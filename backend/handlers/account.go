package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"mirpass-backend/db"
	"net/http"
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
	err = db.CreateVerification(req.Username, token)
	if err != nil {
		log.Printf("CreateVerification error: %v", err)
		WriteErrorResponse(w, 500, "Error creating verification")
		return
	}

	// Send verification email
	go utils.SendVerificationEmail(req.Email, token)

	WriteSuccessResponse(w, "Registration successful. Please check your email to verify your account.", nil)
}

func VerifyEmailHandler(w http.ResponseWriter, r *http.Request) {
	token := r.URL.Query().Get("token")
	if token == "" {
		WriteErrorResponse(w, 400, "Missing token")
		return
	}

	err := db.VerifyUserByToken(token)
	if err != nil {
		WriteErrorResponse(w, 400, "Invalid or expired token")
		return
	}

	// If the request is coming from fetch/axios (expects JSON), return JSON instead of redirect
	acceptsJSON := strings.Contains(r.Header.Get("Accept"), "application/json") ||
		r.Header.Get("X-Requested-With") == "XMLHttpRequest"

	if acceptsJSON {
		WriteSuccessResponse(w, "Email verified", nil)
		return
	}
}
