import type { MetadataOnlyBoundaryContract } from "../governance/boundaryTypes";
import type {
  RuntimeBridgeBoardroomStorytellingPosture,
  RuntimeBridgeDashboardNarrativePlan,
  RuntimeBridgeDashboardNarrativePriority,
  RuntimeBridgeDashboardNarrativeTheme,
  RuntimeBridgeNarrativeEmphasis,
} from "./runtimeBridgeDashboardNarrativeIntelligence";
import { createRuntimeBridgeId } from "./runtimeBridgeIds";
import type { RuntimeBridgeSourceModuleReference } from "./runtimeBridgeTypes";

export type RuntimeBridgeVisualizationStoryPriority = RuntimeBridgeDashboardNarrativePriority;

export type RuntimeBridgeVisualizationStoryTheme =
  | RuntimeBridgeDashboardNarrativeTheme
  | "executive_digest"
  | "visual_escalation"
  | "strategic_kpi_story"
  | "insight_continuity";

export type RuntimeBridgeExecutiveVisualizationStory = {
  readonly storyId: string;
  readonly subjectId: string;
  readonly priority: RuntimeBridgeVisualizationStoryPriority;
  readonly headline: string;
  readonly storylineIds: ReadonlyArray<string>;
  readonly bundleIds: ReadonlyArray<string>;
  readonly themeIds: ReadonlyArray<RuntimeBridgeVisualizationStoryTheme>;
  readonly continuityIds: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeBoardroomVisualizationNarrative = {
  readonly narrativeId: string;
  readonly subjectId: string;
  readonly priority: RuntimeBridgeVisualizationStoryPriority;
  readonly posture: RuntimeBridgeBoardroomStorytellingPosture["posture"];
  readonly boardroomThemeIds: ReadonlyArray<RuntimeBridgeVisualizationStoryTheme>;
  readonly sourcePostureId: string;
  readonly storylineIds: ReadonlyArray<string>;
  readonly emphasisIds: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeMultiDashboardSequence = {
  readonly sequenceId: string;
  readonly subjectId: string;
  readonly priority: RuntimeBridgeVisualizationStoryPriority;
  readonly orderedStorylineIds: ReadonlyArray<string>;
  readonly orderedBundleIds: ReadonlyArray<string>;
  readonly orderedAudienceSummaryIds: ReadonlyArray<string>;
  readonly sourceVisualNarrativeSequenceId: string;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeVisualEscalationStory = {
  readonly escalationStoryId: string;
  readonly subjectId: string;
  readonly priority: RuntimeBridgeVisualizationStoryPriority;
  readonly posture: "none" | "watch" | "review" | "urgent_review";
  readonly emphasisIds: ReadonlyArray<string>;
  readonly storylineIds: ReadonlyArray<string>;
  readonly relationshipIds: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeStrategicKPIStoryline = {
  readonly kpiStorylineId: string;
  readonly subjectId: string;
  readonly priority: RuntimeBridgeVisualizationStoryPriority;
  readonly kpiRelationshipIds: ReadonlyArray<string>;
  readonly themeIds: ReadonlyArray<RuntimeBridgeVisualizationStoryTheme>;
  readonly sourceChartRecommendationIds: ReadonlyArray<string>;
  readonly sourceDiagramRelationshipIds: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeExecutiveDigestVisualization = {
  readonly digestId: string;
  readonly subjectId: string;
  readonly priority: RuntimeBridgeVisualizationStoryPriority;
  readonly audienceSummaryIds: ReadonlyArray<string>;
  readonly emphasisIds: ReadonlyArray<string>;
  readonly themeIds: ReadonlyArray<RuntimeBridgeVisualizationStoryTheme>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeInsightStoryContinuity = {
  readonly continuityId: string;
  readonly subjectId: string;
  readonly priority: RuntimeBridgeVisualizationStoryPriority;
  readonly fromRefId: string;
  readonly toRefId: string;
  readonly continuityKind:
    | "dashboard_to_boardroom"
    | "kpi_to_story"
    | "emphasis_to_digest"
    | "storyline_to_sequence";
  readonly themeIds: ReadonlyArray<RuntimeBridgeVisualizationStoryTheme>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeVisualizationStoryBundle = {
  readonly bundleId: string;
  readonly subjectId: string;
  readonly theme: RuntimeBridgeVisualizationStoryTheme;
  readonly priority: RuntimeBridgeVisualizationStoryPriority;
  readonly storylineIds: ReadonlyArray<string>;
  readonly kpiStorylineIds: ReadonlyArray<string>;
  readonly continuityIds: ReadonlyArray<string>;
  readonly emphasisIds: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export const runtimeBridgeExecutiveVisualizationStorytellingGovernance = {
  mode: "metadata_only",
  contractId: "runtime-bridge-executive-visualization-storytelling",
  label: "Runtime bridge executive visualization storytelling",
  description:
    "Metadata-only executive visualization story bundles, boardroom visualization narratives, multi-dashboard executive sequencing, visual escalation storytelling, strategic KPI storyline packaging, executive digest visualization posture, and insight-to-story continuity metadata.",
  confidence: "high",
  canExecute: false,
  canMutateWorkspace: false,
  canCallBackend: false,
  lineageRefs: [
    "runtime-bridge-executive-visualization-story",
    "runtime-bridge-boardroom-visualization-narrative",
    "runtime-bridge-multi-dashboard-sequence",
    "runtime-bridge-visual-escalation-story",
    "runtime-bridge-strategic-kpi-storyline",
    "runtime-bridge-executive-digest-visualization",
    "runtime-bridge-insight-story-continuity",
    "runtime-bridge-visualization-story-bundle",
  ],
} satisfies MetadataOnlyBoundaryContract;

export const runtimeBridgeExecutiveVisualizationStorytellingSourceModule: RuntimeBridgeSourceModuleReference = {
  moduleId: "runtime-bridge-executive-visualization-storytelling",
  modulePath: "frontend/src/features/runtimeBridge/runtimeBridgeExecutiveVisualizationStorytelling.ts",
  capabilityMode: "metadata_only",
  label: "Runtime bridge executive visualization storytelling",
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

const priorityScore = (priority: RuntimeBridgeVisualizationStoryPriority) => {
  if (priority === "critical") return 4;
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  return 1;
};

const sortPriorities = (
  priorities: ReadonlyArray<RuntimeBridgeVisualizationStoryPriority>,
): RuntimeBridgeVisualizationStoryPriority[] =>
  uniqueStable(priorities).sort((left, right) => {
    const priorityDelta = priorityScore(right) - priorityScore(left);
    if (priorityDelta !== 0) return priorityDelta;
    return left.localeCompare(right);
  });

const strongestPriority = (
  priorities: ReadonlyArray<RuntimeBridgeVisualizationStoryPriority>,
): RuntimeBridgeVisualizationStoryPriority => sortPriorities(priorities)[0] || "low";

const sortByPriorityThenId = <T extends { readonly priority: RuntimeBridgeVisualizationStoryPriority }>(
  items: ReadonlyArray<T>,
  getId: (item: T) => string,
): T[] =>
  [...items].sort((left, right) => {
    const priorityDelta = priorityScore(right.priority) - priorityScore(left.priority);
    if (priorityDelta !== 0) return priorityDelta;
    return getId(left).localeCompare(getId(right));
  });

const storyTheme = (
  theme: RuntimeBridgeDashboardNarrativeTheme,
): RuntimeBridgeVisualizationStoryTheme => theme;

const escalationPosture = (
  posture: RuntimeBridgeBoardroomStorytellingPosture["posture"],
): RuntimeBridgeVisualEscalationStory["posture"] => {
  if (posture === "risk_led") return "urgent_review";
  if (posture === "strategic_visual_review") return "review";
  if (posture === "evidence_led") return "watch";
  return "none";
};

const emphasisThemes = (
  emphasis: ReadonlyArray<RuntimeBridgeNarrativeEmphasis>,
): ReadonlyArray<RuntimeBridgeVisualizationStoryTheme> =>
  uniqueStable(emphasis.map((item) => storyTheme(item.theme)));

export const collectRuntimeBridgeVisualizationStoryThemes = (
  plan: RuntimeBridgeDashboardNarrativePlan,
): ReadonlyArray<RuntimeBridgeVisualizationStoryTheme> =>
  uniqueStable([
    ...plan.dashboardNarrativeThemes.map(storyTheme),
    "executive_digest",
    "visual_escalation",
    "strategic_kpi_story",
    "insight_continuity",
  ]);

export const summarizeRuntimeBridgeVisualizationStoryPriorities = (
  plan: RuntimeBridgeDashboardNarrativePlan,
): ReadonlyArray<RuntimeBridgeVisualizationStoryPriority> =>
  sortPriorities([
    ...plan.dashboardNarrativePriorities,
    plan.visualNarrativeSequence.priority,
    plan.crossDashboardAlignment.priority,
    plan.boardroomStorytellingPosture.priority,
    ...plan.dashboardStorylines.map((storyline) => storyline.priority),
    ...plan.kpiVisualRelationships.map((relationship) => relationship.priority),
    ...plan.audienceDashboardSummaries.map((summary) => summary.priority),
    ...plan.narrativeEmphasis.map((emphasis) => emphasis.priority),
  ]);

export const buildRuntimeBridgeBoardroomVisualizationNarrative = (
  plan: RuntimeBridgeDashboardNarrativePlan,
): RuntimeBridgeBoardroomVisualizationNarrative => {
  const posture = plan.boardroomStorytellingPosture;
  const relatedStorylines = plan.dashboardStorylines.filter((storyline) =>
    posture.storylineIds.includes(storyline.storylineId),
  );
  const relatedEmphasis = plan.narrativeEmphasis.filter((emphasis) =>
    posture.emphasisIds.includes(emphasis.emphasisId),
  );

  return {
    narrativeId: createRuntimeBridgeId("runtime-bridge-boardroom-visualization-narrative", plan.subjectId),
    subjectId: plan.subjectId,
    priority: posture.priority,
    posture: posture.posture,
    boardroomThemeIds: uniqueStable([
      "boardroom_story",
      ...relatedStorylines.flatMap((storyline) => storyline.themeIds.map(storyTheme)),
      ...emphasisThemes(relatedEmphasis),
    ]),
    sourcePostureId: posture.postureId,
    storylineIds: posture.storylineIds,
    emphasisIds: posture.emphasisIds,
    summary: `Boardroom visualization narrative describes ${posture.posture} posture with ${posture.priority} priority.`,
    metadataOnly: true,
  };
};

export const buildRuntimeBridgeStrategicKPIStoryline = (
  plan: RuntimeBridgeDashboardNarrativePlan,
): RuntimeBridgeStrategicKPIStoryline => {
  const relationships = sortByPriorityThenId(
    plan.kpiVisualRelationships,
    (relationship) => relationship.relationshipId,
  );
  const priority = strongestPriority(relationships.map((relationship) => relationship.priority));

  return {
    kpiStorylineId: createRuntimeBridgeId("runtime-bridge-strategic-kpi-storyline", plan.subjectId),
    subjectId: plan.subjectId,
    priority,
    kpiRelationshipIds: relationships.map((relationship) => relationship.relationshipId),
    themeIds: uniqueStable([
      "strategic_kpi_story" as const,
      ...relationships.map((relationship) => storyTheme(relationship.theme)),
    ]),
    sourceChartRecommendationIds: uniqueStable(
      relationships.flatMap((relationship) => relationship.chartRecommendationIds),
    ),
    sourceDiagramRelationshipIds: uniqueStable(
      relationships.flatMap((relationship) => relationship.diagramRelationshipIds),
    ),
    summary: `Strategic KPI storyline packages ${relationships.length} KPI visual relationships with ${priority} priority.`,
    metadataOnly: true,
  };
};

export const buildRuntimeBridgeVisualEscalationStory = (
  plan: RuntimeBridgeDashboardNarrativePlan,
): RuntimeBridgeVisualEscalationStory => {
  const posture = escalationPosture(plan.boardroomStorytellingPosture.posture);
  const riskEmphasis = plan.narrativeEmphasis.filter(
    (emphasis) => emphasis.emphasis === "risk" || emphasis.priority === "critical" || emphasis.priority === "high",
  );
  const relationships = plan.kpiVisualRelationships.filter(
    (relationship) => relationship.priority === "critical" || relationship.priority === "high",
  );
  const priority = strongestPriority([
    plan.boardroomStorytellingPosture.priority,
    ...riskEmphasis.map((emphasis) => emphasis.priority),
    ...relationships.map((relationship) => relationship.priority),
  ]);

  return {
    escalationStoryId: createRuntimeBridgeId("runtime-bridge-visual-escalation-story", plan.subjectId),
    subjectId: plan.subjectId,
    priority,
    posture,
    emphasisIds: riskEmphasis.map((emphasis) => emphasis.emphasisId),
    storylineIds: plan.boardroomStorytellingPosture.storylineIds,
    relationshipIds: relationships.map((relationship) => relationship.relationshipId),
    summary: `Visual escalation story describes ${posture} posture with ${priority} priority across ${riskEmphasis.length} emphasis descriptors.`,
    metadataOnly: true,
  };
};

export const buildRuntimeBridgeExecutiveDigestVisualization = (
  plan: RuntimeBridgeDashboardNarrativePlan,
): RuntimeBridgeExecutiveDigestVisualization => {
  const summaries = sortByPriorityThenId(
    plan.audienceDashboardSummaries,
    (summary) => summary.summaryId,
  );
  const priority = strongestPriority([
    ...summaries.map((summary) => summary.priority),
    ...plan.narrativeEmphasis.map((emphasis) => emphasis.priority),
  ]);

  return {
    digestId: createRuntimeBridgeId("runtime-bridge-executive-digest-visualization", plan.subjectId),
    subjectId: plan.subjectId,
    priority,
    audienceSummaryIds: summaries.map((summary) => summary.summaryId),
    emphasisIds: plan.narrativeEmphasis.map((emphasis) => emphasis.emphasisId),
    themeIds: uniqueStable([
      "executive_digest" as const,
      ...summaries.flatMap((summary) => summary.themeIds.map(storyTheme)),
      ...emphasisThemes(plan.narrativeEmphasis),
    ]),
    summary: `Executive digest visualization packages ${summaries.length} audience dashboard summaries and ${plan.narrativeEmphasis.length} emphasis descriptors.`,
    metadataOnly: true,
  };
};

export const summarizeRuntimeBridgeInsightStoryContinuity = (
  plan: RuntimeBridgeDashboardNarrativePlan,
): ReadonlyArray<RuntimeBridgeInsightStoryContinuity> => {
  const storylineContinuity = plan.dashboardStorylines.map((storyline) => ({
    continuityId: createRuntimeBridgeId(
      "runtime-bridge-insight-story-continuity",
      plan.subjectId,
      storyline.storylineId,
      "sequence",
    ),
    subjectId: plan.subjectId,
    priority: storyline.priority,
    fromRefId: storyline.storylineId,
    toRefId: plan.visualNarrativeSequence.sequenceId,
    continuityKind: "storyline_to_sequence" as const,
    themeIds: storyline.themeIds.map(storyTheme),
    summary: `${storyline.storylineId} continues into visual narrative sequence metadata.`,
    metadataOnly: true as const,
  }));
  const kpiContinuity = plan.kpiVisualRelationships.map((relationship) => ({
    continuityId: createRuntimeBridgeId(
      "runtime-bridge-insight-story-continuity",
      plan.subjectId,
      relationship.relationshipId,
      "kpi",
    ),
    subjectId: plan.subjectId,
    priority: relationship.priority,
    fromRefId: relationship.relationshipId,
    toRefId: plan.visualNarrativeSequence.sequenceId,
    continuityKind: "kpi_to_story" as const,
    themeIds: [storyTheme(relationship.theme), "strategic_kpi_story" as const],
    summary: `${relationship.relationshipId} connects KPI visual relationship metadata to story sequence metadata.`,
    metadataOnly: true as const,
  }));
  const digestContinuity = plan.audienceDashboardSummaries.map((summary) => ({
    continuityId: createRuntimeBridgeId(
      "runtime-bridge-insight-story-continuity",
      plan.subjectId,
      summary.summaryId,
      "digest",
    ),
    subjectId: plan.subjectId,
    priority: summary.priority,
    fromRefId: summary.summaryId,
    toRefId: plan.boardroomStorytellingPosture.postureId,
    continuityKind: "emphasis_to_digest" as const,
    themeIds: uniqueStable(["executive_digest" as const, ...summary.themeIds.map(storyTheme)]),
    summary: `${summary.summaryId} aligns audience dashboard summary metadata with executive digest posture.`,
    metadataOnly: true as const,
  }));
  const boardroomContinuity = [
    {
      continuityId: createRuntimeBridgeId(
        "runtime-bridge-insight-story-continuity",
        plan.subjectId,
        "dashboard",
        "boardroom",
      ),
      subjectId: plan.subjectId,
      priority: plan.boardroomStorytellingPosture.priority,
      fromRefId: plan.crossDashboardAlignment.alignmentId,
      toRefId: plan.boardroomStorytellingPosture.postureId,
      continuityKind: "dashboard_to_boardroom" as const,
      themeIds: uniqueStable([
        "boardroom_story" as const,
        ...plan.crossDashboardAlignment.themeIds.map(storyTheme),
      ]),
      summary: "Cross-dashboard alignment metadata continues into boardroom storytelling posture metadata.",
      metadataOnly: true as const,
    },
  ];

  return sortByPriorityThenId(
    [...storylineContinuity, ...kpiContinuity, ...digestContinuity, ...boardroomContinuity],
    (continuity) => continuity.continuityId,
  );
};

export const buildRuntimeBridgeMultiDashboardSequence = ({
  plan,
  continuity = summarizeRuntimeBridgeInsightStoryContinuity(plan),
  bundles = buildRuntimeBridgeVisualizationStoryBundles({
    plan,
    continuity,
  }),
}: {
  readonly plan: RuntimeBridgeDashboardNarrativePlan;
  readonly continuity?: ReadonlyArray<RuntimeBridgeInsightStoryContinuity>;
  readonly bundles?: ReadonlyArray<RuntimeBridgeVisualizationStoryBundle>;
}): RuntimeBridgeMultiDashboardSequence => {
  const storylines = sortByPriorityThenId(plan.dashboardStorylines, (storyline) => storyline.storylineId);
  const summaries = sortByPriorityThenId(plan.audienceDashboardSummaries, (summary) => summary.summaryId);
  const priority = strongestPriority([
    plan.visualNarrativeSequence.priority,
    ...storylines.map((storyline) => storyline.priority),
    ...summaries.map((summary) => summary.priority),
    ...continuity.map((item) => item.priority),
  ]);

  return {
    sequenceId: createRuntimeBridgeId("runtime-bridge-multi-dashboard-sequence", plan.subjectId),
    subjectId: plan.subjectId,
    priority,
    orderedStorylineIds: storylines.map((storyline) => storyline.storylineId),
    orderedBundleIds: bundles.map((bundle) => bundle.bundleId),
    orderedAudienceSummaryIds: summaries.map((summary) => summary.summaryId),
    sourceVisualNarrativeSequenceId: plan.visualNarrativeSequence.sequenceId,
    summary: `Multi-dashboard sequence orders ${storylines.length} storylines, ${bundles.length} story bundles, and ${summaries.length} audience summaries.`,
    metadataOnly: true,
  };
};

export const buildRuntimeBridgeVisualizationStoryBundles = ({
  plan,
  continuity = summarizeRuntimeBridgeInsightStoryContinuity(plan),
  kpiStoryline = buildRuntimeBridgeStrategicKPIStoryline(plan),
}: {
  readonly plan: RuntimeBridgeDashboardNarrativePlan;
  readonly continuity?: ReadonlyArray<RuntimeBridgeInsightStoryContinuity>;
  readonly kpiStoryline?: RuntimeBridgeStrategicKPIStoryline;
}): ReadonlyArray<RuntimeBridgeVisualizationStoryBundle> =>
  collectRuntimeBridgeVisualizationStoryThemes(plan).map((theme) => {
    const storylines = plan.dashboardStorylines.filter((storyline) =>
      storyline.themeIds.some((storylineTheme) => storyTheme(storylineTheme) === theme),
    );
    const emphasis = plan.narrativeEmphasis.filter((item) => storyTheme(item.theme) === theme);
    const continuityItems = continuity.filter((item) => item.themeIds.includes(theme));
    const priority = strongestPriority([
      ...storylines.map((storyline) => storyline.priority),
      ...emphasis.map((item) => item.priority),
      ...continuityItems.map((item) => item.priority),
      kpiStoryline.themeIds.includes(theme) ? kpiStoryline.priority : "low",
    ]);

    return {
      bundleId: createRuntimeBridgeId("runtime-bridge-visualization-story-bundle", plan.subjectId, theme),
      subjectId: plan.subjectId,
      theme,
      priority,
      storylineIds: storylines.map((storyline) => storyline.storylineId),
      kpiStorylineIds: kpiStoryline.themeIds.includes(theme) ? [kpiStoryline.kpiStorylineId] : [],
      continuityIds: continuityItems.map((item) => item.continuityId),
      emphasisIds: emphasis.map((item) => item.emphasisId),
      summary: `${theme} visualization story bundle connects ${storylines.length} dashboard storylines and ${continuityItems.length} continuity descriptors.`,
      metadataOnly: true as const,
    };
  }).sort((left, right) => {
    const priorityDelta = priorityScore(right.priority) - priorityScore(left.priority);
    if (priorityDelta !== 0) return priorityDelta;
    return left.bundleId.localeCompare(right.bundleId);
  });

export const buildRuntimeBridgeExecutiveVisualizationStory = (
  plan: RuntimeBridgeDashboardNarrativePlan,
): RuntimeBridgeExecutiveVisualizationStory => {
  const continuity = summarizeRuntimeBridgeInsightStoryContinuity(plan);
  const kpiStoryline = buildRuntimeBridgeStrategicKPIStoryline(plan);
  const bundles = buildRuntimeBridgeVisualizationStoryBundles({
    plan,
    continuity,
    kpiStoryline,
  });
  const priority = strongestPriority([
    ...summarizeRuntimeBridgeVisualizationStoryPriorities(plan),
    ...bundles.map((bundle) => bundle.priority),
    ...continuity.map((item) => item.priority),
    kpiStoryline.priority,
  ]);

  return {
    storyId: createRuntimeBridgeId("runtime-bridge-executive-visualization-story", plan.subjectId),
    subjectId: plan.subjectId,
    priority,
    headline: "Executive visualization story metadata is ready for review",
    storylineIds: plan.dashboardStorylines.map((storyline) => storyline.storylineId),
    bundleIds: bundles.map((bundle) => bundle.bundleId),
    themeIds: collectRuntimeBridgeVisualizationStoryThemes(plan),
    continuityIds: continuity.map((item) => item.continuityId),
    summary: `Executive visualization story packages ${bundles.length} story bundles, ${plan.dashboardStorylines.length} dashboard storylines, and ${continuity.length} continuity descriptors.`,
    metadataOnly: true,
  };
};
