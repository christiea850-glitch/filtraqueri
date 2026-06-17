import type { SchemaColumn } from "../../dataset/datasetTypes";
import type { SqlDialectId } from "../../sqlIntelligence";
import type {
  AcceptedRelationshipContract,
  AnalysisScopeSelection,
  WorksheetMetadata,
} from "../../workbook";
import {
  EMPTY_BUSINESS_INTENT,
  type BusinessIntent,
} from "./businessIntentGrounding";
import {
  inferSemanticTableHints,
  type SemanticColumnHint,
  type SemanticColumnRole,
} from "./semanticHintRegistry";

export type AdaptiveProposalSupport = "supported" | "needs_review" | "unsupported";

export type SemanticHint = {
  id: string;
  target: "entity" | "metric" | "grouping" | "filter" | "relationship";
  label: string;
  worksheetId?: string;
  tableName?: string;
  columnName?: string;
  confidence: "high" | "medium" | "low";
};

export type ProposedEntity = {
  id: string;
  requestedName: string;
  label: string;
  worksheetId: string | null;
  tableName: string | null;
  confidence: "high" | "medium" | "low";
  binding: "exact" | "similar" | "scope_fallback" | "unresolved";
};

export type ProposedMetric = {
  id: string;
  label: string;
  kind: "count_rows" | "count_entities" | "sum" | "average" | "metric_column";
  tableName: string | null;
  columnName: string | null;
  synthesized: boolean;
  confidence: "high" | "medium" | "low";
};

export type ProposedGrouping = {
  id: string;
  label: string;
  tableName: string | null;
  columnName: string | null;
  confidence: "high" | "medium" | "low";
};

export type ProposedFilter = {
  id: string;
  label: string;
  tableName: string | null;
  columnName: string | null;
  semantics: "resolved" | "needs_review";
  reason: string;
};

export type ProposedJoinNeed = {
  id: string;
  leftEntity: string;
  rightEntity: string;
  leftTable: string | null;
  rightTable: string | null;
  status: "verified" | "needs_review" | "missing" | "not_required";
  contractId: string | null;
  reason: string;
};

export type ProposedAssumption = {
  id: string;
  label: string;
  detail: string;
};

export type MissingRequirement = {
  id: string;
  kind: "scope" | "intent" | "entity" | "table" | "column" | "relationship" | "dialect";
  message: string;
};

export type ProposedWarning = {
  id: string;
  severity: "info" | "warning" | "blocking";
  message: string;
};

export type AdaptiveProposalLlmReadiness = {
  safeToOfferFallback: false;
  payloadShape: "metadata_only";
  reason: string;
};

export type AdaptiveReportProposal = {
  proposalKind: "adaptive";
  id: string;
  title: string;
  question: string;
  support: AdaptiveProposalSupport;
  confidence: "high" | "medium" | "low";
  detectedIntent: BusinessIntent;
  entities: ProposedEntity[];
  metrics: ProposedMetric[];
  groupings: ProposedGrouping[];
  filters: ProposedFilter[];
  joinNeeds: ProposedJoinNeed[];
  assumptions: ProposedAssumption[];
  missingRequirements: MissingRequirement[];
  warnings: ProposedWarning[];
  semanticHints: SemanticHint[];
  renderer: {
    status: "not_rendered";
    canRender: false;
    targetDialect: "duckdb";
    selectedGuidanceDialect?: SqlDialectId;
    notes: string[];
  };
  sql: null;
  canRenderSql: false;
  canInsertSql: false;
  canRunSql: false;
  llmReadiness: AdaptiveProposalLlmReadiness;
  payloadFingerprint: string;
  proposalNarrative: string;
};

export type AdaptiveReportProposalRequest = {
  prompt: string;
  detectedIntent?: BusinessIntent | null;
  selectedGuidanceDialect?: SqlDialectId;
  appliedScopeSelections?: readonly AnalysisScopeSelection[];
  worksheets?: readonly Pick<
    WorksheetMetadata,
    "worksheetId" | "displayName" | "sheetName" | "tableName" | "schema"
  >[];
  acceptedRelationshipContracts?: readonly AcceptedRelationshipContract[];
  semanticHints?: readonly SemanticHint[];
};

type WorksheetInput = NonNullable<AdaptiveReportProposalRequest["worksheets"]>[number];

type BoundColumn = {
  worksheet: WorksheetInput;
  column: SchemaColumn;
  confidence: "high" | "medium" | "low";
  semanticRoles?: SemanticColumnRole[];
};

