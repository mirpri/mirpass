package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"mirpass-backend/db"
	"mirpass-backend/utils"
	"net/http"
	"strings"
)

type contextKey string

const UsernameKey contextKey = "username"
const AppIDKey contextKey = "appId"

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

// validateAppID writes an error response and returns false when appID is empty
// (400) or targets the built-in "system" application (403).
func validateAppID(w http.ResponseWriter, appID string) bool {
	if appID == "" {
		WriteErrorResponse(w, http.StatusBadRequest, "App ID is required")
		return false
	}
	if appID == "system" {
		WriteErrorResponse(w, http.StatusForbidden, "The system application cannot be managed here")
		return false
	}
	return true
}

// AppIDFromQuery extracts the app id from the "id"/"appId" query parameter,
// validates it, and stores it in the request context under AppIDKey.
func AppIDFromQuery(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		appID := r.URL.Query().Get("id")
		if appID == "" {
			appID = r.URL.Query().Get("appId")
		}
		if !validateAppID(w, appID) {
			return
		}
		ctx := context.WithValue(r.Context(), AppIDKey, appID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// AppIDFromJSONBody extracts the app id from a JSON request body field
// ("appId", "app_id", or "id"), validates it, and stores it in the request
// context. The body is restored so downstream handlers can decode it again.
func AppIDFromJSONBody(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var appID string
		if r.Body != nil && strings.Contains(r.Header.Get("Content-Type"), "application/json") {
			body, err := io.ReadAll(r.Body)
			if err == nil && len(body) > 0 {
				var m map[string]interface{}
				if json.Unmarshal(body, &m) == nil {
					for _, key := range []string{"appId", "app_id", "id"} {
						if v, ok := m[key].(string); ok && v != "" {
							appID = v
							break
						}
					}
				}
				r.Body = io.NopCloser(bytes.NewReader(body))
			}
		}
		if appID == "" {
			appID = GetAppIDFromContext(r.Context())
		}
		if !validateAppID(w, appID) {
			return
		}
		ctx := context.WithValue(r.Context(), AppIDKey, appID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// AppIDFromMultipartForm extracts the app id from a multipart form field
// ("appId") and stores it in the request context. Unlike the other AppIDFrom*
// middlewares it does not validate, because it is meant to be chained before
// AppIDFromJSONBody on routes that accept both content types.
func AppIDFromMultipartForm(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var appID string
		if strings.HasPrefix(r.Header.Get("Content-Type"), "multipart/form-data") {
			if err := r.ParseMultipartForm(10 << 20); err == nil {
				appID = r.FormValue("appId")
			}
		}
		ctx := context.WithValue(r.Context(), AppIDKey, appID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// GetAppIDFromContext returns the app id stored by an AppIDFrom* middleware, or "".
func GetAppIDFromContext(ctx context.Context) string {
	appID, ok := ctx.Value(AppIDKey).(string)
	if !ok {
		return ""
	}
	return appID
}
