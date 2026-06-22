import type { SqlPreviewResult } from "./sqlTypes";

export const SQL_RESULT_DRIFT_WARNING =
  "Your question or SQL has changed since this result was run. Re-run to refresh.";

const normalizeDraftValue = (value: string) => value.trim();

const formatRunTimestamp = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hour = String(date.getUTCHours()).padStart(2, "0");
  const minute = String(date.getUTCMinutes()).padStart(2, "0");

  return `${year}-${month}-${day} ${hour}:${minute} UTC`;
};

export type SqlResultProvenanceViewModel = {
  summaryText: string;
  sourceText: string | null;
  ranAtText: string | null;
  driftWarningText: string | null;
};

export function createSqlResultProvenanceViewModel({
  previewResult,
  currentTaskPrompt,
  currentSqlDraft,
}: {
  previewResult: SqlPreviewResult;
  currentTaskPrompt: string;
  currentSqlDraft: string;
}): SqlResultProvenanceViewModel {
  const executedQuestion = previewResult.executedQuestion;

  if (!executedQuestion) {
    return {
      summaryText: "Showing result from a previous run",
      sourceText: null,
      ranAtText: null,
      driftWarningText: null,
    };
  }

  const taskPrompt = executedQuestion.taskPrompt.trim();
  const sourceName = executedQuestion.sourceLabel || executedQuestion.sourceTableName;
  const promptChanged =
    normalizeDraftValue(currentTaskPrompt) !== normalizeDraftValue(executedQuestion.taskPrompt);
  const sqlChanged = normalizeDraftValue(currentSqlDraft) !== normalizeDraftValue(executedQuestion.sqlAtRun);

  return {
    summaryText: taskPrompt
      ? `Showing result for: ${taskPrompt}`
      : `Showing result for SQL run on ${sourceName || "the selected source"}`,
    sourceText: sourceName ? `Source: ${sourceName}` : null,
    ranAtText: executedQuestion.ranAt ? `Ran: ${formatRunTimestamp(executedQuestion.ranAt)}` : null,
    driftWarningText: promptChanged || sqlChanged ? SQL_RESULT_DRIFT_WARNING : null,
  };
}
