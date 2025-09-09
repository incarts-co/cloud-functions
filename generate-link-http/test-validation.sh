#!/bin/bash

# Test QR Identifier Validation
# Run with: bash test-validation.sh

BASE_URL="http://localhost:5001/incarts/us-central1"
LINK_ID="test-link-123"  # Replace with actual link ID

echo "======================================"
echo "Testing QR Identifier Validation"
echo "======================================"
echo ""

# Test 1: Valid identifier
echo "Test 1: Valid identifier (should succeed)"
curl -X POST $BASE_URL/createAdditionalQRCode \
  -H "Content-Type: application/json" \
  -d '{
    "linkId": "'$LINK_ID'",
    "identifier": "black-friday-2025",
    "name": "Black Friday Campaign",
    "userId": "test-user"
  }'
echo -e "\n\n"

# Test 2: Too short identifier
echo "Test 2: Too short (should fail)"
curl -X POST $BASE_URL/createAdditionalQRCode \
  -H "Content-Type: application/json" \
  -d '{
    "linkId": "'$LINK_ID'",
    "identifier": "bf",
    "name": "Too Short",
    "userId": "test-user"
  }'
echo -e "\n\n"

# Test 3: Too long identifier
echo "Test 3: Too long (should fail)"
curl -X POST $BASE_URL/createAdditionalQRCode \
  -H "Content-Type: application/json" \
  -d '{
    "linkId": "'$LINK_ID'",
    "identifier": "this-is-a-very-long-identifier-that-exceeds-fifty-characters-limit",
    "name": "Too Long",
    "userId": "test-user"
  }'
echo -e "\n\n"

# Test 4: Uppercase letters (should fail)
echo "Test 4: Uppercase letters (should fail)"
curl -X POST $BASE_URL/createAdditionalQRCode \
  -H "Content-Type: application/json" \
  -d '{
    "linkId": "'$LINK_ID'",
    "identifier": "Black-Friday-2025",
    "name": "Uppercase Test",
    "userId": "test-user"
  }'
echo -e "\n\n"

# Test 5: Special characters (should fail)
echo "Test 5: Special characters (should fail)"
curl -X POST $BASE_URL/createAdditionalQRCode \
  -H "Content-Type: application/json" \
  -d '{
    "linkId": "'$LINK_ID'",
    "identifier": "black_friday!",
    "name": "Special Chars",
    "userId": "test-user"
  }'
echo -e "\n\n"

# Test 6: Spaces (should fail)
echo "Test 6: Spaces (should fail)"
curl -X POST $BASE_URL/createAdditionalQRCode \
  -H "Content-Type: application/json" \
  -d '{
    "linkId": "'$LINK_ID'",
    "identifier": "black friday 2025",
    "name": "Spaces Test",
    "userId": "test-user"
  }'
echo -e "\n\n"

# Test 7: Path traversal attempt (should fail)
echo "Test 7: Path traversal (should fail)"
curl -X POST $BASE_URL/createAdditionalQRCode \
  -H "Content-Type: application/json" \
  -d '{
    "linkId": "'$LINK_ID'",
    "identifier": "../admin",
    "name": "Path Traversal",
    "userId": "test-user"
  }'
echo -e "\n\n"

# Test 8: Double hyphens (should fail)
echo "Test 8: Double hyphens (should fail)"
curl -X POST $BASE_URL/createAdditionalQRCode \
  -H "Content-Type: application/json" \
  -d '{
    "linkId": "'$LINK_ID'",
    "identifier": "black--friday",
    "name": "Double Hyphen",
    "userId": "test-user"
  }'
echo -e "\n\n"

# Test 9: Leading hyphen (should fail)
echo "Test 9: Leading hyphen (should fail)"
curl -X POST $BASE_URL/createAdditionalQRCode \
  -H "Content-Type: application/json" \
  -d '{
    "linkId": "'$LINK_ID'",
    "identifier": "-blackfriday",
    "name": "Leading Hyphen",
    "userId": "test-user"
  }'
echo -e "\n\n"

# Test 10: Reserved word (should fail)
echo "Test 10: Reserved word 'admin' (should fail)"
curl -X POST $BASE_URL/createAdditionalQRCode \
  -H "Content-Type: application/json" \
  -d '{
    "linkId": "'$LINK_ID'",
    "identifier": "admin",
    "name": "Reserved Word",
    "userId": "test-user"
  }'
echo -e "\n\n"

# Test 11: Duplicate identifier (should fail with suggestions)
echo "Test 11: Duplicate identifier (run twice to test)"
curl -X POST $BASE_URL/createAdditionalQRCode \
  -H "Content-Type: application/json" \
  -d '{
    "linkId": "'$LINK_ID'",
    "identifier": "test-duplicate",
    "name": "First Creation",
    "userId": "test-user"
  }'
echo -e "\n"
echo "Running same identifier again (should fail with suggestions):"
curl -X POST $BASE_URL/createAdditionalQRCode \
  -H "Content-Type: application/json" \
  -d '{
    "linkId": "'$LINK_ID'",
    "identifier": "test-duplicate",
    "name": "Second Creation",
    "userId": "test-user"
  }'
echo -e "\n\n"

echo "======================================"
echo "Validation Testing Complete"
echo "======================================" 