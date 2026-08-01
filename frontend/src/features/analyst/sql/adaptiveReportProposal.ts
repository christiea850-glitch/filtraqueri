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
import type {
  BusinessSqlAggregateComparisonOperator,
  BusinessSqlAggregateComparisonValue,
  BusinessSqlFilterComparisonValue,
  BusinessSqlFilterOperator,
} from "./businessSqlQueryPlan";
import { createBusinessSqlMeasureAlias } from "./businessSqlQueryPlan";
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
  kind:
    | "count_rows"
    | "count_entities"
    | "count_distinct"
    | "sum"
    | "average"
    | "minimum"
    | "maximum"
    | "metric_column";
  tableName: string | null;
  columnName: string | null;
  inferredType?: SchemaColumn["inferred_type"];
  synthesized: boolean;
  confidence: "high" | "medium" | "low";
};

export type ProposedAggregateResultCondition = {
  id: string;
  metricId?: string;
  target?:
    | {
        kind: "metric";
        metricId: string;
      }
    | {
        kind: "derived_measure";
        derivedMeasureId: string;
      };
  operator: BusinessSqlAggregateComparisonOperator;
  comparisonValue: BusinessSqlAggregateComparisonValue;
  label?: string;
  evidence?: string;
  confidence: "high" | "medium" | "low";
};

