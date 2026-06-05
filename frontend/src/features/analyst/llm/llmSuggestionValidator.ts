import type { ReportOpportunityDomain } from "../sql/reportIntelligencePlanner";
import type {
  AIColumnSensitivityCategory,
  AIColumnSensitivityLevel,
  AIColumnSummary,
  AIMetadataContextPayload,
  AIWorksheetTableSummary,
} from "./llmGovernanceTypes";
import {
  AI_SUGGESTION_CONFIDENCE_VALUES,
  AI_SUGGESTION_DOMAIN_VALUES,
  AI_SUGGESTION_READINESS_VALUES,
  AI_SUGGESTION_SQL_DRAFT_STATUS_VALUES,
  type AIGovernedMetaReportSuggestion,
  type AIGovernedSuggestionReadiness,
  type AIGovernedSuggestionValidationIssue,
  type AIGovernedSuggestionValidationResult,
  type AISuggestionConfidenceLevel,
  type AISuggestionProvenance,
  type AISuggestionProvenanceSource,
  type AISuggestionSensitivitySummary,
  type AISuggestionSqlDraftStatus,
} from "./llmSuggestionContract";

type RawSuggestionRecord = Record<string, unknown>;

const MAX_SHORT_TEXT = 140;
const MAX_LONG_TEXT = 420;
const MAX_LIST_ITEMS = 24;
const RAW_VALUE_FIELD_NAMES = new Set([
  "data",
  "example",
  "examples",
  "generatedSql",
  "preview",
  "prompt",
  "query",
  "raw",
  "rawData",
  "rawRows",
  "row",
  "rows",
  "sample",
  "samples",
  "sampleRows",
  "sampleValues",
  "sample_values",
  "sql",
  "sqlDraft",
  "sqlDraftIncluded",
  "sqlQuery",
  "sql_draft_included",
  "topValues",
  "top_values",
  "values",
]);

