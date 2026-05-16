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
import { createRuntimeBridgeId } from "./runtimeBridgeIds";
import type { RuntimeBridgeSnapshot } from "./runtimeBridgeTypes";

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

  return {
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
    nodes: [
      ...(resultNode ? [resultNode] : []),
      ...narrativeMetadata.nodes,
      ...investigationMetadata.nodes,
    ],
    edges: [...narrativeMetadata.edges, ...investigationMetadata.edges],
    artifacts: [],
    continuations: [
      ...narrativeMetadata.continuations,
      ...investigationMetadata.continuations,
    ],
    advisories: [
      ...narrativeMetadata.advisories,
      ...investigationMetadata.advisories,
    ],
    investigations: investigationMetadata.investigations,
    explanations: [
      ...narrativeMetadata.explanations,
      ...investigationMetadata.explanations,
    ],
    results: resultReference ? [resultReference] : [],
    confidence: [
      ...narrativeMetadata.confidence,
      ...investigationMetadata.confidence,
    ],
    events: [],
    metadataOnly: true,
  };
};
