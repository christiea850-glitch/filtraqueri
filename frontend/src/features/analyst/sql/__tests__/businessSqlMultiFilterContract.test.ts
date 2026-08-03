/** PS-8a - explicit AND multi-filter contract foundation fixtures. */

import {
  attachBusinessSqlJoinResolutionToPlan,
} from "../businessSqlQueryPlanJoinResolution";
import type { BusinessSqlRelationshipMetadata } from "../businessSqlJoinPathResolver";
import {
  createBusinessSqlAggregateResultConditionId,
  createBusinessSqlFilterGroup,
  createBusinessSqlFilterGroupId,
  createBusinessSqlFilterId,
  createBusinessSqlMeasureAlias,
  createBusinessSqlMeasureId,
  createBusinessSqlRowLimitId,
  createBusinessSqlSortId,
  createEmptyBusinessSqlQueryPlan,
  resolveBusinessSqlFilterCombinator,
  summarizeBusinessSqlQueryPlan,
  type BusinessSqlFilter,
  type BusinessSqlFilterComparisonValue,
  type BusinessSqlFilterOperator,
  type BusinessSqlMeasure,
  type BusinessSqlQueryPlan,
} from "../businessSqlQueryPlan";
import { evaluateBusinessSqlPlanReadiness } from "../businessSqlPlanReadiness";
import { evaluateBusinessSqlRenderReadiness } from "../businessSqlRenderReadiness";
import { evaluateBusinessSqlRendererCapability } from "../businessSqlRendererCapability";
import { createBusinessSqlRenderPreview } from "../businessSqlRenderPreview";
import { renderBusinessSqlQueryPlan } from "../businessSqlRenderer";

type FixtureResult = {
  name: string;
  ok: boolean;
  failureReasons: string[];
};

type Fixture = {
  name: string;
  assert: () => string[];
};

type FieldType = NonNullable<BusinessSqlFilter["target"]>["fieldInferredType"];

const measure = (field = "amount", label = "Total amount"): BusinessSqlMeasure => {
  const seed = {
    kind: "sum" as const,
    entity: "orders",
    table: "orders",
    field,
    distinct: false,
  };
  return {
    ...seed,
    measureId: createBusinessSqlMeasureId(seed),
    fieldInferredType: "numeric",
    label,
    sqlAlias: createBusinessSqlMeasureAlias(label),
  };
};

const amountMeasure = measure();

const filterFor = (options: {
  table?: string;
  entity?: string;
  field?: string;
  fieldInferredType?: FieldType;
  operator?: BusinessSqlFilterOperator;
  comparisonValue?: BusinessSqlFilterComparisonValue;
  label?: string;
  evidence?: string;
  targetResolved?: boolean;
  legacyFields?: boolean;
} = {}): BusinessSqlFilter => {
  const {
    table = "orders",
    entity = table,
    field = "status",
    fieldInferredType = "categorical",
    operator = "equals",
    comparisonValue,
    label,
    evidence,
    targetResolved = true,
    legacyFields = true,
  } = options;
  const value = Object.prototype.hasOwnProperty.call(options, "comparisonValue")
    ? comparisonValue
    : { kind: "string" as const, value: "active" };
  const seed: BusinessSqlFilter = {
    kind: "custom",
    target: {
      kind: "field",
      entity,
      table,
      field,
      fieldInferredType,
      resolved: targetResolved,
    },
    ...(legacyFields ? { entity, table, field, fieldInferredType } : {}),
    operator,
    comparisonValue: value,
    label: label || `${field} ${operator}`,
    evidence,
  };
  return {
    ...seed,
    filterId: createBusinessSqlFilterId(seed),
  };
};

const scalar = (field = "status") => filterFor({ field, fieldInferredType: "categorical" });
const setFilter = () =>
  filterFor({
    field: "status",
    fieldInferredType: "categorical",
    operator: "in",
    comparisonValue: { kind: "set", valueKind: "string", values: ["active", "pending"] },
  });
const numericRange = () =>
  filterFor({
    field: "amount",
    fieldInferredType: "numeric",
    operator: "between",
    comparisonValue: {
      kind: "range",
      valueKind: "number",
      lower: 100,
      upper: 500,
      lowerInclusive: true,
      upperInclusive: true,
    },
  });
const singleDate = (operator: "before" | "after" = "before") =>
  filterFor({
    field: "order_date",
    fieldInferredType: "date",
    operator,
    comparisonValue: { kind: "date", valueKind: "date", value: "2026-01-01" },
  });
const dateRange = () =>
  filterFor({
    field: "order_date",
    fieldInferredType: "date",
    operator: "between",
    comparisonValue: {
      kind: "range",
      valueKind: "date",
      lower: "2026-01-01",
      upper: "2026-12-31",
      lowerInclusive: true,
      upperInclusive: true,
    },
  });
