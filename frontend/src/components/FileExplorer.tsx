import React, { useCallback, useRef, useState, useEffect } from 'react'
import {
  ChevronRight,
  FolderPlus,
  Grid,
  Home,
  List,
  RefreshCw,
  Search,
  ShieldAlert,
  Upload,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { FileList } from './FileList'
import { FileGrid } from './FileGrid'
import { FilePreview } from './FilePreview'
import { useFileList, useCreateFolder, useUploadFile } from '@/hooks/useFileSystem'
import { useToast } from '@/lib/toast-context'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { Connection, FileInfo, ApiError } from '@/lib/types'
import { cn } from '@/lib/utils'

interface Props {
  connection: Connection
  initialPath?: string
  onPathChange?: (path: string) => void
}

export function FileExplorer({ connection, initialPath = '', onPathChange }: Props) {
  const [path, setPath] = useState(initialPath)
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [mkdirOpen, setMkdirOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [previewFile, setPreviewFile] = useState<FileInfo | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const { data: files = [], isLoading, isError, error, refetch } = useFileList(connection.id, path)
  const apiError = error as ApiError | null
  const createFolder = useCreateFolder()
  const uploadFile = useUploadFile()

  // Sync internal path with prop
  useEffect(() => {
    setPath(initialPath)
  }, [initialPath])

  const breadcrumbs = path ? path.split('/').filter(Boolean) : []

  const navigate = (newPath: string) => {
    setPath(newPath)
    onPathChange?.(newPath)
  }

  const handleFileClick = (file: FileInfo) => {
    if (file.isDirectory) navigate(file.path)
    else setPreviewFile(file)
  }

  const handleBreadcrumb = (idx: number) => {
    const newPath = idx < 0 ? '' : breadcrumbs.slice(0, idx + 1).join('/')
    navigate(newPath)
  }

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      const droppedFiles = Array.from(e.dataTransfer.files)
      for (const file of droppedFiles) {
        setUploadProgress((p) => ({ ...p, [file.name]: 0 }))
        try {
          await uploadFile.mutateAsync({
            connectionId: connection.id,
            path,
            file,
            onProgress: (pct) => setUploadProgress((p) => ({ ...p, [file.name]: pct })),
          })
          toast({ title: `Uploaded ${file.name}` })
        } catch {
          toast({ title: `Failed to upload ${file.name}`, variant: 'destructive' })
        } finally {
          setUploadProgress((p) => { const n = { ...p }; delete n[file.name]; return n })
        }
      }
    },
    [connection.id, path, uploadFile, toast]
  )

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? [])
    for (const file of selected) {
      setUploadProgress((p) => ({ ...p, [file.name]: 0 }))
      try {
        await uploadFile.mutateAsync({
          connectionId: connection.id,
          path,
          file,
          onProgress: (pct) => setUploadProgress((p) => ({ ...p, [file.name]: pct })),
        })
        toast({ title: `Uploaded ${file.name}` })
      } catch {
        toast({ title: `Failed to upload ${file.name}`, variant: 'destructive' })
      } finally {
        setUploadProgress((p) => { const n = { ...p }; delete n[file.name]; return n })
      }
    }
    e.target.value = ''
  }

  const filteredFiles = files.filter(file =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleMkdir = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createFolder.mutateAsync({ connectionId: connection.id, path, name: newFolderName })
      setMkdirOpen(false)
      setNewFolderName('')
      toast({ title: 'Folder created' })
    } catch {
      toast({ title: 'Failed to create folder', variant: 'destructive' })
    }
  }

  const breadcrumbRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (breadcrumbRef.current) {
      breadcrumbRef.current.scrollLeft = breadcrumbRef.current.scrollWidth
    }
  }, [path])

  return (
    <div
      className="flex flex-col h-full"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 px-4 sm:px-6 py-3 sm:py-4 border-b border-border/50 glass-card shrink-0">
        {/* Breadcrumbs */}
        <div className="flex items-center bg-muted/50 rounded-full px-1 py-1 border border-border/50 w-full sm:max-w-2xl sm:flex-1 overflow-hidden relative group/nav">
          <button
            onClick={() => handleBreadcrumb(-1)}
            className={cn(
              "p-2 rounded-full hover:bg-accent transition-all shrink-0 z-10",
              !path ? "text-primary bg-primary/10" : "text-muted-foreground"
            )}
          >
            <Home className="w-4 h-4" />
          </button>

          <div 
            ref={breadcrumbRef}
            className="flex items-center overflow-x-auto no-scrollbar scroll-smooth pr-10"
            style={{ 
              maskImage: 'linear-gradient(to right, white 80%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to right, white 80%, transparent 100%)'
            }}
          >
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={idx}>
                <ChevronRight className="w-3 h-3 text-muted-foreground/30 shrink-0" />
                <button
                  onClick={() => handleBreadcrumb(idx)}
                  className={cn(
                    "px-2 sm:px-3 py-1 text-xs sm:text-sm font-medium transition-all whitespace-nowrap rounded-full hover:bg-accent",
                    idx === breadcrumbs.length - 1 ? "text-foreground" : "text-muted-foreground/50 hover:text-foreground"
                  )}
                >
                  {crumb}
                </button>
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Search */}
          <div className="relative flex-1 sm:w-64 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 sm:h-10 pl-9 sm:pl-10 pr-4 bg-muted/50 rounded-xl border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all text-xs sm:text-sm text-foreground placeholder:text-muted-foreground/50"
            />
          </div>

          <div className="flex items-center gap-1 sm:gap-2 border-l border-border/50 pl-2 sm:pl-4">
            <Button variant="ghost" size="icon" onClick={() => refetch()} title="Refresh" className="w-8 h-8 sm:w-9 sm:h-9 rounded-full hover:bg-accent">
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setMkdirOpen(true)} title="New Folder" className="hidden sm:flex w-9 h-9 rounded-full hover:bg-accent">
              <FolderPlus className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} title="Upload" className="w-8 h-8 sm:w-9 sm:h-9 rounded-full hover:bg-accent">
              <Upload className="w-4 h-4" />
            </Button>
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileInput} />

            <div className="hidden xs:flex bg-muted/50 rounded-xl border border-border/50 p-1 ml-1 sm:ml-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setViewMode('list')}
                className={cn("w-7 h-7 sm:w-8 sm:h-8 rounded-lg", viewMode === 'list' ? "bg-accent text-primary shadow-sm" : "text-muted-foreground")}
              >
                <List className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setViewMode('grid')}
                className={cn("w-7 h-7 sm:w-8 sm:h-8 rounded-lg", viewMode === 'grid' ? "bg-accent text-primary shadow-sm" : "text-muted-foreground")}
              >
                <Grid className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Upload progress */}
      {Object.entries(uploadProgress).length > 0 && (
        <div className="px-4 py-2 space-y-1 border-b border-white/10 bg-muted/30">
          {Object.entries(uploadProgress).map(([name, pct]) => (
            <div key={name} className="flex items-center gap-2 text-xs">
              <span className="truncate flex-1 text-muted-foreground">{name}</span>
              <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-muted-foreground w-8 text-right">{pct}%</span>
            </div>
          ))}
        </div>
      )}

      {/* File content */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8 gap-4 animate-in fade-in zoom-in duration-300">
            <div className="p-4 rounded-full bg-destructive/10 text-destructive">
              <ShieldAlert className="w-10 h-10" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-white">Connection Error</h3>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                {apiError?.response?.data?.error || 'Failed to connect to SMB server.'}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Retry Connection
            </Button>
          </div>
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
            <FolderPlus className="w-12 h-12 opacity-30" />
            <p className="text-sm">This folder is empty</p>
            <p className="text-xs">Drop files here to upload</p>
          </div>
        ) : viewMode === 'list' ? (
          <FileList files={filteredFiles} connectionId={connection.id} currentPath={path} onNavigate={handleFileClick} />
        ) : (
          <FileGrid files={filteredFiles} connectionId={connection.id} currentPath={path} onNavigate={handleFileClick} />
        )}
      </div>

      <Dialog open={mkdirOpen} onOpenChange={setMkdirOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Folder</DialogTitle></DialogHeader>
          <form onSubmit={handleMkdir} className="space-y-3">
            <Input
              placeholder="Folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              autoFocus
              required
            />
            <Button type="submit" className="w-full" disabled={createFolder.isPending}>
              Create
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <FilePreview 
        file={previewFile} 
        connectionId={connection.id} 
        onClose={() => setPreviewFile(null)} 
      />
    </div>
  )
}
