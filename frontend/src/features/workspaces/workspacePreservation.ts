import type { WorkspaceShellContract } from "./workspaceTypes";

export type WorkspacePreservationExpectation = {
  readonly workspaceId: string;
  readonly preservesDatasetContinuity: boolean;
  readonly preservesWorkbookContinuity: boolean;
  readonly preservesSessionContinuity: boolean;
  readonly preservesInvestigationContinuity: boolean;
  readonly preservesFilterContinuity: boolean;
  readonly preservesPaginationContinuity: boolean;
  readonly preservesActiveResultContinuity: boolean;
  readonly persistenceEngineActive: false;
  readonly metadataOnly: true;
};

export const createWorkspacePreservationExpectation = (
  workspace: WorkspaceShellContract,
): WorkspacePreservationExpectation => ({
  workspaceId: workspace.workspaceId,
  preservesDatasetContinuity: true,
  preservesWorkbookContinuity: workspace.category !== "analyst_workspace",
  preservesSessionContinuity: true,
  preservesInvestigationContinuity: workspace.category !== "future_workspace",
  preservesFilterContinuity: true,
  preservesPaginationContinuity: true,
  preservesActiveResultContinuity: workspace.category !== "future_workspace",
  persistenceEngineActive: false,
  metadataOnly: true,
});

export const workspacePreservationVersion = "s5-4a-workspace-preservation-v1";

