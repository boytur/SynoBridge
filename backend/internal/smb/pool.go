package smb

import (
	"fmt"
	"net"
	"sync"
	"time"

	"github.com/hirochachacha/go-smb2"
)

const sessionTimeout = 30 * time.Minute

type SMBConfig struct {
	Host      string
	Port      int
	ShareName string
	Username  string
	Password  string
}

type SessionEntry struct {
	Session    *smb2.Session
	Share      *smb2.Share
	LastAccess time.Time
	Config     SMBConfig
}

type SessionPool struct {
	sessions map[string]*SessionEntry
	mu       sync.RWMutex
}

func NewSessionPool() *SessionPool {
	p := &SessionPool{
		sessions: make(map[string]*SessionEntry),
	}
	go p.cleanupLoop()
	return p
}

func sessionKey(userID string, connID uint) string {
	return fmt.Sprintf("%s:%d", userID, connID)
}

func (p *SessionPool) GetSession(userID string, connID uint, config SMBConfig) (*SessionEntry, error) {
	key := sessionKey(userID, connID)

	p.mu.RLock()
	entry, ok := p.sessions[key]
	p.mu.RUnlock()

	if ok {
		p.mu.Lock()
		entry.LastAccess = time.Now()
		p.mu.Unlock()
		return entry, nil
	}

	// Create new connection
	addr := fmt.Sprintf("%s:%d", config.Host, config.Port)
	conn, err := net.Dial("tcp", addr)
	if err != nil {
		return nil, fmt.Errorf("connection failed: %w", err)
	}

	d := &smb2.Dialer{
		Initiator: &smb2.NTLMInitiator{
			User:     config.Username,
			Password: config.Password,
		},
	}

	session, err := d.Dial(conn)
	if err != nil {
		conn.Close()
		return nil, fmt.Errorf("SMB authentication failed: %w", err)
	}

	share, err := session.Mount(config.ShareName)
	if err != nil {
		session.Logoff()
		return nil, fmt.Errorf("failed to mount share: %w", err)
	}

	entry = &SessionEntry{
		Session:    session,
		Share:      share,
		LastAccess: time.Now(),
		Config:     config,
	}

	p.mu.Lock()
	p.sessions[key] = entry
	p.mu.Unlock()

	return entry, nil
}

func (p *SessionPool) TestConnection(config SMBConfig) error {
	addr := fmt.Sprintf("%s:%d", config.Host, config.Port)
	conn, err := net.DialTimeout("tcp", addr, 5*time.Second)
	if err != nil {
		return fmt.Errorf("connection failed: %w", err)
	}
	defer conn.Close()

	d := &smb2.Dialer{
		Initiator: &smb2.NTLMInitiator{
			User:     config.Username,
			Password: config.Password,
		},
	}

	session, err := d.Dial(conn)
	if err != nil {
		return fmt.Errorf("SMB authentication failed: %w", err)
	}
	defer session.Logoff()

	share, err := session.Mount(config.ShareName)
	if err != nil {
		return fmt.Errorf("failed to mount share: %w", err)
	}
	defer share.Umount()

	return nil
}

func (p *SessionPool) ListShares(config SMBConfig) ([]string, error) {
	addr := fmt.Sprintf("%s:%d", config.Host, config.Port)
	conn, err := net.DialTimeout("tcp", addr, 5*time.Second)
	if err != nil {
		return nil, fmt.Errorf("connection failed: %w", err)
	}
	defer conn.Close()

	d := &smb2.Dialer{
		Initiator: &smb2.NTLMInitiator{
			User:     config.Username,
			Password: config.Password,
		},
	}

	session, err := d.Dial(conn)
	if err != nil {
		return nil, fmt.Errorf("SMB authentication failed: %w", err)
	}
	defer session.Logoff()

	shares, err := session.ListSharenames()
	if err != nil {
		return nil, fmt.Errorf("failed to list shares: %w", err)
	}
	return shares, nil
}

func (p *SessionPool) CloseSession(userID string, connID uint) error {
	key := sessionKey(userID, connID)
	p.mu.Lock()
	defer p.mu.Unlock()
	if entry, ok := p.sessions[key]; ok {
		entry.Share.Umount()
		entry.Session.Logoff()
		delete(p.sessions, key)
	}
	return nil
}

func (p *SessionPool) CloseAllUserSessions(userID string) {
	p.mu.Lock()
	defer p.mu.Unlock()
	prefix := userID + ":"
	for key, entry := range p.sessions {
		if len(key) > len(prefix) && key[:len(prefix)] == prefix {
			entry.Share.Umount()
			entry.Session.Logoff()
			delete(p.sessions, key)
		}
	}
}

func (p *SessionPool) cleanupLoop() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		p.mu.Lock()
		for key, entry := range p.sessions {
			if time.Since(entry.LastAccess) > sessionTimeout {
				entry.Share.Umount()
				entry.Session.Logoff()
				delete(p.sessions, key)
			}
		}
		p.mu.Unlock()
	}
}
