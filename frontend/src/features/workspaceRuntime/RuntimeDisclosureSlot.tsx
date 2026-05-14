import { useEffect, useState } from "react";
import type { RuntimeDisclosureSlotProps } from "./runtimeTypes";

const DISCLOSURE_STORAGE_PREFIX = "filtraqueri.runtimeDisclosure.";

const HUMAN_DISCLOSURE_LABELS: Record<string, string> = {
  "runtime slot": "Details",
  "metadata pending": "Details pending",
  "execution contract": "Run boundary",
  adapter: "Context",
  "runtime adapter": "SQL context",
};

function RuntimeDisclosureSlot({
  id,
  title,
  label,
  summary,
  badge,
  defaultOpen = false,
  children,
}: RuntimeDisclosureSlotProps) {
  const [isOpen, setIsOpen] = useState(() => {
    try {
      const storedValue = window.localStorage.getItem(`${DISCLOSURE_STORAGE_PREFIX}${id}`);
      return storedValue === null ? defaultOpen : storedValue === "open";
    } catch {
      return defaultOpen;
    }
  });
  const displayLabel = HUMAN_DISCLOSURE_LABELS[label.toLowerCase()] || label;

  useEffect(() => {
    try {
      window.localStorage.setItem(
        `${DISCLOSURE_STORAGE_PREFIX}${id}`,
        isOpen ? "open" : "closed",
      );
    } catch {
      // Disclosure state is ergonomic only; ignore unavailable storage.
    }
  }, [id, isOpen]);

  return (
    <details
      className="runtime-disclosure-slot"
      open={isOpen}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
    >
      <summary>
        <span>
          <small>{displayLabel}</small>
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
