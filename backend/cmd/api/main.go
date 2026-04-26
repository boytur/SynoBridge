package main

import (
	"log"
	"os"
	"strings"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/omnismb/backend/internal/auth"
	"github.com/omnismb/backend/internal/handler"
	"github.com/omnismb/backend/internal/repository"
	"github.com/omnismb/backend/internal/smb"
)

func main() {
	dbPath := getEnv("DB_PATH", "./synobridge.db")
	encKey := padKey(getEnv("ENCRYPTION_KEY", "changeme32byteskey1234567890123"))
	auth0Domain := getEnv("AUTH0_DOMAIN", "")
	auth0Audience := getEnv("AUTH0_AUDIENCE", "")
	allowedEmailsRaw := getEnv("ALLOWED_EMAILS", "")
	var allowedEmails []string
	if allowedEmailsRaw != "" {
		for _, e := range strings.Split(allowedEmailsRaw, ",") {
			if trimmed := strings.TrimSpace(e); trimmed != "" {
				allowedEmails = append(allowedEmails, trimmed)
			}
		}
	}

	frontendURL := getEnv("FRONTEND_URL", "http://localhost:5173")
	port := getEnv("PORT", "8080")

	db, err := repository.NewDB(dbPath)
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	connRepo := repository.NewConnectionRepository(db, []byte(encKey))
	wishlistRepo := repository.NewWishlistRepository(db)
	whitelistRepo := repository.NewWhitelistRepository(db)
	sessionPool := smb.NewSessionPool()

	connHandler := handler.NewConnectionHandler(connRepo, sessionPool)
	fsHandler := handler.NewFSHandler(connRepo, sessionPool)
	wishlistHandler := handler.NewWishlistHandler(wishlistRepo)
	whitelistHandler := handler.NewWhitelistHandler(whitelistRepo)
	discoveryHandler := handler.NewDiscoveryHandler(sessionPool)

	r := gin.Default()

	// CORS
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{frontendURL},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length", "Content-Disposition"},
		AllowCredentials: true,
	}))

	// Auth middleware selection
	var authMiddleware gin.HandlerFunc
	if auth0Domain != "" && auth0Audience != "" {
		validator := auth.NewValidator(auth0Domain, auth0Audience, allowedEmails, whitelistRepo.Exists)
		authMiddleware = validator.Middleware()
		log.Printf("Auth0 enabled: domain=%s, whitelisted_emails=%v", auth0Domain, allowedEmails)
	} else {
		authMiddleware = auth.DevMiddleware()
		log.Println("WARNING: Running in dev mode without Auth0 - all requests are unauthenticated")
	}

	api := r.Group("/api/v1")
	api.Use(authMiddleware)
	{
		// Auth callback
		api.POST("/auth/callback", func(c *gin.Context) {
			claims, _ := auth.GetUserFromContext(c)
			c.JSON(200, gin.H{"user": claims})
		})

		// Connections
		api.GET("/connections", connHandler.List)
		api.POST("/connections", connHandler.Create)
		api.PUT("/connections/:id", connHandler.Update)
		api.DELETE("/connections/:id", connHandler.Delete)

		// File system
		api.GET("/fs/list", fsHandler.List)
		api.GET("/fs/download", fsHandler.Download)
		api.POST("/fs/upload", fsHandler.Upload)
		api.DELETE("/fs/delete", fsHandler.Delete)
		api.POST("/fs/mkdir", fsHandler.Mkdir)
		api.PUT("/fs/rename", fsHandler.Rename)

		// Wishlist
		api.GET("/wishlist", wishlistHandler.List)
		api.POST("/wishlist", wishlistHandler.Add)
		api.DELETE("/wishlist/:id", wishlistHandler.Remove)

		// Discovery
		api.GET("/discovery/scan", discoveryHandler.Scan)
		api.POST("/discovery/shares", discoveryHandler.ScanShares)

		// Whitelist management
		api.GET("/whitelist", whitelistHandler.List)
		api.POST("/whitelist", whitelistHandler.Add)
		api.DELETE("/whitelist/:id", whitelistHandler.Delete)
	}

	log.Printf("SynoBridge backend starting on :%s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func padKey(key string) string {
	// Ensure key is exactly 32 bytes for AES-256
	b := []byte(key)
	if len(b) >= 32 {
		return string(b[:32])
	}
	padded := make([]byte, 32)
	copy(padded, b)
	return string(padded)
}
