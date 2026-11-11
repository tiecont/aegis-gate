// config-publisher provides a deliberately explicit local-only execution mode.
// Production signing/key provisioning remains behind configsnapshot.Signer.
package main

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/hex"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"aegisgate.dev/aegisgate/apps/control-api/publication"
	"aegisgate.dev/aegisgate/internal/configpublish"
	"aegisgate.dev/aegisgate/internal/configsnapshot"
	"aegisgate.dev/aegisgate/internal/contracts"
	"golang.org/x/net/netutil"
)

type localSettings struct {
	DatabaseDSNFile           string              `json:"database_dsn_file"`
	ArtifactDirectory         string              `json:"artifact_directory"`
	ArtifactEndpoint          string              `json:"artifact_endpoint"`
	ArtifactListen            string              `json:"artifact_listen"`
	ArtifactCertificateFile   string              `json:"artifact_certificate_file"`
	ArtifactKeyFile           string              `json:"artifact_key_file"`
	ConsumerDeployments       map[string][]string `json:"consumer_deployments"`
	NATSEndpoint              string              `json:"nats_endpoint"`
	NATSClientCertificateFile string              `json:"nats_client_certificate_file"`
	NATSClientKeyFile         string              `json:"nats_client_key_file"`
	NATSCAFile                string              `json:"nats_ca_file"`
	NATSServerName            string              `json:"nats_server_name"`
	ArtifactClientCAFile      string              `json:"artifact_client_ca_file"`
	SigningKeyFile            string              `json:"signing_key_file"`
	SigningKeyID              string              `json:"signing_key_id"`
	PublicKeyOutput           string              `json:"public_key_output"`
}

