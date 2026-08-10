import type { BusinessSqlQueryPlan } from "./businessSqlQueryPlan";

export type BusinessSqlPlanElementCoreKind =
  | "measure"
  | "filter"
  | "grouping"
  | "comparison"
  | "ranking"
  | "relationship"
  | "visualization"
  | "explanation";

export type BusinessSqlPlanElementExtensionKind = `extension:${string}`;

export type BusinessSqlPlanElementKind =
  | BusinessSqlPlanElementCoreKind
  | BusinessSqlPlanElementExtensionKind;

export type BusinessSqlPlanElementKey = string;
export type BusinessSqlPlanElementId = string;

export type BusinessSqlPlanElementIdentity = {
  version: "business-sql-plan-element-identity:v1";
  scopeId: string;
  kind: BusinessSqlPlanElementKind;
  elementKey: BusinessSqlPlanElementKey;
  elementId: BusinessSqlPlanElementId;
};

export type BusinessSqlPlanElementIdentityClaim = {
  kind: BusinessSqlPlanElementKind;
  elementKey: BusinessSqlPlanElementKey;
};

export type BusinessSqlPlanElementIdentityReasonCode =
  | "identity_missing"
  | "identity_not_object"
  | "identity_version_unsupported"
  | "identity_scope_missing"
  | "identity_kind_unsupported"
  | "identity_element_key_missing"
  | "identity_element_id_missing"
  | "identity_element_id_malformed"
  | "identity_element_id_not_canonical"
  | "duplicate_identity"
  | "duplicate_element_claim"
  | "identity_without_element_claim"
  | "element_claim_without_identity";

export type BusinessSqlPlanElementIdentityCapabilityReason =
  | "none"
  | "stable_anchor_unavailable"
  | "stable_anchor_collision"
  | BusinessSqlPlanElementIdentityReasonCode;

export type BusinessSqlPlanElementIdentityValidation = {
  valid: boolean;
  compatibleLegacyPlan: boolean;
  reasonCodes: BusinessSqlPlanElementIdentityReasonCode[];
  blockers: string[];
  summary: string;
};

export type BusinessSqlPlanElementIdentityCapabilityStatus =
  | "legacy_compatible"
  | "eligible"
  | "ineligible"
  | "identity_capable"
  | "invalid";

export type BusinessSqlPlanElementIdentityCapability = {
  status: BusinessSqlPlanElementIdentityCapabilityStatus;
  eligible: boolean;
  identityCapable: boolean;
  compatibleLegacyPlan: boolean;
  reasonCodes: BusinessSqlPlanElementIdentityCapabilityReason[];
  missingStableAnchorKinds: BusinessSqlPlanElementKind[];
  stableAnchorCollisionKinds: BusinessSqlPlanElementKind[];
  summary: string;
};

const CORE_KINDS = new Set<BusinessSqlPlanElementCoreKind>([
  "measure",
  "filter",
  "grouping",
  "comparison",
  "ranking",
  "relationship",
  "visualization",
  "explanation",
]);

const hasText = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const unique = <T,>(values: readonly T[]): T[] => Array.from(new Set(values));

const extensionKindPattern = /^extension:[a-z][a-z0-9-]*(?::[a-z][a-z0-9-]*)*$/;
const elementIdPattern = /^business-sql-plan-element:v1:(?:[0-9]+:[0-9a-f]+|0:empty):(?:[0-9]+:[0-9a-f]+|0:empty):(?:[0-9]+:[0-9a-f]+|0:empty)$/;

const encodeIdentityPart = (value: string): string => {
  const hex = Array.from(value)
    .map((character) => character.codePointAt(0)?.toString(16).padStart(6, "0") || "")
    .join("");
  return `${Array.from(value).length}:${hex || "empty"}`;
};

export const isBusinessSqlPlanElementKind = (
  value: unknown,
): value is BusinessSqlPlanElementKind =>
  typeof value === "string" &&
  (CORE_KINDS.has(value as BusinessSqlPlanElementCoreKind) ||
    extensionKindPattern.test(value));

