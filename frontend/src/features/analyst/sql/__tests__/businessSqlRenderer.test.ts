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
  BUSINESS_SQL_DUCKDB_RENDERER_ID,
  BUSINESS_SQL_DUCKDB_RENDERER_VERSION,
  createBusinessSqlArtifactId,
  createBusinessSqlExecutionRenderRequest,
  evaluateBusinessSqlDialectRendererCapability,
  getBusinessSqlDialectRenderer,
  renderBusinessSqlQueryPlanArtifact,
  renderBusinessSqlArtifactFromRenderability,
  renderBusinessSqlFromRenderability,
  type BusinessSqlRenderResult,
} from "../businessSqlRenderer";
import {
  DEFAULT_BUSINESS_SQL_EXECUTION_TARGET,
  createBusinessSqlExecutionTarget,
  createBusinessSqlExecutionTargetId,
} from "../businessSqlExecutionTarget";
import {
  createBusinessSqlExecutionRequest,
  createBusinessSqlExecutionRequestId,
  type BusinessSqlExecutionLimits,
} from "../businessSqlExecutionRequest";
import {
  DEFAULT_LOCAL_DUCKDB_BUSINESS_SQL_EXECUTION_POLICY,
  createBusinessSqlExecutionPolicy,
  productionPolicyFor,
} from "../businessSqlExecutionPolicy";
import {
  canExecuteBusinessSqlRequest,
  evaluateBusinessSqlExecutionPolicy,
} from "../businessSqlExecutionPolicyEvaluation";
import { createBusinessSqlExecutionAuditRecord } from "../businessSqlExecutionAudit";
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
const deterministicArtifactFirst = renderBusinessSqlArtifactFromRenderability({
  integrated: ordersPerCustomer,
  renderability: renderabilityFor(ordersPerCustomer),
});
const deterministicArtifactSecond = renderBusinessSqlArtifactFromRenderability({
  integrated: ordersPerCustomer,
  renderability: renderabilityFor(ordersPerCustomer),
});
const executionRenderRequest = createBusinessSqlExecutionRenderRequest({
  plan: ordersPerCustomer.plan,
  executionTarget: DEFAULT_BUSINESS_SQL_EXECUTION_TARGET,
});
const executionArtifact = renderBusinessSqlArtifactFromRenderability({
  integrated: ordersPerCustomer,
  renderability: renderabilityFor(ordersPerCustomer),
  request: executionRenderRequest,
});
const executionLimits: BusinessSqlExecutionLimits = {
  maxReturnedRows: 1000,
  maxExecutionMilliseconds: 30000,
  truncationRequired: true,
  cancellationSupported: true,
  persistenceAllowed: false,
};
const executionAuditContext = {
  auditRequired: true,
  purpose: "fixture manual run",
  metadataOnly: true as const,
};
const createdExecutionRequest = createBusinessSqlExecutionRequest({
  renderRequest: executionRenderRequest,
  artifact: executionArtifact,
  target: DEFAULT_BUSINESS_SQL_EXECUTION_TARGET,
  requestedLimits: executionLimits,
  requestedAuditContext: executionAuditContext,
  manualTrigger: true,
});
const allowedExecutionEvaluation = createdExecutionRequest.request
  ? evaluateBusinessSqlExecutionPolicy({
      executionRequest: createdExecutionRequest.request,
      artifact: executionArtifact,
      target: DEFAULT_BUSINESS_SQL_EXECUTION_TARGET,
      policy: DEFAULT_LOCAL_DUCKDB_BUSINESS_SQL_EXECUTION_POLICY,
      context: {
        readOnlyEnforced: true,
        sensitiveDataPolicyPresent: true,
        auditContextPresent: true,
        metadataOnly: true,
      },
    })
  : null;

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
    name: "leased units per property with row filter refuses until WHERE rendering is supported",
    integrated: leasedUnitsPerProperty,
    assert: (result) => [
      ...expectRefused(result, "renderer_capability_incapable"),
      ...(evaluateBusinessSqlRendererCapability(leasedUnitsPerProperty.plan).reasonCodes.includes(
        "row_filter_legacy_semantics_not_renderable",
      )
        ? []
        : ["Expected legacy row filter rendering capability guard."]),
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
  {
    name: "DuckDB renderer registry exposes stable dialect and version identity",
    integrated: ordersPerCustomer,
    assert: () => {
      const renderer = getBusinessSqlDialectRenderer("duckdb");
      return [
        ...(renderer.dialect === "duckdb" ? [] : ["Expected DuckDB dialect identity."]),
        ...(renderer.rendererId === BUSINESS_SQL_DUCKDB_RENDERER_ID
          ? []
          : ["Expected DuckDB renderer id."]),
        ...(renderer.rendererVersion === BUSINESS_SQL_DUCKDB_RENDERER_VERSION
          ? []
          : ["Expected stable DuckDB renderer version identity."]),
      ];
    },
  },
  {
    name: "SqlArtifact carries rendered SQL outside canonical plan metadata",
    integrated: ordersPerCustomer,
    assert: (result) => {
      const artifact = renderBusinessSqlArtifactFromRenderability({
        integrated: ordersPerCustomer,
        renderability: renderabilityFor(ordersPerCustomer),
      });
      return [
        ...(artifact.dialect === "duckdb" ? [] : ["Expected DuckDB SqlArtifact dialect."]),
        ...(artifact.rendererId === BUSINESS_SQL_DUCKDB_RENDERER_ID
          ? []
          : ["Expected SqlArtifact renderer id."]),
        ...(artifact.rendererVersion === BUSINESS_SQL_DUCKDB_RENDERER_VERSION
          ? []
          : ["Expected SqlArtifact renderer version."]),
        ...(artifact.renderPurpose === "preview" ? [] : ["Expected preview render purpose."]),
        ...(artifact.requestId.startsWith("business-sql-render-request:")
          ? []
          : ["Expected deterministic render request id."]),
        ...(artifact.sql === result.sql ? [] : ["Expected SqlArtifact SQL to equal legacy renderer SQL."]),
        ...(artifact.rendered === result.rendered ? [] : ["Expected SqlArtifact rendered flag equality."]),
        ...(artifact.status === result.status ? [] : ["Expected SqlArtifact status equality."]),
        ...(artifact.reasonCode === result.reasonCode ? [] : ["Expected SqlArtifact reason equality."]),
        ...(ordersPerCustomer.plan.renderer.sql
          ? ["Canonical plan renderer metadata must not receive rendered SQL."]
          : []),
      ];
    },
  },
  {
    name: "compatibility wrapper remains byte-identical to DuckDB SqlArtifact",
    integrated: leasesByStatus,
    assert: (result) => {
      const artifact = renderBusinessSqlArtifactFromRenderability({
        integrated: leasesByStatus,
        renderability: renderabilityFor(leasesByStatus),
      });
      return [
        ...(artifact.sql === result.sql ? [] : ["Expected wrapper SQL byte equality."]),
        ...(artifact.summary === result.summary ? [] : ["Expected wrapper summary equality."]),
        ...(artifact.warnings.join("|") === result.warnings.join("|")
          ? []
          : ["Expected wrapper warning equality."]),
        ...(artifact.blockers.join("|") === result.blockers.join("|")
          ? []
          : ["Expected wrapper blocker equality."]),
      ];
    },
  },
  {
    name: "rendering artifact does not mutate canonical plan identity or fields",
    integrated: sumSalaryByDepartment,
    assert: () => {
      const before = JSON.stringify(sumSalaryByDepartment.plan);
      const beforeId = sumSalaryByDepartment.plan.id;
      renderBusinessSqlArtifactFromRenderability({
        integrated: sumSalaryByDepartment,
        renderability: renderabilityFor(sumSalaryByDepartment),
      });
      const after = JSON.stringify(sumSalaryByDepartment.plan);
      return [
        ...(sumSalaryByDepartment.plan.id === beforeId ? [] : ["Plan id must not change."]),
        ...(after === before ? [] : ["Rendering artifact must not mutate canonical plan fields."]),
      ];
    },
  },
  {
    name: "same input produces the same SqlArtifact identity",
    integrated: ordersPerCustomer,
    assert: () =>
      deterministicArtifactFirst.artifactId === deterministicArtifactSecond.artifactId &&
      deterministicArtifactFirst.sql === deterministicArtifactSecond.sql &&
      deterministicArtifactFirst.rendererVersion === deterministicArtifactSecond.rendererVersion
        ? []
        : ["Expected deterministic SqlArtifact identity."],
  },
  {
    name: "renderer version participates in SqlArtifact identity",
    integrated: ordersPerCustomer,
    assert: () => {
      const changedVersionId = createBusinessSqlArtifactId({
        planId: deterministicArtifactFirst.planId,
        dialect: deterministicArtifactFirst.dialect,
        rendererId: deterministicArtifactFirst.rendererId,
        rendererVersion: `${deterministicArtifactFirst.rendererVersion}:changed`,
        renderPurpose: deterministicArtifactFirst.renderPurpose,
        rendererConfigurationId: deterministicArtifactFirst.rendererConfigurationId,
        sql: deterministicArtifactFirst.sql,
        reasonCode: deterministicArtifactFirst.reasonCode,
      });
      return changedVersionId !== deterministicArtifactFirst.artifactId
        ? []
        : ["Expected renderer version changes to change artifact identity."];
    },
  },
  {
    name: "DuckDB renderer capability is reported per requested dialect",
    integrated: ordersPerCustomer,
    assert: () => {
      const capability = evaluateBusinessSqlDialectRendererCapability({
        integrated: ordersPerCustomer,
        renderability: renderabilityFor(ordersPerCustomer),
      });
      return [
        ...(capability.dialect === "duckdb" ? [] : ["Expected DuckDB capability dialect."]),
        ...(capability.rendererId === BUSINESS_SQL_DUCKDB_RENDERER_ID
          ? []
          : ["Expected capability renderer id."]),
        ...(capability.rendererVersion === BUSINESS_SQL_DUCKDB_RENDERER_VERSION
          ? []
          : ["Expected capability renderer version."]),
        ...(capability.capable && capability.status === "capable"
          ? []
          : ["Expected capable DuckDB renderer report."]),
        ...(capability.metadataOnly ? [] : ["Capability report must be metadata only."]),
      ];
    },
  },
  {
    name: "preview and execution render requests are distinct without granting execution",
    integrated: ordersPerCustomer,
    assert: () => {
      const executionRequest = createBusinessSqlExecutionRenderRequest({
        plan: ordersPerCustomer.plan,
        executionTarget: DEFAULT_BUSINESS_SQL_EXECUTION_TARGET,
      });
      const executionArtifact = renderBusinessSqlArtifactFromRenderability({
        integrated: ordersPerCustomer,
        renderability: renderabilityFor(ordersPerCustomer),
        request: executionRequest,
      });
      return [
        ...(executionRequest.purpose === "execution" ? [] : ["Expected execution purpose."]),
        ...(executionRequest.dialect === DEFAULT_BUSINESS_SQL_EXECUTION_TARGET.dialect
          ? []
          : ["Expected execution request dialect from execution target."]),
        ...(!executionRequest.executionPermissionGranted
          ? []
          : ["Render request must not grant execution permission."]),
        ...(!executionRequest.containsExecutionCredentials
          ? []
          : ["Render request must not contain credentials."]),
        ...(!executionRequest.containsRenderedSql
          ? []
          : ["Render request must not contain rendered SQL."]),
        ...(!executionRequest.containsResultRows
          ? []
          : ["Render request must not contain result rows."]),
        ...(!executionRequest.rawPromptReinterpreted
          ? []
          : ["Render request must not reinterpret raw prompt text."]),
        ...(executionArtifact.renderPurpose === "execution"
          ? []
          : ["Expected execution artifact purpose."]),
        ...(executionArtifact.sql === deterministicArtifactFirst.sql
          ? []
          : ["Expected DuckDB SQL bytes to remain identical across purposes."]),
        ...(executionArtifact.artifactId !== deterministicArtifactFirst.artifactId
          ? []
          : ["Expected preview and execution artifacts to have distinct identities."]),
        ...(!executionArtifact.inserted && !executionArtifact.ranQuery
          ? []
          : ["Execution artifact rendering must not insert or run SQL."]),
      ];
    },
  },
  {
    name: "render request identity is deterministic and plan identity remains unchanged",
    integrated: ordersPerCustomer,
    assert: () => {
      const first = createBusinessSqlExecutionRenderRequest({
        plan: ordersPerCustomer.plan,
        executionTarget: DEFAULT_BUSINESS_SQL_EXECUTION_TARGET,
      });
      const second = createBusinessSqlExecutionRenderRequest({
        plan: ordersPerCustomer.plan,
        executionTarget: DEFAULT_BUSINESS_SQL_EXECUTION_TARGET,
      });
      const beforePlanId = ordersPerCustomer.plan.id;
      renderBusinessSqlQueryPlanArtifact(ordersPerCustomer.plan, first);
      return [
        ...(first.requestId === second.requestId
          ? []
          : ["Expected deterministic render request identity."]),
        ...(ordersPerCustomer.plan.id === beforePlanId ? [] : ["Plan identity must not change."]),
      ];
    },
  },
  {
    name: "execution target identity is deterministic and contains no live connection material",
    integrated: ordersPerCustomer,
    assert: () => {
      const firstId = createBusinessSqlExecutionTargetId(DEFAULT_BUSINESS_SQL_EXECUTION_TARGET);
      const equivalent = createBusinessSqlExecutionTarget({
        dialect: "duckdb",
        connectionKind: "local_duckdb",
        environment: "local",
        dataSensitivity: "internal",
        readOnlyRequired: true,
        allowedExecutionMode: "read_only_analytical",
        targetConfigurationId: "business-sql-execution-target-config:local-duckdb",
      });
      return [
        ...(firstId === createBusinessSqlExecutionTargetId(DEFAULT_BUSINESS_SQL_EXECUTION_TARGET)
          ? []
          : ["Expected deterministic target identity."]),
        ...(equivalent.id === firstId ? [] : ["Expected equivalent target id."]),
        ...(!DEFAULT_BUSINESS_SQL_EXECUTION_TARGET.containsCredentials
          ? []
          : ["Target must not contain credentials."]),
        ...(!DEFAULT_BUSINESS_SQL_EXECUTION_TARGET.containsLiveClient
          ? []
          : ["Target must not contain a live client."]),
        ...(!DEFAULT_BUSINESS_SQL_EXECUTION_TARGET.containsNetworkHandle
          ? []
          : ["Target must not contain a network handle."]),
        ...(!DEFAULT_BUSINESS_SQL_EXECUTION_TARGET.grantsExecutionPermission
          ? []
          : ["Target must not grant execution permission."]),
      ];
    },
  },
  {
    name: "execution request identity is deterministic and requires manual rendered execution artifact",
    integrated: ordersPerCustomer,
    assert: () => {
      const missingManual = createBusinessSqlExecutionRequest({
        renderRequest: executionRenderRequest,
        artifact: executionArtifact,
        target: DEFAULT_BUSINESS_SQL_EXECUTION_TARGET,
        requestedLimits: executionLimits,
        requestedAuditContext: executionAuditContext,
        manualTrigger: false,
      });
      const previewArtifactRequest = createBusinessSqlExecutionRequest({
        renderRequest: executionRenderRequest,
        artifact: deterministicArtifactFirst,
        target: DEFAULT_BUSINESS_SQL_EXECUTION_TARGET,
        requestedLimits: executionLimits,
        requestedAuditContext: executionAuditContext,
        manualTrigger: true,
      });
      const expectedId = createdExecutionRequest.request
        ? createBusinessSqlExecutionRequestId(createdExecutionRequest.request)
        : null;
      return [
        ...(createdExecutionRequest.status === "created" && createdExecutionRequest.request
          ? []
          : ["Expected execution request to be created."]),
        ...(createdExecutionRequest.request && expectedId === createdExecutionRequest.request.requestId
          ? []
          : ["Expected deterministic execution request id."]),
        ...(createdExecutionRequest.request && !createdExecutionRequest.request.executionPermissionGranted
          ? []
          : ["Execution request itself must not grant permission."]),
        ...(missingManual.status === "blocked" &&
        missingManual.blockers.includes("manual_trigger_missing")
          ? []
          : ["Expected manual trigger blocker."]),
        ...(previewArtifactRequest.status === "blocked" &&
        previewArtifactRequest.blockers.includes("execution_artifact_required")
          ? []
          : ["Expected execution artifact requirement blocker."]),
      ];
    },
  },
  {
    name: "execution policy blocks identity mismatches",
    integrated: ordersPerCustomer,
    assert: () => {
      if (!createdExecutionRequest.request) return ["Expected created execution request."];
      const mismatchedArtifact = {
        ...executionArtifact,
        artifactId: `${executionArtifact.artifactId}:mismatch`,
      };
      const mismatchedTarget = {
        ...DEFAULT_BUSINESS_SQL_EXECUTION_TARGET,
        id: "business-sql-execution-target:mismatch",
      };
      const mismatchedDialectTarget = {
        ...DEFAULT_BUSINESS_SQL_EXECUTION_TARGET,
        id: "business-sql-execution-target:dialect-mismatch",
      };
      const artifactDialectMismatch = {
        ...executionArtifact,
        dialect: "postgres" as typeof executionArtifact.dialect,
        artifactId: `${executionArtifact.artifactId}:dialect-mismatch`,
      };
      const artifactMismatchEvaluation = evaluateBusinessSqlExecutionPolicy({
        executionRequest: createdExecutionRequest.request,
        artifact: mismatchedArtifact,
        target: DEFAULT_BUSINESS_SQL_EXECUTION_TARGET,
        policy: DEFAULT_LOCAL_DUCKDB_BUSINESS_SQL_EXECUTION_POLICY,
        context: { readOnlyEnforced: true, sensitiveDataPolicyPresent: true, auditContextPresent: true, metadataOnly: true },
      });
      const targetMismatchEvaluation = evaluateBusinessSqlExecutionPolicy({
        executionRequest: createdExecutionRequest.request,
        artifact: executionArtifact,
        target: mismatchedTarget,
        policy: DEFAULT_LOCAL_DUCKDB_BUSINESS_SQL_EXECUTION_POLICY,
        context: { readOnlyEnforced: true, sensitiveDataPolicyPresent: true, auditContextPresent: true, metadataOnly: true },
      });
      const dialectMismatchEvaluation = evaluateBusinessSqlExecutionPolicy({
        executionRequest: {
          ...createdExecutionRequest.request,
          dialect: "duckdb",
        },
        artifact: artifactDialectMismatch,
        target: mismatchedDialectTarget,
        policy: DEFAULT_LOCAL_DUCKDB_BUSINESS_SQL_EXECUTION_POLICY,
        context: { readOnlyEnforced: true, sensitiveDataPolicyPresent: true, auditContextPresent: true, metadataOnly: true },
      });
      const planMismatchEvaluation = evaluateBusinessSqlExecutionPolicy({
        executionRequest: {
          ...createdExecutionRequest.request,
          planId: "business-sql-plan:mismatch",
        },
        artifact: executionArtifact,
        target: DEFAULT_BUSINESS_SQL_EXECUTION_TARGET,
        policy: DEFAULT_LOCAL_DUCKDB_BUSINESS_SQL_EXECUTION_POLICY,
        context: { readOnlyEnforced: true, sensitiveDataPolicyPresent: true, auditContextPresent: true, metadataOnly: true },
      });
      return [
        ...(artifactMismatchEvaluation.blockers.includes("artifact_identity_mismatch")
          ? []
          : ["Expected artifact mismatch blocker."]),
        ...(targetMismatchEvaluation.blockers.includes("target_identity_mismatch")
          ? []
          : ["Expected target mismatch blocker."]),
        ...(dialectMismatchEvaluation.status === "blocked" ? [] : ["Expected dialect mismatch blocked."]),
        ...(planMismatchEvaluation.blockers.includes("plan_identity_mismatch")
          ? []
          : ["Expected plan mismatch blocker."]),
      ];
    },
  },
  {
    name: "execution policy fails closed for missing required governance inputs",
    integrated: ordersPerCustomer,
    assert: () => {
      if (!createdExecutionRequest.request) return ["Expected created execution request."];
      const strictPolicy = createBusinessSqlExecutionPolicy({
        ...DEFAULT_LOCAL_DUCKDB_BUSINESS_SQL_EXECUTION_POLICY,
        authenticationRequired: true,
        authorizationRequired: true,
      });
      const missingLimitsRequest = {
        ...createdExecutionRequest.request,
        requestedLimits: {
          truncationRequired: true,
          cancellationSupported: true,
          persistenceAllowed: false,
        },
      };
      const evaluation = evaluateBusinessSqlExecutionPolicy({
        executionRequest: missingLimitsRequest,
        artifact: executionArtifact,
        target: DEFAULT_BUSINESS_SQL_EXECUTION_TARGET,
        policy: strictPolicy,
        context: { metadataOnly: true },
      });
      return [
        ...(evaluation.status === "blocked" && !evaluation.allowed ? [] : ["Expected blocked evaluation."]),
        ...(evaluation.blockers.includes("authentication_context_missing") ? [] : ["Expected auth blocker."]),
        ...(evaluation.blockers.includes("authorization_context_missing") ? [] : ["Expected authorization blocker."]),
        ...(evaluation.blockers.includes("read_only_not_enforced") ? [] : ["Expected read-only blocker."]),
        ...(evaluation.blockers.includes("timeout_policy_missing") ? [] : ["Expected timeout blocker."]),
        ...(evaluation.blockers.includes("result_limit_missing") ? [] : ["Expected result limit blocker."]),
        ...(evaluation.blockers.includes("sensitive_data_policy_missing") ? [] : ["Expected sensitivity blocker."]),
        ...(evaluation.blockers.includes("audit_logging_required") ? [] : ["Expected audit blocker."]),
      ];
    },
  },
  {
    name: "allowed local analytical policy case remains metadata-only with no execution",
    integrated: ordersPerCustomer,
    assert: () => [
      ...(allowedExecutionEvaluation?.status === "allowed" && allowedExecutionEvaluation.allowed
        ? []
        : ["Expected allowed local policy evaluation."]),
      ...(allowedExecutionEvaluation?.blockers.length === 0 ? [] : ["Expected no blockers."]),
      ...(allowedExecutionEvaluation?.metadataOnly ? [] : ["Expected metadata-only evaluation."]),
      ...(!allowedExecutionEvaluation?.containsExecutionResult ? [] : ["Evaluation must not contain result."]),
      ...(!allowedExecutionEvaluation?.containsCredentials ? [] : ["Evaluation must not contain credentials."]),
      ...(!executionArtifact.inserted && !executionArtifact.ranQuery
        ? []
        : ["Artifact rendering must not insert or run SQL."]),
    ],
  },
  {
    name: "production target requires review before allowance",
    integrated: ordersPerCustomer,
    assert: () => {
      if (!createdExecutionRequest.request) return ["Expected created execution request."];
      const productionTarget = createBusinessSqlExecutionTarget({
        dialect: "duckdb",
        connectionKind: "local_duckdb",
        environment: "production",
        dataSensitivity: "confidential",
        readOnlyRequired: true,
        allowedExecutionMode: "read_only_analytical",
        targetConfigurationId: "business-sql-execution-target-config:prod-fixture",
      });
      const productionRequest = {
        ...createdExecutionRequest.request,
        executionTargetId: productionTarget.id,
      };
      const evaluation = evaluateBusinessSqlExecutionPolicy({
        executionRequest: productionRequest,
        artifact: executionArtifact,
        target: productionTarget,
        policy: productionPolicyFor(productionTarget),
        context: {
          authenticationContextPresent: true,
          authorizationContextPresent: true,
          readOnlyEnforced: true,
          sensitiveDataPolicyPresent: true,
          auditContextPresent: true,
          rowLevelSecurityContextPresent: true,
          metadataOnly: true,
        },
      });
      return [
        ...(evaluation.status === "needs_review" ? [] : ["Expected production review state."]),
        ...(evaluation.warnings.includes("production_target") ? [] : ["Expected production warning."]),
        ...(evaluation.warnings.includes("production_review_required")
          ? []
          : ["Expected production review warning."]),
        ...(!evaluation.allowed ? [] : ["Production review state must not be allowed."]),
      ];
    },
  },
  {
    name: "manual run gate only opens for allowed policy evaluation",
    integrated: ordersPerCustomer,
    assert: () => {
      const blockedEvaluation = evaluateBusinessSqlExecutionPolicy({
        executionRequest: null,
        artifact: deterministicArtifactFirst,
        target: DEFAULT_BUSINESS_SQL_EXECUTION_TARGET,
        policy: DEFAULT_LOCAL_DUCKDB_BUSINESS_SQL_EXECUTION_POLICY,
        context: { metadataOnly: true },
      });
      return [
        ...(!canExecuteBusinessSqlRequest(null) ? [] : ["Preview readiness alone must not open gate."]),
        ...(!canExecuteBusinessSqlRequest(blockedEvaluation) ? [] : ["Blocked evaluation must not open gate."]),
        ...(canExecuteBusinessSqlRequest(allowedExecutionEvaluation)
          ? []
          : ["Allowed evaluation should open conceptual gate."]),
      ];
    },
  },
  {
    name: "execution audit record captures evaluated policy lineage only",
    integrated: ordersPerCustomer,
    assert: () => {
      if (!createdExecutionRequest.request || !allowedExecutionEvaluation) {
        return ["Expected created execution request and allowed evaluation."];
      }
      const audit = createBusinessSqlExecutionAuditRecord({
        executionRequest: createdExecutionRequest.request,
        evaluation: allowedExecutionEvaluation,
        artifact: executionArtifact,
      });
      return [
        ...(audit.lifecycle === "policy_evaluated" ? [] : ["Expected policy evaluated lifecycle."]),
        ...(audit.executionRequestId === createdExecutionRequest.request.requestId
          ? []
          : ["Expected execution request lineage."]),
        ...(audit.policyEvaluationId === allowedExecutionEvaluation.evaluationId
          ? []
          : ["Expected policy evaluation lineage."]),
        ...(audit.artifactId === executionArtifact.artifactId ? [] : ["Expected artifact lineage."]),
        ...(!audit.containsCredentials ? [] : ["Audit must not contain credentials."]),
        ...(!audit.containsResultRows ? [] : ["Audit must not contain result rows."]),
        ...(!audit.executionStarted && !audit.executionCompleted
          ? []
          : ["Audit record must not claim execution occurred."]),
      ];
    },
  },
  {
    name: "execution governance contracts do not mutate canonical plan",
    integrated: ordersPerCustomer,
    assert: () => {
      const before = JSON.stringify(ordersPerCustomer.plan);
      const beforeId = ordersPerCustomer.plan.id;
      createBusinessSqlExecutionTargetId(DEFAULT_BUSINESS_SQL_EXECUTION_TARGET);
      if (createdExecutionRequest.request && allowedExecutionEvaluation) {
        createBusinessSqlExecutionAuditRecord({
          executionRequest: createdExecutionRequest.request,
          evaluation: allowedExecutionEvaluation,
          artifact: executionArtifact,
        });
      }
      const after = JSON.stringify(ordersPerCustomer.plan);
      return [
        ...(ordersPerCustomer.plan.id === beforeId ? [] : ["Plan id must not change."]),
        ...(after === before ? [] : ["Execution governance must not mutate plan."]),
      ];
    },
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
