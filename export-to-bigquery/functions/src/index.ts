/**
 * Firestore to BigQuery Cloud Function v2
 * Compatible with Node 22/23, Firebase Functions v2, and latest BigQuery client
 * Fixed event handling and removed unavailable properties
 */

import { onDocumentWritten, Change, FirestoreEvent } from "firebase-functions/v2/firestore";
import { onRequest } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";
import { BigQuery } from "@google-cloud/bigquery";
import { initializeApp } from "firebase-admin/app";
import { DocumentSnapshot } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";

// Initialize Firebase Admin
initializeApp();

// Set global options for all functions
setGlobalOptions({
  region: "us-central1", // Change to your preferred region
  memory: "512MiB",
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
 * Generate a unique event ID since it's not available in v2
 */
function generateEventId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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
    
    // For deduplication, we format the row with insertId according to BigQuery API spec
    const rowsToInsert = [{
      insertId: row.event_id, // This is the correct way to specify insertId
      json: row
    }];
    
    await table.insert(rowsToInsert, {
      ignoreUnknownValues: true,
      skipInvalidRows: false,
      raw: true, // This tells BigQuery to expect the insertId format
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
      // Extract event data - note: eventId and eventType are not available in v2
      const { data, params } = event;
      const collectionName = params.collection;
      const documentId = params.documentId;
      const eventId = generateEventId(); // Generate our own ID

      logger.info(`Processing document change for ${collectionName}/${documentId}`);

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
 * HTTP function to create current state views for each collection
 * Call this once after deploying to set up convenient views
 */
export const createCurrentStateViews = onRequest(
  {
    cors: true,
  },
  async (req, res) => {
    try {
      const collections = ["users", "projects", "campaigns", "newDynamicPages", "products", "links"];
      const results = [];
      
      for (const collection of collections) {
        const viewName = `${collection}_current_state`;
        const query = `
          CREATE OR REPLACE VIEW \`${process.env.GCLOUD_PROJECT}.${datasetId}.${viewName}\` AS
          WITH latest_docs AS (
            SELECT 
              document_id,
              ARRAY_AGG(data ORDER BY timestamp DESC LIMIT 1)[OFFSET(0)] as data,
              MAX(timestamp) as last_updated,
              ARRAY_AGG(operation ORDER BY timestamp DESC LIMIT 1)[OFFSET(0)] as last_operation
            FROM \`${process.env.GCLOUD_PROJECT}.${datasetId}.${tableId}\`
            WHERE collection_name = '${collection}'
            GROUP BY document_id
          )
          SELECT 
            document_id,
            data,
            last_updated,
            last_operation
          FROM latest_docs
          WHERE last_operation != 'DELETE'
        `;
        
        try {
          await bigQuery.query(query);
          logger.info(`Created view ${viewName}`);
          results.push(`✅ Created view: ${viewName}`);
        } catch (error) {
          logger.error(`Error creating view ${viewName}:`, error);
          results.push(`❌ Failed to create view: ${viewName} - ${error}`);
        }
      }
      
      res.status(200).json({
        message: "View creation completed",
        results: results,
      });
    } catch (error) {
      logger.error("Error creating views:", error);
      res.status(500).json({
        error: "Error creating views",
        details: error,
      });
    }
  }
);

/**
 * HTTP function to get analytics data for testing
 */
export const getAnalytics = onRequest(
  {
    cors: true,
  },
  async (req, res) => {
    try {
      const query = `
        SELECT 
          collection_name,
          operation,
          COUNT(*) as count,
          DATE(timestamp) as date
        FROM \`${process.env.GCLOUD_PROJECT}.${datasetId}.${tableId}\`
        WHERE DATE(timestamp) >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAYS)
        GROUP BY collection_name, operation, date
        ORDER BY date DESC, collection_name, operation
      `;
      
      const [rows] = await bigQuery.query(query);
      
      res.status(200).json({
        message: "Analytics data retrieved successfully",
        data: rows,
      });
    } catch (error) {
      logger.error("Error getting analytics:", error);
      res.status(500).json({
        error: "Error getting analytics",
        details: error,
      });
    }
  }
);