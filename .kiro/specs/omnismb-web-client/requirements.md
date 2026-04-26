# Requirements Document: OmniSMB Web Client

## Introduction

OmniSMB is a web-based SMB/Samba client manager inspired by Synology DSM. The system enables users to connect to multiple SMB shares, manage files through a modern web interface, and maintain a wishlist of frequently accessed files and folders across different servers. The application provides secure authentication, encrypted credential storage, and efficient file streaming capabilities.

## Glossary

- **SMB_Manager**: The backend system component responsible for managing SMB connections and operations
- **File_Explorer**: The frontend component providing the file browsing interface
- **Wishlist_System**: The component managing user-starred files and folders
- **Auth_Service**: The authentication and authorization service using Auth0
- **Connection_Store**: The SQLite database storing SMB connection configurations
- **Session_Pool**: The in-memory storage of active SMB sessions
- **Stream_Handler**: The component responsible for streaming files without full disk caching

## Requirements

### Requirement 1: SMB Connection Management

**User Story:** As a user, I want to manage multiple SMB server connections, so that I can access files from different network shares.

#### Acceptance Criteria

1. WHEN a user adds a new SMB connection, THE SMB_Manager SHALL validate the connection parameters (host, port, share name, username, password)
2. WHEN a user saves SMB credentials, THE Connection_Store SHALL encrypt the password using AES-256 before storing it in SQLite
3. WHEN a user retrieves stored connections, THE SMB_Manager SHALL decrypt passwords and return connection details
4. WHEN a user requests a connection health check, THE SMB_Manager SHALL attempt to connect to the SMB share and return the connection status
5. THE SMB_Manager SHALL store connection configurations with unique aliases to prevent duplicates
6. WHEN a user deletes a connection, THE SMB_Manager SHALL remove it from the Connection_Store and terminate any active sessions

### Requirement 2: Authentication and Authorization

**User Story:** As a system administrator, I want to secure the application with Auth0, so that only authenticated users can access SMB resources.

#### Acceptance Criteria

1. WHEN a user accesses the application, THE Auth_Service SHALL redirect unauthenticated users to the Auth0 login page
2. WHEN Auth0 returns an authentication callback, THE Auth_Service SHALL validate the token and create a user session
3. WHEN a user makes API requests, THE Auth_Service SHALL verify the session token before processing the request
4. WHEN a session expires, THE Auth_Service SHALL return an unauthorized status and require re-authentication
5. THE Auth_Service SHALL maintain session state securely using HTTP-only cookies or secure token storage

### Requirement 3: File Browsing and Navigation

**User Story:** As a user, I want to browse files and folders on SMB shares, so that I can navigate my network storage.

#### Acceptance Criteria

1. WHEN a user selects a connection, THE File_Explorer SHALL display the root directory of the SMB share
2. WHEN a user navigates to a directory, THE SMB_Manager SHALL return a list of files and folders with metadata (name, size, type, modified date)
3. WHEN a user navigates deeper into folders, THE File_Explorer SHALL update the breadcrumb navigation to show the current path
4. THE File_Explorer SHALL support both list view and grid view display modes
5. WHEN the directory listing is loading, THE File_Explorer SHALL display skeleton loading indicators
6. WHEN a directory contains no items, THE File_Explorer SHALL display an appropriate empty state message

### Requirement 4: File Upload Operations

**User Story:** As a user, I want to upload files to SMB shares, so that I can add content to my network storage.

#### Acceptance Criteria

1. WHEN a user drags files into the File_Explorer, THE File_Explorer SHALL accept the files and initiate upload
2. WHEN a user clicks an upload button and selects files, THE File_Explorer SHALL initiate upload for the selected files
3. WHEN files are uploading, THE File_Explorer SHALL display upload progress for each file
4. WHEN an upload completes successfully, THE SMB_Manager SHALL write the file to the SMB share and refresh the directory listing
5. WHEN an upload fails, THE File_Explorer SHALL display an error message and allow retry
6. THE SMB_Manager SHALL support multipart file uploads for large files

### Requirement 5: File Download and Streaming

**User Story:** As a user, I want to download and stream files from SMB shares, so that I can access my content without storing it locally on the server.

#### Acceptance Criteria

1. WHEN a user requests to download a file, THE Stream_Handler SHALL stream the file directly from the SMB share to the client
2. WHEN a user requests to stream media (video/image), THE Stream_Handler SHALL stream the content without caching the full file on the server disk
3. THE Stream_Handler SHALL use io.Copy or equivalent streaming mechanisms to minimize server memory usage
4. WHEN streaming large files, THE Stream_Handler SHALL support HTTP range requests for partial content delivery
5. WHEN a download or stream fails, THE SMB_Manager SHALL return an appropriate error status and message

### Requirement 6: File Management Operations

**User Story:** As a user, I want to perform file operations (rename, delete, create folder), so that I can organize my files on SMB shares.

#### Acceptance Criteria

