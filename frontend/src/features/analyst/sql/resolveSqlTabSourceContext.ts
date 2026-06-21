/**
 * Option C — Active SQL tab source-of-truth resolver.
 *
 * Resolves the active SQL tab + global dataset into one deterministic source
 * context that drives the schema rail, command bar badges, template/report
 * generation, query explanation, and the execution-mismatch warning copy.
 *
 * The resolver does not call any backend, does not run any SQL, and does not
 * mutate workbook state. It is pure data: read the tab, look up the
 * corresponding worksheet in the workbook metadata, and surface
 * worksheet-level schema + tableName + rowCount + columnCount instead of
 * the global dataset's fields. When the tab points at a worksheet/source
 * that differs from the dataset's currently active (executable) source,
 * `isExecutableWithCurrentDataset` flips to false and `mismatchWarning`
 * carries safe human-readable copy that the UI can render next to Run
 * Query. The actual execution path is unchanged; only the warning surfaces.
 */

import type { DatasetMetadata, SchemaColumn } from "../../dataset/datasetTypes";
import type { SqlWorkspaceSourceType, SqlWorkspaceTab } from "./sqlTabsTypes";

export type SqlTabSourceContext = {
  // Human-friendly label shown in command bar / schema rail / route page.
  sourceLabel: string;
  // The tab's worksheet (if any) — null when no workbook is open.
  worksheetId: string | null;
  // Original vs cleaned, derived from the tab.
  sourceType: SqlWorkspaceSourceType;
  // The table name actually targeted by the tab's FROM clause (original or
  // cleaned), to be displayed as a small command-bar badge.
  tableName: string;
  // The original worksheet's table name (canonical / pre-cleaning), for
  // display when the tab is on the cleaned variant.
  sourceTableName: string | null;
  originalTableName: string | null;
  cleanedTableName: string | null;
  // Schema for the tab's source. Falls back to the global dataset schema
  // when the tab has no worksheet binding (e.g. starter SQL on a CSV).
  schema: SchemaColumn[];
  rowCount: number;
  columnCount: number;
  // True when the tab's source matches the dataset's currently executable
  // (active) source. When false, Run Query still works against the global
  // active source — the warning copy below tells the user to switch.
  isExecutableWithCurrentDataset: boolean;
  mismatchWarning: string | null;
  // Companion fields describing the global executable source — used by the
  // warning copy and any debug surfaces.
  globalActiveSourceLabel: string | null;
  globalActiveTableName: string | null;
};

const EMPTY_CONTEXT: SqlTabSourceContext = {
  sourceLabel: "No dataset open",
  worksheetId: null,
  sourceType: "original",
  tableName: "",
  sourceTableName: null,
  originalTableName: null,
  cleanedTableName: null,
  schema: [],
  rowCount: 0,
  columnCount: 0,
  isExecutableWithCurrentDataset: false,
  mismatchWarning: null,
  globalActiveSourceLabel: null,
  globalActiveTableName: null,
};

