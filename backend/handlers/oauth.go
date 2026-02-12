package handlers

import (
	"bytes"
	"encoding/json"
	"io"
	"log"
	"mirpass-backend/config"
	"mirpass-backend/db"
	"mirpass-backend/types"
	"mirpass-backend/utils"
	"net/http"
	"strings"
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

func GetTokenHandler(w http.ResponseWriter, r *http.Request) {
	bodyBytes, err := io.ReadAll(r.Body)
	if err != nil {
		log.Print("GetTokenHandler:", err)
		WriteErrorResponse(w, 400, "Invalid request body")
		return
	}
	// Restore request body for sub-handlers
	r.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))

	var req struct {
		GrantType string `json:"grant_type"`
	}
	err = json.Unmarshal(bodyBytes, &req)
	if err != nil || req.GrantType == "" {
		log.Print("GetTokenHandler - invalid JSON:", err)
		WriteErrorResponse(w, 400, "Invalid request body")
		return
	}

	switch req.GrantType {
	case "urn:ietf:params:oauth:grant-type:device_code":
		DeviceFlowPollHandler(w, r)
	case "authorization_code":
		AuthCodeFlowTokenHandler(w, r)
	default:
		WriteErrorResponse(w, 400, "Unsupported grant_type")
	}
}

func DeviceFlowPollHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ClientID   string `json:"client_id"`
		DeviceCode string `json:"device_code"`
	}
	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil || req.DeviceCode == "" {
		log.Println("Error decoding request body:", err)
		WriteErrorResponse(w, 400, "Invalid request body")
		return
	}

	session, err := db.GetSessionByDeviceCode(req.DeviceCode)
	if err != nil || session.Status == "consumed" {
		log.Println("Error fetching session for device code:", err)
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
		accessToken, err := utils.GenerateJWTToken(session.ClientID, session.Username, time.Hour*24*7) // TODO: let app set token expiry
		if err != nil {
			WriteErrorResponse(w, 500, "Failed to generate access token")
			return
		}
		res := map[string]string{
			"token_type":   "Bearer",
			"access_token": accessToken,
			"expires_in":   "604800", // 7 days in seconds
		}
		db.UpdateDeviceFlowSessionStatus(session.SessionID, "consumed", "")
		db.AddHistory(session.Username, session.ClientID)
		WriteOauthSuccessResponse(w, res)
		return
	}
	WriteErrorResponse(w, 500, "Failed to process request")
}

func AuthCodeFlowTokenHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Code         string `json:"code"`
		ClientID     string `json:"client_id"`
		CodeVerifier string `json:"code_verifier"`
	}
	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil || req.Code == "" || req.ClientID == "" {
		WriteErrorResponse(w, 400, "Invalid request body")
		return
	}

	session, err := db.GetAuthCodeSessionByCode(req.Code)
	if err != nil || session.Status != "authorized" {
		WriteErrorResponse(w, 400, "Invalid code")
		return
	}

	if session.ClientID != req.ClientID {
		WriteErrorResponse(w, 400, "client_id does not match")
		return
	}

	switch session.CodeChallengeMethod {
	case "S256":
		hashedVerifier := utils.Sha256(req.CodeVerifier)
		if hashedVerifier != session.CodeChallenge {
			WriteErrorResponse(w, 400, "Invalid code_verifier")
			return
		}
	case "plain":
		if req.CodeVerifier != session.CodeChallenge {
			WriteErrorResponse(w, 400, "Invalid code_verifier")
			return
		}
	default:
		WriteErrorResponse(w, 400, "Unsupported code_challenge_method")
		return
	}

	accessToken, err := utils.GenerateJWTToken(session.ClientID, session.Username, time.Hour*24*7) // TODO: let app set token expiry
	if err != nil {
		WriteErrorResponse(w, 500, "Failed to generate access token")
		return
	}
	res := map[string]string{
		"token_type":   "Bearer",
		"access_token": accessToken,
		"expires_in":   "604800", // 7 days in seconds
	}
	db.UpdateDeviceFlowSessionStatus(session.SessionID, "consumed", "")
	db.AddHistory(session.Username, session.ClientID)
	WriteOauthSuccessResponse(w, res)
}

func SessionDetailsByUsercodeHandler(w http.ResponseWriter, r *http.Request) {
	userCode := r.URL.Query().Get("userCode")
	if userCode == "" {
		WriteErrorResponse(w, 400, "Missing userCode")
		return
	}

	session, err := db.GetSessionByUserCode(userCode)
	if err != nil {
		WriteErrorResponse(w, 400, "Invalid userCode")
		return
	}
	res := map[string]string{
		"sessionId": session.SessionID,
		"appId":     session.ClientID,
		"status":    session.Status,
		"expiresAt": session.ExpiresAt,
	}
	WriteSuccessResponse(w, "Success", res)
}

func OAuthConsentHandler(w http.ResponseWriter, r *http.Request) {
	username := GetUsernameFromContext(r.Context())
	var req struct {
		SessionID string `json:"sessionId"`
		Approve   bool   `json:"approve"`
	}
	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil || req.SessionID == "" {
		WriteErrorResponse(w, 400, "Invalid request body")
		return
	}

	status := "denied"
	if req.Approve {
		status = "authorized"
	}

	err = db.UpdateDeviceFlowSessionStatus(req.SessionID, status, username)
	if err != nil {
		WriteErrorResponse(w, 500, "Failed to update session status")
		return
	}
	WriteSuccessResponse(w, "Consent recorded", nil)
}

