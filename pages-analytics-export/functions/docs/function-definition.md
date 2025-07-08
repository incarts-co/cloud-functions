// =============================================================
// COMPLETE CLOUD FUNCTION IMPLEMENTATION
// File: index.js
// =============================================================

const { BigQuery } = require('@google-cloud/bigquery');
const bigquery = new BigQuery();

// Query definitions
const QUERIES = {
  general: `
    SELECT 
      page_slug as "Page URL Slug",
      SUM(total_page_views) as "Total Page Views",
      SUM(total_page_views) as "Total Users", 
      AVG(avg_session_duration) as "Average Engagement Duration",
      SUM(total_clicks) as "Total Clicks"
    FROM \`incarts.analytics.unified_ctr_complete\`
    WHERE project_name = @project_id
      AND date BETWEEN @start_date AND @end_date
      AND total_page_views > 0
    GROUP BY page_slug
    ORDER BY SUM(total_page_views) DESC
  `,
  
  pageviews_by_date: `
    SELECT 
      date as "Date",
      SUM(total_page_views) as "Page Views"
    FROM \`incarts.analytics.unified_ctr_complete\`
    WHERE project_name = @project_id
      AND date BETWEEN @start_date AND @end_date
    GROUP BY date
    ORDER BY date
  `,
  
  clicks_by_date: `
    SELECT 
      date as "Date",
      SUM(total_clicks) as "Link Clicks"
    FROM \`incarts.analytics.unified_ctr_complete\`
    WHERE project_name = @project_id
      AND date BETWEEN @start_date AND @end_date
      AND total_clicks > 0
    GROUP BY date
    ORDER BY date
  `,
  
  interactions: `
    SELECT 
      link_action_type as "Event Name",
      SUM(total_clicks) as "Event Count"
    FROM \`incarts.analytics.unified_ctr_complete\`
    WHERE project_name = @project_id
      AND date BETWEEN @start_date AND @end_date
      AND link_action_type IS NOT NULL
    GROUP BY link_action_type
    ORDER BY SUM(total_clicks) DESC
  `,
  
  clicks_by_url: `
    SELECT 
      clicked_url as "Clicked URL",
      SUM(total_clicks) as "Click Count"
    FROM \`incarts.analytics.unified_ctr_complete\`
    WHERE project_name = @project_id
      AND date BETWEEN @start_date AND @end_date
      AND clicked_url IS NOT NULL
      AND total_clicks > 0
    GROUP BY clicked_url
    ORDER BY SUM(total_clicks) DESC
  `,
  
  pageviews_by_device: `
    SELECT 
      device_type as "Device Type",
      SUM(page_views) as "Page Views",
      SUM(users) as "Users"
    FROM \`incarts.analytics.pages_device_breakdown\`
    WHERE project_name = @project_id
      AND date BETWEEN @start_date AND @end_date
    GROUP BY device_type
    ORDER BY SUM(page_views) DESC
  `,
  
  top_cities: `
    SELECT 
      city as "City",
      state as "State", 
      country as "Country",
      SUM(users) as "Users",
      SUM(page_views) as "Page Views"
    FROM \`incarts.analytics.pages_geographic_breakdown\`
    WHERE project_name = @project_id
      AND date BETWEEN @start_date AND @end_date
      AND city IS NOT NULL
      AND city != '(not set)'
    GROUP BY city, state, country
    ORDER BY SUM(users) DESC
    LIMIT 25
  `,
  
  top_traffic_sources: `
    SELECT 
      source as "Traffic Source Domain",
      medium as "Medium",
      SUM(users) as "Users",
      SUM(sessions) as "Sessions",
      SUM(page_views) as "Page Views"
    FROM \`incarts.analytics.pages_traffic_sources\`
    WHERE project_name = @project_id
      AND date BETWEEN @start_date AND @end_date
      AND source IS NOT NULL
      AND source != '(direct)'
    GROUP BY source, medium
    ORDER BY SUM(users) DESC
    LIMIT 25
  `
};

// Utility function to convert array of objects to CSV
function convertToCSV(data) {
  if (!data || data.length === 0) {
    return '';
  }

  const headers = Object.keys(data[0]);
  const csvHeaders = headers.join(',');
  
  const csvRows = data.map(row => {
    return headers.map(header => {
      let value = row[header];
      
      // Handle null/undefined values
      if (value === null || value === undefined) {
        value = '';
      }
      
      // Handle dates
      if (value instanceof Date) {
        value = value.toISOString().split('T')[0];
      }
      
      // Escape quotes and wrap in quotes if contains comma
      value = String(value);
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        value = '"' + value.replace(/"/g, '""') + '"';
      }
      
      return value;
    }).join(',');
  });

  return csvHeaders + '\n' + csvRows.join('\n');
}

// Validation functions
function validateDateFormat(dateString) {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) return false;
  
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date);
}

function validateExportType(type) {
  return Object.keys(QUERIES).includes(type);
}

function validateProjectId(projectId) {
  // Basic validation - adjust based on your project ID format
  return typeof projectId === 'string' && projectId.length > 0 && projectId.length < 100;
}

// Security validation
function validateApiKey(apiKey) {
  // In production, use environment variable
  const validApiKeys = [
    process.env.API_KEY,
    process.env.API_KEY_SECONDARY // Optional secondary key
  ].filter(key => key); // Remove undefined keys
  
  return validApiKeys.includes(apiKey);
}