const EMPTY_RENDERER: AdaptiveReportProposal["renderer"] = {
  status: "not_rendered",
  canRender: false,
  targetDialect: "duckdb",
  notes: ["Planning only. SQL is not generated, inserted, or run for adaptive proposals."],
};

const EMPTY_LLM_READINESS: AdaptiveProposalLlmReadiness = {
  safeToOfferFallback: false,
  payloadShape: "metadata_only",
  reason: "Planning outline from worksheet names, columns, and relationships only.",
};

export const EMPTY_ADAPTIVE_REPORT_PROPOSAL: AdaptiveReportProposal = {
  proposalKind: "adaptive",
  id: "adaptive-report-proposal:empty",
  title: "No adaptive report proposal",
  question: "",
  support: "unsupported",
  confidence: "low",
  detectedIntent: EMPTY_BUSINESS_INTENT,
  entities: [],
  metrics: [],
  groupings: [],
  filters: [],
  joinNeeds: [],
  assumptions: [],
  missingRequirements: [
    {
      id: "missing-prompt",
      kind: "intent",
      message: "Describe the business question before proposing a report.",
    },
  ],
  warnings: [],
  semanticHints: [],
  renderer: EMPTY_RENDERER,
  sql: null,
  canRenderSql: false,
  canInsertSql: false,
  canRunSql: false,
  llmReadiness: EMPTY_LLM_READINESS,
  payloadFingerprint: "adaptive:v1:empty",
  proposalNarrative:
    "No adaptive report proposal is available yet. Add a business question and applied worksheet scope to review a draft structure, no SQL yet.",
};

const normalize = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[_%()]+/g, " ")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const compactId = (value: string): string =>
  normalize(value).replace(/\s+/g, "-") || "unknown";

const singularize = (value: string): string => {
  const normalized = normalize(value);
  if (normalized.endsWith("ies")) return `${normalized.slice(0, -3)}y`;
  if (normalized.endsWith("ses")) return normalized.slice(0, -2);
  if (normalized.endsWith("s") && normalized.length > 3) return normalized.slice(0, -1);
  return normalized;
};

const nameScore = (left: string, right: string): "high" | "medium" | null => {
  const a = normalize(left);
  const b = normalize(right);
  if (!a || !b) return null;
  if (a === b || singularize(a) === singularize(b)) return "high";
  if (a.includes(b) || b.includes(a)) return "medium";
  const aParts = a.split(" ");
  const bParts = b.split(" ");
  if (aParts.some((part) => bParts.includes(part) || singularize(part) === singularize(b))) {
    return "medium";
  }
  return null;
};

const worksheetLabel = (worksheet: WorksheetInput): string =>
  worksheet.displayName || worksheet.sheetName || worksheet.tableName;

