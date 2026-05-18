import type { NavigationRouteRegistryEntry } from "./navigationTypes";

const humanOnly = {
  human: true,
  analyst: false,
} as const;

const analystOnly = {
  human: false,
  analyst: true,
} as const;

const anyMode = {
  human: true,
  analyst: true,
} as const;

const noContext = {
  requiresDataset: false,
  requiresSession: false,
  requiresWorkbook: false,
} as const;

const datasetContext = {
  requiresDataset: true,
  requiresSession: true,
  requiresWorkbook: false,
} as const;

export const navigationRouteRegistry = [
  {
    routeId: "workspace:welcome",
    routeKind: "workspace",
    depth: 1,
    owningSurface: "workspace_shell",
    modeAccess: humanOnly,
    contextRequirements: noContext,
    protectedSurface: false,
    label: "Open data",
    metadataOnly: true,
  },
  {
    routeId: "page:dataset",
    routeKind: "page",
    depth: 2,
    owningSurface: "dataset",
    modeAccess: humanOnly,
    contextRequirements: noContext,
    protectedSurface: true,
    label: "Dataset",
    metadataOnly: true,
  },
  {
    routeId: "page:filters",
    routeKind: "page",
    depth: 2,
    owningSurface: "filters",
    modeAccess: humanOnly,
    contextRequirements: datasetContext,
    protectedSurface: true,
    label: "Filters",
    metadataOnly: true,
  },
  {
    routeId: "page:query-builder",
    routeKind: "page",
    depth: 2,
    owningSurface: "query_builder",
    modeAccess: humanOnly,
    contextRequirements: datasetContext,
    protectedSurface: true,
    label: "Build query",
    metadataOnly: true,
  },
  {
    routeId: "page:results",
    routeKind: "page",
    depth: 2,
    owningSurface: "results",
    modeAccess: anyMode,
    contextRequirements: datasetContext,
    protectedSurface: true,
    label: "Results",
    metadataOnly: true,
  },
  {
    routeId: "detail:pattern-preview",
    routeKind: "detail",
    depth: 3,
    owningSurface: "future_consumer",
    modeAccess: anyMode,
    contextRequirements: datasetContext,
    protectedSurface: false,
    label: "S5 Detail Pattern Preview",
    metadataOnly: true,
  },
  {
    routeId: "detail:results-insight",
    routeKind: "detail",
    depth: 3,
    owningSurface: "results",
    modeAccess: anyMode,
    contextRequirements: datasetContext,
    protectedSurface: false,
    label: "Results Insight Detail",
    metadataOnly: true,
  },
  {
    routeId: "page:history",
    routeKind: "page",
    depth: 2,
    owningSurface: "history",
    modeAccess: humanOnly,
    contextRequirements: datasetContext,
    protectedSurface: false,
    label: "Activity",
    metadataOnly: true,
  },
  {
    routeId: "page:export",
    routeKind: "page",
    depth: 2,
    owningSurface: "export",
    modeAccess: humanOnly,
    contextRequirements: datasetContext,
    protectedSurface: true,
    label: "Export",
    metadataOnly: true,
  },
  {
    routeId: "workspace:sql",
    routeKind: "workspace",
    depth: 1,
    owningSurface: "sql_workspace",
    modeAccess: analystOnly,
    contextRequirements: noContext,
    protectedSurface: true,
    label: "SQL Workspace",
    metadataOnly: true,
  },
  {
    routeId: "page:settings",
    routeKind: "page",
    depth: 2,
    owningSurface: "settings",
    modeAccess: anyMode,
    contextRequirements: noContext,
    protectedSurface: false,
    label: "Settings",
    metadataOnly: true,
  },
] as const satisfies ReadonlyArray<NavigationRouteRegistryEntry>;

export const navigationRouteRegistryVersion = "s5-2b-results-insight-detail-v1";

export const navigationRouteKindDepthLimits = {
  workspace: 1,
  page: 2,
  detail: 3,
  subDetail: 4,
} as const;
