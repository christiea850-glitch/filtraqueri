import {
  assessBusinessSqlPlanElementIdentityCapability,
  validateBusinessSqlPlanElementIdentityManifest,
  type BusinessSqlPlanElementId,
  type BusinessSqlPlanElementIdentity,
  type BusinessSqlPlanElementKind,
} from "./businessSqlPlanElementIdentity";
import {
  createBusinessSqlFilterId,
  createBusinessSqlRowLimitId,
  type BusinessSqlFilter,
  type BusinessSqlFilterComparisonValue,
  type BusinessSqlFilterOperator,
  type BusinessSqlMeasure,
  type BusinessSqlQueryPlan,
  type BusinessSqlRowLimit,
} from "./businessSqlQueryPlan";
import {
  validateBusinessSqlDefinitionAuthority,
  type BusinessSqlDefinitionAuthorityRecord,
} from "./businessSqlDefinitionAuthority";

export type BusinessSqlPlanRevisionKind = "root" | "accepted_clarification";

export type BusinessSqlPlanRevisionIdentity = {
  revisionId: string;
  revisionSequence: number;
  parentRevisionId?: string;
};

export type BusinessSqlPlanRevisionActor = {
  actorId: string;
  actorType: "user" | "system" | "service";
};

export type BusinessSqlPlanRevisionSource = {
  sourceId: string;
  sourceType: "clarification" | "governance" | "import" | "system";
};

export type BusinessSqlPlanRevisionProvenance = {
  actor: BusinessSqlPlanRevisionActor;
  source: BusinessSqlPlanRevisionSource;
  reason: string;
  clarificationId: string;
  acceptanceId: string;
  acceptedAt?: string;
};

export type BusinessSqlPlanRevisionChangeKind =
  | "filter.comparison_value"
  | "filter.operator"
  | "row_limit.value"
  | "measure.definition_authority"
  | "revision_metadata";

export type BusinessSqlPlanRevisionCanonicalValue =
  | BusinessSqlFilterComparisonValue
  | BusinessSqlFilterOperator
  | BusinessSqlDefinitionAuthorityRecord
  | number
  | string
  | boolean
  | null
  | { readonly [key: string]: BusinessSqlPlanRevisionCanonicalValue }
  | readonly BusinessSqlPlanRevisionCanonicalValue[];

export type BusinessSqlPlanRevisionChangeRecord = {
  changeId: string;
  changeKind: BusinessSqlPlanRevisionChangeKind;
  targetElementId: BusinessSqlPlanElementId;
  targetElementKind: BusinessSqlPlanElementKind;
  previousValue: BusinessSqlPlanRevisionCanonicalValue;
  proposedValue: BusinessSqlPlanRevisionCanonicalValue;
  acceptedValue: BusinessSqlPlanRevisionCanonicalValue;
  actor: BusinessSqlPlanRevisionActor;
  source: BusinessSqlPlanRevisionSource;
  reason: string;
  clarificationId: string;
  acceptanceId: string;
  definitionAuthority?: BusinessSqlDefinitionAuthorityRecord;
};

export type BusinessSqlPlanRevisionRecord = {
  kind: BusinessSqlPlanRevisionKind;
  identity: BusinessSqlPlanRevisionIdentity;
  parentRevisionId?: string;
  plan: BusinessSqlQueryPlan;
  changes: BusinessSqlPlanRevisionChangeRecord[];
  affectedElementIds: BusinessSqlPlanElementId[];
  provenance?: BusinessSqlPlanRevisionProvenance;
  metadata?: Record<string, BusinessSqlPlanRevisionCanonicalValue>;
};

export type BusinessSqlVersionedPlanLedger = {
  version: "business-sql-plan-revision-ledger:v1";
  activeRevisionId: string;
  revisions: BusinessSqlPlanRevisionRecord[];
};

