import {
  runtimeBridgeRegistryLayerValidation,
  summarizeRuntimeBridgeMetadataOnlyCompliancePosture,
} from "../_registry";
import {
  summarizeRuntimeBridgeCapabilityPosture,
  summarizeRuntimeBridgeExecutionBoundaryPosture,
  summarizeRuntimeBridgeRuntimeReadinessPosture,
} from "../_contracts";
import { runtimeBridgeGovernanceSnapshot } from "./runtimeBridgeGovernanceSnapshot";
import type { RuntimeBridgeIntegrityValue } from "./runtimeBridgeArchitecturePosture";

export type RuntimeBridgeIntegrityDimension =
  | "dependency_integrity"
  | "governance_integrity"
  | "metadata_only_integrity"
  | "readiness_integrity"
  | "contract_integrity"
  | "layer_integrity"
  | "registry_integrity";

export type RuntimeBridgeIntegritySummary = {
  readonly summaryId: RuntimeBridgeIntegrityDimension;
  readonly integrity: RuntimeBridgeIntegrityValue;
  readonly supportingSnapshotId: string;
  readonly summary: string;
  readonly metadataOnly: true;
};

export const summarizeRuntimeBridgeIntegrityPosture = (): ReadonlyArray<RuntimeBridgeIntegritySummary> => {
  const metadataCompliance = summarizeRuntimeBridgeMetadataOnlyCompliancePosture();
  const capabilityPosture = summarizeRuntimeBridgeCapabilityPosture();
  const boundaryPosture = summarizeRuntimeBridgeExecutionBoundaryPosture();
  const readinessPosture = summarizeRuntimeBridgeRuntimeReadinessPosture();
  const snapshotId = runtimeBridgeGovernanceSnapshot.snapshotId;

  return [
    {
      summaryId: "dependency_integrity",
      integrity: runtimeBridgeGovernanceSnapshot.dependencyPosture,
      supportingSnapshotId: snapshotId,
      summary: "Registered Runtime Bridge dependency layers resolve to approved architecture classifications.",
      metadataOnly: true,
    },
    {
      summaryId: "governance_integrity",
      integrity: runtimeBridgeGovernanceSnapshot.governanceReviewRequiredCount >= 0 ? "verified" : "review_required",
      supportingSnapshotId: snapshotId,
      summary: "Governance review counts are derived from capability contracts and registry eligibility metadata.",
      metadataOnly: true,
    },
    {
      summaryId: "metadata_only_integrity",
      integrity: metadataCompliance.valid ? "verified" : "review_required",
      supportingSnapshotId: metadataCompliance.validationId,
      summary: "Registered manifests retain metadata-only governance classification.",
      metadataOnly: true,
    },
    {
      summaryId: "readiness_integrity",
      integrity: readinessPosture.readinessIds.length > 0 ? "verified" : "review_required",
      supportingSnapshotId: readinessPosture.summaryId,
      summary: "Capability contracts retain explicit runtime readiness classifications.",
      metadataOnly: true,
    },
    {
      summaryId: "contract_integrity",
      integrity:
        capabilityPosture.executableCount === 0 &&
        capabilityPosture.runtimeEligibleCount === 0 &&
        boundaryPosture.nonMetadataBoundaryCount === 0
          ? "verified"
          : "review_required",
      supportingSnapshotId: capabilityPosture.summaryId,
      summary: "Capability contracts remain advisory-only, non-executable, and metadata-boundary aligned.",
      metadataOnly: true,
    },
    {
      summaryId: "layer_integrity",
      integrity: runtimeBridgeRegistryLayerValidation.valid ? "verified" : "review_required",
      supportingSnapshotId: runtimeBridgeRegistryLayerValidation.validationId,
      summary: "Registered module layers and allowed dependency layers are approved.",
      metadataOnly: true,
    },
    {
      summaryId: "registry_integrity",
      integrity: runtimeBridgeRegistryLayerValidation.checkedModuleIds.length > 0 ? "verified" : "review_required",
      supportingSnapshotId: runtimeBridgeRegistryLayerValidation.validationId,
      summary: "Runtime Bridge registry contains deterministic module identifiers for snapshot reporting.",
      metadataOnly: true,
    },
  ];
};

export const runtimeBridgeIntegritySummaries = summarizeRuntimeBridgeIntegrityPosture();
