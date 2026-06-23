import type { DatasetMetadata, SchemaColumn } from "../../dataset/datasetTypes";
import type { DataProfileReport } from "../../dataIntelligence/dataProfileTypes";
import { getDatasetActiveWorksheet, getWorkbookMetadata } from "../../workbook";
import type { WorksheetMetadata, WorksheetRelationshipCandidate } from "../../workbook";
import { getDialectProfile, type SqlDialectId } from "../../sqlIntelligence";
import {
  createReportOpportunities,
  type ReportOpportunity,
} from "../sql/reportIntelligencePlanner";
import { classifySensitiveColumn } from "./llmSensitiveColumnClassifier";
import type {
  AIColumnSensitivityCategory,
  AIColumnSummary,
  AIDataProfileSummary,
  AIDeterministicReportOpportunitySummary,
  AIMetadataContextPayload,
  AIMetadataPayloadCategorySummary,
  AIMetadataPayloadSafetySummary,
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

const summarizeColumn = (
  column: SchemaColumn,
  rowCount: number,
  worksheetName: string,
  trustedTableName: string,
): AIColumnSummary => ({
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
    sampleValuesIncluded: false,
    topValuesIncluded: false,
    rawValuesIncluded: false,
  },
  sensitivity: classifySensitiveColumn({ column, worksheetName, trustedTableName }),
});