export type BusinessSqlPlanRevisionReasonCode =
  | "none"
  | "revision_id_blank"
  | "revision_id_duplicate"
  | "revision_sequence_duplicate"
  | "revision_sequence_non_monotonic"
  | "revision_sequence_gap"
  | "root_missing"
  | "root_multiple"
  | "root_has_parent"
  | "root_has_changes"
  | "parent_missing"
  | "parent_unknown"
  | "parent_self"
  | "lineage_cycle"
  | "lineage_fork"
  | "active_revision_missing"
  | "active_revision_unknown"
  | "active_revision_not_tip"
  | "plan_identity_invalid"
  | "identity_ineligible"
  | "target_unknown"
  | "target_duplicate"
  | "target_kind_mismatch"
  | "change_id_blank"
  | "change_id_duplicate"
  | "change_kind_unsupported"
  | "previous_value_mismatch"
  | "accepted_status_required"
  | "provenance_actor_malformed"
  | "provenance_source_malformed"
  | "provenance_reason_malformed"
  | "provenance_clarification_malformed"
  | "provenance_acceptance_malformed"
  | "provenance_partial"
  | "definition_authority_invalid"
  | "canonical_value_unchanged"
  | "unaffected_identity_changed"
  | "affected_identity_missing"
  | "element_identity_transferred"
  | "partial_application";

export type BusinessSqlPlanRevisionValidation = {
  valid: boolean;
  reasonCodes: BusinessSqlPlanRevisionReasonCode[];
  blockers: string[];
  summary: string;
};

export type BusinessSqlCreateRootRevisionRequest = {
  plan: BusinessSqlQueryPlan;
  identity: Omit<BusinessSqlPlanRevisionIdentity, "parentRevisionId">;
  metadata?: Record<string, BusinessSqlPlanRevisionCanonicalValue>;
};

export type BusinessSqlAcceptedPlanRevisionRequest = {
  status: "accepted" | "pending" | "rejected" | "malformed" | "unapplied";
  identity: BusinessSqlPlanRevisionIdentity;
  parentRevisionId: string;
  changes: BusinessSqlPlanRevisionChangeRecord[];
  provenance: BusinessSqlPlanRevisionProvenance;
  metadata?: Record<string, BusinessSqlPlanRevisionCanonicalValue>;
};

export type BusinessSqlPlanRevisionResult =
  | {
      status: "created";
      ledger: BusinessSqlVersionedPlanLedger;
      revision: BusinessSqlPlanRevisionRecord;
      validation: BusinessSqlPlanRevisionValidation;
    }
  | {
      status: "ineligible" | "invalid" | "not_applicable";
      ledger?: BusinessSqlVersionedPlanLedger;
      validation: BusinessSqlPlanRevisionValidation;
    };

const hasText = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const unique = <T,>(values: readonly T[]): T[] => Array.from(new Set(values));

const cloneValue = <T,>(value: T): T => {
  if (Array.isArray(value)) return value.map((item) => cloneValue(item)) as T;
  if (value && typeof value === "object") {
    const copy: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) copy[key] = cloneValue(entry);
    return copy as T;
  }
  return value;
};

const canonicalJson = (value: unknown): string => JSON.stringify(value);

const valuesEqual = (left: unknown, right: unknown): boolean =>
  canonicalJson(left) === canonicalJson(right);

const failure = (
  reasonCodes: readonly BusinessSqlPlanRevisionReasonCode[],
  blockers: readonly string[],
): BusinessSqlPlanRevisionValidation => {
  const reasons = unique(reasonCodes);
  return {
    valid: false,
    reasonCodes: reasons,
    blockers: unique(blockers),
    summary: `valid=false; reasons=${reasons.join(",") || "none"}`,
  };
};

const success = (summary: string): BusinessSqlPlanRevisionValidation => ({
  valid: true,
  reasonCodes: [],
  blockers: [],
  summary,
});

