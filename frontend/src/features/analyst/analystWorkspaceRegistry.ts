import { createElement } from "react";
import SqlAssistantRoutePage from "./sql/SqlAssistantRoutePage";
import SqlWorkspace from "./sql/SqlWorkspace";
import { createAnalystPlaceholderRenderer } from "./analystWorkspaceHelpers";
import type { AnalystWorkspaceDefinition } from "./analystWorkspaceTypes";

const placeholderWorkspaces = [
  {
    id: "savedQueries" as const,
    title: "Saved Queries",
    description: "Save repeatable analysis steps and reuse query definitions across sessions.",
    capabilities: ["Query library", "Reusable definitions", "Session-aware history"],
    requiresDataset: false,
    aiCapabilities: {
      plainEnglish: true,
      validation: true,
    },
  },
  {
    id: "queryExplain" as const,
    title: "Query Explain",
    description: "Validate query structure and explain how a result is produced before execution.",
    capabilities: ["Validation checks", "Execution explanation", "Risk warnings"],
    requiresDataset: false,
    aiCapabilities: {
      validation: true,
      plainEnglish: true,
    },
  },
  {
    id: "dataCleaning" as const,
    title: "Data Cleaning",
    description: "Prepare datasets with controlled transformations and calculated fields.",
    capabilities: ["Type cleanup", "Calculated columns", "Missing value handling"],
    requiresDataset: true,
    aiCapabilities: {
      cleaning: true,
      validation: true,
    },
  },
  {
    id: "diagnostics" as const,
    title: "Diagnostics",
    description: "Inspect relational quality, table design, keys, dependencies, and anomalies.",
    capabilities: ["Functional dependencies", "Anomaly detection", "Table design checks"],
    requiresDataset: true,
    aiCapabilities: {
      diagnostics: true,
      validation: true,
    },
  },
  {
    id: "normalization" as const,
    title: "Normalization",
    description: "Explore normalization guidance for 1NF, 2NF, and 3NF design improvements.",
    capabilities: ["1NF checks", "2NF checks", "3NF recommendations"],
    requiresDataset: true,
    aiCapabilities: {
      normalization: true,
      diagnostics: true,
    },
  },
];

export const analystWorkspaceRegistry: AnalystWorkspaceDefinition[] = [
  {
    id: "sqlWorkspace",
    title: "Inspect SQL",
    description: "Write, inspect, save, and manually run analyst-level SQL against the active source.",
    capabilities: ["SELECT workflows", "CTEs and subqueries", "Window functions"],
    modeRequirement: "analyst",
    requiresDataset: false,
    previewBadge: "Preview",
    aiCapabilities: {
      plainEnglish: true,
      validation: true,
    },
    renderer: ({
      dataset,
      onExecutionResult,
      sqlWorkspaceMetadata,
      onSqlWorkspaceMetadataChange,
      onWorksheetSelect,
      isSwitchingWorksheet,
      analysisScopeSelections,
      onAnalysisScopeSelectionsChange,
      onAnalystViewChange,
      onSqlAssistantModeChange,
    }) =>
      createElement(SqlWorkspace, {
        dataset,
        onExecutionResult,
        metadata: sqlWorkspaceMetadata,
        onMetadataChange: onSqlWorkspaceMetadataChange,
        onWorksheetSelect,
        isSwitchingWorksheet,
        analysisScopeSelections,
        onAnalysisScopeSelectionsChange,
        onAnalystViewChange,
        onSqlAssistantModeChange,
      }),
  },
  {
    id: "sqlTemplates",
    title: "Browse Templates",
    description: "Find deterministic SQL patterns and Complex SQL Assist before returning to Inspect SQL.",
    capabilities: ["Template Library", "Complex SQL Assist", "Manual review"],
    modeRequirement: "analyst",
    requiresDataset: false,
    previewBadge: "Preview",
    aiCapabilities: {
      plainEnglish: true,
      validation: true,
    },
    renderer: ({
      dataset,
      sqlWorkspaceMetadata,
      onSqlWorkspaceMetadataChange,
      onAnalystViewChange,
      requestedSqlAssistantMode,
    }) =>
      createElement(SqlAssistantRoutePage, {
        dataset,
        metadata: sqlWorkspaceMetadata,
        onMetadataChange: onSqlWorkspaceMetadataChange,
        kind: "templates",
        requestedMode: requestedSqlAssistantMode,
        onAnalystViewChange,
      }),
  },
  {
    id: "sqlReports",
    title: "Browse Reports",
    description: "Review deterministic report recipes and governed local metadata-only AI previews.",
    capabilities: ["Report Recipes", "AI local preview", "Manual review"],
    modeRequirement: "analyst",
    requiresDataset: false,
    previewBadge: "Preview",
    aiCapabilities: {
      plainEnglish: true,
      validation: true,
    },
    renderer: ({
      dataset,
      sqlWorkspaceMetadata,
      onSqlWorkspaceMetadataChange,
      onAnalystViewChange,
    }) =>
      createElement(SqlAssistantRoutePage, {
        dataset,
        metadata: sqlWorkspaceMetadata,
        onMetadataChange: onSqlWorkspaceMetadataChange,
        kind: "reports",
        requestedMode: "recipes",
        onAnalystViewChange,
      }),
  },
  ...placeholderWorkspaces.map((workspace) => ({
    ...workspace,
    modeRequirement: "analyst" as const,
    previewBadge: "Preview",
    renderer: createAnalystPlaceholderRenderer(workspace),
  })),
];
