export const appCompositionRootNotes = {
  phase: "s5-p3-app-composition-root-stabilization",
  currentOwner: "App.tsx remains the current composition root.",
  routingStatus: "Routing is not migrated into the navigation skeleton in this phase.",
  navigationStatus: "The navigation skeleton exists for future route hierarchy and back-behavior ownership only.",
  protectedBehavior:
    "Human/Analyst switching, upload/session restore, SQL workspace, Monaco, Query Builder, Results pagination, exports, ActiveResultModel, and Runtime Bridge behavior must remain unchanged.",
} as const;

