// Package db sets up the PostgreSQL connection through GORM and holds the models.
package db

import (
	"fmt"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// Sheet is one named calculation, e.g. a single trip, holding its own
// travelers and expenses.
type Sheet struct {
	ID        uint64 `gorm:"primaryKey"`
	Name      string `gorm:"not null;default:''"`
	Saved     bool   `gorm:"not null;default:false"`
	CreatedAt time.Time
}

// Traveler is a person who shares the expenses of one sheet.
type Traveler struct {
	ID      uint64 `gorm:"primaryKey"`
	SheetID uint64 `gorm:"not null;uniqueIndex:idx_sheet_traveler_name"`
	Sheet   Sheet  `gorm:"constraint:OnDelete:CASCADE"`
	Name    string `gorm:"not null;uniqueIndex:idx_sheet_traveler_name"`
}

// Expense is one cost paid by a single traveler and split into shares.
type Expense struct {
	ID          uint64 `gorm:"primaryKey"`
	SheetID     uint64 `gorm:"not null;index"`
	Sheet       Sheet  `gorm:"constraint:OnDelete:CASCADE"`
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
	if err := migrateToSheets(gdb); err != nil {
		return nil, fmt.Errorf("migrate to sheets: %w", err)
	}
	if err := gdb.AutoMigrate(models()...); err != nil {
		return nil, fmt.Errorf("auto-migrate: %w", err)
	}
	return gdb, nil
}

// models lists the GORM models to auto-migrate. Add new models here.
func models() []any {
	return []any{&Sheet{}, &Traveler{}, &Expense{}, &ExpenseShare{}}
}

// migrateToSheets moves travelers and expenses created before sheets existed
// into one unsaved sheet, so AutoMigrate can add the NOT NULL sheet_id
// columns. It does nothing on a fresh database or one already migrated.
func migrateToSheets(gdb *gorm.DB) error {
	m := gdb.Migrator()
	if !m.HasTable(&Traveler{}) || m.HasColumn(&Traveler{}, "SheetID") {
		return nil
	}
	return gdb.Transaction(func(tx *gorm.DB) error {
		m := tx.Migrator()
		if err := m.AutoMigrate(&Sheet{}); err != nil {
			return err
		}
		sheet := Sheet{}
		if err := tx.Create(&sheet).Error; err != nil {
			return err
		}
		for _, table := range []string{"travelers", "expenses"} {
			if !m.HasTable(table) {
				continue
			}
			if err := tx.Exec("ALTER TABLE " + table + " ADD COLUMN sheet_id bigint").Error; err != nil {
				return err
			}
			if err := tx.Exec("UPDATE "+table+" SET sheet_id = ?", sheet.ID).Error; err != nil {
				return err
			}
			if err := tx.Exec("ALTER TABLE " + table + " ALTER COLUMN sheet_id SET NOT NULL").Error; err != nil {
				return err
			}
		}
		// Traveler names are now unique per sheet, not globally.
		if m.HasIndex(&Traveler{}, "idx_travelers_name") {
			return m.DropIndex(&Traveler{}, "idx_travelers_name")
		}
		return nil
	})
}
