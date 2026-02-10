package db

import (
	"database/sql"
	"fmt"
	"log"
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
		VALUES ('root', 'root@localhost', ?, TRUE) 
		ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)`, string(hash))
	if err != nil {
		return fmt.Errorf("creating/updating root user: %w", err)
	}
	log.Println("Ensured default root user (username: root) exists and password is set")

	// Ensure root has root role for system
	// Using ON DUPLICATE KEY UPDATE to ensure role is correct
	_, err = db.Exec(`INSERT INTO admins (username, app, role) VALUES ('root', 'system', 'root') 
		ON DUPLICATE KEY UPDATE role = 'root'`)
	if err != nil {
		return fmt.Errorf("assigning root role: %w", err)
	}

	// Migrate login_sessions table
	// Attempt to add columns. Ignore errors if they exist.
	// We are dropping auth_code_used and adding state and poll_secret.
	// Since we can't easily check column existence in raw SQL without extra queries,
	// we'll try to add and ignore duplicate column errors, or use a comprehensive migration strategy.
	// For this context, assuming we can just run ALTER statements.

	// Add state if not exists (simulated by ignoring error usually, but here we'll just run it)
	// Safest way in simple script is to try query.

	db.Exec("ALTER TABLE login_sessions ADD COLUMN state VARCHAR(50) DEFAULT 'pending'")
	db.Exec("ALTER TABLE login_sessions ADD COLUMN poll_secret VARCHAR(255) DEFAULT NULL")
	db.Exec("ALTER TABLE login_sessions ADD COLUMN auth_code VARCHAR(255) DEFAULT NULL")

	// Migration data: If auth_code_used was true, state = exchanged.
	// If auth_code_used column exists, we can use it.
	// Check if auth_code_used exists?
	// We'll blindly try to update based on it, if it fails, it implies it's already dropped or didn't exist (fresh install).
	db.Exec("UPDATE login_sessions SET state = 'exchanged' WHERE auth_code_used = 1")
	db.Exec("UPDATE login_sessions SET state = 'delivered' WHERE auth_code_used = 0 AND auth_code IS NOT NULL AND login_at IS NOT NULL")

	// Drop auth_code_used
	db.Exec("ALTER TABLE login_sessions DROP COLUMN auth_code_used")

	return nil
}
