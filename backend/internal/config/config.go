// Package config loads the server configuration from the environment.
package config

import (
	"fmt"
	"os"

	"github.com/caarlos0/env/v11"
	"github.com/joho/godotenv"
)

// Config holds every setting the server reads from the environment.
type Config struct {
	// DatabaseURL is a Postgres connection URL, e.g.
	// postgres://user:pass@localhost:5434/tripexpenses?sslmode=disable
	DatabaseURL string `env:"DATABASE_URL,required,notEmpty"`
	// Port is the HTTP port the server listens on.
	Port int `env:"PORT" envDefault:"8080"`
}

// Addr returns the listen address for the HTTP server.
func (c Config) Addr() string {
	return fmt.Sprintf(":%d", c.Port)
}

// Load reads .env from the working directory if present (variables already
// set in the environment take precedence), then parses and validates the
// configuration. All missing or invalid variables are reported together.
func Load() (Config, error) {
	if err := godotenv.Load(); err != nil && !os.IsNotExist(err) {
		return Config{}, fmt.Errorf("loading .env: %w", err)
	}
	return Parse()
}

// Parse reads the configuration from the current environment only.
func Parse() (Config, error) {
	cfg, err := env.ParseAs[Config]()
	if err != nil {
		return Config{}, fmt.Errorf("invalid configuration (see backend/.env.example): %w", err)
	}
	return cfg, nil
}
