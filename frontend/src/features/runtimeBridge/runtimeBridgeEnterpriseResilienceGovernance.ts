import type { MetadataOnlyBoundaryContract } from "../governance/boundaryTypes";
import type {
  RuntimeBridgeEnterpriseLifecycleContinuity,
  RuntimeBridgeLifecyclePriority,
  RuntimeBridgeLifecycleTheme,
} from "./runtimeBridgeEnterpriseLifecycleContinuity";
import { createRuntimeBridgeId } from "./runtimeBridgeIds";
import type { RuntimeBridgeSourceModuleReference } from "./runtimeBridgeTypes";

export type RuntimeBridgeResiliencePriority = RuntimeBridgeLifecyclePriority;

export type RuntimeBridgeResilienceTheme =
  | RuntimeBridgeLifecycleTheme
  | "continuity_governance"
  | "intelligence_survivability"
  | "continuity_audit_readiness"
  | "federation_resilience"
  | "executive_continuity_governance"
  | "resilience_continuity_flow"
  | "resilience_governance_bundle";

export type RuntimeBridgeContinuityGovernanceMap = {
  readonly governanceMapId: string;
  readonly subjectId: string;
  readonly priority: RuntimeBridgeResiliencePriority;
  readonly continuityGovernancePosture: "baseline" | "governed" | "mature" | "risk_review";
  readonly lifecycleStageMapIds: ReadonlyArray<string>;
  readonly lifecycleNarrativeFlowIds: ReadonlyArray<string>;
  readonly continuityBundleIds: ReadonlyArray<string>;
  readonly governanceThemeIds: ReadonlyArray<RuntimeBridgeResilienceTheme>;
  readonly canMutateRuntimeState: false;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeIntelligenceSurvivability = {
  readonly survivabilityId: string;
  readonly subjectId: string;
  readonly priority: RuntimeBridgeResiliencePriority;
  readonly survivabilityPosture: "limited" | "durable" | "federated" | "risk_sensitive";
  readonly resilienceIds: ReadonlyArray<string>;
  readonly lineageIds: ReadonlyArray<string>;
  readonly archivePostureIds: ReadonlyArray<string>;
  readonly canPersistMemory: false;
  readonly canWriteStorage: false;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeContinuityAuditReadiness = {
  readonly auditReadinessId: string;
  readonly subjectId: string;
  readonly priority: RuntimeBridgeResiliencePriority;
  readonly auditReadinessPosture: "descriptive" | "review_ready" | "governance_ready" | "risk_review";
  readonly governanceMapId: string;
  readonly archivePostureIds: ReadonlyArray<string>;
  readonly lifecycleBundleIds: ReadonlyArray<string>;
  readonly canPersistMemory: false;
  readonly canRestoreSession: false;
  readonly canWriteStorage: false;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeFederationResilienceTopology = {
  readonly topologyId: string;
  readonly subjectId: string;
  readonly priority: RuntimeBridgeResiliencePriority;
  readonly topologyPosture: "single_lifecycle" | "continuity_mapped" | "federated_resilience" | "risk_resilience";
  readonly sourceFederationId: string;
  readonly lifecycleContinuityIds: ReadonlyArray<string>;
  readonly continuityGovernanceMapIds: ReadonlyArray<string>;
  readonly survivabilityIds: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeExecutiveContinuityNarrative = {
  readonly narrativeId: string;
  readonly subjectId: string;
  readonly priority: RuntimeBridgeResiliencePriority;
  readonly narrativePosture: "lifecycle_summary" | "governance_first" | "durability_first" | "risk_first";
  readonly governanceMapId: string;
  readonly survivabilityId: string;
  readonly auditReadinessId: string;
  readonly topologyId: string;
  readonly executiveThemeIds: ReadonlyArray<RuntimeBridgeResilienceTheme>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeResilienceContinuityFlow = {
  readonly flowId: string;
  readonly subjectId: string;
  readonly priority: RuntimeBridgeResiliencePriority;
  readonly flowPosture: "linear" | "governance_led" | "federation_led" | "risk_led";
  readonly governanceMapId: string;
  readonly survivabilityId: string;
  readonly auditReadinessId: string;
  readonly topologyId: string;
  readonly narrativeId: string;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeResilienceGovernanceBundle = {
  readonly bundleId: string;
  readonly subjectId: string;
  readonly theme: RuntimeBridgeResilienceTheme;
  readonly priority: RuntimeBridgeResiliencePriority;
  readonly governanceMapIds: ReadonlyArray<string>;
  readonly survivabilityIds: ReadonlyArray<string>;
  readonly auditReadinessIds: ReadonlyArray<string>;
  readonly topologyIds: ReadonlyArray<string>;
  readonly narrativeIds: ReadonlyArray<string>;
  readonly sourceLifecycleBundleIds: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeEnterpriseResilienceGovernance = {
  readonly resilienceGovernanceId: string;
  readonly subjectId: string;
  readonly continuityGovernanceMap: RuntimeBridgeContinuityGovernanceMap;
  readonly intelligenceSurvivability: RuntimeBridgeIntelligenceSurvivability;
  readonly continuityAuditReadiness: RuntimeBridgeContinuityAuditReadiness;
  readonly federationResilienceTopology: RuntimeBridgeFederationResilienceTopology;
  readonly executiveContinuityNarrative: RuntimeBridgeExecutiveContinuityNarrative;
  readonly resilienceContinuityFlow: RuntimeBridgeResilienceContinuityFlow;
  readonly resilienceGovernanceBundles: ReadonlyArray<RuntimeBridgeResilienceGovernanceBundle>;
  readonly resiliencePriorities: ReadonlyArray<RuntimeBridgeResiliencePriority>;
  readonly resilienceThemes: ReadonlyArray<RuntimeBridgeResilienceTheme>;
  readonly sourceLifecycleContinuityId: string;
  readonly metadataOnly: true;
};

export const runtimeBridgeEnterpriseResilienceGovernanceGovernance = {
  mode: "metadata_only",
  contractId: "runtime-bridge-enterprise-resilience-governance",
  label: "Runtime bridge enterprise resilience governance",
  description:
    "Metadata-only resilience governance descriptors, enterprise continuity posture metadata, intelligence survivability summaries, continuity audit-readiness descriptors, federation resilience mapping, executive continuity governance narratives, and deterministic resilience continuity planning.",
  confidence: "high",
  canExecute: false,
  canMutateWorkspace: false,
  canCallBackend: false,
  lineageRefs: [
    "runtime-bridge-enterprise-resilience-governance",
    "runtime-bridge-continuity-governance-map",
    "runtime-bridge-intelligence-survivability",
    "runtime-bridge-continuity-audit-readiness",
    "runtime-bridge-federation-resilience-topology",
    "runtime-bridge-executive-continuity-narrative",
    "runtime-bridge-resilience-continuity-flow",
    "runtime-bridge-resilience-governance-bundle",
  ],
} satisfies MetadataOnlyBoundaryContract;

export const runtimeBridgeEnterpriseResilienceGovernanceSourceModule: RuntimeBridgeSourceModuleReference = {
  moduleId: "runtime-bridge-enterprise-resilience-governance",
  modulePath: "frontend/src/features/runtimeBridge/runtimeBridgeEnterpriseResilienceGovernance.ts",
  capabilityMode: "metadata_only",
  label: "Runtime bridge enterprise resilience governance",
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

const priorityScore = (priority: RuntimeBridgeResiliencePriority) => {
  if (priority === "critical") return 4;
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  return 1;
};

const sortPriorities = (
  priorities: ReadonlyArray<RuntimeBridgeResiliencePriority>,
): RuntimeBridgeResiliencePriority[] =>
  uniqueStable(priorities).sort((left, right) => {
    const priorityDelta = priorityScore(right) - priorityScore(left);
    if (priorityDelta !== 0) return priorityDelta;
    return left.localeCompare(right);
  });

const strongestPriority = (
  priorities: ReadonlyArray<RuntimeBridgeResiliencePriority>,
): RuntimeBridgeResiliencePriority => sortPriorities(priorities)[0] || "low";

const resilienceTheme = (theme: RuntimeBridgeLifecycleTheme): RuntimeBridgeResilienceTheme => theme;

export const collectRuntimeBridgeResilienceThemes = (
  continuity: RuntimeBridgeEnterpriseLifecycleContinuity,
): ReadonlyArray<RuntimeBridgeResilienceTheme> =>
  uniqueStable([
    ...continuity.lifecycleThemes.map(resilienceTheme),
    "continuity_governance",
    "intelligence_survivability",
    "continuity_audit_readiness",
    "federation_resilience",
    "executive_continuity_governance",
    "resilience_continuity_flow",
    "resilience_governance_bundle",
  ]);

export const summarizeRuntimeBridgeResiliencePriorities = (
  continuity: RuntimeBridgeEnterpriseLifecycleContinuity,
): ReadonlyArray<RuntimeBridgeResiliencePriority> =>
  sortPriorities([
    ...continuity.lifecyclePriorities,
    continuity.lifecycleStageMap.priority,
    continuity.crossSessionFederationLineage.priority,
    continuity.strategicArchivePosture.priority,
    continuity.organizationalIntelligenceEvolution.priority,
    continuity.insightEcosystemResilience.priority,
    continuity.lifecycleNarrativeFlow.priority,
    ...continuity.lifecycleContinuityBundles.map((bundle) => bundle.priority),
  ]);

export const buildRuntimeBridgeContinuityGovernanceMap = (
  continuity: RuntimeBridgeEnterpriseLifecycleContinuity,
): RuntimeBridgeContinuityGovernanceMap => {
  const continuityGovernancePosture: RuntimeBridgeContinuityGovernanceMap["continuityGovernancePosture"] =
    continuity.lifecycleStageMap.lifecyclePosture === "risk_review"
      ? "risk_review"
      : continuity.lifecycleStageMap.lifecyclePosture === "mature"
        ? "mature"
        : continuity.lifecycleContinuityBundles.length > 2
          ? "governed"
          : "baseline";

  return {
    governanceMapId: createRuntimeBridgeId("runtime-bridge-continuity-governance-map", continuity.subjectId),
    subjectId: continuity.subjectId,
    priority: strongestPriority(summarizeRuntimeBridgeResiliencePriorities(continuity)),
    continuityGovernancePosture,
    lifecycleStageMapIds: [continuity.lifecycleStageMap.stageMapId],
    lifecycleNarrativeFlowIds: [continuity.lifecycleNarrativeFlow.narrativeFlowId],
    continuityBundleIds: continuity.lifecycleContinuityBundles.map((bundle) => bundle.bundleId),
    governanceThemeIds: collectRuntimeBridgeResilienceThemes(continuity),
    canMutateRuntimeState: false,
    summary: `Continuity governance map is ${continuityGovernancePosture} across ${continuity.lifecycleContinuityBundles.length} lifecycle continuity bundles.`,
    metadataOnly: true,
  };
};

export const summarizeRuntimeBridgeIntelligenceSurvivability = (
  continuity: RuntimeBridgeEnterpriseLifecycleContinuity,
): RuntimeBridgeIntelligenceSurvivability => {
  const survivabilityPosture: RuntimeBridgeIntelligenceSurvivability["survivabilityPosture"] =
    continuity.insightEcosystemResilience.resiliencePosture === "risk_resilient"
      ? "risk_sensitive"
      : continuity.crossSessionFederationLineage.lineagePosture === "federated_lineage"
        ? "federated"
        : continuity.insightEcosystemResilience.resiliencePosture === "resilient"
          ? "durable"
          : "limited";

  return {
    survivabilityId: createRuntimeBridgeId("runtime-bridge-intelligence-survivability", continuity.subjectId),
    subjectId: continuity.subjectId,
    priority: strongestPriority([
      continuity.insightEcosystemResilience.priority,
      continuity.crossSessionFederationLineage.priority,
      continuity.strategicArchivePosture.priority,
    ]),
    survivabilityPosture,
    resilienceIds: [continuity.insightEcosystemResilience.resilienceId],
    lineageIds: [continuity.crossSessionFederationLineage.lineageId],
    archivePostureIds: [continuity.strategicArchivePosture.archivePostureId],
    canPersistMemory: false,
    canWriteStorage: false,
    summary: `Intelligence survivability is ${survivabilityPosture}; it describes durability posture without persisting memory or writing storage.`,
    metadataOnly: true,
  };
};

export const summarizeRuntimeBridgeContinuityAuditReadiness = ({
  continuity,
  governanceMap,
}: {
  readonly continuity: RuntimeBridgeEnterpriseLifecycleContinuity;
  readonly governanceMap: RuntimeBridgeContinuityGovernanceMap;
}): RuntimeBridgeContinuityAuditReadiness => {
  const auditReadinessPosture: RuntimeBridgeContinuityAuditReadiness["auditReadinessPosture"] =
    governanceMap.continuityGovernancePosture === "risk_review"
      ? "risk_review"
      : continuity.strategicArchivePosture.archivePosture === "review_archive"
        ? "governance_ready"
        : continuity.strategicArchivePosture.archivePosture === "archive_ready"
          ? "review_ready"
          : "descriptive";

  return {
    auditReadinessId: createRuntimeBridgeId("runtime-bridge-continuity-audit-readiness", continuity.subjectId),
    subjectId: continuity.subjectId,
    priority: strongestPriority([governanceMap.priority, continuity.strategicArchivePosture.priority]),
    auditReadinessPosture,
    governanceMapId: governanceMap.governanceMapId,
    archivePostureIds: [continuity.strategicArchivePosture.archivePostureId],
    lifecycleBundleIds: continuity.lifecycleContinuityBundles.map((bundle) => bundle.bundleId),
    canPersistMemory: false,
    canRestoreSession: false,
    canWriteStorage: false,
    summary: `Continuity audit readiness is ${auditReadinessPosture}; it is audit metadata only and cannot persist memory, restore sessions, or write storage.`,
    metadataOnly: true,
  };
};

export const buildRuntimeBridgeFederationResilienceTopology = ({
  continuity,
  governanceMap,
  survivability,
}: {
  readonly continuity: RuntimeBridgeEnterpriseLifecycleContinuity;
  readonly governanceMap: RuntimeBridgeContinuityGovernanceMap;
  readonly survivability: RuntimeBridgeIntelligenceSurvivability;
}): RuntimeBridgeFederationResilienceTopology => {
  const topologyPosture: RuntimeBridgeFederationResilienceTopology["topologyPosture"] =
    governanceMap.continuityGovernancePosture === "risk_review"
      ? "risk_resilience"
      : survivability.survivabilityPosture === "federated"
        ? "federated_resilience"
        : continuity.lifecycleStageMap.lifecyclePosture === "mature"
          ? "continuity_mapped"
          : "single_lifecycle";

  return {
    topologyId: createRuntimeBridgeId("runtime-bridge-federation-resilience-topology", continuity.subjectId),
    subjectId: continuity.subjectId,
    priority: strongestPriority([governanceMap.priority, survivability.priority]),
    topologyPosture,
    sourceFederationId: continuity.sourceFederationId,
    lifecycleContinuityIds: [continuity.lifecycleContinuityId],
    continuityGovernanceMapIds: [governanceMap.governanceMapId],
    survivabilityIds: [survivability.survivabilityId],
    summary: `Federation resilience topology is ${topologyPosture} for lifecycle continuity ${continuity.lifecycleContinuityId}.`,
    metadataOnly: true,
  };
};

export const buildRuntimeBridgeExecutiveContinuityNarrative = ({
  continuity,
  governanceMap,
  survivability,
  auditReadiness,
  topology,
}: {
  readonly continuity: RuntimeBridgeEnterpriseLifecycleContinuity;
  readonly governanceMap: RuntimeBridgeContinuityGovernanceMap;
  readonly survivability: RuntimeBridgeIntelligenceSurvivability;
  readonly auditReadiness: RuntimeBridgeContinuityAuditReadiness;
  readonly topology: RuntimeBridgeFederationResilienceTopology;
}): RuntimeBridgeExecutiveContinuityNarrative => {
  const narrativePosture: RuntimeBridgeExecutiveContinuityNarrative["narrativePosture"] =
    governanceMap.continuityGovernancePosture === "risk_review"
      ? "risk_first"
      : auditReadiness.auditReadinessPosture === "governance_ready"
        ? "governance_first"
        : survivability.survivabilityPosture === "durable" || survivability.survivabilityPosture === "federated"
          ? "durability_first"
          : "lifecycle_summary";

  return {
    narrativeId: createRuntimeBridgeId("runtime-bridge-executive-continuity-narrative", continuity.subjectId),
    subjectId: continuity.subjectId,
    priority: strongestPriority([
      governanceMap.priority,
      survivability.priority,
      auditReadiness.priority,
      topology.priority,
    ]),
    narrativePosture,
    governanceMapId: governanceMap.governanceMapId,
    survivabilityId: survivability.survivabilityId,
    auditReadinessId: auditReadiness.auditReadinessId,
    topologyId: topology.topologyId,
    executiveThemeIds: collectRuntimeBridgeResilienceThemes(continuity),
    summary: `Executive continuity narrative is ${narrativePosture} across governance, survivability, audit readiness, and federation resilience metadata.`,
    metadataOnly: true,
  };
};

export const buildRuntimeBridgeResilienceContinuityFlow = ({
  continuity,
  governanceMap,
  survivability,
  auditReadiness,
  topology,
  narrative,
}: {
  readonly continuity: RuntimeBridgeEnterpriseLifecycleContinuity;
  readonly governanceMap: RuntimeBridgeContinuityGovernanceMap;
  readonly survivability: RuntimeBridgeIntelligenceSurvivability;
  readonly auditReadiness: RuntimeBridgeContinuityAuditReadiness;
  readonly topology: RuntimeBridgeFederationResilienceTopology;
  readonly narrative: RuntimeBridgeExecutiveContinuityNarrative;
}): RuntimeBridgeResilienceContinuityFlow => {
  const flowPosture: RuntimeBridgeResilienceContinuityFlow["flowPosture"] =
    narrative.narrativePosture === "risk_first"
      ? "risk_led"
      : topology.topologyPosture === "federated_resilience"
        ? "federation_led"
        : governanceMap.continuityGovernancePosture === "governed" ||
            governanceMap.continuityGovernancePosture === "mature"
          ? "governance_led"
          : "linear";

  return {
    flowId: createRuntimeBridgeId("runtime-bridge-resilience-continuity-flow", continuity.subjectId),
    subjectId: continuity.subjectId,
    priority: strongestPriority([
      governanceMap.priority,
      survivability.priority,
      auditReadiness.priority,
      topology.priority,
      narrative.priority,
    ]),
    flowPosture,
    governanceMapId: governanceMap.governanceMapId,
    survivabilityId: survivability.survivabilityId,
    auditReadinessId: auditReadiness.auditReadinessId,
    topologyId: topology.topologyId,
    narrativeId: narrative.narrativeId,
    summary: `Resilience continuity flow is ${flowPosture} across governance, survivability, audit readiness, topology, and executive narrative metadata.`,
    metadataOnly: true,
  };
};

export const buildRuntimeBridgeResilienceGovernanceBundles = ({
  continuity,
  governanceMap,
  survivability,
  auditReadiness,
  topology,
  narrative,
}: {
  readonly continuity: RuntimeBridgeEnterpriseLifecycleContinuity;
  readonly governanceMap: RuntimeBridgeContinuityGovernanceMap;
  readonly survivability: RuntimeBridgeIntelligenceSurvivability;
  readonly auditReadiness: RuntimeBridgeContinuityAuditReadiness;
  readonly topology: RuntimeBridgeFederationResilienceTopology;
  readonly narrative: RuntimeBridgeExecutiveContinuityNarrative;
}): ReadonlyArray<RuntimeBridgeResilienceGovernanceBundle> =>
  collectRuntimeBridgeResilienceThemes(continuity).map((theme) => {
    const sourceBundles = continuity.lifecycleContinuityBundles.filter(
      (bundle) => resilienceTheme(bundle.theme) === theme,
    );
    const priority = strongestPriority([
      ...sourceBundles.map((bundle) => bundle.priority),
      theme === "continuity_governance" ? governanceMap.priority : "low",
      theme === "intelligence_survivability" ? survivability.priority : "low",
      theme === "continuity_audit_readiness" ? auditReadiness.priority : "low",
      theme === "federation_resilience" ? topology.priority : "low",
      theme === "executive_continuity_governance" ? narrative.priority : "low",
    ]);

    return {
      bundleId: createRuntimeBridgeId("runtime-bridge-resilience-governance-bundle", continuity.subjectId, theme),
      subjectId: continuity.subjectId,
      theme,
      priority,
      governanceMapIds: theme === "continuity_governance" ? [governanceMap.governanceMapId] : [],
      survivabilityIds: theme === "intelligence_survivability" ? [survivability.survivabilityId] : [],
      auditReadinessIds: theme === "continuity_audit_readiness" ? [auditReadiness.auditReadinessId] : [],
      topologyIds: theme === "federation_resilience" ? [topology.topologyId] : [],
      narrativeIds: theme === "executive_continuity_governance" ? [narrative.narrativeId] : [],
      sourceLifecycleBundleIds: sourceBundles.map((bundle) => bundle.bundleId),
      summary: `${theme} resilience governance bundle references ${sourceBundles.length} lifecycle continuity bundles.`,
      metadataOnly: true as const,
    };
  }).sort((left, right) => {
    const priorityDelta = priorityScore(right.priority) - priorityScore(left.priority);
    if (priorityDelta !== 0) return priorityDelta;
    return left.bundleId.localeCompare(right.bundleId);
  });

export const buildRuntimeBridgeEnterpriseResilienceGovernance = (
  continuity: RuntimeBridgeEnterpriseLifecycleContinuity,
): RuntimeBridgeEnterpriseResilienceGovernance => {
  const continuityGovernanceMap = buildRuntimeBridgeContinuityGovernanceMap(continuity);
  const intelligenceSurvivability = summarizeRuntimeBridgeIntelligenceSurvivability(continuity);
  const continuityAuditReadiness = summarizeRuntimeBridgeContinuityAuditReadiness({
    continuity,
    governanceMap: continuityGovernanceMap,
  });
  const federationResilienceTopology = buildRuntimeBridgeFederationResilienceTopology({
    continuity,
    governanceMap: continuityGovernanceMap,
    survivability: intelligenceSurvivability,
  });
  const executiveContinuityNarrative = buildRuntimeBridgeExecutiveContinuityNarrative({
    continuity,
    governanceMap: continuityGovernanceMap,
    survivability: intelligenceSurvivability,
    auditReadiness: continuityAuditReadiness,
    topology: federationResilienceTopology,
  });
  const resilienceContinuityFlow = buildRuntimeBridgeResilienceContinuityFlow({
    continuity,
    governanceMap: continuityGovernanceMap,
    survivability: intelligenceSurvivability,
    auditReadiness: continuityAuditReadiness,
    topology: federationResilienceTopology,
    narrative: executiveContinuityNarrative,
  });
  const resilienceGovernanceBundles = buildRuntimeBridgeResilienceGovernanceBundles({
    continuity,
    governanceMap: continuityGovernanceMap,
    survivability: intelligenceSurvivability,
    auditReadiness: continuityAuditReadiness,
    topology: federationResilienceTopology,
    narrative: executiveContinuityNarrative,
  });

  return {
    resilienceGovernanceId: createRuntimeBridgeId(
      "runtime-bridge-enterprise-resilience-governance",
      continuity.subjectId,
    ),
    subjectId: continuity.subjectId,
    continuityGovernanceMap,
    intelligenceSurvivability,
    continuityAuditReadiness,
    federationResilienceTopology,
    executiveContinuityNarrative,
    resilienceContinuityFlow,
    resilienceGovernanceBundles,
    resiliencePriorities: summarizeRuntimeBridgeResiliencePriorities(continuity),
    resilienceThemes: collectRuntimeBridgeResilienceThemes(continuity),
    sourceLifecycleContinuityId: continuity.lifecycleContinuityId,
    metadataOnly: true,
  };
};
