import type { WorkspaceMode } from "../dataset/datasetTypes";
import type { SchemaColumn } from "../dataset/datasetTypes";
import type { ResultTabKey } from "../results/resultTypes";
import type { SqlWorkspaceMetadataSnapshot } from "../sqlWorkspacePersistence";

export type WorkspaceManifestDataset = {
  dataset_id: string;
  dataset_name: string;
  source_type: "uploaded" | "preview" | "execution-input" | "session-restored";
  uploaded_path: string;
  duckdb_path: string;
  schema: SchemaColumn[];
  row_count: number;
  column_count: number;
  created_at: string;
  workbook_metadata?: unknown;
};

export type WorkspaceManifest = {
  version: number;
  workspace_id: string;
  workspace_name: string;
  active_dataset_id: string | null;
  active_result_id: ResultTabKey | null;
  active_execution_id: string | null;
  current_mode: WorkspaceMode;
  current_result_tab: ResultTabKey;
  filter_metadata: Record<string, unknown>;
  query_builder_metadata: Record<string, unknown>;
  sql_workspace_metadata?: SqlWorkspaceMetadataSnapshot | null;
  workbook_metadata?: unknown;
  datasets: WorkspaceManifestDataset[];
  created_at: string;
  last_opened_at: string;
  updated_at: string;
};

export type WorkspaceManifestUpdate = Partial<
  Pick<
    WorkspaceManifest,
    | "workspace_name"
    | "active_dataset_id"
    | "active_result_id"
    | "active_execution_id"
    | "current_mode"
    | "current_result_tab"
    | "filter_metadata"
    | "query_builder_metadata"
    | "sql_workspace_metadata"
  >
>;
