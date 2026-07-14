import type { ReactNode } from "react";
import OverflowChipStrip, {
  type OverflowChipItem,
} from "./OverflowChipStrip";

type WorksheetSwitcherVariant = "dataPreview" | "exploreScope" | "sqlContext";

type WorksheetSwitcherOption = {
  id: string;
  label: ReactNode;
  isActive: boolean;
  disabled?: boolean;
  title?: string;
  ariaLabel?: string;
  content?: ReactNode;
  badge?: {
    label: ReactNode;
    status: string;
    className?: string;
    ariaHidden?: boolean;
  };
};

type WorksheetSwitcherProps = {
  variant: WorksheetSwitcherVariant;
  ariaLabel: string;
  options: WorksheetSwitcherOption[];
  className: string;
  optionClassName: string;
  activeClassName?: string;
  labelClassName?: string;
  badgeClassName?: string;
  onSelect: (worksheetId: string) => void;
};

function WorksheetSwitcher({
  variant,
  ariaLabel,
  options,
  className,
  optionClassName,
  activeClassName = "active",
  labelClassName,
  badgeClassName,
  onSelect,
}: WorksheetSwitcherProps) {
  if (options.length === 0) return null;

  const renderOptionContent = ({
    label,
    content,
    badge,
  }: Pick<WorksheetSwitcherOption, "label" | "content" | "badge">) =>
    content ?? (
      <>
        <span className={labelClassName}>{label}</span>
        {badge && (
          <span
            className={badge.className || `${badgeClassName || ""} is-${badge.status}`.trim()}
            aria-hidden={badge.ariaHidden}
          >
            {badge.label}
          </span>
        )}
      </>
    );

  if (variant === "dataPreview") {
    const overflowItems: OverflowChipItem<WorksheetSwitcherOption>[] = options.map((option) => ({
      key: option.id,
      label:
        typeof option.label === "string"
          ? option.label
          : option.ariaLabel || option.title || option.id,
      tooltip: option.title,
      ariaLabel: option.ariaLabel,
      className: `${optionClassName}${option.isActive ? ` ${activeClassName}` : ""}`,
      isActive: option.isActive,
      disabled: option.disabled,
      data: option,
    }));

    return (
      <OverflowChipStrip
        items={overflowItems}
        visibleLimit={8}
        ariaLabel={ariaLabel}
        className={className}
        enableSearch={options.length > 10}
        searchPlaceholder="Search worksheets..."
        onChipClick={(item) => item.data && onSelect(item.data.id)}
        renderChip={(item) =>
          item.data ? renderOptionContent(item.data) : item.label
        }
      />
    );
  }

  return (
    <div className={className} aria-label={ariaLabel} data-worksheet-switcher-variant={variant}>
      {options.map(
        ({ id, label, isActive, disabled, title, ariaLabel: optionAriaLabel, content, badge }) => {
          const classNameForOption = `${optionClassName}${isActive ? ` ${activeClassName}` : ""}`;
          const renderedContent = renderOptionContent({ label, content, badge });

          if (variant === "sqlContext") {
            return (
              <div
                key={id}
                className={classNameForOption}
                title={title}
                aria-label={optionAriaLabel}
                data-disabled={disabled ? "true" : undefined}
              >
                {renderedContent}
              </div>
            );
          }

          return (
            <button
              type="button"
              key={id}
              className={classNameForOption}
              disabled={disabled}
              onClick={() => onSelect(id)}
              title={title}
              aria-label={optionAriaLabel}
            >
              {renderedContent}
            </button>
          );
        },
      )}
    </div>
  );
}

export default WorksheetSwitcher;
export type { WorksheetSwitcherOption, WorksheetSwitcherVariant };
