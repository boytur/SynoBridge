package repository

import "gorm.io/gorm"

type WishlistRepository struct {
	db *gorm.DB
}

func NewWishlistRepository(db *gorm.DB) *WishlistRepository {
	return &WishlistRepository{db: db}
}

func (r *WishlistRepository) Create(item *WishlistItem) error {
	return r.db.Create(item).Error
}

func (r *WishlistRepository) GetAll() ([]WishlistItem, error) {
	var items []WishlistItem
	if err := r.db.Preload("Connection").Find(&items).Error; err != nil {
		return nil, err
	}
	// Clear passwords from preloaded connections
	for i := range items {
		items[i].Connection.Password = ""
	}
	return items, nil
}

func (r *WishlistRepository) Delete(id uint) error {
	return r.db.Delete(&WishlistItem{}, id).Error
}

func (r *WishlistRepository) GetByConnectionAndPath(connID uint, path string) (*WishlistItem, error) {
	var item WishlistItem
	err := r.db.Where("connection_id = ? AND path = ?", connID, path).First(&item).Error
	if err != nil {
		return nil, err
	}
	return &item, nil
}
