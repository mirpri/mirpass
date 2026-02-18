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

	if !app.DeviceCodeEnabled {
		WriteErrorResponse(w, 400, "Device code flow is disabled for this application")
		return
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
		db.UpdateSessionStatus(session.SessionID, "consumed", "")
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
		ClientSecret string `json:"client_secret"`
		CodeVerifier string `json:"code_verifier"`
	}
	err := json.NewDecoder(r.Body).Decode(&req)
	// Allow client_id to be missing from body if available in Basic Auth
	username, _, ok := r.BasicAuth()
	if req.ClientID == "" && ok {
		req.ClientID = username
	}

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

	if session.CodeChallenge != "" {
		if req.CodeVerifier == "" {
			WriteErrorResponse(w, 400, "code_verifier required for this request")
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
			WriteErrorResponse(w, 500, "Internal Server Error")
			return
		}
	} else {
		// No PKCE, require client secret
		// Check for client secret in body
		clientSecret := req.ClientSecret
		if clientSecret == "" {
			// Check for client secret in Basic Auth header
			_, password, ok := r.BasicAuth()
			if ok {
				clientSecret = password
			}
		}

		if clientSecret == "" {
			WriteErrorResponse(w, 401, "client_secret is required when not using PKCE")
			return
		}

		if !db.ValidateAppSecret(req.ClientID, clientSecret) {
			WriteErrorResponse(w, 401, "Invalid client_secret")
			return
		}
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
	db.UpdateSessionStatus(session.SessionID, "consumed", "")
	db.AddHistory(session.Username, session.ClientID)
	WriteOauthSuccessResponse(w, res)
}

