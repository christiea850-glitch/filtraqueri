import type { MetadataOnlyBoundaryContract } from "../governance/boundaryTypes";
import type {
  InvestigationTimelineEvent,
  InvestigationWorkspacePlan,
  InvestigationWorkspaceRecommendation,
  InvestigationWorkspaceSession,
} from "../investigationWorkspace/workspaceSessionTypes";
import type { RuntimeContinuationReference } from "../runtimeIntelligence/continuations/runtimeContinuations";
import {
  createBridgeReferenceId,
} from "./runtimeBridgeIds";
import type {
  RuntimeBridgeAdvisoryReference,
  RuntimeBridgeArtifactReference,
  RuntimeBridgeConfidence,
  RuntimeBridgeContinuationReference,
  RuntimeBridgeEvent,
  RuntimeBridgeInvestigationReference,
  RuntimeBridgeSourceModuleReference,
} from "./runtimeBridgeTypes";

export const runtimeInvestigationWorkspaceAdapterGovernance = {
  mode: "metadata_only",
  contractId: "runtime-investigation-workspace-bridge-adapters",
  label: "Runtime investigation workspace bridge adapters",
  description:
    "Metadata-only adapters that translate investigation workspace metadata into runtime bridge references.",
  confidence: "high",
  canExecute: false,
  canMutateWorkspace: false,
  canCallBackend: false,
  lineageRefs: [
    "investigation-workspace-investigation-adapter",
    "investigation-workspace-timeline-adapter",
    "investigation-workspace-checkpoint-adapter",
    "investigation-workspace-session-artifact-adapter",
    "investigation-workspace-continuation-adapter",
    "investigation-workspace-confidence-adapter",
  ],
} satisfies MetadataOnlyBoundaryContract;

export const runtimeInvestigationWorkspaceAdapterSourceModule: RuntimeBridgeSourceModuleReference = {
  moduleId: "runtime-investigation-workspace-adapters",
  modulePath: "frontend/src/features/runtimeBridge/runtimeInvestigationWorkspaceAdapters.ts",
  capabilityMode: "metadata_only",
  label: "Runtime investigation workspace bridge adapters",
};

const readinessConfidenceScore = {
  needs_data: 0.25,
  ready_to_investigate: 0.55,
  result_ready: 0.75,
  deliverable_ready: 0.9,
} as const;

const readinessConfidenceLevel = {
  needs_data: "low",
  ready_to_investigate: "medium",
  result_ready: "high",
  deliverable_ready: "high",
} as const;

export const adaptInvestigationWorkspaceToBridgeInvestigation = (
  workspacePlan: InvestigationWorkspacePlan,
): RuntimeBridgeInvestigationReference => {
  const { session } = workspacePlan;

  return {
    investigationId: createBridgeReferenceId("investigation-workspace", session.sessionId),
    sessionId: session.sessionId,
    label: session.sessionTitle,
    stage: session.status,
    timelineReferenceIds: session.timeline.map((event) =>
      createBridgeReferenceId("investigation-timeline-event", event.eventId),
    ),
    advisoryReferenceIds: [
      ...session.narrativeReferences.map((reference) =>
        createBridgeReferenceId("investigation-narrative", reference.insightId),
      ),
      ...workspacePlan.recommendations.map((recommendation) =>
        createBridgeReferenceId("investigation-recommendation", recommendation.recommendationId),
      ),
      ...session.advisoryRuntimeCheckpoints.map((checkpoint) =>
        createBridgeReferenceId("investigation-runtime-checkpoint", checkpoint.eventId),
      ),
    ],
    resultReferenceIds: session.activeResultReference
      ? [
          createBridgeReferenceId(
            "investigation-result",
            `${session.activeResultReference.sourceType}-${session.activeResultReference.sourceTab}`,
          ),
        ]
      : [],
    metadataOnly: true,
  };
};

export const adaptInvestigationTimelineToBridgeEvents = (
  timeline: ReadonlyArray<InvestigationTimelineEvent>,
  sourceModule: RuntimeBridgeSourceModuleReference = runtimeInvestigationWorkspaceAdapterSourceModule,
): RuntimeBridgeEvent[] =>
  timeline.map((event) => ({
    eventId: createBridgeReferenceId("investigation-timeline-event", event.eventId),
    eventType: event.type,
    createdAt: event.createdAt,
    sourceModule,
    relatedReferenceIds: [
      event.relatedDatasetId
        ? createBridgeReferenceId("dataset", event.relatedDatasetId)
        : null,
      event.relatedResultSource
        ? createBridgeReferenceId("result-source", event.relatedResultSource)
        : null,
      event.stage ? createBridgeReferenceId("investigation-stage", event.stage) : null,
    ].filter((referenceId): referenceId is string => Boolean(referenceId)),
    summary: event.description,
    metadataOnly: true,
  }));

