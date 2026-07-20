import {
  createEmptyTransformationPipeline,
  createTransformationStep,
  toWorkbookTransformationPlan,
} from "../../dataPreparation/transformationPipeline";
import type { SchemaColumn } from "../../dataset/datasetTypes";
import type { WorkbookTransformationPlan, WorksheetMissingValuePlan, WorksheetStructuralDecisionPlan } from "../../workbook";
import { applyCleaningRecipe, getCleaningRecipePreview, type CleaningRecipePreview } from "../../../services/api";

type FixtureResult = { name: string; ok: boolean; failureReasons: string[] };
export type UxS2e4IntegrationFixtureReport = { results: FixtureResult[]; passed: number; failed: FixtureResult[] };

const expect = (condition: boolean, message: string) => (condition ? [] : [message]);
const fixture = (name: string, failureReasons: string[]): FixtureResult => ({ name, ok: failureReasons.length === 0, failureReasons });
const column = (name: string, inferred_type: SchemaColumn["inferred_type"]): SchemaColumn => ({ name, type: inferred_type, inferred_type, null_count: 0, unique_count: 3, sample_values: [] });
const text = column("name", "text");
const amount = column("amount", "numeric");
const category = column("tier", "categorical");
const worksheetId = "dataset-1:worksheet:alpha";
const secondWorksheetId = "dataset-1:worksheet:beta";
const pipelineSeed = "dataset-1:worksheet:alpha:alpha_table";

const buildPlan = (steps: ReturnType<typeof createTransformationStep>[]) => toWorkbookTransformationPlan(createEmptyTransformationPipeline({ worksheetId, sourceTableName: "alpha_table", sourceType: "original", seed: pipelineSeed, steps }));
const step = (kind: Parameters<typeof createTransformationStep>[0]["kind"], targetColumn: SchemaColumn, sequenceIndex: number, outputColumn?: string, parameters?: Parameters<typeof createTransformationStep>[0]["parameters"]) => createTransformationStep({ pipelineId: createEmptyTransformationPipeline({ worksheetId, sourceTableName: "alpha_table", sourceType: "original", seed: pipelineSeed }).id, sequenceIndex, kind, targetColumn, outputColumn, parameters });