const malformedProvenanceReasons = (
  provenance: Partial<BusinessSqlPlanRevisionProvenance> | null | undefined,
): BusinessSqlPlanRevisionReasonCode[] => {
  if (!provenance || typeof provenance !== "object") return ["provenance_partial"];
  const reasons: BusinessSqlPlanRevisionReasonCode[] = [];
  if (!provenance.actor || !hasText(provenance.actor.actorId)) {
    reasons.push("provenance_actor_malformed");
  }
  if (!provenance.source || !hasText(provenance.source.sourceId)) {
    reasons.push("provenance_source_malformed");
  }
  if (!hasText(provenance.reason)) reasons.push("provenance_reason_malformed");
  if (!hasText(provenance.clarificationId)) {
    reasons.push("provenance_clarification_malformed");
  }
  if (!hasText(provenance.acceptanceId)) reasons.push("provenance_acceptance_malformed");
  return reasons;
};

type ResolvedElement =
  | { kind: "filter"; identity: BusinessSqlPlanElementIdentity; value: BusinessSqlFilter }
  | { kind: "ranking"; identity: BusinessSqlPlanElementIdentity; value: BusinessSqlRowLimit }
  | { kind: "measure"; identity: BusinessSqlPlanElementIdentity; value: BusinessSqlMeasure };

const identityById = (
  plan: BusinessSqlQueryPlan,
  elementId: BusinessSqlPlanElementId,
): BusinessSqlPlanElementIdentity | null =>
  (plan.elementIdentities || []).find((identity) => identity.elementId === elementId) || null;

const resolveElementById = (
  plan: BusinessSqlQueryPlan,
  elementId: BusinessSqlPlanElementId,
): ResolvedElement | null => {
  const identity = identityById(plan, elementId);
  if (!identity) return null;
  if (identity.kind === "filter") {
    const value = plan.filters.find((filter) => filter.planElementKey === identity.elementKey);
    return value ? { kind: "filter", identity, value } : null;
  }
  if (identity.kind === "ranking" && plan.rowLimit?.planElementKey === identity.elementKey) {
    return { kind: "ranking", identity, value: plan.rowLimit };
  }
  if (identity.kind === "measure") {
    const value = plan.measures.find((measure) => measure.planElementKey === identity.elementKey);
    return value ? { kind: "measure", identity, value } : null;
  }
  return null;
};

const currentCanonicalValue = (
  plan: BusinessSqlQueryPlan,
  change: BusinessSqlPlanRevisionChangeRecord,
): BusinessSqlPlanRevisionCanonicalValue | null | undefined => {
  if (change.changeKind === "revision_metadata") return change.previousValue;
  const resolved = resolveElementById(plan, change.targetElementId);
  if (!resolved || resolved.kind !== change.targetElementKind) return undefined;
  if (change.changeKind === "filter.comparison_value" && resolved.kind === "filter") {
    return resolved.value.comparisonValue ? cloneValue(resolved.value.comparisonValue) : null;
  }
  if (change.changeKind === "filter.operator" && resolved.kind === "filter") {
    return resolved.value.operator || null;
  }
  if (change.changeKind === "row_limit.value" && resolved.kind === "ranking") {
    return resolved.value.value;
  }
  if (change.changeKind === "measure.definition_authority" && resolved.kind === "measure") {
    return resolved.value.definitionAuthority ? cloneValue(resolved.value.definitionAuthority) : null;
  }
  return undefined;
};

