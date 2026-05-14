import type { WorkspaceRuntimePersistenceState } from "./runtimeTypes";

const RUNTIME_STORAGE_KEY = "filtraqueri.workspaceRuntime";

const defaultRuntimePersistenceState: WorkspaceRuntimePersistenceState = {
  selectedTrailItemId: null,
  isRuntimePanelCollapsed: false,
  selectedTaskId: null,
};

export const normalizeRuntimePersistenceState = (
  value: unknown,
): WorkspaceRuntimePersistenceState => {
  if (!value || typeof value !== "object") return defaultRuntimePersistenceState;

  const candidate = value as Partial<WorkspaceRuntimePersistenceState>;

  return {
    selectedTrailItemId:
      typeof candidate.selectedTrailItemId === "string" ? candidate.selectedTrailItemId : null,
    isRuntimePanelCollapsed: Boolean(candidate.isRuntimePanelCollapsed),
    selectedTaskId: typeof candidate.selectedTaskId === "string" ? candidate.selectedTaskId : null,
  };
};

export const loadRuntimePersistenceState = (): WorkspaceRuntimePersistenceState => {
  try {
    const storedValue = window.localStorage.getItem(RUNTIME_STORAGE_KEY);
    return normalizeRuntimePersistenceState(storedValue ? JSON.parse(storedValue) : null);
  } catch {
    return defaultRuntimePersistenceState;
  }
};

export const saveRuntimePersistenceState = (state: WorkspaceRuntimePersistenceState) => {
  window.localStorage.setItem(
    RUNTIME_STORAGE_KEY,
    JSON.stringify(normalizeRuntimePersistenceState(state)),
  );
};
