/**
 * T-13H - guarded Business SQL renderer contract fixtures.
 *
 * Pure fixture runner only. No editor insertion, Run Query calls, backend/API
 * calls, provider calls, network calls, persistence, or query execution.
 */

import {
  evaluateBusinessSqlRenderability,
  type BusinessSqlRenderabilityGate,
} from "../businessSqlRenderabilityGate";
import type { SchemaColumn } from "../../../dataset/datasetTypes";
import { proposeAdaptiveReport } from "../adaptiveReportProposal";
import { createBusinessSqlPlanFromAdaptiveProposal } from "../adaptiveProposalBusinessSqlBridge";
import { detectBusinessIntent } from "../businessIntentGrounding";
import type { BusinessSqlRelationshipMetadata } from "../businessSqlJoinPathResolver";
import {
  attachBusinessSqlJoinResolutionToPlan,
  planBusinessSqlQueryRequestWithJoinResolution,
  type BusinessSqlQueryPlanJoinResolution,
} from "../businessSqlQueryPlanJoinResolution";
import {
  createBusinessSqlMeasureId,
  createBusinessSqlSortId,
  createBusinessSqlMeasureAlias,
  createBusinessSqlRowLimitId,
  createEmptyBusinessSqlQueryPlan,
  type BusinessSqlMeasure,
  type BusinessSqlMeasureKind,
  type BusinessSqlQueryPlan,
} from "../businessSqlQueryPlan";
import {
  renderBusinessSqlFromRenderability,
  type BusinessSqlRenderResult,
} from "../businessSqlRenderer";
import { evaluateBusinessSqlRendererCapability } from "../businessSqlRendererCapability";

type RendererFixture = {
  name: string;
  integrated: BusinessSqlQueryPlanJoinResolution;
  renderability?: BusinessSqlRenderabilityGate;
  assert: (
    result: BusinessSqlRenderResult,
    integrated: BusinessSqlQueryPlanJoinResolution,
  ) => string[];
};

type RendererFixtureResult = {
  name: string;
  ok: boolean;
  summary: string;
  renderResult: BusinessSqlRenderResult;
  failureReasons: string[];
};

export type RendererFixtureReport = {
  results: RendererFixtureResult[];
  passed: RendererFixtureResult[];
  failed: RendererFixtureResult[];
};

const relationship = (
  id: string,
  fromEntity: string,
  toEntity: string,
  status: BusinessSqlRelationshipMetadata["status"] = "accepted",
): BusinessSqlRelationshipMetadata => ({ id, fromEntity, toEntity, status });

const column = (
  name: string,
  inferred_type: SchemaColumn["inferred_type"],
): SchemaColumn => ({
  name,
  type: inferred_type === "numeric" ? "DOUBLE" : "VARCHAR",
  inferred_type,
  null_count: 0,
  unique_count: inferred_type === "categorical" ? 4 : 10,
  sample_values: [],
});

const employeeWorksheet = {
  worksheetId: "worksheet:employees",
  displayName: "Employees",
  sheetName: "Employees",
  tableName: "employees",
  schema: [
    column("employee_id", "text"),
    column("department", "categorical"),
    column("salary", "numeric"),
  ],
};

const departmentWorksheet = {
  worksheetId: "worksheet:departments",
  displayName: "Departments",
  sheetName: "Departments",
  tableName: "departments",
  schema: [
    column("department", "categorical"),
    column("cost", "numeric"),
  ],
};

const approvedQuestion = "Show the five departments with the highest total salary expenditure.";
const lowestTotalCostQuestion = "Show departments with the lowest total cost.";
const highestAverageSalaryQuestion = "Show departments with the highest average salary.";

const integratedFor = (
  prompt: string,
  relationships: readonly BusinessSqlRelationshipMetadata[] = [],
): BusinessSqlQueryPlanJoinResolution =>
  planBusinessSqlQueryRequestWithJoinResolution({ prompt, relationships });

