package configpublish

import (
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"os"
	"path/filepath"
	"regexp"
	"syscall"
)

// LocalFileSigner is exclusively a disposable local fixture provider. Production
// must supply configsnapshot.Signer backed by an audited signing secret service.
// Never copy fixture files into source, container layers, logs or production.
type LocalFileSigner struct {
	id      string
	private ed25519.PrivateKey
}

func OpenLocalFileSigner(path, id string) (*LocalFileSigner, error) {
	if !regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$`).MatchString(id) {
		return nil, ErrUnavailable
	}
	dir, err := os.Lstat(filepath.Dir(path))
	if err != nil || !dir.IsDir() || dir.Mode().Perm() != 0700 {
		return nil, ErrUnavailable
	}
	file, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_EXCL|syscall.O_NOFOLLOW, 0600)
	if err == nil {
		_, private, e := ed25519.GenerateKey(rand.Reader)
		if e != nil {
			file.Close()
			return nil, ErrUnavailable
		}
		if _, e = file.Write(private); e == nil {
			e = file.Sync()
		}
		closeErr := file.Close()
		if e != nil || closeErr != nil {
			return nil, ErrUnavailable
		}
	} else if !os.IsExist(err) {
		return nil, ErrUnavailable
	}
	info, err := os.Lstat(path)
	if err != nil || !info.Mode().IsRegular() || info.Mode().Perm() != 0600 || info.Size() != ed25519.PrivateKeySize {
		return nil, ErrUnavailable
	}
	file, err = os.OpenFile(path, os.O_RDONLY|syscall.O_NOFOLLOW, 0)
	if err != nil {
		return nil, ErrUnavailable
	}
	defer file.Close()
	private := make([]byte, ed25519.PrivateKeySize+1)
	n, err := file.Read(private)
	if err != nil || n != ed25519.PrivateKeySize {
		return nil, ErrUnavailable
	}
	private = private[:n]
	derived := ed25519.NewKeyFromSeed(private[:ed25519.SeedSize])
	for i, b := range derived {
		if private[i] != b {
			return nil, ErrUnavailable
		}
	}
	return &LocalFileSigner{id, ed25519.PrivateKey(private)}, nil
}
func (s *LocalFileSigner) KeyID() string { return s.id }
func (s *LocalFileSigner) PublicKey() ed25519.PublicKey {
	return append(ed25519.PublicKey{}, s.private.Public().(ed25519.PublicKey)...)
}
func (s *LocalFileSigner) Sign(ctx context.Context, message []byte) ([]byte, error) {
	if ctx.Err() != nil {
		return nil, ctx.Err()
	}
	return ed25519.Sign(s.private, message), nil
}
