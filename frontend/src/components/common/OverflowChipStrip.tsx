import { useMemo, useState, type ReactNode } from "react";

export type OverflowChipItem<T = unknown> = {
  key: string;
  label: string;
  tooltip?: string;
  ariaLabel?: string;
  className?: string;
  isActive?: boolean;
  disabled?: boolean;
  data?: T;
};

export type OverflowChipStripProps<T = unknown> = {
  items: readonly OverflowChipItem<T>[];
  visibleLimit: number;
  ariaLabel: string;
  className?: string;
  onChipClick?: (item: OverflowChipItem<T>) => void;
  renderChip?: (item: OverflowChipItem<T>, isInOverflow: boolean) => ReactNode;
  overflowLabel?: (remainingCount: number) => string;
  emptyState?: ReactNode;
  enableSearch?: boolean;
  searchPlaceholder?: string;
};

function OverflowChipStrip<T = unknown>({
  items,
  visibleLimit,
  ariaLabel,
  className,
  onChipClick,
  renderChip,
  overflowLabel,
  emptyState = null,
  enableSearch = false,
  searchPlaceholder = "Search",
}: OverflowChipStripProps<T>) {
  const [isOverflowOpen, setIsOverflowOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const safeVisibleLimit = Math.max(0, visibleLimit);
  const visibleItems = items.slice(0, safeVisibleLimit);
  const hiddenItems = items.slice(safeVisibleLimit);
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const filteredHiddenItems = useMemo(
    () =>
      normalizedSearchQuery.length === 0
        ? hiddenItems
        : hiddenItems.filter((item) =>
            item.label.toLowerCase().includes(normalizedSearchQuery),
          ),
    [hiddenItems, normalizedSearchQuery],
  );

  const renderChipContent = (item: OverflowChipItem<T>, isInOverflow: boolean) =>
    renderChip ? renderChip(item, isInOverflow) : item.label;

  const chipClassName = (item: OverflowChipItem<T>) =>
    [
      "overflow-chip-strip-chip",
      item.isActive ? "is-active" : "",
      item.className || "",
    ]
      .filter(Boolean)
      .join(" ");

  const renderButton = (item: OverflowChipItem<T>, isInOverflow: boolean) =>
    onChipClick ? (
      <button
        type="button"
        key={item.key}
        className={chipClassName(item)}
        disabled={item.disabled}
        title={item.tooltip}
        aria-label={item.ariaLabel}
        aria-pressed={item.isActive || undefined}
        onClick={() => {
          if (item.disabled) return;
          onChipClick(item);
          if (isInOverflow) setIsOverflowOpen(false);
        }}
      >
        {renderChipContent(item, isInOverflow)}
      </button>
    ) : (
      <span key={item.key} className={chipClassName(item)} title={item.tooltip}>
        {renderChipContent(item, isInOverflow)}
      </span>
    );

  if (items.length === 0) {
    return emptyState ? (
      <div className="overflow-chip-strip is-empty" aria-label={ariaLabel}>
        {emptyState}
      </div>
    ) : null;
  }

  return (
    <div
      className={["overflow-chip-strip", className || ""].filter(Boolean).join(" ")}
      aria-label={ariaLabel}
    >
      <div className="overflow-chip-strip-visible">
        {visibleItems.map((item) => renderButton(item, false))}
        {hiddenItems.length > 0 && (
          <details
            className="overflow-chip-strip-overflow"
            open={isOverflowOpen}
            onToggle={(event) => setIsOverflowOpen(event.currentTarget.open)}
          >
            <summary className="overflow-chip-strip-more">
              {overflowLabel
                ? overflowLabel(hiddenItems.length)
                : `+${hiddenItems.length} more`}
            </summary>
            <div className="overflow-chip-strip-panel">
              {enableSearch && (
                <label className="overflow-chip-strip-search">
                  <span>Filter hidden chips</span>
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder={searchPlaceholder}
                  />
                </label>
              )}
              <div className="overflow-chip-strip-hidden">
                {filteredHiddenItems.length > 0 ? (
                  filteredHiddenItems.map((item) => renderButton(item, true))
                ) : (
                  <span className="overflow-chip-strip-empty">No hidden chips match.</span>
                )}
              </div>
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

export default OverflowChipStrip;
