# Generate Link HTTP API Documentation

## Overview

The Generate Link HTTP Cloud Function provides a comprehensive API for creating shoppable links with automatic URL shortening and QR code generation. This function supports multiple retailers and link types.

## API Documentation

### Swagger/OpenAPI Specification

The complete API specification is available in `swagger.json`. You can view and test the API using various tools:

#### Viewing the Swagger Documentation

1. **Swagger Editor (Online)**
   - Visit [Swagger Editor](https://editor.swagger.io/)
   - Copy and paste the contents of `swagger.json`
   - View interactive documentation and test endpoints

2. **Swagger UI (Local)**
   ```bash
   # Install swagger-ui-express (if using Node.js)
   npm install -g swagger-ui-watcher

   # Serve the swagger.json
   swagger-ui-watcher swagger.json
   ```

3. **VS Code Extension**
   - Install "Swagger Viewer" or "OpenAPI (Swagger) Editor" extension
   - Open `swagger.json` and use the preview feature

#### Using Postman

1. Import the `swagger.json` file into Postman
2. Postman will automatically create a collection with all endpoints
3. Fill in the required parameters and test the API

## Quick Start

### Base URL
```
Production: https://us-central1-incarts.cloudfunctions.net/generateLinkHttp
```

### Authentication

Currently, the API uses CORS-based access control. Allowed origins are configured in the function code.

### Request Format

All requests should be POST requests with `Content-Type: application/json`.

## Link Types

### 1. Custom URL Link (linkType: "1")

Create a shortened link for any custom URL.

**Required Parameters:**
- `linkType`: "1"
- `retailerStep`: 2 (for custom link)
- `linkName`: String (internal name)
- `originalUrl`: String (URL to shorten)
- `projectId`: String
- `projectName`: String
- `userId`: String

**Example Request:**
```json
{
  "linkType": "1",
  "retailerStep": 2,
  "linkName": "Summer Sale Link",
  "publicLinkName": "Get 50% Off",
  "originalUrl": "https://example.com/summer-sale",
  "projectId": "proj123",
  "projectName": "Summer Campaign 2025",
  "userId": "user456",
  "linkTags": ["summer", "sale", "discount"],
  "linkValue": 50
}
```

### 2. Product Link (linkType: "2")

Create links for retailer products with support for multiple retailers.

#### Supported Retailers

**Walmart.com**
- Actions: "Item Page", "Add Items to Cart"
- Supports backup products
- Supports PDP fulfillment for single items

**Instacart.com**
- Actions: "Item Page", "Shopping List", "Recipe"
- Supports retailer-specific links
- API integration for shopping lists and recipes

**Amazon.com**
- Actions: "Item Page", "Add Items to Cart"
- Uses Amazon Associates links

**Kroger.com**
- Actions: "Item Page"

#### Example: Walmart Add to Cart with Backups

```json
{
  "linkType": "2",
  "linkName": "Grocery Essentials",
  "selectedWebsite": "Walmart.com",
  "selectedAction": "Add Items to Cart",
  "selectedProducts": ["123456789", "987654321"],
  "projectId": "proj123",
  "projectName": "Grocery Campaign",
  "userId": "user456",
  "useBackups": true,
  "backupProducts": [
    {
      "primaryId": "123456789",
      "backupIds": ["111111111", "222222222"],
      "quantity": 2
    }
  ],
  "walmartAllowPdp": true,
  "cartUrlOptions": {
    "mode": "auto",
    "fallbackMode": "items",
    "includeStoreId": "auto"
  },
  "storeId": "12345"
}
```

#### Example: Instacart Shopping List

```json
{
  "linkType": "2",
  "linkName": "Weekly Grocery List",
  "selectedWebsite": "Instacart.com",
  "selectedAction": "Shopping List",
  "instacartRetailer": "costco",
  "shoppingListData": {
    "title": "Weekly Groceries",
    "imageUrl": "https://example.com/groceries.jpg",
    "instructions": "Get these items for the week",
    "lineItems": [
      {
        "name": "Whole Milk",
        "display_text": "Organic Whole Milk",
        "measurements": [
          {
            "quantity": 1,
            "unit": "gallon"
          }
        ],
        "filters": {
          "brand_filters": ["Organic Valley"],
          "health_filters": ["organic"]
        }
      },
      {
        "name": "Eggs",
        "display_text": "Free Range Eggs",
        "measurements": [
          {
            "quantity": 12,
            "unit": "count"
          }
        ]
      }
    ]
  },
  "projectId": "proj123",
  "projectName": "Recipe Campaign",
  "userId": "user456"
}
```

#### Example: Instacart Recipe

```json
{
  "linkType": "2",
  "linkName": "Chocolate Chip Cookies Recipe",
  "selectedWebsite": "Instacart.com",
  "selectedAction": "Recipe",
  "instacartRetailer": "costco",
  "recipeData": {
    "title": "Best Chocolate Chip Cookies",
    "image_url": "https://example.com/cookies.jpg",
    "author": "Chef Jane",
    "servings": 24,
    "cooking_time": 30,
    "instructions": [
      "Preheat oven to 375°F",
      "Mix dry ingredients",
      "Cream butter and sugar",
      "Combine wet and dry ingredients",
      "Bake for 10-12 minutes"
    ],
    "ingredients": [
      {
        "name": "Flour",
        "display_text": "All-Purpose Flour",
        "measurements": [
          {
            "quantity": 2.5,
            "unit": "cup"
          }
        ]
      },
      {
        "name": "Butter",
        "display_text": "Unsalted Butter",
        "measurements": [
          {
            "quantity": 1,
            "unit": "cup"
          }
        ],
        "filters": {
          "brand_filters": ["Land O'Lakes"],
          "health_filters": ["organic"]
        }
      },
      {
        "name": "Chocolate Chips",
        "display_text": "Semi-Sweet Chocolate Chips",
        "measurements": [
          {
            "quantity": 2,
            "unit": "cup"
          }
        ]
      }
    ],
    "landing_page_configuration": {
      "partner_linkback_url": "https://yoursite.com",
      "enable_pantry_items": true
    }
  },
  "projectId": "proj123",
  "projectName": "Recipe Campaign",
  "userId": "user456"
}
```

### 3. Shoppable Page Link (linkType: "3")

Create a link to an existing shoppable page.

**Required Parameters:**
- `linkType`: "3"
- `linkName`: String
- `shoppablePageId`: String (ID from newDynamicPages collection)
- `projectId`: String
- `projectName`: String
- `userId`: String

**Example Request:**
```json
{
  "linkType": "3",
  "linkName": "Product Landing Page",
  "publicLinkName": "Shop Now",
  "shoppablePageId": "page_abc123",
  "projectId": "proj123",
  "projectName": "Landing Page Campaign",
  "userId": "user456",
  "linkTags": ["landing-page", "products"]
}
```

## Response Format

### Success Response (200)

```json
{
  "success": true,
  "shortLink": "https://in2c.art/abc123",
  "shortId": "abc123",
  "qrCodeUrl": "https://storage.googleapis.com/incarts.appspot.com/qrcodes/abc123.png",
  "linkDocId": "AbCdEfGhIjKlMnOpQrSt"
}
```

### Error Responses

#### 400 Bad Request
```json
{
  "success": false,
  "error": "Missing required parameters: linkType, projectId"
}
```

#### 404 Not Found
```json
{
  "success": false,
  "error": "Shoppable page with ID page_abc123 not found."
}
```

#### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Failed to shorten URL: Connection timeout"
}
```

## Advanced Features

### Backup Products

The backup products feature allows you to specify alternative products that will be used if the primary product is unavailable.

**Configuration:**
```json
{
  "useBackups": true,
  "backupProducts": [
    {
      "primaryId": "123456789",
      "backupIds": ["111111111", "222222222", "333333333"],
      "quantity": 2
    }
  ]
}
```

The system will attempt to use backup products in the order specified if the primary product is out of stock.

### Walmart Smart Cart Options

For Walmart links, you can configure advanced cart behavior:

```json
{
  "cartUrlOptions": {
    "mode": "auto",
    "fallbackMode": "items",
    "includeStoreId": "auto",
    "preferItemsForWalmart": true,
    "preferOffersForMarketplace": false
  },
  "storeId": "12345",
  "defaultStoreId": "12345",
  "preferredStoreId": "12345"
}
```

**Cart URL Modes:**
- `auto`: Automatically choose the best mode
- `offer`: Use offer-based URLs
- `items`: Use items-based URLs

### UTM Parameters

Add UTM tracking to your links:

```json
{
  "utmParameters": {
    "utm_source": "email",
    "utm_medium": "newsletter",
    "utm_campaign": "summer_sale",
    "utm_content": "button_cta"
  }
}
```

### Custom Redirect URLs

Specify a custom fallback or redirect URL:

```json
{
  "customUrl": "https://yoursite.com/fallback",
  "redirectUrl": "https://yoursite.com/redirect",
  "fallbackUrl": "https://yoursite.com/backup"
}
```

## Testing

### Using cURL

```bash
# Custom URL Link
curl -X POST https://us-central1-incarts.cloudfunctions.net/generateLinkHttp \
  -H "Content-Type: application/json" \
  -d '{
    "linkType": "1",
    "retailerStep": 2,
    "linkName": "Test Link",
    "originalUrl": "https://example.com",
    "projectId": "test_proj",
    "projectName": "Test Project",
    "userId": "test_user"
  }'
