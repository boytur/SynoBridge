package handler

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/omnismb/backend/internal/smb"
)

type DiscoveryHandler struct {
	pool *smb.SessionPool
}

func NewDiscoveryHandler(pool *smb.SessionPool) *DiscoveryHandler {
	return &DiscoveryHandler{pool: pool}
}

func (h *DiscoveryHandler) Scan(c *gin.Context) {
	// Scan for 2 seconds
	servers, err := smb.DiscoverServers(c.Request.Context(), 2*time.Second)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to scan network: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, servers)
}

func (h *DiscoveryHandler) ScanShares(c *gin.Context) {
	var req struct {
		Host     string `json:"host" binding:"required"`
		Port     int    `json:"port"`
		Username string `json:"username" binding:"required"`
		Password string `json:"password" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Port == 0 {
		req.Port = 445
	}

	cfg := smb.SMBConfig{
		Host:     req.Host,
		Port:     req.Port,
		Username: req.Username,
		Password: req.Password,
	}

	shares, err := h.pool.ListShares(cfg)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "Failed to list shares: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, shares)
}
