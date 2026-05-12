import type { SqlDialectId } from "../sqlIntelligence";
import {
  SQL_WORKSPACE_METADATA_VERSION,
  type SqlWorkspaceMetadataSnapshot,
} from "./sqlWorkspaceMetadataTypes";

const supportedDialects = new Set<SqlDialectId>(["duckdb", "mariadb", "oracle"]);

const isSqlDialectId = (value: unknown): value is SqlDialectId =>
  typeof value === "string" && supportedDialects.has(value as SqlDialectId);

export const createSqlWorkspaceMetadataSnapshot = ({
  selectedDialect = "duckdb",
  draftCount = 0,
  lastDraftSavedAt = null,
}: {
  selectedDialect?: SqlDialectId;
  draftCount?: number;
  lastDraftSavedAt?: string | null;
} = {}): SqlWorkspaceMetadataSnapshot => ({
  version: SQL_WORKSPACE_METADATA_VERSION,
  selectedDialect,
  activeSqlTab: "editor",
  lastOpenedContext: "sqlWorkspace",
  draftMetadata: {
    draftCount,
    lastDraftSavedAt,
  },
  updatedAt: new Date().toISOString(),
});

export const normalizeSqlWorkspaceMetadataSnapshot = (
  value: unknown,
): SqlWorkspaceMetadataSnapshot => {
  if (!value || typeof value !== "object") {
    return createSqlWorkspaceMetadataSnapshot();
  }

  const snapshot = value as Partial<SqlWorkspaceMetadataSnapshot>;
  const draftMetadata =
    snapshot.draftMetadata && typeof snapshot.draftMetadata === "object"
      ? snapshot.draftMetadata
      : null;

  return createSqlWorkspaceMetadataSnapshot({
    selectedDialect: isSqlDialectId(snapshot.selectedDialect)
      ? snapshot.selectedDialect
      : "duckdb",
    draftCount:
      typeof draftMetadata?.draftCount === "number" && Number.isFinite(draftMetadata.draftCount)
        ? Math.max(0, draftMetadata.draftCount)
        : 0,
    lastDraftSavedAt:
      typeof draftMetadata?.lastDraftSavedAt === "string"
        ? draftMetadata.lastDraftSavedAt
        : null,
  });
};

export const updateSqlWorkspaceDialect = (
  snapshot: SqlWorkspaceMetadataSnapshot,
  selectedDialect: SqlDialectId,
): SqlWorkspaceMetadataSnapshot => ({
  ...normalizeSqlWorkspaceMetadataSnapshot(snapshot),
  selectedDialect,
  updatedAt: new Date().toISOString(),
});

export const updateSqlWorkspaceDraftMetadata = (
  snapshot: SqlWorkspaceMetadataSnapshot,
  draftMetadata: SqlWorkspaceMetadataSnapshot["draftMetadata"],
): SqlWorkspaceMetadataSnapshot => ({
  ...normalizeSqlWorkspaceMetadataSnapshot(snapshot),
  draftMetadata,
  updatedAt: new Date().toISOString(),
});
