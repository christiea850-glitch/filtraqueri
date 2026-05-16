# Large Dataset Scalability Architecture Audit

## Scope

This audit evaluates how FiltraQueri can support very large CSV files and multi-sheet Excel workbooks while preserving the current Human Mode workflow. It is a planning/specification document only. No upload, session, runtime, query, workbook, export, Monaco, `executeWorkspaceQuery`, `ActiveResultModel`, or `ResultsGrid` behavior is changed by this audit.

## Current Architecture Summary

### Upload And Storage

CSV uploads are accepted by `backend/app/main.py` at `/datasets/upload`. The backend writes the uploaded file to `backend/storage/uploads`, then creates a per-dataset DuckDB database in `backend/storage/sessions` using:

```sql
CREATE TABLE data AS SELECT * FROM read_csv_auto(?, HEADER=TRUE)
```

The frontend does not parse CSVs in the browser. `frontend/src/services/api.ts` sends the file as `FormData`, and `frontend/src/features/dataset/useWorkspaceDatasetController.ts` stores only the returned metadata and preview rows in React state.

Excel uploads go through `backend/app/workbook_ingestion.py`. XLSX files are read directly from the zip package with `xml.etree.ElementTree`; each worksheet is parsed into Python row arrays, normalized, inserted into DuckDB worksheet tables, and exposed through a `data` view for the active worksheet.

### Query And Result Flow

Preview, filtering, and Query Builder requests are backend-driven:

- preview: `GET /datasets/{dataset_id}/preview`
- filters: `POST /datasets/{dataset_id}/filter`
- Query Builder: `POST /datasets/{dataset_id}/query-builder`

`frontend/src/features/execution/executeWorkspaceQuery.ts` wraps backend responses into the current workspace execution result shape. `ActiveResultModel` in `frontend/src/features/results/activeResultModel.ts` keeps the current page rows, columns, filters, grouping state, sorting state, and export payload.

### Rendering

`frontend/src/components/results/ResultsGrid.tsx` renders a full HTML table for the active page. Pagination is present, with row-per-page options up to 800. There is no virtual row or virtual column rendering yet.

### Persistence

Backend workspace manifests store dataset metadata, schema, workbook metadata, filter metadata, query builder metadata, SQL workspace metadata, and active result identifiers. Frontend runtime persistence in `frontend/src/features/workspaceRuntime/runtimePersistence.ts` stores lightweight navigation/runtime state in `localStorage`.

## Current Bottlenecks

### CSV Ingestion

Strengths:

- CSV parsing is backend-side, not browser-side.
- DuckDB is already used as the local execution engine.
- The browser receives only preview rows on upload.

Risks:

- Upload handling uses `shutil.copyfileobj(file.file, destination)` synchronously inside the request lifecycle.
- `read_csv_auto` materializes the full table before the user can continue.
- `profile_dataset` performs `COUNT`, `COUNT(DISTINCT)`, `MIN`, `MAX`, and sample queries per column across the full table. For wide million-row CSVs, this can dominate upload time.
- Upload is synchronous. There is no job status, cancellation, or progressive preview.
- `MAX_QUERY_LIMIT` is 1000, which protects the browser but also creates an artificial ceiling for exports and analyst queries.

### Workbook Ingestion

Strengths:

- Workbook tables are staged into DuckDB.
- Active worksheet switching is server-side and preserves the single-table workflow.
- Relationship metadata is advisory and does not mutate execution behavior.

Risks:

- XLSX parsing uses `ET.fromstring(workbook_zip.read(sheet_path))`, loading each full sheet XML into memory.
- `parse_xlsx_workbook` returns all parsed sheet rows before ingestion, so memory grows with workbook size and sheet count.
- Shared strings are loaded completely.
- Workbook support is guarded by prototype limits: 25 MB file size, 30 worksheets, 250 columns, 50,000 rows per worksheet.
- `create_table_from_rows` inserts row arrays with `executemany`, which is not suitable for very large worksheets.
- `profile_table` performs per-column full-table scans and distinct counts.
- Relationship profiling samples distinct values for candidate columns and can multiply work across worksheet pairs.

### Browser And Frontend State

Strengths:

- The frontend does not hold the entire dataset.
- Results are page-limited.
- Recent dataset history is capped to five sessions.

Risks:

- `ResultState.rows`, `ActiveResultModel.rows`, and export payload rows are still in React state for each active result tab.
- Recent dataset sessions store `previewResult`, `filteredResult`, and `queriedResult`. With 800-row pages and wide columns, this can become heavy.
- `ResultsGrid` renders every visible cell in the page. At 800 rows x 250 columns, that is 200,000 table cells before headers and controls.
- Column display profiling and structural row classification run in the browser from current page rows and visible columns.
- Column menu rendering maps all columns. Very wide datasets need column virtualization or searchable lazy lists.

