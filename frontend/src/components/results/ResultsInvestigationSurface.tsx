import type { AnalysisPackagePlan } from "../../features/analysisPackages";
import type { InvestigationWorkspacePlan } from "../../features/investigationWorkspace";
import type { InvestigationReport } from "../../features/investigationIntelligence";
import type { NarrativeReport } from "../../features/narrativeIntelligence";
import type { ActiveResultModel } from "../../features/results/activeResultModel";
import type { ResultTabKey } from "../../features/results/resultTypes";
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

type ResultsInvestigationSurfaceProps = {
  activeResultModel: ActiveResultModel;
  activeResultTab: ResultTabKey;
  workspaceMode: WorkspaceMode;
  investigationReport: InvestigationReport;
  analysisPackagePlan: AnalysisPackagePlan;
  investigationWorkspacePlan: InvestigationWorkspacePlan;
  narrativeReport: NarrativeReport;
};

function ResultsInvestigationSurface({
  activeResultModel,
  activeResultTab,
  workspaceMode,
  investigationReport,
  analysisPackagePlan,
  investigationWorkspacePlan,
  narrativeReport,
}: ResultsInvestigationSurfaceProps) {
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
  const resultFollowUps = investigationReport.nextSteps.slice(0, 3);
  const packageArtifacts = analysisPackagePlan.packageManifest.artifactManifest;
  const readyPackageArtifacts = packageArtifacts.filter((artifact) => artifact.readiness === "ready_now");
  const packageRecommendations = analysisPackagePlan.recommendations.slice(0, 4);
  const latestTimelineEvent = investigationWorkspacePlan.session.timeline.at(-1);
  const workspaceRecommendations = investigationWorkspacePlan.recommendations.slice(0, 3);
  const executiveInsights = narrativeReport.visibleInsights.slice(0, 4);
  const narrativeReadiness = narrativeReport.readiness;
  const primaryExecutiveInsight = executiveInsights[0] || null;
  const explainabilityPreview = createExplainabilityPreviewViewModel({
    sourceDescriptorVersion: "results-investigation-surface-v1",
    generatedAt: "deterministic-results-preview",
    takeawaySentence: narrativeReport.summary || takeaway,
    confidenceLabel: narrativeReadiness.label,
    topEvidenceFact: primaryExecutiveInsight?.evidence[0] || {
      label: "Top contributor",
      value: topContributorLabel,
    },
    whyItMattersPreview: chartSupportLabel,
    recommendationPreview: continuationSuggestion,
  });

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
      <div className="results-business-takeaway">
        <span>{isAnalystMode ? "Result inspection" : "Business takeaway"}</span>
        <strong>{explainabilityPreview.takeawaySentence}</strong>
        <small>{explainabilityPreview.confidenceLabel} | {explainabilityPreview.whyItMattersPreview}</small>
      </div>

      {!isAnalystMode && (
        <div className="executive-insights-panel" aria-label="Executive insights">
          <div className="executive-insights-header">
            <span>Executive insights</span>
            <strong>{narrativeReadiness.label}</strong>
            <small>
              {narrativeReadiness.insightCount.toLocaleString()} deterministic insight
              {narrativeReadiness.insightCount === 1 ? "" : "s"}
            </small>
          </div>
          {executiveInsights.length > 0 ? (
            <div className="executive-insight-list">
              {executiveInsights.map((insight) => (
                <article key={insight.id} className={`is-${insight.severity}`}>
                  <div>
                    <span>{insight.category}</span>
                    <strong>{insight.title}</strong>
                  </div>
                  <p>{insight.narrative}</p>
                  <small>
                    {insight.evidence[0]?.label}: {insight.evidence[0]?.value}
                  </small>
                </article>
              ))}
            </div>
          ) : (
            <p>{narrativeReadiness.detail}</p>
          )}
        </div>
      )}

      <div className="results-insight-row" aria-label="Lightweight result insights">
        <span>
          <small>Top contributor</small>
          <strong>{topContributorLabel}</strong>
        </span>
        <span>
          <small>Highlight</small>
          <strong>{highlightLabel}</strong>
        </span>
        <span>
          <small>Supporting view</small>
          <strong>{chartSupportLabel}</strong>
        </span>
        <span>
          <small>{isAnalystMode ? "Payload" : "Continuation"}</small>
          <strong>{continuationSuggestion}</strong>
        </span>
      </div>

      <div className="results-review-facts" aria-label="Supporting result context">
        <span>
          <small>Source</small>
          <strong>{sourceLabel}</strong>
        </span>
        <span>
          <small>Result rows</small>
          <strong>{activeResultModel.totalCount.toLocaleString()}</strong>
        </span>
        <span>
          <small>Filters / sort</small>
          <strong>
            {activeFilterCount.toLocaleString()} filters / {activeSortLabel}
          </strong>
        </span>
        <span>
          <small>{isAnalystMode ? "Payload" : "Export"}</small>
          <strong>{activeResultModel.export.rowCount > 0 ? "Ready" : "No rows yet"}</strong>
        </span>
      </div>

      {!isAnalystMode && resultFollowUps.length > 0 && (
        <div className="investigation-prompt-row results-follow-up-row" aria-label="Follow-up investigations">
          <span>Follow up</span>
          {resultFollowUps.map((suggestion) => (
            <small key={suggestion.id}>{suggestion.question}</small>
          ))}
        </div>
      )}

      {!isAnalystMode && (
        <div className="workspace-hub-panel results-workspace-hub" aria-label="Workspace hub summary">
          <div>
            <span>Workspace hub</span>
            <strong>{investigationWorkspacePlan.readinessSummary.label}</strong>
            <small>
              {latestTimelineEvent
                ? latestTimelineEvent.label
                : "No checkpoint recorded yet."}
            </small>
          </div>
          <div className="workspace-hub-metrics" aria-label="Workspace hub metrics">
            <span>
              Packages
              <strong>{investigationWorkspacePlan.readinessSummary.packageCount.toLocaleString()}</strong>
            </span>
            <span>
              Stages
              <strong>{investigationWorkspacePlan.readinessSummary.stageCount.toLocaleString()}</strong>
            </span>
            <span>
              Deliverables
              <strong>{investigationWorkspacePlan.readinessSummary.deliverableCount.toLocaleString()}</strong>
            </span>
          </div>
          {workspaceRecommendations.length > 0 && (
            <div className="workspace-hub-prompts" aria-label="Workspace continuation guidance">
              {workspaceRecommendations.map((recommendation) => (
                <small key={recommendation.recommendationId}>{recommendation.label}</small>
              ))}
            </div>
          )}
        </div>
      )}

      {!isAnalystMode && (
        <div className="analysis-package-panel results-package-panel" aria-label="Analysis package planner">
          <div>
            <span>Analysis package</span>
            <strong>{analysisPackagePlan.readinessSummary.label}</strong>
            <small>{analysisPackagePlan.humanSummary}</small>
          </div>
          <div className="analysis-package-artifacts" aria-label="Suggested package contents">
            <span>
              Ready artifacts
              <strong>{readyPackageArtifacts.length.toLocaleString()}</strong>
            </span>
            {packageRecommendations.slice(0, 3).map((recommendation) => (
              <span key={recommendation.recommendationId}>
                {recommendation.label}
                <strong>{recommendation.readiness.replace(/_/g, " ")}</strong>
              </span>
            ))}
          </div>
        </div>
      )}

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
