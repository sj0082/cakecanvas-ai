# Scripts Directory

This folder contains utility scripts for managing the CakeCanvas AI project.

## Admin Scripts

### `promote_admin.cjs`
Promotes a user to admin role in the database.

**Usage:**
```bash
node scripts/promote_admin.cjs <email>
```

## Database Utilities

### `check_duplicates.cjs`
Checks for duplicate entries in the database.

**Usage:**
```bash
node scripts/check_duplicates.cjs
```

### `analyze_duplicates.cjs`
Analyzes duplicate data patterns in the database.

**Usage:**
```bash
node scripts/analyze_duplicates.cjs
```

### `dry_run_fix.cjs`
Dry run for fixing database issues without making actual changes.

**Usage:**
```bash
node scripts/dry_run_fix.cjs
```

### `fix_duplicates.cjs`
Fixes duplicate entries in the database (use after dry run).

**Usage:**
```bash
node scripts/fix_duplicates.cjs
```

## Debug & Testing

### `debug_stylepacks.cjs`
Debug utility for stylepack data.

**Usage:**
```bash
node scripts/debug_stylepacks.cjs
```

### `reproduce_error.cjs`
Script to reproduce the "Generate AI Design" error for debugging.

**Usage:**
```bash
node scripts/reproduce_error.cjs
```

## Requirements

All scripts require:
- Node.js
- `@supabase/supabase-js` package
- Valid `.env` file with Supabase credentials

## Notes

- Always run `dry_run_fix.cjs` before `fix_duplicates.cjs`
- Admin scripts require service role key
- Keep these scripts out of the production build
