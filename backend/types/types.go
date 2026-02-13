package types

type Response struct {
	Status  int         `json:"status"`
	Message string      `json:"message,omitempty"`
	Error   string      `json:"error,omitempty"`
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
	AppID   string `json:"appId"`
	LogoURL string `json:"logoUrl,omitempty"`
	Name    string `json:"name"`
	Role    string `json:"role"`
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

type TrustedURI struct {
	ID        int64  `json:"id"`
	AppID     string `json:"appId"`
	Name      string `json:"name,omitempty"`
	URI       string `json:"uri"`
	CreatedAt string `json:"createdAt"`
}

type AppMember struct {
	Username  string `json:"username"`
	Role      string `json:"role"`
	AvatarURL string `json:"avatarUrl,omitempty"`
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
