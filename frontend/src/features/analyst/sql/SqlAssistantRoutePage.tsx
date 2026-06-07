import type { ActiveView, DatasetMetadata } from "../../dataset/datasetTypes";
import type { SqlWorkspaceMetadataSnapshot } from "../../sqlWorkspacePersistence";
import type { AnalysisScopeSelection, WorkbookMetadata } from "../../workbook";
import SqlAssistantPanel, { type SqlAssistantMode } from "./SqlAssistantPanel";
import useSqlWorkspace from "./useSqlWorkspace";

type SqlAssistantRoutePageKind = "templates" | "reports";

type SqlAssistantRoutePageProps = {
  dataset: DatasetMetadata | null;
  metadata?: SqlWorkspaceMetadataSnapshot;
  onMetadataChange?: (metadata: SqlWorkspaceMetadataSnapshot) => void;
  kind: SqlAssistantRoutePageKind;
  requestedMode?: SqlAssistantMode | null;
  onAnalystViewChange?: (view: ActiveView) => void;
};

const templateModes: SqlAssistantMode[] = ["templates", "assist"];
const reportModes: SqlAssistantMode[] = ["recipes"];

const getScopeWorksheetLabels = (
  dataset: DatasetMetadata | null,
  selections: AnalysisScopeSelection[],
) => {
  const worksheets = dataset?.workbook_metadata?.worksheets || [];
  return selections.map((selection) => {
    const worksheet = worksheets.find((current) => current.worksheetId === selection.worksheetId);
    return worksheet?.displayName || worksheet?.sheetName || selection.tableName;
  });
};

const createAppliedScopeDataset = (
  dataset: DatasetMetadata | null,
  fallbackDataset: DatasetMetadata | null,
  selections: AnalysisScopeSelection[],
): DatasetMetadata | null => {
  if (!dataset || selections.length === 0 || !dataset.workbook_metadata) {
    return fallbackDataset;
  }

  const selectionIds = new Set(selections.map((selection) => selection.worksheetId));
  const scopedWorksheets = dataset.workbook_metadata.worksheets.filter((worksheet) =>
    selectionIds.has(worksheet.worksheetId),
  );
  const firstSelection = selections[0];
  const primaryWorksheet =
    scopedWorksheets.find((worksheet) => worksheet.worksheetId === firstSelection?.worksheetId) ||
    scopedWorksheets[0];

  if (!firstSelection || !primaryWorksheet) {
    return fallbackDataset;
  }

  const scopedWorkbook: WorkbookMetadata = {
    ...dataset.workbook_metadata,
    activeWorksheetId: primaryWorksheet.worksheetId,
    activeAnalysisSource: {
      type: firstSelection.sourceType,
      worksheetId: firstSelection.worksheetId,
      tableName: firstSelection.tableName,
      originalTableName: firstSelection.originalTableName || primaryWorksheet.tableName,
      activatedAt:
        dataset.workbook_metadata.activeAnalysisSource?.activatedAt ||
        dataset.workbook_metadata.updatedAt,
    },
    worksheetIds: scopedWorksheets.map((worksheet) => worksheet.worksheetId),
    worksheets: scopedWorksheets,
    tableMappings: dataset.workbook_metadata.tableMappings.filter((mapping) =>
      scopedWorksheets.some((worksheet) => worksheet.tableName === mapping.tableName),
    ),
    cleanedWorkingCopies: dataset.workbook_metadata.cleanedWorkingCopies.filter((copy) =>
      selectionIds.has(copy.sourceWorksheetId),
    ),
    relationshipCandidates: dataset.workbook_metadata.relationshipCandidates.filter(
      (candidate) =>
        selectionIds.has(candidate.sourceWorksheetId) &&
        selectionIds.has(candidate.targetWorksheetId),
    ),
    acceptedRelationshipContracts:
      dataset.workbook_metadata.acceptedRelationshipContracts.filter(
        (contract) =>
          selectionIds.has(contract.sourceWorksheetId) &&
          selectionIds.has(contract.targetWorksheetId),
      ),
  };

  return {
    ...dataset,
    table_name: firstSelection.tableName,
    schema: primaryWorksheet.schema,
    row_count: primaryWorksheet.rowCount,
    column_count: primaryWorksheet.columnCount,
    workbook_metadata: scopedWorkbook,
  };
};

const pageCopy: Record<
  SqlAssistantRoutePageKind,
  {
    label: string;
    title: string;
    description: string;
    bannerTitle: string;
    bannerText: string;
    note: string;
  }
