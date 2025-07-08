/**
 * @fileoverview Analytics export Cloud Function for BigQuery data
 * @description Exports analytics data from BigQuery tables in CSV or JSON format
 * @module analytics-export
 * @related BigQuery tables: complete_page_analytics, unified_click_analytics, complete_ctr_analysis, pages_device_breakdown, pages_geographic_breakdown, pages_traffic_sources
 * @updated Uses new unified analytics views with Supabase + GA4 integration
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

// Query definitions - Clean export-specific queries for desired report format
const QUERIES: Record<string, string> = {
  general: `
    WITH page_summary AS (
      SELECT 
        page_slug,
        SUM(total_page_views) as total_page_views,
        SUM(total_users) as total_users,
        AVG(avg_session_duration) as avg_engagement_duration
      FROM \`incarts.analytics.complete_page_analytics\`
      WHERE project_id = @project_id
        AND date BETWEEN @start_date AND @end_date
        AND (@page_slug IS NULL OR page_slug = @page_slug)
      GROUP BY page_slug
    ),
    click_summary AS (
      SELECT 
        page_slug,
        SUM(clicks) as total_real_clicks
      FROM \`incarts.analytics.unified_click_analytics\`
      WHERE project_id = @project_id
        AND date BETWEEN @start_date AND @end_date
        AND (@page_slug IS NULL OR page_slug = @page_slug)
        AND destination_url IS NOT NULL
        AND destination_url != ''
      GROUP BY page_slug
    )
    SELECT 
      CONCAT('https://pages.incarts.co/pages/', ps.page_slug) as Landing_Page_URL,
      ps.total_page_views as Total_Page_Views,
      ps.total_users as Total_Users,
      CONCAT(
        CAST(FLOOR(ps.avg_engagement_duration / 3600) AS STRING), ':',
        LPAD(CAST(FLOOR(MOD(ps.avg_engagement_duration, 3600) / 60) AS STRING), 2, '0'), ':',
        LPAD(CAST(FLOOR(MOD(ps.avg_engagement_duration, 60)) AS STRING), 2, '0')
      ) as Average_Engagement_Duration,
      COALESCE(cs.total_real_clicks, 0) as Total_Clicks
    FROM page_summary ps
    LEFT JOIN click_summary cs ON ps.page_slug = cs.page_slug
    ORDER BY ps.total_page_views DESC
    LIMIT 1
  `,

  pageviews_by_date: `
    SELECT 
      CAST(date AS STRING) as Date,
      SUM(total_page_views) as PageViews
    FROM \`incarts.analytics.complete_page_analytics\`
    WHERE project_id = @project_id
      AND date BETWEEN @start_date AND @end_date
      AND (@page_slug IS NULL OR page_slug = @page_slug)
    GROUP BY date
    ORDER BY PageViews DESC
  `,

  clicks_by_date: `
    SELECT 
      CAST(date AS STRING) as Date,
      SUM(clicks) as Link_Clicks
    FROM \`incarts.analytics.unified_click_analytics\`
    WHERE project_id = @project_id
      AND date BETWEEN @start_date AND @end_date
      AND (@page_slug IS NULL OR page_slug = @page_slug)
      AND destination_url IS NOT NULL
      AND destination_url != ''
    GROUP BY date
    HAVING SUM(clicks) > 0
    ORDER BY Link_Clicks DESC
  `,

  interactions: `
    WITH real_events AS (
      -- Page views from GA4
      SELECT 
        'page_view' as event_name,
        SUM(total_page_views) as event_count
      FROM \`incarts.analytics.complete_page_analytics\`
      WHERE project_id = @project_id
        AND date BETWEEN @start_date AND @end_date
        AND (@page_slug IS NULL OR page_slug = @page_slug)
      
      UNION ALL
      
      -- Session starts (approximate from total users)
      SELECT 
        'session_start' as event_name,
        SUM(total_users) as event_count
      FROM \`incarts.analytics.complete_page_analytics\`
      WHERE project_id = @project_id
        AND date BETWEEN @start_date AND @end_date
        AND (@page_slug IS NULL OR page_slug = @page_slug)
      
      UNION ALL
      
      -- Real clicks to external URLs
      SELECT 
        'click' as event_name,
        SUM(clicks) as event_count
      FROM \`incarts.analytics.unified_click_analytics\`
      WHERE project_id = @project_id
        AND date BETWEEN @start_date AND @end_date
        AND (@page_slug IS NULL OR page_slug = @page_slug)
        AND destination_url IS NOT NULL
        AND destination_url != ''
    )
    SELECT 
      event_name as Event_Name,
      event_count as Event_Count
    FROM real_events
    WHERE event_count > 0
    ORDER BY event_count DESC
  `,

  clicks_by_url: `
    SELECT 
      destination_url as URL,
      SUM(clicks) as Clicks
    FROM \`incarts.analytics.unified_click_analytics\`
    WHERE project_id = @project_id
      AND date BETWEEN @start_date AND @end_date
      AND destination_url IS NOT NULL
      AND destination_url != ''
      AND (@page_slug IS NULL OR page_slug = @page_slug)
    GROUP BY destination_url
    ORDER BY Clicks DESC
  `,

  pageviews_by_device: `
    SELECT 
      device_type as Device_Category,
      SUM(page_views) as PageViews
    FROM \`incarts.analytics.pages_device_breakdown\`
    WHERE project_id = @project_id
      AND date BETWEEN @start_date AND @end_date
      AND (@page_slug IS NULL OR page_slug = @page_slug)
    GROUP BY device_type
    ORDER BY PageViews DESC
  `,

  top_cities: `
    SELECT 
      COALESCE(state, '(not set)') as Region,
      COALESCE(city, '(not set)') as City,
      SUM(page_views) as PageViews
    FROM \`incarts.analytics.pages_geographic_breakdown\`
    WHERE project_id = @project_id
      AND date BETWEEN @start_date AND @end_date
      AND (@page_slug IS NULL OR page_slug = @page_slug)
    GROUP BY state, city
    ORDER BY PageViews DESC
    LIMIT 25
  `,

  top_traffic_sources: `
    SELECT 
      COALESCE(source, '(not set)') as Session_Source,
      SUM(page_views) as PageViews
    FROM \`incarts.analytics.pages_traffic_sources\`
    WHERE project_id = @project_id
      AND date BETWEEN @start_date AND @end_date
      AND (@page_slug IS NULL OR page_slug = @page_slug)
    GROUP BY source
    ORDER BY PageViews DESC
    LIMIT 25
  `,

  full_report: `
    SELECT 1 as placeholder
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
 * Generates a full analytics report by executing multiple queries
 * @function
 * @param {string} projectId - Project ID
 * @param {string} startDate - Start date
 * @param {string} endDate - End date
 * @param {string} pageSlug - Page slug filter
 * @returns {Promise<Object>} Full report data
 */
