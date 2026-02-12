package types

type DeviceFlowSession struct {
	SessionID  string
	ClientID   string
	Username   string
	DeviceCode string
	UserCode   string
	Status     string
	ExpiresAt  string
	LastPoll   string
}

type AuthCodeFlowSession struct {
	SessionID           string
	ClientID            string
	Username            string
	RedirectURI         string
	CodeChallenge       string
	CodeChallengeMethod string
	State               string
	Status              string
	ExpiresAt           string
}

type OAuthSession struct {
	SessionID string
	ClientID  string
	Username  string
	FlowType  string
	Status    string
	ExpiresAt string
}