export type ProposedDerivedMeasure = {
  id: string;
  operator: "subtract" | "divide" | "add" | "multiply";
  leftMetricId: string;
  rightMetricId: string;
  divisionPolicy?: {
    zeroDenominator: "null";
  };
  sqlAlias: string;
  label?: string;
  evidence?: string;
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
  semantics: "resolved" | "needs_review" | "canonical";
  reason: string;
  executable?: true;
  target?: {
    kind: "field";
    entity?: string;
    table: string;
    field: string;
    fieldInferredType?: SchemaColumn["inferred_type"];
    resolved: boolean;
  };
  operator?: BusinessSqlFilterOperator;
  comparisonValue?: BusinessSqlFilterComparisonValue;
  evidence?: string;
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

export type ProposedSort = {
  id: string;
  label: string;
  target: "metric" | "grouping" | "derived_measure";
  targetId: string;
  direction: "asc" | "desc";
  confidence: "high" | "medium" | "low";
};

export type ProposedRowLimit = {
  id: string;
  value: number;
  confidence: "high" | "medium" | "low";
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
  derivedMeasures: ProposedDerivedMeasure[];
  groupings: ProposedGrouping[];
  aggregateResultConditions: ProposedAggregateResultCondition[];
  sorts?: ProposedSort[];
  rowLimit?: ProposedRowLimit | null;
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
  derivedMeasures: [],
  groupings: [],
  aggregateResultConditions: [],
  sorts: [],
  rowLimit: null,
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

  if (!best) {
    const columnBackedWorksheet = worksheets.find((worksheet) =>
      worksheet.schema.some((column) => nameScore(entityName, column.name)),
    );
    if (columnBackedWorksheet) {
      const explicitColumnName = columnBackedWorksheet.schema.some(
        (column) => nameScore(entityName, column.name) === "high",
      );
      best = { worksheet: columnBackedWorksheet, confidence: explicitColumnName ? "high" : "medium" };
    }
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

const findColumnByName = (
  columnName: string,
  worksheets: readonly WorksheetInput[],
): BoundColumn | null => {
  let best: BoundColumn | null = null;
  for (const item of allColumns(worksheets)) {
    const confidence = nameScore(columnName, item.column.name);
    if (confidence === "high") return { ...item, confidence };
    if (confidence === "medium" && !best) best = { ...item, confidence };
  }
  return best;
};

const inferMetricKind = (metric: string): ProposedMetric["kind"] => {
  const text = normalize(metric);
  if (text.startsWith("avg ") || text.startsWith("average ")) return "average";
  if (text.startsWith("minimum ") || text.startsWith("min ")) return "minimum";
  if (text.startsWith("maximum ") || text.startsWith("max ")) return "maximum";
  if (text.startsWith("sum ") || text.startsWith("total ")) return "sum";
  if (text.startsWith("distinct count ") || text.startsWith("count distinct ")) return "count_distinct";
  if (text.startsWith("count ") || text.endsWith(" count")) return "count_entities";
  return "metric_column";
};

const createProposedDerivedMeasureId = ({
  operator,
  leftMetricId,
  rightMetricId,
  divisionPolicy,
}: Pick<
  ProposedDerivedMeasure,
  "operator" | "leftMetricId" | "rightMetricId" | "divisionPolicy"
>): string =>
  [
    "derived-measure",
    operator,
    compactId(leftMetricId),
    compactId(rightMetricId),
    operator === "divide" ? divisionPolicy?.zeroDenominator || "missing-policy" : null,
  ]
    .filter((part): part is string => Boolean(part))
    .join(":");

type ExplicitSubtractionFormula =
  | {
      status: "none";
    }
  | {
      status: "unsupported";
      reason: "multiple_subtractions" | "missing_left_operand" | "missing_right_operand";
    }
  | {
      status: "detected";
      leftPhrase: string;
      rightPhrase: string;
      groupingPhrase: string | null;
      evidence: string;
    };

type ExplicitDivisionFormula =
  | {
      status: "none";
    }
  | {
      status: "unsupported";
      reason:
        | "multiple_divisions"
        | "mixed_formulas"
        | "missing_left_operand"
        | "missing_right_operand";
    }
  | {
      status: "detected";
      leftPhrase: string;
      rightPhrase: string;
      groupingPhrase: string | null;
      evidence: string;
    };

type ExplicitAddMultiplyFormula =
  | {
      status: "none";
    }
  | {
      status: "unsupported";
      reason:
        | "multiple_additions"
        | "multiple_multiplications"
        | "mixed_formulas"
        | "missing_left_operand"
        | "missing_right_operand";
    }
  | {
      status: "detected";
      leftPhrase: string;
      rightPhrase: string;
      groupingPhrase: string | null;
      evidence: string;
    };

type ExplicitFormulaOperator = ProposedDerivedMeasure["operator"];

type ExplicitDerivedFormula =
  | {
      status: "none";
    }
  | {
      status: "unsupported";
      operator: ExplicitFormulaOperator | "mixed";
      reason:
        | "multiple_subtractions"
        | "multiple_divisions"
        | "multiple_additions"
        | "multiple_multiplications"
        | "mixed_formulas"
        | "missing_left_operand"
        | "missing_right_operand";
    }
  | {
      status: "detected";
      operator: ExplicitFormulaOperator;
      leftPhrase: string;
      rightPhrase: string;
      groupingPhrase: string | null;
      evidence: string;
      phrase: string;
    };

const INTRODUCTORY_FORMULA_WORDS =
  /^(?:please\s+)?(?:(?:can|could)\s+you\s+)?(?:show(?:\s+me)?|display|calculate|find|identify|list)(?:\s+(?:the\s+)?)?/;

const trimFormulaOperand = (value: string): string =>
  normalize(value)
    .replace(INTRODUCTORY_FORMULA_WORDS, "")
    .replace(/^(?:the\s+)?/, "")
    .replace(/\b(?:for|in)\s+each\b/g, " by ")
    .trim();

const FORMULA_OPERATORS: ReadonlyArray<{
  operator: ExplicitFormulaOperator;
  phrase: string;
  pattern: RegExp;
  multipleReason: Extract<ExplicitDerivedFormula, { status: "unsupported" }>["reason"];
}> = [
  { operator: "subtract", phrase: "minus", pattern: /\bminus\b/g, multipleReason: "multiple_subtractions" },
  { operator: "divide", phrase: "divided by", pattern: /\bdivided\s+by\b/g, multipleReason: "multiple_divisions" },
  { operator: "add", phrase: "plus", pattern: /\bplus\b/g, multipleReason: "multiple_additions" },
  { operator: "multiply", phrase: "multiplied by", pattern: /\bmultiplied\s+by\b/g, multipleReason: "multiple_multiplications" },
];

const explicitFormulaMatches = (text: string) =>
  FORMULA_OPERATORS.flatMap((definition) =>
    [...text.matchAll(definition.pattern)].map((match) => ({
      ...definition,
      index: match.index || 0,
      text: match[0],
    })),
  ).sort((left, right) => left.index - right.index || left.phrase.localeCompare(right.phrase));

const detectExplicitDerivedFormulaForOperator = (
  prompt: string,
  operator: ExplicitFormulaOperator,
): ExplicitDerivedFormula => {
  const text = normalize(prompt);
  const matches = explicitFormulaMatches(text);
  const operatorMatches = matches.filter((match) => match.operator === operator);
  const definition = FORMULA_OPERATORS.find((item) => item.operator === operator)!;
  if (operatorMatches.length === 0) return { status: "none" };
  if (operatorMatches.length > 1) {
    return { status: "unsupported", operator, reason: definition.multipleReason };
  }
  if (matches.some((match) => match.operator !== operator)) {
    return { status: "unsupported", operator: "mixed", reason: "mixed_formulas" };
  }

  const match = operatorMatches[0];
  const left = trimFormulaOperand(text.slice(0, match.index));
  const rightAndGrouping = text.slice(match.index + match.text.length).trim();
  const groupingMatch = rightAndGrouping.match(/\bby\s+(.+)$/);
  const right = trimFormulaOperand(
    groupingMatch
      ? rightAndGrouping.slice(0, groupingMatch.index).trim()
      : rightAndGrouping,
  );
  const groupingPhrase = groupingMatch ? trimFormulaOperand(groupingMatch[1]) : null;

  if (!left) return { status: "unsupported", operator, reason: "missing_left_operand" };
  if (!right) return { status: "unsupported", operator, reason: "missing_right_operand" };

  return {
    status: "detected",
    operator,
    leftPhrase: left,
    rightPhrase: right,
    groupingPhrase: groupingPhrase || null,
    evidence: `${left} ${definition.phrase} ${right}`,
    phrase: definition.phrase,
  };
};

const detectSelectedExplicitDerivedFormula = (prompt: string): ExplicitDerivedFormula => {
  const text = normalize(prompt);
  const matches = explicitFormulaMatches(text);
  if (matches.length === 0) return { status: "none" };
  const operators = Array.from(new Set(matches.map((match) => match.operator)));
  if (operators.length > 1) {
    return { status: "unsupported", operator: "mixed", reason: "mixed_formulas" };
  }
  return detectExplicitDerivedFormulaForOperator(prompt, operators[0]);
};

export const detectExplicitSubtractionFormula = (
  prompt: string,
): ExplicitSubtractionFormula => {
  const formula = detectExplicitDerivedFormulaForOperator(prompt, "subtract");
  if (formula.status === "none") return formula;
  if (formula.status === "unsupported") {
    return {
      status: "unsupported",
      reason:
        formula.reason === "mixed_formulas"
          ? "multiple_subtractions"
          : formula.reason as Extract<ExplicitSubtractionFormula, { status: "unsupported" }>["reason"],
    };
  }
  const { leftPhrase, rightPhrase, groupingPhrase, evidence } = formula;
  return { status: "detected", leftPhrase, rightPhrase, groupingPhrase, evidence };
};

export const detectExplicitDivisionFormula = (
  prompt: string,
): ExplicitDivisionFormula => {
  const formula = detectExplicitDerivedFormulaForOperator(prompt, "divide");
  if (formula.status === "none") return formula;
  if (formula.status === "unsupported") {
    return {
      status: "unsupported",
      reason:
        formula.reason === "multiple_divisions" ||
        formula.reason === "mixed_formulas" ||
        formula.reason === "missing_left_operand" ||
        formula.reason === "missing_right_operand"
          ? formula.reason
          : "mixed_formulas",
    };
  }
  const { leftPhrase, rightPhrase, groupingPhrase, evidence } = formula;
  return { status: "detected", leftPhrase, rightPhrase, groupingPhrase, evidence };
};

export const detectExplicitAdditionFormula = (
  prompt: string,
): ExplicitAddMultiplyFormula => {
  const formula = detectExplicitDerivedFormulaForOperator(prompt, "add");
  if (formula.status === "none") return formula;
  if (formula.status === "unsupported") {
    return {
      status: "unsupported",
      reason:
        formula.reason === "multiple_additions" ||
        formula.reason === "mixed_formulas" ||
        formula.reason === "missing_left_operand" ||
        formula.reason === "missing_right_operand"
          ? formula.reason
          : "mixed_formulas",
    };
  }
  const { leftPhrase, rightPhrase, groupingPhrase, evidence } = formula;
  return { status: "detected", leftPhrase, rightPhrase, groupingPhrase, evidence };
};

export const detectExplicitMultiplicationFormula = (
  prompt: string,
): ExplicitAddMultiplyFormula => {
  const formula = detectExplicitDerivedFormulaForOperator(prompt, "multiply");
  if (formula.status === "none") return formula;
  if (formula.status === "unsupported") {
    return {
      status: "unsupported",
      reason:
        formula.reason === "multiple_multiplications" ||
        formula.reason === "mixed_formulas" ||
        formula.reason === "missing_left_operand" ||
        formula.reason === "missing_right_operand"
          ? formula.reason
          : "mixed_formulas",
    };
  }
  const { leftPhrase, rightPhrase, groupingPhrase, evidence } = formula;
  return { status: "detected", leftPhrase, rightPhrase, groupingPhrase, evidence };
};

type AggregateThresholdMatch = {
  operator: BusinessSqlAggregateComparisonOperator;
  comparisonValue: BusinessSqlAggregateComparisonValue;
  evidence: string;
  trailingConcept: string | null;
};

type DerivedRankingShell =
  | { status: "none" }
  | {
      status: "unsupported";
      reason: "missing_direction" | "ambiguous_direction" | "formula_not_detected" | "formula_unsupported";
      groupingPhrase?: string;
    }
  | {
      status: "detected";
      groupingPhrase: string;
      direction: "asc" | "desc";
      formula: Extract<ExplicitDerivedFormula, { status: "detected" }>;
    };

type DerivedThresholdShell =
  | { status: "none" }
  | {
      status: "unsupported";
      reason: "missing_threshold" | "multiple_thresholds" | "formula_not_detected" | "formula_unsupported";
      groupingPhrase?: string;
    }
  | {
      status: "detected";
      groupingPhrase: string;
      threshold: AggregateThresholdMatch;
      formula: Extract<ExplicitDerivedFormula, { status: "detected" }>;
    };

const THRESHOLD_PHRASES: ReadonlyArray<{
  operator: BusinessSqlAggregateComparisonOperator;
  phrases: readonly string[];
}> = [
  { operator: "not_equals", phrases: ["not equal to", "different from"] },
  { operator: "greater_than_or_equal", phrases: ["at least", "no less than"] },
  { operator: "less_than_or_equal", phrases: ["at most", "no more than"] },
  { operator: "greater_than", phrases: ["above", "over", "greater than", "more than"] },
  { operator: "less_than", phrases: ["below", "under", "less than", "fewer than"] },
  { operator: "equals", phrases: ["equal to", "equals"] },
];

const NUMBER_TOKEN = String.raw`([^\s]+)`;
const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const THRESHOLD_PHRASE_OPERATOR_BY_TEXT = new Map(
  THRESHOLD_PHRASES.flatMap(({ operator, phrases }) =>
    phrases.map((phrase) => [phrase, operator] as const),
  ),
);
const THRESHOLD_PHRASE_PATTERN = THRESHOLD_PHRASES.flatMap(({ phrases }) => phrases)
  .sort((left, right) => right.length - left.length || left.localeCompare(right))
  .map(escapeRegExp)
  .join("|");

const NUMERIC_THRESHOLD_PATTERN =
  /^-?(?:(?:\d+)(?:\.\d+)?|(?:\d{1,3})(?:,\d{3})+(?:\.\d+)?)$/;
const SENTENCE_PUNCTUATION = /^[,.;?]+$/;
const UNSUPPORTED_NUMERIC_SUFFIXES = new Set([
  "usd",
  "dollar",
  "dollars",
  "percent",
  "percentage",
  "hundred",
  "hundreds",
  "thousand",
  "thousands",
  "million",
  "millions",
  "billion",
  "billions",
  "trillion",
  "trillions",
  "k",
  "m",
  "mm",
  "bn",
  "b",
]);
const UNSUPPORTED_MEASUREMENT_UNITS = new Set([
  "second",
  "seconds",
  "sec",
  "secs",
  "minute",
  "minutes",
  "min",
  "mins",
  "hour",
  "hours",
  "hr",
  "hrs",
  "day",
  "days",
  "week",
  "weeks",
  "month",
  "months",
  "year",
  "years",
  "mile",
  "miles",
  "kilometer",
  "kilometers",
  "km",
  "meter",
  "meters",
  "foot",
  "feet",
  "ft",
  "inch",
  "inches",
  "kilogram",
  "kilograms",
  "kg",
  "gram",
  "grams",
  "g",
  "pound",
  "pounds",
  "lb",
  "lbs",
  "liter",
  "liters",
  "litre",
  "litres",
  "gallon",
  "gallons",
]);
const EXPRESSION_CONTINUATION_PATTERN = /^[+\-*/^%=()]/;

const normalizeThresholdDetectionText = (value: string): string =>
  value.toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim();

const trimSentencePunctuation = (value: string): string => {
  let trimmed = value;
  while (trimmed.length > 0) {
    const last = trimmed[trimmed.length - 1];
    if (!SENTENCE_PUNCTUATION.test(last)) break;
    const candidate = trimmed.slice(0, -1);
    if (NUMERIC_THRESHOLD_PATTERN.test(candidate)) return candidate;
    trimmed = candidate;
  }
  return value;
};

const trimNaturalLanguageValuePunctuation = (value: string): string =>
  value.trim().replace(/[,.?;]+$/g, "").trim();

const parseNumericThreshold = (value: string): BusinessSqlAggregateComparisonValue | null => {
  const token = trimSentencePunctuation(value.trim());
  if (!NUMERIC_THRESHOLD_PATTERN.test(token)) return null;
  const parsed = Number(token.replace(/,/g, ""));
  return Number.isFinite(parsed) ? { kind: "number", value: parsed } : null;
};

const firstWord = (value: string): string =>
  value.match(/^[a-z]+/)?.[0] || "";

const wordMatches = (words: ReadonlySet<string>, value: string): boolean => {
  if (!value) return false;
  return words.has(value) || words.has(singularize(value));
};

const isUnsupportedAggregateThresholdUnit = (value: string): boolean =>
  wordMatches(UNSUPPORTED_MEASUREMENT_UNITS, value);

const hasUnsupportedNumericContinuation = ({
  text,
  numericEndIndex,
  trailingConcept,
}: {
  text: string;
  numericEndIndex: number;
  trailingConcept: string;
}): boolean => {
  const continuation = text.slice(numericEndIndex).trimStart();
  if (EXPRESSION_CONTINUATION_PATTERN.test(continuation)) return true;
  const firstContinuationWord = firstWord(continuation);
  if (isUnsupportedAggregateThresholdUnit(firstContinuationWord)) return true;
  const firstTrailingWord = trailingConcept.split(/\s+/g).find(Boolean) || "";
  return wordMatches(UNSUPPORTED_NUMERIC_SUFFIXES, firstContinuationWord) ||
    wordMatches(UNSUPPORTED_NUMERIC_SUFFIXES, firstTrailingWord);
};

const trimThresholdConcept = (value: string): string => {
  const stopWords = new Set([
    "and",
    "or",
    "by",
    "per",
    "in",
    "for",
    "from",
    "with",
    "where",
    "ordered",
    "sorted",
  ]);
  const words = value
    .replace(/[_-]+/g, " ")
    .split(/\s+/g)
    .map((word) => word.trim())
    .filter(Boolean);
  const stopIndex = words.findIndex((word) => stopWords.has(word));
  const concept = words.slice(0, stopIndex >= 0 ? stopIndex : words.length).join(" ");
  return singularize(concept);
};

export const parseAggregateThresholdNumber = (
  value: string,
): BusinessSqlAggregateComparisonValue | null => parseNumericThreshold(value);

const hasThresholdOperatorPhrase = (prompt: string): boolean =>
  new RegExp(String.raw`\b(?:${THRESHOLD_PHRASE_PATTERN})\b`, "i").test(
    normalizeThresholdDetectionText(prompt),
  );

type RowFilterShell =
  | { status: "none" }
  | { status: "unsupported"; reason: string; baseQuestion?: string; predicate?: string }
  | {
      status: "detected";
      baseQuestion: string;
      predicate: string;
      fieldPhrase: string;
      operator: BusinessSqlFilterOperator;
      valueText: string;
      evidence: string;
    };

type RowFilterOperatorPhrase = {
  operator: BusinessSqlFilterOperator;
  phrase: string;
  nullary?: true;
};

const ROW_FILTER_OPERATOR_PHRASES: readonly RowFilterOperatorPhrase[] = ([
  { operator: "not_equals", phrase: "is not equal to" },
  { operator: "not_equals", phrase: "does not equal" },
  { operator: "greater_than_or_equal", phrase: "no less than" },
  { operator: "less_than_or_equal", phrase: "no more than" },
  { operator: "is_not_null", phrase: "is not null", nullary: true },
  { operator: "greater_than_or_equal", phrase: "at least" },
  { operator: "less_than_or_equal", phrase: "at most" },
  { operator: "greater_than", phrase: "greater than" },
  { operator: "greater_than", phrase: "more than" },
  { operator: "less_than", phrase: "less than" },
  { operator: "less_than", phrase: "fewer than" },
  { operator: "starts_with", phrase: "starts with" },
  { operator: "ends_with", phrase: "ends with" },
  { operator: "equals", phrase: "is equal to" },
  { operator: "equals", phrase: "equals" },
  { operator: "greater_than", phrase: "above" },
  { operator: "less_than", phrase: "below" },
  { operator: "contains", phrase: "contains" },
  { operator: "is_null", phrase: "is null", nullary: true },
] satisfies readonly RowFilterOperatorPhrase[])
  .slice()
  .sort((left, right) => right.phrase.length - left.phrase.length || left.phrase.localeCompare(right.phrase));

const maskQuotedNaturalLanguageStrings = (value: string): string =>
  value.replace(/"[^"\u0000-\u001f\u007f]*"|'[^'\u0000-\u001f\u007f]*'/g, (match) =>
    " ".repeat(match.length),
  );

const standaloneWhereMatches = (value: string): RegExpMatchArray[] =>
  [...value.matchAll(/\bwhere\b/gi)];

const detectRowFilterShell = (prompt: string): RowFilterShell => {
  const whereMatches = standaloneWhereMatches(prompt);
  if (whereMatches.length === 0) return { status: "none" };
  if (whereMatches.length > 1) return { status: "unsupported", reason: "multiple_where_clauses" };
  const whereIndex = whereMatches[0].index || 0;
  const baseQuestion = prompt.slice(0, whereIndex).trim();
  const predicate = prompt.slice(whereIndex + whereMatches[0][0].length).trim();
  if (!baseQuestion || !predicate) {
    return { status: "unsupported", reason: "missing_where_clause_part", baseQuestion, predicate };
  }

  const masked = maskQuotedNaturalLanguageStrings(predicate);
  if (/;|--|\/\*|\*\/|[()]/.test(masked)) {
    return { status: "unsupported", reason: "raw_predicate_text", baseQuestion, predicate };
  }
  if (/\b(?:and|or)\b/i.test(masked)) {
    return { status: "unsupported", reason: "multiple_predicates", baseQuestion, predicate };
  }

  const rawMatches = ROW_FILTER_OPERATOR_PHRASES.flatMap((definition) => {
    const pattern = new RegExp(`\\b${escapeRegExp(definition.phrase)}\\b`, "gi");
    return [...masked.matchAll(pattern)].map((match) => ({
      ...definition,
      index: match.index || 0,
      endIndex: (match.index || 0) + match[0].length,
      text: match[0],
    }));
  }).sort((left, right) => right.text.length - left.text.length || left.index - right.index);
  const occupied: Array<{ start: number; end: number }> = [];
  const matches = rawMatches
    .filter((match) => {
      const overlaps = occupied.some((span) => match.index < span.end && match.endIndex > span.start);
      if (overlaps) return false;
      occupied.push({ start: match.index, end: match.endIndex });
      return true;
    })
    .sort((left, right) => left.index - right.index || right.phrase.length - left.phrase.length);

  if (matches.length === 0) {
    return { status: "unsupported", reason: "missing_operator", baseQuestion, predicate };
  }
  if (matches.length > 1) {
    return { status: "unsupported", reason: "multiple_operator_matches", baseQuestion, predicate };
  }

  const match = matches[0];
  const fieldPhrase = predicate.slice(0, match.index).trim();
  const valueText = predicate.slice(match.index + match.text.length).trim();
  if (!fieldPhrase) {
    return { status: "unsupported", reason: "missing_field", baseQuestion, predicate };
  }
  if (/\b(?:minus|plus|divided\s+by|multiplied\s+by)\b/i.test(fieldPhrase)) {
    return { status: "unsupported", reason: "formula_field_phrase", baseQuestion, predicate };
  }
  if (match.nullary && trimNaturalLanguageValuePunctuation(valueText)) {
    return { status: "unsupported", reason: "unexpected_nullary_value", baseQuestion, predicate };
  }
  if (!match.nullary && !trimNaturalLanguageValuePunctuation(valueText)) {
    return { status: "unsupported", reason: "missing_value", baseQuestion, predicate };
  }

  return {
    status: "detected",
    baseQuestion,
    predicate,
    fieldPhrase,
    operator: match.operator,
    valueText,
    evidence: predicate,
  };
};

const textType = (value: SchemaColumn["inferred_type"] | undefined): boolean =>
  value === "text" || value === "categorical";

const parseNaturalLanguageStringValue = (value: string): BusinessSqlFilterComparisonValue | null => {
  const trimmed = trimNaturalLanguageValuePunctuation(value);
  const doubleQuoted = trimmed.match(/^"([^"\u0000-\u001f\u007f]*)"$/);
  if (doubleQuoted) return { kind: "string", value: doubleQuoted[1] };
  const singleQuoted = trimmed.match(/^'([^'\u0000-\u001f\u007f]*)'$/);
  if (singleQuoted) return { kind: "string", value: singleQuoted[1] };
  if (/^[A-Za-z0-9_-]+$/.test(trimmed)) return { kind: "string", value: trimmed };
  return null;
};

