/**
 * T-24G-1 - Shadow Plan Validator contract fixtures.
 *
 * Pure fixture runner only. This does not validate real plans, build provider
 * payloads, generate SQL, insert SQL into Monaco, execute queries, call
 * providers, call backend APIs, persist storage, synthesize data, tokenize
 * values, or render UI.
 */

import {
  SHADOW_PLAN_NO_EXECUTION_INVARIANTS,
  assertShadowPlanNoExecutionInvariants,
  createBlockedLlmShadowPlanValidationResult,
  createEmptyLlmShadowPlanValidationResult,
  hasShadowPlanBlockingViolations,
  isLlmShadowPlanAdvisoryOnly,
  type LlmShadowPlan,
  type LlmShadowPlanValidationResult,
} from "../llmShadowPlanValidator";

type ShadowPlanValidatorFixtureResult = {
  name: string;
  ok: boolean;
  failureReasons: string[];
};

export type ShadowPlanValidatorFixtureReport = {
  results: ShadowPlanValidatorFixtureResult[];
  passed: ShadowPlanValidatorFixtureResult[];
  failed: ShadowPlanValidatorFixtureResult[];
};

const fixture = (name: string, run: () => string[]) => ({ name, run });

const samplePlan: LlmShadowPlan = {
  planId: "shadow-plan-fixture",
  intent: {
    label: "Summarize revenue by customer segment",
    description: "Advisory-only plan vocabulary fixture.",
    userGoal: "Understand revenue concentration without generating SQL.",
  },
  entities: [
    { entityId: "orders", label: "Orders", tableName: "orders", role: "primary" },
    { entityId: "customers", label: "Customers", tableName: "customers", role: "related" },
  ],
  metrics: [
    {
      metricId: "revenue",
      label: "Revenue",
      entityId: "orders",
      aggregation: "sum",
      columnName: "order_total",
    },
  ],
  groupings: [
    {
      groupingId: "segment",
      label: "Customer segment",
      entityId: "customers",
      columnName: "segment",
      granularity: "category",
    },
  ],
  filters: [
    {
      filterId: "recent_orders",
      label: "Recent orders",
      entityId: "orders",
      columnName: "order_date",
      operator: "between",
      valueDescription: "Analyst-selected reporting window only; no raw values included.",
    },
  ],
  relationshipsNeeded: [
    {
      relationshipId: "orders_to_customers",
      fromEntityId: "orders",
      toEntityId: "customers",
      reason: "Revenue must be grouped by customer segment.",
      status: "needs_confirmation",
    },
  ],
  assumptions: [
    {
      assumptionId: "revenue_column",
      description: "order_total represents revenue.",
      requiresReview: true,
    },
  ],
  confidence: "medium",
  privacyMode: "metadata_only_llm",
  payloadFingerprint: "fixture-payload-fingerprint",
  source: "llm_shadow_plan",
  containsSql: false,
  containsRawValues: false,
  containsProviderResponseText: false,
  noExecution: SHADOW_PLAN_NO_EXECUTION_INVARIANTS,
};

const withResult = (
  partial: Partial<LlmShadowPlanValidationResult>,
): LlmShadowPlanValidationResult => ({
  ...createEmptyLlmShadowPlanValidationResult(),
  ...partial,
});

