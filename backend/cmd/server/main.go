package main

import (
	"log"
	"net/http"

	"github.com/nikola93/tripexpenses/backend/gen/tripexpenses/v1/tripexpensesv1connect"
	"github.com/nikola93/tripexpenses/backend/internal/config"
	"github.com/nikola93/tripexpenses/backend/internal/db"
	"github.com/nikola93/tripexpenses/backend/internal/service"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatal(err)
	}

	gdb, err := db.Open(cfg.DatabaseURL)
	if err != nil {
		log.Fatal(err)
	}
	sqlDB, err := gdb.DB()
	if err != nil {
		log.Fatal(err)
	}
	defer sqlDB.Close()

	mux := http.NewServeMux()
	mux.Handle(tripexpensesv1connect.NewTripExpensesServiceHandler(service.New(gdb)))
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		if err := sqlDB.PingContext(r.Context()); err != nil {
			http.Error(w, "database unavailable", http.StatusServiceUnavailable)
			return
		}
		w.Write([]byte("ok"))
	})

	log.Printf("listening on %s", cfg.Addr())
	// Serve HTTP/2 without TLS (h2c) alongside HTTP/1.1 so plain gRPC
	// clients work, not just the Connect and gRPC-Web protocols.
	protocols := new(http.Protocols)
	protocols.SetHTTP1(true)
	protocols.SetUnencryptedHTTP2(true)
	srv := &http.Server{Addr: cfg.Addr(), Handler: mux, Protocols: protocols}
	log.Fatal(srv.ListenAndServe())
}
