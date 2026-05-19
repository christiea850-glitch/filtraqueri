import { useState } from "react";
import InvestigationWorkspaceView from "./InvestigationWorkspaceView";
import type {
  InvestigationWorkspaceLocalTab,
  InvestigationWorkspacePresentationMode,
  InvestigationWorkspaceReadOnlyContext,
} from "./investigationWorkspaceTypes";

export type InvestigationWorkspaceSurfaceProps = InvestigationWorkspaceReadOnlyContext;

// S7-A local proof boundary:
// - non-routed and local-state-only
// - presentation-only over supplied Results investigation context
// - does not own execution, result state, routing, persistence, orchestration, or Runtime Bridge behavior
function InvestigationWorkspaceSurface(props: InvestigationWorkspaceSurfaceProps) {
  const [selectedTab, setSelectedTab] = useState<InvestigationWorkspaceLocalTab>("overview");
  const [expandedSectionId, setExpandedSectionId] = useState<string | null>(null);
  const [presentationMode, setPresentationMode] =
    useState<InvestigationWorkspacePresentationMode>("compact");

  return (
    <InvestigationWorkspaceView
      {...props}
      localState={{
        selectedTab,
        expandedSectionId,
        presentationMode,
      }}
      setSelectedTab={setSelectedTab}
      setExpandedSectionId={setExpandedSectionId}
      setPresentationMode={setPresentationMode}
    />
  );
}

export default InvestigationWorkspaceSurface;