const renderabilityFor = (
  integrated: BusinessSqlQueryPlanJoinResolution,
): BusinessSqlRenderabilityGate =>
  evaluateBusinessSqlRenderability({ integrated });

const renderInput = (
  integrated: BusinessSqlQueryPlanJoinResolution,
  renderability = renderabilityFor(integrated),
) => renderBusinessSqlFromRenderability({ integrated, renderability });

const leasesByStatus = integratedFor("Count leases by status");
const leasedUnitsPerProperty = integratedFor(
  "How many units in each property are leased to current tenants?",
  [
    relationship("relationship:properties-units", "properties", "units", "accepted"),
    relationship("relationship:units-leases", "units", "leases", "ready"),
  ],
);
const ordersPerCustomer = integratedFor("Count orders per customer", [
  relationship("relationship:customers-orders", "customers", "orders", "ready"),
]);
const ticketsPerAccount = integratedFor("Count tickets per account", [
  relationship("relationship:accounts-tickets", "accounts", "tickets", "verified"),
]);
const needsReviewPlan = integratedFor("Count orders per customer", [
  relationship("relationship:customers-orders", "customers", "orders", "unknown"),
]);
const blockedPlan = integratedFor("Count orders per customer", [
  relationship("relationship:customers-orders", "customers", "orders", "missing"),
]);
const unsupportedReadyPlan: BusinessSqlQueryPlanJoinResolution = {
  ...leasesByStatus,
  plan: {
    ...leasesByStatus.plan,
    id: "business-sql-plan:unsupported-render-shape",
    kind: "count_distinct_entity",
  },
};
const nonDuckDbPlan: BusinessSqlQueryPlanJoinResolution = {
  ...leasesByStatus,
  plan: {
    ...leasesByStatus.plan,
    renderer: {
      ...leasesByStatus.plan.renderer,
      targetDialect: "oracle",
    },
  },
};
const forgedUnresolvedJoinPlan: BusinessSqlQueryPlanJoinResolution = {
  ...needsReviewPlan,
  readiness: "ready",
  support: "supported",
};
const forgedRenderableGate: BusinessSqlRenderabilityGate = {
  ...renderabilityFor(needsReviewPlan),
  status: "renderable",
  renderable: true,
  readinessStatus: "ready",
  support: "supported",
  reasonCodes: [],
  blockingReasons: [],
  reviewReasons: [],
};
const deterministicFirst = renderInput(ordersPerCustomer);
const deterministicSecond = renderInput(ordersPerCustomer);

const integratedFromPlan = (plan: BusinessSqlQueryPlan): BusinessSqlQueryPlanJoinResolution => ({
  plan,
  joinResolution: {
    status: "ready",
    support: "supported",
    resolved: [],
    unresolved: [],
    blocked: [],
    relationshipIds: [],
    assumptions: [],
    warnings: [],
  },
  readiness: "ready",
  support: "supported",
  resolvedJoinPaths: [],
  unresolvedJoinRequirements: [],
  blockedJoinRequirements: [],
  warnings: [],
  assumptions: [],
  summary: `plan=${plan.id}; readiness=ready; join=ready; resolved=0; unresolved=0; blocked=0; relationships=none`,
});

const pipelineForQuestion = (
  prompt: string,
  worksheet: typeof employeeWorksheet | typeof departmentWorksheet,
) => {
  const detectedIntent = detectBusinessIntent(prompt);
  const proposal = proposeAdaptiveReport({
    prompt,
    detectedIntent,
    worksheets: [worksheet],
    appliedScopeSelections: [
      {
        worksheetId: worksheet.worksheetId,
        sourceType: "original",
        tableName: worksheet.tableName,
        originalTableName: worksheet.tableName,
      },
    ],
  });
  const bridgeResult = createBusinessSqlPlanFromAdaptiveProposal({
    proposal,
    acceptedRelationshipContracts: [],
    selectedGuidanceDialect: "duckdb",
  });
  const integrated = bridgeResult.plan
    ? attachBusinessSqlJoinResolutionToPlan({ plan: bridgeResult.plan, relationships: [] })
    : integratedFromPlan(createEmptyBusinessSqlQueryPlan());
  const renderability = renderabilityFor(integrated);
  const capability = evaluateBusinessSqlRendererCapability(integrated.plan);

  return {
    detectedIntent,
    proposal,
    bridgeResult,
    integrated,
    renderability,
    capability,
  };
};

