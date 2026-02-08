package utils

import (
	"fmt"
	"mirpass-backend/config"
	"net/smtp"
)

func SendVerificationEmail(to, token, task string) error {
	var subjectLine, bodyTitle, bodyText string
	switch task {
	case "change_email":
		subjectLine = "Mirpass - Confirm Email Change"
		bodyTitle = "Confirm Email Change"
		bodyText = "You requested to change your email address. Please click the link below to confirm:"
	case "reset_password":
		subjectLine = "Mirpass - Reset Password"
		bodyTitle = "Reset Password"
		bodyText = "You requested to reset your password. Please click the link below to confirm and update your password:"
	default:
		subjectLine = "Mirpass - Email Verification"
		bodyTitle = "Verify your email"
		bodyText = "Please click the link below to verify your account:"
	}

	from := config.AppConfig.SMTPEmail

	// Construct headers
	headers := fmt.Sprintf("From: %s\r\n", from)
	headers += fmt.Sprintf("To: %s\r\n", to)
	headers += fmt.Sprintf("Subject: %s\r\n", subjectLine)
	headers += "MIME-version: 1.0;\r\n"
	headers += "Content-Type: text/html; charset=\"UTF-8\";\r\n"
	headers += "\r\n"

	verificationURL := fmt.Sprintf("%s/verify?token=%s", config.AppConfig.FrontendURL, token)
	body := fmt.Sprintf("<html><body><h1>%s</h1><p>%s</p><a href=\"%s\">Verify Link</a></body></html>", bodyTitle, bodyText, verificationURL)

	msg := []byte(headers + body)

	fmt.Printf("DEBUG: Mail Config - Enable: %v, Host: %s, Port: %s, User: %s\n",
		config.AppConfig.MailEnable, config.AppConfig.SMTPHost, config.AppConfig.SMTPPort, config.AppConfig.SMTPEmail)

	if !config.AppConfig.MailEnable {
		fmt.Printf("Mail sending is disabled. Task: %s. To: %s\n%s\n", task, to, msg)
		return nil
	}

	password := config.AppConfig.SMTPPassword
	host := config.AppConfig.SMTPHost
	port := config.AppConfig.SMTPPort
	auth := smtp.PlainAuth("", from, password, host)

	addr := fmt.Sprintf("%s:%s", host, port)
	fmt.Printf("DEBUG: Attempting to send mail to %s via %s...\n", to, addr)

	err := smtp.SendMail(addr, auth, from, []string{to}, msg)
	if err != nil {
		fmt.Printf("ERROR: Failed to send mail: %v\n", err)
	} else {
		fmt.Printf("SUCCESS: Mail sent to %s\n", to)
	}
	return err
}
