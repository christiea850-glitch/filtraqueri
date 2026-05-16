import type { RuntimeConfidenceSummary } from "../runtimeIntelligence/confidence/runtimeConfidence";
import type { RuntimeContinuationReference } from "../runtimeIntelligence/continuations/runtimeContinuations";
import type { RuntimeEvent, RuntimeEventReference } from "../runtimeIntelligence/events/runtimeEvents";
import type { RuntimeEdge, RuntimeNode } from "../runtimeIntelligence";
import type { MetadataOnlyBoundaryContract } from "../governance/boundaryTypes";
import {
  createBridgeEdgeId,
  createBridgeNodeId,
  createBridgeReferenceId,
} from "./runtimeBridgeIds";
import type {
  RuntimeBridgeConfidence,
  RuntimeBridgeContinuationReference,
  RuntimeBridgeEdge,
  RuntimeBridgeEvent,
  RuntimeBridgeLineageReference,
  RuntimeBridgeNode,
  RuntimeBridgeSourceModuleReference,
} from "./runtimeBridgeTypes";

export const runtimeGraphAdapterGovernance = {
  mode: "metadata_only",
  contractId: "runtime-graph-bridge-adapters",
  label: "Runtime graph bridge adapters",
  description:
    "Metadata-only adapters that translate runtime intelligence graph metadata into runtime bridge references.",
  confidence: "high",
  canExecute: false,
  canMutateWorkspace: false,
  canCallBackend: false,
  lineageRefs: [
    "runtime-graph-node-adapter",
    "runtime-graph-edge-adapter",
    "runtime-graph-continuation-adapter",
    "runtime-graph-event-adapter",
    "runtime-graph-confidence-adapter",
  ],
} satisfies MetadataOnlyBoundaryContract;

export const runtimeGraphAdapterSourceModule: RuntimeBridgeSourceModuleReference = {
  moduleId: "runtime-graph-adapters",
  modulePath: "frontend/src/features/runtimeBridge/runtimeGraphAdapters.ts",
  capabilityMode: "metadata_only",
  label: "Runtime graph bridge adapters",
};

const mapRuntimeLineageReferences = (
  lineageReferences: ReadonlyArray<RuntimeNode["lineageReferences"][number]>,
): RuntimeBridgeLineageReference[] =>
  lineageReferences.map((lineageReference) => ({
    referenceId: lineageReference.nodeId,
    referenceKind: "runtime_node",
    relationship:
      lineageReference.relation === "derived"
        ? "derived_from"
        : lineageReference.relation === "evidence"
          ? "evidence_for"
          : lineageReference.relation,
    label: lineageReference.nodeType,
  }));

export const adaptRuntimeNodeToBridgeNode = (
  runtimeNode: RuntimeNode,
  sourceModule: RuntimeBridgeSourceModuleReference = runtimeGraphAdapterSourceModule,
): RuntimeBridgeNode => ({
  bridgeNodeId: createBridgeNodeId("runtime", runtimeNode.id),
  nodeType: "runtime",
  label: runtimeNode.label,
  createdAt: runtimeNode.createdAt,
  updatedAt: null,
  sourceModule,
  lineageReferences: mapRuntimeLineageReferences(runtimeNode.lineageReferences),
  relatedRuntimeNodeIds: runtimeNode.derivedFrom.map((nodeId) =>
    createBridgeNodeId("runtime", nodeId),
  ),
  advisoryReferenceIds: runtimeNode.advisoryEventReferences.map((eventReference) =>
    createBridgeReferenceId("runtime-event", eventReference.eventId),
  ),
  continuationReferenceIds: runtimeNode.continuationReferences.map((continuation) =>
    createBridgeReferenceId("runtime-continuation", continuation.continuationId),
  ),
  confidenceReferenceIds: runtimeNode.confidenceSummary
    ? [createBridgeReferenceId("runtime-confidence", runtimeNode.id)]
    : [],
  artifactReferenceIds: runtimeNode.artifactSnapshots.map((artifact) =>
    createBridgeReferenceId("runtime-artifact", artifact.artifactId),
  ),
  metadataOnly: true,
});

