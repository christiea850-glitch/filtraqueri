/**
 * T-13M-1 - Adaptive Report Proposal foundation fixtures.
 *
 * Pure fixture runner only. No SQL generation, SQL rendering, Monaco insertion,
 * Run Query calls, backend/API calls, provider calls, LLM calls, or ranking changes.
 */

import type { SchemaColumn } from "../../../dataset/datasetTypes";
import type {
  AcceptedRelationshipContract,
  AnalysisScopeSelection,
  WorksheetMetadata,
} from "../../../workbook";
import type { BusinessIntent } from "../businessIntentGrounding";
import { detectBusinessIntent } from "../businessIntentGrounding";
import {
  EMPTY_ADAPTIVE_REPORT_PROPOSAL,
  detectAggregateThresholdMatches,
  parseAggregateThresholdNumber,
  proposeAdaptiveReport,
  type AdaptiveReportProposal,
  type AdaptiveReportProposalRequest,
} from "../adaptiveReportProposal";

type FixtureResult = {
  name: string;
  ok: boolean;
  failureReasons: string[];
};

export type AdaptiveReportProposalFixtureReport = {
  results: FixtureResult[];
  passed: FixtureResult[];
  failed: FixtureResult[];
};

type Fixture = {
  name: string;
  request: AdaptiveReportProposalRequest;
  assert: (proposal: AdaptiveReportProposal) => string[];
};

const column = (
  name: string,
  inferred_type: SchemaColumn["inferred_type"] = "text",
): SchemaColumn => ({
  name,
  type: inferred_type,
  inferred_type,
  null_count: 0,
  unique_count: 10,
  sample_values: [],
});

const worksheet = (
  tableName: string,
  schema: SchemaColumn[],
): Pick<WorksheetMetadata, "worksheetId" | "displayName" | "sheetName" | "tableName" | "schema"> => ({
  worksheetId: `worksheet:${tableName}`,
  displayName: tableName,
  sheetName: tableName,
  tableName,
  schema,
});

const scope = (...tableNames: string[]): AnalysisScopeSelection[] =>
  tableNames.map((tableName) => ({
    worksheetId: `worksheet:${tableName}`,
    sourceType: "original",
    tableName,
    originalTableName: tableName,
  }));

