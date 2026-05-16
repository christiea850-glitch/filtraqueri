import type { AnalysisPackagePlan } from "../analysisPackages/analysisPackageTypes";
import type { BusinessQuestionInterpretation } from "../businessQuestionIntelligence/businessQuestionTypes";
import type { EngineAdapter, EngineCompatibilityResult } from "../engineAdapters/engineAdapterTypes";
import type { MetadataOnlyBoundaryContract } from "../governance/boundaryTypes";
import type { PlanningReadinessReport } from "../planningReadiness/planningReadinessTypes";
import type { WorkflowRecommendation } from "../workflowRecommendations/workflowRecommendationTypes";
import {
  createBridgeNodeId,
  createBridgeReferenceId,
} from "./runtimeBridgeIds";
import type {
  RuntimeBridgeAdvisoryReference,
  RuntimeBridgeArtifactReference,
  RuntimeBridgeConfidence,
  RuntimeBridgeConfidenceLevel,
  RuntimeBridgeExplanationReference,
  RuntimeBridgeNode,
  RuntimeBridgeSourceModuleReference,
} from "./runtimeBridgeTypes";

export const runtimeAnalysisPackageAdapterGovernance = {
  mode: "metadata_only",
  contractId: "runtime-analysis-package-bridge-adapters",
  label: "Runtime analysis package bridge adapters",
  description:
    "Metadata-only adapters that translate analysis package and planning metadata into runtime bridge references.",
  confidence: "high",
  canExecute: false,
  canMutateWorkspace: false,
  canCallBackend: false,
  lineageRefs: [
    "analysis-package-artifact-adapter",
    "workflow-recommendation-advisory-adapter",
    "business-intent-node-adapter",
    "engine-recommendation-explanation-adapter",
    "readiness-confidence-adapter",
  ],
} satisfies MetadataOnlyBoundaryContract;

export const runtimeAnalysisPackageAdapterSourceModule: RuntimeBridgeSourceModuleReference = {
  moduleId: "runtime-analysis-package-adapters",
  modulePath: "frontend/src/features/runtimeBridge/runtimeAnalysisPackageAdapters.ts",
  capabilityMode: "metadata_only",
  label: "Runtime analysis package bridge adapters",
};

const mapModerateConfidence = (
  confidence: "low" | "moderate" | "medium" | "high" | null | undefined,
): RuntimeBridgeConfidenceLevel => {
  if (confidence === "moderate") return "medium";
  return confidence || "unknown";
};

const readinessScoreByStatus = {
  ready_now: 0.9,
  ready_for_future_execution: 0.85,
  partially_ready: 0.6,
  relationship_dependent: 0.55,
  engine_limited: 0.45,
  needs_result: 0.4,
  future_generation: 0.35,
  not_ready: 0.2,
  unsupported: 0.1,
  not_applicable: null,
} as const;

export const adaptAnalysisPackageToBridgeArtifacts = (
  analysisPackagePlan: AnalysisPackagePlan,
): RuntimeBridgeArtifactReference[] => {
  const manifest = analysisPackagePlan.packageManifest;

  return manifest.artifactManifest.map((artifact) => ({
    artifactId: createBridgeReferenceId("analysis-package-artifact", artifact.artifactId),
    artifactType: artifact.type,
    label: artifact.label,
    createdAt: manifest.generatedAt,
    hash: null,
    summary: artifact.description,
    lineageReferenceIds: [
      createBridgeReferenceId("analysis-package", manifest.packageId),
      ...(artifact.relatedDatasetId
        ? [createBridgeReferenceId("dataset", artifact.relatedDatasetId)]
        : []),
      ...(artifact.relatedInvestigationStep
        ? [createBridgeReferenceId("investigation-stage", artifact.relatedInvestigationStep)]
        : []),
    ],
    metadataOnly: true,
  }));
};

export const adaptWorkflowRecommendationToBridgeAdvisory = (
  recommendation: WorkflowRecommendation,
  sourceModule: RuntimeBridgeSourceModuleReference = runtimeAnalysisPackageAdapterSourceModule,
): RuntimeBridgeAdvisoryReference => ({
  advisoryId: createBridgeReferenceId("workflow-recommendation", recommendation.id),
  advisoryType: "workflow",
  label: recommendation.label,
  sourceModule,
  evidenceReferenceIds: recommendation.supportingMetadataSignals.map((signal) =>
    createBridgeReferenceId("workflow-signal", signal.id),
  ),
  confidenceReferenceId: createBridgeReferenceId("workflow-confidence", recommendation.id),
  metadataOnly: true,
});