// Rate limiting (simple in-memory implementation)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10; // 10 requests per minute per IP

function checkRateLimit(ip) {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW;
  
  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, []);
  }
  
  const requests = rateLimitMap.get(ip);
  
  // Remove old requests
  const validRequests = requests.filter(timestamp => timestamp > windowStart);
  
  if (validRequests.length >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }
  
  validRequests.push(now);
  rateLimitMap.set(ip, validRequests);
  
  return true;
}

// Main export function
exports.exportAnalytics = async (req, res) => {
  try {
    // CORS headers
    res.set('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    
    // Only allow GET requests
    if (req.method !== 'GET') {
      return res.status(405).json({ 
        error: 'Method not allowed',
        allowed_methods: ['GET'] 
      });
    }
    
    // Get client IP for rate limiting
    const clientIP = req.headers['x-forwarded-for'] || 
                     req.headers['x-real-ip'] || 
                     req.connection.remoteAddress || 
                     'unknown';
    
    // Check rate limit
    if (!checkRateLimit(clientIP)) {
      return res.status(429).json({ 
        error: 'Rate limit exceeded',
        message: 'Too many requests. Please try again later.' 
      });
    }
    
    // Validate API key
    const apiKey = req.headers['x-api-key'] || req.query.api_key;
    if (!validateApiKey(apiKey)) {
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Invalid or missing API key' 
      });
    }
    
    // Extract and validate parameters
    const { type, project_id, start_date, end_date, format = 'csv' } = req.query;
    
    // Parameter validation
    if (!type || !project_id || !start_date || !end_date) {
      return res.status(400).json({ 
        error: 'Missing required parameters',
        required: ['type', 'project_id', 'start_date', 'end_date'],
        received: { type, project_id, start_date, end_date }
      });
    }
    
    if (!validateExportType(type)) {
      return res.status(400).json({ 
        error: 'Invalid export type',
        valid_types: Object.keys(QUERIES),
        received: type
      });
    }
    
    if (!validateProjectId(project_id)) {
      return res.status(400).json({ 
        error: 'Invalid project ID format' 
      });
    }
    
    if (!validateDateFormat(start_date) || !validateDateFormat(end_date)) {
      return res.status(400).json({ 
        error: 'Invalid date format',
        expected_format: 'YYYY-MM-DD',
        received: { start_date, end_date }
      });
    }
    
    // Validate date range
    const startDateObj = new Date(start_date);
    const endDateObj = new Date(end_date);
    const maxRangeDays = 365; // 1 year max
    
    if (startDateObj > endDateObj) {
      return res.status(400).json({ 
        error: 'Start date must be before end date' 
      });
    }
    
    const daysDifference = (endDateObj - startDateObj) / (1000 * 60 * 60 * 24);
    if (daysDifference > maxRangeDays) {
      return res.status(400).json({ 
        error: `Date range too large. Maximum ${maxRangeDays} days allowed.`,
        requested_days: Math.ceil(daysDifference)
      });
    }
    
    // Validate format
    if (!['csv', 'json'].includes(format)) {
      return res.status(400).json({ 
        error: 'Invalid format',
        valid_formats: ['csv', 'json'],
        received: format
      });
    }
    
    // Execute BigQuery
    console.log(`Executing export: ${type} for project ${project_id} from ${start_date} to ${end_date}`);
    
    const query = QUERIES[type];
    const options = {
      query: query,
      params: { 
        project_id: project_id, 
        start_date: start_date, 
        end_date: end_date 
      },
      // Add query timeout
      timeoutMs: 30000 // 30 seconds
    };

    const [rows] = await bigquery.query(options);
    
    console.log(`Query executed successfully. Returned ${rows.length} rows.`);
    
    // Handle empty results
    if (!rows || rows.length === 0) {
      const emptyResponse = format === 'csv' ? '' : [];
      
      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${type}_${project_id}_${start_date}_${end_date}.csv"`);
        res.send(emptyResponse);
      } else {
        res.json({
          data: emptyResponse,
          metadata: {
            type,
            project_id,
            start_date,
            end_date,
            row_count: 0
          }
        });
      }
      return;
    }
    
    // Return data in requested format
    if (format === 'csv') {
      const csv = convertToCSV(rows);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${type}_${project_id}_${start_date}_${end_date}.csv"`);
      res.send(csv);
    } else {
      res.json({
        data: rows,
        metadata: {
          type,
          project_id,
          start_date,
          end_date,
          row_count: rows.length,
          generated_at: new Date().toISOString()
        }
      });
    }
    
  } catch (error) {
    console.error('Export error:', error);
    
    // Different error handling based on error type
    if (error.message && error.message.includes('permission')) {
      res.status(403).json({ 
        error: 'Permission denied',
        message: 'Insufficient permissions to access the requested data' 
      });
    } else if (error.message && error.message.includes('timeout')) {
      res.status(504).json({ 
        error: 'Query timeout',
        message: 'The query took too long to execute. Please try a smaller date range.' 
      });
    } else {
      res.status(500).json({ 
        error: 'Internal server error',
        message: 'Export failed. Please try again later.',
        // Only include error details in development
        ...(process.env.NODE_ENV === 'development' && { details: error.message })
      });
    }
  }
};

// Optional: Health check endpoint
exports.healthCheck = (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
};