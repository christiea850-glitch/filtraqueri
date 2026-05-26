import type { QueryBuilderRequest } from "../query-builder/queryBuilderTypes";
import type { ControlledLogicDraft } from "./questionLogicDraftTypes";
import type { MissingRequirement } from "./questionTranslatorTypes";

export type GovernedQueryBuilderRequestDraftStatus =
  | "not_created"
  | "eligible"
  | "created_for_review"
  | "blocked";

export type GovernedQueryBuilderRequestDraft = {
  status: GovernedQueryBuilderRequestDraftStatus;
  sourceDraft: ControlledLogicDraft;
  request: QueryBuilderRequest | null;
  validationWarnings: string[];
  blockingRequirements: MissingRequirement[];
  generatedSql: null;
  executionStatus: "not_executed";
};
