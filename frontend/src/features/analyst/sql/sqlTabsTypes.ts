import type { SqlDialectId } from "../../sqlIntelligence";
import type { SqlExecutionStatus, SqlPreviewResult } from "./sqlTypes";

export type SqlWorkspaceSourceType = "original" | "cleaned_working_copy";

export type SqlWorkspaceTabCreatedFrom =
  | "starter"
  | "template"
  | "report"
  | "manual"
  | "cleaned_source";

export type SqlWorkspaceTab = {
  id: string;
  title: string;
  worksheetId?: string;
  sourceType: SqlWorkspaceSourceType;
  tableName: string;
  originalTableName?: string;
  cleanedTableName?: string;
  sqlDraft: string;
  dialect: SqlDialectId;
  previewResult: SqlPreviewResult;
  editorStatus: SqlExecutionStatus;
  isDirty: boolean;
  createdFrom?: SqlWorkspaceTabCreatedFrom;
};

export type SqlWorkspaceTabsState = {
  activeTabId: string;
  tabs: SqlWorkspaceTab[];
};
