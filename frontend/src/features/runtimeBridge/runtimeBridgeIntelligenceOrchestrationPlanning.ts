import type { MetadataOnlyBoundaryContract } from "../governance/boundaryTypes";
import { createRuntimeBridgeId } from "./runtimeBridgeIds";
import type {
  RuntimeBridgeNarrativePriority,
  RuntimeBridgeStrategicNarrativePackage,
} from "./runtimeBridgeStrategicNarrativePackaging";
import type { RuntimeBridgeSourceModuleReference } from "./runtimeBridgeTypes";

export type RuntimeBridgeCoordinationPriority = RuntimeBridgeNarrativePriority;

export type RuntimeBridgeExecutionBoundary = {
  readonly boundaryId: string;
  readonly subjectId: string;
  readonly label: string;
  readonly allowedMode: "metadata_only";
  readonly canExecute: false;
  readonly canCoordinateRuntime: false;
  readonly canSchedule: false;
  readonly canPersist: false;
  readonly protectedSurfaceRefs: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeDependencyPlan = {
  readonly dependencyId: string;
  readonly subjectId: string;
  readonly fromId: string;
  readonly toId: string;
  readonly dependencyKind:
    | "narrative_to_review"
    | "objective_to_bundle"
    | "kpi_to_boardroom"
    | "bundle_to_synchronization"
    | "boundary_to_checkpoint";
  readonly priority: RuntimeBridgeCoordinationPriority;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeReviewStage = {
  readonly stageId: string;
  readonly subjectId: string;
  readonly sequence: number;
  readonly label: string;
  readonly stageKind:
    | "executive_storyline_review"
    | "objective_alignment_review"
    | "kpi_sequence_review"
    | "boardroom_posture_review"
    | "boundary_review";
  readonly priority: RuntimeBridgeCoordinationPriority;
  readonly relatedDependencyIds: ReadonlyArray<string>;
  readonly relatedCheckpointIds: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeEscalationRoute = {
  readonly routeId: string;
  readonly subjectId: string;
  readonly posture: "none" | "watch" | "review" | "urgent_review";
  readonly priority: RuntimeBridgeCoordinationPriority;
  readonly audienceRef: string;
  readonly reviewStageIds: ReadonlyArray<string>;
  readonly boundaryIds: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeDeliverySynchronization = {
  readonly synchronizationId: string;
  readonly subjectId: string;
  readonly posture: "single_stream" | "parallel_review" | "executive_first" | "risk_first";
  readonly priority: RuntimeBridgeCoordinationPriority;
  readonly synchronizedBundleIds: ReadonlyArray<string>;
  readonly synchronizedStageIds: ReadonlyArray<string>;
  readonly synchronizedNarrativeIds: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgePlanningCheckpoint = {
  readonly checkpointId: string;
  readonly subjectId: string;
  readonly sequence: number;
  readonly label: string;
  readonly checkpointKind:
    | "metadata_boundary"
    | "dependency_review"
    | "escalation_posture"
    | "delivery_alignment"
    | "narrative_consistency";
  readonly priority: RuntimeBridgeCoordinationPriority;
  readonly relatedRefIds: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeCoordinationSequence = {
  readonly sequenceId: string;
  readonly subjectId: string;
  readonly priority: RuntimeBridgeCoordinationPriority;
  readonly orderedStageIds: ReadonlyArray<string>;
  readonly orderedCheckpointIds: ReadonlyArray<string>;
  readonly orderedDependencyIds: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeOrchestrationNarrative = {
  readonly narrativeId: string;
  readonly subjectId: string;
  readonly headline: string;
  readonly summary: string;
  readonly coordinationSequenceId: string;
  readonly synchronizationId: string;
  readonly escalationRouteIds: ReadonlyArray<string>;
  readonly boundaryIds: ReadonlyArray<string>;
  readonly metadataOnly: true;
};

export type RuntimeBridgeOrchestrationPlan = {
  readonly planId: string;
  readonly subjectId: string;
  readonly coordinationSequence: RuntimeBridgeCoordinationSequence;
  readonly dependencyPlans: ReadonlyArray<RuntimeBridgeDependencyPlan>;
  readonly reviewStages: ReadonlyArray<RuntimeBridgeReviewStage>;
  readonly escalationRoutes: ReadonlyArray<RuntimeBridgeEscalationRoute>;
  readonly deliverySynchronization: RuntimeBridgeDeliverySynchronization;
  readonly executionBoundaries: ReadonlyArray<RuntimeBridgeExecutionBoundary>;
  readonly planningCheckpoints: ReadonlyArray<RuntimeBridgePlanningCheckpoint>;
  readonly coordinationPriorities: ReadonlyArray<RuntimeBridgeCoordinationPriority>;
  readonly orchestrationNarrative: RuntimeBridgeOrchestrationNarrative;
  readonly sourceStrategicNarrativePackageId: string;
  readonly metadataOnly: true;
};

export const runtimeBridgeIntelligenceOrchestrationPlanningGovernance = {
  mode: "metadata_only",
  contractId: "runtime-bridge-intelligence-orchestration-planning",
  label: "Runtime bridge intelligence orchestration planning",
  description:
    "Metadata-only planning descriptors for intelligence coordination sequencing, dependency mapping, review stages, escalation posture, delivery synchronization, execution boundaries, and planning checkpoints.",
  confidence: "high",
  canExecute: false,
  canMutateWorkspace: false,
  canCallBackend: false,
  lineageRefs: [
    "runtime-bridge-orchestration-plan",
    "runtime-bridge-coordination-sequence",
    "runtime-bridge-dependency-plan",
    "runtime-bridge-review-stage",
    "runtime-bridge-escalation-route",
    "runtime-bridge-delivery-synchronization",
    "runtime-bridge-execution-boundary",
    "runtime-bridge-planning-checkpoint",
    "runtime-bridge-orchestration-narrative",
  ],
} satisfies MetadataOnlyBoundaryContract;

export const runtimeBridgeIntelligenceOrchestrationPlanningSourceModule: RuntimeBridgeSourceModuleReference = {
  moduleId: "runtime-bridge-intelligence-orchestration-planning",
  modulePath: "frontend/src/features/runtimeBridge/runtimeBridgeIntelligenceOrchestrationPlanning.ts",
  capabilityMode: "metadata_only",
  label: "Runtime bridge intelligence orchestration planning",
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

const priorityScore = (priority: RuntimeBridgeCoordinationPriority) => {
  if (priority === "critical") return 4;
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  return 1;
};

const sortPriorities = (
  priorities: ReadonlyArray<RuntimeBridgeCoordinationPriority>,
): RuntimeBridgeCoordinationPriority[] =>
  uniqueStable(priorities).sort((left, right) => {
    const priorityDelta = priorityScore(right) - priorityScore(left);
    if (priorityDelta !== 0) return priorityDelta;
    return left.localeCompare(right);
  });

const strongestPriority = (
  priorities: ReadonlyArray<RuntimeBridgeCoordinationPriority>,
): RuntimeBridgeCoordinationPriority => sortPriorities(priorities)[0] || "low";

const sortByPriorityThenId = <T extends { readonly priority: RuntimeBridgeCoordinationPriority }>(
  items: ReadonlyArray<T>,
  getId: (item: T) => string,
): T[] =>
  [...items].sort((left, right) => {
    const priorityDelta = priorityScore(right.priority) - priorityScore(left.priority);
    if (priorityDelta !== 0) return priorityDelta;
    return getId(left).localeCompare(getId(right));
  });

export const summarizeRuntimeBridgeCoordinationPriorities = (
  strategicPackage: RuntimeBridgeStrategicNarrativePackage,
): ReadonlyArray<RuntimeBridgeCoordinationPriority> =>
  sortPriorities([
    ...strategicPackage.narrativePriorities,
    strategicPackage.storyline.narrativePriority,
    strategicPackage.kpiStorySequence.priority,
    ...strategicPackage.briefingBundles.map((bundle) => bundle.priority),
    ...strategicPackage.businessObjectiveAlignments.map((alignment) => alignment.priority),
    ...strategicPackage.narrativeSections.map((section) => section.priority),
  ]);

export const summarizeRuntimeBridgeExecutionBoundaries = (
  strategicPackage: RuntimeBridgeStrategicNarrativePackage,
): ReadonlyArray<RuntimeBridgeExecutionBoundary> => [
  {
    boundaryId: createRuntimeBridgeId("runtime-bridge-execution-boundary", strategicPackage.subjectId, "metadata"),
    subjectId: strategicPackage.subjectId,
    label: "Metadata-only planning boundary",
    allowedMode: "metadata_only",
    canExecute: false,
    canCoordinateRuntime: false,
    canSchedule: false,
    canPersist: false,
    protectedSurfaceRefs: [
      "App.tsx",
      "executeWorkspaceQuery",
      "ResultsGrid",
      "ActiveResultModel",
      "useResultExecutionCoordinator",
      "SQL/Monaco",
      "runtimePersistence",
      "backendAPIs",
      "exports",
    ],
    summary: "Planning metadata is descriptive only and cannot execute, coordinate runtime systems, schedule, persist, route, query, or export.",
    metadataOnly: true,
  },
];

export const collectRuntimeBridgeDependencyPlans = (
  strategicPackage: RuntimeBridgeStrategicNarrativePackage,
): ReadonlyArray<RuntimeBridgeDependencyPlan> => {
  const narrativeDependencies = strategicPackage.narrativeSections.map((section) => ({
    dependencyId: createRuntimeBridgeId(
      "runtime-bridge-dependency-plan",
      strategicPackage.subjectId,
      section.sectionId,
      "review",
    ),
    subjectId: strategicPackage.subjectId,
    fromId: section.sectionId,
    toId: strategicPackage.storyline.storylineId,
    dependencyKind: "narrative_to_review" as const,
    priority: section.priority,
    summary: `${section.title} depends on executive storyline review metadata.`,
    metadataOnly: true as const,
  }));
  const objectiveDependencies = strategicPackage.businessObjectiveAlignments.flatMap((alignment) =>
    alignment.sourceSectionIds.map((sectionId) => ({
      dependencyId: createRuntimeBridgeId(
        "runtime-bridge-dependency-plan",
        strategicPackage.subjectId,
        alignment.alignmentId,
        sectionId,
      ),
      subjectId: strategicPackage.subjectId,
      fromId: alignment.alignmentId,
      toId: sectionId,
      dependencyKind: "objective_to_bundle" as const,
      priority: alignment.priority,
      summary: `${alignment.objective} objective alignment references narrative section metadata.`,
      metadataOnly: true as const,
    })),
  );
  const kpiDependency = {
    dependencyId: createRuntimeBridgeId(
      "runtime-bridge-dependency-plan",
      strategicPackage.subjectId,
      "kpi",
      "boardroom",
    ),
    subjectId: strategicPackage.subjectId,
    fromId: strategicPackage.kpiStorySequence.sequenceId,
    toId: strategicPackage.boardroomPresentation.presentationId,
    dependencyKind: "kpi_to_boardroom" as const,
    priority: strategicPackage.kpiStorySequence.priority,
    summary: "KPI story sequence metadata informs boardroom posture metadata.",
    metadataOnly: true as const,
  };
  const bundleDependencies = strategicPackage.briefingBundles.map((bundle) => ({
    dependencyId: createRuntimeBridgeId(
      "runtime-bridge-dependency-plan",
      strategicPackage.subjectId,
      bundle.bundleId,
      "synchronization",
    ),
    subjectId: strategicPackage.subjectId,
    fromId: bundle.bundleId,
    toId: strategicPackage.boardroomPresentation.presentationId,
    dependencyKind: "bundle_to_synchronization" as const,
    priority: bundle.priority,
    summary: `${bundle.strategicTheme} briefing bundle participates in delivery synchronization metadata.`,
    metadataOnly: true as const,
  }));

  return sortByPriorityThenId(
    [...narrativeDependencies, ...objectiveDependencies, kpiDependency, ...bundleDependencies],
    (dependency) => dependency.dependencyId,
  );
};

export const collectRuntimeBridgePlanningCheckpoints = ({
  strategicPackage,
  boundaries = summarizeRuntimeBridgeExecutionBoundaries(strategicPackage),
}: {
  readonly strategicPackage: RuntimeBridgeStrategicNarrativePackage;
  readonly boundaries?: ReadonlyArray<RuntimeBridgeExecutionBoundary>;
}): ReadonlyArray<RuntimeBridgePlanningCheckpoint> => {
  const priorities = summarizeRuntimeBridgeCoordinationPriorities(strategicPackage);
  const priority = strongestPriority(priorities);
  const checkpoints: RuntimeBridgePlanningCheckpoint[] = [
    {
      checkpointId: createRuntimeBridgeId("runtime-bridge-planning-checkpoint", strategicPackage.subjectId, "boundary"),
      subjectId: strategicPackage.subjectId,
      sequence: 1,
      label: "Metadata boundary review",
      checkpointKind: "metadata_boundary",
      priority,
      relatedRefIds: boundaries.map((boundary) => boundary.boundaryId),
      summary: "Confirm planning metadata remains descriptive and non-executable.",
      metadataOnly: true,
    },
    {
      checkpointId: createRuntimeBridgeId("runtime-bridge-planning-checkpoint", strategicPackage.subjectId, "dependency"),
      subjectId: strategicPackage.subjectId,
      sequence: 2,
      label: "Dependency metadata review",
      checkpointKind: "dependency_review",
      priority,
      relatedRefIds: strategicPackage.briefingBundles.map((bundle) => bundle.bundleId),
      summary: "Review dependency relationships between storyline, objectives, bundles, and boardroom metadata.",
      metadataOnly: true,
    },
    {
      checkpointId: createRuntimeBridgeId("runtime-bridge-planning-checkpoint", strategicPackage.subjectId, "escalation"),
      subjectId: strategicPackage.subjectId,
      sequence: 3,
      label: "Escalation posture review",
      checkpointKind: "escalation_posture",
      priority: strategicPackage.storyline.narrativePriority,
      relatedRefIds: [strategicPackage.boardroomPresentation.presentationId],
      summary: "Review escalation storytelling density and boardroom posture metadata.",
      metadataOnly: true,
    },
    {
      checkpointId: createRuntimeBridgeId("runtime-bridge-planning-checkpoint", strategicPackage.subjectId, "delivery"),
      subjectId: strategicPackage.subjectId,
      sequence: 4,
      label: "Delivery alignment review",
      checkpointKind: "delivery_alignment",
      priority: strategicPackage.kpiStorySequence.priority,
      relatedRefIds: [strategicPackage.kpiStorySequence.sequenceId],
      summary: "Review delivery synchronization posture against KPI story sequence metadata.",
      metadataOnly: true,
    },
    {
      checkpointId: createRuntimeBridgeId("runtime-bridge-planning-checkpoint", strategicPackage.subjectId, "narrative"),
      subjectId: strategicPackage.subjectId,
      sequence: 5,
      label: "Narrative consistency review",
      checkpointKind: "narrative_consistency",
      priority,
      relatedRefIds: strategicPackage.narrativeSections.map((section) => section.sectionId),
      summary: "Review narrative section ordering and strategic theme consistency metadata.",
      metadataOnly: true,
    },
  ];

  return sortByPriorityThenId(checkpoints, (checkpoint) => checkpoint.checkpointId).map((checkpoint, index) => ({
    ...checkpoint,
    sequence: index + 1,
  }));
};

export const summarizeRuntimeBridgeReviewStages = ({
  strategicPackage,
  dependencyPlans = collectRuntimeBridgeDependencyPlans(strategicPackage),
  checkpoints = collectRuntimeBridgePlanningCheckpoints({ strategicPackage }),
}: {
  readonly strategicPackage: RuntimeBridgeStrategicNarrativePackage;
  readonly dependencyPlans?: ReadonlyArray<RuntimeBridgeDependencyPlan>;
  readonly checkpoints?: ReadonlyArray<RuntimeBridgePlanningCheckpoint>;
}): ReadonlyArray<RuntimeBridgeReviewStage> => {
  const stageInputs: ReadonlyArray<{
    readonly suffix: string;
    readonly label: string;
    readonly stageKind: RuntimeBridgeReviewStage["stageKind"];
    readonly priority: RuntimeBridgeCoordinationPriority;
    readonly relatedRefIds: ReadonlyArray<string>;
  }> = [
    {
      suffix: "storyline",
      label: "Executive storyline review",
      stageKind: "executive_storyline_review",
      priority: strategicPackage.storyline.narrativePriority,
      relatedRefIds: strategicPackage.storyline.sectionIds,
    },
    {
      suffix: "objectives",
      label: "Business objective alignment review",
      stageKind: "objective_alignment_review",
      priority: strongestPriority(strategicPackage.businessObjectiveAlignments.map((alignment) => alignment.priority)),
      relatedRefIds: strategicPackage.businessObjectiveAlignments.map((alignment) => alignment.alignmentId),
    },
    {
      suffix: "kpi",
      label: "KPI sequence review",
      stageKind: "kpi_sequence_review",
      priority: strategicPackage.kpiStorySequence.priority,
      relatedRefIds: [strategicPackage.kpiStorySequence.sequenceId],
    },
    {
      suffix: "boardroom",
      label: "Boardroom posture review",
      stageKind: "boardroom_posture_review",
      priority: strategicPackage.storyline.narrativePriority,
      relatedRefIds: [strategicPackage.boardroomPresentation.presentationId],
    },
    {
      suffix: "boundary",
      label: "Execution boundary review",
      stageKind: "boundary_review",
      priority: strongestPriority(summarizeRuntimeBridgeCoordinationPriorities(strategicPackage)),
      relatedRefIds: checkpoints.map((checkpoint) => checkpoint.checkpointId),
    },
  ];

  return sortByPriorityThenId(
    stageInputs.map((stageInput) => {
      const relatedDependencyIds = dependencyPlans
        .filter(
          (dependency) =>
            stageInput.relatedRefIds.includes(dependency.fromId) ||
            stageInput.relatedRefIds.includes(dependency.toId),
        )
        .map((dependency) => dependency.dependencyId);
      const relatedCheckpointIds = checkpoints
        .filter((checkpoint) =>
          checkpoint.relatedRefIds.some((refId) => stageInput.relatedRefIds.includes(refId)),
        )
        .map((checkpoint) => checkpoint.checkpointId);

      return {
        stageId: createRuntimeBridgeId("runtime-bridge-review-stage", strategicPackage.subjectId, stageInput.suffix),
        subjectId: strategicPackage.subjectId,
        sequence: 0,
        label: stageInput.label,
        stageKind: stageInput.stageKind,
        priority: stageInput.priority,
        relatedDependencyIds,
        relatedCheckpointIds,
        summary: `${stageInput.label} is a ${stageInput.priority} metadata review stage with ${relatedDependencyIds.length} dependency references.`,
        metadataOnly: true as const,
      };
    }),
    (stage) => stage.stageId,
  ).map((stage, index) => ({
    ...stage,
    sequence: index + 1,
  }));
};

export const classifyRuntimeBridgeEscalationRoutes = ({
  strategicPackage,
  reviewStages = summarizeRuntimeBridgeReviewStages({ strategicPackage }),
  boundaries = summarizeRuntimeBridgeExecutionBoundaries(strategicPackage),
}: {
  readonly strategicPackage: RuntimeBridgeStrategicNarrativePackage;
  readonly reviewStages?: ReadonlyArray<RuntimeBridgeReviewStage>;
  readonly boundaries?: ReadonlyArray<RuntimeBridgeExecutionBoundary>;
}): ReadonlyArray<RuntimeBridgeEscalationRoute> => {
  const posture: RuntimeBridgeEscalationRoute["posture"] =
    strategicPackage.boardroomPresentation.escalationStoryDensity === "high"
      ? "urgent_review"
      : strategicPackage.boardroomPresentation.escalationStoryDensity === "medium"
        ? "review"
        : strategicPackage.storyline.narrativePriority === "medium"
          ? "watch"
          : "none";
  const priority = strongestPriority([
    strategicPackage.storyline.narrativePriority,
    strategicPackage.kpiStorySequence.priority,
  ]);
  const riskStages = reviewStages.filter(
    (stage) => stage.priority === "critical" || stage.priority === "high" || stage.stageKind === "boundary_review",
  );

  return [
    {
      routeId: createRuntimeBridgeId("runtime-bridge-escalation-route", strategicPackage.subjectId, posture),
      subjectId: strategicPackage.subjectId,
      posture,
      priority,
      audienceRef: strategicPackage.boardroomPresentation.audience,
      reviewStageIds: riskStages.map((stage) => stage.stageId),
      boundaryIds: boundaries.map((boundary) => boundary.boundaryId),
      summary: `Escalation route posture is ${posture} for ${strategicPackage.boardroomPresentation.audience} audience across ${riskStages.length} review stages.`,
      metadataOnly: true,
    },
  ];
};

export const buildRuntimeBridgeDeliverySynchronization = ({
  strategicPackage,
  reviewStages = summarizeRuntimeBridgeReviewStages({ strategicPackage }),
}: {
  readonly strategicPackage: RuntimeBridgeStrategicNarrativePackage;
  readonly reviewStages?: ReadonlyArray<RuntimeBridgeReviewStage>;
}): RuntimeBridgeDeliverySynchronization => {
  const priority = strongestPriority(summarizeRuntimeBridgeCoordinationPriorities(strategicPackage));
  const posture: RuntimeBridgeDeliverySynchronization["posture"] =
    strategicPackage.boardroomPresentation.escalationStoryDensity === "high"
      ? "risk_first"
      : strategicPackage.boardroomPresentation.communicationPosture === "strategic_review"
        ? "parallel_review"
        : strategicPackage.boardroomPresentation.communicationPosture === "brief"
          ? "single_stream"
          : "executive_first";

  return {
    synchronizationId: createRuntimeBridgeId("runtime-bridge-delivery-synchronization", strategicPackage.subjectId),
    subjectId: strategicPackage.subjectId,
    posture,
    priority,
    synchronizedBundleIds: strategicPackage.briefingBundles.map((bundle) => bundle.bundleId),
    synchronizedStageIds: reviewStages.map((stage) => stage.stageId),
    synchronizedNarrativeIds: [
      strategicPackage.storyline.storylineId,
      strategicPackage.kpiStorySequence.sequenceId,
      strategicPackage.boardroomPresentation.presentationId,
    ],
    summary: `Delivery synchronization posture is ${posture} with ${priority} coordination priority across ${reviewStages.length} review stages.`,
    metadataOnly: true,
  };
};

export const buildRuntimeBridgeCoordinationSequence = ({
  strategicPackage,
  reviewStages = summarizeRuntimeBridgeReviewStages({ strategicPackage }),
  checkpoints = collectRuntimeBridgePlanningCheckpoints({ strategicPackage }),
  dependencyPlans = collectRuntimeBridgeDependencyPlans(strategicPackage),
}: {
  readonly strategicPackage: RuntimeBridgeStrategicNarrativePackage;
  readonly reviewStages?: ReadonlyArray<RuntimeBridgeReviewStage>;
  readonly checkpoints?: ReadonlyArray<RuntimeBridgePlanningCheckpoint>;
  readonly dependencyPlans?: ReadonlyArray<RuntimeBridgeDependencyPlan>;
}): RuntimeBridgeCoordinationSequence => {
  const orderedStages = sortByPriorityThenId(reviewStages, (stage) => stage.stageId);
  const orderedCheckpoints = sortByPriorityThenId(checkpoints, (checkpoint) => checkpoint.checkpointId);
  const orderedDependencies = sortByPriorityThenId(dependencyPlans, (dependency) => dependency.dependencyId);
  const priority = strongestPriority([
    ...orderedStages.map((stage) => stage.priority),
    ...orderedCheckpoints.map((checkpoint) => checkpoint.priority),
    ...orderedDependencies.map((dependency) => dependency.priority),
  ]);

  return {
    sequenceId: createRuntimeBridgeId("runtime-bridge-coordination-sequence", strategicPackage.subjectId),
    subjectId: strategicPackage.subjectId,
    priority,
    orderedStageIds: orderedStages.map((stage) => stage.stageId),
    orderedCheckpointIds: orderedCheckpoints.map((checkpoint) => checkpoint.checkpointId),
    orderedDependencyIds: orderedDependencies.map((dependency) => dependency.dependencyId),
    summary: `Coordination sequence describes ${orderedStages.length} review stages, ${orderedCheckpoints.length} checkpoints, and ${orderedDependencies.length} dependency references.`,
    metadataOnly: true,
  };
};

export const buildRuntimeBridgeOrchestrationNarrative = ({
  strategicPackage,
  coordinationSequence,
  deliverySynchronization,
  escalationRoutes,
  executionBoundaries,
}: {
  readonly strategicPackage: RuntimeBridgeStrategicNarrativePackage;
  readonly coordinationSequence: RuntimeBridgeCoordinationSequence;
  readonly deliverySynchronization: RuntimeBridgeDeliverySynchronization;
  readonly escalationRoutes: ReadonlyArray<RuntimeBridgeEscalationRoute>;
  readonly executionBoundaries: ReadonlyArray<RuntimeBridgeExecutionBoundary>;
}): RuntimeBridgeOrchestrationNarrative => ({
  narrativeId: createRuntimeBridgeId("runtime-bridge-orchestration-narrative", strategicPackage.subjectId),
  subjectId: strategicPackage.subjectId,
  headline: "Intelligence planning metadata is ready for human review",
  summary: `Orchestration planning narrative describes ${coordinationSequence.priority} coordination priority, ${deliverySynchronization.posture} synchronization posture, ${escalationRoutes.length} escalation route descriptors, and ${executionBoundaries.length} metadata-only boundaries.`,
  coordinationSequenceId: coordinationSequence.sequenceId,
  synchronizationId: deliverySynchronization.synchronizationId,
  escalationRouteIds: escalationRoutes.map((route) => route.routeId),
  boundaryIds: executionBoundaries.map((boundary) => boundary.boundaryId),
  metadataOnly: true,
});

export const buildRuntimeBridgeOrchestrationPlan = (
  strategicPackage: RuntimeBridgeStrategicNarrativePackage,
): RuntimeBridgeOrchestrationPlan => {
  const executionBoundaries = summarizeRuntimeBridgeExecutionBoundaries(strategicPackage);
  const dependencyPlans = collectRuntimeBridgeDependencyPlans(strategicPackage);
  const planningCheckpoints = collectRuntimeBridgePlanningCheckpoints({
    strategicPackage,
    boundaries: executionBoundaries,
  });
  const reviewStages = summarizeRuntimeBridgeReviewStages({
    strategicPackage,
    dependencyPlans,
    checkpoints: planningCheckpoints,
  });
  const escalationRoutes = classifyRuntimeBridgeEscalationRoutes({
    strategicPackage,
    reviewStages,
    boundaries: executionBoundaries,
  });
  const deliverySynchronization = buildRuntimeBridgeDeliverySynchronization({
    strategicPackage,
    reviewStages,
  });
  const coordinationSequence = buildRuntimeBridgeCoordinationSequence({
    strategicPackage,
    reviewStages,
    checkpoints: planningCheckpoints,
    dependencyPlans,
  });
  const orchestrationNarrative = buildRuntimeBridgeOrchestrationNarrative({
    strategicPackage,
    coordinationSequence,
    deliverySynchronization,
    escalationRoutes,
    executionBoundaries,
  });

  return {
    planId: createRuntimeBridgeId("runtime-bridge-orchestration-plan", strategicPackage.subjectId),
    subjectId: strategicPackage.subjectId,
    coordinationSequence,
    dependencyPlans,
    reviewStages,
    escalationRoutes,
    deliverySynchronization,
    executionBoundaries,
    planningCheckpoints,
    coordinationPriorities: summarizeRuntimeBridgeCoordinationPriorities(strategicPackage),
    orchestrationNarrative,
    sourceStrategicNarrativePackageId: strategicPackage.packageId,
    metadataOnly: true,
  };
};
