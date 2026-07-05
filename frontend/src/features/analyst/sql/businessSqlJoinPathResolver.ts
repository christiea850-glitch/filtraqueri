import type { AcceptedRelationshipContract } from "../../workbook";
import {
  type BusinessSqlJoinEdge,
  type BusinessSqlJoinPath,
  type BusinessSqlJoinRequirement,
  type BusinessSqlPlanWarning,
  type BusinessSqlQueryPlan,
} from "./businessSqlQueryPlan";

export type BusinessSqlMissingRelationship = {
  fromEntity: string;
  toEntity: string;
  reason?: string;
};

export type BusinessSqlRelationshipStatus =
  | "accepted"
  | "ready"
  | "verified"
  | "unknown"
  | "missing"
  | "rejected"
  | "invalid";

export type BusinessSqlRelationshipMetadata = {
  id: string;
  fromEntity: string;
  toEntity: string;
  fromTable?: string;
  fromField?: string;
  toTable?: string;
  toField?: string;
  status: BusinessSqlRelationshipStatus;
};

export type BusinessSqlJoinResolutionReason =
  | "accepted_relationship"
  | "ready_relationship"
  | "verified_relationship"
  | "unknown_relationship"
  | "missing_relationship"
  | "rejected_relationship"
  | "invalid_relationship";

export type BusinessSqlJoinRequirementResolution = {
  requirement: BusinessSqlJoinRequirement;
  status: "resolved" | "needs_review" | "blocked";
  reason: BusinessSqlJoinResolutionReason;
  relationshipId?: string;
  edge?: BusinessSqlJoinEdge;
};

export type BusinessSqlJoinPathResolution = {
  status: "ready" | "needs_review" | "blocked";
  support: "supported" | "needs_review" | "blocked";
  resolved: BusinessSqlJoinRequirementResolution[];
  unresolved: BusinessSqlJoinRequirementResolution[];
  blocked: BusinessSqlJoinRequirementResolution[];
  relationshipIds: string[];
  assumptions: string[];
  warnings: string[];
};

export type ResolveBusinessSqlJoinPathsInput = {
  requirements: readonly BusinessSqlJoinRequirement[];
  relationships?: readonly BusinessSqlRelationshipMetadata[];
};

export type ResolveBusinessSqlJoinPathInput = {
  plan: BusinessSqlQueryPlan;
  acceptedRelationshipContracts?: readonly AcceptedRelationshipContract[];
  readyRelationshipContracts?: readonly AcceptedRelationshipContract[];
  missingRelationships?: readonly BusinessSqlMissingRelationship[];
};

type RelationshipMatch = {
  contract: AcceptedRelationshipContract;
  reversed: boolean;
};

const sameName = (left: string | undefined, right: string | undefined): boolean =>
  Boolean(left && right && left.trim().toLowerCase() === right.trim().toLowerCase());

const uniqueStrings = (values: readonly string[]): string[] =>
  Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));

const pairMatches = (
  leftFrom: string,
  leftTo: string,
  rightFrom: string,
  rightTo: string,
): boolean =>
  (sameName(leftFrom, rightFrom) && sameName(leftTo, rightTo)) ||
  (sameName(leftFrom, rightTo) && sameName(leftTo, rightFrom));

const relationshipKey = (fromEntity: string, toEntity: string): string =>
  [fromEntity.trim().toLowerCase(), toEntity.trim().toLowerCase()].sort().join("::");

const ELIGIBLE_STATUSES: readonly BusinessSqlRelationshipStatus[] = [
  "accepted",
  "ready",
  "verified",
];

const reasonForStatus = (
  status: BusinessSqlRelationshipStatus,
): BusinessSqlJoinResolutionReason => `${status}_relationship` as BusinessSqlJoinResolutionReason;

