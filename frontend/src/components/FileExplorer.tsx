import React, { useCallback, useRef, useState } from 'react'
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
import { useFileList, useCreateFolder, useUploadFile } from '@/hooks/useFileSystem'
import { useToast } from '@/lib/toast-context'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { Connection, FileInfo, ApiError } from '@/lib/types'
import { cn } from '@/lib/utils'

interface Props {
  connection: Connection
}

export function FileExplorer({ connection }: Props) {
  const [path, setPath] = useState('')
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [mkdirOpen, setMkdirOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({})
  const [searchQuery, setSearchQuery] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const { data: files = [], isLoading, isError, error, refetch } = useFileList(connection.id, path)
  const apiError = error as ApiError | null
  const createFolder = useCreateFolder()
  const uploadFile = useUploadFile()

  const breadcrumbs = path ? path.split('/').filter(Boolean) : []

  const navigate = (newPath: string) => setPath(newPath)

  const handleFileClick = (file: FileInfo) => {
    if (file.isDirectory) navigate(file.path)
  }

  const handleBreadcrumb = (idx: number) => {
    if (idx < 0) {
      setPath('')
    } else {
      setPath(breadcrumbs.slice(0, idx + 1).join('/'))
    }
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

  return (
    <div
      className="flex flex-col h-full"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-white/10 glass-card">
        {/* Breadcrumbs */}
        <div className="flex items-center bg-white/5 rounded-full px-1 py-1 border border-white/10 max-w-2xl flex-1 overflow-hidden">
          <button
            onClick={() => handleBreadcrumb(-1)}
            className={cn(
              "p-2 rounded-full hover:bg-white/10 transition-colors shrink-0",
              !path ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Home className="w-4 h-4" />
          </button>

          <div className="flex items-center overflow-x-auto no-scrollbar scroll-smooth">
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={idx}>
                <ChevronRight className="w-3 h-3 text-white/20 shrink-0" />
                <button
                  onClick={() => handleBreadcrumb(idx)}
                  className="px-3 py-1 text-sm text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap rounded-full hover:bg-white/10"
                >
                  {crumb}
                </button>
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="relative w-64 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <input
            type="text"
            placeholder="Search in folder..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-10 pr-4 bg-white/5 rounded-xl border border-white/10 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-sm"
          />
        </div>

        <div className="flex items-center gap-2 border-l border-white/10 pl-4">
          <Button variant="ghost" size="icon" onClick={() => refetch()} title="Refresh" className="rounded-full">
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setMkdirOpen(true)} title="New Folder" className="rounded-full">
            <FolderPlus className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} title="Upload" className="rounded-full">
            <Upload className="w-4 h-4" />
          </Button>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileInput} />

          <div className="flex bg-white/5 rounded-xl border border-white/10 p-1 ml-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setViewMode('list')}
              className={cn("w-8 h-8 rounded-lg", viewMode === 'list' ? "bg-white/10 text-primary" : "text-muted-foreground")}
            >
              <List className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setViewMode('grid')}
              className={cn("w-8 h-8 rounded-lg", viewMode === 'grid' ? "bg-white/10 text-primary" : "text-muted-foreground")}
            >
              <Grid className="w-4 h-4" />
            </Button>
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
    </div>
  )
}
