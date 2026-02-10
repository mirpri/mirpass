package types

type Response struct {
	Status  int         `json:"status"`
	Message string      `json:"message,omitempty"`
	Data    interface{} `json:"data,omitempty"`
}

type User struct {
	Username     string
	Email        string
	PasswordHash string
	Nickname     string
	AvatarURL    string
	IsVerified   bool
}

type UserProfile struct {
	Username  string `json:"username"`
	Email     string `json:"email"`
	Nickname  string `json:"nickname,omitempty"`
	AvatarURL string `json:"avatarUrl,omitempty"`
}

type AppRole struct {
	AppID string `json:"appId"`
	Name  string `json:"name"`
	Role  string `json:"role"`
}

type UserWithSystemRole struct {
	Username     string
	Email        string
	PasswordHash string
	Nickname     string
	AvatarURL    string
	IsVerified   bool
	Role         string
}

type UserPublicInfo struct {
	Username  string `json:"username"`
	Nickname  string `json:"nickname,omitempty"`
	AvatarURL string `json:"avatarUrl,omitempty"`
}

type AppPublicInfo struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	LogoURL     string `json:"logoUrl"`
}

type Application struct {
	ID           string  `json:"id"`
	Name         string  `json:"name"`
	Description  string  `json:"description"`
	LogoURL      string  `json:"logoUrl,omitempty"`
	SuspendUntil *string `json:"suspendUntil,omitempty"`
	CreatedAt    string  `json:"createdAt"`
	Role         string  `json:"role,omitempty"`
}

type APIKey struct {
	ID        int64  `json:"id"`
	AppID     string `json:"appId"`
	Name      string `json:"name,omitempty"`
	CreatedAt string `json:"createdAt"`
}

type CreateAppRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

type UpdateAppRequest struct {
	AppID        string  `json:"appId"`
	Name         string  `json:"name"`
	Description  string  `json:"description"`
	LogoURL      string  `json:"logoUrl,omitempty"`
	SuspendUntil *string `json:"suspendUntil,omitempty"` // If provided
}

type AppMember struct {
	Username  string `json:"username"`
	Role      string `json:"role"`
	AvatarUrl string `json:"avatarUrl,omitempty"`
}

type AddMemberRequest struct {
	AppID    string `json:"appId"`
	Username string `json:"username"`
	Role     string `json:"role"` // 'admin' or 'root' (though mostly 'admin')
}

type UpdateMemberRoleRequest struct {
	AppID    string `json:"appId"`
	Username string `json:"username"`
	Role     string `json:"role"`
}

type RemoveMemberRequest struct {
	AppID    string `json:"appId"`
	Username string `json:"username"`
}

// SSO Types

type SSOSession struct {
	ID         int64   `json:"id"`
	SessionID  string  `json:"sessionId"`
	AppID      string  `json:"appId"`
	Username   *string `json:"username,omitempty"` // Pointer to handle NULL
	CreatedAt  string  `json:"createdAt"`
	ExpiresAt  string  `json:"expiresAt"`
	LoginAt    *string `json:"loginAt,omitempty"`
	AuthCode   *string `json:"authCode,omitempty"`
	State      string  `json:"state"`
	PollSecret *string `json:"pollSecret,omitempty"`
}

type SSOSessionDetails struct {
	SessionID string `json:"sessionId"`
	AppID     string `json:"appId"`
	AppName   string `json:"appName"`
	LogoURL   string `json:"logoUrl,omitempty"`
	Status    string `json:"status"` // pending, confirmed
}

type DailyStats struct {
	Date        string `json:"date"`
	Logins      int    `json:"logins"`
	ActiveUsers int    `json:"activeUsers"`
	NewUsers    int    `json:"newUsers"`
}

type AppStatsSummary struct {
	TotalUsers     int          `json:"totalUsers"`
	TotalLogins    int          `json:"totalLogins"`
	ActiveUsers24h int          `json:"activeUsers24h"`
	NewUsers24h    int          `json:"newUsers24h"`
	Daily          []DailyStats `json:"daily"`
}

type LoginHistoryItem struct {
	User      string `json:"user,omitempty"`
	App       string `json:"app,omitempty"`
	Timestamp string `json:"time"`
}

type AppLoginSummaryItem struct {
	App       string `json:"app"`
	LogoUrl   string `json:"logoUrl,omitempty"`
	Timestamp string `json:"time"`
}