const edgeFromMetadata = (
  requirement: BusinessSqlJoinRequirement,
  relationship: BusinessSqlRelationshipMetadata,
): BusinessSqlJoinEdge => {
  const reversed = sameName(relationship.fromEntity, requirement.toEntity);
  return {
    fromEntity: requirement.fromEntity,
    fromTable: reversed ? relationship.toTable : relationship.fromTable,
    fromField: reversed ? relationship.toField : relationship.fromField,
    toEntity: requirement.toEntity,
    toTable: reversed ? relationship.fromTable : relationship.toTable,
    toField: reversed ? relationship.fromField : relationship.toField,
    relationship: relationship.id,
    verified: true,
  };
};

/** Resolves join requirements only; it never produces SQL or runtime instructions. */
export function resolveBusinessSqlJoinPaths({
  requirements,
  relationships = [],
}: ResolveBusinessSqlJoinPathsInput): BusinessSqlJoinPathResolution {
  const resolved: BusinessSqlJoinRequirementResolution[] = [];
  const unresolved: BusinessSqlJoinRequirementResolution[] = [];
  const blocked: BusinessSqlJoinRequirementResolution[] = [];

  for (const requirement of requirements) {
    const candidates = relationships
      .filter((relationship) =>
        pairMatches(
          requirement.fromEntity,
          requirement.toEntity,
          relationship.fromEntity,
          relationship.toEntity,
        ),
      )
      .slice()
      .sort((left, right) => left.id.localeCompare(right.id));
    const eligible = candidates.find((candidate) =>
      ELIGIBLE_STATUSES.includes(candidate.status),
    );

    if (eligible) {
      resolved.push({
        requirement: { ...requirement, verified: true },
        status: "resolved",
        reason: reasonForStatus(eligible.status),
        relationshipId: eligible.id,
        edge: edgeFromMetadata(requirement, eligible),
      });
      continue;
    }

    const blocking = candidates.find((candidate) =>
      ["missing", "rejected", "invalid"].includes(candidate.status),
    );
    if (blocking) {
      blocked.push({
        requirement: { ...requirement, verified: false },
        status: "blocked",
        reason: reasonForStatus(blocking.status),
        relationshipId: blocking.id,
      });
      continue;
    }

    const unknown = candidates.find((candidate) => candidate.status === "unknown");
    unresolved.push({
      requirement: { ...requirement, verified: false },
      status: "needs_review",
      reason: "unknown_relationship",
      relationshipId: unknown?.id,
    });
  }

  const status = blocked.length > 0 ? "blocked" : unresolved.length > 0 ? "needs_review" : "ready";
  return {
    status,
    support: status === "ready" ? "supported" : status,
    resolved,
    unresolved,
    blocked,
    relationshipIds: resolved.flatMap((item) => item.relationshipId ? [item.relationshipId] : []),
    assumptions: [],
    warnings: [
      ...unresolved.map((item) =>
        `Relationship ${item.requirement.fromEntity} -> ${item.requirement.toEntity} needs review.`,
      ),
      ...blocked.map((item) =>
        `Relationship ${item.requirement.fromEntity} -> ${item.requirement.toEntity} is blocked.`,
      ),
    ],
  };
}

const warningExists = (
  warnings: readonly BusinessSqlPlanWarning[],
  id: string,
): boolean => warnings.some((warning) => warning.id === id);

const activeReadyContracts = (
  acceptedRelationshipContracts: readonly AcceptedRelationshipContract[],
  readyRelationshipContracts: readonly AcceptedRelationshipContract[],
): AcceptedRelationshipContract[] => {
  const byId = new Map<string, AcceptedRelationshipContract>();
  for (const contract of [
    ...acceptedRelationshipContracts,
    ...readyRelationshipContracts,
  ]) {
    if (contract.status !== "active" || contract.validationState === "broken") {
      continue;
    }
    byId.set(contract.contractId, contract);
  }
  return Array.from(byId.values()).sort((left, right) =>
    left.contractId.localeCompare(right.contractId),
  );
};

const tableForEntity = (
  plan: BusinessSqlQueryPlan,
  entity: string,
): string | undefined =>
  plan.entities.find((entry) => sameName(entry.entity, entity))?.table;

