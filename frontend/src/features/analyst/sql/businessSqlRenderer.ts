import {
  evaluateBusinessSqlRenderability,
  type BusinessSqlRenderabilityGate,
} from "./businessSqlRenderabilityGate";
import type {
  BusinessSqlAggregateComparisonOperator,
  BusinessSqlDerivedMeasure,
  BusinessSqlFilter,
  BusinessSqlFilterComparisonValue,
  BusinessSqlFilterOperator,
  BusinessSqlJoinEdge,
  BusinessSqlMeasure,
  BusinessSqlQueryPlan,
} from "./businessSqlQueryPlan";
import {
  getBusinessSqlAggregateResultConditionTarget,
  isCanonicalBusinessSqlDateRangeValue,
  isCanonicalBusinessSqlDateValue,
  normalizeMetricAndMeasures,
  resolveBusinessSqlFilterCombinator,
} from "./businessSqlQueryPlan";
import { evaluateBusinessSqlRendererCapability } from "./businessSqlRendererCapability";
import { evaluateBusinessSqlFilterCompatibility } from "./businessSqlFilterCompatibility";
import type {
  BusinessSqlJoinPathResolution,
  BusinessSqlJoinRequirementResolution,
} from "./businessSqlJoinPathResolver";
import type {
  BusinessSqlIntegratedReadiness,
  BusinessSqlQueryPlanJoinResolution,
} from "./businessSqlQueryPlanJoinResolution";
import {
  createBusinessSqlPreviewRenderRequest,
  type BusinessSqlRenderRequest,
} from "./businessSqlRenderRequest";
import {
  renderResultFromSqlArtifact,
  sqlArtifactFromRenderResult,
  type BusinessSqlDialectRenderer,
  type BusinessSqlRenderResult,
  type BusinessSqlRendererDialectId,
  type BusinessSqlRendererReasonCode,
  type RenderBusinessSqlInput,
  type SqlArtifact,
} from "./businessSqlRendererContracts";

export type {
  BusinessSqlDialectCapability,
  BusinessSqlDialectRenderer,
  BusinessSqlRenderResult,
  BusinessSqlRendererDialectId,
  BusinessSqlRendererReasonCode,
  RenderBusinessSqlInput,
  SqlArtifact,
} from "./businessSqlRendererContracts";
export { createBusinessSqlArtifactId } from "./businessSqlRendererContracts";
export type {
  BusinessSqlExecutionTarget,
  BusinessSqlRenderPurpose,
  BusinessSqlRenderRequest,
} from "./businessSqlRenderRequest";
export {
  createBusinessSqlExecutionRenderRequest,
  createBusinessSqlPreviewRenderRequest,
  createBusinessSqlRenderRequest,
  createBusinessSqlRenderRequestId,
  DEFAULT_BUSINESS_SQL_EXECUTION_TARGET,
} from "./businessSqlRenderRequest";

type SqlSafetyValidation = {
  ok: boolean;
  reasons: string[];
};

export const BUSINESS_SQL_DUCKDB_RENDERER_ID = "business-sql-renderer:duckdb";
export const BUSINESS_SQL_POSTGRESQL_RENDERER_ID = "business-sql-renderer:postgresql";

// Renderer version policy: increment this value for byte-visible SQL emission
// changes or behavior changes that alter artifact interpretation. Do not
// increment for pure internal refactors that keep byte-identical output.
// The version participates in SqlArtifact identity, never canonical plan identity.
export const BUSINESS_SQL_DUCKDB_RENDERER_VERSION =
  "business-sql-duckdb-renderer:v1";
export const BUSINESS_SQL_POSTGRESQL_RENDERER_VERSION =
  "business-sql-postgresql-renderer:v1";

type BusinessSqlDialectRenderingConfig = {
  dialect: BusinessSqlRendererDialectId;
  rendererId: string;
  rendererVersion: string;
  textContains: (fieldExpression: string, literal: string) => string;
  textStartsWith: (fieldExpression: string, literal: string) => string;
  textEndsWith: (fieldExpression: string, literal: string) => string;
};

const DUCKDB_RENDERING_CONFIG: BusinessSqlDialectRenderingConfig = {
  dialect: "duckdb",
  rendererId: BUSINESS_SQL_DUCKDB_RENDERER_ID,
  rendererVersion: BUSINESS_SQL_DUCKDB_RENDERER_VERSION,
  textContains: (fieldExpression, literal) => `contains(${fieldExpression}, ${literal})`,
  textStartsWith: (fieldExpression, literal) => `starts_with(${fieldExpression}, ${literal})`,
  textEndsWith: (fieldExpression, literal) => `ends_with(${fieldExpression}, ${literal})`,
};

const POSTGRESQL_RENDERING_CONFIG: BusinessSqlDialectRenderingConfig = {
  dialect: "postgresql",
  rendererId: BUSINESS_SQL_POSTGRESQL_RENDERER_ID,
  rendererVersion: BUSINESS_SQL_POSTGRESQL_RENDERER_VERSION,
  textContains: (fieldExpression, literal) => `POSITION(${literal} IN ${fieldExpression}) > 0`,
  textStartsWith: (fieldExpression, literal) => `POSITION(${literal} IN ${fieldExpression}) = 1`,
  textEndsWith: (fieldExpression, literal) => `RIGHT(${fieldExpression}, CHAR_LENGTH(${literal})) = ${literal}`,
};

const hasText = (value: string | undefined): value is string =>
  Boolean(value && value.trim().length > 0);

const uniqueStrings = (values: readonly string[]): string[] =>
  Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));

const hasControlCharacter = (value: string): boolean =>
  Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });

const quoteIdentifier = (identifier: string): string =>
  `"${identifier.replace(/"/g, '""')}"`;

const qualified = (table: string, field: string): string =>
  `${quoteIdentifier(table)}.${quoteIdentifier(field)}`;

