import type { ReactNode } from "react";
import FocusedWorkspaceShell from "./FocusedWorkspaceShell";

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
    <FocusedWorkspaceShell
      className="drill-in-detail-panel"
      eyebrow={eyebrow}
      title={title}
      summary={summary}
      onBack={onBack}
      backLabel={backLabel}
    >
      <div className="drill-in-detail-body">{children}</div>
    </FocusedWorkspaceShell>
  );
}

export default DrillInDetailPanel;
