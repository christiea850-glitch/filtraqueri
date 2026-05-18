export type NavigationRouteKind = "workspace" | "page" | "detail" | "subDetail";

export type NavigationRouteDepth = 1 | 2 | 3 | 4;

export type NavigationWorkspaceMode = "human" | "analyst";

export type NavigationOwningSurface =
  | "workspace_shell"
  | "dataset"
  | "filters"
  | "query_builder"
  | "results"
  | "history"
  | "export"
  | "settings"
  | "sql_workspace"
  | "analyst_workspace"
  | "future_consumer";

export type NavigationModeAccessRule = {
  readonly human: boolean;
  readonly analyst: boolean;
};

export type NavigationContextRequirements = {
  readonly requiresDataset: boolean;
  readonly requiresSession: boolean;
  readonly requiresWorkbook: boolean;
};

export type NavigationRouteRegistryEntry = {
  readonly routeId: string;
  readonly routeKind: NavigationRouteKind;
  readonly depth: NavigationRouteDepth;
  readonly owningSurface: NavigationOwningSurface;
  readonly modeAccess: NavigationModeAccessRule;
  readonly contextRequirements: NavigationContextRequirements;
  readonly protectedSurface: boolean;
  readonly label: string;
  readonly metadataOnly: true;
};

export type NavigationRouteReference = {
  readonly routeId: string;
  readonly routeKind: NavigationRouteKind;
  readonly depth: NavigationRouteDepth;
};

export const navigationMaxRouteDepth: NavigationRouteDepth = 4;

