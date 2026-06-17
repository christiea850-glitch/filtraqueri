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
      ...(proposal.semanticHints.length === 1 ? [] : ["Expected generic semantic hint pass-through."]),
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
