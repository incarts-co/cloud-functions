/**
 * @fileoverview Cloud Functions for enriching substitution documents
 * @description This function triggers when a document is created in the
 * "substitutions" collection and enriches it with project and UTM parameter
 * data from the corresponding "links" document
 */

import {onDocumentCreated} from "firebase-functions/v2/firestore";
import {initializeApp, getApps} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";

// Initialize Firebase Admin SDK if not already initialized
if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();

/**
 * Substitution document structure
 */
interface SubstitutionDocument {
  backupProducts: Array<{
    originalId: string;
    reason: string;
    replacementId: string;
  }>;
  shortId: string;
  timestamp: {
    __time__: string;
  };
  zipCode: string;
  projectId?: string;
  projectName?: string;
  utmParameters?: Record<string, string>;
}

/**
 * Links document structure
 */
interface LinksDocument {
  backupProducts: Array<{
    backupIds: string[];
    primaryId: string;
  }>;
  created: {
    timestamp: {
      __time__: string;
    };
    userId: string;
    userRef: {
      __ref__: string;
    };
  };
  customUrl: string;
  description: string;
  docId: string;
  linkTags: string[];
  linkValue: number;
  linkactiveflag: boolean;
  linkqrcodeimgurl: string;
  longLink: string;
  name: string;
  pageType: string;
  projectDetails: {
    projectId: string;
    projectName: string;
    projectRef: {
      __ref__: string;
    };
  };
  publicName: string;
  qrCode: string;
  shortLink: string;
  shortlinkwithouthttps: string;
  siteRetailer: string;
  siteplainname: string;
  urlShortCode: string;
  useBackups: boolean;
  utmParameters: Record<string, string>;
}

/**
 * Cloud Function that enriches substitution documents with link data
 * Triggers when a document is created in the "substitutions" collection
 */
export const enrichSubstitutions = onDocumentCreated(
  "substitutions/{docId}",
  async (event) => {
    const snapshot = event.data;

    if (!snapshot) {
      logger.error("No data associated with the event");
      return;
    }

    const substitutionData = snapshot.data() as SubstitutionDocument;
    const docId = event.params.docId;

    logger.info(`Processing substitution document: ${docId}`, {
      shortId: substitutionData.shortId,
      zipCode: substitutionData.zipCode,
    });

    try {
      // Query the links collection for a document where urlShortCode
      // matches shortId
      const linksQuery = await db
        .collection("links")
        .where("urlShortCode", "==", substitutionData.shortId)
        .limit(1)
        .get();

      if (linksQuery.empty) {
        logger.warn(
          `No matching link found for shortId: ${substitutionData.shortId}`
        );
        return;
      }

      const linkDoc = linksQuery.docs[0];
      const linkData = linkDoc.data() as LinksDocument;

      // Prepare the update data
      const updateData: Partial<SubstitutionDocument> = {
        projectId: linkData.projectDetails.projectId,
        projectName: linkData.projectDetails.projectName,
        utmParameters: linkData.utmParameters,
      };

      // Update the substitution document
      await snapshot.ref.update(updateData);

      logger.info(`Successfully enriched substitution document: ${docId}`, {
        projectId: updateData.projectId,
        projectName: updateData.projectName,
        utmParametersCount: Object.keys(updateData.utmParameters || {}).length,
      });
    } catch (error) {
      logger.error(`Error enriching substitution document: ${docId}`, {
        error: error instanceof Error ? error.message : String(error),
        shortId: substitutionData.shortId,
      });
      throw error;
    }
  }
);
