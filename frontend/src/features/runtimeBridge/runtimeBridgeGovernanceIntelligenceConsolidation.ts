import type { MetadataOnlyBoundaryContract } from "../governance/boundaryTypes";
import type {
  RuntimeBridgeGovernanceObservation,
  RuntimeBridgeReviewGovernancePlan,
  RuntimeBridgeReviewPriority,
} from "./runtimeBridgeIntelligenceReviewGovernance";
import { createRuntimeBridgeId } from "./runtimeBridgeIds";
import type { RuntimeBridgeSourceModuleReference } from "./runtimeBridgeTypes";

export type RuntimeBridgeGovernancePriority = RuntimeBridgeReviewPriority;

export type RuntimeBridgeGovernanceSignal = {
  readonly signalId: string;
  readonly subjectId: string;
  readonly priority: RuntimeBridgeGovernancePriority;
  readonly signalKind:
    | "approval_posture"
    | "review_alignment"
    | "escalation_posture"
    | "compliance_posture"
    | "audit_readiness"
    | "boundary_coverage";
  readonly label: string;
  readonly sourceRefIds: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeGovernanceAlignmentSummary = {
  readonly alignmentId: string;
  readonly subjectId: string;
  readonly priority: RuntimeBridgeGovernancePriority;
  readonly posture: "aligned" | "review_aligned" | "urgent_review_aligned";
  readonly reviewStageCount: number;
  readonly checkpointCount: number;
  readonly boundaryCount: number;
  readonly sourceSignalIds: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeEscalationPostureSummary = {
  readonly escalationSummaryId: string;
  readonly subjectId: string;
  readonly posture: "none" | "watch" | "review" | "urgent_review";
  readonly priority: RuntimeBridgeGovernancePriority;
  readonly routeIds: ReadonlyArray<string>;
  readonly reviewStageIds: ReadonlyArray<string>;
  readonly sourceSignalIds: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeCompliancePostureSummary = {
  readonly complianceSummaryId: string;
  readonly subjectId: string;
  readonly posture: "metadata_compliant" | "review_recommended" | "urgent_review_recommended";
  readonly priority: RuntimeBridgeGovernancePriority;
  readonly boundaryIds: ReadonlyArray<string>;
  readonly checkpointIds: ReadonlyArray<string>;
  readonly sourceSignalIds: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeAuditReadinessSummary = {
  readonly auditReadinessId: string;
  readonly subjectId: string;
  readonly readiness: "ready" | "review_ready" | "urgent_review_ready";
  readonly priority: RuntimeBridgeGovernancePriority;
  readonly narrativeIds: ReadonlyArray<string>;
  readonly observationIds: ReadonlyArray<string>;
  readonly checkpointIds: ReadonlyArray<string>;
  readonly sourceSignalIds: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeGovernanceReviewMap = {
  readonly reviewMapId: string;
  readonly subjectId: string;
  readonly orderedCheckpointIds: ReadonlyArray<string>;
  readonly orderedReviewStageIds: ReadonlyArray<string>;
  readonly orderedObservationIds: ReadonlyArray<string>;
  readonly boundaryIds: ReadonlyArray<string>;
  readonly signalIds: ReadonlyArray<string>;
  readonly priority: RuntimeBridgeGovernancePriority;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeGovernanceNarrativeBundle = {
  readonly bundleId: string;
  readonly subjectId: string;
  readonly headline: string;
  readonly priority: RuntimeBridgeGovernancePriority;
  readonly auditNarrativeId: string;
  readonly alignmentSummaryId: string;
  readonly escalationSummaryId: string;
  readonly complianceSummaryId: string;
  readonly auditReadinessId: string;
  readonly signalIds: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeGovernanceConsolidation = {
  readonly consolidationId: string;
  readonly subjectId: string;
  readonly priority: RuntimeBridgeGovernancePriority;
  readonly signalIds: ReadonlyArray<string>;
  readonly alignmentSummaryId: string;
  readonly escalationSummaryId: string;
  readonly complianceSummaryId: string;
  readonly auditReadinessId: string;
  readonly reviewMapId: string;
  readonly narrativeBundleId: string;
  readonly sourceReviewGovernancePlanId: string;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeGovernanceIntelligenceManifest = {
  readonly manifestId: string;
  readonly subjectId: string;
  readonly consolidation: RuntimeBridgeGovernanceConsolidation;
  readonly alignmentSummary: RuntimeBridgeGovernanceAlignmentSummary;
  readonly escalationPostureSummary: RuntimeBridgeEscalationPostureSummary;
  readonly compliancePostureSummary: RuntimeBridgeCompliancePostureSummary;
  readonly auditReadinessSummary: RuntimeBridgeAuditReadinessSummary;
  readonly narrativeBundle: RuntimeBridgeGovernanceNarrativeBundle;
  readonly governanceSignals: ReadonlyArray<RuntimeBridgeGovernanceSignal>;
  readonly governancePriorities: ReadonlyArray<RuntimeBridgeGovernancePriority>;
  readonly reviewMap: RuntimeBridgeGovernanceReviewMap;
  readonly sourceReviewGovernancePlanId: string;
  readonly metadataOnly: true;
};

export const runtimeBridgeGovernanceIntelligenceConsolidationGovernance = {
  mode: "metadata_only",
  contractId: "runtime-bridge-governance-intelligence-consolidation",
  label: "Runtime bridge governance intelligence consolidation",
  description:
    "Metadata-only consolidation of governance review posture, escalation posture, compliance posture, orchestration planning alignment, audit readiness, governance signals, and audit-ready narratives.",
  confidence: "high",
  canExecute: false,
  canMutateWorkspace: false,
  canCallBackend: false,
  lineageRefs: [
    "runtime-bridge-governance-intelligence-manifest",
    "runtime-bridge-governance-consolidation",
    "runtime-bridge-governance-alignment-summary",
    "runtime-bridge-escalation-posture-summary",
    "runtime-bridge-compliance-posture-summary",
    "runtime-bridge-audit-readiness-summary",
    "runtime-bridge-governance-narrative-bundle",
    "runtime-bridge-governance-signal",
    "runtime-bridge-governance-review-map",
  ],
} satisfies MetadataOnlyBoundaryContract;

export const runtimeBridgeGovernanceIntelligenceConsolidationSourceModule: RuntimeBridgeSourceModuleReference = {
  moduleId: "runtime-bridge-governance-intelligence-consolidation",
  modulePath: "frontend/src/features/runtimeBridge/runtimeBridgeGovernanceIntelligenceConsolidation.ts",
  capabilityMode: "metadata_only",
  label: "Runtime bridge governance intelligence consolidation",
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

const priorityScore = (priority: RuntimeBridgeGovernancePriority) => {
  if (priority === "critical") return 4;
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  return 1;
};

const sortPriorities = (
  priorities: ReadonlyArray<RuntimeBridgeGovernancePriority>,
): RuntimeBridgeGovernancePriority[] =>
  uniqueStable(priorities).sort((left, right) => {
    const priorityDelta = priorityScore(right) - priorityScore(left);
    if (priorityDelta !== 0) return priorityDelta;
    return left.localeCompare(right);
  });

const strongestPriority = (
  priorities: ReadonlyArray<RuntimeBridgeGovernancePriority>,
): RuntimeBridgeGovernancePriority => sortPriorities(priorities)[0] || "low";

const sortByPriorityThenId = <T extends { readonly priority: RuntimeBridgeGovernancePriority }>(
  items: ReadonlyArray<T>,
  getId: (item: T) => string,
): T[] =>
  [...items].sort((left, right) => {
    const priorityDelta = priorityScore(right.priority) - priorityScore(left.priority);
    if (priorityDelta !== 0) return priorityDelta;
    return getId(left).localeCompare(getId(right));
  });

const observationSignalKind = (
  observation: RuntimeBridgeGovernanceObservation,
): RuntimeBridgeGovernanceSignal["signalKind"] => {
  if (observation.theme === "approval_posture") return "approval_posture";
  if (observation.theme === "review_density") return "review_alignment";
  if (observation.theme === "escalation") return "escalation_posture";
  if (observation.theme === "compliance") return "compliance_posture";
  if (observation.theme === "audit") return "audit_readiness";
  return "boundary_coverage";
};

export const summarizeRuntimeBridgeGovernancePriorities = (
  reviewPlan: RuntimeBridgeReviewGovernancePlan,
): ReadonlyArray<RuntimeBridgeGovernancePriority> =>
  sortPriorities([
    ...reviewPlan.reviewPriorities,
    reviewPlan.approvalPosture.priority,
    reviewPlan.humanReviewSequence.priority,
    reviewPlan.escalationReview.priority,
    reviewPlan.compliancePosture.priority,
    ...reviewPlan.governanceCheckpoints.map((checkpoint) => checkpoint.priority),
    ...reviewPlan.governanceObservations.map((observation) => observation.priority),
  ]);

export const collectRuntimeBridgeGovernanceSignals = (
  reviewPlan: RuntimeBridgeReviewGovernancePlan,
): ReadonlyArray<RuntimeBridgeGovernanceSignal> => {
  const observationSignals = reviewPlan.governanceObservations.map((observation) => ({
    signalId: createRuntimeBridgeId("runtime-bridge-governance-signal", observation.observationId),
    subjectId: reviewPlan.subjectId,
    priority: observation.priority,
    signalKind: observationSignalKind(observation),
    label: observation.label,
    sourceRefIds: uniqueStable([
      observation.observationId,
      ...observation.relatedCheckpointIds,
      ...observation.relatedStageIds,
    ]),
    summary: observation.summary,
    metadataOnly: true as const,
  }));
  const postureSignals: RuntimeBridgeGovernanceSignal[] = [
    {
      signalId: createRuntimeBridgeId("runtime-bridge-governance-signal", reviewPlan.approvalPosture.postureId),
      subjectId: reviewPlan.subjectId,
      priority: reviewPlan.approvalPosture.priority,
      signalKind: "approval_posture",
      label: "Approval posture descriptor",
      sourceRefIds: [reviewPlan.approvalPosture.postureId, ...reviewPlan.approvalPosture.reviewStageIds],
      summary: reviewPlan.approvalPosture.summary,
      metadataOnly: true,
    },
    {
      signalId: createRuntimeBridgeId("runtime-bridge-governance-signal", reviewPlan.escalationReview.escalationReviewId),
      subjectId: reviewPlan.subjectId,
      priority: reviewPlan.escalationReview.priority,
      signalKind: "escalation_posture",
      label: "Escalation posture descriptor",
      sourceRefIds: [
        reviewPlan.escalationReview.escalationReviewId,
        ...reviewPlan.escalationReview.routeIds,
        ...reviewPlan.escalationReview.reviewStageIds,
      ],
      summary: reviewPlan.escalationReview.summary,
      metadataOnly: true,
    },
    {
      signalId: createRuntimeBridgeId("runtime-bridge-governance-signal", reviewPlan.compliancePosture.compliancePostureId),
      subjectId: reviewPlan.subjectId,
      priority: reviewPlan.compliancePosture.priority,
      signalKind: "compliance_posture",
      label: "Compliance posture descriptor",
      sourceRefIds: [
        reviewPlan.compliancePosture.compliancePostureId,
        ...reviewPlan.compliancePosture.boundaryIds,
        ...reviewPlan.compliancePosture.checkpointIds,
      ],
      summary: reviewPlan.compliancePosture.summary,
      metadataOnly: true,
    },
    {
      signalId: createRuntimeBridgeId("runtime-bridge-governance-signal", reviewPlan.auditNarrative.narrativeId),
      subjectId: reviewPlan.subjectId,
      priority: strongestPriority(summarizeRuntimeBridgeGovernancePriorities(reviewPlan)),
      signalKind: "audit_readiness",
      label: reviewPlan.auditNarrative.headline,
      sourceRefIds: [
        reviewPlan.auditNarrative.narrativeId,
        ...reviewPlan.auditNarrative.observationIds,
        ...reviewPlan.auditNarrative.boundaryIds,
      ],
      summary: reviewPlan.auditNarrative.summary,
      metadataOnly: true,
    },
  ];

  return sortByPriorityThenId([...postureSignals, ...observationSignals], (signal) => signal.signalId);
};

export const summarizeRuntimeBridgeGovernanceAlignment = ({
  reviewPlan,
  signals = collectRuntimeBridgeGovernanceSignals(reviewPlan),
}: {
  readonly reviewPlan: RuntimeBridgeReviewGovernancePlan;
  readonly signals?: ReadonlyArray<RuntimeBridgeGovernanceSignal>;
}): RuntimeBridgeGovernanceAlignmentSummary => {
  const priority = strongestPriority(summarizeRuntimeBridgeGovernancePriorities(reviewPlan));
  const posture: RuntimeBridgeGovernanceAlignmentSummary["posture"] =
    reviewPlan.escalationReview.posture === "urgent_review"
      ? "urgent_review_aligned"
      : reviewPlan.escalationReview.posture === "review" || reviewPlan.compliancePosture.posture !== "metadata_compliant"
        ? "review_aligned"
        : "aligned";

  return {
    alignmentId: createRuntimeBridgeId("runtime-bridge-governance-alignment-summary", reviewPlan.subjectId),
    subjectId: reviewPlan.subjectId,
    priority,
    posture,
    reviewStageCount: reviewPlan.humanReviewSequence.orderedReviewStageIds.length,
    checkpointCount: reviewPlan.governanceCheckpoints.length,
    boundaryCount: reviewPlan.reviewBoundaries.length,
    sourceSignalIds: signals.map((signal) => signal.signalId),
    summary: `Governance alignment is ${posture} across ${reviewPlan.governanceCheckpoints.length} checkpoints, ${reviewPlan.humanReviewSequence.orderedReviewStageIds.length} review stages, and ${reviewPlan.reviewBoundaries.length} boundaries.`,
    metadataOnly: true,
  };
};

export const summarizeRuntimeBridgeEscalationPosture = ({
  reviewPlan,
  signals = collectRuntimeBridgeGovernanceSignals(reviewPlan),
}: {
  readonly reviewPlan: RuntimeBridgeReviewGovernancePlan;
  readonly signals?: ReadonlyArray<RuntimeBridgeGovernanceSignal>;
}): RuntimeBridgeEscalationPostureSummary => ({
  escalationSummaryId: createRuntimeBridgeId("runtime-bridge-escalation-posture-summary", reviewPlan.subjectId),
  subjectId: reviewPlan.subjectId,
  posture: reviewPlan.escalationReview.posture,
  priority: reviewPlan.escalationReview.priority,
  routeIds: reviewPlan.escalationReview.routeIds,
  reviewStageIds: reviewPlan.escalationReview.reviewStageIds,
  sourceSignalIds: signals
    .filter((signal) => signal.signalKind === "escalation_posture")
    .map((signal) => signal.signalId),
  summary: `Escalation posture is ${reviewPlan.escalationReview.posture} with ${reviewPlan.escalationReview.priority} governance priority.`,
  metadataOnly: true,
});

export const summarizeRuntimeBridgeCompliancePosture = ({
  reviewPlan,
  signals = collectRuntimeBridgeGovernanceSignals(reviewPlan),
}: {
  readonly reviewPlan: RuntimeBridgeReviewGovernancePlan;
  readonly signals?: ReadonlyArray<RuntimeBridgeGovernanceSignal>;
}): RuntimeBridgeCompliancePostureSummary => ({
  complianceSummaryId: createRuntimeBridgeId("runtime-bridge-compliance-posture-summary", reviewPlan.subjectId),
  subjectId: reviewPlan.subjectId,
  posture: reviewPlan.compliancePosture.posture,
  priority: reviewPlan.compliancePosture.priority,
  boundaryIds: reviewPlan.compliancePosture.boundaryIds,
  checkpointIds: reviewPlan.compliancePosture.checkpointIds,
  sourceSignalIds: signals
    .filter((signal) => signal.signalKind === "compliance_posture" || signal.signalKind === "boundary_coverage")
    .map((signal) => signal.signalId),
  summary: `Compliance posture is ${reviewPlan.compliancePosture.posture} across ${reviewPlan.compliancePosture.boundaryIds.length} boundaries and ${reviewPlan.compliancePosture.checkpointIds.length} checkpoints.`,
  metadataOnly: true,
});

export const summarizeRuntimeBridgeAuditReadiness = ({
  reviewPlan,
  signals = collectRuntimeBridgeGovernanceSignals(reviewPlan),
}: {
  readonly reviewPlan: RuntimeBridgeReviewGovernancePlan;
  readonly signals?: ReadonlyArray<RuntimeBridgeGovernanceSignal>;
}): RuntimeBridgeAuditReadinessSummary => {
  const priority = strongestPriority(summarizeRuntimeBridgeGovernancePriorities(reviewPlan));
  const readiness: RuntimeBridgeAuditReadinessSummary["readiness"] =
    reviewPlan.escalationReview.posture === "urgent_review"
      ? "urgent_review_ready"
      : reviewPlan.compliancePosture.posture === "metadata_compliant"
        ? "ready"
        : "review_ready";

  return {
    auditReadinessId: createRuntimeBridgeId("runtime-bridge-audit-readiness-summary", reviewPlan.subjectId),
    subjectId: reviewPlan.subjectId,
    readiness,
    priority,
    narrativeIds: [reviewPlan.auditNarrative.narrativeId],
    observationIds: reviewPlan.governanceObservations.map((observation) => observation.observationId),
    checkpointIds: reviewPlan.governanceCheckpoints.map((checkpoint) => checkpoint.checkpointId),
    sourceSignalIds: signals
      .filter((signal) => signal.signalKind === "audit_readiness" || signal.signalKind === "review_alignment")
      .map((signal) => signal.signalId),
    summary: `Audit readiness is ${readiness} with ${reviewPlan.governanceObservations.length} observations and ${reviewPlan.governanceCheckpoints.length} checkpoints.`,
    metadataOnly: true,
  };
};

export const buildRuntimeBridgeGovernanceReviewMap = ({
  reviewPlan,
  signals = collectRuntimeBridgeGovernanceSignals(reviewPlan),
}: {
  readonly reviewPlan: RuntimeBridgeReviewGovernancePlan;
  readonly signals?: ReadonlyArray<RuntimeBridgeGovernanceSignal>;
}): RuntimeBridgeGovernanceReviewMap => ({
  reviewMapId: createRuntimeBridgeId("runtime-bridge-governance-review-map", reviewPlan.subjectId),
  subjectId: reviewPlan.subjectId,
  orderedCheckpointIds: reviewPlan.humanReviewSequence.orderedCheckpointIds,
  orderedReviewStageIds: reviewPlan.humanReviewSequence.orderedReviewStageIds,
  orderedObservationIds: reviewPlan.humanReviewSequence.orderedObservationIds,
  boundaryIds: reviewPlan.reviewBoundaries.map((boundary) => boundary.boundaryId),
  signalIds: signals.map((signal) => signal.signalId),
  priority: reviewPlan.humanReviewSequence.priority,
  summary: `Governance review map links ${reviewPlan.humanReviewSequence.orderedCheckpointIds.length} checkpoints, ${reviewPlan.humanReviewSequence.orderedReviewStageIds.length} review stages, and ${signals.length} governance signals.`,
  metadataOnly: true,
});

export const buildRuntimeBridgeGovernanceNarrativeBundle = ({
  reviewPlan,
  alignmentSummary,
  escalationSummary,
  complianceSummary,
  auditReadiness,
  signals,
}: {
  readonly reviewPlan: RuntimeBridgeReviewGovernancePlan;
  readonly alignmentSummary: RuntimeBridgeGovernanceAlignmentSummary;
  readonly escalationSummary: RuntimeBridgeEscalationPostureSummary;
  readonly complianceSummary: RuntimeBridgeCompliancePostureSummary;
  readonly auditReadiness: RuntimeBridgeAuditReadinessSummary;
  readonly signals: ReadonlyArray<RuntimeBridgeGovernanceSignal>;
}): RuntimeBridgeGovernanceNarrativeBundle => {
  const priority = strongestPriority([
    alignmentSummary.priority,
    escalationSummary.priority,
    complianceSummary.priority,
    auditReadiness.priority,
  ]);

  return {
    bundleId: createRuntimeBridgeId("runtime-bridge-governance-narrative-bundle", reviewPlan.subjectId),
    subjectId: reviewPlan.subjectId,
    headline: "Governance intelligence metadata is consolidated for audit review",
    priority,
    auditNarrativeId: reviewPlan.auditNarrative.narrativeId,
    alignmentSummaryId: alignmentSummary.alignmentId,
    escalationSummaryId: escalationSummary.escalationSummaryId,
    complianceSummaryId: complianceSummary.complianceSummaryId,
    auditReadinessId: auditReadiness.auditReadinessId,
    signalIds: signals.map((signal) => signal.signalId),
    summary: `Governance narrative bundle consolidates ${alignmentSummary.posture} alignment, ${escalationSummary.posture} escalation posture, ${complianceSummary.posture} compliance posture, and ${auditReadiness.readiness} audit readiness.`,
    metadataOnly: true,
  };
};

export const consolidateRuntimeBridgeGovernanceMetadata = ({
  reviewPlan,
  signals,
  alignmentSummary,
  escalationSummary,
  complianceSummary,
  auditReadiness,
  reviewMap,
  narrativeBundle,
}: {
  readonly reviewPlan: RuntimeBridgeReviewGovernancePlan;
  readonly signals: ReadonlyArray<RuntimeBridgeGovernanceSignal>;
  readonly alignmentSummary: RuntimeBridgeGovernanceAlignmentSummary;
  readonly escalationSummary: RuntimeBridgeEscalationPostureSummary;
  readonly complianceSummary: RuntimeBridgeCompliancePostureSummary;
  readonly auditReadiness: RuntimeBridgeAuditReadinessSummary;
  readonly reviewMap: RuntimeBridgeGovernanceReviewMap;
  readonly narrativeBundle: RuntimeBridgeGovernanceNarrativeBundle;
}): RuntimeBridgeGovernanceConsolidation => {
  const priority = strongestPriority([
    alignmentSummary.priority,
    escalationSummary.priority,
    complianceSummary.priority,
    auditReadiness.priority,
    reviewMap.priority,
    narrativeBundle.priority,
    ...signals.map((signal) => signal.priority),
  ]);

  return {
    consolidationId: createRuntimeBridgeId("runtime-bridge-governance-consolidation", reviewPlan.subjectId),
    subjectId: reviewPlan.subjectId,
    priority,
    signalIds: signals.map((signal) => signal.signalId),
    alignmentSummaryId: alignmentSummary.alignmentId,
    escalationSummaryId: escalationSummary.escalationSummaryId,
    complianceSummaryId: complianceSummary.complianceSummaryId,
    auditReadinessId: auditReadiness.auditReadinessId,
    reviewMapId: reviewMap.reviewMapId,
    narrativeBundleId: narrativeBundle.bundleId,
    sourceReviewGovernancePlanId: reviewPlan.planId,
    summary: `Governance consolidation is ${priority} priority across ${signals.length} signals, ${reviewPlan.governanceCheckpoints.length} checkpoints, and ${reviewPlan.reviewBoundaries.length} review boundaries.`,
    metadataOnly: true,
  };
};

export const buildRuntimeBridgeGovernanceIntelligenceManifest = (
  reviewPlan: RuntimeBridgeReviewGovernancePlan,
): RuntimeBridgeGovernanceIntelligenceManifest => {
  const governanceSignals = collectRuntimeBridgeGovernanceSignals(reviewPlan);
  const alignmentSummary = summarizeRuntimeBridgeGovernanceAlignment({
    reviewPlan,
    signals: governanceSignals,
  });
  const escalationPostureSummary = summarizeRuntimeBridgeEscalationPosture({
    reviewPlan,
    signals: governanceSignals,
  });
  const compliancePostureSummary = summarizeRuntimeBridgeCompliancePosture({
    reviewPlan,
    signals: governanceSignals,
  });
  const auditReadinessSummary = summarizeRuntimeBridgeAuditReadiness({
    reviewPlan,
    signals: governanceSignals,
  });
  const reviewMap = buildRuntimeBridgeGovernanceReviewMap({
    reviewPlan,
    signals: governanceSignals,
  });
  const narrativeBundle = buildRuntimeBridgeGovernanceNarrativeBundle({
    reviewPlan,
    alignmentSummary,
    escalationSummary: escalationPostureSummary,
    complianceSummary: compliancePostureSummary,
    auditReadiness: auditReadinessSummary,
    signals: governanceSignals,
  });
  const consolidation = consolidateRuntimeBridgeGovernanceMetadata({
    reviewPlan,
    signals: governanceSignals,
    alignmentSummary,
    escalationSummary: escalationPostureSummary,
    complianceSummary: compliancePostureSummary,
    auditReadiness: auditReadinessSummary,
    reviewMap,
    narrativeBundle,
  });

  return {
    manifestId: createRuntimeBridgeId("runtime-bridge-governance-intelligence-manifest", reviewPlan.subjectId),
    subjectId: reviewPlan.subjectId,
    consolidation,
    alignmentSummary,
    escalationPostureSummary,
    compliancePostureSummary,
    auditReadinessSummary,
    narrativeBundle,
    governanceSignals,
    governancePriorities: summarizeRuntimeBridgeGovernancePriorities(reviewPlan),
    reviewMap,
    sourceReviewGovernancePlanId: reviewPlan.planId,
    metadataOnly: true,
  };
};
