package db

import (
	"database/sql"

	"mirpass-backend/types"

	"github.com/go-sql-driver/mysql"
)

func GetDBConfig() mysql.Config {
	return cfg
}

func DBRun(query string) (sql.Result, error) {
	result, err := database.Exec(query)
	return result, err
}

func GetUserByUsername(username string) (*types.User, error) {
	var user types.User
	var nickname sql.NullString
	var avatar sql.NullString

	query := `
		SELECT username, email, password_hash, nickname, avatar_url, is_verified 
		FROM users 
		WHERE username = ?`

	err := database.QueryRow(query, username).
		Scan(&user.Username, &user.Email, &user.PasswordHash, &nickname, &avatar, &user.IsVerified)
	if err != nil {
		return nil, err
	}
	user.Nickname = nickname.String
	user.AvatarURL = avatar.String
	return &user, nil
}

func CreateUser(username, email, passwordHash string) (int64, error) {
	result, err := database.Exec("INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)", username, email, passwordHash)
	if err != nil {
		return 0, err
	}
	// With username as PK, LastInsertId might not be relevant depending on driver, but returning rows affected or 0 is safe enough for caller who doesn't use it.
	return result.RowsAffected()
}

func CreateVerification(username string, token string) error {
	_, err := database.Exec("INSERT INTO verifications (username, token) VALUES (?, ?)", username, token)
	return err
}

