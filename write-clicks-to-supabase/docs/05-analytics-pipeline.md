# Analytics Pipeline Update Guide

## Overview
This guide covers updating the analytics pipeline to process and display QR code source data. The analytics pipeline consists of Cloud Functions that enrich clicks, Supabase for data storage, and Metabase for visualization.

## Current Architecture
- **Click Processing**: Cloud Function enriches clicks from Firestore
- **Data Storage**: Supabase PostgreSQL database
- **Visualization**: Metabase dashboards
- **Current Flow**: Firestore clicks → Enrichment → Supabase → Metabase

## Required Changes

### 1. Update Supabase Schema

**Database**: Supabase PostgreSQL

```sql
-- Add new columns to link_clicks table
ALTER TABLE public.link_clicks 
ADD COLUMN IF NOT EXISTS source_type VARCHAR(10) DEFAULT 'link',
ADD COLUMN IF NOT EXISTS qr_identifier VARCHAR(50),
ADD COLUMN IF NOT EXISTS qr_code_id VARCHAR(50);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_link_clicks_source_type 
ON public.link_clicks(source_type);

CREATE INDEX IF NOT EXISTS idx_link_clicks_qr_identifier 
ON public.link_clicks(qr_identifier);

CREATE INDEX IF NOT EXISTS idx_link_clicks_qr_code_id 
ON public.link_clicks(qr_code_id);

-- Create view for QR analytics
CREATE OR REPLACE VIEW qr_analytics AS
SELECT 
  short_id,
  source_type,
  qr_identifier,
  COUNT(*) as click_count,
  COUNT(DISTINCT ip_address) as unique_visitors,
  DATE(timestamp) as click_date,
  project_id,
  project_name
FROM link_clicks
WHERE timestamp >= NOW() - INTERVAL '30 days'
GROUP BY 
  short_id, 
  source_type, 
  qr_identifier, 
  DATE(timestamp),
  project_id,
  project_name;

-- Create summary view for QR vs Link comparison
CREATE OR REPLACE VIEW source_type_summary AS
SELECT 
  project_id,
  project_name,
  source_type,
  COUNT(*) as total_clicks,
  COUNT(DISTINCT short_id) as unique_links,
  COUNT(DISTINCT ip_address) as unique_visitors,
  AVG(CASE WHEN link_value IS NOT NULL THEN link_value ELSE 0 END) as avg_value
FROM link_clicks
WHERE timestamp >= NOW() - INTERVAL '30 days'
GROUP BY project_id, project_name, source_type;
```

### 2. Update Click Enrichment Function

**File**: Cloud Function that syncs clicks to Supabase (likely `writeClicksToSupabase` or similar)

```javascript
// Find and update the existing enrichment function
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { createClient } = require('@supabase/supabase-js');

// Supabase client setup (existing)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// MODIFY: Update the click processing function
exports.processClickToSupabase = functions.firestore
  .document('clicks/{clickId}')
  .onCreate(async (snap, context) => {
    const clickData = snap.data();
    
    try {
      // Prepare data for Supabase (existing fields)
      const enrichedClick = {
        // ... existing fields ...
        device_type: clickData.deviceType,
        city_name: clickData.geoipData?.cityName,
        country_name: clickData.geoipData?.countryName,
        short_id: clickData.shortId,
        short_link: clickData.shortLink,
        timestamp: clickData.timestamp.toDate(),
        
        // NEW: Add QR-specific fields
        source_type: clickData.sourceType || 'link',  // Default to 'link' for backward compatibility
        qr_identifier: clickData.qrIdentifier || null,
        qr_code_id: clickData.qrCodeId || null,
        
        // ... rest of existing fields ...
      };
      
      // Insert into Supabase
      const { error } = await supabase
        .from('link_clicks')
        .insert([enrichedClick]);
      
      if (error) {
        console.error('Error inserting to Supabase:', error);
      }
      
    } catch (error) {
      console.error('Error processing click:', error);
    }
  });
```

### 3. Create Analytics Dashboard Components

**File**: Create analytics components in Next.js app

