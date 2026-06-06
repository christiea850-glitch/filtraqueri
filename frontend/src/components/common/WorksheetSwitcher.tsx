import type { ReactNode } from "react";

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

  return (
    <div className={className} aria-label={ariaLabel} data-worksheet-switcher-variant={variant}>
      {options.map(
        ({ id, label, isActive, disabled, title, ariaLabel: optionAriaLabel, content, badge }) => (
          <button
            type="button"
            key={id}
            className={`${optionClassName}${isActive ? ` ${activeClassName}` : ""}`}
            disabled={disabled}
            onClick={() => onSelect(id)}
            title={title}
            aria-label={optionAriaLabel}
          >
            {content ?? (
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
            )}
          </button>
        ),
      )}
    </div>
  );
}

export default WorksheetSwitcher;
export type { WorksheetSwitcherOption, WorksheetSwitcherVariant };
