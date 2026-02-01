package handlers

import (
	"encoding/json"
	"fmt"
	"mirpass-backend/types"
	"net/http"
)

func WriteSuccessResponse(w http.ResponseWriter, message string, data interface{}) {
	response := types.Response{
		Status:  200,
		Message: message,
		Data:    data,
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(response)
}

func WriteErrorResponse(w http.ResponseWriter, status int, message string) {
	response := types.Response{
		Status:  status,
		Message: message,
	}

	if status == 500 {
		fmt.Println("Internal Server Error: ", message)
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(response)
}
