package repository

import "gorm.io/gorm"

type WhitelistedEmail struct {
	ID    uint   `gorm:"primaryKey" json:"id"`
	Email string `gorm:"uniqueIndex;not null" json:"email"`
}

type WhitelistRepository struct {
	db *gorm.DB
}

func NewWhitelistRepository(db *gorm.DB) *WhitelistRepository {
	return &WhitelistRepository{db: db}
}

func (r *WhitelistRepository) GetAll() ([]WhitelistedEmail, error) {
	var emails []WhitelistedEmail
	err := r.db.Find(&emails).Error
	return emails, err
}

func (r *WhitelistRepository) Add(email string) error {
	return r.db.Create(&WhitelistedEmail{Email: email}).Error
}

func (r *WhitelistRepository) Delete(id uint) error {
	return r.db.Delete(&WhitelistedEmail{}, id).Error
}

func (r *WhitelistRepository) Exists(email string) (bool, error) {
	var count int64
	// Case-insensitive check for SQLite
	err := r.db.Model(&WhitelistedEmail{}).Where("LOWER(email) = LOWER(?)", email).Count(&count).Error
	return count > 0, err
}
