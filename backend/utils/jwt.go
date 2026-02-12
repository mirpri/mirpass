package utils

import (
	"log"
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
	// 1. Try Authorization Header
	authHeader := r.Header.Get("Authorization")
	if authHeader != "" {
		parts := strings.Split(authHeader, " ")
		if len(parts) == 2 && parts[0] == "Bearer" {
			claims, err := ValidateToken(parts[1])
			if err == nil {
				return &claims, nil
			}
			// Use this error log for debugging
			log.Printf("Header token failed: %v", err)
		}
	}

	// 2. Try Cookie
	cookie, err := r.Cookie("auth_token")
	if err == nil && cookie.Value != "" {
		claims, err := ValidateToken(cookie.Value)
		if err == nil {
			return &claims, nil
		}
		log.Printf("Cookie token failed: %v", err)
		return nil, err
	}

	log.Println("JWT ExtractClaims failed: no valid header or cookie found")
	return nil, jwt.ErrTokenMalformed
}
