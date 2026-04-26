package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"runtime"
	"syscall"
	"time"

	"github.com/omnismb/bridge/internal/discovery"
	"github.com/omnismb/bridge/internal/server"
	"github.com/spf13/cobra"
)

var logChan = make(chan string, 100)

type ShareInfo struct {
	Path string `json:"path"`
	Name string `json:"name"`
	User string `json:"user"`
	Pass string `json:"pass"`
	IP   string `json:"ip"`
}

var lastShare *ShareInfo
var handshakeSuccess bool

func getLocalIP() string {
	addrs, err := net.InterfaceAddrs()
	if err != nil {
		return "localhost"
	}
	for _, address := range addrs {
		if ipnet, ok := address.(*net.IPNet); ok && !ipnet.IP.IsLoopback() {
			if ipnet.IP.To4() != nil {
				return ipnet.IP.String()
			}
		}
	}
	return "localhost"
}

func logProgress(msg string) {
	fmt.Println(msg)
	select {
	case logChan <- msg:
	default:
	}
}

var rootCmd = &cobra.Command{
	Use:   "synobridge-bridge",
	Short: "SynoBridge Bridge Agent for Legacy NAS",
	Long: `A cross-platform agent that bridges older NAS units (SMBv1/v2) 
to the SynoBridge modern web interface. Supports Windows and Linux.`,
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Println("🚀 SynoBridge Bridge starting...")

		// Start mDNS broadcast in background
		go discovery.StartBroadcast(8888)

		// Start a simple API server for configuration
		go func() {
			// CORS Middleware for local frontend access
			corsMiddleware := func(h http.HandlerFunc) http.HandlerFunc {
				return func(w http.ResponseWriter, r *http.Request) {
					w.Header().Set("Access-Control-Allow-Origin", "*")
					w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
					w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
					if r.Method == "OPTIONS" {
						return
					}
					h(w, r)
				}
			}

			// Dashboard UI
			http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
				fmt.Fprintf(w, server.GetDashboardHTML())
			})

			// Logs SSE API
			http.HandleFunc("/api/logs", corsMiddleware(func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "text/event-stream")
				w.Header().Set("Cache-Control", "no-cache")
				w.Header().Set("Connection", "keep-alive")

				flusher, _ := w.(http.Flusher)
				for msg := range logChan {
					fmt.Fprintf(w, "data: %s\n\n", msg)
					flusher.Flush()
				}
			}))

			// Last Share API (Secure way for Web App to get details)
			http.HandleFunc("/api/last-share", corsMiddleware(func(w http.ResponseWriter, r *http.Request) {
				if lastShare == nil {
					http.Error(w, "No share created yet", http.StatusNotFound)
					return
				}
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(lastShare)
			}))

			// Success Handshake API
			http.HandleFunc("/api/success", corsMiddleware(func(w http.ResponseWriter, r *http.Request) {
				if r.Method == http.MethodPost {
					handshakeSuccess = true
					logProgress("🎊 SynoBridge successfully linked to this share!")
					w.WriteHeader(http.StatusOK)
					return
				}
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(map[string]bool{"success": handshakeSuccess})
			}))

			// Browse API (List local directories)
			http.HandleFunc("/api/browse", corsMiddleware(func(w http.ResponseWriter, r *http.Request) {
				path := r.URL.Query().Get("path")
				if path == "" {
					if runtime.GOOS == "windows" {
						path = "C:\\"
					} else {
						path = "/"
					}
				}

				entries, err := os.ReadDir(path)
				if err != nil {
					http.Error(w, err.Error(), http.StatusInternalServerError)
					return
				}

				type DirEntry struct {
					Name string `json:"name"`
					Path string `json:"path"`
				}
				dirs := []DirEntry{}
				for _, entry := range entries {
					if entry.IsDir() {
						dirs = append(dirs, DirEntry{
							Name: entry.Name(),
							Path: filepath.Join(path, entry.Name()),
						})
					}
				}

				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(dirs)
			}))

			// Share API
			http.HandleFunc("/api/share", corsMiddleware(func(w http.ResponseWriter, r *http.Request) {
				if r.Method != http.MethodPost {
					http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
					return
				}
				var req struct {
					Path string `json:"path"`
					Name string `json:"name"`
					User string `json:"user"`
					Pass string `json:"pass"`
				}
				if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
					http.Error(w, err.Error(), http.StatusBadRequest)
					return
				}

				logProgress(fmt.Sprintf("📂 Setup request for: %s (%s)", req.Name, req.Path))

				// Apply share logic
				var err error
				if os.PathSeparator == '\\' {
					err = setupWindowsShare(req.Name, req.Path, req.User, req.Pass)
				} else {
					err = setupLinuxShare(req.Name, req.Path, req.User, req.Pass)
				}

				if err != nil {
					logProgress("❌ Error: " + err.Error())
					w.Header().Set("Content-Type", "application/json")
					json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "error": err.Error()})
					return
				}

				// SAVE FOR SECURE HANDSHAKE
				lastShare = &ShareInfo{
					Path: req.Path,
					Name: req.Name,
					User: req.User,
					Pass: req.Pass,
					IP:   getLocalIP(),
				}

				logProgress("✅ Setup completed successfully!")
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
			}))

			logProgress(fmt.Sprintf("🌐 Setup Dashboard available at http://localhost:8888 (Local IP: %s)", getLocalIP()))
			
			// Auto-open browser
			openBrowser("http://localhost:8888")

			if err := http.ListenAndServe("0.0.0.0:8888", nil); err != nil {
				log.Printf("Server failed: %v", err)
			}
		}()

		// Wait for interrupt
		stop := make(chan os.Signal, 1)
		signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
		<-stop

		fmt.Println("\n👋 Bridge shutting down safely.")
	},
}