const isValidIdentifier = (identifier: string | undefined): identifier is string =>
  hasText(identifier) && !hasControlCharacter(identifier);

const summaryFor = (
  planId: string,
  status: BusinessSqlRenderResult["status"],
  reasonCode: BusinessSqlRendererReasonCode,
  sql: string | null,
  dialect: BusinessSqlRendererDialectId,
): string =>
  [
    `plan=${planId}`,
    `status=${status}`,
    `rendered=${status === "rendered"}`,
    `reason=${reasonCode}`,
    `target=${dialect}`,
    `sql=${sql ? "present" : "none"}`,
    "execution=false",
    "insert=false",
    "run=false",
  ].join("; ");

const refused = ({
  integrated,
  reasonCode,
  status,
  reasons,
  warnings,
  dialect,
}: {
  integrated: BusinessSqlQueryPlanJoinResolution;
  reasonCode: Exclude<BusinessSqlRendererReasonCode, "rendered">;
  status: "needs_review" | "blocked";
  reasons: readonly string[];
  warnings?: readonly string[];
  dialect: BusinessSqlRendererDialectId;
}): BusinessSqlRenderResult => {
  const blockers = status === "blocked" ? uniqueStrings(reasons) : [];
  return {
    status,
    rendered: false,
    sql: null,
    reasonCode,
    reasons: uniqueStrings(reasons),
    blockers,
    warnings: uniqueStrings(warnings || integrated.warnings),
    planId: integrated.plan.id,
    rendererTarget: dialect,
    executionPayload: null,
    inserted: false,
    ranQuery: false,
    summary: summaryFor(integrated.plan.id, status, reasonCode, null, dialect),
  };
};

const rendered = (
  integrated: BusinessSqlQueryPlanJoinResolution,
  sql: string,
  dialect: BusinessSqlRendererDialectId,
): BusinessSqlRenderResult => ({
  status: "rendered",
  rendered: true,
  sql,
  reasonCode: "rendered",
  reasons: [],
  blockers: [],
  warnings: uniqueStrings(integrated.warnings),
  planId: integrated.plan.id,
  rendererTarget: dialect,
  executionPayload: null,
  inserted: false,
  ranQuery: false,
  summary: summaryFor(integrated.plan.id, "rendered", "rendered", sql, dialect),
});

const groupingExpressions = (plan: BusinessSqlQueryPlan): Array<{
  expression: string;
  alias: string;
  table: string;
  field: string;
}> | null => {
  const expressions = [];
  for (const grouping of plan.groupings) {
    if (!isValidIdentifier(grouping.table) || !isValidIdentifier(grouping.field)) return null;
    expressions.push({
      expression: qualified(grouping.table, grouping.field),
      alias: grouping.label || grouping.field,
      table: grouping.table,
      field: grouping.field,
    });
  }
  return expressions;
};

const metricExpression = (measure: BusinessSqlMeasure): string | null => {
  if (measure.kind === "count_distinct") {
    if (!isValidIdentifier(measure.table) || !isValidIdentifier(measure.field)) return null;
    return `COUNT(DISTINCT ${qualified(measure.table, measure.field)})`;
  }
  if (measure.kind === "count_entities" || measure.kind === "count_rows") {
    if (isValidIdentifier(measure.table) && isValidIdentifier(measure.field)) {
      return `COUNT(${qualified(measure.table, measure.field)})`;
    }
    return "COUNT(*)";
  }
  if (!isValidIdentifier(measure.table) || !isValidIdentifier(measure.field)) return null;
  if (measure.kind === "sum") return `SUM(${qualified(measure.table, measure.field)})`;
  if (measure.kind === "average") return `AVG(${qualified(measure.table, measure.field)})`;
  if (measure.kind === "minimum") return `MIN(${qualified(measure.table, measure.field)})`;
  if (measure.kind === "maximum") return `MAX(${qualified(measure.table, measure.field)})`;
  return null;
};

const measuresById = (measures: readonly BusinessSqlMeasure[]): Map<string, BusinessSqlMeasure> =>
  new Map(measures.map((measure) => [measure.measureId, measure]));

const derivedMeasureExpression = (
  derivedMeasure: BusinessSqlDerivedMeasure,
  measures: readonly BusinessSqlMeasure[],
): string | null => {
  if (
    derivedMeasure.operator !== "add" &&
    derivedMeasure.operator !== "subtract" &&
    derivedMeasure.operator !== "multiply" &&
    derivedMeasure.operator !== "divide"
  ) {
    return null;
  }
  const byId = measuresById(measures);
  const leftMeasure = byId.get(derivedMeasure.leftMeasureId);
  const rightMeasure = byId.get(derivedMeasure.rightMeasureId);
  if (!leftMeasure || !rightMeasure) return null;
  const leftExpression = metricExpression(leftMeasure);
  const rightExpression = metricExpression(rightMeasure);
  if (!leftExpression || !rightExpression) return null;
  if (derivedMeasure.operator === "divide") {
    if (derivedMeasure.divisionPolicy?.zeroDenominator !== "null") return null;
    return [
      "CASE",
      `    WHEN (${rightExpression}) = 0 THEN NULL`,
      `    ELSE (${leftExpression}) / (${rightExpression})`,
      "  END",
    ].join("\n");
  }
  if (derivedMeasure.operator === "add") {
    return `(${leftExpression}) + (${rightExpression})`;
  }
  if (derivedMeasure.operator === "multiply") {
    return `(${leftExpression}) * (${rightExpression})`;
  }
  return `(${leftExpression}) - (${rightExpression})`;
};

const derivedOperandMeasures = (
  derivedMeasure: BusinessSqlDerivedMeasure,
  measures: readonly BusinessSqlMeasure[],
): [BusinessSqlMeasure, BusinessSqlMeasure] | null => {
  const byId = measuresById(measures);
  const leftMeasure = byId.get(derivedMeasure.leftMeasureId);
  const rightMeasure = byId.get(derivedMeasure.rightMeasureId);
  return leftMeasure && rightMeasure ? [leftMeasure, rightMeasure] : null;
};