const capture = async (run: () => Promise<unknown>, payload: CleaningRecipePreview) => {
  const originalFetch = globalThis.fetch;
  const requests: Record<string, unknown>[] = [];
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    requests.push(JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>);
    return new Response(JSON.stringify(payload), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  try { await run(); } finally { globalThis.fetch = originalFetch; }
  return requests;
};

const previewPayload: CleaningRecipePreview = {
  status: "preview_only",
  worksheet_id: worksheetId,
  worksheet_name: "Alpha",
  before: { row_count: 2, column_count: 2 },
  after_preview: { row_count: 2, column_count: 3, columns: ["name", "amount", "amount_log"], rows: [{ name: "ada", amount: 10, amount_log: 2.3 }], row_provenance: [{ preview_row_index: 0, original_row_index: 0 }] },
  recipe: [],
  excluded: { repeated_headers: 0, section_banners: 0, date_title_rows: 0, layout_rows: 0, placeholder_rows: 0, side_note_columns: 0 },
  transformation_summary: { status: "applied", step_count: 2, changed_columns: ["name"], added_columns: ["amount_log"], cells_changed: 2, operations: [{ kind: "lowercase", detail: "name" }], warnings: [] },
  preview_row_limit: 10,
  message: "ok",
};

const samePlan = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

export async function runUxS2e4IntegrationFixtures(): Promise<UxS2e4IntegrationFixtureReport> {
  const results: FixtureResult[] = [];
  const emptyPlan = toWorkbookTransformationPlan(createEmptyTransformationPipeline({ worksheetId, sourceTableName: "alpha_table", sourceType: "original", seed: pipelineSeed }));
  const textPlan = buildPlan([step("trim_whitespace", text, 0)]);
  const derivedPlan = buildPlan([step("log_transform", amount, 0, "amount_log")]);
  const orderedPlan = buildPlan([step("trim_whitespace", text, 0), step("lowercase", text, 1)]);
  const chainedPlan: WorkbookTransformationPlan | null = { worksheetId, pipelineId: "chain", steps: [{ stepId: "a", order: 0, kind: "frequency_encode", targetColumn: "tier", outputColumn: "tier_frequency", parameters: { kind: "frequency_encode" } }, { stepId: "b", order: 1, kind: "min_max_scale", targetColumn: "tier_frequency", outputColumn: "tier_frequency_scaled", parameters: { kind: "min_max_scale" } }] };
  const fillPlan = buildPlan([step("fill_missing_mean", amount, 0)]);
  const oneHotPlan = buildPlan([step("one_hot_encode", category, 0)]);
  const sqlPlan = buildPlan([step("sql_select_transform", text, 0, undefined, { kind: "sql_select_transform", sqlDraft: "select * from t" })]);
  results.push(fixture("empty pipeline omits transformation_plan", expect(emptyPlan === null, "Empty pipeline should not produce a wire plan.")));
  results.push(fixture("supported text transformation serialization", [ ...expect(textPlan?.steps[0]?.kind === "trim_whitespace", "Text transform should serialize."), ...expect(textPlan?.steps[0]?.targetColumn === "name", "Target column should serialize.") ]));
  results.push(fixture("supported derived-column serialization", [ ...expect(derivedPlan?.steps[0]?.outputColumn === "amount_log", "Derived output column should serialize."), ...expect(derivedPlan?.steps[0]?.parameters?.kind === "log_transform", "Derived parameters should serialize.") ]));
  results.push(fixture("multiple ordered steps", expect(orderedPlan?.steps.map((item) => item.order).join(",") === "0,1", "Step order should be preserved.")));
  results.push(fixture("later step can target earlier derived column", expect(chainedPlan.steps[1].targetColumn === chainedPlan.steps[0].outputColumn, "Later target should match earlier output.")));
  results.push(fixture("blocked fill transformation", expect(fillPlan === null, "Missing-value fill transforms should not serialize as transformation_plan.")));
  results.push(fixture("blocked one_hot_encode", expect(oneHotPlan === null, "One-hot should not serialize.")));
  results.push(fixture("blocked sql_select_transform", expect(sqlPlan === null, "SQL transforms should not serialize.")));
  const drafts: Record<string, WorkbookTransformationPlan> = { [`dataset-1:${worksheetId}`]: textPlan!, [`dataset-1:${secondWorksheetId}`]: { ...textPlan!, worksheetId: secondWorksheetId } };
  delete drafts[`dataset-1:${worksheetId}`];
  results.push(fixture("worksheet-scoped draft restoration", expect(drafts[`dataset-1:${secondWorksheetId}`]?.worksheetId === secondWorksheetId, "Draft key should include dataset and worksheet.")));
  results.push(fixture("reset affects only selected worksheet", expect(!drafts[`dataset-1:${worksheetId}`] && Boolean(drafts[`dataset-1:${secondWorksheetId}`]), "Reset should be worksheet-scoped.")));
  const keyA = JSON.stringify({ structuralDecisionPlan: null, missingValuePlan: null, transformationPlan: textPlan });
  const keyB = JSON.stringify({ structuralDecisionPlan: null, missingValuePlan: null, transformationPlan: orderedPlan });
  results.push(fixture("transformation change invalidates current Step 3 preview", expect(keyA !== keyB, "Plan key should include transformations.")));
  const structuralPlan: WorksheetStructuralDecisionPlan = { worksheetId, decisions: [{ recommendationId: "r1", evidenceType: "layout_rows", decision: "use_recommendation", evidenceIds: ["e1"] }] };
  const missingValuePlan: WorksheetMissingValuePlan = { worksheetId, worksheetStrategy: "decide_per_column", columnDecisions: [{ columnName: "amount", strategy: "fill_zero" }] };
  const previewRequests = await capture(() => getCleaningRecipePreview("dataset-1", worksheetId, { rowLimitPreview: 10, structuralDecisionPlan, missingValuePlan, transformationPlan: textPlan }), previewPayload);
  const applyRequests = await capture(() => applyCleaningRecipe("dataset-1", worksheetId, { rowLimitPreview: 10, structuralDecisionPlan, missingValuePlan, transformationPlan: textPlan }), previewPayload as never);
  results.push(fixture("combined structural missing-value transformation preview request", [ ...expect(Boolean(previewRequests[0].structural_decision_plan), "Structural plan missing."), ...expect(Boolean(previewRequests[0].missing_value_plan), "Missing-value plan missing."), ...expect(Boolean(previewRequests[0].transformation_plan), "Transformation plan missing.") ]));
  results.push(fixture("preview and Apply serialize identical transformation plans", expect(samePlan(previewRequests[0].transformation_plan, applyRequests[0].transformation_plan), "Preview and Apply transformation plans should match.")));
  results.push(fixture("backend transformation_summary is rendered source data", expect(previewPayload.transformation_summary?.step_count === 2 && previewPayload.transformation_summary.operations.length === 1, "Transformation summary should be available.")));
  results.push(fixture("backend after_preview columns and rows are authoritative", expect(previewPayload.after_preview.columns.includes("amount_log") && previewPayload.after_preview.rows[0].amount_log === 2.3, "after_preview should supply final columns and rows.")));
  results.push(fixture("active cleaned copy remains unchanged until manual re-Apply", expect(!samePlan(keyA, keyB), "New draft should differ from existing active cleaned copy plan until Apply.")));
  const failed = results.filter((result) => !result.ok);
  return { results, passed: results.length - failed.length, failed };
}
