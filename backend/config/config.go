package config

import (
	"log"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	DBUser       string
	DBPassword   string
	DBName       string
	DBAddr       string
	JWTSecret    string
	JWTExpiresIn int
	MailEnable   bool
	SMTPEmail    string
	SMTPPassword string
	SMTPHost     string
	SMTPPort     string
	FrontendURL  string
}

var AppConfig Config

func LoadConfig() {
	err := godotenv.Load()
	if err != nil {
		log.Println("No .env file found or error loading .env file, relying on system environment variables.")
	}

	AppConfig = Config{
		DBUser:       os.Getenv("DB_USER"),
		DBPassword:   os.Getenv("DB_PASSWORD"),
		DBName:       os.Getenv("DB_NAME"),
		DBAddr:       os.Getenv("DB_ADDR"),
		JWTSecret:    os.Getenv("JWT_SECRET"),
		JWTExpiresIn: getEnvInt("JWT_EXPIRES_IN", 3600*24*7),
		MailEnable:   os.Getenv("MAIL_ENABLE") == "true",
		SMTPEmail:    os.Getenv("SMTP_EMAIL"),
		SMTPPassword: os.Getenv("SMTP_PASSWORD"),
		SMTPHost:     os.Getenv("SMTP_HOST"),
		SMTPPort:     os.Getenv("SMTP_PORT"),
		FrontendURL:  os.Getenv("FRONTEND_URL"),
	}
}

func getEnvInt(key string, defaultVal int) int {
	valStr := os.Getenv(key)
	if valStr == "" {
		return defaultVal
	}
	val, err := strconv.Atoi(valStr)
	if err != nil {
		return defaultVal
	}
	return val
}