### Filtering, Grouping, Sorting

Strengths:

- Filtering, sorting, grouping, and query building are backend DuckDB queries.
- Query Builder uses `LIMIT` and `OFFSET`.

Risks:

- `COUNT(*)` on filtered and grouped results runs for each request.
- High-offset pagination can become expensive on large tables.
- Grouping on high-cardinality columns can produce expensive count subqueries.
- There are no indexes, materialized filter caches, or result caches.
- Analyst SQL execution only returns a limited result and does not expose server-side pagination for arbitrary SELECT output.

### Export

Strengths:

- Export is backend-generated from DuckDB, not browser-generated from visible rows.
- Export limit is capped at 1000 rows today.

Risks:

- `csv_response` builds the entire CSV in `io.StringIO` before returning.
- Export currently fetches all export rows into memory via `rows_to_dicts`.
- Raising export limits without streaming would create backend memory pressure.
- Excel export is not currently implemented; adding it with in-memory workbooks would be risky.

## Scalability Risk Matrix

| Area | Current Risk | Why It Matters |
| --- | --- | --- |
| Million-row CSV upload | Medium | DuckDB can handle it, but synchronous upload plus full profiling can make upload feel frozen. |
| Wide CSV upload | High | Per-column full-table profiling and browser column UI scale poorly. |
| Large XLSX workbook | High | Current parser materializes XML and rows in memory; hard limits already acknowledge prototype scale. |
| Multi-sheet relationship profiling | Medium | Pairwise column comparison can grow quickly across many sheets and columns. |
| Results rendering | High | Paginated but not virtualized; large pages and wide tables can freeze the browser. |
| Filtering and grouping | Medium | Backend execution is correct, but count/group queries need caching and progressive status. |
| Export | High if limits rise | Current implementation is memory-buffered and capped at 1000 rows. |
| Runtime/session persistence | Low to medium | Runtime persistence is small, but recent sessions can retain page rows across tabs. |

## Recommended Dataset Tiers

### Small Dataset

Target: up to 100,000 rows, up to 100 columns, single CSV or modest workbook.

Behavior:

- Current synchronous upload can remain acceptable.
- Full profiling is allowed.
- ResultsGrid can render current pagination options.
- Export can remain capped until streaming export exists.

### Medium Dataset

Target: 100,000 to 2 million rows, up to 250 columns, limited workbook sheet count.

Behavior:

- Upload should return a fast preview and background profiling job.
- Full `COUNT(DISTINCT)` should be replaced with sampled or approximate profiles.
- ResultsGrid should default to smaller page sizes.
- Human Mode should show "ready to explore" once preview is available, with deeper summaries arriving progressively.

### Large Dataset

Target: 2 million to 50 million rows or very wide tables.

Behavior:

- Ingestion should be asynchronous and job-based.
- Preview should be generated immediately from a bounded sample.
- Filtering/sorting/grouping should be server-side only.
- Pagination should move toward keyset or cached-page strategies where possible.
- ResultsGrid needs row and column virtualization.
- Exports should be background streaming jobs.

### Enterprise-Scale Dataset

Target: 50 million+ rows, very large workbooks, cloud/object storage, team workflows.

Behavior:

- Upload should be resumable and object-storage-backed.
- CSV/XLSX should be converted to Parquet.
- DuckDB should query Parquet directly or attach a managed analytical store.
- Query execution should be async with result sets stored as cached artifacts.
- Human Mode should become preview-first and task-oriented, never full-data-first.

## Backend Processing Strategy

### Immediate Backend Safety

1. Keep browser parsing out of scope. Continue uploading files to the backend.
2. Add explicit file-size and row/column tier classification to upload responses.
3. Split upload into phases: file received, preview ready, profile ready, relationship review ready.
4. Replace full profiling during upload with bounded initial profiling for medium and large datasets:
   - row count
   - column count
   - first-page preview
   - sampled type inference
   - sampled distinct estimates
5. Defer expensive per-column `COUNT(DISTINCT)` and relationship profiling.

### Chunked CSV Parsing

DuckDB's `read_csv_auto` is a good baseline, but the product should wrap ingestion as a job:

- Persist the uploaded file.
- Create a dataset ingestion job record.
- Run DuckDB CSV loading in a worker.
- Emit preview metadata as soon as a small sample is available.
- Compute full row count and profile asynchronously.

For very large CSVs, prefer:

- `COPY` or `CREATE TABLE AS SELECT` into DuckDB from file.
- sampled schema inference first, then explicit schema load if needed.
- optional conversion to Parquet once loaded.

### Streaming Workbook Ingestion

The current workbook parser should not be scaled directly. For large XLSX:

