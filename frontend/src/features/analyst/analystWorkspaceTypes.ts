import type { ReactNode } from "react";
import type { ActiveView, DatasetMetadata } from "../dataset/datasetTypes";
import type { WorkspaceExecutionResult } from "../execution/workspaceExecutionTypes";
import type { SqlWorkspaceMetadataSnapshot } from "../sqlWorkspacePersistence";

export type AnalystWorkspaceRenderContext = {
  dataset: DatasetMetadata | null;
  onExecutionResult?: (result: WorkspaceExecutionResult) => void;
  sqlWorkspaceMetadata?: SqlWorkspaceMetadataSnapshot;
  onSqlWorkspaceMetadataChange?: (metadata: SqlWorkspaceMetadataSnapshot) => void;
  onWorksheetSelect?: (worksheetId: string) => void;
  isSwitchingWorksheet?: boolean;
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
