import type { DatasetMetadata, SchemaColumn } from "../dataset/datasetTypes";
import {
  getWorkbookMetadata,
  hasSuspiciousWorkbookHeaders,
  type WorksheetMetadata,
  type WorksheetStatus,
  type WorksheetTemplateStructureEvidence,
  type WorksheetTemplateStructureEvidenceType,
} from "../workbook";

export type PreparationSignalFamily =
  | "header-integrity"
  | "template-layout"
  | "missing-values"
  | "column-quality"
  | "worksheet-status";

export type PreparationSignalKind =
  | "template_candidate"
  | WorksheetTemplateStructureEvidenceType
  | "missing_values"
  | "generated_columns"
  | "structural_columns"
  | "header_detection_warning"
  | "normalized_header_quality"
  | "worksheet_status"
  | "multiple_worksheets";

export type PreparationSignal = {
  id: string;
  kind: PreparationSignalKind;
  family: PreparationSignalFamily;
  source: "active-schema" | "worksheet-metadata" | "h3a-evidence";
  worksheetId?: string;
  worksheetName?: string;
  columnNames?: string[];
  worksheetStatus?: WorksheetStatus;
  evidence?: WorksheetTemplateStructureEvidence;
  explanation: string;
};

export type WorksheetEvidenceSignal = PreparationSignal & {
  source: "h3a-evidence";
  worksheetId: string;
  worksheetName: string;
  evidence: WorksheetTemplateStructureEvidence;
};

export type PreparationSignalReport = {
  signals: PreparationSignal[];
  worksheets: WorksheetMetadata[];
  templateCandidateWorksheets: WorksheetMetadata[];
  templateEvidenceSignals: WorksheetEvidenceSignal[];
  missingColumns: SchemaColumn[];
  highBlankColumns: SchemaColumn[];
  generatedColumns: string[];
  structuralColumns: string[];
  headerWarningWorksheets: WorksheetMetadata[];
  normalizedHeaderWorksheets: WorksheetMetadata[];
  unavailableWorksheets: WorksheetMetadata[];
  hasSuspiciousHeaders: boolean;
  hasRepeatedHighBlankPattern: boolean;
  hasHighBlankRate: boolean;
};

const HIGH_BLANK_THRESHOLD = 0.7;
const REPEATED_PATTERN_MIN_COLUMNS = 3;
const REPEATED_PATTERN_TOLERANCE = 0.01;
const generatedColumnPattern = /^column_\d+(?:_\d+)?$/i;

const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean)));

const getEvidenceFamily = (
  type: WorksheetTemplateStructureEvidenceType,
): PreparationSignalFamily => (type === "repeated_header" ? "header-integrity" : "template-layout");

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