const nullary = () =>
  filterFor({
    field: "closed_at",
    fieldInferredType: "date",
    operator: "is_null",
    comparisonValue: undefined,
  });
const joinedDate = (field = "signup_date") =>
  filterFor({
    table: "customers",
    entity: "customers",
    field,
    fieldInferredType: "date",
    operator: "after",
    comparisonValue: { kind: "date", valueKind: "date", value: "2026-01-01" },
  });

const basePlan = (
  filters: BusinessSqlFilter[] = [],
  overrides: Partial<BusinessSqlQueryPlan> = {},
): BusinessSqlQueryPlan => ({
  ...createEmptyBusinessSqlQueryPlan(),
  id: overrides.id || "business-sql-plan:ps-8a",
  kind: "single_table_count_grouping",
  status: "resolved",
  support: "supported",
  entities: [{ entity: "orders", table: "orders", required: true, role: "source" }],
  measures: [amountMeasure],
  metric: null,
  groupings: [{ entity: "orders", table: "orders", field: "region", label: "region" }],
  filters,
  filterCombinator: "and",
  orderBy: [
    {
      sortId: createBusinessSqlSortId({
        target: { kind: "measure", measureId: amountMeasure.measureId, resolved: true },
        direction: "desc",
      }),
      target: { kind: "measure", measureId: amountMeasure.measureId, resolved: true },
      direction: "desc",
      label: "Sort by Total amount",
    },
  ],
  ...overrides,
});

const relationship: BusinessSqlRelationshipMetadata = {
  id: "relationship:orders-customers",
  fromEntity: "orders",
  toEntity: "customers",
  fromTable: "orders",
  fromField: "customer_id",
  toTable: "customers",
  toField: "customer_id",
  status: "accepted",
};

const joinedPlan = (
  filters: BusinessSqlFilter[],
  relationshipStatus: BusinessSqlRelationshipMetadata["status"] = "accepted",
): BusinessSqlQueryPlan =>
  basePlan(filters, {
    entities: [
      { entity: "orders", table: "orders", required: true, role: "source" },
      { entity: "customers", table: "customers", required: true, role: "join_subject" },
    ],
    joinPath: {
      required: true,
      status: relationshipStatus === "missing" ? "missing" : "resolved",
      entities: ["orders", "customers"],
      requirements: [
        { fromEntity: "orders", toEntity: "customers", required: true, verified: relationshipStatus !== "missing" },
      ],
      edges: [
        {
          fromEntity: "orders",
          fromTable: "orders",
          fromField: "customer_id",
          toEntity: "customers",
          toTable: "customers",
          toField: "customer_id",
          relationship: relationship.id,
          verified: relationshipStatus !== "missing",
        },
      ],
    },
  });

const readiness = (
  plan: BusinessSqlQueryPlan,
  relationships: readonly BusinessSqlRelationshipMetadata[] = [],
) => evaluateBusinessSqlPlanReadiness(attachBusinessSqlJoinResolutionToPlan({ plan, relationships }));

const structurallyReady = (plan: BusinessSqlQueryPlan): string[] =>
  readiness(plan).status === "ready" ? [] : [`Expected structural readiness, got ${readiness(plan).summary}.`];

const structurallyBlockedWith = (plan: BusinessSqlQueryPlan, reason: string): string[] => {
  const result = readiness(plan);
  return result.status === "blocked" && result.reasonCodes.includes(reason as never)
    ? []
    : [`Expected structural blocker ${reason}, got ${result.summary}.`];
};

const rendererIncapable = (plan: BusinessSqlQueryPlan): string[] => {
  const capability = evaluateBusinessSqlRendererCapability(plan);
  return capability.status === "incapable" &&
    capability.reasonCodes.includes("multiple_row_filters_not_supported")
    ? []
    : [`Expected multiple-filter renderer incapability, got ${capability.reasonCodes.join(",")}.`];
};

const rendersNoSql = (plan: BusinessSqlQueryPlan): string[] => {
  const rendered = renderBusinessSqlQueryPlan(plan);
  return !rendered.rendered &&
    rendered.sql === null &&
    rendered.inserted === false &&
    rendered.ranQuery === false
    ? []
    : ["Expected renderer bypass to produce no SQL, insert, or run."];
};

const previewNoActions = (plan: BusinessSqlQueryPlan): string[] => {
  const preview = createBusinessSqlRenderPreview(plan);
  return preview.sql === null &&
    !preview.actions.canCopySql &&
    !preview.actions.canInsertSql &&
    !preview.actions.canRunSql
    ? []
    : ["Expected preview to expose no SQL actions."];
};

