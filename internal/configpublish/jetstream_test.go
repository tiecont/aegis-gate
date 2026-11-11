package configpublish

import (
	"context"
	"encoding/json"
	"os"
	"testing"
	"time"

	"aegisgate.dev/aegisgate/packages/test-fixtures/configlab"
	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"
)

func TestIntegrationJetStreamMutualTLSBoundedDurabilityNegative(t *testing.T) {
	if os.Getenv("AEGIS_TENANCY_INTEGRATION") != "1" {
		t.Skip("explicit owned-loopback Docker integration requires AEGIS_TENANCY_INTEGRATION=1")
	}
	fixture := configlab.StartNATS(t)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	operator, err := ConnectJetStream(fixture.Endpoint, fixture.ClientTLS("operator"))
	if err != nil {
		t.Fatal("operator TLS", err)
	}
	defer operator.Close()
	if err = operator.Provision(ctx); err != nil {
		t.Fatal("provision", err)
	}
	publisher, err := ConnectJetStream(fixture.Endpoint, fixture.ClientTLS("publisher"))
	if err != nil {
		t.Fatal("publisher TLS", err)
	}
	defer publisher.Close()
	digest := "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	n := Notification{DeploymentID: "deployment-a", Generation: 1, Digest: digest, Location: "https://artifacts.example.com/artifacts/" + digest}
	if err = publisher.Publish(ctx, n); err != nil {
		t.Fatal(err)
	}
	if err = publisher.Publish(ctx, n); err != nil {
		t.Fatal("idempotent retry", err)
	}
	stream, err := operator.js.Stream(ctx, RolloutStream)
	if err != nil {
		t.Fatal(err)
	}
	info, err := stream.Info(ctx)
	if err != nil || info.State.Msgs != 1 {
		t.Fatal("duplicate durable publication", err)
	}
	consumer, err := operator.js.CreateOrUpdateConsumer(ctx, RolloutStream, jetstream.ConsumerConfig{Durable: "planner", FilterSubject: RolloutSubject, AckPolicy: jetstream.AckExplicitPolicy, AckWait: time.Second, MaxAckPending: 16, MaxDeliver: 8})
	if err != nil {
		t.Fatal(err)
	}
	message, err := consumer.Next(jetstream.FetchMaxWait(time.Second))
	if err != nil {
		t.Fatal(err)
	}
	var got Notification
	if json.Unmarshal(message.Data(), &got) != nil || got != n {
		t.Fatal("notification bytes")
	}
	// Leave this delivery unacknowledged; restart must preserve both approved
	// notification and durable consumer state, then redeliver for recovery.
	if err = fixture.Stop(ctx); err != nil {
		t.Fatal(err)
	}
	if err = publisher.Publish(ctx, n); err == nil {
		t.Fatal("messaging outage ignored")
	}
	if err = fixture.Restart(ctx); err != nil {
		t.Fatal(err)
	}
	restored, err := ConnectJetStream(fixture.Endpoint, fixture.ClientTLS("planner"))
	if err != nil {
		t.Fatal(err)
	}
	defer restored.Close()
	resumed, err := restored.js.Consumer(ctx, RolloutStream, "planner")
	if err != nil {
		t.Fatal("durable consumer lost", err)
	}
	message, err = resumed.Next(jetstream.FetchMaxWait(3 * time.Second))
	if err != nil {
		t.Fatal("redelivery after restart", err)
	}
	if json.Unmarshal(message.Data(), &got) != nil || got != n {
		t.Fatal("recovered bytes changed")
	}
	if err = message.DoubleAck(ctx); err != nil {
		t.Fatal("durable ACK", err)
	}
	// No client certificate, wrong server identity and unmapped signed client
	// identity each fail authentication. TLS verification is never disabled.
	missing := fixture.ClientTLS("publisher")
	missing.Certificates = nil
	if _, err = ConnectJetStream(fixture.Endpoint, missing); err == nil {
		t.Fatal("missing client certificate accepted")
	}
	wrong := fixture.ClientTLS("publisher")
	wrong.ServerName = "wrong.example.com"
	if _, err = ConnectJetStream(fixture.Endpoint, wrong); err == nil {
		t.Fatal("wrong server accepted")
	}
	if untrusted, e := ConnectJetStream(fixture.Endpoint, fixture.ClientTLS("unmapped")); e == nil {
		untrusted.Close()
		t.Fatal("unmapped certificate identity accepted")
	}
	// The publisher role cannot broadcast directly to edges or provision a
	// replacement stream. It is only an admission-notification producer.
	restricted, err := ConnectJetStream(fixture.Endpoint, fixture.ClientTLS("publisher"))
	if err != nil {
		t.Fatal(err)
	}
	defer restricted.Close()
	denied := make(chan error, 1)
	restricted.connection.SetErrorHandler(func(_ *nats.Conn, _ *nats.Subscription, e error) {
		select {
		case denied <- e:
		default:
		}
	})
	if err = restricted.connection.Publish("aegis.edge.canary", []byte("must-deny")); err != nil {
		t.Fatal(err)
	}
	_ = restricted.connection.FlushTimeout(time.Second)
	select {
	case <-denied:
	case <-time.After(time.Second):
		t.Fatal("publisher bypassed rollout subject ACL")
	}
}
