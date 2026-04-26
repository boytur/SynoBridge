import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { connectionsApi } from '@/lib/api'
import type { CreateConnectionDto, UpdateConnectionDto } from '@/lib/types'

export function useConnections() {
  return useQuery({
    queryKey: ['connections'],
    queryFn: connectionsApi.getAll,
  })
}

export function useCreateConnection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: CreateConnectionDto) => connectionsApi.create(dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['connections'] }),
  })
}

export function useUpdateConnection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, dto }: { id: number; dto: UpdateConnectionDto }) =>
      connectionsApi.update(id, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['connections'] }),
  })
}

export function useDeleteConnection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => connectionsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['connections'] }),
  })
}
