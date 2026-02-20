#!/bin/bash
# Release script - Build and push images to Docker Hub
# Usage: ./scripts/release.sh YOUR_DOCKERHUB_USERNAME

set -e

if [ -z "$1" ]; then
    echo "Usage: $0 <dockerhub-username>"
    echo "Example: $0 johndoe"
    exit 1
fi

DOCKERHUB_USER="$1"
IMAGE_PREFIX="$DOCKERHUB_USER/adventureshare"

echo "Building images..."
docker-compose build

echo "Tagging images..."
docker tag adventureshare-backend:latest ${IMAGE_PREFIX}/backend:latest
docker tag adventureshare-frontend:latest ${IMAGE_PREFIX}/frontend:latest

echo "Logging in to Docker Hub..."
docker login

echo "Pushing images to Docker Hub..."
docker push ${IMAGE_PREFIX}/backend:latest
docker push ${IMAGE_PREFIX}/frontend:latest

echo ""
echo "Done! To deploy on another machine:"
echo ""
echo "1. Create a .env file with:"
echo "   IMAGE_PREFIX=${IMAGE_PREFIX}"
echo "   JWT_SECRET=your_secure_secret"
echo "   ENABLE_REGISTRATION=false"
echo ""
echo "2. Run: docker-compose -f docker-compose.prod.yml up -d"
echo ""
echo "Or quick start:"
echo "   IMAGE_PREFIX=${IMAGE_PREFIX} docker-compose -f docker-compose.prod.yml up -d"
