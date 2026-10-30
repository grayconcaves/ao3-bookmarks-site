"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Row = Record<string, unknown>;
type LinkColumns = { ao3: string | null; epub: string | null; pdf: string | null };

export default function Page() {
  const [rows, setRows] = useState<Row[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [linkColumns, setLinkColumns] = useState<LinkColumns>({
    ao3: null,
    epub: null,
    pdf: null,
  });
  const [authors, setAuthors] = useState<string[]>([]);
  const [additionalTagOptions, setAdditionalTagOptions] = useState<string[]>(
    []
  );
  const [relationshipTagOptions, setRelationshipTagOptions] = useState<
    string[]
  >([]);
  const [search, setSearch] = useState("");
  const [author, setAuthor] = useState("");
  const [workId, setWorkId] = useState("");
  const [additionalTags, setAdditionalTags] = useState<string[]>([]);
  const [relationshipTags, setRelationshipTags] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<Row | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (author) params.set("author", author);
    if (workId) params.set("workId", workId);
    additionalTags.forEach((t) => params.append("additionalTags", t));
    relationshipTags.forEach((t) => params.append("relationshipTags", t));
    if (sortBy) params.set("sortBy", sortBy);
    params.set("sortDir", sortDir);
    params.set("page", String(page));
    params.set("pageSize", "50");

    try {
      const res = await fetch(`/api/records?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load data");
        setLoading(false);
        return;
      }
      setRows(data.rows);
      setColumns(data.columns);
      setLinkColumns(data.linkColumns);
      setAuthors(data.authors);
      setAdditionalTagOptions(data.tagOptions?.additional || []);
      setRelationshipTagOptions(data.tagOptions?.relationship || []);
      setTotalPages(data.totalPages);
      setTotal(data.total);
      if (!sortBy && data.sortBy) setSortBy(data.sortBy);
    } catch (e: any) {
      setError(e.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    search,
    author,
    workId,
    additionalTags,
    relationshipTags,
    sortBy,
    sortDir,
    page,
  ]);

  useEffect(() => {
    const t = setTimeout(fetchData, 300); // debounce search typing
    return () => clearTimeout(t);
  }, [fetchData]);

  // Reset to page 1 whenever search/filter/sort changes.
  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, author, workId, additionalTags, relationshipTags, sortBy, sortDir]);

  const columnClass = (col: string) =>
    col.toLowerCase() === "summary" ? "col-summary" : undefined;

  const handleSort = (col: string) => {
    if (sortBy === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortDir("asc");
    }
  };

  const getRowValue = (row: Row, column: string) => {
    const key = Object.keys(row).find(
      (candidate) => candidate.toLowerCase() === column.toLowerCase()
    );
    return key ? row[key] : undefined;
  };

  const handleRowClick = (row: Row) => {
    setSelectedRow(row);
  };

  const closeModal = () => setSelectedRow(null);

  useEffect(() => {
    if (!selectedRow && !showHelp) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeModal();
        setShowHelp(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedRow, showHelp]);

  return (
    <main className="container">
      <div className="title-row">
        <h1>Gai&apos;s AO3 Bookmarks</h1>
        <button
          type="button"
          className="help-icon"
          onClick={() => setShowHelp(true)}
          aria-label="How to use this site"
        >
          ?
        </button>
      </div>
      <h3>A personal archive of bookmarked Ao3 fics</h3>

      <div className="controls">
        <input
          type="text"
          placeholder="Search titles..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <input
          type="text"
          className="work-id"
          placeholder="Work ID..."
          value={workId}
          onChange={(e) => setWorkId(e.target.value)}
        />
        {authors.length > 0 && (
          <select value={author} onChange={(e) => setAuthor(e.target.value)}>
            <option value="">All authors</option>
            {authors.map((a) => (
              <option key={String(a)} value={String(a)}>
                {String(a)}
              </option>
            ))}
          </select>
        )}
        {relationshipTagOptions.length > 0 && (
          <MultiSelectDropdown
            label="Relationships"
            options={relationshipTagOptions}
            selected={relationshipTags}
            onChange={setRelationshipTags}
          />
        )}
        {additionalTagOptions.length > 0 && (
          <MultiSelectDropdown
            label="Additional Tags"
            options={additionalTagOptions}
            selected={additionalTags}
            onChange={setAdditionalTags}
          />
        )}
      </div>

      {error && <div className="error">{error}</div>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col}
                  className={columnClass(col)}
                  onClick={() => handleSort(col)}
                >
                  {col}
                  {sortBy === col ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                onClick={() => handleRowClick(row)}
                className={selectedRow === row ? "selected" : ""}
              >
                {columns.map((col) => (
                  <td key={col} className={columnClass(col)} data-label={col}>
                    {renderCell(col, row[col], linkColumns)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && rows.length === 0 && !error && (
          <div className="empty">No results.</div>
        )}
        {loading && <div className="empty">Loading...</div>}
      </div>

      {selectedRow && (
        <div className="modal-overlay" onClick={closeModal}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close"
              onClick={closeModal}
              aria-label="Close"
            >
              ×
            </button>
            <h2 className="modal-title">
              {formatCell(getRowValue(selectedRow, "title")) || "Details"}
              {formatCell(getRowValue(selectedRow, "status")) && (
                <span className="modal-status">
                  {formatCell(getRowValue(selectedRow, "status"))}
                </span>
              )}
            </h2>
            {formatCell(getRowValue(selectedRow, "author")) && (
              <p className="modal-author">
                by {formatCell(getRowValue(selectedRow, "author"))}
              </p>
            )}
            <div className="modal-links">
              {linkColumns.ao3 &&
                modalLinkButton(
                  getRowValue(selectedRow, linkColumns.ao3),
                  "Ao3 ↗",
                  "btn-blue"
                )}
              {linkColumns.epub &&
                modalLinkButton(
                  getRowValue(selectedRow, linkColumns.epub),
                  "EPUB",
                  "btn-orange"
                )}
              {linkColumns.pdf &&
                modalLinkButton(
                  getRowValue(selectedRow, linkColumns.pdf),
                  "PDF",
                  "btn-green"
                )}
            </div>
            <div className="detail-grid">
              {[
                { key: "summary", label: "Summary", pills: false },
                { key: "relationship_tags", label: "Relationship Tags", pills: true },
                { key: "additional_tags", label: "Additional Tags", pills: true },
              ].map(({ key, label, pills }) => {
                const value = getRowValue(selectedRow, key);
                if (pills) {
                  const tags = parseTags(value);
                  if (tags.length === 0) return null;
                  return (
                    <div key={key} className="detail-card">
                      <h3>{label}</h3>
                      <div className="pill-list">
                        {tags.map((tag, idx) => (
                          <span key={idx} className="pill">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                }
                const text = formatCell(value);
                if (!text) return null;
                return (
                  <div key={key} className="detail-card">
                    <h3>{label}</h3>
                    <p>{text}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {showHelp && (
        <div className="modal-overlay" onClick={() => setShowHelp(false)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close"
              onClick={() => setShowHelp(false)}
              aria-label="Close"
            >
              ×
            </button>
            <h2 className="modal-title">How to use this site</h2>
            <div className="help-text">
              <p>
                This is an archive of fics I have bookmarked on Ao3. The EPUB
                and PDF files are saved directly from Ao3 into my Google Drive
                and are available for everyone to download.
              </p>
              <p>
                Use the &quot;Search titles...&quot; box to search for a
                specific work&apos;s title, or you can use the &quot;Work
                ID...&quot; search if you have it.
              </p>
              <p>
                You can also filter by author, by any number of relationships
                (pick them from the &quot;Relationships&quot; list), or by any
                number of additional tags (though you&apos;ll need to write
                down the tag to look for it).
              </p>
              <p>Have fun!</p>
            </div>
          </div>
        </div>
      )}

      {!loading && total > 0 && (
        <div className="pagination">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </button>
          <span>
            Page {page} of {totalPages} ({total} results)
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </button>
        </div>
      )}
    </main>
  );
}

function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const toggleOption = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter((o) => o !== option));
    } else {
      onChange([...selected, option]);
    }
  };

  const filteredOptions = query
    ? options.filter((o) => o.toLowerCase().includes(query.toLowerCase()))
    : options;

  const buttonLabel =
    selected.length === 0
      ? label
      : `${label} (${selected.length})`;

  return (
    <div className="multi-select" ref={ref}>
      <button
        type="button"
        className={`multi-select-trigger ${selected.length > 0 ? "active" : ""}`}
        onClick={() => setOpen((o) => !o)}
      >
        {buttonLabel}
        <span className="multi-select-caret">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="multi-select-panel">
          {options.length > 8 && (
            <input
              type="text"
              className="multi-select-search"
              placeholder={`Filter ${label.toLowerCase()}...`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          )}
          <div className="multi-select-options">
            {filteredOptions.length === 0 && (
              <div className="multi-select-empty">No matches.</div>
            )}
            {filteredOptions.map((option) => (
              <div
                key={option}
                className={`multi-select-option ${
                  selected.includes(option) ? "selected" : ""
                }`}
                onClick={() => toggleOption(option)}
              >
                {option}
              </div>
            ))}
          </div>
          {selected.length > 0 && (
            <button
              type="button"
              className="multi-select-clear"
              onClick={() => onChange([])}
            >
              Clear ({selected.length})
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function renderCell(
  col: string,
  value: unknown,
  linkColumns: LinkColumns
): React.ReactNode {
  if (col === linkColumns.ao3) return linkButton(value, "Read on AO3", "btn-blue");
  if (col === linkColumns.epub) return linkButton(value, "Download EPUB", "btn-orange");
  if (col === linkColumns.pdf) return linkButton(value, "Download PDF", "btn-green");
  return formatCell(value);
}

function modalLinkButton(value: unknown, label: string, className: string) {
  if (!value) return null;
  const href = String(value);
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`btn btn-small ${className}`}
    >
      {label}
    </a>
  );
}

function linkButton(value: unknown, label: string, className: string) {
  if (!value) return "";
  const href = String(value);
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`btn ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {label}
    </a>
  );
}

function parseTags(value: unknown): string[] {
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
        // Postgres text[] comes back like {tag one,"tag, two",tag3}
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

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toLocaleString();
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d.toLocaleString();
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
