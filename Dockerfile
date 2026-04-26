# Stage 1: Build the React Frontend
FROM node:20-slim AS frontend-builder
WORKDIR /app
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ .
# Clear API URL so frontend uses relative paths (proxied by the Go backend)
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# Stage 2: Build the Go Backend
FROM golang:1.26-alpine AS backend-builder
RUN for i in 1 2 3; do apk add --no-cache gcc musl-dev sqlite-dev && break || sleep 2; done
WORKDIR /app
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ .
# Build the binary
RUN CGO_ENABLED=1 GOOS=linux go build -o /app/bin/api ./cmd/api

# Stage 3: Unified Final Image
FROM alpine:3.19
RUN apk add --no-cache sqlite-libs ca-certificates
WORKDIR /app

# Copy the compiled Go binary
COPY --from=backend-builder /app/bin/api /app/api

# Copy the compiled React assets into the 'public' directory
# The Go backend is configured to serve static files from './public'
COPY --from=frontend-builder /app/dist /app/public

# Default Environment Variables
ENV GIN_MODE=release
ENV PORT=80
ENV DB_PATH=/data/omnismb.db

# Expose the single unified port
EXPOSE 80

# Run the unified Go application
CMD ["/app/api"]
