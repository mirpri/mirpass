package db

import (
	"database/sql"

	"mirpass-backend/types"
	"mirpass-backend/utils"

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
	query := `
		SELECT a.app, COALESCE(app_tbl.name, a.app), a.role 
		FROM admins a 
		LEFT JOIN applications app_tbl ON a.app = app_tbl.id 
		WHERE a.username = ?`

	rows, err := database.Query(query, username)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var apps []types.AppRole
	for rows.Next() {
		var ar types.AppRole
		if err := rows.Scan(&ar.AppID, &ar.Name, &ar.Role); err != nil {
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

func CreateApp(name, description, owner string) (string, error) {
	// Generate ID
	id := utils.GenerateID()

	tx, err := database.Begin()
	if err != nil {
		return "", err
	}

	// Insert App
	_, err = tx.Exec("INSERT INTO applications (id, name, description) VALUES (?, ?, ?)", id, name, description)
	if err != nil {
		tx.Rollback()
		return "", err
	}

	// Insert Admin (owner)
	_, err = tx.Exec("INSERT INTO admins (username, app, role) VALUES (?, ?, 'root')", owner, id)
	if err != nil {
		tx.Rollback()
		return "", err
	}

	if err = tx.Commit(); err != nil {
		return "", err
	}

	return id, nil
}

func GetApplication(appID string) (*types.Application, error) {
	var app types.Application
	var createdAt sql.NullString
	err := database.QueryRow("SELECT id, name, description, created_at FROM applications WHERE id = ?", appID).
		Scan(&app.ID, &app.Name, &app.Description, &createdAt)
	if err != nil {
		return nil, err
	}
	app.CreatedAt = createdAt.String
	return &app, nil
}

func IsAppAdmin(username, appID string) (bool, error) {
	var count int
	err := database.QueryRow("SELECT COUNT(*) FROM admins WHERE username = ? AND app = ? AND (role = 'admin' OR role = 'root')", username, appID).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

func GetAppKeys(appID string) ([]types.APIKey, error) {
	rows, err := database.Query("SELECT id, app_id, COALESCE(name, ''), created_at FROM api_keys WHERE app_id = ? ORDER BY created_at DESC", appID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var keys []types.APIKey
	for rows.Next() {
		var k types.APIKey
		var createdAt sql.NullString
		if err := rows.Scan(&k.ID, &k.AppID, &k.Name, &createdAt); err != nil {
			return nil, err
		}
		k.CreatedAt = createdAt.String
		keys = append(keys, k)
	}
	return keys, nil
}

func CreateAPIKey(appID, keyHash, name string) (int64, error) {
	res, err := database.Exec("INSERT INTO api_keys (app_id, key_hash, name) VALUES (?, ?, ?)", appID, keyHash, name)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func DeleteAPIKey(keyID int64, appID string) error {
	res, err := database.Exec("DELETE FROM api_keys WHERE id = ? AND app_id = ?", keyID, appID)
	if err != nil {
		return err
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func UpdateApp(appID, name, description string) error {
	_, err := database.Exec("UPDATE applications SET name = ?, description = ? WHERE id = ?", name, description, appID)
	return err
}

func DeleteApp(appID string) error {
	_, err := database.Exec("DELETE FROM applications WHERE id = ?", appID)
	return err
}

func AddAppMember(appID, username, role string) error {
	_, err := database.Exec("INSERT INTO admins (username, app, role) VALUES (?, ?, ?)", username, appID, role)
	return err
}

func RemoveAppMember(appID, username string) error {
	_, err := database.Exec("DELETE FROM admins WHERE username = ? AND app = ?", username, appID)
	return err
}

func UpdateAppMemberRole(appID, username, role string) error {
	_, err := database.Exec("UPDATE admins SET role = ? WHERE username = ? AND app = ?", role, username, appID)
	return err
}

func GetAppMembers(appID string) ([]types.AppMember, error) {
	query := `
		SELECT a.username, a.role, u.avatar_url 
		FROM admins a 
		LEFT JOIN users u ON a.username = u.username 
		WHERE a.app = ?`
	rows, err := database.Query(query, appID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var members []types.AppMember
	for rows.Next() {
		var m types.AppMember
		var avatar sql.NullString
		if err := rows.Scan(&m.Username, &m.Role, &avatar); err != nil {
			return nil, err
		}
		m.AvatarUrl = avatar.String
		members = append(members, m)
	}
	return members, nil
}

// --- SSO Operations ---

func GetAppIDByAPIKeyHash(hash string) (string, error) {
	var appID string
	err := database.QueryRow("SELECT app_id FROM api_keys WHERE key_hash = ?", hash).Scan(&appID)
	if err != nil {
		return "", err
	}
	return appID, nil
}

func GetAppName(appID string) (string, error) {
	var name string
	err := database.QueryRow("SELECT name FROM applications WHERE id = ?", appID).Scan(&name)
	return name, err
}

func CreateLoginSession(appID string, sessionID string, expiryMinutes int) error {
	_, err := database.Exec(`
        INSERT INTO login_sessions (app_id, session_id, expires_at) 
        VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
		appID, sessionID, expiryMinutes)
	return err
}

func GetLoginSession(sessionID string) (*types.SSOSession, error) {
	s := &types.SSOSession{}
	var username sql.NullString
	var loginAt sql.NullString

	var cAt, eAt sql.NullString

	err := database.QueryRow(`
        SELECT id, app_id, session_id, username, created_at, expires_at, login_at 
        FROM login_sessions WHERE session_id = ?`, sessionID).
		Scan(&s.ID, &s.AppID, &s.SessionID, &username, &cAt, &eAt, &loginAt)

	if err != nil {
		return nil, err
	}
	s.CreatedAt = cAt.String
	s.ExpiresAt = eAt.String

	if username.Valid {
		u := username.String
		s.Username = &u
	}
	if loginAt.Valid {
		l := loginAt.String
		s.LoginAt = &l
	}
	return s, nil
}

func ConfirmLoginSession(sessionID string, username string) error {
	_, err := database.Exec(`
        UPDATE login_sessions 
        SET username = ?, login_at = NOW() 
        WHERE session_id = ?`, username, sessionID)
	return err
}
