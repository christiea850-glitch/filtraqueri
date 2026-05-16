import type { InvestigationReport } from "../investigationIntelligence";
import type {
  NarrativeInsight,
  NarrativeRecommendationAction,
  NarrativeReport,
  NarrativeSeverity,
} from "../narrativeIntelligence";
import type { ActiveResultModel } from "../results/activeResultModel";
import type {
  RuntimeBridgeAdvisoryReference,
  RuntimeBridgeConfidence,
  RuntimeBridgeContinuationReference,
  RuntimeBridgeEdge,
  RuntimeBridgeExplanationReference,
  RuntimeBridgeInvestigationReference,
  RuntimeBridgeNode,
  RuntimeBridgeResultReference,
  RuntimeBridgeSourceModuleReference,
} from "./runtimeBridgeTypes";
import {
  createBridgeEdgeId,
  createBridgeNodeId,
  createBridgeReferenceId,
} from "./runtimeBridgeIds";

const getSeverityConfidenceLevel = (severity: NarrativeSeverity) => {
  if (severity === "critical" || severity === "high") return "high";
  if (severity === "medium") return "medium";
  return "low";
};

const getRecommendationCategory = (action: NarrativeRecommendationAction) => {
  if (action.includes("compare")) return "compare";
  if (action.includes("filter") || action.includes("inspect")) return "investigate";
  if (action.includes("summary")) return "explain";
  if (action.includes("snapshot")) return "export";
  return "investigate";
};

const createNode = ({
  nodeType,
  sourceId,
  label,
  createdAt,
  sourceModule,
  advisoryReferenceIds = [],
  continuationReferenceIds = [],
  confidenceReferenceIds = [],
  artifactReferenceIds = [],
  relatedRuntimeNodeIds = [],
}: {
  nodeType: RuntimeBridgeNode["nodeType"];
  sourceId: string;
  label: string;
  createdAt: string;
  sourceModule: RuntimeBridgeSourceModuleReference;
  advisoryReferenceIds?: ReadonlyArray<string>;
  continuationReferenceIds?: ReadonlyArray<string>;
  confidenceReferenceIds?: ReadonlyArray<string>;
  artifactReferenceIds?: ReadonlyArray<string>;
  relatedRuntimeNodeIds?: ReadonlyArray<string>;
}): RuntimeBridgeNode => ({
  bridgeNodeId: createBridgeNodeId(nodeType, sourceId),
  nodeType,
  label,
  createdAt,
  updatedAt: null,
  sourceModule,
  lineageReferences: [
    {
      referenceId: sourceId,
      referenceKind: nodeType,
      relationship: "source",
      label,
    },
  ],
  relatedRuntimeNodeIds,
  advisoryReferenceIds,
  continuationReferenceIds,
  confidenceReferenceIds,
  artifactReferenceIds,
  metadataOnly: true,
});

export const createRuntimeBridgeResultReference = (
  activeResultModel: ActiveResultModel | null | undefined,
): RuntimeBridgeResultReference | null => {
  if (!activeResultModel) return null;

  return {
    resultReferenceId: createBridgeReferenceId(
      "result",
      `${activeResultModel.datasetId}:${activeResultModel.sourceTab}`,
    ),
    datasetId: activeResultModel.datasetId,
    resultTab: activeResultModel.sourceTab,
    sourceType: activeResultModel.sourceType,
    rowCount: activeResultModel.totalCount,
    columnCount: activeResultModel.columns.length,
    activeResultModelId: createBridgeReferenceId(
      "active-result-model",
      `${activeResultModel.datasetId}:${activeResultModel.sourceTab}`,
    ),
    executionReferenceId: null,
    metadataOnly: true,
  };
};

export const createRuntimeBridgeResultNode = ({
  resultReference,
  activeResultModel,
  createdAt,
  sourceModule,
}: {
  resultReference: RuntimeBridgeResultReference;
  activeResultModel: ActiveResultModel;
  createdAt: string;
  sourceModule: RuntimeBridgeSourceModuleReference;
}) =>
  createNode({
    nodeType: "result",
    sourceId: resultReference.resultReferenceId,
    label: `${activeResultModel.sourceTab} result`,
    createdAt,
    sourceModule,
  });

