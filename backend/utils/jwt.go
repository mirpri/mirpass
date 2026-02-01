package utils

import (
	"mirpass-backend/config"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func GenerateJWTToken(userID string) string {
	claims := jwt.MapClaims{
		"user_id": userID,
		"exp":     jwt.NewNumericDate(time.Now().Add(time.Second * time.Duration(config.AppConfig.JWTExpiresIn))),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signedToken, _ := token.SignedString([]byte(config.AppConfig.JWTSecret))

	return signedToken
}
