import type { MetadataOnlyBoundaryContract } from "../governance/boundaryTypes";
import { createRuntimeBridgeId } from "./runtimeBridgeIds";
import type { RuntimeBridgeSourceModuleReference } from "./runtimeBridgeTypes";
import type {
  RuntimeBridgeChartRecommendation,
  RuntimeBridgeDashboardDescriptor,
  RuntimeBridgeDiagramRelationship,
  RuntimeBridgeVisualizationPlan,
  RuntimeBridgeVisualizationPriority,
  RuntimeBridgeVisualizationTheme,
} from "./runtimeBridgeVisualizationPlanning";

export type RuntimeBridgeDashboardNarrativePriority = RuntimeBridgeVisualizationPriority;

export type RuntimeBridgeDashboardNarrativeTheme =
  | RuntimeBridgeVisualizationTheme
  | "boardroom_story"
  | "cross_dashboard_alignment"
  | "audience_summary";

export type RuntimeBridgeNarrativeEmphasis = {
  readonly emphasisId: string;
  readonly subjectId: string;
  readonly theme: RuntimeBridgeDashboardNarrativeTheme;
  readonly priority: RuntimeBridgeDashboardNarrativePriority;
  readonly emphasis: "context" | "risk" | "operations" | "evidence" | "relationship" | "impact";
  readonly sourceDashboardIds: ReadonlyArray<string>;
  readonly sourceChartRecommendationIds: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeKPIVisualRelationship = {
  readonly relationshipId: string;
  readonly subjectId: string;
  readonly kpiGroupId: string;
  readonly theme: RuntimeBridgeDashboardNarrativeTheme;
  readonly priority: RuntimeBridgeDashboardNarrativePriority;
  readonly chartRecommendationIds: ReadonlyArray<string>;
  readonly diagramRelationshipIds: ReadonlyArray<string>;
  readonly relationshipPosture: "single_visual" | "multi_visual" | "relationship_supported" | "diagram_supported";
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeDashboardStoryline = {
  readonly storylineId: string;
  readonly subjectId: string;
  readonly dashboardId: string;
  readonly priority: RuntimeBridgeDashboardNarrativePriority;
  readonly narrativeFlow: RuntimeBridgeDashboardDescriptor["narrativeFlow"];
  readonly themeIds: ReadonlyArray<RuntimeBridgeDashboardNarrativeTheme>;
  readonly emphasisIds: ReadonlyArray<string>;
  readonly kpiVisualRelationshipIds: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeVisualNarrativeSequence = {
  readonly sequenceId: string;
  readonly subjectId: string;
  readonly priority: RuntimeBridgeDashboardNarrativePriority;
  readonly orderedStorylineIds: ReadonlyArray<string>;
  readonly orderedKPIVisualRelationshipIds: ReadonlyArray<string>;
  readonly orderedEmphasisIds: ReadonlyArray<string>;
  readonly sourceVisualizationSequenceId: string;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeCrossDashboardAlignment = {
  readonly alignmentId: string;
  readonly subjectId: string;
  readonly priority: RuntimeBridgeDashboardNarrativePriority;
  readonly posture: "single_dashboard" | "aligned" | "review_alignment";
  readonly dashboardIds: ReadonlyArray<string>;
  readonly themeIds: ReadonlyArray<RuntimeBridgeDashboardNarrativeTheme>;
  readonly relationshipIds: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeBoardroomStorytellingPosture = {
  readonly postureId: string;
  readonly subjectId: string;
  readonly priority: RuntimeBridgeDashboardNarrativePriority;
  readonly posture: "brief" | "risk_led" | "evidence_led" | "strategic_visual_review";
  readonly storylineIds: ReadonlyArray<string>;
  readonly emphasisIds: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeAudienceDashboardSummary = {
  readonly summaryId: string;
  readonly subjectId: string;
  readonly audience: "executive" | "board" | "operations" | "governance" | "mixed";
  readonly priority: RuntimeBridgeDashboardNarrativePriority;
  readonly dashboardIds: ReadonlyArray<string>;
  readonly storylineIds: ReadonlyArray<string>;
  readonly themeIds: ReadonlyArray<RuntimeBridgeDashboardNarrativeTheme>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeDashboardNarrativePlan = {
  readonly planId: string;
  readonly subjectId: string;
  readonly dashboardStorylines: ReadonlyArray<RuntimeBridgeDashboardStoryline>;
  readonly visualNarrativeSequence: RuntimeBridgeVisualNarrativeSequence;
  readonly kpiVisualRelationships: ReadonlyArray<RuntimeBridgeKPIVisualRelationship>;
  readonly crossDashboardAlignment: RuntimeBridgeCrossDashboardAlignment;
  readonly boardroomStorytellingPosture: RuntimeBridgeBoardroomStorytellingPosture;
  readonly audienceDashboardSummaries: ReadonlyArray<RuntimeBridgeAudienceDashboardSummary>;
  readonly narrativeEmphasis: ReadonlyArray<RuntimeBridgeNarrativeEmphasis>;
  readonly dashboardNarrativePriorities: ReadonlyArray<RuntimeBridgeDashboardNarrativePriority>;
  readonly dashboardNarrativeThemes: ReadonlyArray<RuntimeBridgeDashboardNarrativeTheme>;
  readonly sourceVisualizationPlanId: string;
  readonly metadataOnly: true;
};

export const runtimeBridgeDashboardNarrativeIntelligenceGovernance = {
  mode: "metadata_only",
  contractId: "runtime-bridge-dashboard-narrative-intelligence",
  label: "Runtime bridge dashboard narrative intelligence",
  description:
    "Metadata-only dashboard storytelling, visual narrative sequencing, KPI-to-visual relationships, cross-dashboard alignment summaries, boardroom storytelling posture, and audience-specific dashboard summary metadata.",
  confidence: "high",
  canExecute: false,
  canMutateWorkspace: false,
  canCallBackend: false,
  lineageRefs: [
    "runtime-bridge-dashboard-narrative-plan",
    "runtime-bridge-dashboard-storyline",
    "runtime-bridge-visual-narrative-sequence",
    "runtime-bridge-kpi-visual-relationship",
    "runtime-bridge-cross-dashboard-alignment",
    "runtime-bridge-boardroom-storytelling-posture",
    "runtime-bridge-audience-dashboard-summary",
    "runtime-bridge-narrative-emphasis",
  ],
} satisfies MetadataOnlyBoundaryContract;

export const runtimeBridgeDashboardNarrativeIntelligenceSourceModule: RuntimeBridgeSourceModuleReference = {
  moduleId: "runtime-bridge-dashboard-narrative-intelligence",
  modulePath: "frontend/src/features/runtimeBridge/runtimeBridgeDashboardNarrativeIntelligence.ts",
  capabilityMode: "metadata_only",
  label: "Runtime bridge dashboard narrative intelligence",
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

const priorityScore = (priority: RuntimeBridgeDashboardNarrativePriority) => {
  if (priority === "critical") return 4;
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  return 1;
};

const sortPriorities = (
  priorities: ReadonlyArray<RuntimeBridgeDashboardNarrativePriority>,
): RuntimeBridgeDashboardNarrativePriority[] =>
  uniqueStable(priorities).sort((left, right) => {
    const priorityDelta = priorityScore(right) - priorityScore(left);
    if (priorityDelta !== 0) return priorityDelta;
    return left.localeCompare(right);
  });

const strongestPriority = (
  priorities: ReadonlyArray<RuntimeBridgeDashboardNarrativePriority>,
): RuntimeBridgeDashboardNarrativePriority => sortPriorities(priorities)[0] || "low";

const sortByPriorityThenId = <T extends { readonly priority: RuntimeBridgeDashboardNarrativePriority }>(
  items: ReadonlyArray<T>,
  getId: (item: T) => string,
): T[] =>
  [...items].sort((left, right) => {
    const priorityDelta = priorityScore(right.priority) - priorityScore(left.priority);
    if (priorityDelta !== 0) return priorityDelta;
    return getId(left).localeCompare(getId(right));
  });

const narrativeTheme = (theme: RuntimeBridgeVisualizationTheme): RuntimeBridgeDashboardNarrativeTheme =>
  theme;

const emphasisForTheme = (
  theme: RuntimeBridgeDashboardNarrativeTheme,
): RuntimeBridgeNarrativeEmphasis["emphasis"] => {
  if (theme === "risk" || theme === "governance") return "risk";
  if (theme === "operations") return "operations";
  if (theme === "evidence" || theme === "confidence") return "evidence";
  if (theme === "relationship") return "relationship";
  if (theme === "financial" || theme === "opportunity") return "impact";
  return "context";
};

const audienceFromFlow = (
  flow: RuntimeBridgeDashboardDescriptor["narrativeFlow"],
): RuntimeBridgeAudienceDashboardSummary["audience"] => {
  if (flow === "risk_first") return "governance";
  if (flow === "operations_first") return "operations";
  if (flow === "evidence_first") return "board";
  return "executive";
};

const chartMap = (
  recommendations: ReadonlyArray<RuntimeBridgeChartRecommendation>,
) =>
  new Map<string, RuntimeBridgeChartRecommendation>(
    recommendations.map((recommendation) => [recommendation.recommendationId, recommendation]),
  );

const diagramMap = (
  relationships: ReadonlyArray<RuntimeBridgeDiagramRelationship>,
) =>
  new Map<string, RuntimeBridgeDiagramRelationship>(
    relationships.map((relationship) => [relationship.relationshipId, relationship]),
  );

export const collectRuntimeBridgeDashboardNarrativeThemes = (
  visualizationPlan: RuntimeBridgeVisualizationPlan,
): ReadonlyArray<RuntimeBridgeDashboardNarrativeTheme> => {
  const themes: RuntimeBridgeDashboardNarrativeTheme[] = [
    ...visualizationPlan.visualizationThemes.map(narrativeTheme),
    "boardroom_story",
    "audience_summary",
  ];

  if (visualizationPlan.dashboardDescriptors.length > 1) {
    themes.push("cross_dashboard_alignment");
  }

  return uniqueStable(themes);
};

export const summarizeRuntimeBridgeDashboardNarrativePriorities = (
  visualizationPlan: RuntimeBridgeVisualizationPlan,
): ReadonlyArray<RuntimeBridgeDashboardNarrativePriority> =>
  sortPriorities([
    ...visualizationPlan.visualizationPriorities,
    visualizationPlan.executiveVisualizationNarrative.priority,
    visualizationPlan.visualizationSequence.priority,
    ...visualizationPlan.dashboardDescriptors.map((dashboard) => dashboard.priority),
    ...visualizationPlan.kpiVisualizationGroups.map((group) => group.priority),
    ...visualizationPlan.chartRecommendations.map((recommendation) => recommendation.priority),
    ...visualizationPlan.diagramRelationships.map((relationship) => relationship.priority),
  ]);

export const summarizeRuntimeBridgeNarrativeEmphasis = (
  visualizationPlan: RuntimeBridgeVisualizationPlan,
): ReadonlyArray<RuntimeBridgeNarrativeEmphasis> => {
  const chartsById = chartMap(visualizationPlan.chartRecommendations);

  return sortByPriorityThenId(
    visualizationPlan.dashboardDescriptors.flatMap((dashboard) =>
      collectRuntimeBridgeDashboardNarrativeThemes(visualizationPlan).map((theme) => {
        const chartRecommendationIds = dashboard.chartRecommendationIds.filter((recommendationId) => {
          const recommendation = chartsById.get(recommendationId);
          return recommendation ? narrativeTheme(recommendation.theme) === theme : theme === "executive_summary";
        });
        const priority = strongestPriority([
          dashboard.priority,
          ...chartRecommendationIds
            .map((recommendationId) => chartsById.get(recommendationId)?.priority)
            .filter((priorityValue): priorityValue is RuntimeBridgeDashboardNarrativePriority =>
              Boolean(priorityValue),
            ),
        ]);

        return {
          emphasisId: createRuntimeBridgeId(
            "runtime-bridge-narrative-emphasis",
            visualizationPlan.subjectId,
            dashboard.dashboardId,
            theme,
          ),
          subjectId: visualizationPlan.subjectId,
          theme,
          priority,
          emphasis: emphasisForTheme(theme),
          sourceDashboardIds: [dashboard.dashboardId],
          sourceChartRecommendationIds: chartRecommendationIds,
          summary: `${theme} narrative emphasis is ${emphasisForTheme(theme)} with ${priority} priority.`,
          metadataOnly: true as const,
        };
      }),
    ),
    (emphasis) => emphasis.emphasisId,
  );
};

export const collectRuntimeBridgeKPIVisualRelationships = (
  visualizationPlan: RuntimeBridgeVisualizationPlan,
): ReadonlyArray<RuntimeBridgeKPIVisualRelationship> => {
  const diagramsById = diagramMap(visualizationPlan.diagramRelationships);

  return sortByPriorityThenId(
    visualizationPlan.kpiVisualizationGroups.map((group) => {
      const diagramRelationshipIds = visualizationPlan.diagramRelationships
        .filter(
          (relationship) =>
            relationship.theme === group.theme ||
            relationship.sourcePackageIds.some((packageId) => group.sourcePackageIds.includes(packageId)),
        )
        .map((relationship) => relationship.relationshipId);
      const relationshipPosture: RuntimeBridgeKPIVisualRelationship["relationshipPosture"] =
        diagramRelationshipIds.length > 0
          ? "diagram_supported"
          : group.chartRecommendationIds.length > 1
            ? "multi_visual"
            : group.sourcePackageIds.length > 1
              ? "relationship_supported"
              : "single_visual";
      const priority = strongestPriority([
        group.priority,
        ...diagramRelationshipIds
          .map((relationshipId) => diagramsById.get(relationshipId)?.priority)
          .filter((priorityValue): priorityValue is RuntimeBridgeDashboardNarrativePriority =>
            Boolean(priorityValue),
          ),
      ]);

      return {
        relationshipId: createRuntimeBridgeId("runtime-bridge-kpi-visual-relationship", group.groupId),
        subjectId: visualizationPlan.subjectId,
        kpiGroupId: group.groupId,
        theme: narrativeTheme(group.theme),
        priority,
        chartRecommendationIds: group.chartRecommendationIds,
        diagramRelationshipIds,
        relationshipPosture,
        summary: `${group.theme} KPI visual relationship is ${relationshipPosture} across ${group.chartRecommendationIds.length} chart recommendations.`,
        metadataOnly: true as const,
      };
    }),
    (relationship) => relationship.relationshipId,
  );
};

export const buildRuntimeBridgeDashboardStoryline = ({
  visualizationPlan,
  kpiRelationships = collectRuntimeBridgeKPIVisualRelationships(visualizationPlan),
  narrativeEmphasis = summarizeRuntimeBridgeNarrativeEmphasis(visualizationPlan),
}: {
  readonly visualizationPlan: RuntimeBridgeVisualizationPlan;
  readonly kpiRelationships?: ReadonlyArray<RuntimeBridgeKPIVisualRelationship>;
  readonly narrativeEmphasis?: ReadonlyArray<RuntimeBridgeNarrativeEmphasis>;
}): ReadonlyArray<RuntimeBridgeDashboardStoryline> =>
  sortByPriorityThenId(
    visualizationPlan.dashboardDescriptors.map((dashboard) => {
      const dashboardEmphasis = narrativeEmphasis.filter((emphasis) =>
        emphasis.sourceDashboardIds.includes(dashboard.dashboardId),
      );
      const dashboardKpiRelationships = kpiRelationships.filter((relationship) =>
        dashboard.kpiGroupIds.includes(relationship.kpiGroupId),
      );
      const priority = strongestPriority([
        dashboard.priority,
        ...dashboardEmphasis.map((emphasis) => emphasis.priority),
        ...dashboardKpiRelationships.map((relationship) => relationship.priority),
      ]);

      return {
        storylineId: createRuntimeBridgeId("runtime-bridge-dashboard-storyline", dashboard.dashboardId),
        subjectId: visualizationPlan.subjectId,
        dashboardId: dashboard.dashboardId,
        priority,
        narrativeFlow: dashboard.narrativeFlow,
        themeIds: uniqueStable([
          ...dashboardEmphasis.map((emphasis) => emphasis.theme),
          ...dashboardKpiRelationships.map((relationship) => relationship.theme),
        ]),
        emphasisIds: dashboardEmphasis.map((emphasis) => emphasis.emphasisId),
        kpiVisualRelationshipIds: dashboardKpiRelationships.map((relationship) => relationship.relationshipId),
        summary: `${dashboard.title} storyline describes ${dashboard.narrativeFlow} flow with ${priority} priority.`,
        metadataOnly: true as const,
      };
    }),
    (storyline) => storyline.storylineId,
  );

export const buildRuntimeBridgeVisualNarrativeSequence = ({
  visualizationPlan,
  storylines,
  kpiRelationships,
  narrativeEmphasis,
}: {
  readonly visualizationPlan: RuntimeBridgeVisualizationPlan;
  readonly storylines: ReadonlyArray<RuntimeBridgeDashboardStoryline>;
  readonly kpiRelationships: ReadonlyArray<RuntimeBridgeKPIVisualRelationship>;
  readonly narrativeEmphasis: ReadonlyArray<RuntimeBridgeNarrativeEmphasis>;
}): RuntimeBridgeVisualNarrativeSequence => {
  const orderedStorylines = sortByPriorityThenId(storylines, (storyline) => storyline.storylineId);
  const orderedRelationships = sortByPriorityThenId(kpiRelationships, (relationship) => relationship.relationshipId);
  const orderedEmphasis = sortByPriorityThenId(narrativeEmphasis, (emphasis) => emphasis.emphasisId);
  const priority = strongestPriority([
    visualizationPlan.visualizationSequence.priority,
    ...orderedStorylines.map((storyline) => storyline.priority),
    ...orderedRelationships.map((relationship) => relationship.priority),
    ...orderedEmphasis.map((emphasis) => emphasis.priority),
  ]);

  return {
    sequenceId: createRuntimeBridgeId("runtime-bridge-visual-narrative-sequence", visualizationPlan.subjectId),
    subjectId: visualizationPlan.subjectId,
    priority,
    orderedStorylineIds: orderedStorylines.map((storyline) => storyline.storylineId),
    orderedKPIVisualRelationshipIds: orderedRelationships.map((relationship) => relationship.relationshipId),
    orderedEmphasisIds: orderedEmphasis.map((emphasis) => emphasis.emphasisId),
    sourceVisualizationSequenceId: visualizationPlan.visualizationSequence.sequenceId,
    summary: `Visual narrative sequence orders ${orderedStorylines.length} dashboard storylines, ${orderedRelationships.length} KPI relationships, and ${orderedEmphasis.length} emphasis descriptors.`,
    metadataOnly: true,
  };
};

export const summarizeRuntimeBridgeCrossDashboardAlignment = ({
  visualizationPlan,
  kpiRelationships,
}: {
  readonly visualizationPlan: RuntimeBridgeVisualizationPlan;
  readonly kpiRelationships: ReadonlyArray<RuntimeBridgeKPIVisualRelationship>;
}): RuntimeBridgeCrossDashboardAlignment => {
  const dashboardIds = visualizationPlan.dashboardDescriptors.map((dashboard) => dashboard.dashboardId);
  const posture: RuntimeBridgeCrossDashboardAlignment["posture"] =
    dashboardIds.length <= 1
      ? "single_dashboard"
      : kpiRelationships.length >= dashboardIds.length
        ? "aligned"
        : "review_alignment";
  const priority = strongestPriority([
    ...visualizationPlan.dashboardDescriptors.map((dashboard) => dashboard.priority),
    ...kpiRelationships.map((relationship) => relationship.priority),
  ]);

  return {
    alignmentId: createRuntimeBridgeId("runtime-bridge-cross-dashboard-alignment", visualizationPlan.subjectId),
    subjectId: visualizationPlan.subjectId,
    priority,
    posture,
    dashboardIds,
    themeIds: collectRuntimeBridgeDashboardNarrativeThemes(visualizationPlan),
    relationshipIds: kpiRelationships.map((relationship) => relationship.relationshipId),
    summary: `Cross-dashboard alignment is ${posture} across ${dashboardIds.length} dashboard descriptors and ${kpiRelationships.length} KPI visual relationships.`,
    metadataOnly: true,
  };
};

export const summarizeRuntimeBridgeBoardroomStorytellingPosture = ({
  visualizationPlan,
  storylines,
  narrativeEmphasis,
}: {
  readonly visualizationPlan: RuntimeBridgeVisualizationPlan;
  readonly storylines: ReadonlyArray<RuntimeBridgeDashboardStoryline>;
  readonly narrativeEmphasis: ReadonlyArray<RuntimeBridgeNarrativeEmphasis>;
}): RuntimeBridgeBoardroomStorytellingPosture => {
  const priority = strongestPriority([
    visualizationPlan.executiveVisualizationNarrative.priority,
    ...storylines.map((storyline) => storyline.priority),
    ...narrativeEmphasis.map((emphasis) => emphasis.priority),
  ]);
  const hasRisk = narrativeEmphasis.some((emphasis) => emphasis.emphasis === "risk");
  const hasEvidence = narrativeEmphasis.some((emphasis) => emphasis.emphasis === "evidence");
  const posture: RuntimeBridgeBoardroomStorytellingPosture["posture"] =
    priority === "critical" || hasRisk
      ? "risk_led"
      : hasEvidence
        ? "evidence_led"
        : storylines.length > 1
          ? "strategic_visual_review"
          : "brief";

  return {
    postureId: createRuntimeBridgeId("runtime-bridge-boardroom-storytelling-posture", visualizationPlan.subjectId),
    subjectId: visualizationPlan.subjectId,
    priority,
    posture,
    storylineIds: storylines.map((storyline) => storyline.storylineId),
    emphasisIds: narrativeEmphasis.map((emphasis) => emphasis.emphasisId),
    summary: `Boardroom storytelling posture is ${posture} with ${priority} dashboard narrative priority.`,
    metadataOnly: true,
  };
};

export const buildRuntimeBridgeAudienceDashboardSummaries = ({
  visualizationPlan,
  storylines,
}: {
  readonly visualizationPlan: RuntimeBridgeVisualizationPlan;
  readonly storylines: ReadonlyArray<RuntimeBridgeDashboardStoryline>;
}): ReadonlyArray<RuntimeBridgeAudienceDashboardSummary> =>
  sortByPriorityThenId(
    visualizationPlan.dashboardDescriptors.map((dashboard) => {
      const dashboardStorylines = storylines.filter((storyline) => storyline.dashboardId === dashboard.dashboardId);
      const priority = strongestPriority([
        dashboard.priority,
        ...dashboardStorylines.map((storyline) => storyline.priority),
      ]);

      return {
        summaryId: createRuntimeBridgeId("runtime-bridge-audience-dashboard-summary", dashboard.dashboardId),
        subjectId: visualizationPlan.subjectId,
        audience: audienceFromFlow(dashboard.narrativeFlow),
        priority,
        dashboardIds: [dashboard.dashboardId],
        storylineIds: dashboardStorylines.map((storyline) => storyline.storylineId),
        themeIds: uniqueStable(dashboardStorylines.flatMap((storyline) => storyline.themeIds)),
        summary: `${audienceFromFlow(dashboard.narrativeFlow)} dashboard summary describes ${dashboard.narrativeFlow} storytelling flow.`,
        metadataOnly: true as const,
      };
    }),
    (summary) => summary.summaryId,
  );

export const buildRuntimeBridgeDashboardNarrativePlan = (
  visualizationPlan: RuntimeBridgeVisualizationPlan,
): RuntimeBridgeDashboardNarrativePlan => {
  const narrativeEmphasis = summarizeRuntimeBridgeNarrativeEmphasis(visualizationPlan);
  const kpiVisualRelationships = collectRuntimeBridgeKPIVisualRelationships(visualizationPlan);
  const dashboardStorylines = buildRuntimeBridgeDashboardStoryline({
    visualizationPlan,
    kpiRelationships: kpiVisualRelationships,
    narrativeEmphasis,
  });
  const visualNarrativeSequence = buildRuntimeBridgeVisualNarrativeSequence({
    visualizationPlan,
    storylines: dashboardStorylines,
    kpiRelationships: kpiVisualRelationships,
    narrativeEmphasis,
  });
  const crossDashboardAlignment = summarizeRuntimeBridgeCrossDashboardAlignment({
    visualizationPlan,
    kpiRelationships: kpiVisualRelationships,
  });
  const boardroomStorytellingPosture = summarizeRuntimeBridgeBoardroomStorytellingPosture({
    visualizationPlan,
    storylines: dashboardStorylines,
    narrativeEmphasis,
  });
  const audienceDashboardSummaries = buildRuntimeBridgeAudienceDashboardSummaries({
    visualizationPlan,
    storylines: dashboardStorylines,
  });

  return {
    planId: createRuntimeBridgeId("runtime-bridge-dashboard-narrative-plan", visualizationPlan.subjectId),
    subjectId: visualizationPlan.subjectId,
    dashboardStorylines,
    visualNarrativeSequence,
    kpiVisualRelationships,
    crossDashboardAlignment,
    boardroomStorytellingPosture,
    audienceDashboardSummaries,
    narrativeEmphasis,
    dashboardNarrativePriorities: summarizeRuntimeBridgeDashboardNarrativePriorities(visualizationPlan),
    dashboardNarrativeThemes: collectRuntimeBridgeDashboardNarrativeThemes(visualizationPlan),
    sourceVisualizationPlanId: visualizationPlan.planId,
    metadataOnly: true,
  };
};
