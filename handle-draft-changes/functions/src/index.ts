/**
 * @fileoverview Cloud Function to handle draft status changes
 * @description Monitors updates to newDynamicPages documents and sets
 * hasDraftChanges flag when publishingStatus is 'draft' and
 * hasDraftChanges is not set or false
 */

import {onDocumentUpdated} from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";

// Initialize Firebase Admin SDK
admin.initializeApp();

/**
 * Cloud Function triggered when a document in newDynamicPages is updated
 * Sets hasDraftChanges to true when publishingStatus is 'draft' and
 * hasDraftChanges is not set or false
 */
export const handleDraftChanges = onDocumentUpdated(
  {
    document: "newDynamicPages/{docId}",
    region: "us-central1", // Adjust region as needed
  },
  async (event) => {
    const afterData = event.data?.after.data();

    // Exit if no data
    if (!afterData) {
      logger.warn("No after data found in update event");
      return;
    }

    const docId = event.params.docId;

    // Check conditions for setting hasDraftChanges
    if (
      afterData.publishingStatus === "draft" &&
      (!afterData.hasDraftChanges || afterData.hasDraftChanges === false)
    ) {
      try {
        // Update the document to set hasDraftChanges to true
        await admin.firestore()
          .collection("newDynamicPages")
          .doc(docId)
          .update({
            hasDraftChanges: true,
            lastModified: admin.firestore.FieldValue.serverTimestamp(),
          });

        logger.info(`Set hasDraftChanges to true for document ${docId}`, {
          publishingStatus: afterData.publishingStatus,
          previousHasDraftChanges: afterData.hasDraftChanges,
        });
      } catch (error) {
        logger.error(
          `Failed to update hasDraftChanges for document ${docId}`,
          error
        );
      }
    } else {
      // Log when conditions don't match for debugging
      if (process.env.NODE_ENV === "development") {
        logger.debug(`No action needed for document ${docId}`, {
          publishingStatus: afterData.publishingStatus,
          hasDraftChanges: afterData.hasDraftChanges,
        });
      }
    }
  }
);