const scopeTableNames = (scope: readonly AnalysisScopeSelection[]): string[] =>
  Array.from(
    new Set(
      scope
        .map((selection) => selection.tableName || selection.originalTableName || "")
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );

const scopedWorksheets = (
  worksheets: readonly WorksheetInput[],
  scope: readonly AnalysisScopeSelection[],
): WorksheetInput[] => {
  if (scope.length === 0) return [];
  const scopeIds = new Set(scope.map((selection) => selection.worksheetId));
  const tables = new Set(scopeTableNames(scope).map(normalize));
  return worksheets.filter(
    (worksheet) =>
      scopeIds.has(worksheet.worksheetId) || tables.has(normalize(worksheet.tableName)),
  );
};

const allColumns = (worksheets: readonly WorksheetInput[]) =>
  worksheets.flatMap((worksheet) =>
    worksheet.schema.map((column) => ({ worksheet, column })),
  );

const createSemanticColumnHints = (
  worksheets: readonly WorksheetInput[],
  contracts: readonly AcceptedRelationshipContract[],
): SemanticColumnHint[] =>
  inferSemanticTableHints({
    tables: worksheets.map((worksheet) => ({
      worksheetId: worksheet.worksheetId,
      displayName: worksheet.displayName,
      sheetName: worksheet.sheetName,
      tableName: worksheet.tableName,
      schema: worksheet.schema,
    })),
    acceptedRelationshipContracts: contracts,
  }).columns;

const proposalConfidenceFromSemanticHint = (
  hint: SemanticColumnHint,
): BoundColumn["confidence"] => hint.confidence;

const semanticColumnToBoundColumn = (
  hint: SemanticColumnHint,
  worksheets: readonly WorksheetInput[],
): BoundColumn | null => {
  const worksheet = worksheets.find(
    (candidate) =>
      candidate.worksheetId === hint.worksheetId ||
      normalize(candidate.tableName) === normalize(hint.tableName),
  );
  const column = worksheet?.schema.find(
    (candidate) => normalize(candidate.name) === normalize(hint.columnName),
  );
  if (!worksheet || !column) return null;
  return {
    worksheet,
    column,
    confidence: proposalConfidenceFromSemanticHint(hint),
    semanticRoles: hint.roles,
  };
};

const roleMatches = (
  hint: SemanticColumnHint,
  roles: readonly SemanticColumnRole[],
): boolean => roles.some((role) => hint.roles.includes(role));

const promptScoreForSemanticHint = (
  hint: SemanticColumnHint,
  prompt: string,
): number => {
  const text = normalize(prompt);
  if (!text) return 0;
  const tableName = normalize(hint.tableName);
  const tableStem = singularize(tableName);
  const columnParts = normalize(hint.columnName).split(" ").filter((part) => part.length > 2);
  let score = 0;
  if (text.includes(tableName) || text.includes(tableStem)) score += 4;
  score += columnParts.filter((part) => text.includes(part)).length;
  return score;
};

const findSemanticColumn = ({
  preferredName,
  prompt = "",
  worksheets,
  semanticColumns,
  roles,
}: {
  preferredName?: string;
  prompt?: string;
  worksheets: readonly WorksheetInput[];
  semanticColumns: readonly SemanticColumnHint[];
  roles: readonly SemanticColumnRole[];
}): BoundColumn | null => {
  const ranked = semanticColumns
    .filter((hint) => roleMatches(hint, roles))
    .map((hint) => {
      const nameConfidence = preferredName ? nameScore(preferredName, hint.columnName) : null;
      const tableConfidence = preferredName ? nameScore(preferredName, hint.tableName) : null;
      const confidenceScore =
        hint.confidence === "high" ? 6 : hint.confidence === "medium" ? 4 : 1;
      const score =
        confidenceScore +
        (roles.includes(hint.primaryRole) ? 3 : 0) +
        (nameConfidence === "high" ? 8 : nameConfidence === "medium" ? 4 : 0) +
        (tableConfidence === "high" ? 4 : tableConfidence === "medium" ? 2 : 0) +
        promptScoreForSemanticHint(hint, prompt);
      return { hint, score };
    })
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.hint.tableName.localeCompare(right.hint.tableName) ||
        left.hint.columnName.localeCompare(right.hint.columnName),
    );

  for (const candidate of ranked) {
    const bound = semanticColumnToBoundColumn(candidate.hint, worksheets);
    if (bound) return bound;
  }
  return null;
};

const semanticHintsForProposal = (
  hints: readonly SemanticColumnHint[],
): SemanticHint[] =>
  hints
    .filter((hint) => hint.primaryRole !== "unknown")
    .map((hint) => {
      const target: SemanticHint["target"] = hint.roles.includes("foreign_key")
        ? "relationship"
        : hint.roles.includes("metric_candidate")
          ? "metric"
          : hint.roles.includes("grouping_candidate")
            ? "grouping"
            : hint.roles.includes("filter_candidate")
              ? "filter"
              : "entity";
      return {
        id: `semantic-hint:${compactId(hint.tableName)}:${compactId(hint.columnName)}:${hint.primaryRole}`,
        target,
        label: `${hint.columnName}: ${hint.primaryRole.replace("_", " ")}`,
        worksheetId: hint.worksheetId || undefined,
        tableName: hint.tableName,
        columnName: hint.columnName,
        confidence: hint.confidence,
      };
    });

const uniqueSemanticHints = (hints: readonly SemanticHint[]): SemanticHint[] => {
  const seen = new Set<string>();
  const unique: SemanticHint[] = [];
  for (const hint of hints) {
    if (seen.has(hint.id)) continue;
    seen.add(hint.id);
    unique.push(hint);
  }
  return unique;
};

