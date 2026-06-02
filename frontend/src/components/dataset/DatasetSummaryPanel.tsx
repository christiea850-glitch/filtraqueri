import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import type { DatasetMetadata, DatasetSession } from "../../features/dataset/datasetTypes";
import {
  getOriginalWorkbookLayout,
  getPreview,
  type OriginalWorkbookCellStyle,
  type OriginalWorkbookLayout,
} from "../../services/api";
import ColumnDistributionCard from "./ColumnDistributionCard";
import MissingValuesOverview from "./MissingValuesOverview";
import { useDataIntelligence } from "../../features/dataIntelligence";
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
  WORKBOOK_HEADER_WARNING_COPY,
  getStructuralColumnNotice,
  getDatasetActiveWorksheet,
  hasSuspiciousWorkbookHeaders,
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
  EvidenceRow,
  EvidenceRows,
  InlineDisclosure,
  InvestigationThread,
  InvestigationThreadStage,
  MetadataFooter,
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
type DataWorkflowMenu = "details";
type DataFocusedWorkflow =
  | "dataIntelligence"
  | "businessSemantics"
  | "kpiIntelligence";
type FocusedOperationalWorkspace = "connections" | "entities" | "kpis" | "trends";
type DataWorkspaceCommandTarget =
  | "overview"
  | "missingValues"
  | "columns"
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

type PreviewMode = "analysis" | "original";

const getOriginalBorderStyle = (side: OriginalWorkbookCellStyle["border"]["top"]) => {
  if (!side.style) return undefined;

  const width = side.style === "medium" ? "2px" : side.style === "thick" ? "3px" : "1px";
  const style = side.style.includes("dash") ? "dashed" : side.style === "dotted" ? "dotted" : "solid";
  return `${width} ${style} ${side.color || "#cbd5e1"}`;
};

const getOriginalCellStyle = (cellStyle?: OriginalWorkbookCellStyle): CSSProperties => {
  if (!cellStyle) return {};

  return {
    backgroundColor: cellStyle.fill_color || undefined,
    color: cellStyle.font.color || undefined,
    fontSize: cellStyle.font.size ? `${cellStyle.font.size}px` : undefined,
    fontStyle: cellStyle.font.italic ? "italic" : undefined,
    fontWeight: cellStyle.font.bold ? 700 : undefined,
    textAlign: (cellStyle.alignment.horizontal as CSSProperties["textAlign"]) || undefined,
    verticalAlign: (cellStyle.alignment.vertical as CSSProperties["verticalAlign"]) || undefined,
    whiteSpace: cellStyle.alignment.wrap_text ? "normal" : undefined,
    borderTop: getOriginalBorderStyle(cellStyle.border.top),
    borderRight: getOriginalBorderStyle(cellStyle.border.right),
    borderBottom: getOriginalBorderStyle(cellStyle.border.bottom),
    borderLeft: getOriginalBorderStyle(cellStyle.border.left),
  };
};

