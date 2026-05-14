import type {
  GuidanceContextWeight,
  GuidancePriority,
  GuidanceRecommendationGroup,
  GuidanceReason,
  GuidanceScore,
  InvestigationGuidanceItem,
  RuntimeContextSnapshot,
} from "./runtimeTypes";

const reasonBaseScores: Record<GuidanceReason, number> = {
  "no-dataset-open": 92,
  "dataset-open-no-query": 88,
  "workbook-relationships-unreviewed": 74,
  "results-ready-no-refinement": 62,
  "analyst-draft-with-result-context": 58,
  "human-intent-without-analyst-context": 52,
};

const reasonOrder: Record<GuidanceReason, number> = {
  "no-dataset-open": 0,
  "dataset-open-no-query": 1,
  "workbook-relationships-unreviewed": 2,
  "results-ready-no-refinement": 3,
  "analyst-draft-with-result-context": 4,
  "human-intent-without-analyst-context": 5,
};

const clampScore = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

const priorityFromScore = (score: number): GuidancePriority => {
  if (score >= 76) return "high";
  if (score >= 50) return "medium";
  return "low";
};

const createWeight = (
  id: string,
  label: string,
  value: number,
  reason: string,
): GuidanceContextWeight => ({
  id,
  label,
  value,
  reason,
});

const getContextWeights = (
  item: InvestigationGuidanceItem,
  snapshot: RuntimeContextSnapshot,
): GuidanceContextWeight[] => {
  const weights: GuidanceContextWeight[] = [];
  const hasDataset = Boolean(snapshot.dataset.datasetId);
  const hasQueryShape =
    snapshot.queryBuilder.hasRunQuery ||
    snapshot.queryBuilder.selectedColumns.length > 0 ||
    snapshot.queryBuilder.groupBy.length > 0 ||
    snapshot.queryBuilder.aggregations.length > 0;
  const hasResultRows = snapshot.activeResult.rowCount > 0;

  if (item.reason === "no-dataset-open" && !hasDataset) {
    weights.push(createWeight("dataset:missing", "No dataset", 10, "Opening data is required before analysis."));
  }

  if (item.reason === "dataset-open-no-query" && hasDataset && !hasQueryShape) {
    weights.push(createWeight("query:empty", "No query shape", 12, "A dataset is loaded but no builder shape exists."));
  }

  if (item.reason === "results-ready-no-refinement" && hasResultRows && !hasQueryShape) {
    weights.push(createWeight("result:available", "Result available", 7, "Rows are available for review."));
  }

  if (item.reason === "workbook-relationships-unreviewed") {
    const relationshipWeight = Math.min(14, snapshot.workbook.relationshipCandidateCount * 3);
    if (relationshipWeight > 0) {
      weights.push(
        createWeight(
          "workbook:relationships",
          "Relationship metadata",
          relationshipWeight,
          "Workbook relationship candidates were detected.",
        ),
      );
    }
    if (snapshot.workbook.acceptedRelationshipCount === 0) {
      weights.push(
        createWeight(
          "workbook:unaccepted",
          "No accepted relationships",
          5,
          "Relationship candidates have not been accepted yet.",
        ),
      );
    }
  }

  if (item.reason === "human-intent-without-analyst-context" && snapshot.taskRecommendation.humanIntentLabel) {
    weights.push(createWeight("intent:active", "Human intent", 6, "A guided Human Mode intent is active."));
  }

  if (item.reason === "analyst-draft-with-result-context" && snapshot.sql.hasDrafts) {
    weights.push(createWeight("sql:draft", "SQL draft", 8, "Analyst draft metadata exists."));
    if (hasResultRows) {
      weights.push(createWeight("result:compare", "Result context", 4, "An active result can be revisited."));
    }
  }

  if (item.audience === snapshot.mode) {
    weights.push(createWeight("mode:current", "Current mode", 3, "The recommendation matches the current mode."));
  }

  return weights;
};

