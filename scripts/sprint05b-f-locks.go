package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5"
)

func main() {
	if len(os.Args) != 3 || !filepath.IsAbs(os.Args[1]) {
		panic("source path and output required")
	}
	secret, err := os.ReadFile(filepath.Join(os.Args[1], ".local", "postgres-password"))
	if err != nil {
		panic("fixture credential unavailable")
	}
	dsn := &url.URL{Scheme: "postgres", Host: "127.0.0.1:54329", Path: "aegisgate_local",
		User: url.UserPassword("aegisgate_local", strings.TrimSpace(string(secret)))}
	dsn.RawQuery = "sslmode=disable&application_name=sprint05b-f-readonly-lock-observer"
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	connect, cancel := context.WithTimeout(ctx, 3*time.Second)
	conn, err := pgx.Connect(connect, dsn.String())
	cancel()
	if err != nil {
		panic("owned loopback database unavailable")
	}
	defer conn.Close(context.Background())
	file, err := os.OpenFile(os.Args[2], os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
	if err != nil {
		panic("new lock evidence required")
	}
	defer file.Close()
	encoder := json.NewEncoder(file)
	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()
	deadline := time.NewTimer(10 * time.Minute)
	defer deadline.Stop()
	var written int64
	for {
		select {
		case <-ctx.Done():
			return
		case <-deadline.C:
			return
		case <-ticker.C:
		}
		query, done := context.WithTimeout(ctx, time.Second)
		var sample []byte
		err = conn.QueryRow(query, `SELECT json_build_object('time',clock_timestamp(),'locks',COALESCE(json_agg(json_build_object(
		 'pid',l.pid,'role',a.usename,'classid',l.classid::bigint,'objid',l.objid::bigint,
		 'granted',l.granted,'mode',l.mode,'wait_event_type',a.wait_event_type,'wait_event',a.wait_event,
		 'blockers',pg_blocking_pids(l.pid),'waitstart',l.waitstart,
		 'query_age_ms',EXTRACT(EPOCH FROM clock_timestamp()-a.query_start)*1000)), '[]'::json))
		 FROM pg_locks l JOIN pg_stat_activity a ON a.pid=l.pid WHERE l.locktype='advisory' AND a.datname=current_database()`).Scan(&sample)
		done()
		if err != nil {
			if ctx.Err() != nil {
				return
			}
			_ = encoder.Encode(map[string]string{"error": "read-only lock sample failed"})
			continue
		}
		written += int64(len(sample))
		if written > 4<<20 {
			_ = encoder.Encode(map[string]string{"stop": "4MiB observation cap"})
			return
		}
		var safe json.RawMessage = sample
		if err = encoder.Encode(safe); err != nil {
			fmt.Fprintln(os.Stderr, "lock evidence write failed")
			return
		}
	}
}
