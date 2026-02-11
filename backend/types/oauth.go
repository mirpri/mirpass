package types

type DeviceFlowSession struct {
	ID         string
	AppID      string
	SessionID  string
	UserID     *string
	DeviceCode string
	UserCode   string
	Status     string
	ExpiresAt  string
	LastPoll   string
}
