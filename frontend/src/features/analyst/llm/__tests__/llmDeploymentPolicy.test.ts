/**
 * T-24I-1 - AI deployment policy fixture coverage.
 *
 * Pure fixture runner only. This does not implement admin settings, render UI,
 * call providers, call backend APIs, persist storage, build payloads, synthesize
 * data, tokenize values, generate SQL, insert SQL, or run queries.
 */

import {
  AI_DEPLOYMENT_TYPES,
  assertAIDeploymentNoExecutionInvariants,
  createAIDeploymentPolicyDecision,
  getAIPrivacyAllowanceForDeployment,
  isAIPrivacyModeAllowedForDeployment,
  requiresAIAdminPolicy,
  requiresAILegalComplianceReview,
  type AIDeploymentType,
} from "../llmDeploymentPolicy";

type DeploymentPolicyFixtureResult = {
  name: string;
  ok: boolean;
  failureReasons: string[];
};

export type DeploymentPolicyFixtureReport = {
  results: DeploymentPolicyFixtureResult[];
  passed: DeploymentPolicyFixtureResult[];
  failed: DeploymentPolicyFixtureResult[];
};

const fixture = (
  name: string,
  run: () => string[],
): { name: string; run: () => string[] } => ({ name, run });

const fixtures = [
  fixture("level 0 is allowed for all deployment types", () =>
    AI_DEPLOYMENT_TYPES.every((deploymentType) =>
      getAIPrivacyAllowanceForDeployment(deploymentType, 0) === "allowed" &&
      isAIPrivacyModeAllowedForDeployment(deploymentType, "no_llm"),
    )
      ? []
      : ["Expected Level 0/no-LLM to be allowed for every deployment type."],
  ),
  fixture("level 1 public cloud is conditional metadata-only governed", () => {
    const decision = createAIDeploymentPolicyDecision("public_cloud", 1);
    return [
      ...(decision.allowance === "allowed" ? [] : ["Expected public cloud Level 1 allowance."]),
      ...(decision.privacyMode === "metadata_only_llm" ? [] : ["Expected metadata-only mode."]),
      ...(decision.providerEligibilityRequired ? [] : ["Expected provider boundary eligibility." ]),
      ...(decision.providerEligibility.zeroRetentionRequired ? [] : ["Expected zero-retention requirement."]),
      ...(decision.warnings.some((warning) => /raw rows|samples|token vault/i.test(warning))
        ? []
        : ["Expected metadata-only safety warning."]),
    ];
  }),
  fixture("level 2 public cloud is not default allowed", () => {
    const allowance = getAIPrivacyAllowanceForDeployment("public_cloud", 2);
    return allowance === "deferred" && !isAIPrivacyModeAllowedForDeployment("public_cloud", 2)
      ? []
      : ["Expected public cloud Level 2 to be deferred and not default allowed."];
  }),
  fixture("level 3 public cloud is prohibited", () =>
    getAIPrivacyAllowanceForDeployment("public_cloud", 3) === "prohibited"
      ? []
      : ["Expected public cloud Level 3 to be prohibited."],
  ),
  fixture("level 4 is prohibited for all deployment types", () =>
    AI_DEPLOYMENT_TYPES.every(
      (deploymentType) => getAIPrivacyAllowanceForDeployment(deploymentType, 4) === "prohibited",
    )
      ? []
      : ["Expected Level 4 to be prohibited for all deployment types."],
  ),
  fixture("private self-hosted enterprise level 3 requires legal review or deferred", () => {
    const deploymentTypes: AIDeploymentType[] = [
      "private_cloud",
      "self_hosted_on_prem",
      "enterprise_governed",
    ];
    return deploymentTypes.every((deploymentType) => {
      const decision = createAIDeploymentPolicyDecision(deploymentType, 3);
      return decision.allowance === "requires_legal_compliance_review" || decision.allowance === "deferred";
    }) && deploymentTypes.every((deploymentType) => requiresAILegalComplianceReview(deploymentType, 3))
      ? []
      : ["Expected private/self-hosted/enterprise Level 3 to require legal review or defer." ];
  }),
  fixture("offline local-only level 1 requires no external provider", () => {
    const decision = createAIDeploymentPolicyDecision("offline_local_only", "metadata_only_llm");
    return [
      ...(!decision.providerEligibility.externalProviderAllowed ? [] : ["Expected no external provider."]),
      ...(decision.providerEligibility.localPrivateModelRequired ? [] : ["Expected local/private model requirement."]),
      ...(decision.reasons.some((reason) => /no external provider/i.test(reason))
        ? []
        : ["Expected no-external-provider reason."]),
    ];
  }),
  fixture("admin policy helper works for enterprise and private gated modes", () =>
    requiresAIAdminPolicy("enterprise_governed", 1) &&
    requiresAIAdminPolicy("private_cloud", 1) &&
    requiresAIAdminPolicy("self_hosted_on_prem", 2)
      ? []
      : ["Expected admin policy helper to flag enterprise/private gated modes."],
  ),
  fixture("no-execution invariants are always true", () => {
    const decisions = AI_DEPLOYMENT_TYPES.flatMap((deploymentType) =>
      ([0, 1, 2, 3, 4] as const).map((level) =>
        createAIDeploymentPolicyDecision(deploymentType, level),
      ),
    );
    return decisions.every(assertAIDeploymentNoExecutionInvariants) &&
      decisions.every(
        (decision) => decision.deterministicValidationRequired && decision.manualInsertSqlRequired && decision.manualRunQueryRequired,
      )
      ? []
      : ["Expected deployment decisions to preserve no-execution invariants." ];
  }),
  fixture("helpers do not expose provider backend storage UI SQL insert or run capability", () => {
    const serialized = JSON.stringify({
      allowance: getAIPrivacyAllowanceForDeployment("public_cloud", 1),
      allowed: isAIPrivacyModeAllowedForDeployment("offline_local_only", 1),
      admin: requiresAIAdminPolicy("enterprise_governed", 1),
      review: requiresAILegalComplianceReview("private_cloud", 3),
      decision: createAIDeploymentPolicyDecision("public_cloud", 2),
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
      "providerCallMade\":true",
      "backendApiCallMade\":true",
      "renderedUi\":true",
      "payloadBuilt\":true",
      "syntheticGenerated\":true",
      "tokenVaultUsed\":true",
      "runQuery",
      "insertSql",
    ];
    return forbidden.some((token) => serialized.includes(token))
      ? ["Expected deployment policy helpers to remain pure contracts only."]
      : [];
  }),
];

export function runLlmDeploymentPolicyFixtures(): DeploymentPolicyFixtureReport {
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
