/**
 * T-11D-1 — deterministic SQL execution error formatter fixtures.
 *
 * The project does not currently include a dedicated test runner. This file
 * mirrors the existing fixture convention: it exports deterministic fixture
 * data plus a pure runner that performs no I/O and never exits the process.
 */

import {
  formatSqlExecutionError,
  type FormatSqlExecutionErrorInput,
  type SqlExecutionErrorCategory,
} from "../sqlErrorFormatter.ts";

type SqlErrorFormatterFixture = {
  name: string;
  input: FormatSqlExecutionErrorInput;
  expectedCategory: SqlExecutionErrorCategory;
  expectedToken?: string;
  expectedRawMessage?: string;
};

type SqlErrorFormatterFixtureResult = {
  name: string;
  ok: boolean;
  category: SqlExecutionErrorCategory;
  failureReasons: string[];
};

export type SqlErrorFormatterFixtureReport = {
  results: SqlErrorFormatterFixtureResult[];
  passed: SqlErrorFormatterFixtureResult[];
  failed: SqlErrorFormatterFixtureResult[];
};

export const SQL_ERROR_FORMATTER_FIXTURES: SqlErrorFormatterFixture[] = [
  {
    name: "Catalog Error table missing maps to table_not_found",
    input: {
      rawMessage: 'Query failed: Catalog Error: Table with name sales_2024 does not exist! Did you mean "sales"?',
      sqlText: "SELECT * FROM sales_2024;",
      availableTables: ["sales", "customers"],
      activeTable: "sales",
    },
    expectedCategory: "table_not_found",
    expectedToken: "sales_2024",
  },
  {
    name: "Binder Error column missing maps to column_not_found",
    input: {
      rawMessage: 'Query failed: Binder Error: Referenced column "custmer_id" not found in FROM clause! Candidate bindings: "customer_id", "order_id"',
      sqlText: "SELECT custmer_id FROM orders;",
      availableColumns: ["customer_id", "order_id"],
    },
    expectedCategory: "column_not_found",
    expectedToken: "custmer_id",
  },
  {
    name: "Parser Error syntax near token maps to parser_error with token",
    input: {
      rawMessage: 'Query failed: Parser Error: syntax error at or near "FROM"',
      sqlText: "SELECT FROM orders;",
    },
    expectedCategory: "parser_error",
    expectedToken: "FROM",
  },
  {
    name: "SELECT-only validation with CTE maps to cte_select_first_validation",
    input: {
      rawMessage: "Only SELECT queries are allowed",
      sqlText: "WITH recent_orders AS (SELECT * FROM orders) SELECT * FROM recent_orders;",
    },
    expectedCategory: "cte_select_first_validation",
    expectedToken: "WITH",
  },
  {
    name: "Only one SELECT statement validation maps to multi_statement",
    input: {
      rawMessage: "Only one SELECT statement is allowed",
      sqlText: "SELECT * FROM orders; SELECT * FROM customers;",
    },
    expectedCategory: "multi_statement",
    expectedToken: ";",
  },
  {
    name: "DROP validation maps to blocked_statement",
    input: {
      rawMessage: "DROP statements are not allowed",
      sqlText: "DROP TABLE orders;",
    },
    expectedCategory: "blocked_statement",
    expectedToken: "DROP",
  },
  {
    name: "ROWNUM maps to dialect_mismatch",
    input: {
      rawMessage: "Query failed: Binder Error: Referenced column ROWNUM not found",
      sqlText: "SELECT * FROM orders WHERE ROWNUM <= 10;",
      selectedDialect: "duckdb",
    },
    expectedCategory: "dialect_mismatch",
    expectedToken: "ROWNUM",
  },
  {
    name: "TOP 10 maps to dialect_mismatch",
    input: {
      rawMessage: 'Query failed: Parser Error: syntax error at or near "10"',
      sqlText: "SELECT TOP 10 * FROM orders;",
      selectedDialect: "duckdb",
    },
    expectedCategory: "dialect_mismatch",
    expectedToken: "TOP 10",
  },
  {
    name: "DATEADD maps to dialect_mismatch",
    input: {
      rawMessage: "Query failed: Parser Error: syntax error near DATEADD",
      sqlText: "SELECT DATEADD(day, 7, order_date) FROM orders;",
    },
    expectedCategory: "dialect_mismatch",
    expectedToken: "DATEADD(",
  },
  {
    name: "TO_DATE maps to dialect_mismatch",
    input: {
      rawMessage: "Query failed: Parser Error: function not found",
      sqlText: "SELECT TO_DATE(order_date, 'YYYY-MM-DD') FROM orders;",
    },
    expectedCategory: "dialect_mismatch",
    expectedToken: "TO_DATE(",
  },
  {
    name: "NVL maps to dialect_mismatch",
    input: {
      rawMessage: "Query failed: Catalog Error: Scalar Function with name nvl does not exist",
      sqlText: "SELECT NVL(customer_name, 'Unknown') FROM customers;",
    },
    expectedCategory: "dialect_mismatch",
    expectedToken: "NVL(",
  },
  {
    name: "ISNULL maps to dialect_mismatch",
    input: {
      rawMessage: "Query failed: Parser Error: syntax error near ISNULL",
      sqlText: "SELECT ISNULL(customer_name, 'Unknown') FROM customers;",
    },
    expectedCategory: "dialect_mismatch",
    expectedToken: "ISNULL(",
  },
  {
    name: "Unknown raw error maps to unknown and preserves rawMessage",
    input: {
      rawMessage: "Query failed: unexpected runtime edge case",
      sqlText: "SELECT * FROM orders;",
    },
    expectedCategory: "unknown",
    expectedRawMessage: "Query failed: unexpected runtime edge case",
  },
];

const expect = (
  condition: boolean,
  failureReason: string,
  failureReasons: string[],
) => {
  if (!condition) failureReasons.push(failureReason);
};

export function runSqlErrorFormatterFixtures(): SqlErrorFormatterFixtureReport {
  const results = SQL_ERROR_FORMATTER_FIXTURES.map((fixture) => {
    const insight = formatSqlExecutionError(fixture.input);
    const failureReasons: string[] = [];

    expect(
      insight.category === fixture.expectedCategory,
      `Expected category ${fixture.expectedCategory}, received ${insight.category}.`,
      failureReasons,
    );

    if (fixture.expectedToken) {
      expect(
        insight.likelyLocation?.token === fixture.expectedToken,
        `Expected token ${fixture.expectedToken}, received ${insight.likelyLocation?.token || "none"}.`,
        failureReasons,
      );
    }

    if (fixture.expectedRawMessage) {
      expect(
        insight.rawMessage === fixture.expectedRawMessage,
        "Expected rawMessage to be preserved exactly.",
        failureReasons,
      );
    }

    expect(
      insight.suggestions.every((suggestion) => !/^replace\b/i.test(suggestion.trim())),
      "Suggestions must not use automatic Replace-with language.",
      failureReasons,
    );

    return {
      name: fixture.name,
      ok: failureReasons.length === 0,
      category: insight.category,
      failureReasons,
    };
  });

  return {
    results,
    passed: results.filter((result) => result.ok),
    failed: results.filter((result) => !result.ok),
  };
}
