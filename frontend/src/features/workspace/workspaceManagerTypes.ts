export type WorkspaceStatus = "active" | "recoverable" | "stale" | "corrupted";

export type WorkspaceDatasetSummary = {
  dataset_id: string;
  dataset_name: string;
  row_count: number;
  column_count: number;
};

export type WorkspaceRecoveryMetadata = {
  can_recover: boolean;
  reason: string | null;
};

export type WorkspaceValidationMetadata = {
  is_valid: boolean;
  messages: string[];
};

export type WorkspaceManifestSummary = {
  workspace_id: string;
  workspace_name: string;
  created_at: string;
  last_opened_at: string;
  active_dataset: WorkspaceDatasetSummary | null;
  dataset_count: number;
  manifest_version: number | null;
  status: WorkspaceStatus;
  recovery: WorkspaceRecoveryMetadata;
  validation: WorkspaceValidationMetadata;
};

export type WorkspaceRecoveryDecision = {
  canRecover: boolean;
  workspaceId: string | null;
  messages: string[];
};
