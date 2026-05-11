import type { ResultTabKey } from "../../features/results/resultTypes";

type ResultTabsProps = {
  activeTab: ResultTabKey;
  hasFilteredResults: boolean;
  hasQueryResults: boolean;
  onTabChange: (tab: ResultTabKey) => void;
};

function ResultTabs({
  activeTab,
  hasFilteredResults,
  hasQueryResults,
  onTabChange,
}: ResultTabsProps) {
  return (
    <div className="result-tabs" aria-label="Result tabs">
      <button
        type="button"
        className={activeTab === "preview" ? "is-active" : ""}
        onClick={() => onTabChange("preview")}
      >
        Preview
      </button>
      <button
        type="button"
        className={activeTab === "filtered" ? "is-active" : ""}
        onClick={() => onTabChange("filtered")}
        disabled={!hasFilteredResults}
      >
        Filtered
      </button>
      <button
        type="button"
        className={activeTab === "queried" ? "is-active" : ""}
        onClick={() => onTabChange("queried")}
        disabled={!hasQueryResults}
      >
        Query
      </button>
    </div>
  );
}

export default ResultTabs;
