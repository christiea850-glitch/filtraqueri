import type { SqlDialectId } from "../../sqlIntelligence";
import type { SchemaColumn } from "../../dataset/datasetTypes";

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
export type BusinessSqlMeasureKind =
  | BusinessSqlMetricKind
  | "sum"
  | "average"
  | "minimum"
  | "maximum";

export type BusinessSqlMetric = {
  kind: BusinessSqlMetricKind;
  entity?: string;
  table?: string;
  field?: string;
  distinct: boolean;
  label: string;
};

export type BusinessSqlMeasure = {
  measureId: string;
  kind: BusinessSqlMeasureKind;
  entity?: string;
  table?: string;
  field?: string;
  fieldInferredType?: SchemaColumn["inferred_type"];
  distinct: boolean;
  label: string;
  sqlAlias: string;
};

export type BusinessSqlDerivedMeasureOperator =
  | "add"
  | "subtract"
  | "multiply"
  | "divide";

export type BusinessSqlDivisionPolicy = {
  zeroDenominator: "null";
};

export type BusinessSqlDerivedMeasure = {
  derivedMeasureId: string;
  operator: BusinessSqlDerivedMeasureOperator;
  leftMeasureId: string;
  rightMeasureId: string;
  divisionPolicy?: BusinessSqlDivisionPolicy;
  sqlAlias: string;
  label?: string;
};

export type BusinessSqlSortTarget =
  | {
      kind: "measure";
      measureId: string;
      resolved?: boolean;
    }
  | {
      kind: "grouping";
      entity?: string;
      table?: string;
      field?: string;
      resolved?: boolean;
    }
  | {
      kind: "field";
      entity?: string;
      table?: string;
      field: string;
      resolved?: boolean;
    }
  | {
      kind: "derived_measure";
      derivedMeasureId: string;
      resolved?: boolean;
      sqlAlias?: string;
      label?: string;
    };

export type BusinessSqlSort = {
  sortId: string;
  target: BusinessSqlSortTarget;
  direction: "asc" | "desc";
  label?: string;
};

export type BusinessSqlRowLimit = {
  rowLimitId: string;
  value: number;
};

export type BusinessSqlAggregateComparisonOperator =
  | "greater_than"
  | "greater_than_or_equal"
  | "less_than"
  | "less_than_or_equal"
  | "equals"
  | "not_equals";

export type BusinessSqlAggregateComparisonValue = {
  kind: "number";
  value: number;
};

export type BusinessSqlAggregateResultConditionTarget =
  | {
      kind: "measure";
      measureId: string;
    }
  | {
      kind: "derived_measure";
      derivedMeasureId: string;
    };

