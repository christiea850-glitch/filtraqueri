import { useEffect, useState } from "react";
import type { AnalysisPackagePlan } from "../../features/analysisPackages";
import type { InvestigationWorkspacePlan } from "../../features/investigationWorkspace";
import type { InvestigationReport } from "../../features/investigationIntelligence";
import type { NarrativeReport } from "../../features/narrativeIntelligence";
import type { ActiveResultModel } from "../../features/results/activeResultModel";
import type { ResultTabKey } from "../../features/results/resultTypes";
import {
  formatDisplayLabel,
  formatMetricDisplayLabel,
} from "../../features/displayLabels/displayLabelFormatter";
import {
  getActiveSortLabel,
  getChartSupportLabel,
  getHiddenColumnCount,
  getHighlightLabel,
  getResultContinuationSuggestion,
  getResultSourceLabel,
  getResultTakeaway,
  getTopContributorLabel,
} from "../../features/results/resultInvestigationSurfaceSelectors";
import type { WorkspaceMode } from "../../features/dataset/datasetTypes";
import { createExplainabilityPreviewViewModel } from "../../features/runtimeBridgeConsumers";
import { ResultsInsightDetailPage } from "../../features/detailPages";
import {
  closeControlledHashDetailRoute,
  createNavigationBackStateDescriptor,
  createNavigationOriginDescriptor,
  emptyNavigationContextPreservation,
  openControlledHashDetailRoute,
  subscribeControlledHashDetailRoute,
  type ControlledHashDetailRouteId,
} from "../../features/navigation";
import {
  ActionRail,
  EvidenceRow,
  EvidenceRows,
  InlineDisclosure,
  InvestigationThread,
  OperationalList,
  PrimaryFocusBlock,
  WorkspaceHeader,
} from "../workspace";

type ResultsInvestigationSurfaceProps = {
  activeResultModel: ActiveResultModel;
  activeResultTab: ResultTabKey;
  workspaceMode: WorkspaceMode;
  investigationReport: InvestigationReport;
  analysisPackagePlan: AnalysisPackagePlan;
  investigationWorkspacePlan: InvestigationWorkspacePlan;
  narrativeReport: NarrativeReport;
  preparedQuestionContext?: {
    questionText: string;
    sourceLabel: string;
    status: "applied_for_review" | "executed";
  } | null;
};

const resultsInsightDetailRouteId: ControlledHashDetailRouteId = "detail:results-insight";

const toBusinessStatusLabel = (value: string) =>
  value
    .replace(/ready_now/g, "ready")
    .replace(/readiness/g, "fit")
    .replace(/_/g, " ");

const formatEmbeddedDisplayLabels = (value: string) =>
  value.replace(/[A-Za-z0-9()%]+(?:_[A-Za-z0-9()%]+)+/g, (fieldName) =>
    /^(sum|avg|count)_/i.test(fieldName)
      ? formatMetricDisplayLabel(fieldName)
      : formatDisplayLabel(fieldName),
  );

