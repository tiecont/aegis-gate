package main

import (
	"context"
	"errors"
	"flag"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"aegisgate.dev/aegisgate/apps/control-api/internal/transport"
)

func main() {
	addr := flag.String("listen", "127.0.0.1:8080", "local development health listener")
	managementConfig := flag.String("management-config", "", "owner-only local management JSON configuration")
	migrate := flag.Bool("migrate", false, "apply local management database migrations before serving")
	flag.Parse()
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	srv, err := transport.NewServer(*addr)
	if err != nil {
		log.Fatal(err)
	}
	if *managementConfig != "" {
		management, store, resolver, err := transport.LocalAdminServer(ctx, *addr, *managementConfig)
		if err != nil {
			log.Fatal("local management configuration unavailable")
		}
		if *migrate {
			if err := store.Migrate(ctx); err != nil {
				store.Close()
				log.Fatal("local management migration failed")
			}
		}
		srv = management
		done := make(chan struct{})
		go func() {
			defer close(done)
			ticker := time.NewTicker(time.Second)
			defer ticker.Stop()
			for {
				select {
				case <-ctx.Done():
					return
				case <-ticker.C:
					_, _ = store.RunDomainVerification(ctx, resolver)
				}
			}
		}()
		defer func() { stop(); <-done; store.Close() }()
	}
	go func() {
		<-ctx.Done()
		shutdown, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = srv.Shutdown(shutdown)
	}()
	var serveErr error
	if *managementConfig != "" {
		log.Print("local management HTTPS listener starting")
		serveErr = srv.ListenAndServeTLS("", "")
	} else {
		log.Print("foundation control-api: tenant endpoints unavailable")
		serveErr = srv.ListenAndServe()
	}
	if serveErr != nil && !errors.Is(serveErr, http.ErrServerClosed) {
		log.Fatal("local listener failed")
	}
}
