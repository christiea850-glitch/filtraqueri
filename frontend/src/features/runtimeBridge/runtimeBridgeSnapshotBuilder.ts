import {
  createInvestigationBridgeMetadata,
  createNarrativeBridgeMetadata,
  createRuntimeBridgeResultNode,
  createRuntimeBridgeResultReference,
} from "./runtimeBridgeAdapters";
import {
  runtimeBridgeBuilderSourceModules,
  type RuntimeBridgeSnapshotBuildInput,
} from "./runtimeBridgeBuilderTypes";
import { createBridgeEdgeId, createBridgeNodeId, createRuntimeBridgeId } from "./runtimeBridgeIds";
import { createRuntimeBridgeArtifacts } from "./runtimeBridgeArtifacts";
import { createRuntimeBridgeEvents } from "./runtimeBridgeEvents";
import { normalizeRuntimeBridgeSnapshot } from "./runtimeBridgeNormalize";
import type { RuntimeBridgeSnapshot } from "./runtimeBridgeTypes";
import { createRuntimeBridgeIntegrityReport } from "./runtimeBridgeIntegrity";

export const buildRuntimeBridgeSnapshot = ({
  bridgeId,
  createdAt,
  sourceModules,
  activeResultModel,
  narrativeReport,
  investigationReport,
}: RuntimeBridgeSnapshotBuildInput): RuntimeBridgeSnapshot => {
  const modules = {
    ...runtimeBridgeBuilderSourceModules,
    ...sourceModules,
  };
  const resultReference = createRuntimeBridgeResultReference(activeResultModel);
  const resultNode =
    resultReference && activeResultModel
      ? createRuntimeBridgeResultNode({
          resultReference,
          activeResultModel,
          createdAt,
          sourceModule: modules.activeResult,
        })
      : null;
  const narrativeMetadata = createNarrativeBridgeMetadata({
    narrativeReport,
    createdAt,
    sourceModule: modules.narrativeIntelligence,
    resultReference,
  });
  const investigationMetadata = createInvestigationBridgeMetadata({
    investigationReport,
    createdAt,
    sourceModule: modules.investigationIntelligence,
    resultReference,
  });
  const nodes = [
    ...(resultNode ? [resultNode] : []),
    ...narrativeMetadata.nodes,
    ...investigationMetadata.nodes,
  ];
  const continuations = [
    ...narrativeMetadata.continuations,
    ...investigationMetadata.continuations,
  ];
  const advisories = [
    ...narrativeMetadata.advisories,
    ...investigationMetadata.advisories,
  ];
  const explanations = [
    ...narrativeMetadata.explanations,
    ...investigationMetadata.explanations,
  ];
  const confidence = [
    ...narrativeMetadata.confidence,
    ...investigationMetadata.confidence,
  ];
  const artifacts = createRuntimeBridgeArtifacts({
    createdAt,
    sourceModule: modules.runtimeBridge,
    resultReference,
    narrativeReport,
    investigationReport,
    relatedNodeIds: nodes.map((node) => node.bridgeNodeId),
  });
  const artifactEdges = artifacts.flatMap((artifact) =>
    artifact.relatedNodeIds.map((nodeId) => ({
      bridgeEdgeId: createBridgeEdgeId("references", artifact.artifactId, nodeId),
      edgeType: "references" as const,
      fromBridgeNodeId: createBridgeNodeId("artifact", artifact.artifactId),
      toBridgeNodeId: nodeId,
      createdAt,
      lineageReferences: [
        {
          referenceId: artifact.artifactId,
          referenceKind: "artifact" as const,
          relationship: "related_to" as const,
          label: artifact.label,
        },
      ],
      confidenceReferenceId: null,
      metadataOnly: true as const,
    })),
  );
  const events = createRuntimeBridgeEvents({
    createdAt,
    sourceModule: modules.runtimeBridge,
    relatedNodeIds: nodes.map((node) => node.bridgeNodeId),
    confidence,
    explanations,
    continuations,
    artifactIds: artifacts.map((artifact) => artifact.artifactId),
  });

  return normalizeRuntimeBridgeSnapshot({
    bridgeId:
      bridgeId ||
      createRuntimeBridgeId(
        "runtime-bridge",
        activeResultModel?.datasetId,
        activeResultModel?.sourceTab,
        narrativeReport?.reportId,
        investigationReport?.flow.id,
        createdAt,
      ),
    createdAt,
    sourceModule: modules.runtimeBridge,
    nodes,
    edges: [...narrativeMetadata.edges, ...investigationMetadata.edges, ...artifactEdges],
    artifacts,
    continuations,
    advisories,
    investigations: investigationMetadata.investigations,
    explanations,
    results: resultReference ? [resultReference] : [],
    confidence,
    events,
    metadataOnly: true,
  });
};

export const buildRuntimeBridgeIntegrityReadySnapshot = (
  input: RuntimeBridgeSnapshotBuildInput,
) => {
  const snapshot = buildRuntimeBridgeSnapshot(input);

  return {
    snapshot,
    integrityReport: createRuntimeBridgeIntegrityReport({
      snapshot,
      checkedAt: input.createdAt,
    }),
    metadataOnly: true as const,
  };
};
