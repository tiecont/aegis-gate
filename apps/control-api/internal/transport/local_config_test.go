package transport

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestNegativePrivateConfigurationFiles(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "config.json")
	if err := os.WriteFile(path, []byte(`{}`), 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := privateFile(path); err != nil {
		t.Fatal("safe config denied")
	}
	if err := os.Chmod(path, 0640); err != nil {
		t.Fatal(err)
	}
	if _, err := privateFile(path); err == nil {
		t.Fatal("group-readable config accepted")
	}
	if err := os.Chmod(path, 0600); err != nil {
		t.Fatal(err)
	}
	link := filepath.Join(dir, "link")
	if err := os.Symlink(path, link); err != nil {
		t.Fatal(err)
	}
	for _, invalid := range []string{link, dir, filepath.Join(dir, "missing")} {
		if _, err := privateFile(invalid); err == nil {
			t.Fatal("unsafe config file accepted")
		}
	}
	if err := os.WriteFile(path, []byte(strings.Repeat("x", 16385)), 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := privateFile(path); err == nil {
		t.Fatal("unbounded config accepted")
	}
	if _, _, _, err := LocalAdminServer(context.Background(), "0.0.0.0:8443", path); err == nil {
		t.Fatal("public management listener accepted")
	}
}

func TestNegativeAdminRateLimitsBounded(t *testing.T) {
	h := &adminHandler{limits: map[string]window{}}
	for range 120 {
		if !h.allow("actor", 120) {
			t.Fatal("valid budget denied")
		}
	}
	if h.allow("actor", 120) {
		t.Fatal("admin rate limit bypass")
	}
	h.limits["actor"] = window{start: time.Now().Add(-time.Minute), count: 120}
	if !h.allow("actor", 120) {
		t.Fatal("window did not expire")
	}
	for len(h.limits) < 4096 {
		key := strings.Repeat("a", len(h.limits)+1)
		if !h.allow(key, 1) {
			t.Fatal("bounded map failed")
		}
	}
	if h.allow("overflow", 1) || len(h.limits) != 4096 {
		t.Fatal("limiter map unbounded")
	}
}
