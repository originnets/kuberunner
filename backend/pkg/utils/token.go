package utils

import (
	"crypto/rand"
	"encoding/hex"
	"sync"
	"time"
)

// TokenTTL 登录令牌有效期。
const TokenTTL = 24 * time.Hour

type tokenEntry struct {
	Username  string
	ExpiresAt time.Time
}

var tokenStore = struct {
	sync.RWMutex
	entries map[string]tokenEntry
}{
	entries: make(map[string]tokenEntry),
}

// IssueToken 为登录成功的用户生成随机令牌。
func IssueToken(username string) (string, time.Time, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", time.Time{}, err
	}

	token := hex.EncodeToString(buf)
	expiresAt := time.Now().Add(TokenTTL)

	tokenStore.Lock()
	tokenStore.entries[token] = tokenEntry{Username: username, ExpiresAt: expiresAt}
	tokenStore.Unlock()

	return token, expiresAt, nil
}

// ValidateToken 校验令牌并返回对应用户名。
func ValidateToken(token string) (string, bool) {
	if token == "" {
		return "", false
	}

	tokenStore.RLock()
	entry, ok := tokenStore.entries[token]
	tokenStore.RUnlock()
	if !ok {
		return "", false
	}

	if time.Now().After(entry.ExpiresAt) {
		RevokeToken(token)
		return "", false
	}

	return entry.Username, true
}

// RevokeToken 注销令牌（退出登录）。
func RevokeToken(token string) {
	if token == "" {
		return
	}
	tokenStore.Lock()
	delete(tokenStore.entries, token)
	tokenStore.Unlock()
}
