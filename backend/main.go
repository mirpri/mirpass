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
	mux.HandleFunc("/register", handlers.RegisterHandler)
	mux.HandleFunc("/login", handlers.LoginHandler)
	mux.HandleFunc("/verify", handlers.VerifyEmailHandler)

	http.ListenAndServe(":3999", mux)
}