const findWorksheetForEntity = (
  entityName: string,
  worksheets: readonly WorksheetInput[],
): ProposedEntity => {
  let best: { worksheet: WorksheetInput; confidence: "high" | "medium" } | null = null;

  for (const worksheet of worksheets) {
    const confidence =
      nameScore(entityName, worksheet.tableName) ||
      nameScore(entityName, worksheetLabel(worksheet));
    if (confidence === "high") {
      best = { worksheet, confidence };
      break;
    }
    if (confidence === "medium" && !best) best = { worksheet, confidence };
  }

  if (best) {
    return {
      id: `entity:${compactId(entityName)}`,
      requestedName: entityName,
      label: worksheetLabel(best.worksheet),
      worksheetId: best.worksheet.worksheetId,
      tableName: best.worksheet.tableName,
      confidence: best.confidence,
      binding: best.confidence === "high" ? "exact" : "similar",
    };
  }

  return {
    id: `entity:${compactId(entityName)}`,
    requestedName: entityName,
    label: entityName,
    worksheetId: null,
    tableName: null,
    confidence: "low",
    binding: "unresolved",
  };
};

const fallbackEntitiesFromScope = (worksheets: readonly WorksheetInput[]): ProposedEntity[] =>
  worksheets.slice(0, 3).map((worksheet) => ({
    id: `entity:${compactId(worksheet.tableName)}`,
    requestedName: worksheet.tableName,
    label: worksheetLabel(worksheet),
    worksheetId: worksheet.worksheetId,
    tableName: worksheet.tableName,
    confidence: "low",
    binding: "scope_fallback",
  }));

const findColumn = (
  columnName: string,
  worksheets: readonly WorksheetInput[],
  semanticColumns: readonly SemanticColumnHint[] = [],
  roles: readonly SemanticColumnRole[] = [],
): BoundColumn | null => {
  let best: BoundColumn | null = null;
  for (const item of allColumns(worksheets)) {
    const confidence = nameScore(columnName, item.column.name);
    if (confidence === "high") return { ...item, confidence };
    if (confidence === "medium" && !best) best = { ...item, confidence };
  }
  return (
    best ||
    (roles.length > 0
      ? findSemanticColumn({
          preferredName: columnName,
          worksheets,
          semanticColumns,
          roles,
        })
      : null)
  );
};

const inferMetricKind = (metric: string): ProposedMetric["kind"] => {
  const text = normalize(metric);
  if (text.startsWith("avg ") || text.startsWith("average ")) return "average";
  if (text.startsWith("sum ") || text.startsWith("total ")) return "sum";
  if (text.startsWith("count ")) return "count_entities";
  return "metric_column";
};

const proposeMetrics = (
  intent: BusinessIntent,
  worksheets: readonly WorksheetInput[],
  semanticColumns: readonly SemanticColumnHint[],
): ProposedMetric[] => {
  if (intent.metrics.length === 0) {
    return [
      {
        id: "metric:count-rows",
        label: "Count rows",
        kind: "count_rows",
        tableName: worksheets[0]?.tableName || null,
        columnName: null,
        synthesized: true,
        confidence: worksheets.length > 0 ? "high" : "low",
      },
    ];
  }

  return intent.metrics.map((metric) => {
    const metricName = metric.replace(/^(count|sum|total|avg|average)_?/, "");
    const column = findColumn(metricName, worksheets, semanticColumns, [
      "metric_candidate",
      "amount",
      "quantity",
      "countable_entity",
      "identifier",
    ]);
    const kind = inferMetricKind(metric.replace(/_/g, " "));
    return {
      id: `metric:${compactId(metric)}`,
      label: metric.replace(/_/g, " "),
      kind,
      tableName: column?.worksheet.tableName || worksheets[0]?.tableName || null,
      columnName: column?.column.name || (kind === "count_entities" ? null : null),
      synthesized: kind === "count_entities" && !column,
      confidence: column?.confidence || (kind === "count_entities" ? "medium" : "low"),
    };
  });
};

const proposeGroupings = (
  intent: BusinessIntent,
  worksheets: readonly WorksheetInput[],
  semanticColumns: readonly SemanticColumnHint[],
): ProposedGrouping[] =>
  intent.grouping.map((grouping) => {
    const column = findColumn(grouping, worksheets, semanticColumns, [
      "grouping_candidate",
      "category",
      "name",
      "foreign_key",
      "identifier",
    ]);
    return {
      id: `grouping:${compactId(grouping)}`,
      label: grouping,
      tableName: column?.worksheet.tableName || null,
      columnName: column?.column.name || null,
      confidence: column?.confidence || "low",
    };
  });

const promptHasAny = (prompt: string, terms: readonly string[]): boolean => {
  const text = normalize(prompt);
  return terms.some((term) => text.includes(term));
};

