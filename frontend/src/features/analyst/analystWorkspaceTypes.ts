import type { ReactNode } from "react";
import type { ActiveView, DatasetMetadata } from "../dataset/datasetTypes";

export type AnalystWorkspaceRenderContext = {
  dataset: DatasetMetadata | null;
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