const joinEdgesForRendering = (
  integrated: BusinessSqlQueryPlanJoinResolution,
): BusinessSqlJoinEdge[] | null => {
  const { plan, joinResolution } = integrated;
  if (!plan.joinPath.required) return [];
  if (joinResolution.status !== "ready") return null;
  if (integrated.unresolvedJoinRequirements.length > 0) return null;
  if (integrated.blockedJoinRequirements.length > 0) return null;
  if (plan.joinPath.edges.some((edge) => !edge.fromTable || !edge.toTable)) return null;
  if (plan.joinPath.edges.some((edge) => !edge.fromField || !edge.toField)) return null;
  return plan.joinPath.edges;
};

const renderFromAndJoins = (
  integrated: BusinessSqlQueryPlanJoinResolution,
): string | null => {
  const plan = integrated.plan;
  const firstRequiredTable = plan.entities.find((entity) => entity.required)?.table;
  if (!hasText(firstRequiredTable)) return null;

  const edges = joinEdgesForRendering(integrated);
  if (!edges) return null;

  return [
    `FROM ${quoteIdentifier(firstRequiredTable)}`,
    ...edges.map((edge) => {
      if (
        !hasText(edge.toTable) ||
        !hasText(edge.fromTable) ||
        !hasText(edge.fromField) ||
        !hasText(edge.toField)
      ) {
        return null;
      }
      return `JOIN ${quoteIdentifier(edge.toTable)} ON ${qualified(
        edge.fromTable,
        edge.fromField,
      )} = ${qualified(edge.toTable, edge.toField)}`;
    }),
  ]
    .filter((clause): clause is string => Boolean(clause))
    .join("\n");
};

const renderOrderBy = (
  plan: BusinessSqlQueryPlan,
  measure: BusinessSqlMeasure,
  groupings: NonNullable<ReturnType<typeof groupingExpressions>>,
): string | null => {
  const sort = plan.orderBy[0];
  if (!sort) return null;
  const direction = sort.direction === "asc" ? "ASC" : "DESC";
  if (sort.target.kind === "measure") {
    if (sort.target.measureId !== measure.measureId) return null;
    return `ORDER BY ${quoteIdentifier(measure.sqlAlias)} ${direction}`;
  }
  if (sort.target.kind === "derived_measure") return null;
  const sortTarget = sort.target;
  const grouping = groupings.find(
    (candidate) =>
      candidate.table === sortTarget.table &&
      candidate.field === sortTarget.field,
  );
  if (!grouping) return null;
  return `ORDER BY ${quoteIdentifier(grouping.alias)} ${direction}`;
};

const renderOptionalOrderBy = (
  plan: BusinessSqlQueryPlan,
  measures: readonly BusinessSqlMeasure[],
  derivedMeasures: readonly BusinessSqlDerivedMeasure[],
  groupings: NonNullable<ReturnType<typeof groupingExpressions>>,
): string | null => {
  const sort = plan.orderBy[0];
  if (!sort) return null;
  const direction = sort.direction === "asc" ? "ASC" : "DESC";
  if (sort.target.kind === "measure") {
    const measureId = sort.target.measureId;
    const measure = measures.find((candidate) => candidate.measureId === measureId);
    return measure ? `ORDER BY ${quoteIdentifier(measure.sqlAlias)} ${direction}` : null;
  }
  if (sort.target.kind === "derived_measure") {
    const target = sort.target;
    const matchingDerivedMeasures = derivedMeasures.filter(
      (candidate) => candidate.derivedMeasureId === target.derivedMeasureId,
    );
    const derivedMeasure = matchingDerivedMeasures.length === 1
      ? matchingDerivedMeasures[0]
      : null;
    return derivedMeasure && isValidIdentifier(derivedMeasure.sqlAlias)
      ? `ORDER BY ${quoteIdentifier(derivedMeasure.sqlAlias)} ${direction}`
      : null;
  }
  const sortTarget = sort.target;
  const grouping = groupings.find(
    (candidate) =>
      candidate.table === sortTarget.table &&
      candidate.field === sortTarget.field,
  );
  return grouping ? `ORDER BY ${quoteIdentifier(grouping.alias)} ${direction}` : null;
};

const renderLimit = (plan: BusinessSqlQueryPlan): string | null => {
  if (!plan.rowLimit) return null;
  if (!Number.isInteger(plan.rowLimit.value) || plan.rowLimit.value < 1 || plan.rowLimit.value > 10000) {
    return null;
  }
  return `LIMIT ${plan.rowLimit.value}`;
};

const aggregateComparisonOperatorSql: Record<BusinessSqlAggregateComparisonOperator, string> = {
  greater_than: ">",
  greater_than_or_equal: ">=",
  less_than: "<",
  less_than_or_equal: "<=",
  equals: "=",
  not_equals: "<>",
};

const renderNumericComparisonValue = (value: number): string | null =>
  Number.isFinite(value) ? String(value) : null;

const renderSqlLiteral = (value: BusinessSqlFilterComparisonValue): string | null => {
  if (value.kind === "number") return Number.isFinite(value.value) ? String(value.value) : null;
  if (value.kind === "boolean") return value.value ? "TRUE" : "FALSE";
  if (value.kind === "string") {
    if (!isValidIdentifier(value.value)) return null;
    return `'${value.value.replace(/'/g, "''")}'`;
  }
  return null;
};

const renderSqlDateLiteral = (value: BusinessSqlFilterComparisonValue): string | null => {
  if (value.kind !== "date") return null;
  if (value.valueKind !== "date") return null;
  return isCanonicalBusinessSqlDateValue(value.value) ? `DATE '${value.value}'` : null;
};

