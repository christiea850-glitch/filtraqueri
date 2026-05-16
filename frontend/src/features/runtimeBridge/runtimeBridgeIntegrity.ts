import {
  detectForbiddenRuntimeBridgeContinuationFields,
  detectMissingRuntimeBridgeRelatedNodes,
  detectRuntimeBridgeEdgesWithMissingNodes,
  type RuntimeBridgeValidationIssue,
} from "./runtimeBridgeNormalize";
import type {
  RuntimeBridgeAdvisoryReference,
  RuntimeBridgeArtifactReference,
  RuntimeBridgeContinuationReference,
  RuntimeBridgeEdge,
  RuntimeBridgeEvent,
  RuntimeBridgeExplanationReference,
  RuntimeBridgeNode,
  RuntimeBridgeSnapshot,
} from "./runtimeBridgeTypes";

export type RuntimeBridgeIntegrityReport = {
  readonly snapshotId: string;
  readonly checkedAt: string;
  readonly warnings: ReadonlyArray<RuntimeBridgeValidationIssue>;
  readonly errors: ReadonlyArray<RuntimeBridgeValidationIssue>;
  readonly orphanCounts: {
    readonly nodes: number;
    readonly advisories: number;
    readonly continuations: number;
    readonly explanations: number;
    readonly artifacts: number;
    readonly events: number;
  };
  readonly missingReferenceCounts: {
    readonly relatedNodes: number;
    readonly edgeNodes: number;
    readonly advisoryEvidence: number;
    readonly forbiddenContinuationFields: number;
  };
  readonly metadataOnly: true;
};

const getArtifactRelatedNodeIds = (artifact: RuntimeBridgeArtifactReference) =>
  "relatedNodeIds" in artifact ? (artifact.relatedNodeIds as ReadonlyArray<string>) : [];

const getEventRelatedNodeIds = (event: RuntimeBridgeEvent) =>
  "relatedNodeIds" in event ? (event.relatedNodeIds as ReadonlyArray<string>) : [];

const getEventContinuationReferenceIds = (event: RuntimeBridgeEvent) =>
  "continuationReferenceIds" in event
    ? (event.continuationReferenceIds as ReadonlyArray<string>)
    : [];

const getEventExplanationReferenceIds = (event: RuntimeBridgeEvent) =>
  "explanationReferenceIds" in event
    ? (event.explanationReferenceIds as ReadonlyArray<string>)
    : [];

export const getNodeOutgoingEdges = (
  snapshot: RuntimeBridgeSnapshot,
  nodeId: string,
): ReadonlyArray<RuntimeBridgeEdge> =>
  snapshot.edges.filter((edge) => edge.fromBridgeNodeId === nodeId);

export const getNodeIncomingEdges = (
  snapshot: RuntimeBridgeSnapshot,
  nodeId: string,
): ReadonlyArray<RuntimeBridgeEdge> =>
  snapshot.edges.filter((edge) => edge.toBridgeNodeId === nodeId);

export const getNodeRelatedArtifacts = (
  snapshot: RuntimeBridgeSnapshot,
  nodeId: string,
): ReadonlyArray<RuntimeBridgeArtifactReference> =>
  snapshot.artifacts.filter((artifact) => getArtifactRelatedNodeIds(artifact).includes(nodeId));

export const getNodeRelatedEvents = (
  snapshot: RuntimeBridgeSnapshot,
  nodeId: string,
): ReadonlyArray<RuntimeBridgeEvent> =>
  snapshot.events.filter((event) => getEventRelatedNodeIds(event).includes(nodeId));

export const getNodeRelatedContinuations = (
  snapshot: RuntimeBridgeSnapshot,
  nodeId: string,
): ReadonlyArray<RuntimeBridgeContinuationReference> => {
  const continuationIds = new Set(
    snapshot.nodes
      .filter((node) => node.bridgeNodeId === nodeId)
      .flatMap((node) => node.continuationReferenceIds),
  );

  for (const event of getNodeRelatedEvents(snapshot, nodeId)) {
    getEventContinuationReferenceIds(event).forEach((continuationId) =>
      continuationIds.add(continuationId),
    );
  }

  return snapshot.continuations.filter((continuation) =>
    continuationIds.has(continuation.continuationId),
  );
};

export const getNodeRelatedAdvisories = (
  snapshot: RuntimeBridgeSnapshot,
  nodeId: string,
): ReadonlyArray<RuntimeBridgeAdvisoryReference> => {
  const advisoryIds = new Set(
    snapshot.nodes
      .filter((node) => node.bridgeNodeId === nodeId)
      .flatMap((node) => node.advisoryReferenceIds),
  );

  return snapshot.advisories.filter((advisory) => advisoryIds.has(advisory.advisoryId));
};

