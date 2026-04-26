import axios from 'axios'
import type {
  Connection,
  CreateConnectionDto,
  UpdateConnectionDto,
  FileInfo,
  WishlistItem,
  AddWishlistDto,
  ScanSharesDto,
} from './types'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '',
})

// Inject auth token from Auth0
export function setAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`
  } else {
    delete api.defaults.headers.common['Authorization']
  }
}

// Connections
export const connectionsApi = {
  getAll: async (): Promise<Connection[]> => {
    const { data } = await api.get('/api/v1/connections')
    return data
  },
  create: async (dto: CreateConnectionDto): Promise<Connection> => {
    const { data } = await api.post('/api/v1/connections', dto)
    return data
  },
  update: async (id: number, dto: UpdateConnectionDto): Promise<void> => {
    await api.put(`/api/v1/connections/${id}`, dto)
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/v1/connections/${id}`)
  },
}

// File system
export const fileSystemApi = {
  list: async (connectionId: number, path: string): Promise<FileInfo[]> => {
    const { data } = await api.get('/api/v1/fs/list', {
      params: { id: connectionId, path },
    })
    return data ?? []
  },
  download: (connectionId: number, path: string) => {
    const token = api.defaults.headers.common['Authorization']
    const url = `${api.defaults.baseURL}/api/v1/fs/download?id=${connectionId}&path=${encodeURIComponent(path)}`
    // Open in new tab to trigger browser download
    const a = document.createElement('a')
    a.href = url
    if (token) {
      // For authenticated downloads, use fetch + blob
      fetch(url, { headers: { Authorization: token as string } })
        .then((r) => r.blob())
        .then((blob) => {
          const blobUrl = URL.createObjectURL(blob)
          a.href = blobUrl
          a.download = path.split('/').pop() ?? 'download'
          a.click()
          URL.revokeObjectURL(blobUrl)
        })
    } else {
      a.download = path.split('/').pop() ?? 'download'
      a.click()
    }
  },
  upload: async (connectionId: number, path: string, file: File, onProgress?: (pct: number) => void): Promise<void> => {
    const form = new FormData()
    form.append('id', String(connectionId))
    form.append('path', path)
    form.append('file', file)
    await api.post('/api/v1/fs/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (onProgress && e.total) {
          onProgress(Math.round((e.loaded * 100) / e.total))
        }
      },
    })
  },
  delete: async (connectionId: number, path: string, isDirectory: boolean): Promise<void> => {
    await api.delete('/api/v1/fs/delete', {
      data: { id: connectionId, path, isDirectory },
    })
  },
  mkdir: async (connectionId: number, path: string, name: string): Promise<void> => {
    await api.post('/api/v1/fs/mkdir', { id: connectionId, path, name })
  },
  rename: async (connectionId: number, oldPath: string, newPath: string): Promise<void> => {
    await api.put('/api/v1/fs/rename', { id: connectionId, oldPath, newPath })
  },
}

// Wishlist
export const wishlistApi = {
  getAll: async (): Promise<WishlistItem[]> => {
    const { data } = await api.get('/api/v1/wishlist')
    return data ?? []
  },
  add: async (dto: AddWishlistDto): Promise<WishlistItem> => {
    const { data } = await api.post('/api/v1/wishlist', dto)
    return data
  },
  remove: async (id: number): Promise<void> => {
    await api.delete(`/api/v1/wishlist/${id}`)
  },
}

// Discovery
export interface DiscoveredServer {
  name: string
  host: string
  ips: string[]
  port: number
}

export const discoveryApi = {
  scan: async (): Promise<DiscoveredServer[]> => {
    const { data } = await api.get('/api/v1/discovery/scan')
    return data ?? []
  },
  scanShares: async (dto: ScanSharesDto): Promise<string[]> => {
    const { data } = await api.post('/api/v1/discovery/shares', dto)
    return data ?? []
  },
}

// Whitelist
export interface WhitelistedEmail {
  ID: number
  Email: string
}

export const whitelistApi = {
  getAll: async (): Promise<WhitelistedEmail[]> => {
    const { data } = await api.get('/api/v1/whitelist')
    return data ?? []
  },
  add: async (email: string): Promise<void> => {
    await api.post('/api/v1/whitelist', { email })
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/v1/whitelist/${id}`)
  },
}
