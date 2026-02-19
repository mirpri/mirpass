package utils

import (
	"crypto/rand"
	"crypto/rsa"
	"log"
	"sync"

	"github.com/go-jose/go-jose/v4"
)

var (
	rsaPrivateKey *rsa.PrivateKey
	jwks          *jose.JSONWebKeySet
	keysMutex     sync.RWMutex
)

const signingKeyID = "mirpass-rs256-1"

// InitKeys initializes RSA keys for OIDC signing
func InitKeys() {
	keysMutex.Lock()
	defer keysMutex.Unlock()

	if rsaPrivateKey != nil {
		return
	}

	var err error
	rsaPrivateKey, err = rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		log.Fatal("Failed to generate RSA key:", err)
	}

	jwk := jose.JSONWebKey{
		Key:       &rsaPrivateKey.PublicKey,
		KeyID:     signingKeyID,
		Algorithm: "RS256",
		Use:       "sig",
	}

	jwks = &jose.JSONWebKeySet{
		Keys: []jose.JSONWebKey{jwk},
	}
}

// GetJWKS returns the JSON Web Key Set
func GetJWKS() *jose.JSONWebKeySet {
	keysMutex.RLock()
	currentJWKS := jwks
	keysMutex.RUnlock()

	if currentJWKS == nil {
		InitKeys()
		keysMutex.RLock()
		currentJWKS = jwks
		keysMutex.RUnlock()
	}
	return currentJWKS
}

// GetRSAPrivateKey returns the current signing key
func GetRSAPrivateKey() *rsa.PrivateKey {
	keysMutex.RLock()
	currentPrivateKey := rsaPrivateKey
	keysMutex.RUnlock()

	if currentPrivateKey == nil {
		InitKeys()
		keysMutex.RLock()
		currentPrivateKey = rsaPrivateKey
		keysMutex.RUnlock()
	}
	return currentPrivateKey
}

// GetSigningKeyID returns the Key ID of the current signing key
func GetSigningKeyID() string {
	return signingKeyID
}
