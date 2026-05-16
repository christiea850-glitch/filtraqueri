import type { MetadataOnlyBoundaryContract } from "../governance/boundaryTypes";
import type {
  RuntimeBridgeAdvisoryReference,
  RuntimeBridgeArtifactReference,
  RuntimeBridgeConfidence,
  RuntimeBridgeContinuationReference,
  RuntimeBridgeEdge,
  RuntimeBridgeEvent,
  RuntimeBridgeExplanationReference,
  RuntimeBridgeLineageReference,
  RuntimeBridgeNode,
  RuntimeBridgeSnapshot,
  RuntimeBridgeSourceModuleReference,
} from "./runtimeBridgeTypes";

export type RuntimeBridgeRelationshipTrace = {
  readonly rootNodeId: string;
  readonly rootNode: RuntimeBridgeNode | null;
  readonly ancestorNodeIds: ReadonlyArray<string>;
  readonly descendantNodeIds: ReadonlyArray<string>;
  readonly incomingEdgeIds: ReadonlyArray<string>;
  readonly outgoingEdgeIds: ReadonlyArray<string>;
  readonly relatedReferenceIds: ReadonlyArray<string>;
  readonly lineageReferences: ReadonlyArray<RuntimeBridgeLineageReference>;
  readonly metadataOnly: true;
};

export type RuntimeBridgeLineageSummary = {
  readonly rootNodeId: string;
  readonly rootLabel: string | null;
  readonly ancestorCount: number;
  readonly descendantCount: number;
  readonly incomingEdgeCount: number;
  readonly outgoingEdgeCount: number;
  readonly relatedReferenceCount: number;
  readonly lineageReferenceCount: number;
  readonly metadataOnly: true;
};

export type RuntimeBridgeEvidenceSummary = {
  readonly rootNodeId: string;
  readonly artifactCount: number;
  readonly eventCount: number;
  readonly advisoryCount: number;
  readonly explanationCount: number;
  readonly continuationCount: number;
  readonly confidenceCount: number;
  readonly evidenceReferenceIds: ReadonlyArray<string>;
  readonly metadataOnly: true;
};

export const runtimeBridgeLineageGovernance = {
  mode: "metadata_only",
  contractId: "runtime-bridge-lineage",
  label: "Runtime bridge lineage inspection",
  description:
    "Metadata-only lineage and evidence inspection helpers for RuntimeBridge snapshots.",
  confidence: "high",
  canExecute: false,
  canMutateWorkspace: false,
  canCallBackend: false,
  lineageRefs: [
    "runtime-bridge-lineage-trace",
    "runtime-bridge-ancestor-inspection",
    "runtime-bridge-descendant-inspection",
    "runtime-bridge-evidence-summary",
  ],
} satisfies MetadataOnlyBoundaryContract;

export const runtimeBridgeLineageSourceModule: RuntimeBridgeSourceModuleReference = {
  moduleId: "runtime-bridge-lineage",
  modulePath: "frontend/src/features/runtimeBridge/runtimeBridgeLineage.ts",
  capabilityMode: "metadata_only",
  label: "Runtime bridge lineage inspection",
};

const uniqueStable = (items: ReadonlyArray<string>): string[] => {
  const seen = new Set<string>();
  const values: string[] = [];

  for (const item of items) {
    if (!item || seen.has(item)) continue;
    seen.add(item);
    values.push(item);
  }

  return values;
};

const getArtifactRelatedNodeIds = (artifact: RuntimeBridgeArtifactReference) =>
  "relatedNodeIds" in artifact ? (artifact.relatedNodeIds as ReadonlyArray<string>) : [];

const getEventRelatedNodeIds = (event: RuntimeBridgeEvent) =>
  "relatedNodeIds" in event ? (event.relatedNodeIds as ReadonlyArray<string>) : [];

const collectNodeReferenceIds = (node: RuntimeBridgeNode | null) =>
  node
    ? uniqueStable([
        ...node.advisoryReferenceIds,
        ...node.continuationReferenceIds,
        ...node.confidenceReferenceIds,
        ...node.artifactReferenceIds,
        ...node.relatedRuntimeNodeIds,
      ])
    : [];

const collectReachableNodeIds = ({
  startNodeId,
  edges,
  direction,
}: {
  readonly startNodeId: string;
  readonly edges: ReadonlyArray<RuntimeBridgeEdge>;
  readonly direction: "incoming" | "outgoing";
}) => {
  const visited = new Set<string>();
  const frontier = [startNodeId];
  const collected: string[] = [];

  while (frontier.length > 0) {
    const currentNodeId = frontier.shift();
    if (!currentNodeId) continue;

    const nextEdges = edges.filter((edge) =>
      direction === "incoming"
        ? edge.toBridgeNodeId === currentNodeId
        : edge.fromBridgeNodeId === currentNodeId,
    );

    for (const edge of nextEdges) {
      const nextNodeId =
        direction === "incoming" ? edge.fromBridgeNodeId : edge.toBridgeNodeId;
      if (nextNodeId === startNodeId || visited.has(nextNodeId)) continue;
      visited.add(nextNodeId);
      collected.push(nextNodeId);
      frontier.push(nextNodeId);
    }
  }

  return collected;
};

