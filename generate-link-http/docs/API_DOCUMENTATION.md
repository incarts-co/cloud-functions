# InCarts Link Generation & QR Code API Documentation

## Overview

The InCarts Link Generation API provides endpoints for creating shoppable links with integrated QR code tracking. This API enables you to:

- Generate shortened URLs for products across multiple retailers
- Create trackable QR codes for physical marketing materials
- Differentiate between QR scans and direct link clicks
- Support multiple QR codes per link for granular campaign tracking

## Base URL

```
Production: https://incarts-url-shortener-263676641320.us-central1.run.app
development-cloud: https://incarts-url-shortener-dev-263676641320.us-central1.run.app
Local Development: http://localhost:5001/incarts/us-central1
```

## Authentication

Currently, the API uses CORS validation. Ensure your domain is whitelisted in the allowed origins list.

Allowed origins:
- `http://localhost:3000`
- `https://*.flutterflow.app`
- `https://*.incarts.beta`
- `https://rrd.incarts.co`
- `https://beta.incarts.co`
- `https://staging.incarts.co`
- `https://app.incarts.co`

## Endpoints

### 1. Generate Link with QR Code

**Endpoint:** `POST /generateLinkHttp`

Creates a shortened link with an automatically generated default QR code. Supports three types of links:
- Type 1: Custom URL links
- Type 2: Product links (retailer-specific)
- Type 3: Shoppable page links

#### Request Body Schema

```typescript
{
  // Required fields
  linkType: "1" | "2" | "3";        // Type of link to create
  linkName: string;                  // Private name for internal reference
  projectId: string;                 // Project identifier
  projectName: string;               // Project display name
  userId: string;                    // User creating the link
  
  // Optional common fields
  publicLinkName?: string;           // Public-facing name
  linkValue?: number;                // Value for analytics (default: 0)
  utmParameters?: object;            // UTM tracking parameters
  linkTags?: string[];               // Tags for organization
  
  // Type 1 (Custom URL) specific
  retailerStep?: 1 | 2;             // 1=retailer selection, 2=custom link
  originalUrl?: string;              // The destination URL
  customUrl?: string;                // Optional custom short URL
  
  // Type 2 (Product Link) specific
  selectedWebsite?: string;          // "Walmart.com", "Amazon.com", etc.
  selectedAction?: string;           // "Item Page", "Add Items to Cart", etc.
  selectedRetailer?: string;         // "Walmart", "Amazon", etc.
  instacartRetailer?: string;        // For Instacart links
  selectedProducts?: string[];       // Array of product IDs/ASINs
  
  // Shopping List specific
  shoppingListData?: {
    title: string;
    imageUrl: string;
    instructions?: string;
    lineItems: Array<{
      upc?: string;
      quantity?: number;
      item_name?: string;
    }>;
  };
  
  // Recipe specific
  recipeData?: {
    title: string;
    image_url?: string;
    author?: string;
    servings?: number;
    cooking_time?: number;
    instructions?: string[];
    ingredients: Array<{
      name: string;
      display_text?: string;
      upcs?: string[];
      measurements?: Array<{
        quantity?: number;
        unit?: string;
      }>;
    }>;
  };
  
  // Type 3 (Shoppable Page) specific
  shoppablePageId?: string;          // ID of shoppable page
  
  // Backup products feature
  useBackups?: boolean;              // Enable backup products
  backupProducts?: string;           // JSON string of backup configs
}
```

#### Response Schema

```typescript
{
  success: boolean;
  shortLink?: string;        // The shortened URL (e.g., "https://in2carts.com/w/abc123")
  shortId?: string;          // Short code identifier (e.g., "abc123")
  qrCodeUrl?: string;        // URL to the QR code image
  linkDocId?: string;        // Firestore document ID for the link
  error?: string;            // Error message if success is false
}
```

#### Example Requests

##### Custom URL Link (Type 1)
```json
{
  "linkType": "1",
  "retailerStep": 2,
  "linkName": "Black Friday Sale",
  "publicLinkName": "50% Off Everything",
  "originalUrl": "https://example.com/black-friday",
  "linkValue": 500,
  "utmParameters": {
    "utm_source": "qr_code",
    "utm_medium": "print",
    "utm_campaign": "black_friday_2025"
  },
  "projectId": "project-123",
  "projectName": "Holiday Campaign",
  "userId": "user-456",
  "linkTags": ["sale", "black-friday", "2025"]
}
```

