import type { HistoryItem } from "../../features/history/historyTypes";

type QueryHistoryPanelProps = {
  history: HistoryItem[];
  variant?: "aside" | "standalone";
};

function QueryHistoryPanel({ history, variant = "aside" }: QueryHistoryPanelProps) {
  const className = variant === "standalone" ? "history-panel standalone-panel" : "history-panel";
  const content = (
    <>
      <div>
        <p className="section-label">Activity</p>
        <h2>Activity</h2>
      </div>
      {history.length === 0 ? (
        <p className="history-empty">No activity yet.</p>
      ) : (
        <div className="history-list">
          {history.map((item) => (
            <article key={item.id}>
              <div>
                <strong>{item.action}</strong>
                <time>{item.timestamp}</time>
              </div>
              <p>{item.detail}</p>
              <span>{item.resultCount.toLocaleString()} rows</span>
            </article>
          ))}
        </div>
      )}
    </>
  );

  if (variant === "standalone") {
    return <section className={className}>{content}</section>;
  }

  return <aside className={className}>{content}</aside>;
}

export default QueryHistoryPanel;
