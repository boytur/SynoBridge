#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

# Default Docker Hub username / registry namespace
REGISTRY=${1:-"boytur"}
VERSION=${2:-"latest"}

echo "🚀 Starting SynoBridge Unified Docker build process..."
echo "👤 Target Registry/Username: $REGISTRY"
echo "🏷️  Tag: $VERSION"
echo "----------------------------------------"

echo "📦 Building Unified Image (Backend + Frontend)..."
docker build --network=host -t $REGISTRY/synobridge:$VERSION -f Dockerfile .

echo ""
echo "✅ Success! The unified image has been built and tagged locally."
echo "----------------------------------------"
echo "To push this image to your Docker registry, simply run:"
echo ""
echo "docker push $REGISTRY/synobridge:$VERSION"
echo ""
echo "Note: If you are pushing to Docker Hub, make sure you are logged in first (docker login)."
