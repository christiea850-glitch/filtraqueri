import type {
  BoundaryOwnershipReference,
  CapabilityMode,
  ProtectedSurfaceId,
  SideEffectKind,
} from "./boundaryTypes";

export type SideEffectOwnershipContract = {
  readonly sideEffect: SideEffectKind;
  readonly owner: BoundaryOwnershipReference;
  readonly mode: Extract<CapabilityMode, "executable" | "persistence" | "hybrid">;
  readonly protectedSurface?: ProtectedSurfaceId;
  readonly requiresUserAction: boolean;
  readonly advisoryModulesMayTrigger: false;
  readonly notes: string;
};

export const protectedExecutableSurfaces: ReadonlyArray<ProtectedSurfaceId> = [
  "executeWorkspaceQuery",
  "ResultsGrid",
  "ActiveResultModel",
  "useResultExecutionCoordinator",
  "useExportController",
  "useWorkspaceDatasetController",
  "useWorkspaceRuntimeCoordinator",
  "SqlWorkspace",
  "MonacoEditor",
  "workbookSessionRestore",
  "runtimePersistence",
  "runtimeIntelligenceGraph",
  "narrativeIntelligence",
];

export const sideEffectOwnershipContracts: ReadonlyArray<SideEffectOwnershipContract> = [
  {
    sideEffect: "backend_query",
    owner: {
      ownerId: "workspace-query-execution",
      ownerName: "executeWorkspaceQuery",
      featurePath: "frontend/src/features/execution/executeWorkspaceQuery.ts",
    },
    mode: "executable",
    protectedSurface: "executeWorkspaceQuery",
    requiresUserAction: true,
    advisoryModulesMayTrigger: false,
    notes: "Only approved executable coordinators should call backend query execution.",
  },
  {
    sideEffect: "result_mutation",
    owner: {
      ownerId: "result-execution-coordinator",
      ownerName: "useResultExecutionCoordinator",
      featurePath: "frontend/src/features/results/useResultExecutionCoordinator.ts",
    },
    mode: "executable",
    protectedSurface: "useResultExecutionCoordinator",
    requiresUserAction: true,
    advisoryModulesMayTrigger: false,
    notes: "Result mutation, activation, pagination, sorting, filtering, and query result updates stay with the result execution owner.",
  },
  {
    sideEffect: "export_download",
    owner: {
      ownerId: "export-controller",
      ownerName: "useExportController",
      featurePath: "frontend/src/features/export/useExportController.ts",
    },
    mode: "executable",
    protectedSurface: "useExportController",
    requiresUserAction: true,
    advisoryModulesMayTrigger: false,
    notes: "Advisory recommendations may mention export readiness but cannot initiate downloads.",
  },
  {
    sideEffect: "sql_execution",
    owner: {
      ownerId: "sql-workspace",
      ownerName: "SQL Workspace",
      featurePath: "frontend/src/features/analyst/sql",
    },
    mode: "hybrid",
    protectedSurface: "SqlWorkspace",
    requiresUserAction: true,
    advisoryModulesMayTrigger: false,
    notes: "SQL intelligence may validate or explain SQL, but execution remains owned by the SQL workspace.",
  },
  {
    sideEffect: "session_restore",
    owner: {
      ownerId: "dataset-controller",
      ownerName: "useWorkspaceDatasetController",
      featurePath: "frontend/src/features/dataset/useWorkspaceDatasetController.ts",
    },
    mode: "hybrid",
    protectedSurface: "workbookSessionRestore",
    requiresUserAction: false,
    advisoryModulesMayTrigger: false,
    notes: "Session and workbook restore behavior remains isolated from advisory intelligence.",
  },
  {
    sideEffect: "runtime_persistence",
    owner: {
      ownerId: "runtime-coordinator",
      ownerName: "useWorkspaceRuntimeCoordinator",
      featurePath: "frontend/src/features/workspaceRuntime/useWorkspaceRuntimeCoordinator.ts",
    },
    mode: "persistence",
    protectedSurface: "runtimePersistence",
    requiresUserAction: false,
    advisoryModulesMayTrigger: false,
    notes: "Runtime persistence stores UI/runtime context state; runtime intelligence graph contracts remain metadata-only.",
  },
];

export const advisoryOnlyFeaturePaths: ReadonlyArray<string> = [
  "frontend/src/features/narrativeIntelligence",
  "frontend/src/features/workflowRecommendations",
  "frontend/src/features/businessSemantics",
  "frontend/src/features/dataIntelligence",
  "frontend/src/features/investigationIntelligence",
  "frontend/src/features/analysisPackages",
  "frontend/src/features/analysisPlan",
  "frontend/src/features/analyticsPlanning",
  "frontend/src/features/analyticsIntentGraph",
  "frontend/src/features/businessQuestionIntelligence",
  "frontend/src/features/kpiIntelligence",
  "frontend/src/features/planningReadiness",
  "frontend/src/features/relationshipAwarePlanning",
  "frontend/src/features/taskPlanPreview",
  "frontend/src/features/explanations",
  "frontend/src/features/engineAdapters",
  "frontend/src/features/sqlIntelligence",
  "frontend/src/features/workbookIntelligence",
  "frontend/src/features/workbookRelationships",
];

export const metadataOnlyFeaturePaths: ReadonlyArray<string> = [
  "frontend/src/features/runtimeIntelligence",
  "frontend/src/features/runtimeIntelligence/contracts",
  "frontend/src/features/runtimeIntelligence/graph",
  "frontend/src/features/runtimeIntelligence/continuations",
  "frontend/src/features/runtimeIntelligence/confidence",
  "frontend/src/features/runtimeIntelligence/events",
  "frontend/src/features/runtimeIntelligence/artifacts",
];

export const hybridFeaturePaths: ReadonlyArray<string> = [
  "frontend/src/App.tsx",
  "frontend/src/features/workspaceRuntime/useWorkspaceRuntimeCoordinator.ts",
  "frontend/src/features/results/useResultExecutionCoordinator.ts",
  "frontend/src/features/dataset/useWorkspaceDatasetController.ts",
  "frontend/src/features/analyst/sql",
  "frontend/src/features/investigationWorkspace",
];
