/**
 * @fileoverview Cloud function to sync document counts for each project
 * @description This function counts documents in products, newDynamicPages,
 * links, and campaigns collections for each project and updates the project
 * document with these counts
 * @module temp-sync-counts/functions
 */

import * as admin from "firebase-admin";
import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();


/**
 * Interface for the counts object to be stored in project documents
 */
interface ProjectCounts {
  products: number;
  newDynamicPages: number;
  links: number;
  campaigns: number;
  lastSynced: admin.firestore.Timestamp;
}

/**
 * Counts documents in a collection for a specific project
 * @function
 * @param {string} collectionName - Name of the collection to query
 * @param {string} projectId - ID of the project to filter by
 * @return {Promise<number>} Count of documents matching the project
 */
async function countDocumentsForProject(
  collectionName: string,
  projectId: string
): Promise<number> {
  try {
    const snapshot = await db
      .collection(collectionName)
      .where("project.projectId", "==", projectId)
      .get();

    return snapshot.size;
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      logger.error(
        `Error counting documents in ${collectionName} ` +
        `for project ${projectId}:`,
        error
      );
    }
    throw error;
  }
}

/**
 * Cloud function to sync counts of related documents for all projects
 * @function
 * @param {Request} request - HTTP request object
 * @param {Response} response - HTTP response object
 * @returns {Promise<void>}
 */
export const syncProjectCounts = onRequest(async (_, response) => {
  try {
    if (process.env.NODE_ENV === "development") {
      logger.info("Starting project counts sync");
    }

    // Get all projects
    const projectsSnapshot = await db.collection("projects").get();

    if (projectsSnapshot.empty) {
      response.status(200).json({
        success: true,
        message: "No projects found to sync",
        projectsProcessed: 0,
      });
      return;
    }

    const collections = ["products", "newDynamicPages", "links", "campaigns"];
    const batch = db.batch();
    let projectsProcessed = 0;
    const errors: Array<{projectId: string; error: string}> = [];

    // Process each project
    for (const projectDoc of projectsSnapshot.docs) {
      try {
        const projectId = projectDoc.id;

        if (process.env.NODE_ENV === "development") {
          logger.info(`Processing project: ${projectId}`);
        }

        // Count documents in each collection for this project
        const counts: Partial<ProjectCounts> = {
          lastSynced: admin.firestore.Timestamp.now(),
        };

        // Fetch counts for all collections in parallel
        const countPromises = collections.map(async (collectionName) => {
          const count = await countDocumentsForProject(
            collectionName,
            projectId
          );
          return {collectionName, count};
        });

        const results = await Promise.all(countPromises);

        // Assign counts to the counts object
        results.forEach(({collectionName, count}) => {
          counts[
            collectionName as keyof Omit<ProjectCounts, "lastSynced">
          ] = count;
        });

        // Update the project document with counts
        batch.update(projectDoc.ref, {counts});
        projectsProcessed++;

        if (process.env.NODE_ENV === "development") {
          logger.info(`Counts for project ${projectId}:`, counts);
        }
      } catch (projectError) {
        const errorMessage = projectError instanceof Error ?
          projectError.message : String(projectError);
        errors.push({
          projectId: projectDoc.id,
          error: errorMessage,
        });

        if (process.env.NODE_ENV === "development") {
          logger.error(
            `Error processing project ${projectDoc.id}:`,
            projectError
          );
        }
      }
    }

    // Commit all updates in a single batch
    await batch.commit();

    const responseData = {
      success: true,
      message: "Project counts sync completed",
      projectsProcessed,
      totalProjects: projectsSnapshot.size,
      errors: errors.length > 0 ? errors : undefined,
    };

    if (process.env.NODE_ENV === "development") {
      logger.info("Sync completed:", responseData);
    }

    response.status(200).json(responseData);
  } catch (error) {
    const errorMessage = error instanceof Error ?
      error.message : String(error);

    if (process.env.NODE_ENV === "development") {
      logger.error("Error in syncProjectCounts:", error);
    }

    response.status(500).json({
      success: false,
      error: "Failed to sync project counts",
      details: errorMessage,
    });
  }
});
