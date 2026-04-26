# Design Document: OmniSMB Web Client

## Overview

OmniSMB is a full-stack web application that provides a modern, secure interface for managing SMB/Samba file shares. The system follows a client-server architecture with a React-based frontend communicating with a Golang backend that handles SMB protocol operations, authentication, and data persistence.

The design emphasizes:
- **Security**: Auth0 integration for authentication, AES-256 encryption for stored credentials
- **Performance**: Streaming file transfers without server-side caching, concurrent operations using goroutines
- **User Experience**: Synology DSM-inspired interface with glassmorphism design, optimistic UI updates
- **Maintainability**: Clean separation between frontend, backend, and data layers

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Browser                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  React Frontend (Vite + TypeScript)                │    │
│  │  - TanStack Query for state management             │    │
│  │  - Auth0 SPA SDK for authentication                │    │
│  │  - shadcn/ui + Tailwind for UI                     │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTPS / REST API
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Golang Backend (Gin)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │ Auth Handler │  │ SMB Handler  │  │ Wishlist Handler│  │
│  └──────────────┘  └──────────────┘  └─────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           Session Pool (In-Memory)                   │  │
│  │  - Active SMB connections keyed by user + connection │  │
│  │  - Thread-safe access with sync.RWMutex             │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           Repository Layer (GORM)                    │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                ┌───────────┴───────────┐
                ▼                       ▼
        ┌──────────────┐        ┌──────────────┐
        │   SQLite     │        │  SMB Servers │
        │  (Metadata)  │        │  (Network)   │
        └──────────────┘        └──────────────┘
```

### Component Interaction Flow

**File Listing Flow:**
1. User clicks on a connection in the sidebar
2. Frontend sends GET /api/v1/fs/list?id=1&path=/
3. Backend retrieves connection from database, decrypts credentials
4. Backend gets or creates SMB session from Session Pool
5. Backend lists directory contents via go-smb2
6. Backend returns JSON array of file metadata
7. Frontend renders files in File Explorer

**File Download/Stream Flow:**
1. User clicks download or plays media
2. Frontend sends GET /api/v1/fs/download?id=1&path=/file.mp4
3. Backend retrieves SMB session
4. Backend opens file handle on SMB share
5. Backend streams file using io.Copy directly to HTTP response
6. Browser receives and displays/downloads content

## Components and Interfaces

### Backend Components

#### 1. Auth Service (`internal/auth`)

**Responsibilities:**
- Validate Auth0 JWT tokens
- Manage user sessions
- Provide middleware for protected routes

**Key Functions:**
```go
// ValidateToken verifies the Auth0 JWT token
func ValidateToken(tokenString string) (*UserClaims, error)

// AuthMiddleware is Gin middleware that checks authentication
func AuthMiddleware() gin.HandlerFunc

// GetUserFromContext extracts user info from Gin context
func GetUserFromContext(c *gin.Context) (*UserClaims, error)
```

**Data Structures:**
```go
type UserClaims struct {
    Sub       string `json:"sub"`       // Auth0 user ID
    Email     string `json:"email"`
    ExpiresAt int64  `json:"exp"`
}
```

#### 2. SMB Client Wrapper (`internal/smb`)

**Responsibilities:**
- Manage SMB connection lifecycle
- Provide thread-safe session pooling
- Abstract go-smb2 library operations

**Key Functions:**
```go
// GetSession retrieves or creates an SMB session
func (p *SessionPool) GetSession(userID string, connID uint, config SMBConfig) (*smb2.Session, error)

// CloseSession terminates a specific SMB session
func (p *SessionPool) CloseSession(userID string, connID uint) error

// CloseAllUserSessions terminates all sessions for a user
func (p *SessionPool) CloseAllUserSessions(userID string) error

// ListDirectory returns files and folders in a path
func ListDirectory(session *smb2.Session, shareName, path string) ([]FileInfo, error)

// DownloadFile returns a reader for streaming file content
func DownloadFile(session *smb2.Session, shareName, path string) (io.ReadCloser, error)

// UploadFile writes data to SMB share
func UploadFile(session *smb2.Session, shareName, path string, reader io.Reader) error

