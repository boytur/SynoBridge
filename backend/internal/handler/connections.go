package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/omnismb/backend/internal/repository"
	"github.com/omnismb/backend/internal/smb"
)

type ConnectionHandler struct {
	repo *repository.ConnectionRepository
	pool *smb.SessionPool
}

func NewConnectionHandler(repo *repository.ConnectionRepository, pool *smb.SessionPool) *ConnectionHandler {
	return &ConnectionHandler{repo: repo, pool: pool}
}

type createConnectionRequest struct {
	Alias     string `json:"alias" binding:"required"`
	Host      string `json:"host" binding:"required"`
	Port      int    `json:"port" binding:"required,min=1,max=65535"`
	ShareName string `json:"shareName"`
	Username  string `json:"username" binding:"required"`
	Password  string `json:"password" binding:"required"`
}

type updateConnectionRequest struct {
	Alias     string `json:"alias"`
	Host      string `json:"host"`
	Port      int    `json:"port"`
	ShareName string `json:"shareName"`
	Username  string `json:"username"`
	Password  string `json:"password"`
}

func (h *ConnectionHandler) List(c *gin.Context) {
	conns, err := h.repo.GetAll()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve connections"})
		return
	}
	c.JSON(http.StatusOK, conns)
}

func (h *ConnectionHandler) Create(c *gin.Context) {
	var req createConnectionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	conn := &repository.SMBConnection{
		Alias:     req.Alias,
		Host:      req.Host,
		Port:      req.Port,
		ShareName: req.ShareName,
		Username:  req.Username,
		Password:  req.Password,
	}

	// Verify connection before creating
	if err := h.pool.TestConnection(smb.SMBConfig{
		Host:      conn.Host,
		Port:      conn.Port,
		ShareName: conn.ShareName,
		Username:  conn.Username,
		Password:  conn.Password,
	}); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "SMB connection failed: " + err.Error()})
		return
	}

	if err := h.repo.Create(conn); err != nil {
		if isUniqueConstraintError(err) {
			c.JSON(http.StatusConflict, gin.H{"error": "Connection alias already exists"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create connection"})
		return
	}
	conn.Password = ""
	c.JSON(http.StatusCreated, conn)
}

func (h *ConnectionHandler) Update(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid connection ID"})
		return
	}
	var req updateConnectionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	updates := map[string]interface{}{}
	if req.Alias != "" {
		updates["alias"] = req.Alias
	}
	if req.Host != "" {
		updates["host"] = req.Host
	}
	if req.Port > 0 {
		updates["port"] = req.Port
	}
	if req.ShareName != "" {
		updates["share_name"] = req.ShareName
	}
	if req.Username != "" {
		updates["username"] = req.Username
	}
	if req.Password != "" {
		updates["password"] = req.Password
	}
	if err := h.repo.Update(uint(id), updates); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update connection"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Connection updated"})
}

func (h *ConnectionHandler) Delete(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid connection ID"})
		return
	}
	if err := h.repo.Delete(uint(id)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete connection"})
		return
	}
	c.JSON(http.StatusNoContent, nil)
}

func isUniqueConstraintError(err error) bool {
	return err != nil && (contains(err.Error(), "UNIQUE constraint failed") || contains(err.Error(), "unique"))
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && containsStr(s, substr))
}

func containsStr(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
