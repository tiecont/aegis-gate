//go:build aegisgate_sprint06a_feasibility

package configsnapshot

import (
	"crypto/ed25519"
	"time"
)

// Sprint06AAdmissionContext is deliberately the only context accepted by this
// build-tagged feasibility hook. It does not extend snapshot v1 or production API.
const Sprint06AAdmissionContext = "AEGISGATE_EXPERIMENTAL_ADMISSION_V1"
const Sprint06AMaxAdmissionBytes = 32 << 10

func Sprint06AAdmissionSigningBytes(raw []byte) ([]byte, error) {
	if len(raw) == 0 || len(raw) > Sprint06AMaxAdmissionBytes {
		return nil, fail("admission_size")
	}
	canonical, err := canonicalRaw(raw)
	if err != nil {
		return nil, err
	}
	return append([]byte(Sprint06AAdmissionContext+"\x00"), canonical...), nil
}

// VerifySprint06AAdmission uses the same immutable, root-authenticated key state
// as Verify, including current bundle expiry, key retirement and creation time.
// The caller must validate the versioned sidecar and its exact snapshot binding.
func (s *TrustStore) VerifySprint06AAdmission(raw, signature []byte, keyID string, createdAt, now time.Time) error {
	if len(signature) != ed25519.SignatureSize || !identifier(keyID) {
		return fail("admission_signature")
	}
	message, err := Sprint06AAdmissionSigningBytes(raw)
	if err != nil {
		return err
	}
	key, err := s.key(keyID, createdAt, now)
	if err != nil {
		return err
	}
	if !ed25519.Verify(key, message, signature) {
		return fail("admission_signature")
	}
	return nil
}
