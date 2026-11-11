// Package lab generates disposable, unsafe-for-production lab keys. No fixture
// material is shared with production or printed into logs.
package lab

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"math/big"
	"os"
	"path/filepath"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func serial() (*big.Int, error)            { return rand.Int(rand.Reader, new(big.Int).Lsh(big.NewInt(1), 128)) }
func write(path string, data []byte) error { return os.WriteFile(path, data, 0600) }
func keyPEM(key *rsa.PrivateKey) []byte {
	return pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(key)})
}
func certPEM(der []byte) []byte {
	return pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der})
}

// Generate refuses overwrites and creates mode0700 private directories.
func Generate(dir string) error {
	if err := os.Mkdir(dir, 0700); err != nil {
		return fmt.Errorf("new fixture directory required: %w", err)
	}
	if err := os.Chmod(dir, 0700); err != nil {
		return err
	}
	if err := write(filepath.Join(dir, "UNSAFE_LOCAL_ONLY"), []byte("Disposable development CA and JWT key. Never trust in production.\n")); err != nil {
		return err
	}
	now := time.Now().UTC()
	caKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return err
	}
	s, err := serial()
	if err != nil {
		return err
	}
	ca := &x509.Certificate{SerialNumber: s, Subject: pkix.Name{CommonName: "AegisGate UNSAFE LOCAL ONLY CA"}, NotBefore: now.Add(-time.Hour), NotAfter: now.Add(48 * time.Hour), IsCA: true, BasicConstraintsValid: true, KeyUsage: x509.KeyUsageCertSign | x509.KeyUsageCRLSign}
	der, err := x509.CreateCertificate(rand.Reader, ca, ca, &caKey.PublicKey, caKey)
	if err != nil {
		return err
	}
	if err := write(filepath.Join(dir, "ca.pem"), certPEM(der)); err != nil {
		return err
	}
	// Parse generated extensions (including SubjectKeyId) before issuing leaves.
	ca, err = x509.ParseCertificate(der)
	if err != nil {
		return err
	}
	for _, profile := range []struct {
		name, host    string
		before, after time.Time
	}{{"origin-a", "origin-a.test", now.Add(-time.Hour), now.Add(24 * time.Hour)}, {"origin-b", "origin-b.test", now.Add(-time.Hour), now.Add(24 * time.Hour)}, {"wrong-host", "wrong.test", now.Add(-time.Hour), now.Add(24 * time.Hour)}, {"expired", "origin-a.test", now.Add(-48 * time.Hour), now.Add(-24 * time.Hour)}} {
		k, err := rsa.GenerateKey(rand.Reader, 2048)
		if err != nil {
			return err
		}
		s, err := serial()
		if err != nil {
			return err
		}
		cert := &x509.Certificate{SerialNumber: s, Subject: pkix.Name{CommonName: profile.host}, DNSNames: []string{profile.host}, NotBefore: profile.before, NotAfter: profile.after, KeyUsage: x509.KeyUsageDigitalSignature | x509.KeyUsageKeyEncipherment, ExtKeyUsage: []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth}}
		encoded, err := x509.CreateCertificate(rand.Reader, cert, ca, &k.PublicKey, caKey)
		if err != nil {
			return err
		}
		if err := write(filepath.Join(dir, profile.name+".pem"), certPEM(encoded)); err != nil {
			return err
		}
		if err := write(filepath.Join(dir, profile.name+".key"), keyPEM(k)); err != nil {
			return err
		}
	}
	issuerKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return err
	}
	if err := write(filepath.Join(dir, "jwt.key"), keyPEM(issuerKey)); err != nil {
		return err
	}
	jwks := map[string]any{"keys": []any{map[string]any{"kty": "RSA", "kid": "unsafe-local-1", "use": "sig", "alg": "RS256", "n": base64.RawURLEncoding.EncodeToString(issuerKey.N.Bytes()), "e": base64.RawURLEncoding.EncodeToString(big.NewInt(int64(issuerKey.E)).Bytes())}}}
	encoded, err := json.Marshal(jwks)
	if err != nil {
		return err
	}
	if err := write(filepath.Join(dir, "jwks.json"), encoded); err != nil {
		return err
	}
	token := jwt.NewWithClaims(jwt.SigningMethodRS256, jwt.RegisteredClaims{Issuer: "https://issuer.test/", Subject: "unsafe-local-subject", Audience: jwt.ClaimStrings{"unsafe-local-api"}, ExpiresAt: jwt.NewNumericDate(now.Add(15 * time.Minute)), IssuedAt: jwt.NewNumericDate(now), NotBefore: jwt.NewNumericDate(now.Add(-time.Minute))})
	token.Header["kid"] = "unsafe-local-1"
	signed, err := token.SignedString(issuerKey)
	if err != nil {
		return err
	}
	return write(filepath.Join(dir, "valid.jwt"), []byte(signed))
}
