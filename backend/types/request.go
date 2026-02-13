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

type AddTrustedURIRequest struct {
	AppID string `json:"appId"`
	Name  string `json:"name"`
	URI   string `json:"uri"`
}

type DeleteTrustedURIRequest struct {
	AppID string `json:"appId"`
	URIID int64  `json:"uriId"`
}

type AuthCodeFlowRequest struct {
	ClientID            string `json:"client_id"`
	RedirectURI         string `json:"redirect_uri"`
	ResponseType        string `json:"response_type"`
	CodeChallenge       string `json:"code_challenge"`
	CodeChallengeMethod string `json:"code_challenge_method"`
	State               string `json:"state"`
}
