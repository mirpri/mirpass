package utils

import (
	"bytes"
	"fmt"
	"image"
	"image/jpeg"
	_ "image/png" // register png decoder
	"io"
	"net/http"

	"github.com/nfnt/resize"
)

// ProcessImage resizes and compresses an image to be <= 128KB
func ProcessImage(r io.Reader) ([]byte, error) {
	// Decode image
	img, _, err := image.Decode(r)
	if err != nil {
		return nil, fmt.Errorf("decode image: %w", err)
	}

	// Resize logic: Max dimension 512
	bounds := img.Bounds()
	width := bounds.Dx()
	height := bounds.Dy()

	if width > 512 && height > 512 {
		img = resize.Thumbnail(512, 512, img, resize.Lanczos3)
	} else if width != height {
		size := uint(min(width, height))
		img = resize.Thumbnail(size, size, img, resize.Lanczos3)
	}

	// Compress
	var buf bytes.Buffer
	quality := 60
	buf.Reset()
	err = jpeg.Encode(&buf, img, &jpeg.Options{Quality: quality})
	if err != nil {
		return nil, fmt.Errorf("encode jpeg: %w", err)
	}

	if buf.Len() > 128*1024 {
		return nil, fmt.Errorf("image too complex to compress under 128KB")
	}

	return buf.Bytes(), nil
}

// DownloadAndProcessImage downloads an image from a URL and processes it
func DownloadAndProcessImage(url string) ([]byte, error) {
	resp, err := http.Get(url)
	if err != nil {
		return nil, fmt.Errorf("download image: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("download failed with status: %d", resp.StatusCode)
	}

	// Limit download size to 10MB
	limitReader := io.LimitReader(resp.Body, 10*1024*1024)

	return ProcessImage(limitReader)
}
