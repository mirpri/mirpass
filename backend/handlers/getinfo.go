package handlers

import (
	"database/sql"
	"mirpass-backend/db"
	"mirpass-backend/types"
	"net/http"
)

func MyInfoHandler(w http.ResponseWriter, r *http.Request) {
	username := GetUsernameFromContext(r.Context())
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

	res := types.UserProfile{
		Username:  user.Username,
		Email:     user.Email,
		Nickname:  user.Nickname,
		AvatarURL: user.AvatarURL,
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
