import type { MetadataOnlyBoundaryContract } from "../governance/boundaryTypes";
import { createRuntimeBridgeId } from "./runtimeBridgeIds";
import type {
  RuntimeBridgeInsightInterpretation,
  RuntimeBridgeInsightSeverity,
  RuntimeBridgeInterpretationTheme,
  RuntimeBridgeOperationalSignal,
  RuntimeBridgeOpportunityIndicator,
  RuntimeBridgeRecommendationSummary,
  RuntimeBridgeRiskIndicator,
} from "./runtimeBridgeInsightInterpretation";
import type { RuntimeBridgeSourceModuleReference } from "./runtimeBridgeTypes";

export type RuntimeBridgeRecommendationPriority = "low" | "medium" | "high" | "critical";

export type RuntimeBridgePrioritySignal = {
  readonly signalId: string;
  readonly theme: RuntimeBridgeInterpretationTheme;
  readonly priority: RuntimeBridgeRecommendationPriority;
  readonly label: string;
  readonly summary: string;
  readonly weight: number;
  readonly evidenceReferenceIds: ReadonlyArray<string>;
  readonly relatedInsightIds: ReadonlyArray<string>;
  readonly metadataOnly: true;
};

export type RuntimeBridgeRecommendationRationale = {
  readonly rationaleId: string;
  readonly recommendationId: string;
  readonly primaryTheme: RuntimeBridgeInterpretationTheme;
  readonly priority: RuntimeBridgeRecommendationPriority;
  readonly summary: string;
  readonly supportingSignalIds: ReadonlyArray<string>;
  readonly evidenceReferenceIds: ReadonlyArray<string>;
  readonly confidenceGroup: "limited" | "moderate" | "strong";
  readonly metadataOnly: true;
};

export type RuntimeBridgeOperationalEscalation = {
  readonly escalationId: string;
  readonly subjectId: string;
  readonly posture: "none" | "watch" | "review" | "urgent_review";
  readonly priority: RuntimeBridgeRecommendationPriority;
  readonly rationale: string;
  readonly signalIds: ReadonlyArray<string>;
  readonly evidenceReferenceIds: ReadonlyArray<string>;
  readonly metadataOnly: true;
};

export type RuntimeBridgeUrgencySummary = {
  readonly urgencyId: string;
  readonly subjectId: string;
  readonly urgency: RuntimeBridgeRecommendationPriority;
  readonly summary: string;
  readonly highPriorityRecommendationCount: number;
  readonly riskIndicatorCount: number;
  readonly evidenceReferenceCount: number;
  readonly metadataOnly: true;
};

export type RuntimeBridgeExecutiveRecommendation = {
  readonly recommendationId: string;
  readonly sourceRecommendationId: string;
  readonly priority: RuntimeBridgeRecommendationPriority;
  readonly rank: number;
  readonly theme: RuntimeBridgeInterpretationTheme;
  readonly label: string;
  readonly summary: string;
  readonly rationale: RuntimeBridgeRecommendationRationale;
  readonly prioritySignalIds: ReadonlyArray<string>;
  readonly relatedInsightIds: ReadonlyArray<string>;
  readonly evidenceReferenceIds: ReadonlyArray<string>;
  readonly metadataOnly: true;
};

