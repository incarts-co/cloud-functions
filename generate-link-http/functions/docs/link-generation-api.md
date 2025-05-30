# Link Generation API Documentation

## Base URL
```
https://us-central1-[project-id].cloudfunctions.net/generateLinkHttp
```

## Authentication & CORS
The API supports CORS for the following origins:
- `http://localhost:[port]`
- `https://*.flutterflow.app`
- `https://*.incarts.beta`

Required Headers:
```
Content-Type: application/json
```

## Common Parameters
All requests require these base parameters:

| Parameter    | Type     | Required | Description                    |
|-------------|----------|----------|--------------------------------|
| linkType    | string   | Yes      | Link type: "1", "2", or "3"   |
| linkName    | string   | Yes      | Private name for the link      |
| projectId   | string   | Yes      | Current project identifier     |
| projectName | string   | Yes      | Project name                   |
| userId      | string   | Yes      | User identifier               |

Optional common parameters:

| Parameter      | Type     | Required | Description                    | Example                                      |
|---------------|----------|----------|--------------------------------|----------------------------------------------|
| publicLinkName | string   | No       | Public display name           | "Summer Sale Product"                        |
| linkValue     | number   | No       | Value for analytics           | 10                                           |
| utmParameters | object   | No       | UTM tracking parameters       | {"source": "facebook", "medium": "social"}   |
| linkTags      | string[] | No       | Tags associated with the link | ["promo", "summer2025"]                      |

## 1. Custom URL Links (Type 1)

### 1.1 Retailer Selection (Step 1)

**Conditions:**
- linkType must be "1"
- retailerStep must be 1
- originalUrl is required

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

### 1.2 Custom Link (Step 2)

**Conditions:**
- linkType must be "1"
- retailerStep must be 2
- originalUrl is required

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

## 2. Product Links (Type 2)

For product links, the selectedRetailer parameter is optional. If not provided, the retailer name will be automatically determined from the selectedWebsite:
- "Walmart.com" → "Walmart"
- "Amazon.com" → "Amazon"
- "Kroger.com" → "Kroger"
- "Instacart.com" → "Instacart"

### 2.1 Walmart Product Page

**Conditions:**
- linkType must be "2"
- selectedWebsite must be "Walmart.com"
- selectedAction must be "Item Page"
- selectedProducts array must contain at least one product ID

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

### 2.2 Walmart Add To Cart

**Conditions:**
- linkType must be "2"
- selectedWebsite must be "Walmart.com"
- selectedAction must be "Add Items to Cart"
- selectedProducts array can contain multiple product IDs

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

### 2.3 Instacart Product Page

**Conditions:**
- linkType must be "2"
- selectedWebsite must be "Instacart.com"
- selectedAction must be "Item Page"
- selectedProducts array must contain at least one product ID
- instacartRetailer is optional but recommended

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

### 2.4 Instacart Shopping List

**Conditions:**
- linkType must be "2"
- selectedWebsite must be "Instacart.com"
- selectedAction must be "Shopping List"
- shoppingListData object is required with:
  - title: Name of the shopping list
  - imageUrl: URL of the list's image
  - instructions: Optional instructions for the shopping list
  - lineItems: Array of items with name, quantity, unit, and brand filters

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
      "instructions": "Shopping list instructions", // Optional
      "lineItems": [
        {
          "name": "Just Bare Lightly Breaded Chicken Breast Bites",
          "quantity": 1,
          "unit": "oz",
          "filters": {
            "brand_filters": ["Just Bare"]
          }
        },
        {
          "name": "Real Good Food Lightly Breaded Chicken Strips, 3 lbs",
          "quantity": 1,
          "unit": "lbs",
          "filters": {
            "brand_filters": ["Real good foods"]
          }
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

**Note:** The shopping list creation will:
1. Make an API call to Instacart's endpoint
2. Create a shopping list with the provided items
3. Return a products_link_url that will be processed through the standard link generation pipeline (shortening, QR code, document creation)

### 2.5 Amazon Product Cart

**Conditions:**
- linkType must be "2"
- selectedWebsite must be "Amazon.com"
- selectedAction must be "Add Items to Cart"
- selectedProducts array can contain multiple product IDs

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

### 2.6 Kroger Product Page

**Conditions:**
- linkType must be "2"
- selectedWebsite must be "Kroger.com"
- selectedAction must be "Item Page"
- selectedProducts array must contain at least one product ID

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

## 3. Shoppable Page Links (Type 3)

**Conditions:**
- linkType must be "3"
- shoppablePageId is required

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

## Successful Response Format

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

## Error Response Format

All error responses follow this format:

```json
{
  "success": false,
  "error": "Error message describing what went wrong"
}
```

### Common Error Scenarios

1. Missing Required Parameters
```json
{
  "success": false,
  "error": "Missing required parameters: linkType, linkName"
}
```

2. Invalid Link Type Configuration
```json
{
  "success": false,
  "error": "Original URL is required for custom links (retailerStep 2)"
}
```

3. Missing Product Information
```json
{
  "success": false,
  "error": "Website, action, and products are required for product links"
}
```

4. Missing Shoppable Page ID
```json
{
  "success": false,
  "error": "Shoppable page ID is required for page links"
}
```

5. URL Shortener Service Error
```json
{
  "success": false,
  "error": "Failed to shorten URL: Service unavailable"
}
```

6. QR Code Generation Error
```json
{
  "success": false,
  "error": "Failed to generate QR code: Invalid URL format"
}
```

7. Invalid Shopping List Data
```json
{
  "success": false,
  "error": "Shopping list data is required for Shopping List action"
}
```

8. Missing Shopping List Fields
```json
{
  "success": false,
  "error": "Invalid shopping list data: title, imageUrl, and lineItems are required"
}
```

9. Database Error
```json
{
  "success": false,
  "error": "Failed to create link document: Database connection error"
}
```