1. WHEN a user renames a file or folder, THE SMB_Manager SHALL update the name on the SMB share and refresh the directory listing
2. WHEN a user deletes a file or folder, THE SMB_Manager SHALL remove it from the SMB share and update the directory listing
3. WHEN a user creates a new folder, THE SMB_Manager SHALL create the directory on the SMB share and refresh the listing
4. WHEN a user performs a bulk delete operation, THE SMB_Manager SHALL use goroutines to delete multiple items concurrently
5. WHEN a file operation fails, THE SMB_Manager SHALL return a descriptive error message indicating the cause
6. THE File_Explorer SHALL provide context menus (right-click) for accessing file operations

### Requirement 7: Wishlist Management

**User Story:** As a user, I want to star files and folders across different SMB servers, so that I can quickly access frequently used items.

#### Acceptance Criteria

1. WHEN a user adds a file or folder to the wishlist, THE Wishlist_System SHALL store the item with its connection ID and path
2. WHEN a user views the wishlist, THE Wishlist_System SHALL return all starred items grouped by connection
3. WHEN a user removes an item from the wishlist, THE Wishlist_System SHALL delete it from the database
4. WHEN a user clicks a wishlist item, THE File_Explorer SHALL navigate to that file's location on the appropriate SMB share
5. THE File_Explorer SHALL use optimistic UI updates when adding items to the wishlist
6. THE File_Explorer SHALL display visual indicators (star icons) for files and folders that are in the wishlist

### Requirement 8: Session Management

**User Story:** As a system architect, I want to manage SMB sessions efficiently, so that the system maintains performance and security.

#### Acceptance Criteria

1. WHEN a user connects to an SMB share, THE Session_Pool SHALL create and store the session in memory
2. WHEN a user makes multiple requests to the same share, THE Session_Pool SHALL reuse the existing session
3. WHEN a session becomes idle, THE Session_Pool SHALL close the connection after a timeout period
4. WHEN a user logs out, THE Session_Pool SHALL terminate all SMB sessions associated with that user
5. THE Session_Pool SHALL handle concurrent requests to the same SMB share safely using appropriate synchronization

### Requirement 9: User Interface Design

**User Story:** As a user, I want a modern and intuitive interface, so that I can efficiently manage my files.

#### Acceptance Criteria

1. THE File_Explorer SHALL display a sidebar showing all connected SMB shares
2. THE File_Explorer SHALL use glassmorphism design with semi-transparent elements and backdrop blur effects
3. WHEN displaying file lists, THE File_Explorer SHALL show file icons, names, sizes, and modification dates
4. THE File_Explorer SHALL provide keyboard shortcuts for common operations (delete, rename, refresh)
5. WHEN loading data, THE File_Explorer SHALL use skeleton components from shadcn/ui
6. THE File_Explorer SHALL be responsive and work on desktop and tablet screen sizes

### Requirement 10: Error Handling and Resilience

**User Story:** As a user, I want clear error messages and graceful failure handling, so that I understand what went wrong and can take corrective action.

#### Acceptance Criteria

1. WHEN an SMB connection fails, THE SMB_Manager SHALL return a descriptive error message indicating the connection issue
2. WHEN a file operation fails due to permissions, THE SMB_Manager SHALL return an error indicating insufficient permissions
3. WHEN the database is unavailable, THE Connection_Store SHALL return an error and prevent data corruption
4. WHEN network errors occur during file transfer, THE Stream_Handler SHALL abort the transfer and notify the user
5. THE File_Explorer SHALL display user-friendly error messages in toast notifications or modal dialogs
6. WHEN errors occur, THE system SHALL log detailed error information for debugging purposes

### Requirement 11: Data Persistence

**User Story:** As a user, I want my connection configurations and wishlist to persist, so that I don't have to reconfigure the application each time.

#### Acceptance Criteria

1. THE Connection_Store SHALL persist SMB connection configurations in SQLite with GORM
2. THE Connection_Store SHALL persist wishlist items in SQLite with foreign key relationships to connections
3. WHEN the application starts, THE Connection_Store SHALL load existing connections and wishlist items
4. WHEN a connection is deleted, THE Connection_Store SHALL cascade delete associated wishlist items
5. THE Connection_Store SHALL use database migrations to manage schema changes
6. THE Connection_Store SHALL handle database errors gracefully and prevent data loss

### Requirement 12: API Design

**User Story:** As a frontend developer, I want a well-designed REST API, so that I can build a responsive user interface.

#### Acceptance Criteria

1. THE SMB_Manager SHALL expose RESTful endpoints following the /api/v1 prefix convention
2. WHEN API requests succeed, THE SMB_Manager SHALL return appropriate HTTP status codes (200, 201, 204)
3. WHEN API requests fail, THE SMB_Manager SHALL return appropriate error status codes (400, 401, 404, 500) with error details
4. THE SMB_Manager SHALL accept and return JSON-formatted data for all API endpoints
5. THE SMB_Manager SHALL validate request parameters and return 400 Bad Request for invalid inputs
6. THE SMB_Manager SHALL implement CORS headers to allow frontend access from the configured origin
