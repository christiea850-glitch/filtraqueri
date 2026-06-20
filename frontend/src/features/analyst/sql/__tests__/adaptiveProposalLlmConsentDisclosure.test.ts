/**
 * T-13M-12 - Inspect SQL compact LLM provider-boundary disclosure fixtures.
 *
 * Pure fixture runner only. No provider calls, SQL generation, SQL rendering,
 * Monaco insertion, Run Query calls, backend/API calls, or execution behavior.
 */

import type { DatasetMetadata, SchemaColumn } from "../../../dataset/datasetTypes";
import type { AnalysisScopeSelection } from "../../../workbook";
import {
  createBusinessSqlPreviewAdaptiveReportProposalFallback,
  type AdaptiveReportProposalFallbackState,
} from "../adaptiveReportProposalUiAdapter";
import type { BusinessSqlRenderPreview } from "../businessSqlRenderPreview";
import {
  ADAPTIVE_PROPOSAL_LLM_DISCLOSURE_COPY,
  createAdaptiveProposalLlmConsentDisclosureRenderModel,
  serializeAdaptiveProposalLlmConsentDisclosureForAudit,
  shouldShowAdaptiveProposalLlmConsentDisclosure,
} from "../AdaptiveProposalLlmConsentDisclosure";
import { createAdaptiveProposalLlmConsentShellViewModel } from "../adaptiveProposalLlmConsentShellAdapter";
import type { AdaptiveProposalLlmConsentShellViewModel } from "../adaptiveProposalLlmConsentShellAdapter";

type FixtureResult = {
  name: string;
  ok: boolean;
  failureReasons: string[];
};

export type AdaptiveProposalLlmConsentDisclosureFixtureReport = {
  results: FixtureResult[];
  passed: FixtureResult[];
  failed: FixtureResult[];
};

type DisclosureScenario = {
  fallback: AdaptiveReportProposalFallbackState;
  model: AdaptiveProposalLlmConsentShellViewModel | null;
  visible: boolean;
};

type Fixture = {
  name: string;
  scenario: DisclosureScenario;
  assert: (scenario: DisclosureScenario) => string[];
};

const RAW_SAMPLE = "raw sample should not render in inspect disclosure";
const RAW_TOP_VALUE = "raw top value should not render in inspect disclosure";
const RAW_PROMPT = "show order totals by raw inspect prompt text";
const RAW_ROW = "raw row should not render in inspect disclosure";
const RAW_SQL = "select * from inspect_orders";
const RAW_RESULT = "query result should not render in inspect disclosure";
const RAW_CLIPBOARD = "clipboard should not render in inspect disclosure";
const RAW_API_KEY = "sk-inspect-api-key-should-not-render";
const RAW_PROVIDER_RESPONSE = "raw provider response should not render in inspect disclosure";

const column = (
  name: string,
  inferred_type: SchemaColumn["inferred_type"] = "text",
): SchemaColumn => ({
  name,
  type: inferred_type,
  inferred_type,
  null_count: 0,
  unique_count: 10,
  sample_values: [RAW_SAMPLE],
  top_values: [{ value: RAW_TOP_VALUE, count: 3 }],
});

const dataset: DatasetMetadata = {
  dataset_id: "dataset:inspect-orders",
  filename: "inspect-orders.csv",
  original_filename: "inspect-orders.csv",
  table_name: "orders",
  uploaded_at: "2026-01-01T00:00:00.000Z",
  row_count: 50,
  column_count: 3,
  schema: [
    column("order_id", "numeric"),
    column("status", "categorical"),
    column("order_total", "numeric"),
  ],
};

const scope: AnalysisScopeSelection[] = [
  {
    worksheetId: dataset.dataset_id,
    sourceType: "original",
    tableName: dataset.table_name,
    originalTableName: dataset.table_name,
  },
];

const preview = (
  status: BusinessSqlRenderPreview["status"],
  sql: string | null = null,
): BusinessSqlRenderPreview => ({
  status,
  title: status === "ready" ? "SQL preview ready" : "SQL preview not ready",
  body: status === "ready" ? "Rendered SQL is available." : "SQL cannot be previewed yet.",
  sql,
  planId: `preview:${status}:${sql ? "sql" : "none"}`,
  rendererTarget: "duckdb",
  guidanceDialect: "duckdb",
  reasons: status === "ready" ? ["Rendered safely."] : ["Needs more metadata."],
  warnings: [],
  actions: {
    canCopySql: status === "ready" && Boolean(sql),
    canInsertSql: false,
    canRunSql: false,
  },
});

const blockedPreview = preview("blocked");
const readyPreview = preview("ready", RAW_SQL);