export const createBusinessSqlPlanElementIdentity = ({
  scopeId,
  kind,
  elementKey,
}: {
  scopeId: string;
  kind: BusinessSqlPlanElementKind;
  elementKey: BusinessSqlPlanElementKey;
}): BusinessSqlPlanElementIdentity => {
  return {
    version: "business-sql-plan-element-identity:v1",
    scopeId,
    kind,
    elementKey,
    elementId: [
      "business-sql-plan-element",
      "v1",
      encodeIdentityPart(scopeId),
      encodeIdentityPart(kind),
      encodeIdentityPart(elementKey),
    ].join(":"),
  };
};

export const serializeBusinessSqlPlanElementIdentity = (
  identity: BusinessSqlPlanElementIdentity,
): string =>
  JSON.stringify({
    version: identity.version,
    scopeId: identity.scopeId,
    kind: identity.kind,
    elementKey: identity.elementKey,
    elementId: identity.elementId,
  });

export const reconstructBusinessSqlPlanElementIdentity = (
  serialized: string,
): BusinessSqlPlanElementIdentity =>
  JSON.parse(serialized) as BusinessSqlPlanElementIdentity;

const identityClaimKey = (claim: BusinessSqlPlanElementIdentityClaim): string =>
  [encodeIdentityPart(claim.kind), encodeIdentityPart(claim.elementKey)].join(":");

const addClaim = (
  claims: BusinessSqlPlanElementIdentityClaim[],
  kind: BusinessSqlPlanElementKind,
  elementKey: string | undefined,
) => {
  if (!hasText(elementKey)) return;
  claims.push({ kind, elementKey });
};

const addMissingAnchorKind = (
  kinds: BusinessSqlPlanElementKind[],
  kind: BusinessSqlPlanElementKind,
  elementKey: string | undefined,
) => {
  if (!hasText(elementKey)) kinds.push(kind);
};

export const getBusinessSqlPlanElementIdentityClaims = (
  plan: Pick<
    BusinessSqlQueryPlan,
    | "measures"
    | "derivedMeasures"
    | "groupings"
    | "filters"
    | "orderBy"
    | "rowLimit"
    | "aggregateResultConditions"
    | "joinPath"
  >,
): BusinessSqlPlanElementIdentityClaim[] => {
  const claims: BusinessSqlPlanElementIdentityClaim[] = [];
  for (const measure of plan.measures) addClaim(claims, "measure", measure.planElementKey);
  for (const derivedMeasure of plan.derivedMeasures) addClaim(claims, "measure", derivedMeasure.planElementKey);
  for (const grouping of plan.groupings) addClaim(claims, "grouping", grouping.planElementKey);
  for (const filter of plan.filters) addClaim(claims, "filter", filter.planElementKey);
  for (const sort of plan.orderBy) addClaim(claims, "ranking", sort.planElementKey);
  if (plan.rowLimit) addClaim(claims, "ranking", plan.rowLimit.planElementKey);
  for (const condition of plan.aggregateResultConditions) {
    addClaim(claims, "comparison", condition.planElementKey);
  }
  for (const requirement of plan.joinPath.requirements) {
    addClaim(claims, "relationship", requirement.planElementKey);
  }
  return claims;
};

// PS-CMG2 intentionally stops at elements that already have production-owned
// stable anchors. Multi-element intent-slot ownership is deferred architecture;
// this assessment prevents fabricating partial identities from mutable content.
export const getBusinessSqlPlanElementsMissingStableAnchors = (
  plan: Pick<
    BusinessSqlQueryPlan,
    | "measures"
    | "derivedMeasures"
    | "groupings"
    | "filters"
    | "orderBy"
    | "rowLimit"
    | "aggregateResultConditions"
    | "joinPath"
  >,
): BusinessSqlPlanElementKind[] => {
  const kinds: BusinessSqlPlanElementKind[] = [];
  for (const measure of plan.measures) addMissingAnchorKind(kinds, "measure", measure.planElementKey);
  for (const derivedMeasure of plan.derivedMeasures) addMissingAnchorKind(kinds, "measure", derivedMeasure.planElementKey);
  for (const grouping of plan.groupings) addMissingAnchorKind(kinds, "grouping", grouping.planElementKey);
  for (const filter of plan.filters) addMissingAnchorKind(kinds, "filter", filter.planElementKey);
  for (const sort of plan.orderBy) addMissingAnchorKind(kinds, "ranking", sort.planElementKey);
  if (plan.rowLimit) addMissingAnchorKind(kinds, "ranking", plan.rowLimit.planElementKey);
  for (const condition of plan.aggregateResultConditions) {
    addMissingAnchorKind(kinds, "comparison", condition.planElementKey);
  }
  for (const requirement of plan.joinPath.requirements) {
    addMissingAnchorKind(kinds, "relationship", requirement.planElementKey);
  }
  return unique(kinds);
};

