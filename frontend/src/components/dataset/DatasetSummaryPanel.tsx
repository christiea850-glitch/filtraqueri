import { useEffect, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import type { DatasetMetadata, DatasetSession } from "../../features/dataset/datasetTypes";
import { useBusinessSemantics } from "../../features/businessSemantics";
import { useDataIntelligence } from "../../features/dataIntelligence";
import { useWorkflowRecommendations } from "../../features/workflowRecommendations";
import { createDatasetIntelligencePreviewViewModel } from "../../features/runtimeBridgeConsumers";
import { DatasetIntelligenceDetailPage } from "../../features/detailPages";
import {
  closeControlledHashDetailRoute,
  createNavigationBackStateDescriptor,
  createNavigationOriginDescriptor,
  emptyNavigationContextPreservation,
  subscribeControlledHashDetailRoute,
  type ControlledHashDetailRouteId,
} from "../../features/navigation";
import {
  createSchemaDisplayProfiles,
  getBusinessRoleLabel,
} from "../../features/dataIntelligence/structuralPresentation";
import {
  getDatasetActiveWorksheet,
  listWorkbookWorksheets,
  type WorksheetMetadata,
} from "../../features/workbook";
import {
  buildWorkbookRelationshipIntelligence,
  type WorkbookEntityRole,
  type WorkbookRelationshipIntelligence,
} from "../../features/workbookIntelligence";
import DrillInDetailPanel from "../layout/DrillInDetailPanel";
import FocusedWorkspaceShell from "../layout/FocusedWorkspaceShell";
import WorkspaceTabs from "../layout/WorkspaceTabs";
import {
  ContextRail,
  ContextRailHeader,
  ContextRailSection,
  EvidenceRow,
  EvidenceRows,
  InlineDisclosure,
  InvestigationThread,
  InvestigationThreadStage,
  MetadataFooter,
  OperationalList,
  OperationalTag,
  OperationalWorkspaceLayout,
  WorkspaceHeader,
} from "../workspace";
import WorkbookContextPanel from "../workbook/WorkbookContextPanel";

export type HumanIntent =
  | "summary"
  | "missing_values"
  | "top_categories"
  | "compare_columns"
  | "trends"
  | "unusual_values"
  | "simple_chart";

type DatasetSummaryPanelProps = {
  dataset: DatasetMetadata | null;
  recentDatasets: DatasetSession[];
  onViewPreview: () => void;
  onHumanIntentSelect: (intent: HumanIntent) => void;
  onOpenDataset: () => void;
  onActivateRecentDataset: (datasetId: string) => void;
  onRemoveRecentDataset: (datasetId: string) => void;
  onClearCurrentDataset: () => void;
  onDeleteDataset: (datasetId: string) => void;
  onWorksheetSelect: (worksheetId: string) => void;
  isSwitchingWorksheet: boolean;
  selectedTaskId?: string | null;
  onSelectedTaskIdChange?: (taskId: string | null) => void;
};

type DataDrillInView = "overview" | "columns" | "worksheets" | "dataIntelligence" | "businessSemantics";
type DataWorkflowMenu = "intelligence" | "semantic";
type DataFocusedWorkflow =
  | "dataIntelligence"
  | "guidedAnalyticsTasks"
  | "businessSemantics"
  | "kpiIntelligence"
  | "humanGuidance";
type FocusedOperationalWorkspace = "connections" | "entities" | "kpis" | "trends";
type DataWorkspaceCommandTarget =
  | "preview"
  | "worksheetPreview"
  | "connections"
  | "intelligence"
  | "intelligenceDetail"
  | "semantics";

const datasetIntelligenceDetailRouteId: ControlledHashDetailRouteId = "detail:dataset-intelligence";

type HumanSignalTone =
  | "info"
  | "warning"
  | "opportunity"
  | "ready"
  | "attention"
  | "connected";

type HumanSignalIcon =
  | "trend"
  | "connected"
  | "warning"
  | "opportunity"
  | "timeline"
  | "entity"
  | "comparison"
  | "info";

function HumanSignalIcon({ name }: { name: HumanSignalIcon }) {
  const iconPaths: Record<HumanSignalIcon, ReactNode> = {
    trend: (
      <>
        <path d="M4 18h16" />
        <path d="m5 14 4-4 4 3 6-7" />
        <path d="M16 6h3v3" />
      </>
    ),
    connected: (
      <>
        <path d="M9 12a3 3 0 1 0-3 3" />
        <path d="M15 12a3 3 0 1 1 3 3" />
        <path d="M8 12h8" />
      </>
    ),
    warning: (
      <>
        <path d="M12 4 3 20h18L12 4Z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </>
    ),
    opportunity: (
      <>
        <path d="M9 18h6" />
        <path d="M10 22h4" />
        <path d="M8.5 14.5a5 5 0 1 1 7 0c-.7.7-1.1 1.4-1.3 2.5H9.8c-.2-1.1-.6-1.8-1.3-2.5Z" />
      </>
    ),
    timeline: (
      <>
        <rect x="4" y="5" width="16" height="15" rx="2" />
        <path d="M8 3v4M16 3v4M4 10h16" />
      </>
    ),
    entity: (
      <>
        <path d="M16 19a4 4 0 0 0-8 0" />
        <circle cx="12" cy="8" r="3" />
        <path d="M19 18a3 3 0 0 0-2.4-2.9" />
        <path d="M17 5.4a2.5 2.5 0 0 1 0 5" />
      </>
    ),
    comparison: (
      <>
        <path d="M5 6h6M5 12h10M5 18h14" />
        <path d="M17 6h2" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5" />
        <path d="M12 8h.01" />
      </>
    ),
  };

  return (
    <span className="human-signal-icon" aria-hidden="true">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {iconPaths[name]}
      </svg>
    </span>
  );
}

type DatasetSessionPanelProps = {
  dataset: DatasetMetadata;
  schemaTypeSummary: Record<string, number>;
  activeFilterLabels: string[];
  queryGroupBy: string[];
  onRelationshipReview?: (
    candidateId: string,
    reviewStatus: "pending" | "accepted" | "dismissed",
    notes?: string,
  ) => void;
};

export function DatasetSessionPanel({
  dataset,
  schemaTypeSummary,
  activeFilterLabels,
  queryGroupBy,
  onRelationshipReview,
}: DatasetSessionPanelProps) {
  return (
    <aside className="session-panel">
      <div>
        <p className="section-label">Context</p>
        <h2 title={dataset.original_filename}>{dataset.original_filename}</h2>
      </div>
      <div className="session-stat-list">
        <span>Rows</span>
        <strong>{dataset.row_count.toLocaleString()}</strong>
      </div>
      <div className="schema-type-list">
        <span>
          Columns
          <strong>{dataset.column_count.toLocaleString()}</strong>
        </span>
        <span>
          Types
          <strong>{Object.keys(schemaTypeSummary).length}</strong>
        </span>
      </div>
      <div className="active-context">
        <p>Filters</p>
        <small>{activeFilterLabels.length || "None"}</small>
      </div>
      <div className="active-context">
        <p>Grouping</p>
        <small>{queryGroupBy.length > 0 ? queryGroupBy.join(", ") : "None"}</small>
      </div>
      <WorkbookContextPanel
        dataset={dataset}
        variant="results"
        onRelationshipReview={onRelationshipReview}
      />
    </aside>
  );
}

type WorksheetSelectorProps = {
  worksheets: WorksheetMetadata[];
  activeWorksheetId: string | null;
  isSwitchingWorksheet: boolean;
  onWorksheetSelect: (worksheetId: string) => void;
};

function WorksheetSelector({
  worksheets,
  activeWorksheetId,
  isSwitchingWorksheet,
  onWorksheetSelect,
}: WorksheetSelectorProps) {
  if (worksheets.length === 0) return null;

  return (
    <div className="worksheet-selector" aria-label="Workbook sources">
      <div className="worksheet-selector-header">
        <div>
          <p className="section-label">Sources</p>
          <h4>Available sources</h4>
        </div>
        <span className="dataset-count-pill">{worksheets.length}</span>
      </div>
      <div className="worksheet-list">
        {worksheets.map((worksheet) => {
          const isActive = worksheet.worksheetId === activeWorksheetId;
          const isReady = worksheet.status === "ready";
          const label = worksheet.displayName || worksheet.sheetName;

          return (
            <button
              type="button"
              className={`worksheet-item${isActive ? " active" : ""}`}
              key={worksheet.worksheetId}
              disabled={!isReady || isActive || isSwitchingWorksheet}
              onClick={() => onWorksheetSelect(worksheet.worksheetId)}
              aria-current={isActive ? "true" : undefined}
              title={label}
            >
              <span className="worksheet-name">{label}</span>
              <span className={`worksheet-status ${worksheet.status}`}>{worksheet.status}</span>
              <span className="worksheet-metrics">
                {worksheet.rowCount.toLocaleString()} rows
                <span aria-hidden="true">/</span>
                {worksheet.columnCount.toLocaleString()} columns
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const workbookRoleLabels: Record<WorkbookEntityRole, string> = {
  customers: "Customers",
  orders: "Orders",
  invoices: "Invoices",
  products: "Products",
  employees: "Employees",
  managers: "Managers",
  transactions: "Transactions",
  inventory: "Inventory",
  payments: "Payments",
  regions: "Regions",
  unknown: "Worksheet",
};

const workbookRoleActivityLabels: Record<WorkbookEntityRole, string> = {
  customers: "customer fields",
  orders: "order fields",
  invoices: "invoice fields",
  products: "product fields",
  employees: "employee fields",
  managers: "manager fields",
  transactions: "transaction fields",
  inventory: "inventory fields",
  payments: "payment fields",
  regions: "regional fields",
  unknown: "dataset fields",
};

const toBusinessConnectionGuidance = (connection: {
  sourceWorksheetName: string;
  targetWorksheetName: string;
  sourceColumn: string;
  targetColumn: string;
  guidance: string;
}) => {
  const source = connection.sourceWorksheetName || "One source";
  const target = connection.targetWorksheetName || "another source";
  const combined = `${source} ${target} ${connection.sourceColumn} ${connection.targetColumn} ${connection.guidance}`.toLowerCase();

  if (combined.includes("tenant") && combined.includes("lease")) {
    return "Tenant fields may relate to lease timeline fields.";
  }
  if (combined.includes("payment") && (combined.includes("tenant") || combined.includes("lease"))) {
    return "Payment fields appear connected to tenant or lease records.";
  }
  if (combined.includes("property") && combined.includes("manager")) {
    return "Property and manager fields may describe related records.";
  }
  if (combined.includes("lease") && combined.includes("payment")) {
    return "Lease fields may connect to payment records.";
  }
  if (combined.includes("customer") && (combined.includes("order") || combined.includes("transaction"))) {
    return "Customer fields may connect to order or transaction records.";
  }
  if (combined.includes("product") && (combined.includes("order") || combined.includes("transaction") || combined.includes("invoice"))) {
    return "Product fields may connect to order, transaction, or invoice records.";
  }
  if (combined.includes("inventory") && combined.includes("product")) {
    return "Inventory fields may relate to product records.";
  }
  if (combined.includes("invoice") && combined.includes("payment")) {
    return "Invoice fields may connect to payment records.";
  }

  return `${source} may relate to ${target} in this dataset.`;
};

function WorkbookRelationshipSummaryPanel({
  intelligence,
}: {
  intelligence: WorkbookRelationshipIntelligence;
}) {
  const [showAllConnections, setShowAllConnections] = useState(false);
  const visibleRoles = intelligence.entityRoles.slice(0, 5);
  const allConnections = intelligence.joinSuggestions;
  const visibleConnections = showAllConnections ? allConnections : allConnections.slice(0, 2);
  const detectedEntityCount = intelligence.entityRoles.filter(
    (role) => role.role !== "unknown",
  ).length;
  const workbookNarrativeSummary =
    allConnections.length > 0
      ? "Related sources may describe the same records from different angles."
      : intelligence.humanSummary;
  const formatConfidence = (value: string) =>
    value ? `${value.charAt(0).toUpperCase()}${value.slice(1)} confidence` : "Confidence";
  const formatConnectionStrength = (value: string) => {
    if (value === "high") return "Strong";
    if (value === "medium") return "Likely";
    return "Review";
  };

  return (
    <section className="workbook-intelligence-panel" aria-label="Connected sources">
      <div className="workbook-intelligence-heading">
        <div>
          <p className="section-label">Connected sources</p>
          <h3>Sources that may share fields</h3>
          <p>{workbookNarrativeSummary}</p>
        </div>
        <span>{intelligence.complexity}</span>
      </div>
      <div className="workbook-intelligence-strip" aria-label="Source connection summary">
        <span>
          Linked fields
          <strong>{intelligence.joinSuggestions.length.toLocaleString()}</strong>
        </span>
        <span>
          Source areas
          <strong>{detectedEntityCount.toLocaleString()}</strong>
        </span>
        <span>
          Suggested start
          <strong>{intelligence.recommendedStartingWorksheetName || "Current sheet"}</strong>
        </span>
      </div>
      {visibleConnections.length > 0 && (
        <div className="workbook-connection-list" aria-label="Likely source connections">
          {visibleConnections.map((connection) => (
            <article key={connection.id} className={`is-${connection.confidence}`}>
              <span className="workbook-connection-icon" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 15l6-6" />
                  <path d="M11 6l1-1a3.5 3.5 0 0 1 5 5l-1 1" />
                  <path d="M13 18l-1 1a3.5 3.5 0 0 1-5-5l1-1" />
                </svg>
              </span>
              <div className="workbook-connection-copy">
                <p className="workbook-connection-text">{toBusinessConnectionGuidance(connection)}</p>
                <small>
                  {connection.sourceWorksheetName} and {connection.targetWorksheetName}
                </small>
              </div>
              <span
                className={`workbook-connection-confidence is-${connection.confidence}`}
                title={formatConfidence(connection.confidence)}
              >
                {formatConnectionStrength(connection.confidence)}
              </span>
              <span className="workbook-connection-chevron" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m9 6 6 6-6 6" />
                </svg>
              </span>
            </article>
          ))}
        </div>
      )}
      <div className="workbook-intelligence-footer">
        <div className="workbook-entity-list" aria-label="Detected source roles">
          {visibleRoles.map((role) => (
            <span key={role.worksheetId} title={role.reasons.join(" ")}>
              {workbookRoleLabels[role.role]}
              <strong>{role.worksheetName}</strong>
            </span>
          ))}
        </div>
        {allConnections.length > 2 && (
          <button
            type="button"
            className="workbook-view-all"
            onClick={() => setShowAllConnections((current) => !current)}
          >
            {showAllConnections ? "Show fewer" : `Show ${allConnections.length - 2} more`}
          </button>
        )}
      </div>
    </section>
  );
}

function formatRelativeTime(value: string): string {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return "recently";
  const minutes = Math.round((Date.now() - timestamp) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function CountUp({ value }: { value: number }) {
  const [shownValue, setShownValue] = useState(0);

  useEffect(() => {
    let frameId = 0;
    const startTime = performance.now();
    const animate = (now: number) => {
      const progress = Math.min(1, (now - startTime) / 850);
      const eased = 1 - Math.pow(1 - progress, 3);
      setShownValue(Math.round(value * eased));
      if (progress < 1) frameId = requestAnimationFrame(animate);
    };
    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [value]);

  return <>{shownValue.toLocaleString()}</>;
}

function DatasetPreviewPage({
  dataset,
  worksheets,
  initialWorksheetId,
  onBack,
}: {
  dataset: DatasetMetadata;
  worksheets: WorksheetMetadata[];
  initialWorksheetId: string | null;
  onBack: () => void;
}) {
  const hasWorkbook = worksheets.length > 0;
  const [isWrapped, setIsWrapped] = useState(false);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [selectedWorksheetId, setSelectedWorksheetId] = useState<string | null>(
    initialWorksheetId || worksheets[0]?.worksheetId || null,
  );
  const selectedWorksheet = hasWorkbook
    ? worksheets.find((sheet) => sheet.worksheetId === selectedWorksheetId) || worksheets[0]
    : null;
  const previewColumns = selectedWorksheet
    ? selectedWorksheet.schema
    : Array.isArray(dataset.schema)
      ? dataset.schema
      : [];
  const sampleRowCount = previewColumns.reduce(
    (count, column) =>
      Math.max(count, Array.isArray(column.sample_values) ? column.sample_values.length : 0),
    0,
  );
  const visibleRowCount = Math.min(sampleRowCount, 25);
  const previewLabel = selectedWorksheet
    ? selectedWorksheet.displayName || selectedWorksheet.sheetName
    : dataset.original_filename;
  const previewRowTotal = selectedWorksheet ? selectedWorksheet.rowCount : dataset.row_count;

  const formatCell = (value: unknown) => {
    if (value === null || value === undefined || value === "") return "—";
    return String(value);
  };

  const baseColumnWidth = 168;
  const getColumnWidth = (columnName: string) => columnWidths[columnName] ?? baseColumnWidth;
  const totalTableWidth =
    52 + previewColumns.reduce((sum, column) => sum + getColumnWidth(column.name), 0);

  const startColumnResize = (
    event: ReactPointerEvent<HTMLSpanElement>,
    columnName: string,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    handle.classList.add("is-dragging");
    const startX = event.clientX;
    const startWidth = getColumnWidth(columnName);
    const onMove = (moveEvent: PointerEvent) => {
      const nextWidth = startWidth + (moveEvent.clientX - startX);
      setColumnWidths((current) => ({
        ...current,
        [columnName]: Math.min(560, Math.max(72, Math.round(nextWidth))),
      }));
    };
    const onRelease = () => {
      handle.classList.remove("is-dragging");
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onRelease);
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onRelease);
  };

  return (
    <FocusedWorkspaceShell
      className="dataset-preview-page"
      eyebrow="Preview dataset"
      title={previewLabel}
      summary={`${previewRowTotal.toLocaleString()} rows / ${previewColumns.length.toLocaleString()} columns / showing a sample`}
      backLabel="Back to Data"
      onBack={onBack}
      actions={
        <button
          type="button"
          className="secondary-button dataset-preview-wrap-toggle"
          onClick={() => setIsWrapped((current) => !current)}
        >
          {isWrapped ? "Compact cells" : "Expand cells"}
        </button>
      }
    >

      {hasWorkbook && (
        <div className="dataset-preview-sheets" aria-label="Worksheets">
          {worksheets.map((sheet) => (
            <button
              type="button"
              key={sheet.worksheetId}
              className={`dataset-preview-sheet${
                sheet.worksheetId === selectedWorksheet?.worksheetId ? " active" : ""
              }`}
              onClick={() => setSelectedWorksheetId(sheet.worksheetId)}
            >
              {sheet.displayName || sheet.sheetName}
            </button>
          ))}
        </div>
      )}

      <div className="dataset-preview-table-wrap">
        {previewColumns.length === 0 || visibleRowCount === 0 ? (
          <p className="compact-empty">No sample data is available for this worksheet.</p>
        ) : (
          <table
            className={["dataset-preview-table", isWrapped ? "is-wrapped" : ""]
              .filter(Boolean)
              .join(" ")}
            style={{ width: `${totalTableWidth}px`, minWidth: "100%" }}
          >
            <colgroup>
              <col style={{ width: "52px" }} />
              {previewColumns.map((column) => (
                <col key={column.name} style={{ width: `${getColumnWidth(column.name)}px` }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th className="dataset-preview-rownum">#</th>
                {previewColumns.map((column) => (
                  <th key={column.name}>
                    <span className="dataset-preview-cell">{column.name}</span>
                    <small>{column.inferred_type}</small>
                    <span
                      className="dataset-preview-resizer"
                      role="separator"
                      aria-orientation="vertical"
                      aria-label={`Resize ${column.name} column`}
                      onPointerDown={(event) => startColumnResize(event, column.name)}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: visibleRowCount }).map((_, rowIndex) => (
                <tr key={rowIndex}>
                  <td className="dataset-preview-rownum">{rowIndex + 1}</td>
                  {previewColumns.map((column) => {
                    const cellText = formatCell(
                      Array.isArray(column.sample_values)
                        ? column.sample_values[rowIndex]
                        : undefined,
                    );
                    return (
                      <td key={column.name} title={cellText}>
                        <span className="dataset-preview-cell">{cellText}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </FocusedWorkspaceShell>
  );
}

function DatasetSummaryPanel({
  dataset,
  onOpenDataset,
  onDeleteDataset,
  onWorksheetSelect,
  isSwitchingWorksheet,
}: DatasetSummaryPanelProps) {
  const [activeDrillInView, setActiveDrillInView] = useState<DataDrillInView>("overview");
  const [activeWorkflowMenu, setActiveWorkflowMenu] = useState<DataWorkflowMenu | null>(null);
  const [activeFocusedWorkflow, setActiveFocusedWorkflow] = useState<DataFocusedWorkflow | null>(null);
  const [activeOperationalWorkspace, setActiveOperationalWorkspace] =
    useState<FocusedOperationalWorkspace | null>(null);
  const [isDatasetIntelligenceDetailOpen, setIsDatasetIntelligenceDetailOpen] = useState(false);
  const [isDatasetPreviewOpen, setIsDatasetPreviewOpen] = useState(false);
  const [selectedEvidenceTitle, setSelectedEvidenceTitle] = useState<string | null>(null);
  const createSchemaTypeSummary = (metadata: DatasetMetadata) =>
    (Array.isArray(metadata.schema) ? metadata.schema : []).reduce<Record<string, number>>((summary, column) => {
      const type = column.inferred_type || "unknown";
      summary[type] = (summary[type] || 0) + 1;
      return summary;
    }, {});
  const workbookWorksheets = listWorkbookWorksheets(dataset);
  const activeWorksheet = getDatasetActiveWorksheet(dataset);
  const workbookRelationshipIntelligence = buildWorkbookRelationshipIntelligence(dataset?.workbook_metadata);
  const { dataProfile, dialectRecommendation } = useDataIntelligence(dataset);
  const {
    workflowRecommendationReport,
  } = useWorkflowRecommendations({
    dataProfile,
    dialectRecommendation,
  });
  const {
    businessSemanticReport,
    detectedSemanticEntities,
  } = useBusinessSemantics({
    dataset,
    dataProfile,
    workflowRecommendationReport,
  });
  const schemaTypeSummary = dataset ? createSchemaTypeSummary(dataset) : {};
  const detectedColumns = Array.isArray(dataset?.schema) ? dataset.schema : [];
  const displayColumnProfiles = createSchemaDisplayProfiles(detectedColumns);
  const detectedNumericFields = dataProfile?.possibleMetrics || [];
  const detectedCategoryFields = dataProfile?.possibleDimensions || [];
  const detectedDateFields = dataProfile?.dateTimeFields || [];
  const datasetReviewSummary = dataset
    ? `${dataset.column_count.toLocaleString()} columns, ${dataset.row_count.toLocaleString()} rows, and ${Object.keys(
        schemaTypeSummary,
      ).length.toLocaleString()} detected field types.`
    : "Dataset structure is available for review.";
  const measureReviewSummary =
    detectedNumericFields.length > 0
      ? `${detectedNumericFields.length.toLocaleString()} numeric field${
          detectedNumericFields.length === 1 ? "" : "s"
        } may support measurement, ranking, or summaries.`
      : "No clear numeric measure fields were detected yet.";
  const semanticHints = displayColumnProfiles.filter((profile) => profile.role).slice(0, 5);
  const businessEntityHints = displayColumnProfiles
    .filter((profile) => profile.role === "customer" || profile.role === "description" || profile.role === "identifier")
    .slice(0, 3);
  const datasetPurposeLabel =
    semanticHints.some((profile) => profile.role === "customer") &&
    (dataProfile?.possibleMetrics.length || 0) > 0
      ? "This dataset includes entity fields and measurable values."
      : (dataProfile?.possibleMetrics.length || 0) > 0 && (dataProfile?.dateTimeFields.length || 0) > 0
        ? "This dataset includes measurable values over time."
        : (dataProfile?.possibleMetrics.length || 0) > 0
          ? "This dataset includes measurable values."
          : "This dataset has structure available for investigation.";
  const understandingSignals = [
    businessEntityHints[0] ? `Entity field: ${businessEntityHints[0].displayName}` : null,
    dataProfile?.possibleMetrics[0] ? `Possible metric: ${dataProfile.possibleMetrics[0].name}` : null,
    dataProfile?.dateTimeFields[0] ? `Timeline signal: ${dataProfile.dateTimeFields[0].name}` : "Timeline signal needs review",
    dataProfile?.possibleDimensions[0] ? `Possible segment: ${dataProfile.possibleDimensions[0].name}` : null,
  ].filter(Boolean) as string[];
  const workbookActivityLabels = Array.from(
    new Set(
      (workbookRelationshipIntelligence?.entityRoles || [])
        .filter((role) => role.role !== "unknown")
        .map((role) => workbookRoleActivityLabels[role.role]),
    ),
  ).slice(0, 4);
  const businessActivityLabels = Array.from(
    new Set([
      ...(dataProfile?.possibleMetrics.length ? ["measurable fields"] : []),
      ...(dataProfile?.dateTimeFields.length ? ["date/time fields"] : []),
      ...(businessEntityHints.length ? ["entity fields"] : []),
      ...(dataProfile?.possibleDimensions.length ? ["comparison fields"] : []),
      ...workbookActivityLabels,
    ]),
  ).slice(0, 6);
  const businessNarrative =
    businessActivityLabels.length > 0
      ? `Start with ${businessActivityLabels.slice(0, 3).join(", ")}. These cues describe the dataset structure.`
      : "A first read is being prepared so you can choose a useful question sooner.";
  const businessSignals = [
    dataProfile?.possibleMetrics.length
      ? {
          title: "Measurable field",
          detail: `${detectedNumericFields[0].name} may support measurement or ranking.`,
          tone: "opportunity" as HumanSignalTone,
          icon: "opportunity" as HumanSignalIcon,
        }
      : null,
    dataProfile?.dateTimeFields.length
      ? {
          title: "Timeline ready",
          detail: `${detectedDateFields[0].name} can order records over time.`,
          tone: "ready" as HumanSignalTone,
          icon: "timeline" as HumanSignalIcon,
        }
      : {
          title: "Timeline unclear",
          detail: "Time-based review may need a clearer date field.",
          tone: "attention" as HumanSignalTone,
          icon: "warning" as HumanSignalIcon,
        },
    businessEntityHints.length
      ? {
          title: "Entity signal",
          detail: `${businessEntityHints[0].displayName} may show who or what the activity concerns.`,
          tone: "info" as HumanSignalTone,
          icon: "entity" as HumanSignalIcon,
        }
      : null,
    (workbookRelationshipIntelligence?.joinSuggestions.length || 0) > 0
      ? {
          title: "Connected sources",
          detail: "Multiple sheets may describe related records.",
          tone: "connected" as HumanSignalTone,
          icon: "connected" as HumanSignalIcon,
        }
      : null,
    dataProfile?.possibleDimensions.length
      ? {
          title: "Comparison field",
          detail: `${detectedCategoryFields[0].name} may support grouping or comparison.`,
          tone: "opportunity" as HumanSignalTone,
          icon: "comparison" as HumanSignalIcon,
        }
      : null,
  ].filter(Boolean) as Array<{
    title: string;
    detail: string;
    tone: HumanSignalTone;
    icon: HumanSignalIcon;
  }>;
  const investigationNextSteps = [
    dataProfile?.dateTimeFields.length
      ? {
          label: "Review change over time",
          detail: "Look for shifts, seasonality, or timing effects.",
          icon: "trend" as HumanSignalIcon,
        }
      : null,
    dataProfile?.possibleMetrics.length
      ? {
          label: "Review the key measure",
          detail: "Review the strongest measurable field in the dataset.",
          icon: "opportunity" as HumanSignalIcon,
        }
      : null,
    businessEntityHints.length
      ? {
          label: "Review entity fields",
          detail: "Review the record groups or segments detected in the fields.",
          icon: "entity" as HumanSignalIcon,
        }
      : null,
    (workbookRelationshipIntelligence?.joinSuggestions.length || 0) > 0
      ? {
          label: "Review connected sources",
          detail: "See how multiple sheets may describe related records.",
          icon: "connected" as HumanSignalIcon,
        }
      : null,
    dataProfile?.possibleDimensions.length
      ? {
          label: "Compare segments",
          detail: "Review categories, regions, or segments detected in the data.",
          icon: "comparison" as HumanSignalIcon,
        }
      : null,
  ].filter(Boolean) as Array<{
    label: string;
    detail: string;
    icon: HumanSignalIcon;
  }>;
  const selectedEvidence =
    businessSignals.find((signal) => signal.title === selectedEvidenceTitle) ||
    businessSignals[0] ||
    null;
  const closeDrillIn = () => {
    setActiveDrillInView("overview");
    setActiveFocusedWorkflow(null);
  };
  const dataTabs = [
    { id: "overview", label: "Overview" },
    { id: "columns", label: "Fields" },
    { id: "worksheets", label: "Sources" },
  ] satisfies Array<{ id: DataDrillInView; label: string }>;
  const datasetIntelligencePreview = createDatasetIntelligencePreviewViewModel({
    sourceDescriptorVersion: "dataset-summary-panel-v1",
    generatedAt: "deterministic-dataset-preview",
    datasetLabel: dataset?.original_filename || "Dataset",
    rowCount: dataset?.row_count || 0,
    columnCount: dataset?.column_count || 0,
    detectedDataShapeSummary: `${Object.keys(schemaTypeSummary).length.toLocaleString()} field types`,
    opportunityPreview:
      detectedNumericFields[0]?.name ||
      semanticHints[0]?.displayName ||
      "Review the detected data profile.",
    whyItMattersPreview: "Column labels and workbook structure are cleaned up for review.",
    readinessLabel: dataProfile ? dataProfile.shape.shapeLabel.replace(/_/g, " ") : "Profile",
  });
  const navigationContext = emptyNavigationContextPreservation("human");
  const workbookContextLabel = dataset?.workbook_metadata
    ? activeWorksheet?.displayName || activeWorksheet?.sheetName || dataset.workbook_metadata.name
    : "Dataset table";
  const datasetIntelligenceOrigin = createNavigationOriginDescriptor({
    preservationId: "preserve:dataset-intelligence-detail",
    scope: "inline-preview-to-detail",
    originSurfaceId: "dataset-summary-panel",
    sourceRoute: {
      routeId: "page:dataset",
      routeKind: "page",
      depth: 2,
    },
    targetRoute: {
      routeId: "detail:dataset-intelligence",
      routeKind: "detail",
      depth: 3,
    },
    mode: "human",
    context: {
      ...navigationContext,
      dataset: {
        datasetId: dataset?.dataset_id || null,
        datasetName: dataset?.original_filename || null,
      },
      workbook: {
        workbookId: dataset?.workbook_metadata?.workbookId || null,
        workbookName: dataset?.workbook_metadata?.name || null,
        worksheetId: activeWorksheet?.worksheetId || null,
        worksheetName: activeWorksheet?.displayName || activeWorksheet?.sheetName || null,
      },
    },
  });
  const datasetIntelligenceBackState = createNavigationBackStateDescriptor({
    preservationId: "preserve:dataset-intelligence-detail",
    origin: datasetIntelligenceOrigin,
    filterState: {
      activeFilterLabels: [],
      filterCount: 0,
    },
    paginationState: {
      page: null,
      totalPages: null,
      rowsPerPage: null,
    },
    expandedPanelState: {
      expandedPanelIds: isDatasetIntelligenceDetailOpen
        ? ["dataset-intelligence-detail"]
        : [`dataset-drill-in:${activeDrillInView}`],
      collapsedPanelIds: [],
    },
    selectedItem: {
      selectedItemId: dataset?.dataset_id || null,
      selectedItemLabel: dataset?.original_filename || null,
      selectedItemType: "dataset",
    },
  });
  const closeDatasetIntelligenceDetail = () => {
    closeControlledHashDetailRoute(datasetIntelligenceDetailRouteId);
    setIsDatasetIntelligenceDetailOpen(false);
  };
  const openFocusedWorkflow = (workflow: DataFocusedWorkflow) => {
    setIsDatasetPreviewOpen(false);
    setIsDatasetIntelligenceDetailOpen(false);
    setActiveOperationalWorkspace(null);
    setActiveWorkflowMenu(null);
    setActiveFocusedWorkflow(workflow);
    setActiveDrillInView(
      workflow === "dataIntelligence" || workflow === "guidedAnalyticsTasks"
        ? "dataIntelligence"
        : "businessSemantics",
    );
  };
  const openOperationalWorkspace = (workspace: FocusedOperationalWorkspace) => {
    setIsDatasetPreviewOpen(false);
    setIsDatasetIntelligenceDetailOpen(false);
    setActiveFocusedWorkflow(null);
    setActiveWorkflowMenu(null);
    setActiveOperationalWorkspace(workspace);
    setActiveDrillInView("overview");
  };
  const closeOperationalWorkspace = () => {
    setActiveOperationalWorkspace(null);
    setActiveDrillInView("overview");
  };
  const getWorkspaceForStep = (step: (typeof investigationNextSteps)[number]) => {
    if (step.icon === "trend") return "trends";
    if (step.icon === "connected") return "connections";
    if (step.icon === "entity" || step.icon === "comparison") return "entities";
    return "kpis";
  };
  const selectedEvidenceWorkspace: FocusedOperationalWorkspace =
    selectedEvidence?.icon === "timeline"
      ? "trends"
      : selectedEvidence?.icon === "connected"
        ? "connections"
        : selectedEvidence?.icon === "entity" || selectedEvidence?.icon === "comparison"
          ? "entities"
          : "kpis";

  useEffect(() => {
    return subscribeControlledHashDetailRoute(datasetIntelligenceDetailRouteId, (event) => {
      setIsDatasetIntelligenceDetailOpen(event.active);
    });
  }, []);

  useEffect(() => {
    if (!activeWorkflowMenu) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveWorkflowMenu(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeWorkflowMenu]);

  useEffect(() => {
    const handleDataWorkspaceCommand = (event: Event) => {
      if (!dataset) return;

      const commandEvent = event as CustomEvent<{ target?: DataWorkspaceCommandTarget }>;
      const target = commandEvent.detail?.target;

      if (target === "preview" || target === "worksheetPreview") {
        setActiveFocusedWorkflow(null);
        setIsDatasetPreviewOpen(true);
        return;
      }

      if (target === "connections") {
        setIsDatasetPreviewOpen(false);
        setIsDatasetIntelligenceDetailOpen(false);
        setActiveFocusedWorkflow(null);
        setActiveOperationalWorkspace("connections");
        setActiveDrillInView("overview");
        return;
      }

      if (target === "intelligenceDetail") {
        setIsDatasetPreviewOpen(false);
        setActiveFocusedWorkflow(null);
        setIsDatasetIntelligenceDetailOpen(true);
        return;
      }

      if (target === "intelligence") {
        openFocusedWorkflow("dataIntelligence");
        return;
      }

      if (target === "semantics") {
        openFocusedWorkflow("businessSemantics");
      }
    };

    window.addEventListener("filtraqueri:data-workspace-command", handleDataWorkspaceCommand);
    return () =>
      window.removeEventListener("filtraqueri:data-workspace-command", handleDataWorkspaceCommand);
  }, [dataset]);

  if (dataset && isDatasetPreviewOpen) {
    return (
      <DatasetPreviewPage
        dataset={dataset}
        worksheets={workbookWorksheets}
        initialWorksheetId={activeWorksheet?.worksheetId || null}
        onBack={() => setIsDatasetPreviewOpen(false)}
      />
    );
  }

  if (dataset && isDatasetIntelligenceDetailOpen) {
    return (
      <DatasetIntelligenceDetailPage
        datasetIntelligencePreview={datasetIntelligencePreview}
        sourceContext={`${dataset.original_filename} / ${workbookContextLabel}`}
        workbookContextLabel={workbookContextLabel}
        fieldTypeLabel={`${Object.keys(schemaTypeSummary).length.toLocaleString()} field types`}
        preservedContextLabel={datasetIntelligenceBackState.preservationId}
        onBack={closeDatasetIntelligenceDetail}
      />
    );
  }

  if (dataset && activeOperationalWorkspace) {
    const workspaceTitle =
      activeOperationalWorkspace === "connections"
        ? "Connected sources"
        : activeOperationalWorkspace === "entities"
          ? "Possible segments"
          : activeOperationalWorkspace === "kpis"
            ? "Possible measures"
            : "Date/time fields";
    const workspaceSummary =
      activeOperationalWorkspace === "connections"
        ? "Review source relationships and related worksheet fields."
        : activeOperationalWorkspace === "entities"
          ? "Review entity and segment fields detected in the dataset."
          : activeOperationalWorkspace === "kpis"
            ? "Review measurable fields detected in the dataset."
            : "Review timeline fields and date signals found in the dataset.";

    return (
      <FocusedWorkspaceShell
        eyebrow="Data detail"
        title={workspaceTitle}
        summary={workspaceSummary}
        onBack={closeOperationalWorkspace}
      >
        <div className="focused-operational-workspace">
          <InvestigationThread>
            <WorkspaceHeader
              eyebrow="Dataset detail"
              title={workspaceTitle}
              meta={activeWorksheet?.displayName || activeWorksheet?.sheetName || "Dataset table"}
            />
            <EvidenceRows>
              <div className="thread-section-heading">
                <p className="section-label">Available signals</p>
                <strong>Detected fields and source context.</strong>
              </div>
              {activeOperationalWorkspace === "connections" &&
                (workbookRelationshipIntelligence?.joinSuggestions.slice(0, 5).map((connection) => (
                  <EvidenceRow
                    key={connection.id}
                    tone="connected"
                    icon={<HumanSignalIcon name="connected" />}
                    title={toBusinessConnectionGuidance(connection)}
                    description={`${connection.sourceWorksheetName} and ${connection.targetWorksheetName}`}
                  />
                )) || (
                  <EvidenceRow
                    tone="info"
                    icon={<HumanSignalIcon name="info" />}
                    title="No connected sources detected yet"
                    description="Upload a workbook with multiple related sheets to review source relationships."
                  />
                ))}
              {activeOperationalWorkspace === "entities" &&
                (businessEntityHints.length > 0 || dataProfile?.possibleDimensions.length ? (
                  [...businessEntityHints.map((profile) => profile.displayName), ...(dataProfile?.possibleDimensions || []).map((field) => field.name)]
                    .slice(0, 6)
                    .map((label) => (
                      <EvidenceRow
                        key={label}
                        tone="info"
                        icon={<HumanSignalIcon name="entity" />}
                        title={label}
                        description="Potential entity, segment, or comparison field."
                      />
                    ))
                ) : (
                  <EvidenceRow
                    tone="attention"
                    icon={<HumanSignalIcon name="warning" />}
                    title="Segment signal needs review"
                    description="No strong entity or segment field is available yet."
                  />
                ))}
              {activeOperationalWorkspace === "kpis" &&
                (detectedNumericFields.length ? (
                  detectedNumericFields
                    .map((field) => field.name)
                    .slice(0, 6)
                    .map((label) => (
                      <EvidenceRow
                        key={label}
                        tone="opportunity"
                        icon={<HumanSignalIcon name="opportunity" />}
                        title={label}
                        description="Possible measurable field for dataset review."
                      />
                    ))
                ) : (
                  <EvidenceRow
                    tone="attention"
                    icon={<HumanSignalIcon name="warning" />}
                    title="Metric signal needs review"
                    description="A stronger measurable field is needed for measure review."
                  />
                ))}
              {activeOperationalWorkspace === "trends" &&
                (dataProfile?.dateTimeFields.length ? (
                  dataProfile.dateTimeFields.slice(0, 6).map((field) => (
                    <EvidenceRow
                      key={field.name}
                      tone="ready"
                      icon={<HumanSignalIcon name="timeline" />}
                      title={field.name}
                      description="Timeline candidate for reviewing change over time."
                    />
                  ))
                ) : (
                  <EvidenceRow
                    tone="attention"
                    icon={<HumanSignalIcon name="warning" />}
                    title="Timeline signal needs review"
                    description="Time review needs a clearer date or time field."
                  />
                ))}
            </EvidenceRows>
          </InvestigationThread>
          <ContextRail>
            <ContextRailHeader
              eyebrow="Context"
              title="Data detail"
              description="This focused surface keeps detailed dataset review out of the main Data page."
            />
            <InlineDisclosure summary="Advanced context" className="context-disclosure">
              <p>
                This detail view uses existing profile and workbook metadata. No execution or SQL is triggered here.
              </p>
            </InlineDisclosure>
          </ContextRail>
        </div>
      </FocusedWorkspaceShell>
    );
  }

  return (
    <div className="human-dataset-workspace">
      {!activeFocusedWorkflow && (
      <section className="dataset-hub-panel" aria-label="Dataset management hub">
        <div className="data-page-head">
          <div>
            <p className="section-label">Data</p>
            <h2>Data</h2>
            <p>Understand what this data may represent and where it may be useful.</p>
          </div>
          {dataset && (
            <div className="data-page-head-actions">
              <span className="data-updated">Last updated: {formatRelativeTime(dataset.uploaded_at)}</span>
              <button
                type="button"
                className="secondary-button"
                onClick={() => window.location.reload()}
              >
                Refresh
              </button>
            </div>
          )}
        </div>

        {dataset ? (
            <div className="data-profile-surface">
            <OperationalWorkspaceLayout>
              <InvestigationThread>
                <WorkspaceHeader
                  eyebrow="Dataset"
                  title={<span title={dataset.original_filename}>{dataset.original_filename}</span>}
                  meta={activeWorksheet?.displayName || activeWorksheet?.sheetName || "Dataset table"}
                />

                <InvestigationThreadStage ariaLabel="Understand" className="is-understand">
                  <p className="section-label">Understand</p>
                  <h3>{datasetPurposeLabel}</h3>
                  <p>Early read of the structure behind the data.</p>
                  <div className="evidence-chip-row" aria-label="Initial evidence">
                    {understandingSignals.map((signal) => (
                      <OperationalTag key={signal}>{signal}</OperationalTag>
                    ))}
                  </div>
                </InvestigationThreadStage>

                <EvidenceRows>
                  <div className="thread-section-heading">
                    <p className="section-label">Evidence</p>
                    <strong>{businessNarrative}</strong>
                  </div>
                  {businessSignals.slice(0, 3).map((signal, index) => (
                    <EvidenceRow
                      key={signal.title}
                      tone={signal.tone}
                      selected={selectedEvidence?.title === signal.title}
                      primary={index === 0}
                      icon={<HumanSignalIcon name={signal.icon} />}
                      title={signal.title}
                      description={signal.detail}
                      onClick={() => setSelectedEvidenceTitle(signal.title)}
                    />
                  ))}
                </EvidenceRows>

                <InlineDisclosure summary="Suggested next steps">
                  <OperationalList>
                    {investigationNextSteps.slice(0, 3).map((step, index) => (
                      <button
                        type="button"
                        key={step.label}
                        className={index === 0 ? "is-recommended" : undefined}
                        onClick={() => {
                          openOperationalWorkspace(getWorkspaceForStep(step));
                        }}
                      >
                        {step.label}
                      </button>
                    ))}
                  </OperationalList>
                </InlineDisclosure>

                <MetadataFooter>
                  <span>
                    Rows
                    <strong><CountUp value={dataset.row_count} /></strong>
                  </span>
                  <span>
                    Columns
                    <strong><CountUp value={dataset.column_count} /></strong>
                  </span>
                  <span>
                    Sources
                    <strong><CountUp value={workbookWorksheets.length} /></strong>
                  </span>
                  <span>
                    Field mix
                    <strong><CountUp value={Object.keys(schemaTypeSummary).length} /></strong>
                  </span>
                </MetadataFooter>
              </InvestigationThread>

              <ContextRail>
                <ContextRailHeader
                  eyebrow="Context"
                  title={selectedEvidence?.title || "Evidence"}
                  description={selectedEvidence?.detail || "Select an evidence row to see why it matters."}
                />
                <ContextRailSection title="Dataset meaning">
                  <p>
                    {selectedEvidence
                      ? "This signal helps explain what the dataset appears to contain."
                      : "These signals summarize the dataset before deeper work begins."}
                  </p>
                  <div className="context-rail-actions">
                    <button type="button" onClick={() => openOperationalWorkspace(selectedEvidenceWorkspace)}>
                      Review detail
                    </button>
                  </div>
                </ContextRailSection>
                <InlineDisclosure summary="Advanced context" className="context-disclosure">
                  <p>
                    Field names, worksheet links, and profile metadata remain available without leading the Human Mode flow.
                  </p>
                </InlineDisclosure>
                {activeDrillInView === "overview" && workbookRelationshipIntelligence && (
                  <InlineDisclosure summary="Connected source detail" className="context-disclosure">
                    <WorkbookRelationshipSummaryPanel intelligence={workbookRelationshipIntelligence} />
                  </InlineDisclosure>
                )}
              </ContextRail>
            </OperationalWorkspaceLayout>
            <div className="data-tabs-row">
              <WorkspaceTabs
                items={dataTabs}
                activeItem={activeDrillInView}
                label="Data views"
                onChange={(view) => {
                  setActiveFocusedWorkflow(null);
                  setActiveDrillInView(view);
                }}
              />
              <div className="data-profile-actions">
                <div className="data-workflow-menu-wrap">
                  <button
                    type="button"
                    className="secondary-button data-action-btn data-workflow-trigger"
                    aria-haspopup="menu"
                    aria-expanded={activeWorkflowMenu === "intelligence"}
                    onClick={() =>
                      setActiveWorkflowMenu((current) =>
                        current === "intelligence" ? null : "intelligence",
                      )
                    }
                  >
                    Explore
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>
                  {activeWorkflowMenu === "intelligence" && (
                    <div className="data-workflow-menu" role="menu" aria-label="Dataset follow-up options">
                      <button type="button" role="menuitem" onClick={() => openFocusedWorkflow("dataIntelligence")}>
                        <strong>What the data suggests</strong>
                        <span>Review dataset signals and useful fields.</span>
                      </button>
                      <button type="button" role="menuitem" onClick={() => openFocusedWorkflow("guidedAnalyticsTasks")}>
                        <strong>Investigation readiness</strong>
                        <span>See how this dataset can be used outside Data.</span>
                      </button>
                    </div>
                  )}
                </div>
                <div className="data-workflow-menu-wrap">
                  <button
                    type="button"
                    className="secondary-button data-action-btn data-workflow-trigger"
                    aria-haspopup="menu"
                    aria-expanded={activeWorkflowMenu === "semantic"}
                    onClick={() =>
                      setActiveWorkflowMenu((current) =>
                        current === "semantic" ? null : "semantic",
                      )
                    }
                  >
                    Details
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>
                  {activeWorkflowMenu === "semantic" && (
                    <div className="data-workflow-menu" role="menu" aria-label="Dataset details">
                      <button type="button" role="menuitem" onClick={() => openFocusedWorkflow("businessSemantics")}>
                        <strong>Dataset meaning</strong>
                        <span>Review what these fields may represent.</span>
                      </button>
                      <button type="button" role="menuitem" onClick={() => openFocusedWorkflow("kpiIntelligence")}>
                        <strong>Possible measures</strong>
                        <span>Review measurable fields found in the data.</span>
                      </button>
                      <button type="button" role="menuitem" onClick={() => openFocusedWorkflow("humanGuidance")}>
                        <strong>Exploration guidance</strong>
                        <span>See where question asking and SQL belong.</span>
                      </button>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className="secondary-button data-action-btn"
                  onClick={() => setIsDatasetPreviewOpen(true)}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  Preview dataset
                </button>
                <button
                  type="button"
                  className="text-button danger-text-button data-action-btn"
                  onClick={() => onDeleteDataset(dataset.dataset_id)}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
                  </svg>
                  Delete dataset
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="dataset-empty-guidance">
            <p>No dataset open. Choose a CSV or Excel workbook to review its structure.</p>
            <button type="button" className="primary-button" onClick={onOpenDataset}>
              Choose file
            </button>
          </div>
        )}
      </section>
      )}

      {dataset && activeDrillInView === "columns" && (
        <DrillInDetailPanel
          eyebrow="Data detail"
          title="Detected columns"
          summary="Column details are shown here so the main Data page stays compact."
          onBack={closeDrillIn}
        >
          <section className="detected-columns-section" aria-label="Detected columns">
            <div className="worksheet-selector-header">
              <div>
                <p className="section-label">Detected columns</p>
                <h4>Column profile</h4>
              </div>
              <span className="dataset-count-pill">{detectedColumns.length.toLocaleString()}</span>
            </div>
            <div className="detected-column-list">
              {detectedColumns.map((column) => {
                const displayProfile =
                  displayColumnProfiles.find((profile) => profile.sourceName === column.name) ||
                  null;

                return (
                <span key={column.name} title={displayProfile?.displayName !== column.name ? column.name : undefined}>
                  <strong>{displayProfile?.displayName || column.name}</strong>
                  <small>
                    {displayProfile?.role
                      ? getBusinessRoleLabel(displayProfile.role)
                      : column.inferred_type || "unknown"}
                  </small>
                  {displayProfile && displayProfile.displayName !== column.name && (
                    <em>Source: {column.name}</em>
                  )}
                </span>
                );
              })}
            </div>
          </section>
        </DrillInDetailPanel>
      )}

      {dataset && activeDrillInView === "worksheets" && (
        <DrillInDetailPanel
          eyebrow="Data detail"
          title="Available sources"
          summary="Switch worksheets without leaving the Data tab."
          onBack={closeDrillIn}
        >
          <WorksheetSelector
            worksheets={workbookWorksheets}
            activeWorksheetId={activeWorksheet?.worksheetId || null}
            isSwitchingWorksheet={isSwitchingWorksheet}
            onWorksheetSelect={onWorksheetSelect}
          />
        </DrillInDetailPanel>
      )}

      {dataset && dataProfile && activeFocusedWorkflow === "dataIntelligence" && (
        <DrillInDetailPanel
          eyebrow="Dataset detail"
          title="What the data suggests"
          summary={datasetReviewSummary}
          onBack={closeDrillIn}
          backLabel="Back to Data"
        >
        <section className="data-intelligence-panel" aria-label="Dataset understanding">
          <div className="summary-header">
            <div>
              <p className="section-label">Dataset understanding</p>
              <h2>Dataset signals available in this file</h2>
              <p>{datasetReviewSummary}</p>
            </div>
            <span className="dataset-count-pill">
              {dialectRecommendation?.recommendedFutureEngine?.label || "Suggested only"}
            </span>
          </div>
          <div className="data-intelligence-grid">
            <span>
              Dataset shape
              <strong>{dataProfile.shape.shapeLabel.replace(/_/g, " ")}</strong>
            </span>
            <span>
              Possible metrics
              <strong>{dataProfile.possibleMetrics.length}</strong>
            </span>
            <span>
              Possible segments
              <strong>{dataProfile.possibleDimensions.length}</strong>
            </span>
            <span>
              Timeline fields
              <strong>{dataProfile.dateTimeFields.length}</strong>
            </span>
            <span>
              Trend potential
              <strong>{dataProfile.timeSeriesReadiness.ready ? "Possible" : "Needs fields"}</strong>
            </span>
            <span>
              Comparison potential
              <strong>{dataProfile.statisticalReadiness.ready ? "Possible" : "Needs metrics"}</strong>
            </span>
          </div>
        </section>
        </DrillInDetailPanel>
      )}

      {dataset && activeFocusedWorkflow === "businessSemantics" && (
        <DrillInDetailPanel
          eyebrow="Dataset detail"
          title="Dataset meaning"
          summary="Dataset context is derived from detected field names and profile metadata."
          onBack={closeDrillIn}
          backLabel="Back to Data"
        >
        {businessSemanticReport && (
        <section className="business-semantics-panel" aria-label="Dataset meaning">
          <div className="summary-header">
            <div>
              <p className="section-label">Dataset meaning</p>
              <h2>Detected field context</h2>
              <p>Detected labels below are based on field names and profile metadata.</p>
            </div>
            <span className="dataset-count-pill">{detectedSemanticEntities.length}</span>
          </div>
          <div className="business-semantics-grid">
            {detectedSemanticEntities.slice(0, 6).map((entity) => (
              <article className="business-semantic-card" key={entity.id}>
                <strong>{entity.label}</strong>
                <span>{entity.confidence} confidence</span>
                <p>{entity.supportingMetadataSignals[0]?.description || "Detected from the data profile."}</p>
              </article>
            ))}
          </div>
          {detectedNumericFields.length > 0 && (
            <div className="business-kpi-list">
              <span>Possible measures</span>
              {detectedNumericFields.slice(0, 5).map((field) => (
                <small key={field.name}>{field.name}</small>
              ))}
            </div>
          )}
        </section>
        )}
        {!businessSemanticReport && (
          <p className="compact-empty">No dataset context is available for this dataset yet.</p>
        )}
        </DrillInDetailPanel>
      )}

      {dataset && activeFocusedWorkflow === "kpiIntelligence" && (
        <DrillInDetailPanel
          eyebrow="Dataset detail"
          title="Possible measures"
          summary={measureReviewSummary}
          onBack={closeDrillIn}
          backLabel="Back to Data"
        >
        <section className="kpi-intelligence-panel" aria-label="Possible measures">
          <div className="summary-header">
            <div>
              <p className="section-label">Possible measures</p>
              <h2>Measure fields found in the data</h2>
              <p>{measureReviewSummary}</p>
            </div>
            <span className="dataset-count-pill">{detectedNumericFields.length}</span>
          </div>
          <div className="kpi-opportunity-list">
            {detectedNumericFields.slice(0, 4).map((field) => (
              <article className="kpi-opportunity-card" key={field.name}>
                <strong>{field.name}</strong>
                <p>This field may support measurement, ranking, or numeric summaries.</p>
                <div>
                  <small>{field.inferredType}</small>
                  <small>{field.confidence} confidence</small>
                </div>
              </article>
            ))}
          </div>
          {detectedNumericFields.length === 0 && (
            <p className="compact-empty">No measure fields are available for this dataset yet.</p>
          )}
        </section>
        </DrillInDetailPanel>
      )}

      {dataset && activeFocusedWorkflow === "guidedAnalyticsTasks" && (
        <DrillInDetailPanel
          eyebrow="Data context"
          title="Ready for investigation"
          summary="This dataset context is available in Investigate or Analyst Mode."
          onBack={closeDrillIn}
          backLabel="Back to Data"
        >
        <section className="human-guidance-panel" aria-label="Dataset investigation readiness">
          <div>
            <p className="section-label">Dataset context</p>
            <h2>Ready for investigation</h2>
            <p>
              The dataset profile is available in Investigate for business questions, or in Analyst Mode for SQL.
            </p>
          </div>
        </section>
        </DrillInDetailPanel>
      )}

      {dataset && activeFocusedWorkflow === "humanGuidance" && (
        <DrillInDetailPanel
          eyebrow="Data context"
          title="Ready for exploration"
          summary="This dataset is ready for exploration. Use Investigate to ask business questions, or Analyst Mode for SQL."
          onBack={closeDrillIn}
          backLabel="Back to Data"
        >
        <section className="human-guidance-panel" aria-label="Human mode data guidance">
          <div>
            <p className="section-label">Data context</p>
            <h2>Ready for exploration</h2>
            <p>
              This dataset is ready for exploration. Use Investigate to ask business questions, or Analyst Mode for SQL.
            </p>
          </div>
        </section>
        </DrillInDetailPanel>
      )}
    </div>
  );
}

export default DatasetSummaryPanel;