const createScenario = ({
  taskPrompt = RAW_PROMPT,
  businessSqlRenderPreview = blockedPreview,
  activeSqlDraft = "",
}: {
  taskPrompt?: string;
  businessSqlRenderPreview?: BusinessSqlRenderPreview | null;
  activeSqlDraft?: string;
} = {}): DisclosureScenario => {
  const fallback = createBusinessSqlPreviewAdaptiveReportProposalFallback({
    taskPrompt,
    dataset,
    selectedDialect: "duckdb",
    appliedScopeSelections: scope,
    preview: businessSqlRenderPreview,
  });
  const model = fallback.proposal
    ? createAdaptiveProposalLlmConsentShellViewModel({
        proposal: fallback.proposal,
        dataset,
        selectedGuidanceDialect: "duckdb",
      })
    : null;
  const visible = shouldShowAdaptiveProposalLlmConsentDisclosure({
    model,
    businessSqlRenderPreview,
    activeSqlDraft,
  });

  return { fallback, model, visible };
};

const serializeDisclosure = (scenario: DisclosureScenario): string =>
  scenario.model ? serializeAdaptiveProposalLlmConsentDisclosureForAudit(scenario.model) : "";

const expectVisibleDisclosureSafety = (scenario: DisclosureScenario): string[] => {
  if (!scenario.visible || !scenario.model) return ["Expected visible Inspect SQL disclosure."];

  const renderModel = createAdaptiveProposalLlmConsentDisclosureRenderModel(scenario.model);
  return [
    ...(renderModel.statusLabel === "Provider disabled" ? [] : ["Expected provider-disabled status."]),
    ...(renderModel.providerCallMade === false ? [] : ["Disclosure must not call provider."]),
    ...(renderModel.noSqlGenerated === true ? [] : ["Disclosure must not generate SQL."]),
    ...(renderModel.noInsertAvailable === true ? [] : ["Disclosure must not expose insert capability."]),
    ...(renderModel.noRunAvailable === true ? [] : ["Disclosure must not expose run capability."]),
    ...(scenario.model.providerCallMade === false ? [] : ["Shared model must not call provider."]),
    ...(scenario.model.noSqlGenerated === true ? [] : ["Shared model must preserve no SQL generation."]),
    ...(scenario.model.noInsertAvailable === true ? [] : ["Shared model must preserve no insert."]),
    ...(scenario.model.noRunAvailable === true ? [] : ["Shared model must preserve no run."]),
  ];
};

const expectNoRawDisclosureContent = (scenario: DisclosureScenario): string[] => {
  const serialized = serializeDisclosure(scenario);
  const forbidden = [
    RAW_SAMPLE,
    RAW_TOP_VALUE,
    RAW_PROMPT,
    RAW_ROW,
    RAW_SQL,
    RAW_RESULT,
    RAW_CLIPBOARD,
    RAW_API_KEY,
    RAW_PROVIDER_RESPONSE,
  ];
  return forbidden.some((value) => serialized.includes(value))
    ? ["Inspect SQL disclosure leaked raw prompt/rows/samples/SQL/results/clipboard/API/provider response."]
    : [];
};

