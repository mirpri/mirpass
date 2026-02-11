package handlers

import (
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

	var req struct {
		AppID string `json:"appId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteErrorResponse(w, http.StatusBadRequest, "Invalid request")
		return
	}

	var appID string

	apiKey := r.Header.Get("X-Api-Key")
	if apiKey == "" {
		WriteErrorResponse(w, http.StatusBadRequest, "Missing API Key")
		return
	}

	hash := utils.Sha256(apiKey)
	id, err := db.GetAppIDByAPIKeyHash(hash)
	if err != nil {
		WriteErrorResponse(w, http.StatusUnauthorized, "Invalid API Key")
		return
	}
	// If AppID is provided in body, verify it matches
	if req.AppID != "" && req.AppID != id {
		WriteErrorResponse(w, http.StatusForbidden, "App ID mismatch")
		return
	}
	appID = id

	app, err := db.GetApplication(appID)
	if err != nil {
		WriteErrorResponse(w, http.StatusInternalServerError, "Failed to get app details")
		return
	}
	if app.SuspendUntil != nil {
		t, err := time.Parse(time.RFC3339, *app.SuspendUntil)
		if err == nil && t.After(time.Now().UTC()) {
			WriteErrorResponse(w, http.StatusForbidden, "Application is suspended")
			return
		}
	}

	// Create Session
	sessionID := utils.GenerateToken()
	pollSecret := utils.GenerateToken()                           // Secret to polling status
	err = db.CreateLoginSession(appID, sessionID, pollSecret, 10) // 10 minutes expiry
	if err != nil {
		WriteErrorResponse(w, http.StatusInternalServerError, "Failed to create session")
		return
	}

	resp := map[string]string{
		"sessionId":  sessionID,
		"pollSecret": pollSecret,
		"loginUrl":   config.AppConfig.FrontendURL + "/login?sso=" + sessionID,
	}
	WriteSuccessResponse(w, "Session initiated", resp)
}

func GetSSODetailsHandler(w http.ResponseWriter, r *http.Request) {
	sessionID := r.URL.Query().Get("sessionId")
	if sessionID == "" {
		WriteErrorResponse(w, http.StatusBadRequest, "Missing sessionId")
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
		LogoURL:   FormatUrl(app.LogoURL),
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
		SessionID   string `json:"sessionId"`
		RequestCode bool   `json:"requestCode"` // If true, code is returned and marked delivered
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteErrorResponse(w, http.StatusBadRequest, "Invalid request")
		return
	}

	// Generate Auth Code
	authCode := utils.GenerateToken()

	// If client requests code (for redirect), we return it and set state='delivered'.
	// Else we just confirm (state='confirmed').
	err = db.ConfirmLoginSession(req.SessionID, claims.Username, authCode, req.RequestCode)
	if err != nil {
		WriteErrorResponse(w, http.StatusInternalServerError, "Failed to confirm")
		return
	}

	var authCodeResp string
	if req.RequestCode {
		authCodeResp = authCode
	}

	WriteSuccessResponse(w, "Confirmed", map[string]string{"authCode": authCodeResp})
}

func PollSSOHandler(w http.ResponseWriter, r *http.Request) {
	sessionID := r.URL.Query().Get("sessionId")
	pollSecret := r.URL.Query().Get("secret") // New Requirement

	if sessionID == "" {
		WriteErrorResponse(w, http.StatusBadRequest, "Missing sessionId")
		return
	}

	session, err := db.GetLoginSession(sessionID)
	if err != nil {
		WriteErrorResponse(w, http.StatusNotFound, "not_found")
		return
	}

	// Verify Secret if it exists in DB (legacy/migrated rows might not have it, user didn't specify strict enforcement for old sessions, assuming new ones have it)
	// If session has secret, enforce it.
	if session.PollSecret != nil && *session.PollSecret != "" {
		if pollSecret != *session.PollSecret {
			WriteErrorResponse(w, http.StatusForbidden, "Invalid poll secret")
			return
		}
	}

	if session.State == "pending" || session.LoginAt == nil {
		// Pending
		WriteSuccessResponse(w, "pending", map[string]string{"status": "pending"})
		return
	}

	// If state is 'confirmed', return code and set state='delivered'
	if session.State == "confirmed" {
		// Deliver code
		var code string
		if session.AuthCode != nil {
			code = *session.AuthCode
		}

		// Update state to delivered
		db.UpdateSessionState(session.SessionID, "delivered")

		WriteSuccessResponse(w, "confirmed", map[string]string{
			"status":   "confirmed",
			"authCode": code,
		})
		return
	}

	// If already delivered or exchanged, do not return code
	if session.State == "delivered" || session.State == "exchanged" {
		// Already delivered
		WriteSuccessResponse(w, "confirmed", map[string]string{
			"status": "confirmed",
			// No code returned
		})
		return
	}

	// Default fallback
	WriteErrorResponse(w, http.StatusInternalServerError, "Unknown state")
}

func ExchangeSSOCodeHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Code string `json:"code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteErrorResponse(w, http.StatusBadRequest, "Invalid request")
		return
	}

	session, err := db.GetSessionByAuthCode(req.Code)
	if err != nil {
		WriteErrorResponse(w, http.StatusNotFound, "Invalid auth code")
		return
	}

	// Check if used (state should not be 'exchanged')
	if session.State == "exchanged" {
		WriteErrorResponse(w, http.StatusForbidden, "Auth code already used")
		return
	}

	// Mark as exchanged
	if err := db.UpdateSessionState(session.SessionID, "exchanged"); err != nil {
		WriteErrorResponse(w, http.StatusInternalServerError, "Failed to mark code used")
		return
	}

	// Generate Token
	token, err := utils.GenerateJWTToken(session.AppID, *session.Username, time.Hour*24*7)
	if err != nil {
		WriteErrorResponse(w, http.StatusInternalServerError, "Token gen failed")
		return
	}

	WriteSuccessResponse(w, "success", map[string]string{
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

	claims, err := utils.ValidateToken(req.Token)
	if err != nil {
		WriteSuccessResponse(w, "Invalid token", map[string]interface{}{
			"valid": false,
		})
		return
	}

	res := map[string]interface{}{
		"valid":    true,
		"appId":    claims.AppID,
		"username": claims.Username,
	}

	WriteSuccessResponse(w, "Token is valid", res)
}