const approvedPipeline = pipelineForQuestion(approvedQuestion, employeeWorksheet);
const lowestTotalCostPipeline = pipelineForQuestion(lowestTotalCostQuestion, departmentWorksheet);
const highestAverageSalaryPipeline = pipelineForQuestion(highestAverageSalaryQuestion, employeeWorksheet);

const aggregatePlan = (
  kind: Extract<BusinessSqlMeasureKind, "sum" | "average" | "minimum" | "maximum">,
  overrides: Partial<BusinessSqlQueryPlan> = {},
): BusinessSqlQueryPlan => {
  const label =
    kind === "sum"
      ? "Total salary expenditure"
      : kind === "average"
        ? "Average salary"
        : kind === "minimum"
          ? "Minimum salary"
          : "Maximum salary";
  const measureSeed = {
    kind,
    entity: "employees",
    table: "employees",
    field: "salary",
    distinct: false,
  };
  const measure: BusinessSqlMeasure = {
    ...measureSeed,
    measureId: createBusinessSqlMeasureId(measureSeed),
    fieldInferredType: "numeric",
    label,
    sqlAlias: createBusinessSqlMeasureAlias(label),
  };
  const sortTarget = { kind: "measure" as const, measureId: measure.measureId, resolved: true };
  const rowLimit = { value: 5 };

  return {
    ...createEmptyBusinessSqlQueryPlan(),
    id: `business-sql-plan:${kind}:salary-by-department`,
    kind: "single_table_count_grouping",
    status: "resolved",
    support: "supported",
    prompt: "Show the five departments with the highest total salary expenditure.",
    entities: [
      { entity: "employees", table: "employees", required: true, role: "source" },
    ],
    metric: null,
    measures: [measure],
    groupings: [
      { entity: "employees", table: "employees", field: "department", label: "department" },
    ],
    orderBy: [
      {
        sortId: createBusinessSqlSortId({ target: sortTarget, direction: "desc" }),
        target: sortTarget,
        direction: "desc",
      },
    ],
    rowLimit: {
      ...rowLimit,
      rowLimitId: createBusinessSqlRowLimitId(rowLimit),
    },
    ...overrides,
  };
};

const sumSalaryByDepartment = integratedFromPlan(aggregatePlan("sum"));
const averageSalaryByDepartment = integratedFromPlan(aggregatePlan("average"));
const minimumSalaryByDepartment = integratedFromPlan(aggregatePlan("minimum"));
const maximumSalaryByDepartment = integratedFromPlan(aggregatePlan("maximum"));
const multiMeasurePlan = (() => {
  const plan = aggregatePlan("sum");
  return integratedFromPlan({
    ...plan,
    measures: [
      ...plan.measures,
      {
        ...plan.measures[0],
        kind: "average",
        measureId: "business-sql-measure:employees:salary:average",
        label: "Average salary",
        sqlAlias: "average_salary",
      },
    ],
  });
})();
const invalidLimitPlan = integratedFromPlan(
  aggregatePlan("sum", {
    rowLimit: { rowLimitId: "business-sql-row-limit:0", value: 0 },
  }),
);
const unresolvedSortTargetPlan = integratedFromPlan(
  aggregatePlan("sum", {
    orderBy: [
      {
        sortId: createBusinessSqlSortId({
          target: { kind: "measure", measureId: "", resolved: false },
          direction: "desc",
        }),
        target: { kind: "measure", measureId: "", resolved: false },
        direction: "desc",
      },
    ],
  }),
);

