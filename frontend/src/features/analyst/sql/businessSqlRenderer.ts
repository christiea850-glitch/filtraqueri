import {
  evaluateBusinessSqlRenderability,
  type BusinessSqlRenderabilityGate,
} from "./businessSqlRenderabilityGate";
import type {
  BusinessSqlAggregateComparisonOperator,
  BusinessSqlDerivedMeasure,
  BusinessSqlJoinEdge,
  BusinessSqlMeasure,
  BusinessSqlQueryPlan,
} from "./businessSqlQueryPlan";
import {
  getBusinessSqlAggregateResultConditionTarget,
  normalizeMetricAndMeasures,
} from "./businessSqlQueryPlan";
import { evaluateBusinessSqlRendererCapability } from "./businessSqlRendererCapability";
import type {
  BusinessSqlJoinPathResolution,
  BusinessSqlJoinRequirementResolution,
} from "./businessSqlJoinPathResolver";
import type {
  BusinessSqlIntegratedReadiness,
  BusinessSqlQueryPlanJoinResolution,
} from "./businessSqlQueryPlanJoinResolution";

export type BusinessSqlRendererReasonCode =
  | "rendered"
  | "renderability_not_renderable"
  | "readiness_not_ready"
  | "renderer_target_not_duckdb"
  | "join_resolution_unresolved"
  | "relationship_review_required"
  | "renderer_capability_incapable"
  | "unsupported_plan_shape"
  | "incomplete_plan_metadata"
  | "unsafe_sql";

export type BusinessSqlRenderResult = {
  status: "rendered" | "needs_review" | "blocked";
  rendered: boolean;
  sql: string | null;
  reasonCode: BusinessSqlRendererReasonCode;
  reasons: string[];
  blockers: string[];
  warnings: string[];
  planId: string;
  rendererTarget: "duckdb";
  executionPayload: null;
  inserted: false;
  ranQuery: false;
  summary: string;
};

export type RenderBusinessSqlInput = {
  integrated: BusinessSqlQueryPlanJoinResolution;
  renderability?: BusinessSqlRenderabilityGate;
};

type SqlSafetyValidation = {
  ok: boolean;
  reasons: string[];
};

const hasText = (value: string | undefined): value is string =>
  Boolean(value && value.trim().length > 0);

const uniqueStrings = (values: readonly string[]): string[] =>
  Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));

const quoteIdentifier = (identifier: string): string =>
  `"${identifier.replace(/"/g, '""')}"`;

const qualified = (table: string, field: string): string =>
  `${quoteIdentifier(table)}.${quoteIdentifier(field)}`;

const isValidIdentifier = (identifier: string | undefined): identifier is string =>
  hasText(identifier) && !/[\u0000-\u001f\u007f]/.test(identifier);

const summaryFor = (
  planId: string,
  status: BusinessSqlRenderResult["status"],
  reasonCode: BusinessSqlRendererReasonCode,
  sql: string | null,
): string =>
  [
    `plan=${planId}`,
    `status=${status}`,
    `rendered=${status === "rendered"}`,
    `reason=${reasonCode}`,
    "target=duckdb",
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
}: {
  integrated: BusinessSqlQueryPlanJoinResolution;
  reasonCode: Exclude<BusinessSqlRendererReasonCode, "rendered">;
  status: "needs_review" | "blocked";
  reasons: readonly string[];
  warnings?: readonly string[];
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
    rendererTarget: "duckdb",
    executionPayload: null,
    inserted: false,
    ranQuery: false,
    summary: summaryFor(integrated.plan.id, status, reasonCode, null),
  };
};

const rendered = (
  integrated: BusinessSqlQueryPlanJoinResolution,
  sql: string,
): BusinessSqlRenderResult => ({
  status: "rendered",
  rendered: true,
  sql,
  reasonCode: "rendered",
  reasons: [],
  blockers: [],
  warnings: uniqueStrings(integrated.warnings),
  planId: integrated.plan.id,
  rendererTarget: "duckdb",
  executionPayload: null,
  inserted: false,
  ranQuery: false,
  summary: summaryFor(integrated.plan.id, "rendered", "rendered", sql),
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
  if (!sort) return `ORDER BY ${quoteIdentifier(measure.sqlAlias)} DESC`;
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

export function renderBusinessSqlFromRenderability({
  integrated,
  renderability = evaluateBusinessSqlRenderability({ integrated }),
}: RenderBusinessSqlInput): BusinessSqlRenderResult {
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
    });
  }

  if (renderability.rendererTarget.targetDialect !== "duckdb") {
    return refused({
      integrated,
      reasonCode: "renderer_target_not_duckdb",
      status: "blocked",
      reasons: [`Renderer target ${renderability.rendererTarget.targetDialect} is not DuckDB.`],
      warnings: renderability.warnings,
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
    });
  }

  if (integrated.unresolvedJoinRequirements.length > 0) {
    return refused({
      integrated,
      reasonCode: "relationship_review_required",
      status: "needs_review",
      reasons: ["One or more required relationships still need review."],
      warnings: renderability.warnings,
    });
  }

  if (integrated.blockedJoinRequirements.length > 0) {
    return refused({
      integrated,
      reasonCode: "join_resolution_unresolved",
      status: "blocked",
      reasons: ["One or more required relationships are blocked."],
      warnings: renderability.warnings,
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
    });
  }

  if (plan.renderer.targetDialect !== "duckdb") {
    return refused({
      integrated,
      reasonCode: "renderer_target_not_duckdb",
      status: "blocked",
      reasons: [`Plan renderer target ${plan.renderer.targetDialect} is not DuckDB.`],
      warnings: renderability.warnings,
    });
  }

  const normalizedPlan = normalizeMetricAndMeasures(plan);
  const derivedMeasure = normalizedPlan.derivedMeasures[0] || null;
  const rendersDerivedMeasure = Boolean(derivedMeasure);
  const measure = normalizedPlan.measures[0];
  if (
    !measure ||
    plan.kind === "count_distinct_entity" ||
    (!rendersDerivedMeasure && normalizedPlan.measures.length !== 1) ||
    (rendersDerivedMeasure && normalizedPlan.derivedMeasures.length !== 1)
  ) {
    return refused({
      integrated,
      reasonCode: "unsupported_plan_shape",
      status: "needs_review",
      reasons: ["Plan shape is not supported by the deterministic renderer yet."],
      warnings: renderability.warnings,
    });
  }

  const groupings = groupingExpressions(plan);
  const fromAndJoins = renderFromAndJoins(integrated);
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
  const baseMetric = !derivedMeasure ? metricExpression(measure) : null;
  const orderBy = groupings
    ? derivedMeasure
      ? renderOptionalOrderBy(
          plan,
          normalizedPlan.measures,
          normalizedPlan.derivedMeasures,
          groupings,
        )
      : renderOrderBy(plan, measure, groupings)
    : null;
  const requiresOrderBy = !derivedMeasure || (plan.orderBy || []).length > 0;

  if (
    !groupings ||
    groupings.length === 0 ||
    !fromAndJoins ||
    (!derivedMeasure && !baseMetric) ||
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
    });
  }

  const selectLines = groupings.map(
    (grouping) => `  ${grouping.expression} AS ${quoteIdentifier(grouping.alias)},`,
  );
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
    });
  }

  return rendered(integrated, sql);
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
