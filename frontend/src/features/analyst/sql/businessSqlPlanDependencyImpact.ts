import {
  assessBusinessSqlPlanElementIdentityCapability,
  validateBusinessSqlPlanElementIdentityManifest,
  type BusinessSqlPlanElementId,
} from "./businessSqlPlanElementIdentity";
import type {
  BusinessSqlPlanRevisionRecord,
} from "./businessSqlPlanRevisionLineage";

export type BusinessSqlPlanDependencyGraphVersion =
  "business-sql-plan-dependency-graph:v1";

export type BusinessSqlPlanDependencyGraphCoverage = "complete" | "partial";

export type BusinessSqlPlanDependencyEdge = {
  edgeId: string;
  upstreamElementId: BusinessSqlPlanElementId;
  downstreamElementId: BusinessSqlPlanElementId;
};

export type BusinessSqlPlanDependencyGraph = {
  version: BusinessSqlPlanDependencyGraphVersion;
  graphId: string;
  planId: string;
  revisionId: string;
  coverage: BusinessSqlPlanDependencyGraphCoverage;
  edges: readonly BusinessSqlPlanDependencyEdge[];
};

export type BusinessSqlPlanDependencyImpactReasonCode =
  | "graph_missing"
  | "graph_id_blank"
  | "graph_version_unsupported"
  | "graph_revision_mismatch"
  | "graph_plan_mismatch"
  | "plan_identity_invalid"
  | "identity_ineligible"
  | "edge_id_blank"
  | "edge_duplicate"
  | "upstream_missing"
  | "downstream_missing"
  | "upstream_ineligible"
  | "downstream_ineligible"
  | "self_dependency"
  | "cycle_detected"
  | "changed_target_missing"
  | "graph_incomplete"
  | "not_accepted_revision";

export type BusinessSqlPlanDependencyImpactStatus =
  | "ready"
  | "valid_empty"
  | "unavailable"
  | "incomplete"
  | "unsupported"
  | "invalid"
  | "blocked";

export type BusinessSqlPlanDependencyImpactPayload = {
  rootChangedElementIds: BusinessSqlPlanElementId[];
  directlyImpactedElementIds: BusinessSqlPlanElementId[];
  indirectlyImpactedElementIds: BusinessSqlPlanElementId[];
  allImpactedElementIds: BusinessSqlPlanElementId[];
  unaffectedElementIds: BusinessSqlPlanElementId[];
};

export type BusinessSqlPlanDependencyImpactSuccess = {
  status: "ready" | "valid_empty";
  reasonCodes: [];
  graphId: string;
  planId: string;
  revisionId: string;
  impact: BusinessSqlPlanDependencyImpactPayload;
};

export type BusinessSqlPlanDependencyImpactRejection = {
  status: Exclude<BusinessSqlPlanDependencyImpactStatus, "ready" | "valid_empty">;
  reasonCodes: BusinessSqlPlanDependencyImpactReasonCode[];
  graphId?: string;
  planId?: string;
  revisionId?: string;
};

export type BusinessSqlPlanDependencyImpactResult =
  | BusinessSqlPlanDependencyImpactSuccess
  | BusinessSqlPlanDependencyImpactRejection;

export type DeriveBusinessSqlPlanDependencyImpactRequest = {
  acceptedRevision: BusinessSqlPlanRevisionRecord;
  graph?: BusinessSqlPlanDependencyGraph | null;
};

const SUPPORTED_GRAPH_VERSION: BusinessSqlPlanDependencyGraphVersion =
  "business-sql-plan-dependency-graph:v1";

const hasText = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const sortedUnique = <T extends string>(values: readonly T[]): T[] =>
  Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));

const edgePairKey = (edge: Pick<BusinessSqlPlanDependencyEdge, "upstreamElementId" | "downstreamElementId">): string =>
  `${edge.upstreamElementId}\u0000${edge.downstreamElementId}`;

const rejection = ({
  status,
  reasonCodes,
  graph,
  revision,
}: {
  status: BusinessSqlPlanDependencyImpactRejection["status"];
  reasonCodes: readonly BusinessSqlPlanDependencyImpactReasonCode[];
  graph?: Partial<BusinessSqlPlanDependencyGraph> | null;
  revision?: BusinessSqlPlanRevisionRecord;
}): BusinessSqlPlanDependencyImpactRejection => ({
  status,
  reasonCodes: sortedUnique(reasonCodes),
  graphId: hasText(graph?.graphId) ? graph.graphId : undefined,
  planId: hasText(graph?.planId) ? graph.planId : revision?.plan.id,
  revisionId: hasText(graph?.revisionId)
    ? graph.revisionId
    : revision?.identity.revisionId,
});

