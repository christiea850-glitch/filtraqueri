/**
 * T-13N - Adaptive Proposal to Business SQL Plan bridge fixtures.
 *
 * Pure fixture runner only. No SQL rendering, Monaco insertion, Run Query
 * calls, backend/API calls, provider calls, LLM calls, or execution behavior.
 */

import type { AcceptedRelationshipContract, WorksheetMetadata } from "../../../workbook";
import type { SchemaColumn } from "../../../dataset/datasetTypes";
import type { AdaptiveReportProposal, ProposedMetric } from "../adaptiveReportProposal";
import { proposeAdaptiveReport } from "../adaptiveReportProposal";
import {
  createBusinessSqlPlanFromAdaptiveProposal,
  type AdaptiveProposalBusinessSqlBridgeResult,
} from "../adaptiveProposalBusinessSqlBridge";
import { detectBusinessIntent } from "../businessIntentGrounding";
import { createBusinessSqlRenderPreview } from "../businessSqlRenderPreview";

type FixtureResult = {
  name: string;
  ok: boolean;
  failureReasons: string[];
};

export type AdaptiveProposalBusinessSqlBridgeFixtureReport = {
  results: FixtureResult[];
  passed: FixtureResult[];
  failed: FixtureResult[];
};

type Fixture = {
  name: string;
  result: AdaptiveProposalBusinessSqlBridgeResult;
  assert: (result: AdaptiveProposalBusinessSqlBridgeResult) => string[];
};

const acceptedContract = (
  sourceTableName: string,
  sourceColumnName: string,
  targetTableName: string,
  targetColumnName: string,
): AcceptedRelationshipContract => ({
  contractId: `contract:${sourceTableName}:${targetTableName}`,
  sourceWorksheetId: `worksheet:${sourceTableName}`,
  sourceTableName,
  sourceColumnName,
  targetWorksheetId: `worksheet:${targetTableName}`,
  targetTableName,
  targetColumnName,
  relationshipType: "many_to_one_candidate",
  confidence: 0.95,
  acceptedFromCandidateId: `candidate:${sourceTableName}:${targetTableName}`,
  acceptedAt: "2026-01-01T00:00:00.000Z",
  acceptedBy: null,
  status: "active",
  validationState: "valid",
  validationSummary: [],
  overlapRatio: 1,
  sourceUniqueRatio: 0.5,
  targetUniqueRatio: 1,
  inferredTypeCompatible: true,
  lastValidatedAt: "2026-01-01T00:00:00.000Z",
});

const baseProposal = (): AdaptiveReportProposal => ({
  proposalKind: "adaptive",
  id: "adaptive:leases-by-status",
  title: "Leases by status",
  question: "Count leases by status",
  support: "supported",
  confidence: "high",
  detectedIntent: {
    primaryIntent: "count_grouping",
    alternates: [],
    entities: ["leases"],
    metrics: ["count_leases"],
    grouping: ["status"],
    relationshipPredicate: null,
    explicitlyTemporal: false,
    detectorVersion: "v1",
  },
  entities: [
    {
      id: "entity:leases",
      requestedName: "leases",
      label: "leases",
      worksheetId: "worksheet:leases",
      tableName: "leases",
      confidence: "high",
      binding: "exact",
    },
  ],
  metrics: [
    {
      id: "metric:count-leases",
      label: "count leases",
      kind: "count_entities",
      tableName: "leases",
      columnName: null,
      synthesized: false,
      confidence: "high",
    },
  ],
  derivedMeasures: [],
  groupings: [
    {
      id: "grouping:lease-status",
      label: "status",
      tableName: "leases",
      columnName: "lease_status",
      confidence: "high",
    },
  ],
  aggregateResultConditions: [],
  sorts: [],
  rowLimit: null,
  filters: [],
  joinNeeds: [],
  assumptions: [],
  missingRequirements: [],
  warnings: [],
  semanticHints: [],
  renderer: {
    status: "not_rendered",
    canRender: false,
    targetDialect: "duckdb",
    notes: ["Planning only fixture."],
  },
  sql: null,
  canRenderSql: false,
  canInsertSql: false,
  canRunSql: false,
  llmReadiness: {
    safeToOfferFallback: false,
    payloadShape: "metadata_only",
    reason: "Metadata only fixture.",
  },
  payloadFingerprint: "adaptive:fingerprint:leases-by-status",
  proposalNarrative: "Count leases grouped by status.",
});

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

const salesWorksheet = {
  worksheetId: "worksheet:sales",
  displayName: "Sales",
  sheetName: "Sales",
  tableName: "sales",
  schema: [
    column("region", "categorical"),
    column("revenue", "numeric"),
  ],
};

