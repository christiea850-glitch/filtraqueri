export type BusinessSqlClarificationDecisionProvenance = {
  ambiguityId: string;
  chosenOptionId: string;
  chosenOptionLabel?: string;
  presentedOptionIds: string[];
};

export type BusinessSqlPreviewInsertProvenance = {
  source: "business_sql_preview";
  activeTabId: string;
  planId: string;
  rendererTarget: "DuckDB";
  insertedSqlFingerprint: string;
  insertedSqlSnapshot: string;
  copy: "Inserted from Business SQL preview";
  bannerCopy: "Inserted into editor. Review before running.";
  helperCopy: "Run Query remains manual.";
  noPersistence: true;
  noSqlExecution: true;
  noDuckDbExecution: true;
  noBackendCall: true;
  noProviderCall: true;
  noNetworkCall: true;
  noAuthRequired: true;
  clarificationDecision?: BusinessSqlClarificationDecisionProvenance;
};

export type BusinessSqlPreviewInsertProvenanceInput = {
  activeTabId: string;
  planId: string;
  sqlText: string;
  clarificationDecision?: BusinessSqlClarificationDecisionProvenance;
};

const fingerprintSql = (sqlText: string): string => {
  const normalized = sqlText.replace(/\r\n/g, "\n");
  let hash = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash * 31 + normalized.charCodeAt(index)) >>> 0;
  }
  return `sql:${normalized.length}:${hash.toString(16).padStart(8, "0")}`;
};

export function createBusinessSqlPreviewInsertProvenance({
  activeTabId,
  planId,
  sqlText,
  clarificationDecision,
}: BusinessSqlPreviewInsertProvenanceInput): BusinessSqlPreviewInsertProvenance {
  return {
    source: "business_sql_preview",
    activeTabId,
    planId,
    rendererTarget: "DuckDB",
    insertedSqlFingerprint: fingerprintSql(sqlText),
    insertedSqlSnapshot: sqlText,
    copy: "Inserted from Business SQL preview",
    bannerCopy: "Inserted into editor. Review before running.",
    helperCopy: "Run Query remains manual.",
    noPersistence: true,
    noSqlExecution: true,
    noDuckDbExecution: true,
    noBackendCall: true,
    noProviderCall: true,
    noNetworkCall: true,
    noAuthRequired: true,
    ...(clarificationDecision
      ? {
          clarificationDecision: {
            ...clarificationDecision,
            presentedOptionIds: [...clarificationDecision.presentedOptionIds],
          },
        }
      : {}),
  };
}

export function shouldShowBusinessSqlPreviewInsertProvenance({
  provenance,
  activeTabId,
  currentSqlDraft,
}: {
  provenance: BusinessSqlPreviewInsertProvenance | null;
  activeTabId: string;
  currentSqlDraft: string;
}): boolean {
  if (!provenance) return false;
  if (provenance.activeTabId !== activeTabId) return false;
  if (!currentSqlDraft.trim()) return false;
  return currentSqlDraft === provenance.insertedSqlSnapshot;
}

export function summarizeBusinessSqlPreviewInsertProvenance(
  provenance: BusinessSqlPreviewInsertProvenance | null,
): string {
  if (!provenance) return "provenance=none";
  return [
    `source=${provenance.source}`,
    `tab=${provenance.activeTabId}`,
    `plan=${provenance.planId}`,
    `target=${provenance.rendererTarget}`,
    `fingerprint=${provenance.insertedSqlFingerprint}`,
    provenance.clarificationDecision
      ? `clarification=${provenance.clarificationDecision.ambiguityId}:${provenance.clarificationDecision.chosenOptionId}`
      : "clarification=none",
    "persistence=false",
    "execution=false",
    "auth=false",
  ].join("; ");
}
