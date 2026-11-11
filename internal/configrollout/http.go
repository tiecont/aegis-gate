package configrollout

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"aegisgate.dev/aegisgate/internal/configconsumer"
)

type Report struct {
	ACK     configconsumer.Ack `json:"ack"`
	Healthy bool               `json:"healthy"`
}

// ACKHandler requires TLS verification at the server and derives edge identity
// from a pinned URI SAN registry. No edge ID from JSON or headers is accepted.
// The server must use RequireAndVerifyClientCert and bounded HTTP timeouts.
func ACKHandler(controller *Controller, identities map[string]string) (http.Handler, error) {
	if controller == nil || len(identities) == 0 || len(identities) > MaxEdges {
		return nil, ErrDenied
	}
	registry := make(map[string]string, len(identities))
	edges := map[string]bool{}
	for uri, edge := range identities {
		if len(uri) > 256 || !idPattern.MatchString(edge) || edges[edge] {
			return nil, ErrDenied
		}
		registry[uri] = edge
		edges[edge] = true
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		if r.Method != http.MethodPost || r.URL.Path != "/acks" || r.URL.RawQuery != "" {
			http.Error(w, "denied", http.StatusNotFound)
			return
		}
		if r.TLS == nil || len(r.TLS.VerifiedChains) == 0 || len(r.TLS.PeerCertificates) == 0 {
			http.Error(w, "denied", http.StatusUnauthorized)
			return
		}
		identity := ""
		for _, uri := range r.TLS.PeerCertificates[0].URIs {
			if edge, ok := registry[uri.String()]; ok {
				if identity != "" && identity != edge {
					http.Error(w, "denied", http.StatusForbidden)
					return
				}
				identity = edge
			}
		}
		if identity == "" {
			http.Error(w, "denied", http.StatusForbidden)
			return
		}
		body := http.MaxBytesReader(w, r.Body, 4096)
		defer body.Close()
		decoder := json.NewDecoder(body)
		decoder.DisallowUnknownFields()
		var report Report
		if decoder.Decode(&report) != nil || decoder.Decode(new(any)) != io.EOF {
			http.Error(w, "invalid_report", http.StatusBadRequest)
			return
		}
		var err error
		for attempt := 0; attempt < 3; attempt++ {
			err = controller.Record(r.Context(), identity, report.ACK, report.Healthy)
			if !errors.Is(err, ErrConflict) {
				break
			}
		}
		if err != nil {
			http.Error(w, "report_rejected", http.StatusConflict)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}), nil
}
