# Implementation Plan: OmniSMB Web Client

## Overview

This implementation plan breaks down the OmniSMB web client into discrete coding tasks. The approach follows an incremental development strategy: backend infrastructure first, then core SMB functionality, followed by frontend components, and finally integration and testing. Each task builds on previous work to ensure continuous validation.

## Tasks

- [x] 1. Set up project structure and development environment
  - Create backend directory structure (cmd/api, internal/auth, internal/smb, internal/handler, internal/repository)
  - Create frontend directory structure (src/components, src/hooks, src/pages, src/lib)
  - Set up Go modules and install dependencies (gin, gorm, go-smb2, jwt-go)
  - Set up Vite React project with TypeScript, install dependencies (react-query, auth0-spa-js, tailwindcss, shadcn/ui)
  - Create Dockerfile for backend and frontend
  - Create docker-compose.yml for development environment
  - Create Makefile with common commands (build, test, run, clean)
  - _Requirements: Infrastructure setup_

- [ ] 2. Implement database models and repository layer
  - [ ] 2.1 Create GORM models for SMBConnection and WishlistItem
    - Define struct fields with GORM tags
    - Set up foreign key relationships and cascade delete
    - _Requirements: 11.1, 11.2_
  
  - [ ] 2.2 Implement password encryption/decryption utilities
    - Create AES-256-GCM encryption function
    - Create decryption function with IV handling
    - Generate encryption key from environment variable using PBKDF2
    - _Requirements: 1.2_
  
  - [ ]* 2.3 Write property test for password encryption round-trip
    - **Property 1: Password Encryption Round-Trip**
    - **Validates: Requirements 1.2**
  
  - [ ] 2.4 Implement ConnectionRepository with CRUD operations
    - Create, GetByID, GetAll, Update, Delete methods
    - Encrypt passwords before saving, decrypt when retrieving
    - Handle unique alias constraint
    - _Requirements: 1.1, 1.2, 1.5, 11.1_
  
  - [ ]* 2.5 Write property tests for ConnectionRepository
    - **Property 2: Unique Connection Aliases**
    - **Property 17: Connection Persistence Round-Trip**
    - **Validates: Requirements 1.5, 11.1**
  
  - [ ] 2.6 Implement WishlistRepository with CRUD operations
    - Create, GetAll, Delete, GetByConnectionAndPath methods
    - Handle foreign key relationships
    - _Requirements: 7.1, 7.2, 7.3, 11.2_
  
  - [ ]* 2.7 Write property tests for WishlistRepository
    - **Property 18: Wishlist Foreign Key Integrity**
    - **Property 19: Cascade Deletion of Wishlist Items**
    - **Validates: Requirements 11.2, 11.4**
  
  - [ ] 2.8 Set up database initialization and migrations
    - Create database connection function
    - Implement auto-migration for models
    - _Requirements: 11.1_

- [ ] 3. Implement SMB client wrapper and session pool
  - [ ] 3.1 Create SessionPool with thread-safe map
    - Define SessionPool struct with sync.RWMutex
    - Implement session key generation (userID:connectionID)
    - Create SessionEntry struct with session, share, last access time
    - _Requirements: 8.1, 8.5_
  
  - [ ] 3.2 Implement GetSession method with connection reuse
    - Check if session exists in pool
    - Create new SMB connection if needed
    - Update last access time
    - Handle connection errors
    - _Requirements: 8.1, 8.2_
  
  - [ ]* 3.3 Write property tests for session pool
    - **Property 12: Session Pool Reuse**
    - **Property 14: Concurrent Session Access Safety**
    - **Validates: Requirements 8.2, 8.5**
  
  - [ ] 3.4 Implement session cleanup methods
    - CloseSession for single session
    - CloseAllUserSessions for logout
    - Background goroutine for idle session timeout
    - _Requirements: 8.3, 8.4_
  
  - [ ]* 3.5 Write property test for session cleanup
    - **Property 13: Session Cleanup on Logout**
    - **Validates: Requirements 8.4**
  
  - [ ] 3.6 Implement SMB file operations
    - ListDirectory: return FileInfo array with metadata
    - DownloadFile: return io.ReadCloser for streaming
    - UploadFile: accept io.Reader and write to SMB
    - DeletePath: handle files and directories
    - CreateDirectory: create new folder
    - Rename: change file/folder name
    - _Requirements: 3.2, 4.4, 5.1, 6.1, 6.2, 6.3_
  
  - [ ]* 3.7 Write property tests for file operations
    - **Property 10: File Operation Consistency**
    - **Validates: Requirements 6.1, 6.2, 6.3**

- [ ] 4. Checkpoint - Ensure backend core functionality works
  - Run all backend tests
  - Verify database operations work correctly
  - Verify SMB operations work with test SMB server
  - Ask the user if questions arise

