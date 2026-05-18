import {
  collectRuntimeBridgeModuleManifests,
  runtimeBridgeLayerRegistry,
  summarizeRuntimeBridgeGovernanceRegistryPosture,
  summarizeRuntimeBridgeMetadataOnlyCompliancePosture,
  type RuntimeBridgeModuleManifest,
} from "../_registry";
import {
  runtimeBridgeCapabilityContracts,
  summarizeRuntimeBridgeCapabilityPosture,
  summarizeRuntimeBridgeExecutionBoundaryPosture,
  summarizeRuntimeBridgeRuntimeReadinessPosture,
  type RuntimeBridgeCapabilityContract,
} from "../_contracts";
import { runtimeBridgeMetadataOnlyCapabilityFlags } from "../_kernel";
import {
  runtimeBridgeArchitecturePostureDescriptors,
  type RuntimeBridgeArchitecturePosture,
} from "./runtimeBridgeArchitecturePosture";

export type RuntimeBridgeSnapshotPosture = "verified" | "review_required";

export type RuntimeBridgeGovernanceSnapshot = {
  readonly snapshotId: "runtime-bridge-governance-snapshot";
  readonly registeredLayerCount: number;
  readonly registeredManifestCount: number;
  readonly metadataOnlyComplianceCount: number;
  readonly advisoryOnlyCapabilityCount: number;
  readonly prohibitedCapabilityCount: number;
  readonly runtimeEligibleCount: number;
  readonly governanceReviewRequiredCount: number;
  readonly executionBoundaryPosture: RuntimeBridgeSnapshotPosture;
  readonly dependencyPosture: RuntimeBridgeSnapshotPosture;
  readonly deterministicCompliancePosture: RuntimeBridgeSnapshotPosture;
  readonly architecturePostures: ReadonlyArray<RuntimeBridgeArchitecturePosture>;
  readonly summary: string;
  readonly metadataOnly: true;
};

const sortedUnique = (items: ReadonlyArray<string>): string[] =>
  [...new Set(items.filter(Boolean))].sort((left, right) => left.localeCompare(right));

export const createRuntimeBridgeGovernanceSnapshot = (
  manifests: ReadonlyArray<RuntimeBridgeModuleManifest> = collectRuntimeBridgeModuleManifests(),
  contracts: ReadonlyArray<RuntimeBridgeCapabilityContract> = runtimeBridgeCapabilityContracts,
): RuntimeBridgeGovernanceSnapshot => {
  const registryPosture = summarizeRuntimeBridgeGovernanceRegistryPosture(manifests);
  const metadataCompliance = summarizeRuntimeBridgeMetadataOnlyCompliancePosture(manifests);
  const capabilityPosture = summarizeRuntimeBridgeCapabilityPosture(contracts);
  const boundaryPosture = summarizeRuntimeBridgeExecutionBoundaryPosture(contracts);
  const readinessPosture = summarizeRuntimeBridgeRuntimeReadinessPosture(contracts);
  const prohibitedCapabilities = sortedUnique([
    ...manifests.flatMap((manifest) => manifest.prohibitedCapabilities),
    ...contracts.flatMap((contract) => contract.prohibitedRuntimeCapabilities),
  ]);
  const registryLayerIds = new Set(runtimeBridgeLayerRegistry.map((entry) => entry.layer));
  const dependencyPosture =
    manifests.every((manifest) => registryLayerIds.has(manifest.layer)) && registryPosture.layerIds.length > 0
      ? "verified"
      : "review_required";
  const runtimeEligibleCount = capabilityPosture.runtimeEligibleCount;
  const governanceReviewRequiredCount =
    contracts.filter((contract) => contract.governanceRequired || contract.reviewRequired).length +
    manifests.filter((manifest) => manifest.futureRuntimeEligibility !== "metadata_reference_only").length;
  const deterministicCompliancePosture =
    metadataCompliance.valid &&
    capabilityPosture.executableCount === 0 &&
    boundaryPosture.nonMetadataBoundaryCount === 0 &&
    readinessPosture.readinessIds.length > 0 &&
    !runtimeBridgeMetadataOnlyCapabilityFlags.canExecute &&
    !runtimeBridgeMetadataOnlyCapabilityFlags.canMutateWorkspace &&
    !runtimeBridgeMetadataOnlyCapabilityFlags.canCallBackend
      ? "verified"
      : "review_required";

  return {
    snapshotId: "runtime-bridge-governance-snapshot",
    registeredLayerCount: registryPosture.layerIds.length,
    registeredManifestCount: manifests.length,
    metadataOnlyComplianceCount: registryPosture.metadataOnlyCount,
    advisoryOnlyCapabilityCount: capabilityPosture.advisoryOnlyCount,
    prohibitedCapabilityCount: prohibitedCapabilities.length,
    runtimeEligibleCount,
    governanceReviewRequiredCount,
    executionBoundaryPosture: boundaryPosture.nonMetadataBoundaryCount === 0 ? "verified" : "review_required",
    dependencyPosture,
    deterministicCompliancePosture,
    architecturePostures: runtimeBridgeArchitecturePostureDescriptors.map((descriptor) => descriptor.postureId),
    summary: `${registryPosture.metadataOnlyCount} of ${manifests.length} manifests and ${capabilityPosture.advisoryOnlyCount} of ${contracts.length} capability contracts are metadata-only advisory governance descriptors.`,
    metadataOnly: true,
  };
};

export const runtimeBridgeGovernanceSnapshot = createRuntimeBridgeGovernanceSnapshot();
