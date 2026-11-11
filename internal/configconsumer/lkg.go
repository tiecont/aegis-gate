package configconsumer

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"errors"
	"io"
	"os"
	"path/filepath"
	"sync"
)

// Persistence stores only authenticated ciphertext. Implementations must make a
// successful Save durable before returning. A failed Save never authorizes apply.
type Persistence interface {
	Save(context.Context, []byte) error
	Load(context.Context) ([]byte, error)
}

// CacheKeySource is supplied through authenticated secret-service bootstrap.
// Keys are never carried by snapshots, notifications, or cache files.
type CacheKeySource interface {
	CacheKey(context.Context) ([]byte, error)
}

// DiskLKG owns one encrypted checkpoint. Its directory must be created by the
// operator with mode 0700; a directory shared with other principals is refused.
type DiskLKG struct {
	mu       sync.Mutex
	dir      string
	identity string
	keys     CacheKeySource
	max      int64
}

func NewDiskLKG(dir, identity string, keys CacheKeySource, max int64) (*DiskLKG, error) {
	if identity == "" || len(identity) > 256 || keys == nil || max < 1 || max > 4<<20 {
		return nil, errors.New("invalid cache configuration")
	}
	dir, err := filepath.Abs(dir)
	if err != nil {
		return nil, err
	}
	info, err := os.Lstat(dir)
	if err != nil || !info.IsDir() || info.Mode().Perm() != 0700 {
		return nil, errors.New("cache directory must be private")
	}
	return &DiskLKG{dir: dir, identity: identity, keys: keys, max: max}, nil
}

func (s *DiskLKG) aead(ctx context.Context) (cipher.AEAD, error) {
	key, err := s.keys.CacheKey(ctx)
	if err != nil || len(key) != 32 {
		return nil, errors.New("cache key unavailable")
	}
	// Copy before clearing: secret-service implementations retain ownership.
	local := append([]byte(nil), key...)
	defer clear(local)
	block, err := aes.NewCipher(local)
	if err != nil {
		return nil, err
	}
	return cipher.NewGCM(block)
}

func (s *DiskLKG) Save(ctx context.Context, raw []byte) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := ctx.Err(); err != nil {
		return err
	}
	if len(raw) == 0 || int64(len(raw)) > s.max {
		return errors.New("cache size")
	}
	aead, err := s.aead(ctx)
	if err != nil {
		return err
	}
	nonce := make([]byte, aead.NonceSize())
	if _, err = io.ReadFull(rand.Reader, nonce); err != nil {
		return err
	}
	sealed := aead.Seal(nonce, nonce, raw, []byte("AEGISGATE_LKG_V1\x00"+s.identity))
	root, err := os.OpenRoot(s.dir)
	if err != nil {
		return err
	}
	defer root.Close()
	info, err := root.Stat(".")
	if err != nil || info.Mode().Perm() != 0700 {
		return errors.New("cache directory permissions")
	}
	// A unique O_EXCL staging file avoids symlink following or partially replacing
	// the durable checkpoint. Rename followed by directory sync is the commit.
	nameBytes := make([]byte, 16)
	if _, err = rand.Read(nameBytes); err != nil {
		return err
	}
	const hex = "0123456789abcdef"
	name := ".stage-"
	for _, b := range nameBytes {
		name += string([]byte{hex[b>>4], hex[b&15]})
	}
	file, err := root.OpenFile(name, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
	if err != nil {
		return err
	}
	defer root.Remove(name)
	_, err = file.Write(sealed)
	if err == nil {
		err = file.Sync()
	}
	closeErr := file.Close()
	if err != nil {
		return err
	}
	if closeErr != nil {
		return closeErr
	}
	if err = root.Rename(name, "checkpoint.aead"); err != nil {
		return err
	}
	directory, err := root.Open(".")
	if err != nil {
		return err
	}
	defer directory.Close()
	return directory.Sync()
}

func (s *DiskLKG) Load(ctx context.Context) ([]byte, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	aead, err := s.aead(ctx)
	if err != nil {
		return nil, err
	}
	root, err := os.OpenRoot(s.dir)
	if err != nil {
		return nil, err
	}
	defer root.Close()
	dir, err := root.Stat(".")
	if err != nil || dir.Mode().Perm() != 0700 {
		return nil, errors.New("cache directory permissions")
	}
	info, err := root.Lstat("checkpoint.aead")
	if err != nil {
		return nil, err
	}
	if !info.Mode().IsRegular() || info.Mode().Perm() != 0600 || info.Size() > s.max+int64(aead.NonceSize()+aead.Overhead()) {
		return nil, errors.New("unsafe cache file")
	}
	file, err := root.Open("checkpoint.aead")
	if err != nil {
		return nil, err
	}
	defer file.Close()
	sealed, err := io.ReadAll(io.LimitReader(file, s.max+int64(aead.NonceSize()+aead.Overhead())+1))
	if err != nil || len(sealed) < aead.NonceSize()+aead.Overhead() || int64(len(sealed)) > s.max+int64(aead.NonceSize()+aead.Overhead()) {
		return nil, errors.New("invalid cache size")
	}
	return aead.Open(nil, sealed[:aead.NonceSize()], sealed[aead.NonceSize():], []byte("AEGISGATE_LKG_V1\x00"+s.identity))
}
