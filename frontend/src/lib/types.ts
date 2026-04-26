export interface Connection {
  id: number
  alias: string
  host: string
  port: number
  shareName: string
  username: string
  createdAt: string
  updatedAt: string
}

export interface CreateConnectionDto {
  alias: string
  host: string
  port: number
  shareName: string
  username: string
  password: string
}

export interface UpdateConnectionDto {
  alias?: string
  host?: string
  port?: number
  shareName?: string
  username?: string
  password?: string
}

export interface FileInfo {
  name: string
  path: string
  size: number
  isDirectory: boolean
  modifiedAt: string
}

export interface WishlistItem {
  id: number
  connectionId: number
  connection: Connection
  path: string
  isDirectory: boolean
  fileName: string
  createdAt: string
}

export interface AddWishlistDto {
  connectionId: number
  path: string
  isDirectory: boolean
  fileName: string
}

export interface ScanSharesDto {
  host: string
  port: number
  username: string
  password: string
}

export interface ApiError {
  response?: {
    data?: {
      error?: string
    }
  }
}