const hintForRequirement = (
  joinPath: BusinessSqlJoinPath,
  requirement: BusinessSqlJoinRequirement,
): BusinessSqlJoinEdge | undefined =>
  joinPath.edges.find((edge) =>
    pairMatches(
      edge.fromEntity,
      edge.toEntity,
      requirement.fromEntity,
      requirement.toEntity,
    ),
  );

const findContractMatch = (
  requirement: BusinessSqlJoinRequirement,
  hint: BusinessSqlJoinEdge | undefined,
  plan: BusinessSqlQueryPlan,
  contracts: readonly AcceptedRelationshipContract[],
): RelationshipMatch | null => {
  const fromTable = hint?.fromTable || tableForEntity(plan, requirement.fromEntity);
  const toTable = hint?.toTable || tableForEntity(plan, requirement.toEntity);

  return (
    contracts
      .map((contract): RelationshipMatch | null => {
        const sameDirection =
          sameName(contract.sourceTableName, fromTable) &&
          sameName(contract.targetTableName, toTable);
        const reverseDirection =
          sameName(contract.sourceTableName, toTable) &&
          sameName(contract.targetTableName, fromTable);

        if (!sameDirection && !reverseDirection) return null;

        if (hint?.fromField && hint?.toField) {
          const columnsMatch =
            (sameName(contract.sourceColumnName, hint.fromField) &&
              sameName(contract.targetColumnName, hint.toField)) ||
            (sameName(contract.sourceColumnName, hint.toField) &&
              sameName(contract.targetColumnName, hint.fromField));
          if (!columnsMatch) return null;
        }

        return { contract, reversed: reverseDirection };
      })
      .find((match): match is RelationshipMatch => Boolean(match)) || null
  );
};

const edgeFromMatch = (
  requirement: BusinessSqlJoinRequirement,
  match: RelationshipMatch,
): BusinessSqlJoinEdge => {
  const { contract, reversed } = match;
  return {
    fromEntity: requirement.fromEntity,
    fromTable: reversed ? contract.targetTableName : contract.sourceTableName,
    fromField: reversed ? contract.targetColumnName : contract.sourceColumnName,
    toEntity: requirement.toEntity,
    toTable: reversed ? contract.sourceTableName : contract.targetTableName,
    toField: reversed ? contract.sourceColumnName : contract.targetColumnName,
    relationship: requirement.relationship || contract.contractId,
    verified: true,
  };
};

const unresolvedEdge = (
  requirement: BusinessSqlJoinRequirement,
  hint: BusinessSqlJoinEdge | undefined,
): BusinessSqlJoinEdge => ({
  fromEntity: requirement.fromEntity,
  fromTable: hint?.fromTable,
  fromField: hint?.fromField,
  toEntity: requirement.toEntity,
  toTable: hint?.toTable,
  toField: hint?.toField,
  relationship: requirement.relationship,
  verified: false,
});

