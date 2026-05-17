import {
  buildRuntimeBridgeMetadataOnlyGovernanceDescriptor,
  buildRuntimeBridgeSourceModuleDescriptor,
  selectStrongestRuntimeBridgePriority,
  sortRuntimeBridgeBundles,
  sortRuntimeBridgePriorities,
  uniqueStable,
} from "./_kernel";
import type {
  RuntimeBridgeEnterpriseIntelligenceFederation,
  RuntimeBridgeFederationPriority,
  RuntimeBridgeFederationTheme,
} from "./runtimeBridgeEnterpriseIntelligenceFederation";
import { createRuntimeBridgeId } from "./runtimeBridgeIds";

export type RuntimeBridgeLifecyclePriority = RuntimeBridgeFederationPriority;

export type RuntimeBridgeLifecycleTheme =
  | RuntimeBridgeFederationTheme
  | "lifecycle_stage"
  | "cross_session_lineage"
  | "strategic_archive"
  | "organizational_evolution"
  | "ecosystem_resilience"
  | "lifecycle_narrative"
  | "lifecycle_bundle";

export type RuntimeBridgeLifecycleStageMap = {
  readonly stageMapId: string;
  readonly subjectId: string;
  readonly priority: RuntimeBridgeLifecyclePriority;
  readonly lifecyclePosture: "early" | "federated" | "mature" | "risk_review";
  readonly federationTopologyIds: ReadonlyArray<string>;
  readonly continuityMapIds: ReadonlyArray<string>;
  readonly narrativeFlowIds: ReadonlyArray<string>;
  readonly stageThemeIds: ReadonlyArray<RuntimeBridgeLifecycleTheme>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeCrossSessionFederationLineage = {
  readonly lineageId: string;
  readonly subjectId: string;
  readonly priority: RuntimeBridgeLifecyclePriority;
  readonly lineagePosture: "session_agnostic" | "cross_session_reference" | "federated_lineage" | "risk_lineage";
  readonly sourceFederationId: string;
  readonly topologyIds: ReadonlyArray<string>;
  readonly propagationIds: ReadonlyArray<string>;
  readonly synchronizationIds: ReadonlyArray<string>;
  readonly canRestoreSession: false;
  readonly canPersistMemory: false;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeStrategicArchivePosture = {
  readonly archivePostureId: string;
  readonly subjectId: string;
  readonly priority: RuntimeBridgeLifecyclePriority;
  readonly archivePosture: "not_persisted" | "archive_ready" | "review_archive" | "risk_archive";
  readonly sourceFederationId: string;
  readonly archiveCandidateIds: ReadonlyArray<string>;
  readonly canWriteStorage: false;
  readonly canPersistMemory: false;
  readonly canRestoreSession: false;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeOrganizationalIntelligenceEvolution = {
  readonly evolutionId: string;
  readonly subjectId: string;
  readonly priority: RuntimeBridgeLifecyclePriority;
  readonly evolutionPosture: "stable" | "developing" | "federated" | "risk_sensitive";
  readonly sourceBundleIds: ReadonlyArray<string>;
  readonly continuityIds: ReadonlyArray<string>;
  readonly themeIds: ReadonlyArray<RuntimeBridgeLifecycleTheme>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeInsightEcosystemResilience = {
  readonly resilienceId: string;
  readonly subjectId: string;
  readonly priority: RuntimeBridgeLifecyclePriority;
  readonly resiliencePosture: "limited" | "stable" | "resilient" | "risk_resilient";
  readonly continuityIds: ReadonlyArray<string>;
  readonly synchronizationIds: ReadonlyArray<string>;
  readonly topologyContinuityIds: ReadonlyArray<string>;
  readonly bundleIds: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeLifecycleNarrativeFlow = {
  readonly narrativeFlowId: string;
  readonly subjectId: string;
  readonly priority: RuntimeBridgeLifecyclePriority;
  readonly narrativePosture: "linear" | "continuity_first" | "federation_first" | "risk_first";
  readonly stageMapId: string;
  readonly crossSessionLineageId: string;
  readonly strategicArchivePostureId: string;
  readonly organizationalEvolutionId: string;
  readonly ecosystemResilienceId: string;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeLifecycleContinuityBundle = {
  readonly bundleId: string;
  readonly subjectId: string;
  readonly theme: RuntimeBridgeLifecycleTheme;
  readonly priority: RuntimeBridgeLifecyclePriority;
  readonly stageMapIds: ReadonlyArray<string>;
  readonly lineageIds: ReadonlyArray<string>;
  readonly archivePostureIds: ReadonlyArray<string>;
  readonly evolutionIds: ReadonlyArray<string>;
  readonly resilienceIds: ReadonlyArray<string>;
  readonly sourceFederationBundleIds: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeEnterpriseLifecycleContinuity = {
  readonly lifecycleContinuityId: string;
  readonly subjectId: string;
  readonly lifecycleStageMap: RuntimeBridgeLifecycleStageMap;
  readonly crossSessionFederationLineage: RuntimeBridgeCrossSessionFederationLineage;
  readonly strategicArchivePosture: RuntimeBridgeStrategicArchivePosture;
  readonly organizationalIntelligenceEvolution: RuntimeBridgeOrganizationalIntelligenceEvolution;
  readonly insightEcosystemResilience: RuntimeBridgeInsightEcosystemResilience;
  readonly lifecycleNarrativeFlow: RuntimeBridgeLifecycleNarrativeFlow;
  readonly lifecycleContinuityBundles: ReadonlyArray<RuntimeBridgeLifecycleContinuityBundle>;
  readonly lifecyclePriorities: ReadonlyArray<RuntimeBridgeLifecyclePriority>;
  readonly lifecycleThemes: ReadonlyArray<RuntimeBridgeLifecycleTheme>;
  readonly sourceFederationId: string;
  readonly metadataOnly: true;
};

export const runtimeBridgeEnterpriseLifecycleContinuityGovernance = buildRuntimeBridgeMetadataOnlyGovernanceDescriptor({
  contractId: "runtime-bridge-enterprise-lifecycle-continuity",
  label: "Runtime bridge enterprise lifecycle continuity",
  description:
    "Metadata-only enterprise intelligence lifecycle tracking, cross-session federation lineage metadata, strategic intelligence archival posture, organizational intelligence evolution descriptors, enterprise insight ecosystem resilience metadata, and deterministic lifecycle continuity planning.",
  lineageRefs: [
    "runtime-bridge-enterprise-lifecycle-continuity",
    "runtime-bridge-lifecycle-stage-map",
    "runtime-bridge-cross-session-federation-lineage",
    "runtime-bridge-strategic-archive-posture",
    "runtime-bridge-organizational-intelligence-evolution",
    "runtime-bridge-insight-ecosystem-resilience",
    "runtime-bridge-lifecycle-narrative-flow",
    "runtime-bridge-lifecycle-continuity-bundle",
  ],
});

export const runtimeBridgeEnterpriseLifecycleContinuitySourceModule = buildRuntimeBridgeSourceModuleDescriptor({
  moduleId: "runtime-bridge-enterprise-lifecycle-continuity",
  modulePath: "frontend/src/features/runtimeBridge/runtimeBridgeEnterpriseLifecycleContinuity.ts",
  label: "Runtime bridge enterprise lifecycle continuity",
});

const strongestPriority = (
  priorities: ReadonlyArray<RuntimeBridgeLifecyclePriority>,
): RuntimeBridgeLifecyclePriority => selectStrongestRuntimeBridgePriority(priorities, "low");

const lifecycleTheme = (theme: RuntimeBridgeFederationTheme): RuntimeBridgeLifecycleTheme => theme;

export const collectRuntimeBridgeLifecycleThemes = (
  federation: RuntimeBridgeEnterpriseIntelligenceFederation,
): ReadonlyArray<RuntimeBridgeLifecycleTheme> =>
  uniqueStable([
    ...federation.federationThemes.map(lifecycleTheme),
    "lifecycle_stage",
    "cross_session_lineage",
    "strategic_archive",
    "organizational_evolution",
    "ecosystem_resilience",
    "lifecycle_narrative",
    "lifecycle_bundle",
  ]);

export const summarizeRuntimeBridgeLifecyclePriorities = (
  federation: RuntimeBridgeEnterpriseIntelligenceFederation,
): ReadonlyArray<RuntimeBridgeLifecyclePriority> =>
  sortRuntimeBridgePriorities([
    ...federation.federationPriorities,
    federation.federationTopology.priority,
    federation.boardroomContinuityMap.priority,
    federation.intelligenceLineagePropagation.priority,
    federation.enterpriseInsightSynchronization.priority,
    federation.strategicTopologyContinuity.priority,
    federation.federationNarrativeFlow.priority,
    ...federation.federationBundles.map((bundle) => bundle.priority),
  ]);

export const buildRuntimeBridgeLifecycleStageMap = (
  federation: RuntimeBridgeEnterpriseIntelligenceFederation,
): RuntimeBridgeLifecycleStageMap => {
  const lifecyclePosture: RuntimeBridgeLifecycleStageMap["lifecyclePosture"] =
    federation.federationTopology.topologyPosture === "risk_federated"
      ? "risk_review"
      : federation.strategicTopologyContinuity.topologyContinuityPosture === "boardroom_continuity"
        ? "mature"
        : federation.federationTopology.topologyPosture === "federated_ecosystem"
          ? "federated"
          : "early";

  return {
    stageMapId: createRuntimeBridgeId("runtime-bridge-lifecycle-stage-map", federation.subjectId),
    subjectId: federation.subjectId,
    priority: strongestPriority(summarizeRuntimeBridgeLifecyclePriorities(federation)),
    lifecyclePosture,
    federationTopologyIds: [federation.federationTopology.topologyId],
    continuityMapIds: [federation.boardroomContinuityMap.continuityMapId],
    narrativeFlowIds: [federation.federationNarrativeFlow.narrativeFlowId],
    stageThemeIds: collectRuntimeBridgeLifecycleThemes(federation),
    summary: `Lifecycle stage map is ${lifecyclePosture} across ${federation.federationBundles.length} federation bundles.`,
    metadataOnly: true,
  };
};

export const summarizeRuntimeBridgeCrossSessionFederationLineage = (
  federation: RuntimeBridgeEnterpriseIntelligenceFederation,
): RuntimeBridgeCrossSessionFederationLineage => {
  const lineagePosture: RuntimeBridgeCrossSessionFederationLineage["lineagePosture"] =
    federation.intelligenceLineagePropagation.propagationPosture === "risk_lineage"
      ? "risk_lineage"
      : federation.federationTopology.topologyPosture === "federated_ecosystem"
        ? "federated_lineage"
        : federation.boardroomContinuityMap.continuityPosture === "multi_boardroom"
          ? "cross_session_reference"
          : "session_agnostic";

  return {
    lineageId: createRuntimeBridgeId("runtime-bridge-cross-session-federation-lineage", federation.subjectId),
    subjectId: federation.subjectId,
    priority: federation.intelligenceLineagePropagation.priority,
    lineagePosture,
    sourceFederationId: federation.federationId,
    topologyIds: federation.intelligenceLineagePropagation.topologyIds,
    propagationIds: [federation.intelligenceLineagePropagation.lineagePropagationId],
    synchronizationIds: [federation.enterpriseInsightSynchronization.synchronizationId],
    canRestoreSession: false,
    canPersistMemory: false,
    summary: `Cross-session federation lineage is ${lineagePosture}; it describes lineage continuity without restoring sessions or persisting memory.`,
    metadataOnly: true,
  };
};

export const summarizeRuntimeBridgeStrategicArchivePosture = (
  federation: RuntimeBridgeEnterpriseIntelligenceFederation,
): RuntimeBridgeStrategicArchivePosture => {
  const archivePosture: RuntimeBridgeStrategicArchivePosture["archivePosture"] =
    federation.federationTopology.topologyPosture === "risk_federated"
      ? "risk_archive"
      : federation.boardroomContinuityMap.continuityPosture === "boardroom_continuous"
        ? "review_archive"
        : federation.federationBundles.length > 1
          ? "archive_ready"
          : "not_persisted";

  return {
    archivePostureId: createRuntimeBridgeId("runtime-bridge-strategic-archive-posture", federation.subjectId),
    subjectId: federation.subjectId,
    priority: strongestPriority([
      federation.federationTopology.priority,
      federation.boardroomContinuityMap.priority,
      ...federation.federationBundles.map((bundle) => bundle.priority),
    ]),
    archivePosture,
    sourceFederationId: federation.federationId,
    archiveCandidateIds: [
      federation.federationTopology.topologyId,
      federation.boardroomContinuityMap.continuityMapId,
      federation.strategicTopologyContinuity.continuityId,
      federation.federationNarrativeFlow.narrativeFlowId,
    ],
    canWriteStorage: false,
    canPersistMemory: false,
    canRestoreSession: false,
    summary: `Strategic archive posture is ${archivePosture}; it is descriptive only and cannot write storage, persist memory, or restore sessions.`,
    metadataOnly: true,
  };
};

export const buildRuntimeBridgeOrganizationalIntelligenceEvolution = (
  federation: RuntimeBridgeEnterpriseIntelligenceFederation,
): RuntimeBridgeOrganizationalIntelligenceEvolution => {
  const evolutionPosture: RuntimeBridgeOrganizationalIntelligenceEvolution["evolutionPosture"] =
    federation.federationTopology.topologyPosture === "risk_federated"
      ? "risk_sensitive"
      : federation.federationTopology.topologyPosture === "federated_ecosystem"
        ? "federated"
        : federation.federationBundles.length > 2
          ? "developing"
          : "stable";

  return {
    evolutionId: createRuntimeBridgeId("runtime-bridge-organizational-intelligence-evolution", federation.subjectId),
    subjectId: federation.subjectId,
    priority: strongestPriority([
      federation.federationTopology.priority,
      federation.strategicTopologyContinuity.priority,
      ...federation.federationBundles.map((bundle) => bundle.priority),
    ]),
    evolutionPosture,
    sourceBundleIds: federation.federationBundles.map((bundle) => bundle.bundleId),
    continuityIds: [federation.strategicTopologyContinuity.continuityId],
    themeIds: collectRuntimeBridgeLifecycleThemes(federation),
    summary: `Organizational intelligence evolution is ${evolutionPosture} across ${federation.federationBundles.length} federation bundles.`,
    metadataOnly: true,
  };
};

export const summarizeRuntimeBridgeInsightEcosystemResilience = (
  federation: RuntimeBridgeEnterpriseIntelligenceFederation,
): RuntimeBridgeInsightEcosystemResilience => {
  const resiliencePosture: RuntimeBridgeInsightEcosystemResilience["resiliencePosture"] =
    federation.federationTopology.topologyPosture === "risk_federated"
      ? "risk_resilient"
      : federation.enterpriseInsightSynchronization.synchronizationPosture === "federated_sync"
        ? "resilient"
        : federation.boardroomContinuityMap.continuityPosture === "multi_boardroom"
          ? "stable"
          : "limited";

  return {
    resilienceId: createRuntimeBridgeId("runtime-bridge-insight-ecosystem-resilience", federation.subjectId),
    subjectId: federation.subjectId,
    priority: strongestPriority([
      federation.enterpriseInsightSynchronization.priority,
      federation.strategicTopologyContinuity.priority,
      federation.boardroomContinuityMap.priority,
    ]),
    resiliencePosture,
    continuityIds: [
      federation.boardroomContinuityMap.continuityMapId,
      federation.strategicTopologyContinuity.continuityId,
    ],
    synchronizationIds: [federation.enterpriseInsightSynchronization.synchronizationId],
    topologyContinuityIds: [federation.strategicTopologyContinuity.continuityId],
    bundleIds: federation.federationBundles.map((bundle) => bundle.bundleId),
    summary: `Insight ecosystem resilience is ${resiliencePosture} across continuity and synchronization metadata.`,
    metadataOnly: true,
  };
};

export const buildRuntimeBridgeLifecycleNarrativeFlow = ({
  federation,
  stageMap,
  crossSessionLineage,
  strategicArchivePosture,
  organizationalEvolution,
  ecosystemResilience,
}: {
  readonly federation: RuntimeBridgeEnterpriseIntelligenceFederation;
  readonly stageMap: RuntimeBridgeLifecycleStageMap;
  readonly crossSessionLineage: RuntimeBridgeCrossSessionFederationLineage;
  readonly strategicArchivePosture: RuntimeBridgeStrategicArchivePosture;
  readonly organizationalEvolution: RuntimeBridgeOrganizationalIntelligenceEvolution;
  readonly ecosystemResilience: RuntimeBridgeInsightEcosystemResilience;
}): RuntimeBridgeLifecycleNarrativeFlow => {
  const narrativePosture: RuntimeBridgeLifecycleNarrativeFlow["narrativePosture"] =
    stageMap.lifecyclePosture === "risk_review"
      ? "risk_first"
      : ecosystemResilience.resiliencePosture === "resilient"
        ? "continuity_first"
        : crossSessionLineage.lineagePosture === "federated_lineage"
          ? "federation_first"
          : "linear";

  return {
    narrativeFlowId: createRuntimeBridgeId("runtime-bridge-lifecycle-narrative-flow", federation.subjectId),
    subjectId: federation.subjectId,
    priority: strongestPriority([
      stageMap.priority,
      crossSessionLineage.priority,
      strategicArchivePosture.priority,
      organizationalEvolution.priority,
      ecosystemResilience.priority,
    ]),
    narrativePosture,
    stageMapId: stageMap.stageMapId,
    crossSessionLineageId: crossSessionLineage.lineageId,
    strategicArchivePostureId: strategicArchivePosture.archivePostureId,
    organizationalEvolutionId: organizationalEvolution.evolutionId,
    ecosystemResilienceId: ecosystemResilience.resilienceId,
    summary: `Lifecycle narrative flow is ${narrativePosture} across stage mapping, lineage, archive posture, organizational evolution, and ecosystem resilience metadata.`,
    metadataOnly: true,
  };
};

export const buildRuntimeBridgeLifecycleContinuityBundles = ({
  federation,
  stageMap,
  crossSessionLineage,
  strategicArchivePosture,
  organizationalEvolution,
  ecosystemResilience,
}: {
  readonly federation: RuntimeBridgeEnterpriseIntelligenceFederation;
  readonly stageMap: RuntimeBridgeLifecycleStageMap;
  readonly crossSessionLineage: RuntimeBridgeCrossSessionFederationLineage;
  readonly strategicArchivePosture: RuntimeBridgeStrategicArchivePosture;
  readonly organizationalEvolution: RuntimeBridgeOrganizationalIntelligenceEvolution;
  readonly ecosystemResilience: RuntimeBridgeInsightEcosystemResilience;
}): ReadonlyArray<RuntimeBridgeLifecycleContinuityBundle> =>
  sortRuntimeBridgeBundles(collectRuntimeBridgeLifecycleThemes(federation).map((theme) => {
    const sourceBundles = federation.federationBundles.filter(
      (bundle) => lifecycleTheme(bundle.theme) === theme,
    );
    const priority = strongestPriority([
      ...sourceBundles.map((bundle) => bundle.priority),
      theme === "lifecycle_stage" ? stageMap.priority : "low",
      theme === "cross_session_lineage" ? crossSessionLineage.priority : "low",
      theme === "strategic_archive" ? strategicArchivePosture.priority : "low",
      theme === "organizational_evolution" ? organizationalEvolution.priority : "low",
      theme === "ecosystem_resilience" ? ecosystemResilience.priority : "low",
    ]);

    return {
      bundleId: createRuntimeBridgeId("runtime-bridge-lifecycle-continuity-bundle", federation.subjectId, theme),
      subjectId: federation.subjectId,
      theme,
      priority,
      stageMapIds: theme === "lifecycle_stage" ? [stageMap.stageMapId] : [],
      lineageIds: theme === "cross_session_lineage" ? [crossSessionLineage.lineageId] : [],
      archivePostureIds: theme === "strategic_archive" ? [strategicArchivePosture.archivePostureId] : [],
      evolutionIds: theme === "organizational_evolution" ? [organizationalEvolution.evolutionId] : [],
      resilienceIds: theme === "ecosystem_resilience" ? [ecosystemResilience.resilienceId] : [],
      sourceFederationBundleIds: sourceBundles.map((bundle) => bundle.bundleId),
      summary: `${theme} lifecycle continuity bundle references ${sourceBundles.length} federation bundles.`,
      metadataOnly: true as const,
    };
  }));

export const buildRuntimeBridgeEnterpriseLifecycleContinuity = (
  federation: RuntimeBridgeEnterpriseIntelligenceFederation,
): RuntimeBridgeEnterpriseLifecycleContinuity => {
  const lifecycleStageMap = buildRuntimeBridgeLifecycleStageMap(federation);
  const crossSessionFederationLineage = summarizeRuntimeBridgeCrossSessionFederationLineage(federation);
  const strategicArchivePosture = summarizeRuntimeBridgeStrategicArchivePosture(federation);
  const organizationalIntelligenceEvolution = buildRuntimeBridgeOrganizationalIntelligenceEvolution(federation);
  const insightEcosystemResilience = summarizeRuntimeBridgeInsightEcosystemResilience(federation);
  const lifecycleNarrativeFlow = buildRuntimeBridgeLifecycleNarrativeFlow({
    federation,
    stageMap: lifecycleStageMap,
    crossSessionLineage: crossSessionFederationLineage,
    strategicArchivePosture,
    organizationalEvolution: organizationalIntelligenceEvolution,
    ecosystemResilience: insightEcosystemResilience,
  });
  const lifecycleContinuityBundles = buildRuntimeBridgeLifecycleContinuityBundles({
    federation,
    stageMap: lifecycleStageMap,
    crossSessionLineage: crossSessionFederationLineage,
    strategicArchivePosture,
    organizationalEvolution: organizationalIntelligenceEvolution,
    ecosystemResilience: insightEcosystemResilience,
  });

  return {
    lifecycleContinuityId: createRuntimeBridgeId(
      "runtime-bridge-enterprise-lifecycle-continuity",
      federation.subjectId,
    ),
    subjectId: federation.subjectId,
    lifecycleStageMap,
    crossSessionFederationLineage,
    strategicArchivePosture,
    organizationalIntelligenceEvolution,
    insightEcosystemResilience,
    lifecycleNarrativeFlow,
    lifecycleContinuityBundles,
    lifecyclePriorities: summarizeRuntimeBridgeLifecyclePriorities(federation),
    lifecycleThemes: collectRuntimeBridgeLifecycleThemes(federation),
    sourceFederationId: federation.federationId,
    metadataOnly: true,
  };
};
