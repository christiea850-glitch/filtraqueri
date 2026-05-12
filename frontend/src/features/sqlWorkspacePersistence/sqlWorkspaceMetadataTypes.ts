import type { SqlDialectId } from "../sqlIntelligence";

export const SQL_WORKSPACE_METADATA_VERSION = 1;
export const SQL_DRAFT_SNAPSHOT_VERSION = 1;
export const MAX_SQL_DRAFT_TEXT_LENGTH = 20000;
export const MAX_SQL_DRAFT_SNAPSHOTS = 6;

export type SqlWorkspaceActiveTab = "editor" | "guidance" | "drafts";

export type SqlDraftSnapshot = {
  version: number;
  id: string;
  label: string;
  sql: string;
  selectedDialect: SqlDialectId;
  updatedAt: string;
};

export type SqlWorkspaceMetadataSnapshot = {
  version: number;
  selectedDialect: SqlDialectId;
  activeSqlTab: SqlWorkspaceActiveTab;
  activeDraftId: string | null;
  lastOpenedContext: "sqlWorkspace";
  draftMetadata: {
    draftCount: number;
    lastDraftSavedAt: string | null;
  };
  drafts: SqlDraftSnapshot[];
  updatedAt: string;
};
