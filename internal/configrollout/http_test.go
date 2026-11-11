package configrollout

import (
	"bytes"
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/json"
	"io"
	"log"
	"math/big"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"
)

func testPKI(t *testing.T) (*x509.CertPool, tls.Certificate, func(string) tls.Certificate) {
	t.Helper()
	pub, key, _ := ed25519.GenerateKey(rand.Reader)
	now := time.Now()
	ca := &x509.Certificate{SerialNumber: big.NewInt(1), Subject: pkix.Name{CommonName: "disposable rollout test CA"}, NotBefore: now.Add(-time.Hour), NotAfter: now.Add(time.Hour), IsCA: true, BasicConstraintsValid: true, KeyUsage: x509.KeyUsageCertSign | x509.KeyUsageDigitalSignature}
	der, err := x509.CreateCertificate(rand.Reader, ca, ca, pub, key)
	if err != nil {
		t.Fatal(err)
	}
	cert, err := x509.ParseCertificate(der)
	if err != nil {
		t.Fatal(err)
	}
	pool := x509.NewCertPool()
	pool.AddCert(cert)
	serial := int64(2)
	issue := func(identity string) tls.Certificate {
		serial++
		p, k, _ := ed25519.GenerateKey(rand.Reader)
		tmpl := &x509.Certificate{SerialNumber: big.NewInt(serial), NotBefore: now.Add(-time.Minute), NotAfter: now.Add(time.Hour), KeyUsage: x509.KeyUsageDigitalSignature, ExtKeyUsage: []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth}}
		if identity == "server" {
			tmpl.ExtKeyUsage = []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth}
			tmpl.DNSNames = []string{"localhost"}
			tmpl.IPAddresses = []net.IP{net.ParseIP("127.0.0.1")}
		} else {
			uri, _ := url.Parse(identity)
			tmpl.URIs = []*url.URL{uri}
		}
		d, e := x509.CreateCertificate(rand.Reader, tmpl, cert, p, key)
		if e != nil {
			t.Fatal(e)
		}
		return tls.Certificate{Certificate: [][]byte{d}, PrivateKey: k}
	}
	return pool, issue("server"), issue
}

func TestIntegrationAuthenticatedACKBoundary(t *testing.T) {
	c, _, _, _ := testController(t)
	ctx := context.Background()
	n := notice(1)
	c.Begin(ctx, n, edges(), policy(), 0)
	c.Tick(ctx, n.DeploymentID)
	pool, serverCert, issue := testPKI(t)
	handler, err := ACKHandler(c, map[string]string{"spiffe://aegisgate.local/edge/canary-a": "canary-a"})
	if err != nil {
		t.Fatal(err)
	}
	server := httptest.NewUnstartedServer(handler)
	server.Config.ErrorLog = log.New(io.Discard, "", 0)
	server.Config.ReadHeaderTimeout = time.Second
	server.Config.ReadTimeout = 2 * time.Second
	server.Config.WriteTimeout = 2 * time.Second
	server.TLS = &tls.Config{MinVersion: tls.VersionTLS12, Certificates: []tls.Certificate{serverCert}, ClientAuth: tls.RequireAndVerifyClientCert, ClientCAs: pool}
	server.StartTLS()
	defer server.Close()
	post := func(clientCert *tls.Certificate, ack Report) (int, error) {
		t.Helper()
		config := &tls.Config{RootCAs: pool, MinVersion: tls.VersionTLS12}
		if clientCert != nil {
			config.Certificates = []tls.Certificate{*clientCert}
		}
		transport := &http.Transport{TLSClientConfig: config}
		defer transport.CloseIdleConnections()
		client := &http.Client{Transport: transport, Timeout: 2 * time.Second}
		body, _ := json.Marshal(ack)
		response, e := client.Post(server.URL+"/acks", "application/json", bytes.NewReader(body))
		if e != nil {
			return 0, e
		}
		defer response.Body.Close()
		return response.StatusCode, nil
	}
	clientCert := issue("spiffe://aegisgate.local/edge/canary-a")
	if status, err := post(&clientCert, Report{report(n, true, "applied"), true}); err != nil || status != http.StatusNoContent {
		t.Fatalf("valid mTLS ACK failed status=%d err=%v", status, err)
	}
	unknown := issue("spiffe://aegisgate.local/edge/unknown")
	if status, err := post(&unknown, Report{report(n, true, "applied"), true}); err != nil || status != http.StatusForbidden {
		t.Fatalf("unknown identity not denied status=%d err=%v", status, err)
	}
	if _, err := post(nil, Report{report(n, true, "applied"), true}); err == nil {
		t.Fatal("unauthenticated TLS client accepted")
	}
	wrong := report(n, true, "applied")
	wrong.Generation++
	if status, err := post(&clientCert, Report{wrong, true}); err != nil || status != http.StatusConflict {
		t.Fatal("wrong-generation ACK accepted")
	}
	request := httptest.NewRequest(http.MethodPost, "http://localhost/acks", bytes.NewReader([]byte(`{"edge_id":"canary-a"}`)))
	request.Header.Set("X-Edge-ID", "canary-a")
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusUnauthorized {
		t.Fatal("plaintext/header identity accepted")
	}
}
