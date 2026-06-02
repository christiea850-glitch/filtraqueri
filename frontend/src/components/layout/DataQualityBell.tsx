import { useEffect, useState } from "react";
import type {
  DataQualityAlert,
  DataQualityAlertAction,
  DataQualityAlertSummary,
} from "../../features/dataQuality/dataQualityAlerts";

type DataQualityBellProps = {
  summary: DataQualityAlertSummary;
  onNavigate: (action: DataQualityAlertAction) => void;
};

const getBellTone = (summary: DataQualityAlertSummary) => {
  if (summary.alerts.some((alert) => alert.severity === "critical")) return "critical";
  if (summary.alerts.some((alert) => alert.severity === "warning")) return "warning";
  return "neutral";
};

const DataQualityAlertCard = ({
  alert,
  onNavigate,
}: {
  alert: DataQualityAlert;
  onNavigate: (action: DataQualityAlertAction) => void;
}) => (
  <article className={`data-quality-alert-card is-${alert.severity}`}>
    <div className="data-quality-alert-card-heading">
      <span className={`data-quality-severity is-${alert.severity}`}>{alert.severity}</span>
      <small>{alert.affectedSummary}</small>
    </div>
    <strong>{alert.title}</strong>
    <p>{alert.whyItMatters}</p>
    {alert.evidence.length > 0 && (
      <ul>
        {alert.evidence.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    )}
    <button type="button" className="secondary-button" onClick={() => onNavigate(alert.action)}>
      {alert.actionLabel}
    </button>
  </article>
);

export function DataQualityBell({ summary, onNavigate }: DataQualityBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const bellTone = getBellTone(summary);

  useEffect(() => {
    if (!isOpen) return undefined;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isOpen]);

  const navigate = (action: DataQualityAlertAction) => {
    setIsOpen(false);
    onNavigate(action);
  };

  return (
    <div className="data-quality-bell-wrap">
      <button
        type="button"
        className={`data-quality-bell is-${bellTone}`}
        onClick={() => setIsOpen((current) => !current)}
        aria-label={
          summary.attentionCount > 0
            ? `Open data quality alerts, ${summary.attentionCount} need attention`
            : "Open data quality alerts"
        }
        aria-expanded={isOpen}
        aria-controls="data-quality-alert-drawer"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {summary.attentionCount > 0 && (
          <span className="data-quality-bell-count">{summary.attentionCount}</span>
        )}
      </button>

      {isOpen && (
        <aside
          id="data-quality-alert-drawer"
          className="data-quality-alert-drawer"
          aria-label="Data quality alerts"
        >
          <div className="data-quality-alert-drawer-header">
            <div>
              <span>Intelligence alerts</span>
              <h2>Data quality review</h2>
              <p>Read-only signals that may affect analysis trust.</p>
            </div>
            <button
              type="button"
              className="data-quality-alert-close"
              onClick={() => setIsOpen(false)}
              aria-label="Close data quality alerts"
            >
              Close
            </button>
          </div>

          <div className="data-quality-alert-list">
            {summary.alerts.length > 0 ? (
              summary.alerts.map((alert) => (
                <DataQualityAlertCard key={alert.id} alert={alert} onNavigate={navigate} />
              ))
            ) : (
              <p className="data-quality-alert-empty">
                No important data-quality issues were detected from the current metadata.
              </p>
            )}
          </div>

          <p className="data-quality-alert-footnote">
            Alerts do not modify uploaded data or run analysis.
          </p>
        </aside>
      )}
    </div>
  );
}
