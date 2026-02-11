package handlers

import (
	"encoding/json"
	"mirpass-backend/config"
	"mirpass-backend/db"
	"mirpass-backend/utils"
	"net/http"
	"time"
)

func WriteOauthSuccessResponse(w http.ResponseWriter, res interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(res)
}

func WriteOauthErrorResponse(w http.ResponseWriter, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(400)
	json.NewEncoder(w).Encode(map[string]string{"error": message})
}

func DeviceFlowInitiateHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ClientID string `json:"client_id"`
	}
	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil || req.ClientID == "" {
		WriteErrorResponse(w, 400, "Invalid request body")
		return
	}

	app, err := db.GetApplication(req.ClientID)
	if err != nil {
		WriteErrorResponse(w, 400, "Invalid client_id")
		return
	}

	if app.SuspendUntil != nil {
		t, err := time.Parse(time.RFC3339, *app.SuspendUntil)
		if err == nil && t.After(time.Now()) {
			WriteErrorResponse(w, 400, "Application is suspended")
			return
		}
	}

	sessionId := utils.GenerateToken()
	deviceCode := utils.GenerateToken()
	userCode := utils.GenerateUserCode()

	err = db.CreateDeviceFlowSession(app.ID, sessionId, deviceCode, userCode)
	if err != nil {
		WriteErrorResponse(w, http.StatusInternalServerError, "Failed to create device flow")
		return
	}

	resp := map[string]string{
		"device_code":               deviceCode,
		"user_code":                 userCode,
		"verification_uri":          config.AppConfig.FrontendURL + "/auth",
		"verification_uri_complete": config.AppConfig.FrontendURL + "/auth?user_code=" + userCode,
		"interval":                  "5",   // 5 seconds
		"expires_in":                "900", // 15 minutes
	}
	WriteOauthSuccessResponse(w, resp)
}

func DeviceFlowPollHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		GrantType  string `json:"grant_type"`
		ClientID   string `json:"client_id"`
		DeviceCode string `json:"device_code"`
	}
	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil || req.DeviceCode == "" {
		WriteErrorResponse(w, 400, "Invalid request body")
		return
	}

	session, err := db.GetSessionByDeviceCode(req.DeviceCode)
	if err != nil || session.Status == "consumed" {
		WriteErrorResponse(w, 400, "Invalid device_code")
		return
	}

	if t, err := time.Parse(time.RFC3339, session.LastPoll); err == nil && time.Since(t) < 5*time.Second {
		WriteOauthErrorResponse(w, "slow_down")
		return
	}
	db.UpdateSessionPoll(session.SessionID)

	if session.Status == "pending" {
		WriteOauthErrorResponse(w, "authorization_pending")
		return
	}
	if session.Status == "denied" {
		WriteOauthErrorResponse(w, "access_denied")
		return
	}
	if session.Status == "expired" {
		WriteOauthErrorResponse(w, "expired_token")
		return
	}
	if session.Status == "authorized" {
		accessToken, err := utils.GenerateJWTToken(session.AppID, *session.UserID, time.Hour*24*7) // TODO: let app set token expiry
		if err != nil {
			WriteErrorResponse(w, 500, "Failed to generate access token")
			return
		}
		res := map[string]string{
			"token_type":   "Bearer",
			"access_token": accessToken,
			"expires_in":   "604800", // 7 days in seconds
		}
		db.UpdateDeviceFlowSessionStatus(session.SessionID, "consumed")
		WriteOauthSuccessResponse(w, res)
		return
	}
	WriteErrorResponse(w, 500, "Failed to process request")
}

func DeviceFlowConsentHandler(w http.ResponseWriter, r *http.Request) {
	username := GetUsernameFromContext(r.Context())
	var req struct {
		UserCode string `json:"userCode"`
		Approve  bool   `json:"approve"`
	}
	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil || req.UserCode == "" {
		WriteErrorResponse(w, 400, "Invalid request body")
		return
	}

	status := "denied"
	if req.Approve {
		status = "authorized"
	}
	session, err := db.GetSessionByDeviceCode(req.UserCode)
	if err != nil || session.Status != "pending" {
		WriteErrorResponse(w, 400, "Invalid session_id")
		return
	}
	if session.UserID != nil && *session.UserID != username {
		WriteErrorResponse(w, 401, "Unauthorized")
		return
	}
	err = db.UpdateDeviceFlowSessionStatus(session.SessionID, status)
	if err != nil {
		WriteErrorResponse(w, 500, "Failed to update session status")
		return
	}
	WriteSuccessResponse(w, "Consent recorded", nil)
}
