import { useState, useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route, useNavigate, useParams } from 'react-router-dom'
import { ConnectionSidebar } from '@/components/ConnectionSidebar'
import { FileExplorer } from '@/components/FileExplorer'
import { WishlistView } from '@/pages/WishlistView'
import { SettingsView } from '@/pages/SettingsView'
import { QuickSetup } from '@/components/QuickSetup'
import { ToastContextProvider } from '@/lib/toast-context'
import { setAuthToken, api } from '@/lib/api'
import { Loader2, ShieldAlert, RefreshCw, Menu } from 'lucide-react'
import { useConnections } from '@/hooks/useConnections'
import { cn } from '@/lib/utils'
import { useBridgeHandshake, BridgeLinkingOverlay } from './components/BridgeLinking'
import { ROUTES } from '@/lib/routes'
import { useAuth, isAuthEnabled } from './components/AuthProvider'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
})

function AppInner() {
  const navigate = useNavigate()
  const { alias, '*': path } = useParams()
  const { isLoading, isAuthenticated, loginWithRedirect, getAccessTokenSilently } = useAuth()
  const [showWishlist, setShowWishlist] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [tokenInitialized, setTokenInitialized] = useState(false)
  const [accessDenied, setAccessDenied] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'dark'
  })
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  
  const { data: connections = [] } = useConnections()
  const selectedConn = connections.find(c => c.alias === alias) || null

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
          setTokenInitialized(true)
        })
    } else if (!isAuthEnabled) {
      setTokenInitialized(true)
    }

    const interceptor = api.interceptors.response.use(
      (res) => res,
      (err) => {
        if (err.response?.status === 403) setAccessDenied(true)
        return Promise.reject(err)
      }
    )
    return () => api.interceptors.response.eject(interceptor)
  }, [isAuthenticated, getAccessTokenSilently])

  // Theme support
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('theme', theme)
  }, [theme])

  // Bridge Handshake logic (Modular)
  const { status: bridgeStatus, error: bridgeError, reset: resetBridge } = useBridgeHandshake(
    tokenInitialized,
    isAuthenticated,
    (conn) => navigate(ROUTES.FILE.explorer(conn.alias))
  )

  if (isLoading || (isAuthenticated && !tokenInitialized)) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!isAuthenticated && isAuthEnabled()) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 bg-background text-foreground">
        <h1 className="text-3xl font-bold">SynoBridge</h1>
        <button onClick={() => loginWithRedirect()} className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors">
          Sign In
        </button>
      </div>
    )
  }

  if (accessDenied) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-6 p-8 text-center bg-background">
        <ShieldAlert className="w-16 h-16 text-destructive" />
        <h2 className="text-2xl font-bold">Access Denied</h2>
        <p className="text-muted-foreground max-w-md">Your account does not have permission to access SynoBridge.</p>
        <button onClick={() => window.location.reload()} className="flex items-center gap-2 px-4 py-2 bg-secondary rounded-md hover:bg-secondary/80">
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground relative">
      <BridgeLinkingOverlay status={bridgeStatus} error={bridgeError} onReset={resetBridge} />

      {isMobileSidebarOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsMobileSidebarOpen(false)} />
      )}

      <div className={cn(
        "fixed lg:static inset-y-0 left-0 z-50 transform lg:transform-none transition-transform duration-300 ease-in-out",
        isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <ConnectionSidebar
          selectedId={selectedConn?.id ?? null}
          onSelect={(conn) => {
            navigate(ROUTES.FILE.explorer(conn.alias))
            setIsMobileSidebarOpen(false)
            setShowWishlist(false)
            setShowSettings(false)
          }}
          onWishlistClick={() => {
            setShowWishlist(true)
            setShowSettings(false)
            setIsMobileSidebarOpen(false)
          }}
          onSettingsClick={() => {
            setShowSettings(true)
            setShowWishlist(false)
            setIsMobileSidebarOpen(false)
          }}
          theme={theme}
          setTheme={setTheme}
        />
      </div>

      <main className="flex-1 flex flex-col min-w-0 relative h-full">
        <header className="h-14 border-b flex items-center px-4 shrink-0 bg-background/80 backdrop-blur-md sticky top-0 z-10">
          <button onClick={() => setIsMobileSidebarOpen(true)} className="p-2 -ml-2 mr-2 lg:hidden hover:bg-secondary rounded-md transition-colors">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold truncate">
              {showSettings ? 'Settings' : showWishlist ? 'Wishlist' : selectedConn?.alias || 'SynoBridge'}
            </h1>
          </div>
        </header>

        <div className="flex-1 overflow-hidden">
          {showSettings ? (
            <SettingsView open={true} onClose={() => setShowSettings(false)} theme={theme} setTheme={setTheme} />
          ) : showWishlist ? (
            <WishlistView onNavigate={(conn, p) => {
              navigate(ROUTES.FILE.explorer(conn.alias, p))
              setShowWishlist(false)
            }} />
          ) : selectedConn ? (
            <FileExplorer 
              key={selectedConn.id} 
              connection={selectedConn} 
              initialPath={path || ''}
              onPathChange={(newPath) => navigate(ROUTES.FILE.explorer(selectedConn.alias, newPath))}
            />
          ) : connections.length === 0 ? (
            <QuickSetup onSetup={() => {}} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
              <p className="text-sm">Select a connection to browse files</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastContextProvider>
        <BrowserRouter>
          <Routes>
            <Route path={ROUTES.HOME} element={<AppInner />} />
            <Route path={ROUTES.CONNECT} element={<AppInner />} />
            <Route path={ROUTES.FILE.MATCH_BASE} element={<AppInner />} />
            <Route path={ROUTES.FILE.MATCH_ALL} element={<AppInner />} />
          </Routes>
        </BrowserRouter>
      </ToastContextProvider>
    </QueryClientProvider>
  )
}
