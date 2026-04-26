import {
  Plus, Search, Server, Trash2, Wifi, Loader2, Settings, Sun, Moon,
  Star
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useConnections, useCreateConnection, useDeleteConnection } from '@/hooks/useConnections'
import { useToast } from '@/lib/toast-context'
import type { Connection, ApiError } from '@/lib/types'
import { cn } from '@/lib/utils'
import { discoveryApi, type DiscoveredServer } from '@/lib/api'
import { useEffect, useState } from 'react'

interface Props {
  selectedId: number | null
  onSelect: (conn: Connection) => void
  onSettingsClick: () => void
  onWishlistClick: () => void
  prefillServer?: DiscoveredServer | null
  onPrefillClear?: () => void
  theme: 'light' | 'dark'
  setTheme: (theme: 'light' | 'dark') => void
}


export function ConnectionSidebar({
  selectedId,
  onSelect,
  onSettingsClick,
  onWishlistClick,
  prefillServer,
  onPrefillClear,
  theme,
  setTheme
}: Props) {
  const connections = useConnections().data || []
  const isLoading = useConnections().isLoading
  const createConn = useCreateConnection()
  const deleteConn = useDeleteConnection()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [isScanningShares, setIsScanningShares] = useState(false)
  const [discovered, setDiscovered] = useState<DiscoveredServer[]>([])
  const [availableShares, setAvailableShares] = useState<string[]>([])
  const [form, setForm] = useState({ alias: '', host: '', port: '445', shareName: '', username: '', password: '' })

  // Handle prefill from QuickSetup
  useEffect(() => {
    if (prefillServer) {
      setForm({
        ...form,
        alias: prefillServer.name || prefillServer.host,
        host: prefillServer.ips[0] || prefillServer.host,
        port: String(prefillServer.port),
      })
      setOpen(true)
      onPrefillClear?.()
    }
  }, [prefillServer])

  const handleScan = async () => {
    setIsScanning(true)
    try {
      const servers = await discoveryApi.scan()
      setDiscovered(servers)
      if (servers.length === 0) {
        toast({ title: 'No servers found', description: 'Make sure your SMB server is on the same network.' })
      }
    } catch (err) {
      const apiErr = err as ApiError
      toast({
        title: 'Scan failed',
        description: apiErr.response?.data?.error || 'Could not scan the network.',
        variant: 'destructive'
      })
    } finally {
      setIsScanning(false)
    }
  }

  const handleScanShares = async () => {
    if (!form.host || !form.username || !form.password) {
      toast({ title: 'Missing information', description: 'Please enter host, username, and password first.' })
      return
    }
    setIsScanningShares(true)
    try {
      const shares = await discoveryApi.scanShares({
        host: form.host,
        port: Number(form.port),
        username: form.username,
        password: form.password
      })
      setAvailableShares(shares)
      if (shares.length === 0) {
        toast({ title: 'No shares found', description: 'Authenticated successfully, but no shares were found on the server.' })
      }
    } catch (err) {
      const apiErr = err as ApiError
      toast({
        title: 'Share scan failed',
        description: apiErr.response?.data?.error || 'Check your credentials and host.',
        variant: 'destructive'
      })
    } finally {
      setIsScanningShares(false)
    }
  }

  const selectDiscovered = (server: DiscoveredServer) => {
    setForm({
      ...form,
      alias: server.name || server.host,
      host: server.ips[0] || server.host,
      port: String(server.port),
    })
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createConn.mutateAsync({ ...form, port: Number(form.port) })
      setOpen(false)
      setForm({ alias: '', host: '', port: '445', shareName: '', username: '', password: '' })
      toast({ title: 'Connection added' })
    } catch (err) {
      const apiErr = err as ApiError
      toast({
        title: 'Failed to add connection',
        description: apiErr.response?.data?.error || 'Check your settings and try again.',
        variant: 'destructive'
      })
    }
  }

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation()
    try {
      await deleteConn.mutateAsync(id)
      toast({ title: 'Connection removed' })
    } catch {
      toast({ title: 'Failed to remove connection', variant: 'destructive' })
    }
  }

  return (
    <aside className="glass-sidebar w-64 flex flex-col h-full border-r border-white/5">
      <div className="p-6">
        <h1 className="text-xl font-bold text-foreground flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/20 text-primary shadow-sm shadow-primary/20">
            <Server className="w-5 h-5" />
          </div>
          SynoBridge
        </h1>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {/* Network Section */}
        <div>
          <div className="text-[10px] text-muted-foreground/50 px-3 py-2 uppercase tracking-[0.2em] font-bold">Network</div>
          <div className="space-y-1">
            {isLoading && (
              <div className="space-y-1 px-3">
                {[1, 2].map((i) => (
                  <div key={i} className="h-8 rounded-md bg-white/5 animate-pulse" />
                ))}
              </div>
            )}

            {connections.map((conn) => (
              <div
                key={conn.id}
                onClick={() => onSelect(conn)}
                className={cn(
                  'group flex items-center gap-3 px-3 py-2 rounded-xl text-sm cursor-pointer transition-all duration-200',
                  selectedId === conn.id
                    ? 'bg-primary/20 text-primary border border-primary/30 shadow-[0_0_15px_rgba(var(--primary),0.05)]'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground border border-transparent'
                )}
              >
                <div className={cn(
                  "p-1.5 rounded-lg transition-colors",
                  selectedId === conn.id ? "bg-primary/20" : "bg-muted group-hover:bg-accent"
                )}>
                  <Wifi className="w-3.5 h-3.5 shrink-0" />
                </div>
                <span className="flex-1 truncate font-medium">{conn.alias || conn.host}</span>
                <button
                  onClick={(e) => handleDelete(e, conn.id)}
                  className="opacity-0 group-hover:opacity-100 hover:text-destructive transition-all p-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}

            <button
              onClick={() => setOpen(true)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-primary hover:bg-primary/10 transition-colors border border-dashed border-primary/20 mt-2"
            >
              <Plus className="w-4 h-4" />
              Add Connection
            </button>
          </div>
        </div>
      </nav>

      <div className="p-4 border-t border-black/5 dark:border-white/5 bg-black/5 dark:bg-white/5 flex flex-col gap-2">
        <div className="flex gap-2">
          <button
            onClick={onWishlistClick}
            className="flex-1 flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 transition-all border border-transparent"
            title="Wishlist"
          >
            <Star className="w-4 h-4" />
          </button>
          <button
            onClick={onSettingsClick}
            className="flex-1 flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 transition-all border border-transparent"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className="p-2.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 transition-all border border-transparent flex items-center justify-center"
            title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          >
            {theme === 'light' ? (
              <Moon className="w-4 h-4 text-slate-600" />
            ) : (
              <Sun className="w-4 h-4 text-yellow-400" />
            )}
          </button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add SMB Connection</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2 border-dashed"
                onClick={handleScan}
                disabled={isScanning}
              >
                {isScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Scan for local servers
              </Button>

              {discovered.length > 0 && (
                <div className="flex flex-wrap gap-2 p-2 rounded-md bg-accent/30 border border-white/5">
                  {discovered.map((s, idx) => (
                    <button
                      key={idx}
                      onClick={() => selectDiscovered(s)}
                      className="text-[10px] px-2 py-1 rounded bg-background border border-white/10 hover:border-primary/50 transition-colors"
                    >
                      {s.name || s.host}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <form onSubmit={handleCreate} className="space-y-3">
              <Input placeholder="Alias (e.g. NAS Home)" value={form.alias} onChange={(e) => setForm({ ...form, alias: e.target.value })} required />
              <Input placeholder="Host (e.g. 192.168.1.100)" value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} required />
              <Input placeholder="Port" type="number" value={form.port} onChange={(e) => setForm({ ...form, port: e.target.value })} required />

              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    placeholder="Share Name (e.g. backup)"
                    value={form.shareName}
                    onChange={(e) => setForm({ ...form, shareName: e.target.value })}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleScanShares}
                    disabled={isScanningShares}
                    className="shrink-0 gap-2"
                  >
                    {isScanningShares ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    Scan
                  </Button>
                </div>

                {availableShares.length > 0 && (
                  <div className="flex flex-wrap gap-2 p-2 rounded-md bg-accent/30 border border-white/5 animate-in fade-in slide-in-from-top-1">
                    {availableShares.map((name) => {
                      const selected = form.shareName.split(',').map(s => s.trim()).includes(name)
                      return (
                        <button
                          key={name}
                          type="button"
                          onClick={() => {
                            const current = form.shareName.split(',').map(s => s.trim()).filter(Boolean)
                            const next = selected
                              ? current.filter(s => s !== name)
                              : [...current, name]
                            setForm({ ...form, shareName: next.join(',') })
                          }}
                          className={cn(
                            "text-[10px] px-2 py-1 rounded border transition-all",
                            selected
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background border-white/10 hover:border-primary/50"
                          )}
                        >
                          {name}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              <Input placeholder="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
              <Input placeholder="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
              <Button type="submit" className="w-full" disabled={createConn.isPending}>
                {createConn.isPending ? 'Connecting...' : 'Add Connection'}
              </Button>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </aside>
  )
}
