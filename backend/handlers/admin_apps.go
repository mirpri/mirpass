package handlers

import (
	"encoding/json"
	"net/http"

	"mirpass-backend/db"
	"mirpass-backend/types"
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

	for i := range apps {
		apps[i].LogoURL = FormatUrl(apps[i].LogoURL)
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
