package domain

import (
	"net/netip"
	"testing"
)

// IANA special-purpose ranges: RFCs 7526, 3879, 9637, 9602, and the
// IPv6 dummy prefix. Registration must not confuse global-unicast with public.
func TestNegativePublicAddressSpecialPurpose(t *testing.T) {
	for _, raw := range []string{"fec0::1", "feff:ffff::1", "3fff::1", "3fff:fff::1", "5f00::1", "5f00:ffff::1", "100:0:0:1::1", "192.88.99.1"} {
		if PublicAddress(netip.MustParseAddr(raw)) {
			t.Errorf("special-purpose address accepted: %s", raw)
		}
	}
	for _, raw := range []string{"8.8.8.8", "93.184.216.34", "1.1.1.1", "2606:4700:4700::1111", "2001:4860:4860::8888"} {
		if !PublicAddress(netip.MustParseAddr(raw)) {
			t.Errorf("public positive control rejected: %s", raw)
		}
	}
}
