/**
 * @fileoverview Cloud function to update campaign statuses from active to completed
 * @description This function checks for campaigns with endDate in the past and status "active",
 * then updates their status to "completed"
 */

import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";

// Initialize Firebase Admin
initializeApp();
const db = getFirestore();

/**
 * Updates campaign statuses from "active" to "completed" for campaigns with past end dates
 * @function
 * @param {Request} request - HTTP request object
 * @param {Response} response - HTTP response object
 * @returns {Promise<void>} Updates campaign statuses and sends response
 */
export const syncCampaignStatus = onRequest(async (_request, response) => {
  try {
    if (process.env.NODE_ENV === "development") {
      logger.info("Starting campaign status sync", {structuredData: true});
    }

    const now = Timestamp.now();
    let updatedCount = 0;
    let errorCount = 0;

    // Query for active campaigns with endDate in the past
    const campaignsSnapshot = await db.collection("campaigns")
      .where("status", "==", "active")
      .where("endDate", "<", now)
      .get();

    if (campaignsSnapshot.empty) {
      response.status(200).json({
        success: true,
        message: "No campaigns to update",
        updatedCount: 0
      });
      return;
    }

    // Update each campaign's status to "completed"
    const updatePromises = campaignsSnapshot.docs.map(async (doc) => {
      try {
        await doc.ref.update({
          status: "completed",
          updatedAt: FieldValue.serverTimestamp()
        });
        updatedCount++;
        
        if (process.env.NODE_ENV === "development") {
          logger.info(`Updated campaign ${doc.id} to completed status`);
        }
      } catch (error) {
        errorCount++;
        logger.error(`Failed to update campaign ${doc.id}:`, error);
      }
    });

    await Promise.all(updatePromises);

    response.status(200).json({
      success: true,
      message: `Campaign status sync completed`,
      updatedCount,
      errorCount,
      totalProcessed: campaignsSnapshot.size
    });

  } catch (error) {
    logger.error("Error syncing campaign statuses:", error);
    response.status(500).json({
      success: false,
      error: "Internal server error",
      message: process.env.NODE_ENV === "development" ? error : "Failed to sync campaign statuses"
    });
  }
});
