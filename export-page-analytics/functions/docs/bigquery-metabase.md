## Overview

The Incarts Pages Analytics system provides comprehensive analytics for landing pages created on the platform. It combines data from Google Analytics 4 (GA4), Firestore, and Supabase to deliver unified insights on page performance, user behavior, traffic sources, and click-through rates.

**Date Range:** June 24, 2025 - Present  
**Total Pages Tracked:** 541 unique pages across 35 projects  
**Data Sources:** GA4 (via Airbyte), Firestore (streaming), Supabase (historical clicks)

---

## System Architecture

### Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    RAW DATA SOURCES                          │
├─────────────────────────────────────────────────────────────┤
│  • GA4 (7 reports) → Airbyte → BigQuery                     │
│  • Firestore (3 collections) → Streaming → BigQuery         │
│  • Supabase (clicks) → Airbyte → BigQuery                   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                 PHASE 1: FOUNDATION VIEWS                    │
├─────────────────────────────────────────────────────────────┤
│  • pages_master_mapping_v4 (541 pages → projects)           │
│  • projects_clean_pages_v4 (315 projects)                   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              PHASE 2: CORE ANALYTICS VIEWS                   │
├─────────────────────────────────────────────────────────────┤
│  • pages_core_analytics_v4 (matches GA4: 57,295 views)      │
│  • pages_click_analytics_v4 (146 clicks tracked)            │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│           PHASE 3: DIMENSIONAL ANALYTICS VIEWS               │
├─────────────────────────────────────────────────────────────┤
│  • pages_traffic_source_analytics_v4 (34 source/medium)     │
│  • pages_geographic_analytics_v4 (54 countries)             │
│  • pages_device_analytics_v4 (4 device types)               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│            PHASE 4: UNIFIED ANALYTICS VIEW                   │
├─────────────────────────────────────────────────────────────┤
│  • pages_complete_analytics_v4 ⭐ MASTER VIEW               │
│  • dashboard_summary_with_traffic_pages_v4 (with filters)   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│         PHASE 5: DASHBOARD-OPTIMIZED VIEWS                   │
├─────────────────────────────────────────────────────────────┤
│  • dashboard_summary_metrics_pages_v4                        │
│  • dashboard_pageviews_by_date_pages_v4                      │
│  • dashboard_top_cities_pages_v4                             │
│  • dashboard_click_through_details_pages_v4                  │
│  • dashboard_device_breakdown_pages_v4                       │
│  • dashboard_clicks_with_traffic_pages_v4                    │
│  • dashboard_device_with_traffic_pages_v4                    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    METABASE DASHBOARDS                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Core Principles

### 1. Single Source of Truth
- **`pages_core_analytics_v4`** matches GA4 data exactly (99.94% accuracy)
- All totals and aggregations derive from this view
- Dimensional views are for breakdowns only, never for totaling

### 2. Fan Trap Prevention
- Deduplicated page-to-project mapping prevents data multiplication
- Pre-aggregation strategy for clicks before joining
- One row per page/date in core analytics (no cartesian products)

### 3. Universal Filtering
All views support filtering by:
- ✅ **date** - Date range filtering
- ✅ **project_id** - Multi-tenant project filtering
- ✅ **page_slug** - Individual page filtering
- ✅ **source** - Traffic source (where applicable)
- ✅ **medium** - Traffic medium (where applicable)

### 4. Project-Centric Architecture
- Every page belongs to a project
- All analytics filterable by project for multi-tenant usage
- Project context preserved throughout data pipeline

---

## Key Metrics

### Page Performance Metrics
| Metric | Description | Source |
|--------|-------------|--------|
| **Page Views** | Total number of page views | GA4 `screenPageViews` |
| **Users** | Unique users visiting pages | GA4 `totalUsers` |
| **Sessions** | Number of sessions containing page views | GA4 `sessions` |
| **Avg Session Duration** | Average time users spend on page (seconds) | GA4 `averageSessionDuration` |
| **Bounce Rate** | Percentage of single-page sessions | GA4 `bounceRate` |

### Click-Through Metrics
| Metric | Description | Source |
|--------|-------------|--------|
| **Total Clicks** | Number of link clicks on pages | GA4 click events + Supabase |
| **Click-Through Rate (CTR)** | (Clicks ÷ Page Views) × 100 | Calculated |
| **Unique Destinations** | Number of different URLs clicked | Distinct destination URLs |

