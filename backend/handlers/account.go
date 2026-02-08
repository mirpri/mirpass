package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"mirpass-backend/db"
	"net/http"
	"regexp"
	"strings"

	"mirpass-backend/utils"

	"golang.org/x/crypto/bcrypt"
)

func LoginHandler(w http.ResponseWriter, r *http.Request) {
	var creds struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}

	err := json.NewDecoder(r.Body).Decode(&creds)
	if err != nil {
		WriteErrorResponse(w, 400, "Invalid request payload")
		return
	}

	user, err := db.GetUserByUsername(creds.Username)
	if err != nil {
		if err == sql.ErrNoRows {
			WriteErrorResponse(w, 401, "Invalid username or password")
		} else {
			log.Printf("GetUserByUsername error: %v", err)
			WriteErrorResponse(w, 500, "Database error")
		}
		return
	}

	err = bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(creds.Password))
	if err != nil {
		WriteErrorResponse(w, 401, "Invalid username or password")
		return
	}

	if !user.IsVerified {
		WriteErrorResponse(w, 403, "Please verify your email before logging in")
		return
	}

	token := utils.GenerateJWTToken(creds.Username)
	WriteSuccessResponse(w, "Login Success", map[string]string{"token": token})
}

func RegisterHandler(w http.ResponseWriter, r *http.Request) {
	log.Default().Println("RegisterHandler called")

	var req struct {
		Username string `json:"username"`
		Email    string `json:"email"`
		Password string `json:"password"`
	}

	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		WriteErrorResponse(w, 400, "Invalid request payload")
		return
	}

	if req.Username == "" || req.Email == "" || req.Password == "" {
		WriteErrorResponse(w, 400, "All fields are required")
		return
	}

	// Validation
	// Username: 5-15 chars, numbers, lowercase letters, underscore
	usernameRegex := regexp.MustCompile(`^[a-z0-9_]{5,15}$`)
	if !usernameRegex.MatchString(req.Username) {
		WriteErrorResponse(w, 400, "Username must be 5-15 characters and contain only lowercase letters, numbers, or underscores")
		return
	}

	// Password: > 8 characters
	if len(req.Password) < 8 {
		WriteErrorResponse(w, 400, "Password must be at least 8 characters")
		return
	}

	// Check conflicts & cleanup unverified
	err = db.ResolveRegistrationConflict(req.Username, req.Email)
	if err != nil {
		if err.Error() == "conflict with verified user" {
			WriteErrorResponse(w, 400, "Username or email already taken")
			return
		}
		log.Printf("ResolveRegistrationConflict error: %v", err)
		WriteErrorResponse(w, 500, "Database error checking conflicts")
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		WriteErrorResponse(w, 500, "Error hashing password")
		return
	}

	_, err = db.CreateUser(req.Username, req.Email, string(hashedPassword))
	if err != nil {
		log.Printf("CreateUser error: %v", err)
		WriteErrorResponse(w, 500, "Error creating user")
		return
	}

	// Generate and save verification token
	token := utils.GenerateToken()
	err = db.CreateVerification(req.Username, token, "register", "")
	if err != nil {
		log.Printf("CreateVerification error: %v", err)
		WriteErrorResponse(w, 500, "Error creating verification")
		return
	}

	// Send verification email
	go utils.SendVerificationEmail(req.Email, token, "register")

	WriteSuccessResponse(w, "Registration successful. Please check your email to verify your account.", nil)
}

func GetVerificationInfoHandler(w http.ResponseWriter, r *http.Request) {
	token := r.URL.Query().Get("token")
	if token == "" {
		WriteErrorResponse(w, 400, "Missing token")
		return
	}

	task, err := db.GetVerificationInfo(token)
	if err != nil {
		WriteErrorResponse(w, 400, "Invalid or expired token")
		return
	}

	WriteSuccessResponse(w, "Verification info retrieved", map[string]string{"task": task})
}

func VerifyEmailHandler(w http.ResponseWriter, r *http.Request) {
	token := r.URL.Query().Get("token")
	if token == "" {
		WriteErrorResponse(w, 400, "Missing token")
		return
	}

	task, err := db.VerifyUserByToken(token)
	if err != nil {
		WriteErrorResponse(w, 400, "Invalid or expired token")
		return
	}

	// If the request is coming from fetch/axios (expects JSON), return JSON instead of redirect
	acceptsJSON := strings.Contains(r.Header.Get("Accept"), "application/json") ||
		r.Header.Get("X-Requested-With") == "XMLHttpRequest"

	if acceptsJSON {
		message := "Email verified account activated"
		if task == "change_email" {
			message = "Email successfully changed"
		} else if task == "reset_password" {
			message = "Password successfully reset"
		}
		WriteSuccessResponse(w, message, nil)
		return
	}
}
