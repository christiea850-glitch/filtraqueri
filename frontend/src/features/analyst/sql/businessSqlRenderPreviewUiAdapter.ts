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
