package utils

import (
	"mirpass-backend/config"
	"net/http"
	"strings"
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
	username, err := ValidateJWTToken(tokenString)
	if err != nil {
		return nil, err
	}
	return &Claims{Username: username}, nil
}

func GenerateSSOToken(appID, username string) (string, error) {
	claims := jwt.MapClaims{
		"username": username,
		"appId":    appID,
		"type":     "sso",
		"exp":      jwt.NewNumericDate(time.Now().Add(time.Minute * 5)), // Short lived
		"iat":      jwt.NewNumericDate(time.Now()),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(config.AppConfig.JWTSecret))
}

func ValidateSSOToken(tokenString string) (jwt.MapClaims, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		return []byte(config.AppConfig.JWTSecret), nil
	})
	if err != nil {
		return nil, err
	}
	if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
		if t, ok := claims["type"].(string); !ok || t != "sso" {
			return nil, jwt.ErrTokenInvalidClaims
		}
		return claims, nil
	}
	return nil, jwt.ErrSignatureInvalid
}