export const adaptRuntimeEdgeToBridgeEdge = (
  runtimeEdge: RuntimeEdge,
): RuntimeBridgeEdge => ({
  bridgeEdgeId: createBridgeEdgeId("runtime", runtimeEdge.fromNodeId, runtimeEdge.toNodeId),
  edgeType:
    runtimeEdge.type === "derived_from"
      ? "links"
      : runtimeEdge.type === "continued_from"
        ? "continues"
        : "references",
  fromBridgeNodeId: createBridgeNodeId("runtime", runtimeEdge.fromNodeId),
  toBridgeNodeId: createBridgeNodeId("runtime", runtimeEdge.toNodeId),
  createdAt: runtimeEdge.createdAt,
  lineageReferences: [
    {
      referenceId: runtimeEdge.id,
      referenceKind: "runtime_edge",
      relationship:
        runtimeEdge.type === "derived_from"
          ? "derived_from"
          : runtimeEdge.type === "continued_from"
            ? "continues"
            : "related_to",
      label: runtimeEdge.lineageReason,
    },
  ],
  confidenceReferenceId: null,
  metadataOnly: true,
});

export const adaptRuntimeContinuationToBridgeContinuation = (
  continuation: RuntimeContinuationReference,
): RuntimeBridgeContinuationReference => ({
  continuationId: createBridgeReferenceId("runtime-continuation", continuation.continuationId),
  category: continuation.category,
  label: continuation.label,
  reason: "Runtime continuation metadata reference.",
  targetReferenceId: continuation.targetId || null,
  evidenceReferenceIds: continuation.targetId
    ? [createBridgeReferenceId("runtime-continuation-target", continuation.targetId)]
    : [],
  metadataOnly: true,
});

export const adaptRuntimeEventToBridgeEvent = ({
  runtimeEvent,
  createdAt,
  sourceModule = runtimeGraphAdapterSourceModule,
}: {
  readonly runtimeEvent: RuntimeEvent | RuntimeEventReference;
  readonly createdAt: string;
  readonly sourceModule?: RuntimeBridgeSourceModuleReference;
}): RuntimeBridgeEvent => {
  const eventCreatedAt = "createdAt" in runtimeEvent ? runtimeEvent.createdAt : createdAt;
  const relatedReferenceIds = [
    "nodeId" in runtimeEvent && runtimeEvent.nodeId
      ? createBridgeNodeId("runtime", runtimeEvent.nodeId)
      : null,
    "artifactId" in runtimeEvent && runtimeEvent.artifactId
      ? createBridgeReferenceId("runtime-artifact", runtimeEvent.artifactId)
      : null,
  ].filter((referenceId): referenceId is string => Boolean(referenceId));

  return {
    eventId: createBridgeReferenceId("runtime-event", runtimeEvent.eventId),
    eventType: runtimeEvent.type,
    createdAt: eventCreatedAt,
    sourceModule,
    relatedReferenceIds,
    summary: "summary" in runtimeEvent ? runtimeEvent.summary : runtimeEvent.label,
    metadataOnly: true,
  };
};

export const adaptRuntimeConfidenceToBridgeConfidence = (
  confidenceSummary: RuntimeConfidenceSummary,
  sourceId: string,
): RuntimeBridgeConfidence => ({
  confidenceId: createBridgeReferenceId("runtime-confidence", sourceId),
  level: confidenceSummary.weakestLink.level,
  score: confidenceSummary.weakestLink.score,
  rationale: confidenceSummary.weakestLink.reason,
  weakestLinkReferenceId: createBridgeReferenceId("runtime-confidence-weakest-link", sourceId),
  evidenceReferenceIds: [
    createBridgeReferenceId("runtime-confidence-source-quality", sourceId),
    createBridgeReferenceId("runtime-confidence-semantic", sourceId),
    createBridgeReferenceId("runtime-confidence-narrative", sourceId),
    createBridgeReferenceId("runtime-confidence-execution", sourceId),
    createBridgeReferenceId("runtime-confidence-feasibility", sourceId),
    createBridgeReferenceId("runtime-confidence-recommendation", sourceId),
  ],
  metadataOnly: true,
});

