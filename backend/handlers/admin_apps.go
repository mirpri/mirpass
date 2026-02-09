package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"mirpass-backend/db"
	"mirpass-backend/types"
	"mirpass-backend/utils"
)

func AdminListApps(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	var apps []types.Application
	var err error

	if q != "" {
		apps, err = db.SearchApps(q)
	} else {
		apps, err = db.GetAllApps()
	}

	if err != nil {
		WriteErrorResponse(w, http.StatusInternalServerError, "Failed to fetch apps")
		return
	}

	WriteSuccessResponse(w, "Apps fetched", apps)
}

func AdminDeleteApp(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	appID := r.URL.Query().Get("id")
	if appID == "" {
		WriteErrorResponse(w, http.StatusBadRequest, "App ID is required")
		return
	}

	if err := db.DeleteApp(appID); err != nil {
		WriteErrorResponse(w, http.StatusInternalServerError, "Failed to delete app")
		return
	}

	WriteSuccessResponse(w, "App deleted", nil)
}

func AdminSuspendApp(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		AppID        string  `json:"appId"`
		SuspendUntil *string `json:"suspendUntil"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteErrorResponse(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.AppID == "" {
		WriteErrorResponse(w, http.StatusBadRequest, "App ID is required")
		return
	}

	if err := db.UpdateAppSuspension(req.AppID, req.SuspendUntil); err != nil {
		WriteErrorResponse(w, http.StatusInternalServerError, "Failed to update suspension")
		return
	}

	WriteSuccessResponse(w, "App suspension updated", nil)
}

func AdminUpdateApp(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var appID, name, description, logoURL string

	contentType := r.Header.Get("Content-Type")
	if strings.HasPrefix(contentType, "multipart/form-data") {
		// Limit 10MB
		r.Body = http.MaxBytesReader(w, r.Body, 10<<20)
		if err := r.ParseMultipartForm(10 << 20); err != nil {
			WriteErrorResponse(w, http.StatusBadRequest, "File too large or invalid")
			return
		}

		appID = r.FormValue("appId")
		name = r.FormValue("name")
		description = r.FormValue("description")
		logoURL = r.FormValue("logoUrl")

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
			WriteErrorResponse(w, http.StatusBadRequest, "Invalid request body")
			return
		}
		appID = req.AppID
		name = req.Name
		description = req.Description
		logoURL = req.LogoURL
	}

	if appID == "" {
		WriteErrorResponse(w, http.StatusBadRequest, "App ID is required")
		return
	}

	// Get old app for cleanup
	oldApp, err := db.GetApplication(appID)
	if err != nil {
		WriteErrorResponse(w, http.StatusInternalServerError, "Failed to fetch existing app")
		return
	}
	oldLogo := oldApp.LogoURL

	// If URL is external link, try to blob it
	if strings.HasPrefix(logoURL, "http") {
		processedData, err := utils.DownloadAndProcessImage(logoURL)
		if err == nil {
			blobID := utils.GenerateID()
			if err := db.SaveBlob(blobID, processedData, "image/jpeg"); err == nil {
				logoURL = "/blob/" + blobID
			}
		}
	}

	if err := db.UpdateAppInfo(appID, name, description, logoURL); err != nil {
		WriteErrorResponse(w, http.StatusInternalServerError, "Failed to update app")
		return
	}

	if oldLogo != "" && oldLogo != logoURL {
		db.DeleteBlobByURL(oldLogo)
	}

	WriteSuccessResponse(w, "App updated successfully", nil)
}
