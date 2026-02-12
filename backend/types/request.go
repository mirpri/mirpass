package types

type CreateAppRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

type UpdateAppRequest struct {
	AppID       string `json:"appId"`
	Name        string `json:"name"`
	Description string `json:"description"`
	LogoURL     string `json:"logoUrl,omitempty"`
}

type AddMemberRequest struct {
	AppID    string `json:"appId"`
	Username string `json:"username"`
	Role     string `json:"role"` // 'admin' or 'root'
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
