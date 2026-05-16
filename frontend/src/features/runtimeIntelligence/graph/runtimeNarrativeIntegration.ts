import type { NarrativeInsight, NarrativeReport } from "../../narrativeIntelligence";
import type { ActiveResultModel } from "../../results/activeResultModel";
import type { RuntimeArtifactSnapshot } from "../artifacts/runtimeArtifacts";
import {
  createRuntimeConfidenceScore,
  createRuntimeConfidenceSummary,
} from "../confidence/runtimeConfidence";
import type { RuntimeNode, RuntimeSourceReference } from "../contracts/runtimeContracts";
import type { RuntimeContinuationReference } from "../continuations/runtimeContinuations";
import type { RuntimeEventReference } from "../events/runtimeEvents";
import { createMetadataHash, createRuntimeId } from "../helpers/runtimeIds";
import { createRuntimeMetadataSnapshot } from "./runtimeGraphBuilder";

const severityConfidenceScore = (insights: NarrativeInsight[]) => {
  if (insights.length === 0) return 0.35;
  const evidenceCount = insights.reduce((sum, insight) => sum + insight.evidence.length, 0);
  return Math.min(0.95, 0.45 + evidenceCount * 0.05);
};

export const createNarrativeRuntimeArtifact = ({
  narrativeReport,
  resultNodeId,
  createdAt,
}: {
  narrativeReport: NarrativeReport;
  resultNodeId: string | null;
  createdAt: string;
}): RuntimeArtifactSnapshot => {
  const evidenceReferenceIds = narrativeReport.insights.flatMap((insight) =>
    insight.evidence.map((evidence) => `${insight.id}:evidence:${evidence.label}`),
  );

  return {
    artifactId: createRuntimeId("runtime-artifact", "narrative", narrativeReport.reportId),
    kind: "narrative_snapshot",
    label: "Narrative insight snapshot",
    summary: narrativeReport.summary,
    hash: createMetadataHash({
      reportId: narrativeReport.reportId,
      insightIds: narrativeReport.insights.map((insight) => insight.id),
      readiness: narrativeReport.readiness.level,
    }),
    createdAt,
    lineage: {
      sourceNodeIds: resultNodeId ? [resultNodeId] : [],
      sourceArtifactIds: [],
      evidenceReferenceIds,
    },
    confidenceSummary: createRuntimeConfidenceSummary({
      narrativeConfidence: createRuntimeConfidenceScore(
        severityConfidenceScore(narrativeReport.insights),
        "Narrative confidence is based on deterministic insight evidence coverage.",
      ),
    }),
    immutable: true,
    metadataOnly: true,
  };
};

export const createNarrativeRuntimeNode = ({
  narrativeReport,
  activeResultModel,
  parentInvestigationReference,
  createdAt,
}: {
  narrativeReport: NarrativeReport;
  activeResultModel: ActiveResultModel | null;
  parentInvestigationReference: string | null;
  createdAt: string;
}): RuntimeNode => {
  const resultNodeId = activeResultModel
    ? createRuntimeId("runtime-node", "result", activeResultModel.datasetId, activeResultModel.sourceTab)
    : null;
  const nodeId = createRuntimeId("runtime-node", "narrative", narrativeReport.reportId);
  const sourceReferences: RuntimeSourceReference[] = [
    ...(resultNodeId
      ? [
          {
            sourceId: resultNodeId,
            sourceType: "result" as const,
            label: activeResultModel?.sourceTab || "Result",
          },
        ]
      : []),
    ...narrativeReport.timelineCheckpoints.map((checkpoint) => ({
      sourceId: checkpoint.checkpointId,
      sourceType: "narrative" as const,
      label: checkpoint.label,
    })),
  ];
  const continuationReferences: RuntimeContinuationReference[] =
    narrativeReport.visibleInsights.flatMap((insight) =>
      insight.recommendations.slice(0, 2).map((recommendation) => ({
        continuationId: createRuntimeId("runtime-continuation", insight.id, recommendation.action),
        category:
          recommendation.action === "compare_periods"
            ? "compare"
            : recommendation.action === "create_executive_summary_later"
              ? "explain"
              : recommendation.action === "filter_missing_values"
                ? "investigate"
                : "investigate",
        label: recommendation.label,
        targetId: insight.id,
        executionNeutral: true,
      })),
    );
  const advisoryEventReferences: RuntimeEventReference[] =
    narrativeReport.timelineCheckpoints.map((checkpoint) => ({
      eventId: createRuntimeId("runtime-event", checkpoint.checkpointId),
      type: "created",
      label: checkpoint.label,
    }));

  return {
    id: nodeId,
    family: "narrative",
    nodeType: "narrative",
    label: "Narrative intelligence report",
    createdAt,
    sourceReferences,
    lineageReferences: [
      ...(resultNodeId ? [{ nodeId: resultNodeId, nodeType: "result" as const, relation: "source" as const }] : []),
      ...narrativeReport.timelineCheckpoints.map((checkpoint) => ({
        nodeId: checkpoint.checkpointId,
        nodeType: "narrative" as const,
        relation: "checkpoint" as const,
      })),
    ],
    parentInvestigationReference,
    derivedFrom: resultNodeId ? [resultNodeId] : [],
    metadataSnapshot: createRuntimeMetadataSnapshot({
      snapshotId: createRuntimeId("runtime-snapshot", "narrative", narrativeReport.reportId),
      capturedAt: createdAt,
      summary: narrativeReport.summary,
      properties: {
        insightCount: narrativeReport.insights.length,
        visibleInsightCount: narrativeReport.visibleInsights.length,
        readiness: narrativeReport.readiness.level,
        metadataOnly: true,
      },
    }),
    artifactSnapshots: [
      createNarrativeRuntimeArtifact({
        narrativeReport,
        resultNodeId,
        createdAt,
      }),
    ],
    confidenceSummary: createRuntimeConfidenceSummary({
      narrativeConfidence: createRuntimeConfidenceScore(
        severityConfidenceScore(narrativeReport.insights),
        "Narrative node confidence reflects deterministic evidence and readiness metadata.",
      ),
      executionConfidence: createRuntimeConfidenceScore(1, "No execution is performed by narrative runtime metadata."),
    }),
    continuationReferences,
    advisoryEventReferences,
    metadataOnly: true,
  };
};