export type BusinessSqlAggregateResultCondition = {
  conditionId: string;
  operator: BusinessSqlAggregateComparisonOperator;
  comparisonValue: BusinessSqlAggregateComparisonValue;
  label?: string;
  measureId?: string;
  target?: BusinessSqlAggregateResultConditionTarget;
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

export type BusinessSqlFilterOperator =
  | "equals"
  | "not_equals"
  | "greater_than"
  | "greater_than_or_equal"
  | "less_than"
  | "less_than_or_equal"
  | "contains"
  | "starts_with"
  | "ends_with"
  | "in"
  | "not_in"
  | "before"
  | "after"
  | "between"
  | "is_null"
  | "is_not_null";

export type BusinessSqlFilterComparisonValue =
  | { kind: "number"; value: number }
  | { kind: "string"; value: string }
  | { kind: "boolean"; value: boolean }
  | { kind: "date"; valueKind: "date"; value: string }
  | {
      kind: "set";
      valueKind: "number" | "string" | "boolean";
      values: readonly (number | string | boolean)[];
      value?: never;
    }
  | {
      kind: "range";
      valueKind: "number";
      lower: number;
      upper: number;
      lowerInclusive: true;
      upperInclusive: true;
      value?: never;
    };

export type BusinessSqlFilterTarget =
  | {
      kind: "field";
      entity?: string;
      table?: string;
      field?: string;
      fieldInferredType?: SchemaColumn["inferred_type"];
      resolved?: boolean;
    };

export type BusinessSqlFilter = {
  filterId?: string;
  kind: BusinessSqlFilterKind;
  target?: BusinessSqlFilterTarget;
  entity?: string;
  table?: string;
  field?: string;
  fieldInferredType?: SchemaColumn["inferred_type"];
  operator?: BusinessSqlFilterOperator;
  comparisonValue?: BusinessSqlFilterComparisonValue;
  value?: string | string[];
  predicate?: string;
  label: string;
  evidence?: string;
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
  measures: BusinessSqlMeasure[];
  derivedMeasures: BusinessSqlDerivedMeasure[];
  groupings: BusinessSqlGrouping[];
  filters: BusinessSqlFilter[];
  orderBy: BusinessSqlSort[];
  rowLimit: BusinessSqlRowLimit | null;
  aggregateResultConditions: BusinessSqlAggregateResultCondition[];
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

const stablePrimitiveId = (
  prefix: string,
  parts: ReadonlyArray<string | number | boolean | null | undefined>,
): string =>
  `${prefix}:${parts
    .map((part) => String(part ?? "").trim().toLowerCase())
    .join(":")
    .replace(/[^a-z0-9:_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")}`;

export const createBusinessSqlMeasureId = (
  measure: Pick<BusinessSqlMeasure, "kind" | "entity" | "table" | "field" | "distinct">,
): string =>
  stablePrimitiveId("business-sql-measure", [
    measure.kind,
    measure.entity,
    measure.table,
    measure.field,
    measure.distinct,
  ]);

export const createBusinessSqlDerivedMeasureId = (
  derivedMeasure: Pick<
    BusinessSqlDerivedMeasure,
    "operator" | "leftMeasureId" | "rightMeasureId" | "divisionPolicy"
  >,
): string =>
  stablePrimitiveId("business-sql-derived-measure", [
    derivedMeasure.operator,
    derivedMeasure.leftMeasureId,
    derivedMeasure.rightMeasureId,
    derivedMeasure.operator === "divide"
      ? derivedMeasure.divisionPolicy?.zeroDenominator
      : null,
  ]);

export const createBusinessSqlSortId = (
  sort: Pick<BusinessSqlSort, "target" | "direction">,
): string => {
  const target = sort.target;
  const targetParts =
    target.kind === "measure"
      ? [target.kind, target.measureId]
      : target.kind === "derived_measure"
        ? [target.kind, target.derivedMeasureId]
        : [target.kind, target.entity, target.table, target.field];

  return stablePrimitiveId("business-sql-sort", [...targetParts, sort.direction]);
};

export const createBusinessSqlRowLimitId = (
  rowLimit: Pick<BusinessSqlRowLimit, "value">,
): string => stablePrimitiveId("business-sql-row-limit", [rowLimit.value]);

const exactStringIdentity = (value: string): string =>
  Array.from(value)
    .map((character) => character.codePointAt(0)?.toString(16).padStart(4, "0") || "")
    .join("");

const invalidSetMemberIdentity = (value: unknown): string => {
  if (value === null) return "null";
  if (Array.isArray(value)) return `array:${value.length}`;
  if (typeof value === "number") {
    if (Number.isNaN(value)) return "number:nan";
    if (!Number.isFinite(value)) return `number:${value > 0 ? "infinity" : "negative-infinity"}`;
    return `number:${value}`;
  }
  if (typeof value === "string") return `string:${exactStringIdentity(value)}`;
  if (typeof value === "boolean") return `boolean:${value}`;
  if (typeof value === "undefined") return "undefined";
  if (typeof value === "symbol") return "symbol";
  if (typeof value === "function") return "function";
  return `object:${Object.prototype.toString.call(value)}`;
};

const setComparisonIdentity = (
  comparisonValue: Extract<BusinessSqlFilterComparisonValue, { kind: "set" }>,
): string => {
  const valueKind = comparisonValue.valueKind;
  const rawValues = comparisonValue.values as readonly unknown[];
  if (
    (valueKind !== "number" && valueKind !== "string" && valueKind !== "boolean") ||
    !Array.isArray(rawValues) ||
    rawValues.length === 0
  ) {
    return [
      "invalid-set",
      String(valueKind),
      Array.isArray(rawValues) ? rawValues.length : "non-array",
    ].join("|");
  }

  const invalidMembers: string[] = [];
  const validMembers: string[] = [];
  for (const value of rawValues) {
    if (valueKind === "number") {
      if (typeof value === "number" && Number.isFinite(value)) {
        validMembers.push(String(value));
      } else {
        invalidMembers.push(invalidSetMemberIdentity(value));
      }
    } else if (valueKind === "string") {
      if (typeof value === "string" && value.trim().length > 0 && !/[\u0000-\u001f\u007f]/.test(value)) {
        validMembers.push(exactStringIdentity(value));
      } else {
        invalidMembers.push(invalidSetMemberIdentity(value));
      }
    } else if (typeof value === "boolean") {
      validMembers.push(String(value));
    } else {
      invalidMembers.push(invalidSetMemberIdentity(value));
    }
  }

  if (invalidMembers.length > 0 || validMembers.length === 0) {
    return [
      "invalid-set",
      valueKind,
      ...Array.from(new Set(validMembers)).sort(),
      ...invalidMembers.sort(),
    ].join("|");
  }

  const normalizedMembers =
    valueKind === "number"
      ? Array.from(new Set(validMembers.map(Number))).sort((left, right) => left - right).map(String)
      : valueKind === "boolean"
      ? Array.from(new Set(validMembers)).sort((left, right) => Number(left === "true") - Number(right === "true"))
      : Array.from(new Set(validMembers)).sort();

  return ["valid-set", valueKind, ...normalizedMembers].join("|");
};

const rangeEndpointIdentity = (value: unknown): string => {
  if (value === null) return "null";
  if (Array.isArray(value)) return `array:${value.length}`;
  if (typeof value === "number") {
    if (Number.isNaN(value)) return "number:nan";
    if (!Number.isFinite(value)) return `number:${value > 0 ? "infinity" : "negative-infinity"}`;
    return `number:${Object.is(value, -0) ? 0 : value}`;
  }
  if (typeof value === "string") return `string:${exactStringIdentity(value)}`;
  if (typeof value === "boolean") return `boolean:${value}`;
  if (typeof value === "undefined") return "undefined";
  if (typeof value === "symbol") return "symbol";
  if (typeof value === "function") return "function";
  return `object:${Object.prototype.toString.call(value)}`;
};

const rangeComparisonIdentity = (
  comparisonValue: Extract<BusinessSqlFilterComparisonValue, { kind: "range" }>,
): string => {
  const lower = comparisonValue.lower as unknown;
  const upper = comparisonValue.upper as unknown;
  const valid =
    comparisonValue.valueKind === "number" &&
    comparisonValue.lowerInclusive === true &&
    comparisonValue.upperInclusive === true &&
    typeof lower === "number" &&
    typeof upper === "number" &&
    Number.isFinite(lower) &&
    Number.isFinite(upper) &&
    lower <= upper;
  return valid
    ? [
        "valid-range",
        comparisonValue.valueKind,
        rangeEndpointIdentity(lower),
        rangeEndpointIdentity(upper),
        "inclusive",
        "inclusive",
      ].join("|")
    : [
        "invalid-range",
        String(comparisonValue.valueKind),
        rangeEndpointIdentity(lower),
        rangeEndpointIdentity(upper),
        comparisonValue.lowerInclusive === true ? "lower-inclusive" : "lower-not-inclusive",
        comparisonValue.upperInclusive === true ? "upper-inclusive" : "upper-not-inclusive",
      ].join("|");
};

export const isCanonicalBusinessSqlDateValue = (value: unknown): value is string => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 12) return false;
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysByMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day >= 1 && day <= daysByMonth[month - 1];
};

