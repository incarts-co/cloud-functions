# Testing Your Swagger Documentation

Your `swagger.json` file has been validated and is correct! ✅

## Validation Status

```bash
✅ OpenAPI Version: 3.2.0 (Latest)
✅ Syntax: Valid
✅ Schema: Valid
✅ Best Practices: Passed
```

## Methods to Test and View Your Documentation

### Method 1: Local HTML Viewer (Easiest - No Installation)

**Step 1:** Open the included `test-swagger.html` file in your browser

```bash
# From the functions directory
open test-swagger.html
# or on Linux
xdg-open test-swagger.html
```

This will load an interactive Swagger UI where you can:
- ✅ View all endpoints
- ✅ See request/response examples
- ✅ Try out the API (if CORS allows)
- ✅ Download the spec

**Note:** For the HTML file to work, both `test-swagger.html` and `swagger.json` must be in the same directory.

---

### Method 2: Online Swagger Editor (Zero Installation)

**Step 1:** Go to https://editor.swagger.io/

**Step 2:** Copy the contents of `swagger.json`

**Step 3:** Paste into the left panel

You'll see:
- ✅ Interactive documentation on the right
- ✅ Real-time validation
- ✅ Ability to generate client SDKs
- ✅ Export to different formats

---

### Method 3: Swagger UI via HTTP Server

**Option A: Using Python**
```bash
# From the functions directory
python3 -m http.server 8080
```

Then visit: http://localhost:8080/test-swagger.html

**Option B: Using Node.js http-server**
```bash
npx http-server -p 8080
```

Then visit: http://localhost:8080/test-swagger.html

---

### Method 4: Redocly Documentation (Professional Look)

Generate beautiful static documentation:

```bash
cd /Users/alikibao/Desktop/Github/incarts/cloud-functions/generate-link-http/functions

# Generate HTML documentation
npx @redocly/cli build-docs swagger.json --output redoc-static.html

# Open the generated file
open redoc-static.html
```

This creates a single-page HTML file with a professional, clean design.

---

### Method 5: Postman (For Testing API Calls)

**Step 1:** Open Postman

**Step 2:** Click "Import" → "Upload Files"

**Step 3:** Select `swagger.json`

**Step 4:** Postman will automatically create:
- ✅ A collection with all endpoints
- ✅ Pre-filled example requests
- ✅ Environment variables (if any)

**Step 5:** You can now test actual API calls!

---

### Method 6: VS Code Extension (For Developers)

**Step 1:** Install "OpenAPI (Swagger) Editor" extension in VS Code

**Step 2:** Open `swagger.json`

**Step 3:** Right-click → "Preview Swagger"

You'll get an in-editor preview with:
- ✅ IntelliSense for editing
- ✅ Real-time validation
- ✅ Side-by-side preview

---

### Method 7: CLI Validation (Command Line)

Validate your spec anytime:

```bash
# Using Redocly CLI (recommended - supports 3.2.0)
npx @redocly/cli lint swagger.json

# Generate a validation report
npx @redocly/cli lint swagger.json --format=stylish
```

---

## Creating a Documentation Endpoint (Optional)

If you want to serve your documentation as part of your Firebase Functions:

### Option A: Separate HTTP Function

Create a new file `functions/src/apiDocs.ts`:

```typescript
import { onRequest } from "firebase-functions/v2/https";
import * as fs from "fs";
import * as path from "path";

export const apiDocs = onRequest(
  {
    region: "us-central1",
  },
  async (request, response) => {
    const swaggerJson = fs.readFileSync(
      path.join(__dirname, "../swagger.json"),
      "utf8"
    );

    const html = \`
<!DOCTYPE html>
<html>
<head>
  <title>Generate Link HTTP API</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = function() {
      SwaggerUIBundle({
        spec: \${swaggerJson},
        dom_id: '#swagger-ui',
        presets: [SwaggerUIBundle.presets.apis]
      });
    };
  </script>
</body>
</html>
    \`;

    response.set("Content-Type", "text/html");
    response.send(html);
  }
);
```

Then export it in `functions/src/index.ts`:

```typescript
export { apiDocs } from "./apiDocs";
```

Deploy:
```bash
firebase deploy --only functions:apiDocs
```

Access at: `https://us-central1-incarts.cloudfunctions.net/apiDocs`

---

## Quick Test Commands

### Validate Spec
```bash
npx @redocly/cli lint swagger.json
```

### Generate Static HTML
```bash
npx @redocly/cli build-docs swagger.json -o docs.html
```

### Bundle Spec (Resolve all $refs)
```bash
npx @redocly/cli bundle swagger.json -o bundled-swagger.json
```

### Preview with Local Server
```bash
npx @redocly/cli preview-docs swagger.json
```

This will start a live preview server at http://127.0.0.1:8080

---

## Recommended Testing Workflow

1. **During Development:**
   - Use VS Code extension for live preview
   - Run `npx @redocly/cli lint swagger.json` to validate

2. **For Sharing with Team:**
   - Use online Swagger Editor: https://editor.swagger.io/
   - Or generate static HTML: `npx @redocly/cli build-docs swagger.json -o docs.html`

3. **For API Testing:**
   - Import into Postman
   - Test actual endpoints with example payloads

4. **For Production:**
   - Consider deploying a documentation endpoint
   - Or host the static HTML on your website

---

## Example: Test with cURL

Once you've viewed the docs, test the actual API:

```bash
curl -X POST https://us-central1-incarts.cloudfunctions.net/generateLinkHttp \
  -H "Content-Type: application/json" \
  -d '{
    "linkType": "1",
    "retailerStep": 2,
    "linkName": "Test Link",
    "originalUrl": "https://example.com",
    "projectId": "test_proj",
    "projectName": "Test",
    "userId": "test_user"
  }'
```

---

## Troubleshooting

### Issue: "Unsupported OpenAPI version: 3.2.0"
**Solution:** Use Redocly CLI instead of swagger-cli
```bash
npx @redocly/cli lint swagger.json
```

### Issue: CORS error when testing API
**Solution:** Your endpoint has CORS configured. Make sure requests come from allowed origins.

### Issue: HTML file doesn't load swagger.json
**Solution:** Serve via HTTP server, not file:// protocol
```bash
python3 -m http.server 8080
open http://localhost:8080/test-swagger.html
```

---

## Next Steps

1. ✅ View documentation: Open `test-swagger.html` in browser
2. ✅ Validate changes: Run `npx @redocly/cli lint swagger.json`
3. ✅ Share with team: Upload to Swagger Editor or generate static HTML
4. ✅ Test API: Import to Postman and test endpoints

Your API documentation is ready to use! 🎉
