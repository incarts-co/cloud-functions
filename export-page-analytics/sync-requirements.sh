#!/bin/bash

# Script to sync requirements.txt from uv for Firebase deployment
# Firebase Cloud Functions still requires requirements.txt for deployment

echo "Syncing requirements.txt from uv..."

# Export dependencies to requirements.txt
uv pip compile pyproject.toml -o functions/requirements.txt

echo "✓ requirements.txt has been updated from pyproject.toml"
echo "Note: Make sure to commit both pyproject.toml and requirements.txt"