##### Walmart Product Link (Type 2)
```json
{
  "linkType": "2",
  "linkName": "TV Deal",
  "selectedWebsite": "Walmart.com",
  "selectedAction": "Item Page",
  "selectedRetailer": "Walmart",
  "selectedProducts": ["551149382"],
  "projectId": "project-123",
  "projectName": "Electronics Campaign",
  "userId": "user-456"
}
```

##### Amazon Multi-Product Cart (Type 2)
```json
{
  "linkType": "2",
  "linkName": "Tech Bundle",
  "selectedWebsite": "Amazon.com",
  "selectedAction": "Add Items to Cart",
  "selectedRetailer": "Amazon",
  "selectedProducts": ["B08N5WRWNW", "B08L5WGQGJ", "B07FZ8S74R"],
  "projectId": "project-123",
  "projectName": "Bundle Deals",
  "userId": "user-456"
}
```

##### Instacart Shopping List (Type 2)
```json
{
  "linkType": "2",
  "linkName": "Weekly Groceries",
  "selectedWebsite": "Instacart.com",
  "selectedAction": "Shopping List",
  "selectedRetailer": "Instacart",
  "instacartRetailer": "kroger",
  "shoppingListData": {
    "title": "Family Dinner Ingredients",
    "imageUrl": "https://example.com/dinner.jpg",
    "instructions": "Organic preferred when available",
    "lineItems": [
      {
        "upc": "0001111041700",
        "quantity": 2
      },
      {
        "item_name": "Organic Bananas",
        "quantity": 6
      }
    ]
  },
  "projectId": "project-123",
  "projectName": "Meal Planning",
  "userId": "user-456"
}
```

### 2. Create Additional QR Code

**Endpoint:** `POST /createAdditionalQRCode`

Creates additional QR codes for an existing link, enabling campaign-specific tracking.

#### Request Body Schema

```typescript
{
  linkId: string;          // Existing link document ID (required)
  identifier: string;      // Unique identifier for QR code (required)
  name: string;           // Display name for the QR code (required)
  userId: string;         // User creating the QR code (required)
  customData?: object;    // Optional metadata for tracking
}
```

#### Response Schema

```typescript
{
  success: boolean;
  qrCodeId?: string;      // The QR code identifier
  qrCodeUrl?: string;     // URL to the QR code image
  qrUrl?: string;         // The URL encoded in the QR code
  error?: string;         // Error message if success is false
}
```

#### Example Requests

##### Campaign-Specific QR Code
```json
{
  "linkId": "link-doc-123",
  "identifier": "black-friday-2025",
  "name": "Black Friday Campaign",
  "userId": "user-456",
  "customData": {
    "campaign": "Black Friday",
    "discount": "50%",
    "validFrom": "2025-11-24",
    "validUntil": "2025-11-30"
  }
}
```

##### Location-Based QR Code
```json
{
  "linkId": "link-doc-123",
  "identifier": "store-nyc-times-square",
  "name": "NYC Times Square Store",
  "userId": "user-456",
  "customData": {
    "storeLocation": "Times Square",
    "storeId": "NYC-001",
    "displayType": "window",
    "floor": "1"
  }
}
```

##### Social Media QR Code
```json
{
  "linkId": "link-doc-123",
  "identifier": "instagram-influencer-tech",
  "name": "Tech Influencer Campaign",
  "userId": "user-456",
  "customData": {
    "platform": "Instagram",
    "influencer": "@techreviewer",
    "followers": 50000,
    "postDate": "2025-01-15",
    "contentType": "reel"
  }
}
```

## Error Handling

### HTTP Status Codes