- [ ] 5. Implement Auth0 authentication service
  - [ ] 5.1 Create Auth0 JWT validation function
    - Parse and validate JWT tokens
    - Verify signature and expiration
    - Extract user claims (sub, email)
    - _Requirements: 2.2, 2.3_
  
  - [ ] 5.2 Implement authentication middleware
    - Extract token from Authorization header
    - Validate token and add user to context
    - Return 401 for missing/invalid tokens
    - _Requirements: 2.1, 2.3_
  
  - [ ]* 5.3 Write property test for token validation
    - **Property 4: Token Validation Correctness**
    - **Validates: Requirements 2.2, 2.3**
  
  - [ ] 5.4 Create helper functions
    - GetUserFromContext to extract user info
    - Token refresh handling
    - _Requirements: 2.3_

- [ ] 6. Implement HTTP handlers for connections API
  - [ ] 6.1 Create connection handlers
    - POST /api/v1/connections - create new connection
    - GET /api/v1/connections - list all connections
    - PUT /api/v1/connections/:id - update connection
    - DELETE /api/v1/connections/:id - delete connection
    - GET /api/v1/connections/:id/health - health check
    - _Requirements: 1.1, 1.4, 1.6, 12.1, 12.2, 12.3_
  
  - [ ] 6.2 Implement request validation
    - Validate required fields
    - Validate port ranges
    - Return 400 for invalid inputs
    - _Requirements: 12.5_
  
  - [ ]* 6.3 Write property tests for connection API
    - **Property 3: Connection Deletion Cleanup**
    - **Property 20: API Endpoint Path Convention**
    - **Property 21: HTTP Status Code Correctness**
    - **Property 23: Request Parameter Validation**
    - **Validates: Requirements 1.6, 12.1, 12.2, 12.3, 12.5**
  
  - [ ]* 6.4 Write unit tests for connection handlers
    - Test successful connection creation
    - Test duplicate alias rejection
    - Test connection health check
    - Test connection deletion
    - _Requirements: 1.1, 1.4, 1.5, 1.6_

- [ ] 7. Implement HTTP handlers for file system API
  - [ ] 7.1 Create file system handlers
    - GET /api/v1/fs/list - list directory contents
    - GET /api/v1/fs/download - stream file download
    - POST /api/v1/fs/upload - multipart file upload
    - DELETE /api/v1/fs/delete - delete file/folder
    - POST /api/v1/fs/mkdir - create directory
    - PUT /api/v1/fs/rename - rename file/folder
    - _Requirements: 3.1, 4.1, 4.2, 5.1, 6.1, 6.2, 6.3, 12.1_
  
  - [ ] 7.2 Implement streaming download with io.Copy
    - Open file from SMB share
    - Stream directly to HTTP response
    - Support HTTP range requests for partial content
    - Set appropriate Content-Type headers
    - _Requirements: 5.1, 5.4_
  
  - [ ]* 7.3 Write property tests for file system API
    - **Property 5: File Metadata Completeness**
    - **Property 7: Upload Persistence**
    - **Property 8: Download Streaming Correctness**
    - **Property 9: HTTP Range Request Support**
    - **Validates: Requirements 3.2, 4.4, 5.1, 5.4**
  
  - [ ] 7.3 Implement multipart upload handler
    - Parse multipart form data
    - Stream file to SMB share
    - Return success/error response
    - _Requirements: 4.4_
  
  - [ ]* 7.4 Write unit tests for file system handlers
    - Test directory listing
    - Test file upload and download
    - Test file operations (rename, delete, mkdir)
    - Test error cases (file not found, permission denied)
    - _Requirements: 3.1, 4.4, 5.1, 6.1, 6.2, 6.3_

- [ ] 8. Implement HTTP handlers for wishlist API
  - [ ] 8.1 Create wishlist handlers
    - GET /api/v1/wishlist - get all wishlist items
    - POST /api/v1/wishlist - add item to wishlist
    - DELETE /api/v1/wishlist/:id - remove from wishlist
    - _Requirements: 7.1, 7.2, 7.3, 12.1_
  
  - [ ]* 8.2 Write property test for wishlist API
    - **Property 11: Wishlist CRUD Consistency**
    - **Validates: Requirements 7.1, 7.2, 7.3**
  
  - [ ]* 8.3 Write unit tests for wishlist handlers
    - Test adding items to wishlist
    - Test retrieving wishlist
    - Test removing items
    - _Requirements: 7.1, 7.2, 7.3_