const firstColumnByKind = (
  worksheets: readonly WorksheetInput[],
  kind: SchemaColumn["inferred_type"],
): BoundColumn | null =>
  allColumns(worksheets).find((item) => item.column.inferred_type === kind)
    ? {
        ...allColumns(worksheets).find((item) => item.column.inferred_type === kind)!,
        confidence: "medium",
      }
    : null;

const proposeFilters = (
  prompt: string,
  intent: BusinessIntent,
  worksheets: readonly WorksheetInput[],
  semanticColumns: readonly SemanticColumnHint[],
): ProposedFilter[] => {
  const filters: ProposedFilter[] = [];
  const statusColumn = findColumn("status", worksheets, semanticColumns, [
    "status",
  ]);
  const dateColumn =
    findSemanticColumn({
      prompt,
      worksheets,
      semanticColumns,
      roles: ["date"],
    }) || firstColumnByKind(worksheets, "date");

  if (promptHasAny(prompt, ["status", "active", "inactive", "open", "closed", "current"])) {
    filters.push({
      id: "filter:status-semantics",
      label: "Status/current semantics",
      tableName: statusColumn?.worksheet.tableName || null,
      columnName: statusColumn?.column.name || null,
      semantics: "needs_review",
      reason: "Status and current/open/closed labels vary by dataset and need review.",
    });
  }

  if (
    intent.explicitlyTemporal ||
    promptHasAny(prompt, [
      "expired",
      "expires",
      "overdue",
      "recent",
      "within",
      "before",
      "after",
      "no recent",
      "missing recent",
      "without recent",
    ])
  ) {
    filters.push({
      id: "filter:date-semantics",
      label: "Date-window semantics",
      tableName: dateColumn?.worksheet.tableName || null,
      columnName: dateColumn?.column.name || null,
      semantics: "needs_review",
      reason: "Date windows such as current, expired, recent, or overdue require human confirmation.",
    });
  }

  if (promptHasAny(prompt, ["unresolved", "low stock", "selling fast", "fast selling", "high turnover"])) {
    const conditionColumn = findSemanticColumn({
      prompt,
      worksheets,
      semanticColumns,
      roles: ["status", "quantity", "metric_candidate"],
    });
    filters.push({
      id: "filter:business-condition-semantics",
      label: "Business condition semantics",
      tableName: conditionColumn?.worksheet.tableName || null,
      columnName: conditionColumn?.column.name || null,
      semantics: "needs_review",
      reason: "Condition labels such as unresolved, low stock, selling fast, or high turnover vary by dataset.",
    });
  }

  return filters;
};

const sameName = (left: string | null | undefined, right: string | null | undefined): boolean =>
  Boolean(left && right && normalize(left) === normalize(right));

const contractMatchesTables = (
  contract: AcceptedRelationshipContract,
  leftTable: string,
  rightTable: string,
): boolean => {
  const direct =
    sameName(contract.sourceTableName, leftTable) &&
    sameName(contract.targetTableName, rightTable);
  const reverse =
    sameName(contract.sourceTableName, rightTable) &&
    sameName(contract.targetTableName, leftTable);
  return direct || reverse;
};

const likelyRelated = (left: ProposedEntity, right: ProposedEntity): boolean => {
  if (!left.tableName || !right.tableName) return false;
  const leftStem = singularize(left.tableName);
  const rightStem = singularize(right.tableName);
  return leftStem.includes(rightStem) || rightStem.includes(leftStem);
};

const hasSemanticForeignKeyBetween = (
  left: ProposedEntity,
  right: ProposedEntity,
  semanticColumns: readonly SemanticColumnHint[],
): boolean => {
  if (!left.tableName || !right.tableName) return false;
  const leftTable = normalize(left.tableName);
  const rightTable = normalize(right.tableName);
  const leftStem = singularize(left.tableName);
  const rightStem = singularize(right.tableName);
  return semanticColumns.some((hint) => {
    if (!hint.roles.includes("foreign_key")) return false;
    const hintTable = normalize(hint.tableName);
    const hintColumn = normalize(hint.columnName);
    return (
      (hintTable === leftTable && hintColumn.includes(`${rightStem} id`)) ||
      (hintTable === rightTable && hintColumn.includes(`${leftStem} id`))
    );
  });
};