// DeletePath removes a file or directory
func DeletePath(session *smb2.Session, shareName, path string, isDir bool) error

// CreateDirectory creates a new folder
func CreateDirectory(session *smb2.Session, shareName, path string) error

// Rename changes the name of a file or folder
func Rename(session *smb2.Session, shareName, oldPath, newPath string) error
```

**Data Structures:**
```go
type SessionPool struct {
    sessions map[string]*smb2.Session  // key: "userID:connID"
    mu       sync.RWMutex
}

type SMBConfig struct {
    Host      string
    Port      int
    ShareName string
    Username  string
    Password  string
}

type FileInfo struct {
    Name        string    `json:"name"`
    Path        string    `json:"path"`
    Size        int64     `json:"size"`
    IsDirectory bool      `json:"isDirectory"`
    ModifiedAt  time.Time `json:"modifiedAt"`
}
```

#### 3. Repository Layer (`internal/repository`)

**Responsibilities:**
- CRUD operations for SMB connections
- CRUD operations for wishlist items
- Password encryption/decryption
- Database migrations

**Key Functions:**
```go
// Connection Repository
func (r *ConnectionRepository) Create(conn *SMBConnection) error
func (r *ConnectionRepository) GetByID(id uint) (*SMBConnection, error)
func (r *ConnectionRepository) GetAll() ([]SMBConnection, error)
func (r *ConnectionRepository) Update(conn *SMBConnection) error
func (r *ConnectionRepository) Delete(id uint) error

// Wishlist Repository
func (r *WishlistRepository) Create(item *WishlistItem) error
func (r *WishlistRepository) GetAll() ([]WishlistItem, error)
func (r *WishlistRepository) Delete(id uint) error
func (r *WishlistRepository) GetByConnectionAndPath(connID uint, path string) (*WishlistItem, error)

// Encryption utilities
func EncryptPassword(plaintext string, key []byte) (string, error)
func DecryptPassword(ciphertext string, key []byte) (string, error)
```

**Data Models:**
```go
type SMBConnection struct {
    gorm.Model
    Alias     string `gorm:"unique;not null"`
    Host      string `gorm:"not null"`
    Port      int    `gorm:"not null"`
    ShareName string `gorm:"not null"`
    Username  string `gorm:"not null"`
    Password  string `gorm:"not null"` // AES-256 encrypted
}

type WishlistItem struct {
    gorm.Model
    ConnectionID uint          `gorm:"not null;index"`
    Connection   SMBConnection `gorm:"foreignKey:ConnectionID;constraint:OnDelete:CASCADE"`
    Path         string        `gorm:"not null"`
    IsDirectory  bool          `gorm:"not null"`
    FileName     string        `gorm:"not null"`
}
```

#### 4. HTTP Handlers (`internal/handler`)

**Responsibilities:**
- Handle HTTP requests and responses
- Validate request parameters
- Coordinate between services
- Return appropriate status codes and error messages

**API Endpoints:**

```go
// Auth endpoints
POST   /api/v1/auth/callback    // Handle Auth0 callback

// Connection endpoints
GET    /api/v1/connections       // List all connections
POST   /api/v1/connections       // Create new connection
PUT    /api/v1/connections/:id   // Update connection
DELETE /api/v1/connections/:id   // Delete connection
GET    /api/v1/connections/:id/health // Check connection health

// File system endpoints
GET    /api/v1/fs/list           // List directory contents
                                 // Query params: id (connection), path
GET    /api/v1/fs/download       // Download/stream file
                                 // Query params: id, path
POST   /api/v1/fs/upload         // Upload file (multipart)
                                 // Form data: id, path, file
DELETE /api/v1/fs/delete         // Delete file/folder
                                 // Body: {id, path, isDirectory}
POST   /api/v1/fs/mkdir          // Create directory
                                 // Body: {id, path, name}
PUT    /api/v1/fs/rename         // Rename file/folder
                                 // Body: {id, oldPath, newPath}

// Wishlist endpoints
GET    /api/v1/wishlist          // Get all wishlist items
POST   /api/v1/wishlist          // Add item to wishlist
                                 // Body: {connectionId, path, isDirectory, fileName}
