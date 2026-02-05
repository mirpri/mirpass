package utils

import (
	"mirpass-backend/config"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func GenerateJWTToken(userID string) string {
	claims := jwt.MapClaims{
		"username": userID,
		"exp":      jwt.NewNumericDate(time.Now().Add(time.Second * time.Duration(config.AppConfig.JWTExpiresIn))),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signedToken, _ := token.SignedString([]byte(config.AppConfig.JWTSecret))

	return signedToken
}

func ValidateJWTToken(tokenString string) (string, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		return []byte(config.AppConfig.JWTSecret), nil
	})

	if err != nil {
		return "", err
	}

	if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
		userID := claims["username"].(string)
		return userID, nil
	}

	return "", jwt.ErrSignatureInvalid
}
