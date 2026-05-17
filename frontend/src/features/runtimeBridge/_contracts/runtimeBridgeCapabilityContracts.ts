import type { RuntimeBridgeRegistryLayer } from "../_registry";
import type { RuntimeBridgeExecutionBoundaryKind } from "./runtimeBridgeExecutionBoundaries";
import type { RuntimeBridgeRuntimeReadinessClassification } from "./runtimeBridgeRuntimeReadiness";

export type RuntimeBridgeCapabilityContract = {
  readonly capabilityId: string;
  readonly capabilityName: string;
  readonly moduleId: string;
  readonly layer: RuntimeBridgeRegistryLayer;
  readonly readiness: RuntimeBridgeRuntimeReadinessClassification;
  readonly advisoryOnly: boolean;
  readonly executable: boolean;
  readonly runtimeEligible: boolean;
  readonly uiEligible: boolean;
  readonly persistenceEligible: boolean;
  readonly orchestrationEligible: boolean;
  readonly exportEligible: boolean;
  readonly backendEligible: boolean;
  readonly agentEligible: boolean;
  readonly workflowEligible: boolean;
  readonly governanceRequired: boolean;
  readonly executionBoundary: RuntimeBridgeExecutionBoundaryKind;
  readonly deterministicOnly: boolean;
  readonly reviewRequired: boolean;
  readonly prohibitedRuntimeCapabilities: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

const prohibitedRuntimeCapabilities = [
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
  "autonomous_agent",
] as const;

const metadataOnlyContract = ({
  capabilityId,
  capabilityName,
  moduleId,
  layer,
  readiness,
  advisoryOnly,
  governanceRequired,
  reviewRequired,
  summary,
}: {
  readonly capabilityId: string;
  readonly capabilityName: string;
  readonly moduleId: string;
  readonly layer: RuntimeBridgeRegistryLayer;
  readonly readiness: RuntimeBridgeRuntimeReadinessClassification;
  readonly advisoryOnly: boolean;
  readonly governanceRequired: boolean;
  readonly reviewRequired: boolean;
  readonly summary: string;
}): RuntimeBridgeCapabilityContract => ({
  capabilityId,
  capabilityName,
  moduleId,
  layer,
  readiness,
  advisoryOnly,
  executable: false,
  runtimeEligible: false,
  uiEligible: false,
  persistenceEligible: false,
  orchestrationEligible: false,
  exportEligible: false,
  backendEligible: false,
  agentEligible: false,
  workflowEligible: false,
  governanceRequired,
  executionBoundary: "metadata_boundary",
  deterministicOnly: true,
  reviewRequired,
  prohibitedRuntimeCapabilities,
  summary,
  metadataOnly: true,
});

export const runtimeBridgeCapabilityContracts = [
  metadataOnlyContract({
    capabilityId: "runtime-bridge-kernel-utils-contract",
    capabilityName: "Runtime Bridge kernel utilities contract",
    moduleId: "runtime-bridge-kernel-utils",
    layer: "kernel",
    readiness: "metadata_only",
    advisoryOnly: true,
    governanceRequired: false,
    reviewRequired: false,
    summary: "Kernel utilities provide deterministic metadata helpers and are never runtime eligible.",
  }),
  metadataOnlyContract({
    capabilityId: "runtime-bridge-enterprise-lifecycle-continuity-contract",
    capabilityName: "Runtime Bridge enterprise lifecycle continuity contract",
    moduleId: "runtime-bridge-enterprise-lifecycle-continuity",
    layer: "lifecycle",
    readiness: "governance_review_required",
    advisoryOnly: true,
    governanceRequired: true,
    reviewRequired: true,
    summary: "Lifecycle continuity remains advisory metadata and requires governance review before future runtime use.",
  }),
  metadataOnlyContract({
    capabilityId: "runtime-bridge-enterprise-resilience-governance-contract",
    capabilityName: "Runtime Bridge enterprise resilience governance contract",
    moduleId: "runtime-bridge-enterprise-resilience-governance",
    layer: "resilience",
    readiness: "governance_review_required",
    advisoryOnly: true,
    governanceRequired: true,
    reviewRequired: true,
    summary: "Resilience governance remains advisory metadata and cannot execute continuity behavior.",
  }),
  metadataOnlyContract({
    capabilityId: "runtime-bridge-enterprise-observability-traceability-contract",
    capabilityName: "Runtime Bridge enterprise observability traceability contract",
    moduleId: "runtime-bridge-enterprise-observability-traceability",
    layer: "observability",
    readiness: "governance_review_required",
    advisoryOnly: true,
    governanceRequired: true,
    reviewRequired: true,
    summary: "Observability traceability remains metadata-only and does not monitor systems.",
  }),
  metadataOnlyContract({
    capabilityId: "runtime-bridge-visualization-planning-contract",
    capabilityName: "Runtime Bridge visualization planning contract",
    moduleId: "runtime-bridge-visualization-planning",
    layer: "visualization",
    readiness: "future_runtime_possible",
    advisoryOnly: true,
    governanceRequired: true,
    reviewRequired: true,
    summary: "Visualization planning may inform future adapters but cannot render UI or charts.",
  }),
  metadataOnlyContract({
    capabilityId: "runtime-bridge-intelligence-review-governance-contract",
    capabilityName: "Runtime Bridge intelligence review governance contract",
    moduleId: "runtime-bridge-intelligence-review-governance",
    layer: "governance",
    readiness: "governance_review_required",
    advisoryOnly: true,
    governanceRequired: true,
    reviewRequired: true,
    summary: "Review governance describes approval posture but cannot approve, deny, or mutate permissions.",
  }),
] as const satisfies ReadonlyArray<RuntimeBridgeCapabilityContract>;