### Engagement Metrics
| Metric | Description | Source |
|--------|-------------|--------|
| **Engagement Rate** | Percentage of engaged sessions | GA4 `engagementRate` |
| **Sessions/Views** | Session to page view ratio | Calculated |

---

## View Reference

### Foundation Views (Phase 1)

#### `pages_master_mapping_v4`
**Purpose:** Deduplicated 1:1 mapping of pages to projects  
**Records:** 541 pages  
**Critical:** Prevents fan traps by ensuring single project per page slug  
**Columns:**
- `page_slug` - URL identifier (e.g., "mdlz-deca-july-4")
- `project_id` - Project UUID
- `project_name` - Human-readable project name
- `page_url` - Full page URL
- `page_document_id` - Firestore document ID

#### `projects_clean_pages_v4`
**Purpose:** Clean project metadata  
**Records:** 315 projects  
**Columns:**
- `project_id` - Project UUID
- `project_name` - Project name
- `business_name` - Business/client name
- `project_status` - Status (published, draft, etc.)
- `is_active` - Active flag

---

### Core Analytics Views (Phase 2)

#### `pages_core_analytics_v4` ⭐
**Purpose:** Foundation analytics view - matches GA4 exactly  
**Records:** 632 page/date combinations  
**Coverage:** 96% of pages mapped to projects  
**Date Range:** June 24, 2025 - Present  

**Validation:** 
- ✅ Total views: 57,295 (GA4: 57,328 = 99.94% match)
- ✅ No fan traps (one row per page/date)
- ✅ Individual page totals match GA4 exactly

**Columns:**
- `page_slug`, `project_id`, `project_name`, `full_page_path`
- `date` (DATE type)
- `page_views`, `users`, `sessions`
- `avg_session_duration_seconds` (converted from fractional)
- `bounce_rate_pct` (converted to percentage)

**Usage:** Primary source for all total calculations

#### `pages_click_analytics_v4`
**Purpose:** Click event tracking with destination URLs  
**Records:** 93 click records  
**Pages with clicks:** 33 pages  
**Total clicks tracked:** 146 clicks  

**Columns:**
- `page_slug`, `project_id`, `project_name`, `date`
- `destination_url` - Where user was directed
- `event_name` - GA4 event type
- `click_count` - Number of clicks
- `users_who_clicked` - Unique users who clicked

**Note:** Only includes clicks with valid destination URLs

---

### Dimensional Analytics Views (Phase 3)

#### `pages_traffic_source_analytics_v4`
**Purpose:** Traffic source/medium breakdown  
**Records:** 915 records  
**Source/Medium Combinations:** 34  

**Top Sources:**
1. track.celtra.com (referral) - 26,657 views
2. (direct) / (none) - 1,136 views  
3. google (organic) - 894 views

**Columns:**
- `page_slug`, `project_id`, `project_name`, `date`
- `source` - Traffic source (e.g., "google", "(direct)")
- `medium` - Traffic medium (e.g., "organic", "referral")
- `page_views`, `users`, `sessions`
- `avg_session_duration_seconds`

**Filters:** Excludes "(not set)" values

#### `pages_geographic_analytics_v4`
**Purpose:** Geographic distribution of page views  
**Records:** 22,789 city-level records  
**Countries:** 54  

**Top Cities:**
1. New York, NY - 5,740 views
2. Chicago, IL - 1,269 views
3. San Antonio, TX - 1,209 views

**Columns:**
- `page_slug`, `project_id`, `project_name`, `date`
- `country`, `state`, `city`
- `page_views`, `users`, `sessions`
- `avg_session_duration_seconds`, `bounce_rate_pct`

**Note:** Empty city values normalized to "(not set)"

#### `pages_device_analytics_v4`
**Purpose:** Device category breakdown  
**Records:** 1,895 records  
**Device Types:** 4 (mobile, desktop, tablet, smart tv)  

**Device Distribution:**
- Mobile: 65,389 views (78%)
- Desktop: 12,432 views (15%)
- Tablet: 5,454 views (7%)
- Smart TV: 29 views (<1%)

**Columns:**
- `page_slug`, `project_id`, `project_name`, `date`
- `device_category` - Primary device type
- `operating_system`, `browser` - Detailed breakdowns
- `page_views`, `users`, `sessions`
- `avg_session_duration_seconds`, `bounce_rate_pct`
- `engagement_rate_pct`

**Important:** Source/medium filters NOT available on device views (GA4 limitation)

---

### Unified Analytics Views (Phase 4)

