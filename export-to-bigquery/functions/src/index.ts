/**
 * Firestore to BigQuery Cloud Function v2
 * Captures all collections using wildcard pattern and streams to BigQuery
 * Compatible with Node 22, Firebase Functions v2, and latest BigQuery client
 */

import { onDocumentWritten, Change, FirestoreEvent } from "firebase-functions/v2/firestore";
import { setGlobalOptions } from "firebase-functions/v2";
import { BigQuery } from "@google-cloud/bigquery";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, DocumentSnapshot } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";

// Initialize Firebase Admin
initializeApp();

// Set global options for all functions
setGlobalOptions({
  region: "us-central1", // Change to your preferred region
  memory: "256MiB",
  timeoutSeconds: 540,
});

// Initialize BigQuery client
const bigQuery = new BigQuery();
const datasetId = "firestore_export";
const tableId = "all_collections_changelog";

// Define the BigQuery table schema
const schema = [
  { name: "timestamp", type: "TIMESTAMP", mode: "REQUIRED" },
  { name: "event_id", type: "STRING", mode: "REQUIRED" },
  { name: "document_name", type: "STRING", mode: "REQUIRED" },
  { name: "document_id", type: "STRING", mode: "REQUIRED" },
  { name: "operation", type: "STRING", mode: "REQUIRED" },
  { name: "collection_name", type: "STRING", mode: "REQUIRED" },
  { name: "data", type: "JSON", mode: "NULLABLE" },
  { name: "old_data", type: "JSON", mode: "NULLABLE" },
];

/**
 * Extract collection name from document path
 */
function extractCollectionName(documentPath: string): string {
  // documentPath format: projects/{project}/databases/{database}/documents/{collection}/{docId}
  const pathParts = documentPath.split("/");
  const documentsIndex = pathParts.indexOf("documents");
  if (documentsIndex !== -1 && documentsIndex + 1 < pathParts.length) {
    return pathParts[documentsIndex + 1];
  }
  return "unknown";
}

/**
 * Sanitize data for BigQuery insertion
 */
