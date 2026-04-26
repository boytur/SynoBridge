package repository

import (
	"gorm.io/gorm"
)

type ConnectionRepository struct {
	db  *gorm.DB
	key []byte
}

func NewConnectionRepository(db *gorm.DB, key []byte) *ConnectionRepository {
	return &ConnectionRepository{db: db, key: key}
}

func (r *ConnectionRepository) Create(conn *SMBConnection) error {
	encrypted, err := EncryptPassword(conn.Password, r.key)
	if err != nil {
		return err
	}
	conn.Password = encrypted
	return r.db.Create(conn).Error
}

func (r *ConnectionRepository) GetByID(id uint) (*SMBConnection, error) {
	var conn SMBConnection
	if err := r.db.First(&conn, id).Error; err != nil {
		return nil, err
	}
	plain, err := DecryptPassword(conn.Password, r.key)
	if err != nil {
		return nil, err
	}
	conn.Password = plain
	return &conn, nil
}

func (r *ConnectionRepository) GetAll() ([]SMBConnection, error) {
	var conns []SMBConnection
	if err := r.db.Find(&conns).Error; err != nil {
		return nil, err
	}
	// Don't expose passwords in list
	for i := range conns {
		conns[i].Password = ""
	}
	return conns, nil
}

func (r *ConnectionRepository) Update(id uint, updates map[string]interface{}) error {
	if pw, ok := updates["password"].(string); ok && pw != "" {
		encrypted, err := EncryptPassword(pw, r.key)
		if err != nil {
			return err
		}
		updates["password"] = encrypted
	}
	return r.db.Model(&SMBConnection{}).Where("id = ?", id).Updates(updates).Error
}

func (r *ConnectionRepository) Delete(id uint) error {
	return r.db.Delete(&SMBConnection{}, id).Error
}