#### `pages_complete_analytics_v4` ⭐
**Purpose:** Master unified view combining page metrics + clicks  
**Records:** 632 (one per page/date)  
**Validation:** Matches GA4 totals exactly  

**Columns:**
- All columns from `pages_core_analytics_v4`
- `total_clicks` - Aggregated click count
- `unique_click_destinations` - Number of different URLs clicked
- `ctr_pct` - Click-through rate percentage

**Critical Design:**
- Does NOT include source/medium columns (prevents fan traps)
- Pre-aggregates clicks before joining (safe aggregation)
- Use for ALL total calculations and summaries

#### `dashboard_summary_with_traffic_pages_v4`
**Purpose:** Summary metrics with source/medium filtering capability  
**Records:** 915 (broken down by source/medium)  

**Columns:**
- All core metrics plus `source` and `medium`
- Allows filtering by traffic dimensions

**Use When:** Need to filter metrics by source/medium  
**Don't Use When:** Calculating overall totals (use `pages_complete_analytics_v4` instead)

---

### Dashboard Views (Phase 5)

#### `dashboard_summary_metrics_pages_v4`
**Purpose:** Optimized for Metabase number cards  
**Use:** Total page views, users, sessions, CTR  
**Filters:** date, project_id, page_slug

#### `dashboard_pageviews_by_date_pages_v4`
**Purpose:** Time series data for line charts  
**Aggregation:** Daily totals per project  
**Use:** "Page Views Over Time" and "Clicks Over Time" charts

#### `dashboard_top_cities_pages_v4`
**Purpose:** Geographic rankings pre-aggregated  
**Use:** "Top 25 Cities" bar chart  
**Sorted by:** Total page views descending

#### `dashboard_click_through_details_pages_v4`
**Purpose:** Detailed click breakdown with URLs  
**Use:** "Click Through Details" table  
**Columns:** page_slug, destination_url, event_name, clicks

#### `dashboard_clicks_with_traffic_pages_v4`
**Purpose:** Click details with source/medium filtering  
**Use:** Click table with full filter support  
**Filters:** All 5 filters (date, project_id, page_slug, source, medium)

#### `dashboard_device_breakdown_pages_v4`
**Purpose:** Device performance aggregated by project  
**Use:** Device analytics summaries

#### `dashboard_device_with_traffic_pages_v4`
**Purpose:** Device data with traffic dimensions  
**Warning:** ⚠️ Not recommended for summing - use for filtering only

---

## Filtering Capabilities

### Universal Filters (Available on Most Views)
```sql
WHERE {{date}}                    -- Date range
  [[AND {{project_id}}]]          -- Project filter
  [[AND {{page_slug}}]]           -- Page filter
  [[AND {{source}}]]              -- Traffic source
  [[AND {{medium}}]]              -- Traffic medium
```

### View-Specific Filter Support

| View | date | project_id | page_slug | source | medium |
|------|------|------------|-----------|--------|--------|
| pages_core_analytics_v4 | ✅ | ✅ | ✅ | ❌ | ❌ |
| pages_complete_analytics_v4 | ✅ | ✅ | ✅ | ❌ | ❌ |
| dashboard_summary_with_traffic_pages_v4 | ✅ | ✅ | ✅ | ✅ | ✅ |
| pages_traffic_source_analytics_v4 | ✅ | ✅ | ✅ | ✅ | ✅ |
| pages_device_analytics_v4 | ✅ | ✅ | ✅ | ❌ | ❌ |
| pages_geographic_analytics_v4 | ✅ | ✅ | ✅ | ❌ | ❌ |
| dashboard_clicks_with_traffic_pages_v4 | ✅ | ✅ | ✅ | ✅ | ✅ |

**Note:** Device and geographic views cannot be filtered by source/medium due to GA4 data structure limitations.

---

## Common Use Cases

### 1. Total Page Views for a Project
```sql
SELECT SUM(page_views) AS total_views
FROM `incarts.analytics.pages_complete_analytics_v4`
WHERE project_id = 'PROJECT_ID'
  AND date BETWEEN 'START_DATE' AND 'END_DATE'
```

### 2. CTR Analysis by Page
```sql
SELECT 
  page_slug,
  SUM(page_views) as views,
  SUM(total_clicks) as clicks,
  ROUND(SUM(total_clicks) * 100.0 / SUM(page_views), 2) as ctr_pct
FROM `incarts.analytics.pages_complete_analytics_v4`
WHERE project_id = 'PROJECT_ID'
GROUP BY page_slug
ORDER BY ctr_pct DESC
```