const measureFieldTypePlan = (
  kind: Extract<BusinessSqlMeasureKind, "sum" | "average" | "minimum" | "maximum">,
  fieldInferredType: SchemaColumn["inferred_type"],
): BusinessSqlQueryPlanJoinResolution => {
  const plan = aggregatePlan(kind);
  const measure = {
    ...plan.measures[0],
    fieldInferredType,
  };
  return integratedFromPlan({
    ...plan,
    id: `business-sql-plan:${kind}:salary-by-department:${fieldInferredType}`,
    measures: [measure],
  });
};

const sumTextFieldPlan = measureFieldTypePlan("sum", "text");
const averageTextFieldPlan = measureFieldTypePlan("average", "text");
const minimumCategoricalFieldPlan = measureFieldTypePlan("minimum", "categorical");
const minimumDateFieldPlan = (() => {
  const plan = aggregatePlan("minimum");
  const measure: BusinessSqlMeasure = {
    ...plan.measures[0],
    field: "hire_date",
    fieldInferredType: "date",
    label: "Earliest hire date",
    sqlAlias: createBusinessSqlMeasureAlias("Earliest hire date"),
  };
  return integratedFromPlan({
    ...plan,
    id: "business-sql-plan:minimum:hire-date-by-department",
    measures: [measure],
  });
})();

const expectRendered = (
  result: BusinessSqlRenderResult,
  fragments: readonly string[],
): string[] => [
  ...(result.rendered && result.status === "rendered" && result.sql
    ? []
    : [`Expected rendered SQL but got ${result.status}.`]),
  ...(result.reasonCode === "rendered" ? [] : [`Expected rendered reason code, got ${result.reasonCode}.`]),
  ...(result.executionPayload === null ? [] : ["Renderer must not expose an execution payload."]),
  ...(result.inserted === false ? [] : ["Renderer must not insert SQL."]),
  ...(result.ranQuery === false ? [] : ["Renderer must not run SQL."]),
  ...(fragments.every((fragment) => result.sql?.includes(fragment))
    ? []
    : [`Expected SQL fragments: ${fragments.join(" | ")}`]),
];

const expectRefused = (
  result: BusinessSqlRenderResult,
  reasonCode: BusinessSqlRenderResult["reasonCode"],
): string[] => [
  ...(!result.rendered && result.sql === null
    ? []
    : ["Refused render attempt must return rendered=false and sql=null."]),
  ...(result.reasonCode === reasonCode
    ? []
    : [`Expected reason ${reasonCode}, got ${result.reasonCode}.`]),
  ...(result.executionPayload === null ? [] : ["Refusal must not expose an execution payload."]),
  ...(result.inserted === false ? [] : ["Refusal must not insert SQL."]),
  ...(result.ranQuery === false ? [] : ["Refusal must not run SQL."]),
];

const assertSelectOnly = (sql: string | null): string[] => {
  if (!sql) return ["Expected SQL text."];
  const normalized = sql.trim();
  return [
    ...(/^SELECT\b/.test(normalized) ? [] : ["Rendered SQL must start with SELECT."]),
    ...(/\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|MERGE|CALL|COPY|PRAGMA|ATTACH|DETACH)\b/i.test(normalized)
      ? ["Rendered SQL must not contain mutating or runtime-control statements."]
      : []),
    ...(/--|\/\*/.test(normalized) ? ["Rendered SQL must not contain comments."] : []),
    ...(normalized.slice(0, -1).includes(";")
      ? ["Rendered SQL must not contain multiple statements."]
      : []),
  ];
};

const assertNoPromptText = (
  result: BusinessSqlRenderResult,
  prompt: string,
): string[] => {
  const sql = result.sql || "";
  return sql.toLowerCase().includes(prompt.toLowerCase())
    ? ["Rendered SQL must not contain raw prompt text."]
    : [];
};