func openBrowser(url string) {
	var err error
	switch runtime.GOOS {
	case "linux":
		err = exec.Command("xdg-open", url).Start()
	case "windows":
		err = exec.Command("rundll32", "url.dll,FileProtocolHandler", url).Start()
	case "darwin":
		err = exec.Command("open", url).Start()
	}
	if err != nil {
		log.Printf("Failed to open browser: %v", err)
	}
}

func setupWindowsShare(name, path, user, pass string) error {
	logProgress("🖥️ Detected Windows. Preparing secure setup...")

	// Build a PowerShell script to handle everything in one UAC prompt
	psScript := fmt.Sprintf(`
		$user = "%s"
		$pass = "%s"
		$name = "%s"
		$path = "%s"

		# 1. Ensure System User exists
		net user $user >$null 2>&1
		if ($LASTEXITCODE -ne 0) {
			Write-Host "🆕 Creating system user: $user"
			net user $user $pass /add /comment:"SynoBridge Share User" /passwordchg:no
		}

		# 2. Create the Share
		Write-Host "📂 Creating share: $name"
		net share "$name=$path" /grant:"${user},full"
	`, user, pass, name, path)

	logProgress("🔐 Opening Secure Windows Prompt (UAC)...")
	
	// Execute the script using PowerShell as Admin
	cmd := exec.Command("powershell", "-Command", "Start-Process", "powershell", "-ArgumentList", "-Command", fmt.Sprintf(`"%s"`, psScript), "-Verb", "RunAs", "-Wait")
	
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("Windows setup failed or was cancelled: %v", err)
	}

	logProgress("✅ Windows setup complete!")
	return nil
}

