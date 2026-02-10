package utils

import (
	"mirpass-backend/config"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func GenerateJWTToken(appID, username string) (string, error) {
	claims := jwt.MapClaims{
		"username": username,
		"appId":    appID,
		"iss":      config.AppConfig.BackendURL,
		"exp":      jwt.NewNumericDate(time.Now().UTC().Add(time.Second * time.Duration(config.AppConfig.JWTExpiresIn))),
		"iat":      jwt.NewNumericDate(time.Now().UTC()),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(config.AppConfig.JWTSecret))
}

func GenerateSysToken(userID string) (string, error) {
	return GenerateJWTToken("system", userID)
}

func ValidateSysToken(tokenString string) (string, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		return []byte(config.AppConfig.JWTSecret), nil
	})

	if err != nil {
		return "", err
	}

	claims, ok := token.Claims.(jwt.MapClaims)

	if ok && token.Valid && claims["appId"] == "system" {
		userID := claims["username"].(string)
		return userID, nil
	}

	return "", jwt.ErrSignatureInvalid
}

type Claims struct {
	Username string
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
	username, err := ValidateSysToken(tokenString)
	if err != nil {
		return nil, err
	}
	return &Claims{Username: username}, nil
}

func ValidateSSOToken(tokenString string) (jwt.MapClaims, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		return []byte(config.AppConfig.JWTSecret), nil
	})
	if err != nil {
		return nil, err
	}
	if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
		// Valid claims
		return claims, nil
	}
	return nil, jwt.ErrSignatureInvalid
}
