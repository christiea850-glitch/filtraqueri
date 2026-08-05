/** PS-CMG1 - deterministic definition-authority contract fixtures. */

import {
  createBusinessSqlDefinitionAuthorityRevisionId,
  evaluateBusinessSqlDefinitionAuthorityReuse,
  isBusinessSqlDefinitionAuthorityAccepted,
  normalizeBusinessSqlDefinitionAuthorityRecord,
  validateBusinessSqlDefinitionAuthority,
  type BusinessSqlDefinitionAuthorityRecord,
  type BusinessSqlDefinitionAuthorityScope,
  type BusinessSqlDefinitionAuthorityValidation,
} from "../businessSqlDefinitionAuthority";

type FixtureResult = {
  name: string;
  ok: boolean;
  summary: string;
  failureReasons: string[];
};

export type BusinessSqlDefinitionAuthorityFixtureReport = {
  results: FixtureResult[];
  passed: FixtureResult[];
  failed: FixtureResult[];
};

const expect = (condition: boolean, message: string): string[] =>
  condition ? [] : [message];

const organizationScope: BusinessSqlDefinitionAuthorityScope = {
  scopeKind: "organization",
  scopeId: "org:acme",
  label: "Acme organization",
};

const investigationScope: BusinessSqlDefinitionAuthorityScope = {
  scopeKind: "investigation",
  scopeId: "investigation:cmg1",
  label: "CMG1 investigation",
};

const otherInvestigationScope: BusinessSqlDefinitionAuthorityScope = {
  scopeKind: "investigation",
  scopeId: "investigation:other",
};

const revisionId = (
  authority: BusinessSqlDefinitionAuthorityRecord["authority"],
  sourceType: BusinessSqlDefinitionAuthorityRecord["source"]["sourceType"],
  sourceId: string,
  scope: BusinessSqlDefinitionAuthorityScope,
): string =>
  createBusinessSqlDefinitionAuthorityRevisionId({
    authority,
    source: { sourceType, sourceId },
    scope,
  });

const governedAuthority: BusinessSqlDefinitionAuthorityRecord = {
  authority: "governed",
  source: {
    sourceType: "metric_registry",
    sourceId: "metric-registry:revenue:v3",
    label: "Approved revenue definition",
    approved: true,
  },
  scope: organizationScope,
  limitations: [],
  acceptance: {
    accepted: true,
    acceptanceId: "registry-approval:revenue:v3",
    actorId: "finance-analytics-owner",
    acceptedAt: "2026-08-05T00:00:00Z",
    acceptedScope: organizationScope,
  },
  revision: {
    revisionId: revisionId(
      "governed",
      "metric_registry",
      "metric-registry:revenue:v3",
      organizationScope,
    ),
    semanticFingerprint: "semantic-fingerprint:revenue:v3",
  },
  reuseEligibility: {
    eligible: true,
    allowedScopes: [organizationScope],
  },
  displayLabel: "Approved revenue",
};

const userDefinedAuthority: BusinessSqlDefinitionAuthorityRecord = {
  authority: "user_defined",
  source: {
    sourceType: "user",
    sourceId: "user:analyst-1",
    approved: false,
  },
  scope: investigationScope,
  limitations: ["Scoped to this investigation only."],
  acceptance: {
    accepted: true,
    actorId: "user:analyst-1",
    acceptanceId: "acceptance:user-defined:cmg1",
    acceptedAt: "2026-08-05T00:00:00Z",
    acceptedScope: investigationScope,
  },
  revision: {
    revisionId: revisionId(
      "user_defined",
      "user",
      "user:analyst-1",
      investigationScope,
    ),
  },
  reuseEligibility: {
    eligible: true,
    allowedScopes: [investigationScope],
  },
  displayLabel: "Analyst definition",
};