export const createNarrativeBridgeMetadata = ({
  narrativeReport,
  createdAt,
  sourceModule,
  resultReference,
}: {
  narrativeReport: NarrativeReport | null | undefined;
  createdAt: string;
  sourceModule: RuntimeBridgeSourceModuleReference;
  resultReference: RuntimeBridgeResultReference | null;
}) => {
  if (!narrativeReport) {
    return {
      advisories: [] as RuntimeBridgeAdvisoryReference[],
      explanations: [] as RuntimeBridgeExplanationReference[],
      continuations: [] as RuntimeBridgeContinuationReference[],
      confidence: [] as RuntimeBridgeConfidence[],
      nodes: [] as RuntimeBridgeNode[],
      edges: [] as RuntimeBridgeEdge[],
    };
  }

  const reportExplanationId = createBridgeReferenceId("explanation", narrativeReport.reportId);
  const advisories = narrativeReport.insights.map((insight): RuntimeBridgeAdvisoryReference => ({
    advisoryId: createBridgeReferenceId("narrative", insight.id),
    advisoryType: insight.category === "quality" ? "quality" : "narrative",
    label: insight.title,
    sourceModule,
    evidenceReferenceIds: insight.evidence.map((evidence) =>
      createBridgeReferenceId("narrative-evidence", `${insight.id}:${evidence.label}`),
    ),
    confidenceReferenceId: createBridgeReferenceId("confidence", insight.id),
    metadataOnly: true,
  }));

  const confidence = narrativeReport.insights.map((insight): RuntimeBridgeConfidence => ({
    confidenceId: createBridgeReferenceId("confidence", insight.id),
    level: getSeverityConfidenceLevel(insight.severity),
    score: null,
    rationale: `${insight.severity} deterministic narrative severity.`,
    weakestLinkReferenceId: null,
    evidenceReferenceIds: insight.evidence.map((evidence) =>
      createBridgeReferenceId("narrative-evidence", `${insight.id}:${evidence.label}`),
    ),
    metadataOnly: true,
  }));

  const continuations = narrativeReport.insights.flatMap((insight) =>
    insight.recommendations.map((recommendation): RuntimeBridgeContinuationReference => ({
      continuationId: createBridgeReferenceId("continuation", recommendation.id),
      category: getRecommendationCategory(recommendation.action),
      label: recommendation.label,
      reason: recommendation.rationale,
      targetReferenceId: resultReference?.resultReferenceId || null,
      evidenceReferenceIds: [createBridgeReferenceId("narrative", insight.id)],
      metadataOnly: true,
    })),
  );

  const explanations: RuntimeBridgeExplanationReference[] = [
    {
      explanationId: reportExplanationId,
      explanationType: "narrative",
      label: "Narrative report summary",
      summary: narrativeReport.summary,
      evidenceReferenceIds: advisories.map((advisory) => advisory.advisoryId),
      advisoryReferenceIds: advisories.map((advisory) => advisory.advisoryId),
      metadataOnly: true,
    },
  ];

  const nodes = [
    createNode({
      nodeType: "explanation",
      sourceId: reportExplanationId,
      label: "Narrative report summary",
      createdAt,
      sourceModule,
      advisoryReferenceIds: advisories.map((advisory) => advisory.advisoryId),
      continuationReferenceIds: continuations.map((continuation) => continuation.continuationId),
      confidenceReferenceIds: confidence.map((item) => item.confidenceId),
    }),
    ...narrativeReport.insights.map((insight: NarrativeInsight) =>
      createNode({
        nodeType: "advisory",
        sourceId: createBridgeReferenceId("narrative", insight.id),
        label: insight.title,
        createdAt,
        sourceModule,
        advisoryReferenceIds: [createBridgeReferenceId("narrative", insight.id)],
        confidenceReferenceIds: [createBridgeReferenceId("confidence", insight.id)],
      }),
    ),
  ];

  const edges = resultReference
    ? advisories.map((advisory): RuntimeBridgeEdge => ({
        bridgeEdgeId: createBridgeEdgeId("supports", advisory.advisoryId, resultReference.resultReferenceId),
        edgeType: "supports",
        fromBridgeNodeId: createBridgeNodeId("advisory", advisory.advisoryId),
        toBridgeNodeId: createBridgeNodeId("result", resultReference.resultReferenceId),
        createdAt,
        lineageReferences: [
          {
            referenceId: resultReference.resultReferenceId,
            referenceKind: "result",
            relationship: "evidence_for",
            label: advisory.label,
          },
        ],
        confidenceReferenceId: advisory.confidenceReferenceId,
        metadataOnly: true,
      }))
    : [];

  return {
    advisories,
    explanations,
    continuations,
    confidence,
    nodes,
    edges,
  };
};