const contract = (
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

const intent = (overrides: Partial<BusinessIntent>): BusinessIntent => ({
  primaryIntent: "count_grouping",
  alternates: [],
  entities: [],
  metrics: [],
  grouping: [],
  relationshipPredicate: null,
  explicitlyTemporal: false,
  detectorVersion: "v1",
  ...overrides,
});

const expectNoExecutableSurface = (proposal: AdaptiveReportProposal): string[] => [
  ...(proposal.proposalKind === "adaptive" ? [] : ["proposalKind must be adaptive."]),
  ...(proposal.sql === null ? [] : ["Adaptive proposal must not expose SQL."]),
  ...(proposal.renderer.status === "not_rendered" ? [] : ["Renderer status must stay not_rendered."]),
  ...(proposal.renderer.canRender === false ? [] : ["Renderer canRender must stay false."]),
  ...(proposal.canRenderSql === false ? [] : ["canRenderSql must stay false."]),
  ...(proposal.canInsertSql === false ? [] : ["canInsertSql must stay false."]),
  ...(proposal.canRunSql === false ? [] : ["canRunSql must stay false."]),
  ...(proposal.llmReadiness.safeToOfferFallback === false
    ? []
    : ["LLM fallback must stay disabled in v1."]),
  ...(proposal.llmReadiness.payloadShape === "metadata_only"
    ? []
    : ["LLM payload shape must be metadata_only."]),
];

const expectNoRawValues = (proposal: AdaptiveReportProposal): string[] => {
  const serialized = JSON.stringify(proposal);
  return [/sample_values/i, /sampleValues/i, /rawRows/i, /cellValues/i].some((pattern) =>
    pattern.test(serialized),
  )
    ? ["Proposal must not represent raw rows, sample values, or cell values."]
    : [];
};

const expectFilterColumn = (
  proposal: AdaptiveReportProposal,
  filterId: string,
  columnName: string,
): string[] => {
  const filter = proposal.filters.find((item) => item.id === filterId);
  if (!filter) return [`Expected filter ${filterId}.`];
  return filter.columnName === columnName
    ? []
    : [`Expected filter ${filterId} to bind ${columnName}; got ${filter.columnName || "none"}.`];
};

const expectMetricColumn = (
  proposal: AdaptiveReportProposal,
  label: string,
  columnName: string,
): string[] => {
  const metric = proposal.metrics.find((item) => item.label === label);
  if (!metric) return [`Expected metric ${label}.`];
  return metric.columnName === columnName
    ? []
    : [`Expected metric ${label} to bind ${columnName}; got ${metric.columnName || "none"}.`];
};

const expectGroupingColumn = (
  proposal: AdaptiveReportProposal,
  label: string,
  columnName: string,
): string[] => {
  const grouping = proposal.groupings.find((item) => item.label === label);
  if (!grouping) return [`Expected grouping ${label}.`];
  return grouping.columnName === columnName
    ? []
    : [`Expected grouping ${label} to bind ${columnName}; got ${grouping.columnName || "none"}.`];
};

const expectGeneratedSemanticHint = (
  proposal: AdaptiveReportProposal,
  columnName: string,
): string[] =>
  proposal.semanticHints.some((hint) => hint.columnName === columnName)
    ? []
    : [`Expected generated semantic hint for ${columnName}.`];

const salesRequest: AdaptiveReportProposalRequest = {
  prompt: "Which customers have the most orders and payments?",
  detectedIntent: intent({
    entities: ["customers", "orders", "payments"],
    metrics: ["count_orders", "total_payment_amount"],
    grouping: ["customer"],
  }),
  appliedScopeSelections: scope("customers", "orders", "payments"),
  worksheets: [
    worksheet("customers", [column("customer_id"), column("customer_name")]),
    worksheet("orders", [column("order_id"), column("customer_id"), column("order_total", "numeric")]),
    worksheet("payments", [column("payment_id"), column("customer_id"), column("payment_amount", "numeric")]),
  ],
  acceptedRelationshipContracts: [
    contract("customers", "customer_id", "orders", "customer_id"),
    contract("customers", "customer_id", "payments", "customer_id"),
  ],
};

const semanticBindingRequest = (
  prompt: string,
  detectedIntent: BusinessIntent,
  worksheets: AdaptiveReportProposalRequest["worksheets"],
  contracts: AcceptedRelationshipContract[] = [],
): AdaptiveReportProposalRequest => ({
  prompt,
  detectedIntent,
  appliedScopeSelections: scope(...(worksheets || []).map((item) => item.tableName)),
  worksheets,
  acceptedRelationshipContracts: contracts,
});

const realPromptRequest = (
  prompt: string,
  tableNames: string[],
  dateTables: readonly string[] = [],
): AdaptiveReportProposalRequest => ({
  prompt,
  detectedIntent: detectBusinessIntent(prompt),
  appliedScopeSelections: scope(...tableNames),
  worksheets: tableNames.map((tableName) =>
    worksheet(tableName, [
      column(`${tableName.replace(/s$/, "")}_id`),
      column("status", "categorical"),
      ...(dateTables.includes(tableName) ? [column("event_date", "date")] : []),
    ]),
  ),
});

const realPromptRequests: AdaptiveReportProposalRequest[] = [
  realPromptRequest(
    "find how current tenants are using their access code and if expired tenants still have access in each unit in the properties to identify security gap",
    ["tenants", "access_codes", "units", "properties"],
    ["tenants"],
  ),
  realPromptRequest("which customers have orders but no recent payments", [
    "customers",
    "orders",
    "payments",
  ], ["payments"]),
  realPromptRequest("which products are low stock but still selling fast", [
    "products",
    "stock",
    "orders",
  ]),
  realPromptRequest("which accounts have many unresolved tickets", [
    "accounts",
    "tickets",
  ]),
  realPromptRequest("which invoices are overdue by customer and payment status", [
    "invoices",
    "customers",
    "payments",
  ], ["invoices"]),
  realPromptRequest(
    "show employee headcount by department and identify departments with high turnover",
    ["employees", "departments"],
  ),
  realPromptRequest("which patients had repeat visits within 30 days by provider", [
    "patients",
    "visits",
    "providers",
  ], ["visits"]),
];

const hasBoundPromptEntity = (proposal: AdaptiveReportProposal): boolean =>
  proposal.entities.some(
    (entity) => entity.binding === "exact" || entity.binding === "similar",
  );

const hasMeaningfulSignal = (proposal: AdaptiveReportProposal): boolean =>
  proposal.detectedIntent.explicitlyTemporal ||
  proposal.detectedIntent.grouping.length > 0 ||
  proposal.filters.length > 0 ||
  proposal.detectedIntent.metrics.length > 0 ||
  proposal.detectedIntent.primaryIntent === "filtering" ||
  proposal.detectedIntent.primaryIntent === "risk";

const fixtures: Fixture[] = [
  {
    name: "PS-2c aggregate threshold phrases map deterministically to all six operators",
    request: salesRequest,
    assert: () => {
      const cases = [
        ["above 5", "greater_than"],
        ["over 5", "greater_than"],
        ["greater than 5", "greater_than"],
        ["more than 5", "greater_than"],
        ["at least 5", "greater_than_or_equal"],
        ["no less than 5", "greater_than_or_equal"],
        ["below 5", "less_than"],
        ["under 5", "less_than"],
        ["less than 5", "less_than"],
        ["fewer than 5", "less_than"],
        ["at most 5", "less_than_or_equal"],
        ["no more than 5", "less_than_or_equal"],
        ["equal to 5", "equals"],
        ["equals 5", "equals"],
        ["not equal to 5", "not_equals"],
        ["different from 5", "not_equals"],
      ] as const;
      return cases.flatMap(([phrase, operator]) => {
        const detected = detectAggregateThresholdMatches(`show groups whose metric is ${phrase}`);
        return detected.length === 1 && detected[0].operator === operator
          ? []
          : [`Expected ${phrase} to map to ${operator}.`];
      });
    },
  },
  {
    name: "PS-2c numeric aggregate thresholds preserve integers decimals and separators",
    request: salesRequest,
    assert: () => {
      const cases = [
        ["500000", 500000],
        ["500,000", 500000],
        ["10.5", 10.5],
      ] as const;
      return cases.flatMap(([raw, expected]) => {
        const parsed = parseAggregateThresholdNumber(raw);
        return parsed?.kind === "number" && parsed.value === expected
          ? []
          : [`Expected ${raw} to parse as ${expected}.`];
      });
    },
  },
  {
    name: "PS-2c full threshold phrase detection validates complete numeric tokens",
    request: salesRequest,
    assert: () => {
      const validCases = [
        ["above 500000", "greater_than", 500000],
        ["above 500,000", "greater_than", 500000],
        ["above 10.5", "greater_than", 10.5],
        ["above 500,000.25", "greater_than", 500000.25],
        ["at least 1,000", "greater_than_or_equal", 1000],
        ["no more than 10.5", "less_than_or_equal", 10.5],
        ["not equal to 1,250", "not_equals", 1250],
        ["above 500,000?", "greater_than", 500000],
        ["above 10.5,", "greater_than", 10.5],
        ["above 5.", "greater_than", 5],
        ["above 10.5?", "greater_than", 10.5],
        ["above 500,000;", "greater_than", 500000],
        ["more than 10 employees", "greater_than", 10],
        ["fewer than 5 accounts", "less_than", 5],
        ["at least 20 orders", "greater_than_or_equal", 20],
        ["more than 100 customers", "greater_than", 100],
      ] as const;
      const invalidCases = [
        "above 1,23",
        "above 10.5.5",
        "above 500,00",
        "above 1,000,00",
        "above 5%",
        "above 10.5%",
        "above 500k",
        "above $500",
        "above 500 USD",
        "above NaN",
        "above Infinity",
        "above -Infinity",
        "above 5 million",
        "above 5 millions",
        "above 2 billion",
        "above 10 thousand",
        "above 1m",
        "above 3bn",
        "above 5 + 1",
        "above 10 - 2",
        "above 4 * 3",
        "above 20 / 5",
        "above 2 ^ 3",
        "above 5 days",
        "above 10 hours",
        "above 20 kg",
        "above 5 miles",
        "above 3 weeks",
        "above 50 pounds",
        "above 5 DAYS",
        "above 10 hrs",
        "above 5 km",
      ];
      return [
        ...validCases.flatMap(([phrase, operator, value]) => {
          const detected = detectAggregateThresholdMatches(
            `show groups whose metric is ${phrase}`,
          );
          return detected.length === 1 &&
            detected[0].operator === operator &&
            detected[0].comparisonValue.value === value
            ? []
            : [`Expected ${phrase} to map to ${operator} ${value}.`];
        }),
        ...invalidCases.flatMap((phrase) => {
          const detected = detectAggregateThresholdMatches(
            `show groups whose metric is ${phrase}`,
          );
          return detected.length === 0
            ? []
            : [`Expected ${phrase} to produce no threshold match.`];
        }),
      ];
    },
  },
  {
    name: "PS-2c ungrounded count-threshold noun does not create a guessed count metric",
    request: {
      prompt: "Show departments with more than 10 widgets.",
      detectedIntent: detectBusinessIntent("Show departments with more than 10 widgets."),
      appliedScopeSelections: scope("employees"),
      worksheets: [
        worksheet("employees", [
          column("employee_id", "text"),
          column("department", "categorical"),
          column("salary", "numeric"),
        ]),
      ],
    },
    assert: (proposal) => [
      ...(proposal.metrics.some((metric) => metric.id === "metric:count-widgets")
        ? ["Ungrounded trailing noun must not create a guessed count_widgets metric."]
        : []),
      ...(proposal.aggregateResultConditions.length === 0
        ? []
        : ["Ungrounded trailing noun must not create an aggregate-result condition."]),
      ...(proposal.support !== "supported"
        ? []
        : ["Ungrounded trailing noun threshold must not be supported as a renderable proposal."]),
      ...expectNoExecutableSurface(proposal),
    ],
  },
  {
    name: "PS-2c invalid numeric aggregate thresholds do not create a condition",
    request: {
      prompt: "Show regions whose total revenue is above NaN.",
      detectedIntent: detectBusinessIntent("Show regions whose total revenue is above NaN."),
      appliedScopeSelections: scope("sales"),
      worksheets: [
        worksheet("sales", [
          column("region", "categorical"),
          column("revenue", "numeric"),
        ]),
      ],
    },
    assert: (proposal) => [
      ...(proposal.aggregateResultConditions.length === 0
        ? []
        : ["Expected invalid numeric threshold not to create a condition."]),
      ...(proposal.canRenderSql === false && proposal.sql === null
        ? []
        : ["Invalid numeric threshold proposal must not expose SQL capability."]),
      ...expectNoExecutableSurface(proposal),
    ],
  },
  {
    name: "PS-2c primary revenue question grounds one grouping metric and aggregate condition",
    request: {
      prompt: "Show regions whose total revenue is above 500000.",
      detectedIntent: detectBusinessIntent("Show regions whose total revenue is above 500000."),
      appliedScopeSelections: scope("sales"),
      worksheets: [
        worksheet("sales", [
          column("region", "categorical"),
          column("revenue", "numeric"),
        ]),
      ],
    },
    assert: (proposal) => {
      const condition = proposal.aggregateResultConditions[0];
      return [
        ...(proposal.metrics.length === 1 ? [] : ["Expected one grounded metric."]),
        ...(proposal.metrics[0]?.kind === "sum" && proposal.metrics[0]?.columnName === "revenue"
          ? []
          : ["Expected SUM revenue metric."]),
        ...(proposal.groupings.length === 1 && proposal.groupings[0]?.columnName === "region"
          ? []
          : ["Expected region grouping."]),
        ...(proposal.aggregateResultConditions.length === 1
          ? []
          : ["Expected one aggregate-result condition."]),
        ...(condition?.metricId === proposal.metrics[0]?.id
          ? []
          : ["Expected condition to reference proposed metric id."]),
        ...(condition?.operator === "greater_than" && condition.comparisonValue.value === 500000
          ? []
          : ["Expected greater_than 500000 threshold."]),
        ...expectNoExecutableSurface(proposal),
      ];
    },
  },
  {
    name: "PS-5c raw-field threshold question becomes a canonical row-filter proposal",
    request: {
      prompt: "Show sales rows where revenue is above 500000.",
      detectedIntent: detectBusinessIntent("Show sales rows where revenue is above 500000."),
      appliedScopeSelections: scope("sales"),
      worksheets: [
        worksheet("sales", [
          column("region", "categorical"),
          column("revenue", "numeric"),
        ]),
      ],
    },
    assert: (proposal) => [
      ...(proposal.aggregateResultConditions.length === 0
        ? []
        : ["Expected raw-field threshold not to create aggregate-result condition."]),
      ...(proposal.support === "supported"
        ? []
        : ["Expected raw-field threshold row filter to be supported."]),
      ...(proposal.filters.length === 1 &&
      proposal.filters[0].semantics === "canonical" &&
      proposal.filters[0].operator === "greater_than" &&
      proposal.filters[0].comparisonValue?.kind === "number" &&
      proposal.filters[0].comparisonValue.value === 500000
        ? []
        : ["Expected one canonical numeric row filter."]),
      ...expectNoExecutableSurface(proposal),
    ],
  },
  {
    name: "PS-2c multiple thresholds are not silently reduced to one condition",
    request: {
      prompt: "Show regions whose total revenue is above 500000 and below 900000.",
      detectedIntent: detectBusinessIntent(
        "Show regions whose total revenue is above 500000 and below 900000.",
      ),
      appliedScopeSelections: scope("sales"),
      worksheets: [
        worksheet("sales", [
          column("region", "categorical"),
          column("revenue", "numeric"),
        ]),
      ],
    },
    assert: (proposal) => [
      ...(proposal.aggregateResultConditions.length === 0
        ? []
        : ["Expected multiple thresholds not to produce a partial one-condition proposal."]),
      ...(proposal.support === "unsupported"
        ? []
        : ["Expected multiple thresholds to block through proposal support."]),
      ...expectNoExecutableSurface(proposal),
    ],
  },
  {
    name: "sales customers orders payments adaptive proposal",
    request: salesRequest,
    assert: (proposal) => [
      ...(proposal.support === "supported" ? [] : ["Expected supported sales proposal."]),
      ...(proposal.entities.length === 3 ? [] : ["Expected three bound sales entities."]),
      ...(proposal.joinNeeds.filter((join) => join.status === "verified").length >= 2
        ? []
        : ["Expected verified sales joins."]),
      ...expectNoExecutableSurface(proposal),
      ...expectNoRawValues(proposal),
    ],
  },
  {
    name: "seven real cross-domain prompts meet adaptive proposal coverage",
    request: realPromptRequests[0],
    assert: () => {
      const proposals = realPromptRequests.map((request) => proposeAdaptiveReport(request));
      const entityCoverage = proposals.filter(hasBoundPromptEntity).length;
      const signalCoverage = proposals.filter(hasMeaningfulSignal).length;
      const within30Days = proposals.find((proposal) =>
        proposal.question.includes("within 30 days"),
      );
      return [
        ...(entityCoverage >= 5
          ? []
          : [`Expected at least 5 of 7 prompts to bind meaningful entities; got ${entityCoverage}.`]),
        ...(signalCoverage >= 6
          ? []
          : [`Expected at least 6 of 7 prompts to detect a signal; got ${signalCoverage}.`]),
        ...(within30Days?.detectedIntent.explicitlyTemporal
          ? []
          : ["Expected within 30 days to be recognized as temporal."]),
        ...proposals.flatMap(expectNoExecutableSurface),
        ...proposals.flatMap(expectNoRawValues),
      ];
    },
  },
  {
    name: "semantic hints improve sales payment date status and amount bindings",
    request: semanticBindingRequest(
      "which customers have orders but no recent payments by payment status",
      intent({
        primaryIntent: "filtering",
        entities: ["customers", "orders", "payments"],
        metrics: ["total_payment_amount"],
        grouping: ["payment status"],
        explicitlyTemporal: true,
      }),
      [
        worksheet("customers", [column("customer_id"), column("customer_name")]),
        worksheet("orders", [column("order_id"), column("customer_id")]),
        worksheet("payments", [
          column("payment_id"),
          column("order_id"),
          column("payment_date", "date"),
          column("payment_status", "categorical"),
          column("payment_amount", "numeric"),
        ]),
      ],
      [
        contract("customers", "customer_id", "orders", "customer_id"),
        contract("orders", "order_id", "payments", "order_id"),
      ],
    ),
    assert: (proposal) => [
      ...expectMetricColumn(proposal, "total payment amount", "payment_amount"),
      ...expectGroupingColumn(proposal, "payment status", "payment_status"),
      ...expectFilterColumn(proposal, "filter:date-semantics", "payment_date"),
      ...expectFilterColumn(proposal, "filter:status-semantics", "payment_status"),
      ...expectGeneratedSemanticHint(proposal, "payment_amount"),
      ...expectNoExecutableSurface(proposal),
      ...expectNoRawValues(proposal),
    ],
  },
  {
    name: "semantic hints improve inventory quantity product category and condition bindings",
    request: semanticBindingRequest(
      "which products are low stock but still selling fast by product category",
      intent({
        primaryIntent: "risk",
        entities: ["products", "stock"],
        metrics: ["total_stock_quantity"],
        grouping: ["product category"],
      }),
      [
        worksheet("products", [
          column("product_id"),
          column("product_name"),
          column("product_category", "categorical"),
        ]),
        worksheet("stock", [
          column("product_id"),
          column("stock_quantity", "numeric"),
          column("inventory_status", "categorical"),
        ]),
      ],
      [contract("products", "product_id", "stock", "product_id")],
    ),
    assert: (proposal) => [
      ...expectMetricColumn(proposal, "total stock quantity", "stock_quantity"),
      ...expectGroupingColumn(proposal, "product category", "product_category"),
      ...expectFilterColumn(proposal, "filter:business-condition-semantics", "stock_quantity"),
      ...expectGeneratedSemanticHint(proposal, "stock_quantity"),
      ...expectNoExecutableSurface(proposal),
      ...expectNoRawValues(proposal),
    ],
  },
  {
    name: "semantic hints improve support ticket unresolved status binding",
    request: semanticBindingRequest(
      "which accounts have many unresolved tickets",
      intent({
        primaryIntent: "filtering",
        entities: ["accounts", "tickets"],
        metrics: ["count_tickets"],
      }),
      [
        worksheet("accounts", [column("account_id"), column("account_name")]),
        worksheet("tickets", [
          column("ticket_id"),
          column("account_id"),
          column("ticket_status", "categorical"),
          column("resolved_at", "date"),
        ]),
      ],
      [contract("accounts", "account_id", "tickets", "account_id")],
    ),
    assert: (proposal) => [
      ...expectMetricColumn(proposal, "count tickets", "ticket_id"),
      ...expectFilterColumn(proposal, "filter:business-condition-semantics", "ticket_status"),
      ...expectGeneratedSemanticHint(proposal, "ticket_status"),
      ...expectNoExecutableSurface(proposal),
      ...expectNoRawValues(proposal),
    ],
  },
  {
    name: "semantic hints improve finance date payment status and amount bindings",
    request: semanticBindingRequest(
      "which invoices are overdue by customer and payment status",
      intent({
        primaryIntent: "risk",
        entities: ["invoices", "customers", "payments"],
        metrics: ["total_payment_amount"],
        grouping: ["payment status"],
        explicitlyTemporal: true,
      }),
      [
        worksheet("customers", [column("customer_id"), column("customer_name")]),
        worksheet("invoices", [
          column("invoice_id"),
          column("customer_id"),
          column("invoice_date", "date"),
          column("due_date", "date"),
          column("invoice_amount", "numeric"),
        ]),
        worksheet("payments", [
          column("payment_id"),
          column("invoice_id"),
          column("payment_status", "categorical"),
          column("payment_amount", "numeric"),
        ]),
      ],
      [
        contract("customers", "customer_id", "invoices", "customer_id"),
        contract("invoices", "invoice_id", "payments", "invoice_id"),
      ],
    ),
    assert: (proposal) => [
      ...expectMetricColumn(proposal, "total payment amount", "payment_amount"),
      ...expectGroupingColumn(proposal, "payment status", "payment_status"),
      ...expectFilterColumn(proposal, "filter:date-semantics", "due_date"),
      ...expectFilterColumn(proposal, "filter:status-semantics", "payment_status"),
      ...expectNoExecutableSurface(proposal),
      ...expectNoRawValues(proposal),
    ],
  },
  {
    name: "semantic hints support hr headcount and turnover metrics without noisy entity overclaim",
    request: semanticBindingRequest(
      "show employee headcount by department and identify departments with high turnover",
      intent({
        primaryIntent: "risk",
        entities: ["employees", "departments"],
        metrics: ["count_employees", "turnover"],
        grouping: ["department"],
      }),
      [
        worksheet("employees", [
          column("employee_id"),
          column("department_id"),
          column("turnover_rate", "numeric"),
          column("is_active", "boolean"),
        ]),
        worksheet("departments", [column("department_id"), column("department_name")]),
      ],
      [contract("departments", "department_id", "employees", "department_id")],
    ),
    assert: (proposal) => [
      ...(proposal.entities.map((entity) => entity.requestedName).includes("headcount") ||
      proposal.entities.map((entity) => entity.requestedName).includes("turnover")
        ? ["Headcount/turnover should stay metric or signal concepts, not requested entities."]
        : []),
      ...expectMetricColumn(proposal, "count employees", "employee_id"),
      ...expectMetricColumn(proposal, "turnover", "turnover_rate"),
      ...expectGroupingColumn(proposal, "department", "department_id"),
      ...expectNoExecutableSurface(proposal),
      ...expectNoRawValues(proposal),
    ],
  },
  {
    name: "semantic hints improve healthcare visit date provider and patient key bindings",
    request: semanticBindingRequest(
      "which patients had repeat visits within 30 days by provider",
      intent({
        primaryIntent: "filtering",
        entities: ["patients", "visits", "providers"],
        metrics: ["count_visits"],
        grouping: ["provider"],
        explicitlyTemporal: true,
      }),
      [
        worksheet("patients", [column("patient_id"), column("patient_name")]),
        worksheet("visits", [
          column("visit_id"),
          column("patient_id"),
          column("provider_id"),
          column("visit_date", "date"),
        ]),
        worksheet("providers", [column("provider_id"), column("provider_name")]),
      ],
      [
        contract("patients", "patient_id", "visits", "patient_id"),
        contract("providers", "provider_id", "visits", "provider_id"),
      ],
    ),
    assert: (proposal) => [
      ...expectMetricColumn(proposal, "count visits", "visit_id"),
      ...expectGroupingColumn(proposal, "provider", "provider_id"),
      ...expectFilterColumn(proposal, "filter:date-semantics", "visit_date"),
      ...expectGeneratedSemanticHint(proposal, "patient_id"),
      ...expectNoExecutableSurface(proposal),
      ...expectNoRawValues(proposal),
    ],
  },
  {
    name: "semantic hints improve property access status tenant unit and property bindings",
    request: semanticBindingRequest(
      "find current tenants with expired access codes by unit and property",
      intent({
        primaryIntent: "expiration",
        entities: ["tenants", "access codes", "units", "properties"],
        metrics: ["count_access_codes"],
        grouping: ["unit", "property"],
        explicitlyTemporal: true,
      }),
      [
        worksheet("tenants", [column("tenant_id"), column("tenant_name")]),
        worksheet("access_codes", [
          column("access_code_id"),
          column("tenant_id"),
          column("unit_id"),
          column("access_status", "categorical"),
          column("expires_at", "date"),
        ]),
        worksheet("units", [column("unit_id"), column("property_id")]),
        worksheet("properties", [column("property_id"), column("property_name")]),
      ],
      [
        contract("tenants", "tenant_id", "access_codes", "tenant_id"),
        contract("units", "unit_id", "access_codes", "unit_id"),
        contract("properties", "property_id", "units", "property_id"),
      ],
    ),
    assert: (proposal) => [
      ...expectMetricColumn(proposal, "count access codes", "access_code_id"),
      ...expectGroupingColumn(proposal, "unit", "unit_id"),
      ...expectGroupingColumn(proposal, "property", "property_id"),
      ...expectFilterColumn(proposal, "filter:date-semantics", "expires_at"),
      ...expectFilterColumn(proposal, "filter:status-semantics", "access_status"),
      ...expectNoExecutableSurface(proposal),
      ...expectNoRawValues(proposal),
    ],
  },
  {
    name: "semantic hints keep ambiguous columns low confidence",
    request: semanticBindingRequest(
      "summarize total unknown by bucket",
      intent({
        entities: ["misc"],
        metrics: ["total_unknown"],
        grouping: ["bucket"],
      }),
      [worksheet("misc", [column("misc"), column("value_blob")])],
    ),
    assert: (proposal) => [
      ...(proposal.metrics.every((metric) => metric.confidence === "low")
        ? []
        : ["Expected ambiguous metric binding to remain low confidence."]),
      ...(proposal.groupings.every((grouping) => grouping.confidence === "high")
        ? ["Ambiguous grouping must not become high confidence."]
        : []),
      ...expectNoExecutableSurface(proposal),
      ...expectNoRawValues(proposal),
    ],
  },
  {
    name: "support tickets accounts adaptive proposal",
    request: {
      prompt: "Count tickets by account and current status",
      detectedIntent: intent({
        entities: ["tickets", "accounts"],
        metrics: ["count_tickets"],
        grouping: ["account", "status"],
      }),
      appliedScopeSelections: scope("tickets", "accounts"),
      worksheets: [
        worksheet("tickets", [column("ticket_id"), column("account_id"), column("status", "categorical")]),
        worksheet("accounts", [column("account_id"), column("account_name")]),
      ],
      acceptedRelationshipContracts: [contract("accounts", "account_id", "tickets", "account_id")],
    },
    assert: (proposal) => [
      ...(proposal.support === "needs_review" ? [] : ["Expected needs_review due to status semantics."]),
      ...(proposal.filters.some((filter) => filter.semantics === "needs_review")
        ? []
        : ["Expected status filter semantics to need review."]),
      ...expectNoExecutableSurface(proposal),
      ...expectNoRawValues(proposal),
    ],
  },
  {
    name: "inventory products stock sales adaptive proposal",
    request: {
      prompt: "Show product stock risk by product and sales volume",
      detectedIntent: intent({
        primaryIntent: "risk",
        entities: ["products", "stock", "sales"],
        metrics: ["total_sales"],
        grouping: ["product"],
      }),
      appliedScopeSelections: scope("products", "stock", "sales"),
      worksheets: [
        worksheet("products", [column("product_id"), column("product_name")]),
        worksheet("stock", [column("product_id"), column("stock_on_hand", "numeric")]),
        worksheet("sales", [column("product_id"), column("sales_amount", "numeric")]),
      ],
      acceptedRelationshipContracts: [
        contract("products", "product_id", "stock", "product_id"),
        contract("products", "product_id", "sales", "product_id"),
      ],
    },
    assert: (proposal) => [
      ...(proposal.entities.length === 3 ? [] : ["Expected inventory proposal entities."]),
      ...(proposal.metrics.some((metric) => metric.columnName === "sales_amount")
        ? []
        : ["Expected sales metric binding."]),
      ...expectNoExecutableSurface(proposal),
      ...expectNoRawValues(proposal),
    ],
  },
  {
    name: "finance invoices payments adaptive proposal",
    request: {
      prompt: "Which invoices are overdue and what payments are linked?",
      detectedIntent: intent({
        primaryIntent: "risk",
        entities: ["invoices", "payments"],
        metrics: ["total_payment_amount"],
        grouping: ["invoice"],
        explicitlyTemporal: true,
      }),
      appliedScopeSelections: scope("invoices", "payments"),
      worksheets: [
        worksheet("invoices", [column("invoice_id"), column("due_date", "date"), column("status", "categorical")]),
        worksheet("payments", [column("payment_id"), column("invoice_id"), column("payment_amount", "numeric")]),
      ],
      acceptedRelationshipContracts: [contract("invoices", "invoice_id", "payments", "invoice_id")],
    },
    assert: (proposal) => [
      ...(proposal.support === "needs_review" ? [] : ["Expected needs_review for overdue/date semantics."]),
      ...(proposal.filters.some((filter) => filter.id === "filter:date-semantics")
        ? []
        : ["Expected date semantics filter."]),
      ...expectNoExecutableSurface(proposal),
      ...expectNoRawValues(proposal),
    ],
  },
  {
    name: "hr employees departments adaptive proposal",
    request: {
      prompt: "Average salary and headcount by department",
      detectedIntent: intent({
        entities: ["employees", "departments"],
        metrics: ["average_salary", "count_employees"],
        grouping: ["department"],
      }),
      appliedScopeSelections: scope("employees", "departments"),
      worksheets: [
        worksheet("employees", [column("employee_id"), column("department_id"), column("salary", "numeric")]),
        worksheet("departments", [column("department_id"), column("department_name")]),
      ],
      acceptedRelationshipContracts: [contract("departments", "department_id", "employees", "department_id")],
    },
    assert: (proposal) => [
      ...(proposal.metrics.some((metric) => metric.columnName === "salary")
        ? []
        : ["Expected salary metric binding."]),
      ...(proposal.groupings.some((grouping) => grouping.columnName === "department_id")
        ? []
        : ["Expected department grouping binding."]),
      ...expectNoExecutableSurface(proposal),
      ...expectNoRawValues(proposal),
    ],
  },
  {
    name: "healthcare patients visits metadata adaptive proposal",
    request: {
      prompt: "How many visits does each patient have by visit type?",
      detectedIntent: intent({
        entities: ["patients", "visits"],
        metrics: ["count_visits"],
        grouping: ["patient", "visit type"],
      }),
      appliedScopeSelections: scope("patients", "visits"),
      worksheets: [
        worksheet("patients", [column("patient_id"), column("patient_name")]),
        worksheet("visits", [column("visit_id"), column("patient_id"), column("visit_type", "categorical")]),
      ],
      acceptedRelationshipContracts: [contract("patients", "patient_id", "visits", "patient_id")],
    },
    assert: (proposal) => [
      ...(proposal.support === "supported" ? [] : ["Expected supported healthcare metadata proposal."]),
      ...(proposal.groupings.length === 2 ? [] : ["Expected patient and visit type groupings."]),
      ...expectNoExecutableSurface(proposal),
      ...expectNoRawValues(proposal),
    ],
  },
  {
    name: "property access security adaptive proposal remains generic",
    request: {
      prompt: "Find access security gaps by property and access code status",
      detectedIntent: intent({
        primaryIntent: "risk",
        entities: ["properties", "access logs"],
        metrics: ["count_access_logs"],
        grouping: ["property", "status"],
      }),
      appliedScopeSelections: scope("properties", "access_logs"),
      worksheets: [
        worksheet("properties", [column("property_id"), column("property_name")]),
        worksheet("access_logs", [column("access_id"), column("property_id"), column("access_status", "categorical")]),
      ],
      acceptedRelationshipContracts: [contract("properties", "property_id", "access_logs", "property_id")],
      semanticHints: [
        {
          id: "hint:security",
          target: "filter",
          label: "access security",
          confidence: "medium",
        },
      ],
    },
    assert: (proposal) => [
      ...(proposal.semanticHints.some((hint) => hint.id === "hint:security")
        ? []
        : ["Expected generic semantic hint pass-through."]),
      ...expectGeneratedSemanticHint(proposal, "access_status"),
      ...(proposal.title.toLowerCase().startsWith("proposal sketch:")
        ? []
        : ["Expected business-friendly proposal sketch title."]),
      ...expectNoExecutableSurface(proposal),
      ...expectNoRawValues(proposal),
    ],
  },
  {
    name: "empty no-intent returns safe empty proposal",
    request: { prompt: "" },
    assert: (proposal) => [
      ...(proposal === EMPTY_ADAPTIVE_REPORT_PROPOSAL ? [] : ["Expected shared empty proposal constant."]),
      ...(proposal.support === "unsupported" ? [] : ["Expected unsupported empty proposal."]),
      ...expectNoExecutableSurface(proposal),
      ...expectNoRawValues(proposal),
    ],
  },
  {
    name: "missing scope blocks honestly",
    request: {
      prompt: "Count orders by customer",
      detectedIntent: intent({
        entities: ["orders", "customers"],
        metrics: ["count_orders"],
        grouping: ["customer"],
      }),
      worksheets: [
        worksheet("orders", [column("order_id"), column("customer_id")]),
        worksheet("customers", [column("customer_id")]),
      ],
    },
    assert: (proposal) => [
      ...(proposal.support === "unsupported" ? [] : ["Expected unsupported missing-scope proposal."]),
      ...(proposal.missingRequirements.some((requirement) => requirement.kind === "scope")
        ? []
        : ["Expected missing scope requirement."]),
      ...expectNoExecutableSurface(proposal),
      ...expectNoRawValues(proposal),
    ],
  },
  {
    name: "ambiguous relationship and status semantics returns needs_review",
    request: {
      prompt: "Count open orders by customer status",
      detectedIntent: intent({
        entities: ["orders", "customers"],
        metrics: ["count_orders"],
        grouping: ["customer", "status"],
      }),
      appliedScopeSelections: scope("orders", "customers"),
      worksheets: [
        worksheet("orders", [column("order_id"), column("customer_id"), column("status", "categorical")]),
        worksheet("customers", [column("customer_id"), column("status", "categorical")]),
      ],
    },
    assert: (proposal) => [
      ...(proposal.support === "needs_review" ? [] : ["Expected needs_review proposal."]),
      ...(proposal.joinNeeds.some((join) => join.status === "missing" || join.status === "needs_review")
        ? []
        : ["Expected unverified relationship need."]),
      ...(proposal.filters.some((filter) => filter.semantics === "needs_review")
        ? []
        : ["Expected ambiguous status filter semantics."]),
      ...expectNoExecutableSurface(proposal),
      ...expectNoRawValues(proposal),
    ],
  },
  {
    name: "no proposal exposes SQL render insert or run capability",
    request: salesRequest,
    assert: (proposal) => expectNoExecutableSurface(proposal),
  },
  {
    name: "fingerprint is stable across repeated invocations",
    request: salesRequest,
    assert: (proposal) => {
      const repeated = proposeAdaptiveReport(salesRequest);
      return [
        ...(proposal.payloadFingerprint === repeated.payloadFingerprint
          ? []
          : ["Expected stable payload fingerprint."]),
        ...expectNoExecutableSurface(proposal),
      ];
    },
  },
];

export function runAdaptiveReportProposalFixtures(): AdaptiveReportProposalFixtureReport {
  const results = fixtures.map((fixture) => {
    const proposal = proposeAdaptiveReport(fixture.request);
    const failureReasons = fixture.assert(proposal);
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

export const allAdaptiveReportProposalFixturesPass = (): boolean =>
  runAdaptiveReportProposalFixtures().failed.length === 0;
