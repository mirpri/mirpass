package utils

import (
	"mirpass-backend/config"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func GenerateJWTToken(appID, username string, exp time.Duration) (string, error) {
	claims := jwt.MapClaims{
		"username": username,
		"appId":    appID,
		"iss":      config.AppConfig.BackendURL,
		"exp":      jwt.NewNumericDate(time.Now().UTC().Add(exp)),
		"iat":      jwt.NewNumericDate(time.Now().UTC()),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(config.AppConfig.JWTSecret))
}

func GenerateSysToken(userID string) (string, error) {
	return GenerateJWTToken("system", userID, time.Hour*24*7)
}

func ValidateToken(tokenString string) (Claims, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		return []byte(config.AppConfig.JWTSecret), nil
	})

	if err != nil {
		return Claims{}, err
	}

	claims, ok := token.Claims.(jwt.MapClaims)

	if ok && token.Valid && claims["appId"] == "system" {
		userID := claims["username"].(string)
		return Claims{Username: userID, AppID: "system"}, nil
	}

	return Claims{}, jwt.ErrSignatureInvalid
}

type Claims struct {
	Username string
	AppID    string
}

func ValidateSysToken(tokenString string) (string, error) {
	claim, err := ValidateToken(tokenString)
	if err != nil {
		return "", err
	}
	return claim.Username, nil
}

func ExtractClaims(r *http.Request) (*Claims, error) {
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		return nil, jwt.ErrTokenMalformed
	}
	parts := strings.Split(authHeader, " ")
	if len(parts) != 2 || parts[0] != "Bearer" {
		return nil, jwt.ErrTokenMalformed
	}
	tokenString := parts[1]
	claims, err := ValidateToken(tokenString)
	if err != nil {
		return nil, err
	}
	return &claims, nil
}
