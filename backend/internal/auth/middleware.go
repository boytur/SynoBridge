package auth

import (
	"context"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

type UserClaims struct {
	Sub   string `json:"sub"`
	Email string `json:"email"`
	jwt.RegisteredClaims
}

type JWKS struct {
	Keys []JWK `json:"keys"`
}

type JWK struct {
	Kid string `json:"kid"`
	N   string `json:"n"`
	E   string `json:"e"`
	Kty string `json:"kty"`
	Use string `json:"use"`
}

type Validator struct {
	domain        string
	audience      string
	jwksURL       string
	allowedEmails []string
	existsFunc    func(string) (bool, error)
	
	// Caching
	mu            sync.RWMutex
	emailCache    map[string]string
	jwksCache     *JWKS
	jwksExpiry    time.Time
}

func NewValidator(domain, audience string, allowedEmails []string, existsFunc func(string) (bool, error)) *Validator {
	return &Validator{
		domain:        domain,
		audience:      audience,
		jwksURL:       fmt.Sprintf("https://%s/.well-known/jwks.json", domain),
		allowedEmails: allowedEmails,
		existsFunc:    existsFunc,
		emailCache:    make(map[string]string),
	}
}

func (v *Validator) ValidateToken(tokenString string) (*UserClaims, error) {
	issuer := fmt.Sprintf("https://%s/", v.domain)
	
	token, err := jwt.ParseWithClaims(tokenString, &UserClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodRSA); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return v.getPublicKey(token)
	}, jwt.WithAudience(v.audience), jwt.WithIssuer(issuer))

	if err != nil {
		fmt.Printf("Token validation failed: %v\n", err)
		return nil, err
	}

	claims, ok := token.Claims.(*UserClaims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid token claims")
	}
	return claims, nil
}

func (v *Validator) getPublicKey(token *jwt.Token) (interface{}, error) {
	v.mu.RLock()
	if v.jwksCache != nil && time.Now().Before(v.jwksExpiry) {
		jwks := v.jwksCache
		v.mu.RUnlock()
		return v.findKey(token, jwks)
	}
	v.mu.RUnlock()

	v.mu.Lock()
	defer v.mu.Unlock()

	// Double check after lock
	if v.jwksCache != nil && time.Now().Before(v.jwksExpiry) {
		return v.findKey(token, v.jwksCache)
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(v.jwksURL)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var jwks JWKS
	if err := json.NewDecoder(resp.Body).Decode(&jwks); err != nil {
		return nil, err
	}

	v.jwksCache = &jwks
	v.jwksExpiry = time.Now().Add(1 * time.Hour)

	return v.findKey(token, &jwks)
}

func (v *Validator) findKey(token *jwt.Token, jwks *JWKS) (interface{}, error) {

	kid, _ := token.Header["kid"].(string)
	for _, key := range jwks.Keys {
		if key.Kid == kid {
			// Decode the modulus (N)
			nb, err := base64.RawURLEncoding.DecodeString(key.N)
			if err != nil {
				return nil, fmt.Errorf("failed to decode modulus: %v", err)
			}

			// Decode the exponent (E)
			eb, err := base64.RawURLEncoding.DecodeString(key.E)
			if err != nil {
				return nil, fmt.Errorf("failed to decode exponent: %v", err)
			}

			var n big.Int
			n.SetBytes(nb)

			var e int
			for _, b := range eb {
				e = e<<8 | int(b)
			}

			return &rsa.PublicKey{
				N: &n,
				E: e,
			}, nil
		}
	}
	return nil, errors.New("key not found")
}

func (v *Validator) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
			return
		}
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid authorization header"})
			return
		}
		claims, err := v.ValidateToken(parts[1])
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid authentication token"})
			return
		}

		// Debug: Log claims to see if email is present
		fmt.Printf("Authenticated user: sub=%s, email=%s\n", claims.Sub, claims.Email)

		// If email is missing from the token, try fetching it from UserInfo endpoint (with cache)
		if claims.Email == "" {
			v.mu.RLock()
			cachedEmail, found := v.emailCache[claims.Sub]
			v.mu.RUnlock()

			if found {
				claims.Email = cachedEmail
			} else {
				email, err := v.fetchEmailFromUserInfo(parts[1])
				if err == nil {
					claims.Email = email
					v.mu.Lock()
					v.emailCache[claims.Sub] = email
					v.mu.Unlock()
					fmt.Printf("Fetched email from UserInfo: %s (and cached it)\n", email)
				} else {
					fmt.Printf("Failed to fetch email from UserInfo: %v\n", err)
				}
			}
		}

		// Check whitelist if configured
		if len(v.allowedEmails) > 0 || v.existsFunc != nil {
			allowed := false

			// Check env whitelist first
			for _, email := range v.allowedEmails {
				if strings.EqualFold(email, claims.Email) {
					allowed = true
					break
				}
			}

			// Check DB whitelist if not found in env
			if !allowed && v.existsFunc != nil {
				if dbAllowed, _ := v.existsFunc(claims.Email); dbAllowed {
					allowed = true
				}
			}

			if !allowed {
				c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "User email is not in the whitelist"})
				return
			}
		}

		c.Set("userClaims", claims)
		c.Set("userID", claims.Sub)
		c.Next()
	}
}

func GetUserFromContext(c *gin.Context) (*UserClaims, error) {
	val, exists := c.Get("userClaims")
	if !exists {
		return nil, errors.New("user not found in context")
	}
	claims, ok := val.(*UserClaims)
	if !ok {
		return nil, errors.New("invalid user claims type")
	}
	return claims, nil
}

func GetUserIDFromContext(c *gin.Context) string {
	id, _ := c.Get("userID")
	if s, ok := id.(string); ok {
		return s
	}
	return ""
}

func (v *Validator) fetchEmailFromUserInfo(token string) (string, error) {
	url := fmt.Sprintf("https://%s/userinfo", v.domain)
	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("Authorization", "Bearer "+token)

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("failed to fetch userinfo: %s", resp.Status)
	}

	var userInfo struct {
		Email string `json:"email"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&userInfo); err != nil {
		return "", err
	}
	return userInfo.Email, nil
}

// DevMiddleware bypasses auth for development when no Auth0 is configured
func DevMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Set("userID", "dev-user")
		c.Set("userClaims", &UserClaims{Sub: "dev-user", Email: "dev@local"})
		c.Next()
	}
}

// contextKey is unexported to avoid collisions
type contextKey string

const UserClaimsKey contextKey = "userClaims"

func WithUserClaims(ctx context.Context, claims *UserClaims) context.Context {
	return context.WithValue(ctx, UserClaimsKey, claims)
}
