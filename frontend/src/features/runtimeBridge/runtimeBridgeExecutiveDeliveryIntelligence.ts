import type { MetadataOnlyBoundaryContract } from "../governance/boundaryTypes";
import type {
  RuntimeBridgeDecisionSupportPackage,
  RuntimeBridgeInsightPackage,
  RuntimeBridgeRecommendationPackage,
} from "./runtimeBridgeDecisionSupport";
import type {
  RuntimeBridgeOperationalEscalation,
  RuntimeBridgeRecommendationPriority,
} from "./runtimeBridgeExecutiveRecommendations";
import { createRuntimeBridgeId } from "./runtimeBridgeIds";
import type { RuntimeBridgeInterpretationTheme } from "./runtimeBridgeInsightInterpretation";
import type { RuntimeBridgeSourceModuleReference } from "./runtimeBridgeTypes";

export type RuntimeBridgeDeliveryPriority = RuntimeBridgeRecommendationPriority;

export type RuntimeBridgeExecutiveAudience =
  | "board"
  | "executive"
  | "operations"
  | "governance"
  | "analyst"
  | "mixed";

export type RuntimeBridgeDeliveryChannel =
  | "executive_brief"
  | "operational_brief"
  | "governance_review"
  | "insight_digest"
  | "presentation_sequence";

