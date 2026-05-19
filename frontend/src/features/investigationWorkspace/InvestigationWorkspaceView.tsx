import type {
  InvestigationWorkspaceLocalState,
  InvestigationWorkspaceLocalTab,
  InvestigationWorkspacePresentationMode,
  InvestigationWorkspaceReadOnlyContext,
} from "./investigationWorkspaceTypes";

export type InvestigationWorkspaceViewProps = InvestigationWorkspaceReadOnlyContext & {
  readonly localState: InvestigationWorkspaceLocalState;
  readonly setSelectedTab: (tab: InvestigationWorkspaceLocalTab) => void;
  readonly setExpandedSectionId: (sectionId: string | null) => void;
  readonly setPresentationMode: (mode: InvestigationWorkspacePresentationMode) => void;
};

const tabs = [
  { id: "overview", label: "Overview", summary: "Summary" },
  { id: "timeline", label: "Timeline", summary: "Sequence" },
  { id: "evidence", label: "Evidence", summary: "Findings" },
] as const satisfies ReadonlyArray<{
  id: InvestigationWorkspaceLocalTab;
  label: string;
  summary: string;
}>;

function InvestigationWorkspaceView({
  investigationWorkspacePlan,
  investigationReport,
  narrativeReport,
  explainabilityPreview,
  resultsContext,
  localState,
  setSelectedTab,
  setExpandedSectionId,
  setPresentationMode,
}: InvestigationWorkspaceViewProps) {
  const visibleTimeline = investigationWorkspacePlan.session.timeline.slice(0, 4);
  const visibleRecommendations = investigationWorkspacePlan.recommendations.slice(0, 3);
  const visibleInsights = narrativeReport.visibleInsights.slice(0, 3);
  const firstTimelineEvent = visibleTimeline[0] || null;
  const firstInsight = visibleInsights[0] || null;
  const activeSection = localState.expandedSectionId;
  const activeTab = tabs.find((tab) => tab.id === localState.selectedTab) || tabs[0];
  const activeTimelineDescription = visibleTimeline.find((event) => event.eventId === activeSection)?.description;
  const activeInsightDescription =
    firstInsight && activeSection === firstInsight.id
      ? firstInsight.evidence[0]?.value || firstInsight.narrative
      : null;
  const overviewActionLabel = localState.presentationMode === "compact" ? "Focus summary" : "Show compact view";

  return (
    <section className="workspace-hub-panel results-workspace-hub" aria-label="Investigation">
      <div>
        <span>Current result</span>
        <h3>Investigation</h3>
        <small>{investigationWorkspacePlan.readinessSummary.label}</small>
      </div>

      <div className="workspace-actions" aria-label="Investigation sections">
        <div className="result-tabs" aria-label="Investigation views">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={localState.selectedTab === tab.id ? "is-active" : undefined}
              onClick={() => setSelectedTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <small>{activeTab.summary}</small>
      </div>

      <div className="results-review-facts" aria-label="Investigation context">
        <span>
          <small>Source</small>
          <strong>{resultsContext.sourceLabel}</strong>
        </span>
        <span>
          <small>Rows</small>
          <strong>{resultsContext.rowCountLabel}</strong>
        </span>
        <span>
          <small>Filters / sort</small>
          <strong>{resultsContext.filterSortLabel}</strong>
        </span>
      </div>

      {localState.selectedTab === "overview" && (
        <div className="investigation-prompt-row" aria-label="Investigation overview">
          <span>Investigation Summary</span>
          <small>{explainabilityPreview.takeawaySentence}</small>
          {visibleRecommendations.length > 0 ? (
            visibleRecommendations.map((recommendation) => (
              <small key={recommendation.recommendationId}>{recommendation.label}</small>
            ))
          ) : (
            <small>Review the current result to identify the next useful question.</small>
          )}
          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              setPresentationMode(localState.presentationMode === "compact" ? "focused" : "compact")
            }
          >
            {overviewActionLabel}
          </button>
        </div>
      )}

      {localState.selectedTab === "timeline" && (
        <div className="workspace-hub-prompts" aria-label="Investigation timeline">
          {visibleTimeline.length > 0 ? (
            visibleTimeline.map((event) => (
              <small key={event.eventId}>{event.label}</small>
            ))
          ) : (
            <small>The investigation timeline will build as results and findings are reviewed.</small>
          )}
          {activeTimelineDescription && <small>{activeTimelineDescription}</small>}
          <button
            type="button"
            className="secondary-button"
            disabled={!firstTimelineEvent}
            onClick={() =>
              firstTimelineEvent &&
              setExpandedSectionId(activeSection === firstTimelineEvent.eventId ? null : firstTimelineEvent.eventId)
            }
          >
            {activeSection === firstTimelineEvent?.eventId ? "Hide step detail" : "Review first step"}
          </button>
        </div>
      )}

      {localState.selectedTab === "evidence" && (
        <div className="executive-insight-list" aria-label="Investigation evidence">
          {visibleInsights.length > 0 ? (
            visibleInsights.map((insight) => (
              <article key={insight.id} className={`is-${insight.severity}`}>
                <div>
                  <span>{insight.category}</span>
                  <strong>{insight.title}</strong>
                </div>
                <p>{insight.evidence[0]?.value || insight.narrative}</p>
              </article>
            ))
          ) : (
            <article>
              <div>
                <span>Findings</span>
                <strong>No findings selected yet</strong>
              </div>
              <p>{investigationReport.humanSummary || "Review a result to surface evidence for this investigation."}</p>
            </article>
          )}
          {activeInsightDescription && (
            <article>
              <div>
                <span>Selected finding</span>
                <strong>{firstInsight?.title}</strong>
              </div>
              <p>{activeInsightDescription}</p>
            </article>
          )}
          <button
            type="button"
            className="secondary-button"
            disabled={!firstInsight}
            onClick={() => firstInsight && setExpandedSectionId(activeSection === firstInsight.id ? null : firstInsight.id)}
          >
            {activeSection === firstInsight?.id ? "Clear finding" : "Highlight finding"}
          </button>
        </div>
      )}

      <p className="status-message">
        Keep the current result, timeline, and strongest evidence together while deciding what to
        review next.
      </p>
    </section>
  );
}

export default InvestigationWorkspaceView;
