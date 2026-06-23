/**
 * T-23B/T-23C - Relationship confirmation type and state helper fixtures.
 *
 * Pure fixture runner only. This does not render SQL, insert SQL into Monaco,
 * execute queries, call providers, call backend APIs, or mutate app state.
 */

import {
  SQL_RELATIONSHIP_CONFIRMATION_SAFETY_FLAGS,
  addSqlConfirmedRelationship,
  clearSqlRelationshipConfirmationState,
  createEmptySqlRelationshipConfirmationState,
  createSqlConfirmedRelationshipFromSuggestion,
  createSqlRelationshipId,
  findSqlConfirmedRelationshipForEndpoints,
  invalidateSqlRelationshipConfirmations,
  isSqlConfirmedRelationshipActive,
  isSqlRelationshipSchemaBacked,
  rejectSqlRelationshipSuggestion,
  removeSqlConfirmedRelationship,
  type SqlConfirmedWorksheetRelationship,
} from "../sqlRelationshipConfirmation";

type RelationshipConfirmationFixtureResult = {
  name: string;
  ok: boolean;
  failureReasons: string[];
};

export type RelationshipConfirmationFixtureReport = {
  results: RelationshipConfirmationFixtureResult[];
  passed: RelationshipConfirmationFixtureResult[];
  failed: RelationshipConfirmationFixtureResult[];
};

const confirmedRelationship = (
  overrides: Partial<SqlConfirmedWorksheetRelationship> = {},
): SqlConfirmedWorksheetRelationship => ({
  relationshipId: createSqlRelationshipId(
    {
      worksheetId: "worksheet:units",
      tableName: "units",
      column: "unit_id",
    },
    {
      worksheetId: "worksheet:access_codes",
      tableName: "access_codes",
      column: "unit_id",
    },
  ),
  fromWorksheetId: "worksheet:units",
  fromWorksheetLabel: "Units",
  fromTableName: "units",
  fromColumn: "unit_id",
  toWorksheetId: "worksheet:access_codes",
  toWorksheetLabel: "Access Codes",
  toTableName: "access_codes",
  toColumn: "unit_id",
  cardinality: "one_to_many",
  confidence: 0.92,
  status: "confirmed",
  confirmedAt: "2026-01-01T00:00:00.000Z",
  confirmedByUser: true,
  scope: "workbook",
  source: "inferred_then_confirmed",
  acceptedFromCandidateId: "candidate:units-access-codes",
  workbookId: "workbook:property",
  datasetId: "dataset:property",
  ...SQL_RELATIONSHIP_CONFIRMATION_SAFETY_FLAGS,
  ...overrides,
});

