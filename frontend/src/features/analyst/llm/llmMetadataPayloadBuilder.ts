import type { DatasetMetadata, SchemaColumn } from "../../dataset/datasetTypes";
import type { DataProfileReport } from "../../dataIntelligence/dataProfileTypes";
import { getDatasetActiveWorksheet, getWorkbookMetadata } from "../../workbook";
import type { WorksheetMetadata, WorksheetRelationshipCandidate } from "../../workbook";
import { getDialectProfile, type SqlDialectId } from "../../sqlIntelligence";
import {
  createReportOpportunities,
  type ReportOpportunity,
} from "../sql/reportIntelligencePlanner";
import type {
  AIColumnSummary,
  AIDataProfileSummary,
  AIDeterministicReportOpportunitySummary,
  AIMetadataContextPayload,
  AIMetadataPayloadCategorySummary,
  AIMode,
  AIRelationshipCandidateSummary,
  AIWorksheetTableSummary,
} from "./llmGovernanceTypes";

export type BuildAIMetadataContextPayloadInput = {
  dataset: DatasetMetadata | null;
  selectedDialect: SqlDialectId;
  dataProfile?: DataProfileReport | null;
  mode?: Extract<AIMode, "metadata_only">;
  generatedAt?: string;
};

const confidenceLevel = (confidence: number): "Low" | "Medium" | "High" => {
  if (confidence >= 0.8) return "High";
  if (confidence >= 0.6) return "Medium";
  return "Low";
};

const missingRatio = (column: SchemaColumn, rowCount: number): number | null => {
  if (rowCount <= 0) return null;
  return Number((column.null_count / rowCount).toFixed(4));
};

const summarizeColumn = (column: SchemaColumn, rowCount: number): AIColumnSummary => ({
  name: column.name,
  type: column.type,
  inferredType: column.inferred_type,
  missing: {
    nullCount: column.null_count,
    missingRatio: missingRatio(column, rowCount),
  },
  profile: {
    uniqueCount: column.unique_count,
    hasNumericStats: Boolean(column.numeric_stats),
    hasDateRange: Boolean(column.date_range),
    hasTextLengthStats: Boolean(column.text_length_stats),
  },
});

const summarizeWorksheet = (worksheet: WorksheetMetadata): AIWorksheetTableSummary => ({
  worksheetId: worksheet.worksheetId,
  worksheetName: worksheet.sheetName,
  displayName: worksheet.displayName || worksheet.sheetName,
  trustedTableName: worksheet.tableName,
  status: worksheet.status,
  rowCount: worksheet.rowCount,
  columnCount: worksheet.columnCount,
  columns: worksheet.schema.map((column) => summarizeColumn(column, worksheet.rowCount)),
  normalizationWarnings: [
    ...worksheet.normalization.warnings,
    worksheet.normalization.headerDetectionWarning,
    worksheet.normalization.structuralColumnDetectionWarning,
  ].filter((warning): warning is string => Boolean(warning)),
});

const summarizeDatasetAsWorksheet = (dataset: DatasetMetadata): AIWorksheetTableSummary => ({
  worksheetId: null,
  worksheetName: dataset.original_filename || dataset.filename,
  displayName: dataset.original_filename || dataset.filename,
  trustedTableName: dataset.table_name,
  status: "ready",
  rowCount: dataset.row_count,
  columnCount: dataset.column_count,
  columns: dataset.schema.map((column) => summarizeColumn(column, dataset.row_count)),
  normalizationWarnings: [],
});

const summarizeRelationship = (
  candidate: WorksheetRelationshipCandidate,
): AIRelationshipCandidateSummary => ({
  relationshipId: candidate.relationshipId,
  sourceWorksheetName: candidate.sourceWorksheetName,
  sourceTable: candidate.sourceTable,
  sourceColumn: candidate.sourceColumn,
  targetWorksheetName: candidate.targetWorksheetName,
  targetTable: candidate.targetTable,
  targetColumn: candidate.targetColumn,
  confidence: candidate.confidence,
  confidenceLabel: candidate.confidenceLabel,
  relationshipType: candidate.relationshipType,
  direction: candidate.direction,
  status: candidate.status,
  reviewStatus: candidate.reviewStatus,
  evidenceSummary: {
    typeCompatible: candidate.evidence.typeCompatible,
    sampledRowCount: candidate.evidence.sampledRowCount,
    sampledOverlapRatio: candidate.evidence.sampledOverlapRatio,
    sourceUniqueRatio: candidate.evidence.sourceUniqueRatio,
    targetUniqueRatio: candidate.evidence.targetUniqueRatio,
  },
});

