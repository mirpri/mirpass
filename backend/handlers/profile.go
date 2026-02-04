package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"mirpass-backend/db"
)

type updateNicknameRequest struct {
	Nickname string `json:"nickname"`
}

type updateAvatarRequest struct {
	AvatarURL string `json:"avatarUrl"`
}

func UpdateNicknameHandler(w http.ResponseWriter, r *http.Request) {
	username := GetUsernameFromContext(r.Context())
	if username == "" {
		WriteErrorResponse(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var req updateNicknameRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteErrorResponse(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	if strings.TrimSpace(req.Nickname) == "" {
		WriteErrorResponse(w, http.StatusBadRequest, "Nickname cannot be empty")
		return
	}

	if err := db.UpdateUserNickname(username, req.Nickname); err != nil {
		WriteErrorResponse(w, http.StatusInternalServerError, "Could not update nickname")
		return
	}

	WriteSuccessResponse(w, "Nickname updated", map[string]string{"nickname": req.Nickname})
}

func UpdateAvatarHandler(w http.ResponseWriter, r *http.Request) {
	username := GetUsernameFromContext(r.Context())
	if username == "" {
		WriteErrorResponse(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var req updateAvatarRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteErrorResponse(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	if strings.TrimSpace(req.AvatarURL) == "" {
		WriteErrorResponse(w, http.StatusBadRequest, "Avatar URL cannot be empty")
		return
	}

	if err := db.UpdateUserAvatar(username, req.AvatarURL); err != nil {
		WriteErrorResponse(w, http.StatusInternalServerError, "Could not update avatar")
		return
	}

	WriteSuccessResponse(w, "Avatar updated", map[string]string{"avatarUrl": req.AvatarURL})
}
