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

type OAuthSession struct {
	SessionID string
	ClientID  string
	Username  string
	FlowType  string
	Status    string
	ExpiresAt string
}
