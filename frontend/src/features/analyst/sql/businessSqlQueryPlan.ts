import type { SqlDialectId } from "../../sqlIntelligence";

export type BusinessSqlPlanId = string;

export type BusinessSqlPlanKind =
  | "empty"
  | "single_table_count_grouping"
  | "multi_table_count_grouping"
  | "count_distinct_entity"
  | "blocked";

export type BusinessSqlPlanStatus = "draft" | "resolved" | "blocked";

export type BusinessSqlPlanSupportLevel = "supported" | "needs_review" | "blocked";

export type BusinessSqlRendererStatus =
  | "not_rendered"
  | "renderable"
  | "rendered"
  | "blocked";

export type BusinessSqlEntityRef = {
  entity: string;
  table?: string;
  field?: string;
  required: boolean;
  role:
    | "source"
    | "metric_subject"
    | "grouping_subject"
    | "filter_subject"
    | "join_subject"
    | "context";
};

export type BusinessSqlMetricKind = "count_rows" | "count_entities" | "count_distinct";

export type BusinessSqlMetric = {
  kind: BusinessSqlMetricKind;
  entity?: string;
  table?: string;
  field?: string;
  distinct: boolean;
  label: string;
};

export type BusinessSqlGrouping = {
  entity: string;
  table?: string;
  field?: string;
  label: string;
};

export type BusinessSqlFilterKind =
  | "active_current"
  | "status"
  | "date_window"
  | "date_relative"
  | "relationship_predicate"
  | "custom";

export type BusinessSqlFilter = {
  kind: BusinessSqlFilterKind;
  entity?: string;
  table?: string;
  field?: string;
  operator?:
    | "equals"
    | "not_equals"
    | "in"
    | "not_in"
    | "before"
    | "after"
    | "between"
    | "is_null"
    | "is_not_null";
  value?: string | string[];
  predicate?: string;
  label: string;
};

export type BusinessSqlJoinRequirement = {
  fromEntity: string;
  toEntity: string;
  required: boolean;
  relationship?: string;
  verified: boolean;
};

export type BusinessSqlJoinEdge = {
  fromEntity: string;
  fromTable?: string;
  fromField?: string;
  toEntity: string;
  toTable?: string;
  toField?: string;
  relationship?: string;
  verified: boolean;
};

export type BusinessSqlJoinPath = {
  required: boolean;
  status: "not_required" | "resolved" | "needs_review" | "missing";
  entities: string[];
  edges: BusinessSqlJoinEdge[];
  requirements: BusinessSqlJoinRequirement[];
};

export type BusinessSqlPlanAssumption = {
  id: string;
  label: string;
  detail: string;
};

export type BusinessSqlPlanWarning = {
  id: string;
  severity: "info" | "warning" | "blocking";
  message: string;
};

export type BusinessSqlPlanPreview = {
  title: string;
  metricSummary: string;
  groupingSummary: string;
  filterSummary: string;
  joinSummary: string;
  rendererSummary: string;
};

export type BusinessSqlRendererMetadata = {
  targetDialect: SqlDialectId;
  selectedGuidanceDialect?: SqlDialectId;
  status: BusinessSqlRendererStatus;
  sql?: string;
  notes: string[];
};

export type BusinessSqlQueryPlan = {
  id: BusinessSqlPlanId;
  kind: BusinessSqlPlanKind;
  status: BusinessSqlPlanStatus;
  support: BusinessSqlPlanSupportLevel;
  prompt?: string;
  entities: BusinessSqlEntityRef[];
  metric: BusinessSqlMetric | null;
  groupings: BusinessSqlGrouping[];
  filters: BusinessSqlFilter[];
  joinPath: BusinessSqlJoinPath;
  assumptions: BusinessSqlPlanAssumption[];
  warnings: BusinessSqlPlanWarning[];
  renderer: BusinessSqlRendererMetadata;
  preview: BusinessSqlPlanPreview;
};

const EMPTY_JOIN_PATH: BusinessSqlJoinPath = {
  required: false,
  status: "not_required",
  entities: [],
  edges: [],
  requirements: [],
};

const createPreview = (
  title: string,
  metricSummary = "No metric selected.",
  groupingSummary = "No grouping selected.",
  filterSummary = "No filters selected.",
  joinSummary = "No join path required.",
  rendererSummary = "SQL has not been rendered.",
): BusinessSqlPlanPreview => ({
  title,
  metricSummary,
  groupingSummary,
  filterSummary,
  joinSummary,
  rendererSummary,
});

export const createEmptyBusinessSqlQueryPlan = (): BusinessSqlQueryPlan => ({
  id: "business-sql-plan:empty",
  kind: "empty",
  status: "draft",
  support: "needs_review",
  entities: [],
  metric: null,
  groupings: [],
  filters: [],
  joinPath: { ...EMPTY_JOIN_PATH, entities: [], edges: [], requirements: [] },
  assumptions: [],
  warnings: [],
  renderer: {
    targetDialect: "duckdb",
    status: "not_rendered",
    notes: ["Uploaded datasets execute against DuckDB by default."],
  },
  preview: createPreview("Empty business SQL query plan"),
});

export const createBlockedBusinessSqlQueryPlan = (reason: string): BusinessSqlQueryPlan => ({
  ...createEmptyBusinessSqlQueryPlan(),
  id: "business-sql-plan:blocked",
  kind: "blocked",
  status: "blocked",
  support: "blocked",
  joinPath: {
    ...EMPTY_JOIN_PATH,
    status: "missing",
    entities: [],
    edges: [],
    requirements: [],
  },
  warnings: [
    {
      id: "blocked-plan-reason",
      severity: "blocking",
      message: reason,
    },
  ],
  renderer: {
    targetDialect: "duckdb",
    status: "blocked",
    notes: ["SQL rendering is blocked until the plan can be resolved."],
  },
  preview: createPreview(
    "Blocked business SQL query plan",
    "No metric can be safely resolved.",
    "No grouping can be safely resolved.",
    "No filters can be safely resolved.",
    reason,
    "SQL rendering is blocked.",
  ),
});

export const isBusinessSqlQueryPlanSupported = (plan: BusinessSqlQueryPlan): boolean =>
  plan.support === "supported" && plan.status !== "blocked";

export const isBusinessSqlQueryPlanRenderable = (plan: BusinessSqlQueryPlan): boolean =>
  plan.support !== "blocked" &&
  plan.renderer.status !== "blocked" &&
  (plan.renderer.status === "renderable" || plan.renderer.status === "rendered");

export const summarizeBusinessSqlQueryPlan = (plan: BusinessSqlQueryPlan): string => {
  const metric = plan.metric?.label || "no metric";
  const grouping =
    plan.groupings.length > 0
      ? plan.groupings.map((group) => group.label).join(", ")
      : "no grouping";
  const filters =
    plan.filters.length > 0
      ? plan.filters.map((filter) => filter.label).join(", ")
      : "no filters";
  const joinPath =
    plan.joinPath.entities.length > 0 ? plan.joinPath.entities.join(" → ") : "no joins";

  return [
    plan.kind,
    `support=${plan.support}`,
    `renderer=${plan.renderer.status}`,
    `metric=${metric}`,
    `grouping=${grouping}`,
    `filters=${filters}`,
    `joinPath=${joinPath}`,
    `target=${plan.renderer.targetDialect}`,
  ].join("; ");
};
