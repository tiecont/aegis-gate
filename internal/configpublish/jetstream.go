package configpublish

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"net/url"
	"strconv"
	"time"

	"aegisgate.dev/aegisgate/internal/configsnapshot"
	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"
)

const RolloutSubject = "aegis.config.rollout"
const RolloutStream = "AEGIS_CONFIG_ROLLOUT"

type JetStream struct {
	connection *nats.Conn
	js         jetstream.JetStream
}

// ConnectJetStream requires pinned server trust and a client certificate.
// Redirect/reconnect discovery is disabled: only the explicit endpoint may be
// contacted. Credentials are never logged. This subject admits a rollout; it
// does not authorize direct expansion to every edge.
func ConnectJetStream(endpoint string, config *tls.Config) (*JetStream, error) {
	u, err := url.Parse(endpoint)
	if err != nil || u.Scheme != "tls" || u.Host == "" || u.User != nil || u.Path != "" || u.RawQuery != "" || u.Fragment != "" || config == nil || config.InsecureSkipVerify || config.RootCAs == nil || config.ServerName == "" || len(config.Certificates) == 0 || config.MinVersion < tls.VersionTLS12 {
		return nil, ErrUnavailable
	}
	conn, err := nats.Connect(endpoint, nats.Secure(config.Clone()), nats.NoReconnect(), nats.DontRandomize(), nats.IgnoreDiscoveredServers(), nats.Timeout(3*time.Second), nats.ReconnectBufSize(0), nats.PingInterval(10*time.Second), nats.MaxPingsOutstanding(2))
	if err != nil {
		return nil, ErrUnavailable
	}
	js, err := jetstream.New(conn)
	if err != nil {
		conn.Close()
		return nil, ErrUnavailable
	}
	return &JetStream{conn, js}, nil
}
func (j *JetStream) Close() { j.connection.Close() }

// Provision is an explicit local operator operation. Production separates
// stream provisioning permissions from worker publish permissions.
func (j *JetStream) Provision(ctx context.Context) error {
	_, err := j.js.CreateOrUpdateStream(ctx, jetstream.StreamConfig{Name: RolloutStream, Subjects: []string{RolloutSubject}, Retention: jetstream.LimitsPolicy, Storage: jetstream.FileStorage, MaxMsgs: 10000, MaxBytes: 32 << 20, MaxMsgSize: 4096, MaxAge: 24 * time.Hour, Duplicates: 24 * time.Hour, MaxConsumers: 32, Discard: jetstream.DiscardNew, Replicas: 1})
	if err != nil {
		return ErrUnavailable
	}
	return nil
}
func (j *JetStream) Publish(ctx context.Context, n Notification) error {
	if n.DeploymentID == "" || len(n.DeploymentID) > 128 || n.Generation == 0 || n.Generation > configsnapshot.MaxGeneration || !digestPattern.MatchString(n.Digest) {
		return ErrUnavailable
	}
	u, err := url.Parse(n.Location)
	if err != nil || u.Scheme != "https" || u.Host == "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" || u.Path != "/artifacts/"+n.Digest {
		return ErrUnavailable
	}
	raw, err := json.Marshal(n)
	if err != nil || len(raw) > 4096 {
		return ErrUnavailable
	}
	_, err = j.js.Publish(ctx, RolloutSubject, raw, jetstream.WithMsgID(n.DeploymentID+":"+strconv.FormatUint(n.Generation, 10)), jetstream.WithExpectStream(RolloutStream))
	if err != nil {
		return ErrUnavailable
	}
	return nil
}
