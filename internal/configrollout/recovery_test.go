package configrollout

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestIntegrationRecoveryArchiveRoundTripBeforeAuditCleanup(t *testing.T) {
	runtime, owner, pool, _ := postgresFixture(t)
	ctx := context.Background()
	now := time.Now().UTC().Truncate(time.Second)
	old := now.Add(-61 * 24 * time.Hour)
	state := State{Version: 1, Sequence: 1, Notice: notice(1)}
	event := Event{Sequence: 1, Generation: 1, Digest: state.Notice.Digest, At: old, Type: "recovery_archive_fixture"}
	if err := runtime.Commit(ctx, 0, state, []Event{event}); err != nil {
		t.Fatal(err)
	}
	state.Version++
	state.Sequence++
	state.Notice = notice(2)
	current := Event{Sequence: 2, Generation: 2, Digest: state.Notice.Digest, At: now, Type: "recovery_current_fixture"}
	if err := runtime.Commit(ctx, 1, state, []Event{current}); err != nil {
		t.Fatal(err)
	}
	var archive []byte
	if err := pool.QueryRow(ctx, "SELECT jsonb_agg(event ORDER BY sequence)::text FROM config_rollout_audit WHERE deployment_id=$1 AND generation<2", state.Notice.DeploymentID).Scan(&archive); err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(t.TempDir(), "audit-archive.json")
	if err := os.WriteFile(path, archive, 0600); err != nil {
		t.Fatal(err)
	}
	restored, err := os.ReadFile(path)
	if err != nil || !bytes.Equal(restored, archive) {
		t.Fatal("archive did not restore", err)
	}
	var events []Event
	if json.Unmarshal(restored, &events) != nil || len(events) != 1 || events[0].Digest != event.Digest || events[0].Sequence != 1 {
		t.Fatal("restored archive lost durable reference")
	}
	digest := sha256.Sum256(restored)
	checksum := hex.EncodeToString(digest[:])
	cutoff := now.Add(-31 * 24 * time.Hour)
	if n, err := runtime.CleanupAudit(ctx, state.Notice.DeploymentID, cutoff, checksum, now); err == nil || n != 0 {
		t.Fatal("runtime archived/deleted audit with maintenance privilege", n, err)
	}
	if n, err := owner.CleanupAudit(ctx, state.Notice.DeploymentID, cutoff, checksum, now); err != nil || n != 1 {
		t.Fatal("verified archive cleanup failed", n, err)
	}
	var retained, recorded int
	if err := pool.QueryRow(ctx, "SELECT count(*) FILTER (WHERE generation=2),count(*) FILTER (WHERE event->>'code'=$2 AND event->>'type'='audit_archive_cleanup') FROM config_rollout_audit WHERE deployment_id=$1", state.Notice.DeploymentID, checksum).Scan(&retained, &recorded); err != nil || retained != 2 || recorded != 1 {
		t.Fatal("cleanup lost current history or archive checksum", err)
	}
	restarted, err := NewPostgreSQLStore(pool)
	if err != nil {
		t.Fatal(err)
	}
	if recovered, err := restarted.Load(ctx, state.Notice.DeploymentID); err != nil || recovered.Notice.Generation != 2 || recovered.Sequence != 3 {
		t.Fatal("archival broke durable rollout restart", err)
	}
}