export const adaptBusinessIntentToBridgeNode = ({
  intent,
  createdAt,
  sourceModule = runtimeAnalysisPackageAdapterSourceModule,
}: {
  readonly intent: BusinessQuestionInterpretation;
  readonly createdAt: string;
  readonly sourceModule?: RuntimeBridgeSourceModuleReference;
}): RuntimeBridgeNode => ({
  bridgeNodeId: createBridgeNodeId("business-intent", intent.id),
  nodeType: "advisory",
  label: intent.detectedIntentCategory,
  createdAt,
  updatedAt: null,
  sourceModule,
  lineageReferences: intent.supportingSignals.map((signal) => ({
    referenceId: createBridgeReferenceId("business-intent-signal", signal.id),
    referenceKind: "advisory",
    relationship: "evidence_for",
    label: signal.label,
  })),
  relatedRuntimeNodeIds: [],
  advisoryReferenceIds: [createBridgeReferenceId("business-intent", intent.id)],
  continuationReferenceIds: intent.followUpSuggestions.map((suggestion) =>
    createBridgeReferenceId("business-intent-follow-up", suggestion),
  ),
  confidenceReferenceIds: [createBridgeReferenceId("business-intent-confidence", intent.id)],
  artifactReferenceIds: [],
  metadataOnly: true,
});

export const adaptEngineRecommendationToBridgeExplanation = (
  recommendation: EngineCompatibilityResult | EngineAdapter,
): RuntimeBridgeExplanationReference => {
  const engine = "engine" in recommendation ? recommendation.engine : recommendation;
  const supportedReasons = "supportedReasons" in recommendation ? recommendation.supportedReasons : [];
  const unsupportedReasons = "unsupportedReasons" in recommendation ? recommendation.unsupportedReasons : [];
  const summaryParts = [
    engine.description,
    ...supportedReasons,
    ...unsupportedReasons,
  ].filter(Boolean);

  return {
    explanationId: createBridgeReferenceId("engine-recommendation", engine.id),
    explanationType: "technical",
    label: engine.label,
    summary: summaryParts.join(" "),
    evidenceReferenceIds: [
      createBridgeReferenceId("engine-type", engine.engineType),
      createBridgeReferenceId("engine-readiness", engine.readinessLevel),
      ...engine.supportedTasks.map((task) => createBridgeReferenceId("engine-task", task)),
    ],
    advisoryReferenceIds: [createBridgeReferenceId("engine-recommendation", engine.id)],
    metadataOnly: true,
  };
};

export const adaptReadinessToBridgeConfidence = (
  readiness: PlanningReadinessReport | AnalysisPackagePlan["readinessSummary"],
  sourceId: string,
): RuntimeBridgeConfidence => {
  const isPlanningReadiness = "confidenceLevel" in readiness;
  const level = isPlanningReadiness
    ? mapModerateConfidence(readiness.confidenceLevel)
    : readiness.readyArtifactCount > 0
      ? "medium"
      : "unknown";
  const score = isPlanningReadiness
    ? readinessScoreByStatus[readiness.status]
    : readiness.recommendedArtifactCount > 0
      ? readiness.readyArtifactCount / readiness.recommendedArtifactCount
      : null;

  return {
    confidenceId: createBridgeReferenceId("readiness-confidence", sourceId),
    level,
    score,
    rationale: isPlanningReadiness ? readiness.beginnerSummary : readiness.label,
    weakestLinkReferenceId: isPlanningReadiness
      ? createBridgeReferenceId("planning-readiness-status", readiness.status)
      : null,
    evidenceReferenceIds: isPlanningReadiness
      ? [
          createBridgeReferenceId("planning-task", readiness.taskId),
          createBridgeReferenceId("planning-status", readiness.status),
          createBridgeReferenceId("planning-scope", readiness.supportedWorkflowScope),
        ]
      : [
          createBridgeReferenceId("analysis-package-ready-artifacts", readiness.readyArtifactCount),
          createBridgeReferenceId(
            "analysis-package-recommended-artifacts",
            readiness.recommendedArtifactCount,
          ),
          createBridgeReferenceId("analysis-package-future-artifacts", readiness.futureArtifactCount),
        ],
    metadataOnly: true,
  };
};
