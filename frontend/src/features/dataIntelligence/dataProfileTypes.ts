import type { SchemaColumn } from "../dataset/datasetTypes";

export type DataProfileColumnTypeSummary = {
  text: number;
  numeric: number;
  date: number;
  boolean: number;
  categorical: number;
  unknown: number;
};

export type DataProfileFieldSignal = {
  name: string;
  inferredType: SchemaColumn["inferred_type"];
  confidence: "low" | "moderate" | "high";
  reasons: string[];
};

export type DataProfileShape = {
  rowCount: number;
  columnCount: number;
  worksheetCount: number;
  shapeLabel: "empty" | "small_table" | "wide_table" | "large_table" | "workbook";
};

export type WorkbookRelationshipContextSignal = {
  hasWorkbookContext: boolean;
  worksheetCount: number;
  relationshipCandidateCount: number;
  acceptedRelationshipCount: number;
  summary: string;
};

export type TimeSeriesReadinessSignal = {
  ready: boolean;
  dateFieldCount: number;
  metricFieldCount: number;
  candidateDateFields: string[];
  summary: string;
};

export type StatisticalReadinessSignal = {
  ready: boolean;
  numericFieldCount: number;
  categoricalFieldCount: number;
  candidateMetricFields: string[];
  summary: string;
};

export type DataProfileReport = {
  datasetId: string;
  datasetName: string;
  shape: DataProfileShape;
  detectedColumnTypes: DataProfileColumnTypeSummary;
  numericFields: DataProfileFieldSignal[];
  categoricalFields: DataProfileFieldSignal[];
  dateTimeFields: DataProfileFieldSignal[];
  possibleIdFields: DataProfileFieldSignal[];
  possibleMetrics: DataProfileFieldSignal[];
  possibleDimensions: DataProfileFieldSignal[];
  workbookRelationshipContext: WorkbookRelationshipContextSignal;
  timeSeriesReadiness: TimeSeriesReadinessSignal;
  statisticalReadiness: StatisticalReadinessSignal;
  humanSummary: string;
  analystSummary: string;
};
