import { useState, useEffect } from 'react'
import { Server, Search, Loader2, ArrowRight, Wifi } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { discoveryApi, type DiscoveredServer } from '@/lib/api'

interface Props {
  onSetup: (server: DiscoveredServer) => void
}

export function QuickSetup({ onSetup }: Props) {
  const [isScanning, setIsScanning] = useState(false)
  const [discovered, setDiscovered] = useState<DiscoveredServer[]>([])

  const handleScan = async () => {
    setIsScanning(true)
    try {
      const servers = await discoveryApi.scan()
      setDiscovered(servers)
    } catch (err) {
      console.error('Scan failed', err)
    } finally {
      setIsScanning(false)
    }
  }

  // Auto-scan on mount
  useEffect(() => {
    handleScan()
  }, [])

  return (
    <div className="w-full h-full overflow-y-auto no-scrollbar pb-24">
      <div className="flex flex-col items-center justify-center min-h-full max-w-2xl mx-auto p-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-150 animate-pulse" />
          <div className="relative p-6 rounded-2xl bg-primary/20 text-primary border border-primary/20 shadow-[0_0_50px_rgba(var(--primary),0.2)]">
            <Server className="w-12 h-12" />
          </div>
        </div>

        <div className="text-center space-y-3 mb-12">
          <h1 className="text-4xl font-bold tracking-tight text-white">Welcome to SynoBridge</h1>
          <p className="text-lg text-muted-foreground">
            Your bridge to seamless SMB storage management. <br />
            We're scanning your network for available servers...
          </p>
        </div>

        <div className="w-full space-y-4">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/60 flex items-center gap-2">
              Discovered Servers
              {isScanning && <Loader2 className="w-3 h-3 animate-spin" />}
            </h2>
            <Button variant="ghost" size="sm" onClick={handleScan} disabled={isScanning} className="text-xs gap-2">
              <Search className="w-3 h-3" />
              Rescan
            </Button>
          </div>

          <div className="grid gap-3">
            {discovered.length === 0 && !isScanning && (
              <div className="p-12 rounded-2xl border border-white/5 bg-white/5 text-center space-y-3">
                <div className="flex justify-center">
                  <div className="p-3 rounded-full bg-white/5 text-muted-foreground/50">
                    <Wifi className="w-6 h-6" />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">No servers found yet. Try rescanning or add one manually in the sidebar.</p>
              </div>
            )}

            {discovered.map((server, idx) => (
              <div
                key={idx}
                className="group relative overflow-hidden p-5 rounded-2xl border border-white/5 bg-white/5 hover:bg-white/10 hover:border-primary/20 transition-all duration-300"
              >
                <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button size="sm" onClick={() => onSetup(server)} className="gap-2">
                    Setup <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>

                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                    <Server className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-semibold text-white">{server.name || 'Unknown Server'}</h3>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="font-mono">{server.host}</span>
                      <span className="w-1 h-1 rounded-full bg-white/20" />
                      <span>Port {server.port}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {isScanning && discovered.length === 0 && (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="h-24 rounded-2xl bg-white/5 border border-white/5 animate-pulse" />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Future Feature Notice */}
        <div className="mt-12 p-6 rounded-2xl border border-primary/10 bg-primary/5 text-center">
          <p className="text-xs font-medium text-primary uppercase tracking-[0.2em] mb-1">Coming Soon</p>
          <p className="text-sm text-muted-foreground font-medium">
            Automated Synology Setup & Smart Shared Folder Grouping
          </p>
        </div>
      </div>
    </div>
  )
}