const renderSqlSetLiteral = (
  value: BusinessSqlFilterComparisonValue,
): string | null => {
  if (value.kind !== "set") return null;
  if (!Array.isArray(value.values) || value.values.length === 0) return null;

  const literals: string[] = [];
  if (value.valueKind === "number") {
    const members = Array.from(new Set(value.values));
    if (!members.every((member): member is number => typeof member === "number" && Number.isFinite(member))) {
      return null;
    }
    literals.push(...members.sort((left, right) => left - right).map(String));
  } else if (value.valueKind === "string") {
    const members = Array.from(new Set(value.values));
    if (!members.every((member): member is string => typeof member === "string" && isValidIdentifier(member))) {
      return null;
    }
    literals.push(...members.sort().map((member) => `'${member.replace(/'/g, "''")}'`));
  } else if (value.valueKind === "boolean") {
    const members = Array.from(new Set(value.values));
    if (!members.every((member): member is boolean => typeof member === "boolean")) return null;
    literals.push(...members
      .sort((left, right) => Number(left) - Number(right))
      .map((member) => member ? "TRUE" : "FALSE"));
  } else {
    return null;
  }

  return literals.length > 0 ? `(${literals.join(", ")})` : null;
};

const renderSqlRangeLiteral = (
  value: BusinessSqlFilterComparisonValue,
): { lower: string; upper: string } | null => {
  if (value.kind !== "range") return null;
  if (
    value.valueKind !== "number" ||
    value.lowerInclusive !== true ||
    value.upperInclusive !== true ||
    value.lower > value.upper
  ) {
    return null;
  }
  const lower = renderNumericComparisonValue(value.lower);
  const upper = renderNumericComparisonValue(value.upper);
  return lower !== null && upper !== null ? { lower, upper } : null;
};

const renderSqlDateRangeLiteral = (
  value: BusinessSqlFilterComparisonValue,
): { lower: string; upper: string } | null => {
  if (!isCanonicalBusinessSqlDateRangeValue(value)) return null;
  return {
    lower: `DATE '${value.lower}'`,
    upper: `DATE '${value.upper}'`,
  };
};

const rowFilterComparisonOperatorSql: Partial<Record<BusinessSqlFilterOperator, string>> = {
  equals: "=",
  not_equals: "<>",
  greater_than: ">",
  greater_than_or_equal: ">=",
  less_than: "<",
  less_than_or_equal: "<=",
};

const joinedTablesForRendering = (
  integrated: BusinessSqlQueryPlanJoinResolution,
): Set<string> | null => {
  const firstRequiredTable = integrated.plan.entities.find((entity) => entity.required)?.table;
  if (!hasText(firstRequiredTable)) return null;
  const tables = new Set([firstRequiredTable]);
  const edges = joinEdgesForRendering(integrated);
  if (!edges) return null;
  for (const edge of edges) {
    if (!hasText(edge.fromTable) || !hasText(edge.toTable)) return null;
    tables.add(edge.fromTable);
    tables.add(edge.toTable);
  }
  return tables;
};

const isBusinessSqlFilterRecord = (filter: unknown): filter is BusinessSqlFilter =>
  Boolean(filter && typeof filter === "object" && !Array.isArray(filter));

const renderBusinessSqlFilterExpression = (
  integrated: BusinessSqlQueryPlanJoinResolution,
  filter: unknown,
  config: BusinessSqlDialectRenderingConfig,
): string | null => {
  if (!isBusinessSqlFilterRecord(filter)) return null;
  if (filter.target?.kind !== "field") return null;
  if (!evaluateBusinessSqlFilterCompatibility({ filter }).compatible) return null;
  const target = filter.target;
  if (!isValidIdentifier(target.table) || !isValidIdentifier(target.field)) return null;
  const joinedTables = joinedTablesForRendering(integrated);
  if (!joinedTables || !joinedTables.has(target.table)) return null;

  const fieldExpression = qualified(target.table, target.field);
  if (filter.operator === "is_null") return `${fieldExpression} IS NULL`;
  if (filter.operator === "is_not_null") return `${fieldExpression} IS NOT NULL`;
  if (!filter.comparisonValue) return null;
  if (filter.operator === "between") {
    const literal = filter.comparisonValue.kind === "range" && filter.comparisonValue.valueKind === "date"
      ? renderSqlDateRangeLiteral(filter.comparisonValue)
      : renderSqlRangeLiteral(filter.comparisonValue);
    if (!literal) return null;
    return `${fieldExpression} BETWEEN ${literal.lower} AND ${literal.upper}`;
  }
  if (filter.comparisonValue.kind === "range") return null;
  if (filter.operator === "before" || filter.operator === "after") {
    const literal = renderSqlDateLiteral(filter.comparisonValue);
    if (!literal) return null;
    return `${fieldExpression} ${filter.operator === "before" ? "<" : ">"} ${literal}`;
  }
  if (filter.comparisonValue.kind === "date") return null;
  if (filter.operator === "in" || filter.operator === "not_in") {
    const literal = renderSqlSetLiteral(filter.comparisonValue);
    if (!literal) return null;
    return `${fieldExpression} ${filter.operator === "in" ? "IN" : "NOT IN"} ${literal}`;
  }
  const literal = renderSqlLiteral(filter.comparisonValue);
  if (!literal) return null;
  if (filter.operator === "contains") return config.textContains(fieldExpression, literal);
  if (filter.operator === "starts_with") return config.textStartsWith(fieldExpression, literal);
  if (filter.operator === "ends_with") return config.textEndsWith(fieldExpression, literal);
  const operator = filter.operator ? rowFilterComparisonOperatorSql[filter.operator] : null;
  return operator ? `${fieldExpression} ${operator} ${literal}` : null;
};

