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
  { id: "overview", label: "Overview" },
  { id: "timeline", label: "Timeline" },
  { id: "evidence", label: "Evidence" },
] as const satisfies ReadonlyArray<{ id: InvestigationWorkspaceLocalTab; label: string }>;

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
  const activeSection = localState.expandedSectionId;

  return (
    <section className="workspace-hub-panel" aria-label="Local investigation workspace proof">
      <div>
        <span>Investigation workspace proof</span>
        <strong>{investigationWorkspacePlan.readinessSummary.label}</strong>
        <small>
          Non-routed / local-state-only / presentation-only
        </small>
      </div>

      <div className="workspace-actions" aria-label="Investigation workspace local controls">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={localState.selectedTab === tab.id ? "secondary-button" : "text-button"}
            onClick={() => setSelectedTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
        <button
          type="button"
          className="text-button"
          onClick={() =>
            setPresentationMode(localState.presentationMode === "compact" ? "focused" : "compact")
          }
        >
          {localState.presentationMode === "compact" ? "Focus" : "Compact"}
        </button>
      </div>

      <div className="results-review-facts" aria-label="Investigation workspace read-only context">
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
        <span>
          <small>Mode</small>
          <strong>{localState.presentationMode}</strong>
        </span>
      </div>

      {localState.selectedTab === "overview" && (
        <div className="investigation-prompt-row" aria-label="Investigation overview">
          <span>{explainabilityPreview.confidenceLabel}</span>
          <small>{explainabilityPreview.takeawaySentence}</small>
          {visibleRecommendations.map((recommendation) => (
            <small key={recommendation.recommendationId}>{recommendation.label}</small>
          ))}
        </div>
      )}

      {localState.selectedTab === "timeline" && (
        <div className="workspace-hub-prompts" aria-label="Investigation timeline preview">
          {visibleTimeline.map((event) => (
            <button
              key={event.eventId}
              type="button"
              className="text-button"
              onClick={() => setExpandedSectionId(activeSection === event.eventId ? null : event.eventId)}
            >
              {event.label}
            </button>
          ))}
          {activeSection && (
            <small>
              {visibleTimeline.find((event) => event.eventId === activeSection)?.description ||
                "Timeline checkpoint selected."}
            </small>
          )}
        </div>
      )}

      {localState.selectedTab === "evidence" && (
        <div className="executive-insight-list" aria-label="Investigation evidence preview">
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
                <span>{explainabilityPreview.topEvidenceFact.label}</span>
                <strong>{explainabilityPreview.topEvidenceFact.value}</strong>
              </div>
              <p>{investigationReport.humanSummary}</p>
            </article>
          )}
        </div>
      )}

      <p className="status-message">
        Local proof only: execution, result mutation, pagination, filtering, exports, uploads,
        restore, routing, persistence, orchestration, Runtime Bridge behavior, and App ownership
        remain outside this workspace.
      </p>
    </section>
  );
}

export default InvestigationWorkspaceView;

