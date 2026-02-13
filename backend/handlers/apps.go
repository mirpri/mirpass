package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"mirpass-backend/config"
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
	app.LogoURL = FormatUrl(app.LogoURL)

	WriteSuccessResponse(w, "App details", app)
}

func GetAppTrustedURIsHandler(w http.ResponseWriter, r *http.Request) {
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

	uris, err := db.GetTrustedURIs(appID)
	if err != nil {
		WriteErrorResponse(w, http.StatusInternalServerError, "Could not fetch trusted URIs")
		return
	}

	WriteSuccessResponse(w, "Trusted URIs", uris)
}

func AddAppTrustedURIHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req types.AddTrustedURIRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteErrorResponse(w, http.StatusBadRequest, "Invalid request")
		return
	}

	claims, err := utils.ExtractClaims(r)
	if err != nil {
		WriteErrorResponse(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	isAdmin, err := db.IsAppAdmin(claims.Username, req.AppID)
	if err != nil || !isAdmin {
		WriteErrorResponse(w, http.StatusForbidden, "Forbidden")
		return
	}

	req.URI = strings.TrimSpace(req.URI)
	req.Name = strings.TrimSpace(req.Name)
	if req.URI == "" {
		WriteErrorResponse(w, http.StatusBadRequest, "URI is required")
		return
	}

	u, err := url.ParseRequestURI(req.URI)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") {
		WriteErrorResponse(w, http.StatusBadRequest, "Invalid URI")
		return
	}

	id, err := db.AddTrustedURI(req.AppID, req.Name, req.URI)
	if err != nil {
		if strings.Contains(err.Error(), "already exists") {
			WriteErrorResponse(w, http.StatusBadRequest, "Trusted URI already exists")
			return
		}
		WriteErrorResponse(w, http.StatusInternalServerError, "Could not add trusted URI")
		return
	}

	WriteSuccessResponse(w, "Trusted URI added", map[string]interface{}{"id": id})
}

func DeleteAppTrustedURIHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req types.DeleteTrustedURIRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteErrorResponse(w, http.StatusBadRequest, "Invalid request")
		return
	}

	claims, err := utils.ExtractClaims(r)
	if err != nil {
		WriteErrorResponse(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	isAdmin, err := db.IsAppAdmin(claims.Username, req.AppID)
	if err != nil || !isAdmin {
		WriteErrorResponse(w, http.StatusForbidden, "Forbidden")
		return
	}

	err = db.DeleteTrustedURI(req.URIID, req.AppID)
	if err != nil {
		WriteErrorResponse(w, http.StatusInternalServerError, "Could not delete trusted URI")
		return
	}

	WriteSuccessResponse(w, "Trusted URI deleted", nil)
}

func UpdateAppHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	claims, err := utils.ExtractClaims(r)
	if err != nil {
		WriteErrorResponse(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var appID, name, description, logoURL string

	contentType := r.Header.Get("Content-Type")
	if strings.HasPrefix(contentType, "multipart/form-data") {
		r.Body = http.MaxBytesReader(w, r.Body, 10<<20)
		if err := r.ParseMultipartForm(10 << 20); err != nil {
			WriteErrorResponse(w, http.StatusBadRequest, "Invalid form data")
			return
		}

		appID = r.FormValue("appId")
		name = r.FormValue("name")
		description = r.FormValue("description")
		logoURL = r.FormValue("logoUrl")

		// Check access early
		isAdmin, err := db.IsAppAdmin(claims.Username, appID)
		if err != nil || !isAdmin {
			WriteErrorResponse(w, http.StatusForbidden, "Forbidden")
			return
		}

		file, _, err := r.FormFile("file")
		if err == nil {
			defer file.Close()
			processedData, err := utils.ProcessImage(file)
			if err != nil {
				WriteErrorResponse(w, http.StatusInternalServerError, "Failed to process image")
				return
			}
			blobID := utils.GenerateID()
			if err := db.SaveBlob(blobID, processedData, "image/jpeg"); err != nil {
				WriteErrorResponse(w, http.StatusInternalServerError, "Failed to save blob")
				return
			}
			logoURL = "/blob/" + blobID
		}
	} else {
		var req types.UpdateAppRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			WriteErrorResponse(w, http.StatusBadRequest, "Invalid request")
			return
		}
		appID = req.AppID
		name = req.Name
		description = req.Description
		logoURL = req.LogoURL

		isAdmin, err := db.IsAppAdmin(claims.Username, appID)
		if err != nil || !isAdmin {
			WriteErrorResponse(w, http.StatusForbidden, "Forbidden")
			return
		}
	}

	// Fetch old app for cleanup
	oldApp, err := db.GetApplication(appID)
	if err != nil {
		WriteErrorResponse(w, http.StatusInternalServerError, "Failed to fetch app info")
		return
	}
	oldLogo := oldApp.LogoURL

	if logoURL != config.AppConfig.BackendURL+oldLogo {
		// External URL blob
		if strings.HasPrefix(logoURL, "http") {
			processedData, err := utils.DownloadAndProcessImage(logoURL)
			if err == nil {
				blobID := utils.GenerateID()
				if err := db.SaveBlob(blobID, processedData, "image/jpeg"); err == nil {
					logoURL = "/blob/" + blobID
				}
			}
		}
		if oldLogo != "" && oldLogo != logoURL {
			db.DeleteBlobByURL(oldLogo)
		}
	} else {
		logoURL = oldLogo
	}

	if err := db.UpdateAppInfo(appID, name, description, logoURL); err != nil {
		if strings.Contains(err.Error(), "Duplicate entry") {
			WriteErrorResponse(w, http.StatusBadRequest, "App name already exists")
			return
		}
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

	summary, err := db.GetAppStatsSummary(appID)
	if err != nil {
		WriteErrorResponse(w, http.StatusInternalServerError, "Failed to get stats")
		return
	}

	WriteSuccessResponse(w, "Stats fetched", summary)
}

func GetAppHistoryHandler(w http.ResponseWriter, r *http.Request) {
	appID := r.URL.Query().Get("id")
	dateStr := r.URL.Query().Get("date") // Optional
	offsetStr := r.URL.Query().Get("offset")

	var offset int
	if offsetStr != "" {
		fmt.Sscanf(offsetStr, "%d", &offset)
	}

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

	history, err := db.GetAppHistory(appID, dateStr, offset)
	if err != nil {
		WriteErrorResponse(w, http.StatusInternalServerError, "Failed to get history")
		return
	}

	WriteSuccessResponse(w, "History fetched", history)
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
	isRoot, err := db.IsAppRoot(claims.Username, req.AppID)
	if err != nil || !isRoot {
		WriteErrorResponse(w, http.StatusForbidden, "Forbidden")
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
	isRoot, err := db.IsAppRoot(claims.Username, req.AppID)
	if err != nil || !isRoot {
		WriteErrorResponse(w, http.StatusForbidden, "Forbidden")
		return
	}

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

	isRoot, err := db.IsAppRoot(claims.Username, req.AppID)
	if err != nil || !isRoot {
		WriteErrorResponse(w, http.StatusForbidden, "Forbidden")
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

	isRoot, err := db.IsAppRoot(claims.Username, req.AppID)
	if err != nil || !isRoot {
		WriteErrorResponse(w, http.StatusForbidden, "Forbidden")
		return
	}

	if err := db.RemoveAppMember(req.AppID, req.Username); err != nil {
		WriteErrorResponse(w, http.StatusInternalServerError, "Could not remove member")
		return
	}
	WriteSuccessResponse(w, "Member removed", nil)
}
