# Generate Link HTTP Cloud Function

## Overview

This Firebase Cloud Function (`generateLinkHttp`) provides an HTTP endpoint for generating various types of dynamic links based on input parameters. It supports creating custom URL links, product links for different retailers (Walmart, Instacart, Amazon, Kroger), and links to shoppable pages.

The function handles different link generation logic based on the `linkType` parameter, processes input data, interacts with external services (like URL shorteners and Instacart's API for shopping lists), generates QR codes, and stores link information in Firestore.

## Deployment

Ensure you have the [Firebase CLI](https://firebase.google.com/docs/cli) installed and configured for your project.

1.  Navigate to the project root directory (`/Users/alikibao/Desktop/Github/incarts-functions/generate-link-http`).
2.  Deploy the function using the following command:

    ```bash
    firebase deploy --only functions:generateLinkHttp
    ```

    *Note: Replace `[project-id]` in the Base URL below with your actual Firebase project ID.*

## API Documentation

### Base URL

```
https://us-central1-[project-id].cloudfunctions.net/generateLinkHttp
```

### Authentication & CORS

The API supports CORS for the following origins:
- `http://localhost:[port]`
- `https://*.flutterflow.app`
- `https://*.incarts.beta`

**Required Headers:**
```
Content-Type: application/json
```

### Common Parameters

All requests require these base parameters:

| Parameter    | Type     | Required | Description                    |
|-------------|----------|----------|--------------------------------|
| linkType    | string   | Yes      | Link type: "1", "2", or "3"   |
| linkName    | string   | Yes      | Private name for the link      |
| projectId   | string   | Yes      | Current project identifier     |
| projectName | string   | Yes      | Project name                   |
| userId      | string   | Yes      | User identifier               |

**Optional common parameters:**

| Parameter      | Type     | Required | Description                    | Example                                      |
|---------------|----------|----------|--------------------------------|----------------------------------------------|
| publicLinkName | string   | No       | Public display name           | "Summer Sale Product"                        |
| linkValue     | number   | No       | Value for analytics           | 10                                           |
| utmParameters | object   | No       | UTM tracking parameters       | {"source": "facebook", "medium": "social"}   |
| linkTags      | string[] | No       | Tags associated with the link | ["promo", "summer2025"]                      |

### Link Types

#### 1. Custom URL Links (Type 1)

##### 1.1 Retailer Selection (Step 1)

**Conditions:**
- `linkType` must be `"1"`
- `retailerStep` must be `1`
- `originalUrl` is required

```bash
curl -X POST https://us-central1-[project-id].cloudfunctions.net/generateLinkHttp \
  -H "Content-Type: application/json" \
  -d '{
    "linkType": "1",
    "retailerStep": 1,
    "linkName": "My Retailer Link",
    "originalUrl": "https://example-retailer.com/product",
    "projectId": "project123",
    "projectName": "My Project",
    "userId": "user123"
  }'
```

##### 1.2 Custom Link (Step 2)

**Conditions:**
- `linkType` must be `"1"`
- `retailerStep` must be `2`
- `originalUrl` is required

```bash
curl -X POST https://us-central1-[project-id].cloudfunctions.net/generateLinkHttp \
  -H "Content-Type: application/json" \
  -d '{
    "linkType": "1",
    "retailerStep": 2,
    "linkName": "My Custom Link",
    "originalUrl": "https://example.com/custom-page",
    "projectId": "project123",
    "projectName": "My Project",
    "userId": "user123",
    "publicLinkName": "Public Link Name",
    "linkValue": 10,
    "linkTags": ["promo", "summer2025"]
  }'
```

#### 2. Product Links (Type 2)

For product links, the `selectedRetailer` parameter is optional. If not provided, the retailer name will be automatically determined from the `selectedWebsite`:
- `"Walmart.com"` → `"Walmart"`
- `"Amazon.com"` → `"Amazon"`
- `"Kroger.com"` → `"Kroger"`
- `"Instacart.com"` → `"Instacart"`

##### 2.1 Walmart Product Page

**Conditions:**
- `linkType` must be `"2"`
- `selectedWebsite` must be `"Walmart.com"`
- `selectedAction` must be `"Item Page"`
- `selectedProducts` array must contain at least one product ID

```bash
curl -X POST https://us-central1-[project-id].cloudfunctions.net/generateLinkHttp \
  -H "Content-Type: application/json" \
  -d '{
    "linkType": "2",
    "linkName": "Walmart Product",
    "selectedWebsite": "Walmart.com",
    "selectedAction": "Item Page",
    "selectedProducts": ["123456789"],
    "projectId": "project123",
    "projectName": "My Project",
    "userId": "user123",
    "utmParameters": {
      "source": "instagram",
      "medium": "social",
      "campaign": "summer_sale"
    }
  }'
```

##### 2.2 Walmart Add To Cart

**Conditions:**
- `linkType` must be `"2"`
- `selectedWebsite` must be `"Walmart.com"`
- `selectedAction` must be `"Add Items to Cart"`
- `selectedProducts` array can contain multiple product IDs

```bash
curl -X POST https://us-central1-[project-id].cloudfunctions.net/generateLinkHttp \
  -H "Content-Type: application/json" \
  -d '{
    "linkType": "2",
    "linkName": "Walmart Cart",
    "selectedWebsite": "Walmart.com",
    "selectedAction": "Add Items to Cart",
    "selectedProducts": ["123456789", "987654321"],
    "projectId": "project123",
    "projectName": "My Project",
    "userId": "user123",
    "utmParameters": {
      "source": "instagram",
      "medium": "social",
      "campaign": "bulk_purchase"
    }
  }'
```

##### 2.3 Instacart Product Page

**Conditions:**
- `linkType` must be `"2"`
- `selectedWebsite` must be `"Instacart.com"`
- `selectedAction` must be `"Item Page"`
- `selectedProducts` array must contain at least one product ID
- `instacartRetailer` is optional but recommended

```bash
curl -X POST https://us-central1-[project-id].cloudfunctions.net/generateLinkHttp \
  -H "Content-Type: application/json" \
  -d '{
    "linkType": "2",
    "linkName": "Instacart Product",
    "selectedWebsite": "Instacart.com",
    "selectedAction": "Item Page",
    "selectedProducts": ["123456789"],
    "instacartRetailer": "kroger",
    "projectId": "project123",
    "projectName": "My Project",
    "userId": "user123",
    "utmParameters": {
      "source": "email",
      "medium": "newsletter",
      "campaign": "weekly_deals"
    }
  }'
```

##### 2.4 Instacart Shopping List

**Conditions:**
- `linkType` must be `"2"`
- `selectedWebsite` must be `"Instacart.com"`
- `selectedAction` must be `"Shopping List"`
- `shoppingListData` object is required with specific fields (see example)

```bash
curl -X POST https://us-central1-[project-id].cloudfunctions.net/generateLinkHttp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "Accept-Language: en-CA" \
  -d '{
    "linkType": "2",
    "linkName": "Shopping List",
    "selectedWebsite": "Instacart.com",
    "selectedAction": "Shopping List",
    "shoppingListData": {
      "title": "Weekly Groceries",
      "imageUrl": "https://example.com/list-image.jpg",
      "instructions": "Shopping list instructions",
      "lineItems": [
        {
          "name": "Just Bare Lightly Breaded Chicken Breast Bites",
          "quantity": 1,
          "unit": "oz",
          "filters": { "brand_filters": ["Just Bare"] }
        },
        {
          "name": "Real Good Food Lightly Breaded Chicken Strips, 3 lbs",
          "quantity": 1,
          "unit": "lbs",
          "filters": { "brand_filters": ["Real good foods"] }
        }
      ]
    },
    "projectId": "project123",
    "projectName": "My Project",
    "userId": "user123",
    "utmParameters": {
      "source": "pinterest",
      "medium": "social",
      "campaign": "recipe_collection"
    }
  }'
```
*Note: This action involves an additional API call to Instacart.*

##### 2.5 Amazon Product Cart

**Conditions:**
- `linkType` must be `"2"`
- `selectedWebsite` must be `"Amazon.com"`
- `selectedAction` must be `"Add Items to Cart"`
- `selectedProducts` array can contain multiple product IDs (ASINs)

```bash
curl -X POST https://us-central1-[project-id].cloudfunctions.net/generateLinkHttp \
  -H "Content-Type: application/json" \
  -d '{
    "linkType": "2",
    "linkName": "Amazon Cart",
    "selectedWebsite": "Amazon.com",
    "selectedAction": "Add Items to Cart",
    "selectedProducts": ["B0123456789", "B0987654321"],
    "projectId": "project123",
    "projectName": "My Project",
    "userId": "user123",
    "utmParameters": {
      "source": "tiktok",
      "medium": "social",
      "campaign": "prime_deals"
    }
  }'
```

##### 2.6 Kroger Product Page

**Conditions:**
- `linkType` must be `"2"`
- `selectedWebsite` must be `"Kroger.com"`
- `selectedAction` must be `"Item Page"`
- `selectedProducts` array must contain at least one product ID (UPC)

```bash
curl -X POST https://us-central1-[project-id].cloudfunctions.net/generateLinkHttp \
  -H "Content-Type: application/json" \
  -d '{
    "linkType": "2",
    "linkName": "Kroger Product",
    "selectedWebsite": "Kroger.com",
    "selectedAction": "Item Page",
    "selectedProducts": ["0123456789"],
    "projectId": "project123",
    "projectName": "My Project",
    "userId": "user123",
    "utmParameters": {
      "source": "twitter",
      "medium": "social",
      "campaign": "fresh_produce"
    }
  }'
```

#### 3. Shoppable Page Links (Type 3)

**Conditions:**
- `linkType` must be `"3"`
- `shoppablePageId` is required

```bash
curl -X POST https://us-central1-[project-id].cloudfunctions.net/generateLinkHttp \
  -H "Content-Type: application/json" \
  -d '{
    "linkType": "3",
    "linkName": "Shoppable Page",
    "shoppablePageId": "page123",
    "projectId": "project123",
    "projectName": "My Project",
    "userId": "user123",
    "utmParameters": {
      "source": "blog",
      "medium": "referral",
      "campaign": "holiday_collection"
    }
  }'
```

### Responses

#### Success Response Format

All successful responses follow this format:

```json
{
  "success": true,
  "shortLink": "https://short.url/abc123",
  "shortId": "abc123",
  "qrCodeUrl": "https://storage.googleapis.com/qrcodes/abc123.png",
  "linkDocId": "uniqueDocumentId20Chars"
}
```

#### Error Response Format

All error responses follow this format:

```json
{
  "success": false,
  "error": "Error message describing what went wrong"
}
```

**Common Error Scenarios:**

*   Missing Required Parameters (e.g., `linkType`, `linkName`)
*   Invalid Link Type Configuration (e.g., missing `originalUrl` for Type 1)
*   Missing Product Information (e.g., `selectedWebsite`, `selectedAction`, `selectedProducts` for Type 2)
*   Missing Shoppable Page ID (for Type 3)
*   URL Shortener Service Error
*   QR Code Generation Error
*   Invalid Shopping List Data (for Instacart Shopping List)
*   Missing Shopping List Fields
*   Database Error (Firestore)

## Development

The Cloud Function code resides in the `functions` directory.

1.  Navigate to the functions directory: `cd functions`
2.  Install dependencies: `npm install`
3.  Build the TypeScript code: `npm run build` (or `npm run build:watch` for continuous building)

Refer to the [Firebase documentation](https://firebase.google.com/docs/functions/local-emulator) for running functions locally using the Firebase Emulator Suite.
