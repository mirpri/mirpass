package db

import (
	"mirpass-backend/types"
	"time"
)

func CreateDeviceFlowSession(clientId string, sessionId string, deviceCode string, userCode string) error {
	_, err := database.Exec(`INSERT INTO oauth_device_flow (app_id, session_id, device_code, user_code, flow_type, status)
	VALUES (?, ?, ?, ?, 'device_code', 'pending')`, clientId, sessionId, deviceCode, userCode)
	return err
}

func GetSessionByDeviceCode(deviceCode string) (*types.DeviceFlowSession, error) {
	row := database.QueryRow(`SELECT id, app_id, session_id, user_id, device_code, user_code, code_challenge, redirect_uri, status, expires_at, last_poll FROM oauth_device_flow WHERE device_code = ?`, deviceCode)

	var s types.DeviceFlowSession
	err := row.Scan(&s.ID, &s.AppID, &s.SessionID, &s.UserID, &s.DeviceCode, &s.UserCode, &s.Status, &s.ExpiresAt, &s.LastPoll)
	if err != nil {
		return nil, err
	}
	t, err := time.Parse(time.RFC3339, s.ExpiresAt)
	if err != nil || time.Now().After(t) {
		UpdateDeviceFlowSessionStatus(s.SessionID, "")
		s.Status = "expired"
	}
	return &s, nil
}

func UpdateSessionPoll(sessionId string) error {
	_, err := database.Exec(`UPDATE oauth_device_flow SET last_poll = CURRENT_TIMESTAMP WHERE session_id = ?`, sessionId)
	return err
}

func UpdateDeviceFlowSessionStatus(sessionId string, status string) error {
	session, err := GetSessionByDeviceCode(sessionId)
	if err != nil {
		return err
	}

	t, err := time.Parse(time.RFC3339, session.ExpiresAt)
	if err != nil || time.Now().After(t) {
		_, err = database.Exec(`UPDATE oauth_device_flow SET status = 'expired' WHERE session_id = ?`, sessionId)
		return nil
	}

	if status == "" {
		return nil
	}

	_, err = database.Exec(`UPDATE oauth_device_flow SET status = ? WHERE session_id = ?`, status, sessionId)
	return err
}