export type RuntimeBridgeRecommendationCluster = {
  readonly clusterId: string;
  readonly theme: RuntimeBridgeInterpretationTheme;
  readonly priority: RuntimeBridgeRecommendationPriority;
  readonly recommendationIds: ReadonlyArray<string>;
  readonly signalIds: ReadonlyArray<string>;
  readonly evidenceReferenceIds: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeExecutiveNarrative = {
  readonly narrativeId: string;
  readonly subjectId: string;
  readonly headline: string;
  readonly summary: string;
  readonly urgency: RuntimeBridgeUrgencySummary;
  readonly escalation: RuntimeBridgeOperationalEscalation;
  readonly recommendationIds: ReadonlyArray<string>;
  readonly clusterIds: ReadonlyArray<string>;
  readonly themeIds: ReadonlyArray<RuntimeBridgeInterpretationTheme>;
  readonly metadataOnly: true;
};

export type RuntimeBridgeRecommendationTimeline = {
  readonly timelineId: string;
  readonly subjectId: string;
  readonly orderedRecommendationIds: ReadonlyArray<string>;
  readonly orderedSignalIds: ReadonlyArray<string>;
  readonly orderedClusterIds: ReadonlyArray<string>;
  readonly metadataOnly: true;
};

export type RuntimeBridgeExecutiveInsightSummary = {
  readonly insightSummaryId: string;
  readonly subjectId: string;
  readonly urgency: RuntimeBridgeUrgencySummary;
  readonly escalation: RuntimeBridgeOperationalEscalation;
  readonly recommendations: ReadonlyArray<RuntimeBridgeExecutiveRecommendation>;
  readonly clusters: ReadonlyArray<RuntimeBridgeRecommendationCluster>;
  readonly themes: ReadonlyArray<RuntimeBridgeInterpretationTheme>;
  readonly timeline: RuntimeBridgeRecommendationTimeline;
  readonly narrative: RuntimeBridgeExecutiveNarrative;
  readonly prioritySignals: ReadonlyArray<RuntimeBridgePrioritySignal>;
  readonly metadataOnly: true;
};

export const runtimeBridgeExecutiveRecommendationGovernance = {
  mode: "metadata_only",
  contractId: "runtime-bridge-executive-recommendations",
  label: "Runtime bridge executive recommendations",
  description:
    "Metadata-only executive recommendation ranking, urgency summaries, operational escalation posture, rationale, clustering, and narrative insight summaries.",
  confidence: "high",
  canExecute: false,
  canMutateWorkspace: false,
  canCallBackend: false,
  lineageRefs: [
    "runtime-bridge-executive-recommendation",
    "runtime-bridge-priority-signal",
    "runtime-bridge-urgency-summary",
    "runtime-bridge-operational-escalation",
    "runtime-bridge-recommendation-rationale",
    "runtime-bridge-recommendation-cluster",
    "runtime-bridge-executive-narrative",
  ],
} satisfies MetadataOnlyBoundaryContract;

export const runtimeBridgeExecutiveRecommendationSourceModule: RuntimeBridgeSourceModuleReference = {
  moduleId: "runtime-bridge-executive-recommendations",
  modulePath: "frontend/src/features/runtimeBridge/runtimeBridgeExecutiveRecommendations.ts",
  capabilityMode: "metadata_only",
  label: "Runtime bridge executive recommendations",
};

const uniqueStable = <T extends string>(items: ReadonlyArray<T>): T[] => {
  const seen = new Set<string>();
  const values: T[] = [];

  for (const item of items) {
    if (!item || seen.has(item)) continue;
    seen.add(item);
    values.push(item);
  }

  return values;
};

const priorityScore = (priority: RuntimeBridgeRecommendationPriority) => {
  if (priority === "critical") return 4;
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  return 1;
};

const severityPriority = (
  severity: RuntimeBridgeInsightSeverity,
): RuntimeBridgeRecommendationPriority => {
  if (severity === "critical") return "critical";
  if (severity === "high") return "high";
  if (severity === "medium") return "medium";
  return "low";
};

const recommendationPriority = (
  recommendation: RuntimeBridgeRecommendationSummary,
): RuntimeBridgeRecommendationPriority => recommendation.priority;

const comparePriorityMetadata = <T extends { readonly priority: RuntimeBridgeRecommendationPriority }>(
  left: T,
  right: T,
) => priorityScore(right.priority) - priorityScore(left.priority);

const sortByPriorityThenId = <T extends { readonly priority: RuntimeBridgeRecommendationPriority }>(
  items: ReadonlyArray<T>,
  getId: (item: T) => string,
): T[] =>
  [...items].sort((left, right) => {
    const priorityDelta = comparePriorityMetadata(left, right);
    if (priorityDelta !== 0) return priorityDelta;
    return getId(left).localeCompare(getId(right));
  });

const confidenceGroup = (evidenceReferenceIds: ReadonlyArray<string>) => {
  if (evidenceReferenceIds.length >= 8) return "strong" as const;
  if (evidenceReferenceIds.length >= 3) return "moderate" as const;
  return "limited" as const;
};

const collectRecommendationEvidence = (
  recommendation: RuntimeBridgeRecommendationSummary,
  signals: ReadonlyArray<RuntimeBridgePrioritySignal>,
) =>
  uniqueStable([
    ...recommendation.evidenceReferenceIds,
    ...signals.flatMap((signal) => signal.evidenceReferenceIds),
  ]);

const signalTheme = (
  signal: RuntimeBridgeOperationalSignal | RuntimeBridgeRiskIndicator | RuntimeBridgeOpportunityIndicator,
): RuntimeBridgeInterpretationTheme => {
  if ("theme" in signal) return signal.theme;
  if ("opportunityId" in signal) return "opportunity";
  return "risk";
};

const recommendationTheme = (
  recommendation: RuntimeBridgeRecommendationSummary,
  signals: ReadonlyArray<RuntimeBridgePrioritySignal>,
): RuntimeBridgeInterpretationTheme => signals[0]?.theme || (recommendation.priority === "high" ? "risk" : "advisory");

export const collectRuntimeBridgePrioritySignals = (
  interpretation: RuntimeBridgeInsightInterpretation,
): ReadonlyArray<RuntimeBridgePrioritySignal> => {
  const operationalSignals = interpretation.operationalSignals.map((signal) => ({
    signalId: createRuntimeBridgeId("runtime-bridge-priority-signal", signal.signalId),
    theme: signal.theme,
    priority: signal.strength === "high" ? "high" as const : signal.strength === "medium" ? "medium" as const : "low" as const,
    label: signal.label,
    summary: `Operational metadata signal strength is ${signal.strength}.`,
    weight: signal.strength === "high" ? 3 : signal.strength === "medium" ? 2 : 1,
    evidenceReferenceIds: signal.evidenceReferenceIds,
    relatedInsightIds: [],
    metadataOnly: true as const,
  }));
  const riskSignals = interpretation.riskIndicators.map((risk) => ({
    signalId: createRuntimeBridgeId("runtime-bridge-priority-signal", risk.riskId),
    theme: signalTheme(risk),
    priority: severityPriority(risk.severity),
    label: risk.label,
    summary: risk.rationale,
    weight: priorityScore(severityPriority(risk.severity)) + 1,
    evidenceReferenceIds: risk.evidenceReferenceIds,
    relatedInsightIds: [],
    metadataOnly: true as const,
  }));
  const opportunitySignals = interpretation.opportunityIndicators.map((opportunity) => ({
    signalId: createRuntimeBridgeId("runtime-bridge-priority-signal", opportunity.opportunityId),
    theme: signalTheme(opportunity),
    priority: opportunity.priority,
    label: opportunity.label,
    summary: opportunity.rationale,
    weight: priorityScore(opportunity.priority),
    evidenceReferenceIds: opportunity.evidenceReferenceIds,
    relatedInsightIds: [],
    metadataOnly: true as const,
  }));
  const businessImpactSignal = {
    signalId: createRuntimeBridgeId(
      "runtime-bridge-priority-signal",
      interpretation.businessImpact.impactId,
    ),
    theme: interpretation.businessImpact.theme,
    priority: severityPriority(interpretation.businessImpact.severity),
    label: interpretation.businessImpact.label,
    summary: interpretation.businessImpact.summary,
    weight: priorityScore(severityPriority(interpretation.businessImpact.severity)),
    evidenceReferenceIds: interpretation.businessImpact.evidenceReferenceIds,
    relatedInsightIds: [],
    metadataOnly: true as const,
  };

  return sortByPriorityThenId(
    [...riskSignals, businessImpactSignal, ...operationalSignals, ...opportunitySignals],
    (signal) => signal.signalId,
  );
};

export const summarizeRuntimeBridgeUrgency = (
  interpretation: RuntimeBridgeInsightInterpretation,
): RuntimeBridgeUrgencySummary => {
  const evidenceReferenceCount = uniqueStable([
    ...interpretation.businessImpact.evidenceReferenceIds,
    ...interpretation.riskIndicators.flatMap((risk) => risk.evidenceReferenceIds),
    ...interpretation.recommendations.flatMap((recommendation) => recommendation.evidenceReferenceIds),
  ]).length;
  const riskIndicatorCount = interpretation.riskIndicators.length;
  const highPriorityRecommendationCount = interpretation.recommendations.filter(
    (recommendation) => recommendation.priority === "high",
  ).length;
  const urgency: RuntimeBridgeRecommendationPriority =
    interpretation.severity === "critical" || riskIndicatorCount >= 3
      ? "critical"
      : interpretation.severity === "high" || highPriorityRecommendationCount >= 2
        ? "high"
        : evidenceReferenceCount >= 5
          ? "medium"
          : "low";

  return {
    urgencyId: createRuntimeBridgeId("runtime-bridge-urgency-summary", interpretation.subjectId),
    subjectId: interpretation.subjectId,
    urgency,
    summary: `Executive urgency is ${urgency} from ${riskIndicatorCount} risk indicators, ${highPriorityRecommendationCount} high-priority recommendations, and ${evidenceReferenceCount} evidence references.`,
    highPriorityRecommendationCount,
    riskIndicatorCount,
    evidenceReferenceCount,
    metadataOnly: true,
  };
};

export const classifyRuntimeBridgeOperationalEscalation = ({
  interpretation,
  urgency = summarizeRuntimeBridgeUrgency(interpretation),
  prioritySignals = collectRuntimeBridgePrioritySignals(interpretation),
}: {
  readonly interpretation: RuntimeBridgeInsightInterpretation;
  readonly urgency?: RuntimeBridgeUrgencySummary;
  readonly prioritySignals?: ReadonlyArray<RuntimeBridgePrioritySignal>;
}): RuntimeBridgeOperationalEscalation => {
  const posture: RuntimeBridgeOperationalEscalation["posture"] =
    urgency.urgency === "critical"
      ? "urgent_review"
      : urgency.urgency === "high"
        ? "review"
        : urgency.urgency === "medium"
          ? "watch"
          : "none";

  return {
    escalationId: createRuntimeBridgeId("runtime-bridge-operational-escalation", interpretation.subjectId),
    subjectId: interpretation.subjectId,
    posture,
    priority: urgency.urgency,
    rationale: `Escalation posture is ${posture} based on ${urgency.summary}`,
    signalIds: prioritySignals.map((signal) => signal.signalId),
    evidenceReferenceIds: uniqueStable(prioritySignals.flatMap((signal) => signal.evidenceReferenceIds)),
    metadataOnly: true,
  };
};

export const summarizeRuntimeBridgeRecommendationRationale = ({
  recommendation,
  prioritySignals,
}: {
  readonly recommendation: RuntimeBridgeRecommendationSummary;
  readonly prioritySignals: ReadonlyArray<RuntimeBridgePrioritySignal>;
}): RuntimeBridgeRecommendationRationale => {
  const relatedSignals = prioritySignals.filter((signal) =>
    signal.evidenceReferenceIds.some((evidenceId) =>
      recommendation.evidenceReferenceIds.includes(evidenceId),
    ),
  );
  const evidenceReferenceIds = collectRecommendationEvidence(recommendation, relatedSignals);
  const priority = recommendationPriority(recommendation);
  const primaryTheme = recommendationTheme(recommendation, relatedSignals);

  return {
    rationaleId: createRuntimeBridgeId("runtime-bridge-recommendation-rationale", recommendation.recommendationId),
    recommendationId: recommendation.recommendationId,
    primaryTheme,
    priority,
    summary: `${recommendation.label} is prioritized as ${priority} with ${relatedSignals.length} supporting priority signals and ${evidenceReferenceIds.length} evidence references.`,
    supportingSignalIds: relatedSignals.map((signal) => signal.signalId),
    evidenceReferenceIds,
    confidenceGroup: confidenceGroup(evidenceReferenceIds),
    metadataOnly: true,
  };
};

export const prioritizeRuntimeBridgeExecutiveRecommendations = ({
  interpretation,
  prioritySignals = collectRuntimeBridgePrioritySignals(interpretation),
}: {
  readonly interpretation: RuntimeBridgeInsightInterpretation;
  readonly prioritySignals?: ReadonlyArray<RuntimeBridgePrioritySignal>;
}): ReadonlyArray<RuntimeBridgeExecutiveRecommendation> =>
  sortByPriorityThenId(
    interpretation.recommendations.map((recommendation) => {
      const rationale = summarizeRuntimeBridgeRecommendationRationale({
        recommendation,
        prioritySignals,
      });

      return {
        recommendationId: createRuntimeBridgeId(
          "runtime-bridge-executive-recommendation",
          recommendation.recommendationId,
        ),
        sourceRecommendationId: recommendation.recommendationId,
        priority: recommendationPriority(recommendation),
        rank: 0,
        theme: rationale.primaryTheme,
        label: recommendation.label,
        summary: recommendation.summary,
        rationale,
        prioritySignalIds: rationale.supportingSignalIds,
        relatedInsightIds: recommendation.relatedInsightIds,
        evidenceReferenceIds: rationale.evidenceReferenceIds,
        metadataOnly: true as const,
      };
    }),
    (recommendation) => recommendation.recommendationId,
  ).map((recommendation, index) => ({
    ...recommendation,
    rank: index + 1,
  }));

export const collectRuntimeBridgeRecommendationThemes = (
  recommendations: ReadonlyArray<RuntimeBridgeExecutiveRecommendation>,
): ReadonlyArray<RuntimeBridgeInterpretationTheme> =>
  uniqueStable(recommendations.map((recommendation) => recommendation.theme));

export const clusterRuntimeBridgeRecommendations = (
  recommendations: ReadonlyArray<RuntimeBridgeExecutiveRecommendation>,
): ReadonlyArray<RuntimeBridgeRecommendationCluster> =>
  collectRuntimeBridgeRecommendationThemes(recommendations).map((theme) => {
    const themeRecommendations = sortByPriorityThenId(
      recommendations.filter((recommendation) => recommendation.theme === theme),
      (recommendation) => recommendation.recommendationId,
    );
    const priority = themeRecommendations[0]?.priority || "low";

    return {
      clusterId: createRuntimeBridgeId("runtime-bridge-recommendation-cluster", theme),
      theme,
      priority,
      recommendationIds: themeRecommendations.map((recommendation) => recommendation.recommendationId),
      signalIds: uniqueStable(themeRecommendations.flatMap((recommendation) => recommendation.prioritySignalIds)),
      evidenceReferenceIds: uniqueStable(
        themeRecommendations.flatMap((recommendation) => recommendation.evidenceReferenceIds),
      ),
      summary: `${themeRecommendations.length} executive recommendations are grouped under ${theme} with ${priority} priority.`,
      metadataOnly: true,
    };
  });

export const buildRuntimeBridgeRecommendationTimeline = ({
  subjectId,
  recommendations,
  prioritySignals,
  clusters,
}: {
  readonly subjectId: string;
  readonly recommendations: ReadonlyArray<RuntimeBridgeExecutiveRecommendation>;
  readonly prioritySignals: ReadonlyArray<RuntimeBridgePrioritySignal>;
  readonly clusters: ReadonlyArray<RuntimeBridgeRecommendationCluster>;
}): RuntimeBridgeRecommendationTimeline => ({
  timelineId: createRuntimeBridgeId("runtime-bridge-recommendation-timeline", subjectId),
  subjectId,
  orderedRecommendationIds: recommendations.map((recommendation) => recommendation.recommendationId),
  orderedSignalIds: prioritySignals.map((signal) => signal.signalId),
  orderedClusterIds: clusters.map((cluster) => cluster.clusterId),
  metadataOnly: true,
});

export const buildRuntimeBridgeExecutiveNarrative = ({
  interpretation,
  urgency,
  escalation,
  recommendations,
  clusters,
}: {
  readonly interpretation: RuntimeBridgeInsightInterpretation;
  readonly urgency: RuntimeBridgeUrgencySummary;
  readonly escalation: RuntimeBridgeOperationalEscalation;
  readonly recommendations: ReadonlyArray<RuntimeBridgeExecutiveRecommendation>;
  readonly clusters: ReadonlyArray<RuntimeBridgeRecommendationCluster>;
}): RuntimeBridgeExecutiveNarrative => {
  const themes = collectRuntimeBridgeRecommendationThemes(recommendations);
  const topRecommendation = recommendations[0];
  const headline = topRecommendation
    ? `${topRecommendation.label} is the top executive recommendation`
    : "No executive recommendations are available";

  return {
    narrativeId: createRuntimeBridgeId("runtime-bridge-executive-narrative", interpretation.subjectId),
    subjectId: interpretation.subjectId,
    headline,
    summary: `Executive insight summary describes ${urgency.urgency} urgency, ${escalation.posture} escalation posture, ${recommendations.length} recommendations, and ${clusters.length} recommendation clusters.`,
    urgency,
    escalation,
    recommendationIds: recommendations.map((recommendation) => recommendation.recommendationId),
    clusterIds: clusters.map((cluster) => cluster.clusterId),
    themeIds: themes,
    metadataOnly: true,
  };
};

export const summarizeRuntimeBridgeExecutiveInsights = (
  interpretation: RuntimeBridgeInsightInterpretation,
): RuntimeBridgeExecutiveInsightSummary => {
  const prioritySignals = collectRuntimeBridgePrioritySignals(interpretation);
  const urgency = summarizeRuntimeBridgeUrgency(interpretation);
  const escalation = classifyRuntimeBridgeOperationalEscalation({
    interpretation,
    urgency,
    prioritySignals,
  });
  const recommendations = prioritizeRuntimeBridgeExecutiveRecommendations({
    interpretation,
    prioritySignals,
  });
  const clusters = clusterRuntimeBridgeRecommendations(recommendations);
  const themes = collectRuntimeBridgeRecommendationThemes(recommendations);
  const timeline = buildRuntimeBridgeRecommendationTimeline({
    subjectId: interpretation.subjectId,
    recommendations,
    prioritySignals,
    clusters,
  });
  const narrative = buildRuntimeBridgeExecutiveNarrative({
    interpretation,
    urgency,
    escalation,
    recommendations,
    clusters,
  });

  return {
    insightSummaryId: createRuntimeBridgeId(
      "runtime-bridge-executive-insight-summary",
      interpretation.subjectId,
    ),
    subjectId: interpretation.subjectId,
    urgency,
    escalation,
    recommendations,
    clusters,
    themes,
    timeline,
    narrative,
    prioritySignals,
    metadataOnly: true,
  };
};
