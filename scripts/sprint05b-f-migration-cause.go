package main

import (
	"context"
	"encoding/json"
	"errors"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"aegisgate.dev/aegisgate/apps/control-api/internal/persistence"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

func require(ok bool, reason string) {
	if !ok {
		panic(reason)
	}
}

func main() {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	secret, err := os.ReadFile(filepath.Join(".local", "postgres-password"))
	require(err == nil, "owned fixture credential unavailable")
	dsn := &url.URL{Scheme: "postgres", Host: "127.0.0.1:54329", Path: "aegisgate_local", User: url.UserPassword("aegisgate_local", strings.TrimSpace(string(secret)))}
	dsn.RawQuery = "sslmode=disable"
	admin, err := pgx.Connect(ctx, dsn.String())
	require(err == nil, "owned fixture database unavailable")
	defer admin.Close(context.Background())
	holder, err := pgx.Connect(ctx, dsn.String())
	require(err == nil, "holder connection unavailable")
	defer holder.Close(context.Background())
	for _, name := range []string{"f_cause_schema_a", "f_cause_schema_b"} {
		_, err = admin.Exec(ctx, "CREATE SCHEMA "+name)
		require(err == nil, "fresh independent schema unavailable")
		defer admin.Exec(context.Background(), "DROP SCHEMA "+name+" CASCADE")
	}
	tx, err := holder.Begin(ctx)
	require(err == nil, "holder transaction unavailable")
	defer tx.Rollback(context.Background())
	_, err = tx.Exec(ctx, "SET LOCAL search_path=f_cause_schema_a")
	require(err == nil, "holder schema selection failed")
	_, err = tx.Exec(ctx, "SELECT pg_advisory_xact_lock(4122026002)")
	require(err == nil, "controlled migration lock unavailable")
	dsn.RawQuery = "sslmode=disable&search_path=f_cause_schema_b"
	store, err := persistence.Open(ctx, dsn.String())
	require(err == nil, "independent schema store unavailable")
	defer store.Close()
	start := time.Now()
	result := make(chan error, 1)
	go func() { result <- store.Migrate(ctx) }()
	type sample struct {
		ElapsedMS int64   `json:"elapsed_ms"`
		WaiterPID int32   `json:"waiter_pid"`
		HolderPID uint32  `json:"holder_pid"`
		Blockers  []int32 `json:"blockers"`
	}
	samples := []sample{}
	var migrationErr error
	for {
		select {
		case migrationErr = <-result:
			goto finished
		case <-time.After(100 * time.Millisecond):
			rows, queryErr := admin.Query(ctx, "SELECT pid,pg_blocking_pids(pid) FROM pg_locks WHERE locktype='advisory' AND classid=0 AND objid=4122026002 AND NOT granted")
			require(queryErr == nil, "read-only lock query failed")
			for rows.Next() {
				var pid int32
				var blockers []int32
				require(rows.Scan(&pid, &blockers) == nil, "lock sample decode failed")
				samples = append(samples, sample{time.Since(start).Milliseconds(), pid, holder.PgConn().PID(), blockers})
			}
			rows.Close()
		}
	}
finished:
	elapsed := time.Since(start).Milliseconds()
	var pgerr *pgconn.PgError
	require(errors.As(migrationErr, &pgerr) && pgerr.Code == "55P03", "original Store.Migrate did not fail at unchanged lock timeout")
	require(elapsed >= 1900 && len(samples) >= 10, "insufficient observed cross-schema lock wait")
	for _, item := range samples {
		found := false
		for _, pid := range item.Blockers {
			found = found || uint32(pid) == item.HolderPID
		}
		require(found, "waiter not blocked by controlled distinct-schema holder")
	}
	require(tx.Rollback(ctx) == nil, "controlled lock release failed")
	require(store.Migrate(ctx) == nil, "unchanged Store.Migrate did not recover after release")
	require(json.NewEncoder(os.Stdout).Encode(map[string]any{
		"scope": "Controlled distinct-schema lock coupling; not a claim about the earlier natural failure",
		"key":   uint64(4122026002), "holder_schema": "f_cause_schema_a", "migration_schema": "f_cause_schema_b",
		"unchanged_store_open_timeouts": true, "sqlstate": pgerr.Code, "elapsed_ms": elapsed,
		"samples": samples, "recovery_migrate_pass": true,
	}) == nil, "safe result encoding failed")
}
