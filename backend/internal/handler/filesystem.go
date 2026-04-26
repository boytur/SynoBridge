package handler

import (
	"fmt"
	"mime"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/omnismb/backend/internal/auth"
	"github.com/omnismb/backend/internal/repository"
	"github.com/omnismb/backend/internal/smb"
)

type FSHandler struct {
	connRepo *repository.ConnectionRepository
	pool     *smb.SessionPool
}

func NewFSHandler(connRepo *repository.ConnectionRepository, pool *smb.SessionPool) *FSHandler {
	return &FSHandler{connRepo: connRepo, pool: pool}
}

func (h *FSHandler) getSession(c *gin.Context, connID uint) (*smb.SessionEntry, error) {
	userID := auth.GetUserIDFromContext(c)
	conn, err := h.connRepo.GetByID(connID)
	if err != nil {
		return nil, fmt.Errorf("connection not found")
	}
	cfg := smb.SMBConfig{
		Host:      conn.Host,
		Port:      conn.Port,
		ShareName: conn.ShareName,
		Username:  conn.Username,
		Password:  conn.Password,
	}
	
	// If no share name is set yet, we can't get a full session with a mounted share.
	// But for Listing shares, we don't need a mount.
	// We'll handle the "no mount" case in the handlers.
	return h.pool.GetSession(userID, connID, cfg)
}

func (h *FSHandler) List(c *gin.Context) {
	idStr := c.Query("id")
	path := c.Query("path")
	if idStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "connection id required"})
		return
	}
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid connection id"})
		return
	}

	conn, err := h.connRepo.GetByID(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "connection not found"})
		return
	}

	cfg := smb.SMBConfig{
		Host:      conn.Host,
		Port:      conn.Port,
		ShareName: conn.ShareName,
		Username:  conn.Username,
		Password:  conn.Password,
	}

	// Case 1: Multiple shares or empty share name, we list available shares
	isMultiShare := strings.Contains(conn.ShareName, ",") || conn.ShareName == ""
	if isMultiShare && path == "" {
		var shares []string
		var err error
		if conn.ShareName == "" {
			shares, err = h.pool.ListShares(cfg)
		} else {
			shares = strings.Split(conn.ShareName, ",")
		}

		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Failed to list shares: " + err.Error()})
			return
		}
		
		var files []smb.FileInfo
		for _, name := range shares {
			name = strings.TrimSpace(name)
			if name == "" { continue }
			files = append(files, smb.FileInfo{
				Name:        name,
				Path:        name,
				IsDirectory: true,
				Size:        0,
			})
		}
		c.JSON(http.StatusOK, files)
		return
	}

	// Case 2: We have a share name (either fixed, multi-select, or browsing)
	shareToUse := conn.ShareName
	actualPath := path

	if isMultiShare {
		// Extract share from first part of path
		path = filepath.ToSlash(path)
		parts := strings.Split(strings.Trim(path, "/"), "/")
		if len(parts) > 0 && parts[0] != "" {
			shareToUse = parts[0]
			if len(parts) > 1 {
				actualPath = strings.Join(parts[1:], "/")
			} else {
				actualPath = ""
			}
		} else {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no share selected"})
			return
		}
	}

	if shareToUse == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no share selected"})
		return
	}

	cfg.ShareName = shareToUse
	userID := auth.GetUserIDFromContext(c)
	entry, err := h.pool.GetSession(userID, uint(id), cfg)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}

	files, err := smb.ListDirectory(entry.Share, actualPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, files)
}

func (h *FSHandler) Download(c *gin.Context) {
	idStr := c.Query("id")
	path := c.Query("path")
	if idStr == "" || path == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id and path required"})
		return
	}
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid connection id"})
		return
	}
	entry, err := h.getSession(c, uint(id))
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	reader, size, err := smb.DownloadFile(entry.Share, path)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "File not found"})
		return
	}
	defer reader.Close()

	contentType := mime.TypeByExtension(filepath.Ext(path))
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	// For images, videos, and PDFs, show inline instead of attachment
	disposition := "attachment"
	if strings.HasPrefix(contentType, "image/") || 
	   strings.HasPrefix(contentType, "video/") || 
	   strings.HasPrefix(contentType, "audio/") || 
	   contentType == "application/pdf" {
		disposition = "inline"
	}

	c.Header("Content-Disposition", fmt.Sprintf(`%s; filename="%s"`, disposition, filepath.Base(path)))
	c.Header("Content-Length", strconv.FormatInt(size, 10))
	c.Header("Accept-Ranges", "bytes") // Inform browser we might support ranges (though reader doesn't yet)
	c.DataFromReader(http.StatusOK, size, contentType, reader, nil)
}

func (h *FSHandler) Upload(c *gin.Context) {
	idStr := c.PostForm("id")
	path := c.PostForm("path")
	if idStr == "" || path == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id and path required"})
		return
	}
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid connection id"})
		return
	}
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file required"})
		return
	}
	defer file.Close()

	entry, err := h.getSession(c, uint(id))
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	destPath := filepath.Join(path, header.Filename)
	if err := smb.UploadFile(entry.Share, destPath, file); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Upload failed: " + err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"message": "File uploaded", "path": destPath})
}

func (h *FSHandler) Delete(c *gin.Context) {
	var req struct {
		ID          uint   `json:"id" binding:"required"`
		Path        string `json:"path" binding:"required"`
		IsDirectory bool   `json:"isDirectory"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	entry, err := h.getSession(c, req.ID)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	if err := smb.DeletePath(entry.Share, req.Path, req.IsDirectory); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Delete failed: " + err.Error()})
		return
	}
	c.JSON(http.StatusNoContent, nil)
}

func (h *FSHandler) Mkdir(c *gin.Context) {
	var req struct {
		ID   uint   `json:"id" binding:"required"`
		Path string `json:"path" binding:"required"`
		Name string `json:"name" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	entry, err := h.getSession(c, req.ID)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	newPath := filepath.Join(req.Path, req.Name)
	if err := smb.CreateDirectory(entry.Share, newPath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create directory: " + err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"message": "Directory created", "path": newPath})
}

func (h *FSHandler) Rename(c *gin.Context) {
	var req struct {
		ID      uint   `json:"id" binding:"required"`
		OldPath string `json:"oldPath" binding:"required"`
		NewPath string `json:"newPath" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	entry, err := h.getSession(c, req.ID)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	if err := smb.Rename(entry.Share, req.OldPath, req.NewPath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Rename failed: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Renamed successfully"})
}
