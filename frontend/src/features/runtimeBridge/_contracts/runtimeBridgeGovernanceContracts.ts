import { runtimeBridgeCapabilityContracts, type RuntimeBridgeCapabilityContract } from "./runtimeBridgeCapabilityContracts";
import type { RuntimeBridgeExecutionBoundaryKind } from "./runtimeBridgeExecutionBoundaries";
import type { RuntimeBridgeRuntimeReadinessClassification } from "./runtimeBridgeRuntimeReadiness";

export type RuntimeBridgeCapabilityPostureSummary = {
  readonly summaryId: string;
  readonly contractCount: number;
  readonly advisoryOnlyCount: number;
  readonly executableCount: number;
  readonly runtimeEligibleCount: number;
  readonly deterministicOnlyCount: number;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeReadinessPostureSummary = {
  readonly summaryId: string;
  readonly readinessIds: ReadonlyArray<RuntimeBridgeRuntimeReadinessClassification>;
  readonly contractIds: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeBoundaryPostureSummary = {
  readonly summaryId: string;
  readonly boundaryIds: ReadonlyArray<RuntimeBridgeExecutionBoundaryKind>;
  readonly metadataBoundaryCount: number;
  readonly nonMetadataBoundaryCount: number;
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

const sortedUnique = <T extends string>(items: ReadonlyArray<T>): T[] =>
  uniqueStable(items).sort((left, right) => left.localeCompare(right));

export const summarizeRuntimeBridgeCapabilityPosture = (
  contracts: ReadonlyArray<RuntimeBridgeCapabilityContract> = runtimeBridgeCapabilityContracts,
): RuntimeBridgeCapabilityPostureSummary => {
  const advisoryOnlyCount = contracts.filter((contract) => contract.advisoryOnly).length;
  const executableCount = contracts.filter((contract) => contract.executable).length;
  const runtimeEligibleCount = contracts.filter((contract) => contract.runtimeEligible).length;
  const deterministicOnlyCount = contracts.filter((contract) => contract.deterministicOnly).length;

  return {
    summaryId: "runtime-bridge-capability-posture",
    contractCount: contracts.length,
    advisoryOnlyCount,
    executableCount,
    runtimeEligibleCount,
    deterministicOnlyCount,
    summary: `${advisoryOnlyCount} of ${contracts.length} Runtime Bridge capability contracts are advisory-only; ${executableCount} are executable.`,
    metadataOnly: true,
  };
};

export const summarizeRuntimeBridgeRuntimeReadinessPosture = (
  contracts: ReadonlyArray<RuntimeBridgeCapabilityContract> = runtimeBridgeCapabilityContracts,
): RuntimeBridgeReadinessPostureSummary => ({
  summaryId: "runtime-bridge-runtime-readiness-posture",
  readinessIds: sortedUnique(contracts.map((contract) => contract.readiness)),
  contractIds: contracts.map((contract) => contract.capabilityId).sort((left, right) => left.localeCompare(right)),
  summary: `${contracts.length} Runtime Bridge capability contracts remain classified through metadata-only readiness descriptors.`,
  metadataOnly: true,
});

export const summarizeRuntimeBridgeExecutionBoundaryPosture = (
  contracts: ReadonlyArray<RuntimeBridgeCapabilityContract> = runtimeBridgeCapabilityContracts,
): RuntimeBridgeBoundaryPostureSummary => {
  const boundaryIds = sortedUnique(contracts.map((contract) => contract.executionBoundary));
  const metadataBoundaryCount = contracts.filter((contract) => contract.executionBoundary === "metadata_boundary").length;
  const nonMetadataBoundaryCount = contracts.length - metadataBoundaryCount;

  return {
    summaryId: "runtime-bridge-execution-boundary-posture",
    boundaryIds,
    metadataBoundaryCount,
    nonMetadataBoundaryCount,
    summary: `${metadataBoundaryCount} of ${contracts.length} Runtime Bridge contracts use metadata boundaries.`,
    metadataOnly: true,
  };
};

export const summarizeRuntimeBridgeGovernanceEnforcementPosture = (
  contracts: ReadonlyArray<RuntimeBridgeCapabilityContract> = runtimeBridgeCapabilityContracts,
): RuntimeBridgeCapabilityPostureSummary => {
  const governanceRequired = contracts.filter((contract) => contract.governanceRequired).length;
  const reviewRequired = contracts.filter((contract) => contract.reviewRequired).length;
  const executableCount = contracts.filter((contract) => contract.executable).length;

  return {
    summaryId: "runtime-bridge-governance-enforcement-posture",
    contractCount: contracts.length,
    advisoryOnlyCount: governanceRequired,
    executableCount,
    runtimeEligibleCount: reviewRequired,
    deterministicOnlyCount: contracts.filter((contract) => contract.deterministicOnly).length,
    summary: `${governanceRequired} contracts require governance review and ${reviewRequired} require explicit future review; ${executableCount} are executable.`,
    metadataOnly: true,
  };
};

export const collectRuntimeBridgeProhibitedRuntimeCapabilities = (
  contracts: ReadonlyArray<RuntimeBridgeCapabilityContract> = runtimeBridgeCapabilityContracts,
): ReadonlyArray<string> =>
  sortedUnique(contracts.flatMap((contract) => contract.prohibitedRuntimeCapabilities));

export const collectRuntimeBridgeAdvisoryOnlyCapabilities = (
  contracts: ReadonlyArray<RuntimeBridgeCapabilityContract> = runtimeBridgeCapabilityContracts,
): ReadonlyArray<RuntimeBridgeCapabilityContract> =>
  contracts
    .filter((contract) => contract.advisoryOnly)
    .sort((left, right) => left.capabilityId.localeCompare(right.capabilityId));

export const runtimeBridgeCapabilityPostureSummary = summarizeRuntimeBridgeCapabilityPosture();
export const runtimeBridgeRuntimeReadinessPostureSummary = summarizeRuntimeBridgeRuntimeReadinessPosture();
export const runtimeBridgeExecutionBoundaryPostureSummary = summarizeRuntimeBridgeExecutionBoundaryPosture();
