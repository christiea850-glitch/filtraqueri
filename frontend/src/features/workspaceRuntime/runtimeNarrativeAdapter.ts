import type {
  GuidanceRecommendationGroup,
  InvestigationNarrative,
  NarrativeConfidence,
  NarrativeEvent,
  NarrativeStage,
  RuntimeContextReference,
  RuntimeContextSnapshot,
  WorkspaceTrailItem,
} from "./runtimeTypes";

const formatViewLabel = (view: RuntimeContextReference["view"]) =>
  view.replace(/([A-Z])/g, " $1").toLowerCase();

const createReference = (
  snapshot: RuntimeContextSnapshot,
  overrides: Partial<RuntimeContextReference> = {},
): RuntimeContextReference => ({
  datasetId: snapshot.dataset.datasetId,
  datasetName: snapshot.dataset.name,
  workbookActiveWorksheetName: snapshot.workbook.activeWorksheetName,
  workbookWorksheetCount: snapshot.workbook.worksheetCount,
  resultTab: snapshot.activeResult.tab,
  mode: snapshot.mode,
  view: snapshot.activeView,
  activeExecutionId: snapshot.execution.activeExecutionId,
  ...overrides,
});

const resolveStage = ({
  snapshot,
  selectedTrailItem,
}: {
  snapshot: RuntimeContextSnapshot;
  selectedTrailItem: WorkspaceTrailItem | null;
}): NarrativeStage => {
  if (!snapshot.dataset.datasetId) return "not-started";
  if (snapshot.mode === "analyst" || snapshot.activeView === "sqlWorkspace") return "analyst-review";
  if (snapshot.activeResult.sourceType !== "none" && snapshot.activeResult.rowCount > 0) return "result-review";
  if (
    snapshot.queryBuilder.hasRunQuery ||
    snapshot.queryBuilder.selectedColumns.length > 0 ||
    snapshot.queryBuilder.groupBy.length > 0 ||
    snapshot.queryBuilder.aggregations.length > 0
  ) {
    return "analysis-forming";
  }
  if (selectedTrailItem) return "context-selected";
  return "data-opened";
};

const confidenceForStage = (
  stage: NarrativeStage,
  recommendationGroups: GuidanceRecommendationGroup[],
): NarrativeConfidence => {
  if (stage === "not-started") return "low";
  if (recommendationGroups.length > 0 || stage === "result-review" || stage === "analyst-review") return "high";
  return "medium";
};

const stageLabel = (stage: NarrativeStage) => {
  if (stage === "not-started") return "Not started";
  if (stage === "data-opened") return "Data opened";
  if (stage === "context-selected") return "Context selected";
  if (stage === "analysis-forming") return "Analysis forming";
  if (stage === "result-review") return "Result review";
  return "Analyst review";
};

