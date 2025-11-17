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

    _Note: Replace `[project-id]` in the Base URL below with your actual Firebase project ID._

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

| Parameter   | Type   | Required | Description                 |
| ----------- | ------ | -------- | --------------------------- |
| linkType    | string | Yes      | Link type: "1", "2", or "3" |
| linkName    | string | Yes      | Private name for the link   |
| projectId   | string | Yes      | Current project identifier  |
| projectName | string | Yes      | Project name                |
| userId      | string | Yes      | User identifier             |

**Optional common parameters:**

| Parameter      | Type     | Required | Description                   | Example                                    |
| -------------- | -------- | -------- | ----------------------------- | ------------------------------------------ |
| publicLinkName | string   | No       | Public display name           | "Summer Sale Product"                      |
| linkValue      | number   | No       | Value for analytics           | 10                                         |
| utmParameters  | object   | No       | UTM tracking parameters       | {"source": "facebook", "medium": "social"} |
| linkTags       | string[] | No       | Tags associated with the link | ["promo", "summer2025"]                    |

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

**Standard Request:**

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

**With Backup Products:**

The backup products feature allows you to specify alternative products that can be used if the primary products are out of stock. This is particularly useful for Walmart where product availability can vary.

```bash
curl -X POST https://us-central1-[project-id].cloudfunctions.net/generateLinkHttp \
  -H "Content-Type: application/json" \
  -d '{
    "linkType": "2",
    "linkName": "Walmart Cart with Backups",
    "selectedWebsite": "Walmart.com",
    "selectedAction": "Add Items to Cart",
    "useBackups": true,
    "selectedProducts": [
      {
        "primaryId": "123456789",
        "backupIds": ["987654321", "456789123"]
      },
      {
        "primaryId": "111222333",
        "backupIds": ["444555666"]
      }
    ],
    "backupProducts": "[{\"primaryId\":\"123456789\",\"backupIds\":[\"987654321\",\"456789123\"]},{\"primaryId\":\"111222333\",\"backupIds\":[\"444555666\"]}]",
    "projectId": "project123",
    "projectName": "My Project",
    "userId": "user123"
  }'
```

**Backup Products Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| useBackups | boolean | Yes (for backup feature) | Enables backup product functionality |
| selectedProducts | array of objects | Yes | When useBackups=true, each object must have primaryId and optionally backupIds |
| selectedProducts[].primaryId | string | Yes | The primary Walmart product ID |
| selectedProducts[].backupIds | string[] | No | Array of backup product IDs to try if primary is unavailable |
| backupProducts | string (JSON) | No | JSON string representation of backup mappings for storage |

**Note:** When `useBackups` is true, the generated URL will initially contain only the primary product IDs. The actual fallback logic to backup products happens at the redirect/resolution layer, not during link generation.

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
- `instacartRetailer` is optional but will be appended to the URL if provided

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
    "instacartRetailer": "kroger",
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

**Shopping List Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| shoppingListData | object | Yes | Contains shopping list details |
| shoppingListData.title | string | Yes | Title of the shopping list |
| shoppingListData.imageUrl | string | Yes | URL of the shopping list image |
| shoppingListData.instructions | string | No | Optional instructions for the list |
| shoppingListData.lineItems | array | Yes | Array of items in the shopping list |
| instacartRetailer | string | No | Specific Instacart retailer (e.g., "kroger", "safeway") |

_Note: This action involves an API call to Instacart's Products Link API._

##### 2.5 Instacart Recipe

**Conditions:**

- `linkType` must be `"2"`
- `selectedWebsite` must be `"Instacart.com"`
- `selectedAction` must be `"Recipe"`
- `recipeData` object is required with specific fields
- `instacartRetailer` is optional but will be appended to the URL if provided

