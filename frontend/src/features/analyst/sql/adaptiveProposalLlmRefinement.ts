import type { AdaptiveReportProposal } from "./adaptiveReportProposal";
import type {
  AdaptiveProposalLlmPayload,
  AdaptiveProposalLlmRefinementResult,
} from "./adaptiveProposalLlmContract";
import { validateAdaptiveProposalLlmResponse } from "./adaptiveProposalLlmValidator";

export const applyAdaptiveProposalLlmRefinement = ({
  proposal,
  payload,
  response,
}: {
  proposal: AdaptiveReportProposal;
  payload: AdaptiveProposalLlmPayload;
  response: unknown;
}): AdaptiveProposalLlmRefinementResult => {
  const validation = validateAdaptiveProposalLlmResponse(response, payload);
  if (!validation.ok || !validation.response) {
    return {
      proposal,
      validation,
      changed: false,
    };
  }

  const refinement = validation.response;
  const refined: AdaptiveReportProposal = {
    ...proposal,
    title: refinement.title ?? proposal.title,
    proposalNarrative: refinement.narrative ?? proposal.proposalNarrative,
    entities: refinement.entities ?? proposal.entities,
    metrics: refinement.metrics ?? proposal.metrics,
    groupings: refinement.groupings ?? proposal.groupings,
    filters: refinement.filters ?? proposal.filters,
    joinNeeds: refinement.joinNeeds ?? proposal.joinNeeds,
    assumptions: refinement.assumptions ?? proposal.assumptions,
    missingRequirements: refinement.missingRequirements ?? proposal.missingRequirements,
    warnings: refinement.warnings ?? proposal.warnings,
    renderer: {
      ...proposal.renderer,
      status: "not_rendered",
      canRender: false,
    },
    sql: null,
    canRenderSql: false,
    canInsertSql: false,
    canRunSql: false,
  };

  return {
    proposal: refined,
    validation,
    changed: JSON.stringify(refined) !== JSON.stringify(proposal),
  };
};
