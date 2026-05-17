import type { MetadataOnlyBoundaryContract } from "../governance/boundaryTypes";
import type {
  RuntimeBridgeExecutiveDeliveryPlan,
  RuntimeBridgeVisualizationIntent,
} from "./runtimeBridgeExecutiveDeliveryIntelligence";
import { createRuntimeBridgeId } from "./runtimeBridgeIds";
import type { RuntimeBridgeInterpretationTheme } from "./runtimeBridgeInsightInterpretation";
import type { RuntimeBridgeSourceModuleReference } from "./runtimeBridgeTypes";

export type RuntimeBridgeVisualizationPriority = "low" | "medium" | "high" | "critical";

export type RuntimeBridgeVisualizationTheme =
  | "executive_summary"
  | "risk"
  | "operations"
  | "governance"
  | "confidence"
  | "evidence"
  | "relationship"
  | "opportunity"
  | "financial"
  | "context";

export type RuntimeBridgeVisualizationIntentDescriptor = {
  readonly descriptorId: string;
  readonly subjectId: string;
  readonly sourceIntentId: string;
  readonly theme: RuntimeBridgeVisualizationTheme;
  readonly priority: RuntimeBridgeVisualizationPriority;
  readonly recommendedChartPosture: string;
  readonly executiveEmphasis: string;
  readonly kpiGrouping: string;
  readonly relationshipDensity: string;
  readonly sourcePackageIds: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeChartRecommendation = {
  readonly recommendationId: string;
  readonly subjectId: string;
  readonly theme: RuntimeBridgeVisualizationTheme;
  readonly priority: RuntimeBridgeVisualizationPriority;
  readonly chartType: string;
  readonly posture: "primary" | "supporting" | "detail";
  readonly sourceIntentIds: ReadonlyArray<string>;
  readonly sourcePackageIds: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeDiagramRelationship = {
  readonly relationshipId: string;
  readonly subjectId: string;
  readonly theme: RuntimeBridgeVisualizationTheme;
  readonly relationshipIntent: "none" | "lineage" | "cluster" | "dependency";
  readonly density: "none" | "low" | "medium" | "high";
  readonly priority: RuntimeBridgeVisualizationPriority;
  readonly sourceIntentIds: ReadonlyArray<string>;
  readonly sourcePackageIds: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeKPIVisualizationGroup = {
  readonly groupId: string;
  readonly subjectId: string;
  readonly theme: RuntimeBridgeVisualizationTheme;
  readonly priority: RuntimeBridgeVisualizationPriority;
  readonly grouping: string;
  readonly chartRecommendationIds: ReadonlyArray<string>;
  readonly visualizationIntentDescriptorIds: ReadonlyArray<string>;
  readonly sourcePackageIds: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeDashboardDescriptor = {
  readonly dashboardId: string;
  readonly subjectId: string;
  readonly title: string;
  readonly priority: RuntimeBridgeVisualizationPriority;
  readonly narrativeFlow: "summary_first" | "risk_first" | "operations_first" | "evidence_first";
  readonly kpiGroupIds: ReadonlyArray<string>;
  readonly chartRecommendationIds: ReadonlyArray<string>;
  readonly diagramRelationshipIds: ReadonlyArray<string>;
  readonly sourceIntentIds: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeExecutiveVisualizationNarrative = {
  readonly narrativeId: string;
  readonly subjectId: string;
  readonly headline: string;
  readonly priority: RuntimeBridgeVisualizationPriority;
  readonly themeIds: ReadonlyArray<RuntimeBridgeVisualizationTheme>;
  readonly dashboardDescriptorIds: ReadonlyArray<string>;
  readonly chartRecommendationIds: ReadonlyArray<string>;
  readonly diagramRelationshipIds: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeVisualizationSequence = {
  readonly sequenceId: string;
  readonly subjectId: string;
  readonly priority: RuntimeBridgeVisualizationPriority;
  readonly orderedDashboardDescriptorIds: ReadonlyArray<string>;
  readonly orderedKPIGroupIds: ReadonlyArray<string>;
  readonly orderedChartRecommendationIds: ReadonlyArray<string>;
  readonly orderedDiagramRelationshipIds: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeVisualizationPlan = {
  readonly planId: string;
  readonly subjectId: string;
  readonly dashboardDescriptors: ReadonlyArray<RuntimeBridgeDashboardDescriptor>;
  readonly kpiVisualizationGroups: ReadonlyArray<RuntimeBridgeKPIVisualizationGroup>;
  readonly visualizationIntentDescriptors: ReadonlyArray<RuntimeBridgeVisualizationIntentDescriptor>;
  readonly chartRecommendations: ReadonlyArray<RuntimeBridgeChartRecommendation>;
  readonly diagramRelationships: ReadonlyArray<RuntimeBridgeDiagramRelationship>;
  readonly executiveVisualizationNarrative: RuntimeBridgeExecutiveVisualizationNarrative;
  readonly visualizationSequence: RuntimeBridgeVisualizationSequence;
  readonly visualizationPriorities: ReadonlyArray<RuntimeBridgeVisualizationPriority>;
  readonly visualizationThemes: ReadonlyArray<RuntimeBridgeVisualizationTheme>;
  readonly sourceExecutiveDeliveryPlanId: string;
  readonly metadataOnly: true;
};

export const runtimeBridgeVisualizationPlanningGovernance = {
  mode: "metadata_only",
  contractId: "runtime-bridge-visualization-planning",
  label: "Runtime bridge visualization planning",
  description:
    "Metadata-only visualization intent planning, dashboard descriptors, KPI visualization grouping, executive visual storytelling posture, chart recommendation metadata, diagram relationship descriptors, and deterministic visualization sequencing.",
  confidence: "high",
  canExecute: false,
  canMutateWorkspace: false,
  canCallBackend: false,
  lineageRefs: [
    "runtime-bridge-visualization-plan",
    "runtime-bridge-dashboard-descriptor",
    "runtime-bridge-kpi-visualization-group",
    "runtime-bridge-visualization-intent-descriptor",
    "runtime-bridge-chart-recommendation",
    "runtime-bridge-diagram-relationship",
    "runtime-bridge-executive-visualization-narrative",
    "runtime-bridge-visualization-sequence",
  ],
} satisfies MetadataOnlyBoundaryContract;

export const runtimeBridgeVisualizationPlanningSourceModule: RuntimeBridgeSourceModuleReference = {
  moduleId: "runtime-bridge-visualization-planning",
  modulePath: "frontend/src/features/runtimeBridge/runtimeBridgeVisualizationPlanning.ts",
  capabilityMode: "metadata_only",
  label: "Runtime bridge visualization planning",
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

const priorityScore = (priority: RuntimeBridgeVisualizationPriority) => {
  if (priority === "critical") return 4;
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  return 1;
};

const sortPriorities = (
  priorities: ReadonlyArray<RuntimeBridgeVisualizationPriority>,
): RuntimeBridgeVisualizationPriority[] =>
  uniqueStable(priorities).sort((left, right) => {
    const priorityDelta = priorityScore(right) - priorityScore(left);
    if (priorityDelta !== 0) return priorityDelta;
    return left.localeCompare(right);
  });

const strongestPriority = (
  priorities: ReadonlyArray<RuntimeBridgeVisualizationPriority>,
): RuntimeBridgeVisualizationPriority => sortPriorities(priorities)[0] || "low";

const sortByPriorityThenId = <T extends { readonly priority: RuntimeBridgeVisualizationPriority }>(
  items: ReadonlyArray<T>,
  getId: (item: T) => string,
): T[] =>
  [...items].sort((left, right) => {
    const priorityDelta = priorityScore(right.priority) - priorityScore(left.priority);
    if (priorityDelta !== 0) return priorityDelta;
    return getId(left).localeCompare(getId(right));
  });

const mapIntentTheme = (theme: RuntimeBridgeInterpretationTheme): RuntimeBridgeVisualizationTheme => {
  if (theme === "risk") return "risk";
  if (theme === "operational" || theme === "quality") return "operations";
  if (theme === "governance") return "governance";
  if (theme === "confidence") return "confidence";
  if (theme === "evidence") return "evidence";
  if (theme === "relationship" || theme === "lineage") return "relationship";
  if (theme === "opportunity" || theme === "advisory") return "opportunity";
  if (theme === "financial") return "financial";
  return "context";
};

const intentPriority = (intent: RuntimeBridgeVisualizationIntent): RuntimeBridgeVisualizationPriority =>
  intent.insightHighlightImportance;

const flowFromAudiencePosture = (
  posture: RuntimeBridgeExecutiveDeliveryPlan["audience"]["posture"],
): RuntimeBridgeDashboardDescriptor["narrativeFlow"] => {
  if (posture === "risk_first") return "risk_first";
  if (posture === "operations_first") return "operations_first";
  if (posture === "evidence_first") return "evidence_first";
  return "summary_first";
};

export const collectRuntimeBridgeVisualizationThemes = (
  deliveryPlan: RuntimeBridgeExecutiveDeliveryPlan,
): ReadonlyArray<RuntimeBridgeVisualizationTheme> =>
  uniqueStable([
    "executive_summary",
    ...deliveryPlan.visualizationIntents.map((intent) => mapIntentTheme(intent.theme)),
  ]);

export const summarizeRuntimeBridgeVisualizationPriorities = (
  deliveryPlan: RuntimeBridgeExecutiveDeliveryPlan,
): ReadonlyArray<RuntimeBridgeVisualizationPriority> =>
  sortPriorities([
    ...deliveryPlan.deliveryPriorities,
    deliveryPlan.audience.priority,
    deliveryPlan.presentationIntent.deliveryPriority,
    deliveryPlan.insightDigest.priority,
    ...deliveryPlan.visualizationIntents.map((intent) => intentPriority(intent)),
  ]);

export const summarizeRuntimeBridgeVisualizationIntent = (
  deliveryPlan: RuntimeBridgeExecutiveDeliveryPlan,
): ReadonlyArray<RuntimeBridgeVisualizationIntentDescriptor> =>
  sortByPriorityThenId(
    deliveryPlan.visualizationIntents.map((intent) => {
      const theme = mapIntentTheme(intent.theme);
      const priority = intentPriority(intent);

      return {
        descriptorId: createRuntimeBridgeId(
          "runtime-bridge-visualization-intent-descriptor",
          intent.intentId,
        ),
        subjectId: deliveryPlan.subjectId,
        sourceIntentId: intent.intentId,
        theme,
        priority,
        recommendedChartPosture: intent.recommendedChartType,
        executiveEmphasis: intent.executiveEmphasis,
        kpiGrouping: intent.kpiGrouping,
        relationshipDensity: intent.relationshipDensity,
        sourcePackageIds: intent.sourcePackageIds,
        summary: `${theme} visualization intent recommends ${intent.recommendedChartType} posture with ${priority} priority.`,
        metadataOnly: true as const,
      };
    }),
    (descriptor) => descriptor.descriptorId,
  );

export const collectRuntimeBridgeChartRecommendations = (
  deliveryPlan: RuntimeBridgeExecutiveDeliveryPlan,
): ReadonlyArray<RuntimeBridgeChartRecommendation> =>
  sortByPriorityThenId(
    deliveryPlan.visualizationIntents.map((intent) => {
      const theme = mapIntentTheme(intent.theme);
      const priority = intentPriority(intent);

      return {
        recommendationId: createRuntimeBridgeId("runtime-bridge-chart-recommendation", intent.intentId),
        subjectId: deliveryPlan.subjectId,
        theme,
        priority,
        chartType: intent.recommendedChartType,
        posture: intent.narrativeVisualizationPosture,
        sourceIntentIds: [intent.intentId],
        sourcePackageIds: intent.sourcePackageIds,
        summary: `${theme} chart recommendation describes ${intent.recommendedChartType} as ${intent.narrativeVisualizationPosture} metadata only.`,
        metadataOnly: true as const,
      };
    }),
    (recommendation) => recommendation.recommendationId,
  );

export const buildRuntimeBridgeDiagramRelationships = (
  deliveryPlan: RuntimeBridgeExecutiveDeliveryPlan,
): ReadonlyArray<RuntimeBridgeDiagramRelationship> =>
  sortByPriorityThenId(
    deliveryPlan.visualizationIntents
      .filter(
        (intent) =>
          intent.diagramRelationshipIntent !== "none" || intent.relationshipDensity !== "none",
      )
      .map((intent) => {
        const theme = mapIntentTheme(intent.theme);
        const priority = intentPriority(intent);

        return {
          relationshipId: createRuntimeBridgeId("runtime-bridge-diagram-relationship", intent.intentId),
          subjectId: deliveryPlan.subjectId,
          theme,
          relationshipIntent: intent.diagramRelationshipIntent,
          density: intent.relationshipDensity,
          priority,
          sourceIntentIds: [intent.intentId],
          sourcePackageIds: intent.sourcePackageIds,
          summary: `${theme} diagram relationship metadata describes ${intent.diagramRelationshipIntent} intent with ${intent.relationshipDensity} density.`,
          metadataOnly: true as const,
        };
      }),
    (relationship) => relationship.relationshipId,
  );

export const collectRuntimeBridgeKPIVisualizationGroups = ({
  deliveryPlan,
  intentDescriptors = summarizeRuntimeBridgeVisualizationIntent(deliveryPlan),
  chartRecommendations = collectRuntimeBridgeChartRecommendations(deliveryPlan),
}: {
  readonly deliveryPlan: RuntimeBridgeExecutiveDeliveryPlan;
  readonly intentDescriptors?: ReadonlyArray<RuntimeBridgeVisualizationIntentDescriptor>;
  readonly chartRecommendations?: ReadonlyArray<RuntimeBridgeChartRecommendation>;
}): ReadonlyArray<RuntimeBridgeKPIVisualizationGroup> =>
  collectRuntimeBridgeVisualizationThemes(deliveryPlan).map((theme) => {
    const themeDescriptors = intentDescriptors.filter((descriptor) => descriptor.theme === theme);
    const themeRecommendations = chartRecommendations.filter((recommendation) => recommendation.theme === theme);
    const priority = strongestPriority([
      ...themeDescriptors.map((descriptor) => descriptor.priority),
      ...themeRecommendations.map((recommendation) => recommendation.priority),
    ]);

    return {
      groupId: createRuntimeBridgeId("runtime-bridge-kpi-visualization-group", deliveryPlan.subjectId, theme),
      subjectId: deliveryPlan.subjectId,
      theme,
      priority,
      grouping: themeDescriptors[0]?.kpiGrouping || "theme_group",
      chartRecommendationIds: themeRecommendations.map((recommendation) => recommendation.recommendationId),
      visualizationIntentDescriptorIds: themeDescriptors.map((descriptor) => descriptor.descriptorId),
      sourcePackageIds: uniqueStable([
        ...themeDescriptors.flatMap((descriptor) => descriptor.sourcePackageIds),
        ...themeRecommendations.flatMap((recommendation) => recommendation.sourcePackageIds),
      ]),
      summary: `${theme} KPI visualization group contains ${themeRecommendations.length} chart recommendations and ${themeDescriptors.length} intent descriptors.`,
      metadataOnly: true as const,
    };
  }).sort((left, right) => {
    const priorityDelta = priorityScore(right.priority) - priorityScore(left.priority);
    if (priorityDelta !== 0) return priorityDelta;
    return left.groupId.localeCompare(right.groupId);
  });

export const buildRuntimeBridgeDashboardDescriptors = ({
  deliveryPlan,
  kpiGroups = collectRuntimeBridgeKPIVisualizationGroups({ deliveryPlan }),
  chartRecommendations = collectRuntimeBridgeChartRecommendations(deliveryPlan),
  diagramRelationships = buildRuntimeBridgeDiagramRelationships(deliveryPlan),
}: {
  readonly deliveryPlan: RuntimeBridgeExecutiveDeliveryPlan;
  readonly kpiGroups?: ReadonlyArray<RuntimeBridgeKPIVisualizationGroup>;
  readonly chartRecommendations?: ReadonlyArray<RuntimeBridgeChartRecommendation>;
  readonly diagramRelationships?: ReadonlyArray<RuntimeBridgeDiagramRelationship>;
}): ReadonlyArray<RuntimeBridgeDashboardDescriptor> => {
  const priority = strongestPriority([
    ...kpiGroups.map((group) => group.priority),
    ...chartRecommendations.map((recommendation) => recommendation.priority),
    ...diagramRelationships.map((relationship) => relationship.priority),
  ]);

  return [
    {
      dashboardId: createRuntimeBridgeId("runtime-bridge-dashboard-descriptor", deliveryPlan.subjectId, "executive"),
      subjectId: deliveryPlan.subjectId,
      title: "Executive visualization descriptor",
      priority,
      narrativeFlow: flowFromAudiencePosture(deliveryPlan.audience.posture),
      kpiGroupIds: kpiGroups.map((group) => group.groupId),
      chartRecommendationIds: chartRecommendations.map((recommendation) => recommendation.recommendationId),
      diagramRelationshipIds: diagramRelationships.map((relationship) => relationship.relationshipId),
      sourceIntentIds: deliveryPlan.visualizationIntents.map((intent) => intent.intentId),
      summary: `Dashboard descriptor describes ${flowFromAudiencePosture(deliveryPlan.audience.posture)} narrative flow across ${kpiGroups.length} KPI groups and ${chartRecommendations.length} chart recommendations.`,
      metadataOnly: true,
    },
  ];
};

export const buildRuntimeBridgeExecutiveVisualizationNarrative = ({
  deliveryPlan,
  dashboardDescriptors,
  chartRecommendations,
  diagramRelationships,
}: {
  readonly deliveryPlan: RuntimeBridgeExecutiveDeliveryPlan;
  readonly dashboardDescriptors: ReadonlyArray<RuntimeBridgeDashboardDescriptor>;
  readonly chartRecommendations: ReadonlyArray<RuntimeBridgeChartRecommendation>;
  readonly diagramRelationships: ReadonlyArray<RuntimeBridgeDiagramRelationship>;
}): RuntimeBridgeExecutiveVisualizationNarrative => {
  const priority = strongestPriority([
    ...dashboardDescriptors.map((descriptor) => descriptor.priority),
    ...chartRecommendations.map((recommendation) => recommendation.priority),
    ...diagramRelationships.map((relationship) => relationship.priority),
  ]);
  const themes = collectRuntimeBridgeVisualizationThemes(deliveryPlan);

  return {
    narrativeId: createRuntimeBridgeId("runtime-bridge-executive-visualization-narrative", deliveryPlan.subjectId),
    subjectId: deliveryPlan.subjectId,
    headline: "Executive visualization planning metadata is ready for review",
    priority,
    themeIds: themes,
    dashboardDescriptorIds: dashboardDescriptors.map((descriptor) => descriptor.dashboardId),
    chartRecommendationIds: chartRecommendations.map((recommendation) => recommendation.recommendationId),
    diagramRelationshipIds: diagramRelationships.map((relationship) => relationship.relationshipId),
    summary: `Executive visualization narrative describes ${priority} visibility priority across ${themes.length} themes, ${chartRecommendations.length} chart recommendations, and ${diagramRelationships.length} relationship descriptors.`,
    metadataOnly: true,
  };
};

export const buildRuntimeBridgeVisualizationSequence = ({
  deliveryPlan,
  dashboardDescriptors,
  kpiGroups,
  chartRecommendations,
  diagramRelationships,
}: {
  readonly deliveryPlan: RuntimeBridgeExecutiveDeliveryPlan;
  readonly dashboardDescriptors: ReadonlyArray<RuntimeBridgeDashboardDescriptor>;
  readonly kpiGroups: ReadonlyArray<RuntimeBridgeKPIVisualizationGroup>;
  readonly chartRecommendations: ReadonlyArray<RuntimeBridgeChartRecommendation>;
  readonly diagramRelationships: ReadonlyArray<RuntimeBridgeDiagramRelationship>;
}): RuntimeBridgeVisualizationSequence => {
  const orderedDashboards = sortByPriorityThenId(dashboardDescriptors, (descriptor) => descriptor.dashboardId);
  const orderedKpiGroups = sortByPriorityThenId(kpiGroups, (group) => group.groupId);
  const orderedCharts = sortByPriorityThenId(chartRecommendations, (recommendation) => recommendation.recommendationId);
  const orderedDiagrams = sortByPriorityThenId(diagramRelationships, (relationship) => relationship.relationshipId);
  const priority = strongestPriority([
    ...orderedDashboards.map((descriptor) => descriptor.priority),
    ...orderedKpiGroups.map((group) => group.priority),
    ...orderedCharts.map((recommendation) => recommendation.priority),
    ...orderedDiagrams.map((relationship) => relationship.priority),
  ]);

  return {
    sequenceId: createRuntimeBridgeId("runtime-bridge-visualization-sequence", deliveryPlan.subjectId),
    subjectId: deliveryPlan.subjectId,
    priority,
    orderedDashboardDescriptorIds: orderedDashboards.map((descriptor) => descriptor.dashboardId),
    orderedKPIGroupIds: orderedKpiGroups.map((group) => group.groupId),
    orderedChartRecommendationIds: orderedCharts.map((recommendation) => recommendation.recommendationId),
    orderedDiagramRelationshipIds: orderedDiagrams.map((relationship) => relationship.relationshipId),
    summary: `Visualization sequence orders ${orderedDashboards.length} dashboard descriptors, ${orderedKpiGroups.length} KPI groups, ${orderedCharts.length} chart recommendations, and ${orderedDiagrams.length} diagram relationship descriptors.`,
    metadataOnly: true,
  };
};

export const buildRuntimeBridgeVisualizationPlan = (
  deliveryPlan: RuntimeBridgeExecutiveDeliveryPlan,
): RuntimeBridgeVisualizationPlan => {
  const visualizationIntentDescriptors = summarizeRuntimeBridgeVisualizationIntent(deliveryPlan);
  const chartRecommendations = collectRuntimeBridgeChartRecommendations(deliveryPlan);
  const diagramRelationships = buildRuntimeBridgeDiagramRelationships(deliveryPlan);
  const kpiVisualizationGroups = collectRuntimeBridgeKPIVisualizationGroups({
    deliveryPlan,
    intentDescriptors: visualizationIntentDescriptors,
    chartRecommendations,
  });
  const dashboardDescriptors = buildRuntimeBridgeDashboardDescriptors({
    deliveryPlan,
    kpiGroups: kpiVisualizationGroups,
    chartRecommendations,
    diagramRelationships,
  });
  const executiveVisualizationNarrative = buildRuntimeBridgeExecutiveVisualizationNarrative({
    deliveryPlan,
    dashboardDescriptors,
    chartRecommendations,
    diagramRelationships,
  });
  const visualizationSequence = buildRuntimeBridgeVisualizationSequence({
    deliveryPlan,
    dashboardDescriptors,
    kpiGroups: kpiVisualizationGroups,
    chartRecommendations,
    diagramRelationships,
  });

  return {
    planId: createRuntimeBridgeId("runtime-bridge-visualization-plan", deliveryPlan.subjectId),
    subjectId: deliveryPlan.subjectId,
    dashboardDescriptors,
    kpiVisualizationGroups,
    visualizationIntentDescriptors,
    chartRecommendations,
    diagramRelationships,
    executiveVisualizationNarrative,
    visualizationSequence,
    visualizationPriorities: summarizeRuntimeBridgeVisualizationPriorities(deliveryPlan),
    visualizationThemes: collectRuntimeBridgeVisualizationThemes(deliveryPlan),
    sourceExecutiveDeliveryPlanId: deliveryPlan.planId,
    metadataOnly: true,
  };
};