const renderWhere = (
  integrated: BusinessSqlQueryPlanJoinResolution,
  filters: readonly unknown[],
  config: BusinessSqlDialectRenderingConfig,
): string | null => {
  if (filters.length === 0) return null;
  if (resolveBusinessSqlFilterCombinator(integrated.plan) !== "and") return null;
  const expressions = filters.map((filter) =>
    renderBusinessSqlFilterExpression(integrated, filter, config),
  );
  if (expressions.some((expression) => expression === null)) return null;
  return `WHERE ${expressions.join("\n  AND ")}`;
};

const renderHaving = (
  plan: BusinessSqlQueryPlan,
  measures: readonly BusinessSqlMeasure[],
  derivedMeasures: readonly BusinessSqlDerivedMeasure[],
): string | null => {
  if (plan.aggregateResultConditions.length === 0) return null;
  if (plan.aggregateResultConditions.length > 1) return null;

  const condition = plan.aggregateResultConditions[0];
  const target = getBusinessSqlAggregateResultConditionTarget(condition);
  if (!target) return null;
  const aggregateExpression = (() => {
    if (target.kind === "measure") {
      const measure = measures.find((candidate) => candidate.measureId === target.measureId);
      return measure ? metricExpression(measure) : null;
    }
    const matchingDerivedMeasures = derivedMeasures.filter(
      (candidate) => candidate.derivedMeasureId === target.derivedMeasureId,
    );
    const derivedMeasure = matchingDerivedMeasures.length === 1
      ? matchingDerivedMeasures[0]
      : null;
    return derivedMeasure ? derivedMeasureExpression(derivedMeasure, measures) : null;
  })();
  const operator = aggregateComparisonOperatorSql[condition.operator];
  const comparisonValue =
    condition.comparisonValue.kind === "number"
      ? renderNumericComparisonValue(condition.comparisonValue.value)
      : null;

  if (!aggregateExpression || !operator || comparisonValue === null) return null;

  return `HAVING ${aggregateExpression} ${operator} ${comparisonValue}`;
};

const appendTerminalClause = (clauses: readonly string[]): string[] => {
  if (clauses.length === 0) return [];
  return [
    ...clauses.slice(0, -1),
    `${clauses[clauses.length - 1]};`,
  ];
};

const validateSelectOnlySql = (sql: string): SqlSafetyValidation => {
  const reasons: string[] = [];
  const trimmed = sql.trim();

  if (!/^SELECT\b/i.test(trimmed)) {
    reasons.push("Rendered SQL must start with SELECT.");
  }
  if (/\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|MERGE|CALL|COPY|PRAGMA|ATTACH|DETACH)\b/i.test(trimmed)) {
    reasons.push("Rendered SQL must not contain mutating or runtime-control statements.");
  }
  if (/--|\/\*/.test(trimmed)) {
    reasons.push("Rendered SQL must not contain comments.");
  }

  const statementBody = trimmed.endsWith(";") ? trimmed.slice(0, -1) : trimmed;
  if (statementBody.includes(";")) {
    reasons.push("Rendered SQL must contain only one statement.");
  }

  return { ok: reasons.length === 0, reasons };
};

const statusForRefusal = (
  renderability: BusinessSqlRenderabilityGate,
): "needs_review" | "blocked" =>
  renderability.status === "blocked" ? "blocked" : "needs_review";

