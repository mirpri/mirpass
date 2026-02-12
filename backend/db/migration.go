package db

import (
	"database/sql"
	"fmt"
	"mirpass-backend/utils"
)

func runMigration(db *sql.DB) error {
	// Ensure root user exists.
	// We use ON DUPLICATE KEY UPDATE to ensure the root password is reset to default ('root')
	// if the hashing algorithm changes or if it was manually messed up.

	// Default password is "root". match frontend logic: Sha256 -> Bcrypt
	passHex := utils.Sha256("root")
	hash, err := utils.HashPassword(passHex)
	if err != nil {
		return fmt.Errorf("hashing default password: %w", err)
	}

	// Insert or Update user to ensure password schema is correct
	_, err = db.Exec(`INSERT INTO users (username, email, password_hash, is_verified) 
		VALUES ('root', 'root@localhost', ?, TRUE) ON DUPLICATE KEY UPDATE is_verified = TRUE`, string(hash))
	if err != nil {
		return fmt.Errorf("creating/updating root user: %w", err)
	}

	// Ensure root has root role for system
	// Using ON DUPLICATE KEY UPDATE to ensure role is correct
	_, err = db.Exec(`INSERT INTO admins (username, app, role) VALUES ('root', 'system', 'root') 
		ON DUPLICATE KEY UPDATE role = 'root'`)
	if err != nil {
		return fmt.Errorf("assigning root role: %w", err)
	}

	// Drop auth_code_used
	db.Exec("ALTER TABLE login_sessions DROP COLUMN auth_code_used")

	return nil
}
