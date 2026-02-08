package db

import (
	"database/sql"
	"fmt"
	"time"

	"mirpass-backend/types"
	"mirpass-backend/utils"

	"github.com/go-sql-driver/mysql"
)

func GetUserLoginHistory(username string) ([]types.LoginHistoryItem, error) {
	// Gets all distinct apps logged into and their last login time
	// AND the recent history log.
	// But to fit the existing "LoginHistoryItem" struct (App, Time), let's just return the full history for now.
	// The user asked for "dashboard显示自己登录过的所有app和最后登录时间" which is a summary.
	// But the dashboard also has a "Recent History" table.
	// Let's modify this to return two datasets? Or just let the handler call two DB functions.
	// For now, I will create a NEW function GetUserAppsSummary and keep this one for the detailed history log.

	query := `
		SELECT a.name as app, a.logo_url, ls.login_at
		FROM login_sessions ls
		JOIN applications a ON ls.app_id = a.id
		WHERE ls.username = ? AND ls.login_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 7 DAY)
		ORDER BY ls.login_at DESC
	`
	rows, err := database.Query(query, username)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var history []types.LoginHistoryItem
	for rows.Next() {
		var item types.LoginHistoryItem
		var logo sql.NullString
		if err := rows.Scan(&item.App, &logo, &item.Timestamp); err != nil {
			return nil, err
		}
		item.LogoUrl = logo.String
		history = append(history, item)
	}
	return history, nil
}

func GetUserAppsSummary(username string) ([]types.LoginHistoryItem, error) {
	// Returns distinct apps and last login time
	query := `
		SELECT a.name as app, a.logo_url, MAX(ls.login_at) as last_login
		FROM login_sessions ls
		JOIN applications a ON ls.app_id = a.id
		WHERE ls.username = ?
		GROUP BY a.name, a.logo_url
		ORDER BY last_login DESC
	`
	rows, err := database.Query(query, username)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var summary []types.LoginHistoryItem
	for rows.Next() {
		var item types.LoginHistoryItem
		var logo sql.NullString
		if err := rows.Scan(&item.App, &logo, &item.Timestamp); err != nil {
			return nil, err
		}
		item.LogoUrl = logo.String
		summary = append(summary, item)
	}
	return summary, nil
}

func GetAppLoginStats(appID string) ([]types.LoginHistoryItem, int, error) {
	// Total users count (distinct users who have ever logged in to this app)
	var totalUsers int
	countQuery := `SELECT COUNT(DISTINCT username) FROM login_sessions WHERE app_id = ? AND login_at IS NOT NULL`
	if err := database.QueryRow(countQuery, appID).Scan(&totalUsers); err != nil {
		return nil, 0, err
	}

	// Login history (last 7 days)
	// We return raw data to frontend to draw charts? Or aggregate here?
	// User asked for "Login History" query for past 7 days, containing only User/App/Time.
	// AND a chart showing daily logins and active users.
	// Let's return the raw history list for the last 7 days.

	query := `
		SELECT username, login_at
		FROM login_sessions
		WHERE app_id = ? AND login_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 7 DAY)
		ORDER BY login_at DESC
	`
	rows, err := database.Query(query, appID)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var history []types.LoginHistoryItem
	for rows.Next() {
		var item types.LoginHistoryItem
		var user sql.NullString
		if err := rows.Scan(&user, &item.Timestamp); err != nil {
			return nil, 0, err
		}
		item.App = appID // implied
		item.User = user.String
		history = append(history, item)
	}

	return history, totalUsers, nil
}

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

func GetUserByEmail(email string) (*types.User, error) {
	var user types.User
	query := "SELECT username, email, password_hash, is_verified FROM users WHERE email = ?"
	err := database.QueryRow(query, email).Scan(&user.Username, &user.Email, &user.PasswordHash, &user.IsVerified)
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
	// With username as PK, LastInsertId might not be relevant depending on driver, but returning rows affected or 0 is safe enough for caller who doesn't use it.
	return result.RowsAffected()
}

