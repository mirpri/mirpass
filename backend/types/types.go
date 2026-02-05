package types

type Response struct {
	Status  int         `json:"status"`
	Message string      `json:"message,omitempty"`
	Data    interface{} `json:"data,omitempty"`
}

type User struct {
	ID           int
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
	App  string `json:"app"`
	Role string `json:"role"`
}

type UserWithSystemRole struct {
	ID           int
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
