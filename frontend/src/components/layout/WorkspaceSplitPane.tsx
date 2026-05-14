import type { ReactNode } from "react";

type WorkspaceSplitPaneProps = {
  primary: ReactNode;
  secondary?: ReactNode;
  secondaryLabel?: string;
};

function WorkspaceSplitPane({ primary, secondary, secondaryLabel }: WorkspaceSplitPaneProps) {
  return (
    <div className="workspace-split-pane">
      <div className="workspace-split-primary">{primary}</div>
      {secondary && (
        <aside className="workspace-split-secondary" aria-label={secondaryLabel || "Supporting details"}>
          {secondary}
        </aside>
      )}
    </div>
  );
}

export default WorkspaceSplitPane;