const parseRowFilterComparisonValue = (
  shell: Extract<RowFilterShell, { status: "detected" }>,
  fieldType: SchemaColumn["inferred_type"] | undefined,
): BusinessSqlFilterComparisonValue | undefined | null => {
  if (shell.operator === "is_null" || shell.operator === "is_not_null") return undefined;
  if (
    shell.operator === "greater_than" ||
    shell.operator === "greater_than_or_equal" ||
    shell.operator === "less_than" ||
    shell.operator === "less_than_or_equal"
  ) {
    if (fieldType !== "numeric") return null;
    return parseNumericThreshold(shell.valueText);
  }
  if (shell.operator === "contains" || shell.operator === "starts_with" || shell.operator === "ends_with") {
    return textType(fieldType) ? parseNaturalLanguageStringValue(shell.valueText) : null;
  }
  if (fieldType === "boolean") {
    const value = trimNaturalLanguageValuePunctuation(shell.valueText).toLowerCase();
    if (value === "true") return { kind: "boolean", value: true };
    if (value === "false") return { kind: "boolean", value: false };
    return null;
  }
  if (textType(fieldType)) return parseNaturalLanguageStringValue(shell.valueText);
  if (fieldType === "numeric") return parseNumericThreshold(shell.valueText);
  return null;
};

