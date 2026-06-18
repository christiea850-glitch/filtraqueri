import type {
  AdaptiveProposalLlmPayload,
  AdaptiveProposalLlmResponse,
  AdaptiveProposalLlmValidationIssue,
  AdaptiveProposalLlmValidationResult,
  SanitizedAcceptedRelationship,
} from "./adaptiveProposalLlmContract";
import type {
  AdaptiveProposalSupport,
  MissingRequirement,
  ProposedAssumption,
  ProposedEntity,
  ProposedFilter,
  ProposedJoinNeed,
  ProposedGrouping,
  ProposedMetric,
  ProposedWarning,
} from "./adaptiveReportProposal";

type RawRecord = Record<string, unknown>;

const MAX_SHORT_TEXT = 160;
const MAX_LONG_TEXT = 600;
const MAX_ITEMS = 30;

const FORBIDDEN_FIELD_NAMES = new Set([
  "canInsertSql",
  "canRender",
  "canRenderSql",
  "canRunSql",
  "code",
  "generatedSql",
  "payloadFingerprint",
  "provenance",
  "query",
  "rawRows",
  "renderer",
  "runQuery",
  "sampleRows",
  "sampleValues",
  "sql",
  "sqlDraft",
  "topValues",
]);

const ALLOWED_TOP_LEVEL_FIELDS = new Set([
  "schemaVersion",
  "title",
  "narrative",
  "entities",
  "metrics",
  "groupings",
  "filters",
  "joinNeeds",
  "assumptions",
  "missingRequirements",
  "warnings",
]);

