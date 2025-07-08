# Analytics Export API

A Cloud Function that exports comprehensive page analytics data from BigQuery in multiple formats (CSV, Excel, JSON). This service combines Google Analytics 4 data with Supabase click tracking to provide complete page performance insights.

## Features

- **Unified Analytics**: Combines GA4 page data with Supabase shortlink click tracking
- **Multiple Formats**: Export as CSV, Excel-compatible CSV, or JSON
- **Comprehensive Reports**: 8 data sections including page performance, user interactions, and geographic insights
- **Real-time Data**: Uses up-to-date BigQuery views with Airbyte data sync
- **Flexible Filtering**: Filter by project, date range, and specific pages

## API Endpoint

```
GET https://exportanalytics-qob6vapoca-uc.a.run.app/exportAnalytics
```

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `type` | string | Yes | Export type. Use `full_report` for complete analytics |
| `project_id` | string | Yes | Project identifier from Firestore |
| `start_date` | string | Yes | Start date in YYYY-MM-DD format |
| `end_date` | string | Yes | End date in YYYY-MM-DD format |
| `format` | string | No | Output format: `csv`, `excel`, or `json` (default: `csv`) |
| `page_slug` | string | No | Optional filter for specific page (e.g., `mdlz-deca-july-4`) |

## Example Usage

### Download Complete Report (Excel Format)
```
https://exportanalytics-qob6vapoca-uc.a.run.app/exportAnalytics?type=full_report&project_id=R9GVSSORudf2g9kmcgVX&start_date=2025-06-01&end_date=2025-06-30&format=excel
```

### Download Specific Page Report (CSV)
```
https://exportanalytics-qob6vapoca-uc.a.run.app/exportAnalytics?type=full_report&project_id=R9GVSSORudf2g9kmcgVX&start_date=2025-06-24&end_date=2025-06-25&page_slug=mdlz-deca-july-4&format=csv
```

### Get JSON Data for API Integration
```
https://exportanalytics-qob6vapoca-uc.a.run.app/exportAnalytics?type=full_report&project_id=R9GVSSORudf2g9kmcgVX&start_date=2025-06-01&end_date=2025-06-30&format=json
```

## Report Sections

The full report includes 8 comprehensive sections:

### 1. General Analytics
- Landing Page URL
- Total Page Views
- Total Users
- Average Engagement Duration (HH:MM:SS format)
- Total Clicks (external links only)

### 2. Page Views by Date
- Daily page view trends
- Sorted by highest traffic days

### 3. Link Clicks by Date
- Daily click-through trends
- Only includes real external link clicks
- Excludes internal GA4 events

### 4. Consumer Interactions Overview
- Event types and counts
- Includes: page_view, session_start, click events

### 5. Clicks by URLs
- Performance of each destination link
- Shows actual URLs clicked by users
- Sorted by click volume

### 6. Page Views by Device Type
- Mobile, desktop, tablet breakdown
- Aggregated across date range

### 7. Top 25 Domain Sources
- Traffic source analysis
- Shows referral domains and traffic volume

### 8. Top 25 Cities
- Geographic performance data
- Region and city breakdown
- Sorted by page views

## Data Sources

This API pulls from unified BigQuery views that combine:

- **Google Analytics 4**: Page views, users, engagement metrics, device data
- **Supabase Click Tracking**: Shortlink click data with destination URLs
- **Firestore**: Project metadata and link mappings

Data is synced via Airbyte and processed through custom BigQuery views for accurate reporting.

## Response Formats

### CSV/Excel Format
- Multi-section CSV with clear headers
- Excel-compatible formatting
- Automatic download with descriptive filename
- Professional layout for presentations

### JSON Format
```json
{
  "data": {
    "general": [...],
    "pageviews_by_date": [...],
    "clicks_by_date": [...],
    "interactions": [...],
    "clicks_by_url": [...],
    "pageviews_by_device": [...],
    "top_cities": [...],
    "top_traffic_sources": [...]
  },
  "metadata": {
    "type": "full_report",
    "project_id": "...",
    "start_date": "...",
    "end_date": "...",
    "generated_at": "2025-01-08T10:30:00.000Z"
  }
}
```

## Implementation Examples

### HTML Download Link
```html
<a href="https://exportanalytics-qob6vapoca-uc.a.run.app/exportAnalytics?type=full_report&project_id=PROJECT_ID&start_date=2025-06-01&end_date=2025-06-30&format=excel" 
   download="analytics_report.csv">
   📊 Download Analytics Report
</a>
```

### JavaScript Function
```javascript
function downloadAnalyticsReport(projectId, startDate, endDate, pageSlug = null) {
  const params = new URLSearchParams({
    type: 'full_report',
    project_id: projectId,
    start_date: startDate,
    end_date: endDate,
    format: 'excel'
  });
  
  if (pageSlug) params.append('page_slug', pageSlug);
  
  const url = `https://exportanalytics-qob6vapoca-uc.a.run.app/exportAnalytics?${params}`;
  window.open(url, '_blank');
}

// Usage
downloadAnalyticsReport('R9GVSSORudf2g9kmcgVX', '2025-06-01', '2025-06-30');
```

### React Component
```jsx
const AnalyticsExport = ({ projectId, startDate, endDate, pageSlug }) => {
  const handleDownload = (format) => {
    const params = new URLSearchParams({
      type: 'full_report',
      project_id: projectId,
      start_date: startDate,
      end_date: endDate,
      format: format
    });
    
    if (pageSlug) params.append('page_slug', pageSlug);
    
    const url = `https://exportanalytics-qob6vapoca-uc.a.run.app/exportAnalytics?${params}`;
    window.open(url, '_blank');
  };

  return (
    <div>
      <button onClick={() => handleDownload('excel')}>
        📊 Download Excel Report
      </button>
      <button onClick={() => handleDownload('csv')}>
        📄 Download CSV
      </button>
    </div>
  );
};
```

## Error Handling

The API returns appropriate HTTP status codes and error messages:

- **400**: Missing or invalid parameters
- **403**: Permission denied
- **404**: Data not found
- **500**: Internal server error
- **504**: Query timeout

## Rate Limits & Performance

- **Query Timeout**: 30 seconds
- **Date Range Limit**: Maximum 365 days
- **Data Processing**: Optimized BigQuery views for fast exports
- **File Size**: Typical reports are 10-100KB

## Security

- **CORS Enabled**: Supports cross-origin requests
- **Input Validation**: All parameters are validated
- **SQL Injection Protection**: Parameterized queries only
- **No Authentication Required**: Public read access to aggregated analytics data

## Support

For technical issues or feature requests, contact the development team or check the BigQuery views for data source details.

## Version

Current version: 1.0.0
Last updated: January 2025