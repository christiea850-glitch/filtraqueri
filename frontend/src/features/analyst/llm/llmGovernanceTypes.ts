import type { SchemaColumn } from "../../dataset/datasetTypes";
import type { SqlDialectId } from "../../sqlIntelligence";
import type {
  ReportOpportunityComplexity,
  ReportOpportunityDomain,
  ReportOpportunityMethod,
  ReportOpportunitySupport,
} from "../sql/reportIntelligencePlanner";

export type AIMode = "metadata_only" | "approved_sample_rows" | "disabled" | "private_model_only";

export type AIPayloadProvenance = {
  mode: AIMode;
  generatedAt: string;
  source: "deterministic_metadata_builder";
  rawRowsIncluded: false;
  sampleRowsIncluded: false;
  promptTextIncluded: false;
  topValuesIncluded: false;
  sqlDraftsIncluded: false;
  queryResultsIncluded: false;
  providerResponsesIncluded: false;
  tokenizationVaultIncluded: false;
  deterministicReportSource: "k10_report_intelligence";
  notes: string[];
};

export type AIMetadataPayloadSafetySummary = AIMetadataPayloadCategorySummary & {
  rawRowsIncluded: false;
  previewRowsIncluded: false;
  sampleValuesIncluded: false;
  topValuesIncluded: false;
  promptTextIncluded: false;
  sqlDraftsIncluded: false;
  queryResultsIncluded: false;
  providerResponsesIncluded: false;
  apiSecretsIncluded: false;
  tokenizationVaultIncluded: false;
  rawFreeTextValuesIncluded: false;
  rawSensitiveValuesIncluded: false;
  blockedCategories: string[];
  allowedCategories: string[];
  excludedCategories: string[];
  providerReady: boolean;
  notes: string[];
};

export type AIColumnMissingSummary = {
  nullCount: number;
  missingRatio: number | null;
};

export type AIColumnProfileSummary = {
  uniqueCount: number;
  hasNumericStats: boolean;
  hasDateRange: boolean;
  hasTextLengthStats: boolean;
  sampleValuesIncluded: false;
  topValuesIncluded: false;
  rawValuesIncluded: false;
};

export type AIColumnSensitivityCategory =
  | "safe_business_metric"
  | "identifier"
  | "direct_personal_identifier"
  | "contact_information"
  | "address_or_location"
  | "financial_or_payment"
  | "access_or_security"
  | "health_or_sensitive"
  | "free_text_sensitive"
  | "unknown_needs_review";

export type AIColumnSensitivityLevel = "safe" | "caution" | "sensitive" | "restricted";

export type AIRedactionPolicyLabel =
  | "allowed_for_metadata_only"
  | "allowed_for_sql_planning"
  | "requires_user_consent_for_samples"
  | "never_send_raw_values";

export type AIColumnSensitivityClassification = {
  category: AIColumnSensitivityCategory;
  level: AIColumnSensitivityLevel;
  policyLabels: AIRedactionPolicyLabel[];
  allowedForMetadataOnly: true;
  allowedForSqlPlanning: boolean;
  requiresUserConsentForSamples: boolean;
  neverSendRawValues: true;
  reasons: string[];
};

export type AIColumnSummary = {
  name: string;
  type: string;
  inferredType: SchemaColumn["inferred_type"];
  missing: AIColumnMissingSummary;
  profile: AIColumnProfileSummary;
  sensitivity: AIColumnSensitivityClassification;
};

export type AIWorksheetTableSummary = {
  worksheetId: string | null;
  worksheetName: string;
  displayName: string;
  trustedTableName: string;
  status: string;
  rowCount: number;
  columnCount: number;
  columns: AIColumnSummary[];
  normalizationWarnings: string[];
};

export type AIRelationshipCandidateSummary = {
  relationshipId: string;
  sourceWorksheetName: string;
  sourceTable: string;
  sourceColumn: string;
  targetWorksheetName: string;
  targetTable: string;
  targetColumn: string;
  confidence: number;
  confidenceLabel: "low" | "medium" | "high";
  relationshipType: string;
  direction: string;
  status: string;
  reviewStatus: string;
  evidenceSummary: {
    typeCompatible: boolean;
    sampledRowCount: number;
    sampledOverlapRatio: number;
    sourceUniqueRatio: number;
    targetUniqueRatio: number;
  };
};

export type AIDataProfileSummary = {
  humanSummary: string | null;
  analystSummary: string | null;
  shapeLabel: string | null;
  possibleMetrics: string[];
  possibleDimensions: string[];
  dateTimeFields: string[];
  possibleIdFields: string[];
  workbookRelationshipSummary: string | null;
  timeSeriesSummary: string | null;
  statisticalSummary: string | null;
};

export type AIDeterministicReportOpportunitySummary = {
  id: string;
  title: string;
  businessQuestion: string;
  whyItMatters: string;
  domains: ReportOpportunityDomain[];
  confidence: number;
  confidenceLevel: "Low" | "Medium" | "High";
  support: ReportOpportunitySupport;
  method: ReportOpportunityMethod;
  complexity: ReportOpportunityComplexity;
  requiredTables: string[];
  optionalTables: string[];
  requiredColumns: string[];
  optionalColumns: string[];
  missingRequirements: string[];
  needsJoins: boolean;
  needsAggregation: boolean;
  needsDateLogic: boolean;
  needsAnomalyDetection: boolean;
  compiledRecipeId: string | null;
  sqlDraftIncluded: false;
};

export type AIDatasetWorkbookSummary = {
  datasetId: string;
  datasetName: string;
  originalFilename: string;
  trustedActiveTableName: string;
  rowCount: number;
  columnCount: number;
  workbook: {
    workbookId: string;
    name: string;
    status: string;
    activeWorksheetId: string | null;
    activeWorksheetName: string | null;
    activeTrustedTableName: string | null;
    worksheetCount: number;
  } | null;
};

export type AIMetadataContextPayload = {
  schemaVersion: 1;
  provenance: AIPayloadProvenance;
  sqlDialect: {
    id: SqlDialectId;
    displayName: string | null;
  };
  dataset: AIDatasetWorkbookSummary | null;
  worksheets: AIWorksheetTableSummary[];
  relationships: AIRelationshipCandidateSummary[];
  dataProfile: AIDataProfileSummary | null;
  deterministicReports: AIDeterministicReportOpportunitySummary[];
};

export type AIMetadataPayloadCategorySummary = {
  mode: AIMode;
  rawRowsIncluded: false;
  sampleRowsIncluded: false;
  promptTextIncluded: false;
  sampleValuesIncluded: false;
  topValuesIncluded: false;
  sqlDraftsIncluded: false;
  queryResultsIncluded: false;
  providerResponsesIncluded: false;
  tokenizationVaultIncluded: false;
  blockedCategoriesExcluded: boolean;
  datasetIncluded: boolean;
  worksheetCount: number;
  columnCount: number;
  relationshipCandidateCount: number;
  deterministicReportCount: number;
  profileSummaryIncluded: boolean;
  sqlDialect: SqlDialectId;
  sensitivity: {
    safe: number;
    caution: number;
    sensitive: number;
    restricted: number;
    categories: AIColumnSensitivityCategory[];
  };
};
