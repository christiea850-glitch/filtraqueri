import type { RuntimeDisclosureSlotProps } from "./runtimeTypes";

function RuntimeDisclosureSlot({
  title,
  label,
  summary,
  badge,
  defaultOpen = false,
  children,
}: RuntimeDisclosureSlotProps) {
  return (
    <details className="runtime-disclosure-slot" open={defaultOpen}>
      <summary>
        <span>
          <small>{label}</small>
          <strong>{title}</strong>
          <em>{summary}</em>
        </span>
        {badge && <b>{badge}</b>}
      </summary>
      <div className="runtime-disclosure-content">{children}</div>
    </details>
  );
}

export default RuntimeDisclosureSlot;
