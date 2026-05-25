import type { ButtonHTMLAttributes, ReactNode } from "react";

type WorkspaceHeaderProps = {
  eyebrow?: string;
  title: ReactNode;
  meta?: ReactNode;
};

export function WorkspaceHeader({ eyebrow, title, meta }: WorkspaceHeaderProps) {
  return (
    <header className="workspace-header-primitive" aria-label="Workspace header">
      <div>
        {eyebrow && <p className="section-label">{eyebrow}</p>}
        <h3>{title}</h3>
      </div>
      {meta && <span>{meta}</span>}
    </header>
  );
}

export function InvestigationThread({ children }: { children: ReactNode }) {
  return (
    <main className="investigation-thread" aria-label="Investigation thread">
      {children}
    </main>
  );
}

type InvestigationThreadStageProps = {
  ariaLabel: string;
  className?: string;
  children: ReactNode;
};

export function InvestigationThreadStage({
  ariaLabel,
  className = "",
  children,
}: InvestigationThreadStageProps) {
  return (
    <section
      className={["investigation-thread-stage", className].filter(Boolean).join(" ")}
      aria-label={ariaLabel}
    >
      {children}
    </section>
  );
}

type PrimaryFocusBlockProps = {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
};

export function PrimaryFocusBlock({
  eyebrow,
  title,
  description,
  action,
}: PrimaryFocusBlockProps) {
  return (
    <section className="primary-focus-block" aria-label="Primary investigation focus">
      <div>
        {eyebrow && <p className="section-label">{eyebrow}</p>}
        <h3>{title}</h3>
        {description && <p>{description}</p>}
      </div>
      {action}
    </section>
  );
}

type EvidenceRowProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  tone?: string;
  selected?: boolean;
  primary?: boolean;
};

export function EvidenceRow({
  icon,
  title,
  description,
  tone,
  selected = false,
  primary = false,
  className = "",
  ...buttonProps
}: EvidenceRowProps) {
  return (
    <button
      type="button"
      className={[
        "evidence-row",
        tone ? `is-${tone}` : "",
        selected ? "is-selected" : "",
        primary ? "is-primary" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...buttonProps}
    >
      {icon}
      <span>
        <strong>{title}</strong>
        {description && <small>{description}</small>}
      </span>
    </button>
  );
}

export function EvidenceRows({ children }: { children: ReactNode }) {
  return (
    <section className="evidence-rows" aria-label="Evidence rows">
      {children}
    </section>
  );
}

type ActionRailProps = {
  eyebrow?: string;
  title?: ReactNode;
  children: ReactNode;
};

export function ActionRail({ eyebrow, title, children }: ActionRailProps) {
  return (
    <section className="action-rail" aria-label="Next investigation actions">
      {(eyebrow || title) && (
        <div className="thread-section-heading">
          {eyebrow && <p className="section-label">{eyebrow}</p>}
          {title && <strong>{title}</strong>}
        </div>
      )}
      <div>{children}</div>
    </section>
  );
}

export function ContextRail({ children }: { children: ReactNode }) {
  return (
    <aside className="context-rail" aria-label="Contextual evidence">
      {children}
    </aside>
  );
}

type ContextRailHeaderProps = {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
};

export function ContextRailHeader({ eyebrow, title, description }: ContextRailHeaderProps) {
  return (
    <div className="context-rail-header">
      {eyebrow && <p className="section-label">{eyebrow}</p>}
      <h3>{title}</h3>
      {description && <p>{description}</p>}
    </div>
  );
}

export function ContextRailSection({
  title,
  children,
}: {
  title: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="context-rail-section">
      <strong>{title}</strong>
      {children}
    </div>
  );
}

export function InlineDisclosure({
  summary,
  children,
  open,
  className = "",
}: {
  summary: ReactNode;
  children: ReactNode;
  open?: boolean;
  className?: string;
}) {
  return (
    <details className={["inline-disclosure", className].filter(Boolean).join(" ")} open={open}>
      <summary>{summary}</summary>
      {children}
    </details>
  );
}

export function OperationalList({ children }: { children: ReactNode }) {
  return <div className="operational-list">{children}</div>;
}

type OperationalTagProps = {
  children: ReactNode;
  className?: string;
};

export function OperationalTag({ children, className = "" }: OperationalTagProps) {
  return <span className={["operational-tag", className].filter(Boolean).join(" ")}>{children}</span>;
}

export function MetadataFooter({ children }: { children: ReactNode }) {
  return (
    <footer className="metadata-footer" aria-label="Dataset metadata">
      {children}
    </footer>
  );
}