const dateComparisonIdentity = (
  comparisonValue: Extract<BusinessSqlFilterComparisonValue, { kind: "date" }>,
): string => {
  const value = comparisonValue.value as unknown;
  return comparisonValue.valueKind === "date" && isCanonicalBusinessSqlDateValue(value)
    ? ["valid-date", comparisonValue.valueKind, value].join("|")
    : [
        "invalid-date",
        String(comparisonValue.valueKind),
        rangeEndpointIdentity(value),
      ].join("|");
};

export const createBusinessSqlFilterId = (
  filter: Pick<BusinessSqlFilter, "target" | "entity" | "table" | "field" | "operator" | "comparisonValue">,
): string => {
  const target = filter.target?.kind === "field"
    ? filter.target
    : {
        kind: "field" as const,
        entity: filter.entity,
        table: filter.table,
        field: filter.field,
      };
  const comparisonValue = filter.comparisonValue;
  const comparisonIdentity =
    comparisonValue?.kind === "set"
      ? setComparisonIdentity(comparisonValue)
      : comparisonValue?.kind === "range"
      ? rangeComparisonIdentity(comparisonValue)
      : comparisonValue?.kind === "date"
      ? dateComparisonIdentity(comparisonValue)
      : comparisonValue?.kind === "number" ||
        comparisonValue?.kind === "string" ||
        comparisonValue?.kind === "boolean"
      ? String(comparisonValue.value)
      : null;
  return stablePrimitiveId("business-sql-filter", [
    target.kind,
    target.entity,
    target.table,
    target.field,
    filter.operator,
    comparisonValue?.kind,
    comparisonIdentity,
  ]);
};

