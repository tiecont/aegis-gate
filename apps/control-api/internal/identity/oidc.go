// Package identity verifies management login ID tokens. These tokens never
// select a tenant and are never accepted as customer traffic credentials.
package identity

import (
	"bytes"
	"context"
	"crypto/subtle"
	"crypto/tls"
	"crypto/x509"
	"errors"
	"io"
	"net/http"
	"net/url"
	"time"

	"github.com/coreos/go-oidc/v3/oidc"
	"golang.org/x/oauth2"
)

var ErrLogin = errors.New("login unavailable")

type Login struct {
	Issuer, Subject string
	ExpiresAt       time.Time
}
type Verifier struct {
	verifier       *oidc.IDTokenVerifier
	issuer, client string
	endpoint       oauth2.Endpoint
	httpClient     *http.Client
}

type boundedTransport struct {
	base   http.RoundTripper
	origin string
}

func (t boundedTransport) RoundTrip(r *http.Request) (*http.Response, error) {
	if r.URL.Scheme != "https" || r.URL.User != nil || r.URL.Host != t.origin || r.URL.Fragment != "" {
		return nil, ErrLogin
	}
	response, err := t.base.RoundTrip(r)
	if err != nil {
		return nil, ErrLogin
	}
	if response.ContentLength > 1<<20 {
		response.Body.Close()
		return nil, ErrLogin
	}
	body, err := io.ReadAll(io.LimitReader(response.Body, (1<<20)+1))
	response.Body.Close()
	if err != nil || len(body) > 1<<20 {
		return nil, ErrLogin
	}
	response.Body = io.NopCloser(bytes.NewReader(body))
	return response, nil
}

func New(ctx context.Context, issuer, client string) (*Verifier, error) {
	return newWithRoots(ctx, issuer, client, nil)
}

// NewWithRoots uses an explicitly configured CA pool with full hostname and
// certificate verification. It supports private IdPs and owned TLS fixtures.
func NewWithRoots(ctx context.Context, issuer, client string, roots *x509.CertPool) (*Verifier, error) {
	return newWithRoots(ctx, issuer, client, roots)
}

func newWithRoots(ctx context.Context, issuer, client string, roots *x509.CertPool) (*Verifier, error) {
	u, err := url.Parse(issuer)
	if err != nil || len(issuer) > 512 || u.Scheme != "https" || u.Hostname() == "" || u.User != nil || u.Opaque != "" || u.Fragment != "" || u.RawQuery != "" || client == "" || len(client) > 256 {
		return nil, ErrLogin
	}
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.Proxy = nil
	transport.TLSClientConfig = &tls.Config{MinVersion: tls.VersionTLS12, RootCAs: roots}
	transport.ResponseHeaderTimeout = 3 * time.Second
	transport.MaxResponseHeaderBytes = 32 << 10
	transport.MaxConnsPerHost = 4
	transport.MaxIdleConnsPerHost = 2
	clientHTTP := &http.Client{Transport: boundedTransport{base: transport, origin: u.Host}, Timeout: 5 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return ErrLogin }}
	ctx = oidc.ClientContext(ctx, clientHTTP)
	provider, err := oidc.NewProvider(ctx, issuer)
	if err != nil {
		return nil, ErrLogin
	}
	endpoint := provider.Endpoint()
	for _, raw := range []string{endpoint.AuthURL, endpoint.TokenURL} {
		if raw == "" {
			continue
		}
		parsed, err := url.Parse(raw)
		if err != nil || parsed.Scheme != "https" || parsed.Host != u.Host || parsed.User != nil || parsed.Fragment != "" {
			return nil, ErrLogin
		}
	}
	return &Verifier{verifier: provider.VerifierContext(ctx, &oidc.Config{ClientID: client, SupportedSigningAlgs: []string{oidc.RS256, oidc.ES256}}), issuer: issuer, client: client, endpoint: endpoint, httpClient: clientHTTP}, nil
}

func (v *Verifier) AuthorizationURL(redirect, state, nonce, verifier string) (string, error) {
	if v.endpoint.AuthURL == "" || len(state) != 43 || len(nonce) != 43 || len(verifier) != 43 {
		return "", ErrLogin
	}
	cfg := oauth2.Config{ClientID: v.client, Endpoint: v.endpoint, RedirectURL: redirect, Scopes: []string{oidc.ScopeOpenID}}
	return cfg.AuthCodeURL(state, oauth2.S256ChallengeOption(verifier), oauth2.SetAuthURLParam("nonce", nonce)), nil
}

func (v *Verifier) Exchange(ctx context.Context, redirect, code, verifier, nonce string) (Login, error) {
	if v.endpoint.TokenURL == "" || len(code) == 0 || len(code) > 2048 || len(verifier) != 43 || len(nonce) != 43 {
		return Login{}, ErrLogin
	}
	cfg := oauth2.Config{ClientID: v.client, Endpoint: v.endpoint, RedirectURL: redirect}
	cfg.Endpoint.AuthStyle = oauth2.AuthStyleInParams
	ctx = context.WithValue(ctx, oauth2.HTTPClient, v.httpClient)
	token, err := cfg.Exchange(ctx, code, oauth2.VerifierOption(verifier))
	if err != nil {
		return Login{}, ErrLogin
	}
	raw, ok := token.Extra("id_token").(string)
	if !ok {
		return Login{}, ErrLogin
	}
	return v.Verify(ctx, raw, nonce)
}

// Verify is a login callback primitive, not an HTTP authentication middleware.
// A future callback must consume its server-stored state/PKCE/nonce exactly once
// before minting a short-lived opaque session in PostgreSQL.
func (v *Verifier) Verify(ctx context.Context, raw, expectedNonce string) (Login, error) {
	if len(raw) == 0 || len(raw) > 16384 || len(expectedNonce) < 32 || len(expectedNonce) > 256 {
		return Login{}, ErrLogin
	}
	token, err := v.verifier.Verify(ctx, raw)
	if err != nil {
		return Login{}, ErrLogin
	}
	var claims struct {
		Nonce           string `json:"nonce"`
		IssuedAt        int64  `json:"iat"`
		NotBefore       *int64 `json:"nbf"`
		AuthorizedParty string `json:"azp"`
	}
	if token.Claims(&claims) != nil || subtle.ConstantTimeCompare([]byte(claims.Nonce), []byte(expectedNonce)) != 1 || token.Subject == "" || len(token.Subject) > 256 {
		return Login{}, ErrLogin
	}
	now := time.Now()
	if claims.IssuedAt == 0 || time.Unix(claims.IssuedAt, 0).After(now.Add(30*time.Second)) || now.Sub(time.Unix(claims.IssuedAt, 0)) > 5*time.Minute {
		return Login{}, ErrLogin
	}
	if claims.NotBefore != nil && time.Unix(*claims.NotBefore, 0).After(now) {
		return Login{}, ErrLogin
	}
	if (claims.AuthorizedParty != "" && claims.AuthorizedParty != v.client) || (len(token.Audience) > 1 && claims.AuthorizedParty != v.client) {
		return Login{}, ErrLogin
	}
	expiry := token.Expiry
	if cap := now.Add(15 * time.Minute); expiry.After(cap) {
		expiry = cap
	}
	return Login{Issuer: v.issuer, Subject: token.Subject, ExpiresAt: expiry}, nil
}
