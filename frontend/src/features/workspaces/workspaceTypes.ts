export type WorkspaceShellCategory =
  | "investigation_workspace"
  | "explainability_workspace"
  | "executive_workspace"
  | "analyst_workspace"
  | "orchestration_workspace"
  | "future_workspace";

export type WorkspaceShellLifecycleState =
  | "inactive"
  | "governance_ready"
  | "route_ready"
  | "preservation_ready"
  | "integrity_ready"
  | "partially_defined"
  | "future_candidate";

export type WorkspaceShellOwner =
  | "results"
  | "dataset"
  | "explainability"
  | "executive"
  | "analyst"
  | "orchestration"
  | "future_consumer";

export type WorkspaceShellContract = {
  readonly workspaceId: string;
  readonly category: WorkspaceShellCategory;
  readonly owner: WorkspaceShellOwner;
  readonly label: string;
  readonly lifecycleState: WorkspaceShellLifecycleState;
  readonly routeReady: boolean;
  readonly preservationReady: boolean;
  readonly integrityReady: boolean;
  readonly active: false;
  readonly metadataOnly: true;
};

export type WorkspaceGovernanceBoundary = {
  readonly workspaceId: string;
  readonly ownsShellMetadata: boolean;
  readonly ownsRouteExecution: false;
  readonly ownsPreservationExecution: false;
  readonly ownsConsumerTransforms: false;
  readonly importsRuntimeBridge: false;
  readonly rendersUi: false;
  readonly executesWorkflows: false;
  readonly persistsState: false;
  readonly metadataOnly: true;
};