- [ ] 9. Set up backend server and middleware
  - [ ] 9.1 Create main.go entry point
    - Initialize database connection
    - Create session pool
    - Set up Gin router
    - Register all routes with authentication middleware
    - Start HTTP server
    - _Requirements: 12.1_
  
  - [ ] 9.2 Configure CORS middleware
    - Allow configured frontend origin
    - Set appropriate CORS headers
    - _Requirements: 12.6_
  
  - [ ] 9.3 Add error handling middleware
    - Catch panics and return 500
    - Log errors with context
    - Return JSON error responses
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.6_
  
  - [ ]* 9.4 Write property test for error logging
    - **Property 16: Error Logging Consistency**
    - **Validates: Requirements 10.6**

- [ ] 10. Checkpoint - Ensure backend API is complete
  - Run all backend tests
  - Test API endpoints with curl or Postman
  - Verify authentication works
  - Verify file operations work with test SMB server
  - Ask the user if questions arise

- [ ] 11. Set up frontend project and authentication
  - [ ] 11.1 Configure Auth0 SPA SDK
    - Create auth configuration with domain, client ID, audience
    - Implement AuthProvider component
    - Create useAuth hook
    - _Requirements: 2.1, 2.2_
  
  - [ ] 11.2 Create API client utilities
    - Set up axios or fetch with base URL
    - Add authentication token to requests
    - Handle 401 responses and redirect to login
    - _Requirements: 2.3_
  
  - [ ] 11.3 Set up TanStack Query
    - Create QueryClient with configuration
    - Wrap app with QueryClientProvider
    - Configure default options (retry, stale time)
    - _Requirements: State management_

- [ ] 12. Implement connection management UI
  - [ ] 12.1 Create ConnectionSidebar component
    - Display list of connections from useConnections hook
    - Show connection status indicators
    - Add button to open connection form
    - Handle connection selection
    - _Requirements: 9.1_
  
  - [ ] 12.2 Create ConnectionForm component
    - Form fields for alias, host, port, share, username, password
    - Form validation
    - Submit handler using useCreateConnection hook
    - _Requirements: 1.1_
  
  - [ ] 12.3 Implement connection hooks
    - useConnections for fetching connections
    - useCreateConnection for adding connections
    - useUpdateConnection for editing connections
    - useDeleteConnection for removing connections
    - useConnectionHealth for health checks
    - _Requirements: 1.1, 1.4, 1.6_
  
  - [ ]* 12.4 Write unit tests for connection components
    - Test ConnectionSidebar renders connections
    - Test ConnectionForm validation
    - Test connection CRUD operations
    - _Requirements: 1.1, 1.4, 1.6_

- [ ] 13. Implement file explorer UI
  - [ ] 13.1 Create FileExplorer component
    - Layout with sidebar and main content area
    - Breadcrumb navigation component
    - View mode toggle (list/grid)
    - Drag-and-drop upload zone
    - _Requirements: 3.1, 3.3, 3.4, 4.1, 9.1_
  
  - [ ] 13.2 Create Breadcrumb component
    - Display path segments as clickable links
    - Handle navigation to parent directories
    - _Requirements: 3.3_
  
  - [ ]* 13.3 Write property test for breadcrumb consistency
    - **Property 6: Breadcrumb Path Consistency**
    - **Validates: Requirements 3.3**
  
  - [ ] 13.4 Create FileList component
    - Table view with columns (name, size, modified date)
    - Sortable columns
    - Row selection
    - Context menu trigger
    - _Requirements: 3.2, 9.3_
  
  - [ ] 13.5 Create FileGrid component
    - Grid layout with file cards
    - File type icons
    - File names and metadata
    - _Requirements: 3.4_
  
  - [ ]* 13.6 Write property test for file display
    - **Property 15: File Display Information Completeness**
    - **Validates: Requirements 9.3**
  
  - [ ] 13.7 Implement file list hooks
    - useFileList for fetching directory contents
    - Handle loading and error states
    - Refetch on path change
    - _Requirements: 3.1, 3.2_
  
  - [ ]* 13.8 Write unit tests for file explorer components
    - Test FileExplorer layout and navigation
    - Test FileList rendering and sorting
    - Test FileGrid rendering
    - Test view mode toggle
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 14. Implement file operations UI
  - [ ] 14.1 Create ContextMenu component
    - Right-click menu with options
    - Download, Rename, Delete, Add to Wishlist actions
    - Conditional options based on file type
    - _Requirements: 6.6_
  
  - [ ] 14.2 Create file operation dialogs
    - RenameDialog with input field
    - DeleteConfirmDialog
    - CreateFolderDialog
    - _Requirements: 6.1, 6.2, 6.3_
  
  - [ ] 14.3 Implement file operation hooks
    - useUploadFile for file uploads
    - useDownloadFile for downloads
    - useDeleteFile for deletions
    - useRenameFile for renames
    - useCreateFolder for new folders
    - _Requirements: 4.1, 4.2, 5.1, 6.1, 6.2, 6.3_
  
  - [ ] 14.4 Create UploadProgress component
    - Display upload progress for multiple files
    - Show file names and progress bars
    - Cancel button for uploads
    - _Requirements: 4.3_
  
  - [ ]* 14.5 Write unit tests for file operations
    - Test context menu rendering
    - Test file operation dialogs
    - Test upload progress display
    - _Requirements: 4.1, 4.2, 6.1, 6.2, 6.3_

