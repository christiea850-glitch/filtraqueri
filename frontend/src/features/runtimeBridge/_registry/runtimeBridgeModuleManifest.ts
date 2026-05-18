import type { RuntimeBridgeRegistryLayer } from "./runtimeBridgeLayerRegistry";

export type RuntimeBridgeGovernanceClassification = "metadata_only";

export type RuntimeBridgeDeterministicCapability =
  | "stable_ids"
  | "stable_sorting"
  | "serializable_metadata"
  | "static_registry"
  | "governance_descriptor"
  | "source_descriptor"
  | "priority_summary"
  | "theme_summary"
  | "bundle_summary";

export type RuntimeBridgeProhibitedCapability =
  | "runtime_execution"
  | "workflow_dispatch"
  | "backend_api"
  | "storage_write"
  | "memory_persistence"
  | "session_restore"
  | "react_rendering"
  | "chart_rendering"
  | "network_call"
  | "timer_loop"
  | "random_id";

export type RuntimeBridgeStabilityLevel = "kernel" | "stable" | "provisional";

export type RuntimeBridgeFutureRuntimeEligibility =
  | "metadata_reference_only"
  | "adapter_candidate"
  | "review_required";

export type RuntimeBridgeReviewStatus = "reviewed" | "representative_subset" | "pending_expansion";

export type RuntimeBridgeModuleManifest = {
  readonly moduleId: string;
  readonly moduleName: string;
  readonly layer: RuntimeBridgeRegistryLayer;
  readonly governanceClassification: RuntimeBridgeGovernanceClassification;
  readonly deterministicCapabilities: ReadonlyArray<RuntimeBridgeDeterministicCapability>;
  readonly metadataOnly: true;
  readonly allowedDependencyLayers: ReadonlyArray<RuntimeBridgeRegistryLayer>;
  readonly prohibitedCapabilities: ReadonlyArray<RuntimeBridgeProhibitedCapability>;
  readonly sourceFile: string;
  readonly stabilityLevel: RuntimeBridgeStabilityLevel;
  readonly architecturalRole: string;
  readonly futureRuntimeEligibility: RuntimeBridgeFutureRuntimeEligibility;
  readonly reviewStatus: RuntimeBridgeReviewStatus;
};

const standardProhibitedCapabilities: ReadonlyArray<RuntimeBridgeProhibitedCapability> = [
  "runtime_execution",
  "workflow_dispatch",
  "backend_api",
  "storage_write",
  "memory_persistence",
  "session_restore",
  "react_rendering",
  "chart_rendering",
  "network_call",
  "timer_loop",
  "random_id",
];

