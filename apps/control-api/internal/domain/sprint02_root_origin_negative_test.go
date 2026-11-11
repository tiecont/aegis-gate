package domain

import (
	"net/netip"
	"testing"
)

func TestNegativeSprint02RootNonPublicOriginPrefixes(t *testing.T) {
	for _, raw := range []string{"fec0::1", "3fff::1", "5f00::1", "100:0:0:1::1", "192.88.99.1"} {
		t.Run(raw, func(t *testing.T) {
			if PublicAddress(netip.MustParseAddr(raw)) {
				t.Fatalf("non-public origin destination accepted: %s", raw)
			}
		})
	}
}
