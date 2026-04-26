import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { wishlistApi } from '@/lib/api'
import type { AddWishlistDto, WishlistItem } from '@/lib/types'

export function useWishlist() {
  return useQuery({
    queryKey: ['wishlist'],
    queryFn: wishlistApi.getAll,
  })
}

export function useAddToWishlist() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: AddWishlistDto) => wishlistApi.add(dto),
    onMutate: async (dto) => {
      await qc.cancelQueries({ queryKey: ['wishlist'] })
      const previous = qc.getQueryData<WishlistItem[]>(['wishlist'])
      // Optimistic update
      qc.setQueryData<WishlistItem[]>(['wishlist'], (old) => [
        ...(old ?? []),
        {
          id: Date.now(),
          connectionId: dto.connectionId,
          connection: {} as never,
          path: dto.path,
          isDirectory: dto.isDirectory,
          fileName: dto.fileName,
          createdAt: new Date().toISOString(),
        },
      ])
      return { previous }
    },
    onError: (_err, _dto, ctx) => {
      if (ctx?.previous) {
        qc.setQueryData(['wishlist'], ctx.previous)
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['wishlist'] })
    },
  })
}

export function useRemoveFromWishlist() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => wishlistApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wishlist'] }),
  })
}
