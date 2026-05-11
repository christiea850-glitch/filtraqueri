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
