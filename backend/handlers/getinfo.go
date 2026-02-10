package handlers

import (
	"database/sql"
	"mirpass-backend/config"
	"mirpass-backend/db"
	"mirpass-backend/types"
	"net/http"
	"strings"
)

func FormatUrl(url string) string {
	if url == "" {
		return ""
	}
	if strings.HasPrefix(url, "/blob/") {
		return config.AppConfig.BackendURL + url
	}
	return url
}

func MyInfoHandler(w http.ResponseWriter, r *http.Request) {
	username := GetUsernameFromContext(r.Context())
	appId, _ := r.Context().Value("appId").(string)

	if username == "" {
		WriteErrorResponse(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	user, err := db.GetUserByUsername(username)
	if err != nil {
		if err == sql.ErrNoRows {
			WriteErrorResponse(w, http.StatusNotFound, "User not found")
		} else {
			WriteErrorResponse(w, 500, "Database error")
		}
		return
	}

	var res interface{}
	if appId == "system" {
		res = types.UserProfile{
			Username:  user.Username,
			Email:     user.Email,
			Nickname:  user.Nickname,
			AvatarURL: FormatUrl(user.AvatarURL),
		}
	} else {
		res = types.UserPublicInfo{
			Username:  user.Username,
			Nickname:  user.Nickname,
			AvatarURL: FormatUrl(user.AvatarURL),
		}
	}
	WriteSuccessResponse(w, "User info retrieved successfully", res)
}

func MyUsernameHandler(w http.ResponseWriter, r *http.Request) {
	username := GetUsernameFromContext(r.Context())
	if username == "" {
		WriteErrorResponse(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	WriteSuccessResponse(w, "Username retrieved successfully", map[string]string{"username": username})
}

func MyAppsHandler(w http.ResponseWriter, r *http.Request) {
	username := GetUsernameFromContext(r.Context())
	if username == "" {
		WriteErrorResponse(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	// We need userID (int) from username (string)
	user, err := db.GetUserByUsername(username)
	if err != nil {
		WriteErrorResponse(w, 500, "Database error")
		return
	}

	apps, err := db.GetAdminApps(user.Username)
	if err != nil {
		WriteErrorResponse(w, 500, "Database error")
		return
	}

	WriteSuccessResponse(w, "Apps retrieved", apps)
}

func UserPublicInfoHandler(w http.ResponseWriter, r *http.Request) {
	username := r.URL.Query().Get("username")
	if username == "" {
		WriteErrorResponse(w, http.StatusBadRequest, "Username is required")
		return
	}

	user, err := db.GetUserByUsername(username)
	if err != nil {
		if err == sql.ErrNoRows {
			WriteErrorResponse(w, http.StatusNotFound, "User not found")
		} else {
			WriteErrorResponse(w, 500, "Database error")
		}
		return
	}

	res := types.UserPublicInfo{
		Username:  user.Username,
		Nickname:  user.Nickname,
		AvatarURL: FormatUrl(user.AvatarURL),
	}
	WriteSuccessResponse(w, "User info retrieved successfully", res)
}

func AppPublicInfoHandler(w http.ResponseWriter, r *http.Request) {
	appID := r.URL.Query().Get("id")
	if appID == "" {
		WriteErrorResponse(w, http.StatusBadRequest, "App ID is required")
		return
	}

	app, err := db.GetApplication(appID)
	res := types.AppPublicInfo{
		ID:          app.ID,
		Name:        app.Name,
		Description: app.Description,
		LogoURL:     FormatUrl(app.LogoURL),
	}

	if err != nil {
		WriteErrorResponse(w, http.StatusNotFound, "App not found")
		return
	}

	WriteSuccessResponse(w, "App details", res)
}