const fixtures: Fixture[] = [
  {
    name: "Inspect SQL compact disclosure appears when Business SQL Preview fallback exists",
    scenario: createScenario(),
    assert: (scenario) => [
      ...(scenario.fallback.shouldShow ? [] : ["Expected adaptive fallback to show."]),
      ...(scenario.fallback.proposal ? [] : ["Expected fallback proposal."]),
      ...expectVisibleDisclosureSafety(scenario),
    ],
  },
  {
    name: "Inspect SQL compact disclosure is hidden when Business SQL Preview is ready and renderable",
    scenario: createScenario({ businessSqlRenderPreview: readyPreview }),
    assert: (scenario) => [
      ...(scenario.visible === false ? [] : ["Expected ready/renderable preview to hide disclosure."]),
      ...(scenario.model === null ? [] : ["Expected ready/renderable preview to suppress fallback proposal."]),
    ],
  },
  {
    name: "Inspect SQL compact disclosure is hidden when fallback has no proposal",
    scenario: createScenario({ taskPrompt: "" }),
    assert: (scenario) => [
      ...(scenario.fallback.proposal === null ? [] : ["Expected no fallback proposal."]),
      ...(scenario.visible === false ? [] : ["Expected no disclosure without proposal."]),
    ],
  },
  {
    name: "Inspect SQL compact disclosure is hidden when active editor draft is non-empty",
    scenario: createScenario({ activeSqlDraft: RAW_SQL }),
    assert: (scenario) => [
      ...(scenario.fallback.proposal ? [] : ["Expected fallback proposal before draft visibility check."]),
      ...(scenario.visible === false ? [] : ["Expected non-empty editor draft to hide disclosure."]),
    ],
  },
  {
    name: "Inspect SQL compact disclosure reuses consent shell adapter view model",
    scenario: createScenario(),
    assert: (scenario) => [
      ...(scenario.model?.ctaDisabled === true ? [] : ["Expected shared shell model."]),
      ...(scenario.model?.payloadSummary.providerMode === "provider_disabled"
        ? []
        : ["Expected shared provider-disabled model."]),
      ...expectVisibleDisclosureSafety(scenario),
    ],
  },
  {
    name: "Inspect SQL compact disclosure exposes no CTA",
    scenario: createScenario(),
    assert: (scenario) => {
      const serialized = serializeDisclosure(scenario);
      return [
        ...(serialized.includes("Use metadata-only AI refinement")
          ? ["Inspect SQL disclosure must not expose CTA text."]
          : []),
        ...(serialized.includes("ctaLabel") || serialized.includes("ctaDisabled")
          ? ["Inspect SQL disclosure must not expose CTA fields."]
          : []),
        ...expectVisibleDisclosureSafety(scenario),
      ];
    },
  },
  {
    name: "Inspect SQL compact disclosure shows metadata-only copy",
    scenario: createScenario(),
    assert: (scenario) => [
      ...(serializeDisclosure(scenario).includes(
        "Metadata only. No raw rows, sample values, prompt text, SQL drafts, or query results.",
      )
        ? []
        : ["Expected metadata-only copy."]),
    ],
  },
  {
    name: "Inspect SQL compact disclosure shows non-SQL copy",
    scenario: createScenario(),
    assert: (scenario) => [
      ...(serializeDisclosure(scenario).includes(
        ADAPTIVE_PROPOSAL_LLM_DISCLOSURE_COPY.nonSqlWarning,
      )
        ? []
        : ["Expected non-SQL disclosure copy."]),
    ],
  },
  {
    name: "Inspect SQL compact disclosure shows provider-disabled no-data-sent copy",
    scenario: createScenario(),
    assert: (scenario) => [
      ...(serializeDisclosure(scenario).includes("Provider access is disabled. No data has been sent.")
        ? []
        : ["Expected no-data-sent copy."]),
    ],
  },
  {
    name: "Inspect SQL payload summary is counts, fingerprint, mode, and status only",
    scenario: createScenario(),
    assert: (scenario) => {
      if (!scenario.model) return ["Expected disclosure model."];
      const summary = createAdaptiveProposalLlmConsentDisclosureRenderModel(scenario.model).payloadSummary;
      return [
        ...(summary.tables === "1" ? [] : ["Expected table count."]),
        ...(Number(summary.includedColumns) > 0 ? [] : ["Expected included column count."]),
        ...(summary.payloadFingerprint ? [] : ["Expected payload fingerprint."]),
        ...(summary.providerMode === "provider_disabled" ? [] : ["Expected provider mode."]),
        ...(summary.consentStatus === "required" ? [] : ["Expected consent status."]),
      ];
    },
  },
  {
    name: "Inspect SQL compact disclosure does not leak raw provider-boundary content",
    scenario: createScenario(),
    assert: (scenario) => [
      ...expectNoRawDisclosureContent(scenario),
      ...expectVisibleDisclosureSafety(scenario),
    ],
  },
  {
    name: "Inspect SQL compact disclosure does not mutate proposal",
    scenario: (() => {
      const scenario = createScenario();
      if (!scenario.fallback.proposal) return scenario;
      const before = JSON.stringify(scenario.fallback.proposal);
      if (scenario.model) createAdaptiveProposalLlmConsentDisclosureRenderModel(scenario.model);
      return JSON.stringify(scenario.fallback.proposal) === before
        ? scenario
        : { ...scenario, visible: false };
    })(),
    assert: (scenario) =>
      scenario.visible ? expectVisibleDisclosureSafety(scenario) : ["Proposal was mutated."],
  },
  {
    name: "Inspect SQL compact disclosure exposes no SQL generation render insert or run capability",
    scenario: createScenario(),
    assert: expectVisibleDisclosureSafety,
  },
  {
    name: "Inspect SQL compact disclosure keeps payload exclusion copy visible",
    scenario: createScenario(),
    assert: (scenario) => [
      ...(serializeDisclosure(scenario).includes(
        "Not sent: raw rows, sample values, top values, raw prompt text, SQL drafts, query results, clipboard content, API keys, or provider responses.",
      )
        ? []
        : ["Expected payload exclusion copy."]),
    ],
  },
];

export function runAdaptiveProposalLlmConsentDisclosureFixtures(): AdaptiveProposalLlmConsentDisclosureFixtureReport {
  const results = fixtures.map((fixture) => {
    const failureReasons = fixture.assert(fixture.scenario);
    return {
      name: fixture.name,
      ok: failureReasons.length === 0,
      failureReasons,
    };
  });

  return {
    results,
    passed: results.filter((result) => result.ok),
    failed: results.filter((result) => !result.ok),
  };
}

export const allAdaptiveProposalLlmConsentDisclosureFixturesPass = (): boolean =>
  runAdaptiveProposalLlmConsentDisclosureFixtures().failed.length === 0;
