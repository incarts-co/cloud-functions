## Required Changes

### 1. Update generateLinkHttp Function

**File**: `functions/generateLinkHttp/index.ts` (or similar)

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Initialize if not already done
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

export const generateLinkHttp = functions.https.onRequest(async (request, response) => {
  // ... existing validation and setup code ...
  
  try {
    // ... existing link generation logic ...
    
    // After successful link creation and QR generation:
    if (linkDocId && qrCodeUrl && shortId) {
      // NEW: Create default QR record in qrCodes collection
      await createDefaultQRRecord({
        linkId: linkDocId,
        shortId: shortId,
        qrCodeUrl: qrCodeUrl,
        projectId: projectId,
        userId: userId
      });
    }
    
    // Return existing response
    response.json({
      success: true,
      shortLink,
      shortId,
      qrCodeUrl,
      linkDocId
    });
    
  } catch (error) {
    // Existing error handling
  }
});

// NEW: Helper function to create QR record (UPDATED with qrCodeId URL)
async function createDefaultQRRecord(params: {
  linkId: string;
  shortId: string;
  qrCodeUrl: string;
  projectId: string;
  userId: string;
}) {
  // Create the QR record first to get the ID
  const qrRef = await db.collection('qrCodes').doc();
  const qrCodeId = qrRef.id;
  
  const qrRecord = {
    linkId: params.linkId,
    identifier: 'default',  // Default identifier for existing QR codes
    name: 'Default QR Code',
    shortId: params.shortId,
    qrCodeUrl: params.qrCodeUrl,
    accessUrl: `https://in2carts.com/qr/${qrCodeId}`,  // Use qrCodeId in URL
    createdAt: admin.firestore.Timestamp.now(),
    createdBy: params.userId,
    projectId: params.projectId,
    isDefault: true,
    clickCount: 0
  };
  
  // Set the document with the generated ID
  await qrRef.set(qrRecord);
  
  // Update link document with qrCodeCount
  await db.collection('links').doc(params.linkId).update({
    qrCodeCount: 1
  });
}
```