export const getNodeRelatedExplanations = (
  snapshot: RuntimeBridgeSnapshot,
  nodeId: string,
): ReadonlyArray<RuntimeBridgeExplanationReference> => {
  const explanationIds = new Set<string>();

  for (const event of getNodeRelatedEvents(snapshot, nodeId)) {
    getEventExplanationReferenceIds(event).forEach((explanationId) =>
      explanationIds.add(explanationId),
    );
  }

  return snapshot.explanations.filter((explanation) =>
    explanationIds.has(explanation.explanationId),
  );
};

export const findRuntimeBridgeOrphanNodes = (
  snapshot: RuntimeBridgeSnapshot,
): ReadonlyArray<RuntimeBridgeNode> =>
  snapshot.nodes.filter(
    (node) =>
      getNodeIncomingEdges(snapshot, node.bridgeNodeId).length === 0 &&
      getNodeOutgoingEdges(snapshot, node.bridgeNodeId).length === 0 &&
      getNodeRelatedArtifacts(snapshot, node.bridgeNodeId).length === 0 &&
      getNodeRelatedEvents(snapshot, node.bridgeNodeId).length === 0,
  );

export const findRuntimeBridgeOrphanAdvisories = (
  snapshot: RuntimeBridgeSnapshot,
): ReadonlyArray<RuntimeBridgeAdvisoryReference> => {
  const referencedIds = new Set([
    ...snapshot.nodes.flatMap((node) => node.advisoryReferenceIds),
    ...snapshot.explanations.flatMap((explanation) => explanation.advisoryReferenceIds),
  ]);

  return snapshot.advisories.filter((advisory) => !referencedIds.has(advisory.advisoryId));
};

export const findRuntimeBridgeOrphanContinuations = (
  snapshot: RuntimeBridgeSnapshot,
): ReadonlyArray<RuntimeBridgeContinuationReference> => {
  const referencedIds = new Set([
    ...snapshot.nodes.flatMap((node) => node.continuationReferenceIds),
    ...snapshot.events.flatMap(getEventContinuationReferenceIds),
  ]);

  return snapshot.continuations.filter(
    (continuation) => !referencedIds.has(continuation.continuationId),
  );
};

export const findRuntimeBridgeOrphanExplanations = (
  snapshot: RuntimeBridgeSnapshot,
): ReadonlyArray<RuntimeBridgeExplanationReference> => {
  const referencedIds = new Set([
    ...snapshot.nodes
      .filter((node) => node.nodeType === "explanation")
      .map((node) => node.lineageReferences[0]?.referenceId)
      .filter(Boolean),
    ...snapshot.events.flatMap(getEventExplanationReferenceIds),
  ]);

  return snapshot.explanations.filter(
    (explanation) => !referencedIds.has(explanation.explanationId),
  );
};

export const findRuntimeBridgeOrphanArtifacts = (
  snapshot: RuntimeBridgeSnapshot,
): ReadonlyArray<RuntimeBridgeArtifactReference> =>
  snapshot.artifacts.filter((artifact) => getArtifactRelatedNodeIds(artifact).length === 0);

export const findRuntimeBridgeOrphanEvents = (
  snapshot: RuntimeBridgeSnapshot,
): ReadonlyArray<RuntimeBridgeEvent> =>
  snapshot.events.filter(
    (event) =>
      event.relatedReferenceIds.length === 0 && getEventRelatedNodeIds(event).length === 0,
  );

export const validateRuntimeBridgeEdgesReferenceExistingNodes =
  detectRuntimeBridgeEdgesWithMissingNodes;

export const validateRuntimeBridgeArtifactRelatedNodesExist = (
  snapshot: RuntimeBridgeSnapshot,
): ReadonlyArray<RuntimeBridgeValidationIssue> => {
  const nodeIds = new Set(snapshot.nodes.map((node) => node.bridgeNodeId));
  const issues: RuntimeBridgeValidationIssue[] = [];

  for (const artifact of snapshot.artifacts) {
    for (const relatedNodeId of getArtifactRelatedNodeIds(artifact)) {
      if (nodeIds.has(relatedNodeId)) continue;
      issues.push({
        issueType: "missing_related_node",
        id: relatedNodeId,
        message: `Artifact "${artifact.artifactId}" references missing related node "${relatedNodeId}".`,
      });
    }
  }

  return issues;
};

