import type { ReactNode } from "react";

type DrillInDetailPanelProps = {
  title: string;
  eyebrow?: string;
  summary?: string;
  children: ReactNode;
  onBack: () => void;
  backLabel?: string;
};

function DrillInDetailPanel({
  title,
  eyebrow = "Details",
  summary,
  children,
  onBack,
  backLabel = "Back",
}: DrillInDetailPanelProps) {
  return (
    <section className="drill-in-detail-panel" aria-label={title}>
      <div className="drill-in-detail-header">
        <button type="button" className="text-button drill-in-back-button" onClick={onBack}>
          {backLabel}
        </button>
        <div>
          <p className="section-label">{eyebrow}</p>
          <h3>{title}</h3>
          {summary && <p>{summary}</p>}
        </div>
      </div>
      <div className="drill-in-detail-body">{children}</div>
    </section>
  );
}

export default DrillInDetailPanel;
