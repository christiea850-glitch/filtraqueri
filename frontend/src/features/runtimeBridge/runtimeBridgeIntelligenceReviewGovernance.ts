import type { MetadataOnlyBoundaryContract } from "../governance/boundaryTypes";
import type {
  RuntimeBridgeCoordinationPriority,
  RuntimeBridgeEscalationRoute,
  RuntimeBridgeOrchestrationPlan,
} from "./runtimeBridgeIntelligenceOrchestrationPlanning";
import { createRuntimeBridgeId } from "./runtimeBridgeIds";
import type { RuntimeBridgeSourceModuleReference } from "./runtimeBridgeTypes";

export type RuntimeBridgeReviewPriority = RuntimeBridgeCoordinationPriority;

export type RuntimeBridgeApprovalPosture = {
  readonly postureId: string;
  readonly subjectId: string;
  readonly posture:
    | "approval_not_performed"
    | "human_review_described"
    | "governance_review_described"
    | "urgent_review_described";
  readonly priority: RuntimeBridgeReviewPriority;
  readonly canApprove: false;
  readonly canDeny: false;
  readonly canMutatePermissions: false;
  readonly reviewStageIds: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeReviewBoundary = {
  readonly boundaryId: string;
  readonly subjectId: string;
  readonly label: string;
  readonly boundaryKind:
    | "metadata_only"
    | "no_permission_enforcement"
    | "no_workflow_execution"
    | "no_runtime_coordination";
  readonly protectedSurfaceRefs: ReadonlyArray<string>;
  readonly canApprove: false;
  readonly canEnforcePermissions: false;
  readonly canExecuteWorkflow: false;
  readonly canPersist: false;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeGovernanceCheckpoint = {
  readonly checkpointId: string;
  readonly subjectId: string;
  readonly sequence: number;
  readonly label: string;
  readonly checkpointKind:
    | "approval_posture"
    | "human_review_sequence"
    | "escalation_review"
    | "compliance_posture"
    | "boundary_review";
  readonly priority: RuntimeBridgeReviewPriority;
  readonly relatedReviewStageIds: ReadonlyArray<string>;
  readonly relatedBoundaryIds: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeGovernanceObservation = {
  readonly observationId: string;
  readonly subjectId: string;
  readonly priority: RuntimeBridgeReviewPriority;
  readonly theme:
    | "approval_posture"
    | "review_density"
    | "escalation"
    | "compliance"
    | "audit"
    | "boundary";
  readonly label: string;
  readonly relatedCheckpointIds: ReadonlyArray<string>;
  readonly relatedStageIds: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeEscalationReview = {
  readonly escalationReviewId: string;
  readonly subjectId: string;
  readonly posture: "none" | "watch" | "review" | "urgent_review";
  readonly priority: RuntimeBridgeReviewPriority;
  readonly routeIds: ReadonlyArray<string>;
  readonly reviewStageIds: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeCompliancePosture = {
  readonly compliancePostureId: string;
  readonly subjectId: string;
  readonly posture: "metadata_compliant" | "review_recommended" | "urgent_review_recommended";
  readonly priority: RuntimeBridgeReviewPriority;
  readonly boundaryIds: ReadonlyArray<string>;
  readonly checkpointIds: ReadonlyArray<string>;
  readonly observationIds: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeHumanReviewSequence = {
  readonly sequenceId: string;
  readonly subjectId: string;
  readonly priority: RuntimeBridgeReviewPriority;
  readonly orderedReviewStageIds: ReadonlyArray<string>;
  readonly orderedCheckpointIds: ReadonlyArray<string>;
  readonly orderedObservationIds: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeAuditNarrative = {
  readonly narrativeId: string;
  readonly subjectId: string;
  readonly headline: string;
  readonly summary: string;
  readonly approvalPostureId: string;
  readonly compliancePostureId: string;
  readonly escalationReviewId: string;
  readonly observationIds: ReadonlyArray<string>;
  readonly boundaryIds: ReadonlyArray<string>;
  readonly metadataOnly: true;
};

export type RuntimeBridgeReviewGovernancePlan = {
  readonly planId: string;
  readonly subjectId: string;
  readonly approvalPosture: RuntimeBridgeApprovalPosture;
  readonly humanReviewSequence: RuntimeBridgeHumanReviewSequence;
  readonly governanceCheckpoints: ReadonlyArray<RuntimeBridgeGovernanceCheckpoint>;
  readonly escalationReview: RuntimeBridgeEscalationReview;
  readonly auditNarrative: RuntimeBridgeAuditNarrative;
  readonly compliancePosture: RuntimeBridgeCompliancePosture;
  readonly reviewPriorities: ReadonlyArray<RuntimeBridgeReviewPriority>;
  readonly governanceObservations: ReadonlyArray<RuntimeBridgeGovernanceObservation>;
  readonly reviewBoundaries: ReadonlyArray<RuntimeBridgeReviewBoundary>;
  readonly sourceOrchestrationPlanId: string;
  readonly metadataOnly: true;
};

export const runtimeBridgeIntelligenceReviewGovernanceGovernance = {
  mode: "metadata_only",
  contractId: "runtime-bridge-intelligence-review-governance",
  label: "Runtime bridge intelligence review governance",
  description:
    "Metadata-only review-chain descriptors, approval posture summaries, human-review sequencing, governance checkpoints, escalation review intelligence, audit narratives, and compliance posture metadata.",
  confidence: "high",
  canExecute: false,
  canMutateWorkspace: false,
  canCallBackend: false,
  lineageRefs: [
    "runtime-bridge-review-governance-plan",
    "runtime-bridge-approval-posture",
    "runtime-bridge-human-review-sequence",
    "runtime-bridge-governance-checkpoint",
    "runtime-bridge-escalation-review",
    "runtime-bridge-audit-narrative",
    "runtime-bridge-compliance-posture",
    "runtime-bridge-governance-observation",
    "runtime-bridge-review-boundary",
  ],
} satisfies MetadataOnlyBoundaryContract;

export const runtimeBridgeIntelligenceReviewGovernanceSourceModule: RuntimeBridgeSourceModuleReference = {
  moduleId: "runtime-bridge-intelligence-review-governance",
  modulePath: "frontend/src/features/runtimeBridge/runtimeBridgeIntelligenceReviewGovernance.ts",
  capabilityMode: "metadata_only",
  label: "Runtime bridge intelligence review governance",
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

const priorityScore = (priority: RuntimeBridgeReviewPriority) => {
  if (priority === "critical") return 4;
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  return 1;
};

const sortPriorities = (
  priorities: ReadonlyArray<RuntimeBridgeReviewPriority>,
): RuntimeBridgeReviewPriority[] =>
  uniqueStable(priorities).sort((left, right) => {
    const priorityDelta = priorityScore(right) - priorityScore(left);
    if (priorityDelta !== 0) return priorityDelta;
    return left.localeCompare(right);
  });

const strongestPriority = (
  priorities: ReadonlyArray<RuntimeBridgeReviewPriority>,
): RuntimeBridgeReviewPriority => sortPriorities(priorities)[0] || "low";

const sortByPriorityThenId = <T extends { readonly priority: RuntimeBridgeReviewPriority }>(
  items: ReadonlyArray<T>,
  getId: (item: T) => string,
): T[] =>
  [...items].sort((left, right) => {
    const priorityDelta = priorityScore(right.priority) - priorityScore(left.priority);
    if (priorityDelta !== 0) return priorityDelta;
    return getId(left).localeCompare(getId(right));
  });

const escalationPriority = (
  routes: ReadonlyArray<RuntimeBridgeEscalationRoute>,
): RuntimeBridgeReviewPriority => strongestPriority(routes.map((route) => route.priority));

const highestEscalationPosture = (
  routes: ReadonlyArray<RuntimeBridgeEscalationRoute>,
): RuntimeBridgeEscalationReview["posture"] => {
  if (routes.some((route) => route.posture === "urgent_review")) return "urgent_review";
  if (routes.some((route) => route.posture === "review")) return "review";
  if (routes.some((route) => route.posture === "watch")) return "watch";
  return "none";
};

export const summarizeRuntimeBridgeReviewPriorities = (
  orchestrationPlan: RuntimeBridgeOrchestrationPlan,
): ReadonlyArray<RuntimeBridgeReviewPriority> =>
  sortPriorities([
    ...orchestrationPlan.coordinationPriorities,
    orchestrationPlan.coordinationSequence.priority,
    orchestrationPlan.deliverySynchronization.priority,
    ...orchestrationPlan.reviewStages.map((stage) => stage.priority),
    ...orchestrationPlan.planningCheckpoints.map((checkpoint) => checkpoint.priority),
    ...orchestrationPlan.escalationRoutes.map((route) => route.priority),
  ]);

export const summarizeRuntimeBridgeReviewBoundaries = (
  orchestrationPlan: RuntimeBridgeOrchestrationPlan,
): ReadonlyArray<RuntimeBridgeReviewBoundary> =>
  orchestrationPlan.executionBoundaries.map((boundary) => ({
    boundaryId: createRuntimeBridgeId("runtime-bridge-review-boundary", boundary.boundaryId),
    subjectId: orchestrationPlan.subjectId,
    label: boundary.label,
    boundaryKind: "metadata_only" as const,
    protectedSurfaceRefs: boundary.protectedSurfaceRefs,
    canApprove: false,
    canEnforcePermissions: false,
    canExecuteWorkflow: false,
    canPersist: false,
    summary: `Review boundary preserves ${boundary.allowedMode} mode and cannot approve, enforce permissions, execute workflows, or persist state.`,
    metadataOnly: true as const,
  }));

export const summarizeRuntimeBridgeApprovalPosture = (
  orchestrationPlan: RuntimeBridgeOrchestrationPlan,
): RuntimeBridgeApprovalPosture => {
  const priority = strongestPriority(summarizeRuntimeBridgeReviewPriorities(orchestrationPlan));
  const escalationPosture = highestEscalationPosture(orchestrationPlan.escalationRoutes);
  const posture: RuntimeBridgeApprovalPosture["posture"] =
    escalationPosture === "urgent_review"
      ? "urgent_review_described"
      : escalationPosture === "review"
        ? "governance_review_described"
        : orchestrationPlan.reviewStages.length > 0
          ? "human_review_described"
          : "approval_not_performed";

  return {
    postureId: createRuntimeBridgeId("runtime-bridge-approval-posture", orchestrationPlan.subjectId),
    subjectId: orchestrationPlan.subjectId,
    posture,
    priority,
    canApprove: false,
    canDeny: false,
    canMutatePermissions: false,
    reviewStageIds: orchestrationPlan.reviewStages.map((stage) => stage.stageId),
    summary: `Approval posture is descriptive only: ${posture} with ${priority} review priority.`,
    metadataOnly: true,
  };
};

export const collectRuntimeBridgeGovernanceCheckpoints = ({
  orchestrationPlan,
  reviewBoundaries = summarizeRuntimeBridgeReviewBoundaries(orchestrationPlan),
}: {
  readonly orchestrationPlan: RuntimeBridgeOrchestrationPlan;
  readonly reviewBoundaries?: ReadonlyArray<RuntimeBridgeReviewBoundary>;
}): ReadonlyArray<RuntimeBridgeGovernanceCheckpoint> => {
  const priority = strongestPriority(summarizeRuntimeBridgeReviewPriorities(orchestrationPlan));
  const stageIds = orchestrationPlan.reviewStages.map((stage) => stage.stageId);
  const boundaryIds = reviewBoundaries.map((boundary) => boundary.boundaryId);
  const checkpoints: RuntimeBridgeGovernanceCheckpoint[] = [
    {
      checkpointId: createRuntimeBridgeId("runtime-bridge-governance-checkpoint", orchestrationPlan.subjectId, "approval"),
      subjectId: orchestrationPlan.subjectId,
      sequence: 1,
      label: "Approval posture descriptor review",
      checkpointKind: "approval_posture",
      priority,
      relatedReviewStageIds: stageIds,
      relatedBoundaryIds: boundaryIds,
      summary: "Review approval posture descriptors without approving, denying, or enforcing behavior.",
      metadataOnly: true,
    },
    {
      checkpointId: createRuntimeBridgeId("runtime-bridge-governance-checkpoint", orchestrationPlan.subjectId, "human-review"),
      subjectId: orchestrationPlan.subjectId,
      sequence: 2,
      label: "Human-review sequence descriptor review",
      checkpointKind: "human_review_sequence",
      priority,
      relatedReviewStageIds: orchestrationPlan.coordinationSequence.orderedStageIds,
      relatedBoundaryIds: boundaryIds,
      summary: "Review ordered human-review metadata from the coordination sequence.",
      metadataOnly: true,
    },
    {
      checkpointId: createRuntimeBridgeId("runtime-bridge-governance-checkpoint", orchestrationPlan.subjectId, "escalation"),
      subjectId: orchestrationPlan.subjectId,
      sequence: 3,
      label: "Escalation review posture",
      checkpointKind: "escalation_review",
      priority: escalationPriority(orchestrationPlan.escalationRoutes),
      relatedReviewStageIds: uniqueStable(
        orchestrationPlan.escalationRoutes.flatMap((route) => route.reviewStageIds),
      ),
      relatedBoundaryIds: boundaryIds,
      summary: "Review escalation route posture metadata without routing execution.",
      metadataOnly: true,
    },
    {
      checkpointId: createRuntimeBridgeId("runtime-bridge-governance-checkpoint", orchestrationPlan.subjectId, "compliance"),
      subjectId: orchestrationPlan.subjectId,
      sequence: 4,
      label: "Compliance posture descriptor review",
      checkpointKind: "compliance_posture",
      priority,
      relatedReviewStageIds: stageIds,
      relatedBoundaryIds: boundaryIds,
      summary: "Review compliance posture metadata against metadata-only boundaries.",
      metadataOnly: true,
    },
    {
      checkpointId: createRuntimeBridgeId("runtime-bridge-governance-checkpoint", orchestrationPlan.subjectId, "boundary"),
      subjectId: orchestrationPlan.subjectId,
      sequence: 5,
      label: "Review boundary descriptor review",
      checkpointKind: "boundary_review",
      priority,
      relatedReviewStageIds: stageIds,
      relatedBoundaryIds: boundaryIds,
      summary: "Review protected-surface and non-execution boundary descriptors.",
      metadataOnly: true,
    },
  ];

  return sortByPriorityThenId(checkpoints, (checkpoint) => checkpoint.checkpointId).map((checkpoint, index) => ({
    ...checkpoint,
    sequence: index + 1,
  }));
};

export const classifyRuntimeBridgeEscalationReview = (
  orchestrationPlan: RuntimeBridgeOrchestrationPlan,
): RuntimeBridgeEscalationReview => {
  const posture = highestEscalationPosture(orchestrationPlan.escalationRoutes);
  const priority = escalationPriority(orchestrationPlan.escalationRoutes);
  const reviewStageIds = uniqueStable(
    orchestrationPlan.escalationRoutes.flatMap((route) => route.reviewStageIds),
  );

  return {
    escalationReviewId: createRuntimeBridgeId("runtime-bridge-escalation-review", orchestrationPlan.subjectId),
    subjectId: orchestrationPlan.subjectId,
    posture,
    priority,
    routeIds: orchestrationPlan.escalationRoutes.map((route) => route.routeId),
    reviewStageIds,
    summary: `Escalation review posture is ${posture} with ${priority} priority across ${reviewStageIds.length} review stages.`,
    metadataOnly: true,
  };
};

export const collectRuntimeBridgeGovernanceObservations = ({
  orchestrationPlan,
  checkpoints = collectRuntimeBridgeGovernanceCheckpoints({ orchestrationPlan }),
}: {
  readonly orchestrationPlan: RuntimeBridgeOrchestrationPlan;
  readonly checkpoints?: ReadonlyArray<RuntimeBridgeGovernanceCheckpoint>;
}): ReadonlyArray<RuntimeBridgeGovernanceObservation> => {
  const priority = strongestPriority(summarizeRuntimeBridgeReviewPriorities(orchestrationPlan));
  const checkpointIds = checkpoints.map((checkpoint) => checkpoint.checkpointId);
  const stageIds = orchestrationPlan.reviewStages.map((stage) => stage.stageId);

  return sortByPriorityThenId(
    [
      {
        observationId: createRuntimeBridgeId("runtime-bridge-governance-observation", orchestrationPlan.subjectId, "approval"),
        subjectId: orchestrationPlan.subjectId,
        priority,
        theme: "approval_posture" as const,
        label: "Approval posture is descriptive",
        relatedCheckpointIds: checkpointIds,
        relatedStageIds: stageIds,
        summary: "Approval metadata describes review posture only and cannot approve, deny, or mutate permissions.",
        metadataOnly: true as const,
      },
      {
        observationId: createRuntimeBridgeId("runtime-bridge-governance-observation", orchestrationPlan.subjectId, "density"),
        subjectId: orchestrationPlan.subjectId,
        priority,
        theme: "review_density" as const,
        label: "Governance review density",
        relatedCheckpointIds: checkpointIds,
        relatedStageIds: stageIds,
        summary: `Governance review density includes ${orchestrationPlan.reviewStages.length} review stages and ${checkpoints.length} governance checkpoints.`,
        metadataOnly: true as const,
      },
      {
        observationId: createRuntimeBridgeId("runtime-bridge-governance-observation", orchestrationPlan.subjectId, "escalation"),
        subjectId: orchestrationPlan.subjectId,
        priority: escalationPriority(orchestrationPlan.escalationRoutes),
        theme: "escalation" as const,
        label: "Escalation review intelligence",
        relatedCheckpointIds: checkpointIds,
        relatedStageIds: uniqueStable(
          orchestrationPlan.escalationRoutes.flatMap((route) => route.reviewStageIds),
        ),
        summary: `Escalation review metadata includes ${orchestrationPlan.escalationRoutes.length} route descriptors.`,
        metadataOnly: true as const,
      },
      {
        observationId: createRuntimeBridgeId("runtime-bridge-governance-observation", orchestrationPlan.subjectId, "boundary"),
        subjectId: orchestrationPlan.subjectId,
        priority,
        theme: "boundary" as const,
        label: "Review boundary metadata",
        relatedCheckpointIds: checkpointIds,
        relatedStageIds: stageIds,
        summary: `Review boundary metadata references ${orchestrationPlan.executionBoundaries.length} execution boundary descriptors.`,
        metadataOnly: true as const,
      },
    ],
    (observation) => observation.observationId,
  );
};

export const summarizeRuntimeBridgeCompliancePosture = ({
  orchestrationPlan,
  reviewBoundaries = summarizeRuntimeBridgeReviewBoundaries(orchestrationPlan),
  checkpoints = collectRuntimeBridgeGovernanceCheckpoints({ orchestrationPlan, reviewBoundaries }),
  observations = collectRuntimeBridgeGovernanceObservations({ orchestrationPlan, checkpoints }),
}: {
  readonly orchestrationPlan: RuntimeBridgeOrchestrationPlan;
  readonly reviewBoundaries?: ReadonlyArray<RuntimeBridgeReviewBoundary>;
  readonly checkpoints?: ReadonlyArray<RuntimeBridgeGovernanceCheckpoint>;
  readonly observations?: ReadonlyArray<RuntimeBridgeGovernanceObservation>;
}): RuntimeBridgeCompliancePosture => {
  const priority = strongestPriority(summarizeRuntimeBridgeReviewPriorities(orchestrationPlan));
  const escalationPosture = highestEscalationPosture(orchestrationPlan.escalationRoutes);
  const posture: RuntimeBridgeCompliancePosture["posture"] =
    escalationPosture === "urgent_review"
      ? "urgent_review_recommended"
      : escalationPosture === "review" || priority === "high" || priority === "critical"
        ? "review_recommended"
        : "metadata_compliant";

  return {
    compliancePostureId: createRuntimeBridgeId("runtime-bridge-compliance-posture", orchestrationPlan.subjectId),
    subjectId: orchestrationPlan.subjectId,
    posture,
    priority,
    boundaryIds: reviewBoundaries.map((boundary) => boundary.boundaryId),
    checkpointIds: checkpoints.map((checkpoint) => checkpoint.checkpointId),
    observationIds: observations.map((observation) => observation.observationId),
    summary: `Compliance posture is ${posture} from metadata-only review boundaries, ${checkpoints.length} checkpoints, and ${observations.length} observations.`,
    metadataOnly: true,
  };
};

export const buildRuntimeBridgeHumanReviewSequence = ({
  orchestrationPlan,
  checkpoints = collectRuntimeBridgeGovernanceCheckpoints({ orchestrationPlan }),
  observations = collectRuntimeBridgeGovernanceObservations({ orchestrationPlan, checkpoints }),
}: {
  readonly orchestrationPlan: RuntimeBridgeOrchestrationPlan;
  readonly checkpoints?: ReadonlyArray<RuntimeBridgeGovernanceCheckpoint>;
  readonly observations?: ReadonlyArray<RuntimeBridgeGovernanceObservation>;
}): RuntimeBridgeHumanReviewSequence => {
  const orderedStages = sortByPriorityThenId(orchestrationPlan.reviewStages, (stage) => stage.stageId);
  const orderedCheckpoints = sortByPriorityThenId(checkpoints, (checkpoint) => checkpoint.checkpointId);
  const orderedObservations = sortByPriorityThenId(observations, (observation) => observation.observationId);
  const priority = strongestPriority([
    ...orderedStages.map((stage) => stage.priority),
    ...orderedCheckpoints.map((checkpoint) => checkpoint.priority),
    ...orderedObservations.map((observation) => observation.priority),
  ]);

  return {
    sequenceId: createRuntimeBridgeId("runtime-bridge-human-review-sequence", orchestrationPlan.subjectId),
    subjectId: orchestrationPlan.subjectId,
    priority,
    orderedReviewStageIds: orderedStages.map((stage) => stage.stageId),
    orderedCheckpointIds: orderedCheckpoints.map((checkpoint) => checkpoint.checkpointId),
    orderedObservationIds: orderedObservations.map((observation) => observation.observationId),
    summary: `Human-review sequence describes ${orderedStages.length} review stages, ${orderedCheckpoints.length} checkpoints, and ${orderedObservations.length} observations.`,
    metadataOnly: true,
  };
};

export const summarizeRuntimeBridgeAuditNarrative = ({
  orchestrationPlan,
  approvalPosture,
  compliancePosture,
  escalationReview,
  observations,
  reviewBoundaries,
}: {
  readonly orchestrationPlan: RuntimeBridgeOrchestrationPlan;
  readonly approvalPosture: RuntimeBridgeApprovalPosture;
  readonly compliancePosture: RuntimeBridgeCompliancePosture;
  readonly escalationReview: RuntimeBridgeEscalationReview;
  readonly observations: ReadonlyArray<RuntimeBridgeGovernanceObservation>;
  readonly reviewBoundaries: ReadonlyArray<RuntimeBridgeReviewBoundary>;
}): RuntimeBridgeAuditNarrative => ({
  narrativeId: createRuntimeBridgeId("runtime-bridge-audit-narrative", orchestrationPlan.subjectId),
  subjectId: orchestrationPlan.subjectId,
  headline: "Review governance metadata is ready for human inspection",
  summary: `Audit-review narrative describes ${approvalPosture.posture}, ${compliancePosture.posture}, ${escalationReview.posture} escalation review posture, ${observations.length} governance observations, and ${reviewBoundaries.length} review boundaries.`,
  approvalPostureId: approvalPosture.postureId,
  compliancePostureId: compliancePosture.compliancePostureId,
  escalationReviewId: escalationReview.escalationReviewId,
  observationIds: observations.map((observation) => observation.observationId),
  boundaryIds: reviewBoundaries.map((boundary) => boundary.boundaryId),
  metadataOnly: true,
});

export const buildRuntimeBridgeReviewGovernancePlan = (
  orchestrationPlan: RuntimeBridgeOrchestrationPlan,
): RuntimeBridgeReviewGovernancePlan => {
  const reviewBoundaries = summarizeRuntimeBridgeReviewBoundaries(orchestrationPlan);
  const governanceCheckpoints = collectRuntimeBridgeGovernanceCheckpoints({
    orchestrationPlan,
    reviewBoundaries,
  });
  const governanceObservations = collectRuntimeBridgeGovernanceObservations({
    orchestrationPlan,
    checkpoints: governanceCheckpoints,
  });
  const approvalPosture = summarizeRuntimeBridgeApprovalPosture(orchestrationPlan);
  const escalationReview = classifyRuntimeBridgeEscalationReview(orchestrationPlan);
  const compliancePosture = summarizeRuntimeBridgeCompliancePosture({
    orchestrationPlan,
    reviewBoundaries,
    checkpoints: governanceCheckpoints,
    observations: governanceObservations,
  });
  const humanReviewSequence = buildRuntimeBridgeHumanReviewSequence({
    orchestrationPlan,
    checkpoints: governanceCheckpoints,
    observations: governanceObservations,
  });
  const auditNarrative = summarizeRuntimeBridgeAuditNarrative({
    orchestrationPlan,
    approvalPosture,
    compliancePosture,
    escalationReview,
    observations: governanceObservations,
    reviewBoundaries,
  });

  return {
    planId: createRuntimeBridgeId("runtime-bridge-review-governance-plan", orchestrationPlan.subjectId),
    subjectId: orchestrationPlan.subjectId,
    approvalPosture,
    humanReviewSequence,
    governanceCheckpoints,
    escalationReview,
    auditNarrative,
    compliancePosture,
    reviewPriorities: summarizeRuntimeBridgeReviewPriorities(orchestrationPlan),
    governanceObservations,
    reviewBoundaries,
    sourceOrchestrationPlanId: orchestrationPlan.planId,
    metadataOnly: true,
  };
};