DELETE /api/v1/wishlist/:id      // Remove from wishlist
```

### Frontend Components

#### 1. Authentication (`src/lib/auth`)

**Responsibilities:**
- Initialize Auth0 client
- Handle login/logout flows
- Provide authentication context to React components

**Key Components:**
```typescript
// Auth0 configuration
const auth0Config = {
  domain: import.meta.env.VITE_AUTH0_DOMAIN,
  clientId: import.meta.env.VITE_AUTH0_CLIENT_ID,
  authorizationParams: {
    redirect_uri: window.location.origin,
    audience: import.meta.env.VITE_AUTH0_AUDIENCE,
  },
};

// Auth context provider
export const AuthProvider: React.FC<{children: React.ReactNode}>

// Custom hooks
export const useAuth = () => useContext(AuthContext)
```

#### 2. API Client (`src/lib/api`)

**Responsibilities:**
- Centralize API calls
- Add authentication headers
- Handle errors consistently

**Key Functions:**
```typescript
// Connection API
export const connectionsApi = {
  getAll: () => Promise<Connection[]>,
  create: (data: CreateConnectionDto) => Promise<Connection>,
  update: (id: number, data: UpdateConnectionDto) => Promise<Connection>,
  delete: (id: number) => Promise<void>,
  checkHealth: (id: number) => Promise<{healthy: boolean}>,
}

// File system API
export const fileSystemApi = {
  list: (connectionId: number, path: string) => Promise<FileInfo[]>,
  download: (connectionId: number, path: string) => void, // Triggers download
  upload: (connectionId: number, path: string, files: FileList) => Promise<void>,
  delete: (connectionId: number, path: string, isDirectory: boolean) => Promise<void>,
  mkdir: (connectionId: number, path: string, name: string) => Promise<void>,
  rename: (connectionId: number, oldPath: string, newPath: string) => Promise<void>,
}

// Wishlist API
export const wishlistApi = {
  getAll: () => Promise<WishlistItem[]>,
  add: (data: AddWishlistDto) => Promise<WishlistItem>,
  remove: (id: number) => Promise<void>,
}
```

#### 3. TanStack Query Hooks (`src/hooks`)

**Responsibilities:**
- Manage server state
- Handle caching and refetching
- Provide loading and error states

**Key Hooks:**
```typescript
// Connection hooks
export const useConnections = () => useQuery({
  queryKey: ['connections'],
  queryFn: connectionsApi.getAll,
})

export const useCreateConnection = () => useMutation({
  mutationFn: connectionsApi.create,
  onSuccess: () => queryClient.invalidateQueries(['connections']),
})

// File system hooks
export const useFileList = (connectionId: number, path: string) => useQuery({
  queryKey: ['files', connectionId, path],
  queryFn: () => fileSystemApi.list(connectionId, path),
  enabled: !!connectionId,
})

export const useUploadFile = () => useMutation({
  mutationFn: ({connectionId, path, files}: UploadParams) => 
    fileSystemApi.upload(connectionId, path, files),
  onSuccess: (_, variables) => {
    queryClient.invalidateQueries(['files', variables.connectionId, variables.path])
  },
})

// Wishlist hooks
export const useWishlist = () => useQuery({
  queryKey: ['wishlist'],
  queryFn: wishlistApi.getAll,
})

