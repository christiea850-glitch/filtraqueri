import { duckDbDialectProfile } from "./duckdb";
import { mariaDbDialectProfile } from "./mariadb";
import { oracleDialectProfile } from "./oracle";
import type { SqlDialectId, SqlDialectProfile } from "../types";

export const sqlDialectProfiles: Record<SqlDialectId, SqlDialectProfile> = {
  duckdb: duckDbDialectProfile,
  mariadb: mariaDbDialectProfile,
  oracle: oracleDialectProfile,
};

export const getDialectProfile = (dialectId: SqlDialectId): SqlDialectProfile =>
  sqlDialectProfiles[dialectId];

export const listSupportedDialects = (): SqlDialectProfile[] =>
  Object.values(sqlDialectProfiles);

export { duckDbDialectProfile } from "./duckdb";
export { mariaDbDialectProfile } from "./mariadb";
export { oracleDialectProfile } from "./oracle";
