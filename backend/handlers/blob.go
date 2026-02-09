package handlers

import (
	"encoding/json"
	"mirpass-backend/db"
	"mirpass-backend/utils"
	"net/http"
	"strings"
)

func UploadBlobHandler(w http.ResponseWriter, r *http.Request) {
	// Limit upload size (e.g. 10MB input to be safe before processing)
	r.Body = http.MaxBytesReader(w, r.Body, 10<<20)

	file, _, err := r.FormFile("file")
	if err != nil {
		WriteErrorResponse(w, http.StatusBadRequest, "Invalid file")
		return
	}
	defer file.Close()

	processedData, err := utils.ProcessImage(file)
	if err != nil {
		WriteErrorResponse(w, http.StatusInternalServerError, "Failed to process image: "+err.Error())
		return
	}

	// Save to DB
	id := utils.GenerateID()
	err = db.SaveBlob(id, processedData, "image/jpeg")
	if err != nil {
		WriteErrorResponse(w, http.StatusInternalServerError, "Failed to save blob")
		return
	}

	url := "/blob/" + id
	WriteSuccessResponse(w, "Image uploaded", map[string]string{"url": url})
}

func ServeBlobHandler(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path
	// path is /blob/{id}
	parts := strings.Split(path, "/")
	if len(parts) < 3 {
		http.NotFound(w, r)
		return
	}
	id := parts[2]

	blob, err := db.GetBlob(id)
	if err != nil {
		http.Error(w, "Internal Error", http.StatusInternalServerError)
		return
	}
	if blob == nil {
		http.NotFound(w, r)
		return
	}

	w.Header().Set("Content-Type", blob.ContentType)
	w.Header().Set("Cache-Control", "public, max-age=31536000") // Cache for 1 year
	w.Write(blob.Data)
}

func AdminListBlobsHandler(w http.ResponseWriter, r *http.Request) {
	blobs, err := db.ListBlobs()
	if err != nil {
		WriteErrorResponse(w, http.StatusInternalServerError, "Failed to list blobs")
		return
	}
	WriteSuccessResponse(w, "Blobs fetched", blobs)
}

func AdminDeleteBlobHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteErrorResponse(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if err := db.DeleteBlob(req.ID); err != nil {
		WriteErrorResponse(w, http.StatusInternalServerError, "Failed to delete blob")
		return
	}
	WriteSuccessResponse(w, "Blob deleted", nil)
}