> = {
  templates: {
    label: "Analyst - Browse Templates",
    title: "SQL patterns",
    description:
      "Pick a starting point from the Template Library or use Complex SQL Assist. Inserts return to Inspect SQL for review.",
    bannerTitle: "Browse Templates",
    bannerText:
      "Find the right SQL pattern without knowing the syntax. Search filters, joins, summaries, date logic, missing records, and data-quality checks.",
    note: "Selecting a template inserts SQL into Inspect SQL only. Run query stays manual.",
  },
  reports: {
    label: "Analyst - Browse Reports",
    title: "Reports for this dataset",
    description:
      "Review deterministic recipes and local metadata-only AI preview suggestions in one gallery.",
    bannerTitle: "Browse Reports",
    bannerText:
      "Turn your dataset into business-ready reports. Use deterministic recipes or review metadata-only AI suggestions before any draft is created.",
    note: "Deterministic reports can insert SQL into Inspect SQL. AI preview cards do not insert SQL.",
  },
};

function SqlAssistantRoutePage({
  dataset,
  metadata,
  onMetadataChange,
  kind,
  requestedMode,
  onAnalystViewChange,
}: SqlAssistantRoutePageProps) {
  const {
    selectedDialect,
    selectedDialectProfile,
    sqlTabs,
    insertSql,
    activeTabSourceContext,
    scopedDatasetForTab,
  } = useSqlWorkspace(dataset, undefined, metadata, onMetadataChange);
  const copy = pageCopy[kind];
  const allowedModes = kind === "templates" ? templateModes : reportModes;
  const activeSourceLabel = sqlTabs.activeTabTitle || "No active SQL tab";
  const appliedScopeLabels = getScopeWorksheetLabels(dataset, sqlTabs.appliedScopeSelections);
  const appliedScopeLabel =
    appliedScopeLabels.length > 0 ? appliedScopeLabels.join(", ") : null;
  // Option C — Templates / Reports must render against the active SQL tab's
  // source (schema, table name), not the global dataset. SqlAssistantPanel
  // already accepts a dataset; we feed it the tab-scoped synthesis from
  // useSqlWorkspace so cards (column choices, sample SQL, eligibility) are
  // built from the active tab's worksheet schema.
  const assistantDataset =
    createAppliedScopeDataset(dataset, scopedDatasetForTab ?? dataset, sqlTabs.appliedScopeSelections) ??
    scopedDatasetForTab ??
    dataset;

  const insertAndReturnToInspectSql = (
    sql: string,
    metadata?: { id?: string; label?: string; createdFrom?: "template" | "report" },
  ) => {
    insertSql(sql, metadata);
    onAnalystViewChange?.("sqlWorkspace");
  };

  return (
    <section className="sql-assistant-route-page" aria-label={copy.title}>
      <div className="analyst-page-banner">
        <p className="section-label">Analyst workspace</p>
        <h2>{copy.bannerTitle}</h2>
        <p>{copy.bannerText}</p>
      </div>

      <div className="sql-assistant-route-topbar">
        <span className="sql-route-source-pill">
          {dataset?.original_filename || "No dataset open"}
        </span>
        <span className="sql-route-source-pill is-active">
          Active tab - {activeSourceLabel}
        </span>
        {activeTabSourceContext.tableName && (
          <span className="sql-route-source-pill">
            {activeTabSourceContext.tableName}
          </span>
        )}
        <span className="sql-route-source-pill">
          {activeTabSourceContext.sourceType === "cleaned_working_copy"
            ? "Cleaned"
            : "Original"}
        </span>
        <span>{copy.note}</span>
      </div>
      <p className="sql-route-scope-helper">
        Templates use the active SQL tab's applied scope. To use different
        worksheets, switch tabs or update this tab's SQL Context.{" "}
        {appliedScopeLabel
          ? `Current applied scope: ${appliedScopeLabel}.`
          : "No scope applied yet; using the active tab source."}{" "}
        Selected scope is context only and does not run or activate anything.
      </p>

      <div className="sql-assistant-route-header">
        <div>
          <p className="section-label">{copy.label}</p>
          <h2>{copy.title}</h2>
          <p>{copy.description}</p>
        </div>
      </div>

      <SqlAssistantPanel
        dataset={assistantDataset}
        selectedDialect={selectedDialect}
        selectedDialectProfile={selectedDialectProfile}
        onInsertSql={insertAndReturnToInspectSql}
        requestedMode={kind === "reports" ? "recipes" : requestedMode}
        allowedModes={allowedModes}
      />
    </section>
  );
}

export default SqlAssistantRoutePage;
