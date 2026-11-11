package configpublish

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strings"
	"sync"
	"syscall"
	"time"

	"aegisgate.dev/aegisgate/internal/configsnapshot"
)

var digestPattern = regexp.MustCompile(`^[0-9a-f]{64}$`)

type LocalStore struct {
	root     *os.Root
	endpoint string
	limit    int
	mu       sync.Mutex
}

// OpenLocalStore requires a pre-created owner-only directory. The directory is
// retained by descriptor; digest-only names cannot traverse outside it. Local
// storage is a disposable restricted fixture, not a production object service.
func OpenLocalStore(directory, endpoint string, maxArtifacts int) (*LocalStore, error) {
	info, err := os.Lstat(directory)
	if err != nil || !info.IsDir() || info.Mode().Perm() != 0700 || info.Mode()&os.ModeSymlink != 0 || maxArtifacts < 1 || maxArtifacts > 1024 {
		return nil, ErrUnavailable
	}
	u, err := url.Parse(endpoint)
	if err != nil || u.Scheme != "https" || u.Host == "" || u.Path != "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" {
		return nil, ErrUnavailable
	}
	root, err := os.OpenRoot(directory)
	if err != nil {
		return nil, ErrUnavailable
	}
	return &LocalStore{root: root, endpoint: endpoint, limit: maxArtifacts}, nil
}
func (s *LocalStore) Close() error { return s.root.Close() }
func (s *LocalStore) read(digest string) ([]byte, error) {
	if !digestPattern.MatchString(digest) {
		return nil, ErrUnavailable
	}
	info, err := s.root.Lstat(digest)
	if err != nil || !info.Mode().IsRegular() || info.Mode().Perm() != 0600 || info.Size() < 1 || info.Size() > configsnapshot.MaxArtifactBytes {
		return nil, ErrUnavailable
	}
	f, err := s.root.OpenFile(digest, os.O_RDONLY|syscall.O_NOFOLLOW, 0)
	if err != nil {
		return nil, ErrUnavailable
	}
	defer f.Close()
	info, err = f.Stat()
	if err != nil || !info.Mode().IsRegular() || info.Mode().Perm() != 0600 {
		return nil, ErrUnavailable
	}
	raw, err := io.ReadAll(io.LimitReader(f, configsnapshot.MaxArtifactBytes+1))
	if err != nil || len(raw) > configsnapshot.MaxArtifactBytes {
		return nil, ErrUnavailable
	}
	sum := sha256.Sum256(raw)
	if hex.EncodeToString(sum[:]) != digest {
		return nil, ErrUnavailable
	}
	return raw, nil
}
func (s *LocalStore) Put(ctx context.Context, raw []byte) (string, error) {
	if ctx.Err() != nil || len(raw) < 1 || len(raw) > configsnapshot.MaxArtifactBytes {
		return "", ErrUnavailable
	}
	sum := sha256.Sum256(raw)
	digest := hex.EncodeToString(sum[:])
	location := s.endpoint + "/artifacts/" + digest
	s.mu.Lock()
	defer s.mu.Unlock()
	lock, err := s.root.OpenFile(".lock", os.O_CREATE|os.O_RDWR|syscall.O_NOFOLLOW, 0600)
	if err != nil {
		return "", ErrUnavailable
	}
	defer lock.Close()
	// Non-blocking file lock keeps admission bounded across separate workers.
	if syscall.Flock(int(lock.Fd()), syscall.LOCK_EX|syscall.LOCK_NB) != nil {
		return "", ErrUnavailable
	}
	defer syscall.Flock(int(lock.Fd()), syscall.LOCK_UN)
	if _, err = s.root.Lstat(digest); err == nil {
		existing, e := s.read(digest)
		if e != nil || !bytes.Equal(existing, raw) {
			return "", ErrUnavailable
		}
		return location, nil
	} else if !os.IsNotExist(err) {
		return "", ErrUnavailable
	}
	directory, err := s.root.Open(".")
	if err != nil {
		return "", ErrUnavailable
	}
	defer directory.Close()
	// A process crash may leave a staged file. The cross-process exclusive
	// lock proves no live writer is using it; remove this digest's stale stage
	// before quota admission so retry cannot deadlock on its own partial write.
	temp := ".stage-" + digest
	if info, e := s.root.Lstat(temp); e == nil {
		if !info.Mode().IsRegular() || info.Mode().Perm() != 0600 || s.root.Remove(temp) != nil {
			return "", ErrUnavailable
		}
	} else if !os.IsNotExist(e) {
		return "", ErrUnavailable
	}
	entries, err := directory.ReadDir(s.limit + 2)
	if err != nil && err != io.EOF {
		return "", ErrUnavailable
	}
	if len(entries) >= s.limit+1 {
		return "", ErrUnavailable
	} // includes .lock
	file, err := s.root.OpenFile(temp, os.O_CREATE|os.O_EXCL|os.O_WRONLY|syscall.O_NOFOLLOW, 0600)
	if err != nil {
		return "", ErrUnavailable
	}
	defer s.root.Remove(temp)
	if _, err = file.Write(raw); err == nil {
		err = file.Sync()
	}
	closeErr := file.Close()
	if err != nil || closeErr != nil || ctx.Err() != nil {
		return "", ErrUnavailable
	}
	// Link is an atomic create-if-absent; an immutable object is never replaced.
	if err = s.root.Link(temp, digest); err != nil {
		return "", ErrUnavailable
	}
	if err = directory.Sync(); err != nil {
		return "", ErrUnavailable
	}
	return location, nil
}