export const findRuntimeBridgeNodeById = (
  snapshot: RuntimeBridgeSnapshot,
  nodeId: string,
): RuntimeBridgeNode | null =>
  snapshot.nodes.find((node) => node.bridgeNodeId === nodeId) || null;

export const findRuntimeBridgeEdgeById = (
  snapshot: RuntimeBridgeSnapshot,
  edgeId: string,
): RuntimeBridgeEdge | null =>
  snapshot.edges.find((edge) => edge.bridgeEdgeId === edgeId) || null;

export const findRuntimeBridgeArtifactsForNode = (
  snapshot: RuntimeBridgeSnapshot,
  nodeId: string,
): ReadonlyArray<RuntimeBridgeArtifactReference> => {
  const node = findRuntimeBridgeNodeById(snapshot, nodeId);
  const nodeArtifactIds = new Set(node?.artifactReferenceIds || []);

  return snapshot.artifacts.filter(
    (artifact) =>
      nodeArtifactIds.has(artifact.artifactId) ||
      getArtifactRelatedNodeIds(artifact).includes(nodeId),
  );
};

export const findRuntimeBridgeEventsForNode = (
  snapshot: RuntimeBridgeSnapshot,
  nodeId: string,
): ReadonlyArray<RuntimeBridgeEvent> =>
  snapshot.events.filter(
    (event) =>
      event.relatedReferenceIds.includes(nodeId) ||
      getEventRelatedNodeIds(event).includes(nodeId),
  );

export const findRuntimeBridgeAdvisoriesForNode = (
  snapshot: RuntimeBridgeSnapshot,
  nodeId: string,
): ReadonlyArray<RuntimeBridgeAdvisoryReference> => {
  const node = findRuntimeBridgeNodeById(snapshot, nodeId);
  const advisoryIds = new Set(node?.advisoryReferenceIds || []);

  return snapshot.advisories.filter((advisory) => advisoryIds.has(advisory.advisoryId));
};

const findRuntimeBridgeContinuationsForNode = (
  snapshot: RuntimeBridgeSnapshot,
  nodeId: string,
): ReadonlyArray<RuntimeBridgeContinuationReference> => {
  const node = findRuntimeBridgeNodeById(snapshot, nodeId);
  const continuationIds = new Set(node?.continuationReferenceIds || []);

  return snapshot.continuations.filter((continuation) =>
    continuationIds.has(continuation.continuationId),
  );
};

const findRuntimeBridgeConfidenceForNode = (
  snapshot: RuntimeBridgeSnapshot,
  nodeId: string,
): ReadonlyArray<RuntimeBridgeConfidence> => {
  const node = findRuntimeBridgeNodeById(snapshot, nodeId);
  const confidenceIds = new Set(node?.confidenceReferenceIds || []);

  return snapshot.confidence.filter((confidence) =>
    confidenceIds.has(confidence.confidenceId),
  );
};

const findRuntimeBridgeExplanationsForNode = (
  snapshot: RuntimeBridgeSnapshot,
  nodeId: string,
): ReadonlyArray<RuntimeBridgeExplanationReference> => {
  const relatedAdvisoryIds = new Set(
    findRuntimeBridgeAdvisoriesForNode(snapshot, nodeId).map((advisory) => advisory.advisoryId),
  );

  return snapshot.explanations.filter((explanation) =>
    explanation.advisoryReferenceIds.some((advisoryId) => relatedAdvisoryIds.has(advisoryId)),
  );
};

export const collectRuntimeBridgeAncestors = (
  snapshot: RuntimeBridgeSnapshot,
  nodeId: string,
): ReadonlyArray<RuntimeBridgeNode> => {
  const ancestorIds = collectReachableNodeIds({
    startNodeId: nodeId,
    edges: snapshot.edges,
    direction: "incoming",
  });

  return ancestorIds
    .map((ancestorId) => findRuntimeBridgeNodeById(snapshot, ancestorId))
    .filter((node): node is RuntimeBridgeNode => Boolean(node));
};

export const collectRuntimeBridgeDescendants = (
  snapshot: RuntimeBridgeSnapshot,
  nodeId: string,
): ReadonlyArray<RuntimeBridgeNode> => {
  const descendantIds = collectReachableNodeIds({
    startNodeId: nodeId,
    edges: snapshot.edges,
    direction: "outgoing",
  });

  return descendantIds
    .map((descendantId) => findRuntimeBridgeNodeById(snapshot, descendantId))
    .filter((node): node is RuntimeBridgeNode => Boolean(node));
};

