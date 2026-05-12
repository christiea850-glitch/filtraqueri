import type { SqlDialectId } from "../sqlIntelligence";

export const SQL_WORKSPACE_METADATA_VERSION = 1;

export type SqlWorkspaceActiveTab = "editor" | "guidance" | "drafts";

export type SqlWorkspaceMetadataSnapshot = {
  version: number;
  selectedDialect: SqlDialectId;
  activeSqlTab: SqlWorkspaceActiveTab;
  lastOpenedContext: "sqlWorkspace";
  draftMetadata: {
    draftCount: number;
    lastDraftSavedAt: string | null;
  };
  updatedAt: string;
};
