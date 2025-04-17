#!/bin/bash

# Exit on error
set -e

echo "Building Package Usage Finder..."
cd "$(dirname "$0")"
go build -o packagefinder ./cmd

echo "Build successful! You can run the tool with:"
echo "./packagefinder [options] package-name" 