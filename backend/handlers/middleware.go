package handlers

import (
	"context"
	"mirpass-backend/db"
	"mirpass-backend/utils"
	"net/http"
	"strings"
)

type contextKey string

const UsernameKey contextKey = "username"

func CORSMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Set CORS headers
		origin := r.Header.Get("Origin")
		if origin != "" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
		} else {
			// Fallback or specific allowed origin if necessary
			w.Header().Set("Access-Control-Allow-Origin", "*")
		}

		w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE")
		w.Header().Set("Access-Control-Allow-Headers", "Accept, Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, X-Requested-With, X-Api-Key")
		w.Header().Set("Access-Control-Allow-Credentials", "true")

		// Handle preflight requests
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func AuthSysMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			WriteErrorResponse(w, http.StatusUnauthorized, "Authorization header is required")
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			WriteErrorResponse(w, http.StatusUnauthorized, "Authorization header must be in format Bearer {token}")
			return
		}

		tokenString := parts[1]
		username, err := utils.ValidateSysToken(tokenString)
		if err != nil {
			WriteErrorResponse(w, http.StatusUnauthorized, "Invalid or expired token")
			return
		}

		// Add username to request context
		ctx := context.WithValue(r.Context(), UsernameKey, username)
		r = r.WithContext(ctx)

		next.ServeHTTP(w, r)
	})
}

func AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			WriteErrorResponse(w, http.StatusUnauthorized, "Authorization header is required")
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			WriteErrorResponse(w, http.StatusUnauthorized, "Authorization header must be in format Bearer {token}")
			return
		}

		tokenString := parts[1]
		claim, err := utils.ValidateToken(tokenString)
		if err != nil {
			WriteErrorResponse(w, http.StatusUnauthorized, "Invalid or expired token")
			return
		}

		// Add username to request context
		ctx := context.WithValue(r.Context(), UsernameKey, claim.Username)
		ctx = context.WithValue(ctx, "appId", claim.AppID)
		r = r.WithContext(ctx)

		next.ServeHTTP(w, r)
	})
}

func GetUsernameFromContext(ctx context.Context) string {
	username, ok := ctx.Value(UsernameKey).(string)
	if !ok {
		return ""
	}
	return username
}

func RequireAdmin(app string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		username := GetUsernameFromContext(r.Context())
		if username == "" {
			WriteErrorResponse(w, http.StatusUnauthorized, "Unauthorized")
			return
		}

		role, err := db.GetAppRole(username, app)
		if err != nil {
			WriteErrorResponse(w, http.StatusInternalServerError, "Database error")
			return
		}

		if role != "admin" && role != "root" {
			WriteErrorResponse(w, http.StatusForbidden, "Admin access required")
			return
		}

		next.ServeHTTP(w, r)
	})
}

func RequireRoot(app string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		username := GetUsernameFromContext(r.Context())
		if username == "" {
			WriteErrorResponse(w, http.StatusUnauthorized, "Unauthorized")
			return
		}

		role, err := db.GetAppRole(username, app)
		if err != nil {
			WriteErrorResponse(w, http.StatusInternalServerError, "Database error")
			return
		}

		if role != "root" {
			WriteErrorResponse(w, http.StatusForbidden, "Root access required")
			return
		}

		next.ServeHTTP(w, r)
	})
}
