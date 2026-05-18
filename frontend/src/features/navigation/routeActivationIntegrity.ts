import type { RouteActivationIntegrityIssue } from "./routeActivationChecks";

export type RouteActivationIntegrityStatus = "valid" | "review_required";

export type RouteActivationIntegritySummary = {
  readonly summaryId: string;
  readonly activationId: string;
  readonly status: RouteActivationIntegrityStatus;
  readonly issueCount: number;
  readonly issueRuleIds: ReadonlyArray<string>;
  readonly metadataOnly: true;
};

export const summarizeRouteActivationIntegrity = (
  activationId: string,
  issues: ReadonlyArray<RouteActivationIntegrityIssue>,
): RouteActivationIntegritySummary => ({
  summaryId: `route-activation-integrity:${activationId}`,
  activationId,
  status: issues.length === 0 ? "valid" : "review_required",
  issueCount: issues.length,
  issueRuleIds: issues.map((issue) => issue.ruleId).sort((left, right) => left.localeCompare(right)),
  metadataOnly: true,
});

