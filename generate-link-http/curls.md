# Example cURL Requests for Link Generation Function

This document provides examples of cURL requests that can be used to interact with the `generateLinkHttp` function.

## Base URL

```
https://us-central1-incarts.cloudfunctions.net/generateLinkHttp
```

## 1. Generate Custom URL Link

```bash
curl -X POST "https://us-central1-incarts.cloudfunctions.net/generateLinkHttp" \
  -H "Content-Type: application/json" \
  -d '{
    "linkType": "1",
    "retailerStep": 2,
    "linkName": "My Custom Link",
    "publicLinkName": "Public Display Name",
    "originalUrl": "https://example.com/my-product-page",
    "linkValue": 10,
    "utmParameters": {
      "utm_source": "incarts",
      "utm_medium": "custom_link",
      "utm_campaign": "example_campaign"
    },
    "projectId": "project123",
    "projectName": "Example Project",
    "userId": "user123",
    "linkTags": ["tag1", "tag2"]
  }'
```

## 2. Generate Product Link (Item Page)

```bash
curl -X POST "https://us-central1-incarts.cloudfunctions.net/generateLinkHttp" \
  -H "Content-Type: application/json" \
  -d '{
    "linkType": "2",
    "linkName": "Walmart Product Link",
    "publicLinkName": "Great Deals on Groceries",
    "selectedWebsite": "Walmart.com",
    "selectedAction": "Item Page",
    "selectedRetailer": "Walmart",
    "selectedProducts": ["123456789"],
    "projectId": "project123",
    "projectName": "Example Project",
    "userId": "user123",
    "linkTags": ["groceries", "deals"]
  }'
```

## 2a. Generate Walmart Add to Cart Link

```bash
curl -X POST "https://us-central1-incarts.cloudfunctions.net/generateLinkHttp" \
  -H "Content-Type: application/json" \
  -d '{
    "linkType": "2",
    "linkName": "Walmart Add to Cart Link",
    "publicLinkName": "Quick Add to Cart",
    "selectedWebsite": "Walmart.com",
    "selectedAction": "Add Items to Cart",
    "selectedRetailer": "Walmart",
    "selectedProducts": ["123456789", "987654321", "567891234"],
    "projectId": "project123",
    "projectName": "Example Project",
    "userId": "user123",
    "linkTags": ["groceries", "quick-cart"]
  }'
```

When using "Walmart.com" with "Add Items to Cart", the function generates a special URL that automatically adds the specified products to the Walmart shopping cart. Multiple product IDs can be provided in the `selectedProducts` array, and they will be combined into a single cart URL.

The resulting URL will be in this format:
```
https://www.walmart.com/affil/cart/addToCart?offers=123456789,987654321,567891234
```

This URL, when accessed, will automatically add all the specified products to the user's Walmart cart in a single action. The page type will also be set to "ATC" (Add To Cart) in the link document.

## 3. Generate Instacart Shopping List

```bash
curl -X POST "https://us-central1-incarts.cloudfunctions.net/generateLinkHttp" \
  -H "Content-Type: application/json" \
  -d '{
    "linkType": "2",
    "linkName": "Weekly Grocery List",
    "publicLinkName": "My Weekly Groceries",
    "selectedWebsite": "Instacart.com",
    "selectedAction": "Shopping List",
    "selectedRetailer": "Instacart",
    "instacartRetailer": "
    ",
    "projectId": "project123",
    "projectName": "Example Project",
    "userId": "user123",
    "linkTags": ["weekly", "groceries"],
    "shoppingListData": {
      "title": "Weekly Grocery List",
      "imageUrl": "https://example.com/grocery-image.jpg",
      "instructions": "These are the items for this week's meals",
      "lineItems": [
        {
          "name": "Organic Bananas",
          "quantity": 1,
          "unit_of_measure": "bunch"
        },
        {
          "name": "Whole Milk",
          "quantity": 1,
          "unit_of_measure": "gallon"
        },
        {
          "name": "Sliced Bread",
          "quantity": 2,
          "unit_of_measure": "loaf"
        }
      ]
    }
  }'
```

## 4. Generate Shoppable Page Link

```bash
curl -X POST "https://us-central1-incarts.cloudfunctions.net/generateLinkHttp" \
  -H "Content-Type: application/json" \
  -d '{
    "linkType": "3",
    "linkName": "Summer Recipe Collection",
    "publicLinkName": "Summer Recipes",
    "shoppablePageId": "page123",
    "projectId": "project123",
    "projectName": "Example Project",
    "userId": "user123",
    "linkTags": ["summer", "recipes"]
  }'
```

## Response Format

A successful response will look like:

```json
{
  "success": true,
  "shortLink": "https://inc.co/abc123",
  "shortId": "abc123",
  "qrCodeUrl": "https://storage.googleapis.com/incarts-qrcodes/abc123.png",
  "linkDocId": "uniqueDocumentId"
}
```

Error responses will include:

```json
{
  "success": false,
  "error": "Error message describing what went wrong"
}
