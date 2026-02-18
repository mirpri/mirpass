package main

import (
	"log"
	"mirpass-backend/config"
	"mirpass-backend/db"
	"mirpass-backend/handlers"
	"net/http"
	"strconv"
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
	mux.HandleFunc("/verify/info", handlers.GetVerificationInfoHandler)
	mux.HandleFunc("/apps/info", handlers.AppPublicInfoHandler)
	mux.HandleFunc("/user/info", handlers.UserPublicInfoHandler)
	mux.HandleFunc("/token/verify", handlers.VerifyTokenHandler)
	mux.HandleFunc("/blob/", handlers.ServeBlobHandler)

	// Protected routes
	mux.Handle("/myprofile", handlers.AuthMiddleware(http.HandlerFunc(handlers.MyInfoHandler)))
	mux.Handle("/myusername", handlers.AuthMiddleware(http.HandlerFunc(handlers.MyUsernameHandler)))
	mux.Handle("/profile/nickname", handlers.AuthSysMiddleware(http.HandlerFunc(handlers.UpdateNicknameHandler)))
	mux.Handle("/profile/avatar", handlers.AuthSysMiddleware(http.HandlerFunc(handlers.UpdateAvatarHandler)))
	mux.Handle("/profile/password", handlers.AuthSysMiddleware(http.HandlerFunc(handlers.UpdatePasswordHandler)))
	mux.Handle("/profile/email/change", handlers.AuthSysMiddleware(http.HandlerFunc(handlers.RequestChangeEmailHandler)))
	mux.HandleFunc("/profile/password/reset", handlers.RequestPasswordResetHandler)

	// Admin routes
	mux.Handle("/admin/blobs", handlers.AuthSysMiddleware(handlers.RequireAdmin("system", http.HandlerFunc(handlers.AdminListBlobsHandler))))
	mux.Handle("/admin/blob/delete", handlers.AuthSysMiddleware(handlers.RequireAdmin("system", http.HandlerFunc(handlers.AdminDeleteBlobHandler))))
	mux.Handle("/admin/blob/upload", handlers.AuthSysMiddleware(handlers.RequireAdmin("system", http.HandlerFunc(handlers.UploadBlobHandler))))

	mux.Handle("/admin/users", handlers.AuthSysMiddleware(handlers.RequireAdmin("system", http.HandlerFunc(handlers.AdminListUsers))))
	mux.Handle("/admin/users/search", handlers.AuthSysMiddleware(handlers.RequireAdmin("system", http.HandlerFunc(handlers.AdminSearchUsers))))
	mux.Handle("/admin/user/delete", handlers.AuthSysMiddleware(handlers.RequireAdmin("system", http.HandlerFunc(handlers.AdminDeleteUser))))
	mux.Handle("/admin/user/update", handlers.AuthSysMiddleware(handlers.RequireAdmin("system", http.HandlerFunc(handlers.AdminUpdateUser))))
	mux.Handle("/admin/user/verify", handlers.AuthSysMiddleware(handlers.RequireAdmin("system", http.HandlerFunc(handlers.AdminVerifyUser))))
	mux.Handle("/admin/user/reset-password", handlers.AuthSysMiddleware(handlers.RequireAdmin("system", http.HandlerFunc(handlers.AdminResetPassword))))

	// System App Management
	mux.Handle("/admin/apps", handlers.AuthSysMiddleware(handlers.RequireAdmin("system", http.HandlerFunc(handlers.AdminListApps))))
	mux.Handle("/admin/app/delete", handlers.AuthSysMiddleware(handlers.RequireAdmin("system", http.HandlerFunc(handlers.AdminDeleteApp))))
	mux.Handle("/admin/app/suspend", handlers.AuthSysMiddleware(handlers.RequireAdmin("system", http.HandlerFunc(handlers.AdminSuspendApp))))

	// My Apps endpoint
	mux.Handle("/myapps", handlers.AuthSysMiddleware(http.HandlerFunc(handlers.MyAppsHandler)))
	mux.Handle("/user/history", handlers.AuthSysMiddleware(http.HandlerFunc(handlers.GetLoginHistoryHandler)))
	mux.Handle("/user/apps/summary", handlers.AuthSysMiddleware(http.HandlerFunc(handlers.GetUserAppsSummaryHandler)))

	// App Management
	mux.Handle("/apps/create", handlers.AuthSysMiddleware(http.HandlerFunc(handlers.CreateAppHandler)))
	mux.Handle("/apps/details", handlers.AuthSysMiddleware(http.HandlerFunc(handlers.AppDetailsHandler)))
	mux.Handle("/apps/uris", handlers.AuthSysMiddleware(http.HandlerFunc(handlers.GetAppTrustedURIsHandler)))
	mux.Handle("/apps/uris/add", handlers.AuthSysMiddleware(http.HandlerFunc(handlers.AddAppTrustedURIHandler)))
	mux.Handle("/apps/uris/delete", handlers.AuthSysMiddleware(http.HandlerFunc(handlers.DeleteAppTrustedURIHandler)))

	mux.Handle("/apps/secrets", handlers.AuthSysMiddleware(http.HandlerFunc(handlers.ListAppSecretsHandler)))
	mux.Handle("/apps/secrets/create", handlers.AuthSysMiddleware(http.HandlerFunc(handlers.CreateAppSecretHandler)))
	mux.Handle("/apps/secrets/delete", handlers.AuthSysMiddleware(http.HandlerFunc(handlers.DeleteAppSecretHandler)))

	mux.Handle("/apps/update", handlers.AuthSysMiddleware(http.HandlerFunc(handlers.UpdateAppHandler)))
	mux.Handle("/apps/delete", handlers.AuthSysMiddleware(http.HandlerFunc(handlers.DeleteAppHandler)))
	mux.Handle("/apps/device-code/toggle", handlers.AuthSysMiddleware(http.HandlerFunc(handlers.UpdateDeviceCodeEnabledHandler)))
	mux.Handle("/apps/stats", handlers.AuthSysMiddleware(http.HandlerFunc(handlers.GetAppStatsHandler)))
	mux.Handle("/apps/history", handlers.AuthSysMiddleware(http.HandlerFunc(handlers.GetAppHistoryHandler)))

	mux.Handle("/apps/members", handlers.AuthSysMiddleware(http.HandlerFunc(handlers.GetAppMembersHandler)))
	mux.Handle("/apps/members/add", handlers.AuthSysMiddleware(http.HandlerFunc(handlers.AddAppMemberHandler)))
	mux.Handle("/apps/members/remove", handlers.AuthSysMiddleware(http.HandlerFunc(handlers.RemoveAppMemberHandler)))
	mux.Handle("/apps/members/role", handlers.AuthSysMiddleware(http.HandlerFunc(handlers.UpdateAppMemberRoleHandler)))

	//OAuth2 Routes
	mux.HandleFunc("/authorize/request", handlers.SessionDetailsHandler)
	mux.HandleFunc("/authorize/request/by-user-code", handlers.SessionDetailsByUsercodeHandler)
	mux.HandleFunc("/authorize/request/consent", handlers.OAuthConsentHandler)

	// OAuth2 Device Code Flow Routes
	mux.HandleFunc("/oauth2/devicecode", handlers.DeviceFlowInitiateHandler)
	mux.HandleFunc("/oauth2/token", handlers.GetTokenHandler)

	// Auth Code Flow Consent Handler
	mux.HandleFunc("/oauth2/authorize", handlers.AuthCodeFlowHandler)
	mux.HandleFunc("/authorize/consent/redirect", handlers.AuthCodeFlowConsentHandler)

	// OIDC Discovery
	mux.HandleFunc("/.well-known/openid-configuration", handlers.OIDCConfigurationHandler)

	// Root routes
	mux.Handle("/root/user/role", handlers.AuthSysMiddleware(handlers.RequireRoot("system", http.HandlerFunc(handlers.RootUpdateRole))))
	mux.Handle("/root/sql", handlers.AuthSysMiddleware(handlers.RequireRoot("system", http.HandlerFunc(handlers.RootDirectSQL))))

	// Wrap the mux with the CORS middleware
	log.Println("Server starting on port " + strconv.Itoa(config.AppConfig.Port))
	log.Println(http.ListenAndServe(":"+strconv.Itoa(config.AppConfig.Port), handlers.CORSMiddleware(mux)))
}
