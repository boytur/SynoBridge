package repository

import (
	"time"

	"gorm.io/gorm"
)

type SMBConnection struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time      `json:"createdAt"`
	UpdatedAt time.Time      `json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
	Alias     string         `gorm:"unique;not null" json:"alias"`
	Host      string         `gorm:"not null" json:"host"`
	Port      int            `gorm:"not null" json:"port"`
	ShareName string         `gorm:"not null" json:"shareName"`
	Username  string         `gorm:"not null" json:"username"`
	Password  string         `gorm:"not null" json:"-"` // Never send password to frontend
}

type WishlistItem struct {
	ID           uint          `gorm:"primaryKey" json:"id"`
	CreatedAt    time.Time     `json:"createdAt"`
	UpdatedAt    time.Time     `json:"updatedAt"`
	ConnectionID uint          `gorm:"not null;index" json:"connectionId"`
	Connection   SMBConnection `gorm:"foreignKey:ConnectionID;constraint:OnDelete:CASCADE" json:"connection"`
	Path         string        `gorm:"not null" json:"path"`
	IsDirectory  bool          `gorm:"not null" json:"isDirectory"`
	FileName     string        `gorm:"not null" json:"fileName"`
}
