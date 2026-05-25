import type { ReactNode } from "react";

type FocusedWorkspaceShellProps = {
  title: string;
  eyebrow?: string;
  summary?: string;
  backLabel?: string;
  onBack: () => void;
  actions?: ReactNode;
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
};

function FocusedWorkspaceShell({
  title,
  eyebrow = "Investigation",
  summary,
  backLabel = "Back",
  onBack,
  actions,
  meta,
  children,
  className,
}: FocusedWorkspaceShellProps) {
  return (
    <section
      className={["focused-workspace-shell", className].filter(Boolean).join(" ")}
      aria-label={title}
    >
      <div className="focused-workspace-header">
        <button type="button" className="text-button focused-workspace-back" onClick={onBack}>
          {backLabel}
        </button>
        <div className="focused-workspace-title">
          <p className="section-label">{eyebrow}</p>
          <h2>{title}</h2>
          {summary && <p>{summary}</p>}
        </div>
        {actions && <div className="focused-workspace-actions">{actions}</div>}
      </div>
      {meta && <div className="focused-workspace-meta">{meta}</div>}
      <div className="focused-workspace-body">{children}</div>
    </section>
  );
}

export default FocusedWorkspaceShell;