func ResolveRegistrationConflict(username, email string) error {
	// Find any conflicting users
	query := "SELECT username, email, is_verified FROM users WHERE username = ? OR email = ?"
	rows, err := database.Query(query, username, email)
	if err != nil {
		return err
	}
	defer rows.Close()

	var toDelete []string

	for rows.Next() {
		var uName string
		var uEmail string
		var isVerified bool
		if err := rows.Scan(&uName, &uEmail, &isVerified); err != nil {
			return err
		}

		if isVerified {
			if uName == username {
				return fmt.Errorf("username already taken")
			}
			if uEmail == email {
				return fmt.Errorf("email already taken")
			}
		}
		toDelete = append(toDelete, uName)
	}

	if len(toDelete) > 0 {
		tx, err := database.Begin()
		if err != nil {
			return err
		}

		for _, u := range toDelete {
			// Delete verifications
			_, err = tx.Exec("DELETE FROM verifications WHERE username = ?", u)
			if err != nil {
				tx.Rollback()
				return err
			}
			// Delete users
			_, err = tx.Exec("DELETE FROM users WHERE username = ?", u)
			if err != nil {
				tx.Rollback()
				return err
			}
		}

		return tx.Commit()
	}

	return nil
}

func GetVerificationInfo(token string) (string, error) {
	var task string
	err := database.QueryRow(`
		SELECT task 
		FROM verifications 
		WHERE token = ? AND expires_at > UTC_TIMESTAMP()`, token).Scan(&task)
	return task, err
}

func CreateVerification(username, token, task, detail string) error {
	_, err := database.Exec("INSERT INTO verifications (username, token, task, detail, expires_at) VALUES (?, ?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 24 HOUR))",
		username, token, task, detail)
	return err
}

