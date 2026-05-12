import type { SchemaColumn } from "../../dataset/datasetTypes";
import type {
  SqlIntelligenceDiagnostic,
  SqlWorkspaceAnalysis,
} from "../../sqlIntelligence";

export type SqlExecutionStatus = "idle" | "draft-saved" | "explain-ready" | "execution-pending";

export type SqlQueryDraft = {
  id: string;
  name: string;
  sql: string;
  savedAt: string;
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
