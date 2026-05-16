import type { ActiveView, WorkspaceMode } from "../../dataset/datasetTypes";

export type RuntimeContinuationCategory =
  | "optimize"
  | "forecast"
  | "investigate"
  | "monitor"
  | "compare"
  | "rerun"
  | "explain"
  | "export"
  | (string & {});

export type ContinuationReason = {
  reasonId: string;
  label: string;
  evidenceReferenceIds: string[];
};

export type ContinuationTarget = {
  targetType: "view" | "artifact" | "runtime_node" | "external" | (string & {});
  targetId: string;
  targetView?: ActiveView;
  targetMode?: WorkspaceMode;
};

export type ContinuationContext = {
  originNodeId: string | null;
  originArtifactId: string | null;
  parentInvestigationId: string | null;
  relatedNodeIds: string[];
  immutable: true;
};

export type ContinuationAction = {
  actionId: string;
  category: RuntimeContinuationCategory;
  label: string;
  executionNeutral: true;
};

export type ContinuationSuggestion = {
  continuationId: string;
  label: string;
  action: ContinuationAction;
  context: ContinuationContext;
  reason: ContinuationReason;
  target: ContinuationTarget;
  createdAt: string;
  uiSafe: true;
  executionNeutral: true;
};

export type RuntimeContinuationReference = {
  continuationId: string;
  category: RuntimeContinuationCategory;
  label: string;
  targetId: string;
  executionNeutral: true;
};