const summarizeWorksheet = (worksheet: WorksheetMetadata): AIWorksheetTableSummary => ({
  worksheetId: worksheet.worksheetId,
  worksheetName: worksheet.sheetName,
  displayName: worksheet.displayName || worksheet.sheetName,
  trustedTableName: worksheet.tableName,
  status: worksheet.status,
  rowCount: worksheet.rowCount,
  columnCount: worksheet.columnCount,
  columns: worksheet.schema.map((column) =>
    summarizeColumn(column, worksheet.rowCount, worksheet.displayName || worksheet.sheetName, worksheet.tableName),
  ),
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
  columns: dataset.schema.map((column) =>
    summarizeColumn(
      column,
      dataset.row_count,
      dataset.original_filename || dataset.filename,
      dataset.table_name,
    ),
  ),
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
      topValuesIncluded: false,
      sqlDraftsIncluded: false,
      queryResultsIncluded: false,
      providerResponsesIncluded: false,
      tokenizationVaultIncluded: false,
      deterministicReportSource: "k10_report_intelligence",
      notes: [
        "Metadata-only payload. Raw rows, preview rows, sample values, top values, prompt text, SQL drafts, query results, provider responses, secrets, token vault contents, and raw sensitive values are excluded.",
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
): AIMetadataPayloadCategorySummary => {
  const sensitivity = payload.worksheets
    .flatMap((worksheet) => worksheet.columns)
    .reduce<{
      safe: number;
      caution: number;
      sensitive: number;
      restricted: number;
      categories: Set<AIColumnSensitivityCategory>;
    }>(
      (summary, column) => {
        summary[column.sensitivity.level] += 1;
        summary.categories.add(column.sensitivity.category);
        return summary;
      },
      {
        safe: 0,
        caution: 0,
        sensitive: 0,
        restricted: 0,
        categories: new Set(),
      },
    );

  return {
    mode: payload.provenance.mode,
    rawRowsIncluded: false,
    sampleRowsIncluded: false,
    promptTextIncluded: false,
    sampleValuesIncluded: false,
    topValuesIncluded: false,
    sqlDraftsIncluded: false,
    queryResultsIncluded: false,
    providerResponsesIncluded: false,
    tokenizationVaultIncluded: false,
    blockedCategoriesExcluded: true,
    datasetIncluded: Boolean(payload.dataset),
    worksheetCount: payload.worksheets.length,
    columnCount: payload.worksheets.reduce((sum, worksheet) => sum + worksheet.columns.length, 0),
    relationshipCandidateCount: payload.relationships.length,
    deterministicReportCount: payload.deterministicReports.length,
    profileSummaryIncluded: Boolean(payload.dataProfile),
    sqlDialect: payload.sqlDialect.id,
    sensitivity: {
      safe: sensitivity.safe,
      caution: sensitivity.caution,
      sensitive: sensitivity.sensitive,
      restricted: sensitivity.restricted,
      categories: Array.from(sensitivity.categories).sort(),
    },
  };
};


const UNSAFE_METADATA_PAYLOAD_FIELD_NAMES = new Set([
  "rows",
  "rawRows",
  "preview",
  "previewRows",
  "sample",
  "samples",
  "sampleRows",
  "sample_values",
  "sampleValues",
  "top_values",
  "topValues",
  "prompt",
  "promptText",
  "rawPromptText",
  "sql",
  "sqlDraft",
  "sqlDrafts",
  "queryResult",
  "queryResults",
  "providerResponse",
  "providerResponses",
  "apiKey",
  "secret",
  "secrets",
  "tokenVault",
  "tokenizationVault",
  "rawValue",
  "rawValues",
  "freeTextValue",
]);

const ALLOWED_METADATA_ONLY_CATEGORIES = [
  "dataset_metadata",
  "worksheet_metadata",
  "column_metadata",
  "relationship_metadata",
  "data_profile_summary_without_values",
  "deterministic_report_summaries",
  "sensitivity_metadata",
  "safe_aggregate_summaries_value_free_threshold_safe",
];

const EXCLUDED_METADATA_ONLY_CATEGORIES = [
  "raw_rows",
  "preview_rows",
  "sample_values",
  "top_values",
  "raw_prompt_text",
  "sql_drafts",
  "query_results",
  "provider_responses",
  "api_keys_or_secrets",
  "tokenization_vault",
  "raw_free_text_cell_values",
  "raw_restricted_or_sensitive_values",
];

export const stripUnsafeMetadataPayloadFields = <T>(input: T): T => {
  if (Array.isArray(input)) return input.map((item) => stripUnsafeMetadataPayloadFields(item)) as T;
  if (!input || typeof input !== "object") return input;
  return Object.fromEntries(
    Object.entries(input as Record<string, unknown>)
      .filter(([key]) => !UNSAFE_METADATA_PAYLOAD_FIELD_NAMES.has(key))
      .map(([key, value]) => [key, stripUnsafeMetadataPayloadFields(value)]),
  ) as T;
};

export const sanitizeMetadataOnlyColumnProfile = (
  profile: Partial<Record<string, unknown>> | null | undefined,
): AIColumnSummary["profile"] => ({
  uniqueCount: typeof profile?.uniqueCount === "number" ? profile.uniqueCount : 0,
  hasNumericStats: Boolean(profile?.hasNumericStats),
  hasDateRange: Boolean(profile?.hasDateRange),
  hasTextLengthStats: Boolean(profile?.hasTextLengthStats),
  sampleValuesIncluded: false,
  topValuesIncluded: false,
  rawValuesIncluded: false,
});

export const summarizeMetadataOnlyPayloadSafety = (
  payload: AIMetadataContextPayload,
): AIMetadataPayloadSafetySummary => ({
  ...summarizeAIMetadataPayloadCategories(payload),
  rawRowsIncluded: false,
  previewRowsIncluded: false,
  sampleValuesIncluded: false,
  topValuesIncluded: false,
  promptTextIncluded: false,
  sqlDraftsIncluded: false,
  queryResultsIncluded: false,
  providerResponsesIncluded: false,
  apiSecretsIncluded: false,
  tokenizationVaultIncluded: false,
  rawFreeTextValuesIncluded: false,
  rawSensitiveValuesIncluded: false,
  blockedCategories: [],
  allowedCategories: [...ALLOWED_METADATA_ONLY_CATEGORIES],
  excludedCategories: [...EXCLUDED_METADATA_ONLY_CATEGORIES],
  providerReady: true,
  notes: ["Metadata-only payload categories are value-free and exclude blocked raw-data categories."],
});

export const containsBlockedPayloadCategory = (summary: AIMetadataPayloadSafetySummary): boolean =>
  summary.rawRowsIncluded ||
  summary.previewRowsIncluded ||
  summary.sampleValuesIncluded ||
  summary.topValuesIncluded ||
  summary.promptTextIncluded ||
  summary.sqlDraftsIncluded ||
  summary.queryResultsIncluded ||
  summary.providerResponsesIncluded ||
  summary.apiSecretsIncluded ||
  summary.tokenizationVaultIncluded ||
  summary.rawFreeTextValuesIncluded ||
  summary.rawSensitiveValuesIncluded ||
  summary.blockedCategories.length > 0;

export const assertMetadataOnlyPayloadCategories = (payload: AIMetadataContextPayload): boolean =>
  !containsBlockedPayloadCategory(summarizeMetadataOnlyPayloadSafety(payload));

export const createMetadataOnlyPayloadAuditSummary = summarizeMetadataOnlyPayloadSafety;
