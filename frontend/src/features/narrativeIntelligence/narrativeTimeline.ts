import type {
  NarrativeInsight,
  NarrativeTimelineCheckpoint,
  NarrativeTimelineCheckpointType,
} from "./narrativeTypes";

const checkpointTypeForInsight = (insight: NarrativeInsight): NarrativeTimelineCheckpointType | null => {
  if (insight.category === "anomaly") return "anomaly_discovered";
  if (insight.category === "concentration" || insight.category === "financial") {
    return "concentration_detected";
  }
  if (insight.category === "categorical" || insight.category === "distribution") {
    return "grouping_opportunity_identified";
  }
  if (insight.category === "quality") return "workbook_quality_warning";
  return null;
};

export const buildNarrativeTimeline = (
  insights: NarrativeInsight[],
): NarrativeTimelineCheckpoint[] =>
  insights
    .map((insight) => {
      const type = checkpointTypeForInsight(insight);
      if (!type) return null;

      return {
        checkpointId: `narrative-checkpoint:${insight.id}`,
        type,
        label: insight.title,
        description: insight.narrative,
        severity: insight.severity,
        relatedInsightId: insight.id,
        relatedColumns: insight.relatedColumns,
      };
    })
    .filter((checkpoint): checkpoint is NarrativeTimelineCheckpoint => Boolean(checkpoint))
    .slice(0, 6);
