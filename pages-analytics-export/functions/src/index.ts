/**
 * @fileoverview Analytics export Cloud Function for BigQuery data
 * @description Exports analytics data from BigQuery tables in CSV or JSON format
 * @module analytics-export
 * @related BigQuery tables: complete_page_analytics, unified_click_analytics, consumer_interactions, pages_device_breakdown, pages_geographic_breakdown, pages_traffic_sources
 */

import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {BigQuery} from "@google-cloud/bigquery";

// Initialize BigQuery client
const bigquery = new BigQuery();

// TypeScript interfaces
interface BigQueryRow {
  [key: string]: any;
}

// Query definitions
const QUERIES: Record<string, string> = {
  general: `
    SELECT 
      page_slug as Page_URL_Slug,
      SUM(total_page_views) as Total_Page_Views,
      SUM(total_users_proxy) as Total_Users,
      AVG(avg_engagement_duration) as Average_Engagement_Duration,
      SUM(total_clicks) as Total_Clicks
    FROM \`incarts.analytics.pages_overview\`
    WHERE project_id = @project_id
      AND (@page_slug IS NULL OR page_slug = @page_slug)
    GROUP BY page_slug
    ORDER BY SUM(total_page_views) DESC
  `,

  pageviews_by_date: `
    SELECT 
      CAST(date AS STRING) as Date,
      SUM(daily_page_views) as Page_Views
    FROM \`incarts.analytics.pageviews_by_date\`
    WHERE project_id = @project_id
      AND date BETWEEN @start_date AND @end_date
      AND (@page_slug IS NULL OR page_slug = @page_slug)
    GROUP BY date
    ORDER BY date
  `,

  clicks_by_date: `
    SELECT 
      CAST(date AS STRING) as Date,
      SUM(total_clicks) as Link_Clicks
    FROM \`incarts.analytics.complete_ctr_analysis\`
    WHERE project_id = @project_id
      AND date BETWEEN @start_date AND @end_date
      AND total_clicks > 0
      AND (@page_slug IS NULL OR page_slug = @page_slug)
    GROUP BY date
    ORDER BY date
  `,

  interactions: `
    SELECT 
      event_name as Event_Name,
      SUM(event_count) as Event_Count
    FROM \`incarts.analytics.consumer_interactions\`
    WHERE project_id = @project_id
      AND date BETWEEN @start_date AND @end_date
      AND event_name IS NOT NULL
      AND (@page_slug IS NULL OR page_slug = @page_slug)
    GROUP BY event_name
    ORDER BY SUM(event_count) DESC
  `,

  clicks_by_url: `
    SELECT 
      destination_url as Clicked_URL,
      link_name as Link_Name,
      SUM(total_clicks) as Click_Count
    FROM \`incarts.analytics.complete_ctr_analysis\`
    WHERE project_id = @project_id
      AND date BETWEEN @start_date AND @end_date
      AND destination_url IS NOT NULL
      AND total_clicks > 0
      AND (@page_slug IS NULL OR page_slug = @page_slug)
    GROUP BY destination_url, link_name
    ORDER BY SUM(total_clicks) DESC
  `,

  pageviews_by_device: `
    SELECT 
      device_type as Device_Type,
      SUM(page_views) as Page_Views,
      SUM(users) as Users
    FROM \`incarts.analytics.pages_device_breakdown\`
    WHERE project_id = @project_id
      AND date BETWEEN @start_date AND @end_date
      AND (@page_slug IS NULL OR page_slug = @page_slug)
    GROUP BY device_type
    ORDER BY SUM(page_views) DESC
  `,

  top_cities: `
    SELECT 
      city as City,
      state as State,
      country as Country,
      SUM(users) as Users,
      SUM(page_views) as Page_Views
    FROM \`incarts.analytics.pages_geographic_breakdown\`
    WHERE project_id = @project_id
      AND date BETWEEN @start_date AND @end_date
      AND city IS NOT NULL
      AND city != '(not set)'
      AND (@page_slug IS NULL OR page_slug = @page_slug)
    GROUP BY city, state, country
    ORDER BY SUM(users) DESC
    LIMIT 25
  `,

  top_traffic_sources: `
    SELECT 
      source as Traffic_Source_Domain,
      medium as Medium,
      SUM(users) as Users,
      SUM(sessions) as Sessions,
      SUM(page_views) as Page_Views
    FROM \`incarts.analytics.pages_traffic_sources\`
    WHERE project_id = @project_id
      AND date BETWEEN @start_date AND @end_date
      AND source IS NOT NULL
      AND source != '(direct)'
      AND (@page_slug IS NULL OR page_slug = @page_slug)
    GROUP BY source, medium
    ORDER BY SUM(users) DESC
    LIMIT 25
  `,
};