const applyChange = (
  plan: BusinessSqlQueryPlan,
  change: BusinessSqlPlanRevisionChangeRecord,
): BusinessSqlQueryPlan => {
  if (change.changeKind === "revision_metadata") return plan;
  const identity = identityById(plan, change.targetElementId);
  if (!identity) return plan;
  if (change.changeKind === "filter.comparison_value") {
    return {
      ...plan,
      filters: plan.filters.map((filter) => {
        if (filter.planElementKey !== identity.elementKey) return filter;
        const nextFilter = {
          ...filter,
          comparisonValue: cloneValue(change.acceptedValue as BusinessSqlFilterComparisonValue),
        };
        return { ...nextFilter, filterId: createBusinessSqlFilterId(nextFilter) };
      }),
    };
  }
  if (change.changeKind === "filter.operator") {
    return {
      ...plan,
      filters: plan.filters.map((filter) => {
        if (filter.planElementKey !== identity.elementKey) return filter;
        const nextFilter = {
          ...filter,
          operator: change.acceptedValue as BusinessSqlFilterOperator,
        };
        return { ...nextFilter, filterId: createBusinessSqlFilterId(nextFilter) };
      }),
    };
  }
  if (change.changeKind === "row_limit.value") {
    return {
      ...plan,
      rowLimit:
        plan.rowLimit?.planElementKey === identity.elementKey
          ? {
              ...plan.rowLimit,
              value: change.acceptedValue as number,
              rowLimitId: createBusinessSqlRowLimitId({ value: change.acceptedValue as number }),
            }
          : plan.rowLimit,
    };
  }
  if (change.changeKind === "measure.definition_authority") {
    return {
      ...plan,
      measures: plan.measures.map((measure) =>
        measure.planElementKey === identity.elementKey
          ? {
              ...measure,
              definitionAuthority: cloneValue(change.acceptedValue as BusinessSqlDefinitionAuthorityRecord),
            }
          : measure,
      ),
    };
  }
  return plan;
};

const validateChangeRecord = (
  plan: BusinessSqlQueryPlan,
  change: BusinessSqlPlanRevisionChangeRecord,
  seenTargets: Set<string>,
  seenChanges: Set<string>,
): BusinessSqlPlanRevisionValidation => {
  const reasonCodes: BusinessSqlPlanRevisionReasonCode[] = [];
  const blockers: string[] = [];
  if (!hasText(change.changeId)) reasonCodes.push("change_id_blank");
  if (seenChanges.has(change.changeId)) reasonCodes.push("change_id_duplicate");
  seenChanges.add(change.changeId);
  if (seenTargets.has(change.targetElementId)) reasonCodes.push("target_duplicate");
  seenTargets.add(change.targetElementId);
  reasonCodes.push(...malformedProvenanceReasons({
    actor: change.actor,
    source: change.source,
    reason: change.reason,
    clarificationId: change.clarificationId,
    acceptanceId: change.acceptanceId,
  }));

  const resolved = resolveElementById(plan, change.targetElementId);
  if (!resolved) reasonCodes.push("target_unknown");
  if (resolved && resolved.kind !== change.targetElementKind) reasonCodes.push("target_kind_mismatch");

  const current = currentCanonicalValue(plan, change);
  if (typeof current === "undefined") reasonCodes.push("change_kind_unsupported");
  if (typeof current !== "undefined" && !valuesEqual(current, change.previousValue)) {
    reasonCodes.push("previous_value_mismatch");
  }

  if (change.changeKind !== "revision_metadata" && valuesEqual(change.previousValue, change.acceptedValue)) {
    reasonCodes.push("canonical_value_unchanged");
  }

  if (change.changeKind === "measure.definition_authority") {
    const validation = validateBusinessSqlDefinitionAuthority(change.acceptedValue);
    if (!validation.valid) reasonCodes.push("definition_authority_invalid");
  }

  for (const reasonCode of unique(reasonCodes)) {
    blockers.push(`Change ${change.changeId || "missing"} failed ${reasonCode}.`);
  }
  return reasonCodes.length > 0
    ? failure(reasonCodes, blockers)
    : success(`change=${change.changeId}; valid=true`);
};

const validatePlanIdentity = (
  plan: BusinessSqlQueryPlan,
): BusinessSqlPlanRevisionValidation => {
  const capability = assessBusinessSqlPlanElementIdentityCapability(plan);
  if (capability.status === "invalid") {
    return failure(["plan_identity_invalid"], [capability.summary]);
  }
  const validation = validateBusinessSqlPlanElementIdentityManifest(plan);
  if (!validation.valid) return failure(["plan_identity_invalid"], validation.blockers);
  return success(`plan=${plan.id}; identity=${capability.status}`);
};

