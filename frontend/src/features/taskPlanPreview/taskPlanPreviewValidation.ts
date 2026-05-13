import type { GuidedInputState } from "../guidedInputs";
import type { PlanningReadinessReport } from "../planningReadiness";

export const buildTaskPlanPreviewSafetyNotes = (
  guidedInputState: GuidedInputState,
  planningReadiness: PlanningReadinessReport,
) => {
  const notes = [...planningReadiness.futureExecutionBlockers];

  if (guidedInputState.missingRequiredInputIds.length > 0) {
    notes.push("Some guided inputs are still missing.");
  }
  if (planningReadiness.relationshipAwareReadiness === "unsupported") {
    notes.push("Workbook relationships still need confirmation.");
  }
  if (planningReadiness.explanationReadiness === "result_summary_required") {
    notes.push("Future result-aware explanations will need validated result summaries.");
  }
  if (notes.length === 0) {
    notes.push("This is a planning preview only; no analysis will run yet.");
  }

  return Array.from(new Set(notes));
};
