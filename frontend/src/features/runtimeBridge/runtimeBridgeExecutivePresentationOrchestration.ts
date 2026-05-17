import type { MetadataOnlyBoundaryContract } from "../governance/boundaryTypes";
import type {
  RuntimeBridgeDashboardCompositionBundle,
  RuntimeBridgeDashboardCompositionPriority,
  RuntimeBridgeDashboardCompositionTheme,
  RuntimeBridgeExecutiveDashboardComposition,
} from "./runtimeBridgeExecutiveDashboardComposition";
import { createRuntimeBridgeId } from "./runtimeBridgeIds";
import type { RuntimeBridgeSourceModuleReference } from "./runtimeBridgeTypes";

export type RuntimeBridgePresentationPriority = RuntimeBridgeDashboardCompositionPriority;

export type RuntimeBridgePresentationTheme =
  | RuntimeBridgeDashboardCompositionTheme
  | "boardroom_flow"
  | "presentation_continuity"
  | "visual_synchronization"
  | "executive_briefing"
  | "presentation_bundle";

export type RuntimeBridgeBoardroomPresentationFlow = {
  readonly flowId: string;
  readonly subjectId: string;
  readonly priority: RuntimeBridgePresentationPriority;
  readonly flowPosture: "brief" | "risk_first" | "dashboard_first" | "hierarchy_first";
  readonly layoutSequenceId: string;
  readonly summaryDashboardId: string;
  readonly hierarchyId: string;
  readonly orderedRefIds: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgePresentationContinuity = {
  readonly continuityId: string;
  readonly subjectId: string;
  readonly priority: RuntimeBridgePresentationPriority;
  readonly continuityPosture: "single_stream" | "dashboard_to_briefing" | "hierarchy_linked" | "risk_linked";
  readonly fromRefId: string;
  readonly toRefId: string;
  readonly themeIds: ReadonlyArray<RuntimeBridgePresentationTheme>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeVisualIntelligenceSynchronization = {
  readonly synchronizationId: string;
  readonly subjectId: string;
  readonly priority: RuntimeBridgePresentationPriority;
  readonly posture: "synchronized" | "review_synchronization" | "risk_synchronized" | "hierarchy_synchronized";
  readonly compositionBundleIds: ReadonlyArray<string>;
  readonly continuityIds: ReadonlyArray<string>;
  readonly coordinationIds: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeExecutiveBriefingOrchestration = {
  readonly briefingId: string;
  readonly subjectId: string;
  readonly priority: RuntimeBridgePresentationPriority;
  readonly posture: "informational" | "digest_led" | "risk_led" | "strategic_review";
  readonly summaryDashboardId: string;
  readonly narrativeId: string;
  readonly bundleIds: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgePresentationSequencePlan = {
  readonly sequenceId: string;
  readonly subjectId: string;
  readonly priority: RuntimeBridgePresentationPriority;
  readonly orderedFlowIds: ReadonlyArray<string>;
  readonly orderedContinuityIds: ReadonlyArray<string>;
  readonly orderedSynchronizationIds: ReadonlyArray<string>;
  readonly orderedBriefingIds: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgePresentationNarrative = {
  readonly narrativeId: string;
  readonly subjectId: string;
  readonly headline: string;
  readonly priority: RuntimeBridgePresentationPriority;
  readonly flowId: string;
  readonly sequenceId: string;
  readonly synchronizationId: string;
  readonly briefingId: string;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgePresentationBundle = {
  readonly bundleId: string;
  readonly subjectId: string;
  readonly theme: RuntimeBridgePresentationTheme;
  readonly priority: RuntimeBridgePresentationPriority;
  readonly sourceCompositionBundleIds: ReadonlyArray<string>;
  readonly continuityIds: ReadonlyArray<string>;
  readonly sequenceIds: ReadonlyArray<string>;
  readonly briefingIds: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeExecutivePresentationOrchestration = {
  readonly orchestrationId: string;
  readonly subjectId: string;
  readonly boardroomPresentationFlow: RuntimeBridgeBoardroomPresentationFlow;
  readonly presentationContinuity: ReadonlyArray<RuntimeBridgePresentationContinuity>;
  readonly visualIntelligenceSynchronization: RuntimeBridgeVisualIntelligenceSynchronization;
  readonly executiveBriefingOrchestration: RuntimeBridgeExecutiveBriefingOrchestration;
  readonly presentationSequencePlan: RuntimeBridgePresentationSequencePlan;
  readonly presentationNarrative: RuntimeBridgePresentationNarrative;
  readonly presentationBundles: ReadonlyArray<RuntimeBridgePresentationBundle>;
  readonly presentationPriorities: ReadonlyArray<RuntimeBridgePresentationPriority>;
  readonly presentationThemes: ReadonlyArray<RuntimeBridgePresentationTheme>;
  readonly sourceDashboardCompositionId: string;
  readonly metadataOnly: true;
};

export const runtimeBridgeExecutivePresentationOrchestrationGovernance = {
  mode: "metadata_only",
  contractId: "runtime-bridge-executive-presentation-orchestration",
  label: "Runtime bridge executive presentation orchestration",
  description:
    "Metadata-only executive presentation sequencing, boardroom intelligence flow, cross-dashboard continuity, visual intelligence synchronization posture, executive briefing descriptors, and deterministic presentation planning metadata.",
  confidence: "high",
  canExecute: false,
  canMutateWorkspace: false,
  canCallBackend: false,
  lineageRefs: [
    "runtime-bridge-executive-presentation-orchestration",
    "runtime-bridge-boardroom-presentation-flow",
    "runtime-bridge-presentation-continuity",
    "runtime-bridge-visual-intelligence-synchronization",
    "runtime-bridge-executive-briefing-orchestration",
    "runtime-bridge-presentation-sequence-plan",
    "runtime-bridge-presentation-narrative",
    "runtime-bridge-presentation-bundle",
  ],
} satisfies MetadataOnlyBoundaryContract;

export const runtimeBridgeExecutivePresentationOrchestrationSourceModule: RuntimeBridgeSourceModuleReference = {
  moduleId: "runtime-bridge-executive-presentation-orchestration",
  modulePath: "frontend/src/features/runtimeBridge/runtimeBridgeExecutivePresentationOrchestration.ts",
  capabilityMode: "metadata_only",
  label: "Runtime bridge executive presentation orchestration",
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

const priorityScore = (priority: RuntimeBridgePresentationPriority) => {
  if (priority === "critical") return 4;
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  return 1;
};

const sortPriorities = (
  priorities: ReadonlyArray<RuntimeBridgePresentationPriority>,
): RuntimeBridgePresentationPriority[] =>
  uniqueStable(priorities).sort((left, right) => {
    const priorityDelta = priorityScore(right) - priorityScore(left);
    if (priorityDelta !== 0) return priorityDelta;
    return left.localeCompare(right);
  });

const strongestPriority = (
  priorities: ReadonlyArray<RuntimeBridgePresentationPriority>,
): RuntimeBridgePresentationPriority => sortPriorities(priorities)[0] || "low";

const presentationTheme = (
  theme: RuntimeBridgeDashboardCompositionTheme,
): RuntimeBridgePresentationTheme => theme;

export const collectRuntimeBridgePresentationThemes = (
  composition: RuntimeBridgeExecutiveDashboardComposition,
): ReadonlyArray<RuntimeBridgePresentationTheme> =>
  uniqueStable([
    ...composition.dashboardCompositionThemes.map(presentationTheme),
    "boardroom_flow",
    "presentation_continuity",
    "visual_synchronization",
    "executive_briefing",
    "presentation_bundle",
  ]);

export const summarizeRuntimeBridgePresentationPriorities = (
  composition: RuntimeBridgeExecutiveDashboardComposition,
): ReadonlyArray<RuntimeBridgePresentationPriority> =>
  sortPriorities([
    ...composition.dashboardCompositionPriorities,
    composition.layoutSequence.priority,
    ...composition.crossKPIVisualCoordination.map((coordination) => coordination.priority),
    ...composition.insightCompositionGroups.map((group) => group.priority),
    composition.executiveSummaryDashboard.priority,
    composition.visualizationHierarchy.priority,
    composition.compositionNarrative.priority,
    ...composition.dashboardCompositionBundles.map((bundle) => bundle.priority),
  ]);

export const buildRuntimeBridgeBoardroomPresentationFlow = (
  composition: RuntimeBridgeExecutiveDashboardComposition,
): RuntimeBridgeBoardroomPresentationFlow => {
  const flowPosture: RuntimeBridgeBoardroomPresentationFlow["flowPosture"] =
    composition.executiveSummaryDashboard.posture === "risk_led"
      ? "risk_first"
      : composition.layoutSequence.layoutPosture === "multi_dashboard"
        ? "dashboard_first"
        : composition.visualizationHierarchy.hierarchyPosture !== "flat"
          ? "hierarchy_first"
          : "brief";

  return {
    flowId: createRuntimeBridgeId("runtime-bridge-boardroom-presentation-flow", composition.subjectId),
    subjectId: composition.subjectId,
    priority: strongestPriority([
      composition.layoutSequence.priority,
      composition.executiveSummaryDashboard.priority,
      composition.visualizationHierarchy.priority,
    ]),
    flowPosture,
    layoutSequenceId: composition.layoutSequence.sequenceId,
    summaryDashboardId: composition.executiveSummaryDashboard.summaryDashboardId,
    hierarchyId: composition.visualizationHierarchy.hierarchyId,
    orderedRefIds: uniqueStable([
      composition.executiveSummaryDashboard.summaryDashboardId,
      composition.layoutSequence.sequenceId,
      composition.visualizationHierarchy.hierarchyId,
      ...composition.layoutSequence.orderedBundleIds,
    ]),
    summary: `Boardroom presentation flow describes ${flowPosture} posture across dashboard composition metadata.`,
    metadataOnly: true,
  };
};

export const summarizeRuntimeBridgePresentationContinuity = (
  composition: RuntimeBridgeExecutiveDashboardComposition,
): ReadonlyArray<RuntimeBridgePresentationContinuity> => {
  const bundleContinuity = composition.dashboardCompositionBundles.map((bundle) => {
    const continuityPosture: RuntimeBridgePresentationContinuity["continuityPosture"] =
      bundle.theme === "visual_escalation" || bundle.theme === "risk"
        ? "risk_linked"
        : bundle.hierarchyIds.length > 0
          ? "hierarchy_linked"
          : bundle.compositionGroupIds.length > 0
            ? "dashboard_to_briefing"
            : "single_stream";

    return {
      continuityId: createRuntimeBridgeId("runtime-bridge-presentation-continuity", bundle.bundleId),
      subjectId: composition.subjectId,
      priority: bundle.priority,
      continuityPosture,
      fromRefId: bundle.bundleId,
      toRefId: composition.compositionNarrative.narrativeId,
      themeIds: [presentationTheme(bundle.theme)],
      summary: `${bundle.theme} presentation continuity is ${continuityPosture}.`,
      metadataOnly: true as const,
    };
  });
  const hierarchyContinuity = {
    continuityId: createRuntimeBridgeId("runtime-bridge-presentation-continuity", composition.subjectId, "hierarchy"),
    subjectId: composition.subjectId,
    priority: composition.visualizationHierarchy.priority,
    continuityPosture: "hierarchy_linked" as const,
    fromRefId: composition.visualizationHierarchy.hierarchyId,
    toRefId: composition.executiveSummaryDashboard.summaryDashboardId,
    themeIds: ["visual_hierarchy" as const, "presentation_continuity" as const],
    summary: "Visualization hierarchy metadata links executive summary dashboard posture to presentation planning metadata.",
    metadataOnly: true as const,
  };

  return [...bundleContinuity, hierarchyContinuity].sort((left, right) => {
    const priorityDelta = priorityScore(right.priority) - priorityScore(left.priority);
    if (priorityDelta !== 0) return priorityDelta;
    return left.continuityId.localeCompare(right.continuityId);
  });
};

export const buildRuntimeBridgeVisualIntelligenceSynchronization = ({
  composition,
  continuity = summarizeRuntimeBridgePresentationContinuity(composition),
}: {
  readonly composition: RuntimeBridgeExecutiveDashboardComposition;
  readonly continuity?: ReadonlyArray<RuntimeBridgePresentationContinuity>;
}): RuntimeBridgeVisualIntelligenceSynchronization => {
  const posture: RuntimeBridgeVisualIntelligenceSynchronization["posture"] =
    composition.executiveSummaryDashboard.posture === "risk_led"
      ? "risk_synchronized"
      : composition.visualizationHierarchy.hierarchyPosture !== "flat"
        ? "hierarchy_synchronized"
        : continuity.length > composition.dashboardCompositionBundles.length
          ? "review_synchronization"
          : "synchronized";

  return {
    synchronizationId: createRuntimeBridgeId("runtime-bridge-visual-intelligence-synchronization", composition.subjectId),
    subjectId: composition.subjectId,
    priority: strongestPriority([
      composition.visualizationHierarchy.priority,
      ...continuity.map((item) => item.priority),
      ...composition.crossKPIVisualCoordination.map((item) => item.priority),
    ]),
    posture,
    compositionBundleIds: composition.dashboardCompositionBundles.map((bundle) => bundle.bundleId),
    continuityIds: continuity.map((item) => item.continuityId),
    coordinationIds: composition.crossKPIVisualCoordination.map((item) => item.coordinationId),
    summary: `Visual intelligence synchronization posture is ${posture} across ${continuity.length} continuity descriptors.`,
    metadataOnly: true,
  };
};

export const summarizeRuntimeBridgeExecutiveBriefingOrchestration = (
  composition: RuntimeBridgeExecutiveDashboardComposition,
): RuntimeBridgeExecutiveBriefingOrchestration => {
  const posture: RuntimeBridgeExecutiveBriefingOrchestration["posture"] =
    composition.executiveSummaryDashboard.posture === "risk_led"
      ? "risk_led"
      : composition.executiveSummaryDashboard.posture === "digest_led"
        ? "digest_led"
        : composition.executiveSummaryDashboard.posture === "strategic_review"
          ? "strategic_review"
          : "informational";

  return {
    briefingId: createRuntimeBridgeId("runtime-bridge-executive-briefing-orchestration", composition.subjectId),
    subjectId: composition.subjectId,
    priority: composition.executiveSummaryDashboard.priority,
    posture,
    summaryDashboardId: composition.executiveSummaryDashboard.summaryDashboardId,
    narrativeId: composition.compositionNarrative.narrativeId,
    bundleIds: composition.dashboardCompositionBundles.map((bundle) => bundle.bundleId),
    summary: `Executive briefing descriptor is ${posture} with ${composition.dashboardCompositionBundles.length} composition bundles.`,
    metadataOnly: true,
  };
};

export const buildRuntimeBridgePresentationSequencePlan = ({
  composition,
  flow,
  continuity,
  synchronization,
  briefing,
}: {
  readonly composition: RuntimeBridgeExecutiveDashboardComposition;
  readonly flow: RuntimeBridgeBoardroomPresentationFlow;
  readonly continuity: ReadonlyArray<RuntimeBridgePresentationContinuity>;
  readonly synchronization: RuntimeBridgeVisualIntelligenceSynchronization;
  readonly briefing: RuntimeBridgeExecutiveBriefingOrchestration;
}): RuntimeBridgePresentationSequencePlan => ({
  sequenceId: createRuntimeBridgeId("runtime-bridge-presentation-sequence-plan", composition.subjectId),
  subjectId: composition.subjectId,
  priority: strongestPriority([
    flow.priority,
    synchronization.priority,
    briefing.priority,
    ...continuity.map((item) => item.priority),
  ]),
  orderedFlowIds: [flow.flowId],
  orderedContinuityIds: continuity.map((item) => item.continuityId),
  orderedSynchronizationIds: [synchronization.synchronizationId],
  orderedBriefingIds: [briefing.briefingId],
  summary: `Presentation sequence plan orders boardroom flow, ${continuity.length} continuity descriptors, synchronization posture, and briefing metadata.`,
  metadataOnly: true,
});

export const buildRuntimeBridgePresentationNarrative = ({
  composition,
  flow,
  sequencePlan,
  synchronization,
  briefing,
}: {
  readonly composition: RuntimeBridgeExecutiveDashboardComposition;
  readonly flow: RuntimeBridgeBoardroomPresentationFlow;
  readonly sequencePlan: RuntimeBridgePresentationSequencePlan;
  readonly synchronization: RuntimeBridgeVisualIntelligenceSynchronization;
  readonly briefing: RuntimeBridgeExecutiveBriefingOrchestration;
}): RuntimeBridgePresentationNarrative => ({
  narrativeId: createRuntimeBridgeId("runtime-bridge-presentation-narrative", composition.subjectId),
  subjectId: composition.subjectId,
  headline: "Executive presentation planning metadata is ready for review",
  priority: strongestPriority([flow.priority, sequencePlan.priority, synchronization.priority, briefing.priority]),
  flowId: flow.flowId,
  sequenceId: sequencePlan.sequenceId,
  synchronizationId: synchronization.synchronizationId,
  briefingId: briefing.briefingId,
  summary: `Presentation narrative describes ${flow.flowPosture} boardroom flow, ${synchronization.posture} synchronization, and ${briefing.posture} briefing posture.`,
  metadataOnly: true,
});

export const buildRuntimeBridgePresentationBundles = ({
  composition,
  continuity,
  sequencePlan,
  briefing,
}: {
  readonly composition: RuntimeBridgeExecutiveDashboardComposition;
  readonly continuity: ReadonlyArray<RuntimeBridgePresentationContinuity>;
  readonly sequencePlan: RuntimeBridgePresentationSequencePlan;
  readonly briefing: RuntimeBridgeExecutiveBriefingOrchestration;
}): ReadonlyArray<RuntimeBridgePresentationBundle> =>
  collectRuntimeBridgePresentationThemes(composition).map((theme) => {
    const sourceBundles: ReadonlyArray<RuntimeBridgeDashboardCompositionBundle> =
      composition.dashboardCompositionBundles.filter((bundle) => presentationTheme(bundle.theme) === theme);
    const relatedContinuity = continuity.filter((item) => item.themeIds.includes(theme));
    const priority = strongestPriority([
      ...sourceBundles.map((bundle) => bundle.priority),
      ...relatedContinuity.map((item) => item.priority),
      theme === "executive_briefing" ? briefing.priority : "low",
      theme === "presentation_bundle" ? sequencePlan.priority : "low",
    ]);

    return {
      bundleId: createRuntimeBridgeId("runtime-bridge-presentation-bundle", composition.subjectId, theme),
      subjectId: composition.subjectId,
      theme,
      priority,
      sourceCompositionBundleIds: sourceBundles.map((bundle) => bundle.bundleId),
      continuityIds: relatedContinuity.map((item) => item.continuityId),
      sequenceIds: theme === "presentation_bundle" ? [sequencePlan.sequenceId] : [],
      briefingIds: theme === "executive_briefing" ? [briefing.briefingId] : [],
      summary: `${theme} presentation bundle references ${sourceBundles.length} composition bundles and ${relatedContinuity.length} continuity descriptors.`,
      metadataOnly: true as const,
    };
  }).sort((left, right) => {
    const priorityDelta = priorityScore(right.priority) - priorityScore(left.priority);
    if (priorityDelta !== 0) return priorityDelta;
    return left.bundleId.localeCompare(right.bundleId);
  });

export const buildRuntimeBridgeExecutivePresentationOrchestration = (
  composition: RuntimeBridgeExecutiveDashboardComposition,
): RuntimeBridgeExecutivePresentationOrchestration => {
  const boardroomPresentationFlow = buildRuntimeBridgeBoardroomPresentationFlow(composition);
  const presentationContinuity = summarizeRuntimeBridgePresentationContinuity(composition);
  const visualIntelligenceSynchronization = buildRuntimeBridgeVisualIntelligenceSynchronization({
    composition,
    continuity: presentationContinuity,
  });
  const executiveBriefingOrchestration = summarizeRuntimeBridgeExecutiveBriefingOrchestration(composition);
  const presentationSequencePlan = buildRuntimeBridgePresentationSequencePlan({
    composition,
    flow: boardroomPresentationFlow,
    continuity: presentationContinuity,
    synchronization: visualIntelligenceSynchronization,
    briefing: executiveBriefingOrchestration,
  });
  const presentationNarrative = buildRuntimeBridgePresentationNarrative({
    composition,
    flow: boardroomPresentationFlow,
    sequencePlan: presentationSequencePlan,
    synchronization: visualIntelligenceSynchronization,
    briefing: executiveBriefingOrchestration,
  });
  const presentationBundles = buildRuntimeBridgePresentationBundles({
    composition,
    continuity: presentationContinuity,
    sequencePlan: presentationSequencePlan,
    briefing: executiveBriefingOrchestration,
  });

  return {
    orchestrationId: createRuntimeBridgeId("runtime-bridge-executive-presentation-orchestration", composition.subjectId),
    subjectId: composition.subjectId,
    boardroomPresentationFlow,
    presentationContinuity,
    visualIntelligenceSynchronization,
    executiveBriefingOrchestration,
    presentationSequencePlan,
    presentationNarrative,
    presentationBundles,
    presentationPriorities: summarizeRuntimeBridgePresentationPriorities(composition),
    presentationThemes: collectRuntimeBridgePresentationThemes(composition),
    sourceDashboardCompositionId: composition.compositionId,
    metadataOnly: true,
  };
};