export const buildPreparationSignalReport = (
  dataset: DatasetMetadata,
): PreparationSignalReport => {
  const worksheets = getWorkbookMetadata(dataset)?.worksheets || [];
  const signals: PreparationSignal[] = [];

  const templateCandidateWorksheets = worksheets.filter(
    (worksheet) => worksheet.normalization.templateStructureCandidate,
  );
  templateCandidateWorksheets.forEach((worksheet) => {
    signals.push({
      id: `worksheet:${worksheet.worksheetId}:template-candidate`,
      kind: "template_candidate",
      family: "template-layout",
      source: "worksheet-metadata",
      worksheetId: worksheet.worksheetId,
      worksheetName: worksheet.displayName,
      explanation: `Template structure candidate with ${worksheet.normalization.templateStructureConfidence} confidence.`,
    });
  });

  const templateEvidenceSignals = worksheets.flatMap((worksheet) =>
    worksheet.normalization.templateStructureEvidence.map<WorksheetEvidenceSignal>(
      (evidence, index) => ({
        id: `${worksheet.worksheetId}:${evidence.type}:${index}`,
        kind: evidence.type,
        family: getEvidenceFamily(evidence.type),
        source: "h3a-evidence",
        worksheetId: worksheet.worksheetId,
        worksheetName: worksheet.displayName,
        evidence,
        explanation: evidence.explanation,
      }),
    ),
  );
  signals.push(...templateEvidenceSignals);

  const missingColumns = dataset.schema.filter((column) => column.null_count > 0);
  const highBlankColumns = missingColumns.filter(
    (column) =>
      dataset.row_count > 0 && column.null_count / dataset.row_count >= HIGH_BLANK_THRESHOLD,
  );
  const repeatedHighBlankPattern = hasRepeatedHighBlankPattern(missingColumns, dataset.row_count);
  if (missingColumns.length > 0) {
    signals.push({
      id: "dataset:missing-values",
      kind: "missing_values",
      family: "missing-values",
      source: "active-schema",
      columnNames: missingColumns.map((column) => column.name),
      explanation: `${missingColumns.length} active fields contain blank values.`,
    });
  }
  if (repeatedHighBlankPattern) {
    signals.push({
      id: "dataset:repeated-high-blank-rate",
      kind: "repeated_missing_pattern",
      family: "missing-values",
      source: "active-schema",
      columnNames: highBlankColumns.map((column) => column.name),
      explanation: `${highBlankColumns.length} active fields share a mostly blank pattern.`,
    });
  }

  const generatedColumns = dataset.schema
    .map((column) => column.name)
    .filter((name) => generatedColumnPattern.test(name.trim()));
  if (generatedColumns.length > 0) {
    signals.push({
      id: "dataset:generated-columns",
      kind: "generated_columns",
      family: "column-quality",
      source: "active-schema",
      columnNames: generatedColumns,
      explanation: `${generatedColumns.length} active fields use generated names.`,
    });
  }

  const structuralColumns = unique(
    worksheets.flatMap((worksheet) => worksheet.normalization.structuralColumnCandidates),
  );
  if (structuralColumns.length > 0) {
    signals.push({
      id: "dataset:structural-columns",
      kind: "structural_columns",
      family: "column-quality",
      source: "worksheet-metadata",
      columnNames: structuralColumns,
      explanation: `${structuralColumns.length} fields may represent worksheet structure.`,
    });
  }

  const hasSuspiciousHeaders = hasSuspiciousWorkbookHeaders(dataset);
  if (hasSuspiciousHeaders) {
    signals.push({
      id: "dataset:suspicious-headers",
      kind: "header_detection_warning",
      family: "header-integrity",
      source: "active-schema",
      explanation: "Active schema includes header labels that resemble data values.",
    });
  }

  const headerWarningWorksheets = worksheets.filter(
    (worksheet) =>
      worksheet.normalization.headerDetectionWarning ||
      worksheet.normalization.headerDetectionConfidence === "low",
  );
  headerWarningWorksheets.forEach((worksheet) => {
    signals.push({
      id: `worksheet:${worksheet.worksheetId}:header-detection-warning`,
      kind: "header_detection_warning",
      family: "header-integrity",
      source: "worksheet-metadata",
      worksheetId: worksheet.worksheetId,
      worksheetName: worksheet.displayName,
      explanation:
        worksheet.normalization.headerDetectionWarning || "Low-confidence header detection.",
    });
  });

  const normalizedHeaderWorksheets = worksheets.filter(
    (worksheet) =>
      worksheet.normalization.duplicateColumnCount > 0 ||
      worksheet.normalization.emptyColumnCount > 0,
  );
  normalizedHeaderWorksheets.forEach((worksheet) => {
    signals.push({
      id: `worksheet:${worksheet.worksheetId}:normalized-header-quality`,
      kind: "normalized_header_quality",
      family: "header-integrity",
      source: "worksheet-metadata",
      worksheetId: worksheet.worksheetId,
      worksheetName: worksheet.displayName,
      explanation: `${worksheet.normalization.duplicateColumnCount} duplicate and ${worksheet.normalization.emptyColumnCount} empty normalized headers.`,
    });
  });

  const unavailableWorksheets = worksheets.filter((worksheet) => worksheet.status !== "ready");
  unavailableWorksheets.forEach((worksheet) => {
    signals.push({
      id: `worksheet:${worksheet.worksheetId}:status`,
      kind: "worksheet_status",
      family: "worksheet-status",
      source: "worksheet-metadata",
      worksheetId: worksheet.worksheetId,
      worksheetName: worksheet.displayName,
      worksheetStatus: worksheet.status,
      explanation: `Worksheet status is ${worksheet.status}.`,
    });
  });
  if (worksheets.length > 1) {
    signals.push({
      id: "workbook:multiple-worksheets",
      kind: "multiple_worksheets",
      family: "worksheet-status",
      source: "worksheet-metadata",
      explanation: `Workbook contains ${worksheets.length} worksheets.`,
    });
  }

  return {
    signals,
    worksheets,
    templateCandidateWorksheets,
    templateEvidenceSignals,
    missingColumns,
    highBlankColumns,
    generatedColumns,
    structuralColumns,
    headerWarningWorksheets,
    normalizedHeaderWorksheets,
    unavailableWorksheets,
    hasSuspiciousHeaders,
    hasRepeatedHighBlankPattern: repeatedHighBlankPattern,
    hasHighBlankRate: highBlankColumns.length > 0,
  };
};
