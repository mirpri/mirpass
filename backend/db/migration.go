package db

import (
	"database/sql"
	"fmt"
	"log"

	"golang.org/x/crypto/bcrypt"
)

func runMigration(db *sql.DB) error {
	err := db.QueryRow("SELECT created_at FROM users WHERE username = 'root'").Scan(new(sql.NullTime))
	if err == sql.ErrNoRows {
		// Create root user
		hash, err := bcrypt.GenerateFromPassword([]byte("root"), bcrypt.DefaultCost)
		if err != nil {
			return fmt.Errorf("hashing password: %w", err)
		}
		// Insert user
		_, err = db.Exec("INSERT INTO users (username, email, password_hash, is_verified) VALUES ('root', 'root@localhost', ?, TRUE)", string(hash))
		if err != nil {
			return fmt.Errorf("creating root user: %w", err)
		}
		log.Println("Created default root user (username: root, password: root)")
	} else if err != nil {
		return fmt.Errorf("checking root user: %w", err)
	}

	// Ensure root has root role for system
	// Using ON DUPLICATE KEY UPDATE to ensure role is correct
	_, err = db.Exec(`INSERT INTO admins (username, app, role) VALUES ('root', 'system', 'root') 
		ON DUPLICATE KEY UPDATE role = 'root'`)
	if err != nil {
		return fmt.Errorf("assigning root role: %w", err)
	}

	// Migration: Add name to api_keys if missing
	// We try to add it and ignore error, assuming error means it exists
	_, _ = db.Exec("ALTER TABLE api_keys ADD COLUMN name VARCHAR(255) DEFAULT NULL")

	return nil
}
