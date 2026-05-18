import type { NavigationWorkspaceMode } from "./navigationTypes";

export type NavigationActiveResultReference = {
  readonly datasetId: string | null;
  readonly resultTab: string | null;
  readonly sourceType: string | null;
  readonly rowCount: number | null;
};

export type NavigationDatasetContext = {
  readonly datasetId: string | null;
  readonly datasetName: string | null;
};

export type NavigationSessionContext = {
  readonly sessionId: string | null;
};

export type NavigationWorkbookContext = {
  readonly workbookId: string | null;
  readonly workbookName: string | null;
  readonly worksheetId: string | null;
  readonly worksheetName: string | null;
};

export type NavigationContextPreservation = {
  readonly dataset: NavigationDatasetContext;
  readonly session: NavigationSessionContext;
  readonly workbook: NavigationWorkbookContext;
  readonly mode: NavigationWorkspaceMode;
  readonly activeResult: NavigationActiveResultReference | null;
};

export const emptyNavigationContextPreservation = (
  mode: NavigationWorkspaceMode,
): NavigationContextPreservation => ({
  dataset: {
    datasetId: null,
    datasetName: null,
  },
  session: {
    sessionId: null,
  },
  workbook: {
    workbookId: null,
    workbookName: null,
    worksheetId: null,
    worksheetName: null,
  },
  mode,
  activeResult: null,
});

