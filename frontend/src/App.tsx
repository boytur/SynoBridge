import { useState, useEffect } from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConnectionSidebar } from '@/components/ConnectionSidebar'
import { FileExplorer } from '@/components/FileExplorer'
import { WishlistView } from '@/pages/WishlistView'
import { SettingsView } from '@/pages/SettingsView'
import { QuickSetup } from '@/components/QuickSetup'
import { ToastContextProvider } from '@/lib/toast-context'
import { setAuthToken, api } from '@/lib/api'
import type { Connection } from '@/lib/types'
import { Loader2, ShieldAlert, RefreshCw } from 'lucide-react'
import { Button } from './components/ui/button'
import { useConnections } from '@/hooks/useConnections'
import type { DiscoveredServer } from '@/lib/api'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
})

function AppInner() {
  const { isLoading, isAuthenticated, loginWithRedirect, getAccessTokenSilently } = useAuth0()
  const [selectedConn, setSelectedConn] = useState<Connection | null>(null)
  const [showWishlist, setShowWishlist] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [tokenInitialized, setTokenInitialized] = useState(false)
  const [accessDenied, setAccessDenied] = useState(false)
  const [prefillServer, setPrefillServer] = useState<DiscoveredServer | null>(null)
  
  const { data: connections = [], isLoading: isConnsLoading } = useConnections()

  const devMode = !import.meta.env.VITE_AUTH0_DOMAIN

  // Inject token into API client
  useEffect(() => {
    if (isAuthenticated) {
      getAccessTokenSilently()
        .then((token) => {
          setAuthToken(token)
          setTokenInitialized(true)
        })
        .catch((err) => {
          console.error('Failed to get access token', err)
          setTokenInitialized(true) // Proceed anyway, API will fail with 401
        })
    } else if (devMode) {
      setTokenInitialized(true)
    }

    // Handle 403 errors globally
    const interceptor = api.interceptors.response.use(
      (res) => res,
      (err) => {
        if (err.response?.status === 403) {
          setAccessDenied(true)
        }
        return Promise.reject(err)
      }
    )
    return () => api.interceptors.response.eject(interceptor)
  }, [isAuthenticated, getAccessTokenSilently, devMode])

  if (!devMode && (isLoading || (isAuthenticated && !tokenInitialized))) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!devMode && !isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <h1 className="text-3xl font-bold">SynoBridge</h1>
        <p className="text-muted-foreground">Sign in to manage your SMB shares</p>
        <button
          onClick={() => loginWithRedirect()}
          className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          Sign In
        </button>
      </div>
    )
  }

  if (accessDenied) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-6 p-8 text-center animate-in fade-in zoom-in duration-300">
        <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center text-destructive border border-destructive/20 shadow-[0_0_30px_rgba(var(--destructive),0.1)]">
          <ShieldAlert className="w-10 h-10" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-white">Access Restricted</h1>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Your account is authenticated, but there was an issue verifying your permissions. 
            This usually happens if your email is not whitelisted or if the auth service is busy.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => window.location.reload()} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Retry
          </Button>
          <Button variant="ghost" onClick={() => loginWithRedirect()}>
            Sign in again
          </Button>
        </div>
      </div>
    )
  }

  const handleSelectConn = (conn: Connection) => {
    setSelectedConn(conn)
    setShowWishlist(false)
    setShowSettings(false)
  }

  const handleWishlistNavigate = (conn: Connection, _path: string) => {
    setSelectedConn(conn)
    setShowWishlist(false)
    setShowSettings(false)
  }

  const handleSettingsClick = () => {
    setShowSettings(true)
    setShowWishlist(false)
  }


  return (
    <div className="flex h-screen overflow-hidden">
      <ConnectionSidebar
        selectedId={selectedConn?.id ?? null}
        onSelect={handleSelectConn}
        onSettingsClick={handleSettingsClick}
        prefillServer={prefillServer}
        onPrefillClear={() => setPrefillServer(null)}
      />
      <main className="flex-1 overflow-hidden">
        {showSettings ? (
          <SettingsView />
        ) : showWishlist ? (
          <WishlistView onNavigate={handleWishlistNavigate} />
        ) : selectedConn ? (
          <FileExplorer connection={selectedConn} />
        ) : connections.length === 0 && !isConnsLoading ? (
          <QuickSetup onSetup={(s) => setPrefillServer(s)} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
            <p className="text-sm">Select a connection to browse files</p>
          </div>
        )}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastContextProvider>
        <AppInner />
      </ToastContextProvider>
    </QueryClientProvider>
  )
}