export const getBusinessSqlPlanElementStableAnchorCollisionKinds = (
  plan: Pick<
    BusinessSqlQueryPlan,
    | "measures"
    | "derivedMeasures"
    | "groupings"
    | "filters"
    | "orderBy"
    | "rowLimit"
    | "aggregateResultConditions"
    | "joinPath"
  >,
): BusinessSqlPlanElementKind[] => {
  const seen = new Set<string>();
  const collisions: BusinessSqlPlanElementKind[] = [];
  for (const claim of getBusinessSqlPlanElementIdentityClaims(plan)) {
    const key = identityClaimKey(claim);
    if (seen.has(key)) collisions.push(claim.kind);
    seen.add(key);
  }
  return unique(collisions);
};

export const createBusinessSqlPlanElementIdentityManifest = (
  plan: Pick<
    BusinessSqlQueryPlan,
    | "id"
    | "measures"
    | "derivedMeasures"
    | "groupings"
    | "filters"
    | "orderBy"
    | "rowLimit"
    | "aggregateResultConditions"
    | "joinPath"
  >,
): BusinessSqlPlanElementIdentity[] =>
  getBusinessSqlPlanElementIdentityClaims(plan).map((claim) =>
    createBusinessSqlPlanElementIdentity({
      scopeId: plan.id,
      kind: claim.kind,
      elementKey: claim.elementKey,
    }),
  );

export function assessBusinessSqlPlanElementIdentityCapability(
  plan: Pick<
    BusinessSqlQueryPlan,
    | "id"
    | "elementIdentities"
    | "measures"
    | "derivedMeasures"
    | "groupings"
    | "filters"
    | "orderBy"
    | "rowLimit"
    | "aggregateResultConditions"
    | "joinPath"
  >,
): BusinessSqlPlanElementIdentityCapability {
  const claims = getBusinessSqlPlanElementIdentityClaims(plan);
  const missingStableAnchorKinds = getBusinessSqlPlanElementsMissingStableAnchors(plan);
  const stableAnchorCollisionKinds = getBusinessSqlPlanElementStableAnchorCollisionKinds(plan);
  const hasManifest = typeof plan.elementIdentities !== "undefined";
  const hasClaims = claims.length > 0;

  if (hasManifest) {
    const validation = validateBusinessSqlPlanElementIdentityManifest(plan);
    const status = validation.valid ? "identity_capable" : "invalid";
    return {
      status,
      eligible: validation.valid,
      identityCapable: validation.valid,
      compatibleLegacyPlan: validation.compatibleLegacyPlan,
      reasonCodes: validation.reasonCodes.length > 0 ? validation.reasonCodes : ["none"],
      missingStableAnchorKinds,
      stableAnchorCollisionKinds,
      summary: [
        validation.summary,
        `capability=${status}`,
        `missingStableAnchors=${missingStableAnchorKinds.join(",") || "none"}`,
        `stableAnchorCollisions=${stableAnchorCollisionKinds.join(",") || "none"}`,
      ].join("; "),
    };
  }

  if (stableAnchorCollisionKinds.length > 0) {
    return {
      status: "ineligible",
      eligible: false,
      identityCapable: false,
      compatibleLegacyPlan: true,
      reasonCodes: ["stable_anchor_collision"],
      missingStableAnchorKinds,
      stableAnchorCollisionKinds,
      summary: [
        `plan=${plan.id}`,
        "capability=ineligible",
        "compatibleLegacyPlan=true",
        "reason=stable_anchor_collision",
        `stableAnchorCollisions=${stableAnchorCollisionKinds.join(",")}`,
      ].join("; "),
    };
  }

  if (missingStableAnchorKinds.length > 0) {
    return {
      status: "ineligible",
      eligible: false,
      identityCapable: false,
      compatibleLegacyPlan: true,
      reasonCodes: ["stable_anchor_unavailable"],
      missingStableAnchorKinds,
      stableAnchorCollisionKinds,
      summary: [
        `plan=${plan.id}`,
        "capability=ineligible",
        "compatibleLegacyPlan=true",
        "reason=stable_anchor_unavailable",
        `missingStableAnchors=${missingStableAnchorKinds.join(",")}`,
      ].join("; "),
    };
  }

  if (hasClaims) {
    return {
      status: "eligible",
      eligible: true,
      identityCapable: false,
      compatibleLegacyPlan: false,
      reasonCodes: ["none"],
      missingStableAnchorKinds,
      stableAnchorCollisionKinds,
      summary: [
        `plan=${plan.id}`,
        "capability=eligible",
        `claims=${claims.length}`,
        "missingStableAnchors=none",
      ].join("; "),
    };
  }

  return {
    status: "legacy_compatible",
    eligible: false,
    identityCapable: false,
    compatibleLegacyPlan: true,
    reasonCodes: ["none"],
    missingStableAnchorKinds,
    stableAnchorCollisionKinds,
    summary: [
      `plan=${plan.id}`,
      "capability=legacy_compatible",
      "compatibleLegacyPlan=true",
      "missingStableAnchors=none",
    ].join("; "),
  };
}