func SessionDetailsByUsercodeHandler(w http.ResponseWriter, r *http.Request) {
	userCode := r.URL.Query().Get("userCode")
	if userCode == "" {
		WriteErrorResponse(w, 400, "Missing userCode")
		return
	}

	session, err := db.GetActiveSessionByUserCode(userCode)
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

	err = db.UpdateSessionStatus(req.SessionID, status, username)
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

	if req.RedirectURI == "" {
		http.Error(w, "missing redirect_uri", http.StatusBadRequest)
		return
	}

	redirectTarget := req.RedirectURI
	if strings.Contains(redirectTarget, "?") {
		redirectTarget += "&"
	} else {
		redirectTarget += "?"
	}

	if req.ResponseType != "code" {
		http.Redirect(w, r, redirectTarget+"error=unsupported_response_type&state="+req.State, http.StatusFound)
		return
	}

	app, err := db.GetApplication(req.ClientID)
	if err != nil {
		http.Redirect(w, r, redirectTarget+"error=invalid_client&state="+req.State, http.StatusFound)
		return
	}
	if app.SuspendUntil != nil {
		t, _ := time.Parse(time.RFC3339, *app.SuspendUntil)
		if t.After(time.Now()) {
			http.Redirect(w, r, redirectTarget+"error=access_denied&state="+req.State, http.StatusFound)
			return
		}
	}

	trusted, err := db.IsTrustedURI(req.ClientID, req.RedirectURI)
	if err != nil {
		log.Print("Failed to validate trusted URI:", err)
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	if !trusted {
		http.Error(w, "redirect_uri not registered", http.StatusBadRequest)
		return
	}

	if req.CodeChallengeMethod == "" {
		req.CodeChallengeMethod = "plain"
	} else if req.CodeChallengeMethod != "plain" && req.CodeChallengeMethod != "S256" {
		http.Error(w, "unsupported code_challenge_method", http.StatusBadRequest)
		return
	}

	sessionId := utils.GenerateToken()
	err = db.CreateAuthCodeSession(req.ClientID, sessionId, req.RedirectURI, req.CodeChallenge, req.CodeChallengeMethod, req.State)
	if err != nil {
		log.Println("Error creating auth code session:", err)
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}

	redirectUrl := config.AppConfig.FrontendURL + "/auth?session_id=" + sessionId
	http.Redirect(w, r, redirectUrl, http.StatusFound)
}

func OIDCConfigurationHandler(w http.ResponseWriter, r *http.Request) {
	baseURL := config.AppConfig.BackendURL
	// Ensure no trailing slash
	baseURL = strings.TrimSuffix(baseURL, "/")

	resp := map[string]interface{}{
		"issuer":                                baseURL,
		"authorization_endpoint":                baseURL + "/oauth2/authorize",
		"token_endpoint":                        baseURL + "/oauth2/token",
		"userinfo_endpoint":                     baseURL + "/myprofile",
		"device_authorization_endpoint":         baseURL + "/oauth2/devicecode",
		"jwks_uri":                              "",                        // No JWKS URI as we use symmetric keys (HS256) for now
		"response_types_supported":              []string{"code", "token"}, // Added token for implicit if we support it, but we don't really support it yet implicitly. Let's keep code only for now.
		"subject_types_supported":               []string{"public"},
		"id_token_signing_alg_values_supported": []string{"HS256"},
		"scopes_supported":                      []string{"openid", "profile", "email"},
		"token_endpoint_auth_methods_supported": []string{"client_secret_basic", "client_secret_post", "none"},
		"claims_supported":                      []string{"sub", "iss", "exp", "iat", "username", "nickname", "avatarUrl", "email"},
		"code_challenge_methods_supported":      []string{"plain", "S256"},
		"grant_types_supported":                 []string{"authorization_code", "urn:ietf:params:oauth:grant-type:device_code"},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func AuthCodeFlowConsentHandler(w http.ResponseWriter, r *http.Request) {
	// 1. Authenticate Request
	claims, err := utils.ExtractClaims(r)
	if err != nil {
		log.Print("Failed to extract claims on AuthCodeFlowConsent:", err)
		WriteErrorResponse(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	username := claims.Username

	// 2. Parse Input (Handle both Query Params & JSON Body)
	var sessID string
	var approve bool

	if r.Method == http.MethodPost {
		var req struct {
			SessionID string `json:"sessionId"`
			Approve   bool   `json:"approve"`
		}
		if json.NewDecoder(r.Body).Decode(&req) == nil {
			sessID = req.SessionID
			approve = req.Approve
		}
	}

	// Fallback to Query Params if Body was empty or method is GET
	if sessID == "" {
		sessID = r.URL.Query().Get("sessionId")
		appv := r.URL.Query().Get("approve")
		approve = (appv == "true")
	}

	if sessID == "" {
		WriteErrorResponse(w, http.StatusBadRequest, "Missing sessionId")
		return
	}

	// 3. Process Logic
	session, err := db.GetAuthCodeSessionBySessionId(sessID)
	if err != nil {
		WriteErrorResponse(w, http.StatusBadRequest, "Invalid session")
		return
	}

	redirectTarget := session.RedirectURI
	if strings.Contains(redirectTarget, "?") {
		redirectTarget += "&"
	} else {
		redirectTarget += "?"
	}

	// If already handled, just return the target (idempotency-ish)
	if session.Status != "pending" {
		target := config.AppConfig.FrontendURL + "/auth?session_id=" + sessID
		WriteSuccessResponse(w, "Already processed", map[string]string{
			"redirectUrl": target,
		})
		return
	}

	if !approve {
		// User denied
		db.UpdateSessionStatus(sessID, "denied", username)
		target := redirectTarget + "error=access_denied&state=" + session.State
		WriteSuccessResponse(w, "Access Denied", map[string]string{
			"redirectUrl": target,
		})
		return
	}

	// Approved
	authCode := utils.GenerateToken()
	err = db.UpdateAuthCodeSessionCode(sessID, authCode, username)
	if err != nil {
		log.Print("Failed to update auth code session:", err)
		WriteErrorResponse(w, http.StatusInternalServerError, "Database error")
		return
	}

	// Construct Success Redirect
	target := redirectTarget + "code=" + authCode + "&state=" + session.State
	WriteSuccessResponse(w, "Authorized", map[string]string{
		"redirectUrl": target,
	})
}
