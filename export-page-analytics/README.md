# Export Page Analytics Cloud Function

Cloud Function to export page analytics to Excel spreadsheet with support for filtering by date, project_id, page_slug, source, and medium.

## Setup with uv

This project uses [uv](https://github.com/astral-sh/uv) for fast, reliable Python dependency management.

### Prerequisites

Install uv if you haven't already:

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

Or on macOS/Linux:

```bash
brew install uv
```

### Installation

#### Option 1: Install from pyproject.toml (recommended for development)

```bash
# Create virtual environment
uv venv

# Activate it
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies from pyproject.toml
uv pip install .
```

#### Option 2: Install from requirements.txt (equivalent to pip install -r)

```bash
# Create virtual environment
uv venv
source .venv/bin/activate

# Install from requirements.txt (uv equivalent of pip install -r)
uv pip install -r functions/requirements.txt
```

**Note:** After installing, sync requirements.txt for Firebase deployment:

```bash
./sync-requirements.sh
```

This generates `functions/requirements.txt` from `pyproject.toml` for Firebase deployment.

### Adding Dependencies

To add a new dependency:

```bash
# Add to project dependencies
uv add package-name

# Then sync requirements.txt for Firebase
./sync-requirements.sh
```

To add a development dependency:

```bash
uv add --dev package-name
```

### Managing Dependencies

```bash
# Install from requirements.txt (uv equivalent of: pip install -r requirements.txt)
uv pip install -r functions/requirements.txt

# Install from pyproject.toml
uv pip install .

# Update all dependencies
uv pip compile pyproject.toml --upgrade -o functions/requirements.txt

# Always sync requirements.txt after changes
./sync-requirements.sh
```

### pip to uv Command Reference

| pip command | uv equivalent |
|-------------|---------------|
| `pip install -r requirements.txt` | `uv pip install -r requirements.txt` |
| `pip install package` | `uv pip install package` |
| `pip install .` | `uv pip install .` |
| `pip freeze > requirements.txt` | `uv pip compile pyproject.toml -o requirements.txt` |
| `pip list` | `uv pip list` |
| `pip uninstall package` | `uv pip uninstall package` |

## Development

### Local Testing

```bash
# Activate virtual environment
source .venv/bin/activate

# Run with functions-framework
functions-framework --target=export_page_analytics --debug
```

### Deploy to Firebase

```bash
# Make sure requirements.txt is synced
./sync-requirements.sh

# Deploy
firebase deploy --only functions
```

## API Usage

### Query Parameters

- `start_date` (required): Start date in YYYY-MM-DD format
- `end_date` (required): End date in YYYY-MM-DD format
- `project_id` (optional): Filter by project ID
- `page_slug` (optional): Filter by page slug
- `source` (optional): Filter by traffic source
- `medium` (optional): Filter by traffic medium

### Example Request

```bash
curl "https://your-function-url/export_page_analytics?start_date=2025-01-01&end_date=2025-12-31&project_id=my-project"
```

## Excel Output

The function generates an Excel file with the following sheets:

1. **Summary** - Overall metrics and KPIs
2. **Daily Breakdown** - Day-by-day performance
3. **Page Performance** - Individual page metrics
4. **Traffic Sources** - Source and medium breakdown
5. **Geographic Distribution** - Top 100 locations
6. **Device Breakdown** - Device category analytics
7. **Click Details** - Click-through data (if available)

## Why uv?

- **10-100x faster** than pip for dependency resolution
- **Reliable** - Uses a Rust-based resolver for consistent installs
- **Compatible** - Works with existing pip/PyPI ecosystem
- **Modern** - Uses `pyproject.toml` (PEP 621) instead of legacy `setup.py`
- **Disk efficient** - Global cache reduces redundant downloads

## Migration Notes

- **pyproject.toml** - Source of truth for dependencies (edit this file)
- **requirements.txt** - Auto-generated for Firebase (don't edit manually)
- **sync-requirements.sh** - Run after any dependency changes
