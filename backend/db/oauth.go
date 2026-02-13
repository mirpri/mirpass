package db

import (
	"database/sql"
	"fmt"
	"mirpass-backend/types"
	"strings"
	"time"
)

func CreateDeviceFlowSession(clientId string, sessionId string, deviceCode string, userCode string) error {
	_, err := database.Exec(`INSERT INTO oauth_sessions (client_id, session_id, device_code, user_code, flow_type, status)
	VALUES (?, ?, ?, ?, 'device_code', 'pending')`, clientId, sessionId, deviceCode, userCode)
	return err
}

func GetSessionByDeviceCode(deviceCode string) (*types.DeviceFlowSession, error) {
	row := database.QueryRow(`SELECT client_id, session_id, device_code, user_code, status, expires_at, last_poll FROM oauth_sessions WHERE device_code = ?`, deviceCode)

	var s types.DeviceFlowSession
	err := row.Scan(&s.ClientID, &s.SessionID, &s.DeviceCode, &s.UserCode, &s.Status, &s.ExpiresAt, &s.LastPoll)
	if err != nil {
		return nil, err
	}
	t, err := time.Parse(time.RFC3339, s.ExpiresAt)
	if err != nil || time.Now().After(t) {
		UpdateSessionStatus(s.SessionID, "", "")
		s.Status = "expired"
	}
	return &s, nil
}

func GetAuthCodeSessionBySessionId(sessionId string) (*types.AuthCodeFlowSession, error) {
	row := database.QueryRow(`SELECT client_id, session_id, redirect_uri, code_challenge, code_challenge_method, state, status, expires_at FROM oauth_sessions WHERE session_id = ?`, sessionId)

	var s types.AuthCodeFlowSession
	var state sql.NullString
	err := row.Scan(&s.ClientID, &s.SessionID, &s.RedirectURI, &s.CodeChallenge, &s.CodeChallengeMethod, &state, &s.Status, &s.ExpiresAt)
	if err != nil {
		return nil, err
	}
	if state.Valid {
		s.State = state.String
	}
	t, err := time.Parse(time.RFC3339, s.ExpiresAt)
	if err != nil || time.Now().After(t) {
		UpdateSessionStatus(s.SessionID, "", "")
		s.Status = "expired"
	}
	return &s, nil
}

func GetActiveSessionByUserCode(userCode string) (*types.DeviceFlowSession, error) {
	userCode = strings.ToUpper(userCode)
	row := database.QueryRow(`SELECT session_id, client_id, username, device_code, user_code, status, expires_at, last_poll FROM oauth_sessions WHERE user_code = ? AND status = 'pending'`, userCode)

	var s types.DeviceFlowSession
	var Username sql.NullString
	err := row.Scan(&s.SessionID, &s.ClientID, &Username, &s.DeviceCode, &s.UserCode, &s.Status, &s.ExpiresAt, &s.LastPoll)
	if err != nil {
		return nil, err
	}
	if Username.Valid {
		s.Username = Username.String
	}
	t, err := time.Parse(time.RFC3339, s.ExpiresAt)
	if err != nil || time.Now().After(t) {
		UpdateSessionStatus(s.SessionID, "", "")
		return nil, fmt.Errorf("Session expired")
	}
	return &s, nil
}

func GetSessionBySessionId(sessionId string) (*types.OAuthSession, error) {
	row := database.QueryRow(`SELECT session_id, client_id, username, status, expires_at FROM oauth_sessions WHERE session_id = ?`, sessionId)

	var s types.OAuthSession
	var Username sql.NullString
	err := row.Scan(&s.SessionID, &s.ClientID, &Username, &s.Status, &s.ExpiresAt)
	if err != nil {
		return nil, err
	}
	if Username.Valid {
		s.Username = Username.String
	}
	return &s, nil
}

func UpdateSessionPoll(sessionId string) error {
	_, err := database.Exec(`UPDATE oauth_sessions SET last_poll = CURRENT_TIMESTAMP WHERE session_id = ?`, sessionId)
	return err
}

func UpdateSessionStatus(sessionId string, status string, username string) error {
	session, err := GetSessionBySessionId(sessionId)
	if err != nil {
		return err
	}

	if username != "" {
		_, err = database.Exec(`UPDATE oauth_sessions SET username = ? WHERE session_id = ?`, username, sessionId)
		if err != nil {
			return err
		}
	}

	if session.Status == "consumed" {
		return nil
	}

	t, err := time.Parse(time.RFC3339, session.ExpiresAt)
	if err != nil || time.Now().After(t) {
		_, err = database.Exec(`UPDATE oauth_sessions SET status = 'expired' WHERE session_id = ?`, sessionId)
		return nil
	}

	if status == "" {
		return nil
	}

	_, err = database.Exec(`UPDATE oauth_sessions SET status = ?, username = ? WHERE session_id = ?`, status, username, sessionId)
	return err
}

func CreateAuthCodeSession(clientId string, sessionId string, redirect_uri string, code_challenge string, code_challenge_method string, state string) error {
	_, err := database.Exec(`INSERT INTO oauth_sessions (client_id, session_id, redirect_uri, code_challenge, code_challenge_method, state, flow_type, status) VALUES (?, ?, ?, ?, ?, ?, 'authorization_code', 'pending')`, clientId, sessionId, redirect_uri, code_challenge, code_challenge_method, state)
	return err
}

func UpdateAuthCodeSessionCode(sessionId string, code string, username string) error {
	_, err := database.Exec(`UPDATE oauth_sessions SET status = 'authorized', auth_code = ?, username = ? WHERE session_id = ?`, code, username, sessionId)
	return err
}

func GetAuthCodeSessionByCode(code string) (*types.AuthCodeFlowSession, error) {
	row := database.QueryRow(`SELECT client_id, session_id, redirect_uri, code_challenge, code_challenge_method, state, status, expires_at, username FROM oauth_sessions WHERE auth_code = ?`, code)

	var s types.AuthCodeFlowSession
	var State sql.NullString
	var Username sql.NullString
	err := row.Scan(&s.ClientID, &s.SessionID, &s.RedirectURI, &s.CodeChallenge, &s.CodeChallengeMethod, &State, &s.Status, &s.ExpiresAt, &Username)
	if err != nil {
		return nil, err
	}
	s.State = State.String
	if Username.Valid {
		s.Username = Username.String
	}
	t, err := time.Parse(time.RFC3339, s.ExpiresAt)
	if err != nil || time.Now().After(t) {
		UpdateSessionStatus(s.SessionID, "", "")
		s.Status = "expired"
	}
	return &s, nil
}

func AddHistory(username string, appId string) error {
	_, err := database.Exec(`INSERT INTO history (username, app_id) VALUES (?, ?)`, username, appId)
	return err
}
