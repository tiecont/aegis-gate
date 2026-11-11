package domain

import (
	"context"
	"net/netip"
	"testing"
)

func TestNegativeSprint02RootNonPublicOriginPrefixes(t *testing.T) {
	for _, raw := range []string{"fec0::1", "3fff::1", "5f00::1", "100:0:0:1::1", "192.88.99.1"} {
		t.Run(raw, func(t *testing.T) {
			address := netip.MustParseAddr(raw)
			if PublicAddress(address) {
				t.Fatalf("non-public origin destination accepted: %s", raw)
			}
			if _, err := Origin(context.Background(), "https://origin.example",
				fixedResolver{netip.MustParseAddr("8.8.8.8"), address}); err == nil {
				t.Fatal("registration accepted mixed public and non-public DNS answers")
			}
		})
	}
	for _, raw := range []string{"8.8.8.8", "1.1.1.1", "2606:4700:4700::1111", "2001:4860:4860::8888"} {
		if !PublicAddress(netip.MustParseAddr(raw)) {
			t.Fatalf("public address control rejected: %s", raw)
		}
	}
}
