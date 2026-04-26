package smb

import (
	"context"
	"fmt"
	"net"
	"strings"
	"sync"
	"time"

	"github.com/grandcat/zeroconf"
)

type DiscoveredServer struct {
	Name string   `json:"name"`
	Host string   `json:"host"`
	IPs  []string `json:"ips"`
	Port int      `json:"port"`
}

func DiscoverServers(ctx context.Context, timeout time.Duration) ([]DiscoveredServer, error) {
	var servers []DiscoveredServer
	var mu sync.Mutex
	seen := make(map[string]bool)

	addServer := func(s DiscoveredServer) {
		mu.Lock()
		defer mu.Unlock()
		if !seen[s.Host] {
			seen[s.Host] = true
			servers = append(servers, s)
		}
	}

	wg := sync.WaitGroup{}
	wg.Add(2)

	// 1. mDNS Discovery
	go func() {
		defer wg.Done()
		resolver, err := zeroconf.NewResolver(nil)
		if err != nil {
			return
		}
		entries := make(chan *zeroconf.ServiceEntry)
		browseCtx, cancel := context.WithTimeout(ctx, timeout)
		defer cancel()

		if err := resolver.Browse(browseCtx, "_smb._tcp", "local.", entries); err != nil {
			return
		}

		for entry := range entries {
			ips := make([]string, len(entry.AddrIPv4))
			for i, ip := range entry.AddrIPv4 {
				ips[i] = ip.String()
			}
			addServer(DiscoveredServer{
				Name: entry.Instance,
				Host: entry.HostName,
				IPs:  ips,
				Port: entry.Port,
			})
		}
	}()

	// 2. Subnet Scan Fallback (Port 445)
	go func() {
		defer wg.Done()
		subnets := getLocalSubnets()
		scanWG := sync.WaitGroup{}
		
		for _, subnet := range subnets {
			for i := 1; i < 255; i++ {
				ip := fmt.Sprintf("%s.%d", subnet, i)
				scanWG.Add(1)
				go func(ipAddr string) {
					defer scanWG.Done()
					d := net.Dialer{Timeout: 500 * time.Millisecond}
					conn, err := d.DialContext(ctx, "tcp", ipAddr+":445")
					if err == nil {
						conn.Close()
						
						// Try to resolve hostname
						hostname := ipAddr
						if names, err := net.LookupAddr(ipAddr); err == nil && len(names) > 0 {
							hostname = strings.TrimSuffix(names[0], ".")
						}

						addServer(DiscoveredServer{
							Name: hostname,
							Host: ipAddr,
							IPs:  []string{ipAddr},
							Port: 445,
						})
					}
				}(ip)
			}
		}
		scanWG.Wait()
	}()

	// Wait for timeout or all discovery methods to finish
	done := make(chan struct{})
	go func() {
		wg.Wait()
		close(done)
	}()

	select {
	case <-done:
	case <-time.After(timeout):
	case <-ctx.Done():
	}

	return servers, nil
}

func getLocalSubnets() []string {
	var subnets []string
	ifaces, err := net.Interfaces()
	if err != nil {
		return subnets
	}

	for _, iface := range ifaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		addrs, _ := iface.Addrs()
		for _, addr := range addrs {
			if ipnet, ok := addr.(*net.IPNet); ok && !ipnet.IP.IsLoopback() {
				if ip4 := ipnet.IP.To4(); ip4 != nil {
					// Only scan private networks to be safe
					if ip4[0] == 192 || ip4[0] == 172 || ip4[0] == 10 {
						subnets = append(subnets, fmt.Sprintf("%d.%d.%d", ip4[0], ip4[1], ip4[2]))
					}
				}
			}
		}
	}
	return subnets
}
