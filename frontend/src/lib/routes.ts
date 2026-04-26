// src/lib/routes.ts

/**
 * UI Application Routes
 * Use these constants instead of hardcoded strings for easier maintenance.
 */
export const ROUTES = {
  HOME: '/',
  CONNECT: '/connect',
  FILE: {
    // Base path for file explorer
    BASE: '/f',
    // Router match patterns
    MATCH_BASE: '/f/:alias',
    MATCH_ALL: '/f/:alias/*',
    // Route generator for navigation
    explorer: (alias: string, path: string = '') =>
      `/f/${alias}${path ? `/${path}` : ''}`,
  }
};

/**
 * Backend API Endpoints
 * Centralized list of all API routes for the frontend.
 */
export const API_ROUTES = {
  V1: {
    CONNECTIONS: {
      BASE: '/api/v1/connections',
      BY_ID: (id: number | string) => `/api/v1/connections/${id}`,
    },
    FS: {
      LIST: '/api/v1/fs/list',
      DOWNLOAD: '/api/v1/fs/download',
      UPLOAD: '/api/v1/fs/upload',
      DELETE: '/api/v1/fs/delete',
      MKDIR: '/api/v1/fs/mkdir',
      RENAME: '/api/v1/fs/rename',
    },
    WISHLIST: {
      BASE: '/api/v1/wishlist',
      BY_ID: (id: number | string) => `/api/v1/wishlist/${id}`,
    },
    DISCOVERY: {
      SCAN: '/api/v1/discovery/scan',
      SHARES: '/api/v1/discovery/shares',
    },
    WHITELIST: {
      BASE: '/api/v1/whitelist',
      BY_ID: (id: number | string) => `/api/v1/whitelist/${id}`,
    }
  }
};
