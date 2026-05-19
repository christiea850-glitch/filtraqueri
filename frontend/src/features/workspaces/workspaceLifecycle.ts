import type { WorkspaceShellContract, WorkspaceShellLifecycleState } from "./workspaceTypes";

export type WorkspaceLifecycleDescriptor = {
  readonly workspaceId: string;
  readonly lifecycleState: WorkspaceShellLifecycleState;
  readonly active: false;
  readonly workspaceRoutingActive: false;
  readonly orchestrationActive: false;
  readonly persistenceActive: false;
  readonly metadataOnly: true;
};

export const createWorkspaceLifecycleDescriptor = (
  workspace: WorkspaceShellContract,
): WorkspaceLifecycleDescriptor => ({
  workspaceId: workspace.workspaceId,
  lifecycleState: workspace.lifecycleState,
  active: false,
  workspaceRoutingActive: false,
  orchestrationActive: false,
  persistenceActive: false,
  metadataOnly: true,
});

export const workspaceLifecycleVersion = "s5-4a-workspace-lifecycle-v1";

