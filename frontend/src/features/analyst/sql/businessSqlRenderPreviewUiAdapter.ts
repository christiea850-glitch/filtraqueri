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
import type { BusinessSqlMissingRelationship } from "./businessSqlJoinPathResolver";

export type BusinessSqlRenderPreviewWorkspaceInput = {
  taskPrompt: string;
  selectedGuidanceDialect: SqlDialectId;
  selectedScopeSelections?: readonly AnalysisScopeSelection[];
  appliedScopeSelections?: readonly AnalysisScopeSelection[];
  worksheets?: readonly Pick<WorksheetMetadata, "tableName" | "schema">[];
  acceptedRelationshipContracts?: readonly AcceptedRelationshipContract[];
  readyRelationshipContracts?: readonly AcceptedRelationshipContract[];
  missingRelationships?: readonly BusinessSqlMissingRelationship[];
  activeSqlDraft?: string;
};

export type BusinessSqlRenderPreviewWorkspaceResult = {
  preview: BusinessSqlRenderPreview;
  activeSqlDraft: string;
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
}: BusinessSqlRenderPreviewWorkspaceInput): BusinessSqlRenderPreviewWorkspaceResult {
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
  };
}
