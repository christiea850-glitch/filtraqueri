import type { DatasetMetadata } from "../dataset/datasetTypes";
import {
  buildPreparationSignalReport,
  type PreparationSignalReport,
} from "../dataPreparation/preparationSignals";
import {
  type WorksheetTemplateStructureEvidence,
} from "../workbook";

export type DataQualityAlertFamily =
  | "header-integrity"
  | "template-layout"
  | "missing-values"
  | "column-quality"
  | "worksheet-status";

export type DataQualityAlertSeverity = "critical" | "warning" | "info";
export type DataQualityAlertState = "unresolved" | "reviewed" | "resolved" | "dismissed";

export type DataQualityAlertAction =
  | "data-overview"
  | "data-missing-values"
  | "data-columns"
  | "preview"
  | "clean-prepare";

export type DataQualityAlert = {
  id: DataQualityAlertFamily;
  family: DataQualityAlertFamily;
  severity: DataQualityAlertSeverity;
  title: string;
  whyItMatters: string;
  evidence: string[];
  affectedSummary: string;
  action: DataQualityAlertAction;
  actionLabel: string;
  scopeKeys: string[];
  resolvedScopeKeys: string[];
  state: DataQualityAlertState;
  stateSummary?: string;
};

export type DataQualityAlertSummary = {
  alerts: DataQualityAlert[];
  attentionCount: number;
  highestSeverity: DataQualityAlertSeverity | "neutral";
};

const severityRank: Record<DataQualityAlertSeverity, number> = {
  critical: 3,
  warning: 2,
  info: 1,
};

const formatList = (values: string[], limit = 3) =>
  values.length > limit
    ? `${values.slice(0, limit).join(", ")} +${values.length - limit}`
    : values.join(", ");

const pluralize = (count: number, singular: string, plural = `${singular}s`) =>
  `${count.toLocaleString()} ${count === 1 ? singular : plural}`;

const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean)));
const alertScopeKey = (
  datasetId: string,
  family: DataQualityAlertFamily,
  worksheetId?: string | null,
) => `${datasetId}:${worksheetId || "dataset"}:${family}`;

const getScopedWorksheetIds = (
  dataset: DatasetMetadata,
  worksheetIds: string[],
) => unique(worksheetIds).length > 0
  ? unique(worksheetIds)
  : [dataset.workbook_metadata?.activeWorksheetId || "dataset"];

const addAlertState = (
  dataset: DatasetMetadata,
  alert: Omit<DataQualityAlert, "scopeKeys" | "resolvedScopeKeys" | "state" | "stateSummary">,
  worksheetIds: string[],
  reviewedScopeKeys: ReadonlySet<string>,
  dismissedScopeKeys: ReadonlySet<string>,
  resolvedWorksheetIds: ReadonlySet<string> = new Set(),
): DataQualityAlert => {
  const scopedWorksheetIds = getScopedWorksheetIds(dataset, worksheetIds);
  const scopeKeys = scopedWorksheetIds.map((worksheetId) =>
    alertScopeKey(dataset.dataset_id, alert.family, worksheetId),
  );
  const resolvedScopeKeys = scopedWorksheetIds
    .filter((worksheetId) => resolvedWorksheetIds.has(worksheetId))
    .map((worksheetId) => alertScopeKey(dataset.dataset_id, alert.family, worksheetId));
  const unresolvedScopeKeys = scopeKeys.filter((key) => !resolvedScopeKeys.includes(key));
  const reviewedUnresolvedScopeKeys = unresolvedScopeKeys.filter((key) => reviewedScopeKeys.has(key));
  const dismissedUnresolvedScopeKeys = unresolvedScopeKeys.filter((key) => dismissedScopeKeys.has(key));
  const state =
    unresolvedScopeKeys.length === 0
      ? "resolved"
      : unresolvedScopeKeys.every((key) => dismissedScopeKeys.has(key))
        ? "dismissed"
      : unresolvedScopeKeys.every((key) => reviewedScopeKeys.has(key))
        ? "reviewed"
        : "unresolved";

  return {
    ...alert,
    scopeKeys,
    resolvedScopeKeys,
    state,
    stateSummary:
      resolvedScopeKeys.length + reviewedUnresolvedScopeKeys.length + dismissedUnresolvedScopeKeys.length > 0 &&
      resolvedScopeKeys.length + reviewedUnresolvedScopeKeys.length + dismissedUnresolvedScopeKeys.length < scopeKeys.length
        ? `${(resolvedScopeKeys.length + reviewedUnresolvedScopeKeys.length + dismissedUnresolvedScopeKeys.length).toLocaleString()} of ${scopeKeys.length.toLocaleString()} worksheet concerns reviewed, dismissed, or resolved`
        : undefined,
  };
};