- [ ] 15. Implement wishlist UI
  - [ ] 15.1 Create WishlistView component
    - Display all wishlist items
    - Group items by connection
    - Navigation to item location
    - Remove from wishlist button
    - _Requirements: 7.2, 7.4_
  
  - [ ] 15.2 Implement wishlist hooks
    - useWishlist for fetching wishlist items
    - useAddToWishlist with optimistic updates
    - useRemoveFromWishlist
    - _Requirements: 7.1, 7.2, 7.3, 7.5_
  
  - [ ] 15.3 Add wishlist indicators to file explorer
    - Star icon for wishlisted items
    - Toggle wishlist status on click
    - _Requirements: 7.6_
  
  - [ ]* 15.4 Write unit tests for wishlist components
    - Test WishlistView rendering
    - Test wishlist item grouping
    - Test add/remove from wishlist
    - Test optimistic updates
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [ ] 16. Implement UI styling and polish
  - [ ] 16.1 Apply Tailwind CSS styling
    - Set up Tailwind configuration
    - Apply glassmorphism effects (backdrop-blur)
    - Style all components with Tailwind classes
    - _Requirements: 9.2_
  
  - [ ] 16.2 Integrate shadcn/ui components
    - Install and configure shadcn/ui
    - Use Button, Dialog, Input, Table components
    - Use Skeleton for loading states
    - Use Toast for notifications
    - _Requirements: 3.5, 9.5_
  
  - [ ] 16.3 Add Lucide icons
    - Install lucide-react
    - Add icons for files, folders, actions
    - _Requirements: 9.3_
  
  - [ ] 16.4 Implement responsive design
    - Test on desktop and tablet sizes
    - Adjust layouts for different screen sizes
    - _Requirements: 9.6_

- [ ] 17. Implement error handling and user feedback
  - [ ] 17.1 Create error boundary component
    - Catch React errors
    - Display fallback UI
    - Log errors
    - _Requirements: 10.5_
  
  - [ ] 17.2 Add toast notifications
    - Success messages for operations
    - Error messages for failures
    - Use shadcn/ui Toast component
    - _Requirements: 10.5_
  
  - [ ] 17.3 Add loading states
    - Skeleton loaders for file lists
    - Spinner for operations
    - Disable buttons during operations
    - _Requirements: 3.5_
  
  - [ ] 17.4 Implement error retry logic
    - Automatic retry for network errors
    - Manual retry buttons for failed operations
    - _Requirements: 10.5_

- [ ] 18. Checkpoint - Ensure frontend is complete
  - Run all frontend tests
  - Test all user flows manually
  - Verify authentication works
  - Verify all file operations work
  - Verify wishlist functionality
  - Ask the user if questions arise

- [ ] 19. Integration and end-to-end testing
  - [ ]* 19.1 Write integration tests for critical flows
    - Test complete connection flow (add, browse, delete)
    - Test file upload and download flow
    - Test wishlist flow (add, view, remove)
    - Test authentication flow
    - _Requirements: All requirements_
  
  - [ ] 19.2 Test with real SMB server
    - Set up test SMB server (Samba)
    - Test all file operations
    - Test error scenarios (permissions, network issues)
    - _Requirements: All SMB-related requirements_
  
  - [ ] 19.3 Performance testing
    - Test with large directories (1000+ files)
    - Test large file uploads/downloads
    - Monitor memory usage
    - _Requirements: Performance goals_

- [ ] 20. Documentation and deployment preparation
  - [ ] 20.1 Create README.md
    - Project overview
    - Setup instructions
    - Environment variables
    - Running with Docker Compose
  
  - [ ] 20.2 Create API documentation
    - Document all endpoints
    - Request/response examples
    - Error codes
  
  - [ ] 20.3 Create deployment guide
    - Production environment setup
    - Security considerations
    - Backup procedures
  
  - [ ] 20.4 Add code comments
    - Document complex functions
    - Add package documentation
    - Document configuration options

- [ ] 21. Final checkpoint - Complete system validation
  - Run all tests (unit, property, integration)
  - Verify all requirements are met
  - Test deployment with Docker Compose
  - Review security considerations
  - Ask the user if questions arise

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The implementation follows a backend-first approach to establish the API contract early
