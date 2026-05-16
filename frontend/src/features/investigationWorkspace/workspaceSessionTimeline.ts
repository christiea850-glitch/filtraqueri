import type {
  InvestigationTimelineEvent,
  InvestigationWorkspaceBuildInput,
} from "./workspaceSessionTypes";

export const buildInvestigationTimeline = ({
  dataset,
  activeResultModel,
  investigationReport,
  narrativeReport,
  queryHistory,
  sourceMode,
}: InvestigationWorkspaceBuildInput): InvestigationTimelineEvent[] => {
  const createdAt = new Date().toISOString();
  const datasetId = dataset?.dataset_id || null;
  const events: InvestigationTimelineEvent[] = [];

  investigationReport?.flow.steps.forEach((step) => {
    events.push({
      eventId: `timeline:stage:${step.stage}`,
      type: "investigation_stage",
      label: step.label,
      description: step.guidance,
      stage: step.stage,
      createdAt,
      relatedDatasetId: datasetId,
      relatedResultSource: null,
    });
  });

  if (activeResultModel) {
    events.push({
      eventId: `timeline:result:${activeResultModel.sourceTab}`,
      type: "result_checkpoint",
      label: "Latest result checkpoint",
      description: `${activeResultModel.sourceType} result with ${activeResultModel.totalCount.toLocaleString()} rows.`,
      stage: "review_result",
      createdAt,
      relatedDatasetId: activeResultModel.datasetId,
      relatedResultSource: activeResultModel.sourceTab,
    });

    if (activeResultModel.filters.activeLabels.length > 0) {
      events.push({
        eventId: "timeline:filters",
        type: "filter_milestone",
        label: "Filter scope recorded",
        description: activeResultModel.filters.activeLabels.join(", "),
        stage: "scope",
        createdAt,
        relatedDatasetId: activeResultModel.datasetId,
        relatedResultSource: activeResultModel.sourceTab,
      });
    }

    if (activeResultModel.grouping.hasGrouping) {
      events.push({
        eventId: "timeline:grouping",
        type: "grouping_milestone",
        label: "Grouping recorded",
        description: activeResultModel.grouping.columns.join(", "),
        stage: "compare",
        createdAt,
        relatedDatasetId: activeResultModel.datasetId,
        relatedResultSource: activeResultModel.sourceTab,
      });
    }
  }

  narrativeReport?.timelineCheckpoints.slice(0, 4).forEach((checkpoint) => {
    events.push({
      eventId: `timeline:${checkpoint.checkpointId}`,
      type: "narrative_checkpoint",
      label: checkpoint.label,
      description: checkpoint.description,
      stage: checkpoint.type === "grouping_opportunity_identified" ? "compare" : "review_result",
      createdAt,
      relatedDatasetId: datasetId,
      relatedResultSource: activeResultModel?.sourceTab || null,
    });
  });

  if (dataset?.workbook_metadata) {
    events.push({
      eventId: "timeline:workbook-active-sheet",
      type: "workbook_transition",
      label: "Workbook worksheet context",
      description: `${dataset.workbook_metadata.worksheets.length.toLocaleString()} worksheet references available.`,
      stage: "scope",
      createdAt,
      relatedDatasetId: datasetId,
      relatedResultSource: null,
    });
  }

  events.push({
    eventId: `timeline:mode:${sourceMode}`,
    type: "mode_transition",
    label: `${sourceMode === "human" ? "Human" : "Analyst"} workspace context`,
    description: "Current workspace mode captured for future deliverable lineage.",
    stage: "question",
    createdAt,
    relatedDatasetId: datasetId,
    relatedResultSource: null,
  });

  queryHistory.slice(0, 5).forEach((item) => {
    events.push({
      eventId: `timeline:history:${item.id}`,
      type: "query_stage",
      label: item.action,
      description: item.detail,
      stage: "summarize",
      createdAt: item.timestamp || createdAt,
      relatedDatasetId: datasetId,
      relatedResultSource: item.action,
    });
  });

  return events;
};
