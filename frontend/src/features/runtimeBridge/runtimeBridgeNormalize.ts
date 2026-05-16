import type {
  RuntimeBridgeAdvisoryReference,
  RuntimeBridgeArtifactReference,
  RuntimeBridgeConfidence,
  RuntimeBridgeContinuationReference,
  RuntimeBridgeEdge,
  RuntimeBridgeEvent,
  RuntimeBridgeExplanationReference,
  RuntimeBridgeInvestigationReference,
  RuntimeBridgeNode,
  RuntimeBridgeSnapshot,
} from "./runtimeBridgeTypes";

export type RuntimeBridgeValidationIssueType =
  | "duplicate_id"
  | "missing_related_node"
  | "missing_edge_node"
  | "forbidden_continuation_field";

export type RuntimeBridgeValidationIssue = {
  readonly issueType: RuntimeBridgeValidationIssueType;
  readonly id: string;
  readonly message: string;
};

const forbiddenContinuationFieldNames = [
  "callback",
  "handler",
  "onClick",
  "onRun",
  "onExecute",
  "execute",
  "run",
  "dispatch",
  "mutation",
  "effect",
];

const dedupeById = <T>(items: ReadonlyArray<T>, getId: (item: T) => string) => {
  const seenIds = new Set<string>();
  const dedupedItems: T[] = [];

  for (const item of items) {
    const id = getId(item);
    if (seenIds.has(id)) continue;
    seenIds.add(id);
    dedupedItems.push(item);
  }

  return dedupedItems;
};

const findDuplicateIds = <T>(
  items: ReadonlyArray<T>,
  getId: (item: T) => string,
  label: string,
): RuntimeBridgeValidationIssue[] => {
  const seenIds = new Set<string>();
  const duplicateIds = new Set<string>();

  for (const item of items) {
    const id = getId(item);
    if (seenIds.has(id)) duplicateIds.add(id);
    seenIds.add(id);
  }

  return [...duplicateIds].map((id) => ({
    issueType: "duplicate_id",
    id,
    message: `${label} contains duplicate id "${id}".`,
  }));
};

const getObjectKeys = (value: unknown): string[] => {
  if (!value || typeof value !== "object") return [];
  return Object.keys(value);
};

export const dedupeRuntimeBridgeNodes = (nodes: ReadonlyArray<RuntimeBridgeNode>) =>
  dedupeById(nodes, (node) => node.bridgeNodeId);

export const dedupeRuntimeBridgeEdges = (edges: ReadonlyArray<RuntimeBridgeEdge>) =>
  dedupeById(edges, (edge) => edge.bridgeEdgeId);

export const dedupeRuntimeBridgeArtifacts = (
  artifacts: ReadonlyArray<RuntimeBridgeArtifactReference>,
) => dedupeById(artifacts, (artifact) => artifact.artifactId);

export const dedupeRuntimeBridgeAdvisories = (
  advisories: ReadonlyArray<RuntimeBridgeAdvisoryReference>,
) => dedupeById(advisories, (advisory) => advisory.advisoryId);

export const dedupeRuntimeBridgeInvestigations = (
  investigations: ReadonlyArray<RuntimeBridgeInvestigationReference>,
) => dedupeById(investigations, (investigation) => investigation.investigationId);

export const dedupeRuntimeBridgeExplanations = (
  explanations: ReadonlyArray<RuntimeBridgeExplanationReference>,
) => dedupeById(explanations, (explanation) => explanation.explanationId);

export const dedupeRuntimeBridgeContinuations = (
  continuations: ReadonlyArray<RuntimeBridgeContinuationReference>,
) => dedupeById(continuations, (continuation) => continuation.continuationId);

export const dedupeRuntimeBridgeConfidence = (
  confidence: ReadonlyArray<RuntimeBridgeConfidence>,
) => dedupeById(confidence, (confidenceReference) => confidenceReference.confidenceId);

export const dedupeRuntimeBridgeEvents = (events: ReadonlyArray<RuntimeBridgeEvent>) =>
  dedupeById(events, (event) => event.eventId);

export const detectRuntimeBridgeDuplicateIds = (
  snapshot: RuntimeBridgeSnapshot,
): RuntimeBridgeValidationIssue[] => [
  ...findDuplicateIds(snapshot.nodes, (node) => node.bridgeNodeId, "nodes"),
  ...findDuplicateIds(snapshot.edges, (edge) => edge.bridgeEdgeId, "edges"),
  ...findDuplicateIds(snapshot.artifacts, (artifact) => artifact.artifactId, "artifacts"),
  ...findDuplicateIds(snapshot.advisories, (advisory) => advisory.advisoryId, "advisories"),
  ...findDuplicateIds(
    snapshot.investigations,
    (investigation) => investigation.investigationId,
    "investigations",
  ),
  ...findDuplicateIds(
    snapshot.explanations,
    (explanation) => explanation.explanationId,
    "explanations",
  ),
  ...findDuplicateIds(
    snapshot.continuations,
    (continuation) => continuation.continuationId,
    "continuations",
  ),
  ...findDuplicateIds(snapshot.confidence, (item) => item.confidenceId, "confidence"),
  ...findDuplicateIds(snapshot.events, (event) => event.eventId, "events"),
];

