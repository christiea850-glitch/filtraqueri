import type { ActiveView, WorkspaceMode } from "../dataset/datasetTypes";

export type RuntimeModeContext = {
  mode: WorkspaceMode;
  surface: "human-workspace" | "analyst-workspace";
  preservesIsolation: boolean;
  defaultReturnView: ActiveView;
  summary: string;
};

export const normalizeRuntimeModeContext = (
  mode: WorkspaceMode,
  activeView: ActiveView,
): RuntimeModeContext =>
  mode === "analyst"
    ? {
        mode,
        surface: "analyst-workspace",
        preservesIsolation: true,
        defaultReturnView: activeView || "sqlWorkspace",
        summary: "Analyst context is isolated from Human Mode execution flows.",
      }
    : {
        mode,
        surface: "human-workspace",
        preservesIsolation: true,
        defaultReturnView: activeView || "results",
        summary: "Human context uses existing guided dataset, query, and result flows.",
      };
