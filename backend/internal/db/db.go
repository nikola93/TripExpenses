// Package db sets up the PostgreSQL connection through GORM and holds the models.
package db

import (
	"fmt"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// Traveler is a person who shares the trip's expenses.
type Traveler struct {
	ID   uint64 `gorm:"primaryKey"`
	Name string `gorm:"not null;uniqueIndex"`
}

// Expense is one cost paid by a single traveler and split into shares.
type Expense struct {
	ID          uint64 `gorm:"primaryKey"`
	Description string `gorm:"not null;default:''"`
	PayerID     uint64 `gorm:"not null;index"`
	Payer       Traveler
	Shares      []ExpenseShare `gorm:"constraint:OnDelete:CASCADE"`
	CreatedAt   time.Time
}

// ExpenseShare is the part of an expense that falls on one traveler.
type ExpenseShare struct {
	ID         uint64 `gorm:"primaryKey"`
	ExpenseID  uint64 `gorm:"not null;uniqueIndex:idx_expense_traveler"`
	TravelerID uint64 `gorm:"not null;uniqueIndex:idx_expense_traveler"`
	Traveler   Traveler
	Amount     int64 `gorm:"not null"`
}

// Open connects to PostgreSQL using the given DSN and runs auto-migrations
// for the registered models.
func Open(dsn string) (*gorm.DB, error) {
	gdb, err := gorm.Open(postgres.Open(dsn), &gorm.Config{TranslateError: true})
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}
	if err := gdb.AutoMigrate(models()...); err != nil {
		return nil, fmt.Errorf("auto-migrate: %w", err)
	}
	return gdb, nil
}

// models lists the GORM models to auto-migrate. Add new models here.
func models() []any {
	return []any{&Traveler{}, &Expense{}, &ExpenseShare{}}
}
