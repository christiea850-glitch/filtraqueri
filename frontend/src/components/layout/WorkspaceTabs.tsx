type WorkspaceTabItem<T extends string> = {
  id: T;
  label: string;
  disabled?: boolean;
};

type WorkspaceTabsProps<T extends string> = {
  items: WorkspaceTabItem<T>[];
  activeItem: T;
  label: string;
  onChange: (item: T) => void;
};

function WorkspaceTabs<T extends string>({
  items,
  activeItem,
  label,
  onChange,
}: WorkspaceTabsProps<T>) {
  return (
    <div className="workspace-tabs" aria-label={label}>
      {items.map((item) => (
        <button
          type="button"
          key={item.id}
          className={activeItem === item.id ? "is-active" : ""}
          disabled={item.disabled}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export default WorkspaceTabs;
export type { WorkspaceTabItem };
