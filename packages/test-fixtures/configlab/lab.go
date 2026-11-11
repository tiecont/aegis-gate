// Package configlab owns disposable, loopback-only Module03 integration fixtures.
// Callers must hold /tmp/aegisgate-sprint02-fixtures.lock for the full lifetime.
package configlab

import (
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/hex"
	"encoding/pem"
	"fmt"
	"math/big"
	"net"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/nats-io/nats.go"
)

const NATSImage = "nats:2.15.2-alpine@sha256:afae2fdbe2e326c65e1246cb83b9d05d319188734f3bd577ac8072daae78a10f"

type NATSFixture struct {
	Endpoint  string
	Directory string
	name      string
	roots     *x509.CertPool
	clients   map[string]tls.Certificate
	server    tls.Certificate
}

func certificate(directory, name string, root *x509.Certificate, rootKey ed25519.PrivateKey, server bool) (tls.Certificate, error) {
	pub, key, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return tls.Certificate{}, err
	}
	serial, err := rand.Int(rand.Reader, new(big.Int).Lsh(big.NewInt(1), 120))
	if err != nil {
		return tls.Certificate{}, err
	}
	now := time.Now()
	uri, _ := url.Parse("spiffe://aegisgate.local/" + name)
	template := &x509.Certificate{SerialNumber: serial, Subject: pkix.Name{CommonName: name}, NotBefore: now.Add(-time.Minute), NotAfter: now.Add(2 * time.Hour), KeyUsage: x509.KeyUsageDigitalSignature, URIs: []*url.URL{uri}}
	if server {
		template.ExtKeyUsage = []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth}
		template.IPAddresses = []net.IP{net.ParseIP("127.0.0.1")}
		template.DNSNames = []string{"localhost"}
	} else {
		template.ExtKeyUsage = []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth}
	}
	der, err := x509.CreateCertificate(rand.Reader, template, root, pub, rootKey)
	if err != nil {
		return tls.Certificate{}, err
	}
	keyDER, err := x509.MarshalPKCS8PrivateKey(key)
	if err != nil {
		return tls.Certificate{}, err
	}
	certPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der})
	keyPEM := pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: keyDER})
	if err = os.WriteFile(filepath.Join(directory, name+".pem"), certPEM, 0600); err != nil {
		return tls.Certificate{}, err
	}
	if err = os.WriteFile(filepath.Join(directory, name+".key"), keyPEM, 0600); err != nil {
		return tls.Certificate{}, err
	}
	return tls.X509KeyPair(certPEM, keyPEM)
}

