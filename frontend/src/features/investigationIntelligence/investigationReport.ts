import type { DatasetMetadata } from "../dataset/datasetTypes";
import type { ActiveResultModel } from "../results/activeResultModel";
import { buildInvestigationContext } from "./investigationContext";
import {
  buildResultFollowUpSuggestions,
  explainInvestigationContext,
} from "./investigationExplanation";
import { buildInvestigationFlow } from "./investigationFlow";
import {
  buildInvestigationIntents,
  buildInvestigationSuggestions,
} from "./investigationSuggestions";
import type { InvestigationReport } from "./investigationTypes";

export const buildInvestigationReport = ({
  dataset,
  activeResultModel,
}: {
  dataset: DatasetMetadata | null;
  activeResultModel?: ActiveResultModel | null;
}): InvestigationReport => {
  const context = buildInvestigationContext({ dataset, activeResultModel });
  const intents = buildInvestigationIntents(context);
  const suggestions = buildInvestigationSuggestions(context);
  const flow = buildInvestigationFlow(context, suggestions);

  return {
    context,
    intents,
    suggestions,
    flow,
    nextSteps: buildResultFollowUpSuggestions(context, suggestions),
    humanSummary: explainInvestigationContext(context, suggestions),
  };
};
