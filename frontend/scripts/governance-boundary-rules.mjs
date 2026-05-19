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

export const runtimeBridgeConsumerFolders = [
  "src/features/runtimeBridgeConsumers",
];

export const navigationFolders = [
  "src/features/navigation",
];

export const workspaceGovernanceFolders = [
  "src/features/workspaces",
];

export const controlledHashNavigationAllowedFiles = [
  "src/features/navigation/controlledHashDetailHelper.ts",
];

export const runtimeIntelligenceFolder = "src/features/runtimeIntelligence";

export const runtimeBridgeArchitectureLayers = {
  "src/features/runtimeBridge/_kernel": "kernel",
  "src/features/runtimeBridge/_contracts": "foundation",
  "src/features/runtimeBridge/_registry": "foundation",
  "src/features/runtimeBridge/_snapshots": "foundation",
  "src/features/runtimeBridge/runtimeAnalysisPackageAdapters": "foundation",
  "src/features/runtimeBridge/runtimeBridgeAdapters": "foundation",
  "src/features/runtimeBridge/runtimeBridgeArtifacts": "foundation",
  "src/features/runtimeBridge/runtimeBridgeBuilderTypes": "foundation",
  "src/features/runtimeBridge/runtimeBridgeComposition": "foundation",
  "src/features/runtimeBridge/runtimeBridgeEvents": "foundation",
  "src/features/runtimeBridge/runtimeBridgeGovernance": "foundation",
  "src/features/runtimeBridge/runtimeBridgeIds": "foundation",
  "src/features/runtimeBridge/runtimeBridgeIntegrity": "foundation",
  "src/features/runtimeBridge/runtimeBridgeLineage": "foundation",
  "src/features/runtimeBridge/runtimeBridgeNormalize": "foundation",
  "src/features/runtimeBridge/runtimeBridgeSnapshotBuilder": "foundation",
  "src/features/runtimeBridge/runtimeBridgeTypes": "foundation",
  "src/features/runtimeBridge/runtimeGraphAdapters": "foundation",
  "src/features/runtimeBridge/runtimeInvestigationWorkspaceAdapters": "foundation",
  "src/features/runtimeBridge/runtimeBridgeDecisionSupport": "intelligence",
  "src/features/runtimeBridge/runtimeBridgeExecutiveDeliveryIntelligence": "intelligence",
  "src/features/runtimeBridge/runtimeBridgeExecutiveRecommendations": "intelligence",
  "src/features/runtimeBridge/runtimeBridgeExplainability": "intelligence",
  "src/features/runtimeBridge/runtimeBridgeInsightInterpretation": "intelligence",
  "src/features/runtimeBridge/runtimeBridgeNarrativeIntelligence": "intelligence",
  "src/features/runtimeBridge/runtimeBridgeStrategicNarrativePackaging": "intelligence",
  "src/features/runtimeBridge/runtimeBridgeGovernanceIntelligenceConsolidation": "governance",
  "src/features/runtimeBridge/runtimeBridgeIntelligenceReviewGovernance": "governance",
  "src/features/runtimeBridge/runtimeBridgeDashboardNarrativeIntelligence": "visualization",
  "src/features/runtimeBridge/runtimeBridgeExecutiveDashboardComposition": "visualization",
  "src/features/runtimeBridge/runtimeBridgeExecutiveVisualizationStorytelling": "visualization",
  "src/features/runtimeBridge/runtimeBridgeVisualizationPlanning": "visualization",
  "src/features/runtimeBridge/runtimeBridgeExecutivePresentationOrchestration": "orchestration",
  "src/features/runtimeBridge/runtimeBridgeIntelligenceOrchestrationPlanning": "orchestration",
  "src/features/runtimeBridge/runtimeBridgeExecutiveDeliveryEcosystem": "federation",
  "src/features/runtimeBridge/runtimeBridgeEnterpriseIntelligenceFederation": "federation",
  "src/features/runtimeBridge/runtimeBridgeEnterpriseLifecycleContinuity": "lifecycle",
  "src/features/runtimeBridge/runtimeBridgeEnterpriseResilienceGovernance": "resilience",
  "src/features/runtimeBridge/runtimeBridgeEnterpriseObservabilityTraceability": "observability",
};

export const runtimeBridgeArchitectureLayerOrder = {
  kernel: 0,
  foundation: 1,
  intelligence: 2,
  visualization: 3,
  orchestration: 4,
  governance: 5,
  federation: 6,
  lifecycle: 7,
  resilience: 8,
  observability: 9,
};

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

export const runtimeBridgeConsumerForbiddenImports = {
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
  backend: [
    "src/services/api",
  ],
  execution: [
    "src/features/execution",
    "src/features/results/useResultExecutionCoordinator",
    "src/features/export",
    "src/features/dataset/useWorkspaceDatasetController",
    "src/features/analyst/sql/useSqlWorkspace",
    "src/services/api",
  ],
  persistence: [
    "src/features/workspace/workspacePersistence",
    "src/features/workspaceRuntime/runtimePersistence",
    "src/features/sqlWorkspacePersistence",
    "src/features/dataset/useDatasetSessions",
    "src/features/investigationWorkspace/workspaceSessionStorage",
  ],
  routingNavigationMutation: [
    "src/App",
    "src/features/navigation",
    "src/features/workspaceRuntime/runtimeNavigationAdapter",
    "src/features/workspaceRuntime/useWorkspaceRuntimeCoordinator",
    "src/components/layout/WorkspaceShell",
  ],
  io: [
    "fs",
    "node:fs",
    "node:fs/promises",
    "path",
    "node:path",
    "process",
    "node:process",
  ],
};

export const navigationForbiddenImports = {
  runtimeBridge: [
    "src/features/runtimeBridge",
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
  backend: [
    "src/services/api",
  ],
  execution: [
    "src/features/execution",
    "src/features/results/useResultExecutionCoordinator",
    "src/features/export",
    "src/features/dataset/useWorkspaceDatasetController",
    "src/features/analyst/sql/useSqlWorkspace",
    "src/services/api",
  ],
  persistence: [
    "src/features/workspace/workspacePersistence",
    "src/features/workspaceRuntime/runtimePersistence",
    "src/features/sqlWorkspacePersistence",
    "src/features/dataset/useDatasetSessions",
    "src/features/investigationWorkspace/workspaceSessionStorage",
  ],
};

export const workspaceGovernanceForbiddenImports = {
  runtimeBridge: [
    "src/features/runtimeBridge",
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
  backend: [
    "src/services/api",
  ],
  execution: [
    "src/features/execution",
    "src/features/results/useResultExecutionCoordinator",
    "src/features/export",
    "src/features/dataset/useWorkspaceDatasetController",
    "src/features/analyst/sql/useSqlWorkspace",
    "src/services/api",
  ],
  persistence: [
    "src/features/workspace/workspacePersistence",
    "src/features/workspaceRuntime/runtimePersistence",
    "src/features/sqlWorkspacePersistence",
    "src/features/dataset/useDatasetSessions",
    "src/features/investigationWorkspace/workspaceSessionStorage",
  ],
  navigationMutation: [
    "src/App",
    "src/features/navigation",
    "src/features/workspaceRuntime/runtimeNavigationAdapter",
    "src/features/workspaceRuntime/useWorkspaceRuntimeCoordinator",
    "src/components/layout/WorkspaceShell",
  ],
};


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
