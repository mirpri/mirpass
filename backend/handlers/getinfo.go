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
