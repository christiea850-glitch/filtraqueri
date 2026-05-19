import type { WorkspaceGovernanceBoundary, WorkspaceShellContract } from "./workspaceTypes";

export type WorkspaceOwnershipDescriptor = WorkspaceGovernanceBoundary & {
  readonly routeOwnershipExpectation: "navigation-governed";
  readonly preservationOwnershipExpectation: "navigation-preservation-governed";
  readonly consumerOwnershipExpectation: "runtime-bridge-consumers-readonly";
  readonly runtimeBridgeIsolationExpectation: "runtime-bridge-metadata-only-isolated";
};

export const createWorkspaceOwnershipDescriptor = (
  workspace: WorkspaceShellContract,
): WorkspaceOwnershipDescriptor => ({
  workspaceId: workspace.workspaceId,
  ownsShellMetadata: true,
  ownsRouteExecution: false,
  ownsPreservationExecution: false,
  ownsConsumerTransforms: false,
  importsRuntimeBridge: false,
  rendersUi: false,
  executesWorkflows: false,
  persistsState: false,
  routeOwnershipExpectation: "navigation-governed",
  preservationOwnershipExpectation: "navigation-preservation-governed",
  consumerOwnershipExpectation: "runtime-bridge-consumers-readonly",
  runtimeBridgeIsolationExpectation: "runtime-bridge-metadata-only-isolated",
  metadataOnly: true,
});

export const workspaceOwnershipVersion = "s5-4a-workspace-ownership-v1";