export const validateRuntimeBridgeEventRelatedNodesExist = (
  snapshot: RuntimeBridgeSnapshot,
): ReadonlyArray<RuntimeBridgeValidationIssue> => {
  const nodeIds = new Set(snapshot.nodes.map((node) => node.bridgeNodeId));
  const issues: RuntimeBridgeValidationIssue[] = [];

  for (const event of snapshot.events) {
    for (const relatedNodeId of getEventRelatedNodeIds(event)) {
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

export const validateRuntimeBridgeAdvisoryEvidenceMetadataOnly = (
  snapshot: RuntimeBridgeSnapshot,
): ReadonlyArray<RuntimeBridgeValidationIssue> =>
  snapshot.advisories.flatMap((advisory) =>
    advisory.evidenceReferenceIds
      .filter((evidenceReferenceId) => !evidenceReferenceId.trim())
      .map((evidenceReferenceId) => ({
        issueType: "missing_related_node" as const,
        id: advisory.advisoryId,
        message: `Advisory "${advisory.advisoryId}" has invalid metadata evidence reference "${evidenceReferenceId}".`,
      })),
  );

export const validateRuntimeBridgeContinuationReferencesMetadataOnly =
  detectForbiddenRuntimeBridgeContinuationFields;

export const createRuntimeBridgeIntegrityReport = ({
  snapshot,
  checkedAt,
}: {
  readonly snapshot: RuntimeBridgeSnapshot;
  readonly checkedAt: string;
}): RuntimeBridgeIntegrityReport => {
  const orphanNodes = findRuntimeBridgeOrphanNodes(snapshot);
  const orphanAdvisories = findRuntimeBridgeOrphanAdvisories(snapshot);
  const orphanContinuations = findRuntimeBridgeOrphanContinuations(snapshot);
  const orphanExplanations = findRuntimeBridgeOrphanExplanations(snapshot);
  const orphanArtifacts = findRuntimeBridgeOrphanArtifacts(snapshot);
  const orphanEvents = findRuntimeBridgeOrphanEvents(snapshot);
  const missingRelatedNodeIssues = detectMissingRuntimeBridgeRelatedNodes(snapshot);
  const missingEdgeNodeIssues = detectRuntimeBridgeEdgesWithMissingNodes(snapshot);
  const advisoryEvidenceIssues = validateRuntimeBridgeAdvisoryEvidenceMetadataOnly(snapshot);
  const forbiddenContinuationIssues = detectForbiddenRuntimeBridgeContinuationFields(
    snapshot.continuations,
  );

  return {
    snapshotId: snapshot.bridgeId,
    checkedAt,
    warnings: [
      ...orphanNodes.map((node) => ({
        issueType: "missing_related_node" as const,
        id: node.bridgeNodeId,
        message: `Node "${node.bridgeNodeId}" has no bridge relationships.`,
      })),
      ...orphanAdvisories.map((advisory) => ({
        issueType: "missing_related_node" as const,
        id: advisory.advisoryId,
        message: `Advisory "${advisory.advisoryId}" is not referenced by bridge metadata.`,
      })),
      ...orphanContinuations.map((continuation) => ({
        issueType: "missing_related_node" as const,
        id: continuation.continuationId,
        message: `Continuation "${continuation.continuationId}" is not referenced by bridge metadata.`,
      })),
      ...orphanExplanations.map((explanation) => ({
        issueType: "missing_related_node" as const,
        id: explanation.explanationId,
        message: `Explanation "${explanation.explanationId}" is not referenced by bridge metadata.`,
      })),
      ...orphanArtifacts.map((artifact) => ({
        issueType: "missing_related_node" as const,
        id: artifact.artifactId,
        message: `Artifact "${artifact.artifactId}" has no related nodes.`,
      })),
      ...orphanEvents.map((event) => ({
        issueType: "missing_related_node" as const,
        id: event.eventId,
        message: `Event "${event.eventId}" has no related references.`,
      })),
    ],
    errors: [
      ...missingRelatedNodeIssues,
      ...missingEdgeNodeIssues,
      ...advisoryEvidenceIssues,
      ...forbiddenContinuationIssues,
    ],
    orphanCounts: {
      nodes: orphanNodes.length,
      advisories: orphanAdvisories.length,
      continuations: orphanContinuations.length,
      explanations: orphanExplanations.length,
      artifacts: orphanArtifacts.length,
      events: orphanEvents.length,
    },
    missingReferenceCounts: {
      relatedNodes: missingRelatedNodeIssues.length,
      edgeNodes: missingEdgeNodeIssues.length,
      advisoryEvidence: advisoryEvidenceIssues.length,
      forbiddenContinuationFields: forbiddenContinuationIssues.length,
    },
    metadataOnly: true,
  };
};
