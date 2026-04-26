package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/omnismb/backend/internal/repository"
)

type WhitelistHandler struct {
	repo *repository.WhitelistRepository
}

func NewWhitelistHandler(repo *repository.WhitelistRepository) *WhitelistHandler {
	return &WhitelistHandler{repo: repo}
}

func (h *WhitelistHandler) List(c *gin.Context) {
	emails, err := h.repo.GetAll()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve whitelist"})
		return
	}
	c.JSON(http.StatusOK, emails)
}

func (h *WhitelistHandler) Add(c *gin.Context) {
	var req struct {
		Email string `json:"email" binding:"required,email"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.repo.Add(req.Email); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add email to whitelist"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"message": "Email added to whitelist"})
}

func (h *WhitelistHandler) Delete(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}
	if err := h.repo.Delete(uint(id)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete from whitelist"})
		return
	}
	c.JSON(http.StatusNoContent, nil)
}
