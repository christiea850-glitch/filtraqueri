import type { SchemaColumn } from "../../dataset/datasetTypes";
import type {
  SqlDialectId,
  SqlDialectProfile,
  SqlIntelligenceDiagnostic,
  SqlValidationResult,
  SqlWorkspaceAnalysis,
} from "../../sqlIntelligence";

export type SqlExecutionStatus =
  | "idle"
  | "draft-saved"
  | "explain-ready"
  | "running"
  | "success"
  | "error";

export type SqlQueryDraft = {
  id: string;
  name: string;
  sql: string;
  savedAt: string;
  dialect: SqlDialectId;
};

export type SqlPreviewResult = {
  columns: string[];
  rows: Record<string, unknown>[];
  message: string;
};

export type SqlSuggestion = {
  id: string;
  label: string;
  description: string;
  sql: string;
};

export type SqlTemplate = SqlSuggestion & {
  category: "select" | "aggregate" | "filter" | "sort";
};

export type SqlEditorInterface = {
  value: string;
  onChange: (sqlText: string) => void;
  onRun: () => void;
  onExplain: () => void;
  onSaveDraft: () => void;
  onClear: () => void;
  schema: SchemaColumn[];
  suggestions: SqlSuggestion[];
  templates: SqlTemplate[];
  keywordSuggestions: string[];
  diagnostics: SqlIntelligenceDiagnostic[];
};

export type SqlGuidanceCard = SqlWorkspaceAnalysis["explanationCards"][number];

export type SqlQueryExplanation = {
  title: string;
  summary: string;
  intent: string;
  source: string;
  fields: string[];
  filters: string[];
  grouping: string[];
  sorting: string[];
  joins: string[];
  outputShape: string;
  businessMeaning: string;
  safetyNote: string;
  isComplex: boolean;
  fallbackMessage: string | null;
};

export type SqlDialectOption = Pick<SqlDialectProfile, "id" | "displayName">;

export type SqlDialectContext = {
  selectedDialect: SqlDialectId;
  selectedDialectProfile: SqlDialectProfile;
  dialectOptions: SqlDialectOption[];
  onDialectChange: (dialect: SqlDialectId) => void;
};

export type SqlWorkspaceTabView = {
  id: string;
  title: string;
  sourceBadge: string | null;
  isActive: boolean;
  isDirty: boolean;
  canClose: boolean;
};

export type SqlWorkspaceTabsInterface = {
  tabs: SqlWorkspaceTabView[];
  activeTabId: string;
  activeTabTitle: string;
  activeTabSourceBadge: string | null;
  activeTabSourceKind: "Original" | "Cleaned" | null;
  onNewTab: () => void;
  onSwitchTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
};

export type SqlValidationSummary = SqlValidationResult;