### 3. Traffic Source Performance
```sql
SELECT 
  source,
  medium,
  SUM(page_views) as total_views,
  SUM(users) as total_users
FROM `incarts.analytics.pages_traffic_source_analytics_v4`
WHERE project_id = 'PROJECT_ID'
  AND date BETWEEN 'START_DATE' AND 'END_DATE'
GROUP BY source, medium
ORDER BY total_views DESC
```

### 4. Geographic Distribution
```sql
SELECT 
  city,
  state,
  country,
  SUM(page_views) as total_views
FROM `incarts.analytics.pages_geographic_analytics_v4`
WHERE project_id = 'PROJECT_ID'
  AND city != '(not set)'
GROUP BY city, state, country
ORDER BY total_views DESC
LIMIT 25
```

### 5. Device Breakdown
```sql
SELECT 
  device_category,
  SUM(page_views) as total_views
FROM `incarts.analytics.pages_device_analytics_v4`
WHERE project_id = 'PROJECT_ID'
  AND date BETWEEN 'START_DATE' AND 'END_DATE'
GROUP BY device_category
ORDER BY total_views DESC
```

### 6. Click Destination Analysis
```sql
SELECT 
  page_slug,
  destination_url,
  SUM(total_clicks) as clicks
FROM `incarts.analytics.dashboard_click_through_details_pages_v4`
WHERE project_id = 'PROJECT_ID'
  AND date BETWEEN 'START_DATE' AND 'END_DATE'
GROUP BY page_slug, destination_url
ORDER BY clicks DESC
```

---

## Metabase Dashboard Configuration

### Required Visualizations

#### 1. Summary Number Cards
- Total Page Views
- Total Users
- Average Session Duration
- Bounce Rate
- Average CTR
- Total Clicks

**View:** `dashboard_summary_with_traffic_pages_v4`  
**Filters:** All 5 filters available

#### 2. Time Series Charts
- Page Views by Date (Line)
- Total Clicks by Date (Line)

**View:** `dashboard_summary_with_traffic_pages_v4` (aggregated by date)  
**Filters:** All 5 filters available

#### 3. Geographic Chart
- Top 25 Cities by Page Views (Bar)

**View:** `pages_geographic_analytics_v4` (aggregated)  
**Filters:** date, project_id, page_slug only

#### 4. Device Chart
- Page Views by Device Type (Bar)

**View:** `pages_device_analytics_v4` (aggregated)  
**Filters:** date, project_id, page_slug only  
**Note:** Source/medium filters NOT available

#### 5. Tables
- Click Through Details (page_slug, destination, clicks)
- Traffic Source/Medium (date, source, medium, users, views)

**Views:** `dashboard_clicks_with_traffic_pages_v4` and `pages_traffic_source_analytics_v4`  
**Filters:** All 5 filters available

---

## Data Quality & Validation

### Validation Checkpoints

#### 1. Fan Trap Detection
```sql
-- Should return 0 rows (one row per page/date)
SELECT page_slug, date, COUNT(*) as duplicates
FROM `incarts.analytics.pages_complete_analytics_v4`
GROUP BY page_slug, date
HAVING COUNT(*) > 1
```

#### 2. Totals Validation Against GA4
```sql
-- Compare with GA4 screenshot totals
SELECT 
  SUM(page_views) as total_views,
  SUM(users) as total_users,
  SUM(sessions) as total_sessions
FROM `incarts.analytics.pages_complete_analytics_v4`
WHERE date BETWEEN '2025-06-24' AND '2025-10-19'
-- Should match GA4: 57,328 views, 46,592 users, 49,243 sessions
```

#### 3. Project Mapping Coverage
```sql
-- Check unmapped pages
SELECT 
  COUNT(*) as total_pages,
  COUNT(project_id) as mapped_pages,
  COUNT(*) - COUNT(project_id) as unmapped_pages
FROM `incarts.analytics.pages_complete_analytics_v4`
-- Should be 96%+ mapped
```

#### 4. CTR Reasonability Check
```sql
-- Flag suspicious CTR values
SELECT page_slug, date, page_views, total_clicks, ctr_pct
FROM `incarts.analytics.pages_complete_analytics_v4`
WHERE ctr_pct > 100  -- Multiple clicks per view
ORDER BY ctr_pct DESC
```

### Known Data Quality Notes

1. **4% Unmapped Pages** - Test/deleted pages without project assignments
2. **CTR > 100%** - Valid when users click multiple links per page view
3. **"(not set)" Values** - GA4 placeholder for unavailable data
4. **Direct Traffic** - Appears as source="(direct)", medium="(none)"