- `200 OK` - Request successful
- `400 Bad Request` - Invalid request parameters
- `404 Not Found` - Resource not found (e.g., link doesn't exist)
- `409 Conflict` - Resource already exists (e.g., duplicate QR identifier)
- `500 Internal Server Error` - Server error

### Error Response Format

```json
{
  "success": false,
  "error": "Detailed error message"
}
```

### Common Error Scenarios

1. **Missing Required Fields**
```json
{
  "success": false,
  "error": "Missing required fields: linkType, linkName, projectId"
}
```

2. **Duplicate QR Code Identifier**
```json
{
  "success": false,
  "error": "QR code with identifier 'black-friday-2025' already exists for this link"
}
```

3. **Link Not Found**
```json
{
  "success": false,
  "error": "Link not found"
}
```

4. **External API Failure**
```json
{
  "success": false,
  "error": "Failed to create Instacart shopping list: Invalid UPC codes"
}
```

## Data Model

### Links Collection

Each generated link creates a document in the `links` collection:

```typescript
{
  docId: string;                    // Document ID
  name: string;                     // Private name
  publicName: string;               // Public display name
  shortLink: string;                // Full shortened URL
  shortlinkwithouthttps: string;    // Short link without protocol
  urlShortCode: string;             // Short code (e.g., "abc123")
  longLink: string;                 // Original destination URL
  originalURL: string;              // Same as longLink
  linkqrcodeimgurl: string;         // QR code image URL
  qrCode: string;                   // Same as linkqrcodeimgurl
  linkactiveflag: boolean;          // Whether link is active
  linkValue: number;                // Analytics value
  pageType: "Link" | "ATC";        // Page type
  utmParameters: object;            // UTM tracking
  linkTags: string[];               // Tags
  qrCodeCount: number;              // Number of QR codes
  created: {
    userId: string;
    userRef: DocumentReference;
    timestamp: Date;
  };
  projectDetails: {
    projectId: string;
    projectName: string;
    projectRef: DocumentReference;
  };
  siteplainname?: string;           // Retailer name
  siteRetailer?: string;            // Instacart retailer
  useBackups?: boolean;             // Backup products enabled
  backupProducts?: object;          // Backup product configs
}
```

### QR Codes Collection

Each QR code creates a document in the `qrCodes` collection:

```typescript
{
  qrCodeId: string;         // Matches document ID (e.g., "black-friday-2025")
  linkId: string;           // Reference to parent link
  shortId: string;          // Short code from link
  name: string;             // Display name
  qrCodeUrl: string;        // QR code image URL
  createdAt: Date;          // Creation timestamp
  createdBy: string;        // User ID
  projectId: string;        // Project ID
  isDefault: boolean;       // Whether this is the default QR
  clickCount: number;       // Click tracking counter
  customData?: object;      // Campaign-specific metadata
}
```

## QR Code URL Structure

Generated QR codes encode URLs in the following format:

- **Default QR**: `https://in2carts.com/qr/default-{linkId}`
- **Custom QR**: `https://in2carts.com/qr/{identifier}`

Examples:
- `https://in2carts.com/qr/default-link-abc123`
- `https://in2carts.com/qr/black-friday-2025`
- `https://in2carts.com/qr/store-nyc-times-square`

## Best Practices

### QR Code Identifiers

1. **Use Descriptive Names**: Choose identifiers that clearly indicate the QR code's purpose
   - Good: `billboard-i95-miami`, `instagram-summer-2025`
   - Bad: `qr1`, `test`, `abc123`

2. **Include Context**: Add location, date, or campaign information
   - `store-{location}-{date}`
   - `{platform}-{campaign}-{year}`

3. **Avoid Special Characters**: Use only alphanumeric characters and hyphens
   - Good: `black-friday-2025`
   - Bad: `black_friday_2025!`

### Custom Data

Use `customData` to store tracking information:

```json
{
  "campaign": "Summer Sale",
  "budget": 5000,
  "startDate": "2025-06-01",
  "endDate": "2025-08-31",
  "targetAudience": "millennials",
  "placement": {
    "type": "billboard",
    "location": "Times Square",
    "size": "14x48"
  }
}
```

### Error Handling in Frontend

```javascript
try {
  const response = await fetch('/generateLinkHttp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestData)
  });
  
  const data = await response.json();
  
  if (!data.success) {
    // Handle specific error cases
    if (data.error.includes('already exists')) {
      // Handle duplicate
    } else if (data.error.includes('not found')) {
      // Handle not found
    }
  }
} catch (error) {
  // Handle network errors
}
```

## Rate Limits

- Maximum 100 requests per minute per IP
- Maximum 1000 requests per hour per project
- Bulk operations should be batched appropriately

## Migration Guide

For existing implementations:

1. **Default QR Codes**: All new links automatically get a default QR code
2. **Document Structure**: QR codes now use identifier as document ID
3. **URL Format**: QR URLs use `/qr/{identifier}` pattern
4. **Backward Compatibility**: Existing short links continue to work

## Support

For issues or questions:
- GitHub Issues: [Report bugs or request features]
- Documentation: [This document]
- API Status: [Check service status]