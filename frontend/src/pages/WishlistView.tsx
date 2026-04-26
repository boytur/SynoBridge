import { File, Folder, Star, Trash2 } from 'lucide-react'
import { useWishlist, useRemoveFromWishlist } from '@/hooks/useWishlist'
import { useToast } from '@/lib/toast-context'
import { Skeleton } from '@/components/ui/skeleton'
import type { Connection } from '@/lib/types'

interface Props {
  onNavigate: (conn: Connection, path: string) => void
}

export function WishlistView({ onNavigate }: Props) {
  const { data: items = [], isLoading } = useWishlist()
  const remove = useRemoveFromWishlist()
  const { toast } = useToast()

  const handleRemove = async (id: number) => {
    try {
      await remove.mutateAsync(id)
      toast({ title: 'Removed from wishlist' })
    } catch {
      toast({ title: 'Failed to remove', variant: 'destructive' })
    }
  }

  // Group by connection
  const grouped = items.reduce<Record<string, typeof items>>((acc, item) => {
    const key = item.connection?.alias ?? String(item.connectionId)
    acc[key] = [...(acc[key] ?? []), item]
    return acc
  }, {})

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-white/10 glass flex items-center gap-2">
        <Star className="w-5 h-5 text-yellow-400" />
        <h2 className="text-lg font-semibold">Wishlist</h2>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {isLoading && (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        )}

        {!isLoading && items.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
            <Star className="w-12 h-12 opacity-30" />
            <p className="text-sm">No items in wishlist</p>
            <p className="text-xs">Right-click files to add them here</p>
          </div>
        )}

        {Object.entries(grouped).map(([alias, groupItems]) => (
          <div key={alias} className="mb-6">
            <h3 className="text-xs text-muted-foreground uppercase tracking-wider mb-2">{alias}</h3>
            <div className="space-y-1">
              {groupItems.map((item) => (
                <div
                  key={item.id}
                  className="group flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors"
                >
                  <button
                    className="flex items-center gap-3 flex-1 min-w-0 text-left"
                    onClick={() => item.connection && onNavigate(item.connection, item.path)}
                  >
                    {item.isDirectory ? (
                      <Folder className="w-4 h-4 text-yellow-400 shrink-0" />
                    ) : (
                      <File className="w-4 h-4 text-muted-foreground shrink-0" />
                    )}
                    <span className="text-sm truncate">{item.fileName}</span>
                    <span className="text-xs text-muted-foreground truncate hidden sm:block">{item.path}</span>
                  </button>
                  <button
                    onClick={() => handleRemove(item.id)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
