package configconsumer

import (
	"context"
	"crypto/tls"
	"errors"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	"aegisgate.dev/aegisgate/internal/configsnapshot"
)

// HTTPSFetcher authenticates both endpoints using independently provisioned TLS
// material. A notification can name only a digest on this fixed artifact origin.
type HTTPSFetcher struct {
	endpoint  string
	client    *http.Client
	transport *http.Transport
}

func NewHTTPSFetcher(endpoint string, config *tls.Config) (*HTTPSFetcher, error) {
	u, err := url.Parse(endpoint)
	if err != nil || u.Scheme != "https" || u.Host == "" || u.User != nil || u.Path != "" || u.RawPath != "" || u.RawQuery != "" || u.ForceQuery || u.Fragment != "" || strings.Contains(endpoint, "#") || config == nil || config.InsecureSkipVerify || config.RootCAs == nil || len(config.Certificates) == 0 || config.Certificates[0].PrivateKey == nil {
		return nil, errors.New("authenticated artifact endpoint required")
	}
	pinned := config.Clone()
	if pinned.MinVersion < tls.VersionTLS12 {
		pinned.MinVersion = tls.VersionTLS12
	}
	if pinned.ServerName == "" {
		pinned.ServerName = u.Hostname()
	}
	transport := &http.Transport{Proxy: nil, TLSClientConfig: pinned, DisableCompression: true, MaxConnsPerHost: 4, MaxIdleConns: 4, MaxIdleConnsPerHost: 4, IdleConnTimeout: 30 * time.Second, TLSHandshakeTimeout: 3 * time.Second, ResponseHeaderTimeout: 3 * time.Second, MaxResponseHeaderBytes: 16 << 10, DialContext: (&net.Dialer{Timeout: 3 * time.Second, KeepAlive: 30 * time.Second}).DialContext}
	client := &http.Client{Transport: transport, Timeout: 5 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return errors.New("artifact redirect denied") }}
	return &HTTPSFetcher{endpoint: endpoint, client: client, transport: transport}, nil
}

func (f *HTTPSFetcher) Fetch(ctx context.Context, location string) (io.ReadCloser, error) {
	if !strings.HasPrefix(location, f.endpoint+"/artifacts/") {
		return nil, errors.New("artifact location denied")
	}
	digest := strings.TrimPrefix(location, f.endpoint+"/artifacts/")
	if safeDigest(digest) != digest || len(digest) != 64 {
		return nil, errors.New("artifact location denied")
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, location, nil)
	if err != nil {
		return nil, errors.New("artifact location denied")
	}
	response, err := f.client.Do(request)
	if err != nil {
		return nil, errors.New("authenticated artifact fetch failed")
	}
	if response.StatusCode != http.StatusOK || response.ContentLength > configsnapshot.MaxArtifactBytes {
		response.Body.Close()
		return nil, errors.New("artifact response denied")
	}
	return &boundedBody{Reader: io.LimitReader(response.Body, configsnapshot.MaxArtifactBytes+1), Closer: response.Body}, nil
}

func (f *HTTPSFetcher) Close() { f.transport.CloseIdleConnections() }

type boundedBody struct {
	io.Reader
	io.Closer
}
