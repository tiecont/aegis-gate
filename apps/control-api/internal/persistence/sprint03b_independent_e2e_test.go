package persistence

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/tls"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"aegisgate.dev/aegisgate/internal/configconsumer"
	"aegisgate.dev/aegisgate/internal/configpublish"
	"aegisgate.dev/aegisgate/internal/configrollout"
	"aegisgate.dev/aegisgate/internal/configsnapshot"
	"aegisgate.dev/aegisgate/packages/test-fixtures/configlab"
	"github.com/jackc/pgx/v5"
	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"
)

type reviewCacheKey []byte

func (k reviewCacheKey) CacheKey(context.Context) ([]byte, error) { return k, nil }

type reviewDispatch struct {
	consumers map[string]*configconsumer.Consumer
	fetchers  map[string]*configconsumer.HTTPSFetcher
	clients   map[string]*http.Client
	endpoint  string
	fail      bool
	unhealthy bool
	sends     map[string]int
}

func (d *reviewDispatch) Send(ctx context.Context, edge configrollout.Edge, n configconsumer.Notice) error {
	d.sends[edge.ID]++
	if d.fail {
		return errors.New("injected disconnected edge")
	}
	ack, ok := d.consumers[edge.ID].CurrentAck(n)
	if !ok {
		ack = d.consumers[edge.ID].FetchApply(ctx, n, d.fetchers[edge.ID])
	}
	report := configrollout.Report{ACK: ack, Healthy: ack.Accepted && !d.unhealthy}
	raw, err := json.Marshal(report)
	if err != nil {
		return err
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, d.endpoint+"/acks", bytes.NewReader(raw))
	if err != nil {
		return err
	}
	request.Header.Set("Content-Type", "application/json")
	response, err := d.clients[edge.ID].Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode != 204 {
		return errors.New("authenticated ACK rejected")
	}
	return nil
}

func reviewTLSServer(t *testing.T, config *tls.Config, handler http.Handler) *httptest.Server {
	t.Helper()
	server := httptest.NewUnstartedServer(handler)
	server.Config.ErrorLog = log.New(io.Discard, "", 0)
	server.Config.ReadHeaderTimeout = time.Second
	server.Config.ReadTimeout = 3 * time.Second
	server.Config.WriteTimeout = 3 * time.Second
	server.TLS = config
	server.StartTLS()
	t.Cleanup(server.Close)
	return server
}