const explainScore = (item: InvestigationGuidanceItem, weights: GuidanceContextWeight[]) => {
  if (item.reason === "no-dataset-open") return "Most relevant next step";
  if (item.reason === "dataset-open-no-query") return "Suggested based on current workspace state";
  if (item.reason === "workbook-relationships-unreviewed") return "Relationship metadata detected";
  if (item.reason === "results-ready-no-refinement") return "Result context is ready to review";
  if (item.reason === "analyst-draft-with-result-context") return "SQL draft and result context are both available";
  if (weights.length > 0) return weights[0].reason;
  return "Stable metadata recommendation";
};

const scoreGuidanceItem = (
  item: InvestigationGuidanceItem,
  snapshot: RuntimeContextSnapshot,
): InvestigationGuidanceItem => {
  const weights = getContextWeights(item, snapshot);
  const scoreValue = clampScore(
    reasonBaseScores[item.reason] + weights.reduce((total, weight) => total + weight.value, 0),
  );
  const priority = priorityFromScore(scoreValue);
  const score: GuidanceScore = {
    value: scoreValue,
    priority,
    explanation: explainScore(item, weights),
    weights,
  };

  return {
    ...item,
    priority,
    score,
  };
};

export const rankInvestigationGuidance = ({
  snapshot,
  guidance,
}: {
  snapshot: RuntimeContextSnapshot;
  guidance: InvestigationGuidanceItem[];
}): InvestigationGuidanceItem[] =>
  guidance
    .map((item) => scoreGuidanceItem(item, snapshot))
    .sort((first, second) => {
      if (second.score.value !== first.score.value) return second.score.value - first.score.value;
      if (reasonOrder[first.reason] !== reasonOrder[second.reason]) {
        return reasonOrder[first.reason] - reasonOrder[second.reason];
      }
      return first.id.localeCompare(second.id);
    })
    .slice(0, 5);

const groupConfig: Record<
  GuidanceRecommendationGroup["id"],
  Pick<GuidanceRecommendationGroup, "title" | "summary">
> = {
  "start-investigation": {
    title: "Start investigation",
    summary: "Open or prepare the workspace before analysis.",
  },
  "continue-analysis": {
    title: "Continue analysis",
    summary: "Refine the current business workflow.",
  },
  "inspect-relationships": {
    title: "Inspect relationships",
    summary: "Workbook relationship metadata may affect connected analysis.",
  },
  "review-sql-context": {
    title: "Review SQL context",
    summary: "Technical SQL metadata is available to inspect.",
  },
  "review-results": {
    title: "Review results",
    summary: "Return to active result context before changing direction.",
  },
};

const groupIdForGuidance = (item: InvestigationGuidanceItem): GuidanceRecommendationGroup["id"] => {
  if (item.reason === "no-dataset-open") return "start-investigation";
  if (item.category === "workbook-relationships") return "inspect-relationships";
  if (item.category === "analyst-review" || item.category === "human-guidance") return "review-sql-context";
  if (item.category === "result-review") return "review-results";
  return "continue-analysis";
};

export const groupGuidanceRecommendations = ({
  snapshot,
  guidance,
}: {
  snapshot: RuntimeContextSnapshot;
  guidance: InvestigationGuidanceItem[];
}): GuidanceRecommendationGroup[] => {
  const groups = guidance.reduce<Partial<Record<GuidanceRecommendationGroup["id"], InvestigationGuidanceItem[]>>>(
    (groupedItems, item) => {
      const groupId = groupIdForGuidance(item);
      groupedItems[groupId] = [...(groupedItems[groupId] || []), item];
      return groupedItems;
    },
    {},
  );

  return (Object.keys(groups) as GuidanceRecommendationGroup["id"][])
    .map((groupId) => {
      const items = groups[groupId] || [];
      const config = groupConfig[groupId];
      return {
        id: groupId,
        title: config.title,
        summary: config.summary,
        audience: snapshot.mode,
        items,
        topScore: items[0]?.score.value || 0,
        metadataOnly: true as const,
      };
    })
    .sort((first, second) => {
      if (second.topScore !== first.topScore) return second.topScore - first.topScore;
      return first.id.localeCompare(second.id);
    });
};