// Handler authorizes verified client URI identities for explicit deployments.
// Both server-side chain verification and per-deployment authorization are
// mandatory; possession of a certificate from the CA alone grants no access.
func (s *LocalStore) Handler(identities map[string][]string) http.Handler {
	allowed := map[string]map[string]bool{}
	for identity, deployments := range identities {
		allowed[identity] = map[string]bool{}
		for _, d := range deployments {
			allowed[identity][d] = true
		}
	}
	slots := make(chan struct{}, 32)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		deny := func(status int) { http.Error(w, "artifact unavailable", status) }
		if r.Method != http.MethodGet || r.URL.RawQuery != "" || r.URL.RawPath != "" || !strings.HasPrefix(r.URL.Path, "/artifacts/") {
			deny(http.StatusNotFound)
			return
		}
		if r.TLS == nil || len(r.TLS.VerifiedChains) == 0 || len(r.TLS.PeerCertificates) == 0 {
			deny(http.StatusForbidden)
			return
		}
		select {
		case slots <- struct{}{}:
			defer func() { <-slots }()
		default:
			deny(http.StatusServiceUnavailable)
			return
		}
		raw, err := s.read(strings.TrimPrefix(r.URL.Path, "/artifacts/"))
		if err != nil {
			deny(http.StatusNotFound)
			return
		}
		var envelope struct {
			DeploymentID string `json:"deployment_id"`
		}
		if json.Unmarshal(raw, &envelope) != nil {
			deny(http.StatusNotFound)
			return
		}
		authorized := false
		for _, identity := range r.TLS.PeerCertificates[0].URIs {
			if allowed[identity.String()][envelope.DeploymentID] {
				authorized = true
			}
		}
		if !authorized {
			deny(http.StatusForbidden)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "private, immutable")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Content-Length", stringLength(len(raw)))
		_, _ = w.Write(raw)
	})
}
func stringLength(n int) string { // avoid formatting candidate data in diagnostics
	const digits = "0123456789"
	if n == 0 {
		return "0"
	}
	var buf [20]byte
	i := len(buf)
	for n > 0 {
		i--
		buf[i] = digits[n%10]
		n /= 10
	}
	return string(buf[i:])
}

// Prune removes a bounded batch older than24h. The caller must hold its
// deployment/rollout retention coordination lock and supply every active,
// in-flight, pending and rollback-reserved digest in keep. This method does not
// infer authority or delete immutable database approval/audit history.
func (s *LocalStore) Prune(ctx context.Context, keep []string, before time.Time, batch int) (int, error) {
	if ctx.Err() != nil || len(keep) > 1024 || batch < 1 || batch > 64 || before.After(time.Now().Add(-24*time.Hour)) {
		return 0, ErrUnavailable
	}
	protected := map[string]bool{}
	for _, d := range keep {
		if !digestPattern.MatchString(d) {
			return 0, ErrUnavailable
		}
		protected[d] = true
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	lock, err := s.root.OpenFile(".lock", os.O_CREATE|os.O_RDWR|syscall.O_NOFOLLOW, 0600)
	if err != nil {
		return 0, ErrUnavailable
	}
	defer lock.Close()
	if syscall.Flock(int(lock.Fd()), syscall.LOCK_EX|syscall.LOCK_NB) != nil {
		return 0, ErrUnavailable
	}
	defer syscall.Flock(int(lock.Fd()), syscall.LOCK_UN)
	directory, err := s.root.Open(".")
	if err != nil {
		return 0, ErrUnavailable
	}
	defer directory.Close()
	entries, err := directory.ReadDir(s.limit + 2)
	if err != nil && err != io.EOF {
		return 0, ErrUnavailable
	}
	deleted := 0
	for _, entry := range entries {
		if ctx.Err() != nil {
			return deleted, ctx.Err()
		}
		if deleted >= batch {
			break
		}
		if !digestPattern.MatchString(entry.Name()) || protected[entry.Name()] {
			continue
		}
		info, err := s.root.Lstat(entry.Name())
		if err != nil || !info.Mode().IsRegular() || info.Mode().Perm() != 0600 || !info.ModTime().Before(before) {
			continue
		}
		if _, err = s.read(entry.Name()); err != nil {
			return deleted, ErrUnavailable
		}
		if err = s.root.Remove(entry.Name()); err != nil {
			return deleted, ErrUnavailable
		}
		deleted++
	}
	if deleted > 0 && directory.Sync() != nil {
		return deleted, ErrUnavailable
	}
	return deleted, nil
}
