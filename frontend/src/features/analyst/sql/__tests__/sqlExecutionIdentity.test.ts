import {
  createSqlExecutionContextIdentity,
  createSqlExecutionIdentity,
  doesSqlExecutionIdentityMatchContext,
} from "../sqlExecutionIdentity";

type FixtureResult = {
  name: string;
  ok: boolean;
  failureReasons: string[];
};

export type SqlExecutionIdentityFixtureReport = {
  results: FixtureResult[];
  passed: FixtureResult[];
  failed: FixtureResult[];
};

const assertEqual = (actual: unknown, expected: unknown, message: string) =>
  actual === expected ? [] : [`${message} Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}.`];

const assertThrows = (run: () => unknown, message: string) => {
  try {
    run();
  } catch {
    return [];
  }
  return [message];
};

export function runSqlExecutionIdentityFixtures(): SqlExecutionIdentityFixtureReport {
  const validIdentity = createSqlExecutionIdentity({
    requestId: "sql-run:1:abc",
    exactSql: "SELECT * FROM orders;",
    datasetId: "dataset-1",
    worksheetId: "worksheet-1",
  });
  const whitespaceTrimmedIdentity = createSqlExecutionIdentity({
    requestId: "sql-run:2:def",
    exactSql: "\n  SELECT * FROM orders;  \t",
    datasetId: "  dataset-1  ",
    worksheetId: "  worksheet-1  ",
  });
  const internalDifferenceIdentity = createSqlExecutionIdentity({
    requestId: "sql-run:3:ghi",
    exactSql: "SELECT  * FROM orders;",
    datasetId: "dataset-1",
    worksheetId: "worksheet-1",
  });
  const nullWorksheetIdentity = createSqlExecutionIdentity({
    requestId: "sql-run:4:jkl",
    exactSql: "SELECT * FROM uploaded_dataset;",
    datasetId: "dataset-csv",
    worksheetId: null,
  });

  const frozenInput = Object.freeze({
    requestId: "sql-run:5:mno",
    exactSql: "  SELECT status FROM orders;  ",
    datasetId: "  dataset-frozen  ",
    worksheetId: "  worksheet-frozen  ",
  });
  const frozenInputBefore = JSON.stringify(frozenInput);
  const frozenResult = createSqlExecutionIdentity(frozenInput);

  const fixtures: FixtureResult[] = [
    {
      name: "constructs a valid execution identity",
      failureReasons: [
        ...assertEqual(validIdentity.requestId, "sql-run:1:abc", "Request ID mismatch."),
        ...assertEqual(validIdentity.exactSql, "SELECT * FROM orders;", "SQL mismatch."),
        ...assertEqual(validIdentity.datasetId, "dataset-1", "Dataset mismatch."),
        ...assertEqual(validIdentity.worksheetId, "worksheet-1", "Worksheet mismatch."),
      ],
      ok: false,
    },
    {
      name: "trims leading and trailing SQL whitespace",
      failureReasons: assertEqual(
        whitespaceTrimmedIdentity.exactSql,
        "SELECT * FROM orders;",
        "Expected boundary whitespace to be trimmed.",
      ),
      ok: false,
    },
    {
      name: "preserves internal SQL differences",
      failureReasons: assertEqual(
        internalDifferenceIdentity.exactSql === validIdentity.exactSql,
        false,
        "Internal SQL formatting must remain significant.",
      ),
      ok: false,
    },
    {
      name: "allows null worksheet identity",
      failureReasons: assertEqual(nullWorksheetIdentity.worksheetId, null, "Worksheet should remain null."),
      ok: false,
    },
    {
      name: "rejects blank request ID",
      failureReasons: assertThrows(
        () => createSqlExecutionIdentity({
          requestId: " ",
          exactSql: "SELECT 1;",
          datasetId: "dataset-1",
          worksheetId: null,
        }),
        "Expected blank request ID to throw.",
      ),
      ok: false,
    },
    {
      name: "rejects blank SQL",
      failureReasons: assertThrows(
        () => createSqlExecutionContextIdentity({
          exactSql: "\n\t ",
          datasetId: "dataset-1",
          worksheetId: null,
        }),
        "Expected blank SQL to throw.",
      ),
      ok: false,
    },
    {
      name: "rejects blank dataset ID",
      failureReasons: assertThrows(
        () => createSqlExecutionContextIdentity({
          exactSql: "SELECT 1;",
          datasetId: " ",
          worksheetId: null,
        }),
        "Expected blank dataset ID to throw.",
      ),
      ok: false,
    },
    {
      name: "matches exact current context",
      failureReasons: assertEqual(
        doesSqlExecutionIdentityMatchContext(validIdentity, {
          exactSql: " SELECT * FROM orders; ",
          datasetId: "dataset-1",
          worksheetId: "worksheet-1",
        }),
        true,
        "Expected context to match.",
      ),
      ok: false,
    },
    {
      name: "detects SQL mismatch",
      failureReasons: assertEqual(
        doesSqlExecutionIdentityMatchContext(validIdentity, {
          exactSql: "SELECT id FROM orders;",
          datasetId: "dataset-1",
          worksheetId: "worksheet-1",
        }),
        false,
        "Expected SQL mismatch.",
      ),
      ok: false,
    },
    {
      name: "detects dataset mismatch",
      failureReasons: assertEqual(
        doesSqlExecutionIdentityMatchContext(validIdentity, {
          exactSql: "SELECT * FROM orders;",
          datasetId: "dataset-2",
          worksheetId: "worksheet-1",
        }),
        false,
        "Expected dataset mismatch.",
      ),
      ok: false,
    },
    {
      name: "detects worksheet mismatch",
      failureReasons: assertEqual(
        doesSqlExecutionIdentityMatchContext(validIdentity, {
          exactSql: "SELECT * FROM orders;",
          datasetId: "dataset-1",
          worksheetId: "worksheet-2",
        }),
        false,
        "Expected worksheet mismatch.",
      ),
      ok: false,
    },
    {
      name: "survives JSON round trip",
      failureReasons: assertEqual(
        JSON.stringify(JSON.parse(JSON.stringify(validIdentity))),
        JSON.stringify(validIdentity),
        "Expected JSON round trip to preserve identity.",
      ),
      ok: false,
    },
    {
      name: "does not mutate caller input",
      failureReasons: [
        ...assertEqual(JSON.stringify(frozenInput), frozenInputBefore, "Input object changed."),
        ...assertEqual(frozenResult.datasetId, "dataset-frozen", "Expected normalized copy."),
      ],
      ok: false,
    },
    {
      name: "excludes request ID from context freshness comparison",
      failureReasons: assertEqual(
        doesSqlExecutionIdentityMatchContext(
          { ...validIdentity, requestId: "sql-run:999:different" },
          {
            exactSql: validIdentity.exactSql,
            datasetId: validIdentity.datasetId,
            worksheetId: validIdentity.worksheetId,
          },
        ),
        true,
        "Request ID must not affect context matching.",
      ),
      ok: false,
    },
  ];

  const results = fixtures.map((fixture) => ({
    ...fixture,
    ok: fixture.failureReasons.length === 0,
  }));

  return {
    results,
    passed: results.filter((result) => result.ok),
    failed: results.filter((result) => !result.ok),
  };
}
