#!/bin/bash

# Test Enhanced Default QR Generation
# Run with: bash test-default-qr.sh

BASE_URL="http://localhost:5001/incarts/us-central1"

echo "=========================================="
echo "Testing Enhanced Default QR Generation"
echo "=========================================="
echo ""

# Test 1: No custom identifier (backward compatibility)
echo "Test 1: No custom identifier (should use default-{linkId})"
curl -X POST $BASE_URL/generateLinkHttp \
  -H "Content-Type: application/json" \
  -d '{
    "linkType": "1",
    "retailerStep": 2,
    "linkName": "Test Link - No Custom QR",
    "originalUrl": "https://example.com/test1",
    "projectId": "test-project",
    "projectName": "Test Project",
    "userId": "test-user"
  }'
echo -e "\n\n"

# Test 2: Valid custom identifier
echo "Test 2: Valid custom identifier"
curl -X POST $BASE_URL/generateLinkHttp \
  -H "Content-Type: application/json" \
  -d '{
    "linkType": "1",
    "retailerStep": 2,
    "linkName": "Test Link - Custom QR",
    "originalUrl": "https://example.com/test2",
    "defaultQRIdentifier": "website-hero-banner",
    "defaultQRName": "Website Hero Banner QR",
    "projectId": "test-project",
    "projectName": "Test Project",
    "userId": "test-user"
  }'
echo -e "\n\n"

# Test 3: Another valid custom identifier
echo "Test 3: Campaign-specific identifier"
curl -X POST $BASE_URL/generateLinkHttp \
  -H "Content-Type: application/json" \
  -d '{
    "linkType": "1",
    "retailerStep": 2,
    "linkName": "Black Friday Sale",
    "originalUrl": "https://example.com/black-friday",
    "defaultQRIdentifier": "email-signature-2025",
    "defaultQRName": "Email Signature QR",
    "projectId": "test-project",
    "projectName": "Test Project",
    "userId": "test-user"
  }'
echo -e "\n\n"

# Test 4: Invalid identifier (uppercase)
echo "Test 4: Invalid identifier with uppercase (should fail)"
curl -X POST $BASE_URL/generateLinkHttp \
  -H "Content-Type: application/json" \
  -d '{
    "linkType": "1",
    "retailerStep": 2,
    "linkName": "Test Link - Invalid QR",
    "originalUrl": "https://example.com/test4",
    "defaultQRIdentifier": "Website-Hero",
    "defaultQRName": "Invalid QR Test",
    "projectId": "test-project",
    "projectName": "Test Project",
    "userId": "test-user"
  }'
echo -e "\n\n"

# Test 5: Invalid identifier (special chars)
echo "Test 5: Invalid identifier with special chars (should fail)"
curl -X POST $BASE_URL/generateLinkHttp \
  -H "Content-Type: application/json" \
  -d '{
    "linkType": "1",
    "retailerStep": 2,
    "linkName": "Test Link - Invalid QR 2",
    "originalUrl": "https://example.com/test5",
    "defaultQRIdentifier": "website_hero!",
    "defaultQRName": "Invalid QR Test 2",
    "projectId": "test-project",
    "projectName": "Test Project",
    "userId": "test-user"
  }'
echo -e "\n\n"

# Test 6: Reserved word identifier
echo "Test 6: Reserved word 'admin' (should fail)"
curl -X POST $BASE_URL/generateLinkHttp \
  -H "Content-Type: application/json" \
  -d '{
    "linkType": "1",
    "retailerStep": 2,
    "linkName": "Test Link - Reserved Word",
    "originalUrl": "https://example.com/test6",
    "defaultQRIdentifier": "admin",
    "defaultQRName": "Reserved Word Test",
    "projectId": "test-project",
    "projectName": "Test Project",
    "userId": "test-user"
  }'
echo -e "\n\n"

# Test 7: Duplicate identifier (run twice)
echo "Test 7: Duplicate identifier test - First creation"
curl -X POST $BASE_URL/generateLinkHttp \
  -H "Content-Type: application/json" \
  -d '{
    "linkType": "1",
    "retailerStep": 2,
    "linkName": "Test Link - Duplicate 1",
    "originalUrl": "https://example.com/test7a",
    "defaultQRIdentifier": "duplicate-test-qr",
    "defaultQRName": "Duplicate Test QR",
    "projectId": "test-project",
    "projectName": "Test Project",
    "userId": "test-user"
  }'
echo -e "\n"

echo "Running with same identifier again (should fail with suggestions):"
curl -X POST $BASE_URL/generateLinkHttp \
  -H "Content-Type: application/json" \
  -d '{
    "linkType": "1",
    "retailerStep": 2,
    "linkName": "Test Link - Duplicate 2",
    "originalUrl": "https://example.com/test7b",
    "defaultQRIdentifier": "duplicate-test-qr",
    "defaultQRName": "Duplicate Test QR 2",
    "projectId": "test-project",
    "projectName": "Test Project",
    "userId": "test-user"
  }'
echo -e "\n\n"

# Test 8: Product link with custom default QR
echo "Test 8: Walmart product link with custom default QR"
curl -X POST $BASE_URL/generateLinkHttp \
  -H "Content-Type: application/json" \
  -d '{
    "linkType": "2",
    "linkName": "TV Deal with Custom QR",
    "selectedWebsite": "Walmart.com",
    "selectedAction": "Item Page",
    "selectedRetailer": "Walmart",
    "selectedProducts": ["551149382"],
    "defaultQRIdentifier": "tv-promo-walmart",
    "defaultQRName": "TV Promotion QR",
    "projectId": "test-project",
    "projectName": "Test Project",
    "userId": "test-user"
  }'
echo -e "\n\n"

echo "=========================================="
echo "Enhanced Default QR Testing Complete"
echo "=========================================="
echo ""
echo "Check Firestore for:"
echo "1. Links with custom QR identifiers"
echo "2. QR codes collection with meaningful IDs"
echo "3. Proper validation errors for invalid identifiers"