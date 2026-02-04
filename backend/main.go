package main

import (
	"mirpass-backend/config"
	"mirpass-backend/db"
	"mirpass-backend/handlers"
	"net/http"
)

func main() {
	config.LoadConfig()
	db.ConnectDB()
	mux := http.NewServeMux()

	// Health check endpoint
	mux.HandleFunc("/health", handlers.HealthCheckHandler)

	// Public routes
	mux.HandleFunc("/register", handlers.RegisterHandler)
	mux.HandleFunc("/login", handlers.LoginHandler)
	mux.HandleFunc("/verify", handlers.VerifyEmailHandler)

	// Protected routes
	mux.Handle("/myprofile", handlers.AuthMiddleware(http.HandlerFunc(handlers.MyInfoHandler)))
	mux.Handle("/myusername", handlers.AuthMiddleware(http.HandlerFunc(handlers.MyUsernameHandler)))
	mux.Handle("/profile/nickname", handlers.AuthMiddleware(http.HandlerFunc(handlers.UpdateNicknameHandler)))
	mux.Handle("/profile/avatar", handlers.AuthMiddleware(http.HandlerFunc(handlers.UpdateAvatarHandler)))

	// Wrap the mux with the CORS middleware
	http.ListenAndServe(":3999", corsMiddleware(mux))
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Set CORS headers
		w.Header().Set("Access-Control-Allow-Origin", "*") // For development, allow all
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "*") // Allow all headers
		w.Header().Set("Access-Control-Expose-Headers", "Content-Length, Content-Type, Authorization")

		// Handle preflight requests
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		// Pass to the next handler
		next.ServeHTTP(w, r)
	})
}
