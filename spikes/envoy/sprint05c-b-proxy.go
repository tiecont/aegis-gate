// Lab-only adapter for released net/http HTTP/2 ordering research.
// No production parser, config consumer, authorization or engine selection.
package main

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"net/http/httputil"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"sync/atomic"
	"syscall"
	"time"
)

type route struct {
	Host       string `json:"host"`
	OriginName string `json:"origin_name"`
	OriginPort int    `json:"origin_port"`
	CertFile   string `json:"cert_file"`
	KeyFile    string `json:"key_file"`
	H2         bool   `json:"h2"`
}
type manifest struct {
	Generation int     `json:"generation"`
	CAFile     string  `json:"ca_file"`
	Routes     []route `json:"routes"`
}
type entry struct {
	cert      tls.Certificate
	transport *http.Transport
	proxy     *httputil.ReverseProxy
}
type state struct {
	generation int
	routes     map[string]*entry
}

func load(file string) (*state, error) {
	b, err := os.ReadFile(file)
	if err != nil {
		return nil, err
	}
	var m manifest
	if err = json.Unmarshal(b, &m); err != nil {
		return nil, err
	}
	ca, err := os.ReadFile(m.CAFile)
	if err != nil {
		return nil, err
	}
	pool := x509.NewCertPool()
	if !pool.AppendCertsFromPEM(ca) {
		return nil, errors.New("CA required")
	}
	s := &state{generation: m.Generation, routes: make(map[string]*entry)}
	for _, r := range m.Routes {
		cert, err := tls.LoadX509KeyPair(r.CertFile, r.KeyFile)
		if err != nil {
			return nil, err
		}
		protocols := new(http.Protocols)
		protocols.SetHTTP1(!r.H2)
		protocols.SetHTTP2(r.H2)
		tr := &http.Transport{Protocols: protocols,
			TLSClientConfig:     &tls.Config{MinVersion: tls.VersionTLS12, RootCAs: pool, ServerName: r.OriginName},
			DialContext:         (&net.Dialer{Timeout: time.Second}).DialContext,
			TLSHandshakeTimeout: time.Second, ResponseHeaderTimeout: 2 * time.Second,
			IdleConnTimeout: 5 * time.Second, MaxConnsPerHost: 64, MaxIdleConnsPerHost: 16,
			MaxResponseHeaderBytes: 65536}
		p := &httputil.ReverseProxy{Transport: tr, FlushInterval: -1,
			ErrorLog: log.New(io.Discard, "", 0),
			Rewrite: func(pr *httputil.ProxyRequest) {
				pr.Out.URL.Scheme = "https"
				pr.Out.URL.Host = net.JoinHostPort("127.0.0.1", strconv.Itoa(r.OriginPort))
				pr.Out.Host = r.OriginName
				for _, h := range []string{"X-Forwarded-For", "X-Forwarded-Host", "X-Forwarded-Proto", "Forwarded", "X-Tenant-ID", "X-Lab-Generation", "X-Lab-Route"} {
					pr.Out.Header.Del(h)
				}
				pr.Out.Header.Set("X-Lab-Generation", strconv.Itoa(m.Generation))
				pr.Out.Header.Set("X-Lab-Route", r.Host)
			},
			ModifyResponse: func(res *http.Response) error {
				if r.H2 && (res.ProtoMajor != 2 || res.TLS == nil || res.TLS.NegotiatedProtocol != "h2") {
					return errors.New("required upstream h2")
				}
				res.Header.Set("X-Lab-Generation", strconv.Itoa(m.Generation))
				return nil
			},
			ErrorHandler: func(w http.ResponseWriter, _ *http.Request, _ error) { http.Error(w, "origin unavailable", 503) },
		}
		s.routes[r.Host] = &entry{cert: cert, transport: tr, proxy: p}
	}
	return s, nil
}

func main() {
	if len(os.Args) != 3 {
		panic("staged fixture manifest and port required")
	}
	initial, err := load(os.Args[1])
	if err != nil {
		panic("invalid staged fixture")
	}
	var active atomic.Pointer[state]
	active.Store(initial)
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	go func() {
		ticker := time.NewTicker(25 * time.Millisecond)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				// The launcher validates original manifests before atomic staging.
				b, err := os.ReadFile(os.Args[1])
				if err != nil {
					continue
				}
				var m manifest
				if json.Unmarshal(b, &m) != nil || m.Generation <= active.Load().generation {
					continue
				}
				next, err := load(os.Args[1])
				if err != nil {
					continue
				}
				old := active.Swap(next)
				for _, e := range old.routes {
					e.transport.CloseIdleConnections()
				}
				fmt.Printf("applied generation=%d\n", next.generation)
			}
		}
	}()
	protocols := new(http.Protocols)
	protocols.SetHTTP1(true)
	protocols.SetHTTP2(true)
	quota := make(chan struct{}, 64)
	srv := &http.Server{Addr: net.JoinHostPort("127.0.0.1", os.Args[2]), Protocols: protocols,
		ReadHeaderTimeout: 2 * time.Second, IdleTimeout: 5 * time.Second, MaxHeaderBytes: 32768,
		ErrorLog: log.New(io.Discard, "", 0),
		TLSConfig: &tls.Config{MinVersion: tls.VersionTLS12, SessionTicketsDisabled: true,
			GetCertificate: func(hello *tls.ClientHelloInfo) (*tls.Certificate, error) {
				peer, _, err := net.SplitHostPort(hello.Conn.RemoteAddr().String())
				if err != nil || peer != "127.0.0.1" {
					return nil, errors.New("unapproved lab source")
				}
				e := active.Load().routes[hello.ServerName]
				if e == nil {
					return nil, errors.New("unregistered SNI")
				}
				return &e.cert, nil
			}},
		Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			s := active.Load()
			host := r.Host
			if strings.HasSuffix(host, ":443") {
				host = strings.TrimSuffix(host, ":443")
			}
			if r.TLS == nil || host != r.TLS.ServerName || s.routes[host] == nil {
				http.Error(w, "authority denied", 421)
				return
			}
			for _, h := range r.Header.Values("Host") {
				if h != host && h != host+":443" {
					http.Error(w, "authority denied", 421)
					return
				}
			}
			if r.ContentLength > 1048576 {
				http.Error(w, "body too large", 413)
				return
			}
			select {
			case quota <- struct{}{}:
				defer func() { <-quota }()
			default:
				http.Error(w, "busy", 503)
				return
			}
			r.Body = http.MaxBytesReader(w, r.Body, 1048576)
			s.routes[host].proxy.ServeHTTP(w, r)
		}),
	}
	shutdownDone := make(chan struct{})
	go func() {
		<-ctx.Done()
		drain, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		_ = srv.Shutdown(drain)
		close(shutdownDone)
	}()
	if err := srv.ListenAndServeTLS("", ""); err != nil && !errors.Is(err, http.ErrServerClosed) {
		panic("loopback TLS server failed")
	}
	<-shutdownDone
	for _, e := range active.Load().routes {
		e.transport.CloseIdleConnections()
	}
}
