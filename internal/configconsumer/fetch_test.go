package configconsumer

import (
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"encoding/pem"
	"io"
	"log"
	"math/big"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"
)

func authenticatedServer(t *testing.T, handler http.HandlerFunc) (*httptest.Server, *tls.Config) {
	t.Helper()
	public, private, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	now := time.Now()
	ca := &x509.Certificate{SerialNumber: big.NewInt(1), IsCA: true, BasicConstraintsValid: true, NotBefore: now.Add(-time.Minute), NotAfter: now.Add(time.Hour), KeyUsage: x509.KeyUsageCertSign}
	der, err := x509.CreateCertificate(rand.Reader, ca, ca, public, private)
	if err != nil {
		t.Fatal(err)
	}
	ca, err = x509.ParseCertificate(der)
	if err != nil {
		t.Fatal(err)
	}
	pool := x509.NewCertPool()
	pool.AddCert(ca)
	issue := func(serial int64, server bool) tls.Certificate {
		pub, key, err := ed25519.GenerateKey(rand.Reader)
		if err != nil {
			t.Fatal(err)
		}
		uri, _ := url.Parse("spiffe://aegisgate.local/edge/edge-a")
		template := &x509.Certificate{SerialNumber: big.NewInt(serial), NotBefore: now.Add(-time.Minute), NotAfter: now.Add(time.Hour), KeyUsage: x509.KeyUsageDigitalSignature}
		if server {
			template.DNSNames = []string{"artifact.example.com"}
			template.ExtKeyUsage = []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth}
		} else {
			template.URIs = []*url.URL{uri}
			template.ExtKeyUsage = []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth}
		}
		cert, err := x509.CreateCertificate(rand.Reader, template, ca, pub, private)
		if err != nil {
			t.Fatal(err)
		}
		encoded, err := x509.MarshalPKCS8PrivateKey(key)
		if err != nil {
			t.Fatal(err)
		}
		pair, err := tls.X509KeyPair(pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: cert}), pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: encoded}))
		if err != nil {
			t.Fatal(err)
		}
		return pair
	}
	server := httptest.NewUnstartedServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.TLS == nil || len(r.TLS.VerifiedChains) == 0 || len(r.TLS.PeerCertificates[0].URIs) != 1 || r.TLS.PeerCertificates[0].URIs[0].String() != "spiffe://aegisgate.local/edge/edge-a" {
			http.Error(w, "denied", 403)
			return
		}
		handler(w, r)
	}))
	server.Config.ErrorLog = log.New(io.Discard, "", 0)
	server.TLS = &tls.Config{MinVersion: tls.VersionTLS12, Certificates: []tls.Certificate{issue(2, true)}, ClientCAs: pool, ClientAuth: tls.RequireAndVerifyClientCert}
	server.StartTLS()
	t.Cleanup(server.Close)
	return server, &tls.Config{MinVersion: tls.VersionTLS12, RootCAs: pool, ServerName: "artifact.example.com", Certificates: []tls.Certificate{issue(3, false)}}
}

func TestAuthenticatedHTTPSFetchAndEndpointNegatives(t *testing.T) {
	f := setup(t)
	raw, notice := f.artifact(t, 1)
	server, config := authenticatedServer(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/artifacts/"+notice.Digest {
			http.NotFound(w, r)
			return
		}
		w.Write(raw)
	})
	fetcher, err := NewHTTPSFetcher(server.URL, config)
	if err != nil {
		t.Fatal(err)
	}
	defer fetcher.Close()
	notice.Location = server.URL + "/artifacts/" + notice.Digest
	if ack := f.c.FetchApply(context.Background(), notice, fetcher); !ack.Accepted {
		t.Fatalf("authenticated fetch failed: %+v", ack)
	}
	for _, location := range []string{"http://127.0.0.1/artifacts/" + notice.Digest, server.URL + ".attacker.example/artifacts/" + notice.Digest, notice.Location + "?secret=sentinel", notice.Location + "#fragment", server.URL + "/artifacts/../" + notice.Digest, server.URL + "/artifacts/" + strings.ToUpper(notice.Digest)} {
		if body, err := fetcher.Fetch(context.Background(), location); err == nil {
			body.Close()
			t.Errorf("forged location accepted: %s", location)
		}
	}
	wrongName := config.Clone()
	wrongName.ServerName = "wrong.example.com"
	wrong, _ := NewHTTPSFetcher(server.URL, wrongName)
	defer wrong.Close()
	if body, err := wrong.Fetch(context.Background(), notice.Location); err == nil {
		body.Close()
		t.Fatal("wrong server identity accepted")
	}
	untrusted := config.Clone()
	untrusted.RootCAs = x509.NewCertPool()
	wrongCA, _ := NewHTTPSFetcher(server.URL, untrusted)
	defer wrongCA.Close()
	if body, err := wrongCA.Fetch(context.Background(), notice.Location); err == nil {
		body.Close()
		t.Fatal("untrusted server accepted")
	}
	missing := config.Clone()
	missing.Certificates = nil
	if _, err := NewHTTPSFetcher(server.URL, missing); err == nil {
		t.Fatal("missing consumer identity accepted")
	}
	unsafe := config.Clone()
	unsafe.InsecureSkipVerify = true
	if _, err := NewHTTPSFetcher(server.URL, unsafe); err == nil {
		t.Fatal("disabled server verification accepted")
	}
}

func TestNegativeHTTPSRedirectAndArtifactReplacement(t *testing.T) {
	f := setup(t)
	apply(t, f, 1)
	raw, notice := f.artifact(t, 2)
	mode := "redirect"
	server, config := authenticatedServer(t, func(w http.ResponseWriter, r *http.Request) {
		if mode == "redirect" {
			http.Redirect(w, r, "https://untrusted.example.com/", http.StatusFound)
			return
		}
		w.Write(append(raw, byte(' ')))
	})
	fetcher, err := NewHTTPSFetcher(server.URL, config)
	if err != nil {
		t.Fatal(err)
	}
	defer fetcher.Close()
	notice.Location = server.URL + "/artifacts/" + notice.Digest
	if ack := f.c.FetchApply(context.Background(), notice, fetcher); ack.Accepted || ack.Code != "fetch_unavailable" {
		t.Fatalf("redirect accepted: %+v", ack)
	}
	// No handler executes concurrently with this write: the first request is done.
	mode = "replacement"
	if ack := f.c.FetchApply(context.Background(), notice, fetcher); ack.Accepted || ack.Code != "artifact_digest" {
		t.Fatalf("replacement accepted: %+v", ack)
	}
	if f.c.Metrics().AppliedGeneration != 1 || !f.c.Metrics().Ready {
		t.Fatal("rejected fetch lost LKG")
	}
}
