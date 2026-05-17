import type { MetadataOnlyBoundaryContract } from "../governance/boundaryTypes";
import type {
  RuntimeBridgeExecutivePresentationOrchestration,
  RuntimeBridgePresentationPriority,
  RuntimeBridgePresentationTheme,
} from "./runtimeBridgeExecutivePresentationOrchestration";
import { createRuntimeBridgeId } from "./runtimeBridgeIds";
import type { RuntimeBridgeSourceModuleReference } from "./runtimeBridgeTypes";

export type RuntimeBridgeDeliveryEcosystemPriority = RuntimeBridgePresentationPriority;

export type RuntimeBridgeDeliveryEcosystemTheme =
  | RuntimeBridgePresentationTheme
  | "enterprise_topology"
  | "presentation_federation"
  | "boardroom_continuity"
  | "insight_propagation"
  | "delivery_channel"
  | "enterprise_narrative";

export type RuntimeBridgeEnterpriseDeliveryTopology = {
  readonly topologyId: string;
  readonly subjectId: string;
  readonly priority: RuntimeBridgeDeliveryEcosystemPriority;
  readonly topologyPosture: "single_channel" | "multi_channel" | "boardroom_centered" | "risk_centered";
  readonly presentationFlowIds: ReadonlyArray<string>;
  readonly briefingIds: ReadonlyArray<string>;
  readonly synchronizationIds: ReadonlyArray<string>;
  readonly bundleIds: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgePresentationFederation = {
  readonly federationId: string;
  readonly subjectId: string;
  readonly priority: RuntimeBridgeDeliveryEcosystemPriority;
  readonly federationPosture: "single_presentation" | "federated" | "review_federation" | "risk_federation";
  readonly presentationBundleIds: ReadonlyArray<string>;
  readonly continuityIds: ReadonlyArray<string>;
  readonly sequenceIds: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeBoardroomDeliveryContinuity = {
  readonly continuityId: string;
  readonly subjectId: string;
  readonly priority: RuntimeBridgeDeliveryEcosystemPriority;
  readonly continuityPosture: "brief" | "continuous" | "risk_continuity" | "hierarchy_continuity";
  readonly boardroomFlowId: string;
  readonly presentationContinuityIds: ReadonlyArray<string>;
  readonly narrativeIds: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeStrategicInsightPropagation = {
  readonly propagationId: string;
  readonly subjectId: string;
  readonly priority: RuntimeBridgeDeliveryEcosystemPriority;
  readonly propagationPosture: "contained" | "cross_presentation" | "boardroom_propagated" | "risk_propagated";
  readonly sourceThemeIds: ReadonlyArray<RuntimeBridgeDeliveryEcosystemTheme>;
  readonly continuityIds: ReadonlyArray<string>;
  readonly bundleIds: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeExecutiveDeliveryChannelMap = {
  readonly channelMapId: string;
  readonly subjectId: string;
  readonly channel: "boardroom" | "executive_briefing" | "visual_sync" | "presentation_sequence" | "continuity";
  readonly priority: RuntimeBridgeDeliveryEcosystemPriority;
  readonly refIds: ReadonlyArray<string>;
  readonly themeIds: ReadonlyArray<RuntimeBridgeDeliveryEcosystemTheme>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeEnterpriseNarrativeFlow = {
  readonly narrativeFlowId: string;
  readonly subjectId: string;
  readonly priority: RuntimeBridgeDeliveryEcosystemPriority;
  readonly narrativePosture: "linear" | "federated" | "boardroom_first" | "risk_first";
  readonly topologyId: string;
  readonly federationId: string;
  readonly continuityId: string;
  readonly propagationId: string;
  readonly channelMapIds: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeDeliveryEcosystemBundle = {
  readonly bundleId: string;
  readonly subjectId: string;
  readonly theme: RuntimeBridgeDeliveryEcosystemTheme;
  readonly priority: RuntimeBridgeDeliveryEcosystemPriority;
  readonly topologyIds: ReadonlyArray<string>;
  readonly federationIds: ReadonlyArray<string>;
  readonly channelMapIds: ReadonlyArray<string>;
  readonly sourcePresentationBundleIds: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeExecutiveDeliveryEcosystem = {
  readonly ecosystemId: string;
  readonly subjectId: string;
  readonly enterpriseDeliveryTopology: RuntimeBridgeEnterpriseDeliveryTopology;
  readonly presentationFederation: RuntimeBridgePresentationFederation;
  readonly boardroomDeliveryContinuity: RuntimeBridgeBoardroomDeliveryContinuity;
  readonly strategicInsightPropagation: RuntimeBridgeStrategicInsightPropagation;
  readonly executiveDeliveryChannelMaps: ReadonlyArray<RuntimeBridgeExecutiveDeliveryChannelMap>;
  readonly enterpriseNarrativeFlow: RuntimeBridgeEnterpriseNarrativeFlow;
  readonly deliveryEcosystemBundles: ReadonlyArray<RuntimeBridgeDeliveryEcosystemBundle>;
  readonly deliveryEcosystemPriorities: ReadonlyArray<RuntimeBridgeDeliveryEcosystemPriority>;
  readonly deliveryEcosystemThemes: ReadonlyArray<RuntimeBridgeDeliveryEcosystemTheme>;
  readonly sourcePresentationOrchestrationId: string;
  readonly metadataOnly: true;
};

export const runtimeBridgeExecutiveDeliveryEcosystemGovernance = {
  mode: "metadata_only",
  contractId: "runtime-bridge-executive-delivery-ecosystem",
  label: "Runtime bridge executive delivery ecosystem",
  description:
    "Metadata-only enterprise intelligence delivery topology, cross-presentation ecosystem coordination, executive intelligence federation metadata, boardroom delivery continuity, strategic insight propagation posture, and deterministic enterprise delivery planning.",
  confidence: "high",
  canExecute: false,
  canMutateWorkspace: false,
  canCallBackend: false,
  lineageRefs: [
    "runtime-bridge-executive-delivery-ecosystem",
    "runtime-bridge-enterprise-delivery-topology",
    "runtime-bridge-presentation-federation",
    "runtime-bridge-boardroom-delivery-continuity",
    "runtime-bridge-strategic-insight-propagation",
    "runtime-bridge-executive-delivery-channel-map",
    "runtime-bridge-enterprise-narrative-flow",
    "runtime-bridge-delivery-ecosystem-bundle",
  ],
} satisfies MetadataOnlyBoundaryContract;

export const runtimeBridgeExecutiveDeliveryEcosystemSourceModule: RuntimeBridgeSourceModuleReference = {
  moduleId: "runtime-bridge-executive-delivery-ecosystem",
  modulePath: "frontend/src/features/runtimeBridge/runtimeBridgeExecutiveDeliveryEcosystem.ts",
  capabilityMode: "metadata_only",
  label: "Runtime bridge executive delivery ecosystem",
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

const priorityScore = (priority: RuntimeBridgeDeliveryEcosystemPriority) => {
  if (priority === "critical") return 4;
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  return 1;
};

const sortPriorities = (
  priorities: ReadonlyArray<RuntimeBridgeDeliveryEcosystemPriority>,
): RuntimeBridgeDeliveryEcosystemPriority[] =>
  uniqueStable(priorities).sort((left, right) => {
    const priorityDelta = priorityScore(right) - priorityScore(left);
    if (priorityDelta !== 0) return priorityDelta;
    return left.localeCompare(right);
  });

const strongestPriority = (
  priorities: ReadonlyArray<RuntimeBridgeDeliveryEcosystemPriority>,
): RuntimeBridgeDeliveryEcosystemPriority => sortPriorities(priorities)[0] || "low";

const ecosystemTheme = (
  theme: RuntimeBridgePresentationTheme,
): RuntimeBridgeDeliveryEcosystemTheme => theme;

export const collectRuntimeBridgeDeliveryEcosystemThemes = (
  orchestration: RuntimeBridgeExecutivePresentationOrchestration,
): ReadonlyArray<RuntimeBridgeDeliveryEcosystemTheme> =>
  uniqueStable([
    ...orchestration.presentationThemes.map(ecosystemTheme),
    "enterprise_topology",
    "presentation_federation",
    "boardroom_continuity",
    "insight_propagation",
    "delivery_channel",
    "enterprise_narrative",
  ]);

export const summarizeRuntimeBridgeDeliveryEcosystemPriorities = (
  orchestration: RuntimeBridgeExecutivePresentationOrchestration,
): ReadonlyArray<RuntimeBridgeDeliveryEcosystemPriority> =>
  sortPriorities([
    ...orchestration.presentationPriorities,
    orchestration.boardroomPresentationFlow.priority,
    ...orchestration.presentationContinuity.map((continuity) => continuity.priority),
    orchestration.visualIntelligenceSynchronization.priority,
    orchestration.executiveBriefingOrchestration.priority,
    orchestration.presentationSequencePlan.priority,
    orchestration.presentationNarrative.priority,
    ...orchestration.presentationBundles.map((bundle) => bundle.priority),
  ]);

export const buildRuntimeBridgeEnterpriseDeliveryTopology = (
  orchestration: RuntimeBridgeExecutivePresentationOrchestration,
): RuntimeBridgeEnterpriseDeliveryTopology => {
  const topologyPosture: RuntimeBridgeEnterpriseDeliveryTopology["topologyPosture"] =
    orchestration.boardroomPresentationFlow.flowPosture === "risk_first"
      ? "risk_centered"
      : orchestration.boardroomPresentationFlow.flowPosture === "hierarchy_first"
        ? "boardroom_centered"
        : orchestration.presentationBundles.length > 1
          ? "multi_channel"
          : "single_channel";

  return {
    topologyId: createRuntimeBridgeId("runtime-bridge-enterprise-delivery-topology", orchestration.subjectId),
    subjectId: orchestration.subjectId,
    priority: strongestPriority(summarizeRuntimeBridgeDeliveryEcosystemPriorities(orchestration)),
    topologyPosture,
    presentationFlowIds: [orchestration.boardroomPresentationFlow.flowId],
    briefingIds: [orchestration.executiveBriefingOrchestration.briefingId],
    synchronizationIds: [orchestration.visualIntelligenceSynchronization.synchronizationId],
    bundleIds: orchestration.presentationBundles.map((bundle) => bundle.bundleId),
    summary: `Enterprise delivery topology is ${topologyPosture} across ${orchestration.presentationBundles.length} presentation bundles.`,
    metadataOnly: true,
  };
};

export const summarizeRuntimeBridgePresentationFederation = (
  orchestration: RuntimeBridgeExecutivePresentationOrchestration,
): RuntimeBridgePresentationFederation => {
  const federationPosture: RuntimeBridgePresentationFederation["federationPosture"] =
    orchestration.boardroomPresentationFlow.flowPosture === "risk_first"
      ? "risk_federation"
      : orchestration.presentationBundles.length > 2
        ? "federated"
        : orchestration.presentationContinuity.length > orchestration.presentationBundles.length
          ? "review_federation"
          : "single_presentation";

  return {
    federationId: createRuntimeBridgeId("runtime-bridge-presentation-federation", orchestration.subjectId),
    subjectId: orchestration.subjectId,
    priority: strongestPriority([
      orchestration.presentationSequencePlan.priority,
      ...orchestration.presentationBundles.map((bundle) => bundle.priority),
      ...orchestration.presentationContinuity.map((continuity) => continuity.priority),
    ]),
    federationPosture,
    presentationBundleIds: orchestration.presentationBundles.map((bundle) => bundle.bundleId),
    continuityIds: orchestration.presentationContinuity.map((continuity) => continuity.continuityId),
    sequenceIds: [orchestration.presentationSequencePlan.sequenceId],
    summary: `Presentation federation is ${federationPosture} with ${orchestration.presentationBundles.length} presentation bundles and ${orchestration.presentationContinuity.length} continuity descriptors.`,
    metadataOnly: true,
  };
};

export const buildRuntimeBridgeBoardroomDeliveryContinuity = (
  orchestration: RuntimeBridgeExecutivePresentationOrchestration,
): RuntimeBridgeBoardroomDeliveryContinuity => {
  const riskContinuity = orchestration.presentationContinuity.filter(
    (continuity) => continuity.continuityPosture === "risk_linked",
  );
  const continuityPosture: RuntimeBridgeBoardroomDeliveryContinuity["continuityPosture"] =
    riskContinuity.length > 0
      ? "risk_continuity"
      : orchestration.boardroomPresentationFlow.flowPosture === "hierarchy_first"
        ? "hierarchy_continuity"
        : orchestration.presentationContinuity.length > 1
          ? "continuous"
          : "brief";

  return {
    continuityId: createRuntimeBridgeId("runtime-bridge-boardroom-delivery-continuity", orchestration.subjectId),
    subjectId: orchestration.subjectId,
    priority: strongestPriority([
      orchestration.boardroomPresentationFlow.priority,
      ...orchestration.presentationContinuity.map((continuity) => continuity.priority),
    ]),
    continuityPosture,
    boardroomFlowId: orchestration.boardroomPresentationFlow.flowId,
    presentationContinuityIds: orchestration.presentationContinuity.map((continuity) => continuity.continuityId),
    narrativeIds: [orchestration.presentationNarrative.narrativeId],
    summary: `Boardroom delivery continuity is ${continuityPosture} across ${orchestration.presentationContinuity.length} continuity descriptors.`,
    metadataOnly: true,
  };
};

export const summarizeRuntimeBridgeStrategicInsightPropagation = (
  orchestration: RuntimeBridgeExecutivePresentationOrchestration,
): RuntimeBridgeStrategicInsightPropagation => {
  const sourceThemeIds = collectRuntimeBridgeDeliveryEcosystemThemes(orchestration);
  const propagationPosture: RuntimeBridgeStrategicInsightPropagation["propagationPosture"] =
    orchestration.boardroomPresentationFlow.flowPosture === "risk_first"
      ? "risk_propagated"
      : orchestration.boardroomPresentationFlow.flowPosture === "hierarchy_first"
        ? "boardroom_propagated"
        : orchestration.presentationBundles.length > 1
          ? "cross_presentation"
          : "contained";

  return {
    propagationId: createRuntimeBridgeId("runtime-bridge-strategic-insight-propagation", orchestration.subjectId),
    subjectId: orchestration.subjectId,
    priority: strongestPriority(summarizeRuntimeBridgeDeliveryEcosystemPriorities(orchestration)),
    propagationPosture,
    sourceThemeIds,
    continuityIds: orchestration.presentationContinuity.map((continuity) => continuity.continuityId),
    bundleIds: orchestration.presentationBundles.map((bundle) => bundle.bundleId),
    summary: `Strategic insight propagation is ${propagationPosture} across ${sourceThemeIds.length} ecosystem themes.`,
    metadataOnly: true,
  };
};

export const buildRuntimeBridgeExecutiveDeliveryChannelMaps = (
  orchestration: RuntimeBridgeExecutivePresentationOrchestration,
): ReadonlyArray<RuntimeBridgeExecutiveDeliveryChannelMap> => {
  const channelInputs: ReadonlyArray<{
    readonly channel: RuntimeBridgeExecutiveDeliveryChannelMap["channel"];
    readonly priority: RuntimeBridgeDeliveryEcosystemPriority;
    readonly refIds: ReadonlyArray<string>;
    readonly themeIds: ReadonlyArray<RuntimeBridgeDeliveryEcosystemTheme>;
  }> = [
    {
      channel: "boardroom",
      priority: orchestration.boardroomPresentationFlow.priority,
      refIds: [orchestration.boardroomPresentationFlow.flowId],
      themeIds: ["boardroom_flow"],
    },
    {
      channel: "executive_briefing",
      priority: orchestration.executiveBriefingOrchestration.priority,
      refIds: [orchestration.executiveBriefingOrchestration.briefingId],
      themeIds: ["executive_briefing"],
    },
    {
      channel: "visual_sync",
      priority: orchestration.visualIntelligenceSynchronization.priority,
      refIds: [orchestration.visualIntelligenceSynchronization.synchronizationId],
      themeIds: ["visual_synchronization"],
    },
    {
      channel: "presentation_sequence",
      priority: orchestration.presentationSequencePlan.priority,
      refIds: [orchestration.presentationSequencePlan.sequenceId],
      themeIds: ["presentation_bundle"],
    },
    {
      channel: "continuity",
      priority: strongestPriority(orchestration.presentationContinuity.map((continuity) => continuity.priority)),
      refIds: orchestration.presentationContinuity.map((continuity) => continuity.continuityId),
      themeIds: ["presentation_continuity"],
    },
  ];

  return channelInputs.map((channelInput) => ({
    channelMapId: createRuntimeBridgeId(
      "runtime-bridge-executive-delivery-channel-map",
      orchestration.subjectId,
      channelInput.channel,
    ),
    subjectId: orchestration.subjectId,
    channel: channelInput.channel,
    priority: channelInput.priority,
    refIds: channelInput.refIds,
    themeIds: channelInput.themeIds,
    summary: `${channelInput.channel} delivery channel maps ${channelInput.refIds.length} metadata references.`,
    metadataOnly: true as const,
  })).sort((left, right) => {
    const priorityDelta = priorityScore(right.priority) - priorityScore(left.priority);
    if (priorityDelta !== 0) return priorityDelta;
    return left.channelMapId.localeCompare(right.channelMapId);
  });
};

export const buildRuntimeBridgeEnterpriseNarrativeFlow = ({
  orchestration,
  topology,
  federation,
  continuity,
  propagation,
  channelMaps,
}: {
  readonly orchestration: RuntimeBridgeExecutivePresentationOrchestration;
  readonly topology: RuntimeBridgeEnterpriseDeliveryTopology;
  readonly federation: RuntimeBridgePresentationFederation;
  readonly continuity: RuntimeBridgeBoardroomDeliveryContinuity;
  readonly propagation: RuntimeBridgeStrategicInsightPropagation;
  readonly channelMaps: ReadonlyArray<RuntimeBridgeExecutiveDeliveryChannelMap>;
}): RuntimeBridgeEnterpriseNarrativeFlow => {
  const narrativePosture: RuntimeBridgeEnterpriseNarrativeFlow["narrativePosture"] =
    topology.topologyPosture === "risk_centered"
      ? "risk_first"
      : topology.topologyPosture === "boardroom_centered"
        ? "boardroom_first"
        : federation.federationPosture === "federated"
          ? "federated"
          : "linear";

  return {
    narrativeFlowId: createRuntimeBridgeId("runtime-bridge-enterprise-narrative-flow", orchestration.subjectId),
    subjectId: orchestration.subjectId,
    priority: strongestPriority([
      topology.priority,
      federation.priority,
      continuity.priority,
      propagation.priority,
      ...channelMaps.map((channelMap) => channelMap.priority),
    ]),
    narrativePosture,
    topologyId: topology.topologyId,
    federationId: federation.federationId,
    continuityId: continuity.continuityId,
    propagationId: propagation.propagationId,
    channelMapIds: channelMaps.map((channelMap) => channelMap.channelMapId),
    summary: `Enterprise narrative flow is ${narrativePosture} across topology, federation, continuity, propagation, and ${channelMaps.length} channel maps.`,
    metadataOnly: true,
  };
};

export const buildRuntimeBridgeDeliveryEcosystemBundles = ({
  orchestration,
  topology,
  federation,
  channelMaps,
}: {
  readonly orchestration: RuntimeBridgeExecutivePresentationOrchestration;
  readonly topology: RuntimeBridgeEnterpriseDeliveryTopology;
  readonly federation: RuntimeBridgePresentationFederation;
  readonly channelMaps: ReadonlyArray<RuntimeBridgeExecutiveDeliveryChannelMap>;
}): ReadonlyArray<RuntimeBridgeDeliveryEcosystemBundle> =>
  collectRuntimeBridgeDeliveryEcosystemThemes(orchestration).map((theme) => {
    const sourcePresentationBundles = orchestration.presentationBundles.filter(
      (bundle) => ecosystemTheme(bundle.theme) === theme,
    );
    const relatedChannelMaps = channelMaps.filter((channelMap) => channelMap.themeIds.includes(theme));
    const priority = strongestPriority([
      ...sourcePresentationBundles.map((bundle) => bundle.priority),
      ...relatedChannelMaps.map((channelMap) => channelMap.priority),
      theme === "enterprise_topology" ? topology.priority : "low",
      theme === "presentation_federation" ? federation.priority : "low",
    ]);

    return {
      bundleId: createRuntimeBridgeId("runtime-bridge-delivery-ecosystem-bundle", orchestration.subjectId, theme),
      subjectId: orchestration.subjectId,
      theme,
      priority,
      topologyIds: theme === "enterprise_topology" ? [topology.topologyId] : [],
      federationIds: theme === "presentation_federation" ? [federation.federationId] : [],
      channelMapIds: relatedChannelMaps.map((channelMap) => channelMap.channelMapId),
      sourcePresentationBundleIds: sourcePresentationBundles.map((bundle) => bundle.bundleId),
      summary: `${theme} delivery ecosystem bundle references ${sourcePresentationBundles.length} presentation bundles and ${relatedChannelMaps.length} channel maps.`,
      metadataOnly: true as const,
    };
  }).sort((left, right) => {
    const priorityDelta = priorityScore(right.priority) - priorityScore(left.priority);
    if (priorityDelta !== 0) return priorityDelta;
    return left.bundleId.localeCompare(right.bundleId);
  });

export const buildRuntimeBridgeExecutiveDeliveryEcosystem = (
  orchestration: RuntimeBridgeExecutivePresentationOrchestration,
): RuntimeBridgeExecutiveDeliveryEcosystem => {
  const enterpriseDeliveryTopology = buildRuntimeBridgeEnterpriseDeliveryTopology(orchestration);
  const presentationFederation = summarizeRuntimeBridgePresentationFederation(orchestration);
  const boardroomDeliveryContinuity = buildRuntimeBridgeBoardroomDeliveryContinuity(orchestration);
  const strategicInsightPropagation = summarizeRuntimeBridgeStrategicInsightPropagation(orchestration);
  const executiveDeliveryChannelMaps = buildRuntimeBridgeExecutiveDeliveryChannelMaps(orchestration);
  const enterpriseNarrativeFlow = buildRuntimeBridgeEnterpriseNarrativeFlow({
    orchestration,
    topology: enterpriseDeliveryTopology,
    federation: presentationFederation,
    continuity: boardroomDeliveryContinuity,
    propagation: strategicInsightPropagation,
    channelMaps: executiveDeliveryChannelMaps,
  });
  const deliveryEcosystemBundles = buildRuntimeBridgeDeliveryEcosystemBundles({
    orchestration,
    topology: enterpriseDeliveryTopology,
    federation: presentationFederation,
    channelMaps: executiveDeliveryChannelMaps,
  });

  return {
    ecosystemId: createRuntimeBridgeId("runtime-bridge-executive-delivery-ecosystem", orchestration.subjectId),
    subjectId: orchestration.subjectId,
    enterpriseDeliveryTopology,
    presentationFederation,
    boardroomDeliveryContinuity,
    strategicInsightPropagation,
    executiveDeliveryChannelMaps,
    enterpriseNarrativeFlow,
    deliveryEcosystemBundles,
    deliveryEcosystemPriorities: summarizeRuntimeBridgeDeliveryEcosystemPriorities(orchestration),
    deliveryEcosystemThemes: collectRuntimeBridgeDeliveryEcosystemThemes(orchestration),
    sourcePresentationOrchestrationId: orchestration.orchestrationId,
    metadataOnly: true,
  };
};
