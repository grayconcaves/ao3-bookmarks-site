import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

const TABLE = process.env.DB_TABLE || "articles";
const TITLE_COL = process.env.DB_TITLE_COLUMN || "title";
const AUTHOR_COL = process.env.DB_AUTHOR_COLUMN || "author";
const WORK_ID_COL = process.env.DB_WORK_ID_COLUMN || "work_id";
const PUBLISH_COL = process.env.DB_PUBLISH_DATE_COLUMN || "publish_date";
const UPDATE_COL = process.env.DB_UPDATE_DATE_COLUMN || "update_date";
const RELATIONSHIP_TAGS_COL =
  process.env.DB_RELATIONSHIP_TAGS_COLUMN || "relationship_tags";
const ADDITIONAL_TAGS_COL =
  process.env.DB_ADDITIONAL_TAGS_COLUMN || "additional_tags";
// Columns to fetch (for buttons/links) but never show as plain data columns.
const HIDDEN_COLUMNS = (
  process.env.DB_HIDDEN_COLUMNS ||
  "id,work_id,relationship_tags,additional_tags,summary"
)
  .split(",")
  .map((c) => c.trim().toLowerCase())
  .filter(Boolean);

// Columns that should render as colored link buttons instead of raw text.
const AO3_LINK_COL = process.env.DB_AO3_LINK_COLUMN || "ao3_link";
const EPUB_LINK_COL = process.env.DB_EPUB_LINK_COLUMN || "epub_link";
const PDF_LINK_COL = process.env.DB_PDF_LINK_COLUMN || "pdf_link";

const DEFAULT_PAGE_SIZE = 50;

function quoteIdent(name: string) {
  return `"${name.replace(/"/g, '""')}"`;
}

// Case-insensitive lookup of a configured column name against the real,
// as-cased columns returned by information_schema.
function resolveColumn(validColumns: string[], name: string): string | null {
  const match = validColumns.find(
    (c) => c.toLowerCase() === name.toLowerCase()
  );
  return match ?? null;
}

