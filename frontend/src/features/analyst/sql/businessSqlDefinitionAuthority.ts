import { stablePrimitiveId } from "./businessSqlQueryPlan";

export type BusinessSqlDefinitionAuthorityKind =
  | "governed"
  | "user_defined"
  | "provisional_proxy";

export type BusinessSqlDefinitionAuthoritySourceType =
  | "metric_registry"
  | "semantic_layer"
  | "governance_policy"
  | "external_catalog"
  | "user"
  | "workspace"
  | "analysis"
  | "filtraqueri_proposal";

export type BusinessSqlDefinitionAuthorityScopeKind =
  | "organization"
  | "workspace"
  | "dataset"
  | "analysis"
  | "investigation"
  | "metric_registry"
  | "custom";

export type BusinessSqlDefinitionAuthorityScope = {
  scopeKind: BusinessSqlDefinitionAuthorityScopeKind;
  scopeId: string;
  label?: string;
};

export type BusinessSqlDefinitionAuthoritySource = {
  sourceType: BusinessSqlDefinitionAuthoritySourceType;
  sourceId: string;
  label?: string;
  approved: boolean;
};

export type BusinessSqlDefinitionAuthorityAcceptanceProvenance = {
  accepted: boolean;
  actorId?: string;
  acceptedAt?: string;
  acceptanceId?: string;
  acceptedScope?: BusinessSqlDefinitionAuthorityScope;
};

export type BusinessSqlDefinitionAuthorityRevisionIdentity = {
  revisionId: string;
  semanticFingerprint?: string;
};

export type BusinessSqlDefinitionReuseEligibility = {
  eligible: boolean;
  allowedScopes: BusinessSqlDefinitionAuthorityScope[];
  reason?: string;
};

export type BusinessSqlDefinitionAuthorityBase = {
  authority: BusinessSqlDefinitionAuthorityKind;
  source: BusinessSqlDefinitionAuthoritySource;
  scope: BusinessSqlDefinitionAuthorityScope;
  limitations: string[];
  acceptance: BusinessSqlDefinitionAuthorityAcceptanceProvenance;
  revision: BusinessSqlDefinitionAuthorityRevisionIdentity;
  reuseEligibility: BusinessSqlDefinitionReuseEligibility;
  displayLabel?: string;
};

export type BusinessSqlGovernedDefinitionAuthority =
  BusinessSqlDefinitionAuthorityBase & {
    authority: "governed";
    source: BusinessSqlDefinitionAuthoritySource & {
      sourceType:
        | "metric_registry"
        | "semantic_layer"
        | "governance_policy"
        | "external_catalog";
      approved: true;
    };
    acceptance: BusinessSqlDefinitionAuthorityAcceptanceProvenance & {
      accepted: true;
    };
  };

export type BusinessSqlUserDefinedDefinitionAuthority =
  BusinessSqlDefinitionAuthorityBase & {
    authority: "user_defined";
    source: BusinessSqlDefinitionAuthoritySource & {
      sourceType: "user" | "workspace" | "analysis";
    };
    acceptance: BusinessSqlDefinitionAuthorityAcceptanceProvenance & {
      accepted: true;
      actorId: string;
      acceptanceId: string;
    };
  };

export type BusinessSqlProvisionalProxyDefinitionAuthority =
  BusinessSqlDefinitionAuthorityBase & {
    authority: "provisional_proxy";
    source: BusinessSqlDefinitionAuthoritySource & {
      sourceType: "filtraqueri_proposal";
      approved: false;
    };
  };

export type BusinessSqlDefinitionAuthorityRecord =
  | BusinessSqlGovernedDefinitionAuthority
  | BusinessSqlUserDefinedDefinitionAuthority
  | BusinessSqlProvisionalProxyDefinitionAuthority;

export type BusinessSqlDefinitionAuthorityReasonCode =
  | "authority_missing"
  | "authority_unknown"
  | "source_missing"
  | "source_id_missing"
  | "governed_approved_source_required"
  | "governed_source_type_invalid"
  | "user_defined_scope_required"
  | "user_defined_acceptance_required"
  | "user_defined_actor_required"
  | "provisional_source_must_be_filtraqueri_proposal"
  | "provisional_must_not_use_approved_source"
  | "provisional_acceptance_required_for_authoritative_plan"
  | "scope_missing"
  | "scope_id_missing"
  | "revision_missing"
  | "revision_id_missing"
  | "reuse_eligibility_missing"
  | "reuse_scope_not_allowed";

export type BusinessSqlDefinitionAuthorityValidation = {
  valid: boolean;
  accepted: boolean;
  reasonCodes: BusinessSqlDefinitionAuthorityReasonCode[];
  blockers: string[];
  summary: string;
};

