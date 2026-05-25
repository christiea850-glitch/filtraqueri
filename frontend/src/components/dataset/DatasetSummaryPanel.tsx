import { useEffect, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { DatasetMetadata, DatasetSession } from "../../features/dataset/datasetTypes";
import { useBusinessQuestions } from "../../features/businessQuestionIntelligence";
import { useBusinessSemantics } from "../../features/businessSemantics";
import { useDataIntelligence } from "../../features/dataIntelligence";
import { useKpiIntelligence } from "../../features/kpiIntelligence";
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
import { TaskLauncherPanel } from "../../features/tasksLauncher";
import DrillInDetailPanel from "../layout/DrillInDetailPanel";
import FocusedWorkspaceShell from "../layout/FocusedWorkspaceShell";
import WorkspaceTabs from "../layout/WorkspaceTabs";
import WorkbookContextPanel from "../workbook/WorkbookContextPanel";

export type HumanIntent =
  | "summary"
  | "missing_values"
  | "top_categories"
  | "compare_columns"
  | "trends"
  | "unusual_values"
  | "simple_chart";

type HumanGuidanceCard = {
  intent: HumanIntent;
  label: string;
};

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
  | "suggestedAnalysisPaths"
  | "guidedAnalyticsTasks"
  | "businessSemantics"
  | "kpiIntelligence"
  | "businessQuestions"
  | "humanGuidance";
type DataWorkspaceCommandTarget =
  | "preview"
  | "worksheetPreview"
  | "connections"
  | "intelligence"
  | "intelligenceDetail"
  | "semantics";

const datasetIntelligenceDetailRouteId: ControlledHashDetailRouteId = "detail:dataset-intelligence";

const humanGuidanceCards: HumanGuidanceCard[] = [
  { intent: "summary", label: "Summarize" },
  { intent: "missing_values", label: "Missing values" },
  { intent: "top_categories", label: "Top categories" },
  { intent: "compare_columns", label: "Compare fields" },
  { intent: "trends", label: "Trend analysis" },
  { intent: "unusual_values", label: "Unusual values" },
  { intent: "simple_chart", label: "Visualize data" },
];

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
    <div className="worksheet-selector" aria-label="Workbook business areas">
      <div className="worksheet-selector-header">
        <div>
          <p className="section-label">Business areas</p>
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
  customers: "customer behavior",
  orders: "order activity",
  invoices: "billing activity",
  products: "product movement",
  employees: "workforce activity",
  managers: "management operations",
  transactions: "transaction activity",
  inventory: "inventory movement",
  payments: "payment activity",
  regions: "regional performance",
  unknown: "business activity",
};

const toBusinessConnectionGuidance = (connection: {
  sourceWorksheetName: string;
  targetWorksheetName: string;
  sourceColumn: string;
  targetColumn: string;
  guidance: string;
}) => {
  const source = connection.sourceWorksheetName || "One business area";
  const target = connection.targetWorksheetName || "another business area";
  const combined = `${source} ${target} ${connection.sourceColumn} ${connection.targetColumn} ${connection.guidance}`.toLowerCase();

  if (combined.includes("tenant") && combined.includes("lease")) {
    return "Tenant activity may relate to lease timelines.";
  }
  if (combined.includes("payment") && (combined.includes("tenant") || combined.includes("lease"))) {
    return "Payments appear connected to tenant or lease operations.";
  }
  if (combined.includes("property") && combined.includes("manager")) {
    return "Properties and managers likely interact operationally.";
  }
  if (combined.includes("lease") && combined.includes("payment")) {
    return "Lease activity may influence payment workflows.";
  }
  if (combined.includes("customer") && (combined.includes("order") || combined.includes("transaction"))) {
    return "Customer activity may connect to purchasing behavior.";
  }
  if (combined.includes("product") && (combined.includes("order") || combined.includes("transaction") || combined.includes("invoice"))) {
    return "Product movement may connect to sales or billing activity.";
  }
  if (combined.includes("inventory") && combined.includes("product")) {
    return "Inventory movement may relate to product performance.";
  }
  if (combined.includes("invoice") && combined.includes("payment")) {
    return "Billing activity may connect to payment movement.";
  }

  return `${source} may relate to ${target} in this operation.`;
};

