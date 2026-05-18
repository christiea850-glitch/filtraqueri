import {
  runtimeBridgeExecutionBoundaryPostureSummary,
  runtimeBridgeRuntimeReadinessPostureSummary,
} from "../_contracts";
import {
  runtimeBridgeRegistryGovernanceSummary,
  runtimeBridgeRegistryLayerValidation,
} from "../_registry";
import { runtimeBridgeGovernanceSnapshot } from "./runtimeBridgeGovernanceSnapshot";
import { runtimeBridgeIntegritySummaries } from "./runtimeBridgeIntegritySummary";

export type RuntimeBridgeComplianceSnapshotSummary = {
  readonly summaryId: string;
  readonly posture: "verified" | "review_required";
  readonly supportingIds: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export const summarizeRuntimeBridgeGovernanceSnapshot = (): RuntimeBridgeComplianceSnapshotSummary => ({
  summaryId: "runtime-bridge-governance-snapshot-summary",
  posture: runtimeBridgeGovernanceSnapshot.deterministicCompliancePosture,
  supportingIds: [runtimeBridgeGovernanceSnapshot.snapshotId, runtimeBridgeRegistryGovernanceSummary.summaryId],
  summary: runtimeBridgeGovernanceSnapshot.summary,
  metadataOnly: true,
});

export const summarizeRuntimeBridgeIntegritySnapshotPosture = (): RuntimeBridgeComplianceSnapshotSummary => {
  const reviewRequiredCount = runtimeBridgeIntegritySummaries.filter(
    (integritySummary) => integritySummary.integrity === "review_required",
  ).length;

  return {
    summaryId: "runtime-bridge-integrity-posture-summary",
    posture: reviewRequiredCount === 0 ? "verified" : "review_required",
    supportingIds: runtimeBridgeIntegritySummaries.map((integritySummary) => integritySummary.summaryId),
    summary: `${runtimeBridgeIntegritySummaries.length - reviewRequiredCount} of ${runtimeBridgeIntegritySummaries.length} Runtime Bridge integrity summaries are verified.`,
    metadataOnly: true,
  };
};

export const summarizeRuntimeBridgeCompliancePosture = (): RuntimeBridgeComplianceSnapshotSummary => ({
  summaryId: "runtime-bridge-compliance-posture-summary",
  posture: runtimeBridgeRegistryLayerValidation.valid ? "verified" : "review_required",
  supportingIds: [
    runtimeBridgeRegistryLayerValidation.validationId,
    runtimeBridgeGovernanceSnapshot.snapshotId,
  ],
  summary: "Runtime Bridge compliance posture is derived from registry validation and governance snapshot metadata.",
  metadataOnly: true,
});

export const summarizeRuntimeBridgeReadinessPosture = (): RuntimeBridgeComplianceSnapshotSummary => ({
  summaryId: "runtime-bridge-readiness-posture-summary",
  posture: runtimeBridgeRuntimeReadinessPostureSummary.readinessIds.length > 0 ? "verified" : "review_required",
  supportingIds: [
    runtimeBridgeRuntimeReadinessPostureSummary.summaryId,
    runtimeBridgeGovernanceSnapshot.snapshotId,
  ],
  summary: runtimeBridgeRuntimeReadinessPostureSummary.summary,
  metadataOnly: true,
});

export const summarizeRuntimeBridgeExecutionBoundarySnapshotPosture = (): RuntimeBridgeComplianceSnapshotSummary => ({
  summaryId: "runtime-bridge-execution-boundary-snapshot-summary",
  posture: runtimeBridgeGovernanceSnapshot.executionBoundaryPosture,
  supportingIds: [
    runtimeBridgeExecutionBoundaryPostureSummary.summaryId,
    runtimeBridgeGovernanceSnapshot.snapshotId,
  ],
  summary: runtimeBridgeExecutionBoundaryPostureSummary.summary,
  metadataOnly: true,
});

export const summarizeRuntimeBridgeDeterministicPosture = (): RuntimeBridgeComplianceSnapshotSummary => ({
  summaryId: "runtime-bridge-deterministic-posture-summary",
  posture: runtimeBridgeGovernanceSnapshot.deterministicCompliancePosture,
  supportingIds: [
    runtimeBridgeGovernanceSnapshot.snapshotId,
    runtimeBridgeRegistryLayerValidation.validationId,
  ],
  summary: "Runtime Bridge deterministic posture is based on static snapshot IDs, registry slugs, and metadata-only kernel capability flags.",
  metadataOnly: true,
});

export const runtimeBridgeComplianceSnapshotSummaries = [
  summarizeRuntimeBridgeGovernanceSnapshot(),
  summarizeRuntimeBridgeIntegritySnapshotPosture(),
  summarizeRuntimeBridgeCompliancePosture(),
  summarizeRuntimeBridgeReadinessPosture(),
  summarizeRuntimeBridgeExecutionBoundarySnapshotPosture(),
  summarizeRuntimeBridgeDeterministicPosture(),
] as const satisfies ReadonlyArray<RuntimeBridgeComplianceSnapshotSummary>;