export const attachBusinessSqlPlanElementIdentityManifest = <
  T extends BusinessSqlQueryPlan,
>(
  plan: T,
): T =>
  typeof plan.elementIdentities !== "undefined"
    ? plan
    : assessBusinessSqlPlanElementIdentityCapability(plan).status !== "eligible"
    ? plan
    : {
        ...plan,
        elementIdentities: createBusinessSqlPlanElementIdentityManifest(plan),
      };

export const resolveBusinessSqlPlanElementIdentity = (
  plan: Pick<BusinessSqlQueryPlan, "elementIdentities">,
  claim: BusinessSqlPlanElementIdentityClaim,
): BusinessSqlPlanElementIdentity | null =>
  (plan.elementIdentities || []).find(
    (identity) =>
      identity.kind === claim.kind &&
      identity.elementKey === claim.elementKey,
  ) || null;

const validateIdentityRecord = (
  identity: unknown,
  expectedScopeId: string,
): {
  identity: BusinessSqlPlanElementIdentity | null;
  reasonCodes: BusinessSqlPlanElementIdentityReasonCode[];
  blockers: string[];
} => {
  const reasonCodes: BusinessSqlPlanElementIdentityReasonCode[] = [];
  const blockers: string[] = [];

  if (!identity) {
    return {
      identity: null,
      reasonCodes: ["identity_missing"],
      blockers: ["Plan-element identity is missing."],
    };
  }

  if (typeof identity !== "object" || Array.isArray(identity)) {
    return {
      identity: null,
      reasonCodes: ["identity_not_object"],
      blockers: ["Plan-element identity must be an object."],
    };
  }

  const candidate = identity as Partial<BusinessSqlPlanElementIdentity>;
  if (candidate.version !== "business-sql-plan-element-identity:v1") {
    reasonCodes.push("identity_version_unsupported");
    blockers.push("Plan-element identity version is unsupported.");
  }
  if (!hasText(candidate.scopeId)) {
    reasonCodes.push("identity_scope_missing");
    blockers.push("Plan-element identity scope is missing.");
  }
  if (candidate.scopeId !== expectedScopeId) {
    reasonCodes.push("identity_scope_missing");
    blockers.push("Plan-element identity scope does not match the plan.");
  }
  if (!isBusinessSqlPlanElementKind(candidate.kind)) {
    reasonCodes.push("identity_kind_unsupported");
    blockers.push("Plan-element identity kind is unsupported.");
  }
  if (!hasText(candidate.elementKey)) {
    reasonCodes.push("identity_element_key_missing");
    blockers.push("Plan-element identity key is missing.");
  }
  if (!hasText(candidate.elementId)) {
    reasonCodes.push("identity_element_id_missing");
    blockers.push("Plan-element identity id is missing.");
  } else if (!elementIdPattern.test(candidate.elementId)) {
    reasonCodes.push("identity_element_id_malformed");
    blockers.push("Plan-element identity id is malformed.");
  }

  if (
    hasText(candidate.scopeId) &&
    isBusinessSqlPlanElementKind(candidate.kind) &&
    hasText(candidate.elementKey) &&
    hasText(candidate.elementId)
  ) {
    const canonical = createBusinessSqlPlanElementIdentity({
      scopeId: candidate.scopeId,
      kind: candidate.kind,
      elementKey: candidate.elementKey,
    });
    if (candidate.elementId !== canonical.elementId) {
      reasonCodes.push("identity_element_id_not_canonical");
      blockers.push("Plan-element identity id does not match its canonical scope/kind/key.");
    }
  }

  return {
    identity: candidate as BusinessSqlPlanElementIdentity,
    reasonCodes,
    blockers,
  };
};

