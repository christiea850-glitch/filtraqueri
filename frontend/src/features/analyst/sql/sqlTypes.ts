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
