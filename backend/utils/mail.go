package utils

import (
	"fmt"
	"mirpass-backend/config"
	"net/smtp"
)

func SendVerificationEmail(to, token, task string) error {
	var subject, bodyTitle, bodyText string
	switch task {
	case "change_email":
		subject = "Subject: MirPass - Confirm Email Change\n"
		bodyTitle = "Confirm Email Change"
		bodyText = "You requested to change your email address. Please click the link below to confirm:"
	case "reset_password":
		subject = "Subject: MirPass - Reset Password\n"
		bodyTitle = "Reset Password"
		bodyText = "You requested to reset your password. Please click the link below to confirm and update your password:"
	default:
		subject = "Subject: MirPass - Email Verification\n"
		bodyTitle = "Verify your email"
		bodyText = "Please click the link below to verify your account:"
	}

	mime := "MIME-version: 1.0;\nContent-Type: text/html; charset=\"UTF-8\";\n\n"
	verificationURL := fmt.Sprintf("%s/verify?token=%s", config.AppConfig.FrontendURL, token)
	body := fmt.Sprintf("<html><body><h1>%s</h1><p>%s</p><a href=\"%s\">Verify Link</a></body></html>", bodyTitle, bodyText, verificationURL)

	msg := []byte(subject + mime + body)
	if !config.AppConfig.MailEnable {
		fmt.Printf("Mail sending is disabled. Task: %s. To: %s\n%s\n", task, to, msg)
		return nil
	}
	from := config.AppConfig.SMTPEmail
	password := config.AppConfig.SMTPPassword
	host := config.AppConfig.SMTPHost
	port := config.AppConfig.SMTPPort
	auth := smtp.PlainAuth("", from, password, host)

	addr := fmt.Sprintf("%s:%s", host, port)
	err := smtp.SendMail(addr, auth, from, []string{to}, msg)
	return err
}
