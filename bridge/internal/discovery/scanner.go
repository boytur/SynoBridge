package discovery

import (
	"fmt"
	"net"
	"time"
)

// ScanSMB looks for devices with port 445 open on the local network
func ScanSMB() []string {
	var found []string
	
	// Get local interface IPs
	addrs, err := net.InterfaceAddrs()
	if err != nil {
		return found
	}

	for _, addr := range addrs {
		if ipnet, ok := addr.(*net.IPNet); ok && !ipnet.IP.IsLoopback() {
			if ipnet.IP.To4() != nil {
				// Simple scan of the /24 subnet (e.g. 192.168.1.0/24)
				baseIP := ipnet.IP.Mask(ipnet.Mask)
				for i := 1; i < 255; i++ {
					targetIP := make(net.IP, len(baseIP))
					copy(targetIP, baseIP)
					targetIP[3] = byte(i)
					
					go func(ip string) {
						address := fmt.Sprintf("%s:445", ip)
						conn, err := net.DialTimeout("tcp", address, 500*time.Millisecond)
						if err == nil {
							conn.Close()
							fmt.Printf("🔍 Found SMB server at: %s\n", ip)
						}
					}(targetIP.String())
				}
			}
		}
	}
	
	return found
}