function sanitizeDataForBigQuery(data: any): any {
  if (data === null || data === undefined) {
    return null;
  }

  if (Array.isArray(data)) {
    return data.map(sanitizeDataForBigQuery);
  }

  if (typeof data === "object") {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      // Handle Firestore-specific types
      if (value && typeof value === "object") {
        // Convert Firestore Timestamp to ISO string
        if (value.constructor.name === "Timestamp" || (value as any)._seconds) {
          sanitized[key] = new Date((value as any)._seconds * 1000 + (value as any)._nanoseconds / 1000000).toISOString();
        }
        // Convert Firestore DocumentReference to string
        else if (value.constructor.name === "DocumentReference" || (value as any).path) {
          sanitized[key] = (value as any).path;
        }
        // Convert Firestore GeoPoint
        else if ((value as any).latitude !== undefined && (value as any).longitude !== undefined) {
          sanitized[key] = {
            latitude: (value as any).latitude,
            longitude: (value as any).longitude,
          };
        }
        // Recursively sanitize nested objects
        else {
          sanitized[key] = sanitizeDataForBigQuery(value);
        }
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  return data;
}

/**
 * Create BigQuery dataset and table if they don't exist
 */
async function ensureDatasetAndTable(): Promise<void> {
  try {
    // Check if dataset exists, create if not
    const [datasetExists] = await bigQuery.dataset(datasetId).exists();
    if (!datasetExists) {
      await bigQuery.createDataset(datasetId, {
        location: "US", // Change to match your Firestore region
      });
      logger.info(`Dataset ${datasetId} created`);
    }

    // Check if table exists, create if not
    const dataset = bigQuery.dataset(datasetId);
    const [tableExists] = await dataset.table(tableId).exists();
    if (!tableExists) {
      await dataset.createTable(tableId, {
        schema: schema,
        timePartitioning: {
          type: "DAY",
          field: "timestamp",
        },
        clustering: {
          fields: ["collection_name", "operation", "document_id"],
        },
      });
      logger.info(`Table ${tableId} created with schema`);
    }
  } catch (error) {
    logger.error("Error ensuring dataset and table:", error);
    throw error;
  }
}

/**
 * Insert row into BigQuery
 */
async function insertToBigQuery(row: any): Promise<void> {
  try {
    await ensureDatasetAndTable();
    
    const table = bigQuery.dataset(datasetId).table(tableId);
    await table.insert([row], {
      ignoreUnknownValues: true,
      skipInvalidRows: false,
    });
    
    logger.info(`Successfully inserted row for ${row.collection_name}/${row.document_id}`);
  } catch (error) {
    logger.error("Error inserting to BigQuery:", error);
    throw error;
  }
}

/**
 * Main Cloud Function - Wildcard trigger for ALL collections
 * This captures: users, projects, campaigns, newDynamicPages, products, links, and any future collections
 */
export const firestoreToBigQuery = onDocumentWritten(
  "{collection}/{documentId}",
  async (event: FirestoreEvent<Change<DocumentSnapshot> | undefined>) => {
    try {
      // Extract event data
      const { data, params, eventId, eventType } = event;
      const collectionName = params.collection;
      const documentId = params.documentId;

      logger.info(`Processing ${eventType} for ${collectionName}/${documentId}`);

      // Determine operation type
      let operation: string;
      let currentData: any = null;
      let previousData: any = null;

      if (!data) {
        logger.error("No data in event");
        return;
      }

      // Handle different operation types
      if (!data.before.exists && data.after.exists) {
        operation = "CREATE";
        currentData = data.after.data();
      } else if (data.before.exists && !data.after.exists) {
        operation = "DELETE";
        previousData = data.before.data();
      } else if (data.before.exists && data.after.exists) {
        operation = "UPDATE";
        currentData = data.after.data();
        previousData = data.before.data();
      } else {
        operation = "UNKNOWN";
      }

      // Skip if this is a no-op write (data unchanged)
      if (operation === "UPDATE" && JSON.stringify(currentData) === JSON.stringify(previousData)) {
        logger.info("Skipping no-op write");
        return;
      }

      // Prepare BigQuery row
      const row = {
        timestamp: new Date().toISOString(),
        event_id: eventId,
        document_name: `projects/${process.env.GCLOUD_PROJECT}/databases/(default)/documents/${collectionName}/${documentId}`,
        document_id: documentId,
        operation,
        collection_name: collectionName,
        data: currentData ? sanitizeDataForBigQuery(currentData) : null,
        old_data: previousData ? sanitizeDataForBigQuery(previousData) : null,
      };

      // Insert to BigQuery
      await insertToBigQuery(row);

      logger.info(`Successfully processed ${operation} for ${collectionName}/${documentId}`);
    } catch (error) {
      logger.error("Error in firestoreToBigQuery function:", error);
      // Don't throw - this would cause the function to retry and potentially create duplicates
    }
  }
);

/**
 * Optional: Create current state view for each collection
 * This view shows the latest state of each document (like the extension's _latest view)
 */
export const createCurrentStateViews = onRequest(async (req, res) => {
  try {
    const collections = ["users", "projects", "campaigns", "newDynamicPages", "products", "links"];
    
    for (const collection of collections) {
      const viewName = `${collection}_current_state`;
      const query = `
        CREATE OR REPLACE VIEW \`${process.env.GCLOUD_PROJECT}.${datasetId}.${viewName}\` AS
        WITH latest_docs AS (
          SELECT 
            document_id,
            MAX_BY(data, timestamp) as data,
            MAX(timestamp) as last_updated,
            MAX_BY(operation, timestamp) as last_operation
          FROM \`${process.env.GCLOUD_PROJECT}.${datasetId}.${tableId}\`
          WHERE collection_name = '${collection}'
          GROUP BY document_id
        )
        SELECT * FROM latest_docs
        WHERE last_operation != 'DELETE'
      `;
      
      await bigQuery.query(query);
      logger.info(`Created view ${viewName}`);
    }
    
    res.status(200).send("Views created successfully");
  } catch (error) {
    logger.error("Error creating views:", error);
    res.status(500).send("Error creating views");
  }
});