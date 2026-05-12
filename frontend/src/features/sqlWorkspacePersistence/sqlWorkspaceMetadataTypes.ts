import type { SqlDialectId } from "../sqlIntelligence";

export const SQL_WORKSPACE_METADATA_VERSION = 1;
export const SQL_DRAFT_SNAPSHOT_VERSION = 1;
export const SQL_SNIPPET_SNAPSHOT_VERSION = 1;
export const MAX_SQL_DRAFT_TEXT_LENGTH = 20000;
export const MAX_SQL_DRAFT_SNAPSHOTS = 6;
export const MAX_SQL_SNIPPET_TEXT_LENGTH = 20000;
export const MAX_SQL_SNIPPETS = 24;
export const MAX_SQL_SNIPPET_NAME_LENGTH = 80;
export const MAX_SQL_SNIPPET_DESCRIPTION_LENGTH = 240;
export const MAX_SQL_SNIPPET_TAGS = 8;
export const MAX_SQL_SNIPPET_TAG_LENGTH = 32;

export type SqlWorkspaceActiveTab = "editor" | "guidance" | "drafts";

export type SqlDraftSnapshot = {
  version: number;
  id: string;
  label: string;
  sql: string;
  selectedDialect: SqlDialectId;
  updatedAt: string;
};

export type SqlSnippetSnapshot = {
  version: number;
  id: string;
  name: string;
  sql: string;
  dialect: SqlDialectId;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  description: string | null;
};

export type SqlWorkspaceMetadataSnapshot = {
  version: number;
  selectedDialect: SqlDialectId;
  activeSqlTab: SqlWorkspaceActiveTab;
  activeDraftId: string | null;
  activeSnippetId: string | null;
  lastOpenedContext: "sqlWorkspace";
  draftMetadata: {
    draftCount: number;
    lastDraftSavedAt: string | null;
  };
  snippetMetadata: {
    snippetCount: number;
    lastSnippetSavedAt: string | null;
  };
  drafts: SqlDraftSnapshot[];
  snippets: SqlSnippetSnapshot[];
  updatedAt: string;
};
