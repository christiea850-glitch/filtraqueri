import { workspaceLifecycleVersion } from "./workspaceLifecycle";
import { workspaceOwnershipVersion } from "./workspaceOwnership";
import { workspacePreservationVersion } from "./workspacePreservation";
import { workspaceReadinessVersion } from "./workspaceReadiness";
import {
  workspaceGovernanceReport,
  workspaceGovernanceReportVersion,
} from "./workspaceGovernanceReport";
import { workspaceReadinessSummaryVersion } from "./workspaceReadinessSummary";
import { workspaceRegistryVersion } from "./workspaceRegistry";

export type WorkspaceGovernanceSnapshotPosture =
  | "workspace_governance_observable"
  | "workspace_governance_review_required";

export type WorkspaceGovernanceSnapshot = {
  readonly snapshotId: "workspace-governance-snapshot:s5-4b";
  readonly snapshotVersion: "s5-4b-workspace-governance-snapshot-v1";
  readonly registryVersions: {
    readonly workspaceRegistry: string;
    readonly workspaceLifecycle: string;
    readonly workspaceOwnership: string;
    readonly workspacePreservation: string;
    readonly workspaceReadiness: string;
    readonly workspaceReadinessSummary: string;
    readonly workspaceGovernanceReport: string;
  };
  readonly workspaceCount: number;
  readonly governanceReadyCount: number;
  readonly inactiveCount: number;
  readonly partiallyDefinedCount: number;
  readonly futureCandidateCount: number;
  readonly preservationReadyCount: number;
  readonly integrityReadyCount: number;
  readonly ownershipLinkedCount: number;
  readonly preservationLinkedCount: number;
  readonly unsupportedStateCount: number;
  readonly workspaceRoutingActive: false;
  readonly workspaceOrchestrationActive: false;
  readonly workspacePersistenceActive: false;
  readonly workspaceUiActive: false;
  readonly posture: WorkspaceGovernanceSnapshotPosture;
  readonly metadataOnly: true;
};

const unsupportedStateCount = workspaceGovernanceReport.unsupportedSummaries.length;

export const workspaceGovernanceSnapshot: WorkspaceGovernanceSnapshot = {
  snapshotId: "workspace-governance-snapshot:s5-4b",
  snapshotVersion: "s5-4b-workspace-governance-snapshot-v1",
  registryVersions: {
    workspaceRegistry: workspaceRegistryVersion,
    workspaceLifecycle: workspaceLifecycleVersion,
    workspaceOwnership: workspaceOwnershipVersion,
    workspacePreservation: workspacePreservationVersion,
    workspaceReadiness: workspaceReadinessVersion,
    workspaceReadinessSummary: workspaceReadinessSummaryVersion,
    workspaceGovernanceReport: workspaceGovernanceReportVersion,
  },
  workspaceCount: workspaceGovernanceReport.workspaceCount,
  governanceReadyCount: workspaceGovernanceReport.governanceReadyCount,
  inactiveCount: workspaceGovernanceReport.inactiveCount,
  partiallyDefinedCount: workspaceGovernanceReport.partiallyDefinedCount,
  futureCandidateCount: workspaceGovernanceReport.futureCandidateCount,
  preservationReadyCount: workspaceGovernanceReport.preservationReadyCount,
  integrityReadyCount: workspaceGovernanceReport.integrityReadyCount,
  ownershipLinkedCount: workspaceGovernanceReport.ownershipLinkedCount,
  preservationLinkedCount: workspaceGovernanceReport.preservationLinkedCount,
  unsupportedStateCount,
  workspaceRoutingActive: false,
  workspaceOrchestrationActive: false,
  workspacePersistenceActive: false,
  workspaceUiActive: false,
  posture:
    unsupportedStateCount === 0
      ? "workspace_governance_observable"
      : "workspace_governance_review_required",
  metadataOnly: true,
};

