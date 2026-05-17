import {
  buildRuntimeBridgeMetadataOnlyGovernanceDescriptor,
  buildRuntimeBridgeSourceModuleDescriptor,
  selectStrongestRuntimeBridgePriority,
  sortRuntimeBridgeBundles,
  sortRuntimeBridgePriorities,
  uniqueStable,
} from "./_kernel";
import type {
  RuntimeBridgeEnterpriseResilienceGovernance,
  RuntimeBridgeResiliencePriority,
  RuntimeBridgeResilienceTheme,
} from "./runtimeBridgeEnterpriseResilienceGovernance";
import { createRuntimeBridgeId } from "./runtimeBridgeIds";

export type RuntimeBridgeObservabilityPriority = RuntimeBridgeResiliencePriority;

export type RuntimeBridgeObservabilityTheme =
  | RuntimeBridgeResilienceTheme
  | "observability_topology"
  | "strategic_traceability_lineage"
  | "executive_audit_federation"
  | "explainability_continuity"
  | "insight_trust_governance"
  | "observability_narrative"
  | "observability_bundle";

export type RuntimeBridgeObservabilityTopology = {
  readonly topologyId: string;
  readonly subjectId: string;
  readonly priority: RuntimeBridgeObservabilityPriority;
  readonly observabilityPosture: "baseline" | "traceable" | "federated" | "risk_review";
  readonly resilienceGovernanceIds: ReadonlyArray<string>;
  readonly continuityGovernanceMapIds: ReadonlyArray<string>;
  readonly resilienceTopologyIds: ReadonlyArray<string>;
  readonly observabilityThemeIds: ReadonlyArray<RuntimeBridgeObservabilityTheme>;
  readonly canMonitorSystems: false;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeStrategicTraceabilityLineage = {
  readonly traceabilityLineageId: string;
  readonly subjectId: string;
  readonly priority: RuntimeBridgeObservabilityPriority;
  readonly traceabilityPosture: "descriptive" | "lineage_mapped" | "federated_trace" | "risk_trace";
  readonly survivabilityIds: ReadonlyArray<string>;
  readonly auditReadinessIds: ReadonlyArray<string>;
  readonly continuityFlowIds: ReadonlyArray<string>;
  readonly sourceResilienceGovernanceId: string;
  readonly canPersistMemory: false;
  readonly canRestoreSession: false;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeExecutiveAuditFederation = {
  readonly auditFederationId: string;
  readonly subjectId: string;
  readonly priority: RuntimeBridgeObservabilityPriority;
  readonly auditFederationPosture: "summary" | "review_ready" | "federated_audit" | "risk_audit";
  readonly auditReadinessIds: ReadonlyArray<string>;
  readonly executiveNarrativeIds: ReadonlyArray<string>;
  readonly topologyIds: ReadonlyArray<string>;
  readonly canWriteStorage: false;
  readonly canCallBackend: false;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeExplainabilityContinuityMap = {
  readonly explainabilityMapId: string;
  readonly subjectId: string;
  readonly priority: RuntimeBridgeObservabilityPriority;
  readonly explainabilityPosture: "implicit" | "mapped" | "continuity_mapped" | "risk_explainability";
  readonly narrativeIds: ReadonlyArray<string>;
  readonly flowIds: ReadonlyArray<string>;
  readonly bundleIds: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeInsightTrustGovernance = {
  readonly trustGovernanceId: string;
  readonly subjectId: string;
  readonly priority: RuntimeBridgeObservabilityPriority;
  readonly trustPosture: "baseline" | "reviewable" | "governed" | "risk_sensitive";
  readonly governanceMapIds: ReadonlyArray<string>;
  readonly survivabilityIds: ReadonlyArray<string>;
  readonly auditFederationIds: ReadonlyArray<string>;
  readonly canMutateRuntimeState: false;
  readonly canAuthorizeBehavior: false;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeObservabilityNarrativeFlow = {
  readonly narrativeFlowId: string;
  readonly subjectId: string;
  readonly priority: RuntimeBridgeObservabilityPriority;
  readonly narrativePosture: "transparent_summary" | "traceability_first" | "audit_first" | "risk_first";
  readonly observabilityTopologyId: string;
  readonly traceabilityLineageId: string;
  readonly auditFederationId: string;
  readonly explainabilityMapId: string;
  readonly trustGovernanceId: string;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeObservabilityBundle = {
  readonly bundleId: string;
  readonly subjectId: string;
  readonly theme: RuntimeBridgeObservabilityTheme;
  readonly priority: RuntimeBridgeObservabilityPriority;
  readonly topologyIds: ReadonlyArray<string>;
  readonly lineageIds: ReadonlyArray<string>;
  readonly auditFederationIds: ReadonlyArray<string>;
  readonly explainabilityMapIds: ReadonlyArray<string>;
  readonly trustGovernanceIds: ReadonlyArray<string>;
  readonly sourceResilienceBundleIds: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeEnterpriseObservabilityTraceability = {
  readonly observabilityTraceabilityId: string;
  readonly subjectId: string;
  readonly observabilityTopology: RuntimeBridgeObservabilityTopology;
  readonly strategicTraceabilityLineage: RuntimeBridgeStrategicTraceabilityLineage;
  readonly executiveAuditFederation: RuntimeBridgeExecutiveAuditFederation;
  readonly explainabilityContinuityMap: RuntimeBridgeExplainabilityContinuityMap;
  readonly insightTrustGovernance: RuntimeBridgeInsightTrustGovernance;
  readonly observabilityNarrativeFlow: RuntimeBridgeObservabilityNarrativeFlow;
  readonly observabilityBundles: ReadonlyArray<RuntimeBridgeObservabilityBundle>;
  readonly observabilityPriorities: ReadonlyArray<RuntimeBridgeObservabilityPriority>;
  readonly observabilityThemes: ReadonlyArray<RuntimeBridgeObservabilityTheme>;
  readonly sourceResilienceGovernanceId: string;
  readonly metadataOnly: true;
};

export const runtimeBridgeEnterpriseObservabilityTraceabilityGovernance = buildRuntimeBridgeMetadataOnlyGovernanceDescriptor({
  contractId: "runtime-bridge-enterprise-observability-traceability",
  label: "Runtime bridge enterprise observability traceability",
  description:
    "Metadata-only enterprise observability descriptors, strategic traceability lineage metadata, executive audit intelligence federation, explainability continuity topology, organizational insight trust governance metadata, and deterministic observability continuity planning.",
  lineageRefs: [
    "runtime-bridge-enterprise-observability-traceability",
    "runtime-bridge-observability-topology",
    "runtime-bridge-strategic-traceability-lineage",
    "runtime-bridge-executive-audit-federation",
    "runtime-bridge-explainability-continuity-map",
    "runtime-bridge-insight-trust-governance",
    "runtime-bridge-observability-narrative-flow",
    "runtime-bridge-observability-bundle",
  ],
});

export const runtimeBridgeEnterpriseObservabilityTraceabilitySourceModule = buildRuntimeBridgeSourceModuleDescriptor({
  moduleId: "runtime-bridge-enterprise-observability-traceability",
  modulePath: "frontend/src/features/runtimeBridge/runtimeBridgeEnterpriseObservabilityTraceability.ts",
  label: "Runtime bridge enterprise observability traceability",
});

const strongestPriority = (
  priorities: ReadonlyArray<RuntimeBridgeObservabilityPriority>,
): RuntimeBridgeObservabilityPriority => selectStrongestRuntimeBridgePriority(priorities, "low");

const observabilityTheme = (theme: RuntimeBridgeResilienceTheme): RuntimeBridgeObservabilityTheme => theme;

export const collectRuntimeBridgeObservabilityThemes = (
  governance: RuntimeBridgeEnterpriseResilienceGovernance,
): ReadonlyArray<RuntimeBridgeObservabilityTheme> =>
  uniqueStable([
    ...governance.resilienceThemes.map(observabilityTheme),
    "observability_topology",
    "strategic_traceability_lineage",
    "executive_audit_federation",
    "explainability_continuity",
    "insight_trust_governance",
    "observability_narrative",
    "observability_bundle",
  ]);

export const summarizeRuntimeBridgeObservabilityPriorities = (
  governance: RuntimeBridgeEnterpriseResilienceGovernance,
): ReadonlyArray<RuntimeBridgeObservabilityPriority> =>
  sortRuntimeBridgePriorities([
    ...governance.resiliencePriorities,
    governance.continuityGovernanceMap.priority,
    governance.intelligenceSurvivability.priority,
    governance.continuityAuditReadiness.priority,
    governance.federationResilienceTopology.priority,
    governance.executiveContinuityNarrative.priority,
    governance.resilienceContinuityFlow.priority,
    ...governance.resilienceGovernanceBundles.map((bundle) => bundle.priority),
  ]);

export const buildRuntimeBridgeObservabilityTopology = (
  governance: RuntimeBridgeEnterpriseResilienceGovernance,
): RuntimeBridgeObservabilityTopology => {
  const observabilityPosture: RuntimeBridgeObservabilityTopology["observabilityPosture"] =
    governance.continuityGovernanceMap.continuityGovernancePosture === "risk_review"
      ? "risk_review"
      : governance.federationResilienceTopology.topologyPosture === "federated_resilience"
        ? "federated"
        : governance.continuityAuditReadiness.auditReadinessPosture === "governance_ready"
          ? "traceable"
          : "baseline";

  return {
    topologyId: createRuntimeBridgeId("runtime-bridge-observability-topology", governance.subjectId),
    subjectId: governance.subjectId,
    priority: strongestPriority(summarizeRuntimeBridgeObservabilityPriorities(governance)),
    observabilityPosture,
    resilienceGovernanceIds: [governance.resilienceGovernanceId],
    continuityGovernanceMapIds: [governance.continuityGovernanceMap.governanceMapId],
    resilienceTopologyIds: [governance.federationResilienceTopology.topologyId],
    observabilityThemeIds: collectRuntimeBridgeObservabilityThemes(governance),
    canMonitorSystems: false,
    summary: `Observability topology is ${observabilityPosture} across ${governance.resilienceGovernanceBundles.length} resilience governance bundles.`,
    metadataOnly: true,
  };
};

export const summarizeRuntimeBridgeStrategicTraceabilityLineage = (
  governance: RuntimeBridgeEnterpriseResilienceGovernance,
): RuntimeBridgeStrategicTraceabilityLineage => {
  const traceabilityPosture: RuntimeBridgeStrategicTraceabilityLineage["traceabilityPosture"] =
    governance.resilienceContinuityFlow.flowPosture === "risk_led"
      ? "risk_trace"
      : governance.federationResilienceTopology.topologyPosture === "federated_resilience"
        ? "federated_trace"
        : governance.intelligenceSurvivability.survivabilityPosture === "durable"
          ? "lineage_mapped"
          : "descriptive";

  return {
    traceabilityLineageId: createRuntimeBridgeId(
      "runtime-bridge-strategic-traceability-lineage",
      governance.subjectId,
    ),
    subjectId: governance.subjectId,
    priority: strongestPriority([
      governance.intelligenceSurvivability.priority,
      governance.continuityAuditReadiness.priority,
      governance.resilienceContinuityFlow.priority,
    ]),
    traceabilityPosture,
    survivabilityIds: [governance.intelligenceSurvivability.survivabilityId],
    auditReadinessIds: [governance.continuityAuditReadiness.auditReadinessId],
    continuityFlowIds: [governance.resilienceContinuityFlow.flowId],
    sourceResilienceGovernanceId: governance.resilienceGovernanceId,
    canPersistMemory: false,
    canRestoreSession: false,
    summary: `Strategic traceability lineage is ${traceabilityPosture}; it describes lineage continuity without persisting memory or restoring sessions.`,
    metadataOnly: true,
  };
};

export const buildRuntimeBridgeExecutiveAuditFederation = (
  governance: RuntimeBridgeEnterpriseResilienceGovernance,
): RuntimeBridgeExecutiveAuditFederation => {
  const auditFederationPosture: RuntimeBridgeExecutiveAuditFederation["auditFederationPosture"] =
    governance.continuityAuditReadiness.auditReadinessPosture === "risk_review"
      ? "risk_audit"
      : governance.federationResilienceTopology.topologyPosture === "federated_resilience"
        ? "federated_audit"
        : governance.continuityAuditReadiness.auditReadinessPosture === "review_ready" ||
            governance.continuityAuditReadiness.auditReadinessPosture === "governance_ready"
          ? "review_ready"
          : "summary";

  return {
    auditFederationId: createRuntimeBridgeId("runtime-bridge-executive-audit-federation", governance.subjectId),
    subjectId: governance.subjectId,
    priority: strongestPriority([
      governance.continuityAuditReadiness.priority,
      governance.executiveContinuityNarrative.priority,
      governance.federationResilienceTopology.priority,
    ]),
    auditFederationPosture,
    auditReadinessIds: [governance.continuityAuditReadiness.auditReadinessId],
    executiveNarrativeIds: [governance.executiveContinuityNarrative.narrativeId],
    topologyIds: [governance.federationResilienceTopology.topologyId],
    canWriteStorage: false,
    canCallBackend: false,
    summary: `Executive audit federation is ${auditFederationPosture}; it is metadata-only and cannot write storage or call backend services.`,
    metadataOnly: true,
  };
};

export const summarizeRuntimeBridgeExplainabilityContinuityMap = (
  governance: RuntimeBridgeEnterpriseResilienceGovernance,
): RuntimeBridgeExplainabilityContinuityMap => {
  const explainabilityPosture: RuntimeBridgeExplainabilityContinuityMap["explainabilityPosture"] =
    governance.executiveContinuityNarrative.narrativePosture === "risk_first"
      ? "risk_explainability"
      : governance.resilienceContinuityFlow.flowPosture === "governance_led"
        ? "continuity_mapped"
        : governance.resilienceGovernanceBundles.length > 1
          ? "mapped"
          : "implicit";

  return {
    explainabilityMapId: createRuntimeBridgeId("runtime-bridge-explainability-continuity-map", governance.subjectId),
    subjectId: governance.subjectId,
    priority: strongestPriority([
      governance.executiveContinuityNarrative.priority,
      governance.resilienceContinuityFlow.priority,
      ...governance.resilienceGovernanceBundles.map((bundle) => bundle.priority),
    ]),
    explainabilityPosture,
    narrativeIds: [governance.executiveContinuityNarrative.narrativeId],
    flowIds: [governance.resilienceContinuityFlow.flowId],
    bundleIds: governance.resilienceGovernanceBundles.map((bundle) => bundle.bundleId),
    summary: `Explainability continuity map is ${explainabilityPosture} across executive narrative and resilience continuity flow metadata.`,
    metadataOnly: true,
  };
};

export const summarizeRuntimeBridgeInsightTrustGovernance = ({
  governance,
  auditFederation,
}: {
  readonly governance: RuntimeBridgeEnterpriseResilienceGovernance;
  readonly auditFederation: RuntimeBridgeExecutiveAuditFederation;
}): RuntimeBridgeInsightTrustGovernance => {
  const trustPosture: RuntimeBridgeInsightTrustGovernance["trustPosture"] =
    governance.continuityGovernanceMap.continuityGovernancePosture === "risk_review"
      ? "risk_sensitive"
      : governance.continuityGovernanceMap.continuityGovernancePosture === "mature"
        ? "governed"
        : auditFederation.auditFederationPosture === "review_ready" ||
            auditFederation.auditFederationPosture === "federated_audit"
          ? "reviewable"
          : "baseline";

  return {
    trustGovernanceId: createRuntimeBridgeId("runtime-bridge-insight-trust-governance", governance.subjectId),
    subjectId: governance.subjectId,
    priority: strongestPriority([
      governance.continuityGovernanceMap.priority,
      governance.intelligenceSurvivability.priority,
      auditFederation.priority,
    ]),
    trustPosture,
    governanceMapIds: [governance.continuityGovernanceMap.governanceMapId],
    survivabilityIds: [governance.intelligenceSurvivability.survivabilityId],
    auditFederationIds: [auditFederation.auditFederationId],
    canMutateRuntimeState: false,
    canAuthorizeBehavior: false,
    summary: `Insight trust governance is ${trustPosture}; it describes trust posture without mutating runtime state or authorizing behavior.`,
    metadataOnly: true,
  };
};

export const buildRuntimeBridgeObservabilityNarrativeFlow = ({
  governance,
  observabilityTopology,
  traceabilityLineage,
  auditFederation,
  explainabilityMap,
  trustGovernance,
}: {
  readonly governance: RuntimeBridgeEnterpriseResilienceGovernance;
  readonly observabilityTopology: RuntimeBridgeObservabilityTopology;
  readonly traceabilityLineage: RuntimeBridgeStrategicTraceabilityLineage;
  readonly auditFederation: RuntimeBridgeExecutiveAuditFederation;
  readonly explainabilityMap: RuntimeBridgeExplainabilityContinuityMap;
  readonly trustGovernance: RuntimeBridgeInsightTrustGovernance;
}): RuntimeBridgeObservabilityNarrativeFlow => {
  const narrativePosture: RuntimeBridgeObservabilityNarrativeFlow["narrativePosture"] =
    observabilityTopology.observabilityPosture === "risk_review"
      ? "risk_first"
      : auditFederation.auditFederationPosture === "review_ready" ||
          auditFederation.auditFederationPosture === "federated_audit"
        ? "audit_first"
        : traceabilityLineage.traceabilityPosture === "lineage_mapped" ||
            traceabilityLineage.traceabilityPosture === "federated_trace"
          ? "traceability_first"
          : "transparent_summary";

  return {
    narrativeFlowId: createRuntimeBridgeId("runtime-bridge-observability-narrative-flow", governance.subjectId),
    subjectId: governance.subjectId,
    priority: strongestPriority([
      observabilityTopology.priority,
      traceabilityLineage.priority,
      auditFederation.priority,
      explainabilityMap.priority,
      trustGovernance.priority,
    ]),
    narrativePosture,
    observabilityTopologyId: observabilityTopology.topologyId,
    traceabilityLineageId: traceabilityLineage.traceabilityLineageId,
    auditFederationId: auditFederation.auditFederationId,
    explainabilityMapId: explainabilityMap.explainabilityMapId,
    trustGovernanceId: trustGovernance.trustGovernanceId,
    summary: `Observability narrative flow is ${narrativePosture} across topology, traceability lineage, audit federation, explainability, and trust governance metadata.`,
    metadataOnly: true,
  };
};

export const buildRuntimeBridgeObservabilityBundles = ({
  governance,
  observabilityTopology,
  traceabilityLineage,
  auditFederation,
  explainabilityMap,
  trustGovernance,
}: {
  readonly governance: RuntimeBridgeEnterpriseResilienceGovernance;
  readonly observabilityTopology: RuntimeBridgeObservabilityTopology;
  readonly traceabilityLineage: RuntimeBridgeStrategicTraceabilityLineage;
  readonly auditFederation: RuntimeBridgeExecutiveAuditFederation;
  readonly explainabilityMap: RuntimeBridgeExplainabilityContinuityMap;
  readonly trustGovernance: RuntimeBridgeInsightTrustGovernance;
}): ReadonlyArray<RuntimeBridgeObservabilityBundle> =>
  sortRuntimeBridgeBundles(collectRuntimeBridgeObservabilityThemes(governance).map((theme) => {
    const sourceBundles = governance.resilienceGovernanceBundles.filter(
      (bundle) => observabilityTheme(bundle.theme) === theme,
    );
    const priority = strongestPriority([
      ...sourceBundles.map((bundle) => bundle.priority),
      theme === "observability_topology" ? observabilityTopology.priority : "low",
      theme === "strategic_traceability_lineage" ? traceabilityLineage.priority : "low",
      theme === "executive_audit_federation" ? auditFederation.priority : "low",
      theme === "explainability_continuity" ? explainabilityMap.priority : "low",
      theme === "insight_trust_governance" ? trustGovernance.priority : "low",
    ]);

    return {
      bundleId: createRuntimeBridgeId("runtime-bridge-observability-bundle", governance.subjectId, theme),
      subjectId: governance.subjectId,
      theme,
      priority,
      topologyIds: theme === "observability_topology" ? [observabilityTopology.topologyId] : [],
      lineageIds: theme === "strategic_traceability_lineage" ? [traceabilityLineage.traceabilityLineageId] : [],
      auditFederationIds: theme === "executive_audit_federation" ? [auditFederation.auditFederationId] : [],
      explainabilityMapIds: theme === "explainability_continuity" ? [explainabilityMap.explainabilityMapId] : [],
      trustGovernanceIds: theme === "insight_trust_governance" ? [trustGovernance.trustGovernanceId] : [],
      sourceResilienceBundleIds: sourceBundles.map((bundle) => bundle.bundleId),
      summary: `${theme} observability bundle references ${sourceBundles.length} resilience governance bundles.`,
      metadataOnly: true as const,
    };
  }));

export const buildRuntimeBridgeEnterpriseObservabilityTraceability = (
  governance: RuntimeBridgeEnterpriseResilienceGovernance,
): RuntimeBridgeEnterpriseObservabilityTraceability => {
  const observabilityTopology = buildRuntimeBridgeObservabilityTopology(governance);
  const strategicTraceabilityLineage = summarizeRuntimeBridgeStrategicTraceabilityLineage(governance);
  const executiveAuditFederation = buildRuntimeBridgeExecutiveAuditFederation(governance);
  const explainabilityContinuityMap = summarizeRuntimeBridgeExplainabilityContinuityMap(governance);
  const insightTrustGovernance = summarizeRuntimeBridgeInsightTrustGovernance({
    governance,
    auditFederation: executiveAuditFederation,
  });
  const observabilityNarrativeFlow = buildRuntimeBridgeObservabilityNarrativeFlow({
    governance,
    observabilityTopology,
    traceabilityLineage: strategicTraceabilityLineage,
    auditFederation: executiveAuditFederation,
    explainabilityMap: explainabilityContinuityMap,
    trustGovernance: insightTrustGovernance,
  });
  const observabilityBundles = buildRuntimeBridgeObservabilityBundles({
    governance,
    observabilityTopology,
    traceabilityLineage: strategicTraceabilityLineage,
    auditFederation: executiveAuditFederation,
    explainabilityMap: explainabilityContinuityMap,
    trustGovernance: insightTrustGovernance,
  });

  return {
    observabilityTraceabilityId: createRuntimeBridgeId(
      "runtime-bridge-enterprise-observability-traceability",
      governance.subjectId,
    ),
    subjectId: governance.subjectId,
    observabilityTopology,
    strategicTraceabilityLineage,
    executiveAuditFederation,
    explainabilityContinuityMap,
    insightTrustGovernance,
    observabilityNarrativeFlow,
    observabilityBundles,
    observabilityPriorities: summarizeRuntimeBridgeObservabilityPriorities(governance),
    observabilityThemes: collectRuntimeBridgeObservabilityThemes(governance),
    sourceResilienceGovernanceId: governance.resilienceGovernanceId,
    metadataOnly: true,
  };
};
