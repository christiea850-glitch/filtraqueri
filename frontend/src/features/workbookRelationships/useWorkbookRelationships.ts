import { useMemo } from "react";
import type { WorkbookMetadata } from "../workbook";
import { buildWorkbookRelationshipRegistry } from "./workbookRelationshipRegistry";

export function useWorkbookRelationships(workbook: WorkbookMetadata | null) {
  return useMemo(
    () => (workbook ? buildWorkbookRelationshipRegistry(workbook) : null),
    [workbook],
  );
}