func VerifyUserByToken(token string) (string, error) {
	var username, task string
	var detail sql.NullString
	// Use explicit columns to avoid scan errors if schema drifted
	// And check expiry
	err := database.QueryRow(`
		SELECT username, task, detail 
		FROM verifications 
		WHERE token = ? AND expires_at > UTC_TIMESTAMP()`, token).Scan(&username, &task, &detail)

	if err != nil {
		return "", err
	}

	// Begin transaction
	tx, err := database.Begin()
	if err != nil {
		return "", err
	}

	deleteToken := true

	switch task {
	case "register":
		_, err = tx.Exec("UPDATE users SET is_verified = TRUE WHERE username = ?", username)
	case "change_email":
		if !detail.Valid {
			err = fmt.Errorf("no new email in verification detail")
		} else {
			conflict_err := ResolveRegistrationConflict("", detail.String)
			if conflict_err != nil {
				if conflict_err.Error() == "email already taken" {
					err = fmt.Errorf("email already in use")
				} else {
					err = fmt.Errorf("database error checking email conflict")
				}
			} else {
				_, err = tx.Exec("UPDATE users SET email = ? WHERE username = ?", detail.String, username)
			}
		}
	case "reset_password":
		if !detail.Valid {
			err = fmt.Errorf("no new password in verification detail")
		} else {
			_, err = tx.Exec("UPDATE users SET password_hash = ? WHERE username = ?", detail.String, username)
		}
	default:
		// Attempt to just verify user if unknown task (fallback)
		_, err = tx.Exec("UPDATE users SET is_verified = TRUE WHERE username = ?", username)
	}

	if err != nil {
		tx.Rollback()
		return "", err
	}

	if deleteToken {
		_, err = tx.Exec("DELETE FROM verifications WHERE token = ?", token)
		if err != nil {
			tx.Rollback()
			return "", err
		}
	}

	if err := tx.Commit(); err != nil {
		return "", err
	}

	return task, nil
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

func AdminUpdateUserInfo(username string, email, nickname, avatarUrl string) error {
	tx, err := database.Begin()
	if err != nil {
		return err
	}

	_, err = tx.Exec("UPDATE users SET email = ?, nickname = ?, avatar_url = ? WHERE username = ?",
		email, nickname, avatarUrl, username)
	if err != nil {
		tx.Rollback()
		return err
	}

	return tx.Commit()
}

func MarkUserVerified(username string) error {
	tx, err := database.Begin()
	if err != nil {
		return err
	}

	_, err = tx.Exec("UPDATE users SET is_verified = TRUE WHERE username = ?", username)
	if err != nil {
		tx.Rollback()
		return err
	}

	_, err = tx.Exec("DELETE FROM verifications WHERE username = ?", username)
	if err != nil {
		tx.Rollback()
		return err
	}

	return tx.Commit()
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
			return "external", nil
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
	var logoUrl sql.NullString
	var suspendUntil sql.NullString

	err := database.QueryRow("SELECT id, name, description, logo_url, suspend_until, created_at FROM applications WHERE id = ?", appID).
		Scan(&app.ID, &app.Name, &app.Description, &logoUrl, &suspendUntil, &createdAt)
	if err != nil {
		return nil, err
	}
	app.CreatedAt = createdAt.String
	app.LogoURL = logoUrl.String
	if suspendUntil.Valid {
		s := suspendUntil.String
		app.SuspendUntil = &s
	}
	return &app, nil
}

func IsAppAdmin(username, appID string) (bool, error) {
	var count int
	err := database.QueryRow("SELECT COUNT(*) FROM admins WHERE username = ? AND (app = ? OR app = 'system') AND (role = 'admin' OR role = 'root')", username, appID).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

func IsAppAdminExplicit(username, appID string) (bool, error) {
	var count int
	err := database.QueryRow("SELECT COUNT(*) FROM admins WHERE username = ? AND app = ? AND (role = 'admin' OR role = 'root')", username, appID).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

func IsAppRoot(username, appID string) (bool, error) {
	var count int
	err := database.QueryRow("SELECT COUNT(*) FROM admins WHERE username = ? AND (app = ? OR app = 'system') AND role = 'root'", username, appID).Scan(&count)
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

func UpdateAppInfo(appID, name, description, logoUrl string) error {
	query := "UPDATE applications SET name = ?, description = ?, logo_url = ? WHERE id = ?"
	_, err := database.Exec(query, name, description, logoUrl, appID)
	return err
}

func UpdateAppSuspension(appID string, suspendUntil *string) error {
	query := "UPDATE applications SET suspend_until = ? WHERE id = ?"
	_, err := database.Exec(query, suspendUntil, appID)
	return err
}

func GetAllApps() ([]types.Application, error) {
	query := "SELECT id, name, description, logo_url, suspend_until, created_at FROM applications ORDER BY name ASC"
	rows, err := database.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var apps []types.Application
	for rows.Next() {
		var app types.Application
		var logoUrl sql.NullString
		var suspendUntil sql.NullString
		var createdAt sql.NullString

		if err := rows.Scan(&app.ID, &app.Name, &app.Description, &logoUrl, &suspendUntil, &createdAt); err != nil {
			return nil, err
		}
		app.LogoURL = logoUrl.String
		if suspendUntil.Valid {
			s := suspendUntil.String
			app.SuspendUntil = &s
		}
		app.CreatedAt = createdAt.String
		apps = append(apps, app)
	}
	return apps, nil
}

func SearchApps(query string) ([]types.Application, error) {
	q := "%" + query + "%"
	stmt := "SELECT id, name, description, logo_url, suspend_until, created_at FROM applications WHERE name LIKE ? OR description LIKE ? ORDER BY name ASC"
	rows, err := database.Query(stmt, q, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var apps []types.Application
	for rows.Next() {
		var app types.Application
		var logoUrl sql.NullString
		var suspendUntil sql.NullString
		var createdAt sql.NullString

		if err := rows.Scan(&app.ID, &app.Name, &app.Description, &logoUrl, &suspendUntil, &createdAt); err != nil {
			return nil, err
		}
		app.LogoURL = logoUrl.String
		if suspendUntil.Valid {
			s := suspendUntil.String
			app.SuspendUntil = &s
		}
		app.CreatedAt = createdAt.String
		apps = append(apps, app)
	}
	return apps, nil
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
        VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? MINUTE))`,
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
		Scan(&s.ID, &s.AppID, &s.SessionID, &username, &cAt, &eAt, &s.LoginAt)

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
        SET username = ?, login_at = UTC_TIMESTAMP() 
        WHERE session_id = ?`, username, sessionID)
	return err
}

func GetAppStatsSummary(appID string) (*types.AppStatsSummary, error) {
	summary := &types.AppStatsSummary{}

	// 1. Total Users
	err := database.QueryRow("SELECT COUNT(DISTINCT username) FROM login_sessions WHERE app_id = ? AND login_at IS NOT NULL", appID).Scan(&summary.TotalUsers)
	if err != nil {
		return nil, err
	}

	// 2. Total Logins
	err = database.QueryRow("SELECT COUNT(*) FROM login_sessions WHERE app_id = ? AND login_at IS NOT NULL", appID).Scan(&summary.TotalLogins)
	if err != nil {
		return nil, err
	}

	// 3. Active Users 24h
	err = database.QueryRow("SELECT COUNT(DISTINCT username) FROM login_sessions WHERE app_id = ? AND login_at >= UTC_TIMESTAMP() - INTERVAL 24 HOUR", appID).Scan(&summary.ActiveUsers24h)
	if err != nil {
		return nil, err
	}

	// 4. New Users 24h
	// Users whose FIRST login to this app was in the last 24h
	queryNewUsers := `
		SELECT COUNT(*) FROM (
			SELECT username 
			FROM login_sessions 
			WHERE app_id = ? AND login_at IS NOT NULL 
			GROUP BY username 
			HAVING MIN(login_at) >= UTC_TIMESTAMP() - INTERVAL 24 HOUR
		) as new_u`
	err = database.QueryRow(queryNewUsers, appID).Scan(&summary.NewUsers24h)
	if err != nil {
		return nil, err
	}

	// 5. Daily Stats (Last 7 days)
	summary.Daily = make([]types.DailyStats, 0)

	dailyQuery := `
		SELECT 
			DATE_FORMAT(login_at, '%Y-%m-%d') as date_str, 
			COUNT(*) as logins, 
			COUNT(DISTINCT username) as active
		FROM login_sessions 
		WHERE app_id = ? AND login_at >= DATE_SUB(UTC_DATE(), INTERVAL 6 DAY)
		GROUP BY DATE(login_at)
		ORDER BY DATE(login_at) ASC
	`
	rows, err := database.Query(dailyQuery, appID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	dailyMap := make(map[string]*types.DailyStats)
	for rows.Next() {
		var d types.DailyStats
		if err := rows.Scan(&d.Date, &d.Logins, &d.ActiveUsers); err != nil {
			return nil, err
		}
		dailyMap[d.Date] = &d
	}

	// Fill in last 7 days
	// First, get new users counts for the last 7 days in one query efficiently
	newUsersMap := make(map[string]int)
	newUsersQuery := `
		SELECT DATE_FORMAT(min_date, '%Y-%m-%d'), COUNT(*)
		FROM (
			SELECT MIN(login_at) as min_date 
			FROM login_sessions 
			WHERE app_id = ? 
			GROUP BY username
		) as user_firsts
		WHERE min_date >= DATE_SUB(UTC_DATE(), INTERVAL 6 DAY)
		GROUP BY DATE(min_date)
	`
	nuRows, err := database.Query(newUsersQuery, appID)
	if err == nil {
		defer nuRows.Close()
		for nuRows.Next() {
			var dStr string
			var count int
			if err := nuRows.Scan(&dStr, &count); err == nil {
				newUsersMap[dStr] = count
			}
		}
	}

	for i := 6; i >= 0; i-- {
		date := time.Now().UTC().AddDate(0, 0, -i).Format("2006-01-02")
		d, exists := dailyMap[date]
		if !exists {
			d = &types.DailyStats{Date: date, Logins: 0, ActiveUsers: 0}
		}

		if count, ok := newUsersMap[date]; ok {
			d.NewUsers = count
		} else {
			d.NewUsers = 0
		}

		summary.Daily = append(summary.Daily, *d)
	}

	return summary, nil
}

func GetAppHistory(appID string, dateStr string) ([]types.LoginHistoryItem, error) {
	var query string
	var args []interface{}
	args = append(args, appID)

	if dateStr != "" {
		query = `
			SELECT username, login_at 
			FROM login_sessions 
			WHERE app_id = ? AND DATE(login_at) = ? 
			ORDER BY login_at DESC`
		args = append(args, dateStr)
	} else {
		// Default history (last 100)
		query = `
			SELECT username, login_at 
			FROM login_sessions 
			WHERE app_id = ? AND login_at IS NOT NULL
			ORDER BY login_at DESC LIMIT 100`
	}

	rows, err := database.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var history []types.LoginHistoryItem
	for rows.Next() {
		var item types.LoginHistoryItem
		var user sql.NullString
		if err := rows.Scan(&user, &item.Timestamp); err != nil {
			return nil, err
		}
		item.App = appID
		item.User = user.String
		history = append(history, item)
	}

	return history, nil
}