const rootChangedElementIdsFor = (
  revision: BusinessSqlPlanRevisionRecord,
): BusinessSqlPlanElementId[] =>
  sortedUnique(
    revision.changes
      .filter((change) => change.changeKind !== "revision_metadata")
      .map((change) => change.targetElementId)
      .filter(hasText),
  );

const hasDirectedCycle = (
  edges: readonly BusinessSqlPlanDependencyEdge[],
): boolean => {
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    const current = adjacency.get(edge.upstreamElementId) || [];
    current.push(edge.downstreamElementId);
    adjacency.set(edge.upstreamElementId, current);
  }
  for (const [node, downstream] of adjacency) {
    adjacency.set(node, sortedUnique(downstream));
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const nodes = sortedUnique([
    ...edges.map((edge) => edge.upstreamElementId),
    ...edges.map((edge) => edge.downstreamElementId),
  ]);

  const visit = (node: string): boolean => {
    if (visiting.has(node)) return true;
    if (visited.has(node)) return false;
    visiting.add(node);
    for (const downstream of adjacency.get(node) || []) {
      if (visit(downstream)) return true;
    }
    visiting.delete(node);
    visited.add(node);
    return false;
  };

  return nodes.some((node) => visit(node));
};

const deriveImpactPayload = (
  rootChangedElementIds: readonly BusinessSqlPlanElementId[],
  eligibleElementIds: readonly BusinessSqlPlanElementId[],
  edges: readonly BusinessSqlPlanDependencyEdge[],
): BusinessSqlPlanDependencyImpactPayload => {
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    const current = adjacency.get(edge.upstreamElementId) || [];
    current.push(edge.downstreamElementId);
    adjacency.set(edge.upstreamElementId, current);
  }
  for (const [node, downstream] of adjacency) {
    adjacency.set(node, sortedUnique(downstream));
  }

  const rootSet = new Set(rootChangedElementIds);
  const distanceByElementId = new Map<string, number>();
  const queue: Array<{ elementId: string; distance: number }> = [];

  for (const rootId of rootChangedElementIds) {
    for (const downstream of adjacency.get(rootId) || []) {
      queue.push({ elementId: downstream, distance: 1 });
    }
  }

  queue.sort((left, right) =>
    left.distance - right.distance ||
    left.elementId.localeCompare(right.elementId),
  );

  while (queue.length > 0) {
    const current = queue.shift()!;
    const existingDistance = distanceByElementId.get(current.elementId);
    if (
      rootSet.has(current.elementId) ||
      (typeof existingDistance === "number" && existingDistance <= current.distance)
    ) {
      continue;
    }
    distanceByElementId.set(current.elementId, current.distance);
    for (const downstream of adjacency.get(current.elementId) || []) {
      queue.push({ elementId: downstream, distance: current.distance + 1 });
    }
    queue.sort((left, right) =>
      left.distance - right.distance ||
      left.elementId.localeCompare(right.elementId),
    );
  }

  const directlyImpactedElementIds = sortedUnique(
    Array.from(distanceByElementId.entries())
      .filter(([, distance]) => distance === 1)
      .map(([elementId]) => elementId),
  );
  const directSet = new Set(directlyImpactedElementIds);
  const indirectlyImpactedElementIds = sortedUnique(
    Array.from(distanceByElementId.entries())
      .filter(([elementId, distance]) => distance > 1 && !directSet.has(elementId))
      .map(([elementId]) => elementId),
  );
  const allImpactedElementIds = sortedUnique([
    ...directlyImpactedElementIds,
    ...indirectlyImpactedElementIds,
  ]);
  const impactedSet = new Set(allImpactedElementIds);
  const unaffectedElementIds = sortedUnique(
    eligibleElementIds.filter(
      (elementId) => !rootSet.has(elementId) && !impactedSet.has(elementId),
    ),
  );

  return {
    rootChangedElementIds: [...rootChangedElementIds],
    directlyImpactedElementIds,
    indirectlyImpactedElementIds,
    allImpactedElementIds,
    unaffectedElementIds,
  };
};

