package handlers

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"time"

	"mirpass-backend/config"
	"mirpass-backend/db"
	"mirpass-backend/types"
	"mirpass-backend/utils"
)

func InitiateSSOHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		WriteErrorResponse(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	// Check API Key
	apiKey := r.Header.Get("X-Api-Key")
	if apiKey == "" {
		WriteErrorResponse(w, http.StatusUnauthorized, "Missing API Key")
		return
	}

	hash := sha256.Sum256([]byte(apiKey))
	keyHash := hex.EncodeToString(hash[:])

	appID, err := db.GetAppIDByAPIKeyHash(keyHash)
	if err != nil {
		WriteErrorResponse(w, http.StatusUnauthorized, "Invalid API Key")
		return
	}

	app, err := db.GetApplication(appID)
	if err != nil {
		WriteErrorResponse(w, http.StatusInternalServerError, "Failed to get app details")
		return
	}
	if app.SuspendUntil != nil {
		t, err := time.Parse(time.RFC3339, *app.SuspendUntil)
		if err == nil && t.After(time.Now()) {
			WriteErrorResponse(w, http.StatusForbidden, "Application is suspended")
			return
		}
	}

	// Create Session
	sessionID := utils.GenerateToken()                // Reusing existing random string generator
	err = db.CreateLoginSession(appID, sessionID, 10) // 10 minutes expiry
	if err != nil {
		WriteErrorResponse(w, http.StatusInternalServerError, "Failed to create session")
		return
	}

	resp := map[string]string{
		"session_id": sessionID,
		"login_url":  config.AppConfig.FrontendURL + "/login?sso=" + sessionID,
	}
	WriteSuccessResponse(w, "Session initiated", resp)
}

func GetSSODetailsHandler(w http.ResponseWriter, r *http.Request) {
	sessionID := r.URL.Query().Get("session_id")
	if sessionID == "" {
		WriteErrorResponse(w, http.StatusBadRequest, "Missing session_id")
		return
	}

	session, err := db.GetLoginSession(sessionID)
	if err != nil {
		WriteErrorResponse(w, http.StatusNotFound, "Session not found")
		return
	}

	app, err := db.GetApplication(session.AppID)
	if err != nil {
		WriteErrorResponse(w, http.StatusInternalServerError, "App details not found")
		return
	}

	var status string
	if session.LoginAt == nil {
		status = "pending"
	} else {
		status = "confirmed"
	}

	resp := types.SSOSessionDetails{
		SessionID: session.SessionID,
		AppID:     session.AppID,
		AppName:   app.Name,
		LogoURL:   app.LogoURL,
		Status:    status,
	}

	WriteSuccessResponse(w, "Session details", resp)
}

func ConfirmSSOHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Authenticated user only
	claims, err := utils.ExtractClaims(r)
	if err != nil {
		WriteErrorResponse(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var req struct {
		SessionID string `json:"sessionId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteErrorResponse(w, http.StatusBadRequest, "Invalid request")
		return
	}

	// Check suspension
	session, err := db.GetLoginSession(req.SessionID)
	if err != nil {
		WriteErrorResponse(w, http.StatusNotFound, "Session not found")
		return
	}

	app, err := db.GetApplication(session.AppID)
	if err != nil {
		WriteErrorResponse(w, http.StatusInternalServerError, "Failed to get app")
		return
	}
	if app.SuspendUntil != nil {
		t, err := time.Parse(time.RFC3339, *app.SuspendUntil)
		if err == nil && t.After(time.Now()) {
			WriteErrorResponse(w, http.StatusForbidden, "Application is suspended")
			return
		}
	}

	err = db.ConfirmLoginSession(req.SessionID, claims.Username)
	if err != nil {
		WriteErrorResponse(w, http.StatusInternalServerError, "Failed to confirm")
		return
	}
	WriteSuccessResponse(w, "Confirmed", nil)
}

func PollSSOHandler(w http.ResponseWriter, r *http.Request) {
	sessionID := r.URL.Query().Get("session_id")
	if sessionID == "" {
		WriteErrorResponse(w, http.StatusBadRequest, "Missing session_id")
		return
	}

	session, err := db.GetLoginSession(sessionID)
	if err != nil {
		WriteErrorResponse(w, http.StatusNotFound, "not_found")
		return
	}

	if session.LoginAt == nil {
		// Pending
		WriteSuccessResponse(w, "pending", map[string]string{"status": "pending"})
		return
	}

	// Confirmed, generate token
	// This token IS the "ticket" the TPA uses to log the user in on their side
	// and verifies against Mirpass.
	token, err := utils.GenerateSSOToken(session.AppID, *session.Username)
	if err != nil {
		WriteErrorResponse(w, http.StatusInternalServerError, "Token gen failed")
		return
	}

	WriteSuccessResponse(w, "confirmed", map[string]string{
		"status":   "confirmed",
		"token":    token,
		"username": *session.Username,
	})
}

func VerifySSOTokenHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Token string `json:"token"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteErrorResponse(w, http.StatusBadRequest, "Invalid request")
		return
	}

	claims, err := utils.ValidateSSOToken(req.Token)
	if err != nil {
		WriteErrorResponse(w, http.StatusUnauthorized, "Invalid token")
		return
	}

	WriteSuccessResponse(w, "valid", claims)
}