func privateFile(path string) ([]byte, error) {
	info, err := os.Lstat(path)
	if err != nil || !info.Mode().IsRegular() || info.Mode().Perm() != 0600 || info.Size() > 65536 {
		return nil, configpublish.ErrUnavailable
	}
	return os.ReadFile(path)
}
func certPool(path string) (*x509.CertPool, error) {
	raw, err := privateFile(path)
	if err != nil {
		return nil, err
	}
	pool := x509.NewCertPool()
	if !pool.AppendCertsFromPEM(raw) {
		return nil, configpublish.ErrUnavailable
	}
	return pool, nil
}
func localRun(ctx context.Context, path string) error {
	raw, err := privateFile(path)
	if err != nil {
		return err
	}
	var settings localSettings
	decoder := json.NewDecoder(strings.NewReader(string(raw)))
	decoder.DisallowUnknownFields()
	if decoder.Decode(&settings) != nil || decoder.Decode(new(any)) != io.EOF {
		return configpublish.ErrUnavailable
	}
	host, _, err := net.SplitHostPort(settings.ArtifactListen)
	if err != nil || net.ParseIP(host) == nil || !net.ParseIP(host).IsLoopback() || settings.ArtifactEndpoint != "https://"+settings.ArtifactListen || len(settings.ConsumerDeployments) == 0 {
		return configpublish.ErrUnavailable
	}
	dsn, err := privateFile(settings.DatabaseDSNFile)
	if err != nil {
		return err
	}
	runtime, err := publication.Open(ctx, strings.TrimSpace(string(dsn)))
	if err != nil {
		return err
	}
	defer runtime.Close()
	signer, err := configpublish.OpenLocalFileSigner(settings.SigningKeyFile, settings.SigningKeyID)
	if err != nil {
		return err
	}
	// Public key bootstrap output is private local material requiring explicit
	// authenticated installation by the operator; never learned from messaging.
	pub := []byte(hex.EncodeToString(signer.PublicKey()) + "\n")
	output, err := os.OpenFile(settings.PublicKeyOutput, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
	if err == nil {
		_, err = output.Write(pub)
		closeErr := output.Close()
		if err != nil || closeErr != nil {
			return configpublish.ErrUnavailable
		}
	} else {
		existing, e := privateFile(settings.PublicKeyOutput)
		if e != nil || string(existing) != string(pub) {
			return configpublish.ErrUnavailable
		}
	}
	now := time.Now().UTC().Truncate(time.Second)
	trust, err := configsnapshot.NewTrustStore([]configsnapshot.TrustedKey{{ID: signer.KeyID(), PublicKey: signer.PublicKey(), NotBefore: now.Add(-24 * time.Hour), NotAfter: now.Add(24 * time.Hour)}})
	if err != nil {
		return err
	}
	serverRoots, err := certPool(settings.NATSCAFile)
	if err != nil {
		return err
	}
	if _, err = privateFile(settings.NATSClientKeyFile); err != nil {
		return err
	}
	client, err := tls.LoadX509KeyPair(settings.NATSClientCertificateFile, settings.NATSClientKeyFile)
	if err != nil {
		return configpublish.ErrUnavailable
	}
	bus, err := configpublish.ConnectJetStream(settings.NATSEndpoint, &tls.Config{MinVersion: tls.VersionTLS12, RootCAs: serverRoots, ServerName: settings.NATSServerName, Certificates: []tls.Certificate{client}})
	if err != nil {
		return err
	}
	defer bus.Close()
	store, err := configpublish.OpenLocalStore(settings.ArtifactDirectory, settings.ArtifactEndpoint, 256)
	if err != nil {
		return err
	}
	defer store.Close()
	clientRoots, err := certPool(settings.ArtifactClientCAFile)
	if err != nil {
		return err
	}
	if _, err = privateFile(settings.ArtifactKeyFile); err != nil {
		return err
	}
	serverCert, err := tls.LoadX509KeyPair(settings.ArtifactCertificateFile, settings.ArtifactKeyFile)
	if err != nil {
		return configpublish.ErrUnavailable
	}
	listener, err := net.Listen("tcp", settings.ArtifactListen)
	if err != nil {
		return configpublish.ErrUnavailable
	}
	server := &http.Server{Handler: store.Handler(settings.ConsumerDeployments), ReadHeaderTimeout: 3 * time.Second, ReadTimeout: 5 * time.Second, WriteTimeout: 5 * time.Second, IdleTimeout: 30 * time.Second, MaxHeaderBytes: 8192, TLSConfig: &tls.Config{MinVersion: tls.VersionTLS12, ClientCAs: clientRoots, ClientAuth: tls.RequireAndVerifyClientCert, Certificates: []tls.Certificate{serverCert}}}
	serverDone := make(chan error, 1)
	go func() {
		serverDone <- server.Serve(tls.NewListener(netutil.LimitListener(listener, 64), server.TLSConfig))
	}()
	defer func() {
		shutdown, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		_ = server.Shutdown(shutdown)
	}()
	worker := configpublish.Worker{Queue: runtime.Queue(), Store: store, Notifier: bus, Signer: signer, Trust: trust, Identity: "local-config-publisher", Lease: 30 * time.Second}
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return nil
		case err = <-serverDone:
			if errors.Is(err, http.ErrServerClosed) {
				return nil
			}
			return configpublish.ErrUnavailable
		case <-ticker.C:
			step, cancel := context.WithTimeout(ctx, 20*time.Second)
			err = worker.RunOnce(step)
			cancel()
			if err != nil && !errors.Is(err, configpublish.ErrEmpty) {
				fmt.Fprintln(os.Stderr, "local publication attempt failed; retry retained")
			}
		}
	}
}
func main() {
	check := flag.Bool("check", false, "emit foundation transport contract and exit")
	local := flag.String("local-config", "", "explicit local fixture configuration; never production")
	flag.Parse()
	if *check {
		id, err := contracts.RequestID()
		if err != nil {
			os.Exit(1)
		}
		if json.NewEncoder(os.Stdout).Encode(contracts.ErrorEnvelope{Error: contracts.ErrorDetail{Code: "not_ready", Message: "Publisher is not configured", RequestID: id}}) != nil {
			os.Exit(1)
		}
		return
	}
	if *local == "" {
		fmt.Fprintln(os.Stderr, "publisher requires explicit local fixture configuration; production secret-service provider not configured")
		os.Exit(2)
	}
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()
	if localRun(ctx, *local) != nil {
		fmt.Fprintln(os.Stderr, "local publisher unavailable")
		os.Exit(1)
	}
}
