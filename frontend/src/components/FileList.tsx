import { useState } from 'react'
import { File, Folder, MoreVertical, Star, Download, Pencil, Trash2 } from 'lucide-react'
import { formatBytes, formatDate } from '@/lib/utils'
import { fileSystemApi } from '@/lib/api'
import { useDeleteFile, useRenameFile } from '@/hooks/useFileSystem'
import { useAddToWishlist, useWishlist } from '@/hooks/useWishlist'
import { useToast } from '@/lib/toast-context'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import type { FileInfo } from '@/lib/types'
import * as ContextMenu from '@radix-ui/react-context-menu'

interface Props {
  files: FileInfo[]
  connectionId: number
  currentPath: string
  onNavigate: (file: FileInfo) => void
}

export function FileList({ files, connectionId, currentPath, onNavigate }: Props) {
  const { data: wishlist = [] } = useWishlist()
  const addToWishlist = useAddToWishlist()
  const deleteFile = useDeleteFile()
  const renameFile = useRenameFile()
  const { toast } = useToast()
  const [renameTarget, setRenameTarget] = useState<FileInfo | null>(null)
  const [newName, setNewName] = useState('')

  const isWishlisted = (file: FileInfo) =>
    wishlist.some((w) => w.connectionId === connectionId && w.path === file.path)

  const handleAddWishlist = async (file: FileInfo) => {
    try {
      await addToWishlist.mutateAsync({
        connectionId,
        path: file.path,
        isDirectory: file.isDirectory,
        fileName: file.name,
      })
      toast({ title: `Added "${file.name}" to wishlist` })
    } catch {
      toast({ title: 'Failed to add to wishlist', variant: 'destructive' })
    }
  }

  const handleDelete = async (file: FileInfo) => {
    try {
      await deleteFile.mutateAsync({
        connectionId,
        path: file.path,
        isDirectory: file.isDirectory,
        parentPath: currentPath,
      })
      toast({ title: `Deleted "${file.name}"` })
    } catch {
      toast({ title: 'Failed to delete', variant: 'destructive' })
    }
  }

  const openRename = (file: FileInfo) => {
    setRenameTarget(file)
    setNewName(file.name)
  }

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!renameTarget) return
    const parentDir = currentPath
    const newPath = parentDir ? `${parentDir}/${newName}` : newName
    try {
      await renameFile.mutateAsync({
        connectionId,
        oldPath: renameTarget.path,
        newPath,
        parentPath: currentPath,
      })
      setRenameTarget(null)
      toast({ title: 'Renamed successfully' })
    } catch {
      toast({ title: 'Failed to rename', variant: 'destructive' })
    }
  }

  return (
    <>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 text-muted-foreground text-xs">
            <th className="text-left px-4 py-2 font-medium">Name</th>
            <th className="text-right px-4 py-2 font-medium">Size</th>
            <th className="text-right px-4 py-2 font-medium">Modified</th>
            <th className="w-8" />
          </tr>
        </thead>
        <tbody>
          {files.map((file) => (
            <ContextMenu.Root key={file.path}>
              <ContextMenu.Trigger asChild>
                <tr
                  onDoubleClick={() => onNavigate(file)}
                  className="border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors group"
                >
                  <td className="px-4 py-2.5 flex items-center gap-2">
                    {file.isDirectory ? (
                      <Folder className="w-4 h-4 text-yellow-400 shrink-0" />
                    ) : (
                      <File className="w-4 h-4 text-muted-foreground shrink-0" />
                    )}
                    <span className="truncate">{file.name}</span>
                    {isWishlisted(file) && <Star className="w-3 h-3 text-yellow-400 fill-yellow-400 shrink-0" />}
                  </td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground">
                    {file.isDirectory ? '—' : formatBytes(file.size)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground whitespace-nowrap">
                    {formatDate(file.modifiedAt)}
                  </td>
                  <td className="px-2">
                    <MoreVertical className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
                  </td>
                </tr>
              </ContextMenu.Trigger>
              <ContextMenu.Portal>
                <ContextMenu.Content className="z-50 min-w-[160px] rounded-md border border-white/10 bg-card p-1 shadow-xl text-sm">
                  {!file.isDirectory && (
                    <ContextMenu.Item
                      className="flex items-center gap-2 px-3 py-1.5 rounded cursor-pointer hover:bg-accent outline-none"
                      onSelect={() => fileSystemApi.download(connectionId, file.path)}
                    >
                      <Download className="w-3.5 h-3.5" /> Download
                    </ContextMenu.Item>
                  )}
                  <ContextMenu.Item
                    className="flex items-center gap-2 px-3 py-1.5 rounded cursor-pointer hover:bg-accent outline-none"
                    onSelect={() => handleAddWishlist(file)}
                  >
                    <Star className="w-3.5 h-3.5" /> Add to Wishlist
                  </ContextMenu.Item>
                  <ContextMenu.Item
                    className="flex items-center gap-2 px-3 py-1.5 rounded cursor-pointer hover:bg-accent outline-none"
                    onSelect={() => openRename(file)}
                  >
                    <Pencil className="w-3.5 h-3.5" /> Rename
                  </ContextMenu.Item>
                  <ContextMenu.Separator className="my-1 h-px bg-white/10" />
                  <ContextMenu.Item
                    className="flex items-center gap-2 px-3 py-1.5 rounded cursor-pointer hover:bg-destructive/20 text-destructive outline-none"
                    onSelect={() => handleDelete(file)}
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </ContextMenu.Item>
                </ContextMenu.Content>
              </ContextMenu.Portal>
            </ContextMenu.Root>
          ))}
        </tbody>
      </table>

      <Dialog open={!!renameTarget} onOpenChange={(o) => !o && setRenameTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rename</DialogTitle></DialogHeader>
          <form onSubmit={handleRename} className="space-y-3">
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus required />
            <Button type="submit" className="w-full" disabled={renameFile.isPending}>Rename</Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