func VerifyUserByToken(token string) error {
	var username string
	err := database.QueryRow("SELECT username FROM verifications WHERE token = ?", token).Scan(&username)
	if err != nil {
		return err
	}

	// Begin transaction
	tx, err := database.Begin()
	if err != nil {
		return err
	}

	_, err = tx.Exec("UPDATE users SET is_verified = TRUE WHERE username = ?", username)
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

func UpdateUserNickname(username, nickname string) error {
	_, err := database.Exec("UPDATE users SET nickname = ? WHERE username = ?", nickname, username)
	return err
}

func UpdateUserAvatar(username, avatarUrl string) error {
	_, err := database.Exec("UPDATE users SET avatar_url = ? WHERE username = ?", avatarUrl, username)
	return err
}

func GetAllUsers() ([]types.User, error) {
	query := `
		SELECT username, email, nickname, avatar_url, is_verified 
		FROM users`
	rows, err := database.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []types.User
	for rows.Next() {
		var u types.User
		var nickname, avatar sql.NullString
		if err := rows.Scan(&u.Username, &u.Email, &nickname, &avatar, &u.IsVerified); err != nil {
			return nil, err
		}
		u.Nickname = nickname.String
		u.AvatarURL = avatar.String
		users = append(users, u)
	}
	return users, nil
}

func SearchUsers(query string) ([]types.User, error) {
	pattern := "%" + query + "%"
	sqlQuery := `
		SELECT username, email, nickname, avatar_url, is_verified 
		FROM users 
		WHERE username LIKE ? OR email LIKE ? OR nickname LIKE ?`
	rows, err := database.Query(sqlQuery, pattern, pattern, pattern)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []types.User
	for rows.Next() {
		var u types.User
		var nickname, avatar sql.NullString
		if err := rows.Scan(&u.Username, &u.Email, &nickname, &avatar, &u.IsVerified); err != nil {
			return nil, err
		}
		u.Nickname = nickname.String
		u.AvatarURL = avatar.String
		users = append(users, u)
	}
	return users, nil
}

func DeleteUser(username string) error {
	_, err := database.Exec("DELETE FROM users WHERE username = ?", username)
	return err
}

func UpdateUserRole(username string, role string) error {
	// If role is user, remove from admins table for 'system'
	if role == "user" {
		_, err := database.Exec("DELETE FROM admins WHERE username = ? AND app = 'system'", username)
		return err
	}

	// For admin or root, insert or update
	_, err := database.Exec(`
		INSERT INTO admins (username, app, role) 
		VALUES (?, 'system', ?) 
		ON DUPLICATE KEY UPDATE role = ?`, username, role, role)
	return err
}

func UpdateUserPassword(username string, passwordHash string) error {
	_, err := database.Exec("UPDATE users SET password_hash = ? WHERE username = ?", passwordHash, username)
	return err
}

func UpdateUserInfo(username string, email, nickname string) error {
	_, err := database.Exec("UPDATE users SET email = ?, nickname = ? WHERE username = ?", email, nickname, username)
	return err
}

func DirectQuery(query string) ([]map[string]interface{}, error) {
	rows, err := database.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	columns, err := rows.Columns()
	if err != nil {
		return nil, err
	}

	var results []map[string]interface{}
	for rows.Next() {
		// Create a slice of interface{} to hold values
		values := make([]interface{}, len(columns))
		valuePtrs := make([]interface{}, len(columns))
		for i := range values {
			valuePtrs[i] = &values[i]
		}

		if err := rows.Scan(valuePtrs...); err != nil {
			return nil, err
		}

		row := make(map[string]interface{})
		for i, col := range columns {
			var v interface{}
			val := values[i]
			b, ok := val.([]byte)
			if ok {
				v = string(b)
			} else {
				v = val
			}
			row[col] = v
		}
		results = append(results, row)
	}
	return results, nil
}

func GetSystemRole(username string) (string, error) {
	var role string
	err := database.QueryRow("SELECT role FROM admins WHERE username = ? AND app = 'system'", username).Scan(&role)
	if err != nil {
		if err == sql.ErrNoRows {
			return "", nil
		}
		return "", err
	}
	return role, nil
}

func GetAllUsersWithSystemRole() ([]types.UserWithSystemRole, error) {
	query := `
		SELECT u.username, u.email, u.nickname, u.avatar_url, a.role, u.is_verified 
		FROM users u 
		LEFT JOIN admins a ON u.username = a.username AND a.app = 'system'`
	rows, err := database.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []types.UserWithSystemRole
	for rows.Next() {
		var u types.UserWithSystemRole
		var nickname, avatar, role sql.NullString
		if err := rows.Scan(&u.Username, &u.Email, &nickname, &avatar, &role, &u.IsVerified); err != nil {
			return nil, err
		}
		u.Nickname = nickname.String
		u.AvatarURL = avatar.String
		u.Role = role.String
		if u.Role == "" {
			u.Role = "user"
		}
		users = append(users, u)
	}
	return users, nil
}

func SearchUsersWithSystemRole(query string) ([]types.UserWithSystemRole, error) {
	pattern := "%" + query + "%"
	sqlQuery := `
		SELECT u.username, u.email, u.nickname, u.avatar_url, a.role, u.is_verified 
		FROM users u 
		LEFT JOIN admins a ON u.username = a.username AND a.app = 'system'
		WHERE u.username LIKE ? OR u.email LIKE ? OR u.nickname LIKE ?`
	rows, err := database.Query(sqlQuery, pattern, pattern, pattern)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []types.UserWithSystemRole
	for rows.Next() {
		var u types.UserWithSystemRole
		var nickname, avatar, role sql.NullString
		if err := rows.Scan(&u.Username, &u.Email, &nickname, &avatar, &role, &u.IsVerified); err != nil {
			return nil, err
		}
		u.Nickname = nickname.String
		u.AvatarURL = avatar.String
		u.Role = role.String
		if u.Role == "" {
			u.Role = "user"
		}
		users = append(users, u)
	}
	return users, nil
}

func GetAdminApps(username string) ([]types.AppRole, error) {
	rows, err := database.Query("SELECT app, role FROM admins WHERE username = ?", username)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var apps []types.AppRole
	for rows.Next() {
		var ar types.AppRole
		if err := rows.Scan(&ar.App, &ar.Role); err != nil {
			return nil, err
		}
		apps = append(apps, ar)
	}
	return apps, nil
}

func GetAppRole(username string, app string) (string, error) {
	var role string
	err := database.QueryRow("SELECT role FROM admins WHERE username = ? AND app = ?", username, app).Scan(&role)
	if err != nil {
		if err == sql.ErrNoRows {
			return "", nil
		}
		return "", err
	}
	return role, nil
}
