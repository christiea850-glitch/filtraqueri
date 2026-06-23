/**
 * T-24G-1 - Shadow Plan Validator contract vocabulary.
 *
 * Contract scaffolding only: this module does not validate real plans, build
 * payloads, call providers, call backend APIs, render UI, persist storage,
 * synthesize data, generate SQL, insert SQL, or run queries.
 */

import type { AIPrivacyMode } from "./llmPrivacyModes";

export type LlmShadowPlanValidationStatus = "valid" | "needs_review" | "invalid" | "blocked";

export type LlmShadowPlanConfidence = "low" | "medium" | "high";

export type LlmShadowPlanIntent = {
  readonly label: string;
  readonly description?: string;
  readonly userGoal?: string;
};

export type LlmShadowPlanEntity = {
  readonly entityId: string;
  readonly label: string;
  readonly tableName?: string;
  readonly role?: "primary" | "related" | "lookup";
};

export type LlmShadowPlanMetric = {
  readonly metricId: string;
  readonly label: string;
  readonly entityId?: string;
  readonly aggregation?: "count" | "count_distinct" | "sum" | "average" | "minimum" | "maximum";
  readonly columnName?: string;
};

export type LlmShadowPlanGrouping = {
  readonly groupingId: string;
  readonly label: string;
  readonly entityId?: string;
  readonly columnName?: string;
  readonly granularity?: "category" | "day" | "week" | "month" | "quarter" | "year";
};

export type LlmShadowPlanFilter = {
  readonly filterId: string;
  readonly label: string;
  readonly entityId?: string;
  readonly columnName?: string;
  readonly operator?: "equals" | "not_equals" | "contains" | "between" | "greater_than" | "less_than" | "is_present";
  readonly valueDescription?: string;
};

export type LlmShadowPlanRelationshipNeed = {
  readonly relationshipId: string;
  readonly fromEntityId: string;
  readonly toEntityId: string;
  readonly reason: string;
  readonly status: "known" | "needs_confirmation" | "missing" | "unsupported";
};

export type LlmShadowPlanAssumption = {
  readonly assumptionId: string;
  readonly description: string;
  readonly requiresReview: boolean;
};

export type ShadowPlanSchemaReference = {
  readonly referenceId: string;
  readonly entityId?: string;
  readonly tableName?: string;
  readonly columnName?: string;
  readonly issue: string;
  readonly blocking: boolean;
};

export type ShadowPlanPrivacyViolation = {
  readonly violationId: string;
  readonly category: "raw_values" | "sql" | "provider_response" | "query_results" | "token_vault" | "privacy_mode";
  readonly reason: string;
  readonly blocking: boolean;
};

export type ShadowPlanRelationshipViolation = {
  readonly violationId: string;
  readonly relationshipId?: string;
  readonly reason: string;
  readonly blocking: boolean;
};

export type ShadowPlanUnsupportedReason = {
  readonly reasonId: string;
  readonly reason: string;
  readonly blocking: boolean;
};

export type ShadowPlanNoExecutionInvariants = {
  readonly llmPlanIsAdvisoryOnly: true;
  readonly llmCannotExecute: true;
  readonly llmCannotInsertSql: true;
  readonly llmCannotRunQuery: true;
  readonly deterministicValidationRequired: true;
  readonly manualInsertRequired: true;
  readonly manualRunRequired: true;
  readonly sqlRendererRemainsFinalAuthority: true;
};

export type ShadowPlanAuditSummary = {
  readonly status: LlmShadowPlanValidationStatus;
  readonly noExecution: ShadowPlanNoExecutionInvariants;
  readonly renderable: false;
  readonly executable: false;
  readonly insertSqlAllowed: false;
  readonly runQueryAllowed: false;
  readonly providerCallsMade: false;
  readonly backendApiCallsMade: false;
  readonly storageMutated: false;
  readonly payloadBuilt: false;
  readonly syntheticDataGenerated: false;
  readonly tokenVaultUsed: false;
  readonly sqlGenerated: false;
};

