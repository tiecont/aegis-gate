package transport

import (
	"context"
	"net"
	"strings"
	"testing"
	"time"

	"golang.org/x/net/dns/dnsmessage"
)

func (d *labDNS) start(t *testing.T) {
	t.Helper()
	socket, err := net.ListenPacket("udp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	done := make(chan struct{})
	go func() {
		defer close(done)
		buf := make([]byte, 4096)
		for {
			n, peer, err := socket.ReadFrom(buf)
			if err != nil {
				return
			}
			var message dnsmessage.Message
			if message.Unpack(buf[:n]) != nil || len(message.Questions) != 1 {
				continue
			}
			q := message.Questions[0]
			response := dnsmessage.Message{Header: dnsmessage.Header{ID: message.Header.ID, Response: true, Authoritative: true, RecursionDesired: message.Header.RecursionDesired, RecursionAvailable: true}, Questions: message.Questions}
			header := dnsmessage.ResourceHeader{Name: q.Name, Class: dnsmessage.ClassINET, TTL: 1}
			switch q.Type {
			case dnsmessage.TypeA:
				header.Type = dnsmessage.TypeA
				response.Answers = []dnsmessage.Resource{{Header: header, Body: &dnsmessage.AResource{A: [4]byte{93, 184, 216, 34}}}}
			case dnsmessage.TypeTXT:
				d.mu.Lock()
				proof := d.proofs[strings.TrimSuffix(q.Name.String(), ".")]
				d.mu.Unlock()
				if proof != "" {
					header.Type = dnsmessage.TypeTXT
					response.Answers = []dnsmessage.Resource{{Header: header, Body: &dnsmessage.TXTResource{TXT: []string{proof}}}}
				}
			}
			raw, e := response.Pack()
			if e == nil {
				_, _ = socket.WriteTo(raw, peer)
			}
		}
	}()
	d.resolver = &net.Resolver{PreferGo: true, StrictErrors: true, Dial: func(ctx context.Context, network, _ string) (net.Conn, error) {
		return (&net.Dialer{Timeout: time.Second}).DialContext(ctx, network, socket.LocalAddr().String())
	}}
	t.Cleanup(func() { socket.Close(); <-done })
}
