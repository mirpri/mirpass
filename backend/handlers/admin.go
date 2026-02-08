package handlers

import (
	"encoding/json"
	"mirpass-backend/db"
	"net/http"

	"golang.org/x/crypto/bcrypt"
)

type AdminUserView struct {
	Username   string `json:"username"`
	Email      string `json:"email"`
	Nickname   string `json:"nickname"`
	AvatarURL  string `json:"avatarUrl"`
	Role       string `json:"role"`
	IsVerified bool   `json:"isVerified"`
}

func AdminListUsers(w http.ResponseWriter, r *http.Request) {
	users, err := db.GetAllUsersWithSystemRole()
	if err != nil {
		WriteErrorResponse(w, 500, "Database error")
		return
	}

	var views []AdminUserView
	for _, u := range users {
		views = append(views, AdminUserView{
			Username:   u.Username,
			Email:      u.Email,
			Nickname:   u.Nickname,
			AvatarURL:  u.AvatarURL,
			Role:       u.Role,
			IsVerified: u.IsVerified,
		})
	}

	WriteSuccessResponse(w, "Users retrieved", views)
}

func AdminSearchUsers(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("q")
	if query == "" {
		AdminListUsers(w, r)
		return
	}

	users, err := db.SearchUsersWithSystemRole(query)
	if err != nil {
		WriteErrorResponse(w, 500, "Database error")
		return
	}

	var views []AdminUserView
	for _, u := range users {
		views = append(views, AdminUserView{
			Username:   u.Username,
			Email:      u.Email,
			Nickname:   u.Nickname,
			AvatarURL:  u.AvatarURL,
			Role:       u.Role,
			IsVerified: u.IsVerified,
		})
	}

	WriteSuccessResponse(w, "Users retrieved", views)
}

func AdminDeleteUser(w http.ResponseWriter, r *http.Request) {
	username := r.URL.Query().Get("username")
	if username == "" {
		WriteErrorResponse(w, 400, "Invalid username")
		return
	}

	err := db.DeleteUser(username)
	if err != nil {
		WriteErrorResponse(w, 500, "Could not delete user")
		return
	}

	WriteSuccessResponse(w, "User deleted", nil)
}

func AdminUpdateUser(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Username  string `json:"username"`
		Email     string `json:"email"`
		Nickname  string `json:"nickname"`
		AvatarURL string `json:"avatarUrl"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		WriteErrorResponse(w, 400, "Invalid payload")
		return
	}

	if err := db.AdminUpdateUserInfo(body.Username, body.Email, body.Nickname, body.AvatarURL); err != nil {
		WriteErrorResponse(w, 500, "Update failed")
		return
	}

	WriteSuccessResponse(w, "User updated", nil)
}

func AdminVerifyUser(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Username string `json:"username"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		WriteErrorResponse(w, 400, "Invalid payload")
		return
	}

	if err := db.MarkUserVerified(body.Username); err != nil {
		WriteErrorResponse(w, 500, "Verification failed")
		return
	}

	WriteSuccessResponse(w, "User verified", nil)
}

func AdminResetPassword(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		WriteErrorResponse(w, 400, "Invalid payload")
		return
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(body.Password), bcrypt.DefaultCost)
	if err != nil {
		WriteErrorResponse(w, 500, "Hash error")
		return
	}

	if err := db.UpdateUserPassword(body.Username, string(hashed)); err != nil {
		WriteErrorResponse(w, 500, "Update failed")
		return
	}

	WriteSuccessResponse(w, "Password reset successfully", nil)
}

func RootUpdateRole(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Username string `json:"username"`
		Role     string `json:"role"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		WriteErrorResponse(w, 400, "Invalid payload")
		return
	}

	if body.Role != "user" && body.Role != "admin" && body.Role != "root" {
		WriteErrorResponse(w, 400, "Invalid role")
		return
	}

	if err := db.UpdateUserRole(body.Username, body.Role); err != nil {
		WriteErrorResponse(w, 500, "Update failed")
		return
	}

	WriteSuccessResponse(w, "Role updated", nil)
}

func RootDirectSQL(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Query string `json:"query"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		WriteErrorResponse(w, 400, "Invalid payload")
		return
	}

	results, err := db.DirectQuery(body.Query)
	if err != nil {
		WriteErrorResponse(w, 400, "Query execution failed: "+err.Error())
		return
	}

	WriteSuccessResponse(w, "Query executed", results)
}