const createEvents = ({
  snapshot,
  stage,
  selectedTrailItem,
  recommendationGroups,
}: {
  snapshot: RuntimeContextSnapshot;
  stage: NarrativeStage;
  selectedTrailItem: WorkspaceTrailItem | null;
  recommendationGroups: GuidanceRecommendationGroup[];
}): NarrativeEvent[] => {
  const events: NarrativeEvent[] = [];

  if (snapshot.dataset.datasetId) {
    events.push({
      id: "narrative:event:dataset",
      label: "Dataset loaded",
      summary: `${snapshot.dataset.name} is available with ${snapshot.dataset.rowCount.toLocaleString()} rows.`,
      stage: "data-opened",
      reference: createReference(snapshot, { view: "dataset", mode: "human" }),
    });
  }

  if (snapshot.workbook.activeWorksheetName) {
    events.push({
      id: "narrative:event:worksheet",
      label: "Worksheet selected",
      summary: `${snapshot.workbook.activeWorksheetName} is the active worksheet.`,
      stage: "context-selected",
      reference: createReference(snapshot, { view: "dataset", mode: "human" }),
    });
  }

  if (selectedTrailItem) {
    events.push({
      id: "narrative:event:trail",
      label: "Trail focus",
      summary: `${selectedTrailItem.label} is pinned as the current investigation context.`,
      stage: "context-selected",
      reference: selectedTrailItem.contextReference,
    });
  }

  if (snapshot.activeResult.sourceType !== "none" && snapshot.activeResult.rowCount > 0) {
    events.push({
      id: "narrative:event:result",
      label: "Result available",
      summary: `${snapshot.activeResult.rowCount.toLocaleString()} rows are available on page ${snapshot.activeResult.page}.`,
      stage: "result-review",
      reference: createReference(snapshot, { view: "results", mode: "human" }),
    });
  }

  if (snapshot.sql.hasDrafts) {
    events.push({
      id: "narrative:event:sql",
      label: "SQL draft present",
      summary: `${snapshot.sql.selectedDialect} draft metadata is available in Analyst Mode.`,
      stage: "analyst-review",
      reference: createReference(snapshot, { view: "sqlWorkspace", mode: "analyst" }),
    });
  }

  if (recommendationGroups.length > 0) {
    events.push({
      id: "narrative:event:recommendation",
      label: "Next step suggested",
      summary: `${recommendationGroups[0].title} is currently the highest-ranked recommendation group.`,
      stage,
      reference: createReference(snapshot),
    });
  }

  return events.slice(0, 5);
};

const createHumanSummary = ({
  snapshot,
  stage,
  recommendationGroups,
}: {
  snapshot: RuntimeContextSnapshot;
  stage: NarrativeStage;
  recommendationGroups: GuidanceRecommendationGroup[];
}) => {
  if (stage === "not-started") {
    return {
      headline: "Your investigation has not started yet.",
      body: "Open a dataset or workbook so FiltraQueri can connect the workspace trail.",
      nextStep: "Open data to begin.",
    };
  }

  const topGroup = recommendationGroups[0];
  return {
    headline: `${stageLabel(stage)} in Human Mode`,
    body: `${snapshot.dataset.name} is shaping a guided analysis around ${formatViewLabel(snapshot.activeView)}.`,
    nextStep: topGroup
      ? `${topGroup.title}: ${topGroup.summary}`
      : "Continue through the trail when you are ready.",
  };
};

const createAnalystSummary = ({
  snapshot,
  stage,
  recommendationGroups,
}: {
  snapshot: RuntimeContextSnapshot;
  stage: NarrativeStage;
  recommendationGroups: GuidanceRecommendationGroup[];
}) => {
  const topGroup = recommendationGroups[0];
  return {
    headline: `${stageLabel(stage)} in Analyst Mode`,
    body: snapshot.sql.hasDrafts
      ? `${snapshot.sql.selectedDialect} draft metadata is available while execution remains disconnected.`
      : `Analyst context is focused on ${formatViewLabel(snapshot.activeView)} metadata.`,
    nextStep: topGroup
      ? `${topGroup.title}: ${topGroup.summary}`
      : "Inspect technical context without running SQL.",
  };
};

export const buildInvestigationNarrative = ({
  snapshot,
  selectedTrailItem,
  recommendationGroups,
}: {
  snapshot: RuntimeContextSnapshot;
  selectedTrailItem: WorkspaceTrailItem | null;
  recommendationGroups: GuidanceRecommendationGroup[];
}): InvestigationNarrative => {
  const stage = resolveStage({ snapshot, selectedTrailItem });
  const summary =
    snapshot.mode === "analyst"
      ? createAnalystSummary({ snapshot, stage, recommendationGroups })
      : createHumanSummary({ snapshot, stage, recommendationGroups });

  return {
    id: `narrative:${snapshot.mode}:${stage}`,
    stage,
    confidence: confidenceForStage(stage, recommendationGroups),
    summary,
    events: createEvents({ snapshot, stage, selectedTrailItem, recommendationGroups }),
    mode: snapshot.mode,
    metadataOnly: true,
  };
};