export const createBusinessSqlAggregateResultConditionId = (
  condition: Pick<
    BusinessSqlAggregateResultCondition,
    "operator" | "comparisonValue" | "target" | "measureId"
  >,
): string =>
  stablePrimitiveId("business-sql-aggregate-condition", [
    ...businessSqlAggregateResultConditionTargetIdentity(condition),
    condition.operator,
    condition.comparisonValue.kind,
    condition.comparisonValue.value,
  ]);

export const getBusinessSqlAggregateResultConditionTarget = (
  condition: {
    target?: {
      kind?: string;
      measureId?: string;
      derivedMeasureId?: string;
    } | null;
    measureId?: string;
  },
): BusinessSqlAggregateResultConditionTarget | null => {
  if (condition.target?.kind === "measure" && condition.target.measureId) {
    return { kind: "measure", measureId: condition.target.measureId };
  }
  if (condition.target?.kind === "derived_measure" && condition.target.derivedMeasureId) {
    return { kind: "derived_measure", derivedMeasureId: condition.target.derivedMeasureId };
  }
  if (condition.measureId) {
    return { kind: "measure", measureId: condition.measureId };
  }
  return null;
};

export const businessSqlAggregateResultConditionTargetIdentity = (
  condition: {
    target?: {
      kind?: string;
      measureId?: string;
      derivedMeasureId?: string;
    } | null;
    measureId?: string;
  },
): string[] => {
  const target = getBusinessSqlAggregateResultConditionTarget(condition);
  if (!target) return ["invalid"];
  return target.kind === "derived_measure"
    ? [target.kind, target.derivedMeasureId]
    : [target.kind, target.measureId];
};

const slugifySqlAlias = (value: string): string => {
  const alias = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  return alias || "measure";
};

export const createBusinessSqlMeasureAlias = (label: string): string =>
  slugifySqlAlias(label);

export const assignBusinessSqlMeasureAliases = (
  measures: readonly BusinessSqlMeasure[],
): BusinessSqlMeasure[] => {
  const aliasCounts = new Map<string, number>();

  return measures.map((measure) => {
    const baseAlias = createBusinessSqlMeasureAlias(measure.label);
    const nextCount = (aliasCounts.get(baseAlias) || 0) + 1;
    aliasCounts.set(baseAlias, nextCount);

    return {
      ...measure,
      sqlAlias: nextCount === 1 ? baseAlias : `${baseAlias}_${nextCount}`,
    };
  });
};

export const metricToBusinessSqlMeasure = (
  metric: BusinessSqlMetric,
): BusinessSqlMeasure => {
  const measure = {
    measureId: createBusinessSqlMeasureId(metric),
    kind: metric.kind,
    entity: metric.entity,
    table: metric.table,
    field: metric.field,
    distinct: metric.distinct,
    label: metric.label,
    sqlAlias: createBusinessSqlMeasureAlias(metric.label),
  };

  return measure;
};

export const measureToBusinessSqlMetric = (
  measure: BusinessSqlMeasure,
): BusinessSqlMetric | null => {
  if (
    measure.kind !== "count_rows" &&
    measure.kind !== "count_entities" &&
    measure.kind !== "count_distinct"
  ) {
    return null;
  }

  return {
    kind: measure.kind,
    entity: measure.entity,
    table: measure.table,
    field: measure.field,
    distinct: measure.distinct,
    label: measure.label,
  };
};

export const normalizeMetricAndMeasures = <
  T extends {
    metric?: BusinessSqlMetric | null;
    measures?: readonly BusinessSqlMeasure[];
  },
>(
  plan: T,
): Omit<T, "metric" | "measures"> & {
  metric: BusinessSqlMetric | null;
  measures: BusinessSqlMeasure[];
} => {
  const inputMeasures = plan.measures || [];
  const measures =
    inputMeasures.length > 0
      ? assignBusinessSqlMeasureAliases(
          inputMeasures.map((measure) => ({
            ...measure,
            measureId: measure.measureId || createBusinessSqlMeasureId(measure),
            sqlAlias: measure.sqlAlias || createBusinessSqlMeasureAlias(measure.label),
          })),
        )
      : plan.metric
        ? [metricToBusinessSqlMeasure(plan.metric)]
        : [];
  const metric = plan.metric || (measures[0] ? measureToBusinessSqlMetric(measures[0]) : null);

  return {
    ...plan,
    metric,
    measures,
  };
};

export const createEmptyBusinessSqlQueryPlan = (): BusinessSqlQueryPlan => ({
  id: "business-sql-plan:empty",
  kind: "empty",
  status: "draft",
  support: "needs_review",
  entities: [],
  metric: null,
  measures: [],
  derivedMeasures: [],
  groupings: [],
  filters: [],
  orderBy: [],
  rowLimit: null,
  aggregateResultConditions: [],
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
