/**
 * @fileoverview Create Additional QR Codes for Existing Links
 * @description Allows creation of multiple QR codes for tracking different campaigns/locations
 * @module cloud-functions/generate-link-http
 * @related generateLink.ts
 */

import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import axios from "axios";
import * as cors from "cors";

// Configure CORS (same as generateLink)
const corsHandler = cors({
  origin: [
    "http://localhost:3000",
    /^http:\/\/localhost:\d+$/,
    /^https:\/\/.*\.flutterflow\.app$/,
    /^https:\/\/.*\.incarts\.beta$/,
    /^https:\/\/rrd\.incarts\.co$/,
    /^https:\/\/beta\.incarts\.co$/,
    /^https:\/\/staging\.incarts\.co$/,
    /^https:\/\/app\.incarts\.co$/,
    /^https:\/\/.*\.us-central1\.hosted\.app$/,
  ],
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
});

// Initialize Firebase Admin (only if not already initialized)
if (!admin.apps.length) {
  initializeApp();
}
const db = getFirestore();

const QR_CODE_GENERATOR_API =
  "https://us-central1-incarts.cloudfunctions.net/generateQRCode";

interface CreateQRCodeRequest {
  linkId: string;           // Existing link document ID
  identifier: string;       // Unique identifier for this QR code (e.g., "campaign-2024", "store-123")
  name: string;            // Display name (e.g., "Black Friday Campaign", "Store #123")
  customData?: any;        // Optional custom data for tracking
  userId: string;          // User creating the QR code
}

/**
 * Validate QR identifier for URL safety and uniqueness requirements
 */
function validateQRIdentifier(identifier: string): { valid: boolean; error?: string } {
  // Length check
  if (identifier.length < 3 || identifier.length > 50) {
    return { valid: false, error: "Identifier must be 3-50 characters long" };
  }
  
  // Character validation: lowercase letters, numbers, hyphens only
  if (!/^[a-z0-9-]+$/.test(identifier)) {
    return { valid: false, error: "Use only lowercase letters, numbers, and hyphens" };
  }
  
  // No double hyphens or leading/trailing hyphens
  if (/--/.test(identifier) || /^-|-$/.test(identifier)) {
    return { valid: false, error: "Invalid hyphen placement" };
  }
  
  // Reserved words check
  const reserved = ["api", "admin", "qr", "link", "test", "w", "app", "www"];
  if (reserved.includes(identifier)) {
    return { valid: false, error: "This identifier is reserved" };
  }
  
  return { valid: true };
}

/**
 * Generate a QR code image
 */
async function generateQrCode(url: string): Promise<any> {
  try {
    const response = await axios.post(QR_CODE_GENERATOR_API, { url });
    return {
      success: true,
      publicUrl: response.data.publicUrl,
    };
  } catch (error: any) {
    logger.error("Error generating QR code:", error);
    return {
      success: false,
      error: error.message || "Failed to generate QR code",
    };
  }
}

/**
 * Create additional QR code for an existing link
 */
export const createAdditionalQRCode = onRequest(
  { cors: true },
  async (request, response) => {
    return new Promise<void>((resolve) => {
      corsHandler(request, response, async () => {
        try {
          const data = request.body as CreateQRCodeRequest;

          // Validate required fields
          if (!data.linkId || !data.identifier || !data.name) {
            response.status(400).json({
              success: false,
              error: "Missing required fields: linkId, identifier, name",
            });
            resolve();
            return;
          }

          // Validate identifier format
          const validation = validateQRIdentifier(data.identifier);
          if (!validation.valid) {
            response.status(400).json({
              success: false,
              error: validation.error,
            });
            resolve();
            return;
          }

          // Check if link exists
          const linkDoc = await db.collection("links").doc(data.linkId).get();
          if (!linkDoc.exists) {
            response.status(404).json({
              success: false,
              error: "Link not found",
            });
            resolve();
            return;
          }

          const linkData = linkDoc.data()!;  // Safe because we checked exists above
          
          // Check if QR code with this identifier already exists
          const existingQR = await db.collection("qrCodes").doc(data.identifier).get();

          if (existingQR.exists) {
            // Generate helpful suggestions
            const timestamp = Date.now();
            const suggestions = [
              `${data.identifier}-${timestamp}`,
              `${data.identifier}-${data.linkId.slice(-6)}`,
              `${data.identifier}-v2`,
            ];
            
            response.status(409).json({
              success: false,
              error: `Identifier '${data.identifier}' is already in use. Please choose a different identifier.`,
              suggestions: suggestions,
            });
            resolve();
            return;
          }

          // Use identifier as the document ID
          const qrCodeId = data.identifier;
          const qrRef = db.collection("qrCodes").doc(qrCodeId);
          
          // Generate QR code for the correct URL format
          const qrUrl = `https://in2carts.com/qr/${qrCodeId}`;
          const qrResult = await generateQrCode(qrUrl);
          
          if (!qrResult.success) {
            response.status(500).json({
              success: false,
              error: `Failed to generate QR code: ${qrResult.error}`,
            });
            resolve();
            return;
          }

          // Create QR code record with required fields for URL shortener
          const qrRecord = {
            qrCodeId: qrCodeId,  // Required for URL shortener lookup
            linkId: data.linkId,
            shortId: linkData.urlShortCode || "",
            name: data.name,
            qrCodeUrl: qrResult.publicUrl,
            createdAt: new Date(),
            createdBy: data.userId,
            projectId: linkData.projectDetails?.projectId || "",
            isDefault: false,
            clickCount: 0,
            customData: data.customData || {},
          };

          // Save QR code record
          await qrRef.set(qrRecord);

          // Update link's QR code count
          const currentCount = linkData.qrCodeCount || 1;
          await db.collection("links").doc(data.linkId).update({
            qrCodeCount: currentCount + 1,
            lastQRCodeCreated: new Date(),
          });

          logger.info("Created additional QR code", {
            qrCodeId,
            linkId: data.linkId,
            identifier: data.identifier,
          });

          // Return success response
          response.json({
            success: true,
            qrCodeId: qrCodeId,
            qrCodeUrl: qrResult.publicUrl,
            qrUrl: qrUrl,  // The URL encoded in the QR
          });
        } catch (error: any) {
          logger.error("Error creating additional QR code:", error);
          response.status(500).json({
            success: false,
            error: error.message || "An unexpected error occurred",
          });
        }
        resolve();
      });
    });
  }
);