const lineageTip = (ledger: BusinessSqlVersionedPlanLedger): BusinessSqlPlanRevisionRecord | null => {
  const parentIds = new Set(
    ledger.revisions
      .map((revision) => revision.parentRevisionId)
      .filter((parent): parent is string => Boolean(parent)),
  );
  const tips = ledger.revisions.filter((revision) => !parentIds.has(revision.identity.revisionId));
  return tips.length === 1 ? tips[0] : null;
};

export function validateBusinessSqlPlanRevisionLedger(
  ledger: BusinessSqlVersionedPlanLedger,
): BusinessSqlPlanRevisionValidation {
  const reasonCodes: BusinessSqlPlanRevisionReasonCode[] = [];
  const blockers: string[] = [];
  const byId = new Map<string, BusinessSqlPlanRevisionRecord>();
  const sequenceIds = new Set<number>();
  const childCounts = new Map<string, number>();

  for (const revision of ledger.revisions) {
    if (!hasText(revision.identity.revisionId)) reasonCodes.push("revision_id_blank");
    if (byId.has(revision.identity.revisionId)) reasonCodes.push("revision_id_duplicate");
    byId.set(revision.identity.revisionId, revision);
    if (sequenceIds.has(revision.identity.revisionSequence)) {
      reasonCodes.push("revision_sequence_duplicate");
    }
    sequenceIds.add(revision.identity.revisionSequence);
    const identityValidation = validatePlanIdentity(revision.plan);
    if (!identityValidation.valid) reasonCodes.push("plan_identity_invalid");
    if (revision.kind === "root" && revision.parentRevisionId) reasonCodes.push("root_has_parent");
    if (revision.kind === "root" && revision.changes.length > 0) reasonCodes.push("root_has_changes");
    if (revision.parentRevisionId) {
      if (revision.parentRevisionId === revision.identity.revisionId) reasonCodes.push("parent_self");
      childCounts.set(revision.parentRevisionId, (childCounts.get(revision.parentRevisionId) || 0) + 1);
    }
  }

  const roots = ledger.revisions.filter((revision) => revision.kind === "root");
  if (roots.length === 0) reasonCodes.push("root_missing");
  if (roots.length > 1) reasonCodes.push("root_multiple");
  if (!hasText(ledger.activeRevisionId)) reasonCodes.push("active_revision_missing");
  if (hasText(ledger.activeRevisionId) && !byId.has(ledger.activeRevisionId)) {
    reasonCodes.push("active_revision_unknown");
  }

  for (const revision of ledger.revisions) {
    if (revision.kind !== "root" && !hasText(revision.parentRevisionId)) {
      reasonCodes.push("parent_missing");
    }
    if (revision.parentRevisionId && !byId.has(revision.parentRevisionId)) {
      reasonCodes.push("parent_unknown");
    }
    if (revision.parentRevisionId && (childCounts.get(revision.parentRevisionId) || 0) > 1) {
      reasonCodes.push("lineage_fork");
    }
  }

  const sorted = [...ledger.revisions].sort(
    (left, right) => left.identity.revisionSequence - right.identity.revisionSequence,
  );
  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index].identity.revisionSequence <= sorted[index - 1].identity.revisionSequence) {
      reasonCodes.push("revision_sequence_non_monotonic");
    }
  }

  for (const revision of ledger.revisions) {
    const visited = new Set<string>();
    let cursor: BusinessSqlPlanRevisionRecord | undefined = revision;
    while (cursor?.parentRevisionId) {
      if (visited.has(cursor.identity.revisionId)) {
        reasonCodes.push("lineage_cycle");
        break;
      }
      visited.add(cursor.identity.revisionId);
      cursor = byId.get(cursor.parentRevisionId);
    }
  }

  const tip = lineageTip(ledger);
  if (tip && ledger.activeRevisionId !== tip.identity.revisionId) {
    reasonCodes.push("active_revision_not_tip");
  }

  for (const revision of ledger.revisions) {
    if (!revision.parentRevisionId) continue;
    const parent = byId.get(revision.parentRevisionId);
    if (!parent) continue;
    if (revision.identity.revisionSequence <= parent.identity.revisionSequence) {
      reasonCodes.push("revision_sequence_non_monotonic");
    }
    if (revision.identity.revisionSequence !== parent.identity.revisionSequence + 1) {
      reasonCodes.push("revision_sequence_gap");
    }
    const affected = new Set(revision.affectedElementIds);
    for (const parentIdentity of parent.plan.elementIdentities || []) {
      const childIdentity = identityById(revision.plan, parentIdentity.elementId);
      if (!childIdentity) {
        reasonCodes.push(affected.has(parentIdentity.elementId) ? "affected_identity_missing" : "unaffected_identity_changed");
        continue;
      }
      if (canonicalJson(parentIdentity) !== canonicalJson(childIdentity)) {
        reasonCodes.push("unaffected_identity_changed");
      }
      const parentElement = resolveElementById(parent.plan, parentIdentity.elementId);
      const childElement = resolveElementById(revision.plan, parentIdentity.elementId);
      if (!parentElement || !childElement || parentElement.identity.elementKey !== childElement.identity.elementKey) {
        reasonCodes.push("element_identity_transferred");
      }
    }
  }

  const reasons = unique(reasonCodes);
  for (const reasonCode of reasons) blockers.push(`Ledger failed ${reasonCode}.`);
  return reasons.length > 0
    ? failure(reasons, blockers)
    : success(`revisions=${ledger.revisions.length}; active=${ledger.activeRevisionId}; valid=true`);
}