const fixtures = [
  fixture("empty validation result is advisory/no-execution by default", () => {
    const result = createEmptyLlmShadowPlanValidationResult();
    return [
      ...(result.status === "needs_review" ? [] : ["Expected empty result to need review."]),
      ...(!result.auditSummary.renderable ? [] : ["Expected empty result not to be renderable."]),
      ...(!result.auditSummary.executable ? [] : ["Expected empty result not to be executable."]),
      ...(assertShadowPlanNoExecutionInvariants(result)
        ? []
        : ["Expected no-execution invariants on empty result."]),
    ];
  }),
  fixture("blocked validation result is not renderable/executable", () => {
    const result = createBlockedLlmShadowPlanValidationResult("Blocking fixture reason.");
    return [
      ...(result.status === "blocked" ? [] : ["Expected blocked status."]),
      ...(!result.auditSummary.renderable ? [] : ["Expected blocked result not to be renderable."]),
      ...(!result.auditSummary.executable ? [] : ["Expected blocked result not to be executable."]),
      ...(hasShadowPlanBlockingViolations(result) ? [] : ["Expected blocking violations."]),
    ];
  }),
  fixture("no-execution invariants are always true", () => {
    const result = createEmptyLlmShadowPlanValidationResult();
    return assertShadowPlanNoExecutionInvariants(samplePlan) &&
      assertShadowPlanNoExecutionInvariants(result)
      ? []
      : ["Expected no-execution invariants to remain true."];
  }),
  fixture("shadow plan type represents planning vocabulary", () => [
    ...(samplePlan.entities.length === 2 ? [] : ["Expected entity vocabulary."]),
    ...(samplePlan.metrics.length === 1 ? [] : ["Expected metric vocabulary."]),
    ...(samplePlan.groupings.length === 1 ? [] : ["Expected grouping vocabulary."]),
    ...(samplePlan.filters.length === 1 ? [] : ["Expected filter vocabulary."]),
    ...(samplePlan.relationshipsNeeded.length === 1 ? [] : ["Expected relationship need vocabulary."]),
  ]),
  fixture("shadow plan cannot claim SQL authority", () =>
    isLlmShadowPlanAdvisoryOnly(samplePlan) &&
    samplePlan.containsSql === false &&
    samplePlan.noExecution.sqlRendererRemainsFinalAuthority
      ? []
      : ["Expected LLM shadow plan to remain advisory only."],
  ),
  fixture("shadow plan cannot allow Insert SQL or Run Query", () =>
    samplePlan.noExecution.llmCannotInsertSql && samplePlan.noExecution.llmCannotRunQuery
      ? []
      : ["Expected Insert SQL and Run Query to remain manually gated."],
  ),
  fixture("blocking privacy violation causes blocked status", () => {
    const result = withResult({
      status: "blocked",
      privacyViolations: [
        { violationId: "raw_values", category: "raw_values", reason: "Raw values are prohibited.", blocking: true },
      ],
    });
    return hasShadowPlanBlockingViolations(result) ? [] : ["Expected blocking privacy violation."];
  }),
  fixture("blocking schema violation causes blocked status", () => {
    const result = withResult({
      status: "blocked",
      schemaReferences: [
        { referenceId: "missing_column", columnName: "missing", issue: "Column not in schema.", blocking: true },
      ],
    });
    return hasShadowPlanBlockingViolations(result) ? [] : ["Expected blocking schema violation."];
  }),
  fixture("blocking relationship violation causes blocked status", () => {
    const result = withResult({
      status: "blocked",
      relationshipViolations: [
        { violationId: "missing_relationship", relationshipId: "orders_to_customers", reason: "No confirmed join path.", blocking: true },
      ],
    });
    return hasShadowPlanBlockingViolations(result) ? [] : ["Expected blocking relationship violation."];
  }),
  fixture("helpers do not emit SQL, call provider, call backend/API, mutate storage, or run queries", () => {
    const serialized = JSON.stringify({
      empty: createEmptyLlmShadowPlanValidationResult(),
      blocked: createBlockedLlmShadowPlanValidationResult("Blocked without side effects."),
      advisory: isLlmShadowPlanAdvisoryOnly(samplePlan),
    });
    const forbidden = [
      "SELECT ",
      "INSERT ",
      "UPDATE ",
      "DELETE ",
      "fetch(",
      "XMLHttpRequest",
      "localStorage",
      "sessionStorage",
      "providerCallsMade\":true",
      "backendApiCallsMade\":true",
      "storageMutated\":true",
      "runQueryAllowed\":true",
      "insertSqlAllowed\":true",
    ];
    return forbidden.some((token) => serialized.includes(token))
      ? ["Expected shadow plan helpers to remain pure and side-effect free."]
      : [];
  }),
];

export function runLlmShadowPlanValidatorFixtures(): ShadowPlanValidatorFixtureReport {
  const results = fixtures.map((item) => {
    const failureReasons = item.run();
    return {
      name: item.name,
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
