import { useEffect, useState } from "react";
import type {
  DataQualityAlert,
  DataQualityAlertSummary,
} from "../../features/dataQuality/dataQualityAlerts";

type DataQualityBellProps = {
  summary: DataQualityAlertSummary;
  onNavigate: (alert: DataQualityAlert) => void;
  onDismiss: (alert: DataQualityAlert) => void;
  onResetStates: () => void;
};

const getBellTone = (summary: DataQualityAlertSummary) => {
  if (summary.highestSeverity === "critical") return "critical";
  if (summary.highestSeverity === "warning") return "warning";
  return "neutral";
};

const DataQualityAlertCard = ({
  alert,
  onNavigate,
  onDismiss,
}: {
  alert: DataQualityAlert;
  onNavigate: (alert: DataQualityAlert) => void;
  onDismiss: (alert: DataQualityAlert) => void;
}) => (
  <article className={`data-quality-alert-card is-${alert.severity} is-${alert.state}`}>
    <div className="data-quality-alert-card-heading">
      <span className={`data-quality-severity is-${alert.severity}`}>{alert.severity}</span>
      <span className={`data-quality-alert-state is-${alert.state}`}>{alert.state}</span>
      <small>{alert.affectedSummary}</small>
    </div>
    <strong>{alert.title}</strong>
    <p>{alert.whyItMatters}</p>
    {alert.stateSummary && <p className="data-quality-alert-state-summary">{alert.stateSummary}.</p>}
    {alert.evidence.length > 0 && (
      <ul>
        {alert.evidence.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    )}
    <div className="data-quality-alert-card-actions">
      <button type="button" className="secondary-button" onClick={() => onNavigate(alert)}>
        {alert.actionLabel}
      </button>
      {alert.severity !== "critical" && alert.state !== "resolved" && (
        <button type="button" className="data-quality-alert-dismiss" onClick={() => onDismiss(alert)}>
          Dismiss
        </button>
      )}
    </div>
  </article>
);

export function DataQualityBell({ summary, onNavigate, onDismiss, onResetStates }: DataQualityBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showReviewed, setShowReviewed] = useState(false);
  const bellTone = getBellTone(summary);
  const unresolvedAlerts = summary.alerts.filter((alert) => alert.state === "unresolved");
  const reviewedAlerts = summary.alerts.filter((alert) => alert.state !== "unresolved");

  useEffect(() => {
    if (!isOpen) return undefined;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isOpen]);

  const navigate = (alert: DataQualityAlert) => {
    setIsOpen(false);
    onNavigate(alert);
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
            {unresolvedAlerts.length > 0 ? (
              unresolvedAlerts.map((alert) => (
                <DataQualityAlertCard key={alert.id} alert={alert} onNavigate={navigate} onDismiss={onDismiss} />
              ))
            ) : (
              <p className="data-quality-alert-empty">
                No unresolved data-quality alerts remain. Reviewed signals are still available below.
              </p>
            )}
            {reviewedAlerts.length > 0 && (
              <div className="data-quality-alert-history">
                <button
                  type="button"
                  className="data-quality-alert-history-toggle"
                  onClick={() => setShowReviewed((current) => !current)}
                  aria-expanded={showReviewed}
                >
                  {showReviewed ? "Hide reviewed alerts" : "Show reviewed alerts"}
                  <span>{reviewedAlerts.length}</span>
                </button>
                {showReviewed &&
                  reviewedAlerts.map((alert) => (
                    <DataQualityAlertCard key={alert.id} alert={alert} onNavigate={navigate} onDismiss={onDismiss} />
                  ))}
              </div>
            )}
            {reviewedAlerts.length > 0 && (
              <button
                type="button"
                className="data-quality-alert-reset"
                onClick={onResetStates}
              >
                Reset reviewed and dismissed alerts
              </button>
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
