import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import type { DatasetMetadata, DatasetSession } from "../../features/dataset/datasetTypes";
import {
  cleanPrepareSteps,
  type CleanPrepareStep,
  useCleanPrepareStep,
} from "../../features/cleanPrepare/useCleanPrepareStep";
import {
  createEmptyTransformationPipeline,
  createTransformationStep,
  getSupportedTransformationsForColumn,
  summarizeTransformationPipeline,
  summarizeTransformationStep,
  type TransformationPipeline,
  type TransformationStepKind,
} from "../../features/dataPreparation/transformationPipeline";
import {
  getOriginalWorkbookLayout,
  getPreview,
  type OriginalWorkbookCellStyle,
  type OriginalWorkbookLayout,
} from "../../services/api";
import DataTable, { type DataTableColumn, type DataTableRow } from "../common/DataTable";
import WorksheetSwitcher, { type WorksheetSwitcherOption } from "../common/WorksheetSwitcher";
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
} from "../../features/dataIntelligence/structuralPresentation";
import {
  WORKBOOK_HEADER_WARNING_COPY,
  getStructuralColumnNotice,
  getDatasetActiveWorksheet,
  getWorkbookMetadata,
  hasSuspiciousWorkbookHeaders,
  listWorkbookWorksheets,
  type WorksheetMetadata,
} from "../../features/workbook";
import {
  buildWorkbookRelationshipIntelligence,
  type WorkbookEntityRole,
  type WorkbookRelationshipIntelligence,
} from "../../features/workbookIntelligence";
import FocusedWorkspaceShell from "../layout/FocusedWorkspaceShell";
import {
  ContextRail,
  ContextRailHeader,
  EvidenceRow,
  EvidenceRows,
  InlineDisclosure,
  InvestigationThread,
  MetadataFooter,
  OperationalWorkspaceLayout,
  WorkspaceHeader,
} from "../workspace";
import WorkbookContextPanel from "../workbook/WorkbookContextPanel";
import { CleanPrepareReviewPanel } from "../workspace/CleanPrepareReviewPanel";

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
  onPreviewBackToCleanPrepare?: (worksheetId: string, scrollY: number) => void;
  selectedTaskId?: string | null;
  onSelectedTaskIdChange?: (taskId: string | null) => void;
  // M-2: Continue in Analyst handoff. The App-level handler switches mode
  // to "analyst" and routes to the existing SQL workspace. Optional so any
  // legacy call site continues to render without the handoff button.
  onContinueInAnalyst?: () => void;
  // M-2 follow-up: Clean / Prepare surface props. Moves the existing
  // CleanPrepareReviewPanel from the (now-hidden) legacy Explore stack onto
  // the Data tab where dataset preparation belongs. Optional so call sites
  // that don't need cleaning can still render. The panel is exposure-only
  // until the user explicitly opens it — no auto-clean, no destructive
  // mutation, no backend call originates from rendering it.
  onAnalysisSourceSelect?: (
    worksheetId: string,
    source: "cleaned" | "original",
  ) => Promise<void>;
  onPreviewWorksheet?: (worksheetId: string) => void;
  cleanPrepareRestoreContext?: {
    worksheetId: string;
    scrollY: number;
    requestId: number;
  } | null;
  onCleanPrepareRestoreConsumed?: () => void;
};

type DataWorkflowMenu = "details";
type FocusedOperationalWorkspace = "connections" | "entities" | "kpis" | "trends";
type PrepareTab = "structural" | "transformations" | "sql-cleaning";
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

const prepareTabLabels: Record<PrepareTab, string> = {
  structural: "Structural fixes",
  transformations: "Column transformations",
  "sql-cleaning": "SQL cleaning",
};

const prepareTabComingSoon: PrepareTab[] = ["sql-cleaning"];

const enabledTransformationKinds = new Set<TransformationStepKind>([
  "fill_missing_mean",
  "fill_missing_median",
  "fill_missing_mode",
  "fill_missing_zero",
  "fill_missing_unknown",
  "log_transform",
  "z_score_scale",
  "min_max_scale",
  "one_hot_encode",
  "frequency_encode",
  "trim_whitespace",
  "lowercase",
  "uppercase",
  "extract_year",
  "extract_month",
  "extract_quarter",
  "extract_day_of_week",
  "boolean_to_integer",
  "fill_missing_true",
  "fill_missing_false",
]);

const configurableTransformationKinds = new Set<TransformationStepKind>([
  "fill_missing_custom",
  "cap_outliers_percentile",
  "ordinal_encode",
  "days_since",
]);

type ConfigurableTransformationKind =
  | "fill_missing_custom"
  | "cap_outliers_percentile"
  | "ordinal_encode"
  | "days_since";

type DraftTransformationConfig = {
  customValue: string;
  lowerPercentile: string;
  upperPercentile: string;
  orderText: string;
  anchorDate: string;
};

type TransformationStepParametersInput = NonNullable<
  Parameters<typeof createTransformationStep>[0]["parameters"]
>;

const createTransformationConfigKey = (
  columnName: string,
  kind: TransformationStepKind,
): string => `${columnName}:${kind}`;

const createDefaultTransformationConfig = (
  kind: TransformationStepKind,
): DraftTransformationConfig => ({
  customValue: "",
  lowerPercentile: kind === "cap_outliers_percentile" ? "5" : "",
  upperPercentile: kind === "cap_outliers_percentile" ? "95" : "",
  orderText: "",
  anchorDate: "",
});

const isConfigurableTransformationKind = (
  kind: TransformationStepKind,
): kind is ConfigurableTransformationKind => configurableTransformationKinds.has(kind);

const parseOrdinalOrder = (orderText: string): string[] =>
  orderText
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

const validateTransformationConfig = (
  kind: ConfigurableTransformationKind,
  config: DraftTransformationConfig,
): string | null => {
  if (kind === "fill_missing_custom") {
    return config.customValue.trim()
      ? null
      : "Enter a replacement value before adding this step.";
  }

  if (kind === "cap_outliers_percentile") {
    const lowerValue = config.lowerPercentile.trim();
    const upperValue = config.upperPercentile.trim();
    if (!lowerValue || !upperValue) return "Enter both lower and upper percentile values.";
    const lowerPercentile = Number(lowerValue);
    const upperPercentile = Number(upperValue);
    if (!Number.isFinite(lowerPercentile) || !Number.isFinite(upperPercentile)) {
      return "Lower and upper percentile must be numbers between 0 and 100.";
    }
    if (
      lowerPercentile < 0 ||
      lowerPercentile > 100 ||
      upperPercentile < 0 ||
      upperPercentile > 100
    ) {
      return "Percentile bounds must stay between 0 and 100.";
    }
    if (lowerPercentile >= upperPercentile) {
      return "Lower percentile must be smaller than upper percentile.";
    }
    return null;
  }

  if (kind === "ordinal_encode") {
    return parseOrdinalOrder(config.orderText).length >= 2
      ? null
      : "Provide at least two comma-separated category values in order.";
  }

  return config.anchorDate.trim() ? null : "Choose an anchor date before adding this step.";
};

