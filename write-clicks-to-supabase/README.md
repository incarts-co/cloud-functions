# Write Clicks to Supabase - Cloud Function

## Overview
This Firebase Cloud Function automatically syncs click tracking data from Firestore to a Supabase database in real-time. It triggers whenever a document is created or updated in the `clicks` collection, enriches the click data with related link and product information, and writes it to a Supabase staging table for analytics and reporting.

## Purpose
- **Real-time Data Sync**: Automatically transfers click analytics from Firestore to Supabase for centralized reporting
- **Data Enrichment**: Combines click events with link metadata and product information
- **Analytics Pipeline**: Prepares structured data for downstream analytics and business intelligence

## Technical Details

### Trigger
- **Type**: Firestore Document Write Trigger (`onDocumentWritten`)
- **Collection Path**: `clicks/{clickId}`
- **Events**: Fires on document create, update, or delete

### Configuration
- **Region**: us-central1
- **Memory**: 1GB
- **Timeout**: 300 seconds (5 minutes)
- **Max Instances**: 10
- **Runtime**: Node.js 22

## Data Flow

### 1. Input - Click Document (Firestore)
When a click event is recorded in Firestore's `clicks` collection, it contains:

```javascript
{
  // Core Click Data
  "shortId": "abc123",              // Required: Link's short code that was clicked
  "timestamp": "2024-01-15T10:30:00Z",
  "shortLink": "https://short.link/abc123",
  
  // User Context
  "deviceType": "mobile",
  "userAgent": "Mozilla/5.0...",
  "ipAddress": "192.168.1.1",
  "referrer": "https://example.com",
  
  // Geographic Data (from IP)
  "geoipData": {
    "city": "New York",
    "country": "United States",
    "region": "NY",
    "postal": "10001",
    "location": {
      "latitude": 40.7128,
      "longitude": -74.0060,
      "timeZone": "America/New_York",
      "accuracyRadius": 10
    }
  },
  
  // Campaign/Marketing
  "campaignId": "camp_123",
  "campaign_name": "Summer Sale 2024",
  "influencerId": "inf_456",
  
  // Link Context
  "linkType": "ATC",                // Add to Cart, Shoppable, Link, etc.
  "linkSiteName": "Amazon",
  "linkTags": ["summer", "sale"],
  "productId": "prod_789",
  
  // Project Association
  "projectDetails": {
    "projectId": "proj_abc",
    "projectName": "Q1 Campaign"
  }
}
```

### 2. Data Enrichment
The function fetches additional data from two Firestore collections:

#### Links Collection (`links/{linkId}`)
```javascript
{
  "urlShortCode": "abc123",         // Matches click.shortId
  "name": "Summer Sale Product",
  "longLink": "https://retailer.com/product/full-url",
  "shortLink": "https://short.link/abc123",
  "linkValue": 99.99,
  "linkactiveflag": true,
  "pageType": "ATC",
  "siteRetailer": "Amazon",
  "siteplainname": "amazon.com",
  "linkTags": ["summer", "electronics"],
  "productId": "prod_789",
  "qrCode": "https://qr.code/image.png",
  "utmParameters": {
    "utm_source": "instagram",
    "utm_medium": "social",
    "utm_campaign": "summer_sale"
  },
  "created": {
    "timestamp": "2024-01-01T00:00:00Z",
    "userId": "user_123"
  },
  "projectDetails": {
    "projectId": "proj_abc",
    "projectName": "Q1 Campaign"
  }
}
```

#### Products Collection (`products/{productId}`)
```javascript
{
  "name": "Wireless Headphones",
  "productPrice": 149.99,
  "brand": "TechBrand",
  "category": "Electronics",
  "upc": "012345678905"
}
```

### 3. Output - Supabase Table (`link_clicks`)
The enriched data is written to Supabase with this structure:

```javascript
{
  // Identifiers
  "firestore_id": "click_doc_123",        // Primary key for upserts
  "short_id": "abc123",
  
  // Timestamps
  "timestamp": "2024-01-15T10:30:00Z",    // Click timestamp
  "last_updated": "2024-01-15T10:30:05Z", // Processing timestamp
  
  // User Context
  "device_type": "mobile",
  "user_agent": "Mozilla/5.0...",
  "ip_address": "192.168.1.1",
  "referrer": "https://example.com",
  "influencer_id": "inf_456",
  
  // Geographic Fields (flattened)
  "city_name": "New York",
  "country_name": "United States",
  "state_name": "NY",
  "postal_code": "10001",
  "latitude": 40.7128,
  "longitude": -74.0060,
  "time_zone": "America/New_York",
  "accuracy_radius": 10,
  
  // Link Information
  "name": "Summer Sale Product",          // From link or click
  "short_link": "https://short.link/abc123",
  "link_long_url": "https://retailer.com/product",
  "link_type": "ATC",
  "page_type": "ATC",
  "link_action_type": "ATC",
  "link_site_name": "Amazon",
  "site_plain_name": "amazon.com",
  "link_tags": "summer,electronics",      // Comma-separated
  "qr_code_url": "https://qr.code/image.png",
  "link_created_at": "2024-01-01T00:00:00Z",
  "link_created_by_user_id": "user_123",
  "link_active_flag": true,
  "link_firestore_doc_id": "link_doc_456",
  
  // Project & Campaign
  "project_id": "proj_abc",
  "project_name": "Q1 Campaign",
  "campaign_id": "camp_123",
  "campaign_name": "Summer Sale 2024",
  "campaign_name_from_link": "summer_sale", // From UTM
  
  // UTM Parameters (JSONB)
  "utm_parameters": {
    "utm_source": "instagram",
    "utm_medium": "social",
    "utm_campaign": "summer_sale"
  },
  
  // Product & Value
  "product_id": "prod_789",
  "product_name": "Wireless Headphones",
  "product_brand": "TechBrand",
  "product_category": "Electronics",
  "product_upc": "012345678905",
  "retailer_name": "Amazon",
  "product_price": 149.99,               // Product price or link value
  "link_value": 99.99,                   // Original link value
  
  // ETL Processing
  "etl_processed_at": null               // Set by downstream ETL
}
```

