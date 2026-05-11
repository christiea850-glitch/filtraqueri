import { createElement } from "react";
import type { ActiveView } from "../dataset/datasetTypes";
import type {
  AnalystWorkspaceDefinition,
  AnalystWorkspaceNavItem,
  AnalystWorkspaceRenderContext,
} from "./analystWorkspaceTypes";

export const createAnalystPlaceholderRenderer =
  (workspace: Pick<AnalystWorkspaceDefinition, "id" | "title" | "description" | "capabilities">) =>
  (_context: AnalystWorkspaceRenderContext) =>
    createElement(
      "section",
      { className: "analyst-workspace-panel standalone-panel" },
      createElement(
        "div",
        { className: "analyst-foundation", key: workspace.id },
        createElement("p", { className: "section-label" }, "Analyst mode"),
        createElement("h2", null, workspace.title),
        createElement("p", null, workspace.description),
        createElement(
          "div",
          { className: "analyst-tool-grid" },
          workspace.capabilities.map((capability) =>
            createElement(
              "article",
              { key: capability },
              createElement("strong", null, capability),
              createElement("span", null, "Planned"),
            ),
          ),
        ),
        createElement(
          "div",
          { className: "analyst-empty-state" },
          createElement("strong", null, "Frontend foundation ready"),
          createElement(
            "p",
            null,
            "This workspace will reuse the active dataset session, results grid, result tabs, and query history when execution support is added.",
          ),
        ),
      ),
    );

export const getAnalystWorkspace = (
  workspaces: AnalystWorkspaceDefinition[],
  view: ActiveView,
) => workspaces.find((workspace) => workspace.id === view);

export const createAnalystWorkspaceRenderers = (
  workspaces: AnalystWorkspaceDefinition[],
  context: AnalystWorkspaceRenderContext,
) =>
  workspaces.reduce<Partial<Record<ActiveView, () => ReturnType<AnalystWorkspaceDefinition["renderer"]>>>>(
    (registry, workspace) => {
      registry[workspace.id] = () => workspace.renderer(context);
      return registry;
    },
    {},
  );

export const createAnalystNavItems = (
  workspaces: AnalystWorkspaceDefinition[],
): AnalystWorkspaceNavItem[] =>
  workspaces.map((workspace) => ({
    view: workspace.id,
    label: workspace.title,
    previewBadge: workspace.previewBadge,
  }));