const proposeJoinNeeds = (
  entities: readonly ProposedEntity[],
  contracts: readonly AcceptedRelationshipContract[],
  semanticColumns: readonly SemanticColumnHint[],
): ProposedJoinNeed[] => {
  const boundEntities = entities.filter((entity) => entity.tableName);
  if (boundEntities.length <= 1) {
    return [
      {
        id: "join:not-required",
        leftEntity: boundEntities[0]?.label || "single entity",
        rightEntity: "",
        leftTable: boundEntities[0]?.tableName || null,
        rightTable: null,
        status: "not_required",
        contractId: null,
        reason: "A single bound entity does not require a join.",
      },
    ];
  }

  const needs: ProposedJoinNeed[] = [];
  const joinPairs =
    boundEntities.length > 2
      ? boundEntities.slice(1).map((entity) => [boundEntities[0], entity] as const)
      : [[boundEntities[0], boundEntities[1]] as const];

  for (const [left, right] of joinPairs) {
    const contract = contracts.find(
      (candidate) =>
        candidate.status === "active" &&
        candidate.validationState !== "broken" &&
        contractMatchesTables(candidate, left.tableName!, right.tableName!),
    );
    const status: ProposedJoinNeed["status"] = contract
      ? "verified"
      : likelyRelated(left, right) || hasSemanticForeignKeyBetween(left, right, semanticColumns)
        ? "needs_review"
        : "missing";
    needs.push({
      id: `join:${compactId(left.label)}:${compactId(right.label)}`,
      leftEntity: left.label,
      rightEntity: right.label,
      leftTable: left.tableName,
      rightTable: right.tableName,
      status,
      contractId: contract?.contractId || null,
      reason: contract
        ? "Accepted relationship metadata verifies this join need."
        : status === "needs_review"
          ? "Entity names or semantic foreign-key hints suggest a possible relationship, but no accepted contract verifies it."
          : "No accepted relationship contract connects these entities.",
    });
  }
  return needs;
};

const createMissingRequirements = ({
  prompt,
  intent,
  scope,
  entities,
  groupings,
  metrics,
  joinNeeds,
}: {
  prompt: string;
  intent: BusinessIntent;
  scope: readonly AnalysisScopeSelection[];
  entities: readonly ProposedEntity[];
  groupings: readonly ProposedGrouping[];
  metrics: readonly ProposedMetric[];
  joinNeeds: readonly ProposedJoinNeed[];
}): MissingRequirement[] => {
  const missing: MissingRequirement[] = [];
  if (!prompt.trim()) {
    missing.push({
      id: "missing-prompt",
      kind: "intent",
      message: "Describe the business question before proposing a report.",
    });
  }
  if (intent.primaryIntent === "unknown" && intent.alternates.length === 0) {
    missing.push({
      id: "missing-intent",
      kind: "intent",
      message: "No deterministic business intent was supplied for this proposal.",
    });
  }
  if (scope.length === 0) {
    missing.push({
      id: "missing-scope",
      kind: "scope",
      message: "Apply worksheet scope before building an adaptive report proposal.",
    });
  }
  for (const entity of entities.filter((entity) => !entity.tableName)) {
    missing.push({
      id: `missing-entity:${compactId(entity.requestedName)}`,
      kind: "entity",
      message: `Could not bind requested entity \`${entity.requestedName}\` to an applied worksheet.`,
    });
  }
  for (const grouping of groupings.filter((grouping) => !grouping.columnName)) {
    missing.push({
      id: `missing-grouping:${compactId(grouping.label)}`,
      kind: "column",
      message: `Could not bind grouping \`${grouping.label}\` to a column.`,
    });
  }
  for (const metric of metrics.filter((metric) => metric.confidence === "low")) {
    missing.push({
      id: `missing-metric:${compactId(metric.label)}`,
      kind: "column",
      message: `Could not safely bind metric \`${metric.label}\` to metadata.`,
    });
  }
  for (const join of joinNeeds.filter((join) => join.status === "missing")) {
    missing.push({
      id: `missing-relationship:${compactId(join.id)}`,
      kind: "relationship",
      message: `Missing relationship metadata between \`${join.leftEntity}\` and \`${join.rightEntity}\`.`,
    });
  }
  return missing;
};

