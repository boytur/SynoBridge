import { File, Folder, Star, Image as ImageIcon } from 'lucide-react'
import { useWishlist } from '@/hooks/useWishlist'
import type { FileInfo } from '@/lib/types'
import { cn } from '@/lib/utils'
import { fileSystemApi } from '@/lib/api'

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
            ) : ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(file.name.split('.').pop()?.toLowerCase() || '') ? (
              <div className="w-12 h-12 rounded overflow-hidden bg-white/5 flex items-center justify-center">
                <img 
                  src={fileSystemApi.getFileUrl(connectionId, file.path)} 
                  alt="" 
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  loading="lazy"
                  onError={(e) => {
                    (e.currentTarget as any).style.display = 'none';
                    (e.currentTarget.parentElement as any).innerHTML = '<div class="text-muted-foreground/30"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg></div>'
                  }}
                />
              </div>
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
