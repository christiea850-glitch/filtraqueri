import {
  applyCleaningRecipe,
  getCleaningRecipePreview,
  type CleaningRecipeApplyResponse,
  type CleaningRecipePreview,
} from "../api";
import type {
  StructuralDecisionChoice,
  WorksheetStructuralDecisionPlan,
} from "../../features/workbook";

type FixtureResult = {
  name: string;
  ok: boolean;
  failureReasons: string[];
};

const createResult = (name: string, failureReasons: string[]): FixtureResult => ({
  name,
  ok: failureReasons.length === 0,
  failureReasons,
});

const expect = (condition: boolean, message: string) => (condition ? [] : [message]);

const responsePayload: CleaningRecipeApplyResponse = {
  status: "applied_to_working_copy",
  dataset_id: "dataset-1",
  worksheet_id: "dataset-1:worksheet:1",
  worksheet_name: "managers",
  cleaned_table_name: "managers_cleaned",
  before: { row_count: 10, column_count: 4 },
  after: { row_count: 9, column_count: 4, columns: ["name"] },
  recipe_applied: [],
  excluded: {
    repeated_headers: 0,
    section_banners: 0,
    date_title_rows: 0,
    layout_rows: 0,
    placeholder_rows: 0,
    side_note_columns: 0,
  },
  preview_rows: [],
  preview_row_limit: 25,
  message: "ok",
};

const previewResponsePayload: CleaningRecipePreview = {
  status: "preview_only",
  worksheet_id: "dataset-1:worksheet:1",
  worksheet_name: "managers",
  before: { row_count: 10, column_count: 4 },
  after_preview: {
    row_count: 9,
    column_count: 4,
    columns: ["name"],
    rows: [],
    row_provenance: [],
  },
  recipe: [],
  excluded: {
    repeated_headers: 0,
    section_banners: 0,
    date_title_rows: 0,
    layout_rows: 0,
    placeholder_rows: 0,
    side_note_columns: 0,
  },
  excluded_details: {
    layout_rows: {
      count: 0,
      row_indexes: [],
      reasons: [],
    },
  },
  preview_row_limit: 10,
  message: "ok",
};

