import type { DatasetMetadata, SchemaColumn } from "../dataset/datasetTypes";
import {
  getWorkbookMetadata,
  hasSuspiciousWorkbookHeaders,
  type WorksheetMetadata,
  type WorksheetTemplateStructureEvidence,
} from "../workbook";

export type DataQualityAlertFamily =
  | "header-integrity"
  | "template-layout"
  | "missing-values"
  | "column-quality"
  | "worksheet-status";

export type DataQualityAlertSeverity = "critical" | "warning" | "info";

export type DataQualityAlertAction = "data" | "preview" | "clean-prepare";

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
};

export type DataQualityAlertSummary = {
  alerts: DataQualityAlert[];
  attentionCount: number;
  highestSeverity: DataQualityAlertSeverity | "neutral";
};

const HIGH_BLANK_THRESHOLD = 0.7;
const REPEATED_PATTERN_MIN_COLUMNS = 3;
const REPEATED_PATTERN_TOLERANCE = 0.01;

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
  worksheet: WorksheetMetadata,
  evidence: WorksheetTemplateStructureEvidence,
) => {
  const location = evidenceLocation(evidence);
  const label = evidence.label ? ` (${evidence.label})` : "";
  return `${worksheet.displayName}: ${evidence.type.replace(/_/g, " ")}${location ? `, ${location}` : ""}${label}`;
};

const getHighestSeverity = (alerts: DataQualityAlert[]) =>
  alerts.reduce<DataQualityAlertSeverity | "neutral">((highest, alert) => {
    if (highest === "neutral" || severityRank[alert.severity] > severityRank[highest]) {
      return alert.severity;
    }

    return highest;
  }, "neutral");

const hasRepeatedHighBlankPattern = (columns: SchemaColumn[], rowCount: number) => {
  if (rowCount <= 0) return false;
  const highBlankRates = columns
    .map((column) => column.null_count / rowCount)
    .filter((rate) => rate >= HIGH_BLANK_THRESHOLD);

  return (
    highBlankRates.length >= REPEATED_PATTERN_MIN_COLUMNS &&
    Math.max(...highBlankRates) - Math.min(...highBlankRates) <= REPEATED_PATTERN_TOLERANCE
  );
};