export const getDataQualityAlertReviewKeys = (
  alert: DataQualityAlert,
  dataset: DatasetMetadata | null,
) => {
  const activeWorksheetId = dataset?.workbook_metadata?.activeWorksheetId;
  if (!activeWorksheetId) return alert.scopeKeys;

  const activeWorksheetScopeKey = alert.scopeKeys.find((key) =>
    key === alertScopeKey(dataset.dataset_id, alert.family, activeWorksheetId),
  );
  return activeWorksheetScopeKey ? [activeWorksheetScopeKey] : alert.scopeKeys;
};

const evidenceLocation = (evidence: WorksheetTemplateStructureEvidence) => {
  if (evidence.rowRange && evidence.rowRange.length >= 2) {
    return `rows ${evidence.rowRange[0] + 1}-${evidence.rowRange[1] + 1}`;
  }

  if (evidence.rowIndexes.length > 0) {
    const rows = evidence.rowIndexes.slice(0, 3).map((row) => row + 1);
    return `rows ${rows.join(", ")}${evidence.rowIndexes.length > rows.length ? ", ..." : ""}`;
  }

  if (evidence.rowIndex !== null) return `row ${evidence.rowIndex + 1}`;

  if (evidence.columnRange && evidence.columnRange.length >= 2) {
    return `columns ${evidence.columnRange[0] + 1}-${evidence.columnRange[1] + 1}`;
  }

  return "";
};

const worksheetEvidenceLabel = (
  worksheetName: string,
  evidence: WorksheetTemplateStructureEvidence,
) => {
  const location = evidenceLocation(evidence);
  const label = evidence.label ? ` (${evidence.label})` : "";
  return `${worksheetName}: ${evidence.type.replace(/_/g, " ")}${location ? `, ${location}` : ""}${label}`;
};

const getHighestSeverity = (alerts: DataQualityAlert[]) =>
  alerts.reduce<DataQualityAlertSeverity | "neutral">((highest, alert) => {
    if (highest === "neutral" || severityRank[alert.severity] > severityRank[highest]) {
      return alert.severity;
    }

    return highest;
  }, "neutral");