// Splits a raw tag cell value into individual tags, regardless of whether
// the column is a real Postgres array (comes back as a JS array already),
// a JSON-encoded string, a Postgres array literal string, or a plain
// comma-separated string.
function parseTagValue(value: unknown): string[] {
  if (value === null || value === undefined) return [];

  let items: unknown[];
  if (Array.isArray(value)) {
    items = value;
  } else if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
      try {
        const parsed = JSON.parse(trimmed);
        items = Array.isArray(parsed) ? parsed : [trimmed];
      } catch {
        items = trimmed.replace(/^\{|\}$/g, "").split(/","|",|,"|,/);
      }
    } else {
      items = trimmed.split(",");
    }
  } else {
    items = [value];
  }

  return items
    .map((item) => String(item).replace(/^"|"$/g, "").trim())
    .filter(Boolean);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim() || "";
  const author = searchParams.get("author")?.trim() || "";
  const workId = searchParams.get("workId")?.trim() || "";
  const relationshipTags = searchParams
    .getAll("relationshipTags")
    .map((t) => t.trim())
    .filter(Boolean);
  const additionalTags = searchParams
    .getAll("additionalTags")
    .map((t) => t.trim())
    .filter(Boolean);
  const sortByParam = searchParams.get("sortBy");
  const sortDir =
    (searchParams.get("sortDir") || "desc").toLowerCase() === "asc"
      ? "ASC"
      : "DESC";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const pageSize = Math.max(
    1,
    parseInt(searchParams.get("pageSize") || String(DEFAULT_PAGE_SIZE), 10) ||
      DEFAULT_PAGE_SIZE
  );
  const offset = (page - 1) * pageSize;

  const client = await pool.connect();
  try {
    const tableCheck = await client.query(
      `SELECT 1 FROM information_schema.tables WHERE table_name = $1 LIMIT 1`,
      [TABLE]
    );
    if (tableCheck.rowCount === 0) {
      return NextResponse.json(
        { error: `Table "${TABLE}" not found. Set DB_TABLE in your env vars.` },
        { status: 400 }
      );
    }

    const colRes = await client.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
      [TABLE]
    );
    const validColumns: string[] = colRes.rows.map((r) => r.column_name);

    // Columns actually shown in the table (hidden ones excluded).
    const displayColumns = validColumns.filter(
      (c) => !HIDDEN_COLUMNS.includes(c.toLowerCase())
    );

    const linkColumns = {
      ao3: resolveColumn(validColumns, AO3_LINK_COL),
      epub: resolveColumn(validColumns, EPUB_LINK_COL),
      pdf: resolveColumn(validColumns, PDF_LINK_COL),
    };

    let orderColumn: string | null = null;
    if (sortByParam && validColumns.includes(sortByParam)) {
      orderColumn = sortByParam;
    } else if (validColumns.includes(UPDATE_COL)) {
      orderColumn = UPDATE_COL;
    } else if (validColumns.includes(PUBLISH_COL)) {
      orderColumn = PUBLISH_COL;
    } else {
      orderColumn = validColumns[0] ?? null;
    }

    const conditions: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    if (search && validColumns.includes(TITLE_COL)) {
      conditions.push(`${quoteIdent(TITLE_COL)} ILIKE $${i}`);
      values.push(`%${search}%`);
      i++;
    }
    if (author && validColumns.includes(AUTHOR_COL)) {
      conditions.push(`${quoteIdent(AUTHOR_COL)} = $${i}`);
      values.push(author);
      i++;
    }
    const workIdCol = resolveColumn(validColumns, WORK_ID_COL);
    if (workId && workIdCol) {
      conditions.push(`${quoteIdent(workIdCol)}::text = $${i}`);
      values.push(workId);
      i++;
    }

    const relTagsCol = resolveColumn(validColumns, RELATIONSHIP_TAGS_COL);
    const addlTagsCol = resolveColumn(validColumns, ADDITIONAL_TAGS_COL);

    // Figure out whether the tag columns are real Postgres arrays or plain
    // text/JSON, so we can filter with the right operator either way.
    const tagColNames = [relTagsCol, addlTagsCol].filter(Boolean) as string[];
    let tagColTypes: Record<string, string> = {};
    if (tagColNames.length) {
      const typeRes = await client.query(
        `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1 AND column_name = ANY($2)`,
        [TABLE, tagColNames]
      );
      tagColTypes = Object.fromEntries(
        typeRes.rows.map((r) => [r.column_name, r.data_type])
      );
    }

    const addTagFilter = (col: string | null, selected: string[]) => {
      if (!col || selected.length === 0) return;
      if (tagColTypes[col] === "ARRAY") {
        // Overlap: row matches if it contains ANY of the selected tags.
        conditions.push(`${quoteIdent(col)} && $${i}::text[]`);
        values.push(selected);
        i++;
      } else {
        // Plain text/JSON column: OR together a substring match per tag.
        const ors = selected.map(() => {
          const clause = `${quoteIdent(col)} ILIKE $${i}`;
          i++;
          return clause;
        });
        conditions.push(`(${ors.join(" OR ")})`);
        selected.forEach((t) => values.push(`%${t}%`));
      }
    };

    addTagFilter(relTagsCol, relationshipTags);
    addTagFilter(addlTagsCol, additionalTags);

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";
    const orderClause = orderColumn
      ? `ORDER BY ${quoteIdent(orderColumn)} ${sortDir} NULLS LAST`
      : "";

    // Total count for pagination (same filters, no limit/offset).
    const countQuery = `SELECT COUNT(*) AS total FROM ${quoteIdent(TABLE)} ${whereClause}`;
    const countRes = await client.query(countQuery, values);
    const total = parseInt(countRes.rows[0].total, 10);

    const limitIdx = i;
    const offsetIdx = i + 1;
    const query = `SELECT * FROM ${quoteIdent(TABLE)} ${whereClause} ${orderClause} LIMIT $${limitIdx} OFFSET $${offsetIdx}`;
    const result = await client.query(query, [...values, pageSize, offset]);

    let authors: string[] = [];
    if (validColumns.includes(AUTHOR_COL)) {
      const authorsRes = await client.query(
        `SELECT DISTINCT ${quoteIdent(AUTHOR_COL)} AS a FROM ${quoteIdent(
          TABLE
        )} WHERE ${quoteIdent(AUTHOR_COL)} IS NOT NULL ORDER BY 1`
      );
      authors = authorsRes.rows.map((r) => r.a);
    }

    // Pull every raw tag cell value once, then split into individual tags in
    // JS so this works whether the column is a real array, JSON text, or a
    // comma-separated string.
    const loadTagOptions = async (col: string | null): Promise<string[]> => {
      if (!col) return [];
      const res = await client.query(
        `SELECT DISTINCT ${quoteIdent(col)} AS v FROM ${quoteIdent(
          TABLE
        )} WHERE ${quoteIdent(col)} IS NOT NULL`
      );
      const set = new Set<string>();
      for (const row of res.rows) {
        for (const tag of parseTagValue(row.v)) set.add(tag);
      }
      return Array.from(set).sort((a, b) => a.localeCompare(b));
    };

    const additionalTagOptions = addlTagsCol
      ? await loadTagOptions(addlTagsCol)
      : [];

    const relationshipTagOptions = relTagsCol
      ? await loadTagOptions(relTagsCol)
      : [];

    return NextResponse.json({
      rows: result.rows,
      columns: displayColumns,
      linkColumns,
      authors,
      tagOptions: {
        additional: additionalTagOptions,
        relationship: relationshipTagOptions,
      },
      sortBy: orderColumn,
      sortDir: sortDir.toLowerCase(),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: err.message || "Query failed" },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