function WorkbookRelationshipSummaryPanel({
  intelligence,
}: {
  intelligence: WorkbookRelationshipIntelligence;
}) {
  const [showAllConnections, setShowAllConnections] = useState(false);
  const visibleRoles = intelligence.entityRoles.slice(0, 5);
  const allConnections = intelligence.joinSuggestions;
  const visibleConnections = showAllConnections ? allConnections : allConnections.slice(0, 3);
  const detectedEntityCount = intelligence.entityRoles.filter(
    (role) => role.role !== "unknown",
  ).length;
  const workbookNarrativeSummary =
    allConnections.length > 0
      ? "FiltraQueri found business areas that may describe the same operation from different angles."
      : intelligence.humanSummary;
  const formatConfidence = (value: string) =>
    value ? `${value.charAt(0).toUpperCase()}${value.slice(1)} confidence` : "Confidence";

  return (
    <section className="workbook-intelligence-panel" aria-label="Connected business operations">
      <div className="workbook-intelligence-heading">
        <div>
          <p className="section-label">Connected operations</p>
          <h3>Business areas that may work together</h3>
          <p>{workbookNarrativeSummary}</p>
        </div>
        <span>{intelligence.complexity}</span>
      </div>
      <div className="workbook-intelligence-strip" aria-label="Business connection summary">
        <span>
          Operational links
          <strong>{intelligence.joinSuggestions.length.toLocaleString()}</strong>
        </span>
        <span>
          Business areas
          <strong>{detectedEntityCount.toLocaleString()}</strong>
        </span>
        <span>
          Suggested start
          <strong>{intelligence.recommendedStartingWorksheetName || "Current sheet"}</strong>
        </span>
      </div>
      {visibleConnections.length > 0 && (
        <div className="workbook-connection-list" aria-label="Likely business connections">
          {visibleConnections.map((connection) => (
            <article key={connection.id}>
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
              <p className="workbook-connection-text">{toBusinessConnectionGuidance(connection)}</p>
              <span className={`workbook-connection-confidence is-${connection.confidence}`}>
                {formatConfidence(connection.confidence)}
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
        <div className="workbook-entity-list" aria-label="Detected business areas">
          {visibleRoles.map((role) => (
            <span key={role.worksheetId} title={role.reasons.join(" ")}>
              {workbookRoleLabels[role.role]}
              <strong>{role.worksheetName}</strong>
            </span>
          ))}
        </div>
        {allConnections.length > 3 && (
          <button
            type="button"
            className="workbook-view-all"
            onClick={() => setShowAllConnections((current) => !current)}
          >
            {showAllConnections ? "Show fewer" : "View all business links"}
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
  onHumanIntentSelect,
  onOpenDataset,
  onDeleteDataset,
  onWorksheetSelect,
  isSwitchingWorksheet,
  selectedTaskId,
  onSelectedTaskIdChange,
}: DatasetSummaryPanelProps) {
  const [activeDrillInView, setActiveDrillInView] = useState<DataDrillInView>("overview");
  const [activeWorkflowMenu, setActiveWorkflowMenu] = useState<DataWorkflowMenu | null>(null);
  const [activeFocusedWorkflow, setActiveFocusedWorkflow] = useState<DataFocusedWorkflow | null>(null);
  const [isDatasetIntelligenceDetailOpen, setIsDatasetIntelligenceDetailOpen] = useState(false);
  const [isDatasetPreviewOpen, setIsDatasetPreviewOpen] = useState(false);
  const createSchemaTypeSummary = (metadata: DatasetMetadata) =>
    (Array.isArray(metadata.schema) ? metadata.schema : []).reduce<Record<string, number>>((summary, column) => {
      const type = column.inferred_type || "unknown";
      summary[type] = (summary[type] || 0) + 1;
      return summary;
    }, {});
  const workbookWorksheets = listWorkbookWorksheets(dataset);
  const activeWorksheet = getDatasetActiveWorksheet(dataset);
  const workbookRelationshipIntelligence = buildWorkbookRelationshipIntelligence(dataset?.workbook_metadata);
  const { dataProfile, dialectRecommendation, humanSummary } = useDataIntelligence(dataset);
  const {
    recommendations,
    humanSummary: workflowSummary,
    workflowRecommendationReport,
  } = useWorkflowRecommendations({
    dataProfile,
    dialectRecommendation,
  });
  const {
    businessSemanticReport,
    detectedSemanticEntities,
    possibleBusinessKpis,
    humanSummary: semanticSummary,
  } = useBusinessSemantics({
    dataset,
    dataProfile,
    workflowRecommendationReport,
  });
  const {
    opportunities: kpiOpportunities,
    kpiIntelligenceReport,
    humanSummary: kpiSummary,
  } = useKpiIntelligence({
    dataProfile,
    businessSemanticReport,
    workflowRecommendationReport,
  });
  const {
    interpretedQuestions,
    humanSummary: questionSummary,
  } = useBusinessQuestions({
    datasetId: dataset?.dataset_id || null,
    questions: [
      "Which products sell the most?",
      "Are sales increasing?",
      "Which regions perform best?",
      "Can this data support forecasting?",
      "Which customers generate the most revenue?",
    ],
    businessSemanticReport,
    kpiIntelligenceReport,
    workflowRecommendationReport,
  });
  const schemaTypeSummary = dataset ? createSchemaTypeSummary(dataset) : {};
  const detectedColumns = Array.isArray(dataset?.schema) ? dataset.schema : [];
  const displayColumnProfiles = createSchemaDisplayProfiles(detectedColumns);
  const semanticHints = displayColumnProfiles.filter((profile) => profile.role).slice(0, 5);
  const businessEntityHints = displayColumnProfiles
    .filter((profile) => profile.role === "customer" || profile.role === "description" || profile.role === "identifier")
    .slice(0, 3);
  const datasetPurposeLabel =
    semanticHints.some((profile) => profile.role === "customer") &&
    (dataProfile?.possibleMetrics.length || 0) > 0
      ? "This looks like customer transaction and sales data."
      : (dataProfile?.possibleMetrics.length || 0) > 0 && (dataProfile?.dateTimeFields.length || 0) > 0
        ? "This looks like business activity data with values over time."
        : (dataProfile?.possibleMetrics.length || 0) > 0
          ? "This looks like operational data with measurable business values."
          : "FiltraQueri found structure it can help you investigate.";
  const understandingSignals = [
    businessEntityHints[0] ? `Business entity: ${businessEntityHints[0].displayName}` : null,
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
      ...(dataProfile?.possibleMetrics.length ? ["measurable business movement"] : []),
      ...(dataProfile?.dateTimeFields.length ? ["activity over time"] : []),
      ...(businessEntityHints.length ? ["customer or entity behavior"] : []),
      ...(dataProfile?.possibleDimensions.length ? ["segment and category patterns"] : []),
      ...workbookActivityLabels,
    ]),
  ).slice(0, 6);
  const businessNarrative =
    businessActivityLabels.length > 0
      ? `FiltraQueri sees signals of ${businessActivityLabels.slice(0, 3).join(", ")}. These patterns can help frame what to investigate before anyone has to inspect the raw sheet.`
      : "FiltraQueri is building a business picture from this dataset so you can decide what is worth investigating first.";
  const businessSignals = [
    dataProfile?.possibleMetrics.length
      ? {
          title: "Financial or measurable activity detected",
          detail: `${dataProfile.possibleMetrics[0].name} may help explain business movement.`,
        }
      : null,
    dataProfile?.dateTimeFields.length
      ? {
          title: "Timeline available for trend questions",
          detail: `${dataProfile.dateTimeFields[0].name} can help organize activity over time.`,
        }
      : {
          title: "Timeline needs review",
          detail: "Trend investigations may need a clearer date field.",
        },
    businessEntityHints.length
      ? {
          title: "Entity behavior patterns detected",
          detail: `${businessEntityHints[0].displayName} may represent who or what the activity is about.`,
        }
      : null,
    (workbookRelationshipIntelligence?.joinSuggestions.length || 0) > 0
      ? {
          title: "Connected operations likely present",
          detail: "Multiple sheets may describe related parts of the same business flow.",
        }
      : null,
    dataProfile?.possibleDimensions.length
      ? {
          title: "Useful comparison groups found",
          detail: `${dataProfile.possibleDimensions[0].name} may help compare segments or categories.`,
        }
      : null,
  ].filter(Boolean) as Array<{ title: string; detail: string }>;
  const opportunityLabels = Array.from(
    new Set([
      ...(dataProfile?.timeSeriesReadiness.ready ? ["Revenue trends"] : []),
      ...(dataProfile?.statisticalReadiness.ready ? ["Top-performing categories"] : []),
      ...(businessEntityHints.length > 0 ? ["Customer or entity patterns"] : []),
      ...recommendations.slice(0, 2).map((recommendation) => recommendation.label),
      ...kpiOpportunities.slice(0, 2).map((opportunity) => opportunity.label),
      ...interpretedQuestions.slice(0, 2).map((question) => question.questionText),
    ]),
  ).slice(0, 5);
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
      kpiOpportunities[0]?.label ||
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
    setActiveWorkflowMenu(null);
    setActiveFocusedWorkflow(workflow);
    setActiveDrillInView(
      workflow === "dataIntelligence" ||
        workflow === "suggestedAnalysisPaths" ||
        workflow === "guidedAnalyticsTasks"
        ? "dataIntelligence"
        : "businessSemantics",
    );
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

      if (target === "connections") {
        setIsDatasetPreviewOpen(false);
        setIsDatasetIntelligenceDetailOpen(false);
        setActiveFocusedWorkflow(null);
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

  return (
    <div className="human-dataset-workspace">
      {!activeFocusedWorkflow && (
      <section className="dataset-hub-panel" aria-label="Dataset management hub">
        <div className="data-page-head">
          <div>
            <p className="section-label">Data</p>
            <h2>Data</h2>
            <p>Understand what this data may represent and choose what to investigate next.</p>
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
            <div className="data-context-card" aria-label="Dataset context">
              <span className="data-context-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M3 9h18M3 15h18M9 3v18" />
                </svg>
              </span>
              <div className="data-context-item data-context-item--name">
                <small>Dataset</small>
                <strong title={dataset.original_filename}>{dataset.original_filename}</strong>
              </div>
              <div className="data-context-item">
                <small>Active area</small>
                <strong>
                  {activeWorksheet?.displayName || activeWorksheet?.sheetName || "Dataset table"}
                </strong>
              </div>
              <div className="data-context-item">
                <small>Rows</small>
                <strong>{dataset.row_count.toLocaleString()}</strong>
              </div>
              <div className="data-context-item">
                <small>Columns</small>
                <strong>{dataset.column_count.toLocaleString()}</strong>
              </div>
            </div>
            <section className="human-understanding-panel" aria-label="What FiltraQueri noticed">
              <div>
                <p className="section-label">What FiltraQueri noticed</p>
                <h3>{datasetPurposeLabel}</h3>
                <p>
                  FiltraQueri is looking for business opportunities in this dataset, not just field names.
                </p>
              </div>
              <div className="human-understanding-grid">
                {understandingSignals.map((signal) => (
                  <span key={signal}>{signal}</span>
                ))}
              </div>
              {opportunityLabels.length > 0 && (
                <div className="human-opportunity-row">
                  <strong>You may be able to investigate</strong>
                  <div>
                    {opportunityLabels.map((label) => (
                      <button
                        type="button"
                        key={label}
                        onClick={() => openFocusedWorkflow("suggestedAnalysisPaths")}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>
            <section className="business-narrative-panel" aria-label="Business understanding">
              <div>
                <p className="section-label">Business context</p>
                <h3>What may matter operationally</h3>
                <p>{businessNarrative}</p>
              </div>
              {businessActivityLabels.length > 0 && (
                <div className="business-activity-list" aria-label="Possible business activities detected">
                  {businessActivityLabels.map((activity) => (
                    <span key={activity}>{activity}</span>
                  ))}
                </div>
              )}
            </section>
            <section className="business-signals-panel" aria-label="Business signals found">
              <div className="business-signals-heading">
                <p className="section-label">Business signals found</p>
                <strong>Useful patterns to investigate</strong>
              </div>
              <div className="business-signal-grid">
                {businessSignals.map((signal) => (
                  <span key={signal.title}>
                    <strong>{signal.title}</strong>
                    <small>{signal.detail}</small>
                  </span>
                ))}
              </div>
            </section>
            <div className="data-stat-row" aria-label="Dataset profile">
              <article className="data-stat data-stat--rows">
                <div className="data-stat-top">
                  <span className="data-stat-ic" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  </span>
                  <span className="data-stat-lbl">Rows</span>
                </div>
                <strong className="data-stat-num">
                  <CountUp value={dataset.row_count} />
                </strong>
                <span className="data-stat-sub">Total rows of data</span>
                <svg
                  className="data-stat-spark"
                  viewBox="0 0 64 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="2,17 13,11 24,14 35,7 46,12 62,4" />
                </svg>
              </article>
              <article className="data-stat data-stat--columns">
                <div className="data-stat-top">
                  <span className="data-stat-ic" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M6 4v16M12 4v16M18 4v16" />
                    </svg>
                  </span>
                  <span className="data-stat-lbl">Columns</span>
                </div>
                <strong className="data-stat-num">
                  <CountUp value={dataset.column_count} />
                </strong>
                <span className="data-stat-sub">Total columns in dataset</span>
                <svg
                  className="data-stat-spark"
                  viewBox="0 0 64 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="2,14 13,16 24,8 35,12 46,5 62,9" />
                </svg>
              </article>
              <article className="data-stat data-stat--worksheets">
                <div className="data-stat-top">
                  <span className="data-stat-ic" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="4" y="8" width="12" height="12" rx="2" />
                      <path d="M8 8V4h12v12h-4" />
                    </svg>
                  </span>
                  <span className="data-stat-lbl">Sources</span>
                </div>
                <strong className="data-stat-num">
                  <CountUp value={workbookWorksheets.length} />
                </strong>
                <span className="data-stat-sub">Available source areas</span>
                <svg
                  className="data-stat-spark"
                  viewBox="0 0 64 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="2,8 13,14 24,10 35,16 46,9 62,13" />
                </svg>
              </article>
              <article className="data-stat data-stat--types">
                <div className="data-stat-top">
                  <span className="data-stat-ic" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="8" cy="8" r="4" />
                      <rect x="13" y="4" width="7" height="7" rx="1.5" />
                      <path d="M8 14l5 6H3z" />
                    </svg>
                  </span>
                  <span className="data-stat-lbl">Field mix</span>
                </div>
                <strong className="data-stat-num">
                  <CountUp value={Object.keys(schemaTypeSummary).length} />
                </strong>
                <span className="data-stat-sub">Supporting structure</span>
                <svg
                  className="data-stat-spark"
                  viewBox="0 0 64 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="2,18 13,9 24,13 35,6 46,11 62,5" />
                </svg>
              </article>
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
                    <div className="data-workflow-menu" role="menu" aria-label="Investigation opportunities">
                      <button type="button" role="menuitem" onClick={() => openFocusedWorkflow("dataIntelligence")}>
                        <strong>What FiltraQueri noticed</strong>
                        <span>Review business signals, useful fields, and investigation fit.</span>
                      </button>
                      <button type="button" role="menuitem" onClick={() => openFocusedWorkflow("suggestedAnalysisPaths")}>
                        <strong>Suggested investigations</strong>
                        <span>See promising questions and opportunities for this dataset.</span>
                      </button>
                      <button type="button" role="menuitem" onClick={() => openFocusedWorkflow("guidedAnalyticsTasks")}>
                        <strong>Explore opportunities</strong>
                        <span>Choose a business goal and let FiltraQueri guide setup.</span>
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
                    Questions
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
                    <div className="data-workflow-menu" role="menu" aria-label="Business questions">
                      <button type="button" role="menuitem" onClick={() => openFocusedWorkflow("businessSemantics")}>
                        <strong>Business meaning</strong>
                        <span>See what FiltraQueri thinks these fields represent.</span>
                      </button>
                      <button type="button" role="menuitem" onClick={() => openFocusedWorkflow("kpiIntelligence")}>
                        <strong>Possible KPIs</strong>
                        <span>Review business measurements and insight opportunities.</span>
                      </button>
                      <button type="button" role="menuitem" onClick={() => openFocusedWorkflow("businessQuestions")}>
                        <strong>Business questions</strong>
                        <span>See questions this dataset may help answer.</span>
                      </button>
                      <button type="button" role="menuitem" onClick={() => openFocusedWorkflow("humanGuidance")}>
                        <strong>Next steps</strong>
                        <span>Choose a simple business investigation move.</span>
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
            {activeDrillInView === "overview" && workbookRelationshipIntelligence && (
              <WorkbookRelationshipSummaryPanel intelligence={workbookRelationshipIntelligence} />
            )}
          </div>
        ) : (
          <div className="dataset-empty-guidance">
            <p>No dataset open. Choose a CSV or Excel workbook so FiltraQueri can start finding the business story.</p>
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
          summary="Switch worksheets without leaving the Data workspace."
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
          eyebrow="Business understanding"
          title="What FiltraQueri noticed"
          summary={humanSummary}
          onBack={closeDrillIn}
          backLabel="Back to Data"
        >
        <section className="data-intelligence-panel" aria-label="Dataset understanding">
          <div className="summary-header">
            <div>
              <p className="section-label">Dataset understanding</p>
              <h2>Business signals FiltraQueri can use</h2>
              <p>{humanSummary}</p>
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

      {dataset && activeFocusedWorkflow === "suggestedAnalysisPaths" && (
        <DrillInDetailPanel
          eyebrow="Explore opportunities"
          title="Suggested investigations"
          summary={workflowSummary}
          onBack={closeDrillIn}
          backLabel="Back to Data"
        >
        <section className="workflow-recommendation-panel" aria-label="Suggested investigations">
          <div className="summary-header">
            <div>
              <p className="section-label">Investigation ideas</p>
              <h2>Promising questions to explore</h2>
              <p>{workflowSummary}</p>
            </div>
            <span className="dataset-count-pill">{recommendations.length}</span>
          </div>
          <div className="workflow-recommendation-list">
            {recommendations.slice(0, 4).map((recommendation) => (
              <article className="workflow-recommendation-card" key={recommendation.id}>
                <strong>{recommendation.label}</strong>
                <p>{recommendation.humanSummary}</p>
                <div>
                  <small>{recommendation.confidence} confidence</small>
                  <small>{recommendation.possibleFutureResultShapes[0]?.replace(/_/g, " ") || "preview idea"}</small>
                </div>
              </article>
            ))}
          </div>
          {recommendations.length === 0 && (
            <p className="compact-empty">No suggested investigations are available for this dataset yet.</p>
          )}
        </section>
        </DrillInDetailPanel>
      )}

      {dataset && activeFocusedWorkflow === "businessSemantics" && (
        <DrillInDetailPanel
          eyebrow="Business meaning"
          title="Business meaning"
          summary={semanticSummary || "Business context is derived from the available data profile."}
          onBack={closeDrillIn}
          backLabel="Back to Data"
        >
        {businessSemanticReport && (
        <section className="business-semantics-panel" aria-label="Business meaning">
          <div className="summary-header">
            <div>
              <p className="section-label">Business meaning</p>
              <h2>Detected business context</h2>
              <p>{semanticSummary}</p>
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
          {possibleBusinessKpis.length > 0 && (
            <div className="business-kpi-list">
              <span>Possible KPIs</span>
              {possibleBusinessKpis.slice(0, 5).map((kpi) => (
                <small key={kpi.id}>{kpi.label}</small>
              ))}
            </div>
          )}
        </section>
        )}
        {!businessSemanticReport && (
          <p className="compact-empty">No business context is available for this dataset yet.</p>
        )}
        </DrillInDetailPanel>
      )}

      {dataset && activeFocusedWorkflow === "kpiIntelligence" && (
        <DrillInDetailPanel
          eyebrow="Business opportunities"
          title="Possible KPIs"
          summary={kpiSummary}
          onBack={closeDrillIn}
          backLabel="Back to Data"
        >
        <section className="kpi-intelligence-panel" aria-label="Possible KPI opportunities">
          <div className="summary-header">
            <div>
              <p className="section-label">Possible KPIs</p>
              <h2>Insight opportunities</h2>
              <p>{kpiSummary}</p>
            </div>
            <span className="dataset-count-pill">{kpiOpportunities.length}</span>
          </div>
          <div className="kpi-opportunity-list">
            {kpiOpportunities.slice(0, 4).map((opportunity) => (
              <article className="kpi-opportunity-card" key={opportunity.id}>
                <strong>{opportunity.label}</strong>
                <p>{opportunity.humanSummary}</p>
                <div>
                  <small>{opportunity.confidence} confidence</small>
                  <small>{opportunity.possibleChartTypes[0]?.replace(/_/g, " ") || "chart option"}</small>
                </div>
              </article>
            ))}
          </div>
          {kpiOpportunities.length === 0 && (
            <p className="compact-empty">No KPI opportunities are available for this dataset yet.</p>
          )}
        </section>
        </DrillInDetailPanel>
      )}

      {dataset && activeFocusedWorkflow === "businessQuestions" && (
        <DrillInDetailPanel
          eyebrow="Business detail"
          title="Business questions"
          summary={questionSummary}
          onBack={closeDrillIn}
          backLabel="Back to Data"
        >
        <section className="business-question-panel" aria-label="Business question intelligence">
          <div className="summary-header">
            <div>
              <p className="section-label">Business questions</p>
              <h2>Question intent mapping</h2>
              <p>{questionSummary}</p>
            </div>
            <span className="dataset-count-pill">{interpretedQuestions.length}</span>
          </div>
          <div className="business-question-list">
            {interpretedQuestions.slice(0, 4).map((interpretation) => (
              <article className="business-question-card" key={interpretation.id}>
                <strong>{interpretation.questionText}</strong>
                <p>{interpretation.humanSummary}</p>
                <div>
                  <small>{interpretation.confidence} confidence</small>
                  <small>{interpretation.detectedIntentCategory.replace(/_/g, " ")}</small>
                </div>
              </article>
            ))}
          </div>
          {interpretedQuestions.length === 0 && (
            <p className="compact-empty">No business questions are available for this dataset yet.</p>
          )}
        </section>
        </DrillInDetailPanel>
      )}

      {dataset && activeFocusedWorkflow === "guidedAnalyticsTasks" && (
        <DrillInDetailPanel
          eyebrow="Explore opportunities"
          title="Suggested investigations"
          summary="Choose a business goal and let FiltraQueri guide the setup."
          onBack={closeDrillIn}
          backLabel="Back to Data"
        >
        <TaskLauncherPanel
          dataset={dataset}
          selectedTaskId={selectedTaskId}
          onSelectedTaskIdChange={onSelectedTaskIdChange}
        />
        </DrillInDetailPanel>
      )}

      {dataset && activeFocusedWorkflow === "humanGuidance" && (
        <DrillInDetailPanel
          eyebrow="Next steps"
          title="Next investigation move"
          summary="Choose a simple business direction to continue."
          onBack={closeDrillIn}
          backLabel="Back to Data"
        >
        <section className="human-guidance-panel" aria-label="Human mode data guidance">
          <div>
            <p className="section-label">Investigation guidance</p>
            <h2>Choose what to explore next</h2>
          </div>
          <div className="human-suggestion-grid">
            {humanGuidanceCards.map((suggestion) => (
              <button
                type="button"
                key={suggestion.intent}
                onClick={() => onHumanIntentSelect(suggestion.intent)}
              >
                <strong>{suggestion.label}</strong>
                <span>Human Mode</span>
              </button>
            ))}
          </div>
        </section>
        </DrillInDetailPanel>
      )}
    </div>
  );
}

export default DatasetSummaryPanel;