const SQL_LIKE_PATTERNS = [
  /```/,
  /\bselect\s+.+\bfrom\b/i,
  /\bwith\s+.+\bas\s*\(/i,
  /\b(insert|update|delete|merge|drop|alter|truncate|create|grant|revoke|execute|call)\b/i,
  /\bjoin\s+.+\bon\b/i,
];

const SUPPORT_VALUES: AdaptiveProposalSupport[] = ["supported", "needs_review", "unsupported"];
const CONFIDENCE_VALUES = ["high", "medium", "low"];
const ENTITY_BINDINGS: ProposedEntity["binding"][] = [
  "exact",
  "similar",
  "scope_fallback",
  "unresolved",
];
const FILTER_SEMANTICS: ProposedFilter["semantics"][] = ["resolved", "needs_review"];
const JOIN_STATUSES: ProposedJoinNeed["status"][] = [
  "verified",
  "needs_review",
  "missing",
  "not_required",
];

const normalize = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[_%()]+/g, " ")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeText = (value: unknown, maxLength: number): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  return normalized.length > maxLength ? normalized.slice(0, maxLength).trim() : normalized;
};

const asRecord = (value: unknown): RawRecord =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as RawRecord) : {};

const collectForbiddenFieldIssues = (
  value: unknown,
  path = "",
): AdaptiveProposalLlmValidationIssue[] => {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectForbiddenFieldIssues(item, `${path}[${index}]`));
  }
  return Object.entries(value as RawRecord).flatMap(([key, nested]) => {
    const nextPath = path ? `${path}.${key}` : key;
    const ownIssue = FORBIDDEN_FIELD_NAMES.has(key)
      ? [
          {
            severity: "error" as const,
            code: "forbidden_field" as const,
            message: `Forbidden field ${nextPath} is not allowed in adaptive proposal refinements.`,
          },
        ]
      : [];
    return [...ownIssue, ...collectForbiddenFieldIssues(nested, nextPath)];
  });
};

const collectSqlLikeIssues = (
  value: unknown,
  path = "response",
): AdaptiveProposalLlmValidationIssue[] => {
  if (typeof value === "string") {
    return SQL_LIKE_PATTERNS.some((pattern) => pattern.test(value))
      ? [
          {
            severity: "error",
            code: "sql_like_content",
            message: `SQL-like content is not allowed at ${path}.`,
          },
        ]
      : [];
  }
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectSqlLikeIssues(item, `${path}[${index}]`));
  }
  return Object.entries(value as RawRecord).flatMap(([key, nested]) =>
    collectSqlLikeIssues(nested, `${path}.${key}`),
  );
};

const createMetadataIndex = (payload: AdaptiveProposalLlmPayload) => {
  const tables = new Set<string>();
  const columnsByTable = new Map<string, Set<string>>();
  const redactedColumnIds = new Set<string>();

  for (const table of payload.tables) {
    if (!table.tableName) continue;
    const tableKey = normalize(table.tableName);
    tables.add(tableKey);
    const columns = columnsByTable.get(tableKey) || new Set<string>();
    for (const column of table.columns) {
      if (column.columnName) columns.add(normalize(column.columnName));
      if (column.redactedColumnId) redactedColumnIds.add(column.redactedColumnId);
    }
    columnsByTable.set(tableKey, columns);
  }

  return { tables, columnsByTable, redactedColumnIds };
};

const validateTableColumnReference = ({
  tableName,
  columnName,
  payload,
  issues,
  label,
}: {
  tableName: unknown;
  columnName: unknown;
  payload: AdaptiveProposalLlmPayload;
  issues: AdaptiveProposalLlmValidationIssue[];
  label: string;
}) => {
  const index = createMetadataIndex(payload);
  const tableText = typeof tableName === "string" ? tableName : null;
  const columnText = typeof columnName === "string" ? columnName : null;

  if (tableText && !index.tables.has(normalize(tableText))) {
    issues.push({
      severity: "error",
      code: "unknown_table",
      message: `${label} references unknown table ${tableText}.`,
    });
    return;
  }

  if (columnText && index.redactedColumnIds.has(columnText)) {
    issues.push({
      severity: "error",
      code: "redacted_reference",
      message: `${label} references redacted field ${columnText}.`,
    });
    return;
  }

  if (columnText && tableText) {
    const columns = index.columnsByTable.get(normalize(tableText));
    if (!columns?.has(normalize(columnText))) {
      issues.push({
        severity: "error",
        code: "unknown_column",
        message: `${label} references unknown or excluded column ${tableText}.${columnText}.`,
      });
    }
  }
};

const relationshipVerifiesJoin = (
  join: ProposedJoinNeed,
  relationships: readonly SanitizedAcceptedRelationship[],
): boolean =>
  relationships.some((relationship) => {
    if (
      relationship.status !== "active" ||
      relationship.validationState === "broken" ||
      !relationship.sourceColumnName ||
      !relationship.targetColumnName ||
      !join.leftTable ||
      !join.rightTable
    ) {
      return false;
    }
    const direct =
      normalize(relationship.sourceTableName || "") === normalize(join.leftTable) &&
      normalize(relationship.targetTableName || "") === normalize(join.rightTable);
    const reverse =
      normalize(relationship.sourceTableName || "") === normalize(join.rightTable) &&
      normalize(relationship.targetTableName || "") === normalize(join.leftTable);
    return direct || reverse;
  });

const validateEnums = (
  record: RawRecord,
  issues: AdaptiveProposalLlmValidationIssue[],
) => {
  const entityRecords = Array.isArray(record.entities) ? record.entities.map(asRecord) : [];
  entityRecords.forEach((entity) => {
    if (entity.confidence && !CONFIDENCE_VALUES.includes(entity.confidence as string)) {
      issues.push({ severity: "error", code: "invalid_enum", message: "Entity confidence is invalid." });
    }
    if (entity.binding && !ENTITY_BINDINGS.includes(entity.binding as ProposedEntity["binding"])) {
      issues.push({ severity: "error", code: "invalid_enum", message: "Entity binding is invalid." });
    }
  });

  const metricRecords = Array.isArray(record.metrics) ? record.metrics.map(asRecord) : [];
  metricRecords.forEach((metric) => {
    if (metric.confidence && !CONFIDENCE_VALUES.includes(metric.confidence as string)) {
      issues.push({ severity: "error", code: "invalid_enum", message: "Metric confidence is invalid." });
    }
  });

  const groupingRecords = Array.isArray(record.groupings) ? record.groupings.map(asRecord) : [];
  groupingRecords.forEach((grouping) => {
    if (grouping.confidence && !CONFIDENCE_VALUES.includes(grouping.confidence as string)) {
      issues.push({ severity: "error", code: "invalid_enum", message: "Grouping confidence is invalid." });
    }
  });

  const filterRecords = Array.isArray(record.filters) ? record.filters.map(asRecord) : [];
  filterRecords.forEach((filter) => {
    if (filter.semantics && !FILTER_SEMANTICS.includes(filter.semantics as ProposedFilter["semantics"])) {
      issues.push({ severity: "error", code: "invalid_enum", message: "Filter semantics is invalid." });
    }
  });

  const joinRecords = Array.isArray(record.joinNeeds) ? record.joinNeeds.map(asRecord) : [];
  joinRecords.forEach((join) => {
    if (join.status && !JOIN_STATUSES.includes(join.status as ProposedJoinNeed["status"])) {
      issues.push({ severity: "error", code: "invalid_enum", message: "Join status is invalid." });
    }
  });

  const warningRecords = Array.isArray(record.warnings) ? record.warnings.map(asRecord) : [];
  warningRecords.forEach((warning) => {
    if (warning.severity && !["info", "warning", "blocking"].includes(warning.severity as string)) {
      issues.push({ severity: "error", code: "invalid_enum", message: "Warning severity is invalid." });
    }
  });

  if (record.support && !SUPPORT_VALUES.includes(record.support as AdaptiveProposalSupport)) {
    issues.push({ severity: "error", code: "invalid_enum", message: "Support is invalid." });
  }
};

const validateTextLengths = (
  value: unknown,
  issues: AdaptiveProposalLlmValidationIssue[],
  path = "response",
) => {
  if (typeof value === "string") {
    const maxLength = path.endsWith("narrative") || path.includes("detail") || path.includes("message")
      ? MAX_LONG_TEXT
      : MAX_SHORT_TEXT;
    if (value.length > maxLength) {
      issues.push({
        severity: "error",
        code: "overlong_text",
        message: `${path} exceeds the allowed text length.`,
      });
    }
    return;
  }
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => validateTextLengths(item, issues, `${path}[${index}]`));
    return;
  }
  Object.entries(value as RawRecord).forEach(([key, nested]) =>
    validateTextLengths(nested, issues, `${path}.${key}`),
  );
};

const validateReferences = (
  record: RawRecord,
  payload: AdaptiveProposalLlmPayload,
  issues: AdaptiveProposalLlmValidationIssue[],
) => {
  const entities = Array.isArray(record.entities) ? record.entities.map(asRecord) : [];
  entities.forEach((entity) =>
    validateTableColumnReference({
      tableName: entity.tableName,
      columnName: null,
      payload,
      issues,
      label: "Entity",
    }),
  );

  const metrics = Array.isArray(record.metrics) ? record.metrics.map(asRecord) : [];
  metrics.forEach((metric) =>
    validateTableColumnReference({
      tableName: metric.tableName,
      columnName: metric.columnName,
      payload,
      issues,
      label: "Metric",
    }),
  );

  const groupings = Array.isArray(record.groupings) ? record.groupings.map(asRecord) : [];
  groupings.forEach((grouping) =>
    validateTableColumnReference({
      tableName: grouping.tableName,
      columnName: grouping.columnName,
      payload,
      issues,
      label: "Grouping",
    }),
  );

  const filters = Array.isArray(record.filters) ? record.filters.map(asRecord) : [];
  filters.forEach((filter) =>
    validateTableColumnReference({
      tableName: filter.tableName,
      columnName: filter.columnName,
      payload,
      issues,
      label: "Filter",
    }),
  );

  const joins = Array.isArray(record.joinNeeds) ? (record.joinNeeds as ProposedJoinNeed[]) : [];
  joins.forEach((join) => {
    validateTableColumnReference({
      tableName: join.leftTable,
      columnName: null,
      payload,
      issues,
      label: "Join",
    });
    validateTableColumnReference({
      tableName: join.rightTable,
      columnName: null,
      payload,
      issues,
      label: "Join",
    });
    if (join.status === "verified" && !relationshipVerifiesJoin(join, payload.relationships)) {
      issues.push({
        severity: "error",
        code: "join_verification_overclaim",
        message: "LLM response may not mark joins verified without accepted relationship metadata.",
      });
    }
  });
};

const validateMissingRequirements = (
  record: RawRecord,
  payload: AdaptiveProposalLlmPayload,
  issues: AdaptiveProposalLlmValidationIssue[],
) => {
  if (!Array.isArray(record.missingRequirements)) return;
  const nextIds = new Set(record.missingRequirements.map(asRecord).map((item) => item.id));
  payload.proposal.missingRequirements.forEach((requirement) => {
    if (!nextIds.has(requirement.id)) {
      issues.push({
        severity: "error",
        code: "missing_requirement_removed",
        message: `Missing requirement ${requirement.id} cannot be removed by LLM refinement.`,
      });
    }
  });
};

const normalizeArray = <T>(value: unknown): T[] | undefined =>
  Array.isArray(value) ? (value.slice(0, MAX_ITEMS) as T[]) : undefined;

const sanitizeResponse = (record: RawRecord): AdaptiveProposalLlmResponse => {
  const response: AdaptiveProposalLlmResponse = {
    schemaVersion: "adaptive-proposal-llm-response:v1",
  };
  const title = normalizeText(record.title, MAX_SHORT_TEXT);
  const narrative = normalizeText(record.narrative, MAX_LONG_TEXT);
  if (title !== null) response.title = title;
  if (narrative !== null) response.narrative = narrative;
  const entities = normalizeArray<ProposedEntity>(record.entities);
  const metrics = normalizeArray<ProposedMetric>(record.metrics);
  const groupings = normalizeArray<ProposedGrouping>(record.groupings);
  const filters = normalizeArray<ProposedFilter>(record.filters);
  const joinNeeds = normalizeArray<ProposedJoinNeed>(record.joinNeeds);
  const assumptions = normalizeArray<ProposedAssumption>(record.assumptions);
  const missingRequirements = normalizeArray<MissingRequirement>(record.missingRequirements);
  const warnings = normalizeArray<ProposedWarning>(record.warnings);
  if (entities) response.entities = entities;
  if (metrics) response.metrics = metrics;
  if (groupings) response.groupings = groupings;
  if (filters) response.filters = filters;
  if (joinNeeds) response.joinNeeds = joinNeeds;
  if (assumptions) response.assumptions = assumptions;
  if (missingRequirements) response.missingRequirements = missingRequirements;
  if (warnings) response.warnings = warnings;
  return response;
};

export const validateAdaptiveProposalLlmResponse = (
  candidate: unknown,
  payload: AdaptiveProposalLlmPayload,
): AdaptiveProposalLlmValidationResult => {
  const issues: AdaptiveProposalLlmValidationIssue[] = [];
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    issues.push({
      severity: "error",
      code: "invalid_shape",
      message: "Adaptive proposal LLM response must be an object.",
    });
  }

  const record = asRecord(candidate);
  if (record.schemaVersion !== "adaptive-proposal-llm-response:v1") {
    issues.push({
      severity: "error",
      code: "invalid_schema_version",
      message: "Adaptive proposal LLM response schema version is invalid.",
    });
  }

  Object.keys(record).forEach((key) => {
    if (!ALLOWED_TOP_LEVEL_FIELDS.has(key)) {
      issues.push({
        severity: "error",
        code: "forbidden_field",
        message: `Top-level field ${key} is not part of the adaptive proposal refinement contract.`,
      });
    }
  });

  issues.push(...collectForbiddenFieldIssues(candidate));
  issues.push(...collectSqlLikeIssues(candidate));
  validateTextLengths(candidate, issues);
  validateEnums(record, issues);
  validateReferences(record, payload, issues);
  validateMissingRequirements(record, payload, issues);

  const ok = issues.every((issue) => issue.severity !== "error");
  return {
    ok,
    response: ok ? sanitizeResponse(record) : null,
    issues,
  };
};
