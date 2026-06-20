/**
 * T-13N - Adaptive Proposal to Business SQL Plan bridge fixtures.
 *
 * Pure fixture runner only. No SQL rendering, Monaco insertion, Run Query
 * calls, backend/API calls, provider calls, LLM calls, or execution behavior.
 */

import type { AcceptedRelationshipContract } from "../../../workbook";
import type { AdaptiveReportProposal, ProposedMetric } from "../adaptiveReportProposal";
import {
  createBusinessSqlPlanFromAdaptiveProposal,
  type AdaptiveProposalBusinessSqlBridgeResult,
} from "../adaptiveProposalBusinessSqlBridge";

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
  groupings: [
    {
      id: "grouping:lease-status",
      label: "status",
      tableName: "leases",
      columnName: "lease_status",
      confidence: "high",
    },
  ],
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
            kind: "average",
            label: "average lease value",
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
