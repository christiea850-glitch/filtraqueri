import type {
  BusinessSqlJoinEdge,
  BusinessSqlQueryPlan,
} from "./businessSqlQueryPlan";
import { evaluateBusinessSqlRenderReadiness } from "./businessSqlRenderReadiness";

export type BusinessSqlRenderResult = {
  status: "rendered" | "needs_review" | "blocked";
  sql: string | null;
  reasons: string[];
  warnings: string[];
  planId: string;
};

const hasText = (value: string | undefined): value is string =>
  Boolean(value && value.trim().length > 0);

const quoteIdentifier = (identifier: string): string =>
  `"${identifier.replace(/"/g, '""')}"`;

const qualified = (table: string, field: string): string =>
  `${quoteIdentifier(table)}.${quoteIdentifier(field)}`;

const stableAlias = (label: string): string =>
  label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "metric";

const renderNeedsReview = (
  plan: BusinessSqlQueryPlan,
  reasons: readonly string[],
  warnings: readonly string[] = [],
): BusinessSqlRenderResult => ({
  status: "needs_review",
  sql: null,
  reasons: [...reasons],
  warnings: [...warnings],
  planId: plan.id,
});

const renderBlocked = (
  plan: BusinessSqlQueryPlan,
  reasons: readonly string[],
  warnings: readonly string[] = [],
): BusinessSqlRenderResult => ({
  status: "blocked",
  sql: null,
  reasons: [...reasons],
  warnings: [...warnings],
  planId: plan.id,
});

const groupingExpression = (plan: BusinessSqlQueryPlan): string | null => {
  const grouping = plan.groupings[0];
  if (!grouping || !hasText(grouping.table) || !hasText(grouping.field)) return null;
  return qualified(grouping.table, grouping.field);
};

const metricExpression = (plan: BusinessSqlQueryPlan): string | null => {
  if (!plan.metric) return null;
  if (plan.metric.kind === "count_distinct") {
    if (!hasText(plan.metric.table) || !hasText(plan.metric.field)) return null;
    return `COUNT(DISTINCT ${qualified(plan.metric.table, plan.metric.field)})`;
  }
  if (plan.metric.kind === "count_entities" || plan.metric.kind === "count_rows") {
    if (hasText(plan.metric.table) && hasText(plan.metric.field)) {
      return `COUNT(${qualified(plan.metric.table, plan.metric.field)})`;
    }
    return "COUNT(*)";
  }
  return null;
};

const requiredVerifiedEdges = (plan: BusinessSqlQueryPlan): BusinessSqlJoinEdge[] | null => {
  if (!plan.joinPath.required) return [];
  if (plan.joinPath.status !== "resolved") return null;
  if (plan.joinPath.edges.some((edge) => !edge.verified)) return null;
  return plan.joinPath.edges;
};

const renderFromAndJoins = (plan: BusinessSqlQueryPlan): string | null => {
  const firstRequiredTable = plan.entities.find((entity) => entity.required)?.table;
  if (!hasText(firstRequiredTable)) return null;
  const edges = requiredVerifiedEdges(plan);
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

const activeCurrentFilterIsSafelyRenderable = (plan: BusinessSqlQueryPlan): boolean =>
  !plan.filters.some(
    (filter) =>
      filter.kind === "active_current" ||
      filter.predicate?.includes("active_current_lease") ||
      filter.label.toLowerCase().includes("current tenant"),
  );

const isKnownRenderableShape = (plan: BusinessSqlQueryPlan): boolean => {
  const grouping = plan.groupings[0];
  if (plan.kind === "single_table_count_grouping") {
    return plan.metric?.entity === "leases" && grouping?.field === "lease_status";
  }
  if (plan.kind !== "multi_table_count_grouping") return false;

  const path = plan.joinPath.entities.join(" -> ");
  return (
    (plan.metric?.entity === "orders" &&
      grouping?.entity === "customers" &&
      path === "customers -> orders") ||
    (plan.metric?.entity === "tickets" &&
      grouping?.entity === "accounts" &&
      path === "accounts -> tickets") ||
    (plan.metric?.entity === "units" &&
      grouping?.entity === "properties" &&
      path === "properties -> units -> leases")
  );
};

export function canRenderBusinessSqlQueryPlan(plan: BusinessSqlQueryPlan): boolean {
  return renderBusinessSqlQueryPlan(plan).status === "rendered";
}

export function renderBusinessSqlQueryPlan(
  plan: BusinessSqlQueryPlan,
): BusinessSqlRenderResult {
  const readiness = evaluateBusinessSqlRenderReadiness(plan);
  if (readiness.status === "blocked") {
    return renderBlocked(plan, readiness.reasons, readiness.warnings);
  }
  if (readiness.status !== "renderable") {
    return renderNeedsReview(plan, readiness.reasons, readiness.warnings);
  }

  if (plan.renderer.targetDialect !== "duckdb") {
    return renderBlocked(plan, ["Renderer target dialect must remain DuckDB."]);
  }
  if (!isKnownRenderableShape(plan)) {
    return renderNeedsReview(plan, ["Plan shape is not supported by the deterministic renderer yet."]);
  }
  if (!activeCurrentFilterIsSafelyRenderable(plan)) {
    return renderNeedsReview(plan, [
      "Active/current lease filter semantics are not safely renderable from this plan yet.",
    ]);
  }

  const grouping = groupingExpression(plan);
  const metric = metricExpression(plan);
  const fromAndJoins = renderFromAndJoins(plan);
  const alias = plan.metric ? stableAlias(plan.metric.label) : "metric";

  if (!grouping || !metric || !fromAndJoins) {
    return renderNeedsReview(plan, [
      "Plan metadata is incomplete for deterministic DuckDB rendering.",
    ]);
  }

  return {
    status: "rendered",
    sql: [
      "SELECT",
      `  ${grouping} AS ${quoteIdentifier(plan.groupings[0]?.label || "grouping")},`,
      `  ${metric} AS ${quoteIdentifier(alias)}`,
      fromAndJoins,
      `GROUP BY ${grouping}`,
      `ORDER BY ${quoteIdentifier(alias)} DESC;`,
    ].join("\n"),
    reasons: [],
    warnings: [...readiness.warnings],
    planId: plan.id,
  };
}

export function applyBusinessSqlRenderedSql(
  plan: BusinessSqlQueryPlan,
): BusinessSqlQueryPlan {
  const result = renderBusinessSqlQueryPlan(plan);
  if (result.status !== "rendered" || !result.sql) {
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