export function deriveBusinessSqlPlanDependencyImpact({
  acceptedRevision,
  graph,
}: DeriveBusinessSqlPlanDependencyImpactRequest): BusinessSqlPlanDependencyImpactResult {
  if (!graph) {
    return rejection({
      status: "unavailable",
      reasonCodes: ["graph_missing"],
      revision: acceptedRevision,
    });
  }

  const reasonCodes: BusinessSqlPlanDependencyImpactReasonCode[] = [];

  if (acceptedRevision.kind !== "accepted_clarification") {
    reasonCodes.push("not_accepted_revision");
  }
  if (!hasText(graph.graphId)) reasonCodes.push("graph_id_blank");
  if (graph.version !== SUPPORTED_GRAPH_VERSION) {
    reasonCodes.push("graph_version_unsupported");
  }
  if (graph.revisionId !== acceptedRevision.identity.revisionId) {
    reasonCodes.push("graph_revision_mismatch");
  }
  if (graph.planId !== acceptedRevision.plan.id) {
    reasonCodes.push("graph_plan_mismatch");
  }
  if (graph.coverage === "partial") reasonCodes.push("graph_incomplete");

  const identityValidation = validateBusinessSqlPlanElementIdentityManifest(acceptedRevision.plan);
  const capability = assessBusinessSqlPlanElementIdentityCapability(acceptedRevision.plan);
  if (capability.status === "invalid" || !identityValidation.valid) {
    reasonCodes.push("plan_identity_invalid");
  } else if (capability.status !== "identity_capable") {
    reasonCodes.push("identity_ineligible");
  }

  const eligibleElementIds = sortedUnique(
    (acceptedRevision.plan.elementIdentities || []).map((identity) => identity.elementId),
  );
  const eligibleElementIdSet = new Set(eligibleElementIds);

  const edgePairs = new Set<string>();
  for (const edge of graph.edges) {
    if (!hasText(edge.edgeId)) reasonCodes.push("edge_id_blank");
    if (!hasText(edge.upstreamElementId)) {
      reasonCodes.push("upstream_missing");
    } else if (!eligibleElementIdSet.has(edge.upstreamElementId)) {
      reasonCodes.push("upstream_ineligible");
    }
    if (!hasText(edge.downstreamElementId)) {
      reasonCodes.push("downstream_missing");
    } else if (!eligibleElementIdSet.has(edge.downstreamElementId)) {
      reasonCodes.push("downstream_ineligible");
    }
    if (
      hasText(edge.upstreamElementId) &&
      hasText(edge.downstreamElementId) &&
      edge.upstreamElementId === edge.downstreamElementId
    ) {
      reasonCodes.push("self_dependency");
    }
    const pairKey = edgePairKey(edge);
    if (edgePairs.has(pairKey)) reasonCodes.push("edge_duplicate");
    edgePairs.add(pairKey);
  }

  const rootChangedElementIds = rootChangedElementIdsFor(acceptedRevision);
  for (const rootId of rootChangedElementIds) {
    if (!eligibleElementIdSet.has(rootId)) reasonCodes.push("changed_target_missing");
  }

  const hasCycleEligibleEdges = graph.edges.every(
    (edge) =>
      hasText(edge.upstreamElementId) &&
      hasText(edge.downstreamElementId) &&
      edge.upstreamElementId !== edge.downstreamElementId &&
      eligibleElementIdSet.has(edge.upstreamElementId) &&
      eligibleElementIdSet.has(edge.downstreamElementId),
  );
  if (hasCycleEligibleEdges && hasDirectedCycle(graph.edges)) {
    reasonCodes.push("cycle_detected");
  }

  if (reasonCodes.length > 0) {
    const reasons = sortedUnique(reasonCodes);
    const status: BusinessSqlPlanDependencyImpactRejection["status"] =
      reasons.includes("graph_incomplete")
        ? "incomplete"
        : reasons.includes("graph_missing")
          ? "unavailable"
          : reasons.includes("identity_ineligible") ||
              reasons.includes("graph_version_unsupported")
            ? "unsupported"
            : "invalid";
    return rejection({ status, reasonCodes: reasons, graph, revision: acceptedRevision });
  }

  const orderedEdges = [...graph.edges].sort((left, right) =>
    left.upstreamElementId.localeCompare(right.upstreamElementId) ||
    left.downstreamElementId.localeCompare(right.downstreamElementId) ||
    left.edgeId.localeCompare(right.edgeId),
  );
  const impact = deriveImpactPayload(rootChangedElementIds, eligibleElementIds, orderedEdges);
  return {
    status:
      graph.edges.length === 0 || impact.allImpactedElementIds.length === 0
        ? "valid_empty"
        : "ready",
    reasonCodes: [],
    graphId: graph.graphId,
    planId: graph.planId,
    revisionId: graph.revisionId,
    impact,
  };
}
