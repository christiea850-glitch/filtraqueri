import { useEffect, useState } from "react";
import type { RuntimeDisclosureSlotProps } from "./runtimeTypes";

const DISCLOSURE_STORAGE_PREFIX = "filtraqueri.runtimeDisclosure.";

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
  const displayLabel = label.toLowerCase() === "runtime slot" ? "Details" : label;

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
