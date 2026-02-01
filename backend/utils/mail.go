package utils

import (
	"fmt"
	"mirpass-backend/config"
	"net/smtp"
)

func SendVerificationEmail(to, token string) error {

	subject := "Subject: MirPass - Email Verification\n"
	mime := "MIME-version: 1.0;\nContent-Type: text/html; charset=\"UTF-8\";\n\n"
	verificationURL := fmt.Sprintf("%s/verify?token=%s", config.AppConfig.FrontendURL, token)
	body := fmt.Sprintf("<html><body><h1>Verify your email</h1><p>Please click the link below to verify your account:</p><a href=\"%s\">Verify Email</a></body></html>", verificationURL)

	msg := []byte(subject + mime + body)
	if !config.AppConfig.MailEnable {
		fmt.Printf("Mail sending is disabled. To: %s\n%s\n", to, msg)
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