export type LlmShadowPlan = {
  readonly planId: string;
  readonly intent: LlmShadowPlanIntent;
  readonly entities: LlmShadowPlanEntity[];
  readonly metrics: LlmShadowPlanMetric[];
  readonly groupings: LlmShadowPlanGrouping[];
  readonly filters: LlmShadowPlanFilter[];
  readonly relationshipsNeeded: LlmShadowPlanRelationshipNeed[];
  readonly assumptions: LlmShadowPlanAssumption[];
  readonly confidence: LlmShadowPlanConfidence;
  readonly privacyMode: AIPrivacyMode;
  readonly payloadFingerprint: string | null;
  readonly source: "llm_shadow_plan";
  readonly containsSql: false;
  readonly containsRawValues: false;
  readonly containsProviderResponseText: false;
  readonly noExecution: ShadowPlanNoExecutionInvariants;
};

export type LlmShadowPlanValidationResult = {
  readonly status: LlmShadowPlanValidationStatus;
  readonly plan: LlmShadowPlan | null;
  readonly schemaReferences: ShadowPlanSchemaReference[];
  readonly privacyViolations: ShadowPlanPrivacyViolation[];
  readonly relationshipViolations: ShadowPlanRelationshipViolation[];
  readonly unsupportedReasons: ShadowPlanUnsupportedReason[];
  readonly assumptions: LlmShadowPlanAssumption[];
  readonly auditSummary: ShadowPlanAuditSummary;
};

export const SHADOW_PLAN_NO_EXECUTION_INVARIANTS: ShadowPlanNoExecutionInvariants = {
  llmPlanIsAdvisoryOnly: true,
  llmCannotExecute: true,
  llmCannotInsertSql: true,
  llmCannotRunQuery: true,
  deterministicValidationRequired: true,
  manualInsertRequired: true,
  manualRunRequired: true,
  sqlRendererRemainsFinalAuthority: true,
};

const createAuditSummary = (status: LlmShadowPlanValidationStatus): ShadowPlanAuditSummary => ({
  status,
  noExecution: SHADOW_PLAN_NO_EXECUTION_INVARIANTS,
  renderable: false,
  executable: false,
  insertSqlAllowed: false,
  runQueryAllowed: false,
  providerCallsMade: false,
  backendApiCallsMade: false,
  storageMutated: false,
  payloadBuilt: false,
  syntheticDataGenerated: false,
  tokenVaultUsed: false,
  sqlGenerated: false,
});

export const createEmptyLlmShadowPlanValidationResult = (): LlmShadowPlanValidationResult => ({
  status: "needs_review",
  plan: null,
  schemaReferences: [],
  privacyViolations: [],
  relationshipViolations: [],
  unsupportedReasons: [],
  assumptions: [],
  auditSummary: createAuditSummary("needs_review"),
});

export const createBlockedLlmShadowPlanValidationResult = (
  reason: ShadowPlanUnsupportedReason | string,
): LlmShadowPlanValidationResult => ({
  ...createEmptyLlmShadowPlanValidationResult(),
  status: "blocked",
  unsupportedReasons: [
    typeof reason === "string"
      ? { reasonId: "blocked_shadow_plan", reason, blocking: true }
      : { ...reason, blocking: true },
  ],
  auditSummary: createAuditSummary("blocked"),
});

export const hasShadowPlanBlockingViolations = (result: LlmShadowPlanValidationResult): boolean =>
  result.status === "blocked" ||
  result.schemaReferences.some((violation) => violation.blocking) ||
  result.privacyViolations.some((violation) => violation.blocking) ||
  result.relationshipViolations.some((violation) => violation.blocking) ||
  result.unsupportedReasons.some((reason) => reason.blocking);

export const assertShadowPlanNoExecutionInvariants = (
  planOrResult: LlmShadowPlan | LlmShadowPlanValidationResult,
): boolean => {
  const noExecution = "auditSummary" in planOrResult
    ? planOrResult.auditSummary.noExecution
    : planOrResult.noExecution;
  return (
    noExecution.llmPlanIsAdvisoryOnly &&
    noExecution.llmCannotExecute &&
    noExecution.llmCannotInsertSql &&
    noExecution.llmCannotRunQuery &&
    noExecution.deterministicValidationRequired &&
    noExecution.manualInsertRequired &&
    noExecution.manualRunRequired &&
    noExecution.sqlRendererRemainsFinalAuthority
  );
};

export const isLlmShadowPlanAdvisoryOnly = (plan: LlmShadowPlan): boolean =>
  plan.source === "llm_shadow_plan" &&
  plan.containsSql === false &&
  plan.containsRawValues === false &&
  plan.containsProviderResponseText === false &&
  assertShadowPlanNoExecutionInvariants(plan);
