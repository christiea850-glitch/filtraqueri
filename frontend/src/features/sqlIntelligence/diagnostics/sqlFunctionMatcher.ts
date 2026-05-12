import { getFunctionCompatibility } from "../functions";
import type { SqlFunctionCompatibility } from "../types";

export type SqlFunctionMatch = {
  functionName: string;
  start: number;
  end: number;
  compatibility: SqlFunctionCompatibility;
  isNested: boolean;
};

const functionCallPattern = /\b([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;

const hasFunctionBefore = (sqlPrefix: string) => /\b[A-Za-z_][A-Za-z0-9_]*\s*\([^)]*$/i.test(sqlPrefix);

export const matchSqlFunctions = (sql: string): SqlFunctionMatch[] =>
  [...sql.matchAll(functionCallPattern)]
    .map((match) => {
      const functionName = match[1].toUpperCase();
      const compatibility = getFunctionCompatibility(functionName);
      if (!compatibility) return null;

      const start = match.index || 0;
      return {
        functionName,
        start,
        end: start + match[0].length,
        compatibility,
        isNested: hasFunctionBefore(sql.slice(0, start)),
      };
    })
    .filter((match): match is SqlFunctionMatch => Boolean(match));