export function resolveBusinessSqlJoinPath({
  plan,
  acceptedRelationshipContracts = [],
  readyRelationshipContracts = [],
  missingRelationships = [],
}: ResolveBusinessSqlJoinPathInput): BusinessSqlQueryPlan {
  if (!plan.joinPath.required || plan.joinPath.requirements.length === 0) {
    return plan;
  }

  const missingRelationshipKeys = new Set(
    missingRelationships.map((relationship) =>
      relationshipKey(relationship.fromEntity, relationship.toEntity),
    ),
  );
  const contracts = activeReadyContracts(
    acceptedRelationshipContracts,
    readyRelationshipContracts,
  );
  const edges: BusinessSqlJoinEdge[] = [];
  const requirements: BusinessSqlJoinRequirement[] = [];
  const warnings: BusinessSqlPlanWarning[] = plan.warnings.filter(
    (warning) => warning.id !== "join-path-needs-review",
  );
  const missingRequirements: BusinessSqlJoinRequirement[] = [];
  const reviewRequirements: BusinessSqlJoinRequirement[] = [];

  for (const requirement of plan.joinPath.requirements) {
    const hint = hintForRequirement(plan.joinPath, requirement);
    const key = relationshipKey(requirement.fromEntity, requirement.toEntity);

    if (missingRelationshipKeys.has(key)) {
      const missingRequirement = { ...requirement, verified: false };
      requirements.push(missingRequirement);
      edges.push(unresolvedEdge(requirement, hint));
      missingRequirements.push(missingRequirement);
      continue;
    }

    const match = findContractMatch(requirement, hint, plan, contracts);
    if (match) {
      requirements.push({ ...requirement, verified: true });
      edges.push(edgeFromMatch(requirement, match));
      continue;
    }

    const reviewRequirement = { ...requirement, verified: false };
    requirements.push(reviewRequirement);
    edges.push(unresolvedEdge(requirement, hint));
    reviewRequirements.push(reviewRequirement);
  }

  const joinEntities = uniqueStrings([
    ...plan.joinPath.entities,
    ...requirements.flatMap((requirement) => [
      requirement.fromEntity,
      requirement.toEntity,
    ]),
  ]);

  if (missingRequirements.length > 0) {
    const missingSummary = missingRequirements
      .map((requirement) => `${requirement.fromEntity} → ${requirement.toEntity}`)
      .join(", ");
    const blockingWarning: BusinessSqlPlanWarning = {
      id: "join-path-missing-relationship",
      severity: "blocking",
      message: `Missing required join relationship: ${missingSummary}.`,
    };

    return {
      ...plan,
      status: "blocked",
      support: "blocked",
      joinPath: {
        required: true,
        status: "missing",
        entities: joinEntities,
        edges,
        requirements,
      },
      warnings: warningExists(warnings, blockingWarning.id)
        ? warnings
        : [...warnings, blockingWarning],
      renderer: {
        ...plan.renderer,
        status: "blocked",
        sql: undefined,
        notes: uniqueStrings([
          ...plan.renderer.notes,
          "SQL rendering is blocked until required relationships are available.",
        ]),
      },
      preview: {
        ...plan.preview,
        joinSummary: `Missing required join path: ${missingSummary}.`,
        rendererSummary: "SQL rendering is blocked.",
      },
    };
  }

  if (reviewRequirements.length > 0) {
    const reviewSummary = reviewRequirements
      .map((requirement) => `${requirement.fromEntity} → ${requirement.toEntity}`)
      .join(", ");
    const reviewWarning: BusinessSqlPlanWarning = {
      id: "join-path-needs-review",
      severity: "warning",
      message: `Join path ${reviewSummary} must be verified before SQL rendering.`,
    };

    return {
      ...plan,
      support: "needs_review",
      joinPath: {
        required: true,
        status: "needs_review",
        entities: joinEntities,
        edges,
        requirements,
      },
      warnings: warningExists(warnings, reviewWarning.id)
        ? warnings
        : [...warnings, reviewWarning],
      renderer: {
        ...plan.renderer,
        sql: undefined,
        status: plan.renderer.status === "blocked" ? "blocked" : "not_rendered",
      },
      preview: {
        ...plan.preview,
        joinSummary: `Needs review: ${reviewSummary}.`,
        rendererSummary: "SQL has not been rendered.",
      },
    };
  }

  return {
    ...plan,
    status: "resolved",
    support: "supported",
    joinPath: {
      required: true,
      status: "resolved",
      entities: joinEntities,
      edges,
      requirements,
    },
    warnings,
    renderer: {
      ...plan.renderer,
      sql: undefined,
      status: plan.renderer.status === "blocked" ? "blocked" : "not_rendered",
      notes: uniqueStrings([
        ...plan.renderer.notes,
        "Join path resolved from accepted relationship metadata.",
      ]),
    },
    preview: {
      ...plan.preview,
      joinSummary: `Resolved join path: ${joinEntities.join(" -> ")}.`,
      rendererSummary: "SQL has not been rendered.",
    },
  };
}
