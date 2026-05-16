import type { WorkspaceStorageReference } from "./workspaceSessionTypes";

export const createWorkspaceStorageReferences = (sessionId: string): WorkspaceStorageReference[] => [
  {
    storageId: `${sessionId}:storage:local-package-folder`,
    label: "Local package folder",
    targetType: "local_folder",
    placeholderPath: null,
    configured: false,
  },
  {
    storageId: `${sessionId}:storage:cloud-target`,
    label: "Cloud storage target",
    targetType: "cloud_storage",
    placeholderPath: null,
    configured: false,
  },
  {
    storageId: `${sessionId}:storage:workspace-bundle`,
    label: "Workspace export bundle",
    targetType: "workspace_bundle",
    placeholderPath: null,
    configured: false,
  },
];