const createHeaderIntegrityAlert = (
  dataset: DatasetMetadata,
  report: PreparationSignalReport,
  reviewedScopeKeys: ReadonlySet<string>,
  dismissedScopeKeys: ReadonlySet<string>,
): DataQualityAlert | null => {
  const suspiciousHeaders = report.hasSuspiciousHeaders;
  const warningWorksheets = report.headerWarningWorksheets;
  const repeatedHeaderEvidence = report.templateEvidenceSignals
    .filter(({ evidence }) => evidence.type === "repeated_header")
    .map(({ worksheetName, evidence }) =>
      worksheetEvidenceLabel(worksheetName, evidence),
    );
  const normalizedHeaderWorksheets = report.normalizedHeaderWorksheets;
  const repeatedHeaderWorksheetIds = unique(
    report.templateEvidenceSignals
      .filter(({ evidence }) => evidence.type === "repeated_header")
      .map(({ worksheetId }) => worksheetId),
  );

  if (
    !suspiciousHeaders &&
    warningWorksheets.length === 0 &&
    repeatedHeaderEvidence.length === 0 &&
    normalizedHeaderWorksheets.length === 0
  ) {
    return null;
  }

  const isCritical =
    suspiciousHeaders || warningWorksheets.length > 0 || repeatedHeaderEvidence.length > 0;
  const affectedWorksheetNames = unique([
    ...warningWorksheets.map((worksheet) => worksheet.displayName),
    ...normalizedHeaderWorksheets.map((worksheet) => worksheet.displayName),
  ]);
  const evidence = unique([
    ...repeatedHeaderEvidence,
    ...warningWorksheets.map(
      (worksheet) =>
        `${worksheet.displayName}: ${worksheet.normalization.headerDetectionWarning || "Low-confidence header detection."}`,
    ),
    ...normalizedHeaderWorksheets.map(
      (worksheet) =>
        `${worksheet.displayName}: ${worksheet.normalization.duplicateColumnCount} duplicate and ${worksheet.normalization.emptyColumnCount} empty normalized headers.`,
    ),
    ...(suspiciousHeaders ? ["Active schema includes header labels that resemble data values."] : []),
  ]);

  const affectedWorksheetIds = unique([
    ...repeatedHeaderWorksheetIds,
    ...warningWorksheets.map((worksheet) => worksheet.worksheetId),
    ...normalizedHeaderWorksheets.map((worksheet) => worksheet.worksheetId),
  ]);
  const activeCleanedWorksheetId =
    dataset.workbook_metadata?.activeAnalysisSource?.type === "cleaned_working_copy"
      ? dataset.workbook_metadata.activeAnalysisSource.worksheetId
      : null;
  const resolvedWorksheetIds = new Set(
    !suspiciousHeaders && activeCleanedWorksheetId &&
    repeatedHeaderWorksheetIds.includes(activeCleanedWorksheetId) &&
    !warningWorksheets.some((worksheet) => worksheet.worksheetId === activeCleanedWorksheetId) &&
    !normalizedHeaderWorksheets.some((worksheet) => worksheet.worksheetId === activeCleanedWorksheetId)
      ? [activeCleanedWorksheetId]
      : [],
  );

  return addAlertState(dataset, {
    id: "header-integrity",
    family: "header-integrity",
    severity: isCritical ? "critical" : "warning",
    title: repeatedHeaderEvidence.length > 0 ? "Headers appear inside data rows" : "Header integrity needs review",
    whyItMatters: "Incorrect or repeated headers can distort filters, counts, and downstream analysis.",
    evidence: evidence.slice(0, 4),
    affectedSummary:
      affectedWorksheetNames.length > 0
        ? pluralize(affectedWorksheetNames.length, "worksheet")
        : "Active dataset schema",
    action: repeatedHeaderEvidence.length > 0 ? "clean-prepare" : "preview",
    actionLabel: repeatedHeaderEvidence.length > 0 ? "Review Clean & Prepare" : "Preview dataset",
  }, affectedWorksheetIds, reviewedScopeKeys, dismissedScopeKeys, resolvedWorksheetIds);
};