const normalizeText = (value: unknown, maxLength: number): string => {
  if (typeof value !== "string") return "";
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1).trim()}...` : normalized;
};

const normalizeList = (value: unknown, maxLength = MAX_SHORT_TEXT): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => normalizeText(item, maxLength))
    .filter(Boolean)
    .slice(0, MAX_LIST_ITEMS);
};

const normalizeDomain = (value: unknown): ReportOpportunityDomain | null => {
  const normalized = normalizeText(value, 40).toLowerCase().replace(/\s+/g, "_");
  return AI_SUGGESTION_DOMAIN_VALUES.includes(normalized as ReportOpportunityDomain)
    ? (normalized as ReportOpportunityDomain)
    : null;
};

const normalizeDomains = (value: unknown): ReportOpportunityDomain[] => {
  const values = Array.isArray(value) ? value : [value];
  const domains = values
    .map(normalizeDomain)
    .filter((domain): domain is ReportOpportunityDomain => Boolean(domain));
  return Array.from(new Set(domains)).slice(0, MAX_LIST_ITEMS);
};

const normalizeConfidence = (value: unknown): AISuggestionConfidenceLevel => {
  if (AI_SUGGESTION_CONFIDENCE_VALUES.includes(value as AISuggestionConfidenceLevel)) {
    return value as AISuggestionConfidenceLevel;
  }
  const normalized = normalizeText(value, 20).toLowerCase();
  if (normalized === "high") return "High";
  if (normalized === "medium" || normalized === "moderate") return "Medium";
  return "Low";
};

const normalizeReadiness = (value: unknown): AIGovernedSuggestionReadiness => {
  const normalized = normalizeText(value, 60).toLowerCase().replace(/\s+/g, "_");
  return AI_SUGGESTION_READINESS_VALUES.includes(normalized as AIGovernedSuggestionReadiness)
    ? (normalized as AIGovernedSuggestionReadiness)
    : "needs_user_review";
};

const normalizeProvenanceSource = (value: unknown): AISuggestionProvenanceSource => {
  if (value === "mock_metadata_generator") return "mock_metadata_generator";
  return "future_ai_suggestion";
};

const isValidConfidenceInput = (value: unknown): boolean => {
  if (value === undefined || value === null) return true;
  const normalized = normalizeText(value, 20).toLowerCase();
  return ["low", "medium", "moderate", "high"].includes(normalized);
};

const isValidReadinessInput = (value: unknown): boolean => {
  if (value === undefined || value === null) return true;
  const normalized = normalizeText(value, 60).toLowerCase().replace(/\s+/g, "_");
  return AI_SUGGESTION_READINESS_VALUES.includes(normalized as AIGovernedSuggestionReadiness);
};

const isValidSqlDraftStatusInput = (value: unknown): boolean => {
  if (value === undefined || value === null) return true;
  const normalized = normalizeText(value, 60).toLowerCase().replace(/\s+/g, "_");
  return AI_SUGGESTION_SQL_DRAFT_STATUS_VALUES.includes(normalized as AISuggestionSqlDraftStatus);
};

const hasRawValueField = (record: RawSuggestionRecord): string[] =>
  Object.keys(record).filter((key) => {
    if (!RAW_VALUE_FIELD_NAMES.has(key)) return false;
    const normalizedKey = key.toLowerCase();
    if (
      (normalizedKey === "sqldraftincluded" || normalizedKey === "sql_draft_included") &&
      record[key] === false
    ) {
      return false;
    }
    return true;
  });

const buildWorksheetIndex = (payload: AIMetadataContextPayload) => {
  const byTable = new Map<string, AIWorksheetTableSummary>();
  const byWorksheet = new Map<string, AIWorksheetTableSummary>();
  payload.worksheets.forEach((worksheet) => {
    byTable.set(worksheet.trustedTableName, worksheet);
    byWorksheet.set(worksheet.worksheetName, worksheet);
    byWorksheet.set(worksheet.displayName, worksheet);
  });
  return { byTable, byWorksheet };
};

const findColumn = (
  payload: AIMetadataContextPayload,
  columnName: string,
  requiredTables: string[],
): AIColumnSummary | null => {
  const { byTable } = buildWorksheetIndex(payload);
  const candidateWorksheets = requiredTables.length > 0
    ? requiredTables.map((table) => byTable.get(table)).filter((worksheet): worksheet is AIWorksheetTableSummary => Boolean(worksheet))
    : payload.worksheets;
  for (const worksheet of candidateWorksheets) {
    const column = worksheet.columns.find((candidate) => candidate.name === columnName);
    if (column) return column;
  }
  return null;
};

const compareSensitivity = (left: AIColumnSensitivityLevel, right: AIColumnSensitivityLevel) => {
  const order: Record<AIColumnSensitivityLevel, number> = {
    safe: 0,
    caution: 1,
    sensitive: 2,
    restricted: 3,
  };
  return order[left] - order[right];
};

const buildSensitivitySummary = (
  requiredColumns: string[],
  payload: AIMetadataContextPayload,
  requiredTables: string[],
): AISuggestionSensitivitySummary => {
  const categories = new Set<AIColumnSensitivityCategory>();
  let highestLevel: AIColumnSensitivityLevel = "safe";
  let restrictedColumnCount = 0;
  let sensitiveColumnCount = 0;

  requiredColumns.forEach((columnName) => {
    const column = findColumn(payload, columnName, requiredTables);
    if (!column) return;
    categories.add(column.sensitivity.category);
    if (compareSensitivity(column.sensitivity.level, highestLevel) > 0) {
      highestLevel = column.sensitivity.level;
    }
    if (column.sensitivity.level === "restricted") restrictedColumnCount += 1;
    if (column.sensitivity.level === "sensitive") sensitiveColumnCount += 1;
  });

  return {
    highestLevel,
    categories: Array.from(categories).sort(),
    restrictedColumnCount,
    sensitiveColumnCount,
    requiresUserReview: compareSensitivity(highestLevel, "safe") > 0,
    requiresConsentForSamples: requiredColumns.length > 0,
  };
};

const readinessFromValidation = (
  requestedReadiness: AIGovernedSuggestionReadiness,
  missingRequirements: string[],
  sensitivity: AISuggestionSensitivitySummary,
): AIGovernedSuggestionReadiness => {
  if (sensitivity.restrictedColumnCount > 0) return "blocked_sensitive_fields";
  if (missingRequirements.length > 0) return "needs_missing_fields";
  if (sensitivity.requiresUserReview) return "needs_user_review";
  return requestedReadiness === "unsupported" ? "unsupported" : "can_generate_now";
};

const sqlDraftStatusFromReadiness = (readiness: AIGovernedSuggestionReadiness): AISuggestionSqlDraftStatus => {
  if (readiness === "can_generate_now") return "eligible_later";
  if (readiness === "needs_user_review") return "eligible_later";
  return "blocked";
};

export const sanitizeAIGovernedSuggestionCandidate = (
  candidate: unknown,
  payload: AIMetadataContextPayload,
): AIGovernedMetaReportSuggestion => {
  const record: RawSuggestionRecord = candidate && typeof candidate === "object" ? candidate as RawSuggestionRecord : {};
  const domains = normalizeDomains(record.domains ?? record.domain ?? record.suggestedDomain);
  const requiredTables = normalizeList(record.requiredTables ?? record.required_tables);
  const requiredWorksheets = normalizeList(record.requiredWorksheets ?? record.required_worksheets);
  const requiredColumns = normalizeList(record.requiredColumns ?? record.required_columns);
  const assumptions = normalizeList(record.assumptions, MAX_LONG_TEXT);
  const missingRequirements = normalizeList(record.missingRequirements ?? record.missing_requirements);
  const sensitivity = buildSensitivitySummary(requiredColumns, payload, requiredTables);
  const requestedReadiness = normalizeReadiness(record.readiness ?? record.readinessStatus);
  const readiness = readinessFromValidation(requestedReadiness, missingRequirements, sensitivity);
  const sqlDraftStatus = sqlDraftStatusFromReadiness(readiness);
  const candidateProvenance =
    record.provenance && typeof record.provenance === "object"
      ? record.provenance as RawSuggestionRecord
      : {};
  const provenance: AISuggestionProvenance = {
    source: normalizeProvenanceSource(candidateProvenance.source ?? record.provenanceSource),
    mode: payload.provenance.mode,
    metadataPayloadSchemaVersion: payload.schemaVersion,
    rawRowsIncluded: false,
    sampleRowsIncluded: false,
    promptTextIncluded: false,
    sqlDraftIncluded: false,
  };

  return {
    id: normalizeText(record.id, 80) || "ai-suggestion-unidentified",
    title: normalizeText(record.title, MAX_SHORT_TEXT) || "Untitled report suggestion",
    businessQuestion: normalizeText(record.businessQuestion ?? record.business_question, MAX_LONG_TEXT),
    whyItMatters: normalizeText(record.whyItMatters ?? record.why_it_matters, MAX_LONG_TEXT),
    domains: domains.length > 0 ? domains : ["generic"],
    category: normalizeText(record.category ?? record.suggestedCategory, MAX_SHORT_TEXT) || "generic",
    requiredTables,
    requiredWorksheets,
    requiredColumns,
    missingRequirements,
    assumptions,
    confidenceLevel: normalizeConfidence(record.confidenceLevel ?? record.confidence),
    readiness,
    sensitivity,
    provenance,
    sqlDraftAllowedLater: sqlDraftStatus === "eligible_later",
    sqlBlockedReason: sqlDraftStatus === "blocked" ? "SQL draft is blocked until validation and readiness requirements pass." : null,
    sqlDraftIncluded: false,
    sqlDraftStatus,
    validationMessages: [],
  };
};

export const validateAIGovernedSuggestion = (
  candidate: unknown,
  payload: AIMetadataContextPayload,
): AIGovernedSuggestionValidationResult => {
  const issues: AIGovernedSuggestionValidationIssue[] = [];
  if (!candidate || typeof candidate !== "object") {
    issues.push({
      severity: "error",
      code: "invalid_shape",
      message: "Suggestion must be a metadata-only object.",
    });
  }

  const record: RawSuggestionRecord = candidate && typeof candidate === "object" ? candidate as RawSuggestionRecord : {};
  const rawFields = hasRawValueField(record);
  rawFields.forEach((field) => {
    issues.push({
      severity: field.toLowerCase().includes("sql") ? "error" : "warning",
      code: field.toLowerCase().includes("sql") ? "sql_draft_present" : "raw_value_field_present",
      message: `${field} was removed because governed suggestions may not include SQL drafts or raw/sample values.`,
    });
  });

  const suggestion = sanitizeAIGovernedSuggestionCandidate(candidate, payload);
  const { byTable, byWorksheet } = buildWorksheetIndex(payload);

  if (!isValidConfidenceInput(record.confidenceLevel ?? record.confidence)) {
    issues.push({
      severity: "warning",
      code: "invalid_enum",
      message: "Confidence level was normalized to Low, Medium, or High.",
    });
  }

  if (!isValidReadinessInput(record.readiness ?? record.readinessStatus)) {
    issues.push({
      severity: "warning",
      code: "invalid_enum",
      message: "Readiness was normalized to a governed readiness status.",
    });
  }

  if (!isValidSqlDraftStatusInput(record.sqlDraftStatus ?? record.sql_draft_status)) {
    issues.push({
      severity: "warning",
      code: "invalid_enum",
      message: "SQL draft status was ignored and recomputed by the validator.",
    });
  }

  suggestion.requiredTables.forEach((table) => {
    if (!byTable.has(table)) {
      issues.push({
        severity: "error",
        code: "missing_table",
        message: `Required table ${table} is not present in trusted metadata.`,
      });
      suggestion.missingRequirements.push(`Missing table: ${table}`);
    }
  });

  suggestion.requiredWorksheets.forEach((worksheet) => {
    if (!byWorksheet.has(worksheet)) {
      issues.push({
        severity: "error",
        code: "missing_table",
        message: `Required worksheet ${worksheet} is not present in trusted metadata.`,
      });
      suggestion.missingRequirements.push(`Missing worksheet: ${worksheet}`);
    }
  });

  suggestion.requiredColumns.forEach((columnName) => {
    const column = findColumn(payload, columnName, suggestion.requiredTables);
    if (!column) {
      issues.push({
        severity: "error",
        code: "missing_column",
        message: `Required column ${columnName} is not present in trusted metadata.`,
      });
      suggestion.missingRequirements.push(`Missing column: ${columnName}`);
      return;
    }
    if (column.sensitivity.level === "restricted") {
      issues.push({
        severity: "error",
        code: "restricted_column",
        message: `Required column ${columnName} is restricted and blocks SQL drafting.`,
      });
    } else if (column.sensitivity.level === "sensitive") {
      issues.push({
        severity: "warning",
        code: "sensitive_column_review",
        message: `Required column ${columnName} is sensitive and needs user review.`,
      });
    }
  });

  suggestion.missingRequirements = Array.from(new Set(suggestion.missingRequirements));
  suggestion.sensitivity = buildSensitivitySummary(
    suggestion.requiredColumns,
    payload,
    suggestion.requiredTables,
  );
  suggestion.readiness = readinessFromValidation(
    suggestion.readiness,
    suggestion.missingRequirements,
    suggestion.sensitivity,
  );
  suggestion.sqlDraftStatus = sqlDraftStatusFromReadiness(suggestion.readiness);
  suggestion.sqlDraftAllowedLater = suggestion.sqlDraftStatus === "eligible_later";
  suggestion.sqlBlockedReason =
    suggestion.sqlDraftStatus === "blocked" ? "SQL draft is blocked until validation and readiness requirements pass." : null;
  suggestion.validationMessages = issues.map((issue) => issue.message);

  return { suggestion, issues };
};