/**
 * Utility function to convert array of objects to CSV
 * @function
 * @param {BigQueryRow[]} data - Array of BigQuery result rows
 * @return {string} CSV formatted string
 */
function convertToCSV(data: BigQueryRow[]): string {
  if (!data || data.length === 0) {
    return "";
  }

  const headers = Object.keys(data[0]);
  // Convert underscores to spaces for better CSV readability
  const csvHeaders = headers.map(header => header.replace(/_/g, " ")).join(",");

  const csvRows = data.map((row) => {
    return headers.map((header) => {
      let value = row[header];

      // Handle null/undefined values
      if (value === null || value === undefined) {
        value = "";
      }

      // Handle dates - BigQuery returns date objects in different formats
      if (value instanceof Date) {
        value = value.toISOString().split("T")[0];
      } else if (value && typeof value === 'object' && value.value) {
        // BigQuery date object format
        value = value.value;
      } else if (value && typeof value === 'object' && typeof value.toString === 'function') {
        // Generic object conversion
        value = value.toString();
      }

      // Escape quotes and wrap in quotes if contains comma
      value = String(value);
      if (value.includes(",") || value.includes("\"") || value.includes("\n")) {
        value = "\"" + value.replace(/"/g, "\"\"") + "\"";
      }

      return value;
    }).join(",");
  });

  return csvHeaders + "\n" + csvRows.join("\n");
}

/**
 * Validates date format (YYYY-MM-DD)
 * @function
 * @param {string} dateString - Date string to validate
 * @return {boolean} True if valid date format
 */
function validateDateFormat(dateString: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) return false;

  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
}

/**
 * Validates export type against available queries
 * @function
 * @param {string} type - Export type to validate
 * @return {boolean} True if valid export type
 */
function validateExportType(type: string): boolean {
  return Object.keys(QUERIES).includes(type);
}

/**
 * Validates project ID format
 * @function
 * @param {string} projectId - Project ID to validate
 * @return {boolean} True if valid project ID
 */
function validateProjectId(projectId: string): boolean {
  return typeof projectId === "string" && projectId.length > 0 && projectId.length < 100;
}

/**
 * Main analytics export function
 * @function
 * @param {any} req - Express request object
 * @param {any} res - Express response object
 */