export const detectAggregateThresholdMatches = (
  prompt: string,
): AggregateThresholdMatch[] => {
  const text = normalizeThresholdDetectionText(prompt);
  const pattern = new RegExp(
    String.raw`\b(${THRESHOLD_PHRASE_PATTERN})\s+${NUMBER_TOKEN}(?:\s+(?!(?:and|or|but)\b)([a-z][a-z\s_]{0,40}))?`,
    "g",
  );
  const matchesByEvidence = new Map<string, AggregateThresholdMatch>();

  for (const match of text.matchAll(pattern)) {
    const phrase = match[1];
    const numericToken = match[2];
    const trailingConcept = trimThresholdConcept(match[3] || "");
    const operator = THRESHOLD_PHRASE_OPERATOR_BY_TEXT.get(phrase);
    const numericStartInMatch = match[0].indexOf(numericToken);
    const numericEndIndex = (match.index || 0) + numericStartInMatch + numericToken.length;
    if (
      hasUnsupportedNumericContinuation({
        text,
        numericEndIndex,
        trailingConcept,
      })
    ) {
      continue;
    }
    const comparisonValue = parseNumericThreshold(numericToken);
    if (!operator || !comparisonValue) continue;
    const evidence = `${phrase} ${trimSentencePunctuation(numericToken)}`;
    matchesByEvidence.set(`${operator}:${evidence}`, {
      operator,
      comparisonValue,
      evidence,
      trailingConcept: trailingConcept || null,
    });
  }

  return Array.from(matchesByEvidence.values());
};

const directionWords = (value: string): string[] =>
  Array.from(value.matchAll(/\b(?:ascending|descending)\b/g)).map((match) => match[0]);

const directionFromWord = (value: string): ProposedSort["direction"] =>
  value === "ascending" ? "asc" : "desc";

export const detectDerivedRankingShell = (prompt: string): DerivedRankingShell => {
  const text = normalize(prompt);
  const rankPrefix = text.match(/^rank\s+(.+?)\s+by\s+(.+)$/);
  const showRanked = text.match(/^show\s+(.+?)\s+ranked\s+by\s+(.+)$/);
  const match = rankPrefix || showRanked;
  if (!match) return { status: "none" };

  const groupingPhrase = trimFormulaOperand(match[1]);
  const rankedBody = match[2].trim();
  const directions = directionWords(rankedBody);
  if (directions.length === 0) return { status: "unsupported", reason: "missing_direction", groupingPhrase };
  if (directions.length > 1) return { status: "unsupported", reason: "ambiguous_direction", groupingPhrase };

  const directionMatch = rankedBody.match(/\b(ascending|descending)\b\s*$/);
  if (!directionMatch) return { status: "unsupported", reason: "ambiguous_direction", groupingPhrase };

  const formulaText = rankedBody.slice(0, directionMatch.index).trim();
  const formula = detectSelectedExplicitDerivedFormula(formulaText);
  if (formula.status === "none") return { status: "unsupported", reason: "formula_not_detected", groupingPhrase };
  if (formula.status === "unsupported") return { status: "unsupported", reason: "formula_unsupported", groupingPhrase };

  return {
    status: "detected",
    groupingPhrase,
    direction: directionFromWord(directionMatch[1]),
    formula: {
      ...formula,
      groupingPhrase,
    },
  };
};

const thresholdEvidenceIndex = (
  text: string,
  threshold: AggregateThresholdMatch,
): number => {
  const evidence = threshold.evidence.toLowerCase();
  const isEvidence = text.indexOf(evidence);
  if (isEvidence >= 0) return isEvidence;
  return -1;
};

const formulaTextBeforeThreshold = (
  body: string,
  threshold: AggregateThresholdMatch,
): string | null => {
  const index = thresholdEvidenceIndex(body, threshold);
  if (index < 0) return null;
  return body
    .slice(0, index)
    .replace(/\b(?:is|are)\s*$/g, "")
    .trim();
};

export const detectDerivedThresholdShell = (prompt: string): DerivedThresholdShell => {
  const text = normalizeThresholdDetectionText(prompt);
  if (/\bwhere\b.+\brank(?:ed)?\s+by\b|\brank(?:ed)?\s+by\b.+\bwhere\b/.test(text)) {
    return { status: "unsupported", reason: "multiple_thresholds" };
  }
  const match = text.match(/^show\s+(.+?)\s+where\s+(.+)$/);
  if (!match) return { status: "none" };

  const groupingPhrase = trimFormulaOperand(match[1]);
  const body = match[2].trim();
  const thresholds = detectAggregateThresholdMatches(body);
  if (thresholds.length === 0) return { status: "unsupported", reason: "missing_threshold", groupingPhrase };
  if (thresholds.length > 1) return { status: "unsupported", reason: "multiple_thresholds", groupingPhrase };

  const formulaText = formulaTextBeforeThreshold(body, thresholds[0]);
  if (!formulaText) return { status: "unsupported", reason: "formula_not_detected", groupingPhrase };
  const formula = detectSelectedExplicitDerivedFormula(formulaText);
  if (formula.status === "none") return { status: "unsupported", reason: "formula_not_detected", groupingPhrase };
  if (formula.status === "unsupported") return { status: "unsupported", reason: "formula_unsupported", groupingPhrase };

  return {
    status: "detected",
    groupingPhrase,
    threshold: thresholds[0],
    formula: {
      ...formula,
      groupingPhrase,
    },
  };
};