export type RuntimeBridgeAudienceProfile = {
  readonly audienceId: string;
  readonly subjectId: string;
  readonly audience: RuntimeBridgeExecutiveAudience;
  readonly priority: RuntimeBridgeDeliveryPriority;
  readonly emphasisThemes: ReadonlyArray<RuntimeBridgeInterpretationTheme>;
  readonly posture: "summary_first" | "risk_first" | "evidence_first" | "operations_first";
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeVisualizationIntent = {
  readonly intentId: string;
  readonly subjectId: string;
  readonly theme: RuntimeBridgeInterpretationTheme;
  readonly recommendedChartType:
    | "scorecard"
    | "bar_comparison"
    | "relationship_map"
    | "timeline"
    | "table_summary"
    | "callout";
  readonly relationshipDensity: "none" | "low" | "medium" | "high";
  readonly executiveEmphasis: "context" | "risk" | "impact" | "urgency" | "confidence";
  readonly kpiGrouping: "none" | "single_metric" | "theme_group" | "portfolio";
  readonly narrativeVisualizationPosture: "supporting" | "primary" | "detail";
  readonly insightHighlightImportance: RuntimeBridgeDeliveryPriority;
  readonly diagramRelationshipIntent: "none" | "lineage" | "cluster" | "dependency";
  readonly sourcePackageIds: ReadonlyArray<string>;
  readonly metadataOnly: true;
};

export type RuntimeBridgePresentationIntent = {
  readonly intentId: string;
  readonly subjectId: string;
  readonly audience: RuntimeBridgeAudienceProfile;
  readonly deliveryPriority: RuntimeBridgeDeliveryPriority;
  readonly channels: ReadonlyArray<RuntimeBridgeDeliveryChannel>;
  readonly visualizationIntentIds: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeEscalationBriefing = {
  readonly briefingId: string;
  readonly subjectId: string;
  readonly escalation: RuntimeBridgeOperationalEscalation;
  readonly priority: RuntimeBridgeDeliveryPriority;
  readonly posture: "informational" | "watch" | "review" | "urgent_review";
  readonly audience: RuntimeBridgeExecutiveAudience;
  readonly channelIds: ReadonlyArray<RuntimeBridgeDeliveryChannel>;
  readonly evidenceReferenceIds: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeInsightDigest = {
  readonly digestId: string;
  readonly subjectId: string;
  readonly audience: RuntimeBridgeExecutiveAudience;
  readonly priority: RuntimeBridgeDeliveryPriority;
  readonly insightPackageIds: ReadonlyArray<string>;
  readonly recommendationPackageIds: ReadonlyArray<string>;
  readonly themeIds: ReadonlyArray<RuntimeBridgeInterpretationTheme>;
  readonly visualizationIntentIds: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgePresentationSequence = {
  readonly sequenceId: string;
  readonly subjectId: string;
  readonly orderedBriefingIds: ReadonlyArray<string>;
  readonly orderedDigestIds: ReadonlyArray<string>;
  readonly orderedVisualizationIntentIds: ReadonlyArray<string>;
  readonly orderedChannelIds: ReadonlyArray<RuntimeBridgeDeliveryChannel>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeExecutiveDeliveryPlan = {
  readonly planId: string;
  readonly subjectId: string;
  readonly audience: RuntimeBridgeAudienceProfile;
  readonly presentationIntent: RuntimeBridgePresentationIntent;
  readonly visualizationIntents: ReadonlyArray<RuntimeBridgeVisualizationIntent>;
  readonly escalationBriefing: RuntimeBridgeEscalationBriefing;
  readonly insightDigest: RuntimeBridgeInsightDigest;
  readonly presentationSequence: RuntimeBridgePresentationSequence;
  readonly deliveryPriorities: ReadonlyArray<RuntimeBridgeDeliveryPriority>;
  readonly deliveryChannels: ReadonlyArray<RuntimeBridgeDeliveryChannel>;
  readonly sourceDecisionSupportPackageId: string;
  readonly metadataOnly: true;
};

export const runtimeBridgeExecutiveDeliveryIntelligenceGovernance = {
  mode: "metadata_only",
  contractId: "runtime-bridge-executive-delivery-intelligence",
  label: "Runtime bridge executive delivery intelligence",
  description:
    "Metadata-only audience-aware executive delivery sequencing, visualization intent metadata, presentation summaries, escalation briefing posture, insight digests, and deterministic delivery planning metadata.",
  confidence: "high",
  canExecute: false,
  canMutateWorkspace: false,
  canCallBackend: false,
  lineageRefs: [
    "runtime-bridge-executive-delivery-plan",
    "runtime-bridge-audience-profile",
    "runtime-bridge-presentation-intent",
    "runtime-bridge-visualization-intent",
    "runtime-bridge-escalation-briefing",
    "runtime-bridge-insight-digest",
    "runtime-bridge-presentation-sequence",
  ],
} satisfies MetadataOnlyBoundaryContract;

export const runtimeBridgeExecutiveDeliveryIntelligenceSourceModule: RuntimeBridgeSourceModuleReference = {
  moduleId: "runtime-bridge-executive-delivery-intelligence",
  modulePath: "frontend/src/features/runtimeBridge/runtimeBridgeExecutiveDeliveryIntelligence.ts",
  capabilityMode: "metadata_only",
  label: "Runtime bridge executive delivery intelligence",
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

const priorityScore = (priority: RuntimeBridgeDeliveryPriority) => {
  if (priority === "critical") return 4;
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  return 1;
};

const sortPriorityValues = (
  priorities: ReadonlyArray<RuntimeBridgeDeliveryPriority>,
): RuntimeBridgeDeliveryPriority[] =>
  uniqueStable(priorities).sort((left, right) => {
    const priorityDelta = priorityScore(right) - priorityScore(left);
    if (priorityDelta !== 0) return priorityDelta;
    return left.localeCompare(right);
  });

const sortPackagesByPriorityThenId = <
  T extends {
    readonly priority: RuntimeBridgeDeliveryPriority;
  },
>(
  packages: ReadonlyArray<T>,
  getId: (item: T) => string,
): T[] =>
  [...packages].sort((left, right) => {
    const priorityDelta = priorityScore(right.priority) - priorityScore(left.priority);
    if (priorityDelta !== 0) return priorityDelta;
    return getId(left).localeCompare(getId(right));
  });

const strongestPriority = (
  priorities: ReadonlyArray<RuntimeBridgeDeliveryPriority>,
): RuntimeBridgeDeliveryPriority => sortPriorityValues(priorities)[0] || "low";

const relationshipDensity = (packageIds: ReadonlyArray<string>) => {
  if (packageIds.length >= 6) return "high" as const;
  if (packageIds.length >= 3) return "medium" as const;
  if (packageIds.length > 0) return "low" as const;
  return "none" as const;
};

const chartIntentForTheme = (
  theme: RuntimeBridgeInterpretationTheme,
  relationshipCount: number,
): RuntimeBridgeVisualizationIntent["recommendedChartType"] => {
  if (theme === "relationship" || theme === "lineage") return "relationship_map";
  if (theme === "confidence" || theme === "evidence") return "bar_comparison";
  if (theme === "governance" || theme === "risk") return "scorecard";
  if (relationshipCount >= 4) return "table_summary";
  return "callout";
};

const emphasisForTheme = (
  theme: RuntimeBridgeInterpretationTheme,
): RuntimeBridgeVisualizationIntent["executiveEmphasis"] => {
  if (theme === "risk" || theme === "governance") return "risk";
  if (theme === "confidence") return "confidence";
  if (theme === "opportunity" || theme === "financial") return "impact";
  if (theme === "operational") return "urgency";
  return "context";
};

const diagramIntentForTheme = (
  theme: RuntimeBridgeInterpretationTheme,
): RuntimeBridgeVisualizationIntent["diagramRelationshipIntent"] => {
  if (theme === "lineage") return "lineage";
  if (theme === "relationship") return "dependency";
  if (theme === "governance" || theme === "risk") return "cluster";
  return "none";
};

const collectPackageThemes = (
  decisionPackage: RuntimeBridgeDecisionSupportPackage,
): ReadonlyArray<RuntimeBridgeInterpretationTheme> =>
  uniqueStable([
    ...decisionPackage.narrative.themeIds,
    ...decisionPackage.insightPackages.map((insightPackage) => insightPackage.theme),
    ...decisionPackage.recommendationPackages.map((recommendationPackage) => recommendationPackage.theme),
  ]);

export const summarizeRuntimeBridgeDeliveryPriorities = (
  decisionPackage: RuntimeBridgeDecisionSupportPackage,
): ReadonlyArray<RuntimeBridgeDeliveryPriority> =>
  sortPriorityValues([
    decisionPackage.decisionSummary.priority,
    decisionPackage.executiveBriefing.urgency.urgency,
    decisionPackage.operationalBriefing.escalation.priority,
    ...decisionPackage.insightPackages.map((insightPackage) => insightPackage.priority),
    ...decisionPackage.recommendationPackages.map((recommendationPackage) => recommendationPackage.priority),
  ]);

export const collectRuntimeBridgeDeliveryChannels = (
  decisionPackage: RuntimeBridgeDecisionSupportPackage,
): ReadonlyArray<RuntimeBridgeDeliveryChannel> => {
  const channels: RuntimeBridgeDeliveryChannel[] = [
    "executive_brief",
    "operational_brief",
    "presentation_sequence",
  ];

  if (decisionPackage.operationalBriefing.escalation.posture !== "none") {
    channels.push("governance_review");
  }

  if (decisionPackage.insightPackages.length > 0) {
    channels.push("insight_digest");
  }

  return uniqueStable(channels);
};

export const classifyRuntimeBridgeAudience = (
  decisionPackage: RuntimeBridgeDecisionSupportPackage,
): RuntimeBridgeAudienceProfile => {
  const themes = collectPackageThemes(decisionPackage);
  const priority = strongestPriority(summarizeRuntimeBridgeDeliveryPriorities(decisionPackage));
  const hasGovernanceTheme = themes.includes("governance") || themes.includes("risk");
  const hasOperationalTheme = themes.includes("operational") || themes.includes("quality");
  const audience: RuntimeBridgeExecutiveAudience =
    priority === "critical"
      ? "executive"
      : hasGovernanceTheme
        ? "governance"
        : hasOperationalTheme
          ? "operations"
          : themes.length >= 3
            ? "mixed"
            : "board";
  const posture: RuntimeBridgeAudienceProfile["posture"] =
    priority === "critical" || hasGovernanceTheme
      ? "risk_first"
      : hasOperationalTheme
        ? "operations_first"
        : decisionPackage.decisionSummary.evidenceReferenceCount >= 8
          ? "evidence_first"
          : "summary_first";

  return {
    audienceId: createRuntimeBridgeId("runtime-bridge-audience-profile", decisionPackage.subjectId, audience),
    subjectId: decisionPackage.subjectId,
    audience,
    priority,
    emphasisThemes: themes,
    posture,
    summary: `Audience posture is ${posture} for ${audience} delivery with ${priority} priority across ${themes.length} themes.`,
    metadataOnly: true,
  };
};

export const collectRuntimeBridgeVisualizationIntents = (
  decisionPackage: RuntimeBridgeDecisionSupportPackage,
): ReadonlyArray<RuntimeBridgeVisualizationIntent> => {
  const themes = collectPackageThemes(decisionPackage);
  const insightPackagesByTheme = new Map<RuntimeBridgeInterpretationTheme, RuntimeBridgeInsightPackage[]>();
  const recommendationPackagesByTheme = new Map<
    RuntimeBridgeInterpretationTheme,
    RuntimeBridgeRecommendationPackage[]
  >();

  for (const insightPackage of decisionPackage.insightPackages) {
    insightPackagesByTheme.set(insightPackage.theme, [
      ...(insightPackagesByTheme.get(insightPackage.theme) || []),
      insightPackage,
    ]);
  }

  for (const recommendationPackage of decisionPackage.recommendationPackages) {
    recommendationPackagesByTheme.set(recommendationPackage.theme, [
      ...(recommendationPackagesByTheme.get(recommendationPackage.theme) || []),
      recommendationPackage,
    ]);
  }

  return themes.map((theme) => {
    const insightPackages = insightPackagesByTheme.get(theme) || [];
    const recommendationPackages = recommendationPackagesByTheme.get(theme) || [];
    const sourcePackageIds = uniqueStable([
      ...insightPackages.map((insightPackage) => insightPackage.packageId),
      ...recommendationPackages.map((recommendationPackage) => recommendationPackage.packageId),
    ]);
    const priority = strongestPriority([
      ...insightPackages.map((insightPackage) => insightPackage.priority),
      ...recommendationPackages.map((recommendationPackage) => recommendationPackage.priority),
    ]);

    return {
      intentId: createRuntimeBridgeId("runtime-bridge-visualization-intent", decisionPackage.subjectId, theme),
      subjectId: decisionPackage.subjectId,
      theme,
      recommendedChartType: chartIntentForTheme(theme, sourcePackageIds.length),
      relationshipDensity: relationshipDensity(sourcePackageIds),
      executiveEmphasis: emphasisForTheme(theme),
      kpiGrouping:
        sourcePackageIds.length >= 4 ? "portfolio" : sourcePackageIds.length > 1 ? "theme_group" : "single_metric",
      narrativeVisualizationPosture: priorityScore(priority) >= 3 ? "primary" : "supporting",
      insightHighlightImportance: priority,
      diagramRelationshipIntent: diagramIntentForTheme(theme),
      sourcePackageIds,
      metadataOnly: true as const,
    };
  });
};

export const summarizeRuntimeBridgePresentationIntent = ({
  decisionPackage,
  audience = classifyRuntimeBridgeAudience(decisionPackage),
  visualizationIntents = collectRuntimeBridgeVisualizationIntents(decisionPackage),
}: {
  readonly decisionPackage: RuntimeBridgeDecisionSupportPackage;
  readonly audience?: RuntimeBridgeAudienceProfile;
  readonly visualizationIntents?: ReadonlyArray<RuntimeBridgeVisualizationIntent>;
}): RuntimeBridgePresentationIntent => {
  const channels = collectRuntimeBridgeDeliveryChannels(decisionPackage);

  return {
    intentId: createRuntimeBridgeId("runtime-bridge-presentation-intent", decisionPackage.subjectId),
    subjectId: decisionPackage.subjectId,
    audience,
    deliveryPriority: audience.priority,
    channels,
    visualizationIntentIds: visualizationIntents.map((intent) => intent.intentId),
    summary: `Presentation intent describes ${audience.audience} delivery across ${channels.length} channels and ${visualizationIntents.length} visualization intents.`,
    metadataOnly: true,
  };
};

export const classifyRuntimeBridgeEscalationBriefing = ({
  decisionPackage,
  audience = classifyRuntimeBridgeAudience(decisionPackage),
}: {
  readonly decisionPackage: RuntimeBridgeDecisionSupportPackage;
  readonly audience?: RuntimeBridgeAudienceProfile;
}): RuntimeBridgeEscalationBriefing => {
  const escalation = decisionPackage.operationalBriefing.escalation;
  const posture: RuntimeBridgeEscalationBriefing["posture"] =
    escalation.posture === "urgent_review"
      ? "urgent_review"
      : escalation.posture === "review"
        ? "review"
        : escalation.posture === "watch"
          ? "watch"
          : "informational";

  return {
    briefingId: createRuntimeBridgeId("runtime-bridge-escalation-briefing", decisionPackage.subjectId),
    subjectId: decisionPackage.subjectId,
    escalation,
    priority: escalation.priority,
    posture,
    audience: audience.audience,
    channelIds: collectRuntimeBridgeDeliveryChannels(decisionPackage),
    evidenceReferenceIds: decisionPackage.operationalBriefing.evidenceReferenceIds,
    summary: `Escalation briefing posture is ${posture} for ${audience.audience} audience with ${escalation.priority} priority.`,
    metadataOnly: true,
  };
};

export const buildRuntimeBridgeInsightDigest = ({
  decisionPackage,
  audience = classifyRuntimeBridgeAudience(decisionPackage),
  visualizationIntents = collectRuntimeBridgeVisualizationIntents(decisionPackage),
}: {
  readonly decisionPackage: RuntimeBridgeDecisionSupportPackage;
  readonly audience?: RuntimeBridgeAudienceProfile;
  readonly visualizationIntents?: ReadonlyArray<RuntimeBridgeVisualizationIntent>;
}): RuntimeBridgeInsightDigest => {
  const insightPackages = sortPackagesByPriorityThenId(
    decisionPackage.insightPackages,
    (insightPackage) => insightPackage.packageId,
  );
  const recommendationPackages = sortPackagesByPriorityThenId(
    decisionPackage.recommendationPackages,
    (recommendationPackage) => recommendationPackage.packageId,
  );

  return {
    digestId: createRuntimeBridgeId("runtime-bridge-insight-digest", decisionPackage.subjectId),
    subjectId: decisionPackage.subjectId,
    audience: audience.audience,
    priority: audience.priority,
    insightPackageIds: insightPackages.map((insightPackage) => insightPackage.packageId),
    recommendationPackageIds: recommendationPackages.map(
      (recommendationPackage) => recommendationPackage.packageId,
    ),
    themeIds: collectPackageThemes(decisionPackage),
    visualizationIntentIds: visualizationIntents.map((intent) => intent.intentId),
    summary: `Insight digest packages ${insightPackages.length} insight groups and ${recommendationPackages.length} recommendation groups for ${audience.audience} delivery.`,
    metadataOnly: true,
  };
};

export const buildRuntimeBridgePresentationSequence = ({
  decisionPackage,
  insightDigest,
  escalationBriefing,
  visualizationIntents,
}: {
  readonly decisionPackage: RuntimeBridgeDecisionSupportPackage;
  readonly insightDigest: RuntimeBridgeInsightDigest;
  readonly escalationBriefing: RuntimeBridgeEscalationBriefing;
  readonly visualizationIntents: ReadonlyArray<RuntimeBridgeVisualizationIntent>;
}): RuntimeBridgePresentationSequence => {
  const channels = collectRuntimeBridgeDeliveryChannels(decisionPackage);

  return {
    sequenceId: createRuntimeBridgeId("runtime-bridge-presentation-sequence", decisionPackage.subjectId),
    subjectId: decisionPackage.subjectId,
    orderedBriefingIds: [
      decisionPackage.executiveBriefing.briefingId,
      escalationBriefing.briefingId,
      decisionPackage.operationalBriefing.briefingId,
    ],
    orderedDigestIds: [insightDigest.digestId],
    orderedVisualizationIntentIds: visualizationIntents.map((intent) => intent.intentId),
    orderedChannelIds: channels,
    summary: `Presentation sequence orders ${channels.length} delivery channels, ${visualizationIntents.length} visualization intents, and one insight digest.`,
    metadataOnly: true,
  };
};

export const summarizeRuntimeBridgeExecutiveAudiencePosture = (
  audience: RuntimeBridgeAudienceProfile,
): string =>
  `${audience.audience} audience posture is ${audience.posture} with ${audience.priority} delivery priority across ${audience.emphasisThemes.length} emphasis themes.`;

export const buildRuntimeBridgeExecutiveDeliveryPlan = (
  decisionPackage: RuntimeBridgeDecisionSupportPackage,
): RuntimeBridgeExecutiveDeliveryPlan => {
  const audience = classifyRuntimeBridgeAudience(decisionPackage);
  const visualizationIntents = collectRuntimeBridgeVisualizationIntents(decisionPackage);
  const presentationIntent = summarizeRuntimeBridgePresentationIntent({
    decisionPackage,
    audience,
    visualizationIntents,
  });
  const escalationBriefing = classifyRuntimeBridgeEscalationBriefing({
    decisionPackage,
    audience,
  });
  const insightDigest = buildRuntimeBridgeInsightDigest({
    decisionPackage,
    audience,
    visualizationIntents,
  });
  const presentationSequence = buildRuntimeBridgePresentationSequence({
    decisionPackage,
    insightDigest,
    escalationBriefing,
    visualizationIntents,
  });
  const deliveryPriorities = summarizeRuntimeBridgeDeliveryPriorities(decisionPackage);
  const deliveryChannels = collectRuntimeBridgeDeliveryChannels(decisionPackage);

  return {
    planId: createRuntimeBridgeId("runtime-bridge-executive-delivery-plan", decisionPackage.subjectId),
    subjectId: decisionPackage.subjectId,
    audience,
    presentationIntent,
    visualizationIntents,
    escalationBriefing,
    insightDigest,
    presentationSequence,
    deliveryPriorities,
    deliveryChannels,
    sourceDecisionSupportPackageId: decisionPackage.packageId,
    metadataOnly: true,
  };
};