const healthcareWorksheet = {
  worksheetId: "worksheet:stays",
  displayName: "Stays",
  sheetName: "Stays",
  tableName: "stays",
  schema: [
    column("hospital_unit", "categorical"),
    column("length_of_stay", "numeric"),
  ],
};

const customerWorksheet = {
  worksheetId: "worksheet:customers",
  displayName: "Customers",
  sheetName: "Customers",
  tableName: "customers",
  schema: [
    column("customer_id", "text"),
    column("region", "categorical"),
  ],
};

const approvedQuestion = "Show the five departments with the highest total salary expenditure.";
const approvedProposal = proposeAdaptiveReport({
  prompt: approvedQuestion,
  detectedIntent: detectBusinessIntent(approvedQuestion),
  worksheets: [employeeWorksheet],
  appliedScopeSelections: [
    {
      worksheetId: employeeWorksheet.worksheetId,
      sourceType: "original",
      tableName: employeeWorksheet.tableName,
      originalTableName: employeeWorksheet.tableName,
    },
  ],
});

const proposalForQuestion = (
  prompt: string,
  worksheet: Pick<WorksheetMetadata, "worksheetId" | "displayName" | "sheetName" | "tableName" | "schema">,
): AdaptiveReportProposal =>
  proposeAdaptiveReport({
    prompt,
    detectedIntent: detectBusinessIntent(prompt),
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

const lowestTotalCostProposal = proposalForQuestion(
  "Show departments with the lowest total cost.",
  departmentWorksheet,
);
const highestAverageSalaryProposal = proposalForQuestion(
  "Show departments with the highest average salary.",
  employeeWorksheet,
);
const revenueThresholdProposal = proposalForQuestion(
  "Show regions whose total revenue is above 500000.",
  salesWorksheet,
);
const revenueCommaThresholdProposal = proposalForQuestion(
  "Show regions whose total revenue is above 500,000.",
  salesWorksheet,
);
const salaryThresholdProposal = proposalForQuestion(
  "Show departments whose total salary is above 500000.",
  employeeWorksheet,
);
const stayThresholdProposal = proposalForQuestion(
  "Show hospital units whose average length of stay is above 5.",
  healthcareWorksheet,
);
const stayDecimalThresholdProposal = proposalForQuestion(
  "Show hospital units whose average length of stay is above 10.5.",
  healthcareWorksheet,
);
const countThresholdProposal = proposalForQuestion(
  "Show departments with more than 10 employees.",
  employeeWorksheet,
);
const customerCountThresholdProposal = proposalForQuestion(
  "Show regions with more than 100 customers.",
  customerWorksheet,
);
const rawFieldThresholdProposal = proposalForQuestion(
  "Show sales rows where revenue is above 500000.",
  salesWorksheet,
);
const rawFieldCommaThresholdProposal = proposalForQuestion(
  "Show sales rows where revenue is above 500,000.",
  salesWorksheet,
);

const withProposal = (overrides: Partial<AdaptiveReportProposal>): AdaptiveReportProposal => ({
  ...baseProposal(),
  ...overrides,
});

const ordersPerCustomerProposal = ({
  joinStatus = "verified",
}: {
  joinStatus?: "verified" | "needs_review" | "missing";
} = {}): AdaptiveReportProposal => ({
  ...baseProposal(),
  id: `adaptive:orders-per-customer:${joinStatus}`,
  title: "Orders per customer",
  question: "Count orders by customer",
  detectedIntent: {
    primaryIntent: "count_grouping",
    alternates: [],
    entities: ["orders", "customers"],
    metrics: ["count_orders"],
    grouping: ["customer"],
    relationshipPredicate: "customer has orders",
    explicitlyTemporal: false,
    detectorVersion: "v1",
  },
  entities: [
    {
      id: "entity:customers",
      requestedName: "customers",
      label: "customers",
      worksheetId: "worksheet:customers",
      tableName: "customers",
      confidence: "high",
      binding: "exact",
    },
    {
      id: "entity:orders",
      requestedName: "orders",
      label: "orders",
      worksheetId: "worksheet:orders",
      tableName: "orders",
      confidence: "high",
      binding: "exact",
    },
  ],
  metrics: [
    {
      id: "metric:count-orders",
      label: "count orders",
      kind: "count_entities",
      tableName: "orders",
      columnName: null,
      synthesized: false,
      confidence: "high",
    },
  ],
  groupings: [
    {
      id: "grouping:customer",
      label: "customer",
      tableName: "customers",
      columnName: "customer_id",
      confidence: "high",
    },
  ],
  joinNeeds: [
    {
      id: "join:customers-orders",
      leftEntity: "customers",
      rightEntity: "orders",
      leftTable: "customers",
      rightTable: "orders",
      status: joinStatus,
      contractId: joinStatus === "verified" ? "contract:customers:orders" : null,
      reason: "customer has orders",
    },
  ],
  payloadFingerprint: `adaptive:fingerprint:orders-per-customer:${joinStatus}`,
});

const bridge = (
  proposal: AdaptiveReportProposal,
  contracts: AcceptedRelationshipContract[] = [],
) =>
  createBusinessSqlPlanFromAdaptiveProposal({
    proposal,
    acceptedRelationshipContracts: contracts,
    selectedGuidanceDialect: "duckdb",
  });

const customersOrdersContract = acceptedContract(
  "customers",
  "customer_id",
  "orders",
  "customer_id",
);

const expectNoExecutionSurface = (
  result: AdaptiveProposalBusinessSqlBridgeResult,
): string[] => [
  ...(result.noSqlRendered === true ? [] : ["Bridge must not render SQL."]),
  ...(result.noInsertPerformed === true ? [] : ["Bridge must not insert SQL."]),
  ...(result.noRunPerformed === true ? [] : ["Bridge must not run SQL."]),
  ...(result.plan?.renderer.sql ? ["Bridge plan must not contain SQL text."] : []),
  ...(result.plan?.renderer.targetDialect && result.plan.renderer.targetDialect !== "duckdb"
    ? ["Renderer target must remain DuckDB."]
    : []),
];

const fixtures: Fixture[] = [
  {
    name: "unsupported proposal returns no plan",
    result: bridge(
      withProposal({
        support: "unsupported",
        missingRequirements: [
          { id: "missing-scope", kind: "scope", message: "Missing scope." },
        ],
      }),
    ),
    assert: (result) => [
      ...(result.state === "no_plan" ? [] : ["Expected no_plan."]),
      ...(result.plan === null ? [] : ["Unsupported proposal should not return a plan."]),
      ...expectNoExecutionSurface(result),
    ],
  },
  {
    name: "missing entity table or metric returns blocked plan",
    result: bridge(
      withProposal({
        metrics: [],
        entities: [
          {
            ...baseProposal().entities[0],
            tableName: null,
            binding: "unresolved",
          },
        ],
      }),
    ),
    assert: (result) => [
      ...(result.state === "blocked_plan" ? [] : ["Expected blocked_plan."]),
      ...(result.plan?.support === "blocked" ? [] : ["Expected blocked plan support."]),
      ...(result.issues.some((issue) => issue.code === "missing_metric")
        ? []
        : ["Expected missing metric issue."]),
      ...expectNoExecutionSurface(result),
    ],
  },
  {
    name: "missing join returns blocked plan",
    result: bridge(ordersPerCustomerProposal({ joinStatus: "missing" })),
    assert: (result) => [
      ...(result.state === "blocked_plan" ? [] : ["Expected blocked_plan."]),
      ...(result.plan?.joinPath.status === "missing" ? [] : ["Expected missing join path."]),
      ...expectNoExecutionSurface(result),
    ],
  },
  {
    name: "needs-review join returns review-required plan",
    result: bridge(ordersPerCustomerProposal({ joinStatus: "needs_review" })),
    assert: (result) => [
      ...(result.state === "review_required_plan" ? [] : ["Expected review_required_plan."]),
      ...(result.plan?.joinPath.status === "needs_review" ? [] : ["Expected needs-review join path."]),
      ...expectNoExecutionSurface(result),
    ],
  },
  {
    name: "low or medium confidence proposal returns review-required plan",
    result: bridge(withProposal({ confidence: "medium" })),
    assert: (result) => [
      ...(result.state === "review_required_plan" ? [] : ["Expected review_required_plan."]),
      ...(result.issues.some((issue) => issue.code === "low_confidence")
        ? []
        : ["Expected confidence issue."]),
      ...expectNoExecutionSurface(result),
    ],
  },
  {
    name: "needs-review filter returns review-required plan",
    result: bridge(
      withProposal({
        support: "needs_review",
        filters: [
          {
            id: "filter:status",
            label: "open status",
            tableName: "leases",
            columnName: "lease_status",
            semantics: "needs_review",
            reason: "Status value needs review.",
          },
        ],
      }),
    ),
    assert: (result) => [
      ...(result.state === "review_required_plan" ? [] : ["Expected review_required_plan."]),
      ...(result.plan?.filters.length === 1 ? [] : ["Expected mapped filter."]),
      ...(result.issues.some((issue) => issue.code === "needs_review_filter")
        ? []
        : ["Expected needs-review filter issue."]),
      ...expectNoExecutionSurface(result),
    ],
  },
  {
    name: "unsupported metric kind blocks conversion",
    result: bridge(
      withProposal({
        metrics: [
          {
            ...(baseProposal().metrics[0] as ProposedMetric),
            kind: "metric_column",
            label: "lease value",
            columnName: "lease_value",
          },
        ],
      }),
    ),
    assert: (result) => [
      ...(result.state === "blocked_plan" ? [] : ["Expected blocked_plan."]),
      ...(result.issues.some((issue) => issue.code === "unsupported_metric")
        ? []
        : ["Expected unsupported metric issue."]),
      ...expectNoExecutionSurface(result),
    ],
  },
  {
    name: "approved salary question carries measure sort and row limit into Business SQL plan",
    result: bridge(approvedProposal),
    assert: (result) => {
      const measure = result.plan?.measures[0];
      const sort = result.plan?.orderBy[0];
      return [
        ...(approvedProposal.support === "supported" ? [] : ["Expected approved proposal to be supported."]),
        ...(approvedProposal.confidence === "high" ? [] : ["Expected approved proposal to be high confidence."]),
        ...(approvedProposal.metrics.length === 1 ? [] : ["Expected approved question to ground exactly one metric."]),
        ...(approvedProposal.metrics[0]?.kind === "sum" ? [] : ["Expected approved metric kind to be sum."]),
        ...(approvedProposal.metrics.some((metric) => metric.kind === "maximum")
          ? ["Highest should drive ordering, not add a maximum metric."]
          : []),
        ...(approvedProposal.detectedIntent.analysisPath?.aggregation === "sum"
          ? []
          : ["Expected approved question to ground to sum aggregation."]),
        ...(approvedProposal.detectedIntent.analysisPath?.measureField === "salary"
          ? []
          : ["Expected approved question to ground salary as measure field."]),
        ...(approvedProposal.detectedIntent.analysisPath?.groupingField === "department"
          ? []
          : ["Expected approved question to ground department as grouping field."]),
        ...(approvedProposal.detectedIntent.analysisPath?.orderDirection === "descending"
          ? []
          : ["Expected approved question to ground descending order."]),
        ...(approvedProposal.detectedIntent.analysisPath?.rowLimit === 5
          ? []
          : ["Expected approved question to ground row limit 5."]),
        ...(result.state === "render_ready_plan" ? [] : ["Expected approved bridge result to be render_ready_plan."]),
        ...(result.readiness?.status === "renderable" ? [] : ["Expected approved bridge readiness to be renderable."]),
        ...(result.plan?.support === "supported" ? [] : ["Expected approved plan support to be supported."]),
        ...(result.plan?.renderer.status === "renderable" ? [] : ["Expected approved renderer status to be renderable."]),
        ...(result.plan?.measures.length === 1 ? [] : ["Expected approved Business SQL plan to contain exactly one measure."]),
        ...(measure?.kind === "sum" && measure.field === "salary"
          ? []
          : ["Expected one sum salary measure."]),
        ...(measure?.sqlAlias === "total_salary_expenditure"
          ? []
          : ["Expected readable deterministic total_salary_expenditure alias."]),
        ...(measure?.measureId ? [] : ["Expected stable measure id."]),
        ...(result.plan?.groupings[0]?.field === "department"
          ? []
          : ["Expected department grouping."]),
        ...(sort?.target.kind === "measure" && sort.target.measureId === measure?.measureId && sort.direction === "desc"
          ? []
          : ["Expected descending sort by measure id."]),
        ...(result.plan?.rowLimit?.value === 5 ? [] : ["Expected row limit 5."]),
        ...(result.plan?.joinPath.status === "not_required" ? [] : ["Expected existing no-join path to be preserved."]),
        ...expectNoExecutionSurface(result),
      ];
    },
  },
  {
    name: "lowest total cost carries one sum cost measure and ascending sort",
    result: bridge(lowestTotalCostProposal),
    assert: (result) => {
      const measure = result.plan?.measures[0];
      const sort = result.plan?.orderBy[0];
      return [
        ...(lowestTotalCostProposal.support === "supported" ? [] : ["Expected lowest total cost proposal to be supported."]),
        ...(lowestTotalCostProposal.metrics.length === 1 ? [] : ["Expected lowest total cost to ground exactly one metric."]),
        ...(lowestTotalCostProposal.metrics[0]?.kind === "sum" ? [] : ["Expected lowest total cost metric kind to be sum."]),
        ...(lowestTotalCostProposal.metrics.some((metric) => metric.kind === "minimum")
          ? ["Lowest total cost should order ascending, not add a minimum metric."]
          : []),
        ...(result.state === "render_ready_plan" ? [] : ["Expected lowest total cost bridge result to be render_ready_plan."]),
        ...(result.readiness?.status === "renderable" ? [] : ["Expected lowest total cost bridge readiness to be renderable."]),
        ...(result.plan?.renderer.status === "renderable" ? [] : ["Expected lowest total cost renderer status to be renderable."]),
        ...(result.plan?.measures.length === 1 ? [] : ["Expected one Business SQL measure."]),
        ...(measure?.kind === "sum" && measure.field === "cost"
          ? []
          : ["Expected one sum cost measure."]),
        ...(measure?.sqlAlias === "total_cost" ? [] : ["Expected total_cost SQL alias."]),
        ...(result.plan?.groupings[0]?.field === "department"
          ? []
          : ["Expected department grouping."]),
        ...(sort?.target.kind === "measure" && sort.target.measureId === measure?.measureId && sort.direction === "asc"
          ? []
          : ["Expected ascending sort by sum cost measure id."]),
        ...(result.plan?.rowLimit === null ? [] : ["Expected no row limit without an explicit limit."]),
        ...expectNoExecutionSurface(result),
      ];
    },
  },
  {
    name: "highest average salary carries one average salary measure and descending sort",
    result: bridge(highestAverageSalaryProposal),
    assert: (result) => {
      const measure = result.plan?.measures[0];
      const sort = result.plan?.orderBy[0];
      return [
        ...(highestAverageSalaryProposal.metrics.length === 1 ? [] : ["Expected highest average salary to ground exactly one metric."]),
        ...(highestAverageSalaryProposal.metrics[0]?.kind === "average" ? [] : ["Expected average metric kind."]),
        ...(highestAverageSalaryProposal.metrics.some((metric) => metric.kind === "maximum")
          ? ["Highest average salary should order descending, not add a maximum metric."]
          : []),
        ...(result.state === "render_ready_plan" ? [] : ["Expected highest average salary bridge result to be render_ready_plan."]),
        ...(measure?.kind === "average" && measure.field === "salary"
          ? []
          : ["Expected one average salary measure."]),
        ...(sort?.target.kind === "measure" && sort.target.measureId === measure?.measureId && sort.direction === "desc"
          ? []
          : ["Expected descending sort by average salary measure id."]),
        ...expectNoExecutionSurface(result),
      ];
    },
  },
  {
    name: "PS-2c primary revenue threshold bridges to stable measureId and deterministic HAVING preview",
    result: bridge(revenueThresholdProposal),
    assert: (result) => {
      const measure = result.plan?.measures[0];
      const condition = result.plan?.aggregateResultConditions[0];
      const preview = result.plan ? createBusinessSqlRenderPreview(result.plan) : null;
      const expectedSql = [
        "SELECT",
        '  "sales"."region" AS "region",',
        '  SUM("sales"."revenue") AS "total_revenue"',
        'FROM "sales"',
        'GROUP BY "sales"."region"',
        'HAVING SUM("sales"."revenue") > 500000',
        'ORDER BY "total_revenue" DESC;',
      ].join("\n");
      return [
        ...(revenueThresholdProposal.aggregateResultConditions.length === 1
          ? []
          : ["Expected proposal to contain one aggregate-result condition."]),
        ...(result.state === "render_ready_plan" ? [] : ["Expected render-ready bridge result."]),
        ...(measure?.kind === "sum" && measure.field === "revenue"
          ? []
          : ["Expected SUM revenue measure."]),
        ...(condition?.measureId === measure?.measureId
          ? []
          : ["Expected condition to reference final stable measureId."]),
        ...(condition?.measureId &&
        condition.measureId !== measure?.sqlAlias &&
        condition.measureId !== measure?.label &&
        !condition.measureId.match(/^\d+$/)
          ? []
          : ["Condition must not reference alias label or array index."]),
        ...(condition?.operator === "greater_than" && condition.comparisonValue.value === 500000
          ? []
          : ["Expected greater_than 500000 condition."]),
        ...(preview?.sql === expectedSql ? [] : ["Expected deterministic revenue HAVING SQL."]),
        ...(preview?.actions.canInsertSql === false && preview.actions.canRunSql === false
          ? []
          : ["Preview must remain manual with no insert or run action."]),
        ...expectNoExecutionSurface(result),
      ];
    },
  },
  {
    name: "PS-2c salary healthcare and count questions reuse the same bridge contracts",
    result: bridge(salaryThresholdProposal),
    assert: () => {
      const salary = bridge(salaryThresholdProposal);
      const stay = bridge(stayThresholdProposal);
      const count = bridge(countThresholdProposal);
      const customerCount = bridge(customerCountThresholdProposal);
      const salarySql = salary.plan ? createBusinessSqlRenderPreview(salary.plan).sql : null;
      const staySql = stay.plan ? createBusinessSqlRenderPreview(stay.plan).sql : null;
      const countSql = count.plan ? createBusinessSqlRenderPreview(count.plan).sql : null;
      const customerCountSql = customerCount.plan ? createBusinessSqlRenderPreview(customerCount.plan).sql : null;
      const countMeasure = count.plan?.measures[0];
      const countCondition = count.plan?.aggregateResultConditions[0];
      const expectedSalarySql = [
        "SELECT",
        '  "employees"."department" AS "department",',
        '  SUM("employees"."salary") AS "total_salary_expenditure"',
        'FROM "employees"',
        'GROUP BY "employees"."department"',
        'HAVING SUM("employees"."salary") > 500000',
        'ORDER BY "total_salary_expenditure" DESC;',
      ].join("\n");
      const expectedStaySql = [
        "SELECT",
        '  "stays"."hospital_unit" AS "hospital_unit",',
        '  AVG("stays"."length_of_stay") AS "average_length_of_stay"',
        'FROM "stays"',
        'GROUP BY "stays"."hospital_unit"',
        'HAVING AVG("stays"."length_of_stay") > 5',
        'ORDER BY "average_length_of_stay" DESC;',
      ].join("\n");
      const expectedCountSql = [
        "SELECT",
        '  "employees"."department" AS "department",',
        '  COUNT("employees"."employee_id") AS "count_employees"',
        'FROM "employees"',
        'GROUP BY "employees"."department"',
        'HAVING COUNT("employees"."employee_id") > 10',
        'ORDER BY "count_employees" DESC;',
      ].join("\n");
      const expectedCustomerCountSql = [
        "SELECT",
        '  "customers"."region" AS "region",',
        '  COUNT("customers"."customer_id") AS "count_customers"',
        'FROM "customers"',
        'GROUP BY "customers"."region"',
        'HAVING COUNT("customers"."customer_id") > 100',
        'ORDER BY "count_customers" DESC;',
      ].join("\n");
      return [
        ...(salary.plan?.aggregateResultConditions.length === 1 &&
        stay.plan?.aggregateResultConditions.length === 1 &&
        count.plan?.aggregateResultConditions.length === 1 &&
        customerCount.plan?.aggregateResultConditions.length === 1
          ? []
          : ["Expected one aggregate-result condition for each cross-domain plan."]),
        ...(count.plan?.groupings.length === 1 ? [] : ["Expected count flow to contain exactly one grouping."]),
        ...(count.plan?.measures.length === 1 && countMeasure?.kind === "count_entities"
          ? []
          : ["Expected count flow to contain exactly one count measure."]),
        ...(countCondition?.comparisonValue.value === 10
          ? []
          : ["Expected count threshold value 10."]),
        ...(countCondition?.measureId === countMeasure?.measureId
          ? []
          : ["Expected count condition to reference final stable measureId."]),
        ...(salarySql === expectedSalarySql ? [] : ["Expected deterministic salary HAVING SQL."]),
        ...(staySql === expectedStaySql ? [] : ["Expected deterministic healthcare AVG HAVING SQL."]),
        ...(countSql === expectedCountSql ? [] : ["Expected deterministic count HAVING SQL."]),
        ...(customerCountSql === expectedCustomerCountSql
          ? []
          : ["Expected deterministic generic customer count HAVING SQL."]),
        ...expectNoExecutionSurface(salary),
        ...expectNoExecutionSurface(stay),
        ...expectNoExecutionSurface(count),
        ...expectNoExecutionSurface(customerCount),
      ];
    },
  },
  {
    name: "PS-2c comma and decimal thresholds bridge to deterministic HAVING SQL",
    result: bridge(revenueCommaThresholdProposal),
    assert: () => {
      const revenue = bridge(revenueCommaThresholdProposal);
      const stay = bridge(stayDecimalThresholdProposal);
      const revenueCondition = revenue.plan?.aggregateResultConditions[0];
      const stayCondition = stay.plan?.aggregateResultConditions[0];
      const revenueSql = revenue.plan ? createBusinessSqlRenderPreview(revenue.plan).sql : null;
      const staySql = stay.plan ? createBusinessSqlRenderPreview(stay.plan).sql : null;
      return [
        ...(revenue.state === "render_ready_plan" ? [] : ["Expected comma revenue threshold to be render-ready."]),
        ...(revenueCondition?.operator === "greater_than" &&
        revenueCondition.comparisonValue.value === 500000
          ? []
          : ["Expected comma revenue threshold value 500000."]),
        ...(revenueSql?.includes('HAVING SUM("sales"."revenue") > 500000')
          ? []
          : ["Expected comma revenue HAVING SQL with normalized number."]),
        ...(stay.state === "render_ready_plan" ? [] : ["Expected decimal stay threshold to be render-ready."]),
        ...(stayCondition?.operator === "greater_than" &&
        stayCondition.comparisonValue.value === 10.5
          ? []
          : ["Expected decimal stay threshold value 10.5."]),
        ...(staySql?.includes('HAVING AVG("stays"."length_of_stay") > 10.5')
          ? []
          : ["Expected decimal stay HAVING SQL with decimal value."]),
        ...expectNoExecutionSurface(revenue),
        ...expectNoExecutionSurface(stay),
      ];
    },
  },
  {
    name: "PS-2c malformed numeric threshold prompts produce no condition or SQL",
    result: bridge(proposalForQuestion("Show regions whose total revenue is above 1,23.", salesWorksheet)),
    assert: () => {
      const malformedCases: Array<
        [
          string,
          Pick<WorksheetMetadata, "worksheetId" | "displayName" | "sheetName" | "tableName" | "schema">,
        ]
      > = [
        ["Show regions whose total revenue is above 1,23.", salesWorksheet],
        ["Show regions whose total revenue is above 10.5.5.", salesWorksheet],
        ["Show regions whose total revenue is above 5%.", salesWorksheet],
        ["Show regions whose total revenue is above 5 million.", salesWorksheet],
        ["Show regions whose total revenue is above 5 + 1.", salesWorksheet],
        ["Show regions whose total revenue is above 10 * 2.", salesWorksheet],
        ["Show regions whose total revenue is above 5 days.", salesWorksheet],
        ["Show regions whose total revenue is above 10 hours.", salesWorksheet],
        ["Show hospital units whose average length of stay is above 5 days.", healthcareWorksheet],
        ["Show regions whose total revenue is above 20 kg.", salesWorksheet],
      ];
      return malformedCases.flatMap(([prompt, worksheet]) => {
        const proposal = proposalForQuestion(prompt, worksheet);
        const result = bridge(proposal);
        const preview = result.plan ? createBusinessSqlRenderPreview(result.plan) : null;
        return [
          ...(proposal.aggregateResultConditions.length === 0
            ? []
            : [`Expected malformed threshold to create no condition: ${prompt}`]),
          ...(result.state !== "render_ready_plan"
            ? []
            : [`Expected malformed threshold not to be render-ready: ${prompt}`]),
          ...(preview?.sql === null || result.plan === null
            ? []
            : [`Expected malformed threshold to produce no SQL: ${prompt}`]),
          ...expectNoExecutionSurface(result),
        ];
      });
    },
  },
  {
    name: "PS-2c bridge rejects unresolved proposed metric references",
    result: bridge({
      ...baseProposal(),
      aggregateResultConditions: [
        {
          id: "aggregate-condition:missing",
          metricId: "metric:missing",
          operator: "greater_than",
          comparisonValue: { kind: "number", value: 5 },
          confidence: "high",
        },
      ],
    }),
    assert: (result) => [
      ...(result.state === "blocked_plan" ? [] : ["Expected unresolved metric reference to block."]),
      ...(result.issues.some((issue) => issue.code === "unresolved_metric_reference")
        ? []
        : ["Expected unresolved_metric_reference issue."]),
      ...expectNoExecutionSurface(result),
    ],
  },
  {
    name: "PS-5c raw-field threshold bridges to deterministic WHERE without aggregate HAVING",
    result: bridge(rawFieldThresholdProposal),
    assert: (result) => {
      const preview = result.plan ? createBusinessSqlRenderPreview(result.plan) : null;
      const commaResult = bridge(rawFieldCommaThresholdProposal);
      const commaPreview = commaResult.plan ? createBusinessSqlRenderPreview(commaResult.plan) : null;
      return [
        ...(rawFieldThresholdProposal.aggregateResultConditions.length === 0
          ? []
          : ["Expected raw-field threshold proposal to have no aggregate condition."]),
        ...(rawFieldThresholdProposal.filters[0]?.semantics === "canonical"
          ? []
          : ["Expected raw-field threshold proposal to have a canonical row filter."]),
        ...(result.state === "render_ready_plan" ? [] : ["Expected raw-field threshold to be render-ready."]),
        ...(preview?.sql?.includes('WHERE "sales"."revenue" > 500000') &&
        !preview.sql.includes("HAVING")
          ? []
          : ["Expected raw-field threshold WHERE SQL without HAVING."]),
        ...(rawFieldCommaThresholdProposal.aggregateResultConditions.length === 0
          ? []
          : ["Expected raw-field comma threshold proposal to have no aggregate condition."]),
        ...(commaPreview?.sql?.includes('WHERE "sales"."revenue" > 500000') &&
        !commaPreview.sql.includes("HAVING")
          ? []
          : ["Expected raw-field comma threshold WHERE SQL without HAVING."]),
        ...expectNoExecutionSurface(result),
        ...expectNoExecutionSurface(commaResult),
      ];
    },
  },
  {
    name: "verified relationship resolves through accepted contracts",
    result: bridge(ordersPerCustomerProposal(), [customersOrdersContract]),
    assert: (result) => [
      ...(result.plan?.joinPath.status === "resolved" ? [] : ["Expected resolved join path."]),
      ...(result.plan?.joinPath.edges.every((edge) => edge.verified)
        ? []
        : ["Expected verified join edges."]),
      ...expectNoExecutionSurface(result),
    ],
  },
  {
    name: "known safe shape can produce render-ready plan",
    result: bridge(baseProposal()),
    assert: (result) => [
      ...(result.state === "render_ready_plan" ? [] : ["Expected render_ready_plan."]),
      ...(result.readiness?.status === "renderable" ? [] : ["Expected renderable readiness."]),
      ...(result.plan?.renderer.status === "renderable" ? [] : ["Expected renderable renderer status."]),
      ...expectNoExecutionSurface(result),
    ],
  },
  {
    name: "bridge never renders SQL",
    result: bridge(baseProposal()),
    assert: expectNoExecutionSurface,
  },
  {
    name: "bridge never inserts SQL",
    result: bridge(baseProposal()),
    assert: (result) => [
      ...(result.noInsertPerformed === true ? [] : ["Expected no insert."]),
      ...(result.plan?.renderer.notes.some((note) => note.includes("inserted"))
        ? []
        : ["Expected no-insert renderer note."]),
      ...expectNoExecutionSurface(result),
    ],
  },
  {
    name: "bridge never runs SQL",
    result: bridge(baseProposal()),
    assert: (result) => [
      ...(result.noRunPerformed === true ? [] : ["Expected no run."]),
      ...(result.plan?.renderer.notes.some((note) => note.includes("run"))
        ? []
        : ["Expected no-run renderer note."]),
      ...expectNoExecutionSurface(result),
    ],
  },
  {
    name: "original adaptive proposal is not mutated",
    result: (() => {
      const proposal = ordersPerCustomerProposal();
      const before = JSON.stringify(proposal);
      const result = bridge(proposal, [customersOrdersContract]);
      return JSON.stringify(proposal) === before
        ? result
        : {
            ...result,
            state: "blocked_plan" as const,
            issues: [
              ...result.issues,
              {
                code: "invariant_violation" as const,
                severity: "blocking" as const,
                message: "Proposal was mutated.",
              },
            ],
          };
    })(),
    assert: (result) => [
      ...(result.issues.some((issue) => issue.message === "Proposal was mutated.")
        ? ["Proposal was mutated."]
        : []),
      ...expectNoExecutionSurface(result),
    ],
  },
  {
    name: "proposal renderer sql invariant violation blocks conversion",
    result: bridge(
      withProposal({
        sql: "SELECT 1;" as never,
      }),
    ),
    assert: (result) => [
      ...(result.state === "blocked_plan" ? [] : ["Expected blocked_plan."]),
      ...(result.issues.some((issue) => issue.code === "invariant_violation")
        ? []
        : ["Expected invariant violation issue."]),
      ...expectNoExecutionSurface(result),
    ],
  },
  {
    name: "existing Business SQL readiness renderer preview contracts remain isolated",
    result: bridge(ordersPerCustomerProposal(), [customersOrdersContract]),
    assert: (result) => [
      ...(result.plan?.renderer.status === "renderable" ? [] : ["Expected readiness-applied plan."]),
      ...(result.plan?.renderer.sql ? ["Bridge must not add rendered SQL."] : []),
      ...expectNoExecutionSurface(result),
    ],
  },
];

export function runAdaptiveProposalBusinessSqlBridgeFixtures(): AdaptiveProposalBusinessSqlBridgeFixtureReport {
  const results = fixtures.map((fixture) => {
    const failureReasons = fixture.assert(fixture.result);
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

export const allAdaptiveProposalBusinessSqlBridgeFixturesPass = (): boolean =>
  runAdaptiveProposalBusinessSqlBridgeFixtures().failed.length === 0;