const acceptedProvisionalAuthority: BusinessSqlDefinitionAuthorityRecord = {
  authority: "provisional_proxy",
  source: {
    sourceType: "filtraqueri_proposal",
    sourceId: "proposal:cmg1:proxy-margin",
    approved: false,
  },
  scope: investigationScope,
  limitations: ["Proxy accepted only for the CMG1 investigation."],
  acceptance: {
    accepted: true,
    actorId: "user:analyst-1",
    acceptanceId: "acceptance:proxy:cmg1",
    acceptedAt: "2026-08-05T00:00:00Z",
    acceptedScope: investigationScope,
  },
  revision: {
    revisionId: revisionId(
      "provisional_proxy",
      "filtraqueri_proposal",
      "proposal:cmg1:proxy-margin",
      investigationScope,
    ),
  },
  reuseEligibility: {
    eligible: true,
    allowedScopes: [investigationScope],
    reason: "Explicitly accepted for this investigation only.",
  },
  displayLabel: "Temporary proxy",
};

const assertValid = (
  validation: BusinessSqlDefinitionAuthorityValidation,
): string[] => [
  ...expect(validation.valid, "Expected authority validation to pass."),
  ...expect(validation.accepted, "Expected authority to be accepted."),
  ...expect(validation.reasonCodes.length === 0, "Expected no authority reason codes."),
  ...expect(validation.blockers.length === 0, "Expected no authority blockers."),
];

