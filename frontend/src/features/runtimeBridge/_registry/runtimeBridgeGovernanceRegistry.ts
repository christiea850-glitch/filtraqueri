import {
  runtimeBridgeApprovedLayers,
  runtimeBridgeLayerRegistry,
  type RuntimeBridgeRegistryLayer,
} from "./runtimeBridgeLayerRegistry";
import {
  runtimeBridgeRegisteredModuleManifests,
  type RuntimeBridgeFutureRuntimeEligibility,
  type RuntimeBridgeModuleManifest,
  type RuntimeBridgeReviewStatus,
} from "./runtimeBridgeModuleManifest";

export type RuntimeBridgeRegistryValidation = {
  readonly validationId: string;
  readonly valid: boolean;
  readonly checkedModuleIds: ReadonlyArray<string>;
  readonly issueIds: ReadonlyArray<string>;
  readonly metadataOnly: true;
};

export type RuntimeBridgeGovernanceRegistrySummary = {
  readonly summaryId: string;
  readonly moduleCount: number;
  readonly layerIds: ReadonlyArray<RuntimeBridgeRegistryLayer>;
  readonly metadataOnlyCount: number;
  readonly reviewStatuses: ReadonlyArray<RuntimeBridgeReviewStatus>;
  readonly futureRuntimeEligibility: ReadonlyArray<RuntimeBridgeFutureRuntimeEligibility>;
  readonly summary: string;
  readonly metadataOnly: true;
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

const sortStable = <T extends string>(items: ReadonlyArray<T>): T[] =>
  uniqueStable(items).sort((left, right) => left.localeCompare(right));

export const collectRuntimeBridgeModuleManifests = (): ReadonlyArray<RuntimeBridgeModuleManifest> =>
  [...runtimeBridgeRegisteredModuleManifests].sort((left, right) => left.moduleId.localeCompare(right.moduleId));

export const validateRuntimeBridgeLayerRegistrations = (
  manifests: ReadonlyArray<RuntimeBridgeModuleManifest> = runtimeBridgeRegisteredModuleManifests,
): RuntimeBridgeRegistryValidation => {
  const approvedLayers = new Set<RuntimeBridgeRegistryLayer>(runtimeBridgeApprovedLayers);
  const issueIds = manifests.flatMap((manifest) => {
    const issues: string[] = [];

    if (!approvedLayers.has(manifest.layer)) {
      issues.push(`${manifest.moduleId}:unapproved-layer:${manifest.layer}`);
    }

    for (const dependencyLayer of manifest.allowedDependencyLayers) {
      if (!approvedLayers.has(dependencyLayer)) {
        issues.push(`${manifest.moduleId}:unapproved-dependency-layer:${dependencyLayer}`);
      }
    }

    if (!manifest.metadataOnly || manifest.governanceClassification !== "metadata_only") {
      issues.push(`${manifest.moduleId}:not-metadata-only`);
    }

    return issues;
  });

  return {
    validationId: "runtime-bridge-registry-layer-validation",
    valid: issueIds.length === 0,
    checkedModuleIds: manifests.map((manifest) => manifest.moduleId).sort((left, right) => left.localeCompare(right)),
    issueIds: sortStable(issueIds),
    metadataOnly: true,
  };
};

export const summarizeRuntimeBridgeGovernanceRegistryPosture = (
  manifests: ReadonlyArray<RuntimeBridgeModuleManifest> = runtimeBridgeRegisteredModuleManifests,
): RuntimeBridgeGovernanceRegistrySummary => {
  const layerIds = sortStable(manifests.map((manifest) => manifest.layer));
  const reviewStatuses = sortStable(manifests.map((manifest) => manifest.reviewStatus));
  const futureRuntimeEligibility = sortStable(manifests.map((manifest) => manifest.futureRuntimeEligibility));
  const metadataOnlyCount = manifests.filter(
    (manifest) => manifest.metadataOnly && manifest.governanceClassification === "metadata_only",
  ).length;

  return {
    summaryId: "runtime-bridge-governance-registry-posture",
    moduleCount: manifests.length,
    layerIds,
    metadataOnlyCount,
    reviewStatuses,
    futureRuntimeEligibility,
    summary: `${metadataOnlyCount} of ${manifests.length} registered Runtime Bridge manifests are metadata-only across ${layerIds.length} layers.`,
    metadataOnly: true,
  };
};

export const summarizeRuntimeBridgeRuntimeEligibilityPosture = (
  manifests: ReadonlyArray<RuntimeBridgeModuleManifest> = runtimeBridgeRegisteredModuleManifests,
): RuntimeBridgeGovernanceRegistrySummary => {
  const adapterCandidates = manifests.filter(
    (manifest) => manifest.futureRuntimeEligibility === "adapter_candidate",
  );
  const reviewRequired = manifests.filter((manifest) => manifest.futureRuntimeEligibility === "review_required");
  const metadataReferenceOnly = manifests.filter(
    (manifest) => manifest.futureRuntimeEligibility === "metadata_reference_only",
  );

  return {
    summaryId: "runtime-bridge-runtime-eligibility-posture",
    moduleCount: manifests.length,
    layerIds: sortStable(manifests.map((manifest) => manifest.layer)),
    metadataOnlyCount: metadataReferenceOnly.length,
    reviewStatuses: sortStable(manifests.map((manifest) => manifest.reviewStatus)),
    futureRuntimeEligibility: sortStable(manifests.map((manifest) => manifest.futureRuntimeEligibility)),
    summary: `${adapterCandidates.length} registered modules are adapter candidates, ${reviewRequired.length} require review, and ${metadataReferenceOnly.length} remain metadata reference only.`,
    metadataOnly: true,
  };
};

export const summarizeRuntimeBridgeMetadataOnlyCompliancePosture = (
  manifests: ReadonlyArray<RuntimeBridgeModuleManifest> = runtimeBridgeRegisteredModuleManifests,
): RuntimeBridgeRegistryValidation => {
  const issueIds = manifests
    .filter((manifest) => !manifest.metadataOnly || manifest.governanceClassification !== "metadata_only")
    .map((manifest) => `${manifest.moduleId}:metadata-only-compliance`);

  return {
    validationId: "runtime-bridge-metadata-only-compliance-posture",
    valid: issueIds.length === 0,
    checkedModuleIds: manifests.map((manifest) => manifest.moduleId).sort((left, right) => left.localeCompare(right)),
    issueIds: sortStable(issueIds),
    metadataOnly: true,
  };
};

export const runtimeBridgeRegistryGovernanceSummary = summarizeRuntimeBridgeGovernanceRegistryPosture();
export const runtimeBridgeRegistryLayerValidation = validateRuntimeBridgeLayerRegistrations();

export const runtimeBridgeRegisteredLayerIds = runtimeBridgeLayerRegistry.map((entry) => entry.layer);