```typescript
// /components/analytics/QRSourceBreakdown.tsx
"use client";

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface SourceData {
  source_type: string;
  total_clicks: number;
  percentage: number;
}

export function QRSourceBreakdown({ projectId }: { projectId: string }) {
  const [data, setData] = useState<SourceData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    try {
      const { data: sourceData, error } = await supabase
        .from('source_type_summary')
        .select('source_type, total_clicks')
        .eq('project_id', projectId);

      if (error) throw error;

      // Calculate percentages
      const total = sourceData.reduce((sum, item) => sum + item.total_clicks, 0);
      const withPercentages = sourceData.map(item => ({
        ...item,
        percentage: (item.total_clicks / total) * 100
      }));

      setData(withPercentages);
    } catch (error) {
      console.error('Error loading source data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading analytics...</div>;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Traffic Sources</h3>
      
      <div className="space-y-3">
        {data.map(item => (
          <div key={item.source_type}>
            <div className="flex justify-between mb-1">
              <span className="text-sm font-medium">
                {item.source_type === 'qr' ? 'QR Codes' : 'Direct Links'}
              </span>
              <span className="text-sm text-gray-600">
                {item.total_clicks.toLocaleString()} ({item.percentage.toFixed(1)}%)
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full ${
                  item.source_type === 'qr' ? 'bg-blue-600' : 'bg-green-600'
                }`}
                style={{ width: `${item.percentage}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

```typescript
// /components/analytics/QRIdentifierBreakdown.tsx
"use client";

interface QRData {
  qr_identifier: string;
  click_count: number;
}

export function QRIdentifierBreakdown({ linkId }: { linkId: string }) {
  const [data, setData] = useState<QRData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [linkId]);

  const loadData = async () => {
    try {
      const { data: qrData, error } = await supabase
        .from('link_clicks')
        .select('qr_identifier')
        .eq('short_id', linkId)
        .eq('source_type', 'qr')
        .not('qr_identifier', 'is', null);

      if (error) throw error;

      // Group by identifier
      const grouped = qrData.reduce((acc, item) => {
        acc[item.qr_identifier] = (acc[item.qr_identifier] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const formatted = Object.entries(grouped)
        .map(([identifier, count]) => ({
          qr_identifier: identifier,
          click_count: count
        }))
        .sort((a, b) => b.click_count - a.click_count);

      setData(formatted);
    } catch (error) {
      console.error('Error loading QR data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading QR analytics...</div>;
  if (data.length === 0) return null;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">QR Code Performance</h3>
      
      <div className="space-y-2">
        {data.map(item => (
          <div key={item.qr_identifier} className="flex justify-between py-2 border-b">
            <span className="font-medium">{item.qr_identifier}</span>
            <span className="text-gray-600">{item.click_count} clicks</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 4. Update CSV Export Function

**File**: Modify existing export functionality

```typescript
// Update the clicks export to include source information
export async function exportClicksWithSource(projectId: string) {
  const { data, error } = await supabase
    .from('link_clicks')
    .select(`
      timestamp,
      short_id,
      short_link,
      source_type,
      qr_identifier,
      device_type,
      country_name,
      city_name,
      link_value
    `)
    .eq('project_id', projectId)
    .order('timestamp', { ascending: false })
    .csv();

  if (error) throw error;

  // Download CSV
  const blob = new Blob([data], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `clicks-with-source-${projectId}.csv`;
  a.click();
}
```

### 5. Metabase Dashboard Updates

In Metabase, create new visualizations:

```sql
-- Query 1: QR vs Link Traffic Over Time
SELECT 
  DATE(timestamp) as date,
  source_type,
  COUNT(*) as clicks
FROM link_clicks
WHERE project_id = {{project_id}}
  AND timestamp >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(timestamp), source_type
ORDER BY date DESC;

-- Query 2: Top Performing QR Identifiers
SELECT 
  qr_identifier,
  COUNT(*) as total_clicks,
  COUNT(DISTINCT ip_address) as unique_visitors,
  AVG(link_value) as avg_value
FROM link_clicks
WHERE project_id = {{project_id}}
  AND source_type = 'qr'
  AND qr_identifier IS NOT NULL
GROUP BY qr_identifier
ORDER BY total_clicks DESC
LIMIT 10;

-- Query 3: Source Type Conversion Metrics
SELECT 
  source_type,
  COUNT(*) as total_clicks,
  COUNT(DISTINCT CASE WHEN link_value > 0 THEN ip_address END) as conversions,
  ROUND(
    100.0 * COUNT(DISTINCT CASE WHEN link_value > 0 THEN ip_address END) / 
    NULLIF(COUNT(DISTINCT ip_address), 0), 
    2
  ) as conversion_rate
FROM link_clicks
WHERE project_id = {{project_id}}
  AND timestamp >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY source_type;
```

## Migration of Historical Data

```sql
-- Update existing clicks to have source_type = 'link'
UPDATE link_clicks 
SET source_type = 'link' 
WHERE source_type IS NULL;

-- If you can identify historical QR clicks by pattern, update them
-- This is optional and depends on your data
UPDATE link_clicks 
SET source_type = 'qr',
    qr_identifier = 'default'
WHERE referrer LIKE '%qr%' 
   OR user_agent LIKE '%QR%'
   AND source_type = 'link';
```

## Testing

```javascript
// Test the analytics data flow
async function testAnalyticsPipeline() {
  // 1. Create a test click with QR metadata
  const testClick = {
    shortId: 'test123',
    sourceType: 'qr',
    qrIdentifier: 'test-billboard',
    // ... other required fields
  };
  
  // 2. Write to Firestore
  await db.collection('clicks').add(testClick);
  
  // 3. Wait for processing (usually 1-2 seconds)
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // 4. Query Supabase to verify
  const { data } = await supabase
    .from('link_clicks')
    .select('*')
    .eq('short_id', 'test123')
    .single();
  
  console.assert(data.source_type === 'qr', 'Source type should be qr');
  console.assert(data.qr_identifier === 'test-billboard', 'QR identifier should match');
}
```

## Important Notes

### Keep It Simple
- Use existing enrichment patterns
- Don't create complex aggregations
- Focus on basic QR vs Link differentiation
- Minimal changes to existing pipeline

### Performance
- Add indexes for new fields
- Use views for complex queries
- Keep real-time queries simple
- Cache analytics data where possible

### Backward Compatibility
- Default source_type to 'link' for existing data
- Don't break existing dashboards
- Keep all existing fields and logic

## Timeline
- Supabase schema: 0.5 days
- Cloud function updates: 0.5 days
- Analytics components: 1 day
- Metabase dashboards: 0.5 days
- Testing: 0.5 days

## Dependencies
- URL shortener must be recording new fields
- Database migration should be complete
- Frontend should be sending QR traffic

## Verification Checklist
- [ ] Supabase schema updated with new columns
- [ ] Indexes created for performance
- [ ] Cloud function enriches clicks with QR data
- [ ] Analytics views created
- [ ] QR vs Link breakdown visible
- [ ] Individual QR identifier metrics work
- [ ] CSV export includes source data
- [ ] Metabase dashboards updated
- [ ] Historical data migrated (optional)
- [ ] No disruption to existing analytics