function ResultsInvestigationSurface({
  activeResultModel,
  activeResultTab,
  workspaceMode,
  investigationReport,
  analysisPackagePlan,
  investigationWorkspacePlan,
  narrativeReport,
  preparedQuestionContext = null,
}: ResultsInvestigationSurfaceProps) {
  const [isInsightDetailOpen, setIsInsightDetailOpen] = useState(false);
  const isAnalystMode = workspaceMode === "analyst";
  const sourceLabel = getResultSourceLabel(activeResultModel);
  const takeaway = getResultTakeaway(activeResultModel);
  const continuationSuggestion = getResultContinuationSuggestion(activeResultModel, isAnalystMode);
  const activeSortLabel = getActiveSortLabel(activeResultModel);
  const activeFilterCount = activeResultModel.filters.activeLabels.length;
  const hiddenColumnCount = getHiddenColumnCount(activeResultModel);
  const topContributorLabel = getTopContributorLabel(activeResultModel);
  const highlightLabel = getHighlightLabel(activeResultModel);
  const chartSupportLabel = getChartSupportLabel(activeResultModel);
  const displaySourceLabel = formatEmbeddedDisplayLabels(sourceLabel);
  const displayTakeaway = formatEmbeddedDisplayLabels(takeaway);
  const displayContinuationSuggestion = formatEmbeddedDisplayLabels(continuationSuggestion);
  const displayActiveSortLabel = formatEmbeddedDisplayLabels(activeSortLabel);
  const displayTopContributorLabel = formatEmbeddedDisplayLabels(topContributorLabel);
  const displayHighlightLabel = formatEmbeddedDisplayLabels(highlightLabel);
  const displayChartSupportLabel = formatEmbeddedDisplayLabels(chartSupportLabel);
  const resultFollowUps = investigationReport.nextSteps.slice(0, 3);
  void analysisPackagePlan;
  void investigationWorkspacePlan;
  const executiveInsights = narrativeReport.visibleInsights.slice(0, 4);
  const narrativeReadiness = narrativeReport.readiness;
  const primaryExecutiveInsight = executiveInsights[0] || null;
  const explainabilityPreview = createExplainabilityPreviewViewModel({
    sourceDescriptorVersion: "results-investigation-surface-v1",
    generatedAt: "deterministic-results-preview",
    takeawaySentence: formatEmbeddedDisplayLabels(narrativeReport.summary || displayTakeaway),
    confidenceLabel: toBusinessStatusLabel(narrativeReadiness.label),
    topEvidenceFact: primaryExecutiveInsight?.evidence[0]
      ? {
          ...primaryExecutiveInsight.evidence[0],
          label: formatEmbeddedDisplayLabels(primaryExecutiveInsight.evidence[0].label),
          value: formatEmbeddedDisplayLabels(String(primaryExecutiveInsight.evidence[0].value)),
        }
      : {
          label: "Top contributor",
          value: displayTopContributorLabel,
        },
    whyItMattersPreview: displayChartSupportLabel,
    recommendationPreview: displayContinuationSuggestion,
  });
  const resultRowsLabel = activeResultModel.totalCount.toLocaleString();
  const filterSortLabel = `${activeFilterCount.toLocaleString()} filters / ${displayActiveSortLabel}`;
  const navigationContext = emptyNavigationContextPreservation(workspaceMode);
  const resultsInsightOrigin = createNavigationOriginDescriptor({
    preservationId: "preserve:results-insight-detail",
    scope: "inline-preview-to-detail",
    originSurfaceId: "results-investigation-surface",
    sourceRoute: {
      routeId: "page:results",
      routeKind: "page",
      depth: 2,
    },
    targetRoute: {
      routeId: "detail:results-insight",
      routeKind: "detail",
      depth: 3,
    },
    mode: workspaceMode,
    context: {
      ...navigationContext,
      activeResult: {
        datasetId: activeResultModel.datasetId,
        resultTab: activeResultTab,
        sourceType: activeResultModel.sourceType,
        rowCount: activeResultModel.totalCount,
      },
    },
  });
  const resultsInsightBackState = createNavigationBackStateDescriptor({
    preservationId: "preserve:results-insight-detail",
    origin: resultsInsightOrigin,
    filterState: {
      activeFilterLabels: activeResultModel.filters.activeLabels,
      filterCount: activeFilterCount,
    },
    paginationState: {
      page: activeResultModel.page,
      totalPages: activeResultModel.totalPages,
      rowsPerPage: activeResultModel.rowsPerPage,
    },
    expandedPanelState: {
      expandedPanelIds: isInsightDetailOpen ? ["results-insight-detail"] : ["results-inline-preview"],
      collapsedPanelIds: [],
    },
    selectedItem: {
      selectedItemId: activeResultModel.sourceTab,
      selectedItemLabel: displaySourceLabel,
      selectedItemType: "result",
    },
  });
  const openResultsInsightDetail = () => {
    openControlledHashDetailRoute(resultsInsightDetailRouteId);
    setIsInsightDetailOpen(true);
  };
  const closeResultsInsightDetail = () => {
    closeControlledHashDetailRoute(resultsInsightDetailRouteId);
    setIsInsightDetailOpen(false);
  };

  useEffect(() => {
    return subscribeControlledHashDetailRoute(resultsInsightDetailRouteId, (event) => {
      setIsInsightDetailOpen(event.active);
    });
  }, []);

  if (isInsightDetailOpen) {
    return (
      <ResultsInsightDetailPage
        explainabilityPreview={explainabilityPreview}
        sourceContext={`${displaySourceLabel} / ${activeResultTab} / ${activeResultModel.sourceType}`}
        resultFactLabel={resultRowsLabel}
        filterSortLabel={filterSortLabel}
        preservedContextLabel={resultsInsightBackState.preservationId}
        onBack={closeResultsInsightDetail}
      />
    );
  }

  return (
    <section
      className={[
        "results-review-strip",
        isAnalystMode ? "is-analyst-results" : "is-human-results",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="Results review context"
    >
      {!isAnalystMode && (
        <div className="results-operational-shell is-stage-only">
          <InvestigationThread>
            <WorkspaceHeader eyebrow="Review result" title="What the data shows" meta={displaySourceLabel} />
            {preparedQuestionContext && (
              <div className="results-prepared-question-note" aria-label="Prepared question traceability">
                <span>Answered question</span>
                <strong>{preparedQuestionContext.questionText}</strong>
                <small>
                  Logic source: {formatEmbeddedDisplayLabels(preparedQuestionContext.sourceLabel)}. Run with the existing Query Builder path.
                </small>
              </div>
            )}
            <PrimaryFocusBlock
              eyebrow="Finding"
              title={explainabilityPreview.takeawaySentence}
              description={`${explainabilityPreview.confidenceLabel} / ${explainabilityPreview.whyItMattersPreview}`}
              action={
                <button type="button" onClick={openResultsInsightDetail}>
                  Open detail
                </button>
              }
            />
            <EvidenceRows>
              <div className="thread-section-heading">
                <p className="section-label">Evidence</p>
                <strong>Result context</strong>
              </div>
              <EvidenceRow title="Top contributor" description={displayTopContributorLabel} />
              <EvidenceRow title="Highlight" description={displayHighlightLabel} />
              <EvidenceRow title="Supporting view" description={displayChartSupportLabel} />
            </EvidenceRows>
            <ActionRail eyebrow="Next move" title={displayContinuationSuggestion}>
              <button type="button" className="is-primary" onClick={openResultsInsightDetail}>
                Inspect finding
              </button>
              <button type="button" onClick={openResultsInsightDetail}>
                Compare groups
              </button>
              <button type="button" onClick={openResultsInsightDetail}>
                Continue investigation
              </button>
            </ActionRail>
            <InlineDisclosure summary="Follow-up and result details">
              <OperationalList>
                {resultFollowUps.map((suggestion) => (
                  <button type="button" key={suggestion.id} onClick={openResultsInsightDetail}>
                    {formatEmbeddedDisplayLabels(suggestion.question)}
                  </button>
                ))}
              </OperationalList>
              <div className="results-disclosure-facts">
                <span>{resultRowsLabel} rows</span>
                <span>{filterSortLabel}</span>
                <span>{activeResultModel.export.rowCount > 0 ? "Export ready" : "No export rows"}</span>
              </div>
            </InlineDisclosure>
          </InvestigationThread>
        </div>
      )}

      {isAnalystMode && (
        <>
      <div className="results-investigation-header">
        <div>
          <p className="section-label">Insights</p>
          <h2>What did I find?</h2>
          <span>{explainabilityPreview.takeawaySentence}</span>
        </div>
        <div className="results-investigation-focus">
          <span>Next useful move</span>
          <strong>{displayContinuationSuggestion}</strong>
          <small>{displayChartSupportLabel}</small>
        </div>
      </div>

      <div className="results-business-takeaway">
        <span>{isAnalystMode ? "Result inspection" : "Business takeaway"}</span>
        <strong>{explainabilityPreview.takeawaySentence}</strong>
        <small>{explainabilityPreview.confidenceLabel} | {explainabilityPreview.whyItMattersPreview}</small>
        <button type="button" className="text-button" onClick={openResultsInsightDetail}>
          View details
        </button>
      </div>
        </>
      )}

      <div className="results-insight-row" aria-label="Lightweight result insights">
        <span>
          <small>Top contributor</small>
          <strong>{displayTopContributorLabel}</strong>
        </span>
        <span>
          <small>Highlight</small>
          <strong>{displayHighlightLabel}</strong>
        </span>
        <span>
          <small>Supporting view</small>
          <strong>{displayChartSupportLabel}</strong>
        </span>
        <span>
          <small>{isAnalystMode ? "Payload" : "Continuation"}</small>
          <strong>{displayContinuationSuggestion}</strong>
        </span>
      </div>

      <div className="results-review-facts" aria-label="Supporting result context">
        <span>
          <small>Source</small>
          <strong>{displaySourceLabel}</strong>
        </span>
        <span>
          <small>Result rows</small>
          <strong>{activeResultModel.totalCount.toLocaleString()}</strong>
        </span>
        <span>
          <small>Filters / sort</small>
          <strong>
            {filterSortLabel}
          </strong>
        </span>
        <span>
          <small>{isAnalystMode ? "Payload" : "Export"}</small>
          <strong>{activeResultModel.export.rowCount > 0 ? "Ready" : "No rows yet"}</strong>
        </span>
      </div>

      <details className="results-technical-disclosure">
        <summary>
          <span>{isAnalystMode ? "Technical result details" : "Result details"}</span>
          <small>
            {activeResultTab} / {activeResultModel.sourceType} / {hiddenColumnCount.toLocaleString()} hidden columns
          </small>
        </summary>
        <div>
          <span>
            Source tab
            <strong>{activeResultModel.sourceTab}</strong>
          </span>
          <span>
            Page
            <strong>
              {activeResultModel.page} of {activeResultModel.totalPages}
            </strong>
          </span>
          <span>
            Rows per page
            <strong>{activeResultModel.rowsPerPage.toLocaleString()}</strong>
          </span>
          <span>
            Export columns
            <strong>{activeResultModel.export.columns.length.toLocaleString()}</strong>
          </span>
        </div>
      </details>
    </section>
  );
}

export default ResultsInvestigationSurface;