function renderConfiguredBusinessSqlFromRenderability({
  integrated,
  renderability: inputRenderability,
  config,
}: RenderBusinessSqlInput & {
  config: BusinessSqlDialectRenderingConfig;
}): BusinessSqlRenderResult {
  const evaluatedRenderability = inputRenderability || evaluateBusinessSqlRenderability({ integrated });
  const renderability: BusinessSqlRenderabilityGate = {
    ...evaluatedRenderability,
    rendererTarget: {
      targetDialect: config.dialect,
      metadataOnly: true,
    },
  };

  if (!renderability.renderable || renderability.status !== "renderable") {
    return refused({
      integrated,
      reasonCode: "renderability_not_renderable",
      status: statusForRefusal(renderability),
      reasons: [
        ...renderability.blockingReasons,
        ...renderability.reviewReasons,
        `Renderability status is ${renderability.status}.`,
      ],
      warnings: renderability.warnings,
      dialect: config.dialect,
    });
  }

  if (renderability.readinessStatus !== "ready" || integrated.readiness !== "ready") {
    return refused({
      integrated,
      reasonCode: "readiness_not_ready",
      status: integrated.readiness === "blocked" ? "blocked" : "needs_review",
      reasons: [
        `Readiness status is ${renderability.readinessStatus}.`,
        `Integrated readiness is ${integrated.readiness}.`,
      ],
      warnings: renderability.warnings,
      dialect: config.dialect,
    });
  }

  if (renderability.rendererTarget.targetDialect !== config.dialect) {
    return refused({
      integrated,
      reasonCode:
        config.dialect === "duckdb"
          ? "renderer_target_not_duckdb"
          : "renderer_target_dialect_mismatch",
      status: "blocked",
      reasons: [
        `Renderer target ${renderability.rendererTarget.targetDialect} does not match ${config.dialect}.`,
      ],
      warnings: renderability.warnings,
      dialect: config.dialect,
    });
  }

  if (integrated.joinResolution.status !== "ready") {
    return refused({
      integrated,
      reasonCode:
        integrated.joinResolution.status === "needs_review"
          ? "relationship_review_required"
          : "join_resolution_unresolved",
      status: integrated.joinResolution.status === "blocked" ? "blocked" : "needs_review",
      reasons: [
        `Join resolution is ${integrated.joinResolution.status}.`,
        ...integrated.joinResolution.warnings,
      ],
      warnings: renderability.warnings,
      dialect: config.dialect,
    });
  }

  if (integrated.unresolvedJoinRequirements.length > 0) {
    return refused({
      integrated,
      reasonCode: "relationship_review_required",
      status: "needs_review",
      reasons: ["One or more required relationships still need review."],
      warnings: renderability.warnings,
      dialect: config.dialect,
    });
  }

  if (integrated.blockedJoinRequirements.length > 0) {
    return refused({
      integrated,
      reasonCode: "join_resolution_unresolved",
      status: "blocked",
      reasons: ["One or more required relationships are blocked."],
      warnings: renderability.warnings,
      dialect: config.dialect,
    });
  }

  const plan = integrated.plan;
  const capability = evaluateBusinessSqlRendererCapability(plan);
  if (!capability.capable) {
    return refused({
      integrated,
      reasonCode: "renderer_capability_incapable",
      status: "needs_review",
      reasons: capability.reasonCodes.map((reason) => `Renderer capability is incapable: ${reason}.`),
      warnings: renderability.warnings,
      dialect: config.dialect,
    });
  }

  const normalizedPlan = normalizeMetricAndMeasures(plan);
  const groupings = groupingExpressions(plan);
  const fromAndJoins = renderFromAndJoins(integrated);
  const where = renderWhere(integrated, normalizedPlan.filters || [], config);
  const requiresWhere = (normalizedPlan.filters || []).length > 0;
  const fieldProjectionOnly =
    normalizedPlan.measures.length === 0 &&
    normalizedPlan.derivedMeasures.length === 0 &&
    normalizedPlan.aggregateResultConditions.length === 0 &&
    (normalizedPlan.orderBy || []).length === 0 &&
    groupings &&
    groupings.length > 0;

  if (requiresWhere && !where) {
    return refused({
      integrated,
      reasonCode: "incomplete_plan_metadata",
      status: "needs_review",
      reasons: ["Plan contains row-level filters that cannot be rendered as deterministic WHERE."],
      warnings: renderability.warnings,
      dialect: config.dialect,
    });
  }

  const derivedMeasure = normalizedPlan.derivedMeasures[0] || null;
  const rendersDerivedMeasure = Boolean(derivedMeasure);
  const measure = normalizedPlan.measures[0];
  if (
    (!measure && !fieldProjectionOnly) ||
    plan.kind === "count_distinct_entity" ||
    (!fieldProjectionOnly && !rendersDerivedMeasure && normalizedPlan.measures.length !== 1) ||
    (rendersDerivedMeasure && normalizedPlan.derivedMeasures.length !== 1)
  ) {
    return refused({
      integrated,
      reasonCode: "unsupported_plan_shape",
      status: "needs_review",
      reasons: ["Plan shape is not supported by the deterministic renderer yet."],
      warnings: renderability.warnings,
      dialect: config.dialect,
    });
  }

  const limit = renderLimit(plan);
  const having = renderHaving(
    normalizedPlan,
    normalizedPlan.measures,
    normalizedPlan.derivedMeasures,
  );
  const requiresHaving = normalizedPlan.aggregateResultConditions.length > 0;
  const operandMeasures = derivedMeasure
    ? derivedOperandMeasures(derivedMeasure, normalizedPlan.measures)
    : null;
  const derivedExpression = derivedMeasure
    ? derivedMeasureExpression(derivedMeasure, normalizedPlan.measures)
    : null;
  const baseMetric = !derivedMeasure && measure ? metricExpression(measure) : null;
  const orderBy = groupings
    ? fieldProjectionOnly
      ? null
      : derivedMeasure
      ? renderOptionalOrderBy(
          plan,
          normalizedPlan.measures,
          normalizedPlan.derivedMeasures,
          groupings,
        )
      : renderOrderBy(plan, measure, groupings)
    : null;
  const requiresOrderBy = !fieldProjectionOnly && (plan.orderBy || []).length > 0;

  if (
    !groupings ||
    groupings.length === 0 ||
    !fromAndJoins ||
    (!fieldProjectionOnly && !derivedMeasure && !baseMetric) ||
    (derivedMeasure && (!operandMeasures || !derivedExpression || !isValidIdentifier(derivedMeasure.sqlAlias))) ||
    (requiresOrderBy && !orderBy) ||
    (plan.rowLimit && !limit) ||
    (requiresHaving && !having)
  ) {
    return refused({
      integrated,
      reasonCode: "incomplete_plan_metadata",
      status: "needs_review",
      reasons: ["Plan metadata is incomplete for deterministic DuckDB rendering."],
      warnings: renderability.warnings,
      dialect: config.dialect,
    });
  }

  const selectLines = groupings.map(
    (grouping) => `  ${grouping.expression} AS ${quoteIdentifier(grouping.alias)},`,
  );
  if (fieldProjectionOnly) {
    const projectionLines = groupings.map((grouping, index) => {
      const suffix = index === groupings.length - 1 ? "" : ",";
      return `  ${grouping.expression} AS ${quoteIdentifier(grouping.alias)}${suffix}`;
    });
    const tailClauses = [where, limit].filter((clause): clause is string => Boolean(clause));
    const terminalClauses =
      tailClauses.length > 0 ? [fromAndJoins, ...appendTerminalClause(tailClauses)] : [`${fromAndJoins};`];
    const sql = [
      "SELECT",
      ...projectionLines,
      ...terminalClauses,
    ].join("\n");
    const safety = validateSelectOnlySql(sql);
    if (!safety.ok) {
      return refused({
        integrated,
        reasonCode: "unsafe_sql",
        status: "blocked",
        reasons: safety.reasons,
        warnings: renderability.warnings,
        dialect: config.dialect,
      });
    }
    return rendered(integrated, sql, config.dialect);
  }

  const groupBy = `GROUP BY ${groupings.map((grouping) => grouping.expression).join(", ")}`;
  const tailClauses = [having, orderBy, limit].filter((clause): clause is string => Boolean(clause));
  const trailingClauses =
    tailClauses.length > 0
      ? [groupBy, ...appendTerminalClause(tailClauses)]
      : [`${groupBy};`];
  const measureSelectLines = derivedMeasure && operandMeasures
    ? [
        `  ${metricExpression(operandMeasures[0])} AS ${quoteIdentifier(operandMeasures[0].sqlAlias)},`,
        `  ${metricExpression(operandMeasures[1])} AS ${quoteIdentifier(operandMeasures[1].sqlAlias)},`,
        `  ${derivedExpression} AS ${quoteIdentifier(derivedMeasure.sqlAlias)}`,
      ]
    : [`  ${baseMetric} AS ${quoteIdentifier(measure.sqlAlias)}`];
  const sql = [
    "SELECT",
    ...selectLines,
    ...measureSelectLines,
    fromAndJoins,
    ...(where ? [where] : []),
    ...trailingClauses,
  ].join("\n");
  const safety = validateSelectOnlySql(sql);
  if (!safety.ok) {
    return refused({
      integrated,
      reasonCode: "unsafe_sql",
      status: "blocked",
      reasons: safety.reasons,
      warnings: renderability.warnings,
      dialect: config.dialect,
    });
  }

  return rendered(integrated, sql, config.dialect);
}

