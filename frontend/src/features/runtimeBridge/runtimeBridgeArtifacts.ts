import type { InvestigationReport } from "../investigationIntelligence";
import type { NarrativeReport } from "../narrativeIntelligence";
import type {
  RuntimeBridgeArtifactReference,
  RuntimeBridgeResultReference,
  RuntimeBridgeSourceModuleReference,
} from "./runtimeBridgeTypes";
import { createBridgeReferenceId } from "./runtimeBridgeIds";

export type RuntimeBridgeArtifactCategory =
  | "result_snapshot"
  | "narrative_report"
  | "investigation_summary"
  | "bridge_snapshot"
  | "lineage_summary"
  | (string & {});

export type RuntimeBridgeArtifactMetadataTag = {
  readonly key: string;
  readonly value: string;
};

export type RuntimeBridgeExpandedArtifactReference = RuntimeBridgeArtifactReference & {
  readonly category: RuntimeBridgeArtifactCategory;
  readonly sourceModule: RuntimeBridgeSourceModuleReference;
  readonly relatedNodeIds: ReadonlyArray<string>;
  readonly metadataTags: ReadonlyArray<RuntimeBridgeArtifactMetadataTag>;
  readonly evidenceReferenceIds: ReadonlyArray<string>;
};

export type RuntimeBridgeArtifactBuildInput = {
  readonly category: RuntimeBridgeArtifactCategory;
  readonly label: string;
  readonly createdAt: string;
  readonly sourceModule: RuntimeBridgeSourceModuleReference;
  readonly relatedNodeIds: ReadonlyArray<string>;
  readonly metadataTags?: ReadonlyArray<RuntimeBridgeArtifactMetadataTag>;
  readonly evidenceReferenceIds?: ReadonlyArray<string>;
  readonly summary?: string;
};

export const createRuntimeBridgeArtifactReference = ({
  category,
  label,
  createdAt,
  sourceModule,
  relatedNodeIds,
  metadataTags = [],
  evidenceReferenceIds = [],
  summary,
}: RuntimeBridgeArtifactBuildInput): RuntimeBridgeExpandedArtifactReference => {
  const artifactId = createBridgeReferenceId(
    "artifact",
    `${category}:${label}:${relatedNodeIds.join(":")}`,
  );

  return {
    artifactId,
    artifactType: category,
    category,
    label,
    createdAt,
    hash: null,
    summary,
    sourceModule,
    relatedNodeIds,
    metadataTags,
    evidenceReferenceIds,
    lineageReferenceIds: [...relatedNodeIds, ...evidenceReferenceIds],
    metadataOnly: true,
  };
};

export const createRuntimeBridgeArtifacts = ({
  createdAt,
  sourceModule,
  resultReference,
  narrativeReport,
  investigationReport,
  relatedNodeIds,
}: {
  readonly createdAt: string;
  readonly sourceModule: RuntimeBridgeSourceModuleReference;
  readonly resultReference: RuntimeBridgeResultReference | null;
  readonly narrativeReport?: NarrativeReport | null;
  readonly investigationReport?: InvestigationReport | null;
  readonly relatedNodeIds: ReadonlyArray<string>;
}): ReadonlyArray<RuntimeBridgeExpandedArtifactReference> => {
  const artifacts: RuntimeBridgeExpandedArtifactReference[] = [
    createRuntimeBridgeArtifactReference({
      category: "bridge_snapshot",
      label: "Runtime bridge snapshot",
      createdAt,
      sourceModule,
      relatedNodeIds,
      metadataTags: [{ key: "metadataOnly", value: "true" }],
      evidenceReferenceIds: [],
      summary: "Metadata-only bridge snapshot assembled from supplied references.",
    }),
  ];

  if (resultReference) {
    artifacts.push(
      createRuntimeBridgeArtifactReference({
        category: "result_snapshot",
        label: `${resultReference.resultTab} result reference`,
        createdAt,
        sourceModule,
        relatedNodeIds,
        metadataTags: [
          { key: "sourceType", value: resultReference.sourceType },
          { key: "resultTab", value: resultReference.resultTab },
        ],
        evidenceReferenceIds: [resultReference.resultReferenceId],
        summary: "Active result metadata reference.",
      }),
    );
  }

  if (narrativeReport) {
    artifacts.push(
      createRuntimeBridgeArtifactReference({
        category: "narrative_report",
        label: "Narrative report reference",
        createdAt,
        sourceModule,
        relatedNodeIds,
        metadataTags: [
          { key: "readiness", value: narrativeReport.readiness.level },
          { key: "insights", value: String(narrativeReport.insights.length) },
        ],
        evidenceReferenceIds: narrativeReport.insights.map((insight) =>
          createBridgeReferenceId("narrative", insight.id),
        ),
        summary: narrativeReport.summary,
      }),
    );
  }

  if (investigationReport) {
    artifacts.push(
      createRuntimeBridgeArtifactReference({
        category: "investigation_summary",
        label: investigationReport.flow.title,
        createdAt,
        sourceModule,
        relatedNodeIds,
        metadataTags: [
          { key: "activeStage", value: investigationReport.flow.activeStage },
          { key: "suggestions", value: String(investigationReport.suggestions.length) },
        ],
        evidenceReferenceIds: investigationReport.suggestions.map((suggestion) =>
          createBridgeReferenceId("investigation-suggestion", suggestion.id),
        ),
        summary: investigationReport.humanSummary,
      }),
    );
  }

  return artifacts;
};