export const runtimeBridgeRegisteredModuleManifests = [
  {
    moduleId: "runtime-bridge-kernel-types",
    moduleName: "Runtime Bridge kernel types",
    layer: "kernel",
    governanceClassification: "metadata_only",
    deterministicCapabilities: ["serializable_metadata", "static_registry"],
    metadataOnly: true,
    allowedDependencyLayers: ["kernel", "foundation"],
    prohibitedCapabilities: standardProhibitedCapabilities,
    sourceFile: "frontend/src/features/runtimeBridge/_kernel/runtimeBridgeKernelTypes.ts",
    stabilityLevel: "kernel",
    architecturalRole: "Shared metadata-only type contracts for Runtime Bridge kernel utilities.",
    futureRuntimeEligibility: "metadata_reference_only",
    reviewStatus: "reviewed",
  },
  {
    moduleId: "runtime-bridge-kernel-utils",
    moduleName: "Runtime Bridge kernel utils",
    layer: "kernel",
    governanceClassification: "metadata_only",
    deterministicCapabilities: ["stable_sorting", "serializable_metadata", "priority_summary", "bundle_summary"],
    metadataOnly: true,
    allowedDependencyLayers: ["kernel", "foundation"],
    prohibitedCapabilities: standardProhibitedCapabilities,
    sourceFile: "frontend/src/features/runtimeBridge/_kernel/runtimeBridgeKernelUtils.ts",
    stabilityLevel: "kernel",
    architecturalRole: "Shared deterministic sorting, uniqueness, and priority helpers.",
    futureRuntimeEligibility: "metadata_reference_only",
    reviewStatus: "reviewed",
  },
  {
    moduleId: "runtime-bridge-kernel-governance",
    moduleName: "Runtime Bridge kernel governance",
    layer: "kernel",
    governanceClassification: "metadata_only",
    deterministicCapabilities: ["governance_descriptor", "source_descriptor", "serializable_metadata"],
    metadataOnly: true,
    allowedDependencyLayers: ["kernel", "foundation"],
    prohibitedCapabilities: standardProhibitedCapabilities,
    sourceFile: "frontend/src/features/runtimeBridge/_kernel/runtimeBridgeKernelGovernance.ts",
    stabilityLevel: "kernel",
    architecturalRole: "Shared metadata-only governance and source module descriptor builders.",
    futureRuntimeEligibility: "metadata_reference_only",
    reviewStatus: "reviewed",
  },
  {
    moduleId: "runtime-bridge-architecture-posture",
    moduleName: "Runtime Bridge architecture posture",
    layer: "foundation",
    governanceClassification: "metadata_only",
    deterministicCapabilities: ["serializable_metadata", "static_registry", "governance_descriptor"],
    metadataOnly: true,
    allowedDependencyLayers: ["kernel", "foundation"],
    prohibitedCapabilities: standardProhibitedCapabilities,
    sourceFile: "frontend/src/features/runtimeBridge/_snapshots/runtimeBridgeArchitecturePosture.ts",
    stabilityLevel: "stable",
    architecturalRole: "Static Runtime Bridge architecture posture descriptors for governance snapshot reporting.",
    futureRuntimeEligibility: "metadata_reference_only",
    reviewStatus: "reviewed",
  },
  {
    moduleId: "runtime-bridge-governance-snapshot",
    moduleName: "Runtime Bridge governance snapshot",
    layer: "foundation",
    governanceClassification: "metadata_only",
    deterministicCapabilities: ["stable_sorting", "serializable_metadata", "governance_descriptor", "bundle_summary"],
    metadataOnly: true,
    allowedDependencyLayers: ["kernel", "foundation"],
    prohibitedCapabilities: standardProhibitedCapabilities,
    sourceFile: "frontend/src/features/runtimeBridge/_snapshots/runtimeBridgeGovernanceSnapshot.ts",
    stabilityLevel: "stable",
    architecturalRole: "Deterministic governance snapshot counts across registry, contracts, kernel flags, and architecture posture descriptors.",
    futureRuntimeEligibility: "metadata_reference_only",
    reviewStatus: "reviewed",
  },
  {
    moduleId: "runtime-bridge-integrity-summary",
    moduleName: "Runtime Bridge integrity summary",
    layer: "foundation",
    governanceClassification: "metadata_only",
    deterministicCapabilities: ["serializable_metadata", "governance_descriptor", "bundle_summary"],
    metadataOnly: true,
    allowedDependencyLayers: ["kernel", "foundation"],
    prohibitedCapabilities: standardProhibitedCapabilities,
    sourceFile: "frontend/src/features/runtimeBridge/_snapshots/runtimeBridgeIntegritySummary.ts",
    stabilityLevel: "stable",
    architecturalRole: "Architecture integrity summaries for dependency, governance, metadata-only, readiness, contract, layer, and registry posture.",
    futureRuntimeEligibility: "metadata_reference_only",
    reviewStatus: "reviewed",
  },
  {
    moduleId: "runtime-bridge-compliance-snapshot",
    moduleName: "Runtime Bridge compliance snapshot",
    layer: "foundation",
    governanceClassification: "metadata_only",
    deterministicCapabilities: ["serializable_metadata", "governance_descriptor", "bundle_summary"],
    metadataOnly: true,
    allowedDependencyLayers: ["kernel", "foundation"],
    prohibitedCapabilities: standardProhibitedCapabilities,
    sourceFile: "frontend/src/features/runtimeBridge/_snapshots/runtimeBridgeComplianceSnapshot.ts",
    stabilityLevel: "stable",
    architecturalRole: "Compliance, readiness, execution-boundary, deterministic, and integrity snapshot helper summaries.",
    futureRuntimeEligibility: "metadata_reference_only",
    reviewStatus: "reviewed",
  },
  {
    moduleId: "runtime-bridge-enterprise-lifecycle-continuity",
    moduleName: "Runtime Bridge enterprise lifecycle continuity",
    layer: "lifecycle",
    governanceClassification: "metadata_only",
    deterministicCapabilities: ["stable_ids", "stable_sorting", "serializable_metadata", "theme_summary", "bundle_summary"],
    metadataOnly: true,
    allowedDependencyLayers: ["kernel", "foundation", "federation", "lifecycle"],
    prohibitedCapabilities: standardProhibitedCapabilities,
    sourceFile: "frontend/src/features/runtimeBridge/runtimeBridgeEnterpriseLifecycleContinuity.ts",
    stabilityLevel: "stable",
    architecturalRole: "Enterprise lifecycle continuity, cross-session lineage posture, and archive posture metadata.",
    futureRuntimeEligibility: "review_required",
    reviewStatus: "representative_subset",
  },
  {
    moduleId: "runtime-bridge-enterprise-resilience-governance",
    moduleName: "Runtime Bridge enterprise resilience governance",
    layer: "resilience",
    governanceClassification: "metadata_only",
    deterministicCapabilities: ["stable_ids", "stable_sorting", "serializable_metadata", "priority_summary", "bundle_summary"],
    metadataOnly: true,
    allowedDependencyLayers: ["kernel", "foundation", "lifecycle", "resilience"],
    prohibitedCapabilities: standardProhibitedCapabilities,
    sourceFile: "frontend/src/features/runtimeBridge/runtimeBridgeEnterpriseResilienceGovernance.ts",
    stabilityLevel: "stable",
    architecturalRole: "Enterprise resilience governance, survivability, audit-readiness, and continuity flow metadata.",
    futureRuntimeEligibility: "review_required",
    reviewStatus: "representative_subset",
  },
  {
    moduleId: "runtime-bridge-enterprise-observability-traceability",
    moduleName: "Runtime Bridge enterprise observability traceability",
    layer: "observability",
    governanceClassification: "metadata_only",
    deterministicCapabilities: ["stable_ids", "stable_sorting", "serializable_metadata", "priority_summary", "bundle_summary"],
    metadataOnly: true,
    allowedDependencyLayers: ["kernel", "foundation", "resilience", "observability"],
    prohibitedCapabilities: standardProhibitedCapabilities,
    sourceFile: "frontend/src/features/runtimeBridge/runtimeBridgeEnterpriseObservabilityTraceability.ts",
    stabilityLevel: "stable",
    architecturalRole: "Enterprise observability, traceability lineage, audit federation, and trust governance metadata.",
    futureRuntimeEligibility: "review_required",
    reviewStatus: "representative_subset",
  },
  {
    moduleId: "runtime-bridge-intelligence-review-governance",
    moduleName: "Runtime Bridge intelligence review governance",
    layer: "governance",
    governanceClassification: "metadata_only",
    deterministicCapabilities: ["stable_ids", "stable_sorting", "serializable_metadata", "governance_descriptor"],
    metadataOnly: true,
    allowedDependencyLayers: ["kernel", "foundation", "intelligence", "orchestration", "governance"],
    prohibitedCapabilities: standardProhibitedCapabilities,
    sourceFile: "frontend/src/features/runtimeBridge/runtimeBridgeIntelligenceReviewGovernance.ts",
    stabilityLevel: "stable",
    architecturalRole: "Review-chain, approval-posture, and governance checkpoint metadata.",
    futureRuntimeEligibility: "review_required",
    reviewStatus: "representative_subset",
  },
  {
    moduleId: "runtime-bridge-visualization-planning",
    moduleName: "Runtime Bridge visualization planning",
    layer: "visualization",
    governanceClassification: "metadata_only",
    deterministicCapabilities: ["stable_ids", "stable_sorting", "serializable_metadata", "theme_summary"],
    metadataOnly: true,
    allowedDependencyLayers: ["kernel", "foundation", "intelligence", "visualization"],
    prohibitedCapabilities: standardProhibitedCapabilities,
    sourceFile: "frontend/src/features/runtimeBridge/runtimeBridgeVisualizationPlanning.ts",
    stabilityLevel: "stable",
    architecturalRole: "Visualization intent, dashboard descriptors, KPI grouping, and chart recommendation metadata.",
    futureRuntimeEligibility: "adapter_candidate",
    reviewStatus: "representative_subset",
  },
] as const satisfies ReadonlyArray<RuntimeBridgeModuleManifest>;