export function resolveSqlTabSourceContext(
  dataset: DatasetMetadata | null | undefined,
  activeTab: SqlWorkspaceTab | null | undefined,
): SqlTabSourceContext {
  if (!dataset || !activeTab) {
    return EMPTY_CONTEXT;
  }

  const workbookMetadata = dataset.workbook_metadata;
  const tabWorksheetId = activeTab.worksheetId || null;
  const tabWorksheet = tabWorksheetId
    ? workbookMetadata?.worksheets.find(
        (worksheet) => worksheet.worksheetId === tabWorksheetId,
      ) || null
    : null;

  // Schema: prefer the tab's worksheet, fall back to the global dataset.
  const schema: SchemaColumn[] =
    (tabWorksheet?.schema && tabWorksheet.schema.length > 0
      ? tabWorksheet.schema
      : dataset.schema) || [];

  const sourceLabel =
    tabWorksheet?.displayName ||
    tabWorksheet?.sheetName ||
    activeTab.originalTableName ||
    activeTab.tableName ||
    dataset.table_name ||
    activeTab.title ||
    "Active source";

  const originalTableName =
    activeTab.originalTableName ||
    tabWorksheet?.tableName ||
    null;

  const cleanedTableName =
    activeTab.cleanedTableName ||
    (tabWorksheetId
      ? workbookMetadata?.cleanedWorkingCopies?.find(
          (copy) => copy.sourceWorksheetId === tabWorksheetId,
        )?.cleanedTableName || null
      : null);

  const tableName =
    activeTab.tableName ||
    (activeTab.sourceType === "cleaned_working_copy"
      ? cleanedTableName || originalTableName || ""
      : originalTableName || "") ||
    dataset.table_name ||
    "";

  const sourceTableName = originalTableName || tableName || null;

  const rowCount =
    typeof tabWorksheet?.rowCount === "number"
      ? tabWorksheet.rowCount
      : dataset.row_count || 0;
  const columnCount =
    typeof tabWorksheet?.columnCount === "number"
      ? tabWorksheet.columnCount
      : schema.length;

  // Determine if the tab source matches the dataset's executable source.
  const globalActiveWorksheetId = workbookMetadata?.activeWorksheetId || null;
  const globalActiveSource = workbookMetadata?.activeAnalysisSource || null;
  const globalActiveSourceType: SqlWorkspaceSourceType =
    globalActiveSource?.type === "cleaned_working_copy"
      ? "cleaned_working_copy"
      : "original";

  const globalActiveWorksheet = globalActiveWorksheetId
    ? workbookMetadata?.worksheets.find(
        (worksheet) => worksheet.worksheetId === globalActiveWorksheetId,
      ) || null
    : null;
  const globalActiveSourceLabel =
    globalActiveWorksheet?.displayName ||
    globalActiveWorksheet?.sheetName ||
    dataset.table_name ||
    null;
  const globalActiveTableName =
    globalActiveSourceType === "cleaned_working_copy"
      ? workbookMetadata?.cleanedWorkingCopies?.find(
          (copy) => copy.sourceWorksheetId === globalActiveWorksheetId,
        )?.cleanedTableName ||
        globalActiveWorksheet?.tableName ||
        dataset.table_name ||
        null
      : globalActiveWorksheet?.tableName || dataset.table_name || null;

  // A tab without a worksheetId (e.g. plain CSV starter) is considered
  // executable; we cannot reason about a mismatch.
  const worksheetMatches =
    !tabWorksheetId ||
    !globalActiveWorksheetId ||
    tabWorksheetId === globalActiveWorksheetId;
  // For a CSV (no workbook metadata) there is no source-type concept;
  // sourceTypeMatches defaults to true.
  const sourceTypeMatches = workbookMetadata
    ? activeTab.sourceType === globalActiveSourceType
    : true;
  const isExecutableWithCurrentDataset = worksheetMatches && sourceTypeMatches;

  const mismatchWarning = isExecutableWithCurrentDataset
    ? null
    : (() => {
        const tabSegment = `${sourceLabel}${tableName ? ` (${tableName})` : ""}`;
        const globalSegment = globalActiveSourceLabel
          ? `${globalActiveSourceLabel}${
              globalActiveTableName ? ` (${globalActiveTableName})` : ""
            }`
          : "the active worksheet";
        return `This tab is prepared for ${tabSegment}. The current executable source is ${globalSegment}. Make this source active before running.`;
      })();

  return {
    sourceLabel,
    worksheetId: tabWorksheetId,
    sourceType: activeTab.sourceType,
    tableName,
    sourceTableName,
    originalTableName,
    cleanedTableName,
    schema,
    rowCount,
    columnCount,
    isExecutableWithCurrentDataset,
    mismatchWarning,
    globalActiveSourceLabel,
    globalActiveTableName,
  };
}

export { EMPTY_CONTEXT as EMPTY_SQL_TAB_SOURCE_CONTEXT };
