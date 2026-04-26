package discovery

import (
	"log"
	"os"

	"github.com/grandcat/zeroconf"
)

func StartBroadcast(port int) {
	host, _ := os.Hostname()
	server, err := zeroconf.Register(
		host,
		"_synobridge-bridge._tcp",
		"local.",
		port,
		[]string{"version=1.0.0", "vendor=OmniSMB"},
		nil,
	)
	if err != nil {
		log.Fatalf("Failed to start mDNS broadcast: %v", err)
	}
	defer server.Shutdown()
	
	log.Printf("📡 Broadcasting SynoBridge Bridge as '%s' on port %d", host, port)
	
	select {}
}