const createTemplateLayoutAlert = (
  dataset: DatasetMetadata,
  report: PreparationSignalReport,
  reviewedScopeKeys: ReadonlySet<string>,
  dismissedScopeKeys: ReadonlySet<string>,
): DataQualityAlert | null => {
  const candidateWorksheets = report.templateCandidateWorksheets;
  const evidenceWorksheetIds = new Set(
    (candidateWorksheets.length > 0 ? candidateWorksheets : report.worksheets).map(
      (worksheet) => worksheet.worksheetId,
    ),
  );
  const layoutEvidence = report.templateEvidenceSignals
    .filter(
      ({ worksheetId, evidence }) =>
        evidenceWorksheetIds.has(worksheetId) &&
        evidence.type !== "repeated_header" &&
        evidence.type !== "clean_table_counter_signal",
    )
    .map(({ worksheetName, evidence }) =>
      worksheetEvidenceLabel(worksheetName, evidence),
    );

  if (candidateWorksheets.length === 0 && layoutEvidence.length === 0) return null;

  const affectedWorksheets = unique([
    ...candidateWorksheets.map((worksheet) => worksheet.displayName),
    ...report.templateEvidenceSignals
      .filter(
        ({ evidence }) =>
          evidence.type !== "repeated_header" && evidence.type !== "clean_table_counter_signal",
      )
      .map(({ worksheetName }) => worksheetName),
  ]);

  const affectedWorksheetIds = unique([
    ...candidateWorksheets.map((worksheet) => worksheet.worksheetId),
    ...report.templateEvidenceSignals
      .filter(
        ({ evidence }) =>
          evidence.type !== "repeated_header" && evidence.type !== "clean_table_counter_signal",
      )
      .map(({ worksheetId }) => worksheetId),
  ]);
  const activeCleanedWorksheetId =
    dataset.workbook_metadata?.activeAnalysisSource?.type === "cleaned_working_copy"
      ? dataset.workbook_metadata.activeAnalysisSource.worksheetId
      : null;

  return addAlertState(dataset, {
    id: "template-layout",
    family: "template-layout",
    severity: candidateWorksheets.length > 0 ? "warning" : "info",
    title:
      candidateWorksheets.length > 0
        ? "Workbook template layout detected"
        : "Workbook layout context is available",
    whyItMatters: "Layout rows, placeholders, and note regions may be present in the analysis table.",
    evidence: unique(layoutEvidence).slice(0, 4),
    affectedSummary: pluralize(affectedWorksheets.length, "worksheet"),
    action: "clean-prepare",
    actionLabel: "Review Clean & Prepare",
  }, affectedWorksheetIds, reviewedScopeKeys, dismissedScopeKeys, new Set(activeCleanedWorksheetId ? [activeCleanedWorksheetId] : []));
};

const createMissingValuesAlert = (
  dataset: DatasetMetadata,
  report: PreparationSignalReport,
  reviewedScopeKeys: ReadonlySet<string>,
  dismissedScopeKeys: ReadonlySet<string>,
): DataQualityAlert | null => {
  const missingColumns = [...report.missingColumns]
    .sort((left, right) => right.null_count - left.null_count);
  if (missingColumns.length === 0) return null;

  const repeatedPattern = report.hasRepeatedHighBlankPattern;
  const hasHighBlankRate = report.hasHighBlankRate;
  const evidence = missingColumns.slice(0, 4).map((column) => {
    const percent = dataset.row_count > 0 ? (column.null_count / dataset.row_count) * 100 : 0;
    return `${column.name}: ${column.null_count.toLocaleString()} blank values (${percent.toFixed(1)}%).`;
  });

  return addAlertState(dataset, {
    id: "missing-values",
    family: "missing-values",
    severity: repeatedPattern || hasHighBlankRate ? "warning" : "info",
    title: repeatedPattern ? "Repeated high blank-rate pattern detected" : "Missing values need review",
    whyItMatters: repeatedPattern
      ? "Similar blank rates across several fields may reflect template space rather than missing business data."
      : "Blank values can affect comparisons and summaries if their meaning is unclear.",
    evidence,
    affectedSummary: pluralize(missingColumns.length, "column"),
    action: "data-missing-values",
    actionLabel: "Review missing values",
  }, [], reviewedScopeKeys, dismissedScopeKeys);
};