const summarizeDataProfile = (profile: DataProfileReport | null): AIDataProfileSummary | null => {
  if (!profile) return null;
  return {
    humanSummary: profile.humanSummary,
    analystSummary: profile.analystSummary,
    shapeLabel: profile.shape.shapeLabel,
    possibleMetrics: profile.possibleMetrics.map((field) => field.name),
    possibleDimensions: profile.possibleDimensions.map((field) => field.name),
    dateTimeFields: profile.dateTimeFields.map((field) => field.name),
    possibleIdFields: profile.possibleIdFields.map((field) => field.name),
    workbookRelationshipSummary: profile.workbookRelationshipContext.summary,
    timeSeriesSummary: profile.timeSeriesReadiness.summary,
    statisticalSummary: profile.statisticalReadiness.summary,
  };
};

const summarizeReportOpportunity = (
  opportunity: ReportOpportunity,
): AIDeterministicReportOpportunitySummary => ({
  id: opportunity.id,
  title: opportunity.title,
  businessQuestion: opportunity.businessQuestion,
  whyItMatters: opportunity.whyItMatters,
  domains: opportunity.domains,
  confidence: opportunity.confidence,
  confidenceLevel: confidenceLevel(opportunity.confidence),
  support: opportunity.support,
  method: opportunity.method,
  complexity: opportunity.complexity,
  requiredTables: opportunity.requiredTables,
  optionalTables: opportunity.optionalTables,
  requiredColumns: opportunity.requiredColumns,
  optionalColumns: opportunity.optionalColumns,
  missingRequirements: opportunity.missingRequirements,
  needsJoins: opportunity.needsJoins,
  needsAggregation: opportunity.needsAggregation,
  needsDateLogic: opportunity.needsDateLogic,
  needsAnomalyDetection: opportunity.needsAnomalyDetection,
  compiledRecipeId: opportunity.compiledRecipeId || null,
  sqlDraftIncluded: false,
});

export const buildAIMetadataContextPayload = ({
  dataset,
  selectedDialect,
  dataProfile = null,
  mode = "metadata_only",
  generatedAt = new Date().toISOString(),
}: BuildAIMetadataContextPayloadInput): AIMetadataContextPayload => {
  const workbook = getWorkbookMetadata(dataset);
  const activeWorksheet = getDatasetActiveWorksheet(dataset);
  const dialectProfile = getDialectProfile(selectedDialect);
  const worksheets = workbook
    ? workbook.worksheets.map(summarizeWorksheet)
    : dataset
      ? [summarizeDatasetAsWorksheet(dataset)]
      : [];
  const deterministicReports = dataset
    ? createReportOpportunities(dataset, selectedDialect).map(summarizeReportOpportunity)
    : [];

  return {
    schemaVersion: 1,
    provenance: {
      mode,
      generatedAt,
      source: "deterministic_metadata_builder",
      rawRowsIncluded: false,
      sampleRowsIncluded: false,
      promptTextIncluded: false,
      deterministicReportSource: "k10_report_intelligence",
      notes: [
        "Metadata-only payload. Raw rows, sample values, prompt text, and SQL drafts are excluded.",
      ],
    },
    sqlDialect: {
      id: selectedDialect,
      displayName: dialectProfile.displayName,
    },
    dataset: dataset
      ? {
          datasetId: dataset.dataset_id,
          datasetName: dataset.filename,
          originalFilename: dataset.original_filename,
          trustedActiveTableName: dataset.table_name,
          rowCount: dataset.row_count,
          columnCount: dataset.column_count,
          workbook: workbook
            ? {
                workbookId: workbook.workbookId,
                name: workbook.name,
                status: workbook.status,
                activeWorksheetId: workbook.activeWorksheetId,
                activeWorksheetName: activeWorksheet?.displayName || activeWorksheet?.sheetName || null,
                activeTrustedTableName:
                  workbook.activeAnalysisSource?.tableName || activeWorksheet?.tableName || null,
                worksheetCount: workbook.worksheets.length,
              }
            : null,
        }
      : null,
    worksheets,
    relationships: workbook ? workbook.relationshipCandidates.map(summarizeRelationship) : [],
    dataProfile: summarizeDataProfile(dataProfile),
    deterministicReports,
  };
};

export const summarizeAIMetadataPayloadCategories = (
  payload: AIMetadataContextPayload,
): AIMetadataPayloadCategorySummary => ({
  mode: payload.provenance.mode,
  rawRowsIncluded: false,
  sampleRowsIncluded: false,
  promptTextIncluded: false,
  datasetIncluded: Boolean(payload.dataset),
  worksheetCount: payload.worksheets.length,
  columnCount: payload.worksheets.reduce((sum, worksheet) => sum + worksheet.columns.length, 0),
  relationshipCandidateCount: payload.relationships.length,
  deterministicReportCount: payload.deterministicReports.length,
  profileSummaryIncluded: Boolean(payload.dataProfile),
  sqlDialect: payload.sqlDialect.id,
});
