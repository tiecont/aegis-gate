package persistence

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"aegisgate.dev/aegisgate/internal/configconsumer"
	"aegisgate.dev/aegisgate/internal/configpublish"
	"aegisgate.dev/aegisgate/internal/configrollout"
	"aegisgate.dev/aegisgate/internal/configsnapshot"
)

func TestIntegrationRecoveryDurableReferencesPruneAndRestart(t *testing.T) {
	s, dsn := localStore(t)
	owner := testOwner(t, dsn)
	ctx := context.Background()
	p, project, _ := publicationFixture(t, s)
	preview, err := s.PreviewPublication(ctx, p, project)
	if err != nil {
		t.Fatal(err)
	}
	root := t.TempDir()
	if err = os.Chmod(root, 0700); err != nil {
		t.Fatal(err)
	}
	objects, err := configpublish.OpenLocalStore(root, "https://artifacts.example.com", 16)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { objects.Close() })
	signer, err := configsnapshot.NewLocalSigner("retention-key")
	if err != nil {
		t.Fatal(err)
	}
	queue := s.PublicationQueue()
	keep := []string{}
	for i, state := range []string{"published", "failed", "leased"} {
		publication, err := s.ApprovePublication(testMFA(p), p, project, "retention-key-"+state, preview.Digest, time.Hour)
		if err != nil || publication.Generation != uint64(i+1) {
			t.Fatal("approval failed", err)
		}
		job, err := queue.Claim(ctx, "retention-worker", 10*time.Second)
		if err != nil {
			t.Fatal(err)
		}
		raw, err := configsnapshot.Sign(ctx, job.Envelope, signer)
		if err != nil {
			t.Fatal(err)
		}
		sum := sha256.Sum256(raw)
		digest := hex.EncodeToString(sum[:])
		if err = queue.Stage(ctx, job, raw, digest); err != nil {
			t.Fatal(err)
		}
		location, err := objects.Put(ctx, raw)
		if err != nil {
			t.Fatal(err)
		}
		keep = append(keep, digest)
		job.Digest = digest
		if state == "published" {
			err = queue.Finish(ctx, job, configpublish.Notification{DeploymentID: project, Generation: job.Envelope.Generation, Digest: digest, Location: location})
		} else if state == "failed" {
			_, err = owner.pool.Exec(ctx, "UPDATE config_outbox SET state='failed',lease_until=NULL,lease_owner=NULL,lease_token=NULL WHERE project_id=$1 AND generation=$2", project, job.Envelope.Generation)
		}
		if err != nil {
			t.Fatal(err)
		}
	}
	if _, err = s.ApprovePublication(testMFA(p), p, project, "retention-pending", preview.Digest, time.Hour); err != nil {
		t.Fatal(err)
	}
	put := func(raw []byte) string {
		t.Helper()
		location, err := objects.Put(ctx, raw)
		if err != nil {
			t.Fatal(err)
		}
		return strings.TrimPrefix(location, "https://artifacts.example.com/artifacts/")
	}
	rolloutOnly := put([]byte(`{"deployment_id":"retention-rollout-only"}`))
	auditOnly := put([]byte(`{"deployment_id":"retention-audit-only"}`))
	external := put([]byte(`{"deployment_id":"retention-disconnected-lkg"}`))
	orphan := put([]byte(`{"deployment_id":"retention-orphan"}`))
	old := time.Now().Add(-72 * time.Hour)
	for _, digest := range append(append([]string(nil), keep...), rolloutOnly, auditOnly, external, orphan) {
		if err = os.Chtimes(filepath.Join(root, digest), old, old); err != nil {
			t.Fatal(err)
		}
	}
	cutoff := time.Now().Add(-48 * time.Hour)
	if n, err := owner.PrunePublicationArtifacts(ctx, objects, []string{external}, cutoff, 1); err == nil || n != 0 {
		t.Fatal("missing rollout tables did not refuse deletion", n, err)
	}
	rollouts, err := configrollout.NewPostgreSQLStore(owner.pool)
	if err != nil || rollouts.Migrate(ctx) != nil {
		t.Fatal("rollout migration failed", err)
	}
	state := configrollout.State{Version: 1, Sequence: 1, Notice: configconsumer.Notice{DeploymentID: project, Generation: 20, Digest: rolloutOnly}}
	event := configrollout.Event{Sequence: 1, Generation: 20, Digest: auditOnly, At: time.Now().UTC(), Type: "retention_fixture"}
	if err = rollouts.Commit(ctx, 0, state, []configrollout.Event{event}); err != nil {
		t.Fatal(err)
	}
	// Hold a real conflicting PostgreSQL writer lock. NOWAIT must refuse the
	// entire operation before the unreferenced filesystem object is deleted.
	writer, err := owner.pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer writer.Rollback(ctx)
	if _, err = writer.Exec(ctx, "LOCK TABLE config_outbox IN ROW EXCLUSIVE MODE"); err != nil {
		t.Fatal(err)
	}
	if n, err := owner.PrunePublicationArtifacts(ctx, objects, []string{external}, cutoff, 1); err == nil || n != 0 {
		t.Fatal("concurrent durable-reference writer was ignored", n, err)
	}
	if err = writer.Rollback(ctx); err != nil {
		t.Fatal(err)
	}
	if err = objects.Close(); err != nil {
		t.Fatal(err)
	}
	objects, err = configpublish.OpenLocalStore(root, "https://artifacts.example.com", 16)
	if err != nil {
		t.Fatal(err)
	}
	// A new maintenance connection/store descriptor must re-read durable rows;
	// no in-memory keep-set from publication is passed to this operation.
	maintenance := testOwner(t, dsn)
	if n, err := maintenance.PrunePublicationArtifacts(ctx, objects, []string{external}, cutoff, 1); err != nil || n != 1 {
		t.Fatal("bounded orphan prune failed", n, err)
	}
	for _, digest := range append(keep, rolloutOnly, auditOnly, external) {
		if _, err = os.Stat(filepath.Join(root, digest)); err != nil {
			t.Fatal("durable or external reference deleted", err)
		}
	}
	if _, err = os.Stat(filepath.Join(root, orphan)); !os.IsNotExist(err) {
		t.Fatal("orphan was not removed")
	}
	var count int
	if err = owner.pool.QueryRow(ctx, "SELECT count(*) FROM config_revisions WHERE project_id=$1", project).Scan(&count); err != nil || count != 4 {
		t.Fatal("prune altered immutable approval history", err)
	}
	if n, err := maintenance.PrunePublicationArtifacts(ctx, objects, []string{"invalid"}, cutoff, 1); err == nil || n != 0 {
		t.Fatal("invalid external reservation accepted", err)
	}
	// Archive the actual durable rows, restore and hash them before accepting the
	// archive checksum. This does not authorize deleting immutable DB revisions.
	var archive []byte
	if err = owner.pool.QueryRow(ctx, "SELECT jsonb_agg(to_jsonb(o) ORDER BY generation)::text FROM config_outbox o WHERE project_id=$1", project).Scan(&archive); err != nil {
		t.Fatal(err)
	}
	archivePath := filepath.Join(t.TempDir(), "outbox-archive.json")
	if err = os.WriteFile(archivePath, archive, 0600); err != nil {
		t.Fatal(err)
	}
	restored, err := os.ReadFile(archivePath)
	if err != nil || !json.Valid(restored) || !bytes.Equal(restored, archive) {
		t.Fatal("archive recovery failed", err)
	}
	expected := sha256.Sum256(archive)
	corrupt := bytes.Clone(restored)
	corrupt[len(corrupt)/2] ^= 1
	if sha256.Sum256(corrupt) == expected {
		t.Fatal("corrupt archive checksum accepted")
	}
	if sha256.Sum256(restored) != expected {
		t.Fatal("restored archive checksum mismatch")
	}
}
