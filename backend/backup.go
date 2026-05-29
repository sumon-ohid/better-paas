package main

import (
	"archive/tar"
	"compress/gzip"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

// ---------------------------------------------------------------------------
// Backups
// ---------------------------------------------------------------------------
//
// A backup is a gzipped tar of the data/ directory (SQLite DB, logs, admin
// token, encryption key). Backups are written to data/backups/ and can be
// downloaded via the API. This gives self-hosters a one-click safety net.
//
// SECURITY: the archive contains secrets (the DB has encrypted tokens, plus
// secret.key and admin_token.txt). It is only reachable behind admin auth, and
// the on-disk copy lives in the owner-only data/ tree.

const backupDir = "data/backups"

// createBackup writes a timestamped .tar.gz of the data directory (excluding
// the backups folder itself) and returns its path.
func createBackup() (string, error) {
	if err := os.MkdirAll(backupDir, 0700); err != nil {
		return "", err
	}
	name := fmt.Sprintf("backup-%s.tar.gz", time.Now().Format("20060102-150405"))
	outPath := filepath.Join(backupDir, name)

	f, err := os.OpenFile(outPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0600)
	if err != nil {
		return "", err
	}
	defer f.Close()

	gz := gzip.NewWriter(f)
	defer gz.Close()
	tw := tar.NewWriter(gz)
	defer tw.Close()

	root := "data"
	err = filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		// Skip the backups directory to avoid recursive inclusion.
		if strings.HasPrefix(path, backupDir) {
			return nil
		}
		rel, err := filepath.Rel(root, path)
		if err != nil {
			return err
		}
		if rel == "." {
			return nil
		}
		hdr, err := tar.FileInfoHeader(info, "")
		if err != nil {
			return err
		}
		hdr.Name = rel
		if err := tw.WriteHeader(hdr); err != nil {
			return err
		}
		if info.IsDir() {
			return nil
		}
		src, err := os.Open(path)
		if err != nil {
			// A transient file (e.g. SQLite WAL) may vanish; skip it.
			log.Printf("[backup] skipping %s: %v", path, err)
			return nil
		}
		defer src.Close()
		_, err = io.Copy(tw, src)
		return err
	})
	if err != nil {
		os.Remove(outPath)
		return "", err
	}
	return outPath, nil
}

// backupInfo describes one stored backup.
type backupInfo struct {
	Name      string    `json:"name"`
	SizeBytes int64     `json:"sizeBytes"`
	CreatedAt time.Time `json:"createdAt"`
}

func listBackups() ([]backupInfo, error) {
	entries, err := os.ReadDir(backupDir)
	if err != nil {
		if os.IsNotExist(err) {
			return []backupInfo{}, nil
		}
		return nil, err
	}
	var out []backupInfo
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".tar.gz") {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		out = append(out, backupInfo{
			Name:      e.Name(),
			SizeBytes: info.Size(),
			CreatedAt: info.ModTime(),
		})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].CreatedAt.After(out[j].CreatedAt) })
	if out == nil {
		out = []backupInfo{}
	}
	return out, nil
}

// pruneBackups keeps only the newest `keep` backups.
func pruneBackups(keep int) {
	list, err := listBackups()
	if err != nil || len(list) <= keep {
		return
	}
	for _, b := range list[keep:] {
		os.Remove(filepath.Join(backupDir, b.Name))
	}
}

// ---------------------------------------------------------------------------
// HTTP handlers
// ---------------------------------------------------------------------------

// GET /api/backups — list backups.
func handleBackupsList(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	list, err := listBackups()
	if err != nil {
		jsonError(w, "Failed to list backups", http.StatusInternalServerError)
		return
	}
	jsonOK(w, list)
}

// POST /api/backups/create — make a new backup.
func handleBackupCreate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	path, err := createBackup()
	if err != nil {
		jsonError(w, fmt.Sprintf("Backup failed: %v", err), http.StatusInternalServerError)
		return
	}
	pruneBackups(10)
	info, _ := os.Stat(path)
	jsonOK(w, backupInfo{
		Name:      filepath.Base(path),
		SizeBytes: sizeOf(info),
		CreatedAt: time.Now(),
	})
}

// GET /api/backups/download?name=<file> — stream a backup file.
func handleBackupDownload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	name := r.URL.Query().Get("name")
	// Prevent path traversal: only allow a bare backup filename.
	if name == "" || strings.ContainsAny(name, "/\\") || !strings.HasSuffix(name, ".tar.gz") {
		jsonError(w, "Invalid backup name", http.StatusBadRequest)
		return
	}
	path := filepath.Join(backupDir, name)
	f, err := os.Open(path)
	if err != nil {
		jsonError(w, "Backup not found", http.StatusNotFound)
		return
	}
	defer f.Close()
	w.Header().Set("Content-Type", "application/gzip")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", name))
	io.Copy(w, f)
}

// POST /api/backups/delete — remove a backup file.
func handleBackupDelete(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req struct {
		Name string `json:"name"`
	}
	if err := decodeJSON(r, &req); err != nil {
		jsonError(w, "Bad request", http.StatusBadRequest)
		return
	}
	if req.Name == "" || strings.ContainsAny(req.Name, "/\\") || !strings.HasSuffix(req.Name, ".tar.gz") {
		jsonError(w, "Invalid backup name", http.StatusBadRequest)
		return
	}
	if err := os.Remove(filepath.Join(backupDir, req.Name)); err != nil {
		jsonError(w, "Failed to delete backup", http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]string{"status": "deleted"})
}

func sizeOf(info os.FileInfo) int64 {
	if info == nil {
		return 0
	}
	return info.Size()
}

// startBackupScheduler runs a daily automatic backup when BACKUP_INTERVAL_HOURS
// is set (>0). Best-effort; disabled by default.
func startBackupScheduler() {
	hours := envInt("BACKUP_INTERVAL_HOURS", 0)
	if hours <= 0 {
		return
	}
	log.Printf("[backup] automatic backups every %dh", hours)
	go func() {
		ticker := time.NewTicker(time.Duration(hours) * time.Hour)
		defer ticker.Stop()
		for range ticker.C {
			if _, err := createBackup(); err != nil {
				log.Printf("[backup] scheduled backup failed: %v", err)
			} else {
				pruneBackups(10)
			}
		}
	}()
}