const createAssumptions = (
  entities: readonly ProposedEntity[],
  metrics: readonly ProposedMetric[],
  groupings: readonly ProposedGrouping[],
): ProposedAssumption[] => {
  const assumptions: ProposedAssumption[] = [];
  for (const entity of entities.filter((entity) => entity.confidence !== "high")) {
    assumptions.push({
      id: `assumption:entity:${compactId(entity.requestedName)}`,
      label: "Entity binding",
      detail: `Treating \`${entity.label}\` as the best metadata match for \`${entity.requestedName}\`.`,
    });
  }
  for (const metric of metrics.filter((metric) => metric.synthesized)) {
    assumptions.push({
      id: `assumption:metric:${compactId(metric.label)}`,
      label: "Metric fallback",
      detail: `Using \`${metric.label}\` because no safer metric column was supplied.`,
    });
  }
  for (const grouping of groupings.filter((grouping) => grouping.confidence !== "high")) {
    assumptions.push({
      id: `assumption:grouping:${compactId(grouping.label)}`,
      label: "Grouping binding",
      detail: `Grouping \`${grouping.label}\` needs review against available columns.`,
    });
  }
  return assumptions;
};

const createWarnings = (
  filters: readonly ProposedFilter[],
  joinNeeds: readonly ProposedJoinNeed[],
  selectedGuidanceDialect: SqlDialectId | undefined,
): ProposedWarning[] => {
  const warnings: ProposedWarning[] = [];
  if (filters.some((filter) => filter.semantics === "needs_review")) {
    warnings.push({
      id: "ambiguous-filter-semantics",
      severity: "warning",
      message: "Filter semantics need review before any future SQL rendering.",
    });
  }
  if (joinNeeds.some((join) => join.status === "needs_review")) {
    warnings.push({
      id: "relationship-needs-review",
      severity: "warning",
      message: "One or more join needs require relationship review.",
    });
  }
  if (selectedGuidanceDialect && selectedGuidanceDialect !== "duckdb") {
    warnings.push({
      id: "dialect-guidance-only",
      severity: "info",
      message: `${selectedGuidanceDialect} is recorded only as guidance metadata; no SQL is rendered.`,
    });
  }
  return warnings;
};

const computeSupport = ({
  missingRequirements,
  filters,
  joinNeeds,
}: {
  missingRequirements: readonly MissingRequirement[];
  filters: readonly ProposedFilter[];
  joinNeeds: readonly ProposedJoinNeed[];
}): AdaptiveProposalSupport => {
  const blockingKinds: MissingRequirement["kind"][] = ["scope", "intent", "entity", "table"];
  if (missingRequirements.some((requirement) => blockingKinds.includes(requirement.kind))) {
    return "unsupported";
  }
  if (
    filters.some((filter) => filter.semantics === "needs_review") ||
    joinNeeds.some((join) => join.status === "needs_review" || join.status === "missing") ||
    missingRequirements.length > 0
  ) {
    return "needs_review";
  }
  return "supported";
};

const computeConfidence = (
  entities: readonly ProposedEntity[],
  metrics: readonly ProposedMetric[],
  groupings: readonly ProposedGrouping[],
): AdaptiveReportProposal["confidence"] => {
  const values = [
    ...entities.map((entity) => entity.confidence),
    ...metrics.map((metric) => metric.confidence),
    ...groupings.map((grouping) => grouping.confidence),
  ];
  if (values.length === 0) return "low";
  if (values.every((value) => value === "high")) return "high";
  if (values.some((value) => value === "high" || value === "medium")) return "medium";
  return "low";
};

const stableStrings = (values: readonly string[]): string[] =>
  Array.from(new Set(values.map((value) => normalize(value)).filter(Boolean))).sort();

const createFingerprint = ({
  intent,
  scope,
  entities,
  joinNeeds,
}: {
  intent: BusinessIntent;
  scope: readonly AnalysisScopeSelection[];
  entities: readonly ProposedEntity[];
  joinNeeds: readonly ProposedJoinNeed[];
}): string =>
  JSON.stringify({
    version: "adaptive-report-proposal:v1",
    intent: {
      primaryIntent: intent.primaryIntent,
      alternates: stableStrings(intent.alternates),
      entities: stableStrings(intent.entities),
      metrics: stableStrings(intent.metrics),
      grouping: stableStrings(intent.grouping),
      relationshipPredicate: intent.relationshipPredicate,
      explicitlyTemporal: intent.explicitlyTemporal,
      detectorVersion: intent.detectorVersion,
    },
    scopeTables: stableStrings(scopeTableNames(scope)),
    entityNames: stableStrings(entities.map((entity) => entity.label)),
    relationshipStatuses: joinNeeds
      .map((join) => `${normalize(join.leftEntity)}>${normalize(join.rightEntity)}:${join.status}`)
      .sort(),
  });