const createColumnQualityAlert = (
  dataset: DatasetMetadata,
  report: PreparationSignalReport,
  reviewedScopeKeys: ReadonlySet<string>,
  dismissedScopeKeys: ReadonlySet<string>,
): DataQualityAlert | null => {
  const generatedColumns = report.generatedColumns;
  const structuralColumns = report.structuralColumns;

  if (generatedColumns.length === 0 && structuralColumns.length === 0) return null;

  return addAlertState(dataset, {
    id: "column-quality",
    family: "column-quality",
    severity: "warning",
    title: "Column names need review",
    whyItMatters: "Generated or structural columns may not represent reliable business fields.",
    evidence: unique([
      ...(generatedColumns.length > 0
        ? [`Generated columns: ${formatList(generatedColumns)}.`]
        : []),
      ...(structuralColumns.length > 0
        ? [`Possible structural columns: ${formatList(structuralColumns)}.`]
        : []),
    ]),
    affectedSummary: pluralize(unique([...generatedColumns, ...structuralColumns]).length, "column"),
    action: "data-columns",
    actionLabel: "Review fields in Data",
  }, [], reviewedScopeKeys, dismissedScopeKeys);
};

const createWorksheetStatusAlert = (
  dataset: DatasetMetadata,
  report: PreparationSignalReport,
  reviewedScopeKeys: ReadonlySet<string>,
  dismissedScopeKeys: ReadonlySet<string>,
): DataQualityAlert | null => {
  const worksheets = report.worksheets;
  const unavailableWorksheets = report.unavailableWorksheets;
  if (unavailableWorksheets.length > 0) {
    const hasError = unavailableWorksheets.some((worksheet) => worksheet.status === "error");
    return addAlertState(dataset, {
      id: "worksheet-status",
      family: "worksheet-status",
      severity: hasError ? "critical" : "warning",
      title: "Some workbook sources are unavailable",
      whyItMatters: "Unavailable worksheets may leave expected records outside the active analysis table.",
      evidence: unavailableWorksheets
        .slice(0, 4)
        .map((worksheet) => `${worksheet.displayName}: ${worksheet.status}.`),
      affectedSummary: pluralize(unavailableWorksheets.length, "worksheet"),
      action: "data-overview",
      actionLabel: "Open Data overview",
    }, unavailableWorksheets.map((worksheet) => worksheet.worksheetId), reviewedScopeKeys, dismissedScopeKeys);
  }

  if (worksheets.length <= 1) return null;

  return addAlertState(dataset, {
    id: "worksheet-status",
    family: "worksheet-status",
    severity: "info",
    title: "Workbook contains multiple sources",
    whyItMatters: "Review worksheet scope before assuming the active table represents the full workbook.",
    evidence: [`Available worksheets: ${formatList(worksheets.map((worksheet) => worksheet.displayName))}.`],
    affectedSummary: pluralize(worksheets.length, "worksheet"),
    action: "data-overview",
    actionLabel: "Open Data overview",
  }, worksheets.map((worksheet) => worksheet.worksheetId), reviewedScopeKeys, dismissedScopeKeys);
};

export const buildDataQualityAlertSummary = (
  dataset: DatasetMetadata | null,
  reviewedScopeKeys: ReadonlySet<string> = new Set(),
  dismissedScopeKeys: ReadonlySet<string> = new Set(),
): DataQualityAlertSummary => {
  if (!dataset) {
    return {
      alerts: [],
      attentionCount: 0,
      highestSeverity: "neutral",
    };
  }

  const report = buildPreparationSignalReport(dataset);
  const alerts = [
    createHeaderIntegrityAlert(dataset, report, reviewedScopeKeys, dismissedScopeKeys),
    createTemplateLayoutAlert(dataset, report, reviewedScopeKeys, dismissedScopeKeys),
    createMissingValuesAlert(dataset, report, reviewedScopeKeys, dismissedScopeKeys),
    createColumnQualityAlert(dataset, report, reviewedScopeKeys, dismissedScopeKeys),
    createWorksheetStatusAlert(dataset, report, reviewedScopeKeys, dismissedScopeKeys),
  ].filter((alert): alert is DataQualityAlert => Boolean(alert));
  const unresolvedAlerts = alerts.filter((alert) => alert.state === "unresolved");

  return {
    alerts,
    attentionCount: unresolvedAlerts.filter((alert) => alert.severity !== "info").length,
    highestSeverity: getHighestSeverity(unresolvedAlerts),
  };
};