const fixtures: Array<{
  name: string;
  run: () => { summary: string; failureReasons: string[] };
}> = [
  {
    name: "valid governed definition",
    run: () => {
      const validation = validateBusinessSqlDefinitionAuthority(governedAuthority);
      return {
        summary: validation.summary,
        failureReasons: [
          ...assertValid(validation),
          ...expect(
            validation.summary.includes("authority=governed") &&
              !validation.summary.includes(governedAuthority.displayLabel || ""),
            "Expected summary to use canonical authority rather than display label.",
          ),
        ],
      };
    },
  },
  {
    name: "governed definition missing approved source",
    run: () => {
      const validation = validateBusinessSqlDefinitionAuthority({
        ...governedAuthority,
        source: { ...governedAuthority.source, approved: false },
      });
      return {
        summary: validation.summary,
        failureReasons: [
          ...expect(!validation.valid, "Expected unapproved governed source to fail."),
          ...expect(
            validation.reasonCodes.includes("governed_approved_source_required"),
            "Expected governed approved-source reason.",
          ),
        ],
      };
    },
  },
  {
    name: "valid user-defined definition with explicit scope",
    run: () => {
      const validation = validateBusinessSqlDefinitionAuthority(userDefinedAuthority);
      return {
        summary: validation.summary,
        failureReasons: [
          ...assertValid(validation),
          ...expect(
            validation.summary.includes("scope=investigation:investigation:cmg1"),
            "Expected user-defined summary to preserve scope.",
          ),
        ],
      };
    },
  },
  {
    name: "user-defined definition missing required provenance",
    run: () => {
      const validation = validateBusinessSqlDefinitionAuthority({
        ...userDefinedAuthority,
        acceptance: {
          accepted: true,
        },
      });
      return {
        summary: validation.summary,
        failureReasons: [
          ...expect(!validation.valid, "Expected missing user provenance to fail."),
          ...expect(
            validation.reasonCodes.includes("user_defined_acceptance_required"),
            "Expected missing acceptance id reason.",
          ),
          ...expect(
            validation.reasonCodes.includes("user_defined_actor_required"),
            "Expected missing actor reason.",
          ),
        ],
      };
    },
  },
  {
    name: "proposed but unaccepted provisional proxy",
    run: () => {
      const validation = validateBusinessSqlDefinitionAuthority({
        ...acceptedProvisionalAuthority,
        acceptance: {
          accepted: false,
        },
      });
      return {
        summary: validation.summary,
        failureReasons: [
          ...expect(!validation.valid, "Expected unaccepted proxy to fail closed."),
          ...expect(!validation.accepted, "Expected proxy accepted flag to be false."),
          ...expect(
            validation.reasonCodes.includes(
              "provisional_acceptance_required_for_authoritative_plan",
            ),
            "Expected proxy acceptance blocker.",
          ),
        ],
      };
    },
  },
  {
    name: "explicitly accepted provisional proxy",
    run: () => {
      const validation = validateBusinessSqlDefinitionAuthority(acceptedProvisionalAuthority);
      return {
        summary: validation.summary,
        failureReasons: [
          ...assertValid(validation),
          ...expect(
            isBusinessSqlDefinitionAuthorityAccepted(acceptedProvisionalAuthority),
            "Expected accepted helper to recognize accepted proxy.",
          ),
        ],
      };
    },
  },
  {
    name: "provisional proxy accepted only for one investigation",
    run: () => {
      const reuse = evaluateBusinessSqlDefinitionAuthorityReuse({
        record: acceptedProvisionalAuthority,
        requestedScope: investigationScope,
      });
      return {
        summary: reuse.summary,
        failureReasons: [
          ...expect(reuse.eligible, "Expected accepted proxy to be reusable in accepted scope."),
          ...expect(reuse.reasonCodes.length === 0, "Expected no reuse reasons for accepted scope."),
        ],
      };
    },
  },
  {
    name: "attempted unrestricted reuse of a limited provisional proxy",
    run: () => {
      const reuse = evaluateBusinessSqlDefinitionAuthorityReuse({
        record: acceptedProvisionalAuthority,
        requestedScope: otherInvestigationScope,
      });
      return {
        summary: reuse.summary,
        failureReasons: [
          ...expect(!reuse.eligible, "Expected other investigation reuse to be blocked."),
          ...expect(
            reuse.reasonCodes.includes("reuse_scope_not_allowed"),
            "Expected reuse scope blocker.",
          ),
        ],
      };
    },
  },
  {
    name: "invalid or unknown authority value",
    run: () => {
      const validation = validateBusinessSqlDefinitionAuthority({
        ...governedAuthority,
        authority: "approved_label",
      });
      return {
        summary: validation.summary,
        failureReasons: [
          ...expect(!validation.valid, "Expected unknown authority to fail."),
          ...expect(
            validation.reasonCodes.includes("authority_unknown"),
            "Expected unknown authority reason.",
          ),
        ],
      };
    },
  },
  {
    name: "display labels do not determine authority",
    run: () => {
      const validation = validateBusinessSqlDefinitionAuthority({
        ...acceptedProvisionalAuthority,
        displayLabel: "Governed approved metric",
        acceptance: { accepted: false },
      });
      return {
        summary: validation.summary,
        failureReasons: [
          ...expect(!validation.valid, "Expected misleading display label not to authorize proxy."),
          ...expect(
            validation.reasonCodes.includes(
              "provisional_acceptance_required_for_authoritative_plan",
            ),
            "Expected canonical proxy acceptance rule to control.",
          ),
          ...expect(
            !validation.summary.includes("Governed approved metric"),
            "Expected summary not to depend on display label.",
          ),
        ],
      };
    },
  },
  {
    name: "deterministic validation and summary behavior",
    run: () => {
      const normalized = normalizeBusinessSqlDefinitionAuthorityRecord(governedAuthority);
      const first = validateBusinessSqlDefinitionAuthority(normalized);
      const second = validateBusinessSqlDefinitionAuthority(normalized);
      return {
        summary: first.summary,
        failureReasons: [
          ...expect(first.summary === second.summary, "Expected deterministic summary."),
          ...expect(
            first.reasonCodes.join(",") === second.reasonCodes.join(","),
            "Expected deterministic reason ordering.",
          ),
          ...expect(
            normalized !== governedAuthority &&
              normalized.limitations !== governedAuthority.limitations,
            "Expected normalization to copy arrays without changing meaning.",
          ),
        ],
      };
    },
  },
];

export function runBusinessSqlDefinitionAuthorityFixtures(): BusinessSqlDefinitionAuthorityFixtureReport {
  const results = fixtures.map((fixture): FixtureResult => {
    const result = fixture.run();
    return {
      name: fixture.name,
      ok: result.failureReasons.length === 0,
      summary: result.summary,
      failureReasons: result.failureReasons,
    };
  });

  return {
    results,
    passed: results.filter((result) => result.ok),
    failed: results.filter((result) => !result.ok),
  };
}