const requestForInput = (input: RenderBusinessSqlInput): BusinessSqlRenderRequest =>
  input.request || createBusinessSqlPreviewRenderRequest(input.integrated.plan, "duckdb");

const duckDbBusinessSqlRenderer: BusinessSqlDialectRenderer = {
  dialect: "duckdb",
  rendererId: BUSINESS_SQL_DUCKDB_RENDERER_ID,
  rendererVersion: BUSINESS_SQL_DUCKDB_RENDERER_VERSION,
  render: (input) => {
    const request = requestForInput(input);
    return sqlArtifactFromRenderResult({
      result: renderConfiguredBusinessSqlFromRenderability({
        ...input,
        config: DUCKDB_RENDERING_CONFIG,
      }),
      request,
      rendererId: BUSINESS_SQL_DUCKDB_RENDERER_ID,
      rendererVersion: BUSINESS_SQL_DUCKDB_RENDERER_VERSION,
    });
  },
  evaluateCapability: (input) => {
    const capability = evaluateBusinessSqlRendererCapability(input.integrated.plan);
    return {
      dialect: "duckdb",
      rendererId: BUSINESS_SQL_DUCKDB_RENDERER_ID,
      rendererVersion: BUSINESS_SQL_DUCKDB_RENDERER_VERSION,
      capable: capability.capable,
      status: capability.status,
      reasonCodes: [...capability.reasonCodes],
      metadataOnly: true,
    };
  },
};

const postgreSqlBusinessSqlRenderer: BusinessSqlDialectRenderer = {
  dialect: "postgresql",
  rendererId: BUSINESS_SQL_POSTGRESQL_RENDERER_ID,
  rendererVersion: BUSINESS_SQL_POSTGRESQL_RENDERER_VERSION,
  render: (input) => {
    const request = requestForInput(input);
    return sqlArtifactFromRenderResult({
      result: renderConfiguredBusinessSqlFromRenderability({
        ...input,
        config: POSTGRESQL_RENDERING_CONFIG,
      }),
      request,
      rendererId: BUSINESS_SQL_POSTGRESQL_RENDERER_ID,
      rendererVersion: BUSINESS_SQL_POSTGRESQL_RENDERER_VERSION,
    });
  },
  evaluateCapability: (input) => {
    const capability = evaluateBusinessSqlRendererCapability(input.integrated.plan);
    return {
      dialect: "postgresql",
      rendererId: BUSINESS_SQL_POSTGRESQL_RENDERER_ID,
      rendererVersion: BUSINESS_SQL_POSTGRESQL_RENDERER_VERSION,
      capable: capability.capable,
      status: capability.status,
      reasonCodes: [...capability.reasonCodes],
      metadataOnly: true,
    };
  },
};

const businessSqlRendererRegistry: Record<
  BusinessSqlRendererDialectId,
  BusinessSqlDialectRenderer
> = {
  duckdb: duckDbBusinessSqlRenderer,
  postgresql: postgreSqlBusinessSqlRenderer,
};

export function getBusinessSqlDialectRenderer(
  dialect: BusinessSqlRendererDialectId | string,
): BusinessSqlDialectRenderer | null {
  return Object.prototype.hasOwnProperty.call(businessSqlRendererRegistry, dialect)
    ? businessSqlRendererRegistry[dialect as BusinessSqlRendererDialectId]
    : null;
}

export function renderBusinessSqlArtifactFromRenderability(
  input: RenderBusinessSqlInput,
  dialect: BusinessSqlRendererDialectId = "duckdb",
): SqlArtifact {
  const request = input.request || createBusinessSqlPreviewRenderRequest(input.integrated.plan, dialect);
  const renderer = getBusinessSqlDialectRenderer(request.dialect);
  if (!renderer) {
    const requestedDialect = request.dialect as BusinessSqlRendererDialectId;
    return sqlArtifactFromRenderResult({
      result: refused({
        integrated: input.integrated,
        reasonCode: "renderer_not_registered",
        status: "blocked",
        reasons: [`Renderer dialect ${request.dialect} is not registered.`],
        dialect: requestedDialect,
      }),
      request,
      rendererId: "business-sql-renderer:unregistered",
      rendererVersion: "business-sql-renderer:unregistered",
    });
  }
  return renderer.render({ ...input, request });
}

