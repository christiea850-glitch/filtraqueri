const WORKSPACE_ID_STORAGE_KEY = "filtraqueri.activeWorkspaceId";

export const saveActiveWorkspaceId = (workspaceId: string) => {
  window.localStorage.setItem(WORKSPACE_ID_STORAGE_KEY, workspaceId);
};

export const loadActiveWorkspaceId = () =>
  window.localStorage.getItem(WORKSPACE_ID_STORAGE_KEY);

export const clearActiveWorkspaceId = () => {
  window.localStorage.removeItem(WORKSPACE_ID_STORAGE_KEY);
};
