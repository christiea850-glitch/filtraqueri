import type { MetadataOnlyBoundaryContract } from "../governance/boundaryTypes";
import type {
  RuntimeBridgeBoardroomVisualizationNarrative,
  RuntimeBridgeExecutiveDigestVisualization,
  RuntimeBridgeExecutiveVisualizationStory,
  RuntimeBridgeInsightStoryContinuity,
  RuntimeBridgeMultiDashboardSequence,
  RuntimeBridgeStrategicKPIStoryline,
  RuntimeBridgeVisualizationStoryBundle,
  RuntimeBridgeVisualizationStoryPriority,
  RuntimeBridgeVisualizationStoryTheme,
  RuntimeBridgeVisualEscalationStory,
} from "./runtimeBridgeExecutiveVisualizationStorytelling";
import { createRuntimeBridgeId } from "./runtimeBridgeIds";
import type { RuntimeBridgeSourceModuleReference } from "./runtimeBridgeTypes";

export type RuntimeBridgeDashboardCompositionPriority = RuntimeBridgeVisualizationStoryPriority;

export type RuntimeBridgeDashboardCompositionTheme =
  | RuntimeBridgeVisualizationStoryTheme
  | "dashboard_layout"
  | "kpi_coordination"
  | "summary_dashboard"
  | "visual_hierarchy"
  | "composition_bundle";

export type RuntimeBridgeDashboardCompositionInput = {
  readonly executiveStory: RuntimeBridgeExecutiveVisualizationStory;
  readonly boardroomNarrative: RuntimeBridgeBoardroomVisualizationNarrative;
  readonly multiDashboardSequence: RuntimeBridgeMultiDashboardSequence;
  readonly visualEscalationStory: RuntimeBridgeVisualEscalationStory;
  readonly strategicKPIStoryline: RuntimeBridgeStrategicKPIStoryline;
  readonly executiveDigestVisualization: RuntimeBridgeExecutiveDigestVisualization;
  readonly insightContinuity: ReadonlyArray<RuntimeBridgeInsightStoryContinuity>;
  readonly storyBundles: ReadonlyArray<RuntimeBridgeVisualizationStoryBundle>;
  readonly metadataOnly: true;
};