export type BusinessSqlDefinitionAuthorityReuseResult = {
  eligible: boolean;
  reasonCodes: BusinessSqlDefinitionAuthorityReasonCode[];
  blockers: string[];
  summary: string;
};

const GOVERNED_SOURCE_TYPES = new Set<BusinessSqlDefinitionAuthoritySourceType>([
  "metric_registry",
  "semantic_layer",
  "governance_policy",
  "external_catalog",
]);

const USER_DEFINED_SOURCE_TYPES = new Set<BusinessSqlDefinitionAuthoritySourceType>([
  "user",
  "workspace",
  "analysis",
]);

const AUTHORITY_VALUES = new Set<BusinessSqlDefinitionAuthorityKind>([
  "governed",
  "user_defined",
  "provisional_proxy",
]);

const unique = <T,>(values: readonly T[]): T[] => Array.from(new Set(values));

const hasText = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const unknownAuthority = (record: unknown): string => {
  if (!record || typeof record !== "object") return "missing";
  const value = (record as { authority?: unknown }).authority;
  return typeof value === "string" ? value : "missing";
};

const scopeIdentity = (
  scope: BusinessSqlDefinitionAuthorityScope | null | undefined,
): string => (scope ? `${scope.scopeKind}:${scope.scopeId}` : "none");

export const createBusinessSqlDefinitionAuthorityRevisionId = ({
  authority,
  source,
  scope,
}: {
  authority: BusinessSqlDefinitionAuthorityKind;
  source: Pick<BusinessSqlDefinitionAuthoritySource, "sourceType" | "sourceId">;
  scope: Pick<BusinessSqlDefinitionAuthorityScope, "scopeKind" | "scopeId">;
}): string =>
  stablePrimitiveId("business-sql-definition-authority", [
    authority,
    source.sourceType,
    source.sourceId,
    scope.scopeKind,
    scope.scopeId,
  ]);

export const normalizeBusinessSqlDefinitionAuthorityRecord = <
  T extends BusinessSqlDefinitionAuthorityRecord,
>(
  record: T,
): T => ({
  ...record,
  limitations: [...record.limitations],
  reuseEligibility: {
    ...record.reuseEligibility,
    allowedScopes: [...record.reuseEligibility.allowedScopes],
  },
});

export const isBusinessSqlDefinitionAuthorityAccepted = (
  record: unknown,
): boolean =>
  !!record &&
  typeof record === "object" &&
  (record as { acceptance?: { accepted?: unknown } }).acceptance?.accepted === true;