export const detectMissingRuntimeBridgeRelatedNodes = (
  snapshot: RuntimeBridgeSnapshot,
): RuntimeBridgeValidationIssue[] => {
  const nodeIds = new Set(snapshot.nodes.map((node) => node.bridgeNodeId));
  const issues: RuntimeBridgeValidationIssue[] = [];

  for (const node of snapshot.nodes) {
    for (const relatedNodeId of node.relatedRuntimeNodeIds) {
      if (nodeIds.has(relatedNodeId)) continue;
      issues.push({
        issueType: "missing_related_node",
        id: relatedNodeId,
        message: `Node "${node.bridgeNodeId}" references missing related node "${relatedNodeId}".`,
      });
    }
  }

  for (const artifact of snapshot.artifacts) {
    const relatedNodeIds = "relatedNodeIds" in artifact
      ? (artifact.relatedNodeIds as ReadonlyArray<string>)
      : [];
    for (const relatedNodeId of relatedNodeIds) {
      if (nodeIds.has(relatedNodeId)) continue;
      issues.push({
        issueType: "missing_related_node",
        id: relatedNodeId,
        message: `Artifact "${artifact.artifactId}" references missing related node "${relatedNodeId}".`,
      });
    }
  }

  for (const event of snapshot.events) {
    const relatedNodeIds = "relatedNodeIds" in event
      ? (event.relatedNodeIds as ReadonlyArray<string>)
      : [];
    for (const relatedNodeId of relatedNodeIds) {
      if (nodeIds.has(relatedNodeId)) continue;
      issues.push({
        issueType: "missing_related_node",
        id: relatedNodeId,
        message: `Event "${event.eventId}" references missing related node "${relatedNodeId}".`,
      });
    }
  }

  return issues;
};

export const detectRuntimeBridgeEdgesWithMissingNodes = (
  snapshot: RuntimeBridgeSnapshot,
): RuntimeBridgeValidationIssue[] => {
  const nodeIds = new Set(snapshot.nodes.map((node) => node.bridgeNodeId));
  const issues: RuntimeBridgeValidationIssue[] = [];

  for (const edge of snapshot.edges) {
    if (!nodeIds.has(edge.fromBridgeNodeId)) {
      issues.push({
        issueType: "missing_edge_node",
        id: edge.fromBridgeNodeId,
        message: `Edge "${edge.bridgeEdgeId}" references missing from-node "${edge.fromBridgeNodeId}".`,
      });
    }

    if (!nodeIds.has(edge.toBridgeNodeId)) {
      issues.push({
        issueType: "missing_edge_node",
        id: edge.toBridgeNodeId,
        message: `Edge "${edge.bridgeEdgeId}" references missing to-node "${edge.toBridgeNodeId}".`,
      });
    }
  }

  return issues;
};

export const detectForbiddenRuntimeBridgeContinuationFields = (
  continuations: ReadonlyArray<RuntimeBridgeContinuationReference | Record<string, unknown>>,
): RuntimeBridgeValidationIssue[] =>
  continuations.flatMap((continuation) =>
    getObjectKeys(continuation)
      .filter((key) => forbiddenContinuationFieldNames.includes(key))
      .map((key) => ({
        issueType: "forbidden_continuation_field" as const,
        id:
          typeof continuation.continuationId === "string"
            ? continuation.continuationId
            : "unknown-continuation",
        message: `Continuation metadata contains forbidden executable-style field "${key}".`,
      })),
  );

export const validateRuntimeBridgeSnapshotMetadata = (
  snapshot: RuntimeBridgeSnapshot,
): RuntimeBridgeValidationIssue[] => [
  ...detectRuntimeBridgeDuplicateIds(snapshot),
  ...detectMissingRuntimeBridgeRelatedNodes(snapshot),
  ...detectRuntimeBridgeEdgesWithMissingNodes(snapshot),
  ...detectForbiddenRuntimeBridgeContinuationFields(snapshot.continuations),
];

export const normalizeRuntimeBridgeSnapshot = (
  snapshot: RuntimeBridgeSnapshot,
): RuntimeBridgeSnapshot => ({
  ...snapshot,
  nodes: dedupeRuntimeBridgeNodes(snapshot.nodes),
  edges: dedupeRuntimeBridgeEdges(snapshot.edges),
  artifacts: dedupeRuntimeBridgeArtifacts(snapshot.artifacts),
  advisories: dedupeRuntimeBridgeAdvisories(snapshot.advisories),
  investigations: dedupeRuntimeBridgeInvestigations(snapshot.investigations),
  explanations: dedupeRuntimeBridgeExplanations(snapshot.explanations),
  continuations: dedupeRuntimeBridgeContinuations(snapshot.continuations),
  confidence: dedupeRuntimeBridgeConfidence(snapshot.confidence),
  events: dedupeRuntimeBridgeEvents(snapshot.events),
});
