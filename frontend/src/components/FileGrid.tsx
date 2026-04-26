import { File, Folder, Star } from 'lucide-react'
import { useWishlist } from '@/hooks/useWishlist'
import type { FileInfo } from '@/lib/types'
import { cn } from '@/lib/utils'

interface Props {
  files: FileInfo[]
  connectionId: number
  currentPath: string
  onNavigate: (file: FileInfo) => void
}

export function FileGrid({ files, connectionId, currentPath: _currentPath, onNavigate }: Props) {
  const { data: wishlist = [] } = useWishlist()

  const isWishlisted = (file: FileInfo) =>
    wishlist.some((w) => w.connectionId === connectionId && w.path === file.path)

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3 p-4">
      {files.map((file) => (
        <button
          key={file.path}
          onDoubleClick={() => onNavigate(file)}
          className={cn(
            'group flex flex-col items-center gap-2 p-3 rounded-lg border border-transparent hover:border-white/10 hover:bg-white/5 transition-all text-center'
          )}
        >
          <div className="relative">
            {file.isDirectory ? (
              <Folder className="w-12 h-12 text-yellow-400" />
            ) : (
              <File className="w-12 h-12 text-muted-foreground" />
            )}
            {isWishlisted(file) && (
              <Star className="absolute -top-1 -right-1 w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
            )}
          </div>
          <span className="text-xs text-foreground truncate w-full">{file.name}</span>
        </button>
      ))}
    </div>
  )
}
