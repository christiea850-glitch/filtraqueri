export type RuntimeBridgeReferenceKind =
  | "runtime_node"
  | "runtime_edge"
  | "result"
  | "advisory"
  | "investigation"
  | "explanation"
  | "continuation"
  | "artifact"
  | "confidence"
  | "event"
  | (string & {});

export type RuntimeBridgeSourceModuleReference = {
  readonly moduleId: string;
  readonly modulePath: string;
  readonly capabilityMode: "advisory" | "metadata_only" | "composition" | "presentational" | "hybrid";
  readonly label: string;
};

export type RuntimeBridgeLineageReference = {
  readonly referenceId: string;
  readonly referenceKind: RuntimeBridgeReferenceKind;
  readonly relationship:
    | "source"
    | "derived_from"
    | "evidence_for"
    | "related_to"
    | "summarizes"
    | "continues"
    | "explains"
    | (string & {});
  readonly label?: string;
};

export type RuntimeBridgeConfidenceLevel = "low" | "medium" | "high" | "unknown";

export type RuntimeBridgeConfidence = {
  readonly confidenceId: string;
  readonly level: RuntimeBridgeConfidenceLevel;
  readonly score: number | null;
  readonly rationale: string;
  readonly weakestLinkReferenceId?: string | null;
  readonly evidenceReferenceIds: ReadonlyArray<string>;
  readonly metadataOnly: true;
};

export type RuntimeBridgeArtifactReference = {
  readonly artifactId: string;
  readonly artifactType:
    | "result_snapshot"
    | "narrative_report"
    | "investigation_summary"
    | "analysis_package"
    | "runtime_graph"
    | "recommendation"
    | (string & {});
  readonly label: string;
  readonly createdAt: string;
  readonly hash?: string | null;
  readonly summary?: string;
  readonly lineageReferenceIds: ReadonlyArray<string>;
  readonly metadataOnly: true;
};

export type RuntimeBridgeContinuationReference = {
  readonly continuationId: string;
  readonly category:
    | "investigate"
    | "compare"
    | "monitor"
    | "explain"
    | "export"
    | "optimize"
    | "forecast"
    | "rerun"
    | (string & {});
  readonly label: string;
  readonly reason: string;
  readonly targetReferenceId?: string | null;
  readonly evidenceReferenceIds: ReadonlyArray<string>;
  readonly metadataOnly: true;
};

export type RuntimeBridgeAdvisoryReference = {
  readonly advisoryId: string;
  readonly advisoryType:
    | "narrative"
    | "recommendation"
    | "semantic"
    | "workflow"
    | "quality"
    | "readiness"
    | (string & {});
  readonly label: string;
  readonly sourceModule: RuntimeBridgeSourceModuleReference;
  readonly evidenceReferenceIds: ReadonlyArray<string>;
  readonly confidenceReferenceId?: string | null;
  readonly metadataOnly: true;
};

export type RuntimeBridgeInvestigationReference = {
  readonly investigationId: string;
  readonly sessionId?: string | null;
  readonly label: string;
  readonly stage?: string | null;
  readonly timelineReferenceIds: ReadonlyArray<string>;
  readonly advisoryReferenceIds: ReadonlyArray<string>;
  readonly resultReferenceIds: ReadonlyArray<string>;
  readonly metadataOnly: true;
};

export type RuntimeBridgeExplanationReference = {
  readonly explanationId: string;
  readonly explanationType:
    | "business"
    | "technical"
    | "semantic"
    | "narrative"
    | "quality"
    | "lineage"
    | (string & {});
  readonly label: string;
  readonly summary: string;
  readonly evidenceReferenceIds: ReadonlyArray<string>;
  readonly advisoryReferenceIds: ReadonlyArray<string>;
  readonly metadataOnly: true;
};

export type RuntimeBridgeResultReference = {
  readonly resultReferenceId: string;
  readonly datasetId: string | null;
  readonly resultTab: "preview" | "filtered" | "queried" | "sql" | (string & {});
  readonly sourceType: "preview" | "filtered" | "query" | "sql" | "metadata" | (string & {});
  readonly rowCount: number | null;
  readonly columnCount: number | null;
  readonly activeResultModelId?: string | null;
  readonly executionReferenceId?: string | null;
  readonly metadataOnly: true;
};

export type RuntimeBridgeEvent = {
  readonly eventId: string;
  readonly eventType:
    | "bridge_created"
    | "reference_linked"
    | "advisory_attached"
    | "continuation_attached"
    | "confidence_attached"
    | "artifact_attached"
    | (string & {});
  readonly createdAt: string;
  readonly sourceModule: RuntimeBridgeSourceModuleReference;
  readonly relatedReferenceIds: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeNode = {
  readonly bridgeNodeId: string;
  readonly nodeType:
    | "runtime"
    | "result"
    | "advisory"
    | "investigation"
    | "explanation"
    | "continuation"
    | "artifact"
    | "confidence"
    | (string & {});
  readonly label: string;
  readonly createdAt: string;
  readonly updatedAt?: string | null;
  readonly sourceModule: RuntimeBridgeSourceModuleReference;
  readonly lineageReferences: ReadonlyArray<RuntimeBridgeLineageReference>;
  readonly relatedRuntimeNodeIds: ReadonlyArray<string>;
  readonly advisoryReferenceIds: ReadonlyArray<string>;
  readonly continuationReferenceIds: ReadonlyArray<string>;
  readonly confidenceReferenceIds: ReadonlyArray<string>;
  readonly artifactReferenceIds: ReadonlyArray<string>;
  readonly metadataOnly: true;
};

export type RuntimeBridgeEdge = {
  readonly bridgeEdgeId: string;
  readonly edgeType:
    | "links"
    | "references"
    | "explains"
    | "supports"
    | "continues"
    | "summarizes"
    | "has_confidence"
    | (string & {});
  readonly fromBridgeNodeId: string;
  readonly toBridgeNodeId: string;
  readonly createdAt: string;
  readonly lineageReferences: ReadonlyArray<RuntimeBridgeLineageReference>;
  readonly confidenceReferenceId?: string | null;
  readonly metadataOnly: true;
};

export type RuntimeBridgeSnapshot = {
  readonly bridgeId: string;
  readonly createdAt: string;
  readonly sourceModule: RuntimeBridgeSourceModuleReference;
  readonly nodes: ReadonlyArray<RuntimeBridgeNode>;
  readonly edges: ReadonlyArray<RuntimeBridgeEdge>;
  readonly artifacts: ReadonlyArray<RuntimeBridgeArtifactReference>;
  readonly continuations: ReadonlyArray<RuntimeBridgeContinuationReference>;
  readonly advisories: ReadonlyArray<RuntimeBridgeAdvisoryReference>;
  readonly investigations: ReadonlyArray<RuntimeBridgeInvestigationReference>;
  readonly explanations: ReadonlyArray<RuntimeBridgeExplanationReference>;
  readonly results: ReadonlyArray<RuntimeBridgeResultReference>;
  readonly confidence: ReadonlyArray<RuntimeBridgeConfidence>;
  readonly events: ReadonlyArray<RuntimeBridgeEvent>;
  readonly metadataOnly: true;
};
