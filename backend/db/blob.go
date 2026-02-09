package db

import (
	"database/sql"
	"fmt"
	"log"
)

type Blob struct {
	ID          string
	Data        []byte
	ContentType string
	Size        int
}

func SaveBlob(id string, data []byte, contentType string) error {
	_, err := database.Exec("INSERT INTO blobs (id, data, content_type, size) VALUES (?, ?, ?, ?)", id, data, contentType, len(data))
	if err != nil {
		return fmt.Errorf("insert blob: %w", err)
	}
	log.Printf("Saved blob %s (size: %d bytes)", id, len(data))
	return nil
}

func GetBlob(id string) (*Blob, error) {
	var b Blob
	err := database.QueryRow("SELECT id, data, content_type, size FROM blobs WHERE id = ?", id).Scan(&b.ID, &b.Data, &b.ContentType, &b.Size)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("get blob: %w", err)
	}
	return &b, nil
}

func DeleteBlob(id string) error {
	_, err := database.Exec("DELETE FROM blobs WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("delete blob: %w", err)
	}
	return nil
}

func ListBlobs() ([]Blob, error) {
	rows, err := database.Query("SELECT id, size, content_type FROM blobs ORDER BY created_at DESC")
	if err != nil {
		return nil, fmt.Errorf("list blobs: %w", err)
	}
	defer rows.Close()

	var blobs []Blob
	for rows.Next() {
		var b Blob
		err := rows.Scan(&b.ID, &b.Size, &b.ContentType)
		if err != nil {
			return nil, err
		}
		blobs = append(blobs, b)
	}
	return blobs, nil
}

func DeleteBlobByURL(url string) error {
	if len(url) > 6 && url[:6] == "/blob/" {
		id := url[6:]
		return DeleteBlob(id)
	}
	return nil
}