export const useAddToWishlist = () => useMutation({
  mutationFn: wishlistApi.add,
  onMutate: async (newItem) => {
    // Optimistic update
    await queryClient.cancelQueries(['wishlist'])
    const previous = queryClient.getQueryData(['wishlist'])
    queryClient.setQueryData(['wishlist'], (old: WishlistItem[]) => [...old, newItem])
    return { previous }
  },
  onError: (err, newItem, context) => {
    queryClient.setQueryData(['wishlist'], context.previous)
  },
  onSettled: () => {
    queryClient.invalidateQueries(['wishlist'])
  },
})
```

#### 4. UI Components (`src/components`)

**Key Components:**

**ConnectionSidebar:**
- Displays list of saved connections
- Shows connection status indicators
- Allows adding new connections
- Provides navigation to wishlist view

**FileExplorer:**
- Main file browsing interface
- Breadcrumb navigation
- Toggle between list and grid views
- Drag-and-drop upload zone
- Context menu for file operations
- Skeleton loading states

**FileList:**
- Renders files in list view with columns (name, size, modified date)
- Sortable columns
- Selection checkboxes for bulk operations

**FileGrid:**
- Renders files in grid view with thumbnails
- Shows file type icons
- Displays file names below icons

**ContextMenu:**
- Right-click menu for file operations
- Options: Download, Rename, Delete, Add to Wishlist
- Conditional options based on file type

**WishlistView:**
- Displays all starred items
- Groups items by connection
- Allows navigation to item location
- Provides remove from wishlist action

**UploadProgress:**
- Shows upload progress for multiple files
- Displays file names and progress bars
- Allows canceling uploads

## Data Models

### Database Schema

**SMBConnection Table:**
```sql
CREATE TABLE smb_connections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at DATETIME,
    updated_at DATETIME,
    deleted_at DATETIME,
    alias TEXT UNIQUE NOT NULL,
    host TEXT NOT NULL,
    port INTEGER NOT NULL,
    share_name TEXT NOT NULL,
    username TEXT NOT NULL,
    password TEXT NOT NULL  -- AES-256 encrypted
);

CREATE INDEX idx_smb_connections_deleted_at ON smb_connections(deleted_at);
```

**WishlistItem Table:**
```sql
CREATE TABLE wishlist_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at DATETIME,
    updated_at DATETIME,
    deleted_at DATETIME,
    connection_id INTEGER NOT NULL,
    path TEXT NOT NULL,
    is_directory BOOLEAN NOT NULL,
    file_name TEXT NOT NULL,
    FOREIGN KEY (connection_id) REFERENCES smb_connections(id) ON DELETE CASCADE
);

CREATE INDEX idx_wishlist_items_deleted_at ON wishlist_items(deleted_at);
CREATE INDEX idx_wishlist_items_connection_id ON wishlist_items(connection_id);
```

### API Data Transfer Objects

**Connection DTOs:**
```typescript
interface Connection {
  id: number
  alias: string
  host: string
  port: number
  shareName: string
  username: string
  createdAt: string
  updatedAt: string
}

interface CreateConnectionDto {
  alias: string
  host: string
  port: number
  shareName: string
  username: string
  password: string
}

interface UpdateConnectionDto {
  alias?: string
  host?: string
  port?: number
  shareName?: string
  username?: string
  password?: string
}
```

**File System DTOs:**
```typescript
interface FileInfo {
  name: string
  path: string
  size: number
  isDirectory: boolean
  modifiedAt: string
}

interface UploadRequest {
  connectionId: number
  path: string
  file: File
}

interface DeleteRequest {
  connectionId: number
  path: string
  isDirectory: boolean
}

interface MkdirRequest {
  connectionId: number
  path: string
  name: string
}

interface RenameRequest {
  connectionId: number
  oldPath: string
  newPath: string
}
```

**Wishlist DTOs:**
```typescript
interface WishlistItem {
  id: number
  connectionId: number
  connectionAlias: string
  path: string
  isDirectory: boolean
  fileName: string
  createdAt: string
}

interface AddWishlistDto {
  connectionId: number
  path: string
  isDirectory: boolean
  fileName: string
}
```

### Session Pool Data Structure

```go
type SessionPool struct {
    sessions map[string]*SessionEntry
    mu       sync.RWMutex
}

type SessionEntry struct {
    Session    *smb2.Session
    Share      *smb2.Share
    LastAccess time.Time
    Config     SMBConfig
}