---

## Important Limitations

### 1. GA4 Dimensional Constraints
**Issue:** GA4 doesn't allow combining certain dimensions in single reports  
**Impact:** Device breakdown cannot be filtered by source/medium  
**Workaround:** Use device view without source/medium filters OR create new GA4 custom report

### 2. Historical Click Data
**Issue:** Click tracking implementation may have gaps  
**Impact:** Only 33 pages (18%) have click data  
**Note:** More pages will accumulate click data over time

### 3. Supabase Historical Data
**Issue:** Historical clicks stored separately from real-time GA4 clicks  
**Impact:** Click totals combine both sources for complete picture

### 4. Date Range
**Limitation:** Analytics start from June 24, 2025  
**Reason:** System implementation date

---

## Troubleshooting

### Problem: Inflated Page View Totals

**Symptom:** Totals much higher than GA4  
**Cause:** Fan trap from joining dimensional views  
**Solution:** Use `pages_complete_analytics_v4` for totals, not dimensional views

### Problem: Missing Source/Medium in Device Chart

**Symptom:** Source/medium filters don't work on device breakdown  
**Cause:** GA4 data structure limitation  
**Solution:** This is expected - device and traffic source are separate dimensions in GA4

### Problem: CTR Shows NULL

**Symptom:** CTR is null for pages with views  
**Cause:** No click data recorded for that page  
**Solution:** This is normal - not all pages have clicks yet

### Problem: Date Filter Not Working

**Symptom:** Date parameter doesn't filter data  
**Cause:** Metabase field filter not mapped correctly  
**Solution:** Ensure date parameter is mapped to the view's `date` column (type: DATE)

### Problem: Missing Pages in Results

**Symptom:** Expected pages don't appear  
**Cause:** Pages not mapped to project or outside date range  
**Solution:** Check `pages_master_mapping_v4` for page existence and project assignment

---

## Maintenance Tasks

### Daily
- ✅ Verify Airbyte syncs completed successfully
- ✅ Check Firestore streaming for latest data
- ✅ Monitor BigQuery query performance

### Weekly
- ✅ Run validation queries against GA4 totals
- ✅ Check for new unmapped pages (project_id IS NULL)
- ✅ Review fan trap detection queries
- ✅ Validate CTR calculations on high-traffic pages

### Monthly
- ✅ Review data quality metrics
- ✅ Update documentation with new insights
- ✅ Optimize slow-running Metabase queries
- ✅ Archive old partition data if needed

---

## Extension Guidelines

### Adding New GA4 Dimensions

1. **Design GA4 Report** in Google Analytics interface
2. **Create Airbyte Connection** for new report
3. **Create Foundation View** with project mapping
4. **Validate for Fan Traps** before production use
5. **Add to Dashboard Views** if needed for Metabase

### Adding New Metrics

1. **Verify Metric Availability** in GA4 source data
2. **Add to Core Analytics View** first
3. **Propagate to Dashboard Views** that need it
4. **Update Metabase Queries** to include new metric
5. **Document Calculation Logic** in this guide

### Creating New Dashboards

1. **Identify Required Metrics** and dimensions
2. **Choose Appropriate Base View** (complete vs dimensional)
3. **Test Filter Combinations** for fan traps
4. **Validate Totals** against GA4 or known values
5. **Document Query Pattern** for future reference

---

## API Integration Guide

### Querying from Cloud Functions

```javascript
const {BigQuery} = require('@google-cloud/bigquery');
const bigquery = new BigQuery({projectId: 'incarts'});

async function getPageAnalytics(projectId, startDate, endDate) {
  const query = `
    SELECT 
      page_slug,
      SUM(page_views) as total_views,
      SUM(total_clicks) as total_clicks,
      ROUND(SUM(total_clicks) * 100.0 / SUM(page_views), 2) as ctr_pct
    FROM \`incarts.analytics.pages_complete_analytics_v4\`
    WHERE project_id = @projectId
      AND date BETWEEN @startDate AND @endDate
    GROUP BY page_slug
    ORDER BY total_views DESC
  `;
  
  const options = {
    query: query,
    params: {projectId, startDate, endDate}
  };
  
  const [rows] = await bigquery.query(options);
  return rows;
}
```

### Best Practices for Cloud Functions

1. **Use Parameterized Queries** to prevent SQL injection
2. **Always Filter by Project ID** for multi-tenant security
3. **Use `pages_complete_analytics_v4`** for accurate totals
4. **Cache Results** where appropriate (e.g., 1-hour TTL)
5. **Set Query Timeouts** to prevent long-running queries

---

## Performance Optimization

### Query Performance Tips

1. **Always Include Date Filters** - Reduces data scanning
2. **Filter by project_id Early** - Leverages clustering
3. **Use Dashboard Views** - Pre-aggregated for speed
4. **Limit Result Sets** - Use TOP/LIMIT clauses
5. **Avoid SELECT *** - Specify needed columns only

### BigQuery Optimization

```sql
-- ✅ Good: Filtered and limited
SELECT page_slug, SUM(page_views) as views
FROM `incarts.analytics.pages_complete_analytics_v4`
WHERE date >= CURRENT_DATE() - 30
  AND project_id = 'abc123'
