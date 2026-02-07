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
type Application struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	CreatedAt   string `json:"created_at"`
	Role        string `json:"role,omitempty"`
}

type APIKey struct {
	ID        int64  `json:"id"`
	AppID     string `json:"app_id"`
	Name      string `json:"name,omitempty"`
	CreatedAt string `json:"created_at"`
}

type CreateAppRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

type UpdateAppRequest struct {
	AppID       string `json:"appId"`
	Name        string `json:"name"`
	Description string `json:"description"`
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
	ID        int64   `json:"id"`
	SessionID string  `json:"session_id"`
	AppID     string  `json:"app_id"`
	Username  *string `json:"username,omitempty"` // Pointer to handle NULL
	CreatedAt string  `json:"created_at"`
	ExpiresAt string  `json:"expires_at"`
	LoginAt   *string `json:"login_at,omitempty"`
}

type SSOSessionDetails struct {
	SessionID string `json:"sessionId"`
	AppID     string `json:"appId"`
	AppName   string `json:"appName"`
	Status    string `json:"status"` // pending, confirmed
}
