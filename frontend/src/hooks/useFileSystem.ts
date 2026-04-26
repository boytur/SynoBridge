import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fileSystemApi } from '@/lib/api'

export function useFileList(connectionId: number | null, path: string) {
  return useQuery({
    queryKey: ['files', connectionId, path],
    queryFn: () => fileSystemApi.list(connectionId!, path),
    enabled: connectionId !== null,
  })
}

export function useUploadFile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      connectionId,
      path,
      file,
      onProgress,
    }: {
      connectionId: number
      path: string
      file: File
      onProgress?: (pct: number) => void
    }) => fileSystemApi.upload(connectionId, path, file, onProgress),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['files', vars.connectionId, vars.path] })
    },
  })
}

export function useDeleteFile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      connectionId,
      path,
      isDirectory,
    }: {
      connectionId: number
      path: string
      isDirectory: boolean
      parentPath: string
    }) => fileSystemApi.delete(connectionId, path, isDirectory),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['files', vars.connectionId, vars.parentPath] })
    },
  })
}

export function useRenameFile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      connectionId,
      oldPath,
      newPath,
    }: {
      connectionId: number
      oldPath: string
      newPath: string
      parentPath: string
    }) => fileSystemApi.rename(connectionId, oldPath, newPath),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['files', vars.connectionId, vars.parentPath] })
    },
  })
}

export function useCreateFolder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      connectionId,
      path,
      name,
    }: {
      connectionId: number
      path: string
      name: string
    }) => fileSystemApi.mkdir(connectionId, path, name),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['files', vars.connectionId, vars.path] })
    },
  })
}