func StartNATS(t testing.TB) *NATSFixture {
	t.Helper()
	directory := t.TempDir()
	if err := os.Chmod(directory, 0700); err != nil {
		t.Fatal(err)
	}
	pub, key, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	now := time.Now()
	root := &x509.Certificate{SerialNumber: big.NewInt(1), Subject: pkix.Name{CommonName: "Disposable Module03 CA"}, NotBefore: now.Add(-time.Minute), NotAfter: now.Add(3 * time.Hour), IsCA: true, BasicConstraintsValid: true, KeyUsage: x509.KeyUsageCertSign | x509.KeyUsageCRLSign}
	der, err := x509.CreateCertificate(rand.Reader, root, root, pub, key)
	if err != nil {
		t.Fatal(err)
	}
	root, err = x509.ParseCertificate(der)
	if err != nil {
		t.Fatal(err)
	}
	if err = os.WriteFile(filepath.Join(directory, "ca.pem"), pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der}), 0600); err != nil {
		t.Fatal(err)
	}
	roots := x509.NewCertPool()
	roots.AddCert(root)
	serial := make([]byte, 8)
	if _, err = rand.Read(serial); err != nil {
		t.Fatal(err)
	}
	f := &NATSFixture{Directory: directory, name: "aegisgate-config-" + hex.EncodeToString(serial), roots: roots, clients: map[string]tls.Certificate{}}
	f.server, err = certificate(directory, "server", root, key, true)
	if err != nil {
		t.Fatal(err)
	}
	for _, identity := range []string{"operator", "publisher", "planner", "edge-a", "edge-b", "unmapped"} {
		f.clients[identity], err = certificate(directory, identity, root, key, false)
		if err != nil {
			t.Fatal(err)
		}
	}
	// Only fixture operator/planner can provision/read. Publisher is restricted
	// to the rollout admission subject; it cannot emit edge group commands.
	config := `listen: "0.0.0.0:4222"
max_connections: 32
max_payload: 8192
jetstream { store_dir: /data, max_memory_store: 16MB, max_file_store: 64MB }
tls { cert_file: "/fixtures/server.pem", key_file: "/fixtures/server.key", ca_file: "/fixtures/ca.pem", verify_and_map: true, timeout: 2 }
authorization { users: [
 { user: "spiffe://aegisgate.local/operator", permissions: { publish: [">"], subscribe: [">"] } },
 { user: "spiffe://aegisgate.local/planner", permissions: { publish: [">"], subscribe: [">"] } },
 { user: "spiffe://aegisgate.local/publisher", permissions: { publish: ["aegis.config.rollout"], subscribe: ["_INBOX.>"] } }
] }
`
	if err = os.WriteFile(filepath.Join(directory, "nats.conf"), []byte(config), 0600); err != nil {
		t.Fatal(err)
	}
	if err = os.Mkdir(filepath.Join(directory, "data"), 0700); err != nil {
		t.Fatal(err)
	}
	portReservation, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal("owned port reservation unavailable")
	}
	listenAddress := portReservation.Addr().String()
	_ = portReservation.Close()
	cmd := exec.Command("docker", "run", "--detach", "--name", f.name, "--pull=never", "--cap-drop=ALL", "--security-opt=no-new-privileges:true", "--read-only", "--user", fmt.Sprintf("%d:%d", os.Getuid(), os.Getgid()), "--mount", "type=bind,src="+filepath.Join(directory, "data")+",dst=/data", "--publish", listenAddress+":4222", "--mount", "type=bind,src="+directory+",dst=/fixtures,readonly", NATSImage, "-c", "/fixtures/nats.conf")
	if _, err = cmd.Output(); err != nil {
		t.Fatal("owned NATS fixture start unavailable")
	}
	t.Cleanup(func() { _ = exec.Command("docker", "rm", "--force", f.name).Run() })
	output, err := exec.Command("docker", "port", f.name, "4222/tcp").Output()
	if err != nil {
		t.Fatal("owned NATS fixture port unavailable")
	}
	address := strings.TrimSpace(string(output))
	if !strings.HasPrefix(address, "127.0.0.1:") {
		t.Fatal("fixture binding is not loopback")
	}
	f.Endpoint = "tls://" + address
	if err = f.wait(); err != nil {
		t.Fatal(err)
	}
	return f
}
func (f *NATSFixture) ClientTLS(identity string) *tls.Config {
	cert, ok := f.clients[identity]
	if !ok {
		return nil
	}
	return &tls.Config{MinVersion: tls.VersionTLS12, RootCAs: f.roots.Clone(), ServerName: "127.0.0.1", Certificates: []tls.Certificate{cert}}
}
func (f *NATSFixture) ServerTLS() *tls.Config {
	return &tls.Config{MinVersion: tls.VersionTLS12, ClientCAs: f.roots.Clone(), ClientAuth: tls.RequireAndVerifyClientCert, Certificates: []tls.Certificate{f.server}}
}
func (f *NATSFixture) Stop(ctx context.Context) error {
	if err := exec.CommandContext(ctx, "docker", "stop", "--time", "1", f.name).Run(); err != nil {
		return fmt.Errorf("owned NATS stop unavailable")
	}
	return nil
}
func (f *NATSFixture) Restart(ctx context.Context) error {
	if err := exec.CommandContext(ctx, "docker", "start", f.name).Run(); err != nil {
		return fmt.Errorf("owned NATS restart unavailable")
	}
	return f.wait()
}
func (f *NATSFixture) wait() error {
	deadline := time.Now().Add(10 * time.Second)
	for time.Now().Before(deadline) {
		conn, err := nats.Connect(f.Endpoint, nats.Secure(f.ClientTLS("operator")), nats.NoReconnect(), nats.Timeout(500*time.Millisecond), nats.IgnoreDiscoveredServers())
		if err == nil {
			err = conn.FlushTimeout(500 * time.Millisecond)
			conn.Close()
			if err == nil {
				return nil
			}
		}
		time.Sleep(50 * time.Millisecond)
	}
	return fmt.Errorf("owned NATS fixture readiness timeout")
}