- Use a streaming workbook reader instead of loading full XML trees.
- Process one sheet at a time.
- Write rows to DuckDB or Parquet incrementally.
- Limit relationship profiling to metadata and samples.
- Treat workbook ingestion as a job with sheet-level status.

Recommended workbook statuses:

- uploaded
- scanning sheets
- preview ready
- staging sheets
- profiling
- ready
- partial
- failed

### Server-Side Pagination

The current `LIMIT/OFFSET` model is acceptable for small and medium pages but should evolve:

- keep existing request shapes for compatibility
- add backend result handles for large result sets
- cache result sets for filters, Query Builder, and Analyst SQL
- support page tokens or keyset pagination where a stable sort exists
- return page metadata and approximate total counts when exact counts are expensive

### Incremental Filtering And Grouping

Filtering and grouping should remain backend-only. For scale:

- cache filter result summaries by dataset id, filter hash, sort hash, page, and page size
- compute expensive counts asynchronously for large datasets
- expose "estimated total" vs "exact total" in metadata later
- avoid auto-running high-cardinality groupings without a Human Mode warning

### Async Query Execution

Introduce an execution job model without removing current synchronous endpoints:

- current endpoints remain for small/medium datasets
- large dataset requests return an execution id
- frontend polls or subscribes for status
- completed jobs expose result pages and export handles

This preserves `executeWorkspaceQuery` by letting it wrap either immediate results or job-completed pages behind the same active result contract.

## DuckDB Strategy

### Browser DuckDB

DuckDB-Wasm should not be the primary large-data engine for FiltraQueri right now.

Use cases where browser DuckDB may help later:

- offline demos
- small local files
- private single-user mode
- client-only sampling

Risks:

- browser memory limits
- slower startup and worker transfer overhead
- duplicate engine behavior between browser and backend
- harder persistence story for large workbooks

Recommendation: keep the browser thin. Do not move large ingestion or querying into browser DuckDB.

### Backend DuckDB

Backend DuckDB is the right near-term engine:

- already integrated
- strong CSV and Parquet support
- excellent local analytical performance
- fits single-user local workspace storage

Near-term improvements:

- add ingestion jobs
- configure memory/temp directories
- convert staged datasets to Parquet for large files
- cache query results as temporary tables or Parquet result artifacts
- avoid full profiling in the upload request

### Parquet Conversion Pipeline

For medium and large datasets:

1. Upload original file.
2. Generate bounded preview.
3. Stage into DuckDB.
4. Write normalized table to Parquet.
5. Store dataset metadata pointing to DuckDB table and/or Parquet artifact.
6. Query Parquet through DuckDB for follow-up requests.

Benefits:

- faster reload after backend restart
- lower storage and scan cost
- cleaner enterprise path to object storage
- better export and result-cache foundation

### Workbook-To-DuckDB Staging

For workbooks:

- each sheet should become a staged relation
- the active sheet remains exposed as `data`
- workbook metadata should store sheet-level profile readiness
- relationships remain advisory unless a future explicit join workflow is added

Large workbook intelligence should be lazy:

- infer roles from sheet and column names first
- profile only sampled values initially
- run relationship scoring as a background task
- never block preview on relationship intelligence

## Virtualization Requirements

### ResultsGrid

`ResultsGrid` is pagination-aware but not virtualization-ready yet. It renders:

- all visible rows on the active page
- all visible columns
- all cells as DOM nodes
- the full column visibility menu

Required for large/wide tables:

- virtual row rendering
- virtual column rendering
- sticky row number and column headers
- measured column widths with horizontal virtualization
- keyboard navigation that works with virtualized rows
- cell copy behavior preserved for visible cells
- column visibility menu with search and lazy rendering

Implementation options:

- TanStack Virtual for rows and columns
- React Aria/table accessibility patterns layered carefully
- a dedicated spreadsheet grid component for Results only

Do not start by raising page size. First introduce virtualization and keep page sizes conservative.

### Large Column Risks

Wide workbooks and CSVs need special handling:

- default to showing business-priority columns first
- keep column visibility state lightweight
- avoid rendering all column controls at once
- allow "show first N columns" or "pin key fields" later

## Export Scalability

### Current Export

Current export is intentionally capped at 1000 rows and returns a Blob to the browser. Backend builds CSV in memory with `StringIO`.

### Recommended Export Model

Small exports:

- keep current synchronous CSV export for up to the existing cap

Medium exports:

- stream CSV from DuckDB cursor or `COPY` output
- return a streaming response
- avoid `rows_to_dicts` for export

Large exports:

- create export job
- write CSV or Parquet artifact to disk/object storage
- show progress in Human Mode
- provide download when ready
- allow cancellation and expiry

Excel export:

- avoid in-memory workbook creation for large datasets
- cap Excel row counts clearly
- prefer CSV or Parquet for large outputs
- use streaming writers only when Excel output is required