export const BUSINESS_SQL_RENDERER_FIXTURES: RendererFixture[] = [
  {
    name: "approved salary question flows through bridge readiness capability and renderer",
    integrated: approvedPipeline.integrated,
    renderability: approvedPipeline.renderability,
    assert: (result, integrated) => [
      ...(approvedPipeline.detectedIntent.metrics.length === 1 &&
      approvedPipeline.detectedIntent.metrics[0] === "sum_salary"
        ? []
        : ["Approved question must ground exactly one sum salary metric."]),
      ...(approvedPipeline.proposal.metrics.length === 1 &&
      approvedPipeline.proposal.metrics[0]?.kind === "sum"
        ? []
        : ["Approved proposal must contain exactly one sum metric."]),
      ...(approvedPipeline.proposal.metrics.some((metric) => metric.kind === "maximum")
        ? ["Highest must not add a maximum metric when sum expenditure is explicit."]
        : []),
      ...(approvedPipeline.bridgeResult.state === "render_ready_plan"
        ? []
        : ["Approved bridge result must be render_ready_plan."]),
      ...(approvedPipeline.bridgeResult.noSqlRendered &&
      approvedPipeline.bridgeResult.noInsertPerformed &&
      approvedPipeline.bridgeResult.noRunPerformed
        ? []
        : ["Bridge must stay manual-only with no render, insert, or run side effects."]),
      ...(approvedPipeline.renderability.status === "renderable"
        ? []
        : ["Approved renderability gate must be renderable."]),
      ...(approvedPipeline.capability.status === "capable"
        ? []
        : ["Approved renderer capability must be capable."]),
      ...(integrated.plan.measures.length === 1 && integrated.plan.measures[0]?.kind === "sum"
        ? []
        : ["Approved integrated plan must contain exactly one sum measure."]),
      ...(integrated.plan.orderBy[0]?.target.kind === "measure" &&
      integrated.plan.orderBy[0]?.target.measureId === integrated.plan.measures[0]?.measureId
        ? []
        : ["Approved ORDER BY must reference the measure by stable measureId."]),
      ...expectRendered(result, [
        '"employees"."department" AS "department"',
        'SUM("employees"."salary") AS "total_salary_expenditure"',
        'FROM "employees"',
        'GROUP BY "employees"."department"',
        'ORDER BY "total_salary_expenditure" DESC',
        "LIMIT 5;",
      ]),
      ...assertSelectOnly(result.sql),
      ...assertNoPromptText(result, integrated.plan.prompt || ""),
    ],
  },
  {
    name: "lowest total cost flows through bridge readiness capability and renderer",
    integrated: lowestTotalCostPipeline.integrated,
    renderability: lowestTotalCostPipeline.renderability,
    assert: (result, integrated) => [
      ...(lowestTotalCostPipeline.detectedIntent.metrics.length === 1 &&
      lowestTotalCostPipeline.detectedIntent.metrics[0] === "sum_cost"
        ? []
        : ["Lowest total cost must ground exactly one sum cost metric."]),
      ...(lowestTotalCostPipeline.proposal.metrics.length === 1 &&
      lowestTotalCostPipeline.proposal.metrics[0]?.kind === "sum"
        ? []
        : ["Lowest total cost proposal must contain exactly one sum metric."]),
      ...(lowestTotalCostPipeline.proposal.metrics.some((metric) => metric.kind === "minimum")
        ? ["Lowest total cost must not add a minimum metric when total defines the measure."]
        : []),
      ...(lowestTotalCostPipeline.bridgeResult.state === "render_ready_plan"
        ? []
        : ["Lowest total cost bridge result must be render_ready_plan."]),
      ...(lowestTotalCostPipeline.renderability.status === "renderable"
        ? []
        : ["Lowest total cost renderability gate must be renderable."]),
      ...(lowestTotalCostPipeline.capability.status === "capable"
        ? []
        : ["Lowest total cost renderer capability must be capable."]),
      ...(integrated.plan.measures.length === 1 &&
      integrated.plan.measures[0]?.kind === "sum" &&
      integrated.plan.measures[0]?.field === "cost"
        ? []
        : ["Lowest total cost integrated plan must contain exactly one sum cost measure."]),
      ...(integrated.plan.orderBy[0]?.target.kind === "measure" &&
      integrated.plan.orderBy[0]?.target.measureId === integrated.plan.measures[0]?.measureId &&
      integrated.plan.orderBy[0]?.direction === "asc"
        ? []
        : ["Lowest total cost ORDER BY must reference the sum measure by stable measureId ascending."]),
      ...(integrated.plan.rowLimit === null ? [] : ["Lowest total cost must not add an implicit row limit."]),
      ...(result.sql === [
        "SELECT",
        '  "departments"."department" AS "department",',
        '  SUM("departments"."cost") AS "total_cost"',
        'FROM "departments"',
        'GROUP BY "departments"."department"',
        'ORDER BY "total_cost" ASC;',
      ].join("\n")
        ? []
        : ["Lowest total cost SQL did not match the deterministic expected SQL."]),
      ...expectRendered(result, [
        '"departments"."department" AS "department"',
        'SUM("departments"."cost") AS "total_cost"',
        'ORDER BY "total_cost" ASC;',
      ]),
      ...assertSelectOnly(result.sql),
      ...assertNoPromptText(result, integrated.plan.prompt || ""),
    ],
  },
  {
    name: "highest average salary flows through bridge readiness capability and renderer",
    integrated: highestAverageSalaryPipeline.integrated,
    renderability: highestAverageSalaryPipeline.renderability,
    assert: (result, integrated) => [
      ...(highestAverageSalaryPipeline.detectedIntent.metrics.length === 1 &&
      highestAverageSalaryPipeline.detectedIntent.metrics[0] === "average_salary"
        ? []
        : ["Highest average salary must ground exactly one average salary metric."]),
      ...(highestAverageSalaryPipeline.proposal.metrics.length === 1 &&
      highestAverageSalaryPipeline.proposal.metrics[0]?.kind === "average"
        ? []
        : ["Highest average salary proposal must contain exactly one average metric."]),
      ...(highestAverageSalaryPipeline.proposal.metrics.some((metric) => metric.kind === "maximum")
        ? ["Highest average salary must not add a maximum metric when average defines the measure."]
        : []),
      ...(highestAverageSalaryPipeline.bridgeResult.state === "render_ready_plan"
        ? []
        : ["Highest average salary bridge result must be render_ready_plan."]),
      ...(highestAverageSalaryPipeline.capability.status === "capable"
        ? []
        : ["Highest average salary renderer capability must be capable."]),
      ...(integrated.plan.measures.length === 1 &&
      integrated.plan.measures[0]?.kind === "average" &&
      integrated.plan.measures[0]?.field === "salary"
        ? []
        : ["Highest average salary integrated plan must contain exactly one average salary measure."]),
      ...(integrated.plan.orderBy[0]?.target.kind === "measure" &&
      integrated.plan.orderBy[0]?.target.measureId === integrated.plan.measures[0]?.measureId &&
      integrated.plan.orderBy[0]?.direction === "desc"
        ? []
        : ["Highest average salary ORDER BY must reference the average measure by stable measureId descending."]),
      ...expectRendered(result, [
        'AVG("employees"."salary") AS "average_salary"',
        'ORDER BY "average_salary" DESC;',
      ]),
      ...assertSelectOnly(result.sql),
      ...assertNoPromptText(result, integrated.plan.prompt || ""),
    ],
  },
  {
    name: "leases by status renderable plan produces deterministic DuckDB SELECT",
    integrated: leasesByStatus,
    assert: (result, integrated) => [
      ...expectRendered(result, [
        'SELECT',
        '"leases"."lease_status" AS "lease_status"',
        'COUNT(*) AS "count_leases"',
        'FROM "leases"',
        'GROUP BY "leases"."lease_status"',
        'ORDER BY "count_leases" DESC;',
      ]),
      ...assertNoPromptText(result, integrated.plan.prompt || ""),
    ],
  },
  {
    name: "existing leases by status SQL remains byte-identical",
    integrated: leasesByStatus,
    assert: (result) =>
      result.sql === [
        "SELECT",
        '  "leases"."lease_status" AS "lease_status",',
        '  COUNT(*) AS "count_leases"',
        'FROM "leases"',
        'GROUP BY "leases"."lease_status"',
        'ORDER BY "count_leases" DESC;',
      ].join("\n")
        ? []
        : ["Expected existing count-plan SQL to remain byte-identical."],
  },
  {
    name: "sum salary by department renders ordering and safe row limit",
    integrated: sumSalaryByDepartment,
    assert: (result, integrated) => [
      ...expectRendered(result, [
        '"employees"."department" AS "department"',
        'SUM("employees"."salary") AS "total_salary_expenditure"',
        'FROM "employees"',
        'GROUP BY "employees"."department"',
        'ORDER BY "total_salary_expenditure" DESC',
        "LIMIT 5;",
      ]),
      ...assertNoPromptText(result, integrated.plan.prompt || ""),
    ],
  },
  {
    name: "average salary by department renders AVG",
    integrated: averageSalaryByDepartment,
    assert: (result) => expectRendered(result, ['AVG("employees"."salary") AS "average_salary"']),
  },
  {
    name: "minimum salary by department renders MIN",
    integrated: minimumSalaryByDepartment,
    assert: (result) => expectRendered(result, ['MIN("employees"."salary") AS "minimum_salary"']),
  },
  {
    name: "minimum date field renders MIN",
    integrated: minimumDateFieldPlan,
    assert: (result) => expectRendered(result, ['MIN("employees"."hire_date") AS "earliest_hire_date"']),
  },
  {
    name: "maximum salary by department renders MAX",
    integrated: maximumSalaryByDepartment,
    assert: (result) => expectRendered(result, ['MAX("employees"."salary") AS "maximum_salary"']),
  },
  {
    name: "multiple measures are refused by renderer capability",
    integrated: multiMeasurePlan,
    assert: (result) => expectRefused(result, "renderer_capability_incapable"),
  },
  {
    name: "invalid row limit is blocked before SQL is rendered",
    integrated: invalidLimitPlan,
    assert: (result) => expectRefused(result, "renderability_not_renderable"),
  },
  {
    name: "unresolved sort target is blocked before SQL is rendered",
    integrated: unresolvedSortTargetPlan,
    assert: (result) => [
      ...expectRefused(result, "renderability_not_renderable"),
      ...(renderabilityFor(unresolvedSortTargetPlan).reasonCodes.includes("sort_target_unresolved")
        ? []
        : ["Expected structural readiness reason sort_target_unresolved."]),
    ],
  },
  {
    name: "sum on text field is blocked before SQL is rendered",
    integrated: sumTextFieldPlan,
    assert: (result) => [
      ...expectRefused(result, "renderability_not_renderable"),
      ...(renderabilityFor(sumTextFieldPlan).reasonCodes.includes("measure_field_type_incompatible")
        ? []
        : ["Expected structural readiness reason measure_field_type_incompatible."]),
    ],
  },
  {
    name: "average on text field is blocked before SQL is rendered",
    integrated: averageTextFieldPlan,
    assert: (result) => [
      ...expectRefused(result, "renderability_not_renderable"),
      ...(renderabilityFor(averageTextFieldPlan).reasonCodes.includes("measure_field_type_incompatible")
        ? []
        : ["Expected structural readiness reason measure_field_type_incompatible."]),
    ],
  },
  {
    name: "minimum on categorical field is blocked before SQL is rendered",
    integrated: minimumCategoricalFieldPlan,
    assert: (result) => [
      ...expectRefused(result, "renderability_not_renderable"),
      ...(renderabilityFor(minimumCategoricalFieldPlan).reasonCodes.includes("measure_field_type_incompatible")
        ? []
        : ["Expected structural readiness reason measure_field_type_incompatible."]),
    ],
  },
  {
    name: "leased units per property with resolved joins renders deterministic DuckDB SELECT",
    integrated: leasedUnitsPerProperty,
    assert: (result, integrated) => [
      ...expectRendered(result, [
        '"properties"."property_id" AS "property"',
        'COUNT(DISTINCT "units"."unit_id") AS "count_distinct_units"',
        'FROM "properties"',
        'JOIN "units" ON "properties"."property_id" = "units"."property_id"',
        'JOIN "leases" ON "units"."unit_id" = "leases"."unit_id"',
      ]),
      ...assertNoPromptText(result, integrated.plan.prompt || ""),
    ],
  },
  {
    name: "orders per customer with resolved joins renders deterministic DuckDB SELECT",
    integrated: ordersPerCustomer,
    assert: (result, integrated) => [
      ...expectRendered(result, [
        '"customers"."customer_id" AS "customer"',
        'COUNT(*) AS "count_orders"',
        'FROM "customers"',
        'JOIN "orders" ON "customers"."customer_id" = "orders"."customer_id"',
      ]),
      ...assertNoPromptText(result, integrated.plan.prompt || ""),
    ],
  },
  {
    name: "tickets per account with resolved joins renders deterministic DuckDB SELECT",
    integrated: ticketsPerAccount,
    assert: (result, integrated) => [
      ...expectRendered(result, [
        '"accounts"."account_id" AS "account"',
        'COUNT(*) AS "count_tickets"',
        'FROM "accounts"',
        'JOIN "tickets" ON "accounts"."account_id" = "tickets"."account_id"',
      ]),
      ...assertNoPromptText(result, integrated.plan.prompt || ""),
    ],
  },
  {
    name: "needs-review renderability refuses to render",
    integrated: needsReviewPlan,
    assert: (result) => expectRefused(result, "renderability_not_renderable"),
  },
  {
    name: "blocked renderability refuses to render",
    integrated: blockedPlan,
    assert: (result) => expectRefused(result, "renderability_not_renderable"),
  },
  {
    name: "unsupported ready shape refuses to render",
    integrated: unsupportedReadyPlan,
    assert: (result) => expectRefused(result, "unsupported_plan_shape"),
  },
  {
    name: "non-DuckDB renderer target refuses to render",
    integrated: nonDuckDbPlan,
    assert: (result) => expectRefused(result, "renderer_target_not_duckdb"),
  },
  {
    name: "unresolved join refuses even with forged renderable gate",
    integrated: forgedUnresolvedJoinPlan,
    renderability: forgedRenderableGate,
    assert: (result) => expectRefused(result, "relationship_review_required"),
  },
  {
    name: "rendered SQL is SELECT-only and contains no prompt text",
    integrated: ordersPerCustomer,
    assert: (result, integrated) => [
      ...expectRendered(result, ["SELECT", 'FROM "customers"', 'JOIN "orders"']),
      ...assertSelectOnly(result.sql),
      ...assertNoPromptText(result, integrated.plan.prompt || ""),
    ],
  },
  {
    name: "same input produces the same SQL output",
    integrated: ordersPerCustomer,
    assert: () =>
      deterministicFirst.sql === deterministicSecond.sql &&
      deterministicFirst.summary === deterministicSecond.summary
        ? []
        : ["Expected deterministic rendered SQL and summary."],
  },
];

export function runBusinessSqlRendererFixtures(): RendererFixtureReport {
  const results = BUSINESS_SQL_RENDERER_FIXTURES.map((fixture) => {
    const renderResult = renderBusinessSqlFromRenderability({
      integrated: fixture.integrated,
      renderability: fixture.renderability || renderabilityFor(fixture.integrated),
    });
    const failureReasons = fixture.assert(renderResult, fixture.integrated);

    return {
      name: fixture.name,
      ok: failureReasons.length === 0,
      summary: renderResult.summary,
      renderResult,
      failureReasons,
    };
  });

  return {
    results,
    passed: results.filter((result) => result.ok),
    failed: results.filter((result) => !result.ok),
  };
}

export function allBusinessSqlRendererFixturesPass(): boolean {
  return runBusinessSqlRendererFixtures().failed.length === 0;
}
