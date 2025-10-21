# Export Out-of-Stock Analytics

Firebase HTTP Cloud Function that queries `incarts.analytics.out_of_stock_analytics` in
BigQuery and returns a multi-tab Excel workbook with:

- Summary KPIs (total out-of-stock events, states and ZIPs affected)
- Daily out-of-stock counts
- State/city level breakdown
- Top substitution combinations

It shares the same filters as the Metabase dashboard: `start_date`, `end_date`,
`project_id`, with optional `link_name` and `slug` parameters.

## Deploy

```bash
cd export-oos-analytics
firebase deploy --only functions:export_out_of_stock_analytics
```

## Sample request

```bash
curl \
  -G "https://us-central1-incarts.cloudfunctions.net/export_out_of_stock_analytics" \
  --data-urlencode "start_date=2025-05-01" \
  --data-urlencode "end_date=2025-05-31" \
  --data-urlencode "project_id=yQvznaqpumVY96orR8uJ" \
  --data-urlencode "link_name=Poppi Grape ATC WM" \
  --data-urlencode "slug=c60F1Yf7c" \
  -o out_of_stock.xlsx
```

Replace `<REGION>` with your function’s region (e.g. `us-central1`) and `<PROJECT_ID>`
with your Firebase project ID. `out_of_stock.xlsx` will contain the exported workbook.
