package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/omnismb/backend/internal/repository"
)

type WishlistHandler struct {
	repo *repository.WishlistRepository
}

func NewWishlistHandler(repo *repository.WishlistRepository) *WishlistHandler {
	return &WishlistHandler{repo: repo}
}

func (h *WishlistHandler) List(c *gin.Context) {
	items, err := h.repo.GetAll()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve wishlist"})
		return
	}
	c.JSON(http.StatusOK, items)
}

func (h *WishlistHandler) Add(c *gin.Context) {
	var req struct {
		ConnectionID uint   `json:"connectionId" binding:"required"`
		Path         string `json:"path" binding:"required"`
		IsDirectory  bool   `json:"isDirectory"`
		FileName     string `json:"fileName" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	item := &repository.WishlistItem{
		ConnectionID: req.ConnectionID,
		Path:         req.Path,
		IsDirectory:  req.IsDirectory,
		FileName:     req.FileName,
	}
	if err := h.repo.Create(item); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add to wishlist"})
		return
	}
	c.JSON(http.StatusCreated, item)
}

func (h *WishlistHandler) Remove(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid wishlist item ID"})
		return
	}
	if err := h.repo.Delete(uint(id)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove from wishlist"})
		return
	}
	c.JSON(http.StatusNoContent, nil)
}
