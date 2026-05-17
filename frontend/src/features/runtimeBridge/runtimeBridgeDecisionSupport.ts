import type { MetadataOnlyBoundaryContract } from "../governance/boundaryTypes";
import type {
  RuntimeBridgeExecutiveInsightSummary,
  RuntimeBridgeExecutiveRecommendation,
  RuntimeBridgeOperationalEscalation,
  RuntimeBridgePrioritySignal,
  RuntimeBridgeRecommendationCluster,
  RuntimeBridgeRecommendationPriority,
  RuntimeBridgeUrgencySummary,
} from "./runtimeBridgeExecutiveRecommendations";
import { createRuntimeBridgeId } from "./runtimeBridgeIds";
import type { RuntimeBridgeInterpretationTheme } from "./runtimeBridgeInsightInterpretation";
import type { RuntimeBridgeSourceModuleReference } from "./runtimeBridgeTypes";

export type RuntimeBridgeInsightPackage = {
  readonly packageId: string;
  readonly subjectId: string;
  readonly theme: RuntimeBridgeInterpretationTheme;
  readonly priority: RuntimeBridgeRecommendationPriority;
  readonly signalIds: ReadonlyArray<string>;
  readonly recommendationIds: ReadonlyArray<string>;
  readonly evidenceReferenceIds: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeRecommendationPackage = {
  readonly packageId: string;
  readonly subjectId: string;
  readonly priority: RuntimeBridgeRecommendationPriority;
  readonly theme: RuntimeBridgeInterpretationTheme;
  readonly recommendationIds: ReadonlyArray<string>;
  readonly rationaleIds: ReadonlyArray<string>;
  readonly evidenceReferenceIds: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeExecutiveBriefing = {
  readonly briefingId: string;
  readonly subjectId: string;
  readonly headline: string;
  readonly urgency: RuntimeBridgeUrgencySummary;
  readonly primaryThemes: ReadonlyArray<RuntimeBridgeInterpretationTheme>;
  readonly recommendationPackageIds: ReadonlyArray<string>;
  readonly insightPackageIds: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeOperationalBriefing = {
  readonly briefingId: string;
  readonly subjectId: string;
  readonly escalation: RuntimeBridgeOperationalEscalation;
  readonly clusterIds: ReadonlyArray<string>;
  readonly signalIds: ReadonlyArray<string>;
  readonly evidenceReferenceIds: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeDecisionSummary = {
  readonly summaryId: string;
  readonly subjectId: string;
  readonly priority: RuntimeBridgeRecommendationPriority;
  readonly themeCount: number;
  readonly insightPackageCount: number;
  readonly recommendationPackageCount: number;
  readonly evidenceReferenceCount: number;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeInsightDelivery = {
  readonly deliveryId: string;
  readonly subjectId: string;
  readonly orderedInsightPackageIds: ReadonlyArray<string>;
  readonly orderedRecommendationPackageIds: ReadonlyArray<string>;
  readonly orderedBriefingIds: ReadonlyArray<string>;
  readonly orderedNarrativeIds: ReadonlyArray<string>;
  readonly metadataOnly: true;
};

export type RuntimeBridgeDecisionNarrative = {
  readonly narrativeId: string;
  readonly subjectId: string;
  readonly headline: string;
  readonly summary: string;
  readonly decisionSummaryId: string;
  readonly executiveBriefingId: string;
  readonly operationalBriefingId: string;
  readonly insightPackageIds: ReadonlyArray<string>;
  readonly recommendationPackageIds: ReadonlyArray<string>;
  readonly themeIds: ReadonlyArray<RuntimeBridgeInterpretationTheme>;
  readonly metadataOnly: true;
};

export type RuntimeBridgeDecisionSupportPackage = {
  readonly packageId: string;
  readonly subjectId: string;
  readonly executiveBriefing: RuntimeBridgeExecutiveBriefing;
  readonly operationalBriefing: RuntimeBridgeOperationalBriefing;
  readonly insightPackages: ReadonlyArray<RuntimeBridgeInsightPackage>;
  readonly recommendationPackages: ReadonlyArray<RuntimeBridgeRecommendationPackage>;
  readonly decisionSummary: RuntimeBridgeDecisionSummary;
  readonly delivery: RuntimeBridgeInsightDelivery;
  readonly narrative: RuntimeBridgeDecisionNarrative;
  readonly sourceInsightSummaryId: string;
  readonly metadataOnly: true;
};

export const runtimeBridgeDecisionSupportGovernance = {
  mode: "metadata_only",
  contractId: "runtime-bridge-decision-support",
  label: "Runtime bridge decision support",
  description:
    "Metadata-only executive briefing structures, operational insight packaging, recommendation package assembly, decision summaries, and deterministic intelligence delivery metadata.",
  confidence: "high",
  canExecute: false,
  canMutateWorkspace: false,
  canCallBackend: false,
  lineageRefs: [
    "runtime-bridge-decision-support-package",
    "runtime-bridge-executive-briefing",
    "runtime-bridge-operational-briefing",
    "runtime-bridge-insight-package",
    "runtime-bridge-recommendation-package",
    "runtime-bridge-decision-summary",
    "runtime-bridge-insight-delivery",
    "runtime-bridge-decision-narrative",
  ],
} satisfies MetadataOnlyBoundaryContract;

export const runtimeBridgeDecisionSupportSourceModule: RuntimeBridgeSourceModuleReference = {
  moduleId: "runtime-bridge-decision-support",
  modulePath: "frontend/src/features/runtimeBridge/runtimeBridgeDecisionSupport.ts",
  capabilityMode: "metadata_only",
  label: "Runtime bridge decision support",
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

const sortPriorityMetadata = <T extends { readonly priority: RuntimeBridgeRecommendationPriority }>(
  items: ReadonlyArray<T>,
  getId: (item: T) => string,
): T[] =>
  [...items].sort((left, right) => {
    const priorityDelta = priorityScore(right.priority) - priorityScore(left.priority);
    if (priorityDelta !== 0) return priorityDelta;
    return getId(left).localeCompare(getId(right));
  });

const strongestPriority = (
  priorities: ReadonlyArray<RuntimeBridgeRecommendationPriority>,
): RuntimeBridgeRecommendationPriority =>
  sortPriorityMetadata(
    priorities.map((priority) => ({ priority })),
    (item) => item.priority,
  )[0]?.priority || "low";

const collectClusterSignals = (
  cluster: RuntimeBridgeRecommendationCluster,
  prioritySignals: ReadonlyArray<RuntimeBridgePrioritySignal>,
) =>
  prioritySignals.filter(
    (signal) =>
      signal.theme === cluster.theme ||
      cluster.signalIds.includes(signal.signalId) ||
      signal.evidenceReferenceIds.some((evidenceId) => cluster.evidenceReferenceIds.includes(evidenceId)),
  );

const collectRecommendationPackageEvidence = (
  recommendations: ReadonlyArray<RuntimeBridgeExecutiveRecommendation>,
) => uniqueStable(recommendations.flatMap((recommendation) => recommendation.evidenceReferenceIds));

export const collectRuntimeBridgeDecisionThemes = (
  summary: RuntimeBridgeExecutiveInsightSummary,
): ReadonlyArray<RuntimeBridgeInterpretationTheme> =>
  uniqueStable([
    ...summary.themes,
    ...summary.recommendations.map((recommendation) => recommendation.theme),
    ...summary.clusters.map((cluster) => cluster.theme),
    ...summary.prioritySignals.map((signal) => signal.theme),
  ]);

export const assembleRuntimeBridgeInsightPackages = (
  summary: RuntimeBridgeExecutiveInsightSummary,
): ReadonlyArray<RuntimeBridgeInsightPackage> =>
  sortPriorityMetadata(
    summary.clusters.map((cluster) => {
      const signals = collectClusterSignals(cluster, summary.prioritySignals);
      const recommendationIds = summary.recommendations
        .filter((recommendation) => cluster.recommendationIds.includes(recommendation.recommendationId))
        .map((recommendation) => recommendation.recommendationId);
      const evidenceReferenceIds = uniqueStable([
        ...cluster.evidenceReferenceIds,
        ...signals.flatMap((signal) => signal.evidenceReferenceIds),
      ]);

      return {
        packageId: createRuntimeBridgeId("runtime-bridge-insight-package", summary.subjectId, cluster.theme),
        subjectId: summary.subjectId,
        theme: cluster.theme,
        priority: cluster.priority,
        signalIds: uniqueStable([...cluster.signalIds, ...signals.map((signal) => signal.signalId)]),
        recommendationIds,
        evidenceReferenceIds,
        summary: `${cluster.theme} insight package includes ${recommendationIds.length} recommendations, ${signals.length} priority signals, and ${evidenceReferenceIds.length} evidence references.`,
        metadataOnly: true as const,
      };
    }),
    (insightPackage) => insightPackage.packageId,
  );

export const assembleRuntimeBridgeRecommendationPackages = (
  summary: RuntimeBridgeExecutiveInsightSummary,
): ReadonlyArray<RuntimeBridgeRecommendationPackage> => {
  const themes = collectRuntimeBridgeDecisionThemes(summary);

  return sortPriorityMetadata(
    themes.map((theme) => {
      const recommendations = sortPriorityMetadata(
        summary.recommendations.filter((recommendation) => recommendation.theme === theme),
        (recommendation) => recommendation.recommendationId,
      );
      const priority = strongestPriority(recommendations.map((recommendation) => recommendation.priority));
      const evidenceReferenceIds = collectRecommendationPackageEvidence(recommendations);

      return {
        packageId: createRuntimeBridgeId("runtime-bridge-recommendation-package", summary.subjectId, theme),
        subjectId: summary.subjectId,
        priority,
        theme,
        recommendationIds: recommendations.map((recommendation) => recommendation.recommendationId),
        rationaleIds: recommendations.map((recommendation) => recommendation.rationale.rationaleId),
        evidenceReferenceIds,
        summary: `${theme} recommendation package includes ${recommendations.length} ranked recommendations and ${evidenceReferenceIds.length} evidence references.`,
        metadataOnly: true as const,
      };
    }),
    (recommendationPackage) => recommendationPackage.packageId,
  );
};

export const buildRuntimeBridgeExecutiveBriefing = ({
  summary,
  insightPackages = assembleRuntimeBridgeInsightPackages(summary),
  recommendationPackages = assembleRuntimeBridgeRecommendationPackages(summary),
}: {
  readonly summary: RuntimeBridgeExecutiveInsightSummary;
  readonly insightPackages?: ReadonlyArray<RuntimeBridgeInsightPackage>;
  readonly recommendationPackages?: ReadonlyArray<RuntimeBridgeRecommendationPackage>;
}): RuntimeBridgeExecutiveBriefing => {
  const themes = collectRuntimeBridgeDecisionThemes(summary);

  return {
    briefingId: createRuntimeBridgeId("runtime-bridge-executive-briefing", summary.subjectId),
    subjectId: summary.subjectId,
    headline: summary.narrative.headline,
    urgency: summary.urgency,
    primaryThemes: themes,
    recommendationPackageIds: recommendationPackages.map((recommendationPackage) => recommendationPackage.packageId),
    insightPackageIds: insightPackages.map((insightPackage) => insightPackage.packageId),
    summary: `Executive briefing packages ${recommendationPackages.length} recommendation groups and ${insightPackages.length} insight groups with ${summary.urgency.urgency} urgency.`,
    metadataOnly: true,
  };
};

export const buildRuntimeBridgeOperationalBriefing = ({
  summary,
  insightPackages = assembleRuntimeBridgeInsightPackages(summary),
}: {
  readonly summary: RuntimeBridgeExecutiveInsightSummary;
  readonly insightPackages?: ReadonlyArray<RuntimeBridgeInsightPackage>;
}): RuntimeBridgeOperationalBriefing => {
  const evidenceReferenceIds = uniqueStable([
    ...summary.escalation.evidenceReferenceIds,
    ...insightPackages.flatMap((insightPackage) => insightPackage.evidenceReferenceIds),
  ]);

  return {
    briefingId: createRuntimeBridgeId("runtime-bridge-operational-briefing", summary.subjectId),
    subjectId: summary.subjectId,
    escalation: summary.escalation,
    clusterIds: summary.clusters.map((cluster) => cluster.clusterId),
    signalIds: uniqueStable([
      ...summary.escalation.signalIds,
      ...insightPackages.flatMap((insightPackage) => insightPackage.signalIds),
    ]),
    evidenceReferenceIds,
    summary: `Operational briefing describes ${summary.escalation.posture} escalation posture across ${summary.clusters.length} clusters and ${evidenceReferenceIds.length} evidence references.`,
    metadataOnly: true,
  };
};

export const summarizeRuntimeBridgeDecisionSupport = ({
  summary,
  insightPackages,
  recommendationPackages,
}: {
  readonly summary: RuntimeBridgeExecutiveInsightSummary;
  readonly insightPackages: ReadonlyArray<RuntimeBridgeInsightPackage>;
  readonly recommendationPackages: ReadonlyArray<RuntimeBridgeRecommendationPackage>;
}): RuntimeBridgeDecisionSummary => {
  const themes = collectRuntimeBridgeDecisionThemes(summary);
  const evidenceReferenceCount = uniqueStable([
    ...insightPackages.flatMap((insightPackage) => insightPackage.evidenceReferenceIds),
    ...recommendationPackages.flatMap((recommendationPackage) => recommendationPackage.evidenceReferenceIds),
  ]).length;
  const priority = strongestPriority([
    summary.urgency.urgency,
    ...insightPackages.map((insightPackage) => insightPackage.priority),
    ...recommendationPackages.map((recommendationPackage) => recommendationPackage.priority),
  ]);

  return {
    summaryId: createRuntimeBridgeId("runtime-bridge-decision-summary", summary.subjectId),
    subjectId: summary.subjectId,
    priority,
    themeCount: themes.length,
    insightPackageCount: insightPackages.length,
    recommendationPackageCount: recommendationPackages.length,
    evidenceReferenceCount,
    summary: `Decision-support package is ${priority} priority across ${themes.length} themes, ${insightPackages.length} insight packages, ${recommendationPackages.length} recommendation packages, and ${evidenceReferenceCount} evidence references.`,
    metadataOnly: true,
  };
};

export const buildRuntimeBridgeInsightDeliveryTimeline = ({
  subjectId,
  executiveBriefing,
  operationalBriefing,
  insightPackages,
  recommendationPackages,
  narrativeId,
}: {
  readonly subjectId: string;
  readonly executiveBriefing: RuntimeBridgeExecutiveBriefing;
  readonly operationalBriefing: RuntimeBridgeOperationalBriefing;
  readonly insightPackages: ReadonlyArray<RuntimeBridgeInsightPackage>;
  readonly recommendationPackages: ReadonlyArray<RuntimeBridgeRecommendationPackage>;
  readonly narrativeId: string;
}): RuntimeBridgeInsightDelivery => ({
  deliveryId: createRuntimeBridgeId("runtime-bridge-insight-delivery", subjectId),
  subjectId,
  orderedInsightPackageIds: insightPackages.map((insightPackage) => insightPackage.packageId),
  orderedRecommendationPackageIds: recommendationPackages.map(
    (recommendationPackage) => recommendationPackage.packageId,
  ),
  orderedBriefingIds: [executiveBriefing.briefingId, operationalBriefing.briefingId],
  orderedNarrativeIds: [narrativeId],
  metadataOnly: true,
});

export const buildRuntimeBridgeDecisionNarrative = ({
  summary,
  executiveBriefing,
  operationalBriefing,
  insightPackages,
  recommendationPackages,
  decisionSummary,
}: {
  readonly summary: RuntimeBridgeExecutiveInsightSummary;
  readonly executiveBriefing: RuntimeBridgeExecutiveBriefing;
  readonly operationalBriefing: RuntimeBridgeOperationalBriefing;
  readonly insightPackages: ReadonlyArray<RuntimeBridgeInsightPackage>;
  readonly recommendationPackages: ReadonlyArray<RuntimeBridgeRecommendationPackage>;
  readonly decisionSummary: RuntimeBridgeDecisionSummary;
}): RuntimeBridgeDecisionNarrative => {
  const themes = collectRuntimeBridgeDecisionThemes(summary);

  return {
    narrativeId: createRuntimeBridgeId("runtime-bridge-decision-narrative", summary.subjectId),
    subjectId: summary.subjectId,
    headline: executiveBriefing.headline,
    summary: `Decision-support narrative explains ${decisionSummary.priority} priority delivery across ${themes.length} themes with ${operationalBriefing.escalation.posture} operational posture.`,
    decisionSummaryId: decisionSummary.summaryId,
    executiveBriefingId: executiveBriefing.briefingId,
    operationalBriefingId: operationalBriefing.briefingId,
    insightPackageIds: insightPackages.map((insightPackage) => insightPackage.packageId),
    recommendationPackageIds: recommendationPackages.map(
      (recommendationPackage) => recommendationPackage.packageId,
    ),
    themeIds: themes,
    metadataOnly: true,
  };
};

export const summarizeRuntimeBridgeExecutiveDelivery = (
  decisionPackage: RuntimeBridgeDecisionSupportPackage,
): RuntimeBridgeDecisionSummary => ({
  summaryId: createRuntimeBridgeId(
    "runtime-bridge-executive-delivery-summary",
    decisionPackage.subjectId,
  ),
  subjectId: decisionPackage.subjectId,
  priority: decisionPackage.decisionSummary.priority,
  themeCount: decisionPackage.decisionSummary.themeCount,
  insightPackageCount: decisionPackage.insightPackages.length,
  recommendationPackageCount: decisionPackage.recommendationPackages.length,
  evidenceReferenceCount: decisionPackage.decisionSummary.evidenceReferenceCount,
  summary: `Executive delivery metadata includes ${decisionPackage.delivery.orderedBriefingIds.length} briefings, ${decisionPackage.delivery.orderedInsightPackageIds.length} insight packages, and ${decisionPackage.delivery.orderedRecommendationPackageIds.length} recommendation packages.`,
  metadataOnly: true,
});

export const buildRuntimeBridgeDecisionSupportPackage = (
  summary: RuntimeBridgeExecutiveInsightSummary,
): RuntimeBridgeDecisionSupportPackage => {
  const insightPackages = assembleRuntimeBridgeInsightPackages(summary);
  const recommendationPackages = assembleRuntimeBridgeRecommendationPackages(summary);
  const executiveBriefing = buildRuntimeBridgeExecutiveBriefing({
    summary,
    insightPackages,
    recommendationPackages,
  });
  const operationalBriefing = buildRuntimeBridgeOperationalBriefing({
    summary,
    insightPackages,
  });
  const decisionSummary = summarizeRuntimeBridgeDecisionSupport({
    summary,
    insightPackages,
    recommendationPackages,
  });
  const narrative = buildRuntimeBridgeDecisionNarrative({
    summary,
    executiveBriefing,
    operationalBriefing,
    insightPackages,
    recommendationPackages,
    decisionSummary,
  });
  const delivery = buildRuntimeBridgeInsightDeliveryTimeline({
    subjectId: summary.subjectId,
    executiveBriefing,
    operationalBriefing,
    insightPackages,
    recommendationPackages,
    narrativeId: narrative.narrativeId,
  });

  return {
    packageId: createRuntimeBridgeId("runtime-bridge-decision-support-package", summary.subjectId),
    subjectId: summary.subjectId,
    executiveBriefing,
    operationalBriefing,
    insightPackages,
    recommendationPackages,
    decisionSummary,
    delivery,
    narrative,
    sourceInsightSummaryId: summary.insightSummaryId,
    metadataOnly: true,
  };
};
