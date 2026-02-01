package utils

import (
	"crypto/rand"
	"encoding/hex"
)

func GenerateRandomToken() string {
	b := make([]byte, 32)
	rand.Read(b)
	return hex.EncodeToString(b)
}
