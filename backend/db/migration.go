package db

import (
	"database/sql"
	"fmt"
	"log"

	"golang.org/x/crypto/bcrypt"
)

func runMigration(db *sql.DB) error {

	// Ensure admins table uses ENUM for role
	// This might fail if there are values in role that are not 'admin' or 'root', but assuming clean or valid state
	if _, err := db.Exec(`ALTER TABLE admins MODIFY COLUMN role ENUM('admin', 'root') NOT NULL`); err != nil {
		// Just log error, don't fail, maybe table doesn't exist yet (though init should have created it)
		// Or maybe it already is ENUM
		log.Default().Printf("Migration warning (modify admins role): %v", err)
	}

	// Create default root user
	var rootID int
	err := db.QueryRow("SELECT id FROM users WHERE username = 'root'").Scan(&rootID)
	if err == sql.ErrNoRows {
		// Create root user
		hash, err := bcrypt.GenerateFromPassword([]byte("root"), bcrypt.DefaultCost)
		if err != nil {
			return fmt.Errorf("hashing password: %w", err)
		}
		// Insert user
		res, err := db.Exec("INSERT INTO users (username, email, password_hash, is_verified) VALUES ('root', 'root@localhost', ?, TRUE)", string(hash))
		if err != nil {
			return fmt.Errorf("creating root user: %w", err)
		}
		id, _ := res.LastInsertId()
		rootID = int(id)
		log.Println("Created default root user (username: root, password: root)")
	} else if err != nil {
		return fmt.Errorf("checking root user: %w", err)
	}

	// Ensure root has root role for system
	// Using ON DUPLICATE KEY UPDATE to ensure role is correct
	_, err = db.Exec(`INSERT INTO admins (username, app, role) VALUES (?, 'system', 'root') 
		ON DUPLICATE KEY UPDATE role = 'root'`, rootID)
	if err != nil {
		return fmt.Errorf("assigning root role: %w", err)
	}

	return nil
}