## Error Handling

### Missing Data Scenarios
- **No shortId**: Logs warning, returns minimal data
- **Link not found**: Logs warning, continues with click data only
- **Product not found**: Uses link value as product price fallback
- **Deleted document**: Skips processing, returns null

### Retry Logic
- Function returns `null` on errors (no automatic retries)
- Errors are logged with context for manual investigation
- Supabase upserts use `firestore_id` for conflict resolution

## Deployment

### Prerequisites
1. Firebase project with Firestore database
2. Supabase project with `link_clicks` table
3. Node.js 22 runtime support

### Environment Setup
```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Deploy to Firebase
npm run deploy
```

### Required Supabase Table Schema
```sql
CREATE TABLE link_clicks (
  firestore_id TEXT PRIMARY KEY,
  short_id TEXT,
  timestamp TIMESTAMPTZ,
  last_updated TIMESTAMPTZ,
  
  -- User context
  device_type TEXT,
  user_agent TEXT,
  ip_address TEXT,
  referrer TEXT,
  influencer_id TEXT,
  
  -- Geographic
  city_name TEXT,
  country_name TEXT,
  state_name TEXT,
  postal_code TEXT,
  latitude DECIMAL,
  longitude DECIMAL,
  time_zone TEXT,
  accuracy_radius INTEGER,
  
  -- Link data
  name TEXT,
  short_link TEXT,
  link_long_url TEXT,
  link_type TEXT,
  page_type TEXT,
  link_action_type TEXT,
  link_site_name TEXT,
  site_plain_name TEXT,
  link_tags TEXT,
  qr_code_url TEXT,
  link_created_at TIMESTAMPTZ,
  link_created_by_user_id TEXT,
  link_active_flag BOOLEAN,
  link_firestore_doc_id TEXT,
  
  -- Project/Campaign
  project_id TEXT,
  project_name TEXT,
  campaign_id TEXT,
  campaign_name TEXT,
  campaign_name_from_link TEXT,
  utm_parameters JSONB,
  
  -- Product
  product_id TEXT,
  product_name TEXT,
  product_brand TEXT,
  product_category TEXT,
  product_upc TEXT,
  retailer_name TEXT,
  product_price DECIMAL,
  link_value DECIMAL,
  
  -- ETL
  etl_processed_at TIMESTAMPTZ
);

-- Recommended indexes
CREATE INDEX idx_short_id ON link_clicks(short_id);
CREATE INDEX idx_timestamp ON link_clicks(timestamp);
CREATE INDEX idx_campaign_id ON link_clicks(campaign_id);
CREATE INDEX idx_product_id ON link_clicks(product_id);
```

## Monitoring

### Logs
Access function logs via Firebase Console or CLI:
```bash
npm run logs
```

### Key Log Events
- **Processing start**: Click ID and full data
- **Enrichment warnings**: Missing links/products
- **Supabase operations**: Success/failure with data
- **Errors**: Full stack traces with context

### Performance Metrics
- Average execution time: ~1-2 seconds
- Memory usage: Typically under 512MB
- Concurrent executions: Up to 10 instances

## Security Considerations
- Supabase credentials are hardcoded (consider using Secret Manager)
- Function has read access to all Firestore collections
- No PII validation or sanitization implemented
- IP addresses are stored (consider privacy regulations)

## Limitations
- Maximum 5-minute timeout per execution
- No built-in retry mechanism for failed syncs
- Deletes in Firestore don't delete from Supabase
- UTM parameters must be JSONB-compatible in Supabase

## Troubleshooting

### Common Issues
1. **"Link not found" warnings**: Verify `urlShortCode` matches `shortId`
2. **Supabase upsert failures**: Check table schema and data types
3. **Timeout errors**: Consider batching or increasing timeout
4. **Memory errors**: Reduce concurrent executions or increase memory

### Debug Steps
1. Check Firebase Functions logs for errors
2. Verify Firestore document structure
3. Test Supabase connection independently
4. Validate data types match schema
5. Monitor function metrics in Firebase Console

## Support
For issues or questions about this function, contact the engineering team or check the internal documentation.