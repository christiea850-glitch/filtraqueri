import type { MetadataOnlyBoundaryContract } from "../governance/boundaryTypes";
import type {
  RuntimeBridgeDeliveryEcosystemPriority,
  RuntimeBridgeDeliveryEcosystemTheme,
  RuntimeBridgeExecutiveDeliveryEcosystem,
} from "./runtimeBridgeExecutiveDeliveryEcosystem";
import { createRuntimeBridgeId } from "./runtimeBridgeIds";
import type { RuntimeBridgeSourceModuleReference } from "./runtimeBridgeTypes";

export type RuntimeBridgeFederationPriority = RuntimeBridgeDeliveryEcosystemPriority;

export type RuntimeBridgeFederationTheme =
  | RuntimeBridgeDeliveryEcosystemTheme
  | "federation_topology"
  | "boardroom_continuity_map"
  | "lineage_propagation"
  | "enterprise_synchronization"
  | "strategic_topology_continuity"
  | "federation_narrative";

export type RuntimeBridgeFederationTopology = {
  readonly topologyId: string;
  readonly subjectId: string;
  readonly priority: RuntimeBridgeFederationPriority;
  readonly topologyPosture: "single_ecosystem" | "federated_ecosystem" | "boardroom_federated" | "risk_federated";
  readonly enterpriseTopologyIds: ReadonlyArray<string>;
  readonly federationIds: ReadonlyArray<string>;
  readonly ecosystemBundleIds: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeBoardroomContinuityMap = {
  readonly continuityMapId: string;
  readonly subjectId: string;
  readonly priority: RuntimeBridgeFederationPriority;
  readonly continuityPosture: "single_boardroom" | "multi_boardroom" | "boardroom_continuous" | "risk_continuous";
  readonly boardroomContinuityIds: ReadonlyArray<string>;
  readonly narrativeFlowIds: ReadonlyArray<string>;
  readonly channelMapIds: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeIntelligenceLineagePropagation = {
  readonly lineagePropagationId: string;
  readonly subjectId: string;
  readonly priority: RuntimeBridgeFederationPriority;
  readonly propagationPosture: "contained" | "propagated" | "boardroom_lineage" | "risk_lineage";
  readonly sourcePropagationIds: ReadonlyArray<string>;
  readonly topologyIds: ReadonlyArray<string>;
  readonly ecosystemBundleIds: ReadonlyArray<string>;
  readonly themeIds: ReadonlyArray<RuntimeBridgeFederationTheme>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeEnterpriseInsightSynchronization = {
  readonly synchronizationId: string;
  readonly subjectId: string;
  readonly priority: RuntimeBridgeFederationPriority;
  readonly synchronizationPosture: "synchronized" | "federated_sync" | "boardroom_sync" | "risk_sync";
  readonly channelMapIds: ReadonlyArray<string>;
  readonly continuityMapIds: ReadonlyArray<string>;
  readonly federationTopologyIds: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeStrategicTopologyContinuity = {
  readonly continuityId: string;
  readonly subjectId: string;
  readonly priority: RuntimeBridgeFederationPriority;
  readonly topologyContinuityPosture: "stable" | "federated" | "boardroom_continuity" | "risk_continuity";
  readonly topologyIds: ReadonlyArray<string>;
  readonly propagationIds: ReadonlyArray<string>;
  readonly synchronizationIds: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeFederationNarrativeFlow = {
  readonly narrativeFlowId: string;
  readonly subjectId: string;
  readonly priority: RuntimeBridgeFederationPriority;
  readonly narrativePosture: "linear" | "federated" | "boardroom_first" | "risk_first";
  readonly federationTopologyId: string;
  readonly boardroomContinuityMapId: string;
  readonly lineagePropagationId: string;
  readonly synchronizationId: string;
  readonly strategicTopologyContinuityId: string;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeFederationBundle = {
  readonly bundleId: string;
  readonly subjectId: string;
  readonly theme: RuntimeBridgeFederationTheme;
  readonly priority: RuntimeBridgeFederationPriority;
  readonly topologyIds: ReadonlyArray<string>;
  readonly continuityMapIds: ReadonlyArray<string>;
  readonly propagationIds: ReadonlyArray<string>;
  readonly synchronizationIds: ReadonlyArray<string>;
  readonly sourceEcosystemBundleIds: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeEnterpriseIntelligenceFederation = {
  readonly federationId: string;
  readonly subjectId: string;
  readonly federationTopology: RuntimeBridgeFederationTopology;
  readonly boardroomContinuityMap: RuntimeBridgeBoardroomContinuityMap;
  readonly intelligenceLineagePropagation: RuntimeBridgeIntelligenceLineagePropagation;
  readonly enterpriseInsightSynchronization: RuntimeBridgeEnterpriseInsightSynchronization;
  readonly strategicTopologyContinuity: RuntimeBridgeStrategicTopologyContinuity;
  readonly federationNarrativeFlow: RuntimeBridgeFederationNarrativeFlow;
  readonly federationBundles: ReadonlyArray<RuntimeBridgeFederationBundle>;
  readonly federationPriorities: ReadonlyArray<RuntimeBridgeFederationPriority>;
  readonly federationThemes: ReadonlyArray<RuntimeBridgeFederationTheme>;
  readonly sourceDeliveryEcosystemId: string;
  readonly metadataOnly: true;
};

export const runtimeBridgeEnterpriseIntelligenceFederationGovernance = {
  mode: "metadata_only",
  contractId: "runtime-bridge-enterprise-intelligence-federation",
  label: "Runtime bridge enterprise intelligence federation",
  description:
    "Metadata-only enterprise-wide intelligence continuity, cross-ecosystem federation mapping, multi-boardroom narrative continuity, intelligence lineage propagation posture, enterprise insight synchronization metadata, and deterministic strategic intelligence topology continuity planning.",
  confidence: "high",
  canExecute: false,
  canMutateWorkspace: false,
  canCallBackend: false,
  lineageRefs: [
    "runtime-bridge-enterprise-intelligence-federation",
    "runtime-bridge-federation-topology",
    "runtime-bridge-boardroom-continuity-map",
    "runtime-bridge-intelligence-lineage-propagation",
    "runtime-bridge-enterprise-insight-synchronization",
    "runtime-bridge-strategic-topology-continuity",
    "runtime-bridge-federation-narrative-flow",
    "runtime-bridge-federation-bundle",
  ],
} satisfies MetadataOnlyBoundaryContract;

export const runtimeBridgeEnterpriseIntelligenceFederationSourceModule: RuntimeBridgeSourceModuleReference = {
  moduleId: "runtime-bridge-enterprise-intelligence-federation",
  modulePath: "frontend/src/features/runtimeBridge/runtimeBridgeEnterpriseIntelligenceFederation.ts",
  capabilityMode: "metadata_only",
  label: "Runtime bridge enterprise intelligence federation",
};

const uniqueStable = <T extends string>(items: ReadonlyArray<T>): T[] => {
  const seen = new Set<string>();
  const values: T[] = [];

  for (const item of items) {
    if (!item || seen.has(item)) continue;
    seen.add(item);
    values.push(item);
  }

  return values;
};

const priorityScore = (priority: RuntimeBridgeFederationPriority) => {
  if (priority === "critical") return 4;
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  return 1;
};

const sortPriorities = (
  priorities: ReadonlyArray<RuntimeBridgeFederationPriority>,
): RuntimeBridgeFederationPriority[] =>
  uniqueStable(priorities).sort((left, right) => {
    const priorityDelta = priorityScore(right) - priorityScore(left);
    if (priorityDelta !== 0) return priorityDelta;
    return left.localeCompare(right);
  });

const strongestPriority = (
  priorities: ReadonlyArray<RuntimeBridgeFederationPriority>,
): RuntimeBridgeFederationPriority => sortPriorities(priorities)[0] || "low";

const federationTheme = (
  theme: RuntimeBridgeDeliveryEcosystemTheme,
): RuntimeBridgeFederationTheme => theme;

export const collectRuntimeBridgeFederationThemes = (
  ecosystem: RuntimeBridgeExecutiveDeliveryEcosystem,
): ReadonlyArray<RuntimeBridgeFederationTheme> =>
  uniqueStable([
    ...ecosystem.deliveryEcosystemThemes.map(federationTheme),
    "federation_topology",
    "boardroom_continuity_map",
    "lineage_propagation",
    "enterprise_synchronization",
    "strategic_topology_continuity",
    "federation_narrative",
  ]);

export const summarizeRuntimeBridgeFederationPriorities = (
  ecosystem: RuntimeBridgeExecutiveDeliveryEcosystem,
): ReadonlyArray<RuntimeBridgeFederationPriority> =>
  sortPriorities([
    ...ecosystem.deliveryEcosystemPriorities,
    ecosystem.enterpriseDeliveryTopology.priority,
    ecosystem.presentationFederation.priority,
    ecosystem.boardroomDeliveryContinuity.priority,
    ecosystem.strategicInsightPropagation.priority,
    ecosystem.enterpriseNarrativeFlow.priority,
    ...ecosystem.executiveDeliveryChannelMaps.map((channelMap) => channelMap.priority),
    ...ecosystem.deliveryEcosystemBundles.map((bundle) => bundle.priority),
  ]);

export const buildRuntimeBridgeFederationTopology = (
  ecosystem: RuntimeBridgeExecutiveDeliveryEcosystem,
): RuntimeBridgeFederationTopology => {
  const topologyPosture: RuntimeBridgeFederationTopology["topologyPosture"] =
    ecosystem.enterpriseDeliveryTopology.topologyPosture === "risk_centered"
      ? "risk_federated"
      : ecosystem.enterpriseDeliveryTopology.topologyPosture === "boardroom_centered"
        ? "boardroom_federated"
        : ecosystem.presentationFederation.federationPosture === "federated"
          ? "federated_ecosystem"
          : "single_ecosystem";

  return {
    topologyId: createRuntimeBridgeId("runtime-bridge-federation-topology", ecosystem.subjectId),
    subjectId: ecosystem.subjectId,
    priority: strongestPriority(summarizeRuntimeBridgeFederationPriorities(ecosystem)),
    topologyPosture,
    enterpriseTopologyIds: [ecosystem.enterpriseDeliveryTopology.topologyId],
    federationIds: [ecosystem.presentationFederation.federationId],
    ecosystemBundleIds: ecosystem.deliveryEcosystemBundles.map((bundle) => bundle.bundleId),
    summary: `Federation topology is ${topologyPosture} across ${ecosystem.deliveryEcosystemBundles.length} delivery ecosystem bundles.`,
    metadataOnly: true,
  };
};

export const summarizeRuntimeBridgeBoardroomContinuity = (
  ecosystem: RuntimeBridgeExecutiveDeliveryEcosystem,
): RuntimeBridgeBoardroomContinuityMap => {
  const continuityPosture: RuntimeBridgeBoardroomContinuityMap["continuityPosture"] =
    ecosystem.boardroomDeliveryContinuity.continuityPosture === "risk_continuity"
      ? "risk_continuous"
      : ecosystem.boardroomDeliveryContinuity.continuityPosture === "hierarchy_continuity"
        ? "boardroom_continuous"
        : ecosystem.boardroomDeliveryContinuity.presentationContinuityIds.length > 1
          ? "multi_boardroom"
          : "single_boardroom";

  return {
    continuityMapId: createRuntimeBridgeId("runtime-bridge-boardroom-continuity-map", ecosystem.subjectId),
    subjectId: ecosystem.subjectId,
    priority: ecosystem.boardroomDeliveryContinuity.priority,
    continuityPosture,
    boardroomContinuityIds: [ecosystem.boardroomDeliveryContinuity.continuityId],
    narrativeFlowIds: [ecosystem.enterpriseNarrativeFlow.narrativeFlowId],
    channelMapIds: ecosystem.executiveDeliveryChannelMaps
      .filter((channelMap) => channelMap.channel === "boardroom" || channelMap.channel === "continuity")
      .map((channelMap) => channelMap.channelMapId),
    summary: `Boardroom continuity map is ${continuityPosture} with ${ecosystem.boardroomDeliveryContinuity.presentationContinuityIds.length} presentation continuity references.`,
    metadataOnly: true,
  };
};

export const buildRuntimeBridgeIntelligenceLineagePropagation = (
  ecosystem: RuntimeBridgeExecutiveDeliveryEcosystem,
): RuntimeBridgeIntelligenceLineagePropagation => {
  const propagationPosture: RuntimeBridgeIntelligenceLineagePropagation["propagationPosture"] =
    ecosystem.strategicInsightPropagation.propagationPosture === "risk_propagated"
      ? "risk_lineage"
      : ecosystem.strategicInsightPropagation.propagationPosture === "boardroom_propagated"
        ? "boardroom_lineage"
        : ecosystem.strategicInsightPropagation.propagationPosture === "cross_presentation"
          ? "propagated"
          : "contained";

  return {
    lineagePropagationId: createRuntimeBridgeId("runtime-bridge-intelligence-lineage-propagation", ecosystem.subjectId),
    subjectId: ecosystem.subjectId,
    priority: ecosystem.strategicInsightPropagation.priority,
    propagationPosture,
    sourcePropagationIds: [ecosystem.strategicInsightPropagation.propagationId],
    topologyIds: [ecosystem.enterpriseDeliveryTopology.topologyId],
    ecosystemBundleIds: ecosystem.deliveryEcosystemBundles.map((bundle) => bundle.bundleId),
    themeIds: ecosystem.strategicInsightPropagation.sourceThemeIds.map(federationTheme),
    summary: `Intelligence lineage propagation is ${propagationPosture} across ${ecosystem.strategicInsightPropagation.sourceThemeIds.length} source themes.`,
    metadataOnly: true,
  };
};

export const summarizeRuntimeBridgeEnterpriseInsightSynchronization = ({
  ecosystem,
  federationTopology,
  boardroomContinuity,
}: {
  readonly ecosystem: RuntimeBridgeExecutiveDeliveryEcosystem;
  readonly federationTopology: RuntimeBridgeFederationTopology;
  readonly boardroomContinuity: RuntimeBridgeBoardroomContinuityMap;
}): RuntimeBridgeEnterpriseInsightSynchronization => {
  const synchronizationPosture: RuntimeBridgeEnterpriseInsightSynchronization["synchronizationPosture"] =
    ecosystem.enterpriseNarrativeFlow.narrativePosture === "risk_first"
      ? "risk_sync"
      : ecosystem.enterpriseNarrativeFlow.narrativePosture === "boardroom_first"
        ? "boardroom_sync"
        : ecosystem.presentationFederation.federationPosture === "federated"
          ? "federated_sync"
          : "synchronized";

  return {
    synchronizationId: createRuntimeBridgeId("runtime-bridge-enterprise-insight-synchronization", ecosystem.subjectId),
    subjectId: ecosystem.subjectId,
    priority: strongestPriority([
      ecosystem.enterpriseNarrativeFlow.priority,
      federationTopology.priority,
      boardroomContinuity.priority,
      ...ecosystem.executiveDeliveryChannelMaps.map((channelMap) => channelMap.priority),
    ]),
    synchronizationPosture,
    channelMapIds: ecosystem.executiveDeliveryChannelMaps.map((channelMap) => channelMap.channelMapId),
    continuityMapIds: [boardroomContinuity.continuityMapId],
    federationTopologyIds: [federationTopology.topologyId],
    summary: `Enterprise insight synchronization is ${synchronizationPosture} across ${ecosystem.executiveDeliveryChannelMaps.length} delivery channel maps.`,
    metadataOnly: true,
  };
};

export const buildRuntimeBridgeStrategicTopologyContinuity = ({
  ecosystem,
  federationTopology,
  lineagePropagation,
  synchronization,
}: {
  readonly ecosystem: RuntimeBridgeExecutiveDeliveryEcosystem;
  readonly federationTopology: RuntimeBridgeFederationTopology;
  readonly lineagePropagation: RuntimeBridgeIntelligenceLineagePropagation;
  readonly synchronization: RuntimeBridgeEnterpriseInsightSynchronization;
}): RuntimeBridgeStrategicTopologyContinuity => {
  const topologyContinuityPosture: RuntimeBridgeStrategicTopologyContinuity["topologyContinuityPosture"] =
    federationTopology.topologyPosture === "risk_federated"
      ? "risk_continuity"
      : federationTopology.topologyPosture === "boardroom_federated"
        ? "boardroom_continuity"
        : federationTopology.topologyPosture === "federated_ecosystem"
          ? "federated"
          : "stable";

  return {
    continuityId: createRuntimeBridgeId("runtime-bridge-strategic-topology-continuity", ecosystem.subjectId),
    subjectId: ecosystem.subjectId,
    priority: strongestPriority([
      federationTopology.priority,
      lineagePropagation.priority,
      synchronization.priority,
    ]),
    topologyContinuityPosture,
    topologyIds: [federationTopology.topologyId, ecosystem.enterpriseDeliveryTopology.topologyId],
    propagationIds: [lineagePropagation.lineagePropagationId, ecosystem.strategicInsightPropagation.propagationId],
    synchronizationIds: [synchronization.synchronizationId],
    summary: `Strategic topology continuity is ${topologyContinuityPosture} across federation and enterprise topology descriptors.`,
    metadataOnly: true,
  };
};

export const buildRuntimeBridgeFederationNarrativeFlow = ({
  ecosystem,
  federationTopology,
  boardroomContinuity,
  lineagePropagation,
  synchronization,
  topologyContinuity,
}: {
  readonly ecosystem: RuntimeBridgeExecutiveDeliveryEcosystem;
  readonly federationTopology: RuntimeBridgeFederationTopology;
  readonly boardroomContinuity: RuntimeBridgeBoardroomContinuityMap;
  readonly lineagePropagation: RuntimeBridgeIntelligenceLineagePropagation;
  readonly synchronization: RuntimeBridgeEnterpriseInsightSynchronization;
  readonly topologyContinuity: RuntimeBridgeStrategicTopologyContinuity;
}): RuntimeBridgeFederationNarrativeFlow => {
  const narrativePosture: RuntimeBridgeFederationNarrativeFlow["narrativePosture"] =
    federationTopology.topologyPosture === "risk_federated"
      ? "risk_first"
      : federationTopology.topologyPosture === "boardroom_federated"
        ? "boardroom_first"
        : federationTopology.topologyPosture === "federated_ecosystem"
          ? "federated"
          : "linear";

  return {
    narrativeFlowId: createRuntimeBridgeId("runtime-bridge-federation-narrative-flow", ecosystem.subjectId),
    subjectId: ecosystem.subjectId,
    priority: strongestPriority([
      federationTopology.priority,
      boardroomContinuity.priority,
      lineagePropagation.priority,
      synchronization.priority,
      topologyContinuity.priority,
    ]),
    narrativePosture,
    federationTopologyId: federationTopology.topologyId,
    boardroomContinuityMapId: boardroomContinuity.continuityMapId,
    lineagePropagationId: lineagePropagation.lineagePropagationId,
    synchronizationId: synchronization.synchronizationId,
    strategicTopologyContinuityId: topologyContinuity.continuityId,
    summary: `Federation narrative flow is ${narrativePosture} across topology, continuity, lineage, synchronization, and strategic topology continuity metadata.`,
    metadataOnly: true,
  };
};

export const buildRuntimeBridgeFederationBundles = ({
  ecosystem,
  federationTopology,
  boardroomContinuity,
  lineagePropagation,
  synchronization,
}: {
  readonly ecosystem: RuntimeBridgeExecutiveDeliveryEcosystem;
  readonly federationTopology: RuntimeBridgeFederationTopology;
  readonly boardroomContinuity: RuntimeBridgeBoardroomContinuityMap;
  readonly lineagePropagation: RuntimeBridgeIntelligenceLineagePropagation;
  readonly synchronization: RuntimeBridgeEnterpriseInsightSynchronization;
}): ReadonlyArray<RuntimeBridgeFederationBundle> =>
  collectRuntimeBridgeFederationThemes(ecosystem).map((theme) => {
    const sourceBundles = ecosystem.deliveryEcosystemBundles.filter(
      (bundle) => federationTheme(bundle.theme) === theme,
    );
    const priority = strongestPriority([
      ...sourceBundles.map((bundle) => bundle.priority),
      theme === "federation_topology" ? federationTopology.priority : "low",
      theme === "boardroom_continuity_map" ? boardroomContinuity.priority : "low",
      theme === "lineage_propagation" ? lineagePropagation.priority : "low",
      theme === "enterprise_synchronization" ? synchronization.priority : "low",
    ]);

    return {
      bundleId: createRuntimeBridgeId("runtime-bridge-federation-bundle", ecosystem.subjectId, theme),
      subjectId: ecosystem.subjectId,
      theme,
      priority,
      topologyIds: theme === "federation_topology" ? [federationTopology.topologyId] : [],
      continuityMapIds: theme === "boardroom_continuity_map" ? [boardroomContinuity.continuityMapId] : [],
      propagationIds: theme === "lineage_propagation" ? [lineagePropagation.lineagePropagationId] : [],
      synchronizationIds: theme === "enterprise_synchronization" ? [synchronization.synchronizationId] : [],
      sourceEcosystemBundleIds: sourceBundles.map((bundle) => bundle.bundleId),
      summary: `${theme} federation bundle references ${sourceBundles.length} ecosystem bundles.`,
      metadataOnly: true as const,
    };
  }).sort((left, right) => {
    const priorityDelta = priorityScore(right.priority) - priorityScore(left.priority);
    if (priorityDelta !== 0) return priorityDelta;
    return left.bundleId.localeCompare(right.bundleId);
  });

export const buildRuntimeBridgeEnterpriseIntelligenceFederation = (
  ecosystem: RuntimeBridgeExecutiveDeliveryEcosystem,
): RuntimeBridgeEnterpriseIntelligenceFederation => {
  const federationTopology = buildRuntimeBridgeFederationTopology(ecosystem);
  const boardroomContinuityMap = summarizeRuntimeBridgeBoardroomContinuity(ecosystem);
  const intelligenceLineagePropagation = buildRuntimeBridgeIntelligenceLineagePropagation(ecosystem);
  const enterpriseInsightSynchronization = summarizeRuntimeBridgeEnterpriseInsightSynchronization({
    ecosystem,
    federationTopology,
    boardroomContinuity: boardroomContinuityMap,
  });
  const strategicTopologyContinuity = buildRuntimeBridgeStrategicTopologyContinuity({
    ecosystem,
    federationTopology,
    lineagePropagation: intelligenceLineagePropagation,
    synchronization: enterpriseInsightSynchronization,
  });
  const federationNarrativeFlow = buildRuntimeBridgeFederationNarrativeFlow({
    ecosystem,
    federationTopology,
    boardroomContinuity: boardroomContinuityMap,
    lineagePropagation: intelligenceLineagePropagation,
    synchronization: enterpriseInsightSynchronization,
    topologyContinuity: strategicTopologyContinuity,
  });
  const federationBundles = buildRuntimeBridgeFederationBundles({
    ecosystem,
    federationTopology,
    boardroomContinuity: boardroomContinuityMap,
    lineagePropagation: intelligenceLineagePropagation,
    synchronization: enterpriseInsightSynchronization,
  });

  return {
    federationId: createRuntimeBridgeId("runtime-bridge-enterprise-intelligence-federation", ecosystem.subjectId),
    subjectId: ecosystem.subjectId,
    federationTopology,
    boardroomContinuityMap,
    intelligenceLineagePropagation,
    enterpriseInsightSynchronization,
    strategicTopologyContinuity,
    federationNarrativeFlow,
    federationBundles,
    federationPriorities: summarizeRuntimeBridgeFederationPriorities(ecosystem),
    federationThemes: collectRuntimeBridgeFederationThemes(ecosystem),
    sourceDeliveryEcosystemId: ecosystem.ecosystemId,
    metadataOnly: true,
  };
};
