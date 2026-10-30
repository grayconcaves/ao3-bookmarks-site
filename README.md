# AO3 Bookmarks Site

A Next.js app that shows every column from a Postgres table with:
- Search by title
- Filter by author (dropdown)
- Click-to-sort on any column header, defaulting to `update_date` (falls back to `publish_date` if that column doesn't exist)

## 0. Rotate your database password first

If you shared your connection string anywhere outside a private, trusted place, rotate it now:
Supabase Dashboard → your project → **Settings → Database → Reset database password**.

## 1. Get the pooled connection string

In Supabase: **Settings → Database → Connection string → Connection pooling**.
Use the one on **port 6543** (PgBouncer), not port 5432. Direct connections don't play well with Vercel's serverless functions because each function invocation can open its own connection and you'll quickly hit Postgres's connection limit.

## 2. Configure environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local`:
- `DATABASE_URL` — your pooled (6543) connection string with the new password
- `DB_TABLE` — the table you want to display (e.g. `gais bookmarks`)
- `DB_TITLE_COLUMN`, `DB_AUTHOR_COLUMN`, `DB_PUBLISH_DATE_COLUMN`, `DB_UPDATE_DATE_COLUMN` — set these to match your actual column names. If a column doesn't exist in your table, leave the default — the app just won't use that feature (e.g. no author filter if there's no author column).

## 3. Run locally

```bash
npm install
npm run dev
```

Visit http://localhost:3000.

## 4. Deploy to Vercel

**Option A — CLI**
```bash
npm install -g vercel
vercel
```
Follow the prompts to link/create a project.

**Option B — GitHub**
1. Push this folder to a GitHub repo.
2. Go to https://vercel.com/new and import the repo.

Either way, before the first deploy finishes successfully, add your environment variables in the Vercel dashboard:
**Project → Settings → Environment Variables**, add the same keys from `.env.local` (`DATABASE_URL`, `DB_TABLE`, etc.) for the Production (and Preview) environments, then redeploy.

## 5. Allow Vercel to reach Supabase

Supabase's pooler (port 6543) accepts connections from anywhere by default, so this usually works out of the box. If you've restricted access via Supabase network restrictions, you'll need to allow Vercel's outbound IPs or disable the restriction for the pooler.

## How sorting/search/filter/pagination work

- All columns are auto-detected via `information_schema.columns`, so any table works without hardcoding fields — this satisfies "show all the columns."
- Clicking a header toggles ascending/descending; the API whitelists sortable columns against real table columns to prevent SQL injection.
- Search does a case-insensitive `ILIKE` match against the title column.
- The author dropdown is populated from `SELECT DISTINCT` on the author column.
- Results are paginated at 50 rows per page (`LIMIT`/`OFFSET` server-side); Previous/Next controls sit below the table and the page resets to 1 whenever you search, filter, or sort.

## Hidden columns

Set `DB_HIDDEN_COLUMNS` (comma-separated, case-insensitive) to columns you want fetched but never shown as a plain data column. Defaults to `id,work_id`. The data is still selected — this only affects which headers/cells render — so link-button columns can still reference them if needed.

## Link-button columns

`DB_AO3_LINK_COLUMN`, `DB_EPUB_LINK_COLUMN`, and `DB_PDF_LINK_COLUMN` (defaults: `ao3_link`, `epub_link`, `pdf_link`) render as buttons instead of raw URLs:
- AO3 link → blue button, opens in a new tab
- Epub link → orange button
- PDF link → green button

If a row has no value in that column, the cell is left blank instead of showing an empty button. Colors are set in `app/globals.css` (`.btn-blue`, `.btn-orange`, `.btn-green`) if you want to adjust them.
