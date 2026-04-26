package repository

import (
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func NewDB(path string) (*gorm.DB, error) {
	db, err := gorm.Open(sqlite.Open(path), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
	})
	if err != nil {
		return nil, err
	}
	// Enable foreign keys for SQLite
	db.Exec("PRAGMA foreign_keys = ON")
	// Auto-migrate schema
	if err := db.AutoMigrate(&SMBConnection{}, &WishlistItem{}, &WhitelistedEmail{}); err != nil {
		return nil, err
	}
	return db, nil
}