func TestIntegrationSprint03BIndependentPublicationToCanaryACKRollback(t *testing.T) {
	if os.Getenv("AEGIS_TENANCY_INTEGRATION") != "1" {
		t.Skip("explicit owned-loopback PostgreSQL/Docker fixture required")
	}
	s, dsn := localStore(t)
	owner := testOwner(t, dsn)
	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()
	p, project, route := publicationFixture(t, s)
	if _, err := s.ApproveRoute(testMFA(p), p, project, route.ID, 1); err != nil {
		t.Fatal(err)
	}
	preview, err := s.PreviewPublication(ctx, p, project)
	if err != nil {
		t.Fatal(err)
	}
	approved, err := s.ApprovePublication(testMFA(p), p, project, "review-first-publication", preview.Digest, time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	lab := configlab.StartNATS(t)
	operator, err := configpublish.ConnectJetStream(lab.Endpoint, lab.ClientTLS("operator"))
	if err != nil {
		t.Fatal("TLS operator", err)
	}
	defer operator.Close()
	if err = operator.Provision(ctx); err != nil {
		t.Fatal("durable stream", err)
	}
	publisher, err := configpublish.ConnectJetStream(lab.Endpoint, lab.ClientTLS("publisher"))
	if err != nil {
		t.Fatal("TLS publisher", err)
	}
	defer publisher.Close()
	bus, err := nats.Connect(lab.Endpoint, nats.Secure(lab.ClientTLS("planner")), nats.NoReconnect())
	if err != nil {
		t.Fatal("TLS planner", err)
	}
	defer bus.Close()
	js, err := jetstream.New(bus)
	if err != nil {
		t.Fatal(err)
	}
	planner, err := js.CreateOrUpdateConsumer(ctx, configpublish.RolloutStream, jetstream.ConsumerConfig{Durable: "independent-review", FilterSubject: configpublish.RolloutSubject, AckPolicy: jetstream.AckExplicitPolicy, AckWait: time.Second, MaxAckPending: 8, MaxDeliver: 4})
	if err != nil {
		t.Fatal(err)
	}
	now := time.Now().UTC().Truncate(time.Second)
	signer, err := configsnapshot.NewLocalSigner("review-signing")
	if err != nil {
		t.Fatal(err)
	}
	trust, err := configsnapshot.NewTrustStore([]configsnapshot.TrustedKey{{ID: signer.KeyID(), PublicKey: signer.PublicKey(), NotBefore: now.Add(-time.Minute), NotAfter: now.Add(2 * time.Hour)}})
	if err != nil {
		t.Fatal(err)
	}
	var artifactHandler http.Handler
	artifactServer := reviewTLSServer(t, lab.ServerTLS(), http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if artifactHandler == nil {
			http.Error(w, "unavailable", 503)
			return
		}
		artifactHandler.ServeHTTP(w, r)
	}))
	directory := t.TempDir()
	os.Chmod(directory, 0700)
	objects, err := configpublish.OpenLocalStore(directory, artifactServer.URL, 8)
	if err != nil {
		t.Fatal(err)
	}
	defer objects.Close()
	artifactHandler = objects.Handler(map[string][]string{"spiffe://aegisgate.local/planner": {project}, "spiffe://aegisgate.local/edge-a": {project}, "spiffe://aegisgate.local/edge-b": {project}})
	worker := configpublish.Worker{Queue: s.PublicationQueue(), Store: objects, Notifier: publisher, Signer: signer, Trust: trust, Identity: "review-publisher", Lease: 30 * time.Second}
	publish := func() configconsumer.Notice {
		t.Helper()
		if err := worker.RunOnce(ctx); err != nil {
			t.Fatal("durable publication", err)
		}
		message, err := planner.Next(jetstream.FetchMaxWait(3 * time.Second))
		if err != nil {
			t.Fatal("JetStream delivery", err)
		}
		var n configconsumer.Notice
		if json.Unmarshal(message.Data(), &n) != nil {
			t.Fatal("notification contract")
		}
		if err = message.DoubleAck(ctx); err != nil {
			t.Fatal("planner durable ACK", err)
		}
		if err = s.VerifyPublication(ctx, n.DeploymentID, n.Generation, n.Digest, func() uint64 {
			if n.Generation == 3 {
				return 1
			}
			return 0
		}()); err != nil {
			t.Fatal("durable approval", err)
		}
		return n
	}
	first := publish()
	if first.Generation != approved.Generation {
		t.Fatal("generation changed on bus")
	}
	rolloutOwner, _ := configrollout.NewPostgreSQLStore(owner.pool)
	if err = rolloutOwner.Migrate(ctx); err != nil {
		t.Fatal(err)
	}
	var role string
	if err = s.pool.QueryRow(ctx, "SELECT current_user").Scan(&role); err != nil {
		t.Fatal(err)
	}
	for _, sql := range []string{"GRANT SELECT,INSERT,UPDATE ON config_rollout_state TO " + pgx.Identifier{role}.Sanitize(), "GRANT SELECT,INSERT ON config_rollout_audit TO " + pgx.Identifier{role}.Sanitize()} {
		if _, err = owner.pool.Exec(ctx, sql); err != nil {
			t.Fatal(err)
		}
	}
	rollouts, _ := configrollout.NewPostgreSQLStore(s.pool)
	dispatch := &reviewDispatch{consumers: map[string]*configconsumer.Consumer{}, fetchers: map[string]*configconsumer.HTTPSFetcher{}, clients: map[string]*http.Client{}, sends: map[string]int{}}
	options := map[string]configconsumer.Options{}
	for _, id := range []string{"edge-a", "edge-b"} {
		key := make(reviewCacheKey, 32)
		rand.Read(key)
		cacheDir := t.TempDir()
		os.Chmod(cacheDir, 0700)
		cache, err := configconsumer.NewDiskLKG(cacheDir, id+"/"+project, key, configsnapshot.MaxArtifactBytes)
		if err != nil {
			t.Fatal(err)
		}
		o := configconsumer.Options{DeploymentID: project, Trust: trust, Persistence: cache, MaxStaleness: time.Hour, MaxReaders: 16, MaxRetainedGenerations: 3}
		options[id] = o
		consumer, err := configconsumer.New(o)
		if err != nil {
			t.Fatal(err)
		}
		dispatch.consumers[id] = consumer
		if consumer.Metrics().Ready {
			t.Fatal("empty edge ready")
		}
		fetch, err := configconsumer.NewHTTPSFetcher(artifactServer.URL, lab.ClientTLS(id))
		if err != nil {
			t.Fatal(err)
		}
		dispatch.fetchers[id] = fetch
		defer fetch.Close()
		dispatch.clients[id] = &http.Client{Transport: &http.Transport{TLSClientConfig: lab.ClientTLS(id)}, Timeout: 3 * time.Second}
		defer dispatch.clients[id].CloseIdleConnections()
	}
	plannerFetch, err := configconsumer.NewHTTPSFetcher(artifactServer.URL, lab.ClientTLS("planner"))
	if err != nil {
		t.Fatal(err)
	}
	defer plannerFetch.Close()
	admission, err := configrollout.NewSignedAdmission(plannerFetch, trust, []string{project}, s.VerifyPublication, nil)
	if err != nil {
		t.Fatal(err)
	}
	controller, err := configrollout.New(rollouts, dispatch, admission, nil)
	if err != nil {
		t.Fatal(err)
	}
	acks, err := configrollout.ACKHandler(controller, map[string]string{"spiffe://aegisgate.local/edge-a": "edge-a", "spiffe://aegisgate.local/edge-b": "edge-b"})
	if err != nil {
		t.Fatal(err)
	}
	ackServer := reviewTLSServer(t, lab.ServerTLS(), acks)
	dispatch.endpoint = ackServer.URL
	edges := []configrollout.Edge{{ID: "edge-a", Group: "canary"}, {ID: "edge-b", Group: "general"}}
	policy := configrollout.Policy{CanaryGroup: "canary", Quorum: 2, ACKTimeout: time.Second, RetryBackoff: time.Second, MaxAttempts: 3}
	if err = controller.Begin(ctx, first, edges, policy, 0); err != nil {
		t.Fatal("signed admission", err)
	}
	if err = controller.Tick(ctx, project); err != nil {
		t.Fatal("gated dispatch", err)
	}
	state, err := controller.State(ctx, project)
	if err != nil || state.Phase != "complete" {
		t.Fatal("full rollout did not complete", state.Phase, err)
	}
	for _, consumer := range dispatch.consumers {
		if !consumer.Metrics().Ready || consumer.Metrics().AppliedGeneration != 1 {
			t.Fatal("edge did not activate signed gen1")
		}
	}
	// A forged maximum generation must not poison durable rollout progress.
	forged := first
	forged.Generation = configsnapshot.MaxGeneration
	forged.Digest = strings.Repeat("0", 64)
	if controller.Begin(ctx, forged, edges, policy, 0) == nil {
		t.Fatal("forged bus advanced rollout")
	}
	unchanged, _ := controller.State(ctx, project)
	if unchanged.Notice.Generation != 1 {
		t.Fatal("forgery poisoned replay floor")
	}
	// PostgreSQL query failure, control fetch failure and messaging outage leave
	// existing complete generations ready. No customer hot path uses these APIs.
	if _, err = owner.pool.Exec(ctx, "REVOKE SELECT ON active_route_approvals FROM "+pgx.Identifier{role}.Sanitize()); err != nil {
		t.Fatal(err)
	}
	if _, err = s.PreviewPublication(ctx, p, project); err == nil {
		t.Fatal("DB denial injection failed")
	}
	owner.pool.Exec(ctx, "GRANT SELECT ON active_route_approvals TO "+pgx.Identifier{role}.Sanitize())
	if err = lab.Stop(ctx); err != nil {
		t.Fatal(err)
	}
	if err = publisher.Publish(ctx, configpublish.Notification(first)); err == nil {
		t.Fatal("NATS outage undetected")
	}
	for _, consumer := range dispatch.consumers {
		if !consumer.Metrics().Ready || consumer.Metrics().AppliedGeneration != 1 {
			t.Fatal("outage removed LKG")
		}
	}
	if err = lab.Restart(ctx); err != nil {
		t.Fatal(err)
	}
	publisher.Close()
	publisher, err = configpublish.ConnectJetStream(lab.Endpoint, lab.ClientTLS("publisher"))
	if err != nil {
		t.Fatal(err)
	}
	defer publisher.Close()
	worker.Notifier = publisher
	bus.Close()
	bus, err = nats.Connect(lab.Endpoint, nats.Secure(lab.ClientTLS("planner")), nats.NoReconnect())
	if err != nil {
		t.Fatal(err)
	}
	defer bus.Close()
	js, _ = jetstream.New(bus)
	planner, err = js.Consumer(ctx, configpublish.RolloutStream, "independent-review")
	if err != nil {
		t.Fatal("durable planner lost", err)
	}
	// A rejecting canary pauses before the general edge sees the new generation.
	if _, err = s.ApprovePublication(testMFA(p), p, project, "review-second-publication", preview.Digest, time.Hour); err != nil {
		t.Fatal(err)
	}
	second := publish()
	dispatch.unhealthy = true
	if err = controller.Begin(ctx, second, edges, policy, 0); err != nil {
		t.Fatal(err)
	}
	before := dispatch.sends["edge-b"]
	if err = controller.Tick(ctx, project); err != nil {
		t.Fatal(err)
	}
	state, _ = controller.State(ctx, project)
	if state.Phase != "paused" || dispatch.sends["edge-b"] != before {
		t.Fatal("rejecting canary expanded rollout")
	}
	if dispatch.consumers["edge-b"].Metrics().AppliedGeneration != 1 {
		t.Fatal("general edge lost prior complete LKG")
	}
	dispatch.unhealthy = false
	// Rollback is separately approved and signed as generation3; it does not
	// reset any consumer or controller counter, even after controller restart.
	rolled, err := s.RollbackPublication(testMFA(p), p, project, "review-signed-rollback", 1, time.Hour)
	if err != nil || rolled.Generation != 3 {
		t.Fatal("monotonic rollback", err)
	}
	third := publish()
	restarted, err := configconsumer.New(options["edge-b"])
	if err != nil {
		t.Fatal(err)
	}
	if err = restarted.Restore(ctx); err != nil || restarted.Metrics().AppliedGeneration != 1 {
		t.Fatal("encrypted cold restart failed", err)
	}
	dispatch.consumers["edge-b"] = restarted
	controller, err = configrollout.New(rollouts, dispatch, admission, nil)
	if err != nil {
		t.Fatal(err)
	}
	acks, err = configrollout.ACKHandler(controller, map[string]string{"spiffe://aegisgate.local/edge-a": "edge-a", "spiffe://aegisgate.local/edge-b": "edge-b"})
	if err != nil {
		t.Fatal(err)
	}
	secondACKServer := reviewTLSServer(t, lab.ServerTLS(), acks)
	dispatch.endpoint = secondACKServer.URL
	if err = controller.Begin(ctx, third, edges, policy, 1); err != nil {
		t.Fatal(err)
	}
	dispatch.fail = true
	if err = controller.Tick(ctx, project); err != nil {
		t.Fatal(err)
	}
	if dispatch.consumers["edge-b"].Metrics().AppliedGeneration != 1 {
		t.Fatal("disconnected edge partially applied")
	}
	dispatch.fail = false
	time.Sleep(2100 * time.Millisecond)
	if err = controller.Tick(ctx, project); err != nil {
		t.Fatal(err)
	}
	state, _ = controller.State(ctx, project)
	if state.Phase != "complete" || state.RollbackFrom != 1 {
		t.Fatal("signed rollback did not recover", state.Phase)
	}
	for _, consumer := range dispatch.consumers {
		capture, err := consumer.Capture()
		if err != nil {
			t.Fatal(err)
		}
		envelope, err := capture.Snapshot()
		capture.Close()
		if err != nil || envelope.Generation != 3 || envelope.Payload.Tenants[0].Routes[0].PolicyID != preview.Payload.Tenants[0].Routes[0].PolicyID {
			t.Fatal("rollback combined policy generations", err)
		}
		if consumer.Apply(ctx, first, nil).Accepted {
			t.Fatal("stale notice accepted")
		}
	}
	var audits int
	if err = owner.pool.QueryRow(ctx, "SELECT count(*) FROM config_rollout_audit WHERE deployment_id=$1", project).Scan(&audits); err != nil || audits < 10 {
		t.Fatal("outcomes not durably audited", audits, err)
	}
	if _, err = s.pool.Exec(ctx, "DELETE FROM config_rollout_audit"); err == nil {
		t.Fatal("runtime may erase audit")
	}
}
