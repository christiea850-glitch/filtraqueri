import type { NarrativeInsight, NarrativeReadinessSummary, NarrativeReport } from "./narrativeTypes";
import { severityRank } from "./narrativeSeverity";
import { buildNarrativeTimeline } from "./narrativeTimeline";

export const sortNarrativeInsights = (insights: NarrativeInsight[]) =>
  [...insights].sort((left, right) => {
    const severityDelta = severityRank(right.severity) - severityRank(left.severity);
    if (severityDelta !== 0) return severityDelta;
    return left.title.localeCompare(right.title);
  });

export const buildNarrativeReadiness = (insights: NarrativeInsight[]): NarrativeReadinessSummary => {
  const highPriorityCount = insights.filter(
    (insight) => insight.severity === "high" || insight.severity === "critical",
  ).length;

  if (insights.length >= 4 && highPriorityCount > 0) {
    return {
      level: "executive_ready",
      label: "Narrative ready",
      detail: "Deterministic result patterns are available for executive review.",
      insightCount: insights.length,
      highPriorityCount,
    };
  }
  if (insights.length > 0) {
    return {
      level: "ready",
      label: "Insight ready",
      detail: "Result metadata supports a compact narrative review.",
      insightCount: insights.length,
      highPriorityCount,
    };
  }
  return {
    level: "limited",
    label: "Limited narrative signal",
    detail: "Open or refine results to expose stronger patterns.",
    insightCount: 0,
    highPriorityCount: 0,
  };
};

export const buildNarrativeReport = ({
  datasetId,
  sourceResultId,
  insights,
}: {
  datasetId: string | null;
  sourceResultId: string | null;
  insights: NarrativeInsight[];
}): NarrativeReport => {
  const sortedInsights = sortNarrativeInsights(insights);
  const readiness = buildNarrativeReadiness(sortedInsights);
  const leadInsight = sortedInsights[0];

  return {
    reportId: `narrative:${datasetId || "no-dataset"}:${sourceResultId || "no-result"}`,
    datasetId,
    sourceResultId,
    summary: leadInsight
      ? leadInsight.narrative
      : "No deterministic executive narrative is available for the current result yet.",
    readiness,
    insights: sortedInsights,
    visibleInsights: sortedInsights.slice(0, 5),
    timelineCheckpoints: buildNarrativeTimeline(sortedInsights),
    futureContracts: {
      aiAssistedExplanationReady: true,
      executiveReportingReady: true,
      narrativeExportReady: true,
      scheduledSummaryReady: true,
      governanceAuditTrailReady: true,
      multilingualSummaryReady: true,
    },
    safetyNotes: [
      "Narratives are generated from metadata and sampled row structures only.",
      "No generative AI decisions or automatic business actions are performed.",
    ],
  };
};