```bash
curl -X POST https://us-central1-[project-id].cloudfunctions.net/generateLinkHttp \
  -H "Content-Type: application/json" \
  -d '{
    "linkType": "2",
    "linkName": "Recipe Link",
    "selectedWebsite": "Instacart.com",
    "selectedAction": "Recipe",
    "instacartRetailer": "walmart",
    "recipeData": {
      "title": "Chicken Parmesan",
      "image_url": "https://example.com/recipe-image.jpg",
      "author": "Chef John",
      "servings": 4,
      "cooking_time": 45,
      "instructions": [
        "Preheat oven to 375°F",
        "Bread the chicken cutlets",
        "Fry until golden brown",
        "Top with sauce and cheese",
        "Bake for 20 minutes"
      ],
      "ingredients": [
        {
          "name": "Chicken breast",
          "display_text": "2 lbs boneless chicken breast",
          "upcs": ["012345678901"],
          "measurements": [
            {
              "quantity": 2,
              "unit": "lbs"
            }
          ]
        },
        {
          "name": "Marinara sauce",
          "display_text": "2 cups marinara sauce",
          "measurements": [
            {
              "quantity": 2,
              "unit": "cups"
            }
          ],
          "filters": {
            "brand_filters": ["Rao's", "Barilla"]
          }
        },
        {
          "name": "Mozzarella cheese",
          "display_text": "1 cup shredded mozzarella",
          "measurements": [
            {
              "quantity": 1,
              "unit": "cup"
            }
          ]
        }
      ],
      "landing_page_configuration": {
        "partner_linkback_url": "https://myrecipesite.com",
        "enable_pantry_items": true
      }
    },
    "projectId": "project123",
    "projectName": "My Project",
    "userId": "user123"
  }'
```

**Recipe Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| recipeData | object | Yes | Contains recipe details |
| recipeData.title | string | Yes | Recipe title |
| recipeData.image_url | string | No | URL of the recipe image |
| recipeData.author | string | No | Recipe author name |
| recipeData.servings | number | No | Number of servings |
| recipeData.cooking_time | number | No | Cooking time in minutes |
| recipeData.instructions | string[] | No | Array of cooking instructions |
| recipeData.ingredients | array | Yes | Array of ingredient objects |
| recipeData.ingredients[].name | string | Yes | Ingredient name |
| recipeData.ingredients[].display_text | string | No | Display text for ingredient |
| recipeData.ingredients[].upcs | string[] | No | Array of UPC codes |
| recipeData.ingredients[].measurements | array | No | Measurement details |
| recipeData.ingredients[].filters | object | No | Brand and health filters |
| instacartRetailer | string | No | Specific Instacart retailer |

_Note: This action involves an API call to Instacart's Recipe API._

##### 2.6 Amazon Product Cart

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

##### 2.7 Kroger Product Page

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

- Missing Required Parameters (e.g., `linkType`, `linkName`)
- Invalid Link Type Configuration (e.g., missing `originalUrl` for Type 1)
- Missing Product Information (e.g., `selectedWebsite`, `selectedAction`, `selectedProducts` for Type 2)
- Missing Shoppable Page ID (for Type 3)
- URL Shortener Service Error
- QR Code Generation Error
- Invalid Shopping List Data (for Instacart Shopping List)
- Missing Shopping List Fields
- Database Error (Firestore)

## Technical Implementation Details

### Architecture Overview

The function follows this flow:

1. **Request Validation**: Validates required parameters based on link type
2. **URL Generation**: Creates the appropriate URL based on retailer and action
3. **URL Shortening**: Calls external API to create shortened URL
4. **QR Code Generation**: Generates QR code for the shortened URL
5. **Data Persistence**: Stores link metadata in Firestore
6. **Response**: Returns shortened URL, QR code, and document ID

### External Service Dependencies

| Service                | Endpoint                                                        | Purpose                |
| ---------------------- | --------------------------------------------------------------- | ---------------------- |
| URL Shortener          | `https://incarts-url-shortener-qob6vapoca-uc.a.run.app/shorten` | Creates shortened URLs |
| QR Code Generator      | `https://us-central1-incarts.cloudfunctions.net/generateQRCode` | Generates QR codes     |
| Instacart Products API | `https://connect.instacart.com/idp/v1/products/products_link`   | Creates shopping lists |
| Instacart Recipe API   | `https://connect.instacart.com/idp/v1/products/recipe`          | Creates recipe links   |

