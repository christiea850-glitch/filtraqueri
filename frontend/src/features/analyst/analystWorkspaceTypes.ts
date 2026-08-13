import type { ReactNode } from "react";
import type { ActiveView, DatasetMetadata } from "../dataset/datasetTypes";
import type { WorkspaceExecutionResult } from "../execution/workspaceExecutionTypes";
import type { SqlWorkspaceMetadataSnapshot } from "../sqlWorkspacePersistence";
import type { AnalysisScopeSelection } from "../workbook";
import type { SqlAssistantMode } from "./sql/SqlAssistantPanel";
import type { SqlQuestionHandoff } from "./sql/sqlTypes";

export type AnalystNavigationContext = {
  sqlAssistantOrigin?: "sql-context-task-assist";
};

export type AnalystWorkspaceRenderContext = {
  dataset: DatasetMetadata | null;
  onExecutionResult?: (result: WorkspaceExecutionResult) => void;
  sqlWorkspaceMetadata?: SqlWorkspaceMetadataSnapshot;
  onSqlWorkspaceMetadataChange?: (metadata: SqlWorkspaceMetadataSnapshot) => void;
  onWorksheetSelect?: (worksheetId: string) => void;
  isSwitchingWorksheet?: boolean;
  analysisScopeSelections?: AnalysisScopeSelection[];
  onAnalysisScopeSelectionsChange?: (selections: AnalysisScopeSelection[]) => void;
  onAnalystViewChange?: (view: ActiveView, context?: AnalystNavigationContext) => void;
  requestedSqlAssistantMode?: SqlAssistantMode | null;
  onSqlAssistantModeChange?: (mode: SqlAssistantMode | null) => void;
  sqlAssistantOrigin?: AnalystNavigationContext["sqlAssistantOrigin"];
  questionHandoff?: SqlQuestionHandoff | null;
  onQuestionHandoffConsumed?: (handoffId: string) => void;
};

export type AnalystAiCapabilityFlags = {
  plainEnglish?: boolean;
  validation?: boolean;
  diagnostics?: boolean;
  normalization?: boolean;
  cleaning?: boolean;
};

export type AnalystWorkspaceDefinition = {
  id: ActiveView;
  title: string;
  description: string;
  capabilities: string[];
  modeRequirement: "analyst";
  requiresDataset: boolean;
  previewBadge: string;
  aiCapabilities: AnalystAiCapabilityFlags;
  renderer: (context: AnalystWorkspaceRenderContext) => ReactNode;
};

export type AnalystWorkspaceNavItem = {
  view: ActiveView;
  label: string;
  previewBadge: string;
};
