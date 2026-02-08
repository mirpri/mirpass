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

	// Migrate verifications table if needed
	// Ignore errors (columns might already exist)
	db.Exec("ALTER TABLE verifications ADD COLUMN task VARCHAR(50) NOT NULL DEFAULT 'register'")
	db.Exec("ALTER TABLE verifications ADD COLUMN detail TEXT DEFAULT NULL")
	db.Exec("ALTER TABLE verifications ADD COLUMN expires_at TIMESTAMP NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL 1 DAY)")

	// Ensure root has root role for system
	// Using ON DUPLICATE KEY UPDATE to ensure role is correct
	_, err = db.Exec(`INSERT INTO admins (username, app, role) VALUES ('root', 'system', 'root') 
		ON DUPLICATE KEY UPDATE role = 'root'`)
	if err != nil {
		return fmt.Errorf("assigning root role: %w", err)
	}

	return nil
}