// Session key format: "userID:connectionID"
func sessionKey(userID string, connID uint) string {
    return fmt.Sprintf("%s:%d", userID, connID)
}
```

## Correctness Properties


*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Password Encryption Round-Trip

*For any* plaintext password, encrypting it with AES-256 and then decrypting the result should produce the original password.

**Validates: Requirements 1.2**

### Property 2: Unique Connection Aliases

*For any* set of SMB connections in the database, no two connections should have the same alias value.

**Validates: Requirements 1.5**

### Property 3: Connection Deletion Cleanup

*For any* SMB connection, after deletion, the connection should not be retrievable from the database and any active sessions for that connection should be terminated.

**Validates: Requirements 1.6**

### Property 4: Token Validation Correctness

*For any* JWT token, the authentication middleware should accept valid tokens and reject invalid or expired tokens with appropriate error responses.

**Validates: Requirements 2.2, 2.3**

### Property 5: File Metadata Completeness

*For any* directory listing response, each file or folder entry should contain all required metadata fields: name, path, size, isDirectory, and modifiedAt.

**Validates: Requirements 3.2**

### Property 6: Breadcrumb Path Consistency

*For any* navigation path in the file explorer, the breadcrumb components should accurately represent the current directory path from root to the current location.

**Validates: Requirements 3.3**

### Property 7: Upload Persistence

*For any* file successfully uploaded to an SMB share, querying the directory listing should include that file with correct metadata.

**Validates: Requirements 4.4**

### Property 8: Download Streaming Correctness

*For any* file on an SMB share, the content streamed to the client should be byte-for-byte identical to the source file.

**Validates: Requirements 5.1**

### Property 9: HTTP Range Request Support

*For any* file and any valid byte range, requesting that range should return exactly the specified bytes from the file.

**Validates: Requirements 5.4**

### Property 10: File Operation Consistency

*For any* file operation (rename, delete, create folder), the subsequent directory listing should reflect the operation's effect: renamed items appear with new names, deleted items are absent, and new folders are present.

**Validates: Requirements 6.1, 6.2, 6.3**

### Property 11: Wishlist CRUD Consistency

*For any* file or folder, after adding it to the wishlist, it should appear in wishlist queries; after removing it, it should not appear in wishlist queries.

**Validates: Requirements 7.1, 7.2, 7.3**

### Property 12: Session Pool Reuse

*For any* user and connection, multiple sequential requests to the same SMB share should reuse the same session rather than creating new sessions.

**Validates: Requirements 8.2**

### Property 13: Session Cleanup on Logout

*For any* user, after logout, no SMB sessions should remain in the session pool for that user.

**Validates: Requirements 8.4**

### Property 14: Concurrent Session Access Safety

*For any* set of concurrent requests to the session pool, all operations should complete without race conditions or data corruption.

**Validates: Requirements 8.5**

### Property 15: File Display Information Completeness

*For any* file rendered in the file explorer, the displayed information should include the file icon, name, size, and modification date.

**Validates: Requirements 9.3**

### Property 16: Error Logging Consistency

*For any* error that occurs in the system, a corresponding log entry should be created with sufficient detail for debugging.

**Validates: Requirements 10.6**

### Property 17: Connection Persistence Round-Trip

*For any* SMB connection configuration, saving it to the database and then loading it should produce an equivalent connection object (with password correctly encrypted/decrypted).

**Validates: Requirements 11.1**

### Property 18: Wishlist Foreign Key Integrity

*For any* wishlist item, it should always reference a valid connection that exists in the database.

**Validates: Requirements 11.2**

### Property 19: Cascade Deletion of Wishlist Items

*For any* connection with associated wishlist items, deleting the connection should automatically remove all wishlist items that reference it.

**Validates: Requirements 11.4**

### Property 20: API Endpoint Path Convention

*For all* API endpoints, the path should follow the /api/v1 prefix convention.

**Validates: Requirements 12.1**

### Property 21: HTTP Status Code Correctness

*For any* API request, successful operations should return 2xx status codes and failed operations should return appropriate error status codes (400, 401, 404, 500) based on the error type.

**Validates: Requirements 12.2, 12.3**

### Property 22: JSON Content Type Consistency

*For any* API endpoint, requests should accept JSON payloads and responses should return JSON-formatted data with appropriate Content-Type headers.

**Validates: Requirements 12.4**

### Property 23: Request Parameter Validation

*For any* API request with invalid parameters, the API should return a 400 Bad Request status with error details describing the validation failure.

**Validates: Requirements 12.5**

## Error Handling

### Backend Error Handling Strategy

**SMB Connection Errors:**
- Connection timeout: Return 504 Gateway Timeout with message "Unable to connect to SMB server"
- Authentication failure: Return 401 Unauthorized with message "Invalid SMB credentials"
- Share not found: Return 404 Not Found with message "SMB share not found"
- Network errors: Return 503 Service Unavailable with message "Network error accessing SMB server"

**File Operation Errors:**
- File not found: Return 404 Not Found with message "File or directory not found"
- Permission denied: Return 403 Forbidden with message "Insufficient permissions for this operation"
- Disk full: Return 507 Insufficient Storage with message "Not enough space on SMB share"
- Invalid path: Return 400 Bad Request with message "Invalid file path"

**Database Errors:**
- Unique constraint violation: Return 409 Conflict with message "Connection alias already exists"
- Foreign key violation: Return 400 Bad Request with message "Referenced connection does not exist"
- Database unavailable: Return 503 Service Unavailable with message "Database temporarily unavailable"

**Authentication Errors:**
- Missing token: Return 401 Unauthorized with message "Authentication required"
- Invalid token: Return 401 Unauthorized with message "Invalid authentication token"
- Expired token: Return 401 Unauthorized with message "Authentication token expired"

**Validation Errors:**
- Missing required fields: Return 400 Bad Request with message listing missing fields
- Invalid field values: Return 400 Bad Request with message describing validation rules
- Invalid file upload: Return 400 Bad Request with message "Invalid file upload"

### Frontend Error Handling Strategy

**Error Display:**
- Use toast notifications for transient errors (network failures, operation failures)
- Use modal dialogs for critical errors requiring user action
- Use inline error messages for form validation errors

**Error Recovery:**
- Automatic retry with exponential backoff for network errors
- Manual retry buttons for failed operations
- Clear error messages with suggested actions

**Error Boundaries:**
- React error boundaries to catch component errors
- Fallback UI for crashed components
- Error reporting to logging service

### Logging Strategy

**Backend Logging Levels:**
- ERROR: Failed operations, exceptions, critical issues
- WARN: Deprecated API usage, performance issues, recoverable errors
- INFO: Successful operations, connection events, user actions
- DEBUG: Detailed operation traces, variable values (development only)

**Log Format:**
```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "ERROR",
  "message": "Failed to connect to SMB server",
  "context": {
    "userId": "auth0|123456",
    "connectionId": 5,
    "host": "192.168.1.100",
    "error": "connection timeout"
  }
}
```

**Frontend Logging:**
- Console errors for development
- Error tracking service (e.g., Sentry) for production
- User action tracking for analytics

## Testing Strategy

### Dual Testing Approach

The testing strategy employs both unit tests and property-based tests to ensure comprehensive coverage:

**Unit Tests:**
- Specific examples demonstrating correct behavior
- Edge cases (empty directories, special characters in filenames, large files)
- Error conditions (network failures, invalid inputs, permission errors)
- Integration points between components
- Mock external dependencies (SMB servers, Auth0, database)

**Property-Based Tests:**
- Universal properties that hold for all inputs
- Comprehensive input coverage through randomization
- Minimum 100 iterations per property test
- Each test references its design document property

### Property-Based Testing Configuration

**Library Selection:**
- **Golang Backend**: Use [gopter](https://github.com/leanovate/gopter) for property-based testing
- **TypeScript Frontend**: Use [fast-check](https://github.com/dubzzz/fast-check) for property-based testing

**Test Configuration:**
```go
// Golang example
properties := gopter.NewProperties(gopter.DefaultTestParameters())
properties.Property("Password encryption round-trip", prop.ForAll(
    func(password string) bool {
        encrypted, _ := EncryptPassword(password, key)
        decrypted, _ := DecryptPassword(encrypted, key)
        return password == decrypted
    },
    gen.AnyString(),
))
properties.TestingRun(t, gopter.ConsoleReporter(t))
```

```typescript
// TypeScript example
test('File metadata completeness', () => {
  fc.assert(
    fc.property(fc.array(fc.record({
      name: fc.string(),
      path: fc.string(),
      size: fc.nat(),
      isDirectory: fc.boolean(),
      modifiedAt: fc.date(),
    })), (files) => {
      // Test that all files have required fields
      return files.every(f => 
        f.name && f.path && typeof f.size === 'number' && 
        typeof f.isDirectory === 'boolean' && f.modifiedAt
      )
    }),
    { numRuns: 100 }
  )
})
```

**Test Tagging Convention:**
Each property-based test must include a comment tag referencing the design property:
```go
// Feature: omnismb-web-client, Property 1: Password encryption round-trip
func TestPasswordEncryptionRoundTrip(t *testing.T) { ... }
```

```typescript
// Feature: omnismb-web-client, Property 5: File metadata completeness
test('File metadata completeness', () => { ... })
```

### Test Organization

**Backend Tests:**
```
backend/
├── internal/
│   ├── auth/
│   │   ├── auth_test.go           # Unit tests
│   │   └── auth_property_test.go  # Property tests
│   ├── smb/
│   │   ├── session_test.go
│   │   ├── session_property_test.go
│   │   ├── operations_test.go
│   │   └── operations_property_test.go
│   ├── repository/
│   │   ├── connection_test.go
│   │   ├── connection_property_test.go
│   │   ├── wishlist_test.go
│   │   └── wishlist_property_test.go
│   └── handler/
│       ├── handler_test.go
│       └── handler_property_test.go
```

**Frontend Tests:**
```
frontend/
├── src/
│   ├── components/
│   │   ├── FileExplorer.test.tsx
│   │   ├── FileExplorer.property.test.tsx
│   │   ├── ConnectionSidebar.test.tsx
│   │   └── WishlistView.test.tsx
│   ├── hooks/
│   │   ├── useConnections.test.ts
│   │   └── useFileList.test.ts
│   └── lib/
│       ├── api.test.ts
│       └── api.property.test.ts
```

### Test Coverage Goals

**Backend:**
- Unit test coverage: >80% of code paths
- Property test coverage: All 23 correctness properties
- Integration tests: All API endpoints
- Error path coverage: All error handling branches

**Frontend:**
- Component test coverage: All user-facing components
- Hook test coverage: All TanStack Query hooks
- Property test coverage: UI-testable properties (5, 6, 11, 15)
- Integration tests: Critical user flows (connect, browse, upload, download, wishlist)

### Testing Best Practices

**Unit Testing:**
- Use table-driven tests for multiple scenarios
- Mock external dependencies (SMB, Auth0, database)
- Test both success and failure paths
- Use descriptive test names

**Property Testing:**
- Generate realistic test data (valid file paths, reasonable file sizes)
- Use shrinking to find minimal failing cases
- Test invariants that should always hold
- Avoid testing implementation details

**Integration Testing:**
- Use test containers for database tests
- Mock SMB servers for file operation tests
- Test complete request/response cycles
- Verify side effects (database changes, session state)

### Continuous Integration

**CI Pipeline:**
1. Run linters (golangci-lint, ESLint)
2. Run unit tests with coverage reporting
3. Run property-based tests (100 iterations minimum)
4. Run integration tests
5. Build Docker images
6. Run security scans

**Quality Gates:**
- All tests must pass
- Code coverage must not decrease
- No critical security vulnerabilities
- No linting errors

## Security Considerations

### Password Encryption

**Implementation:**
- Use AES-256-GCM for authenticated encryption
- Generate unique IV for each encryption operation
- Derive encryption key from environment variable using PBKDF2
- Store IV with ciphertext (IV is not secret)

**Key Management:**
- Store master encryption key in environment variable
- Never log or expose encryption keys
- Rotate keys periodically (provide migration tool)

### Session Security

**Backend Sessions:**
- Store SMB sessions in memory only (never persist credentials)
- Associate sessions with authenticated user IDs
- Implement session timeout (30 minutes idle)
- Clear sessions on logout

**Frontend Sessions:**
- Use Auth0 SPA SDK for secure token management
- Store tokens in memory (not localStorage)
- Implement token refresh before expiration
- Clear tokens on logout

### API Security

**Authentication:**
- Require valid Auth0 JWT for all API endpoints
- Validate token signature and expiration
- Extract user ID from token claims
- Implement rate limiting per user

**Authorization:**
- Users can only access their own connections
- Validate connection ownership before operations
- Prevent path traversal attacks in file paths
- Sanitize user inputs

### Input Validation

**Backend Validation:**
- Validate all request parameters
- Sanitize file paths (prevent ../ attacks)
- Limit file upload sizes
- Validate connection parameters (host, port ranges)

**Frontend Validation:**
- Validate form inputs before submission
- Sanitize user-provided content
- Prevent XSS attacks in file names
- Validate file types for uploads

## Performance Optimizations

### Backend Optimizations

**Session Pooling:**
- Reuse SMB connections for same user/connection
- Implement connection pooling with max pool size
- Close idle connections after timeout
- Use read-write locks for concurrent access

**Streaming:**
- Use io.Copy for zero-copy file transfers
- Stream files directly without buffering
- Support HTTP range requests for large files
- Implement chunked transfer encoding

**Concurrency:**
- Use goroutines for bulk operations
- Implement worker pools for file operations
- Use channels for coordination
- Limit concurrent operations per user

**Database:**
- Use prepared statements
- Implement connection pooling
- Add indexes on foreign keys
- Use transactions for multi-step operations

### Frontend Optimizations

**State Management:**
- Use TanStack Query for automatic caching
- Implement optimistic updates for wishlist
- Debounce search and filter operations
- Prefetch data for likely navigation

**Rendering:**
- Virtualize long file lists
- Lazy load thumbnails
- Use React.memo for expensive components
- Implement skeleton loading states

**Network:**
- Batch API requests where possible
- Implement request deduplication
- Use HTTP/2 for multiplexing
- Compress API responses

## Deployment Architecture

### Docker Compose Setup

```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "8080:8080"
    environment:
      - AUTH0_DOMAIN=${AUTH0_DOMAIN}
      - AUTH0_AUDIENCE=${AUTH0_AUDIENCE}
      - ENCRYPTION_KEY=${ENCRYPTION_KEY}
      - DATABASE_PATH=/data/omnismb.db
    volumes:
      - ./data:/data
    depends_on:
      - db

  frontend:
    build: ./frontend
    ports:
      - "3000:80"
    environment:
      - VITE_API_URL=http://localhost:8080
      - VITE_AUTH0_DOMAIN=${AUTH0_DOMAIN}
      - VITE_AUTH0_CLIENT_ID=${AUTH0_CLIENT_ID}
      - VITE_AUTH0_AUDIENCE=${AUTH0_AUDIENCE}
    depends_on:
      - backend