const createConfiguredTransformationParameters = (
  kind: ConfigurableTransformationKind,
  config: DraftTransformationConfig,
): TransformationStepParametersInput => {
  if (kind === "fill_missing_custom") {
    return { kind, customValue: config.customValue.trim() };
  }
  if (kind === "cap_outliers_percentile") {
    return {
      kind,
      lowerPercentile: Number(config.lowerPercentile),
      upperPercentile: Number(config.upperPercentile),
    };
  }
  if (kind === "ordinal_encode") {
    return { kind, order: parseOrdinalOrder(config.orderText) };
  }
  return { kind, anchorDate: config.anchorDate.trim() };
};

const transformationKindCopy: Record<
  Exclude<TransformationStepKind, "sql_select_transform">,
  { label: string; description: string }
> = {
  fill_missing_mean: {
    label: "Fill missing with mean",
    description: "Plan a numeric fill using the column average.",
  },
  fill_missing_median: {
    label: "Fill missing with median",
    description: "Plan a numeric fill using the column midpoint.",
  },
  fill_missing_mode: {
    label: "Fill missing with mode",
    description: "Plan a fill using the most common value.",
  },
  fill_missing_zero: {
    label: "Fill missing with zero",
    description: "Plan a numeric fill with zero.",
  },
  fill_missing_custom: {
    label: "Fill missing with custom value",
    description: "Needs a configured replacement value.",
  },
  cap_outliers_percentile: {
    label: "Cap outliers by percentile",
    description: "Needs configured lower and upper percentile limits.",
  },
  log_transform: {
    label: "Log transform",
    description: "Plan a log-scaled output column.",
  },
  z_score_scale: {
    label: "Z-score scale",
    description: "Plan a standardized numeric output column.",
  },
  min_max_scale: {
    label: "Min-max scale",
    description: "Plan a numeric output scaled between minimum and maximum.",
  },
  fill_missing_unknown: {
    label: "Fill missing with Unknown",
    description: "Plan a text or category fill with Unknown.",
  },
  one_hot_encode: {
    label: "One-hot encode",
    description: "Plan indicator fields for categories.",
  },
  ordinal_encode: {
    label: "Ordinal encode",
    description: "Needs a configured category order.",
  },
  frequency_encode: {
    label: "Frequency encode",
    description: "Plan category values as frequency signals.",
  },
  trim_whitespace: {
    label: "Trim whitespace",
    description: "Plan leading and trailing whitespace cleanup.",
  },
  lowercase: {
    label: "Lowercase",
    description: "Plan a lowercase text output.",
  },
  uppercase: {
    label: "Uppercase",
    description: "Plan an uppercase text output.",
  },
  extract_year: {
    label: "Extract year",
    description: "Plan a year field from date values.",
  },
  extract_month: {
    label: "Extract month",
    description: "Plan a month field from date values.",
  },
  extract_quarter: {
    label: "Extract quarter",
    description: "Plan a quarter field from date values.",
  },
  extract_day_of_week: {
    label: "Extract day of week",
    description: "Plan a weekday field from date values.",
  },
  days_since: {
    label: "Days since",
    description: "Needs a configured anchor date.",
  },
  boolean_to_integer: {
    label: "Boolean to integer",
    description: "Plan true and false values as numeric indicators.",
  },
  fill_missing_true: {
    label: "Fill missing with true",
    description: "Plan a boolean fill with true.",
  },
  fill_missing_false: {
    label: "Fill missing with false",
    description: "Plan a boolean fill with false.",
  },
};

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
  activeWorksheetId,
  isSwitchingWorksheet,
  onWorksheetSelect,
  onBack,
  onContinueInAnalyst,
}: {
  dataset: DatasetMetadata;
  worksheets: WorksheetMetadata[];
  initialWorksheetId: string | null;
  activeWorksheetId: string | null;
  isSwitchingWorksheet: boolean;
  onWorksheetSelect: (worksheetId: string) => void;
  onBack: () => void;
  // M-2: Optional handoff to the Analyst SQL workspace. The handler at the
  // App level switches workspace mode and routes to the existing SQL
  // workspace — no query is run here, no SQL is generated, no backend is
  // contacted. Optional so the preview page renders without it for unit
  // tests / legacy call sites.
  onContinueInAnalyst?: () => void;
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
    if (hasWorkbook && !previewWorksheetId && !isViewingCleanedAnalysisSource) {
      setPreviewRows([]);
      setPreviewStatus("idle");
      setPreviewError(null);
      return undefined;
    }

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
  const previewSummary =
    previewRows.length === previewRowTotal
      ? `Showing all ${previewRowTotal.toLocaleString()} rows · ${previewColumns.length.toLocaleString()} columns`
      : `Showing ${previewRows.length.toLocaleString()} of ${previewRowTotal.toLocaleString()} rows · ${previewColumns.length.toLocaleString()} columns`;

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
  const previewTableColumns: DataTableColumn[] = previewColumns.map((column) => ({
    key: column.name,
    width: getColumnWidth(column.name),
    header: (
      <>
        <span className="dataset-preview-cell">{column.name}</span>
        <small>{column.inferred_type}</small>
        <span
          className="dataset-preview-resizer"
          role="separator"
          aria-orientation="vertical"
          aria-label={`Resize ${column.name} column`}
          onPointerDown={(event) => startColumnResize(event, column.name)}
        />
      </>
    ),
  }));
  const previewTableRows: DataTableRow[] = previewRows.map((row, rowIndex) => ({
    key: rowIndex,
    values: row,
    rowNumber: rowIndex + 1,
  }));

  return (
    <FocusedWorkspaceShell
      className="dataset-preview-page"
      eyebrow="PREVIEW"
      title={`Previewing ${previewLabel}`}
      summary={previewSummary}
      backLabel="Back to Data"
      onBack={onBack}
      actions={
        <>
          {previewMode === "analysis" && (
            <button
              type="button"
              className="secondary-button dataset-preview-wrap-toggle"
              onClick={() => setIsWrapped((current) => !current)}
            >
              {isWrapped ? "Compact cells" : "Expand cells"}
            </button>
          )}
          {onContinueInAnalyst && (
            <button
              type="button"
              className="primary-button dataset-preview-continue-in-analyst"
              onClick={onContinueInAnalyst}
              title="Use this worksheet in Analyst to build reports, templates, or SQL. Nothing runs until you click Run Query."
            >
              Continue in Analyst &rarr;
            </button>
          )}
        </>
      }
    >

      {supportsOriginalWorkbook && (
        <div className="dataset-preview-mode-switch" aria-label="Workbook preview mode">
          <button
            type="button"
            className={previewMode === "analysis" ? "is-active" : ""}
            onClick={() => selectPreviewMode("analysis")}
          >
            Clean preview
          </button>
          <button
            type="button"
            className={previewMode === "original" ? "is-active" : ""}
            onClick={() => selectPreviewMode("original")}
          >
            Original workbook layout
          </button>
          <span
            className="dataset-preview-mode-help"
            title="Clean preview shows the normalized data FiltraQueri uses for analysis. Original workbook layout shows the raw XLSX as uploaded."
            aria-label="Clean preview shows the normalized data FiltraQueri uses for analysis. Original workbook layout shows the raw XLSX as uploaded."
          >
            ?
          </span>
        </div>
      )}

      {previewMode === "analysis" && hasWorkbook && (() => {
        const activeWorksheet =
          worksheets.find((sheet) => sheet.worksheetId === activeWorksheetId) || null;
        const activeWorksheetName =
          activeWorksheet?.displayName || activeWorksheet?.sheetName || "—";
        const activeSourceIsCleaned =
          activeAnalysisSource?.type === "cleaned_working_copy" &&
          activeAnalysisSource?.worksheetId === activeWorksheetId;
        const isPreviewingActive =
          selectedWorksheet?.worksheetId === activeWorksheetId;
        const canPromoteSelected =
          Boolean(selectedWorksheet) &&
          selectedWorksheet?.status === "ready" &&
          !isPreviewingActive &&
          !isSwitchingWorksheet;
        const selectedWorksheetName =
          selectedWorksheet?.displayName || selectedWorksheet?.sheetName || "this worksheet";
        return (
          <div
            className={`dataset-active-source-compact ${
              isPreviewingActive ? "is-active-source" : "is-previewing-other"
            }`}
            aria-live="polite"
          >
            {isPreviewingActive ? (
              <span className="dataset-active-source-chip">
                <span aria-hidden="true" />
                {activeSourceIsCleaned ? "Active source · cleaned working copy" : "Active source"}
              </span>
            ) : (
              <>
                <span className="dataset-active-source-current">
                  Currently active: <strong>{activeWorksheetName}</strong>
                </span>
                {selectedWorksheet ? (
                  <button
                    type="button"
                    className="primary-button dataset-active-source-cta"
                    onClick={() => onWorksheetSelect(selectedWorksheet.worksheetId)}
                    disabled={!canPromoteSelected}
                    title={
                      canPromoteSelected
                        ? `Make ${selectedWorksheetName} the active analysis source`
                        : "This worksheet is not ready for analysis yet"
                    }
                  >
                    {isSwitchingWorksheet
                      ? "Switching…"
                      : `Use ${selectedWorksheetName} for analysis`}
                  </button>
                ) : null}
              </>
            )}
          </div>
        );
      })()}

      {hasWorkbook && (
        <div className="dataset-preview-sheets-compact">
          <WorksheetSwitcher
          variant="dataPreview"
          ariaLabel="Worksheets"
          className="dataset-preview-sheets"
          optionClassName="dataset-preview-sheet"
          activeClassName="active"
          labelClassName="dataset-preview-sheet-label"
          badgeClassName="dataset-preview-sheet-badge"
          options={worksheets.map<WorksheetSwitcherOption>((sheet) => {
            const sheetCleanedCopy = dataset.workbook_metadata?.cleanedWorkingCopies?.find(
              (copy) => copy.sourceWorksheetId === sheet.worksheetId,
            );
            const sheetIsActiveCleaned =
              Boolean(sheetCleanedCopy) &&
              activeAnalysisSource?.type === "cleaned_working_copy" &&
              activeAnalysisSource.worksheetId === sheet.worksheetId;
            const sheetBadgeStatus: "active" | "available" | "original" =
              sheetIsActiveCleaned ? "active" : sheetCleanedCopy ? "available" : "original";
            const sheetBadgeLabel =
              sheetBadgeStatus === "active"
                ? "Cleaned active"
                : sheetBadgeStatus === "available"
                ? "Cleaned available"
                : "Original";
            const sheetName = sheet.displayName || sheet.sheetName;
            const shouldShowBadge =
              previewMode === "analysis" && sheetBadgeStatus !== "original";
            return {
              id: sheet.worksheetId,
              label: sheetName,
              isActive: sheet.worksheetId === selectedWorksheet?.worksheetId,
              disabled:
                previewMode === "analysis"
                  ? sheet.status !== "ready"
                  : sheet.status !== "ready" && sheet.status !== "empty",
              title:
                sheet.status === "ready"
                  ? `${sheetName}${shouldShowBadge ? ` — ${sheetBadgeLabel}` : ""}`
                  : `${sheetName} is not ready for preview`,
              ariaLabel: shouldShowBadge ? `${sheetName}, ${sheetBadgeLabel}` : sheetName,
              badge: shouldShowBadge
                ? {
                    label: sheetBadgeLabel,
                    status: sheetBadgeStatus,
                    ariaHidden: true,
                  }
                : undefined,
            };
          })}
            onSelect={selectPreviewWorksheet}
          />
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
          <DataTable
            variant="workbookPreview"
            ariaLabel="Dataset preview table"
            wrapperClassName="dataset-preview-table-inner"
            tableClassName={["dataset-preview-table", isWrapped ? "is-wrapped" : ""]
              .filter(Boolean)
              .join(" ")}
            tableStyle={{ width: `${totalTableWidth}px`, minWidth: "100%" }}
            columns={previewTableColumns}
            rows={previewTableRows}
            showRowNumbers
            rowNumberHeader="#"
            rowNumberHeaderClassName="dataset-preview-rownum"
            rowNumberColumnWidth={52}
            renderCell={(row, column) => (
              <span className="dataset-preview-cell">{formatCell(row.values[column.key])}</span>
            )}
            getCellTitle={(row, column) => formatCell(row.values[column.key])}
          />
        )}
      </div>
      )}
    </FocusedWorkspaceShell>
  );
}