export type RuntimeBridgeDashboardLayoutSequence = {
  readonly sequenceId: string;
  readonly subjectId: string;
  readonly priority: RuntimeBridgeDashboardCompositionPriority;
  readonly layoutPosture: "single_dashboard" | "multi_dashboard" | "boardroom_first" | "escalation_first";
  readonly orderedStorylineIds: ReadonlyArray<string>;
  readonly orderedBundleIds: ReadonlyArray<string>;
  readonly orderedDigestIds: ReadonlyArray<string>;
  readonly sourceMultiDashboardSequenceId: string;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeCrossKPIVisualCoordination = {
  readonly coordinationId: string;
  readonly subjectId: string;
  readonly priority: RuntimeBridgeDashboardCompositionPriority;
  readonly posture: "single_kpi" | "multi_kpi" | "diagram_supported" | "boardroom_linked";
  readonly kpiStorylineId: string;
  readonly sourceChartRecommendationIds: ReadonlyArray<string>;
  readonly sourceDiagramRelationshipIds: ReadonlyArray<string>;
  readonly continuityIds: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeInsightCompositionGroup = {
  readonly groupId: string;
  readonly subjectId: string;
  readonly theme: RuntimeBridgeDashboardCompositionTheme;
  readonly priority: RuntimeBridgeDashboardCompositionPriority;
  readonly storylineIds: ReadonlyArray<string>;
  readonly bundleIds: ReadonlyArray<string>;
  readonly continuityIds: ReadonlyArray<string>;
  readonly emphasisIds: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeExecutiveSummaryDashboard = {
  readonly summaryDashboardId: string;
  readonly subjectId: string;
  readonly priority: RuntimeBridgeDashboardCompositionPriority;
  readonly posture: "brief" | "risk_led" | "digest_led" | "strategic_review";
  readonly executiveStoryId: string;
  readonly digestId: string;
  readonly boardroomNarrativeId: string;
  readonly compositionGroupIds: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeVisualizationHierarchy = {
  readonly hierarchyId: string;
  readonly subjectId: string;
  readonly priority: RuntimeBridgeDashboardCompositionPriority;
  readonly hierarchyPosture: "flat" | "summary_to_detail" | "risk_to_detail" | "kpi_to_boardroom";
  readonly primaryRefIds: ReadonlyArray<string>;
  readonly supportingRefIds: ReadonlyArray<string>;
  readonly detailRefIds: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeCompositionNarrative = {
  readonly narrativeId: string;
  readonly subjectId: string;
  readonly headline: string;
  readonly priority: RuntimeBridgeDashboardCompositionPriority;
  readonly layoutSequenceId: string;
  readonly summaryDashboardId: string;
  readonly hierarchyId: string;
  readonly bundleIds: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeDashboardCompositionBundle = {
  readonly bundleId: string;
  readonly subjectId: string;
  readonly theme: RuntimeBridgeDashboardCompositionTheme;
  readonly priority: RuntimeBridgeDashboardCompositionPriority;
  readonly compositionGroupIds: ReadonlyArray<string>;
  readonly coordinationIds: ReadonlyArray<string>;
  readonly hierarchyIds: ReadonlyArray<string>;
  readonly sourceStoryBundleIds: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeExecutiveDashboardComposition = {
  readonly compositionId: string;
  readonly subjectId: string;
  readonly layoutSequence: RuntimeBridgeDashboardLayoutSequence;
  readonly crossKPIVisualCoordination: ReadonlyArray<RuntimeBridgeCrossKPIVisualCoordination>;
  readonly insightCompositionGroups: ReadonlyArray<RuntimeBridgeInsightCompositionGroup>;
  readonly executiveSummaryDashboard: RuntimeBridgeExecutiveSummaryDashboard;
  readonly visualizationHierarchy: RuntimeBridgeVisualizationHierarchy;
  readonly compositionNarrative: RuntimeBridgeCompositionNarrative;
  readonly dashboardCompositionBundles: ReadonlyArray<RuntimeBridgeDashboardCompositionBundle>;
  readonly dashboardCompositionPriorities: ReadonlyArray<RuntimeBridgeDashboardCompositionPriority>;
  readonly dashboardCompositionThemes: ReadonlyArray<RuntimeBridgeDashboardCompositionTheme>;
  readonly sourceExecutiveVisualizationStoryId: string;
  readonly metadataOnly: true;
};

export const runtimeBridgeExecutiveDashboardCompositionGovernance = {
  mode: "metadata_only",
  contractId: "runtime-bridge-executive-dashboard-composition",
  label: "Runtime bridge executive dashboard composition",
  description:
    "Metadata-only dashboard composition descriptors, executive layout sequencing, cross-KPI visual coordination, insight composition grouping, executive summary dashboard posture, visualization hierarchy intelligence, and deterministic dashboard composition planning.",
  confidence: "high",
  canExecute: false,
  canMutateWorkspace: false,
  canCallBackend: false,
  lineageRefs: [
    "runtime-bridge-executive-dashboard-composition",
    "runtime-bridge-dashboard-layout-sequence",
    "runtime-bridge-cross-kpi-visual-coordination",
    "runtime-bridge-insight-composition-group",
    "runtime-bridge-executive-summary-dashboard",
    "runtime-bridge-visualization-hierarchy",
    "runtime-bridge-composition-narrative",
    "runtime-bridge-dashboard-composition-bundle",
  ],
} satisfies MetadataOnlyBoundaryContract;

export const runtimeBridgeExecutiveDashboardCompositionSourceModule: RuntimeBridgeSourceModuleReference = {
  moduleId: "runtime-bridge-executive-dashboard-composition",
  modulePath: "frontend/src/features/runtimeBridge/runtimeBridgeExecutiveDashboardComposition.ts",
  capabilityMode: "metadata_only",
  label: "Runtime bridge executive dashboard composition",
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

const priorityScore = (priority: RuntimeBridgeDashboardCompositionPriority) => {
  if (priority === "critical") return 4;
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  return 1;
};

const sortPriorities = (
  priorities: ReadonlyArray<RuntimeBridgeDashboardCompositionPriority>,
): RuntimeBridgeDashboardCompositionPriority[] =>
  uniqueStable(priorities).sort((left, right) => {
    const priorityDelta = priorityScore(right) - priorityScore(left);
    if (priorityDelta !== 0) return priorityDelta;
    return left.localeCompare(right);
  });

const strongestPriority = (
  priorities: ReadonlyArray<RuntimeBridgeDashboardCompositionPriority>,
): RuntimeBridgeDashboardCompositionPriority => sortPriorities(priorities)[0] || "low";

const compositionTheme = (
  theme: RuntimeBridgeVisualizationStoryTheme,
): RuntimeBridgeDashboardCompositionTheme => theme;

export const collectRuntimeBridgeDashboardCompositionThemes = (
  input: RuntimeBridgeDashboardCompositionInput,
): ReadonlyArray<RuntimeBridgeDashboardCompositionTheme> =>
  uniqueStable([
    ...input.executiveStory.themeIds.map(compositionTheme),
    ...input.storyBundles.map((bundle) => compositionTheme(bundle.theme)),
    "dashboard_layout",
    "kpi_coordination",
    "summary_dashboard",
    "visual_hierarchy",
    "composition_bundle",
  ]);

export const summarizeRuntimeBridgeDashboardCompositionPriorities = (
  input: RuntimeBridgeDashboardCompositionInput,
): ReadonlyArray<RuntimeBridgeDashboardCompositionPriority> =>
  sortPriorities([
    input.executiveStory.priority,
    input.boardroomNarrative.priority,
    input.multiDashboardSequence.priority,
    input.visualEscalationStory.priority,
    input.strategicKPIStoryline.priority,
    input.executiveDigestVisualization.priority,
    ...input.insightContinuity.map((continuity) => continuity.priority),
    ...input.storyBundles.map((bundle) => bundle.priority),
  ]);

export const buildRuntimeBridgeDashboardLayoutSequence = (
  input: RuntimeBridgeDashboardCompositionInput,
): RuntimeBridgeDashboardLayoutSequence => {
  const posture: RuntimeBridgeDashboardLayoutSequence["layoutPosture"] =
    input.visualEscalationStory.posture === "urgent_review"
      ? "escalation_first"
      : input.boardroomNarrative.posture === "risk_led"
        ? "boardroom_first"
        : input.multiDashboardSequence.orderedStorylineIds.length > 1
          ? "multi_dashboard"
          : "single_dashboard";
  const priority = strongestPriority([
    input.multiDashboardSequence.priority,
    input.boardroomNarrative.priority,
    input.visualEscalationStory.priority,
  ]);

  return {
    sequenceId: createRuntimeBridgeId("runtime-bridge-dashboard-layout-sequence", input.executiveStory.subjectId),
    subjectId: input.executiveStory.subjectId,
    priority,
    layoutPosture: posture,
    orderedStorylineIds: input.multiDashboardSequence.orderedStorylineIds,
    orderedBundleIds: input.multiDashboardSequence.orderedBundleIds,
    orderedDigestIds: [input.executiveDigestVisualization.digestId],
    sourceMultiDashboardSequenceId: input.multiDashboardSequence.sequenceId,
    summary: `Dashboard layout sequence describes ${posture} posture across ${input.multiDashboardSequence.orderedStorylineIds.length} storyline descriptors.`,
    metadataOnly: true,
  };
};

export const collectRuntimeBridgeCrossKPIVisualCoordination = (
  input: RuntimeBridgeDashboardCompositionInput,
): ReadonlyArray<RuntimeBridgeCrossKPIVisualCoordination> => {
  const kpiContinuity = input.insightContinuity.filter(
    (continuity) => continuity.continuityKind === "kpi_to_story",
  );
  const posture: RuntimeBridgeCrossKPIVisualCoordination["posture"] =
    input.strategicKPIStoryline.sourceDiagramRelationshipIds.length > 0
      ? "diagram_supported"
      : input.boardroomNarrative.storylineIds.length > 0
        ? "boardroom_linked"
        : input.strategicKPIStoryline.kpiRelationshipIds.length > 1
          ? "multi_kpi"
          : "single_kpi";

  return [
    {
      coordinationId: createRuntimeBridgeId(
        "runtime-bridge-cross-kpi-visual-coordination",
        input.executiveStory.subjectId,
      ),
      subjectId: input.executiveStory.subjectId,
      priority: input.strategicKPIStoryline.priority,
      posture,
      kpiStorylineId: input.strategicKPIStoryline.kpiStorylineId,
      sourceChartRecommendationIds: input.strategicKPIStoryline.sourceChartRecommendationIds,
      sourceDiagramRelationshipIds: input.strategicKPIStoryline.sourceDiagramRelationshipIds,
      continuityIds: kpiContinuity.map((continuity) => continuity.continuityId),
      summary: `Cross-KPI visual coordination is ${posture} across ${input.strategicKPIStoryline.kpiRelationshipIds.length} KPI relationship descriptors.`,
      metadataOnly: true,
    },
  ];
};

export const buildRuntimeBridgeInsightCompositionGroups = (
  input: RuntimeBridgeDashboardCompositionInput,
): ReadonlyArray<RuntimeBridgeInsightCompositionGroup> =>
  collectRuntimeBridgeDashboardCompositionThemes(input).map((theme) => {
    const storyBundles = input.storyBundles.filter((bundle) => compositionTheme(bundle.theme) === theme);
    const continuity = input.insightContinuity.filter((item) => item.themeIds.some((itemTheme) => compositionTheme(itemTheme) === theme));
    const priority = strongestPriority([
      ...storyBundles.map((bundle) => bundle.priority),
      ...continuity.map((item) => item.priority),
      input.executiveStory.themeIds.some((storyTheme) => compositionTheme(storyTheme) === theme)
        ? input.executiveStory.priority
        : "low",
    ]);

    return {
      groupId: createRuntimeBridgeId("runtime-bridge-insight-composition-group", input.executiveStory.subjectId, theme),
      subjectId: input.executiveStory.subjectId,
      theme,
      priority,
      storylineIds: uniqueStable([
        ...storyBundles.flatMap((bundle) => bundle.storylineIds),
        ...input.executiveStory.storylineIds.filter(() => theme === "summary_dashboard"),
      ]),
      bundleIds: storyBundles.map((bundle) => bundle.bundleId),
      continuityIds: continuity.map((item) => item.continuityId),
      emphasisIds: uniqueStable(storyBundles.flatMap((bundle) => bundle.emphasisIds)),
      summary: `${theme} insight composition group references ${storyBundles.length} story bundles and ${continuity.length} continuity descriptors.`,
      metadataOnly: true as const,
    };
  }).sort((left, right) => {
    const priorityDelta = priorityScore(right.priority) - priorityScore(left.priority);
    if (priorityDelta !== 0) return priorityDelta;
    return left.groupId.localeCompare(right.groupId);
  });

export const summarizeRuntimeBridgeExecutiveSummaryDashboard = ({
  input,
  groups = buildRuntimeBridgeInsightCompositionGroups(input),
}: {
  readonly input: RuntimeBridgeDashboardCompositionInput;
  readonly groups?: ReadonlyArray<RuntimeBridgeInsightCompositionGroup>;
}): RuntimeBridgeExecutiveSummaryDashboard => {
  const posture: RuntimeBridgeExecutiveSummaryDashboard["posture"] =
    input.visualEscalationStory.posture === "urgent_review"
      ? "risk_led"
      : input.executiveDigestVisualization.priority === "critical" || input.executiveDigestVisualization.priority === "high"
        ? "digest_led"
        : input.boardroomNarrative.posture === "strategic_visual_review"
          ? "strategic_review"
          : "brief";

  return {
    summaryDashboardId: createRuntimeBridgeId("runtime-bridge-executive-summary-dashboard", input.executiveStory.subjectId),
    subjectId: input.executiveStory.subjectId,
    priority: strongestPriority([
      input.executiveStory.priority,
      input.executiveDigestVisualization.priority,
      input.boardroomNarrative.priority,
    ]),
    posture,
    executiveStoryId: input.executiveStory.storyId,
    digestId: input.executiveDigestVisualization.digestId,
    boardroomNarrativeId: input.boardroomNarrative.narrativeId,
    compositionGroupIds: groups.map((group) => group.groupId),
    summary: `Executive summary dashboard metadata describes ${posture} posture across ${groups.length} composition groups.`,
    metadataOnly: true,
  };
};

export const summarizeRuntimeBridgeVisualizationHierarchy = ({
  input,
  groups = buildRuntimeBridgeInsightCompositionGroups(input),
}: {
  readonly input: RuntimeBridgeDashboardCompositionInput;
  readonly groups?: ReadonlyArray<RuntimeBridgeInsightCompositionGroup>;
}): RuntimeBridgeVisualizationHierarchy => {
  const hierarchyPosture: RuntimeBridgeVisualizationHierarchy["hierarchyPosture"] =
    input.visualEscalationStory.posture === "urgent_review"
      ? "risk_to_detail"
      : input.strategicKPIStoryline.kpiRelationshipIds.length > 0
        ? "kpi_to_boardroom"
        : groups.length > 1
          ? "summary_to_detail"
          : "flat";

  return {
    hierarchyId: createRuntimeBridgeId("runtime-bridge-visualization-hierarchy", input.executiveStory.subjectId),
    subjectId: input.executiveStory.subjectId,
    priority: strongestPriority([
      input.executiveStory.priority,
      input.strategicKPIStoryline.priority,
      input.visualEscalationStory.priority,
    ]),
    hierarchyPosture,
    primaryRefIds: [input.executiveStory.storyId, input.boardroomNarrative.narrativeId],
    supportingRefIds: [input.executiveDigestVisualization.digestId, input.strategicKPIStoryline.kpiStorylineId],
    detailRefIds: uniqueStable([
      ...groups.map((group) => group.groupId),
      ...input.insightContinuity.map((continuity) => continuity.continuityId),
    ]),
    summary: `Visualization hierarchy is ${hierarchyPosture} with ${groups.length} composition groups and ${input.insightContinuity.length} continuity descriptors.`,
    metadataOnly: true,
  };
};

export const buildRuntimeBridgeDashboardCompositionBundles = ({
  input,
  groups = buildRuntimeBridgeInsightCompositionGroups(input),
  coordination = collectRuntimeBridgeCrossKPIVisualCoordination(input),
  hierarchy = summarizeRuntimeBridgeVisualizationHierarchy({ input, groups }),
}: {
  readonly input: RuntimeBridgeDashboardCompositionInput;
  readonly groups?: ReadonlyArray<RuntimeBridgeInsightCompositionGroup>;
  readonly coordination?: ReadonlyArray<RuntimeBridgeCrossKPIVisualCoordination>;
  readonly hierarchy?: RuntimeBridgeVisualizationHierarchy;
}): ReadonlyArray<RuntimeBridgeDashboardCompositionBundle> =>
  collectRuntimeBridgeDashboardCompositionThemes(input).map((theme) => {
    const themeGroups = groups.filter((group) => group.theme === theme);
    const sourceStoryBundles = input.storyBundles.filter((bundle) => compositionTheme(bundle.theme) === theme);
    const priority = strongestPriority([
      ...themeGroups.map((group) => group.priority),
      ...sourceStoryBundles.map((bundle) => bundle.priority),
      hierarchy.priority,
    ]);

    return {
      bundleId: createRuntimeBridgeId("runtime-bridge-dashboard-composition-bundle", input.executiveStory.subjectId, theme),
      subjectId: input.executiveStory.subjectId,
      theme,
      priority,
      compositionGroupIds: themeGroups.map((group) => group.groupId),
      coordinationIds: theme === "kpi_coordination" ? coordination.map((item) => item.coordinationId) : [],
      hierarchyIds: theme === "visual_hierarchy" ? [hierarchy.hierarchyId] : [],
      sourceStoryBundleIds: sourceStoryBundles.map((bundle) => bundle.bundleId),
      summary: `${theme} dashboard composition bundle includes ${themeGroups.length} composition groups and ${sourceStoryBundles.length} source story bundles.`,
      metadataOnly: true as const,
    };
  }).sort((left, right) => {
    const priorityDelta = priorityScore(right.priority) - priorityScore(left.priority);
    if (priorityDelta !== 0) return priorityDelta;
    return left.bundleId.localeCompare(right.bundleId);
  });

export const buildRuntimeBridgeCompositionNarrative = ({
  input,
  layoutSequence,
  executiveSummaryDashboard,
  visualizationHierarchy,
  bundles,
}: {
  readonly input: RuntimeBridgeDashboardCompositionInput;
  readonly layoutSequence: RuntimeBridgeDashboardLayoutSequence;
  readonly executiveSummaryDashboard: RuntimeBridgeExecutiveSummaryDashboard;
  readonly visualizationHierarchy: RuntimeBridgeVisualizationHierarchy;
  readonly bundles: ReadonlyArray<RuntimeBridgeDashboardCompositionBundle>;
}): RuntimeBridgeCompositionNarrative => {
  const priority = strongestPriority([
    layoutSequence.priority,
    executiveSummaryDashboard.priority,
    visualizationHierarchy.priority,
    ...bundles.map((bundle) => bundle.priority),
  ]);

  return {
    narrativeId: createRuntimeBridgeId("runtime-bridge-composition-narrative", input.executiveStory.subjectId),
    subjectId: input.executiveStory.subjectId,
    headline: "Executive dashboard composition metadata is ready for review",
    priority,
    layoutSequenceId: layoutSequence.sequenceId,
    summaryDashboardId: executiveSummaryDashboard.summaryDashboardId,
    hierarchyId: visualizationHierarchy.hierarchyId,
    bundleIds: bundles.map((bundle) => bundle.bundleId),
    summary: `Composition narrative describes ${layoutSequence.layoutPosture} layout sequencing, ${executiveSummaryDashboard.posture} summary posture, and ${visualizationHierarchy.hierarchyPosture} hierarchy.`,
    metadataOnly: true,
  };
};

export const buildRuntimeBridgeExecutiveDashboardComposition = (
  input: RuntimeBridgeDashboardCompositionInput,
): RuntimeBridgeExecutiveDashboardComposition => {
  const layoutSequence = buildRuntimeBridgeDashboardLayoutSequence(input);
  const crossKPIVisualCoordination = collectRuntimeBridgeCrossKPIVisualCoordination(input);
  const insightCompositionGroups = buildRuntimeBridgeInsightCompositionGroups(input);
  const executiveSummaryDashboard = summarizeRuntimeBridgeExecutiveSummaryDashboard({
    input,
    groups: insightCompositionGroups,
  });
  const visualizationHierarchy = summarizeRuntimeBridgeVisualizationHierarchy({
    input,
    groups: insightCompositionGroups,
  });
  const dashboardCompositionBundles = buildRuntimeBridgeDashboardCompositionBundles({
    input,
    groups: insightCompositionGroups,
    coordination: crossKPIVisualCoordination,
    hierarchy: visualizationHierarchy,
  });
  const compositionNarrative = buildRuntimeBridgeCompositionNarrative({
    input,
    layoutSequence,
    executiveSummaryDashboard,
    visualizationHierarchy,
    bundles: dashboardCompositionBundles,
  });

  return {
    compositionId: createRuntimeBridgeId("runtime-bridge-executive-dashboard-composition", input.executiveStory.subjectId),
    subjectId: input.executiveStory.subjectId,
    layoutSequence,
    crossKPIVisualCoordination,
    insightCompositionGroups,
    executiveSummaryDashboard,
    visualizationHierarchy,
    compositionNarrative,
    dashboardCompositionBundles,
    dashboardCompositionPriorities: summarizeRuntimeBridgeDashboardCompositionPriorities(input),
    dashboardCompositionThemes: collectRuntimeBridgeDashboardCompositionThemes(input),
    sourceExecutiveVisualizationStoryId: input.executiveStory.storyId,
    metadataOnly: true,
  };
};