func SessionDetailsHandler(w http.ResponseWriter, r *http.Request) {
	sessionId := r.URL.Query().Get("sessionId")
	if sessionId == "" {
		WriteErrorResponse(w, 400, "Missing sessionId")
		return
	}

	session, err := db.GetSessionBySessionId(sessionId)
	if err != nil {
		WriteErrorResponse(w, 400, "Invalid sessionId")
		return
	}

	resp := map[string]interface{}{
		"appId":     session.ClientID,
		"username":  session.Username,
		"status":    session.Status,
		"expiresAt": session.ExpiresAt,
	}
	WriteSuccessResponse(w, "Success", resp)
}

func AuthCodeFlowHandler(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	req := types.AuthCodeFlowRequest{
		ResponseType:        q.Get("response_type"),
		ClientID:            q.Get("client_id"),
		RedirectURI:         q.Get("redirect_uri"),
		State:               q.Get("state"),
		CodeChallenge:       q.Get("code_challenge"),
		CodeChallengeMethod: q.Get("code_challenge_method"),
	}

	if req.ResponseType != "code" {
		http.Redirect(w, r, req.RedirectURI+"?error=unsupported_response_type&state="+req.State, http.StatusFound)
		return
	}

	app, err := db.GetApplication(req.ClientID)
	if err != nil {
		http.Redirect(w, r, req.RedirectURI+"?error=invalid_client&state="+req.State, http.StatusFound)
		return
	}
	if app.SuspendUntil != nil {
		t, _ := time.Parse(time.RFC3339, *app.SuspendUntil)
		if t.After(time.Now()) {
			http.Redirect(w, r, req.RedirectURI+"?error=access_denied&state="+req.State, http.StatusFound)
			return
		}
	}

	sessionId := utils.GenerateToken()
	err = db.CreateAuthCodeSession(req.ClientID, sessionId, req.RedirectURI, req.CodeChallenge, req.CodeChallengeMethod, req.State)
	if err != nil {
		log.Fatal("Error creating auth code session:", err)
		w.WriteHeader(http.StatusInternalServerError)
		return
	}

	redirectUrl := config.AppConfig.FrontendURL + "/auth?session_id=" + sessionId
	http.Redirect(w, r, redirectUrl, http.StatusFound)
}

func AuthCodeFlowConsentHandler(w http.ResponseWriter, r *http.Request) {
	claims, err := utils.ExtractClaims(r)
	if err != nil {
		log.Print("Failed to extract claims on AuthCodeFlowConsent:", err)
		http.Redirect(w, r, config.AppConfig.FrontendURL+"/login?from="+r.URL.String(), http.StatusFound)
		return
	}
	username := claims.Username

	sessID := r.URL.Query().Get("sessionId")
	appv := r.URL.Query().Get("approve")

	if sessID == "" {
		http.Error(w, "Missing sessionId", http.StatusBadRequest)
		return
	}

	session, err := db.GetAuthCodeSessionBySessionId(sessID)
	if err != nil {
		http.Error(w, "Invalid session", http.StatusBadRequest)
		return
	}

	if session.Status != "pending" {
		// Maybe already approved?
		if session.Status == "authorized" {
			http.Error(w, "Session already processed", http.StatusBadRequest)
			return
		}
		target := session.RedirectURI + "?error=access_denied&state=" + session.State
		if strings.Contains(r.Header.Get("Accept"), "application/json") {
			WriteSuccessResponse(w, "Redirect", map[string]string{"redirectUrl": target})
			return
		}
		http.Redirect(w, r, target, http.StatusFound)
		return
	}

	if appv != "true" {
		// User denied
		db.UpdateDeviceFlowSessionStatus(sessID, "denied", username)
		target := session.RedirectURI + "?error=access_denied&state=" + session.State
		if strings.Contains(r.Header.Get("Accept"), "application/json") {
			WriteSuccessResponse(w, "Redirect", map[string]string{"redirectUrl": target})
			return
		}
		http.Redirect(w, r, target, http.StatusFound)
		return
	}

	// Approved
	authCode := utils.GenerateToken()
	err = db.UpdateAuthCodeSessionCode(sessID, authCode, username)
	if err != nil {
		log.Print("Failed to update auth code session:", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	// Redirect to redirect_uri with code
	redirectTarget := session.RedirectURI
	if strings.Contains(redirectTarget, "?") {
		redirectTarget += "&code=" + authCode + "&state=" + session.State
	} else {
		redirectTarget += "?code=" + authCode + "&state=" + session.State
	}

	log.Print("redirecting to: ", redirectTarget)
	if strings.Contains(r.Header.Get("Accept"), "application/json") {
		WriteSuccessResponse(w, "Authorized", map[string]string{"redirectUrl": redirectTarget})
		return
	}
	http.Redirect(w, r, redirectTarget, http.StatusFound)
}
