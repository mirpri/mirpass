package db

import (
	"database/sql"
	"fmt"
	"log"
)

func runMigration(db *sql.DB) error {

	// Ensure nickname and avatar_url columns exist for legacy tables
	if aff, err := db.Exec(`ALTER TABLE users ADD COLUMN IF NOT EXISTS nickname VARCHAR(255) DEFAULT NULL`); err != nil {
		if aff != nil {
			if count, err := aff.RowsAffected(); err == nil && count > 0 {
				log.Default().Printf("Added nickname column to users table, %d rows affected", count)
			}
		}
		return fmt.Errorf("add nickname column: %w", err)
	}
	if aff, err := db.Exec(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(511) DEFAULT NULL`); err != nil {
		if aff != nil {
			if count, err := aff.RowsAffected(); err == nil && count > 0 {
				log.Default().Printf("Added avatar_url column to users table, %d rows affected", count)
			}
		}
		return fmt.Errorf("add avatar column: %w", err)
	}

	return nil
}
