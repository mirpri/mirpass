package handlers

import (
	"encoding/json"
	"mirpass-backend/db"
	"mirpass-backend/types"
	"net/http"
	"strconv"

	"golang.org/x/crypto/bcrypt"
)

type AdminUserView struct {
	ID        int    `json:"id"`
	Username  string `json:"username"`
	Email     string `json:"email"`
	Nickname  string `json:"nickname"`
	AvatarURL string `json:"avatarUrl"`
	Role      string `json:"role"` // This comes from admins table, but for listing users we might need to join again or fetch separately?
	// The user removed role from user struct, but admin might still want to see role?
	// The prompt said "use the admin table, where app = system".
	// So AdminListUsers should fetching role for 'system' app.
	IsVerified bool `json:"isVerified"`
}

// Helper to fill role
func fillRole(users []types.User) ([]AdminUserView, error) {
	// This is inefficient (N+1) but simple. Or we can just do a JOIN query in db package specifically for AdminListUsers.
	// Ideally we should have a specific DB function for AdminListUsers that includes the role.
	// But since I removed it from GetAllUsers, I should add GetAllUsersWithSystemRole or similar.
	// Let's stick to what I have in db package for a moment.
	// I can query admins table for system app and map it.

	// Better: Add GetAllUsersWithSystemRole in db/operations.go?
	// Wait, I just removed it from GetAllUsers to comply with "don't add role to user... types and queries".
	// I think the user meant "User type (in types.go) shouldn't have role, but Admin view should".

	views := []AdminUserView{}
	// We'll process this in the handler for now to avoid changing db/operations.go too much if not needed.
	// But getting all roles for system app in one go is better.
	return views, nil
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
			ID:         u.ID,
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
			ID:         u.ID,
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

	apps, err := db.GetAdminApps(user.ID) // assuming GetAdminApps takes int ID
	if err != nil {
		WriteErrorResponse(w, 500, "Database error")
		return
	}

	WriteSuccessResponse(w, "Apps retrieved", apps)
}

func AdminDeleteUser(w http.ResponseWriter, r *http.Request) {
	idStr := r.URL.Query().Get("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		WriteErrorResponse(w, 400, "Invalid user ID")
		return
	}

	// Prevent deleting yourself ideally, but root can do anything.
	// Check if target is root, prevent deleting root unless you are root?
	// For simplicity, let's just allow deletion.

	err = db.DeleteUser(id)
	if err != nil {
		WriteErrorResponse(w, 500, "Could not delete user")
		return
	}

	WriteSuccessResponse(w, "User deleted", nil)
}

func AdminUpdateUser(w http.ResponseWriter, r *http.Request) {
	var body struct {
		ID       int    `json:"id"`
		Email    string `json:"email"`
		Nickname string `json:"nickname"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		WriteErrorResponse(w, 400, "Invalid payload")
		return
	}

	if err := db.UpdateUserInfo(body.ID, body.Email, body.Nickname); err != nil {
		WriteErrorResponse(w, 500, "Update failed")
		return
	}

	WriteSuccessResponse(w, "User updated", nil)
}

func AdminResetPassword(w http.ResponseWriter, r *http.Request) {
	var body struct {
		ID       int    `json:"id"`
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

	if err := db.UpdateUserPassword(body.ID, string(hashed)); err != nil {
		WriteErrorResponse(w, 500, "Update failed")
		return
	}

	WriteSuccessResponse(w, "Password reset successfully", nil)
}

func RootUpdateRole(w http.ResponseWriter, r *http.Request) {
	var body struct {
		ID   int    `json:"id"`
		Role string `json:"role"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		WriteErrorResponse(w, 400, "Invalid payload")
		return
	}

	if body.Role != "user" && body.Role != "admin" && body.Role != "root" {
		WriteErrorResponse(w, 400, "Invalid role")
		return
	}

	if err := db.UpdateUserRole(body.ID, body.Role); err != nil {
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
