package db

import (
	"database/sql"

	"github.com/go-sql-driver/mysql"
)

func GetDBConfig() mysql.Config {
	return cfg
}

func DBRun(query string) (sql.Result, error) {
	result, err := database.Exec(query)
	return result, err
}

type User struct {
	ID           int
	Username     string
	Email        string
	PasswordHash string
	IsVerified   bool
}

func GetUserByUsername(username string) (*User, error) {
	var user User
	err := database.QueryRow("SELECT id, username, email, password_hash, is_verified FROM users WHERE username = ?", username).
		Scan(&user.ID, &user.Username, &user.Email, &user.PasswordHash, &user.IsVerified)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func CreateUser(username, email, passwordHash string) (int64, error) {
	result, err := database.Exec("INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)", username, email, passwordHash)
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}

func CreateVerification(userID int64, token string) error {
	_, err := database.Exec("INSERT INTO verifications (user_id, token) VALUES (?, ?)", userID, token)
	return err
}

func VerifyUserByToken(token string) error {
	var userID int
	err := database.QueryRow("SELECT user_id FROM verifications WHERE token = ?", token).Scan(&userID)
	if err != nil {
		return err
	}

	// Begin transaction
	tx, err := database.Begin()
	if err != nil {
		return err
	}

	_, err = tx.Exec("UPDATE users SET is_verified = TRUE WHERE id = ?", userID)
	if err != nil {
		tx.Rollback()
		return err
	}

	_, err = tx.Exec("DELETE FROM verifications WHERE token = ?", token)
	if err != nil {
		tx.Rollback()
		return err
	}

	return tx.Commit()
}