```

```bash
# Walmart Product Link
curl -X POST https://us-central1-incarts.cloudfunctions.net/generateLinkHttp \
  -H "Content-Type: application/json" \
  -d '{
    "linkType": "2",
    "linkName": "Walmart Test",
    "selectedWebsite": "Walmart.com",
    "selectedAction": "Add Items to Cart",
    "selectedProducts": ["123456789"],
    "projectId": "test_proj",
    "projectName": "Test Project",
    "userId": "test_user"
  }'
```

## CORS Configuration

The function accepts requests from the following origins:
- `http://localhost:3000`
- `http://localhost:*` (any port)
- `https://*.flutterflow.app`
- `https://*.incarts.beta`
- `https://rrd.incarts.co`
- `https://beta.incarts.co`
- `https://staging.incarts.co`
- `https://*.us-central1.hosted.app`

## Error Handling

The API uses standard HTTP status codes:
- `200`: Success
- `400`: Bad request (missing/invalid parameters)
- `404`: Resource not found
- `500`: Internal server error

Always check the `success` field in the response to determine if the request was successful.

## Rate Limiting

Currently, there are no explicit rate limits, but the function has the following resource constraints:
- Memory: 512 MiB
- Region: us-central1
- Timeout: Default Firebase Functions timeout

## Support

For issues or questions:
1. Check the Swagger documentation for detailed parameter information
2. Review error messages for specific guidance
3. Contact API support team

## Version History

- **v1.0.5** (Jul-29-2025): Security fix for API keys
- **v1.0.4** (Jul-29-2025): Remove hardcoded API keys
- **v1.0.3** (May-15-2025): Add staging.incarts.co to CORS
- **v1.0.2** (Apr-29-2025): Add backup products feature
- **v1.0.1** (Mar-11-2025): Add rrd.incarts.co to CORS