func setupLinuxShare(name, path, user, pass string) error {
	logProgress("🐧 Detected Linux. Preparing setup...")

	// 1. Check if Samba is installed
	if _, err := os.Stat("/etc/samba"); os.IsNotExist(err) {
		logProgress("⚠️ Samba is not installed. Attempting to install...")
		installCmd := exec.Command("pkexec", "apt-get", "update")
		installCmd.Run()
		installCmd = exec.Command("pkexec", "apt-get", "install", "-y", "samba")
		if output, err := installCmd.CombinedOutput(); err != nil {
			return fmt.Errorf("Failed to install Samba: %s. Please install it manually with 'sudo apt install samba'", string(output))
		}
		logProgress("✅ Samba installed successfully!")
	}

	logProgress("📝 Requesting permission to update /etc/samba/smb.conf...")

	// 2. Check and Override logic
	// Check if share name already exists
	checkCmd := exec.Command("grep", "-q", fmt.Sprintf("\\[%s\\]", name), "/etc/samba/smb.conf")
	if err := checkCmd.Run(); err == nil {
		logProgress(fmt.Sprintf("⚠️ Share '[%s]' already exists. Overriding old configuration...", name))
		// Remove the old block using sed (standard Samba block removal)
		// This removes everything from [name] until the next [ or end of file
		removeCmd := fmt.Sprintf("sed -i '/\\[%s\\]/,/^\\[/ { /\\[%s\\]/! { /^\\[/! d } }; sed -i \"/\\[%s\\]/d\" /etc/samba/smb.conf", name, name, name)
		exec.Command("pkexec", "sh", "-c", removeCmd).Run()
	}

	// 3. Update smb.conf using pkexec + tee -a
	config := fmt.Sprintf("\n[%s]\n   path = %s\n   browseable = yes\n   read only = no\n   valid users = %s\n", name, path, user)
	echoCmd := exec.Command("echo", config)
	teeCmd := exec.Command("pkexec", "tee", "-a", "/etc/samba/smb.conf")

	pipe, _ := echoCmd.StdoutPipe()
	teeCmd.Stdin = pipe

	echoCmd.Start()
	if err := teeCmd.Run(); err != nil {
		return fmt.Errorf("Failed to update smb.conf: %v", err)
	}

	// 3. Ensure System User exists
	logProgress(fmt.Sprintf("👤 Checking system user: %s", user))
	checkUserCmd := exec.Command("id", "-u", user)
	if err := checkUserCmd.Run(); err != nil {
		logProgress("🆕 System user doesn't exist. Creating...")
		// Create system user with no login shell
		createUserCmd := exec.Command("pkexec", "useradd", "-M", "-s", "/usr/sbin/nologin", user)
		if output, err := createUserCmd.CombinedOutput(); err != nil {
			return fmt.Errorf("Failed to create system user: %s", string(output))
		}
		logProgress("✅ System user created!")
	}

	// 4. Add Samba user using pkexec
	logProgress(fmt.Sprintf("🔑 Setting Samba password for: %s", user))
	// Using a more robust pipe for smbpasswd
	userScript := fmt.Sprintf("printf '%s\n%s\n' | smbpasswd -a -s %s", pass, pass, user)
	cmd := exec.Command("pkexec", "sh", "-c", userScript)
	if output, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("Failed to add Samba user: %s", string(output))
	}

	// 5. Fix Permissions (Ensure Samba can traverse to and read the folder)
	logProgress("🔐 Fixing folder permissions for network access...")
	// Grant +x (traverse) to all parents and the folder itself
	// Also ensure the folder is owned/readable by the user
	permCmd := fmt.Sprintf("chmod +x %s && chmod -R 755 %s", path, path)
	// If path is in /home, we might need to fix /home/user too
	parentDir := filepath.Dir(path)
	if parentDir != "/" && parentDir != "." {
		permCmd = fmt.Sprintf("chmod +x %s && %s", parentDir, permCmd)
	}

	cmd = exec.Command("pkexec", "sh", "-c", permCmd)
	if output, err := cmd.CombinedOutput(); err != nil {
		logProgress("⚠️ Warning: Could not fully update permissions: " + string(output))
	}

	// 6. Restart Samba
	logProgress("🚀 Requesting permission to restart Samba...")
	cmd = exec.Command("pkexec", "systemctl", "restart", "smbd")
	if output, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("Failed to restart Samba: %s", string(output))
	}

	logProgress("✅ Linux setup complete!")
	return nil
}

var scanCmd = &cobra.Command{
	Use:   "scan",
	Short: "Scan for local SMB servers",
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Println("🔎 Scanning local network for SMB servers (Port 445)...")
		discovery.ScanSMB()
		// Wait a bit for goroutines to finish
		time.Sleep(2 * time.Second)
	},
}

var shareCmd = &cobra.Command{
	Use:   "share",
	Short: "Create a new SMB share from a local folder",
	Run: func(cmd *cobra.Command, args []string) {
		path, _ := cmd.Flags().GetString("path")
		name, _ := cmd.Flags().GetString("name")
		user, _ := cmd.Flags().GetString("user")
		pass, _ := cmd.Flags().GetString("pass")

		if path == "" || name == "" || user == "" || pass == "" {
			fmt.Println("❌ Error: --path, --name, --user, and --pass are required")
			return
		}

		fmt.Printf("📂 Setting up share '%s' for folder: %s (User: %s)\n", name, path, user)

		// OS-Specific Logic
		var err error
		if os.PathSeparator == '\\' {
			err = setupWindowsShare(name, path, user, pass)
		} else {
			err = setupLinuxShare(name, path, user, pass)
		}

		if err != nil {
			fmt.Printf("❌ Failed to setup share: %v\n", err)
		}
	},
}

func main() {
	shareCmd.Flags().StringP("path", "p", "", "Local folder path to share")
	shareCmd.Flags().StringP("name", "n", "SynoShare", "Name of the network share")
	shareCmd.Flags().StringP("user", "u", "", "Username for the share")
	shareCmd.Flags().StringP("pass", "s", "", "Password for the share")

	rootCmd.AddCommand(scanCmd)
	rootCmd.AddCommand(shareCmd)
	if err := rootCmd.Execute(); err != nil {
		log.Fatal(err)
	}
}