async function generateFullReport(projectId: string, startDate: string, endDate: string, pageSlug: string): Promise<any> {
  const params = {
    project_id: projectId,
    start_date: startDate,
    end_date: endDate,
    page_slug: pageSlug || null,
  };

  // Execute all queries in parallel
  const [
    generalData,
    pageviewsByDate,
    clicksByDate,
    interactions,
    clicksByUrl,
    pageviewsByDevice,
    topCities,
    topTrafficSources,
  ] = await Promise.all([
    bigquery.query({ query: QUERIES.general, params }),
    bigquery.query({ query: QUERIES.pageviews_by_date, params }),
    bigquery.query({ query: QUERIES.clicks_by_date, params }),
    bigquery.query({ query: QUERIES.interactions, params }),
    bigquery.query({ query: QUERIES.clicks_by_url, params }),
    bigquery.query({ query: QUERIES.pageviews_by_device, params }),
    bigquery.query({ query: QUERIES.top_cities, params }),
    bigquery.query({ query: QUERIES.top_traffic_sources, params }),
  ]);

  return {
    general: generalData[0],
    pageviews_by_date: pageviewsByDate[0],
    clicks_by_date: clicksByDate[0],
    interactions: interactions[0],
    clicks_by_url: clicksByUrl[0],
    pageviews_by_device: pageviewsByDevice[0],
    top_cities: topCities[0],
    top_traffic_sources: topTrafficSources[0],
  };
}

/**
 * Converts full report data to Excel-compatible CSV format
 * @function
 * @param {Object} reportData - Full report data object
 * @returns {string} Excel-compatible CSV formatted string
 */
function convertFullReportToExcelCSV(reportData: any): string {
  let csv = "sep=,\n"; // Excel separator hint
  
  // Add each section with headers to match desired format
  const sections = [
    { title: "GENERAL ANALYTICS", data: reportData.general },
    { title: "PAGEVIEWS BY DATE", data: reportData.pageviews_by_date },
    { title: "LINK CLICKS BY DATE", data: reportData.clicks_by_date },
    { title: "CONSUMER INTERACTIONS OVERVIEW", data: reportData.interactions },
    { title: "CLICKS BY URLS", data: reportData.clicks_by_url },
    { title: "PAGEVIEWS BY DEVICE TYPE", data: reportData.pageviews_by_device },
    { title: "TOP 25 DOMAIN SOURCES", data: reportData.top_traffic_sources },
    { title: "TOP 25 CITIES", data: reportData.top_cities },
  ];

  sections.forEach((section, index) => {
    if (index > 0) csv += "\n\n"; // Add spacing between sections
    
    csv += `${section.title}\n`;
    
    if (section.data && section.data.length > 0) {
      csv += convertToCSV(section.data);
    } else {
      csv += "No data available\n";
    }
  });

  return csv;
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
    if (!["csv", "json", "excel"].includes(format as string)) {
      res.status(400).json({
        error: "Invalid format",
        valid_formats: ["csv", "json", "excel"],
        received: format,
      });
      return;
    }

    // Execute BigQuery
    if (process.env.NODE_ENV === "development") {
      const pageSlugInfo = page_slug ? ` for page_slug: ${page_slug}` : "";
      logger.info(`Executing export: ${type} for project ${project_id} from ${start_date} to ${end_date}${pageSlugInfo}`);
    }

    // Handle full_report separately
    if (type === 'full_report') {
      const reportData = await generateFullReport(project_id as string, start_date as string, end_date as string, page_slug as string);
      
      if (format === 'csv') {
        const csv = convertFullReportToExcelCSV(reportData);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="analytics_report_${project_id}_${start_date}_${end_date}.csv"`);
        res.send(csv);
      } else if (format === 'excel') {
        const csv = convertFullReportToExcelCSV(reportData);
        res.setHeader('Content-Type', 'application/vnd.ms-excel');
        res.setHeader('Content-Disposition', `attachment; filename="analytics_report_${project_id}_${start_date}_${end_date}.csv"`);
        res.send(csv);
      } else {
        res.json({
          data: reportData,
          metadata: {
            type: type as string,
            project_id: project_id as string,
            start_date: start_date as string,
            end_date: end_date as string,
            sections: Object.keys(reportData),
            generated_at: new Date().toISOString(),
          },
        });
      }
      return;
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