function OriginalWorkbookPreview({
  datasetId,
  worksheet,
}: {
  datasetId: string;
  worksheet: WorksheetMetadata | null;
}) {
  const [layout, setLayout] = useState<OriginalWorkbookLayout | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!worksheet || (worksheet.status !== "ready" && worksheet.status !== "empty")) return undefined;

    const requestTimeout = window.setTimeout(() => {
      setStatus("loading");
      setError(null);
      setLayout(null);

      getOriginalWorkbookLayout(datasetId, worksheet.worksheetId)
        .then((response) => {
          if (cancelled) return;
          setLayout(response);
          setStatus("success");
        })
        .catch((requestError) => {
          if (cancelled) return;
          setLayout(null);
          setError(
            requestError instanceof Error && requestError.message
              ? requestError.message
              : "Original workbook layout could not be loaded.",
          );
          setStatus("error");
        });
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(requestTimeout);
    };
  }, [datasetId, worksheet]);

  if (!worksheet) {
    return <p className="compact-empty">No worksheet is available for original workbook view.</p>;
  }
  if (worksheet.status !== "ready" && worksheet.status !== "empty") {
    return <p className="compact-empty">This worksheet is not available for original workbook view.</p>;
  }
  if (status === "loading" || status === "idle") {
    return <p className="compact-empty">Loading original workbook layout...</p>;
  }
  if (status === "error" || !layout) {
    return <p className="compact-empty">{error || "Original workbook layout is unavailable."}</p>;
  }
  if (layout.is_empty) {
    return <p className="compact-empty">This worksheet is empty in the original workbook.</p>;
  }

  const cells = new Map(layout.cells.map((cell) => [`${cell.row}:${cell.column}`, cell]));
  const mergeAnchors = new Map(
    layout.merged_ranges.map((range) => [`${range.start_row}:${range.start_column}`, range]),
  );
  const coveredCells = new Set<string>();
  layout.merged_ranges.forEach((range) => {
    for (let row = range.start_row; row <= range.end_row; row += 1) {
      for (let column = range.start_column; column <= range.end_column; column += 1) {
        if (row !== range.start_row || column !== range.start_column) {
          coveredCells.add(`${row}:${column}`);
        }
      }
    }
  });

  return (
    <section className="original-workbook-reference" aria-label="Original workbook reference view">
      <div className="original-workbook-reference-note">
        <strong>Read-only reference view</strong>
        <span>
          Close representation of the uploaded XLSX layout. Analysis tables remain unchanged.
        </span>
        {layout.is_bounded && <small>Showing a bounded worksheet region.</small>}
      </div>
      <div className="original-workbook-grid-wrap">
        <table className="original-workbook-grid">
          <colgroup>
            <col className="original-workbook-row-heading-column" />
            {layout.columns.map((column) => (
              <col
                key={column.index}
                className={column.hidden ? "is-hidden-dimension" : undefined}
                style={{ width: `${Math.max(36, Math.round((column.width || 8.43) * 7 + 5))}px` }}
              />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className="original-workbook-corner" />
              {layout.columns.map((column) => (
                <th
                  key={column.index}
                  className={column.hidden ? "is-hidden-dimension" : undefined}
                  title={column.hidden ? `Column ${column.letter} is hidden in the workbook` : undefined}
                >
                  {column.letter}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {layout.rows.map((row) => (
              <tr
                key={row.index}
                className={row.hidden ? "is-hidden-dimension" : undefined}
                style={{ height: row.height ? `${Math.round(row.height * 1.333)}px` : undefined }}
              >
                <th title={row.hidden ? `Row ${row.index} is hidden in the workbook` : undefined}>
                  {row.index}
                </th>
                {layout.columns.map((column) => {
                  const key = `${row.index}:${column.index}`;
                  if (coveredCells.has(key)) return null;

                  const cell = cells.get(key);
                  const merge = mergeAnchors.get(key);
                  return (
                    <td
                      key={column.index}
                      colSpan={merge ? merge.end_column - merge.start_column + 1 : undefined}
                      rowSpan={merge ? merge.end_row - merge.start_row + 1 : undefined}
                      style={getOriginalCellStyle(cell?.style)}
                      title={cell?.is_formula ? `${cell.coordinate}: formula shown without execution` : cell?.coordinate}
                    >
                      {cell?.display_value || ""}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
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
  const supportsOriginalWorkbook = dataset.original_filename.toLowerCase().endsWith(".xlsx");
  const firstReadyWorksheet = worksheets.find((sheet) => sheet.status === "ready") || null;
  const initialWorksheet = worksheets.find(
    (sheet) => sheet.worksheetId === initialWorksheetId && sheet.status === "ready",
  );
  const [isWrapped, setIsWrapped] = useState(false);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("analysis");
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [selectedWorksheetId, setSelectedWorksheetId] = useState<string | null>(
    initialWorksheet?.worksheetId || firstReadyWorksheet?.worksheetId || null,
  );
  const [previewRows, setPreviewRows] = useState<Record<string, unknown>[]>([]);
  const [previewStatus, setPreviewStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const selectedWorksheet = hasWorkbook
    ? worksheets.find((sheet) => sheet.worksheetId === selectedWorksheetId) || firstReadyWorksheet
    : null;
  const activeAnalysisSource = dataset.workbook_metadata?.activeAnalysisSource;
  const isViewingCleanedAnalysisSource =
    activeAnalysisSource?.type === "cleaned_working_copy" &&
    activeAnalysisSource.worksheetId === selectedWorksheet?.worksheetId;
  const previewColumns = isViewingCleanedAnalysisSource
    ? dataset.schema
    : selectedWorksheet
    ? selectedWorksheet.schema
    : Array.isArray(dataset.schema)
      ? dataset.schema
      : [];
  const previewWorksheetId =
    !isViewingCleanedAnalysisSource && selectedWorksheet?.status === "ready"
      ? selectedWorksheet.worksheetId
      : undefined;
  const visibleRowCount = previewRows.length;

  useEffect(() => {
    let cancelled = false;
    if (hasWorkbook && !previewWorksheetId && !isViewingCleanedAnalysisSource) return undefined;

    const requestTimeout = window.setTimeout(() => {
      setPreviewStatus("loading");
      setPreviewError(null);

      getPreview(dataset.dataset_id, {
        limit: 25,
        page: 1,
        worksheet_id: previewWorksheetId,
      })
        .then((response) => {
          if (cancelled) return;
          const responseRows = Array.isArray(response?.rows) ? response.rows : [];
          setPreviewRows(responseRows as Record<string, unknown>[]);
          setPreviewStatus("success");
        })
        .catch((error) => {
          if (cancelled) return;
          setPreviewRows([]);
          setPreviewError(
            error instanceof Error && error.message
              ? error.message
              : "Preview unavailable. Try Refresh.",
          );
          setPreviewStatus("error");
        });
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(requestTimeout);
    };
  }, [dataset.dataset_id, hasWorkbook, isViewingCleanedAnalysisSource, previewWorksheetId]);
  const previewLabel = selectedWorksheet
    ? selectedWorksheet.displayName || selectedWorksheet.sheetName
    : dataset.original_filename;
  const previewRowTotal = isViewingCleanedAnalysisSource
    ? dataset.row_count
    : selectedWorksheet
      ? selectedWorksheet.rowCount
      : dataset.row_count;

  const selectPreviewWorksheet = (worksheetId: string) => {
    if (previewMode === "analysis") {
      setPreviewRows([]);
      setPreviewStatus("loading");
      setPreviewError(null);
    }
    setSelectedWorksheetId(worksheetId);
  };

  const selectPreviewMode = (mode: PreviewMode) => {
    if (mode === "analysis" && selectedWorksheet?.status !== "ready") {
      setSelectedWorksheetId(firstReadyWorksheet?.worksheetId || null);
    }
    setPreviewMode(mode);
  };

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
        previewMode === "analysis" ? (
        <button
          type="button"
          className="secondary-button dataset-preview-wrap-toggle"
          onClick={() => setIsWrapped((current) => !current)}
        >
          {isWrapped ? "Compact cells" : "Expand cells"}
        </button>
        ) : null
      }
    >

      {supportsOriginalWorkbook && (
        <div className="dataset-preview-mode-switch" aria-label="Workbook preview mode">
          <button
            type="button"
            className={previewMode === "analysis" ? "is-active" : ""}
            onClick={() => selectPreviewMode("analysis")}
          >
            Analysis table
          </button>
          <button
            type="button"
            className={previewMode === "original" ? "is-active" : ""}
            onClick={() => selectPreviewMode("original")}
          >
            Original workbook
          </button>
        </div>
      )}

      {previewMode === "analysis" && (
        <p className="dataset-preview-analysis-source">
          Current analysis source:{" "}
          <strong>{isViewingCleanedAnalysisSource ? "Cleaned working copy" : "Original"}</strong>
        </p>
      )}

      {hasWorkbook && (
        <div className="dataset-preview-sheets" aria-label="Worksheets">
          {worksheets.map((sheet) => (
            <button
              type="button"
              key={sheet.worksheetId}
              className={`dataset-preview-sheet${
                sheet.worksheetId === selectedWorksheet?.worksheetId ? " active" : ""
              }`}
              disabled={
                previewMode === "analysis"
                  ? sheet.status !== "ready"
                  : sheet.status !== "ready" && sheet.status !== "empty"
              }
              onClick={() => selectPreviewWorksheet(sheet.worksheetId)}
              title={
                sheet.status === "ready"
                  ? sheet.displayName || sheet.sheetName
                  : `${sheet.displayName || sheet.sheetName} is not ready for preview`
              }
            >
              {sheet.displayName || sheet.sheetName}
            </button>
          ))}
        </div>
      )}

      {previewMode === "original" && supportsOriginalWorkbook ? (
        <OriginalWorkbookPreview datasetId={dataset.dataset_id} worksheet={selectedWorksheet} />
      ) : (
      <div className="dataset-preview-table-wrap">
        {previewColumns.length === 0 ? (
          <p className="compact-empty">No columns are available for this worksheet.</p>
        ) : previewStatus === "loading" ? (
          <p className="compact-empty">Loading preview rows...</p>
        ) : previewStatus === "error" ? (
          <p className="compact-empty">{previewError || "Preview unavailable. Try Refresh."}</p>
        ) : visibleRowCount === 0 ? (
          <p className="compact-empty">No rows to preview.</p>
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
              {previewRows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  <td className="dataset-preview-rownum">{rowIndex + 1}</td>
                  {previewColumns.map((column) => {
                    const cellText = formatCell(row[column.name]);
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
      )}
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
  const [expandedColumnName, setExpandedColumnName] = useState<string | null>(null);
  const dataOverviewRef = useRef<HTMLElement | null>(null);
  const missingValuesRef = useRef<HTMLDivElement | null>(null);
  const detectedColumnsRef = useRef<HTMLElement | null>(null);
  const createSchemaTypeSummary = (metadata: DatasetMetadata) =>
    (Array.isArray(metadata.schema) ? metadata.schema : []).reduce<Record<string, number>>((summary, column) => {
      const type = column.inferred_type || "unknown";
      summary[type] = (summary[type] || 0) + 1;
      return summary;
    }, {});
  const workbookWorksheets = listWorkbookWorksheets(dataset);
  const activeWorksheet = getDatasetActiveWorksheet(dataset);
  const showHeaderWarning = hasSuspiciousWorkbookHeaders(dataset);
  const structuralColumnNotice = getStructuralColumnNotice(dataset);
  const workbookRelationshipIntelligence = buildWorkbookRelationshipIntelligence(dataset?.workbook_metadata);
  const { dataProfile } = useDataIntelligence(dataset);
  const schemaTypeSummary = dataset ? createSchemaTypeSummary(dataset) : {};
  const detectedColumns = Array.isArray(dataset?.schema) ? dataset.schema : [];
  const displayColumnProfiles = createSchemaDisplayProfiles(detectedColumns);
  const detectedNumericFields = dataProfile?.possibleMetrics || [];
  const detectedCategoryFields = dataProfile?.possibleDimensions || [];
  const detectedDateFields = dataProfile?.dateTimeFields || [];
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
  const focusDataTarget = (target: "overview" | "missingValues" | "columns") => {
    window.setTimeout(() => {
      const element =
        target === "columns"
          ? detectedColumnsRef.current
          : target === "missingValues"
            ? missingValuesRef.current || dataOverviewRef.current
            : dataOverviewRef.current;
      element?.scrollIntoView({ behavior: "smooth", block: "start" });
      element?.focus({ preventScroll: true });
    }, 0);
  };

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

      if (target === "overview" || target === "missingValues" || target === "columns") {
        setIsDatasetPreviewOpen(false);
        setIsDatasetIntelligenceDetailOpen(false);
        setActiveOperationalWorkspace(null);
        setActiveFocusedWorkflow(null);
        setActiveDrillInView(target === "columns" ? "columns" : "overview");
        focusDataTarget(target);
        return;
      }

      if (target === "connections") {
        openOperationalWorkspace("connections");
        return;
      }

      if (target === "intelligenceDetail") {
        setIsDatasetPreviewOpen(false);
        setActiveFocusedWorkflow(null);
        setIsDatasetIntelligenceDetailOpen(true);
        return;
      }

      if (target === "intelligence" || target === "semantics") {
        setIsDatasetPreviewOpen(false);
        setIsDatasetIntelligenceDetailOpen(false);
        setActiveOperationalWorkspace(null);
        setActiveFocusedWorkflow(null);
        setActiveDrillInView("overview");
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
      <section
        ref={dataOverviewRef}
        className="dataset-hub-panel"
        aria-label="Dataset management hub"
        tabIndex={-1}
      >
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
                  <div className="evidence-chip-row" aria-label="Initial detected signals">
                    {understandingSignals.map((signal) => (
                      <OperationalTag key={signal}>{signal}</OperationalTag>
                    ))}
                  </div>
                </InvestigationThreadStage>

                <EvidenceRows>
                  <div className="thread-section-heading">
                    <p className="section-label">Detected signals</p>
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

              {activeDrillInView === "overview" && workbookRelationshipIntelligence && (
                <ContextRail>
                  <InlineDisclosure summary="Connected source detail" className="context-disclosure">
                    <WorkbookRelationshipSummaryPanel intelligence={workbookRelationshipIntelligence} />
                  </InlineDisclosure>
                </ContextRail>
              )}
            </OperationalWorkspaceLayout>
            {structuralColumnNotice ? (
              <p className="workbook-header-warning">{structuralColumnNotice}</p>
            ) : showHeaderWarning ? (
              <p className="workbook-header-warning">{WORKBOOK_HEADER_WARNING_COPY}</p>
            ) : null}
            <div ref={missingValuesRef} tabIndex={-1}>
              <MissingValuesOverview
                schema={Array.isArray(dataset.schema) ? dataset.schema : []}
                rowCount={dataset.row_count}
              />
            </div>
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
          <section
            ref={detectedColumnsRef}
            className="detected-columns-section"
            aria-label="Detected columns"
            tabIndex={-1}
          >
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
                const isExpanded = expandedColumnName === column.name;
                const handleToggle = () =>
                  setExpandedColumnName((current) => (current === column.name ? null : column.name));

                return (
                  <div
                    key={column.name}
                    className={`detected-column-item${isExpanded ? " is-expanded" : ""}`}
                  >
                    <span
                      role="button"
                      tabIndex={0}
                      aria-expanded={isExpanded}
                      onClick={handleToggle}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          handleToggle();
                        }
                      }}
                      title={displayProfile?.displayName !== column.name ? column.name : undefined}
                    >
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
                    {isExpanded && <ColumnDistributionCard column={column} />}
                  </div>
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

    </div>
  );
}

export default DatasetSummaryPanel;
