package utils

import (
	"crypto/sha256"
	"encoding/hex"

	"golang.org/x/crypto/bcrypt"
)

// HashPassword takes a password (likely a SHA256 hex string from frontend)
// and returns the bcrypt hash for persistent storage.
func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(bytes), err
}

// CheckPasswordHash compares a bcrypt hash with a provided password
// (which should be the SHA256 hex string from frontend).
func CheckPasswordHash(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

// Sha256 computes the SHA256 hash of a string and returns it as a hex string.
// This matches the frontend logic: utils/crypto.ts -> sha256()
// Used mostly for backend-initiated tasks (migrations, seeds).
func Sha256(text string) string {
	sum := sha256.Sum256([]byte(text))
	return hex.EncodeToString(sum[:])
}
