import type { SqlDialectId } from "../../sqlIntelligence";
import type {
  AcceptedRelationshipContract,
  AnalysisScopeSelection,
  WorksheetMetadata,
} from "../../workbook";
import { planBusinessSqlQueryRequest } from "./businessSqlQueryPlanner";
import {
  createBusinessSqlRenderPreview,
  type BusinessSqlRenderPreview,
} from "./businessSqlRenderPreview";
import { detectBusinessIntent } from "./businessIntentGrounding";
import { detectBusinessSqlMeasureAmbiguity } from "./businessSqlMeasureAmbiguity";
import type { BusinessSqlMissingRelationship } from "./businessSqlJoinPathResolver";
import type { SqlWorkspaceTabCreatedFrom } from "./sqlTabsTypes";

const BUSINESS_SQL_PREVIEW_SEPARATE_EDITOR_DRAFT_COPY =
  "This preview is for deterministic Business SQL planning. The editor currently contains a separate SQL draft.";

const BUSINESS_SQL_PREVIEW_EMPTY_COPY =
  "Business SQL Preview has no generated preview for this task.";

const BUSINESS_SQL_PREVIEW_EDITOR_DRAFT_FALLBACK_COPY =
  "Business SQL Preview has no generated preview for this task. You can still review the SQL currently in the editor and run it manually.";

export type BusinessSqlRenderPreviewWorkspaceInput = {
  taskPrompt: string;
  selectedGuidanceDialect: SqlDialectId;
  selectedScopeSelections?: readonly AnalysisScopeSelection[];
  appliedScopeSelections?: readonly AnalysisScopeSelection[];
  worksheets?: readonly Pick<
    WorksheetMetadata,
    "worksheetId" | "displayName" | "sheetName" | "tableName" | "schema"
  >[];
  acceptedRelationshipContracts?: readonly AcceptedRelationshipContract[];
  readyRelationshipContracts?: readonly AcceptedRelationshipContract[];
  missingRelationships?: readonly BusinessSqlMissingRelationship[];
  activeSqlDraft?: string;
  activeSqlDraftSource?: SqlWorkspaceTabCreatedFrom | null;
};

export type BusinessSqlRenderPreviewWorkspaceResult = {
  preview: BusinessSqlRenderPreview;
  activeSqlDraft: string;
  activeSqlDraftSource: SqlWorkspaceTabCreatedFrom | null;
};

export type BusinessSqlRenderPreviewEmptyState = {
  message: string;
  hasSeparateEditorDraft: boolean;
};

export type BusinessSqlRenderPreviewCopyState = {
  canCopySql: boolean;
  sql: string | null;
  disabledReason: string | null;
};

export type BusinessSqlRenderPreviewManualInsertState = {
  canManuallyInsertSqlPreview: boolean;
  sql: string | null;
  disabledReason: string | null;
};

export type BusinessSqlRenderPreviewManualInsertResult = {
  inserted: boolean;
  activeSqlDraft: string;
  reason: string | null;
};

export function getBusinessSqlRenderPreviewCopyState(
  preview: BusinessSqlRenderPreview,
): BusinessSqlRenderPreviewCopyState {
  if (preview.status !== "ready") {
    return {
      canCopySql: false,
      sql: null,
      disabledReason: "SQL can be copied only from a ready preview.",
    };
  }

  if (!preview.sql) {
    return {
      canCopySql: false,
      sql: null,
      disabledReason: "No rendered SQL is available to copy.",
    };
  }

  if (!preview.actions.canCopySql) {
    return {
      canCopySql: false,
      sql: null,
      disabledReason: "Copy is not available for this preview.",
    };
  }

  return {
    canCopySql: true,
    sql: preview.sql,
    disabledReason: null,
  };
}