const selectedExplicitDerivedFormulaForProposal = (prompt: string): ExplicitDerivedFormula => {
  const ranking = detectDerivedRankingShell(prompt);
  if (ranking.status === "detected") return ranking.formula;
  if (ranking.status === "unsupported") {
    return { status: "unsupported", operator: "mixed", reason: "mixed_formulas" };
  }
  const threshold = detectDerivedThresholdShell(prompt);
  if (threshold.status === "detected") return threshold.formula;
  if (
    threshold.status === "unsupported" &&
    (threshold.reason === "multiple_thresholds" ||
      threshold.reason === "formula_unsupported" ||
      explicitFormulaMatches(normalize(prompt)).length > 0)
  ) {
    return { status: "unsupported", operator: "mixed", reason: "mixed_formulas" };
  }
  return detectSelectedExplicitDerivedFormula(prompt);
};

const thresholdCountMetricName = (
  matches: readonly AggregateThresholdMatch[],
  entities: readonly string[],
): string | null => {
  if (matches.length !== 1) return null;
  const concept = matches[0].trailingConcept;
  if (!concept) return null;
  const normalizedConcept = normalize(concept);
  const entityMatch =
    entities.find((entity) => normalize(entity) === normalizedConcept) ||
    entities.find((entity) => singularize(entity) === singularize(normalizedConcept));
  return entityMatch ? `count_${entityMatch.replace(/\s+/g, "_")}` : null;
};

const proposedMetricFromPhrase = (
  phrase: string,
  worksheets: readonly WorksheetInput[],
  semanticColumns: readonly SemanticColumnHint[],
  strictNameMatch = false,
  requireGroundedCount = false,
): ProposedMetric => {
  const normalizedPhrase = normalize(phrase);
  const suffixCountMatch = normalizedPhrase.match(/^(.+?)\s+count$/);
  const metricName = suffixCountMatch
    ? suffixCountMatch[1]
    : phrase.replace(/^(count|sum|total|avg|average|minimum|min|maximum|max)_?/, "");
  const kind = inferMetricKind(phrase);
  const column = strictNameMatch
    ? findColumnByName(metricName, worksheets)
    : findColumn(metricName, worksheets, semanticColumns, [
        "metric_candidate",
        "amount",
        "quantity",
        "countable_entity",
        "identifier",
      ]);
  const countIdentifierConfidence =
    suffixCountMatch &&
    column &&
    normalize(column.column.name) === `${singularize(metricName)} id`
      ? "high"
      : column?.confidence;
  const isSupportedExplicitMeasure =
    kind !== "metric_column" &&
    (kind === "count_entities" ? !requireGroundedCount || Boolean(column) : Boolean(column));

  return {
    id: `metric:${compactId(phrase)}`,
    label: phrase,
    kind,
    tableName: isSupportedExplicitMeasure
      ? column?.worksheet.tableName || worksheets[0]?.tableName || null
      : column?.worksheet.tableName || null,
    columnName: column?.column.name || null,
    inferredType: column?.column.inferred_type,
    synthesized: kind === "count_entities" && !column,
    confidence: isSupportedExplicitMeasure
      ? countIdentifierConfidence || (kind === "count_entities" ? "medium" : "low")
      : "low",
  };
};

