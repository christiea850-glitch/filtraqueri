import type { WorkspaceRegistryEntry } from "./workspaceRegistry";
import type { WorkspaceShellLifecycleState } from "./workspaceTypes";

export type WorkspaceUnsupportedState =
  | "missing_ownership_metadata"
  | "missing_preservation_metadata"
  | "invalid_readiness_combination"
  | "unsupported_activation_candidate";

export type WorkspaceReadinessSummary = {
  readonly summaryId: string;
  readonly workspaceId: string;
  readonly label: string;
  readonly lifecycleState: WorkspaceShellLifecycleState;
  readonly governanceReady: boolean;
  readonly inactive: boolean;
  readonly partiallyDefined: boolean;
  readonly futureCandidate: boolean;
  readonly permanentlyInert: boolean;
  readonly routeReady: boolean;
  readonly preservationReady: boolean;
  readonly integrityReady: boolean;
  readonly ownershipLinked: boolean;
  readonly preservationDescriptorLinked: boolean;
  readonly unsupportedStates: ReadonlyArray<WorkspaceUnsupportedState>;
  readonly activationCandidate: false;
  readonly metadataOnly: true;
};

const detectUnsupportedStates = (entry: WorkspaceRegistryEntry): ReadonlyArray<WorkspaceUnsupportedState> => {
  const unsupportedStates: WorkspaceUnsupportedState[] = [];

  if (!entry.ownership || entry.ownership.workspaceId !== entry.shell.workspaceId) {
    unsupportedStates.push("missing_ownership_metadata");
  }

  if (!entry.preservation || entry.preservation.workspaceId !== entry.shell.workspaceId) {
    unsupportedStates.push("missing_preservation_metadata");
  }

  if (entry.shell.routeReady && (!entry.shell.preservationReady || !entry.shell.integrityReady)) {
    unsupportedStates.push("invalid_readiness_combination");
  }

  if (entry.shell.active || entry.lifecycle.active || entry.readiness.active) {
    unsupportedStates.push("unsupported_activation_candidate");
  }

  return unsupportedStates.sort((left, right) => left.localeCompare(right));
};

export const summarizeWorkspaceReadinessEntry = (
  entry: WorkspaceRegistryEntry,
): WorkspaceReadinessSummary => ({
  summaryId: `workspace-readiness-summary:${entry.shell.workspaceId}`,
  workspaceId: entry.shell.workspaceId,
  label: entry.shell.label,
  lifecycleState: entry.shell.lifecycleState,
  governanceReady: entry.shell.lifecycleState === "governance_ready",
  inactive: entry.shell.lifecycleState === "inactive",
  partiallyDefined: entry.shell.lifecycleState === "partially_defined",
  futureCandidate: entry.shell.lifecycleState === "future_candidate",
  permanentlyInert: entry.shell.lifecycleState === "permanently_inert",
  routeReady: entry.shell.routeReady,
  preservationReady: entry.shell.preservationReady,
  integrityReady: entry.shell.integrityReady,
  ownershipLinked: entry.ownership.workspaceId === entry.shell.workspaceId,
  preservationDescriptorLinked: entry.preservation.workspaceId === entry.shell.workspaceId,
  unsupportedStates: detectUnsupportedStates(entry),
  activationCandidate: false,
  metadataOnly: true,
});

export const summarizeWorkspaceReadinessRegistry = (
  entries: ReadonlyArray<WorkspaceRegistryEntry>,
): ReadonlyArray<WorkspaceReadinessSummary> =>
  entries
    .map(summarizeWorkspaceReadinessEntry)
    .sort((left, right) => left.summaryId.localeCompare(right.summaryId));

export const workspaceReadinessSummaryVersion = "s5-4b-workspace-readiness-summary-v1";