volumes:
  data:
```

### Environment Variables

**Backend:**
- `AUTH0_DOMAIN`: Auth0 tenant domain
- `AUTH0_AUDIENCE`: API identifier in Auth0
- `ENCRYPTION_KEY`: Master key for password encryption
- `DATABASE_PATH`: Path to SQLite database file
- `SESSION_TIMEOUT`: SMB session timeout (default: 30m)
- `LOG_LEVEL`: Logging level (default: info)

**Frontend:**
- `VITE_API_URL`: Backend API base URL
- `VITE_AUTH0_DOMAIN`: Auth0 tenant domain
- `VITE_AUTH0_CLIENT_ID`: Auth0 application client ID
- `VITE_AUTH0_AUDIENCE`: API identifier in Auth0

### Production Considerations

**Scalability:**
- Backend is stateful (session pool) - use sticky sessions if scaling horizontally
- Consider Redis for shared session storage in multi-instance deployments
- Database is SQLite - consider PostgreSQL for production at scale

**Monitoring:**
- Implement health check endpoints
- Monitor session pool size and memory usage
- Track API response times
- Alert on error rates

**Backup:**
- Regular SQLite database backups
- Backup encryption key securely
- Document recovery procedures

**Security:**
- Use HTTPS in production
- Implement rate limiting
- Enable CORS only for trusted origins
- Regular security updates for dependencies