export function validateBusinessSqlPlanElementIdentityManifest(
  plan: Pick<
    BusinessSqlQueryPlan,
    | "id"
    | "elementIdentities"
    | "measures"
    | "derivedMeasures"
    | "groupings"
    | "filters"
    | "orderBy"
    | "rowLimit"
    | "aggregateResultConditions"
    | "joinPath"
  >,
): BusinessSqlPlanElementIdentityValidation {
  const identities = plan.elementIdentities || [];
  const claims = getBusinessSqlPlanElementIdentityClaims(plan);
  const reasonCodes: BusinessSqlPlanElementIdentityReasonCode[] = [];
  const blockers: string[] = [];

  if (identities.length === 0 && claims.length === 0) {
    return {
      valid: true,
      compatibleLegacyPlan: true,
      reasonCodes: [],
      blockers: [],
      summary: `plan=${plan.id}; identities=0; claims=0; compatibleLegacyPlan=true; valid=true; reasons=none`,
    };
  }

  const validIdentities: BusinessSqlPlanElementIdentity[] = [];
  for (const identity of identities) {
    const validation = validateIdentityRecord(identity, plan.id);
    reasonCodes.push(...validation.reasonCodes);
    blockers.push(...validation.blockers);
    if (validation.identity) validIdentities.push(validation.identity);
  }

  const identityIds = new Set<string>();
  for (const identity of validIdentities) {
    if (identityIds.has(identity.elementId)) {
      reasonCodes.push("duplicate_identity");
      blockers.push(`Duplicate plan-element identity ${identity.elementId}.`);
    }
    identityIds.add(identity.elementId);
  }

  const identityClaimKeys = new Set<string>();
  for (const identity of validIdentities) {
    const key = identityClaimKey(identity);
    if (identityClaimKeys.has(key)) {
      reasonCodes.push("duplicate_identity");
      blockers.push(`Duplicate plan-element identity claim ${identity.kind}:${identity.elementKey}.`);
    }
    identityClaimKeys.add(key);
  }

  const claimedKeys = new Set<string>();
  for (const claim of claims) {
    const key = identityClaimKey(claim);
    if (claimedKeys.has(key)) {
      reasonCodes.push("duplicate_element_claim");
      blockers.push(`Multiple plan elements claim ${claim.kind}:${claim.elementKey}.`);
    }
    claimedKeys.add(key);
  }

  for (const identity of validIdentities) {
    if (!claimedKeys.has(identityClaimKey(identity))) {
      reasonCodes.push("identity_without_element_claim");
      blockers.push(`Identity ${identity.elementId} is not associated with a real plan element.`);
    }
  }

  for (const claim of claims) {
    if (!identityClaimKeys.has(identityClaimKey(claim))) {
      reasonCodes.push("element_claim_without_identity");
      blockers.push(`Plan element ${claim.kind}:${claim.elementKey} has no identity record.`);
    }
  }

  const uniqueReasons = unique(reasonCodes);
  return {
    valid: uniqueReasons.length === 0,
    compatibleLegacyPlan: false,
    reasonCodes: uniqueReasons,
    blockers: unique(blockers),
    summary: [
      `plan=${plan.id}`,
      `identities=${identities.length}`,
      `claims=${claims.length}`,
      "compatibleLegacyPlan=false",
      `valid=${uniqueReasons.length === 0}`,
      `reasons=${uniqueReasons.join(",") || "none"}`,
    ].join("; "),
  };
}