export const adaptInvestigationCheckpointToBridgeAdvisory = ({
  checkpoint,
  sourceModule = runtimeInvestigationWorkspaceAdapterSourceModule,
}: {
  readonly checkpoint:
    | InvestigationWorkspaceRecommendation
    | InvestigationWorkspaceSession["narrativeReferences"][number]
    | InvestigationWorkspaceSession["advisoryRuntimeCheckpoints"][number];
  readonly sourceModule?: RuntimeBridgeSourceModuleReference;
}): RuntimeBridgeAdvisoryReference => {
  if ("recommendationId" in checkpoint) {
    return {
      advisoryId: createBridgeReferenceId("investigation-recommendation", checkpoint.recommendationId),
      advisoryType: "recommendation",
      label: checkpoint.label,
      sourceModule,
      evidenceReferenceIds: [createBridgeReferenceId("investigation-readiness", checkpoint.readiness)],
      confidenceReferenceId: createBridgeReferenceId(
        "investigation-recommendation-confidence",
        checkpoint.recommendationId,
      ),
      metadataOnly: true,
    };
  }

  if ("insightId" in checkpoint) {
    return {
      advisoryId: createBridgeReferenceId("investigation-narrative", checkpoint.insightId),
      advisoryType: "narrative",
      label: checkpoint.label,
      sourceModule,
      evidenceReferenceIds: [
        createBridgeReferenceId("narrative-category", checkpoint.category),
        createBridgeReferenceId("narrative-severity", checkpoint.severity),
        ...checkpoint.relatedColumns.map((column) => createBridgeReferenceId("column", column)),
      ],
      confidenceReferenceId: null,
      metadataOnly: true,
    };
  }

  return {
    advisoryId: createBridgeReferenceId("investigation-runtime-checkpoint", checkpoint.eventId),
    advisoryType: "recommendation",
    label: checkpoint.label,
    sourceModule,
    evidenceReferenceIds: [createBridgeReferenceId("runtime-event-type", checkpoint.type)],
    confidenceReferenceId: null,
    metadataOnly: true,
  };
};

export const adaptInvestigationSessionToBridgeArtifacts = (
  session: InvestigationWorkspaceSession,
): RuntimeBridgeArtifactReference[] => [
  {
    artifactId: createBridgeReferenceId("investigation-session", session.sessionId),
    artifactType: "investigation_summary",
    label: session.sessionTitle,
    createdAt: session.createdAt,
    hash: null,
    summary: `Investigation workspace session metadata: ${session.status}.`,
    lineageReferenceIds: [
      ...(session.datasetReference
        ? [createBridgeReferenceId("dataset", session.datasetReference.datasetId)]
        : []),
      ...(session.workbookReference
        ? [createBridgeReferenceId("workbook", session.workbookReference.workbookId)]
        : []),
      ...session.analysisPackageReferences.map((reference) =>
        createBridgeReferenceId("analysis-package", reference.packageId),
      ),
    ],
    metadataOnly: true,
  },
  ...session.deliverableHub.items.map((item) => ({
    artifactId: createBridgeReferenceId("investigation-deliverable", item.itemId),
    artifactType: item.type,
    label: item.label,
    createdAt: session.createdAt,
    hash: null,
    summary: item.description,
    lineageReferenceIds: [
      createBridgeReferenceId("deliverable-hub", session.deliverableHub.hubId),
      ...(item.relatedPackageId
        ? [createBridgeReferenceId("analysis-package", item.relatedPackageId)]
        : []),
      ...(item.futureLocationRef
        ? [createBridgeReferenceId("future-location", item.futureLocationRef)]
        : []),
    ],
    metadataOnly: true as const,
  })),
  ...session.auditMetadata.map((auditEntry) => ({
    artifactId: createBridgeReferenceId("investigation-audit", auditEntry.auditId),
    artifactType: "audit_note",
    label: auditEntry.label,
    createdAt: auditEntry.createdAt,
    hash: null,
    summary: auditEntry.description,
    lineageReferenceIds: [
      ...(auditEntry.relatedDatasetId
        ? [createBridgeReferenceId("dataset", auditEntry.relatedDatasetId)]
        : []),
      ...(auditEntry.relatedPackageId
        ? [createBridgeReferenceId("analysis-package", auditEntry.relatedPackageId)]
        : []),
    ],
    metadataOnly: true as const,
  })),
];

export const adaptInvestigationContinuationToBridgeContinuation = (
  continuation: RuntimeContinuationReference,
): RuntimeBridgeContinuationReference => ({
  continuationId: createBridgeReferenceId("investigation-continuation", continuation.continuationId),
  category: continuation.category,
  label: continuation.label,
  reason: "Investigation continuation metadata reference.",
  targetReferenceId: continuation.targetId || null,
  evidenceReferenceIds: continuation.targetId
    ? [createBridgeReferenceId("investigation-continuation-target", continuation.targetId)]
    : [],
  metadataOnly: true,
});

export const adaptInvestigationConfidenceToBridgeConfidence = (
  workspacePlan: InvestigationWorkspacePlan,
): RuntimeBridgeConfidence => {
  const { session, readinessSummary } = workspacePlan;

  return {
    confidenceId: createBridgeReferenceId("investigation-workspace-confidence", session.sessionId),
    level: readinessConfidenceLevel[session.readiness],
    score: readinessConfidenceScore[session.readiness],
    rationale: readinessSummary.label,
    weakestLinkReferenceId: createBridgeReferenceId("investigation-readiness", session.readiness),
    evidenceReferenceIds: [
      createBridgeReferenceId("investigation-stage-count", readinessSummary.stageCount),
      createBridgeReferenceId("investigation-package-count", readinessSummary.packageCount),
      createBridgeReferenceId("investigation-deliverable-count", readinessSummary.deliverableCount),
      createBridgeReferenceId(
        "investigation-ready-deliverable-count",
        readinessSummary.readyDeliverableCount,
      ),
    ],
    metadataOnly: true,
  };
};
