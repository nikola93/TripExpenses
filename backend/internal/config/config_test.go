package config

import (
	"strings"
	"testing"
)

func TestParse(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://u:p@localhost:5432/db")
	t.Setenv("PORT", "")

	cfg, err := Parse()
	if err != nil {
		t.Fatalf("Parse() error = %v", err)
	}
	if cfg.DatabaseURL != "postgres://u:p@localhost:5432/db" {
		t.Errorf("DatabaseURL = %q", cfg.DatabaseURL)
	}
	if cfg.Addr() != ":8080" {
		t.Errorf("Addr() = %q, want default :8080", cfg.Addr())
	}
}

func TestParseReportsAllErrors(t *testing.T) {
	t.Setenv("DATABASE_URL", "")
	t.Setenv("PORT", "not-a-number")

	_, err := Parse()
	if err == nil {
		t.Fatal("Parse() error = nil, want error")
	}
	for _, want := range []string{"DATABASE_URL", "PORT"} {
		if !strings.Contains(strings.ToUpper(err.Error()), want) {
			t.Errorf("error %q does not mention %s", err, want)
		}
	}
}