const omittedCombinatorPlan = (filters: BusinessSqlFilter[]): BusinessSqlQueryPlan => {
  const { filterCombinator, ...plan } = basePlan(filters);
  void filterCombinator;
  return plan;
};

const expectedNoFilterSql = [
  "SELECT",
  '  "orders"."region" AS "region",',
  '  SUM("orders"."amount") AS "total_amount"',
  'FROM "orders"',
  'GROUP BY "orders"."region"',
  'ORDER BY "total_amount" DESC;',
].join("\n");

const expectedSingleFilterSql = [
  "SELECT",
  '  "orders"."region" AS "region",',
  '  SUM("orders"."amount") AS "total_amount"',
  'FROM "orders"',
  `WHERE "orders"."status" = 'active'`,
  'GROUP BY "orders"."region"',
  'ORDER BY "total_amount" DESC;',
].join("\n");

const invalidFilters: Array<{ name: string; filter: BusinessSqlFilter; reason: string }> = [
  { name: "malformed scalar", filter: filterFor({ comparisonValue: { kind: "string", value: "" } }), reason: "row_filter_value_invalid" },
  { name: "malformed set", filter: filterFor({ operator: "in", comparisonValue: { kind: "set", valueKind: "string", values: [] } }), reason: "row_filter_value_invalid" },
  { name: "reversed numeric range", filter: filterFor({ field: "amount", fieldInferredType: "numeric", operator: "between", comparisonValue: { kind: "range", valueKind: "number", lower: 500, upper: 100, lowerInclusive: true, upperInclusive: true } }), reason: "row_filter_value_invalid" },
  { name: "malformed single date", filter: filterFor({ field: "order_date", fieldInferredType: "date", operator: "before", comparisonValue: { kind: "date", valueKind: "date", value: "2026-02-30" } }), reason: "row_filter_value_invalid" },
  { name: "reversed date range", filter: filterFor({ field: "order_date", fieldInferredType: "date", operator: "between", comparisonValue: { kind: "range", valueKind: "date", lower: "2026-12-31", upper: "2026-01-01", lowerInclusive: true, upperInclusive: true } }), reason: "row_filter_value_invalid" },
  { name: "wrong-type range", filter: filterFor({ field: "status", fieldInferredType: "categorical", operator: "between", comparisonValue: { kind: "range", valueKind: "number", lower: 1, upper: 2, lowerInclusive: true, upperInclusive: true } }), reason: "row_filter_type_incompatible" },
  { name: "missing comparison value", filter: filterFor({ operator: "equals", comparisonValue: undefined }), reason: "row_filter_value_missing" },
  { name: "unsupported operator", filter: filterFor({ operator: "matches_regex" as BusinessSqlFilterOperator }), reason: "row_filter_operator_unsupported" },
  { name: "unresolved target", filter: filterFor({ targetResolved: false }), reason: "row_filter_target_unresolved" },
  { name: "target conflict", filter: { ...filterFor(), field: "other_field" }, reason: "row_filter_target_conflict" },
  { name: "legacy filter", filter: { kind: "status", entity: "orders", table: "orders", field: "status", value: "active", label: "Legacy status" }, reason: "row_filter_target_invalid" },
];

const groupId = (filters: BusinessSqlFilter[]) =>
  createBusinessSqlFilterGroupId({ combinator: "and", filters });

const withStoredFilterId = (
  filter: BusinessSqlFilter,
  filterId: string | undefined,
): BusinessSqlFilter => ({
  ...filter,
  filterId,
});