const createNarrative = (
  support: AdaptiveProposalSupport,
  entities: readonly ProposedEntity[],
  metrics: readonly ProposedMetric[],
  joinNeeds: readonly ProposedJoinNeed[],
): string => {
  const entityText =
    entities.length > 0 ? entities.map((entity) => entity.label).join(", ") : "the applied scope";
  const metricText =
    metrics.length > 0 ? metrics.map((metric) => metric.label).join(", ") : "metadata signals";
  const joinText = joinNeeds.some((join) => join.status === "verified")
    ? " Relationship metadata is available for at least one join."
    : joinNeeds.some((join) => join.status === "needs_review" || join.status === "missing")
      ? " Relationship assumptions need review before SQL could be rendered."
      : "";
  return support === "unsupported"
    ? `FiltraQueri cannot safely propose this report yet because required metadata is missing. Add scope or clarify the task before generating SQL.`
    : `FiltraQueri can outline a draft structure, no SQL yet, using ${entityText} with ${metricText}.${joinText}`;
};

const createTitle = (prompt: string): string => {
  const phrase = normalize(prompt)
    .replace(/^(please|can you|could you|show me|show|find|identify)\s+/, "")
    .slice(0, 72)
    .trim();
  return phrase
    ? `Proposal sketch: ${phrase}`
    : "Proposal sketch: how to answer your question";
};

export function proposeAdaptiveReport(
  request: AdaptiveReportProposalRequest,
): AdaptiveReportProposal {
  const prompt = request.prompt || "";
  const detectedIntent = request.detectedIntent || EMPTY_BUSINESS_INTENT;
  if (!prompt.trim() && detectedIntent.primaryIntent === "unknown") {
    return EMPTY_ADAPTIVE_REPORT_PROPOSAL;
  }

  const appliedScopeSelections = request.appliedScopeSelections || [];
  const worksheets = scopedWorksheets(request.worksheets || [], appliedScopeSelections);
  const semanticColumns = createSemanticColumnHints(
    worksheets,
    request.acceptedRelationshipContracts || [],
  );
  const semanticHints = uniqueSemanticHints([
    ...(request.semanticHints || []),
    ...semanticHintsForProposal(semanticColumns),
  ]);
  const requestedEntities = detectedIntent.entities.length > 0 ? detectedIntent.entities : [];
  const entities =
    requestedEntities.length > 0
      ? requestedEntities.map((entity) => findWorksheetForEntity(entity, worksheets))
      : fallbackEntitiesFromScope(worksheets);
  const metrics = proposeMetrics(detectedIntent, worksheets, semanticColumns);
  const groupings = proposeGroupings(detectedIntent, worksheets, semanticColumns);
  const filters = proposeFilters(prompt, detectedIntent, worksheets, semanticColumns);
  const joinNeeds = proposeJoinNeeds(
    entities,
    request.acceptedRelationshipContracts || [],
    semanticColumns,
  );
  const missingRequirements = createMissingRequirements({
    prompt,
    intent: detectedIntent,
    scope: appliedScopeSelections,
    entities,
    groupings,
    metrics,
    joinNeeds,
  });
  const assumptions = createAssumptions(entities, metrics, groupings);
  const warnings = createWarnings(filters, joinNeeds, request.selectedGuidanceDialect);
  const support = computeSupport({ missingRequirements, filters, joinNeeds });
  const confidence = computeConfidence(entities, metrics, groupings);
  const payloadFingerprint = createFingerprint({
    intent: detectedIntent,
    scope: appliedScopeSelections,
    entities,
    joinNeeds,
  });

  return {
    proposalKind: "adaptive",
    id: `adaptive-report-proposal:${compactId(payloadFingerprint)}`,
    title: createTitle(prompt),
    question: prompt,
    support,
    confidence,
    detectedIntent,
    entities,
    metrics,
    groupings,
    filters,
    joinNeeds,
    assumptions,
    missingRequirements,
    warnings,
    semanticHints,
    renderer: {
      ...EMPTY_RENDERER,
      selectedGuidanceDialect: request.selectedGuidanceDialect,
    },
    sql: null,
    canRenderSql: false,
    canInsertSql: false,
    canRunSql: false,
    llmReadiness: EMPTY_LLM_READINESS,
    payloadFingerprint,
    proposalNarrative: createNarrative(support, entities, metrics, joinNeeds),
  };
}