export function createBusinessSqlRootPlanRevision(
  request: BusinessSqlCreateRootRevisionRequest,
): BusinessSqlPlanRevisionResult {
  const reasons: BusinessSqlPlanRevisionReasonCode[] = [];
  if (!hasText(request.identity.revisionId)) reasons.push("revision_id_blank");
  if (request.identity.revisionSequence !== 1) reasons.push("revision_sequence_non_monotonic");
  const identityValidation = validatePlanIdentity(request.plan);
  if (!identityValidation.valid) reasons.push(...identityValidation.reasonCodes);
  if (reasons.length > 0) return { status: "invalid", validation: failure(reasons, ["Root revision request is invalid."]) };

  const revision: BusinessSqlPlanRevisionRecord = {
    kind: "root",
    identity: {
      revisionId: request.identity.revisionId,
      revisionSequence: request.identity.revisionSequence,
    },
    plan: cloneValue(request.plan),
    changes: [],
    affectedElementIds: [],
    metadata: request.metadata ? cloneValue(request.metadata) : undefined,
  };
  const ledger: BusinessSqlVersionedPlanLedger = {
    version: "business-sql-plan-revision-ledger:v1",
    activeRevisionId: revision.identity.revisionId,
    revisions: [revision],
  };
  const validation = validateBusinessSqlPlanRevisionLedger(ledger);
  return validation.valid
    ? { status: "created", ledger, revision, validation }
    : { status: "invalid", validation };
}

export const getActiveBusinessSqlPlanRevision = (
  ledger: BusinessSqlVersionedPlanLedger,
): BusinessSqlPlanRevisionRecord | null =>
  ledger.revisions.find((revision) => revision.identity.revisionId === ledger.activeRevisionId) || null;

export const getActiveBusinessSqlPlan = (
  ledger: BusinessSqlVersionedPlanLedger,
): BusinessSqlQueryPlan | null => getActiveBusinessSqlPlanRevision(ledger)?.plan || null;

