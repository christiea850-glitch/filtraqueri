import type { ReportOpportunityDomain } from "../sql/reportIntelligencePlanner";
import type { AIColumnSensitivityLevel } from "./llmGovernanceTypes";
import type {
  AIGovernedMetaReportSuggestion,
  AIGovernedSuggestionReadiness,
  AIGovernedSuggestionSummary,
} from "./llmSuggestionContract";

export type AIGovernedSuggestionGroups = {
  canGenerateNow: AIGovernedMetaReportSuggestion[];
  needsMissingFields: AIGovernedMetaReportSuggestion[];
  needsUserReview: AIGovernedMetaReportSuggestion[];
  blockedSensitive: AIGovernedMetaReportSuggestion[];
  unsupported: AIGovernedMetaReportSuggestion[];
  byDomain: Partial<Record<ReportOpportunityDomain, AIGovernedMetaReportSuggestion[]>>;
  byCategory: Record<string, AIGovernedMetaReportSuggestion[]>;
  bySensitivity: Record<AIColumnSensitivityLevel, AIGovernedMetaReportSuggestion[]>;
};

export const groupAIGovernedSuggestions = (
  suggestions: AIGovernedMetaReportSuggestion[],
): AIGovernedSuggestionGroups => {
  const groups: AIGovernedSuggestionGroups = {
    canGenerateNow: [],
    needsMissingFields: [],
    needsUserReview: [],
    blockedSensitive: [],
    unsupported: [],
    byDomain: {},
    byCategory: {},
    bySensitivity: {
      safe: [],
      caution: [],
      sensitive: [],
      restricted: [],
    },
  };

  suggestions.forEach((suggestion) => {
    if (suggestion.readiness === "can_generate_now") groups.canGenerateNow.push(suggestion);
    if (suggestion.readiness === "needs_missing_fields") groups.needsMissingFields.push(suggestion);
    if (suggestion.readiness === "needs_user_review") groups.needsUserReview.push(suggestion);
    if (suggestion.readiness === "blocked_sensitive_fields") groups.blockedSensitive.push(suggestion);
    if (suggestion.readiness === "unsupported") groups.unsupported.push(suggestion);

    suggestion.domains.forEach((domain) => {
      groups.byDomain[domain] = [...(groups.byDomain[domain] || []), suggestion];
    });
    groups.byCategory[suggestion.category] = [
      ...(groups.byCategory[suggestion.category] || []),
      suggestion,
    ];
    groups.bySensitivity[suggestion.sensitivity.highestLevel].push(suggestion);
  });

  return groups;
};

export const summarizeAIGovernedSuggestions = (
  suggestions: AIGovernedMetaReportSuggestion[],
): AIGovernedSuggestionSummary => {
  const byReadiness: Record<AIGovernedSuggestionReadiness, number> = {
    can_generate_now: 0,
    needs_missing_fields: 0,
    needs_user_review: 0,
    blocked_sensitive_fields: 0,
    unsupported: 0,
  };
  const byDomain: AIGovernedSuggestionSummary["byDomain"] = {};
  const byHighestSensitivity: AIGovernedSuggestionSummary["byHighestSensitivity"] = {
    safe: 0,
    caution: 0,
    sensitive: 0,
    restricted: 0,
  };

  suggestions.forEach((suggestion) => {
    byReadiness[suggestion.readiness] += 1;
    byHighestSensitivity[suggestion.sensitivity.highestLevel] += 1;
    suggestion.domains.forEach((domain) => {
      byDomain[domain] = (byDomain[domain] || 0) + 1;
    });
  });

  return {
    total: suggestions.length,
    byReadiness,
    byDomain,
    byHighestSensitivity,
    sqlDraftIncluded: false,
  };
};
