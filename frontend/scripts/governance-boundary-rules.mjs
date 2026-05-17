export const advisoryFeatureFolders = [
  "src/features/narrativeIntelligence",
  "src/features/workflowRecommendations",
  "src/features/businessSemantics",
  "src/features/dataIntelligence",
  "src/features/investigationIntelligence",
  "src/features/analysisPackages",
  "src/features/analysisPlan",
  "src/features/analyticsPlanning",
  "src/features/analyticsIntentGraph",
  "src/features/businessQuestionIntelligence",
  "src/features/kpiIntelligence",
  "src/features/planningReadiness",
  "src/features/relationshipAwarePlanning",
  "src/features/taskPlanPreview",
  "src/features/explanations",
  "src/features/engineAdapters",
  "src/features/sqlIntelligence",
  "src/features/workbookIntelligence",
  "src/features/workbookRelationships",
];

export const runtimeMetadataFolders = [
  "src/features/runtimeBridge",
  "src/features/runtimeIntelligence",
];

export const runtimeIntelligenceFolder = "src/features/runtimeIntelligence";

export const continuationMetadataFolders = [
  "src/features/runtimeIntelligence/continuations",
  "src/features/narrativeIntelligence",
  "src/features/investigationWorkspace",
  "src/features/analysisPackages",
];

export const presentationalFolders = [
  "src/components",
  "src/features/tasksLauncher",
];

export const presentationalFiles = [
  "src/features/workspaceRuntime/RuntimeDisclosureSlot.tsx",
];

export const executableImportTargets = [
  "src/features/execution/executeWorkspaceQuery",
  "src/features/export/useExportController",
  "src/features/results/useResultExecutionCoordinator",
  "src/features/dataset/useWorkspaceDatasetController",
  "src/features/dataset/useDatasetSessions",
  "src/features/workspaceRuntime/runtimePersistence",
  "src/features/analyst/sql/useSqlWorkspace",
  "src/services/api",
];

export const advisoryHardFailImportTargets = [
  "src/features/execution/executeWorkspaceQuery",
  "src/services/api",
];

export const runtimeMetadataForbiddenImports = {
  backend: [
    "src/services/api",
  ],
  react: [
    "react",
    "react-dom",
    "react-dom/client",
  ],
  chartRendering: [
    "d3",
    "recharts",
    "chart.js",
    "chartjs",
    "react-chartjs-2",
  ],
  persistence: [
    "src/features/workspace/workspacePersistence",
    "src/features/workspaceRuntime/runtimePersistence",
    "src/features/sqlWorkspacePersistence",
    "src/features/dataset/useDatasetSessions",
    "src/features/investigationWorkspace/workspaceSessionStorage",
  ],
  execution: [
    "src/features/execution",
    "src/features/results/useResultExecutionCoordinator",
    "src/features/export",
    "src/features/dataset/useWorkspaceDatasetController",
    "src/features/analyst/sql/useSqlWorkspace",
    "src/services/api",
  ],
};

export const presentationalForbiddenImports = [
  "src/services/api",
  "src/features/execution",
  "src/features/export/useExportController",
  "src/features/results/useResultExecutionCoordinator",
  "src/features/dataset/useWorkspaceDatasetController",
  "src/features/dataset/useDatasetSessions",
  "src/features/workspaceRuntime/runtimePersistence",
  "src/features/workspace/workspacePersistence",
  "src/features/sqlWorkspacePersistence",
  "src/features/analyst/sql/useSqlWorkspace",
];

export const continuationCallbackFieldNames = [
  "callback",
  "handler",
  "onClick",
  "onRun",
  "onExecute",
  "execute",
  "run",
  "dispatch",
  "mutation",
  "effect",
];

export const allowedBoundaryWarnings = [
  // Keep this list path-specific. Example:
  // {
  //   rule: "advisory-import-executable",
  //   file: "src/features/example/example.ts",
  //   importTarget: "src/features/example/types",
  //   reason: "Type-only domain contract import.",
  // },
];

export const allowedBoundaryErrors = [
  // Keep hard-fail exceptions even narrower than warnings. Example:
  // {
  //   rule: "advisory-import-backend-execution",
  //   file: "src/features/example/example.ts",
  //   importTarget: "src/services/api",
  //   reason: "Temporary migration exception with owner approval.",
  // },
];
