package utils

import (
	"github.com/jaevor/go-nanoid"
)

func GenerateApiKey() string {
	generate, _ := nanoid.Standard(64)
	return "sk_" + generate()
}

func GenerateID() string {
	generate, _ := nanoid.Standard(21)
	return generate()
}

func GenerateToken() string {
	generate, _ := nanoid.Standard(32)
	return generate()
}