export function getBusinessSqlRenderPreviewManualInsertState(
  preview: BusinessSqlRenderPreview,
  activeSqlDraft: string,
): BusinessSqlRenderPreviewManualInsertState {
  if (preview.status !== "ready") {
    return {
      canManuallyInsertSqlPreview: false,
      sql: null,
      disabledReason: "SQL can be inserted only from a ready preview.",
    };
  }

  if (!preview.sql) {
    return {
      canManuallyInsertSqlPreview: false,
      sql: null,
      disabledReason: "No rendered SQL is available to insert.",
    };
  }

  if (activeSqlDraft.trim()) {
    return {
      canManuallyInsertSqlPreview: false,
      sql: null,
      disabledReason: "Editor already has SQL. Clear it before inserting preview SQL.",
    };
  }

  return {
    canManuallyInsertSqlPreview: true,
    sql: preview.sql,
    disabledReason: null,
  };
}

export function applyBusinessSqlRenderPreviewManualInsert(
  preview: BusinessSqlRenderPreview,
  activeSqlDraft: string,
): BusinessSqlRenderPreviewManualInsertResult {
  const insertState = getBusinessSqlRenderPreviewManualInsertState(preview, activeSqlDraft);

  if (!insertState.canManuallyInsertSqlPreview || !insertState.sql) {
    return {
      inserted: false,
      activeSqlDraft,
      reason: insertState.disabledReason,
    };
  }

  return {
    inserted: true,
    activeSqlDraft: insertState.sql,
    reason: null,
  };
}

export function getBusinessSqlRenderPreviewEmptyState({
  preview,
  activeSqlDraft,
  activeSqlDraftSource,
}: {
  preview: BusinessSqlRenderPreview;
  activeSqlDraft: string;
  activeSqlDraftSource?: SqlWorkspaceTabCreatedFrom | null;
}): BusinessSqlRenderPreviewEmptyState {
  const hasSeparateEditorDraft = Boolean(activeSqlDraft.trim());

  if (preview.sql || !hasSeparateEditorDraft) {
    return {
      message: BUSINESS_SQL_PREVIEW_EMPTY_COPY,
      hasSeparateEditorDraft: false,
    };
  }

  if (
    activeSqlDraftSource === "template" ||
    activeSqlDraftSource === "report" ||
    activeSqlDraftSource === "manual"
  ) {
    return {
      message: BUSINESS_SQL_PREVIEW_SEPARATE_EDITOR_DRAFT_COPY,
      hasSeparateEditorDraft: true,
    };
  }

  return {
    message: BUSINESS_SQL_PREVIEW_EDITOR_DRAFT_FALLBACK_COPY,
    hasSeparateEditorDraft: true,
  };
}

export function createBusinessSqlRenderPreviewFromWorkspaceContext({
  taskPrompt,
  selectedGuidanceDialect,
  selectedScopeSelections = [],
  appliedScopeSelections = [],
  worksheets = [],
  acceptedRelationshipContracts = [],
  readyRelationshipContracts = [],
  missingRelationships = [],
  activeSqlDraft = "",
  activeSqlDraftSource = null,
}: BusinessSqlRenderPreviewWorkspaceInput): BusinessSqlRenderPreviewWorkspaceResult {
  const intent = detectBusinessIntent(taskPrompt);
  const measureAmbiguity = detectBusinessSqlMeasureAmbiguity({
    prompt: taskPrompt,
    intent,
    worksheets,
    appliedScopeSelections,
  });

  if (measureAmbiguity) {
    return {
      preview: {
        status: "needs_review",
        title: "SQL preview needs measure clarification",
        body: "Choose what the ranking should measure before previewing Business SQL.",
        sql: null,
        planId: measureAmbiguity.ambiguityId,
        rendererTarget: "duckdb",
        guidanceDialect: selectedGuidanceDialect,
        reasons: [measureAmbiguity.prompt],
        warnings: [],
        actions: {
          canCopySql: false,
          canInsertSql: false,
          canRunSql: false,
        },
      },
      activeSqlDraft,
      activeSqlDraftSource,
    };
  }

  const plan = planBusinessSqlQueryRequest({
    prompt: taskPrompt,
    selectedGuidanceDialect,
    selectedScopeSelections,
    appliedScopeSelections,
    worksheets,
    acceptedRelationshipContracts,
    readyRelationshipContracts,
    missingRelationships,
  });

  return {
    preview: createBusinessSqlRenderPreview(plan),
    activeSqlDraft,
    activeSqlDraftSource,
  };
}