export function applyAcceptedBusinessSqlPlanRevision(
  ledger: BusinessSqlVersionedPlanLedger,
  request: BusinessSqlAcceptedPlanRevisionRequest,
): BusinessSqlPlanRevisionResult {
  if (request.status !== "accepted") {
    return {
      status: "not_applicable",
      ledger,
      validation: failure(["accepted_status_required"], ["Only accepted clarification revisions can create lineage."]),
    };
  }

  const ledgerValidation = validateBusinessSqlPlanRevisionLedger(ledger);
  if (!ledgerValidation.valid) return { status: "invalid", ledger, validation: ledgerValidation };
  const active = getActiveBusinessSqlPlanRevision(ledger);
  if (!active) {
    return { status: "invalid", ledger, validation: failure(["active_revision_unknown"], ["Active revision was not found."]) };
  }
  const capability = assessBusinessSqlPlanElementIdentityCapability(active.plan);
  if (capability.status !== "identity_capable") {
    return {
      status: "ineligible",
      ledger,
      validation: failure(["identity_ineligible"], [capability.summary]),
    };
  }

  const reasonCodes: BusinessSqlPlanRevisionReasonCode[] = [];
  if (!hasText(request.identity.revisionId)) reasonCodes.push("revision_id_blank");
  if (ledger.revisions.some((revision) => revision.identity.revisionId === request.identity.revisionId)) {
    reasonCodes.push("revision_id_duplicate");
  }
  if (ledger.revisions.some((revision) => revision.identity.revisionSequence === request.identity.revisionSequence)) {
    reasonCodes.push("revision_sequence_duplicate");
  }
  if (request.identity.revisionSequence <= active.identity.revisionSequence) {
    reasonCodes.push("revision_sequence_non_monotonic");
  }
  if (request.identity.revisionSequence !== active.identity.revisionSequence + 1) {
    reasonCodes.push("revision_sequence_gap");
  }
  if (request.parentRevisionId !== active.identity.revisionId || request.identity.parentRevisionId !== active.identity.revisionId) {
    reasonCodes.push("parent_missing");
  }
  reasonCodes.push(...malformedProvenanceReasons(request.provenance));

  const seenTargets = new Set<string>();
  const seenChanges = new Set<string>();
  for (const change of request.changes) {
    const validation = validateChangeRecord(active.plan, change, seenTargets, seenChanges);
    reasonCodes.push(...validation.reasonCodes);
  }
  if (request.changes.length === 0) reasonCodes.push("provenance_partial");
  if (reasonCodes.length > 0) {
    return { status: "invalid", ledger, validation: failure(reasonCodes, ["Accepted revision request is invalid."]) };
  }

  let nextPlan = cloneValue(active.plan);
  for (const change of request.changes) nextPlan = applyChange(nextPlan, change);
  const changedCanonical = !valuesEqual(active.plan, nextPlan);
  const onlyMetadataChanges = request.changes.every((change) => change.changeKind === "revision_metadata");
  if (!changedCanonical && !onlyMetadataChanges) {
    return {
      status: "invalid",
      ledger,
      validation: failure(["partial_application"], ["Accepted changes did not alter the canonical plan."]),
    };
  }

  const revision: BusinessSqlPlanRevisionRecord = {
    kind: "accepted_clarification",
    identity: cloneValue(request.identity),
    parentRevisionId: active.identity.revisionId,
    plan: nextPlan,
    changes: cloneValue(request.changes),
    affectedElementIds: request.changes.map((change) => change.targetElementId),
    provenance: cloneValue(request.provenance),
    metadata: request.metadata ? cloneValue(request.metadata) : undefined,
  };
  const nextLedger: BusinessSqlVersionedPlanLedger = {
    version: ledger.version,
    activeRevisionId: revision.identity.revisionId,
    revisions: [...ledger.revisions.map((item) => cloneValue(item)), revision],
  };
  const validation = validateBusinessSqlPlanRevisionLedger(nextLedger);
  return validation.valid
    ? { status: "created", ledger: nextLedger, revision, validation }
    : { status: "invalid", ledger, validation };
}