const fixtures: Array<{
  name: string;
  run: () => string[];
}> = [
  {
    name: "confirmed relationship type supports workbook scope",
    run: () => {
      const relationship = confirmedRelationship();
      return [
        ...(relationship.scope === "workbook" ? [] : ["Expected workbook scope."]),
        ...(relationship.status === "confirmed" ? [] : ["Expected confirmed status."]),
        ...(relationship.confirmedByUser ? [] : ["Expected user confirmation flag."]),
      ];
    },
  },
  {
    name: "rejected relationship supports rejectedAt and is not active",
    run: () => {
      const relationship = confirmedRelationship({
        status: "rejected",
        confirmedAt: undefined,
        rejectedAt: "2026-01-02T00:00:00.000Z",
      });
      return [
        ...(relationship.rejectedAt ? [] : ["Expected rejectedAt timestamp."]),
        ...(!isSqlConfirmedRelationshipActive(relationship)
          ? []
          : ["Rejected relationship must not be active."]),
      ];
    },
  },
  {
    name: "deterministic relationship id is stable and direction independent",
    run: () => {
      const from = {
        worksheetId: "worksheet:units",
        tableName: "Units",
        column: "unit_id",
      };
      const to = {
        worksheetId: "worksheet:access_codes",
        tableName: "Access Codes",
        column: "unit_id",
      };
      const first = createSqlRelationshipId(from, to);
      const second = createSqlRelationshipId(to, from);
      return [
        ...(first === second ? [] : ["Expected relationship id to be direction independent."]),
        ...(first === createSqlRelationshipId(from, to) ? [] : ["Expected stable relationship id."]),
      ];
    },
  },
  {
    name: "schema-backed check returns true when both endpoint columns exist",
    run: () =>
      isSqlRelationshipSchemaBacked({
        fromColumn: "unit_id",
        fromColumns: ["unit_id", "unit_number"],
        toColumn: "unit_id",
        toColumns: [{ name: "unit_id" }, { name: "access_code" }],
      })
        ? []
        : ["Expected schema-backed relationship."],
  },
  {
    name: "schema-backed check returns false when either endpoint column is missing",
    run: () =>
      !isSqlRelationshipSchemaBacked({
        fromColumn: "tenant_id",
        fromColumns: ["unit_id", "unit_number"],
        toColumn: "unit_id",
        toColumns: ["unit_id", "access_code"],
      }) &&
      !isSqlRelationshipSchemaBacked({
        fromColumn: "unit_id",
        fromColumns: ["unit_id", "unit_number"],
        toColumn: "tenant_id",
        toColumns: ["unit_id", "access_code"],
      })
        ? []
        : ["Expected missing endpoint columns to fail schema-backed check."],
  },
  {
    name: "safety flags prohibit SQL generation, Run Query, backend calls, and allow removal",
    run: () => {
      const relationship = confirmedRelationship();
      return [
        ...(relationship.noSqlGeneratedOnConfirm ? [] : ["Expected no SQL generation flag."]),
        ...(relationship.noRunQueryOnConfirm ? [] : ["Expected no Run Query flag."]),
        ...(relationship.noBackendCallOnConfirm ? [] : ["Expected no backend call flag."]),
        ...(relationship.userCanRemove ? [] : ["Expected user removable flag."]),
        ...(relationship.schemaBackedColumns ? [] : ["Expected schema-backed flag."]),
        ...(relationship.invalidatedWhenWorksheetMissing
          ? []
          : ["Expected worksheet invalidation flag."]),
      ];
    },
  },
  {
    name: "empty confirmation state has no confirmed relationships or rejected suggestions",
    run: () => {
      const state = createEmptySqlRelationshipConfirmationState();
      return [
        ...(state.confirmedRelationships.length === 0
          ? []
          : ["Expected no confirmed relationships."]),
        ...(state.rejectedSuggestions.length === 0 ? [] : ["Expected no rejected suggestions."]),
        ...(Object.keys(state.invalidatedRelationshipIds).length === 0
          ? []
          : ["Expected no invalidated relationships."]),
      ];
    },
  },
  {
    name: "helpers are metadata-only and do not emit SQL or side-effect capabilities",
    run: () => {
      const id = createSqlRelationshipId(
        { worksheetId: "worksheet:units", tableName: "units", column: "unit_id" },
        {
          worksheetId: "worksheet:access_codes",
          tableName: "access_codes",
          column: "unit_id",
        },
      );
      const state = createEmptySqlRelationshipConfirmationState();
      const serialized = JSON.stringify({ id, state, flags: SQL_RELATIONSHIP_CONFIRMATION_SAFETY_FLAGS });
      const forbidden = ["SELECT ", "INSERT ", "UPDATE ", "DELETE ", "fetch(", "XMLHttpRequest"];
      return forbidden.some((token) => serialized.includes(token))
        ? ["Expected helpers to avoid SQL/backend/API capability output."]
        : [];
    },
  },
  {
    name: "adding a confirmed relationship stores it as active",
    run: () => {
      const relationship = confirmedRelationship();
      const state = addSqlConfirmedRelationship(
        createEmptySqlRelationshipConfirmationState(),
        relationship,
      );
      const found = findSqlConfirmedRelationshipForEndpoints(
        state,
        {
          worksheetId: relationship.fromWorksheetId,
          tableName: relationship.fromTableName,
          column: relationship.fromColumn,
        },
        {
          worksheetId: relationship.toWorksheetId,
          tableName: relationship.toTableName,
          column: relationship.toColumn,
        },
      );
      return [
        ...(state.confirmedRelationships.length === 1
          ? []
          : ["Expected one confirmed relationship."]),
        ...(found?.relationshipId === relationship.relationshipId
          ? []
          : ["Expected active relationship lookup."]),
      ];
    },
  },
  {
    name: "rejecting a relationship stores it as inactive rejected evidence",
    run: () => {
      const relationship = confirmedRelationship({
        status: "rejected",
        confirmedAt: undefined,
        rejectedAt: "2026-01-03T00:00:00.000Z",
      });
      const state = rejectSqlRelationshipSuggestion(
        createEmptySqlRelationshipConfirmationState(),
        relationship,
      );
      return [
        ...(state.confirmedRelationships.length === 0
          ? []
          : ["Rejected relationship must not remain confirmed."]),
        ...(state.rejectedSuggestions.length === 1
          ? []
          : ["Expected one rejected suggestion."]),
        ...(!isSqlConfirmedRelationshipActive(state.rejectedSuggestions[0]!)
          ? []
          : ["Rejected suggestion must not be active evidence."]),
      ];
    },
  },
  {
    name: "removing a confirmed relationship removes it from active state",
    run: () => {
      const relationship = confirmedRelationship();
      const added = addSqlConfirmedRelationship(
        createEmptySqlRelationshipConfirmationState(),
        relationship,
      );
      const removed = removeSqlConfirmedRelationship(added, relationship.relationshipId);
      return removed.confirmedRelationships.length === 0
        ? []
        : ["Expected confirmed relationship to be removed."];
    },
  },
  {
    name: "clearing state empties confirmed and rejected records",
    run: () => {
      const confirmed = confirmedRelationship();
      const rejected = confirmedRelationship({
        relationshipId: "sql-relationship:rejected",
        status: "rejected",
        confirmedAt: undefined,
        rejectedAt: "2026-01-04T00:00:00.000Z",
      });
      const state = rejectSqlRelationshipSuggestion(
        addSqlConfirmedRelationship(createEmptySqlRelationshipConfirmationState(), confirmed),
        rejected,
      );
      const cleared = clearSqlRelationshipConfirmationState(state);
      return [
        ...(cleared.confirmedRelationships.length === 0
          ? []
          : ["Expected no confirmed relationships after clear."]),
        ...(cleared.rejectedSuggestions.length === 0
          ? []
          : ["Expected no rejected suggestions after clear."]),
        ...(Object.keys(cleared.invalidatedRelationshipIds).length === 0
          ? []
          : ["Expected no invalidation records after clear."]),
      ];
    },
  },
  {
    name: "duplicate confirmations are deduped by relationship id",
    run: () => {
      const first = confirmedRelationship({ confidence: 0.8 });
      const second = confirmedRelationship({ confidence: 0.95 });
      const state = addSqlConfirmedRelationship(
        addSqlConfirmedRelationship(createEmptySqlRelationshipConfirmationState(), first),
        second,
      );
      return [
        ...(state.confirmedRelationships.length === 1
          ? []
          : ["Expected duplicate relationship id to be deduped."]),
        ...(state.confirmedRelationships[0]?.confidence === 0.95
          ? []
          : ["Expected latest relationship to replace earlier duplicate."]),
      ];
    },
  },
  {
    name: "invalidation marks relationships stale when workbook or dataset changes",
    run: () => {
      const relationship = confirmedRelationship();
      const state = addSqlConfirmedRelationship(
        createEmptySqlRelationshipConfirmationState(),
        relationship,
      );
      const datasetInvalidated = invalidateSqlRelationshipConfirmations(state, {
        datasetId: "dataset:other",
      });
      const workbookInvalidated = invalidateSqlRelationshipConfirmations(state, {
        workbookId: "workbook:other",
      });
      return [
        ...(datasetInvalidated.invalidatedRelationshipIds[relationship.relationshipId] ===
        "dataset_changed"
          ? []
          : ["Expected dataset changed invalidation."]),
        ...(workbookInvalidated.invalidatedRelationshipIds[relationship.relationshipId] ===
        "workbook_changed"
          ? []
          : ["Expected workbook changed invalidation."]),
      ];
    },
  },
  {
    name: "invalidation marks relationships stale when endpoint schema changes",
    run: () => {
      const relationship = confirmedRelationship();
      const state = addSqlConfirmedRelationship(
        createEmptySqlRelationshipConfirmationState(),
        relationship,
      );
      const invalidated = invalidateSqlRelationshipConfirmations(state, {
        datasetId: relationship.datasetId,
        workbookId: relationship.workbookId,
        worksheets: [
          {
            worksheetId: relationship.fromWorksheetId,
            tableName: relationship.fromTableName,
            columns: ["unit_number"],
          },
          {
            worksheetId: relationship.toWorksheetId,
            tableName: relationship.toTableName,
            columns: ["unit_id"],
          },
        ],
      });
      const found = findSqlConfirmedRelationshipForEndpoints(
        invalidated,
        {
          worksheetId: relationship.fromWorksheetId,
          tableName: relationship.fromTableName,
          column: relationship.fromColumn,
        },
        {
          worksheetId: relationship.toWorksheetId,
          tableName: relationship.toTableName,
          column: relationship.toColumn,
        },
      );
      return [
        ...(invalidated.invalidatedRelationshipIds[relationship.relationshipId] ===
        "column_missing"
          ? []
          : ["Expected column missing invalidation."]),
        ...(found === null ? [] : ["Invalidated relationship must not be active evidence."]),
      ];
    },
  },
  {
    name: "schema-backed creation blocks missing endpoint columns",
    run: () => {
      const created = createSqlConfirmedRelationshipFromSuggestion({
        from: {
          worksheetId: "worksheet:units",
          worksheetLabel: "Units",
          tableName: "units",
          column: "unit_id",
        },
        fromColumns: ["unit_number"],
        to: {
          worksheetId: "worksheet:access_codes",
          worksheetLabel: "Access Codes",
          tableName: "access_codes",
          column: "unit_id",
        },
        toColumns: ["unit_id"],
        scope: "workbook",
        source: "inferred_then_confirmed",
        confirmedAt: "2026-01-05T00:00:00.000Z",
      });
      return created === null
        ? []
        : ["Expected missing endpoint column to block relationship creation."];
    },
  },
  {
    name: "schema-backed creation produces confirmed safe metadata only",
    run: () => {
      const created = createSqlConfirmedRelationshipFromSuggestion({
        from: {
          worksheetId: "worksheet:units",
          worksheetLabel: "Units",
          tableName: "units",
          column: "unit_id",
        },
        fromColumns: ["unit_id"],
        to: {
          worksheetId: "worksheet:access_codes",
          worksheetLabel: "Access Codes",
          tableName: "access_codes",
          column: "unit_id",
        },
        toColumns: ["unit_id"],
        scope: "workbook",
        source: "inferred_then_confirmed",
        confirmedAt: "2026-01-05T00:00:00.000Z",
        workbookId: "workbook:property",
        datasetId: "dataset:property",
      });
      return [
        ...(created?.status === "confirmed" ? [] : ["Expected confirmed relationship."]),
        ...(created?.schemaBackedColumns ? [] : ["Expected schema-backed safety flag."]),
        ...(created?.noSqlGeneratedOnConfirm ? [] : ["Expected no SQL generation flag."]),
        ...(created?.noRunQueryOnConfirm ? [] : ["Expected no Run Query flag."]),
        ...(created?.noBackendCallOnConfirm ? [] : ["Expected no backend call flag."]),
      ];
    },
  },
  {
    name: "state helpers do not expose SQL, backend, Run Query, or editor mutation capability",
    run: () => {
      const relationship = confirmedRelationship();
      const state = addSqlConfirmedRelationship(
        createEmptySqlRelationshipConfirmationState(),
        relationship,
      );
      const rejected = rejectSqlRelationshipSuggestion(state, {
        ...relationship,
        relationshipId: "sql-relationship:reject-capability-check",
        status: "rejected",
        confirmedAt: undefined,
        rejectedAt: "2026-01-06T00:00:00.000Z",
      });
      const serialized = JSON.stringify({
        state,
        rejected,
        removed: removeSqlConfirmedRelationship(state, relationship.relationshipId),
        cleared: clearSqlRelationshipConfirmationState(rejected),
      });
      const forbidden = [
        "SELECT ",
        "INSERT ",
        "UPDATE ",
        "DELETE ",
        "fetch(",
        "XMLHttpRequest",
        "onRun",
        "onInsertSql",
        "editor",
      ];
      return forbidden.some((token) => serialized.includes(token))
        ? ["Expected state helpers to remain metadata-only."]
        : [];
    },
  },
];

export function runSqlRelationshipConfirmationFixtures(): RelationshipConfirmationFixtureReport {
  const results = fixtures.map((fixture) => {
    const failureReasons = fixture.run();
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