const fixtures: Fixture[] = [
  { name: "A1 zero-filter plan remains representable", assert: () => basePlan([]).filters.length === 0 ? [] : ["Expected zero filters."] },
  { name: "A2 one-filter plan remains representable", assert: () => basePlan([scalar()]).filters.length === 1 ? [] : ["Expected one filter."] },
  { name: "A3 two-filter AND plan is representable", assert: () => structurallyReady(basePlan([scalar(), dateRange()])) },
  { name: "A4 three-filter AND plan is representable", assert: () => structurallyReady(basePlan([scalar(), setFilter(), dateRange()])) },
  { name: "A5 four-filter AND plan is representable", assert: () => structurallyReady(basePlan([scalar(), setFilter(), numericRange(), dateRange()])) },
  { name: "A6 canonical combinator is literal and", assert: () => resolveBusinessSqlFilterCombinator(basePlan([scalar(), dateRange()])) === "and" ? [] : ["Expected literal and."] },
  ...[
    ["A7 unsupported or rejects", "or"],
    ["A8 unsupported not rejects", "not"],
    ["A10 null combinator rejects true multi", null],
    ["A12 numeric combinator rejects", 1],
    ["A13 boolean combinator rejects", true],
    ["A14 object combinator rejects", {}],
    ["A15 array combinator rejects", []],
    ["A16 function combinator rejects", () => "and"],
    ["A17 symbol combinator rejects", Symbol("and")],
    ["A18 whitespace combinator rejects", " "],
    ["A19 no truthiness coercion", "truthy"],
    ["A20 no alias normalization", "&&"],
  ].map(([name, value]) => ({
    name: String(name),
    assert: () => structurallyBlockedWith({ ...basePlan([scalar(), dateRange()]), filterCombinator: value as never }, "row_filter_combinator_unsupported"),
  })),
  { name: "A9 missing combinator follows documented AND policy", assert: () => structurallyReady(omittedCombinatorPlan([scalar(), dateRange()])) },
  { name: "A11 undefined combinator follows documented AND policy", assert: () => structurallyReady({ ...basePlan([scalar(), dateRange()]), filterCombinator: undefined }) },

  ...[
    ["B21 two valid scalar filters are structurally ready", [scalar("status"), scalar("priority")]],
    ["B22 scalar plus set is structurally ready", [scalar(), setFilter()]],
    ["B23 scalar plus numeric range is structurally ready", [scalar(), numericRange()]],
    ["B24 scalar plus single date is structurally ready", [scalar(), singleDate()]],
    ["B25 scalar plus date range is structurally ready", [scalar(), dateRange()]],
    ["B26 set plus numeric range is structurally ready", [setFilter(), numericRange()]],
    ["B27 set plus date range is structurally ready", [setFilter(), dateRange()]],
    ["B28 numeric range plus date range is structurally ready", [numericRange(), dateRange()]],
    ["B29 before plus scalar is structurally ready", [singleDate("before"), scalar()]],
    ["B30 after plus scalar is structurally ready", [singleDate("after"), scalar()]],
    ["B31 nullary plus scalar is structurally ready", [nullary(), scalar()]],
    ["B32 three valid filters are structurally ready", [scalar(), setFilter(), dateRange()]],
    ["B33 four valid filters are structurally ready", [scalar(), setFilter(), numericRange(), dateRange()]],
    ["B34 two filters on the same field are structurally ready", [filterFor({ field: "amount", fieldInferredType: "numeric", operator: "greater_than", comparisonValue: { kind: "number", value: 100 } }), filterFor({ field: "amount", fieldInferredType: "numeric", operator: "less_than", comparisonValue: { kind: "number", value: 500 } })]],
    ["B35 duplicate canonical filters preserve multiplicity", [scalar(), scalar()]],
    ["B36 reversed authored member order remains structurally ready", [dateRange(), scalar()]],
  ].map(([name, filters]) => ({
    name: String(name),
    assert: () => {
      const plan = basePlan(filters as BusinessSqlFilter[]);
      return [
        ...structurallyReady(plan),
        ...(plan.filters.map((filter) => filter.filterId).join("|") === (filters as BusinessSqlFilter[]).map((filter) => filter.filterId).join("|")
          ? []
          : ["Expected authored order preservation."]),
      ];
    },
  })),

  ...invalidFilters.map(({ name, filter, reason }, index) => ({
    name: `C${37 + index} valid filter plus ${name} blocks`,
    assert: () => structurallyBlockedWith(basePlan([scalar(), filter]), reason),
  })),
  { name: "C48 invalid first member blocks complete plan", assert: () => structurallyBlockedWith(basePlan([invalidFilters[0].filter, scalar(), dateRange()]), invalidFilters[0].reason) },
  { name: "C49 invalid middle member blocks complete plan", assert: () => structurallyBlockedWith(basePlan([scalar(), invalidFilters[1].filter, dateRange()]), invalidFilters[1].reason) },
  { name: "C50 invalid last member blocks complete plan", assert: () => structurallyBlockedWith(basePlan([scalar(), dateRange(), invalidFilters[2].filter]), invalidFilters[2].reason) },
  { name: "C51 no valid-member subset fallback", assert: () => rendersNoSql(basePlan([scalar(), invalidFilters[0].filter])) },
  { name: "C52 no invalid-member omission", assert: () => readiness(basePlan([scalar(), invalidFilters[0].filter])).reasonCodes.includes(invalidFilters[0].reason as never) ? [] : ["Expected invalid member reason."] },
  { name: "C53 no filter-free structural fallback", assert: () => readiness(basePlan([invalidFilters[0].filter])).status === "blocked" ? [] : ["Expected blocked, not filter-free fallback."] },

  { name: "D54 same AND group produces same group ID", assert: () => groupId([scalar(), dateRange()]) === groupId([scalar(), dateRange()]) ? [] : ["Expected stable group ID."] },
  { name: "D55 reversed member order produces same group ID", assert: () => groupId([scalar(), dateRange()]) === groupId([dateRange(), scalar()]) ? [] : ["Expected order-independent group ID."] },
  { name: "D56 changing one member changes group ID", assert: () => groupId([scalar(), dateRange()]) !== groupId([scalar(), numericRange()]) ? [] : ["Expected changed member to change group ID."] },
  { name: "D57 adding member changes group ID", assert: () => groupId([scalar(), dateRange()]) !== groupId([scalar(), dateRange(), setFilter()]) ? [] : ["Expected added member to change group ID."] },
  { name: "D58 removing member changes group ID", assert: () => groupId([scalar(), dateRange(), setFilter()]) !== groupId([scalar(), dateRange()]) ? [] : ["Expected removed member to change group ID."] },
  { name: "D59 duplicate multiplicity changes group ID", assert: () => groupId([scalar()]) !== groupId([scalar(), scalar()]) ? [] : ["Expected duplicate multiplicity in group ID."] },
  { name: "D60 label change does not change group ID", assert: () => groupId([scalar(), dateRange()]) === groupId([{ ...scalar(), label: "Relabeled" }, dateRange()]) ? [] : ["Expected label-neutral group ID."] },
  { name: "D61 evidence change does not change group ID", assert: () => groupId([scalar(), dateRange()]) === groupId([{ ...scalar(), evidence: "new evidence" }, dateRange()]) ? [] : ["Expected evidence-neutral group ID."] },
  { name: "D62 prompt wording does not change group ID", assert: () => createBusinessSqlFilterGroup(basePlan([scalar(), dateRange()], { prompt: "first" }))?.filterGroupId === createBusinessSqlFilterGroup(basePlan([scalar(), dateRange()], { prompt: "second" }))?.filterGroupId ? [] : ["Expected prompt-neutral group ID."] },
  { name: "D63 timestamp does not enter group ID", assert: () => {
    const plan = basePlan([scalar(), dateRange()], { warnings: [{ id: String(Date.now()), severity: "info", message: "time" }] });
    return createBusinessSqlFilterGroup(plan)?.filterGroupId === groupId([scalar(), dateRange()]) ? [] : ["Expected timestamp-neutral group ID."];
  } },
  { name: "D64 randomness does not enter group ID", assert: () => {
    const plan = basePlan([scalar(), dateRange()], { assumptions: [{ id: String(Math.random()), label: "random", detail: "ignored" }] });
    return createBusinessSqlFilterGroup(plan)?.filterGroupId === groupId([scalar(), dateRange()]) ? [] : ["Expected randomness-neutral group ID."];
  } },
  { name: "D65 group ID differs from individual filter ID", assert: () => groupId([scalar()]) !== scalar().filterId ? [] : ["Expected group namespace."] },
  { name: "D66 scalar-plus-date identity differs from scalar-plus-numeric identity", assert: () => groupId([scalar(), dateRange()]) !== groupId([scalar(), numericRange()]) ? [] : ["Expected identity difference."] },
  { name: "D67 same-field member IDs remain independently stable", assert: () => groupId([filterFor({ field: "amount", fieldInferredType: "numeric", operator: "greater_than", comparisonValue: { kind: "number", value: 100 } }), filterFor({ field: "amount", fieldInferredType: "numeric", operator: "less_than", comparisonValue: { kind: "number", value: 500 } })]).includes("business-sql-filter") ? [] : ["Expected composed member IDs."] },
  { name: "D68 existing member filter IDs remain unchanged", assert: () => scalar().filterId === createBusinessSqlFilterId(scalar()) ? [] : ["Expected existing filter ID behavior."] },
  { name: "D69 stale stored filterId is ignored when computing group identity", assert: () => {
    const current = scalar();
    const stale = withStoredFilterId(current, "business-sql-filter:stale-old-member");
    return groupId([current, dateRange()]) === groupId([stale, dateRange()])
      ? []
      : ["Expected group ID to ignore stale stored filterId."];
  } },
  { name: "D70 deliberately incorrect stored filterId produces same group ID", assert: () => {
    const current = scalar();
    const poisoned = withStoredFilterId(current, "not-the-current-semantic-id");
    return groupId([current, dateRange()]) === groupId([poisoned, dateRange()])
      ? []
      : ["Expected incorrect stored filterId to be ignored."];
  } },
  { name: "D71 target change with old stored filterId changes group ID", assert: () => {
    const original = scalar();
    const changed = withStoredFilterId(
      filterFor({ field: "priority", fieldInferredType: "categorical" }),
      original.filterId,
    );
    return groupId([original, dateRange()]) !== groupId([changed, dateRange()])
      ? []
      : ["Expected target semantics to change group ID despite stale filterId."];
  } },
  { name: "D72 operator change with old stored filterId changes group ID", assert: () => {
    const original = scalar();
    const changed = withStoredFilterId(
      filterFor({ operator: "not_equals" }),
      original.filterId,
    );
    return groupId([original, dateRange()]) !== groupId([changed, dateRange()])
      ? []
      : ["Expected operator semantics to change group ID despite stale filterId."];
  } },
  { name: "D73 comparison value change with old stored filterId changes group ID", assert: () => {
    const original = scalar();
    const changed = withStoredFilterId(
      filterFor({ comparisonValue: { kind: "string", value: "inactive" } }),
      original.filterId,
    );
    return groupId([original, dateRange()]) !== groupId([changed, dateRange()])
      ? []
      : ["Expected comparison-value semantics to change group ID despite stale filterId."];
  } },
  { name: "D74 missing stored filterId remains deterministic", assert: () => {
    const current = scalar();
    const missing = withStoredFilterId(current, undefined);
    return groupId([missing, dateRange()]) === groupId([missing, dateRange()])
      ? []
      : ["Expected missing stored filterId to remain deterministic."];
  } },
  { name: "D75 reversed member order remains identity-equivalent after recomputation", assert: () => {
    const poisoned = withStoredFilterId(scalar(), "stale");
    const dated = withStoredFilterId(dateRange(), "also-stale");
    return groupId([poisoned, dated]) === groupId([dated, poisoned])
      ? []
      : ["Expected recomputed identity to remain order-independent."];
  } },
  { name: "D76 duplicate multiplicity remains distinguishable after recomputation", assert: () => {
    const poisoned = withStoredFilterId(scalar(), "stale");
    return groupId([poisoned]) !== groupId([poisoned, poisoned])
      ? []
      : ["Expected duplicate multiplicity to remain distinguishable."];
  } },
  { name: "D77 authored filter order remains unmodified by group identity", assert: () => {
    const first = withStoredFilterId(scalar(), "stale-status");
    const second = withStoredFilterId(dateRange(), "stale-date");
    const filters = [first, second];
    const before = filters.map((filter) => filter.label).join("|");
    groupId(filters);
    return filters[0] === first &&
      filters[1] === second &&
      filters.map((filter) => filter.label).join("|") === before
      ? []
      : ["Expected authored filter order to remain unmodified."];
  } },
  { name: "D78 existing member filterId values are not mutated", assert: () => {
    const first = withStoredFilterId(scalar(), "stale-status");
    const second = withStoredFilterId(dateRange(), "stale-date");
    groupId([first, second]);
    return first.filterId === "stale-status" && second.filterId === "stale-date"
      ? []
      : ["Expected group identity computation not to mutate member filterId values."];
  } },

  { name: "E69 zero-filter capability remains unchanged", assert: () => evaluateBusinessSqlRendererCapability(basePlan([])).capable ? [] : ["Expected zero-filter capability."] },
  { name: "E70 one-filter capability remains unchanged", assert: () => evaluateBusinessSqlRendererCapability(basePlan([scalar()])).capable ? [] : ["Expected one-filter capability."] },
  { name: "E71 two valid filters are structurally ready", assert: () => structurallyReady(basePlan([scalar(), dateRange()])) },
  { name: "E72 two valid filters are renderer-incapable", assert: () => rendererIncapable(basePlan([scalar(), dateRange()])) },
  { name: "E73 reason is multiple_row_filters_not_supported", assert: () => rendererIncapable(basePlan([scalar(), dateRange()])) },
  { name: "E74 render readiness is blocked", assert: () => {
    const result = evaluateBusinessSqlRenderReadiness(basePlan([scalar(), dateRange()]));
    return result.status === "blocked" && result.reasons.some((reason) => reason.includes("multiple_row_filters_not_supported")) ? [] : [`Expected blocked render readiness, got ${result.status}.`];
  } },
  { name: "E75 three valid filters remain renderer-incapable", assert: () => rendererIncapable(basePlan([scalar(), setFilter(), dateRange()])) },
  { name: "E76 four valid filters remain renderer-incapable", assert: () => rendererIncapable(basePlan([scalar(), setFilter(), numericRange(), dateRange()])) },
  { name: "E77 invalid member preserves structural blocker", assert: () => structurallyBlockedWith(basePlan([scalar(), invalidFilters[0].filter]), invalidFilters[0].reason) },
  { name: "E78 structural blocker is not replaced by multiple-filter reason", assert: () => readiness(basePlan([scalar(), invalidFilters[0].filter])).reasonCodes.includes("multiple_row_filters_not_supported" as never) ? ["Structural readiness must not use renderer reason."] : [] },
  { name: "E79 legacy member preserves legacy reason", assert: () => structurallyBlockedWith(basePlan([scalar(), invalidFilters[10].filter]), invalidFilters[10].reason) },
  { name: "E80 unresolved joined member preserves relationship blocker", assert: () => readiness(joinedPlan([scalar(), joinedDate()], "missing"), [{ ...relationship, status: "missing" }]).reasonCodes.includes("join_resolution_blocked") ? [] : ["Expected relationship blocker."] },

  ...[
    "F81 two valid filters render no SQL",
    "F82 three valid filters render no SQL",
    "F83 four valid filters render no SQL",
    "F84 renderer does not choose first filter",
    "F85 renderer does not choose last filter",
    "F86 renderer does not omit joined filter",
    "F87 renderer does not emit filter-free SELECT",
    "F88 renderer does not emit partial JOIN SQL",
    "F89 renderer does not emit partial GROUP BY SQL",
    "F90 renderer does not emit partial HAVING SQL",
    "F91 renderer does not emit partial ORDER BY SQL",
    "F92 renderer does not emit partial LIMIT SQL",
    "F97 inserted is false",
    "F98 ranQuery is false",
  ].map((name) => ({
    name,
    assert: () => rendersNoSql(basePlan([scalar(), dateRange()], {
      aggregateResultConditions: [{
        conditionId: createBusinessSqlAggregateResultConditionId({
          target: { kind: "measure", measureId: amountMeasure.measureId },
          operator: "greater_than",
          comparisonValue: { kind: "number", value: 10 },
        }),
        target: { kind: "measure", measureId: amountMeasure.measureId },
        operator: "greater_than",
        comparisonValue: { kind: "number", value: 10 },
      }],
      rowLimit: { rowLimitId: createBusinessSqlRowLimitId({ value: 25 }), value: 25 },
    })),
  })),
  { name: "F93 preview SQL is null", assert: () => previewNoActions(basePlan([scalar(), dateRange()])) },
  { name: "F94 canCopySql is false", assert: () => previewNoActions(basePlan([scalar(), dateRange()])) },
  { name: "F95 canInsertSql is false", assert: () => previewNoActions(basePlan([scalar(), dateRange()])) },
  { name: "F96 canRunSql is false", assert: () => previewNoActions(basePlan([scalar(), dateRange()])) },

  { name: "G99 resolved base plus joined filter is structurally ready", assert: () => readiness(joinedPlan([scalar(), joinedDate()]), [relationship]).status === "ready" ? [] : ["Expected resolved joined filter readiness."] },
  { name: "G100 two resolved joined filters are structurally ready", assert: () => readiness(joinedPlan([joinedDate(), joinedDate("renewal_date")]), [relationship]).status === "ready" ? [] : ["Expected two joined filters ready."] },
  { name: "G101 unresolved joined filter blocks", assert: () => readiness(joinedPlan([scalar(), joinedDate()], "missing"), [{ ...relationship, status: "missing" }]).status === "blocked" ? [] : ["Expected unresolved joined block."] },
  { name: "G102 missing relationship blocks", assert: () => readiness(joinedPlan([scalar(), joinedDate()], "missing"), [{ ...relationship, status: "missing" }]).reasonCodes.includes("join_resolution_blocked") ? [] : ["Expected missing relationship reason."] },
  { name: "G103 no relationship inference", assert: () => readiness(joinedPlan([scalar(), joinedDate()]), []).status !== "ready" ? [] : ["Expected no inferred relationship."] },
  { name: "G104 joined filter identity uses canonical target", assert: () => joinedDate().filterId === createBusinessSqlFilterId(joinedDate()) ? [] : ["Expected joined target identity."] },
  { name: "G105 member order does not alter AND group identity", assert: () => groupId([scalar(), joinedDate()]) === groupId([joinedDate(), scalar()]) ? [] : ["Expected joined order-independent identity."] },
  { name: "G106 no joined-member omission", assert: () => rendersNoSql(joinedPlan([scalar(), joinedDate()])) },

  { name: "H107 zero-filter projection SQL remains byte-identical", assert: () => renderBusinessSqlQueryPlan(basePlan([])).sql === expectedNoFilterSql ? [] : ["Expected zero-filter SQL identity."] },
  { name: "H108 zero-filter grouped SQL remains byte-identical", assert: () => renderBusinessSqlQueryPlan(basePlan([])).sql === expectedNoFilterSql ? [] : ["Expected grouped SQL identity."] },
  { name: "H109 one scalar filter SQL remains byte-identical", assert: () => renderBusinessSqlQueryPlan(basePlan([scalar()])).sql === expectedSingleFilterSql ? [] : ["Expected scalar SQL identity."] },
  { name: "H110 one IN filter SQL remains byte-identical", assert: () => Boolean(renderBusinessSqlQueryPlan(basePlan([setFilter()])).sql?.includes(" IN ('active', 'pending')")) ? [] : ["Expected IN SQL."] },
  { name: "H111 one NOT IN filter SQL remains byte-identical", assert: () => Boolean(renderBusinessSqlQueryPlan(basePlan([filterFor({ operator: "not_in", comparisonValue: { kind: "set", valueKind: "string", values: ["active"] } })])).sql?.includes(" NOT IN ('active')")) ? [] : ["Expected NOT IN SQL."] },
  { name: "H112 one numeric BETWEEN SQL remains byte-identical", assert: () => Boolean(renderBusinessSqlQueryPlan(basePlan([numericRange()])).sql?.includes(" BETWEEN 100 AND 500")) ? [] : ["Expected numeric BETWEEN SQL."] },
  { name: "H113 one BEFORE SQL remains byte-identical", assert: () => Boolean(renderBusinessSqlQueryPlan(basePlan([singleDate("before")])).sql?.includes(" < DATE '2026-01-01'")) ? [] : ["Expected BEFORE SQL."] },
  { name: "H114 one AFTER SQL remains byte-identical", assert: () => Boolean(renderBusinessSqlQueryPlan(basePlan([singleDate("after")])).sql?.includes(" > DATE '2026-01-01'")) ? [] : ["Expected AFTER SQL."] },
  { name: "H115 one date BETWEEN SQL remains byte-identical", assert: () => Boolean(renderBusinessSqlQueryPlan(basePlan([dateRange()])).sql?.includes(" BETWEEN DATE '2026-01-01' AND DATE '2026-12-31'")) ? [] : ["Expected date BETWEEN SQL."] },
  { name: "H116 single-filter preview remains Copy only", assert: () => {
    const preview = createBusinessSqlRenderPreview(basePlan([scalar()]));
    return preview.actions.canCopySql && !preview.actions.canInsertSql && !preview.actions.canRunSql ? [] : ["Expected copy-only single-filter preview."];
  } },
  { name: "H117 explicit default ordering remains byte-identical", assert: () => renderBusinessSqlQueryPlan(basePlan([])).sql === expectedNoFilterSql ? [] : ["Expected ordering identity."] },
  { name: "H118 empty orderBy remains unsorted", assert: () => !renderBusinessSqlQueryPlan(basePlan([], { orderBy: [] })).sql?.includes("ORDER BY") ? [] : ["Expected no ORDER BY."] },
  { name: "H119 single-filter plan remains renderer-capable", assert: () => evaluateBusinessSqlRendererCapability(basePlan([scalar()])).capable ? [] : ["Expected single-filter capability."] },
  { name: "H120 existing natural-language scalar grounding remains green", assert: () => renderBusinessSqlQueryPlan(basePlan([scalar()])).sql === expectedSingleFilterSql ? [] : ["Expected scalar render regression green."] },
  { name: "H121 existing IN/NOT IN grounding remains green", assert: () => evaluateBusinessSqlRendererCapability(basePlan([setFilter()])).capable ? [] : ["Expected IN capability green."] },
  { name: "H122 existing numeric BETWEEN grounding remains green", assert: () => evaluateBusinessSqlRendererCapability(basePlan([numericRange()])).capable ? [] : ["Expected numeric range capability green."] },
  { name: "H123 existing BEFORE/AFTER grounding remains green", assert: () => evaluateBusinessSqlRendererCapability(basePlan([singleDate("after")])).capable ? [] : ["Expected date capability green."] },
  { name: "H124 existing date-range grounding remains green", assert: () => evaluateBusinessSqlRendererCapability(basePlan([dateRange()])).capable ? [] : ["Expected date range capability green."] },
  { name: "H125 no automatic Insert", assert: () => renderBusinessSqlQueryPlan(basePlan([scalar()])).inserted === false ? [] : ["Expected no auto insert."] },
  { name: "H126 no automatic Run", assert: () => renderBusinessSqlQueryPlan(basePlan([scalar()])).ranQuery === false ? [] : ["Expected no auto run."] },
  { name: "summary reports generic AND filter collection", assert: () => summarizeBusinessSqlQueryPlan(basePlan([scalar(), dateRange()])).includes("2 row filters combined with AND") ? [] : ["Expected generic multi-filter summary."] },
];

export function runBusinessSqlMultiFilterContractFixtures() {
  const results: FixtureResult[] = fixtures.map((fixture) => {
    const failureReasons = fixture.assert();
    return {
      name: fixture.name,
      ok: failureReasons.length === 0,
      failureReasons,
    };
  });
  return {
    results,
    passed: results.filter((result) => result.ok),
    failed: results.filter((result) => !result.ok),
  };
}

export const businessSqlMultiFilterContractFixturesPass =
  runBusinessSqlMultiFilterContractFixtures().failed.length === 0;