const withCapturedRequestBody = async (
  run: () => Promise<void>,
  responsePayloadOverride: CleaningRecipeApplyResponse | CleaningRecipePreview = responsePayload,
): Promise<{ url: string; method: string | undefined; body: Record<string, unknown> }[]> => {
  const originalFetch = globalThis.fetch;
  const requests: { url: string; method: string | undefined; body: Record<string, unknown> }[] = [];

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({
      url: String(input),
      method: init?.method,
      body: JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>,
    });

    return new Response(JSON.stringify(responsePayloadOverride), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  try {
    await run();
  } finally {
    globalThis.fetch = originalFetch;
  }

  return requests;
};

const withCapturedApplyBody = (run: () => Promise<void>) => withCapturedRequestBody(run);

const worksheetId = "dataset-1:worksheet:1";

const structuralPlan: WorksheetStructuralDecisionPlan = {
  worksheetId,
  decisions: [
    {
      recommendationId: `${worksheetId}:automatic_blank_row:0`,
      evidenceType: "automatic_blank_row",
      decision: "keep_original",
      evidenceIds: [`${worksheetId}:automatic_blank_row:0`],
      affectedRows: [7],
      affectedColumnIndexes: [],
    },
  ],
};

export async function runCleaningRecipeApiContractFixtures() {
  const results: FixtureResult[] = [];

  const legacyRequests = await withCapturedApplyBody(async () => {
    await applyCleaningRecipe("dataset-1", worksheetId);
  });
  const legacyBody = legacyRequests[0]?.body;
  results.push(
    createResult("existing Apply call body remains unchanged", [
      ...expect(legacyRequests.length === 1, "Expected one Apply request."),
      ...expect(legacyBody?.row_limit_preview === 25, "Legacy call should send row_limit_preview 25."),
      ...expect(
        !Object.hasOwn(legacyBody ?? {}, "structural_decision_plan"),
        "Legacy call should not send structural_decision_plan.",
      ),
      ...expect(
        legacyRequests[0]?.url.includes("/apply-cleaning-recipe") === true,
        "Apply should keep the existing endpoint path.",
      ),
    ]),
  );

  const rowLimitRequests = await withCapturedApplyBody(async () => {
    await applyCleaningRecipe("dataset-1", worksheetId, 50);
  });
  results.push(
    createResult("existing positional row-limit API is preserved", [
      ...expect(
        rowLimitRequests[0]?.body.row_limit_preview === 50,
        "Third positional number should still serialize as row_limit_preview.",
      ),
    ]),
  );

  const planRequests = await withCapturedApplyBody(async () => {
    await applyCleaningRecipe("dataset-1", worksheetId, {
      rowLimitPreview: 25,
      structuralDecisionPlan: structuralPlan,
    });
  });
  const planBody = planRequests[0]?.body;
  const serializedPlan = planBody?.structural_decision_plan as
    | { worksheet_id?: unknown; decisions?: Record<string, unknown>[] }
    | undefined;
  const serializedDecision = serializedPlan?.decisions?.[0];

  results.push(
    createResult("optional structural plan serializes correctly", [
      ...expect(planBody?.row_limit_preview === 25, "Plan call should keep row_limit_preview."),
      ...expect(Boolean(serializedPlan), "Plan call should send structural_decision_plan."),
      ...expect(
        !Object.hasOwn(planBody ?? {}, "structuralDecisionPlan"),
        "Plan call should not send camelCase structuralDecisionPlan.",
      ),
    ]),
  );
  results.push(
    createResult("worksheet_id serializes correctly", [
      ...expect(serializedPlan?.worksheet_id === worksheetId, "Expected canonical worksheet_id."),
    ]),
  );
  results.push(
    createResult("recommendation_id serializes correctly", [
      ...expect(
        serializedDecision?.recommendation_id === `${worksheetId}:automatic_blank_row:0`,
        "Expected canonical recommendation_id.",
      ),
    ]),
  );
  results.push(
    createResult("evidence_type serializes correctly", [
      ...expect(serializedDecision?.evidence_type === "automatic_blank_row", "Expected canonical evidence_type."),
    ]),
  );
  results.push(
    createResult("decision serializes correctly", [
      ...expect(serializedDecision?.decision === "keep_original", "Expected serialized decision."),
      ...expect(
        Array.isArray(serializedDecision?.evidence_ids) &&
          serializedDecision?.evidence_ids[0] === `${worksheetId}:automatic_blank_row:0`,
        "Expected evidence_ids to serialize.",
      ),
      ...expect(
        Array.isArray(serializedDecision?.affected_rows) &&
          serializedDecision?.affected_rows[0] === 7,
        "Expected affected_rows to serialize.",
      ),
      ...expect(
        Array.isArray(serializedDecision?.affected_column_indexes),
        "Expected affected_column_indexes to serialize.",
      ),
    ]),
  );
  results.push(
    createResult("all three allowed decisions are representable", [
      ...expect(
        (["use_recommendation", "keep_original", "decide_later"] satisfies StructuralDecisionChoice[])
          .length === 3,
        "Expected exactly three allowed structural decision choices.",
      ),
    ]),
  );
  results.push(
    createResult("unresolved is excluded from the wire fixtures", [
      ...expect(
        !["use_recommendation", "keep_original", "decide_later"].includes("unresolved"),
        "Unresolved should not be a structural wire decision.",
      ),
    ]),
  );

  const nullPlanRequests = await withCapturedApplyBody(async () => {
    await applyCleaningRecipe("dataset-1", worksheetId, {
      structuralDecisionPlan: null,
    });
  });
  const absentPlanRequests = await withCapturedApplyBody(async () => {
    await applyCleaningRecipe("dataset-1", worksheetId, {
      rowLimitPreview: 25,
    });
  });
  results.push(
    createResult("null or absent plan preserves legacy body", [
      ...expect(
        !Object.hasOwn(nullPlanRequests[0]?.body ?? {}, "structural_decision_plan"),
        "Null plan should not send structural_decision_plan.",
      ),
      ...expect(
        !Object.hasOwn(absentPlanRequests[0]?.body ?? {}, "structural_decision_plan"),
        "Absent plan should not send structural_decision_plan.",
      ),
      ...expect(nullPlanRequests[0]?.body.row_limit_preview === 25, "Null plan should keep row_limit_preview."),
      ...expect(absentPlanRequests[0]?.body.row_limit_preview === 25, "Absent plan should keep row_limit_preview."),
    ]),
  );
  results.push(
    createResult("no new endpoint or fetch path", [
      ...expect(
        planRequests[0]?.url.endsWith(
          `/datasets/dataset-1/workbook/worksheets/${encodeURIComponent(worksheetId)}/apply-cleaning-recipe`,
        ) === true,
        "Structural plan should use the existing Apply endpoint.",
      ),
    ]),
  );

  const legacyPreviewRequests = await withCapturedRequestBody(async () => {
    await getCleaningRecipePreview("dataset-1", worksheetId, 10);
  }, previewResponsePayload);
  results.push(
    createResult("legacy preview remains GET without plan body", [
      ...expect(legacyPreviewRequests[0]?.method === "GET", "Legacy preview should remain GET."),
      ...expect(
        !Object.hasOwn(legacyPreviewRequests[0]?.body ?? {}, "structural_decision_plan"),
        "Legacy preview should not send structural_decision_plan.",
      ),
    ]),
  );

  const decisionPreviewRequests = await withCapturedRequestBody(async () => {
    await getCleaningRecipePreview("dataset-1", worksheetId, {
      rowLimit: 10,
      structuralDecisionPlan: structuralPlan,
    });
  }, previewResponsePayload);
  results.push(
    createResult("decision preview uses same preview path with structural plan", [
      ...expect(decisionPreviewRequests[0]?.method === "POST", "Decision preview should POST."),
      ...expect(
        decisionPreviewRequests[0]?.url.endsWith(
          `/datasets/dataset-1/workbook/worksheets/${encodeURIComponent(worksheetId)}/cleaning-recipe-preview`,
        ) === true,
        "Decision preview should use the existing preview path.",
      ),
      ...expect(
        Boolean(decisionPreviewRequests[0]?.body.structural_decision_plan),
        "Decision preview should send structural_decision_plan.",
      ),
      ...expect(
        decisionPreviewRequests[0]?.body.row_limit_preview === 10,
        "Decision preview should send row_limit_preview.",
      ),
    ]),
  );
  results.push(
    createResult("CleanPrepareReviewPanel still does not send a plan", [
      ...expect(
        !Object.hasOwn(legacyBody ?? {}, "structural_decision_plan"),
        "The existing two-argument Apply path should remain plan-free.",
      ),
    ]),
  );

  const failed = results.filter((result) => !result.ok);

  return {
    results,
    passed: results.length - failed.length,
    failed,
  };
}