export const createInvestigationBridgeMetadata = ({
  investigationReport,
  createdAt,
  sourceModule,
  resultReference,
}: {
  investigationReport: InvestigationReport | null | undefined;
  createdAt: string;
  sourceModule: RuntimeBridgeSourceModuleReference;
  resultReference: RuntimeBridgeResultReference | null;
}) => {
  if (!investigationReport) {
    return {
      advisories: [] as RuntimeBridgeAdvisoryReference[],
      explanations: [] as RuntimeBridgeExplanationReference[],
      continuations: [] as RuntimeBridgeContinuationReference[],
      investigations: [] as RuntimeBridgeInvestigationReference[],
      confidence: [] as RuntimeBridgeConfidence[],
      nodes: [] as RuntimeBridgeNode[],
      edges: [] as RuntimeBridgeEdge[],
    };
  }

  const investigationId = createBridgeReferenceId("investigation", investigationReport.flow.id);
  const suggestionReferences = investigationReport.suggestions.map((suggestion) =>
    createBridgeReferenceId("investigation-suggestion", suggestion.id),
  );
  const nextStepReferences = investigationReport.nextSteps.map((suggestion) =>
    createBridgeReferenceId("investigation-next-step", suggestion.id),
  );
  const advisories = investigationReport.suggestions.map((suggestion): RuntimeBridgeAdvisoryReference => ({
    advisoryId: createBridgeReferenceId("investigation-suggestion", suggestion.id),
    advisoryType: "recommendation",
    label: suggestion.title,
    sourceModule,
    evidenceReferenceIds: suggestion.compareBy.map((column) =>
      createBridgeReferenceId("investigation-evidence", `${suggestion.id}:${column}`),
    ),
    confidenceReferenceId: createBridgeReferenceId("confidence", suggestion.id),
    metadataOnly: true,
  }));

  const continuations = investigationReport.nextSteps.map((suggestion): RuntimeBridgeContinuationReference => ({
    continuationId: createBridgeReferenceId("continuation", suggestion.id),
    category: "investigate",
    label: suggestion.title,
    reason: suggestion.explanation,
    targetReferenceId: resultReference?.resultReferenceId || null,
    evidenceReferenceIds: [createBridgeReferenceId("investigation-next-step", suggestion.id)],
    metadataOnly: true,
  }));

  const confidence = investigationReport.suggestions.map((suggestion): RuntimeBridgeConfidence => ({
    confidenceId: createBridgeReferenceId("confidence", suggestion.id),
    level: suggestion.confidence,
    score: suggestion.confidenceScore,
    rationale: suggestion.explanation,
    weakestLinkReferenceId: null,
    evidenceReferenceIds: suggestion.compareBy.map((column) =>
      createBridgeReferenceId("investigation-evidence", `${suggestion.id}:${column}`),
    ),
    metadataOnly: true,
  }));

  const explanations: RuntimeBridgeExplanationReference[] = [
    {
      explanationId: createBridgeReferenceId("explanation", investigationReport.flow.id),
      explanationType: "business",
      label: investigationReport.flow.title,
      summary: investigationReport.humanSummary,
      evidenceReferenceIds: suggestionReferences,
      advisoryReferenceIds: advisories.map((advisory) => advisory.advisoryId),
      metadataOnly: true,
    },
  ];

  const investigations: RuntimeBridgeInvestigationReference[] = [
    {
      investigationId,
      sessionId: null,
      label: investigationReport.flow.title,
      stage: investigationReport.flow.activeStage,
      timelineReferenceIds: investigationReport.flow.steps.map((step) =>
        createBridgeReferenceId("investigation-stage", `${investigationReport.flow.id}:${step.stage}`),
      ),
      advisoryReferenceIds: advisories.map((advisory) => advisory.advisoryId),
      resultReferenceIds: resultReference ? [resultReference.resultReferenceId] : [],
      metadataOnly: true,
    },
  ];

  const nodes = [
    createNode({
      nodeType: "investigation",
      sourceId: investigationId,
      label: investigationReport.flow.title,
      createdAt,
      sourceModule,
      advisoryReferenceIds: advisories.map((advisory) => advisory.advisoryId),
      continuationReferenceIds: continuations.map((continuation) => continuation.continuationId),
      confidenceReferenceIds: confidence.map((item) => item.confidenceId),
    }),
    ...nextStepReferences.map((referenceId) =>
      createNode({
        nodeType: "continuation",
        sourceId: referenceId,
        label: "Investigation continuation",
        createdAt,
        sourceModule,
        continuationReferenceIds: [referenceId],
      }),
    ),
  ];

  const edges = resultReference
    ? investigations.map((investigation): RuntimeBridgeEdge => ({
        bridgeEdgeId: createBridgeEdgeId("references", investigation.investigationId, resultReference.resultReferenceId),
        edgeType: "references",
        fromBridgeNodeId: createBridgeNodeId("investigation", investigation.investigationId),
        toBridgeNodeId: createBridgeNodeId("result", resultReference.resultReferenceId),
        createdAt,
        lineageReferences: [
          {
            referenceId: resultReference.resultReferenceId,
            referenceKind: "result",
            relationship: "source",
            label: investigation.label,
          },
        ],
        confidenceReferenceId: null,
        metadataOnly: true,
      }))
    : [];

  return {
    advisories,
    explanations,
    continuations,
    investigations,
    confidence,
    nodes,
    edges,
  };
};