export const collectRuntimeBridgeRelatedReferences = (
  snapshot: RuntimeBridgeSnapshot,
  nodeId: string,
): ReadonlyArray<string> => {
  const node = findRuntimeBridgeNodeById(snapshot, nodeId);

  return uniqueStable([
    ...collectNodeReferenceIds(node),
    ...findRuntimeBridgeArtifactsForNode(snapshot, nodeId).map((artifact) => artifact.artifactId),
    ...findRuntimeBridgeEventsForNode(snapshot, nodeId).map((event) => event.eventId),
    ...findRuntimeBridgeAdvisoriesForNode(snapshot, nodeId).map((advisory) => advisory.advisoryId),
    ...findRuntimeBridgeContinuationsForNode(snapshot, nodeId).map(
      (continuation) => continuation.continuationId,
    ),
    ...findRuntimeBridgeConfidenceForNode(snapshot, nodeId).map(
      (confidence) => confidence.confidenceId,
    ),
  ]);
};

export const traceRuntimeBridgeLineage = (
  snapshot: RuntimeBridgeSnapshot,
  nodeId: string,
): RuntimeBridgeRelationshipTrace => {
  const rootNode = findRuntimeBridgeNodeById(snapshot, nodeId);
  const incomingEdges = snapshot.edges.filter((edge) => edge.toBridgeNodeId === nodeId);
  const outgoingEdges = snapshot.edges.filter((edge) => edge.fromBridgeNodeId === nodeId);
  const ancestors = collectRuntimeBridgeAncestors(snapshot, nodeId);
  const descendants = collectRuntimeBridgeDescendants(snapshot, nodeId);

  return {
    rootNodeId: nodeId,
    rootNode,
    ancestorNodeIds: ancestors.map((node) => node.bridgeNodeId),
    descendantNodeIds: descendants.map((node) => node.bridgeNodeId),
    incomingEdgeIds: incomingEdges.map((edge) => edge.bridgeEdgeId),
    outgoingEdgeIds: outgoingEdges.map((edge) => edge.bridgeEdgeId),
    relatedReferenceIds: collectRuntimeBridgeRelatedReferences(snapshot, nodeId),
    lineageReferences: rootNode?.lineageReferences || [],
    metadataOnly: true,
  };
};

export const summarizeRuntimeBridgeLineage = (
  snapshot: RuntimeBridgeSnapshot,
  nodeId: string,
): RuntimeBridgeLineageSummary => {
  const trace = traceRuntimeBridgeLineage(snapshot, nodeId);

  return {
    rootNodeId: nodeId,
    rootLabel: trace.rootNode?.label || null,
    ancestorCount: trace.ancestorNodeIds.length,
    descendantCount: trace.descendantNodeIds.length,
    incomingEdgeCount: trace.incomingEdgeIds.length,
    outgoingEdgeCount: trace.outgoingEdgeIds.length,
    relatedReferenceCount: trace.relatedReferenceIds.length,
    lineageReferenceCount: trace.lineageReferences.length,
    metadataOnly: true,
  };
};

export const summarizeRuntimeBridgeEvidence = (
  snapshot: RuntimeBridgeSnapshot,
  nodeId: string,
): RuntimeBridgeEvidenceSummary => {
  const artifacts = findRuntimeBridgeArtifactsForNode(snapshot, nodeId);
  const events = findRuntimeBridgeEventsForNode(snapshot, nodeId);
  const advisories = findRuntimeBridgeAdvisoriesForNode(snapshot, nodeId);
  const explanations = findRuntimeBridgeExplanationsForNode(snapshot, nodeId);
  const continuations = findRuntimeBridgeContinuationsForNode(snapshot, nodeId);
  const confidence = findRuntimeBridgeConfidenceForNode(snapshot, nodeId);

  return {
    rootNodeId: nodeId,
    artifactCount: artifacts.length,
    eventCount: events.length,
    advisoryCount: advisories.length,
    explanationCount: explanations.length,
    continuationCount: continuations.length,
    confidenceCount: confidence.length,
    evidenceReferenceIds: uniqueStable([
      ...artifacts.flatMap((artifact) => artifact.lineageReferenceIds),
      ...events.flatMap((event) => event.relatedReferenceIds),
      ...advisories.flatMap((advisory) => advisory.evidenceReferenceIds),
      ...explanations.flatMap((explanation) => explanation.evidenceReferenceIds),
      ...continuations.flatMap((continuation) => continuation.evidenceReferenceIds),
      ...confidence.flatMap((confidenceReference) => confidenceReference.evidenceReferenceIds),
    ]),
    metadataOnly: true,
  };
};