export function evaluateBusinessSqlDialectRendererCapability(
  input: RenderBusinessSqlInput,
  dialect: BusinessSqlRendererDialectId = "duckdb",
) {
  const request = input.request || createBusinessSqlPreviewRenderRequest(input.integrated.plan, dialect);
  const renderer = getBusinessSqlDialectRenderer(request.dialect);
  if (!renderer) {
    return {
      dialect: request.dialect,
      rendererId: "business-sql-renderer:unregistered",
      rendererVersion: "business-sql-renderer:unregistered",
      capable: false,
      status: "incapable" as const,
      reasonCodes: ["renderer_not_registered"],
      metadataOnly: true as const,
    };
  }
  return renderer.evaluateCapability({ ...input, request });
}

const joinResolutionFromPlan = (
  plan: BusinessSqlQueryPlan,
): BusinessSqlJoinPathResolution => {
  const resolved: BusinessSqlJoinRequirementResolution[] = [];
  const unresolved: BusinessSqlJoinRequirementResolution[] = [];
  const blocked: BusinessSqlJoinRequirementResolution[] = [];

  for (const requirement of plan.joinPath.requirements) {
    const edge = plan.joinPath.edges.find(
      (candidate) =>
        candidate.fromEntity === requirement.fromEntity &&
        candidate.toEntity === requirement.toEntity,
    );
    if (plan.joinPath.status === "resolved" && requirement.verified && edge) {
      resolved.push({
        requirement,
        status: "resolved",
        reason: "accepted_relationship",
        relationshipId: edge.relationship,
        edge,
      });
    } else if (plan.joinPath.status === "missing") {
      blocked.push({
        requirement,
        status: "blocked",
        reason: "missing_relationship",
      });
    } else {
      unresolved.push({
        requirement,
        status: "needs_review",
        reason: "unknown_relationship",
      });
    }
  }

  const status =
    blocked.length > 0 ? "blocked" : unresolved.length > 0 ? "needs_review" : "ready";
  return {
    status,
    support: status === "ready" ? "supported" : status,
    resolved,
    unresolved,
    blocked,
    relationshipIds: resolved.flatMap((item) => item.relationshipId ? [item.relationshipId] : []),
    assumptions: [],
    warnings: [
      ...unresolved.map((item) =>
        `Relationship ${item.requirement.fromEntity} -> ${item.requirement.toEntity} needs review.`,
      ),
      ...blocked.map((item) =>
        `Relationship ${item.requirement.fromEntity} -> ${item.requirement.toEntity} is blocked.`,
      ),
    ],
  };
};

const integratedFromPlan = (
  plan: BusinessSqlQueryPlan,
): BusinessSqlQueryPlanJoinResolution => {
  const joinResolution = joinResolutionFromPlan(plan);
  const readiness: BusinessSqlIntegratedReadiness =
    plan.support === "blocked" || joinResolution.status === "blocked"
      ? "blocked"
      : plan.support === "needs_review" && !plan.joinPath.required
        ? "needs_review"
        : joinResolution.status;
  return {
    plan,
    joinResolution,
    readiness,
    support: readiness === "ready" ? "supported" : readiness,
    resolvedJoinPaths: joinResolution.resolved,
    unresolvedJoinRequirements: joinResolution.unresolved,
    blockedJoinRequirements: joinResolution.blocked,
    warnings: uniqueStrings([
      ...plan.warnings.map((warning) => warning.message),
      ...joinResolution.warnings,
    ]),
    assumptions: uniqueStrings([
      ...plan.assumptions.map((assumption) => assumption.detail),
      ...joinResolution.assumptions,
    ]),
    summary: [
      `plan=${plan.id}`,
      `readiness=${readiness}`,
      `join=${joinResolution.status}`,
      `resolved=${joinResolution.resolved.length}`,
      `unresolved=${joinResolution.unresolved.length}`,
      `blocked=${joinResolution.blocked.length}`,
      `relationships=${joinResolution.relationshipIds.join(",") || "none"}`,
    ].join("; "),
  };
};

export function canRenderBusinessSqlQueryPlan(plan: BusinessSqlQueryPlan): boolean {
  return renderBusinessSqlQueryPlan(plan).rendered;
}

export function renderBusinessSqlQueryPlan(
  plan: BusinessSqlQueryPlan,
): BusinessSqlRenderResult {
  return renderBusinessSqlFromRenderability({ integrated: integratedFromPlan(plan) });
}

export function renderBusinessSqlQueryPlanArtifact(
  plan: BusinessSqlQueryPlan,
  request: BusinessSqlRenderRequest = createBusinessSqlPreviewRenderRequest(plan, "duckdb"),
): SqlArtifact {
  return renderBusinessSqlArtifactFromRenderability({
    integrated: integratedFromPlan(plan),
    request,
  });
}

export function renderBusinessSqlFromRenderability(
  input: RenderBusinessSqlInput,
): BusinessSqlRenderResult {
  return renderResultFromSqlArtifact(renderBusinessSqlArtifactFromRenderability(input));
}

// Legacy compatibility only: newer flows should keep rendered SQL in
// RenderRequest/SqlArtifact lineage. Canonical analytical meaning must not
// depend on rendered SQL or renderer status written back into plan.renderer.
export function applyBusinessSqlRenderedSql(
  plan: BusinessSqlQueryPlan,
): BusinessSqlQueryPlan {
  const result = renderBusinessSqlQueryPlan(plan);
  if (!result.rendered || !result.sql) {
    return {
      ...plan,
      renderer: {
        ...plan.renderer,
        status: result.status === "blocked" ? "blocked" : "not_rendered",
        sql: undefined,
      },
      preview: {
        ...plan.preview,
        rendererSummary:
          result.status === "blocked"
            ? "SQL rendering is blocked."
            : "Plan needs review before SQL rendering.",
      },
    };
  }

  return {
    ...plan,
    renderer: {
      ...plan.renderer,
      status: "rendered",
      sql: result.sql,
    },
    preview: {
      ...plan.preview,
      rendererSummary: "SQL has been rendered.",
    },
  };
}

export const __businessSqlRendererInternals = {
  validateSelectOnlySql,
  quoteIdentifier,
} as const;
