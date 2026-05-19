import type { WorkspaceShellContract, WorkspaceShellLifecycleState } from "./workspaceTypes";

export type WorkspaceReadinessDescriptor = {
  readonly workspaceId: string;
  readonly readinessState: WorkspaceShellLifecycleState;
  readonly routeReady: boolean;
  readonly preservationReady: boolean;
  readonly integrityReady: boolean;
  readonly consumerReady: boolean;
  readonly futureWorkspaceRoutingReady: boolean;
  readonly active: false;
  readonly metadataOnly: true;
};

export const summarizeWorkspaceReadiness = (
  workspace: WorkspaceShellContract,
): WorkspaceReadinessDescriptor => ({
  workspaceId: workspace.workspaceId,
  readinessState: workspace.lifecycleState,
  routeReady: workspace.routeReady,
  preservationReady: workspace.preservationReady,
  integrityReady: workspace.integrityReady,
  consumerReady: workspace.lifecycleState !== "partially_defined",
  futureWorkspaceRoutingReady: workspace.routeReady && workspace.preservationReady && workspace.integrityReady,
  active: false,
  metadataOnly: true,
});

export const workspaceReadinessVersion = "s5-4a-workspace-readiness-v1";

