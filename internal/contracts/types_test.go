package contracts

import (
	"regexp"
	"testing"
)

func TestRequestID(t *testing.T) {
	seen := make(map[string]bool)
	for range 1000 {
		id, err := RequestID()
		if err != nil {
			t.Fatal(err)
		}
		if !regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`).MatchString(id) {
			t.Fatalf("invalid UUID: %q", id)
		}
		if seen[id] {
			t.Fatal("duplicate UUID")
		}
		seen[id] = true
	}
}
