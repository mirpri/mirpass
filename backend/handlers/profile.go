package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"mirpass-backend/db"
	"mirpass-backend/utils"

	"golang.org/x/crypto/bcrypt"
)

type updateNicknameRequest struct {
	Nickname string `json:"nickname"`
}

type updateAvatarRequest struct {
	AvatarURL string `json:"avatarUrl"`
}

func GetUserAppsSummaryHandler(w http.ResponseWriter, r *http.Request) {
	claims, err := utils.ExtractClaims(r)
	if err != nil {
		WriteErrorResponse(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	summary, err := db.GetUserAppsSummary(claims.Username)
	if err != nil {
		WriteErrorResponse(w, http.StatusInternalServerError, "Failed to get history summary")
		return
	}

	for _, item := range summary {
		item.LogoUrl = FormatUrl(item.LogoUrl)
	}

	WriteSuccessResponse(w, "Summary fetched", summary)
}

func GetLoginHistoryHandler(w http.ResponseWriter, r *http.Request) {
	claims, err := utils.ExtractClaims(r)
	if err != nil {
		WriteErrorResponse(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	dateStr := r.URL.Query().Get("date")
	offsetStr := r.URL.Query().Get("offset")
	var offset int
	if offsetStr != "" {
		// Assuming simple int minutes
		// Need `strconv` imported? It is likely imported if this file handles JSON/etc, but let's check.
		// If not, I need to add import "strconv".
		// profile.go doesn't seem to import strconv based on previous read_file.
		// I'll assume I can't easily add import with replace_string without context. Only if I read whole file.
		// But I read 100 lines before. Imorts were visible: encoding/json, net/http, strings, mirpass/db/utils... no strconv.
		// So I should just ignore offset if I can't parse or I need to add import.
		// Let's rely on standard binding or just use a helper if available? No utils.StrToInt.
		// I will check if I can use Sscanf.
		fmt.Sscanf(offsetStr, "%d", &offset)
	}

	history, err := db.GetUserLoginHistory(claims.Username, dateStr, offset)
	if err != nil {
		WriteErrorResponse(w, http.StatusInternalServerError, "Failed to get history")
		return
	}

	WriteSuccessResponse(w, "History fetched", history)
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

// Helper to clean up old blob
func deleteOldBlob(currentURL string) {
	if strings.HasPrefix(currentURL, "/blob/") {
		id := strings.TrimPrefix(currentURL, "/blob/")
		db.DeleteBlob(id)
	}
}

func UpdateAvatarHandler(w http.ResponseWriter, r *http.Request) {
	username := GetUsernameFromContext(r.Context())
	if username == "" {
		WriteErrorResponse(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	user, err := db.GetUserByUsername(username)
	if err != nil {
		WriteErrorResponse(w, http.StatusInternalServerError, "Failed to get user")
		return
	}
	oldAvatar := user.AvatarURL

	var newAvatarURL string

	contentType := r.Header.Get("Content-Type")
	if strings.HasPrefix(contentType, "multipart/form-data") {
		// Limit upload/scan size
		r.Body = http.MaxBytesReader(w, r.Body, 10<<20)

		// Check for file
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
			newAvatarURL = "/blob/" + blobID
		} else {
			// No file, maybe avatarUrl field in form
			newAvatarURL = r.FormValue("avatarUrl")
		}
	} else {
		// JSON fallback
		var req updateAvatarRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err == nil {
			newAvatarURL = req.AvatarURL
		}
	}

	// If it's a new external URL (http...), fetch and blob it
	if strings.HasPrefix(newAvatarURL, "http") {
		processedData, err := utils.DownloadAndProcessImage(newAvatarURL)
		if err == nil {
			blobID := utils.GenerateID()
			if err := db.SaveBlob(blobID, processedData, "image/jpeg"); err == nil {
				newAvatarURL = "/blob/" + blobID
			}
		}
	}

	if err := db.UpdateUserAvatar(username, newAvatarURL); err != nil {
		WriteErrorResponse(w, http.StatusInternalServerError, "Could not update avatar")
		return
	}

	if oldAvatar != "" && oldAvatar != newAvatarURL {
		deleteOldBlob(oldAvatar)
	}

	WriteSuccessResponse(w, "Avatar updated", map[string]string{"avatarUrl": newAvatarURL})
}

func UpdatePasswordHandler(w http.ResponseWriter, r *http.Request) {
	username := GetUsernameFromContext(r.Context())
	if username == "" {
		WriteErrorResponse(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var req struct {
		CurrentPassword string `json:"currentPassword"`
		NewPassword     string `json:"newPassword"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteErrorResponse(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	if len(req.NewPassword) < 8 {
		WriteErrorResponse(w, http.StatusBadRequest, "New password must be at least 8 characters long")
		return
	}

	// Verify old password
	user, err := db.GetUserByUsername(username)
	if err != nil {
		WriteErrorResponse(w, http.StatusInternalServerError, "Database error")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.CurrentPassword)); err != nil {
		WriteErrorResponse(w, http.StatusUnauthorized, "Incorrect current password")
		return
	}

	// Update to new password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		WriteErrorResponse(w, http.StatusInternalServerError, "Error hashing password")
		return
	}

	if err := db.UpdateUserPassword(username, string(hashedPassword)); err != nil {
		WriteErrorResponse(w, http.StatusInternalServerError, "Failed to update password")
		return
	}

	WriteSuccessResponse(w, "Password updated successfully", nil)
}

func RequestChangeEmailHandler(w http.ResponseWriter, r *http.Request) {
	username := GetUsernameFromContext(r.Context())
	if username == "" {
		WriteErrorResponse(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var req struct {
		Password string `json:"password"`
		NewEmail string `json:"newEmail"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteErrorResponse(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	if req.NewEmail == "" {
		WriteErrorResponse(w, http.StatusBadRequest, "New email is required")
		return
	}

	// Verify password for security
	user, err := db.GetUserByUsername(username)
	if err != nil {
		WriteErrorResponse(w, http.StatusInternalServerError, "Database error")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		WriteErrorResponse(w, http.StatusUnauthorized, "Incorrect password")
		return
	}

	token := utils.GenerateToken()
	// Task: change_email, Detail: new_email
	if err := db.CreateVerification(username, token, "change_email", req.NewEmail); err != nil {
		WriteErrorResponse(w, http.StatusInternalServerError, "Failed to create verification")
		return
	}

	err = utils.SendVerificationEmail(req.NewEmail, token, "change_email") // Send to NEW email
	if err != nil {
		WriteErrorResponse(w, http.StatusInternalServerError, "Error sending verification email")
		return
	}

	WriteSuccessResponse(w, "Verification email sent to new address", nil)
}

func RequestPasswordResetHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Username    string `json:"username"`
		NewPassword string `json:"newPassword"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteErrorResponse(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	if req.Username == "" || req.NewPassword == "" {
		WriteErrorResponse(w, http.StatusBadRequest, "Username and new password are required")
		return
	}

	if len(req.NewPassword) < 8 {
		WriteErrorResponse(w, 400, "Password must be at least 8 characters")
		return
	}

	user, err := db.GetUserByUsername(req.Username)
	if err != nil {
		// Silent failure to prevent enumeration
		WriteSuccessResponse(w, "If account exists, verification details sent", nil)
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		WriteErrorResponse(w, 500, "Error processing")
		return
	}

	token := utils.GenerateToken()
	// Task: reset_password, Detail: hashed_new_password
	if err := db.CreateVerification(user.Username, token, "reset_password", string(hashedPassword)); err != nil {
		// Log error
		WriteSuccessResponse(w, "If account exists, verification details sent", nil)
		return
	}

	err = utils.SendVerificationEmail(user.Email, token, "reset_password")
	if err != nil {
		WriteErrorResponse(w, http.StatusInternalServerError, "Error sending verification email")
		return
	}

	WriteSuccessResponse(w, "If account exists, verification details sent", nil)
}