/**
 * Dedicated Clean / Prepare page — uses FocusedWorkspaceShell like
 * DatasetPreviewPage. Wraps the existing CleanPrepareReviewPanel with a calm
 * page-level header that explains what cleaning does, surfaces the overall
 * preparation priority, and offers a Continue in Analyst handoff alongside
 * the panel's own Activate / Apply actions.
 *
 * No new execution path is introduced: this page renders the same
 * CleanPrepareReviewPanel with an `embedded` flag that hides the panel's
 * internal toggle pill (since the page chrome already explains what we're
 * looking at). All cleaning behavior — recipe preview, missing-value
 * decisions, cleaned-working-copy activation — flows through the same K1/K2
 * handlers that already existed.
 */
function DataCleanPreparePage({
  dataset,
  sourceName,
  onAnalysisSourceSelect,
  onPreviewWorksheet,
  cleanPrepareRestoreContext,
  onCleanPrepareRestoreConsumed,
  onContinueInAnalyst,
  onBack,
}: {
  dataset: DatasetMetadata;
  sourceName: string;
  onAnalysisSourceSelect: (
    worksheetId: string,
    source: "cleaned" | "original",
  ) => Promise<void>;
  onPreviewWorksheet?: (worksheetId: string) => void;
  cleanPrepareRestoreContext?: {
    worksheetId: string;
    scrollY: number;
    requestId: number;
  } | null;
  onCleanPrepareRestoreConsumed?: () => void;
  onContinueInAnalyst?: () => void;
  onBack: () => void;
}) {
  const { step, goToReview, goToDecide, goToApply } = useCleanPrepareStep();
  const [activePrepareTab, setActivePrepareTab] = useState<PrepareTab>("structural");
  // Deterministic page-header summary. The detailed signal counts and per-
  // worksheet issue breakdown surface inside the embedded
  // CleanPrepareReviewPanel below — the page chrome stays compact with just
  // the worksheet count, cleaned-copy count, and source file context.
  const workbook = getWorkbookMetadata(dataset);
  const worksheetCount = workbook?.worksheets.length || 0;
  const cleanedSheetCount = workbook?.cleanedWorkingCopies.length || 0;
  const activeWorksheetNullCount = dataset.schema.reduce(
    (total, column) => total + (column.null_count || 0),
    0,
  );
  const workbookNullCount =
    workbook && worksheetCount > 0
      ? workbook.worksheets.reduce(
          (worksheetTotal, worksheet) =>
            worksheetTotal +
            worksheet.schema.reduce(
              (schemaTotal, column) => schemaTotal + (column.null_count || 0),
              0,
            ),
          0,
        )
      : activeWorksheetNullCount;
  const activeWorksheetId = workbook?.activeWorksheetId;
  const activeWorksheet =
    workbook?.worksheets.find((worksheet) => worksheet.worksheetId === activeWorksheetId) || null;
  const activeWorksheetName =
    activeWorksheet?.displayName || activeWorksheet?.sheetName || dataset.original_filename;
  const transformationColumns = dataset.schema;
  const transformationWorksheetId = activeWorksheet?.worksheetId || dataset.dataset_id;
  const transformationSourceTableName = activeWorksheet?.tableName || dataset.table_name;
  const transformationSourceType: TransformationPipeline["sourceType"] =
    workbook?.activeAnalysisSource?.type === "cleaned_working_copy" ? "cleaned_working_copy" : "original";
  const transformationPipelineSeed = [
    dataset.dataset_id,
    transformationWorksheetId,
    transformationSourceTableName,
    transformationSourceType,
  ].join(":");
  const [selectedColumnName, setSelectedColumnName] = useState<string | null>(
    transformationColumns[0]?.name || null,
  );
  const [draftPipeline, setDraftPipeline] = useState<TransformationPipeline>(() =>
    createEmptyTransformationPipeline({
      worksheetId: transformationWorksheetId,
      sourceTableName: transformationSourceTableName,
      sourceType: transformationSourceType,
      seed: transformationPipelineSeed,
    }),
  );
  const [transformationConfigs, setTransformationConfigs] = useState<
    Record<string, DraftTransformationConfig>
  >({});
  const visibleDraftPipeline =
    draftPipeline.worksheetId === transformationWorksheetId &&
    draftPipeline.sourceTableName === transformationSourceTableName &&
    draftPipeline.sourceType === transformationSourceType
      ? draftPipeline
      : createEmptyTransformationPipeline({
          worksheetId: transformationWorksheetId,
          sourceTableName: transformationSourceTableName,
          sourceType: transformationSourceType,
          seed: transformationPipelineSeed,
        });
  const selectedColumn =
    transformationColumns.find((column) => column.name === selectedColumnName) || null;
  const supportedTransformationKinds = selectedColumn
    ? getSupportedTransformationsForColumn(selectedColumn).filter(
        (kind): kind is Exclude<TransformationStepKind, "sql_select_transform"> =>
          kind !== "sql_select_transform",
      )
    : [];
  const updateTransformationConfig = useCallback(
    (
      columnName: string,
      kind: ConfigurableTransformationKind,
      patch: Partial<DraftTransformationConfig>,
    ) => {
      const configKey = createTransformationConfigKey(columnName, kind);
      setTransformationConfigs((currentConfigs) => ({
        ...currentConfigs,
        [configKey]: {
          ...createDefaultTransformationConfig(kind),
          ...currentConfigs[configKey],
          ...patch,
        },
      }));
    },
    [],
  );
  const addTransformationStep = useCallback(
    (kind: TransformationStepKind, parameters?: TransformationStepParametersInput) => {
      if (!selectedColumn) return;
      if (!enabledTransformationKinds.has(kind) && !isConfigurableTransformationKind(kind)) return;
      if (isConfigurableTransformationKind(kind) && !parameters) return;
      setDraftPipeline((currentPipeline) => {
        const pipeline =
          currentPipeline.worksheetId === transformationWorksheetId &&
          currentPipeline.sourceTableName === transformationSourceTableName &&
          currentPipeline.sourceType === transformationSourceType
            ? currentPipeline
            : createEmptyTransformationPipeline({
                worksheetId: transformationWorksheetId,
                sourceTableName: transformationSourceTableName,
                sourceType: transformationSourceType,
                seed: transformationPipelineSeed,
              });
        const nextStep = createTransformationStep({
          pipelineId: pipeline.id,
          sequenceIndex: pipeline.steps.length,
          kind,
          targetColumn: selectedColumn,
          parameters,
        });
        return createEmptyTransformationPipeline({
          worksheetId: pipeline.worksheetId,
          sourceTableName: pipeline.sourceTableName,
          sourceType: pipeline.sourceType,
          seed: transformationPipelineSeed,
          steps: [...pipeline.steps, nextStep],
          warnings: pipeline.warnings,
        });
      });
    },
    [
      selectedColumn,
      transformationPipelineSeed,
      transformationSourceTableName,
      transformationSourceType,
      transformationWorksheetId,
    ],
  );
  const addConfiguredTransformationStep = useCallback(
    (kind: ConfigurableTransformationKind) => {
      if (!selectedColumn) return;
      const configKey = createTransformationConfigKey(selectedColumn.name, kind);
      const config = {
        ...createDefaultTransformationConfig(kind),
        ...transformationConfigs[configKey],
      };
      if (validateTransformationConfig(kind, config)) return;
      addTransformationStep(kind, createConfiguredTransformationParameters(kind, config));
      setTransformationConfigs((currentConfigs) => {
        const nextConfigs = { ...currentConfigs };
        delete nextConfigs[configKey];
        return nextConfigs;
      });
    },
    [addTransformationStep, selectedColumn, transformationConfigs],
  );
  const isMultiWorksheetWorkbook = Boolean(workbook && worksheetCount > 1);
  const missingCellsSubtitle = isMultiWorksheetWorkbook
    ? `across ${worksheetCount.toLocaleString()} worksheets${
        workbookNullCount !== activeWorksheetNullCount
          ? ` · ${activeWorksheetNullCount.toLocaleString()} in ${activeWorksheetName}`
          : ""
      }`
    : "total";
  const stepLabels: Record<CleanPrepareStep, string> = {
    review: "Review",
    decide: "Decide",
    apply: "Apply",
  };
  const activeStepIndex = cleanPrepareSteps.indexOf(step);

  return (
    <FocusedWorkspaceShell
      className="data-clean-prepare-page"
      eyebrow="PREPARE DATA"
      title={`Prepare Data · ${sourceName}`}
      summary="Fix structural issues, transform columns, or write cleaning SQL. Nothing applies until you Apply."
      backLabel="Back to Data"
      onBack={onBack}
    >
      <section className="data-clean-prepare-page-intro" aria-label="What cleaning does">
        <div className="data-clean-prepare-page-stats">
          <div>
            <p className="section-label">
              {isMultiWorksheetWorkbook ? "Workbook missing cells" : "Missing cells"}
            </p>
            <strong>
              {(isMultiWorksheetWorkbook ? workbookNullCount : activeWorksheetNullCount).toLocaleString()}
            </strong>
            <small>{missingCellsSubtitle}</small>
          </div>
          <div>
            <p className="section-label">Cleaned copies</p>
            <strong>{cleanedSheetCount.toLocaleString()}</strong>
            <small>{cleanedSheetCount === 0 ? "none created yet" : "available for activation"}</small>
          </div>
        </div>
      </section>

      <nav className="prepare-tab-strip" aria-label="Prepare data tools">
        {(Object.keys(prepareTabLabels) as PrepareTab[]).map((tab) => (
          <button
            type="button"
            key={tab}
            className={`prepare-tab-button${activePrepareTab === tab ? " is-active" : ""}`}
            onClick={() => setActivePrepareTab(tab)}
            aria-current={activePrepareTab === tab ? "page" : undefined}
          >
            <span>{prepareTabLabels[tab]}</span>
            {prepareTabComingSoon.includes(tab) && (
              <span className="prepare-tab-coming-soon-chip">Soon</span>
            )}
          </button>
        ))}
      </nav>

      {activePrepareTab === "structural" && (
        <>
          <nav className="data-clean-prepare-step-bar" aria-label="Clean and prepare steps">
            {cleanPrepareSteps.map((stepItem, index) => {
              const stateClass =
                index < activeStepIndex
                  ? "is-complete"
                  : stepItem === step
                    ? "is-current"
                    : "is-future";
              const goToStep =
                stepItem === "review"
                  ? goToReview
                  : stepItem === "decide"
                    ? goToDecide
                    : goToApply;

              return (
                <button
                  type="button"
                  key={stepItem}
                  className={stateClass}
                  onClick={goToStep}
                  aria-current={stepItem === step ? "step" : undefined}
                >
                  <span className="data-clean-prepare-step-marker" aria-hidden="true">
                    {index < activeStepIndex ? "✓" : index + 1}
                  </span>
                  <span>{stepLabels[stepItem]}</span>
                </button>
              );
            })}
          </nav>

          <CleanPrepareReviewPanel
            dataset={dataset}
            sourceName={sourceName}
            onAnalysisSourceSelect={onAnalysisSourceSelect}
            onPreviewDataset={onPreviewWorksheet}
            restoreContext={cleanPrepareRestoreContext}
            onRestoreContextConsumed={onCleanPrepareRestoreConsumed}
            onContinueInAnalyst={onContinueInAnalyst}
            activeStep={step}
            embedded
          />

          <div className="data-clean-prepare-step-actions" aria-label="Clean and prepare step navigation">
            {step === "review" && (
              <button type="button" className="primary-button" onClick={goToDecide}>
                Next: Decide
              </button>
            )}
            {step === "decide" && (
              <>
                <button type="button" className="secondary-button" onClick={goToReview}>
                  Back: Review
                </button>
                <button type="button" className="primary-button" onClick={goToApply}>
                  Next: Apply
                </button>
              </>
            )}
            {step === "apply" && (
              <button type="button" className="secondary-button" onClick={goToDecide}>
                Back: Decide
              </button>
            )}
          </div>
        </>
      )}

      {activePrepareTab === "transformations" && (
        <section aria-label="Column transformations draft planner">
          <div className="prepare-transformations-layout">
            <div className="prepare-transformations-column-list" aria-label="Worksheet columns">
              <div className="prepare-transformations-panel-heading">
                <p className="section-label">Active worksheet columns</p>
                <strong>{transformationColumns.length.toLocaleString()}</strong>
              </div>
              {transformationColumns.length === 0 ? (
                <p className="prepare-transformations-empty">
                  No columns are available for this worksheet yet.
                </p>
              ) : (
                transformationColumns.map((column) => {
                  const isSelected = column.name === selectedColumn?.name;
                  return (
                    <button
                      type="button"
                      key={column.name}
                      className={`prepare-transformations-column-row${
                        isSelected ? " is-selected" : ""
                      }`}
                      onClick={() => setSelectedColumnName(column.name)}
                      aria-pressed={isSelected}
                    >
                      <span>
                        <strong>{column.name}</strong>
                        <small>{column.inferred_type}</small>
                      </span>
                      <span>
                        <small>
                          {column.null_count > 0
                            ? `${column.null_count.toLocaleString()} missing`
                            : "no missing"}
                        </small>
                        <small>{column.unique_count.toLocaleString()} unique</small>
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            <div className="prepare-transformations-detail" aria-label="Available transformations">
              {!selectedColumn ? (
                <p className="prepare-transformations-empty">
                  Select a column on the left to see available transformations.
                </p>
              ) : (
                <>
                  <div className="prepare-transformations-detail-header">
                    <div>
                      <p className="section-label">Selected column</p>
                      <h3>{selectedColumn.name}</h3>
                    </div>
                    <span className={`prepare-transformations-type-badge type-${selectedColumn.inferred_type}`}>
                      {selectedColumn.inferred_type}
                    </span>
                  </div>
                  <dl className="prepare-transformations-column-facts">
                    <div>
                      <dt>Missing</dt>
                      <dd>{selectedColumn.null_count.toLocaleString()}</dd>
                    </div>
                    <div>
                      <dt>Unique</dt>
                      <dd>{selectedColumn.unique_count.toLocaleString()}</dd>
                    </div>
                  </dl>
                  <div className="prepare-transformations-options">
                    {supportedTransformationKinds.map((kind) => {
                      const copy = transformationKindCopy[kind];
                      const isConfigurable = isConfigurableTransformationKind(kind);
                      const configKey = createTransformationConfigKey(selectedColumn.name, kind);
                      const config = isConfigurable
                        ? {
                            ...createDefaultTransformationConfig(kind),
                            ...transformationConfigs[configKey],
                          }
                        : null;
                      const validationMessage =
                        isConfigurable && config ? validateTransformationConfig(kind, config) : null;
                      const isEnabled = enabledTransformationKinds.has(kind);
                      return (
                        <article
                          className={`prepare-transformations-option-card${
                            isConfigurable ? " is-configurable" : ""
                          }`}
                          key={kind}
                        >
                          <div>
                            <h4>{copy.label}</h4>
                            <p>{copy.description}</p>
                          </div>
                          {isConfigurable && config && (
                            <div className="prepare-transformations-config-area">
                              {kind === "fill_missing_custom" && (
                                <label>
                                  <span>Replacement value</span>
                                  <input
                                    type="text"
                                    value={config.customValue}
                                    placeholder="e.g. Unknown, 0, N/A"
                                    onChange={(event) =>
                                      updateTransformationConfig(selectedColumn.name, kind, {
                                        customValue: event.target.value,
                                      })
                                    }
                                  />
                                </label>
                              )}
                              {kind === "cap_outliers_percentile" && (
                                <div className="prepare-transformations-config-grid">
                                  <label>
                                    <span>Lower percentile</span>
                                    <input
                                      type="number"
                                      min="0"
                                      max="100"
                                      step="0.1"
                                      value={config.lowerPercentile}
                                      onChange={(event) =>
                                        updateTransformationConfig(selectedColumn.name, kind, {
                                          lowerPercentile: event.target.value,
                                        })
                                      }
                                    />
                                  </label>
                                  <label>
                                    <span>Upper percentile</span>
                                    <input
                                      type="number"
                                      min="0"
                                      max="100"
                                      step="0.1"
                                      value={config.upperPercentile}
                                      onChange={(event) =>
                                        updateTransformationConfig(selectedColumn.name, kind, {
                                          upperPercentile: event.target.value,
                                        })
                                      }
                                    />
                                  </label>
                                </div>
                              )}
                              {kind === "ordinal_encode" && (
                                <label>
                                  <span>Category order</span>
                                  <textarea
                                    value={config.orderText}
                                    placeholder="Low, Medium, High"
                                    rows={3}
                                    onChange={(event) =>
                                      updateTransformationConfig(selectedColumn.name, kind, {
                                        orderText: event.target.value,
                                      })
                                    }
                                  />
                                </label>
                              )}
                              {kind === "days_since" && (
                                <label>
                                  <span>Anchor date</span>
                                  <input
                                    type="date"
                                    value={config.anchorDate}
                                    onChange={(event) =>
                                      updateTransformationConfig(selectedColumn.name, kind, {
                                        anchorDate: event.target.value,
                                      })
                                    }
                                  />
                                </label>
                              )}
                              {validationMessage && (
                                <p className="prepare-transformations-validation-error">
                                  {validationMessage}
                                </p>
                              )}
                              <button
                                type="button"
                                className="secondary-button"
                                onClick={() => addConfiguredTransformationStep(kind)}
                                disabled={Boolean(validationMessage)}
                              >
                                Add configured step
                              </button>
                            </div>
                          )}
                          <button
                            type="button"
                            className={isEnabled ? "secondary-button" : "secondary-button prepare-transformations-disabled-action"}
                            onClick={() => addTransformationStep(kind)}
                            disabled={!isEnabled}
                            title={
                              isEnabled
                                ? `Add ${copy.label}`
                                : "Needs configuration — coming in a later slice."
                            }
                          >
                            Add
                          </button>
                        </article>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="prepare-transformations-draft-pipeline" aria-label="Draft transformation pipeline">
            <div className="prepare-transformations-draft-header">
              <div>
                <p className="section-label">Draft pipeline</p>
                <h3>Local plan only</h3>
              </div>
              <div className="prepare-transformations-draft-actions" aria-label="Unavailable transformation actions">
                <button
                  type="button"
                  className="secondary-button"
                  disabled
                  title="Not available yet. This slice only builds a draft plan."
                >
                  Preview
                </button>
                <button
                  type="button"
                  className="primary-button"
                  disabled
                  title="Not available yet. This slice only builds a draft plan."
                >
                  Apply
                </button>
              </div>
            </div>

            {visibleDraftPipeline.steps.length === 0 ? (
              <p className="prepare-transformations-empty">
                No transformations added yet. Pick a column and add a transformation.
              </p>
            ) : (
              <>
                <p>{summarizeTransformationPipeline(visibleDraftPipeline)}</p>
                <ol className="prepare-transformations-step-list">
                  {visibleDraftPipeline.steps.map((pipelineStep) => (
                    <li className="prepare-transformations-step-row" key={pipelineStep.id}>
                      <span>{pipelineStep.order + 1}</span>
                      <p>{summarizeTransformationStep(pipelineStep)}</p>
                    </li>
                  ))}
                </ol>
              </>
            )}
            <div className="prepare-transformations-readiness">
              <span>Status: {visibleDraftPipeline.status}</span>
              <span>
                Preview ready: {visibleDraftPipeline.readiness.previewReady ? "yes" : "no"}
              </span>
              <span>Apply ready: no</span>
            </div>
            <p className="prepare-transformations-safety-note">
              Preview and Apply are disabled in this foundation slice.
            </p>
          </div>
        </section>
      )}

      {activePrepareTab === "sql-cleaning" && (
        <section className="prepare-tab-placeholder" aria-label="SQL cleaning coming soon">
          <div className="prepare-tab-placeholder-icon" aria-hidden="true">SQL</div>
          <div className="prepare-tab-placeholder-body">
            <span className="prepare-tab-placeholder-chip">Coming soon</span>
            <h3>SQL cleaning</h3>
            <p>
              A governed SQL cleaning workspace will make scripted cleanup explicit,
              previewable, and separate from Analyst query execution.
            </p>
            <ul className="prepare-tab-placeholder-preview-list">
              <li>Monaco editor with SQL safety validation</li>
              <li>Ask FiltraQueri cleaning prompt examples</li>
              <li>Live preview against working copy</li>
              <li>Chain with no-code transformations</li>
            </ul>
          </div>
        </section>
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
  onPreviewBackToCleanPrepare,
  onContinueInAnalyst,
  onAnalysisSourceSelect,
  onPreviewWorksheet,
  cleanPrepareRestoreContext,
  onCleanPrepareRestoreConsumed,
}: DatasetSummaryPanelProps) {
  const [activeWorkflowMenu, setActiveWorkflowMenu] = useState<DataWorkflowMenu | null>(null);
  const [activeOperationalWorkspace, setActiveOperationalWorkspace] =
    useState<FocusedOperationalWorkspace | null>(null);
  const [isDatasetIntelligenceDetailOpen, setIsDatasetIntelligenceDetailOpen] = useState(false);
  const [isDatasetPreviewOpen, setIsDatasetPreviewOpen] = useState(false);
  // Clean / Prepare now opens as a dedicated FocusedWorkspaceShell page
  // (mirrors the Preview dataset pattern). The Data tab stays calm; the page
  // gives the cleaning workspace its own room with a Back-to-Data button.
  const [isCleanPreparePageOpen, setIsCleanPreparePageOpen] = useState(false);
  const [requestedPreviewWorksheetId, setRequestedPreviewWorksheetId] = useState<string | null>(null);
  const [previewOrigin, setPreviewOrigin] = useState<{
    type: "cleanPrepare";
    worksheetId: string;
    scrollY: number;
  } | null>(null);
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
  const detectedDateFields = dataProfile?.dateTimeFields || [];
  const semanticHints = displayColumnProfiles.filter((profile) => profile.role).slice(0, 5);
  const businessEntityHints = displayColumnProfiles
    .filter((profile) => profile.role === "customer" || profile.role === "description" || profile.role === "identifier")
    .slice(0, 3);
  const missingValueColumns = detectedColumns.filter((column) => (column.null_count || 0) > 0);
  const activeWorksheetLabel =
    activeWorksheet?.displayName || activeWorksheet?.sheetName || "Dataset table";
  const worksheetCountLabel =
    workbookWorksheets.length > 0
      ? `${workbookWorksheets.length.toLocaleString()} worksheet${
          workbookWorksheets.length === 1 ? "" : "s"
        }`
      : "Single table";
  const workbookWarningMessages = Array.from(
    new Set([
      ...(structuralColumnNotice ? [structuralColumnNotice] : []),
      ...(!structuralColumnNotice && showHeaderWarning ? [WORKBOOK_HEADER_WARNING_COPY] : []),
      ...(dataset?.workbook_metadata?.normalization?.warnings || []),
      ...workbookWorksheets.flatMap((worksheet) => worksheet.normalization?.warnings || []),
      ...workbookWorksheets
        .map((worksheet) => worksheet.normalization?.headerDetectionWarning)
        .filter(Boolean),
      ...workbookWorksheets
        .map((worksheet) => worksheet.normalization?.structuralColumnDetectionWarning)
        .filter(Boolean),
    ]),
  );
  const structuralProfileCards = [
    {
      title: "Column profile",
      detail: `${detectedColumns.length.toLocaleString()} columns across ${Object.keys(
        schemaTypeSummary,
      ).length.toLocaleString()} inferred field type${
        Object.keys(schemaTypeSummary).length === 1 ? "" : "s"
      }.`,
      tone: "info" as const,
      icon: "info" as HumanSignalIcon,
    },
    detectedDateFields.length > 0
      ? {
          title: "Date fields",
          detail: `${detectedDateFields[0].name} is detected as a date field.`,
          tone: "ready" as const,
          icon: "timeline" as HumanSignalIcon,
        }
      : {
          title: "No date column detected",
          detail: "Trends analysis needs at least one date field.",
          tone: "attention" as const,
          icon: "warning" as HumanSignalIcon,
        },
    missingValueColumns.length > 0
      ? {
          title: "Missing values",
          detail: `${missingValueColumns.length.toLocaleString()} column${
            missingValueColumns.length === 1 ? "" : "s"
          } contain blank values in the available profile.`,
          tone: "attention" as const,
          icon: "warning" as HumanSignalIcon,
        }
      : {
          title: "Missing values",
          detail: "No blank-value columns are reported in the available profile.",
          tone: "ready" as const,
          icon: "connected" as HumanSignalIcon,
        },
    {
      title: "Sources",
      detail: `${worksheetCountLabel}. Active source: ${activeWorksheetLabel}.`,
      tone: "connected" as const,
      icon: "connected" as HumanSignalIcon,
    },
  ];
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
        : ["dataset-profile"],
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
    setActiveWorkflowMenu(null);
    setActiveOperationalWorkspace(workspace);
  };
  const closeOperationalWorkspace = () => {
    setActiveOperationalWorkspace(null);
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

      const commandEvent = event as CustomEvent<{
        target?: DataWorkspaceCommandTarget;
        worksheetId?: string;
        origin?: "cleanPrepare";
        scrollY?: number;
      }>;
      const target = commandEvent.detail?.target;

      if (target === "preview" || target === "worksheetPreview") {
        const requestedWorksheetId =
          target === "worksheetPreview" &&
          workbookWorksheets.some(
            (worksheet) =>
              worksheet.worksheetId === commandEvent.detail?.worksheetId &&
              worksheet.status === "ready",
          )
            ? commandEvent.detail?.worksheetId || null
            : null;
        setRequestedPreviewWorksheetId(requestedWorksheetId);
        setPreviewOrigin(
          requestedWorksheetId && commandEvent.detail?.origin === "cleanPrepare"
            ? {
                type: "cleanPrepare",
                worksheetId: requestedWorksheetId,
                scrollY:
                  typeof commandEvent.detail.scrollY === "number"
                    ? commandEvent.detail.scrollY
                    : 0,
              }
            : null,
        );
        setIsDatasetPreviewOpen(true);
        return;
      }

      if (target === "overview" || target === "missingValues" || target === "columns") {
        setIsDatasetPreviewOpen(false);
        setIsDatasetIntelligenceDetailOpen(false);
        setActiveOperationalWorkspace(null);
        focusDataTarget(target);
        return;
      }

      if (target === "connections") {
        openOperationalWorkspace("connections");
        return;
      }

      if (target === "intelligenceDetail") {
        setIsDatasetPreviewOpen(false);
        setIsDatasetIntelligenceDetailOpen(true);
        return;
      }

      if (target === "intelligence" || target === "semantics") {
        setIsDatasetPreviewOpen(false);
        setIsDatasetIntelligenceDetailOpen(false);
        setActiveOperationalWorkspace(null);
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
        initialWorksheetId={requestedPreviewWorksheetId || activeWorksheet?.worksheetId || null}
        activeWorksheetId={activeWorksheet?.worksheetId || null}
        isSwitchingWorksheet={isSwitchingWorksheet}
        onWorksheetSelect={onWorksheetSelect}
        onBack={() => {
          if (previewOrigin?.type === "cleanPrepare") {
            onPreviewBackToCleanPrepare?.(previewOrigin.worksheetId, previewOrigin.scrollY);
          }
          setPreviewOrigin(null);
          setRequestedPreviewWorksheetId(null);
          setIsDatasetPreviewOpen(false);
        }}
        onContinueInAnalyst={onContinueInAnalyst}
      />
    );
  }

  if (dataset && isCleanPreparePageOpen && onAnalysisSourceSelect) {
    return (
      <DataCleanPreparePage
        dataset={dataset}
        sourceName={
          activeWorksheet?.displayName ||
          activeWorksheet?.sheetName ||
          dataset.table_name
        }
        onAnalysisSourceSelect={onAnalysisSourceSelect}
        onPreviewWorksheet={onPreviewWorksheet}
        cleanPrepareRestoreContext={cleanPrepareRestoreContext}
        onCleanPrepareRestoreConsumed={onCleanPrepareRestoreConsumed}
        onContinueInAnalyst={onContinueInAnalyst}
        onBack={() => setIsCleanPreparePageOpen(false)}
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
          ? "Category and identifier fields"
          : activeOperationalWorkspace === "kpis"
            ? "Numeric fields"
            : "Date/time fields";
    const workspaceSummary =
      activeOperationalWorkspace === "connections"
        ? "Review source relationships and related worksheet fields."
        : activeOperationalWorkspace === "entities"
          ? "Review categorical, identifier, and comparison fields detected in the dataset."
          : activeOperationalWorkspace === "kpis"
            ? "Review numeric fields detected in the dataset."
            : "Review date and time fields found in the dataset.";

    return (
      <FocusedWorkspaceShell
        eyebrow="Data profile"
        title={workspaceTitle}
        summary={workspaceSummary}
        onBack={closeOperationalWorkspace}
      >
        <div className="focused-operational-workspace">
          <InvestigationThread>
            <WorkspaceHeader
              eyebrow="Dataset profile"
              title={workspaceTitle}
              meta={activeWorksheet?.displayName || activeWorksheet?.sheetName || "Dataset table"}
            />
            <EvidenceRows>
              <div className="thread-section-heading">
                <p className="section-label">Available fields</p>
                <strong>Detected columns and source context.</strong>
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
                        description="Categorical, identifier, or comparison field."
                      />
                    ))
                ) : (
                  <EvidenceRow
                    tone="attention"
                    icon={<HumanSignalIcon name="warning" />}
                    title="No category field detected"
                    description="No clear categorical or identifier field is available in the current profile."
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
                        description="Numeric field available in the current profile."
                      />
                    ))
                ) : (
                  <EvidenceRow
                    tone="attention"
                    icon={<HumanSignalIcon name="warning" />}
                    title="No numeric field detected"
                    description="No numeric field is available in the current profile."
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
                      description="Date or time field available in the current profile."
                    />
                  ))
                ) : (
                  <EvidenceRow
                    tone="attention"
                    icon={<HumanSignalIcon name="warning" />}
                    title="No date field detected"
                    description="A date or time field is needed for time-based inspection."
                  />
                ))}
            </EvidenceRows>
          </InvestigationThread>
          <ContextRail>
            <ContextRailHeader
              eyebrow="Context"
              title="Profile context"
              description="This view uses existing workbook and column metadata."
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
      <section
        ref={dataOverviewRef}
        className="dataset-hub-panel"
        aria-label="Dataset management hub"
        tabIndex={-1}
      >
        <div className="data-page-head">
          <div>
            <p className="section-label">Data</p>
            <h2>{dataset ? dataset.original_filename : "Data"}</h2>
            <p>
              {dataset
                ? `Structure and columns for ${dataset.original_filename}.`
                : "Choose a dataset to inspect workbook structure and columns."}
            </p>
          </div>
          {dataset && (
            <div className="data-page-head-actions">
              <button
                type="button"
                className="text-button data-refresh-link"
                onClick={() => window.location.reload()}
              >
                Refresh data
              </button>
            </div>
          )}
        </div>

        {dataset ? (
            <div className="data-profile-surface">
            <OperationalWorkspaceLayout>
              <InvestigationThread>
                <WorkspaceHeader
                  eyebrow="Dataset profile"
                  title="Structure and sources"
                  meta={`Active worksheet: ${activeWorksheetLabel}`}
                />

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
                    <strong>
                      <CountUp value={workbookWorksheets.length || 1} />
                    </strong>
                  </span>
                  <span>
                    Field types
                    <strong><CountUp value={Object.keys(schemaTypeSummary).length} /></strong>
                  </span>
                </MetadataFooter>

                <EvidenceRows>
                  <div className="thread-section-heading">
                    <p className="section-label">Structure checks</p>
                    <strong>Metadata available for inspection before analysis.</strong>
                  </div>
                  {structuralProfileCards.map((signal, index) => (
                    <EvidenceRow
                      key={signal.title}
                      tone={signal.tone}
                      primary={index === 0}
                      icon={<HumanSignalIcon name={signal.icon} />}
                      title={signal.title}
                      description={signal.detail}
                    />
                  ))}
                </EvidenceRows>
              </InvestigationThread>

              {workbookRelationshipIntelligence && (
                <ContextRail>
                  <InlineDisclosure summary="Connected source detail" className="context-disclosure">
                    <WorkbookRelationshipSummaryPanel intelligence={workbookRelationshipIntelligence} />
                  </InlineDisclosure>
                </ContextRail>
              )}
            </OperationalWorkspaceLayout>
            {workbookWarningMessages.length > 0 && (
              <section className="data-warning-card" aria-label="Workbook warnings">
                <div className="worksheet-selector-header">
                  <div>
                    <p className="section-label">Warnings</p>
                    <h4>Review before analysis</h4>
                  </div>
                  <span className="dataset-count-pill">
                    {workbookWarningMessages.length.toLocaleString()}
                  </span>
                </div>
                <ul>
                  {workbookWarningMessages.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </section>
            )}
            <div ref={missingValuesRef} tabIndex={-1}>
              <MissingValuesOverview
                schema={Array.isArray(dataset.schema) ? dataset.schema : []}
                rowCount={dataset.row_count}
              />
            </div>
            <section
              ref={detectedColumnsRef}
              className="data-column-profile-card"
              aria-label="Column profile"
              tabIndex={-1}
            >
              <div className="worksheet-selector-header">
                <div>
                  <p className="section-label">Column profile</p>
                  <h4>Fields in this dataset</h4>
                </div>
                <span className="dataset-count-pill">{detectedColumns.length.toLocaleString()}</span>
              </div>
              <div className="data-column-profile-list">
                {detectedColumns.map((column) => (
                  <div key={column.name} className="data-column-profile-row">
                    <strong title={column.name}>{column.name}</strong>
                    <span>{column.inferred_type || "unknown"}</span>
                    <small>
                      {(column.null_count || 0) > 0
                        ? `${column.null_count.toLocaleString()} missing`
                        : "no missing"}
                    </small>
                    <small>{column.unique_count.toLocaleString()} unique</small>
                  </div>
                ))}
              </div>
            </section>
            {dataset.workbook_metadata && workbookWorksheets.length > 1 && (
              <section className="data-workbook-browser-card" aria-label="Workbook browser">
                <div className="worksheet-selector-header">
                  <div>
                    <p className="section-label">Workbook sources</p>
                    <h4>Worksheets in this workbook</h4>
                  </div>
                  <span className="dataset-count-pill">{workbookWorksheets.length.toLocaleString()}</span>
                </div>
                <WorksheetSwitcher
                  variant="dataPreview"
                  ariaLabel="Workbook worksheets"
                  className="dataset-preview-sheets data-workbook-sheets"
                  optionClassName="dataset-preview-sheet data-workbook-sheet"
                  activeClassName="active"
                  labelClassName="dataset-preview-sheet-label"
                  badgeClassName="dataset-preview-sheet-badge"
                  options={workbookWorksheets.map<WorksheetSwitcherOption>((worksheet) => {
                    const label = worksheet.displayName || worksheet.sheetName;
                    return {
                      id: worksheet.worksheetId,
                      label,
                      isActive: worksheet.worksheetId === activeWorksheet?.worksheetId,
                      disabled:
                        worksheet.status !== "ready" ||
                        worksheet.worksheetId === activeWorksheet?.worksheetId ||
                        isSwitchingWorksheet,
                      title: label,
                      ariaLabel: `${label}, ${worksheet.rowCount.toLocaleString()} rows, ${worksheet.columnCount.toLocaleString()} columns`,
                      badge: {
                        label: worksheet.status,
                        status: worksheet.status,
                        ariaHidden: true,
                      },
                    };
                  })}
                  onSelect={onWorksheetSelect}
                />
              </section>
            )}
            <div className="data-tabs-row data-actions-row">
              <div className="data-profile-actions">
                <div className="data-primary-actions">
                  <button
                    type="button"
                    className="secondary-button data-action-btn"
                    onClick={() => {
                      setPreviewOrigin(null);
                      setRequestedPreviewWorksheetId(null);
                      setIsDatasetPreviewOpen(true);
                    }}
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
                  {onAnalysisSourceSelect && (
                    <button
                      type="button"
                      className="secondary-button data-action-btn data-clean-prepare-toggle"
                      onClick={() => setIsCleanPreparePageOpen(true)}
                      title="Prepare structural fixes, column transformations, or SQL cleaning before analysis."
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
                        <path d="M3 6h18M3 12h18M3 18h12" />
                        <path d="m17 17 2 2 4-4" />
                      </svg>
                      Prepare Data
                    </button>
                  )}
                </div>
                <div className="data-danger-actions">
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
    </div>
  );
}

export default DatasetSummaryPanel;