export const exportAnalytics = onRequest(async (req, res): Promise<void> => {
  try {
    // CORS headers
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

    // Handle preflight requests
    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    // Only allow GET requests
    if (req.method !== "GET") {
      res.status(405).json({
        error: "Method not allowed",
        allowed_methods: ["GET"],
      });
      return;
    }

    // Extract and validate parameters
    const {type, project_id, start_date, end_date, format = "csv", page_slug} = req.query;

    // Parameter validation
    if (!type || !project_id || !start_date || !end_date) {
      res.status(400).json({
        error: "Missing required parameters",
        required: ["type", "project_id", "start_date", "end_date"],
        received: {type, project_id, start_date, end_date},
      });
      return;
    }

    if (!validateExportType(type as string)) {
      res.status(400).json({
        error: "Invalid export type",
        valid_types: Object.keys(QUERIES),
        received: type,
      });
      return;
    }

    if (!validateProjectId(project_id as string)) {
      res.status(400).json({
        error: "Invalid project ID format",
      });
      return;
    }

    if (!validateDateFormat(start_date as string) || !validateDateFormat(end_date as string)) {
      res.status(400).json({
        error: "Invalid date format",
        expected_format: "YYYY-MM-DD",
        received: {start_date, end_date},
      });
      return;
    }

    // Validate date range
    const startDateObj = new Date(start_date as string);
    const endDateObj = new Date(end_date as string);
    const maxRangeDays = 365; // 1 year max

    if (startDateObj > endDateObj) {
      res.status(400).json({
        error: "Start date must be before end date",
      });
      return;
    }

    const daysDifference = (endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDifference > maxRangeDays) {
      res.status(400).json({
        error: `Date range too large. Maximum ${maxRangeDays} days allowed.`,
        requested_days: Math.ceil(daysDifference),
      });
      return;
    }

    // Validate format
    if (!["csv", "json"].includes(format as string)) {
      res.status(400).json({
        error: "Invalid format",
        valid_formats: ["csv", "json"],
        received: format,
      });
      return;
    }

    // Execute BigQuery
    if (process.env.NODE_ENV === "development") {
      const pageSlugInfo = page_slug ? ` for page_slug: ${page_slug}` : "";
      logger.info(`Executing export: ${type} for project ${project_id} from ${start_date} to ${end_date}${pageSlugInfo}`);
    }

    const query = QUERIES[type as string];
    const options = {
      query: query,
      params: {
        project_id: project_id as string,
        start_date: start_date as string,
        end_date: end_date as string,
        page_slug: page_slug ? page_slug as string : null,
      },
      // Add query timeout
      timeoutMs: 30000, // 30 seconds
    };

    const [rows] = await bigquery.query(options);

    if (process.env.NODE_ENV === "development") {
      logger.info(`Query executed successfully. Returned ${rows.length} rows.`);
    }

    // Handle empty results
    if (!rows || rows.length === 0) {
      const emptyResponse = format === "csv" ? "" : [];

      if (format === "csv") {
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename="${type}_${project_id}_${start_date}_${end_date}.csv"`);
        res.send(emptyResponse);
      } else {
        res.json({
          data: emptyResponse,
          metadata: {
            type: type as string,
            project_id: project_id as string,
            start_date: start_date as string,
            end_date: end_date as string,
            row_count: 0,
          },
        });
      }
      return;
    }

    // Return data in requested format
    if (format === "csv") {
      const csv = convertToCSV(rows);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="${type}_${project_id}_${start_date}_${end_date}.csv"`);
      res.send(csv);
    } else {
      res.json({
        data: rows,
        metadata: {
          type: type as string,
          project_id: project_id as string,
          start_date: start_date as string,
          end_date: end_date as string,
          row_count: rows.length,
          generated_at: new Date().toISOString(),
        },
      });
    }
  } catch (error) {
    logger.error("Export error:", error);

    // Different error handling based on error type
    if (error instanceof Error) {
      if (error.message && error.message.includes("permission")) {
        res.status(403).json({
          error: "Permission denied",
          message: "Insufficient permissions to access the requested data",
        });
      } else if (error.message && error.message.includes("timeout")) {
        res.status(504).json({
          error: "Query timeout",
          message: "The query took too long to execute. Please try a smaller date range.",
        });
      } else {
        res.status(500).json({
          error: "Internal server error",
          message: "Export failed. Please try again later.",
          // Only include error details in development
          ...(process.env.NODE_ENV === "development" && {details: error.message}),
        });
      }
    } else {
      res.status(500).json({
        error: "Internal server error",
        message: "Export failed. Please try again later.",
      });
    }
  }
});

/**
 * Optional health check endpoint
 * @function
 * @param {any} req - Express request object
 * @param {any} res - Express response object
 */
export const healthCheck = onRequest((_req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});
