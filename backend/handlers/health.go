package handlers

import (
	"encoding/json"
	"mirpass-backend/types"
	"net/http"
)

func HealthCheckHandler(w http.ResponseWriter, r *http.Request) {
	response := types.Response{
		Status:  200,
		Message: "mirpass server is running",
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(response)
}