const proposeMetrics = (
  intent: BusinessIntent,
  prompt: string,
  worksheets: readonly WorksheetInput[],
  semanticColumns: readonly SemanticColumnHint[],
  rowFilterShell: RowFilterShell = { status: "none" },
): ProposedMetric[] => {
  const explicitFormula = selectedExplicitDerivedFormulaForProposal(prompt);
  if (explicitFormula.status === "detected") {
    const requireGroundedCount = explicitFormula.operator !== "subtract";
    return [
      proposedMetricFromPhrase(
        explicitFormula.leftPhrase,
        worksheets,
        semanticColumns,
        true,
        requireGroundedCount,
      ),
      proposedMetricFromPhrase(
        explicitFormula.rightPhrase,
        worksheets,
        semanticColumns,
        true,
        requireGroundedCount,
      ),
    ];
  }
  if (explicitFormula.status === "unsupported") return [];

  if (intent.metrics.length === 0) {
    if (simpleProjectionFieldPhrase(rowFilterShell)) return [];
    const thresholdMetric = thresholdCountMetricName(
      detectAggregateThresholdMatches(prompt),
      intent.entities,
    );
    if (thresholdMetric) {
      return proposeMetrics(
        { ...intent, metrics: [thresholdMetric] },
        prompt,
        worksheets,
        semanticColumns,
      );
    }
    if (detectAggregateThresholdMatches(prompt).length > 0) return [];
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

  return intent.metrics.map((metric) =>
    proposedMetricFromPhrase(metric.replace(/_/g, " "), worksheets, semanticColumns),
  );
};

const proposeSorts = (
  intent: BusinessIntent,
  prompt: string,
  metrics: readonly ProposedMetric[],
): ProposedSort[] => {
  if (!intent.analysisPath) return [];
  const text = normalize(prompt);
  const hasExplicitSortLanguage =
    /\b(?:top|bottom|highest|lowest|ascending|descending|rank(?:ed)?|sort(?:ed)?|order(?:ed)?)\b/.test(text);
  if (!hasExplicitSortLanguage) return [];
  const targetMetric = metrics.find((metric) =>
    sameName(metric.columnName, intent.analysisPath?.measureField),
  ) || metrics[0];
  if (!targetMetric) return [];

  return [
    {
      id: `sort:${compactId(targetMetric.id)}:${intent.analysisPath.orderDirection}`,
      label: `Sort by ${targetMetric.label}`,
      target: "metric",
      targetId: targetMetric.id,
      direction: intent.analysisPath.orderDirection === "ascending" ? "asc" : "desc",
      confidence: targetMetric.confidence,
    },
  ];
};

const DEFAULT_AGGREGATE_SORT_ASSUMPTION =
  "Results are ordered by the primary measure in descending order by default.";

const defaultAggregateSortFor = ({
  metrics,
  groupings,
  derivedMeasures,
  sorts,
  prompt,
  aggregateResultConditions,
}: {
  metrics: readonly ProposedMetric[];
  groupings: readonly ProposedGrouping[];
  derivedMeasures: readonly ProposedDerivedMeasure[];
  sorts: readonly ProposedSort[];
  prompt: string;
  aggregateResultConditions: readonly ProposedAggregateResultCondition[];
}): ProposedSort[] => {
  if (sorts.length > 0) return [...sorts];
  if (aggregateResultConditions.length === 0 && hasThresholdOperatorPhrase(prompt)) return [...sorts];
  if (metrics.length !== 1) return [...sorts];
  if (groupings.length === 0) return [...sorts];
  if (derivedMeasures.length > 0) return [...sorts];
  const metric = metrics[0];
  if (
    metric.kind === "metric_column" ||
    !metric.tableName ||
    metric.confidence === "low"
  ) {
    return [...sorts];
  }
  return [
    {
      id: `sort:${compactId(metric.id)}:desc`,
      label: `Sort by ${metric.label}`,
      target: "metric",
      targetId: metric.id,
      direction: "desc",
      confidence: "low",
    },
  ];
};

const proposeDerivedSorts = (
  prompt: string,
  derivedMeasures: readonly ProposedDerivedMeasure[],
  groupings: readonly ProposedGrouping[],
): ProposedSort[] => {
  const ranking = detectDerivedRankingShell(prompt);
  if (ranking.status !== "detected") return [];
  if (derivedMeasures.length !== 1 || groupings.length !== 1) return [];
  const derivedMeasure = derivedMeasures[0];
  const grouping = groupings[0];
  if (!grouping.tableName || !grouping.columnName) return [];
  return [
    {
      id: `sort:derived-measure:${compactId(derivedMeasure.id)}:${ranking.direction}`,
      label: `Sort by ${derivedMeasure.label || derivedMeasure.sqlAlias}`,
      target: "derived_measure",
      targetId: derivedMeasure.id,
      direction: ranking.direction,
      confidence: derivedMeasure.confidence,
    },
  ];
};

const proposeRowLimit = (intent: BusinessIntent): ProposedRowLimit | null => {
  const value = intent.analysisPath?.rowLimit;
  if (!value) return null;
  return {
    id: `row-limit:${value}`,
    value,
    confidence: "high",
  };
};

const groupingConceptsFromPromptSubject = (prompt: string): string[] => {
  const text = normalize(prompt);
  const subjectMatch = text.match(
    /\b(?:show|list|find|identify)\s+(?:the\s+)?([a-z][a-z\s_]{0,60}?)\s+(?:whose|with|where|that)\b/,
  );
  if (!subjectMatch) return [];
  const subject = subjectMatch[1]
    .replace(/\b(rows?|records?)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return subject ? [singularize(subject)] : [];
};

const proposeGroupings = (
  intent: BusinessIntent,
  prompt: string,
  worksheets: readonly WorksheetInput[],
  semanticColumns: readonly SemanticColumnHint[],
  rowFilterShell: RowFilterShell = { status: "none" },
): ProposedGrouping[] => {
  const explicitFormula = selectedExplicitDerivedFormulaForProposal(prompt);
  const simpleProjection = simpleProjectionFieldPhrase(rowFilterShell);
  const groupingConcepts =
    explicitFormula.status === "detected" && explicitFormula.groupingPhrase
      ? [explicitFormula.groupingPhrase]
      : intent.grouping.length > 0
      ? intent.grouping
      : simpleProjection
      ? [simpleProjection]
      : groupingConceptsFromPromptSubject(prompt);
  const strictFormulaGrouping = explicitFormula.status === "detected";

  return Array.from(new Set(groupingConcepts)).map((grouping) => {
    const column = strictFormulaGrouping
      ? findColumnByName(grouping, worksheets)
      : findColumn(grouping, worksheets, semanticColumns, [
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
};

const proposeDerivedMeasures = (
  prompt: string,
  metrics: readonly ProposedMetric[],
): ProposedDerivedMeasure[] => {
  const explicitFormula = selectedExplicitDerivedFormulaForProposal(prompt);
  if (explicitFormula.status !== "detected") return [];
  if (metrics.length !== 2) return [];

  const [leftMetric, rightMetric] = metrics;
  const operandsAreGrounded = [leftMetric, rightMetric].every(
    (metric) =>
      metric.kind !== "metric_column" &&
      metric.confidence !== "low" &&
      metric.tableName &&
      (metric.kind === "count_entities" || metric.columnName),
  );
  if (!operandsAreGrounded) return [];

  const seed = {
    operator: explicitFormula.operator,
    leftMetricId: leftMetric.id,
    rightMetricId: rightMetric.id,
    ...(explicitFormula.operator === "divide"
      ? { divisionPolicy: { zeroDenominator: "null" as const } }
      : {}),
  };
  const label = `${leftMetric.label} ${explicitFormula.phrase} ${rightMetric.label}`;
  return [
    {
      ...seed,
      id: createProposedDerivedMeasureId(seed),
      sqlAlias: createBusinessSqlMeasureAlias(label),
      label,
      evidence: explicitFormula.evidence,
      confidence:
        leftMetric.confidence === "high" && rightMetric.confidence === "high"
          ? "high"
          : "medium",
    },
  ];
};

const proposeAggregateResultConditions = ({
  prompt,
  metrics,
  groupings,
  derivedMeasures,
}: {
  prompt: string;
  metrics: readonly ProposedMetric[];
  groupings: readonly ProposedGrouping[];
  derivedMeasures: readonly ProposedDerivedMeasure[];
}): ProposedAggregateResultCondition[] => {
  const derivedThreshold = detectDerivedThresholdShell(prompt);
  if (derivedThreshold.status === "detected") {
    if (derivedMeasures.length !== 1 || groupings.length !== 1) return [];
    const derivedMeasure = derivedMeasures[0];
    const grouping = groupings[0];
    if (!grouping.tableName || !grouping.columnName) return [];
    const threshold = derivedThreshold.threshold;
    return [
      {
        id: `aggregate-condition:derived-measure:${compactId(derivedMeasure.id)}:${threshold.operator}:${threshold.comparisonValue.value}`,
        target: {
          kind: "derived_measure",
          derivedMeasureId: derivedMeasure.id,
        },
        operator: threshold.operator,
        comparisonValue: threshold.comparisonValue,
        label: `${derivedMeasure.label || derivedMeasure.sqlAlias} ${threshold.evidence}`,
        evidence: threshold.evidence,
        confidence: "high",
      },
    ];
  }
  if (derivedMeasures.length > 0) return [];

  const thresholdMatches = detectAggregateThresholdMatches(prompt);
  if (thresholdMatches.length !== 1) return [];
  if (metrics.length !== 1 || groupings.length !== 1) return [];

  const metric = metrics[0];
  const grouping = groupings[0];
  if (
    !metric.tableName ||
    metric.confidence === "low" ||
    metric.kind === "metric_column" ||
    !grouping.tableName ||
    !grouping.columnName
  ) {
    return [];
  }

  const threshold = thresholdMatches[0];
  return [
    {
      id: `aggregate-condition:${compactId(metric.id)}:${threshold.operator}:${threshold.comparisonValue.value}`,
      metricId: metric.id,
      target: { kind: "metric", metricId: metric.id },
      operator: threshold.operator,
      comparisonValue: threshold.comparisonValue,
      label: `${metric.label} ${threshold.evidence}`,
      evidence: threshold.evidence,
      confidence: "high",
    },
  ];
};

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

const matchingRowFilterFields = (
  fieldPhrase: string,
  worksheets: readonly WorksheetInput[],
): BoundColumn[] => {
  const normalizedFieldPhrase = normalize(fieldPhrase).replace(/\b(?:is|are)\s*$/g, "").trim();
  return allColumns(worksheets)
  .map((item) => ({ item, confidence: nameScore(normalizedFieldPhrase, item.column.name) }))
  .filter((candidate): candidate is { item: { worksheet: WorksheetInput; column: SchemaColumn }; confidence: "high" | "medium" } =>
    Boolean(candidate.confidence),
  )
  .filter((candidate) => candidate.confidence === "high")
  .map((candidate) => ({ ...candidate.item, confidence: candidate.confidence }));
};

const valueIdentity = (value: BusinessSqlFilterComparisonValue | undefined): string =>
  value ? `${value.kind}:${String(value.value)}` : "nullary";

export const createProposedRowFilterId = ({
  target,
  operator,
  comparisonValue,
}: Pick<ProposedFilter, "target" | "operator" | "comparisonValue">): string =>
  [
    "filter",
    "canonical",
    compactId(target?.entity || ""),
    compactId(target?.table || ""),
    compactId(target?.field || ""),
    operator || "missing-operator",
    compactId(valueIdentity(comparisonValue)),
  ].join(":");

const unsupportedRowFilter = (
  shell: Extract<RowFilterShell, { status: "unsupported" }>,
): ProposedFilter => ({
  id: `filter:row-filter:${compactId(shell.reason)}`,
  label: "Row-filter semantics",
  tableName: null,
  columnName: null,
  semantics: "needs_review",
  reason: `Explicit row-filter clause is unsupported: ${shell.reason}.`,
  evidence: shell.predicate,
});

const proposedCanonicalRowFilter = (
  shell: Extract<RowFilterShell, { status: "detected" }>,
  worksheets: readonly WorksheetInput[],
): ProposedFilter => {
  const matches = matchingRowFilterFields(shell.fieldPhrase, worksheets);
  if (matches.length !== 1) {
    return {
      id: `filter:row-filter:${matches.length === 0 ? "missing-field" : "ambiguous-field"}`,
      label: "Row-filter semantics",
      tableName: null,
      columnName: null,
      semantics: "needs_review",
      reason: matches.length === 0
        ? "Could not bind the row-filter field to exactly one applied-scope column."
        : "The row-filter field matches more than one applied-scope column.",
      evidence: shell.evidence,
    };
  }
  const bound = matches[0];
  const comparisonValue = parseRowFilterComparisonValue(shell, bound.column.inferred_type);
  if (comparisonValue === null) {
    return {
      id: "filter:row-filter:incompatible-value",
      label: "Row-filter semantics",
      tableName: bound.worksheet.tableName,
      columnName: bound.column.name,
      semantics: "needs_review",
      reason: "Row-filter operator, value, and field type are not compatible.",
      evidence: shell.evidence,
    };
  }
  const target = {
    kind: "field" as const,
    entity: bound.worksheet.tableName,
    table: bound.worksheet.tableName,
    field: bound.column.name,
    fieldInferredType: bound.column.inferred_type,
    resolved: true,
  };
  const seed = {
    target,
    operator: shell.operator,
    comparisonValue,
  };
  return {
    id: createProposedRowFilterId(seed),
    label: `${bound.column.name} ${shell.evidence}`,
    tableName: bound.worksheet.tableName,
    columnName: bound.column.name,
    semantics: "canonical",
    executable: true,
    reason: "Explicit row-level predicate grounded to one applied-scope field.",
    target,
    operator: shell.operator,
    comparisonValue,
    evidence: shell.evidence,
  };
};

const simpleProjectionFieldPhrase = (rowFilterShell: RowFilterShell): string | null => {
  if (rowFilterShell.status !== "detected") return null;
  const text = normalize(rowFilterShell.baseQuestion);
  const match = text.match(/^(?:show|list|find|identify)\s+(.+)$/);
  if (!match) return null;
  const phrase = match[1].trim();
  if (
    !phrase ||
    /\b(?:by|per|total|sum|average|avg|minimum|min|maximum|max|count|highest|lowest|top|bottom)\b/.test(phrase)
  ) {
    return null;
  }
  return phrase;
};

const proposeFilters = (
  prompt: string,
  intent: BusinessIntent,
  worksheets: readonly WorksheetInput[],
  semanticColumns: readonly SemanticColumnHint[],
  aggregateResultConditions: readonly ProposedAggregateResultCondition[] = [],
): ProposedFilter[] => {
  const filters: ProposedFilter[] = [];
  const rowFilterShell = detectRowFilterShell(prompt);
  const hasDerivedThresholdShell = detectDerivedThresholdShell(prompt).status === "detected";
  const hasAggregateThresholdShell =
    aggregateResultConditions.length > 0 ||
    /\bwhere\b\s+(?:total|sum|average|avg|minimum|min|maximum|max|count)\b/i.test(prompt);
  const legacyPrompt = rowFilterShell.status === "detected" ? rowFilterShell.baseQuestion : prompt;
  if (rowFilterShell.status === "unsupported" && !hasDerivedThresholdShell && !hasAggregateThresholdShell) {
    filters.push(unsupportedRowFilter(rowFilterShell));
  } else if (rowFilterShell.status === "detected") {
    if (!hasDerivedThresholdShell && aggregateResultConditions.length === 0 && !hasAggregateThresholdShell) {
      filters.push(proposedCanonicalRowFilter(rowFilterShell, worksheets));
    }
  }
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

  if (promptHasAny(legacyPrompt, ["status", "active", "inactive", "open", "closed", "current"])) {
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
    promptHasAny(legacyPrompt, [
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

  if (promptHasAny(legacyPrompt, ["unresolved", "low stock", "selling fast", "fast selling", "high turnover"])) {
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
  const byTable = new Map<string, ProposedEntity>();
  for (const entity of entities.filter((candidate) => candidate.tableName)) {
    const key = normalize(entity.tableName || "");
    const existing = byTable.get(key);
    if (!existing || existing.confidence !== "high") {
      byTable.set(key, entity);
    }
  }
  const boundEntities = Array.from(byTable.values());
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
  derivedMeasures,
  aggregateResultConditions,
  thresholdMatchCount,
  filters,
  joinNeeds,
}: {
  prompt: string;
  intent: BusinessIntent;
  scope: readonly AnalysisScopeSelection[];
  entities: readonly ProposedEntity[];
  groupings: readonly ProposedGrouping[];
  metrics: readonly ProposedMetric[];
  derivedMeasures: readonly ProposedDerivedMeasure[];
  aggregateResultConditions: readonly ProposedAggregateResultCondition[];
  thresholdMatchCount: number;
  filters: readonly ProposedFilter[];
  joinNeeds: readonly ProposedJoinNeed[];
}): MissingRequirement[] => {
  const missing: MissingRequirement[] = [];
  const hasGroundedAggregateThreshold = aggregateResultConditions.length === 1;
  const hasCanonicalRowFilter = filters.some((filter) => filter.semantics === "canonical");
  const explicitFormula = selectedExplicitDerivedFormulaForProposal(prompt);
  const rankingShell = detectDerivedRankingShell(prompt);
  const thresholdShell = detectDerivedThresholdShell(prompt);
  const hasGroundedDerivedFormula = derivedMeasures.length === 1;
  if (!prompt.trim()) {
    missing.push({
      id: "missing-prompt",
      kind: "intent",
      message: "Describe the business question before proposing a report.",
    });
  }
  if (
    intent.primaryIntent === "unknown" &&
    intent.alternates.length === 0 &&
    !hasGroundedAggregateThreshold &&
    !hasGroundedDerivedFormula &&
    !(hasCanonicalRowFilter && groupings.length > 0)
  ) {
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
  for (const entity of entities.filter(
    (entity) => !entity.tableName && !hasGroundedAggregateThreshold && !hasGroundedDerivedFormula,
  )) {
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
  if (explicitFormula.status === "unsupported") {
    const operatorName =
      explicitFormula.operator === "subtract"
        ? "subtraction"
        : explicitFormula.operator === "divide"
        ? "division"
        : explicitFormula.operator === "add"
        ? "addition"
        : explicitFormula.operator === "multiply"
        ? "multiplication"
        : "mixed";
    const multipleMessage =
      explicitFormula.reason === "multiple_subtractions"
        ? "Only one explicit X minus Y formula is supported in this slice."
        : explicitFormula.reason === "multiple_divisions"
        ? "Only one explicit X divided by Y formula is supported in this slice."
        : explicitFormula.reason === "multiple_additions"
        ? "Only one explicit X plus Y formula is supported in this slice."
        : explicitFormula.reason === "multiple_multiplications"
        ? "Only one explicit X multiplied by Y formula is supported in this slice."
        : null;
    missing.push({
      id:
        explicitFormula.reason === "multiple_subtractions"
          ? "unsupported-multiple-derived-subtractions"
          : explicitFormula.reason === "multiple_divisions"
          ? "unsupported-multiple-derived-divisions"
          : explicitFormula.reason === "multiple_additions"
          ? "unsupported-multiple-derived-additions"
          : explicitFormula.reason === "multiple_multiplications"
          ? "unsupported-multiple-derived-multiplications"
          : explicitFormula.reason === "mixed_formulas"
          ? "unsupported-mixed-derived-formulas"
          : `missing-derived-${operatorName}-${explicitFormula.reason.replace(/_/g, "-")}`,
      kind: "intent",
      message:
        multipleMessage ||
        (explicitFormula.reason === "mixed_formulas"
          ? "Mixed derived-measure formulas are not supported in this slice."
          : `Could not safely identify both operands for the explicit ${operatorName} formula.`),
    });
  } else if (explicitFormula.status === "detected" && !hasGroundedDerivedFormula) {
    const operatorName =
      explicitFormula.operator === "subtract"
        ? "subtraction"
        : explicitFormula.operator === "divide"
        ? "division"
        : explicitFormula.operator === "add"
        ? "addition"
        : "multiplication";
    missing.push({
      id: `missing-derived-${operatorName}-grounding`,
      kind: "column",
      message:
        `Could not safely bind the explicit ${operatorName} formula to two grounded compatible base measures.`,
    });
  }
  if (rankingShell.status === "unsupported") {
    missing.push({
      id:
        rankingShell.reason === "missing_direction"
          ? "missing-derived-ranking-direction"
          : rankingShell.reason === "ambiguous_direction"
          ? "ambiguous-derived-ranking-direction"
          : "missing-derived-ranking-grounding",
      kind: "intent",
      message:
        rankingShell.reason === "missing_direction"
          ? "Derived-measure ranking requires an explicit ascending or descending direction."
          : rankingShell.reason === "ambiguous_direction"
          ? "Derived-measure ranking direction is ambiguous."
          : "Could not safely ground the explicit derived-measure ranking target.",
    });
  }
  if (
    thresholdShell.status === "unsupported" &&
    !hasCanonicalRowFilter &&
    !hasGroundedAggregateThreshold
  ) {
    missing.push({
      id:
        thresholdShell.reason === "missing_threshold"
          ? "missing-derived-aggregate-threshold"
          : thresholdShell.reason === "multiple_thresholds"
          ? "unsupported-derived-ranking-threshold-composition"
          : "missing-derived-aggregate-threshold-grounding",
      kind: "intent",
      message:
        thresholdShell.reason === "missing_threshold"
          ? "Derived aggregate-result conditions require one explicit numeric threshold."
          : thresholdShell.reason === "multiple_thresholds"
          ? "Combined or multiple derived ranking and threshold requests are not supported in this slice."
          : "Could not safely ground the explicit derived aggregate-result condition target.",
    });
  }
  if (
    explicitFormula.status === "detected" &&
    explicitFormula.groupingPhrase &&
    groupings.length === 0
  ) {
    const operatorName =
      explicitFormula.operator === "subtract"
        ? "subtraction"
        : explicitFormula.operator === "divide"
        ? "division"
        : explicitFormula.operator === "add"
        ? "addition"
        : "multiplication";
    missing.push({
      id: `missing-derived-${operatorName}-grouping`,
      kind: "column",
      message: `Could not safely bind the grouping for the explicit ${operatorName} formula.`,
    });
  }
  if (thresholdMatchCount > 1) {
    missing.push({
      id: "unsupported-multiple-aggregate-thresholds",
      kind: "intent",
      message: "Only one aggregate-result threshold condition is supported in this slice.",
    });
  } else if (thresholdMatchCount === 1 && aggregateResultConditions.length === 0) {
    missing.push({
      id: "missing-aggregate-threshold-grounding",
      kind: "column",
      message:
        "Could not safely bind the aggregate-result threshold to one grounded measure and one grounded grouping.",
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
  sorts: readonly ProposedSort[] = [],
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
  if (sorts.some((sort) => sort.confidence === "low" && sort.target === "metric")) {
    assumptions.push({
      id: "assumption:default-aggregate-ordering",
      label: "Default aggregate ordering",
      detail: DEFAULT_AGGREGATE_SORT_ASSUMPTION,
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
  derivedMeasures: readonly ProposedDerivedMeasure[] = [],
): AdaptiveReportProposal["confidence"] => {
  const values = [
    ...entities.map((entity) => entity.confidence),
    ...metrics.map((metric) => metric.confidence),
    ...groupings.map((grouping) => grouping.confidence),
    ...derivedMeasures.map((derivedMeasure) => derivedMeasure.confidence),
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
  metrics,
  derivedMeasures,
  groupings,
  aggregateResultConditions,
  sorts,
  rowLimit,
  filters,
}: {
  intent: BusinessIntent;
  scope: readonly AnalysisScopeSelection[];
  entities: readonly ProposedEntity[];
  joinNeeds: readonly ProposedJoinNeed[];
  metrics: readonly ProposedMetric[];
  derivedMeasures: readonly ProposedDerivedMeasure[];
  groupings: readonly ProposedGrouping[];
  aggregateResultConditions: readonly ProposedAggregateResultCondition[];
  sorts: readonly ProposedSort[];
  rowLimit: ProposedRowLimit | null;
  filters: readonly ProposedFilter[];
}): string =>
  JSON.stringify({
    version: "adaptive-report-proposal:v1",
    intent: {
      primaryIntent: intent.primaryIntent,
      alternates: stableStrings(intent.alternates),
      entities: stableStrings(intent.entities),
      metrics: stableStrings(intent.metrics),
      grouping: stableStrings(intent.grouping),
      analysisPath: intent.analysisPath,
      relationshipPredicate: intent.relationshipPredicate,
      explicitlyTemporal: intent.explicitlyTemporal,
      detectorVersion: intent.detectorVersion,
    },
    scopeTables: stableStrings(scopeTableNames(scope)),
    entityNames: stableStrings(entities.map((entity) => entity.label)),
    metricIds: stableStrings(metrics.map((metric) => metric.id)),
    derivedMeasureIds: stableStrings(derivedMeasures.map((derivedMeasure) => derivedMeasure.id)),
    groupingIds: stableStrings(groupings.map((grouping) => grouping.id)),
    aggregateResultConditionIds: stableStrings(
      aggregateResultConditions.map((condition) => condition.id),
    ),
    filterIds: stableStrings(filters.map((filter) => filter.id)),
    sortIds: stableStrings(sorts.map((sort) => `${sort.target}:${sort.targetId}:${sort.direction}`)),
    rowLimit: rowLimit?.value || null,
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
  const rowFilterShell = detectRowFilterShell(prompt);
  const requestedEntities = detectedIntent.entities.length > 0 ? detectedIntent.entities : [];
  const entities =
    requestedEntities.length > 0
      ? requestedEntities.map((entity) => findWorksheetForEntity(entity, worksheets))
      : fallbackEntitiesFromScope(worksheets);
  const fullPromptMetrics = proposeMetrics(detectedIntent, prompt, worksheets, semanticColumns);
  const fullPromptDerivedMeasures = proposeDerivedMeasures(prompt, fullPromptMetrics);
  const fullPromptGroupings = proposeGroupings(detectedIntent, prompt, worksheets, semanticColumns);
  const fullPromptAggregateResultConditions = proposeAggregateResultConditions({
    prompt,
    metrics: fullPromptMetrics,
    groupings: fullPromptGroupings,
    derivedMeasures: fullPromptDerivedMeasures,
  });
  const useRowFilterBasePrompt =
    rowFilterShell.status === "detected" &&
    fullPromptAggregateResultConditions.length === 0 &&
    detectDerivedThresholdShell(prompt).status !== "detected";
  const planningPrompt = useRowFilterBasePrompt ? rowFilterShell.baseQuestion : prompt;
  const metrics = proposeMetrics(detectedIntent, planningPrompt, worksheets, semanticColumns, rowFilterShell);
  const derivedMeasures = proposeDerivedMeasures(planningPrompt, metrics);
  const groupings = proposeGroupings(detectedIntent, planningPrompt, worksheets, semanticColumns, rowFilterShell);
  const aggregateResultConditions = proposeAggregateResultConditions({
    prompt: planningPrompt,
    metrics,
    groupings,
    derivedMeasures,
  });
  const derivedSorts = proposeDerivedSorts(planningPrompt, derivedMeasures, groupings);
  const explicitSorts = derivedMeasures.length > 0
    ? derivedSorts
    : proposeSorts(detectedIntent, planningPrompt, metrics);
  const sorts = derivedMeasures.length > 0
    ? explicitSorts
    : defaultAggregateSortFor({
        metrics,
        groupings,
        derivedMeasures,
        sorts: explicitSorts,
        prompt: planningPrompt,
        aggregateResultConditions,
      });
  const rowLimit = proposeRowLimit(detectedIntent);
  const filters = proposeFilters(prompt, detectedIntent, worksheets, semanticColumns, aggregateResultConditions);
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
    derivedMeasures,
    aggregateResultConditions,
    thresholdMatchCount: filters.some((filter) => filter.semantics === "canonical")
      ? 0
      : detectAggregateThresholdMatches(planningPrompt).length,
    filters,
    joinNeeds,
  });
  const assumptions = createAssumptions(entities, metrics, groupings, sorts);
  const warnings = createWarnings(filters, joinNeeds, request.selectedGuidanceDialect);
  const support = computeSupport({ missingRequirements, filters, joinNeeds });
  const confidence = computeConfidence(entities, metrics, groupings, derivedMeasures);
  const payloadFingerprint = createFingerprint({
    intent: detectedIntent,
    scope: appliedScopeSelections,
    entities,
    joinNeeds,
    metrics,
    derivedMeasures,
    groupings,
    aggregateResultConditions,
    sorts,
    rowLimit,
    filters,
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
    derivedMeasures,
    groupings,
    aggregateResultConditions,
    sorts,
    rowLimit,
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