export function validateBusinessSqlDefinitionAuthority(
  record: unknown,
): BusinessSqlDefinitionAuthorityValidation {
  const reasonCodes: BusinessSqlDefinitionAuthorityReasonCode[] = [];
  const blockers: string[] = [];

  if (!record || typeof record !== "object") {
    reasonCodes.push("authority_missing");
    blockers.push("Definition authority is missing.");
    return {
      valid: false,
      accepted: false,
      reasonCodes,
      blockers,
      summary: "authority=missing; accepted=false; valid=false; reasons=authority_missing",
    };
  }

  const candidate = record as Partial<BusinessSqlDefinitionAuthorityRecord> & {
    authority?: unknown;
  };
  const authority =
    typeof candidate.authority === "string" ? candidate.authority : null;

  if (!authority || !AUTHORITY_VALUES.has(authority as BusinessSqlDefinitionAuthorityKind)) {
    reasonCodes.push("authority_unknown");
    blockers.push("Definition authority value is missing or unsupported.");
  }

  if (!candidate.source || typeof candidate.source !== "object") {
    reasonCodes.push("source_missing");
    blockers.push("Definition authority source is missing.");
  } else if (!hasText(candidate.source.sourceId)) {
    reasonCodes.push("source_id_missing");
    blockers.push("Definition authority source identity is missing.");
  }

  if (!candidate.scope || typeof candidate.scope !== "object") {
    reasonCodes.push("scope_missing");
    blockers.push("Definition authority scope is missing.");
  } else if (!hasText(candidate.scope.scopeId)) {
    reasonCodes.push("scope_id_missing");
    blockers.push("Definition authority scope identity is missing.");
  }

  if (!candidate.revision || typeof candidate.revision !== "object") {
    reasonCodes.push("revision_missing");
    blockers.push("Definition authority revision identity is missing.");
  } else if (!hasText(candidate.revision.revisionId)) {
    reasonCodes.push("revision_id_missing");
    blockers.push("Definition authority revision id is missing.");
  }

  if (!candidate.reuseEligibility || typeof candidate.reuseEligibility !== "object") {
    reasonCodes.push("reuse_eligibility_missing");
    blockers.push("Definition authority reuse eligibility is missing.");
  }

  const accepted = candidate.acceptance?.accepted === true;

  if (authority === "governed" && candidate.source) {
    if (!GOVERNED_SOURCE_TYPES.has(candidate.source.sourceType)) {
      reasonCodes.push("governed_source_type_invalid");
      blockers.push("Governed definitions must originate from an approved organizational source.");
    }
    if (candidate.source.approved !== true) {
      reasonCodes.push("governed_approved_source_required");
      blockers.push("Governed definitions require an approved source.");
    }
  }

  if (authority === "user_defined") {
    if (candidate.source && !USER_DEFINED_SOURCE_TYPES.has(candidate.source.sourceType)) {
      reasonCodes.push("user_defined_scope_required");
      blockers.push("User-defined definitions require a user, workspace, or analysis source.");
    }
    if (!accepted || !candidate.acceptance?.acceptanceId) {
      reasonCodes.push("user_defined_acceptance_required");
      blockers.push("User-defined definitions require explicit acceptance provenance.");
    }
    if (!hasText(candidate.acceptance?.actorId)) {
      reasonCodes.push("user_defined_actor_required");
      blockers.push("User-defined definitions require an accepting actor.");
    }
  }

  if (authority === "provisional_proxy") {
    if (candidate.source?.sourceType !== "filtraqueri_proposal") {
      reasonCodes.push("provisional_source_must_be_filtraqueri_proposal");
      blockers.push("Provisional proxy definitions must be marked as FiltraQueri proposals.");
    }
    if (candidate.source?.approved === true) {
      reasonCodes.push("provisional_must_not_use_approved_source");
      blockers.push("Provisional proxy definitions must not claim an approved source.");
    }
    if (!accepted) {
      reasonCodes.push("provisional_acceptance_required_for_authoritative_plan");
      blockers.push("Provisional proxy definitions require explicit acceptance before authoritative use.");
    }
  }

  const uniqueReasonCodes = unique(reasonCodes);
  const authorityLabel = authority && AUTHORITY_VALUES.has(authority as BusinessSqlDefinitionAuthorityKind)
    ? authority
    : unknownAuthority(record);
  const summary = [
    `authority=${authorityLabel}`,
    `source=${candidate.source?.sourceType || "none"}:${candidate.source?.sourceId || "none"}`,
    `scope=${scopeIdentity(candidate.scope)}`,
    `accepted=${accepted}`,
    `reuse=${candidate.reuseEligibility?.eligible === true ? "eligible" : "limited"}`,
    `revision=${candidate.revision?.revisionId || "none"}`,
    `valid=${uniqueReasonCodes.length === 0}`,
    `reasons=${uniqueReasonCodes.join(",") || "none"}`,
  ].join("; ");

  return {
    valid: uniqueReasonCodes.length === 0,
    accepted,
    reasonCodes: uniqueReasonCodes,
    blockers: unique(blockers),
    summary,
  };
}

export function evaluateBusinessSqlDefinitionAuthorityReuse({
  record,
  requestedScope,
}: {
  record: unknown;
  requestedScope: BusinessSqlDefinitionAuthorityScope;
}): BusinessSqlDefinitionAuthorityReuseResult {
  const validation = validateBusinessSqlDefinitionAuthority(record);
  if (!validation.valid) {
    return {
      eligible: false,
      reasonCodes: validation.reasonCodes,
      blockers: validation.blockers,
      summary: `${validation.summary}; requested=${scopeIdentity(requestedScope)}; reuse=false`,
    };
  }

  const authority = record as BusinessSqlDefinitionAuthorityRecord;
  const allowed = authority.reuseEligibility.eligible &&
    authority.reuseEligibility.allowedScopes.some(
      (scope) =>
        scope.scopeKind === requestedScope.scopeKind &&
        scope.scopeId === requestedScope.scopeId,
    );

  if (!allowed) {
    const reasonCodes: BusinessSqlDefinitionAuthorityReasonCode[] = [
      "reuse_scope_not_allowed",
    ];
    return {
      eligible: false,
      reasonCodes,
      blockers: ["Definition authority is not eligible for the requested reuse scope."],
      summary: [
        `authority=${authority.authority}`,
        `requested=${scopeIdentity(requestedScope)}`,
        `allowed=${authority.reuseEligibility.allowedScopes.map(scopeIdentity).join(",") || "none"}`,
        "reuse=false",
        `reasons=${reasonCodes.join(",")}`,
      ].join("; "),
    };
  }

  return {
    eligible: true,
    reasonCodes: [],
    blockers: [],
    summary: [
      `authority=${authority.authority}`,
      `requested=${scopeIdentity(requestedScope)}`,
      "reuse=true",
      "reasons=none",
    ].join("; "),
  };
}
