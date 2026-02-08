package handlers

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"

	"mirpass-backend/db"
	"mirpass-backend/types"
	"mirpass-backend/utils"
)

func CreateAppHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	claims, err := utils.ExtractClaims(r)
	if err != nil {
		WriteErrorResponse(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	username := claims.Username

	var req types.CreateAppRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteErrorResponse(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Name == "" {
		WriteErrorResponse(w, http.StatusBadRequest, "App name is required")
		return
	}

	appID, err := db.CreateApp(req.Name, req.Description, username)
	if err != nil {
		WriteErrorResponse(w, http.StatusInternalServerError, "Could not create app: "+err.Error())
		return
	}

	WriteSuccessResponse(w, "App created successfully", map[string]string{"id": appID})
}

func AppDetailsHandler(w http.ResponseWriter, r *http.Request) {
	appID := r.URL.Query().Get("id")
	if appID == "" {
		WriteErrorResponse(w, http.StatusBadRequest, "App ID is required")
		return
	}

	claims, err := utils.ExtractClaims(r)
	if err != nil {
		WriteErrorResponse(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	// Check access
	isAdmin, err := db.IsAppAdmin(claims.Username, appID)
	if err != nil {
		WriteErrorResponse(w, http.StatusInternalServerError, "Error checking permissions")
		return
	}
	if !isAdmin {
		WriteErrorResponse(w, http.StatusForbidden, "You do not have permission to view this app")
		return
	}

	app, err := db.GetApplication(appID)
	if err != nil {
		WriteErrorResponse(w, http.StatusNotFound, "App not found")
		return
	}

	// Add user's role to the response
	role, _ := db.GetAppRole(claims.Username, appID)
	app.Role = role

	WriteSuccessResponse(w, "App details", app)
}

func GetAppKeysHandler(w http.ResponseWriter, r *http.Request) {
	appID := r.URL.Query().Get("id")
	if appID == "" {
		WriteErrorResponse(w, http.StatusBadRequest, "App ID is required")
		return
	}

	claims, err := utils.ExtractClaims(r)
	if err != nil {
		WriteErrorResponse(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	// Check access
	isAdmin, err := db.IsAppAdmin(claims.Username, appID)
	if err != nil || !isAdmin {
		WriteErrorResponse(w, http.StatusForbidden, "Forbidden")
		return
	}

	keys, err := db.GetAppKeys(appID)
	if err != nil {
		WriteErrorResponse(w, http.StatusInternalServerError, "Could not fetch keys")
		return
	}

	WriteSuccessResponse(w, "App keys", keys)
}

func CreateAppKeyHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		AppID string `json:"appId"`
		Name  string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteErrorResponse(w, http.StatusBadRequest, "Invalid request")
		return
	}

	claims, err := utils.ExtractClaims(r)
	if err != nil {
		WriteErrorResponse(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	// Check access
	isAdmin, err := db.IsAppAdmin(claims.Username, req.AppID)
	if err != nil || !isAdmin {
		WriteErrorResponse(w, http.StatusForbidden, "Forbidden")
		return
	}

	// Generate key
	rawKey := utils.GenerateApiKey()
	// Hash it
	hash := sha256.Sum256([]byte(rawKey))
	keyHash := hex.EncodeToString(hash[:])

	id, err := db.CreateAPIKey(req.AppID, keyHash, req.Name)
	if err != nil {
		WriteErrorResponse(w, http.StatusInternalServerError, "Could not create key")
		return
	}

	WriteSuccessResponse(w, "Key created", map[string]interface{}{
		"id":  id,
		"key": rawKey,
	})
}

func DeleteAppKeyHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		AppID string `json:"appId"`
		KeyID int64  `json:"keyId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteErrorResponse(w, http.StatusBadRequest, "Invalid request")
		return
	}

	claims, err := utils.ExtractClaims(r)
	if err != nil {
		WriteErrorResponse(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	// Check access (only root or admin can delete keys? assuming admins can)
	isAdmin, err := db.IsAppAdmin(claims.Username, req.AppID)
	if err != nil || !isAdmin {
		WriteErrorResponse(w, http.StatusForbidden, "Forbidden")
		return
	}

	err = db.DeleteAPIKey(req.KeyID, req.AppID)
	if err != nil {
		WriteErrorResponse(w, http.StatusInternalServerError, "Could not delete key")
		return
	}

	WriteSuccessResponse(w, "Key deleted", nil)
}

func UpdateAppHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req types.UpdateAppRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteErrorResponse(w, http.StatusBadRequest, "Invalid request")
		return
	}

	claims, err := utils.ExtractClaims(r)
	if err != nil {
		WriteErrorResponse(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	role, err := db.GetAppRole(claims.Username, req.AppID)

	// Only root can update application details? Or admin too?
	// Usually admin can update details, root can delete.
	if role != "root" && role != "admin" {
		WriteErrorResponse(w, http.StatusForbidden, "Forbidden")
		return
	}

	// Fetch existing app to preserve system-controlled fields (SuspendUntil)
	// No longer needed if we use UpdateAppInfo which doesn't touch suspension
	/*
		existing, err := db.GetApplication(req.AppID)
		if err != nil {
			WriteErrorResponse(w, http.StatusInternalServerError, "Could not fetch app details")
			return
		}
	*/

	// Users cannot change SuspendUntil.
	if err := db.UpdateAppInfo(req.AppID, req.Name, req.Description, req.LogoURL); err != nil {
		WriteErrorResponse(w, http.StatusInternalServerError, "Could not update app")
		return
	}
	WriteSuccessResponse(w, "App updated", nil)
}

func GetAppStatsHandler(w http.ResponseWriter, r *http.Request) {
	appID := r.URL.Query().Get("id")
	if appID == "" {
		WriteErrorResponse(w, http.StatusBadRequest, "App ID is required")
		return
	}

	claims, err := utils.ExtractClaims(r)
	if err != nil {
		WriteErrorResponse(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	// Check access
	isAdmin, err := db.IsAppAdmin(claims.Username, appID)
	if err != nil || !isAdmin {
		WriteErrorResponse(w, http.StatusForbidden, "Forbidden")
		return
	}

	history, totalUsers, err := db.GetAppLoginStats(appID)
	if err != nil {
		WriteErrorResponse(w, http.StatusInternalServerError, "Failed to get stats")
		return
	}

	WriteSuccessResponse(w, "Stats fetched", map[string]interface{}{
		"history":    history,
		"totalUsers": totalUsers,
	})
}

func DeleteAppHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		AppID string `json:"appId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteErrorResponse(w, http.StatusBadRequest, "Invalid request")
		return
	}

	claims, err := utils.ExtractClaims(r)
	if err != nil {
		WriteErrorResponse(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	// Only app root can delete app
	role, err := db.GetAppRole(claims.Username, req.AppID)
	if role != "root" {
		WriteErrorResponse(w, http.StatusForbidden, "Forbidden: Only app root can delete app")
		return
	}

	if err := db.DeleteApp(req.AppID); err != nil {
		WriteErrorResponse(w, http.StatusInternalServerError, "Could not delete app")
		return
	}
	WriteSuccessResponse(w, "App deleted", nil)
}

func GetAppMembersHandler(w http.ResponseWriter, r *http.Request) {
	appID := r.URL.Query().Get("id")
	if appID == "" {
		WriteErrorResponse(w, http.StatusBadRequest, "App ID is required")
		return
	}

	claims, err := utils.ExtractClaims(r)
	if err != nil {
		WriteErrorResponse(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	isAdmin, err := db.IsAppAdmin(claims.Username, appID)
	if err != nil || !isAdmin {
		WriteErrorResponse(w, http.StatusForbidden, "Forbidden")
		return
	}

	members, err := db.GetAppMembers(appID)
	if err != nil {
		WriteErrorResponse(w, http.StatusInternalServerError, "Could not fetch members")
		return
	}
	WriteSuccessResponse(w, "Members list", members)
}

func AddAppMemberHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req types.AddMemberRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteErrorResponse(w, http.StatusBadRequest, "Invalid request")
		return
	}

	claims, err := utils.ExtractClaims(r)
	if err != nil {
		WriteErrorResponse(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	// Only root can add admins/roots
	role, err := db.GetAppRole(claims.Username, req.AppID)
	if role != "root" {
		WriteErrorResponse(w, http.StatusForbidden, "Forbidden: Only root can add members")
		return
	}

	// Check if user exists first? Assuming simple flow or DB error will catch
	// Verify user exists:
	user, err := db.GetUserByUsername(req.Username)
	if err != nil || user == nil {
		WriteErrorResponse(w, http.StatusNotFound, "User not found")
		return
	}

	if req.Role != "admin" && req.Role != "root" {
		WriteErrorResponse(w, http.StatusBadRequest, "Invalid role")
		return
	}

	if err := db.AddAppMember(req.AppID, req.Username, req.Role); err != nil {
		WriteErrorResponse(w, http.StatusInternalServerError, "Could not add member (maybe already exists?)")
		return
	}
	WriteSuccessResponse(w, "Member added", nil)
}

func UpdateAppMemberRoleHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req types.UpdateMemberRoleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteErrorResponse(w, http.StatusBadRequest, "Invalid request")
		return
	}

	claims, err := utils.ExtractClaims(r)
	if err != nil {
		WriteErrorResponse(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	role, err := db.GetAppRole(claims.Username, req.AppID)
	if role != "root" {
		WriteErrorResponse(w, http.StatusForbidden, "Forbidden: Only root can update roles")
		return
	}

	if req.Username == claims.Username {
		WriteErrorResponse(w, http.StatusBadRequest, "Cannot change your own role here")
		return
	}

	if err := db.UpdateAppMemberRole(req.AppID, req.Username, req.Role); err != nil {
		WriteErrorResponse(w, http.StatusInternalServerError, "Could not update role")
		return
	}
	WriteSuccessResponse(w, "Role updated", nil)
}

func RemoveAppMemberHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req types.RemoveMemberRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteErrorResponse(w, http.StatusBadRequest, "Invalid request")
		return
	}

	claims, err := utils.ExtractClaims(r)
	if err != nil {
		WriteErrorResponse(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	role, err := db.GetAppRole(claims.Username, req.AppID)
	if role != "root" && claims.Username != req.Username {
		WriteErrorResponse(w, http.StatusForbidden, "Forbidden: Only root can remove members")
		return
	}

	if err := db.RemoveAppMember(req.AppID, req.Username); err != nil {
		WriteErrorResponse(w, http.StatusInternalServerError, "Could not remove member")
		return
	}
	WriteSuccessResponse(w, "Member removed", nil)
}
