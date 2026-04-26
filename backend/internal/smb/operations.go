package smb

import (
	"io"
	"path/filepath"
	"sync"
	"time"

	"github.com/hirochachacha/go-smb2"
)

type FileInfo struct {
	Name        string    `json:"name"`
	Path        string    `json:"path"`
	Size        int64     `json:"size"`
	IsDirectory bool      `json:"isDirectory"`
	ModifiedAt  time.Time `json:"modifiedAt"`
}

func ListDirectory(share *smb2.Share, path string) ([]FileInfo, error) {
	if path == "" {
		path = "."
	}
	entries, err := share.ReadDir(path)
	if err != nil {
		return nil, err
	}
	files := make([]FileInfo, 0, len(entries))
	for _, e := range entries {
		name := e.Name()
		fullPath := filepath.Join(path, name)
		if path == "." || path == "/" {
			fullPath = name
		}
		files = append(files, FileInfo{
			Name:        name,
			Path:        fullPath,
			Size:        e.Size(),
			IsDirectory: e.IsDir(),
			ModifiedAt:  e.ModTime(),
		})
	}
	return files, nil
}

func DownloadFile(share *smb2.Share, path string) (io.ReadCloser, int64, error) {
	f, err := share.Open(path)
	if err != nil {
		return nil, 0, err
	}
	info, err := f.Stat()
	if err != nil {
		f.Close()
		return nil, 0, err
	}
	return f, info.Size(), nil
}

func UploadFile(share *smb2.Share, path string, reader io.Reader) error {
	f, err := share.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()
	_, err = io.Copy(f, reader)
	return err
}

func DeletePath(share *smb2.Share, path string, isDir bool) error {
	if isDir {
		return share.RemoveAll(path)
	}
	return share.Remove(path)
}

func BulkDelete(share *smb2.Share, paths []string, isDirs []bool) []error {
	errs := make([]error, len(paths))
	var wg sync.WaitGroup
	for i, path := range paths {
		wg.Add(1)
		go func(idx int, p string, isDir bool) {
			defer wg.Done()
			errs[idx] = DeletePath(share, p, isDir)
		}(i, path, isDirs[i])
	}
	wg.Wait()
	return errs
}

func CreateDirectory(share *smb2.Share, path string) error {
	return share.MkdirAll(path, 0755)
}

func Rename(share *smb2.Share, oldPath, newPath string) error {
	return share.Rename(oldPath, newPath)
}
