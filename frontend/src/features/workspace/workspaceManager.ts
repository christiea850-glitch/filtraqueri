import type { WorkspaceManifest } from "./workspaceManifestTypes";
import type {
  WorkspaceManifestSummary,
  WorkspaceRecoveryDecision,
  WorkspaceStatus,
} from "./workspaceManagerTypes";

const safeTimestamp = (value: string | null | undefined) => {
  const timestamp = value ? Date.parse(value) : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
};

export const sortWorkspacesByRecent = (
  workspaces: WorkspaceManifestSummary[],
): WorkspaceManifestSummary[] =>
  [...workspaces].sort(
    (left, right) =>
      safeTimestamp(right.last_opened_at || right.created_at) -
      safeTimestamp(left.last_opened_at || left.created_at),
  );

export const markActiveWorkspaceSummary = (
  summary: WorkspaceManifestSummary,
  activeWorkspaceId: string | null,
): WorkspaceManifestSummary => ({
  ...summary,
  status:
    activeWorkspaceId && summary.workspace_id === activeWorkspaceId && summary.recovery.can_recover
      ? "active"
      : summary.status,
});

export const listSavedWorkspaces = (
  workspaces: WorkspaceManifestSummary[],
  activeWorkspaceId: string | null = null,
): WorkspaceManifestSummary[] =>
  sortWorkspacesByRecent(
    workspaces.map((workspace) => markActiveWorkspaceSummary(workspace, activeWorkspaceId)),
  );

export const getWorkspaceManifestSummary = (
  manifest: WorkspaceManifest,
  activeWorkspaceId: string | null = null,
): WorkspaceManifestSummary => {
  const activeDataset =
    manifest.datasets.find((dataset) => dataset.dataset_id === manifest.active_dataset_id) ||
    manifest.datasets[0] ||
    null;
  const validation = validateManifestHealth(manifest);
  const status: WorkspaceStatus =
    activeWorkspaceId === manifest.workspace_id && validation.is_valid
      ? "active"
      : validation.is_valid
        ? "recoverable"
        : "stale";

  return {
    workspace_id: manifest.workspace_id,
    workspace_name: manifest.workspace_name || activeDataset?.dataset_name || "Untitled workspace",
    created_at: manifest.created_at,
    last_opened_at: manifest.last_opened_at || manifest.updated_at,
    active_dataset: activeDataset
      ? {
          dataset_id: activeDataset.dataset_id,
          dataset_name: activeDataset.dataset_name,
          row_count: activeDataset.row_count,
          column_count: activeDataset.column_count,
        }
      : null,
    dataset_count: manifest.datasets.length,
    manifest_version: manifest.version,
    status,
    recovery: {
      can_recover: validation.is_valid,
      reason: validation.messages[0] || null,
    },
    validation,
  };
};

export const setActiveWorkspace = (
  workspaces: WorkspaceManifestSummary[],
  workspaceId: string,
): WorkspaceManifestSummary[] =>
  listSavedWorkspaces(workspaces, workspaceId);

export const renameWorkspaceSafely = (name: string, fallbackName: string) => {
  const trimmedName = name.trim();
  return trimmedName ? trimmedName.slice(0, 120) : fallbackName;
};

export const removeStaleWorkspace = (
  workspaces: WorkspaceManifestSummary[],
  workspaceId: string,
) => workspaces.filter((workspace) => workspace.workspace_id !== workspaceId || workspace.status !== "stale");

export const removeCorruptedManifest = (
  workspaces: WorkspaceManifestSummary[],
  workspaceId: string,
) =>
  workspaces.filter(
    (workspace) => workspace.workspace_id !== workspaceId || workspace.status !== "corrupted",
  );

export const validateManifestHealth = (
  manifest: WorkspaceManifest,
): { is_valid: boolean; messages: string[] } => {
  const messages: string[] = [];
  const datasetIds = new Set(manifest.datasets.map((dataset) => dataset.dataset_id));

  if (!manifest.workspace_id) messages.push("Workspace id is missing.");
  if (!manifest.datasets.length) messages.push("No datasets are registered in this workspace.");
  if (manifest.active_dataset_id && !datasetIds.has(manifest.active_dataset_id)) {
    messages.push("Active dataset reference is stale.");
  }

  return {
    is_valid: messages.length === 0,
    messages,
  };
};

export const recoverWorkspaceSafely = (
  summary: WorkspaceManifestSummary | null,
): WorkspaceRecoveryDecision => {
  if (!summary) {
    return {
      canRecover: false,
      workspaceId: null,
      messages: ["No saved workspace was found."],
    };
  }

  if (!summary.recovery.can_recover || summary.status === "stale" || summary.status === "corrupted") {
    return {
      canRecover: false,
      workspaceId: null,
      messages: summary.validation.messages.length
        ? summary.validation.messages
        : [summary.recovery.reason || "Workspace cannot be recovered safely."],
    };
  }

  return {
    canRecover: true,
    workspaceId: summary.workspace_id,
    messages: summary.validation.messages,
  };
};

export const gracefullyResetBrokenReferences = (manifest: WorkspaceManifest): WorkspaceManifest => {
  const datasetIds = new Set(manifest.datasets.map((dataset) => dataset.dataset_id));
  const activeDatasetId =
    manifest.active_dataset_id && datasetIds.has(manifest.active_dataset_id)
      ? manifest.active_dataset_id
      : manifest.datasets[0]?.dataset_id || null;
  const currentResultTab =
    manifest.current_result_tab === "filtered" || manifest.current_result_tab === "queried"
      ? manifest.current_result_tab
      : "preview";

  return {
    ...manifest,
    active_dataset_id: activeDatasetId,
    active_result_id:
      manifest.active_result_id === "filtered" || manifest.active_result_id === "queried"
        ? manifest.active_result_id
        : "preview",
    active_execution_id: manifest.active_execution_id || null,
    current_result_tab: currentResultTab,
    current_mode: manifest.current_mode === "analyst" ? "analyst" : "human",
  };
};
