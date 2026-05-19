import { workspaceRegistry } from "./workspaceRegistry";
import {
  summarizeWorkspaceReadinessRegistry,
  type WorkspaceReadinessSummary,
} from "./workspaceReadinessSummary";

export type WorkspaceGovernanceReport = {
  readonly reportId: "workspace-governance-report:s5-4b";
  readonly workspaceCount: number;
  readonly governanceReadyCount: number;
  readonly inactiveCount: number;
  readonly partiallyDefinedCount: number;
  readonly futureCandidateCount: number;
  readonly permanentlyInertCount: number;
  readonly preservationReadyCount: number;
  readonly integrityReadyCount: number;
  readonly ownershipLinkedCount: number;
  readonly preservationDescriptorLinkedCount: number;
  readonly unsupportedOwnershipStateCount: number;
  readonly unsupportedReadinessCombinationCount: number;
  readonly unsupportedActivationCandidateCount: number;
  readonly summaries: ReadonlyArray<WorkspaceReadinessSummary>;
  readonly unsupportedSummaries: ReadonlyArray<WorkspaceReadinessSummary>;
  readonly metadataOnly: true;
};

export const createWorkspaceGovernanceReport = (
  summaries: ReadonlyArray<WorkspaceReadinessSummary>,
): WorkspaceGovernanceReport => {
  const unsupportedSummaries = summaries.filter((summary) => summary.unsupportedStates.length > 0);

  return {
    reportId: "workspace-governance-report:s5-4b",
    workspaceCount: summaries.length,
    governanceReadyCount: summaries.filter((summary) => summary.governanceReady).length,
    inactiveCount: summaries.filter((summary) => summary.inactive).length,
    partiallyDefinedCount: summaries.filter((summary) => summary.partiallyDefined).length,
    futureCandidateCount: summaries.filter((summary) => summary.futureCandidate).length,
    permanentlyInertCount: summaries.filter((summary) => summary.permanentlyInert).length,
    preservationReadyCount: summaries.filter((summary) => summary.preservationReady).length,
    integrityReadyCount: summaries.filter((summary) => summary.integrityReady).length,
    ownershipLinkedCount: summaries.filter((summary) => summary.ownershipLinked).length,
    preservationDescriptorLinkedCount: summaries.filter((summary) => summary.preservationDescriptorLinked).length,
    unsupportedOwnershipStateCount: summaries.filter((summary) =>
      summary.unsupportedStates.includes("missing_ownership_metadata"),
    ).length,
    unsupportedReadinessCombinationCount: summaries.filter((summary) =>
      summary.unsupportedStates.includes("invalid_readiness_combination"),
    ).length,
    unsupportedActivationCandidateCount: summaries.filter((summary) =>
      summary.unsupportedStates.includes("unsupported_activation_candidate"),
    ).length,
    summaries,
    unsupportedSummaries,
    metadataOnly: true,
  };
};

export const workspaceGovernanceSummaries = summarizeWorkspaceReadinessRegistry(workspaceRegistry);

export const workspaceGovernanceReport = createWorkspaceGovernanceReport(workspaceGovernanceSummaries);

export const workspaceGovernanceReportVersion = "s5-4b-workspace-governance-report-v1";