### Firestore Data Structure

When a link is created, the following document structure is stored in the `links` collection:

```javascript
{
  // Core Fields
  "docId": "uniqueDocumentId20Chars",
  "name": "Private link name",
  "publicName": "Public display name",
  "linkactiveflag": true,

  // URLs and Codes
  "longLink": "https://original-destination-url.com",
  "shortLink": "https://short.url/abc123",
  "shortlinkwithouthttps": "short.url/abc123",
  "urlShortCode": "abc123",
  "qrCode": "https://storage.googleapis.com/qrcodes/abc123.png",
  "linkqrcodeimgurl": "https://storage.googleapis.com/qrcodes/abc123.png",

  // Metadata
  "created": {
    "userId": "user123",
    "userRef": DocumentReference("users/user123"),
    "timestamp": Timestamp
  },

  "projectDetails": {
    "projectId": "project123",
    "projectName": "My Project",
    "projectRef": DocumentReference("projects/project123")
  },

  // Analytics
  "linkValue": 29.99,
  "pageType": "Link" | "ATC",  // ATC for Add to Cart links
  "utmParameters": {
    "source": "instagram",
    "medium": "social",
    "campaign": "summer_sale"
  },
  "linkTags": ["promo", "summer"],

  // Retailer-Specific (for linkType "2")
  "siteplainname": "Walmart",  // Retailer name
  "siteRetailer": "kroger",    // Instacart-specific retailer

  // Backup Products (when useBackups is true)
  "useBackups": true,
  "backupProducts": [
    {
      "primaryId": "123456789",
      "backupIds": ["987654321", "456789123"]
    }
  ],

  // Other
  "description": "-",
  "customUrl": "https://custom-tracking-url.com" // Optional custom URL
}
```

### URL Generation Logic

#### Walmart URLs

- **Item Page**: `https://www.walmart.com/ip/{productId}`
- **Add to Cart**: `https://affil.walmart.com/cart/addToCart?items={productId1},{productId2}`
- **With Backups**: Only primary IDs are used in initial URL

#### Instacart URLs

- **Item Page**: `https://www.instacart.com/products/{productId}?retailerSlug={retailer}`
- **Shopping List**: Generated via API call, returns unique Instacart URL
- **Recipe**: Generated via API call, returns unique Instacart recipe URL
- **Retailer Parameter**: Appended as `retailer_key` query parameter when provided

#### Amazon URLs

- **Item Page**: `https://www.amazon.com/dp/{ASIN}`
- **Add to Cart**: `https://www.amazon.com/gp/aws/cart/add.html?AssociateTag=incartsshoppa-20&ASIN.1={ASIN1}&Quantity.1=1`

#### Kroger URLs

- **Item Page**: `https://www.kroger.com/p/-/{productId}`

### Error Handling

The function returns appropriate HTTP status codes:

- **400**: Bad Request - Missing required parameters or invalid data
- **404**: Not Found - Shoppable page or link record not found
- **500**: Internal Server Error - External service failures or database errors

Common error scenarios:

- Missing required parameters (linkType, linkName, projectId, etc.)
- Invalid link type configuration
- External service failures (URL shortener, QR generator, Instacart API)
- Database operation failures
- Invalid shopping list or recipe data structure

## Development

The Cloud Function code resides in the `functions` directory.

1.  Navigate to the functions directory: `cd functions`
2.  Install dependencies: `npm install`
3.  Build the TypeScript code: `npm run build` (or `npm run build:watch` for continuous building)

Refer to the [Firebase documentation](https://firebase.google.com/docs/functions/local-emulator) for running functions locally using the Firebase Emulator Suite.
