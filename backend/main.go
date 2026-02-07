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

	// Admin routes
	mux.Handle("/admin/users", handlers.AuthMiddleware(handlers.RequireAdmin("system", http.HandlerFunc(handlers.AdminListUsers))))
	mux.Handle("/admin/users/search", handlers.AuthMiddleware(handlers.RequireAdmin("system", http.HandlerFunc(handlers.AdminSearchUsers))))
	mux.Handle("/admin/user/delete", handlers.AuthMiddleware(handlers.RequireAdmin("system", http.HandlerFunc(handlers.AdminDeleteUser))))
	mux.Handle("/admin/user/update", handlers.AuthMiddleware(handlers.RequireAdmin("system", http.HandlerFunc(handlers.AdminUpdateUser))))
	mux.Handle("/admin/user/reset-password", handlers.AuthMiddleware(handlers.RequireAdmin("system", http.HandlerFunc(handlers.AdminResetPassword))))

	// My Apps endpoint
	mux.Handle("/myapps", handlers.AuthMiddleware(http.HandlerFunc(handlers.MyAppsHandler)))

	// App Management
	mux.Handle("/apps/create", handlers.AuthMiddleware(http.HandlerFunc(handlers.CreateAppHandler)))
	mux.Handle("/apps/details", handlers.AuthMiddleware(http.HandlerFunc(handlers.AppDetailsHandler)))
	mux.Handle("/apps/keys", handlers.AuthMiddleware(http.HandlerFunc(handlers.GetAppKeysHandler)))
	mux.Handle("/apps/keys/create", handlers.AuthMiddleware(http.HandlerFunc(handlers.CreateAppKeyHandler)))
	mux.Handle("/apps/keys/delete", handlers.AuthMiddleware(http.HandlerFunc(handlers.DeleteAppKeyHandler)))

	mux.Handle("/apps/update", handlers.AuthMiddleware(http.HandlerFunc(handlers.UpdateAppHandler)))
	mux.Handle("/apps/delete", handlers.AuthMiddleware(http.HandlerFunc(handlers.DeleteAppHandler)))

	mux.Handle("/apps/members", handlers.AuthMiddleware(http.HandlerFunc(handlers.GetAppMembersHandler)))
	mux.Handle("/apps/members/add", handlers.AuthMiddleware(http.HandlerFunc(handlers.AddAppMemberHandler)))
	mux.Handle("/apps/members/remove", handlers.AuthMiddleware(http.HandlerFunc(handlers.RemoveAppMemberHandler)))
	mux.Handle("/apps/members/role", handlers.AuthMiddleware(http.HandlerFunc(handlers.UpdateAppMemberRoleHandler)))

	// SSO Routes
	mux.HandleFunc("/sso/init", handlers.InitiateSSOHandler)
	mux.HandleFunc("/sso/details", handlers.GetSSODetailsHandler)
	mux.HandleFunc("/sso/poll", handlers.PollSSOHandler)
	mux.HandleFunc("/sso/verify", handlers.VerifySSOTokenHandler)
	mux.Handle("/sso/confirm", handlers.AuthMiddleware(http.HandlerFunc(handlers.ConfirmSSOHandler)))

	// Root routes

	// Root routes
	mux.Handle("/root/user/role", handlers.AuthMiddleware(handlers.RequireRoot("system", http.HandlerFunc(handlers.RootUpdateRole))))
	mux.Handle("/root/sql", handlers.AuthMiddleware(handlers.RequireRoot("system", http.HandlerFunc(handlers.RootDirectSQL))))

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