GROUP BY page_slug
LIMIT 100

-- ❌ Bad: Full table scan
SELECT *
FROM `incarts.analytics.pages_complete_analytics_v4`
```

### Metabase Caching

- Enable query caching (1-24 hours depending on use case)
- Use "Saved Questions" for commonly run queries
- Schedule dashboard refreshes during off-peak hours

---

## Glossary

| Term | Definition |
|------|------------|
| **Page Slug** | URL-friendly identifier for a page (e.g., "mdlz-deca-july-4") |
| **Fan Trap** | SQL anti-pattern causing data multiplication through joins |
| **CTR** | Click-Through Rate: (Clicks ÷ Page Views) × 100 |
| **Bounce Rate** | Percentage of single-page sessions |
| **Session** | Group of user interactions within a time window |
| **Engagement Rate** | Percentage of sessions with meaningful interaction |
| **Source** | Where traffic originated (e.g., "google", "(direct)") |
| **Medium** | How traffic arrived (e.g., "organic", "referral") |
| **(not set)** | GA4 placeholder for unavailable dimension values |
| **Project** | Client/campaign grouping for pages |

---

## Support & Contact

**System Owner:** Incarts Analytics Team  
**Documentation Version:** 1.0  
**Last Updated:** October 20, 2025  
**BigQuery Project:** `incarts`  
**Dataset:** `incarts.analytics`

For questions or issues:
1. Check this documentation first
2. Review troubleshooting section
3. Validate with known test cases
4. Contact analytics team with specific error messages

---

## Appendix: View Inventory

### Complete List of Views (16 total)

**Phase 1: Foundation (2)**
1. pages_master_mapping_v4
2. projects_clean_pages_v4

**Phase 2: Core Analytics (2)**
3. pages_core_analytics_v4 ⭐
4. pages_click_analytics_v4

**Phase 3: Dimensional (3)**
5. pages_traffic_source_analytics_v4
6. pages_geographic_analytics_v4
7. pages_device_analytics_v4

**Phase 4: Unified (2)**
8. pages_complete_analytics_v4 ⭐
9. dashboard_summary_with_traffic_pages_v4

**Phase 5: Dashboard (7)**
10. dashboard_summary_metrics_pages_v4
11. dashboard_pageviews_by_date_pages_v4
12. dashboard_top_cities_pages_v4
13. dashboard_click_through_details_pages_v4
14. dashboard_device_breakdown_pages_v4
15. dashboard_clicks_with_traffic_pages_v4
16. dashboard_device_with_traffic_pages_v4

⭐ = Primary views for most use cases

---

## Quick Reference Card

### Which View Should I Use?

| Need | Use This View |
|------|---------------|
| Overall totals | `pages_complete_analytics_v4` |
| Source/medium breakdown | `pages_traffic_source_analytics_v4` |
| Geographic analysis | `pages_geographic_analytics_v4` |
| Device breakdown | `pages_device_analytics_v4` |
| Click details | `dashboard_clicks_with_traffic_pages_v4` |
| Time series | `dashboard_pageviews_by_date_pages_v4` |
| With source/medium filters | `dashboard_summary_with_traffic_pages_v4` |

### All Filters Available?

| View Type | date | project | page | source | medium |
|-----------|------|---------|------|--------|--------|
| Core/Complete | ✅ | ✅ | ✅ | ❌ | ❌ |
| Traffic | ✅ | ✅ | ✅ | ✅ | ✅ |
| Device | ✅ | ✅ | ✅ | ❌ | ❌ |
| Geographic | ✅ | ✅ | ✅ | ❌ | ❌ |
| With Traffic | ✅ | ✅ | ✅ | ✅ | ✅ |

---