## Human Mode Preservation

Large dataset support must preserve the simple Human Mode promise: open data, see what it is, ask useful questions, and refine without understanding backend machinery.

Recommended Human Mode behavior:

- show preview as soon as possible
- label large datasets in business terms: "Large workbook", "Many rows", "Profile still preparing"
- keep heavy work behind progressive disclosure
- generate summaries from samples first
- show confidence language for sampled intelligence
- never require users to choose engines, partitions, indexes, or query plans
- keep Analyst Mode as the place for technical inspection

Human Mode should prefer:

- "Preview ready"
- "Summary still preparing"
- "This file has many rows, so we are sampling first"
- "Exports may take a moment"

Human Mode should avoid:

- exposing DuckDB internals
- showing raw execution stages by default
- blocking the workspace until full profiling is complete

## Recommended Architecture Roadmap

### Phase 1: Immediate Fixes

1. Add dataset size tiers to backend metadata.
2. Add upload file size and workbook sheet/row/column messaging that distinguishes prototype limits from product limits.
3. Keep preview generation fast and bounded.
4. Cap ResultsGrid page sizes more conservatively for wide datasets.
5. Avoid storing large queried/filtered pages in recent sessions when switching datasets.
6. Add backend profiling modes:
   - full for small
   - sampled for medium and large
7. Defer workbook relationship profiling when workbook complexity is high.

### Phase 2: Medium-Term Scalability Layer

1. Add ingestion job records and job status endpoints.
2. Add async profile generation.
3. Add result-cache records for filter, Query Builder, and Analyst SQL outputs.
4. Add server-side paged result handles.
5. Add streaming CSV export.
6. Add ResultsGrid row virtualization.
7. Add lazy column menu rendering.
8. Add sampled Human Mode intelligence with visible confidence wording.

### Phase 3: Large Dataset Architecture

1. Convert large staged datasets to Parquet.
2. Query Parquet through backend DuckDB.
3. Add background export jobs.
4. Add virtualized rows and columns in ResultsGrid.
5. Add approximate counts and progressive exact counts.
6. Add cancellable long-running queries.
7. Add sheet-level workbook ingestion jobs.

### Phase 4: Enterprise Direction

1. Move file storage to object storage.
2. Store metadata, jobs, and result handles in a durable database.
3. Add resumable uploads.
4. Add worker queue for ingestion, profiling, exports, and relationship intelligence.
5. Add dataset retention policies.
6. Add Parquet-first analytical storage.
7. Add audit logs for large export and query jobs.

## Recommended Implementation Order

1. Define dataset tier metadata and profile readiness states.
2. Split preview readiness from full profiling readiness.
3. Convert workbook relationship intelligence to lazy/background execution for complex workbooks.
4. Introduce ingestion job endpoints while preserving current upload response for small datasets.
5. Add streaming export for CSV before raising export limits.
6. Add ResultsGrid row virtualization.
7. Add column virtualization and lazy column controls.
8. Add result handles and async execution for large filter/query/SQL outputs.
9. Add Parquet conversion for medium and large datasets.
10. Add enterprise storage and worker infrastructure.

## Preservation Risks

The highest preservation risks are not in DuckDB itself. They are in the contracts surrounding it:

- `executeWorkspaceQuery` expects immediate rows today.
- `ActiveResultModel` expects row arrays for the active page.
- ResultsGrid expects all visible rows and columns to be renderable.
- session restore expects preview state to be immediately reconstructable.
- export history assumes a synchronous completed export.

To preserve behavior, introduce new scalable internals behind compatibility adapters:

- keep current synchronous paths for small datasets
- keep request shapes stable
- let async jobs hydrate the same `ResultState` shape when a page is ready
- keep Human Mode preview-first
- do not auto-join workbook sheets
- do not expose technical engine decisions in Human Mode

## Audit Validation Notes

Inspected areas:

- upload flow: `backend/app/main.py`, `frontend/src/services/api.ts`, `frontend/src/features/dataset/useWorkspaceDatasetController.ts`
- workbook parsing path: `backend/app/workbook_ingestion.py`, `backend/app/workbook_relationships.py`
- ResultsGrid rendering flow: `frontend/src/components/results/ResultsGrid.tsx`
- ActiveResultModel lifecycle: `frontend/src/features/results/activeResultModel.ts`, `frontend/src/features/results/useResults.ts`
- runtime persistence: `frontend/src/features/workspaceRuntime/runtimePersistence.ts`
- workspace/session restore: `frontend/src/features/dataset/useDatasetSessions.ts`, `frontend/src/features/dataset/useWorkspaceDatasetController.ts`
- export flow: `frontend/src/features/export/useExportController.ts`, `backend/app/main.py`

No code changes are recommended as part of this audit document itself.
