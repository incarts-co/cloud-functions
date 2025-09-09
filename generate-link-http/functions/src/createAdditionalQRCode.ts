/**
 * @fileoverview Create Additional QR Codes for Existing Links
 * @description Allows creation of multiple QR codes for tracking different campaigns/locations
 * @module cloud-functions/generate-link-http
 * @related generateLink.ts
 */

import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
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

// Initialize Firebase Admin
initializeApp();
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
            response.status(409).json({
              success: false,
              error: `QR code with identifier '${data.identifier}' already exists for this link`,
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