const createHeaderIntegrityAlert = (
  dataset: DatasetMetadata,
  worksheets: WorksheetMetadata[],
): DataQualityAlert | null => {
  const suspiciousHeaders = hasSuspiciousWorkbookHeaders(dataset);
  const warningWorksheets = worksheets.filter(
    (worksheet) =>
      worksheet.normalization.headerDetectionWarning ||
      worksheet.normalization.headerDetectionConfidence === "low",
  );
  const repeatedHeaderEvidence = worksheets.flatMap((worksheet) =>
    worksheet.normalization.templateStructureEvidence
      .filter((evidence) => evidence.type === "repeated_header")
      .map((evidence) => worksheetEvidenceLabel(worksheet, evidence)),
  );
  const normalizedHeaderWorksheets = worksheets.filter(
    (worksheet) =>
      worksheet.normalization.duplicateColumnCount > 0 ||
      worksheet.normalization.emptyColumnCount > 0,
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

  return {
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
  };
};

const createTemplateLayoutAlert = (worksheets: WorksheetMetadata[]): DataQualityAlert | null => {
  const candidateWorksheets = worksheets.filter(
    (worksheet) => worksheet.normalization.templateStructureCandidate,
  );
  const evidenceWorksheets = candidateWorksheets.length > 0 ? candidateWorksheets : worksheets;
  const layoutEvidence = evidenceWorksheets.flatMap((worksheet) =>
    worksheet.normalization.templateStructureEvidence
      .filter(
        (evidence) =>
          evidence.type !== "repeated_header" && evidence.type !== "clean_table_counter_signal",
      )
      .map((evidence) => worksheetEvidenceLabel(worksheet, evidence)),
  );

  if (candidateWorksheets.length === 0 && layoutEvidence.length === 0) return null;

  const affectedWorksheets = unique([
    ...candidateWorksheets.map((worksheet) => worksheet.displayName),
    ...worksheets
      .filter((worksheet) =>
        worksheet.normalization.templateStructureEvidence.some(
          (evidence) =>
            evidence.type !== "repeated_header" && evidence.type !== "clean_table_counter_signal",
        ),
      )
      .map((worksheet) => worksheet.displayName),
  ]);

  return {
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
  };
};

const createMissingValuesAlert = (dataset: DatasetMetadata): DataQualityAlert | null => {
  const missingColumns = dataset.schema
    .filter((column) => column.null_count > 0)
    .sort((left, right) => right.null_count - left.null_count);
  if (missingColumns.length === 0) return null;

  const repeatedPattern = hasRepeatedHighBlankPattern(missingColumns, dataset.row_count);
  const hasHighBlankRate = missingColumns.some(
    (column) => dataset.row_count > 0 && column.null_count / dataset.row_count >= HIGH_BLANK_THRESHOLD,
  );
  const evidence = missingColumns.slice(0, 4).map((column) => {
    const percent = dataset.row_count > 0 ? (column.null_count / dataset.row_count) * 100 : 0;
    return `${column.name}: ${column.null_count.toLocaleString()} blank values (${percent.toFixed(1)}%).`;
  });

  return {
    id: "missing-values",
    family: "missing-values",
    severity: repeatedPattern || hasHighBlankRate ? "warning" : "info",
    title: repeatedPattern ? "Repeated high blank-rate pattern detected" : "Missing values need review",
    whyItMatters: repeatedPattern
      ? "Similar blank rates across several fields may reflect template space rather than missing business data."
      : "Blank values can affect comparisons and summaries if their meaning is unclear.",
    evidence,
    affectedSummary: pluralize(missingColumns.length, "column"),
    action: "data",
    actionLabel: "Review in Data",
  };
};

const createColumnQualityAlert = (
  dataset: DatasetMetadata,
  worksheets: WorksheetMetadata[],
): DataQualityAlert | null => {
  const generatedColumns = dataset.schema
    .map((column) => column.name)
    .filter((name) => /^column_\d+(?:_\d+)?$/i.test(name.trim()));
  const structuralColumns = unique(
    worksheets.flatMap((worksheet) => worksheet.normalization.structuralColumnCandidates),
  );

  if (generatedColumns.length === 0 && structuralColumns.length === 0) return null;

  return {
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
    action: "data",
    actionLabel: "Review in Data",
  };
};

const createWorksheetStatusAlert = (worksheets: WorksheetMetadata[]): DataQualityAlert | null => {
  const unavailableWorksheets = worksheets.filter((worksheet) => worksheet.status !== "ready");
  if (unavailableWorksheets.length > 0) {
    const hasError = unavailableWorksheets.some((worksheet) => worksheet.status === "error");
    return {
      id: "worksheet-status",
      family: "worksheet-status",
      severity: hasError ? "critical" : "warning",
      title: "Some workbook sources are unavailable",
      whyItMatters: "Unavailable worksheets may leave expected records outside the active analysis table.",
      evidence: unavailableWorksheets
        .slice(0, 4)
        .map((worksheet) => `${worksheet.displayName}: ${worksheet.status}.`),
      affectedSummary: pluralize(unavailableWorksheets.length, "worksheet"),
      action: "data",
      actionLabel: "Review in Data",
    };
  }

  if (worksheets.length <= 1) return null;

  return {
    id: "worksheet-status",
    family: "worksheet-status",
    severity: "info",
    title: "Workbook contains multiple sources",
    whyItMatters: "Review worksheet scope before assuming the active table represents the full workbook.",
    evidence: [`Available worksheets: ${formatList(worksheets.map((worksheet) => worksheet.displayName))}.`],
    affectedSummary: pluralize(worksheets.length, "worksheet"),
    action: "data",
    actionLabel: "Review in Data",
  };
};

export const buildDataQualityAlertSummary = (
  dataset: DatasetMetadata | null,
): DataQualityAlertSummary => {
  if (!dataset) {
    return {
      alerts: [],
      attentionCount: 0,
      highestSeverity: "neutral",
    };
  }

  const worksheets = getWorkbookMetadata(dataset)?.worksheets || [];
  const alerts = [
    createHeaderIntegrityAlert(dataset, worksheets),
    createTemplateLayoutAlert(worksheets),
    createMissingValuesAlert(dataset),
    createColumnQualityAlert(dataset, worksheets),
    createWorksheetStatusAlert(worksheets),
  ].filter((alert): alert is DataQualityAlert => Boolean(alert));

  return {
    alerts,
    attentionCount: alerts.filter((alert) => alert.severity !== "info").length,
    highestSeverity: getHighestSeverity(alerts),
  };
};
