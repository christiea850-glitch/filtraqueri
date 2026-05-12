import type { SqlDialectId } from "../sqlIntelligence";
import {
  MAX_SQL_DRAFT_SNAPSHOTS,
  MAX_SQL_DRAFT_TEXT_LENGTH,
  SQL_DRAFT_SNAPSHOT_VERSION,
  SQL_WORKSPACE_METADATA_VERSION,
  type SqlDraftSnapshot,
  type SqlWorkspaceMetadataSnapshot,
} from "./sqlWorkspaceMetadataTypes";

const supportedDialects = new Set<SqlDialectId>(["duckdb", "mariadb", "oracle"]);

const isSqlDialectId = (value: unknown): value is SqlDialectId =>
  typeof value === "string" && supportedDialects.has(value as SqlDialectId);

const normalizeDraftText = (value: unknown) =>
  typeof value === "string" ? value.slice(0, MAX_SQL_DRAFT_TEXT_LENGTH) : "";

const normalizeDraftLabel = (value: unknown, fallback: string) =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, 80) : fallback;

const normalizeDraftId = (value: unknown, fallback: string) =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, 80) : fallback;

const normalizeTimestamp = (value: unknown) =>
  typeof value === "string" && value.trim() ? value : new Date().toISOString();

export const createSqlDraftSnapshot = ({
  id = "active-draft",
  label = "Query draft",
  sql = "",
  selectedDialect = "duckdb",
  updatedAt = new Date().toISOString(),
}: Partial<SqlDraftSnapshot> = {}): SqlDraftSnapshot => ({
  version: SQL_DRAFT_SNAPSHOT_VERSION,
  id: normalizeDraftId(id, "active-draft"),
  label: normalizeDraftLabel(label, "Query draft"),
  sql: normalizeDraftText(sql),
  selectedDialect: isSqlDialectId(selectedDialect) ? selectedDialect : "duckdb",
  updatedAt: normalizeTimestamp(updatedAt),
});

export const normalizeSqlDraftSnapshot = (
  value: unknown,
  fallbackId = "active-draft",
): SqlDraftSnapshot | null => {
  if (!value || typeof value !== "object") return null;

  const draft = value as Partial<SqlDraftSnapshot>;
  return createSqlDraftSnapshot({
    id: normalizeDraftId(draft.id, fallbackId),
    label: normalizeDraftLabel(draft.label, "Query draft"),
    sql: normalizeDraftText(draft.sql),
    selectedDialect: isSqlDialectId(draft.selectedDialect) ? draft.selectedDialect : "duckdb",
    updatedAt: normalizeTimestamp(draft.updatedAt),
  });
};

const normalizeSqlDraftSnapshots = (value: unknown): SqlDraftSnapshot[] =>
  Array.isArray(value)
    ? value
        .slice(0, MAX_SQL_DRAFT_SNAPSHOTS)
        .map((draft, index) => normalizeSqlDraftSnapshot(draft, `draft-${index + 1}`))
        .filter((draft): draft is SqlDraftSnapshot => Boolean(draft))
    : [];

export const createSqlWorkspaceMetadataSnapshot = ({
  selectedDialect = "duckdb",
  activeDraftId = null,
  drafts = [],
  draftCount = 0,
  lastDraftSavedAt = null,
}: {
  selectedDialect?: SqlDialectId;
  activeDraftId?: string | null;
  drafts?: SqlDraftSnapshot[];
  draftCount?: number;
  lastDraftSavedAt?: string | null;
} = {}): SqlWorkspaceMetadataSnapshot => ({
  version: SQL_WORKSPACE_METADATA_VERSION,
  selectedDialect,
  activeSqlTab: "editor",
  activeDraftId,
  lastOpenedContext: "sqlWorkspace",
  draftMetadata: {
    draftCount: Math.min(Math.max(0, draftCount), MAX_SQL_DRAFT_SNAPSHOTS),
    lastDraftSavedAt,
  },
  drafts: drafts.slice(0, MAX_SQL_DRAFT_SNAPSHOTS),
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
  const drafts = normalizeSqlDraftSnapshots(snapshot.drafts);
  const activeDraftId =
    typeof snapshot.activeDraftId === "string" &&
    drafts.some((draft) => draft.id === snapshot.activeDraftId)
      ? snapshot.activeDraftId
      : drafts[0]?.id || null;
  const activeDraft = drafts.find((draft) => draft.id === activeDraftId);

  return createSqlWorkspaceMetadataSnapshot({
    selectedDialect: activeDraft?.selectedDialect || (isSqlDialectId(snapshot.selectedDialect)
      ? snapshot.selectedDialect
      : "duckdb"),
    activeDraftId,
    drafts,
    draftCount:
      typeof draftMetadata?.draftCount === "number" && Number.isFinite(draftMetadata.draftCount)
        ? draftMetadata.draftCount
        : drafts.length,
    lastDraftSavedAt:
      typeof draftMetadata?.lastDraftSavedAt === "string"
        ? draftMetadata.lastDraftSavedAt
        : activeDraft?.updatedAt || null,
  });
};

export const updateSqlWorkspaceDialect = (
  snapshot: SqlWorkspaceMetadataSnapshot,
  selectedDialect: SqlDialectId,
): SqlWorkspaceMetadataSnapshot => {
  const normalizedSnapshot = normalizeSqlWorkspaceMetadataSnapshot(snapshot);
  const updatedAt = new Date().toISOString();

  return {
    ...normalizedSnapshot,
    selectedDialect,
    drafts: normalizedSnapshot.drafts.map((draft) =>
      draft.id === normalizedSnapshot.activeDraftId
        ? { ...draft, selectedDialect, updatedAt }
        : draft,
    ),
    updatedAt,
  };
};

export const updateSqlWorkspaceDraftMetadata = (
  snapshot: SqlWorkspaceMetadataSnapshot,
  draftMetadata: SqlWorkspaceMetadataSnapshot["draftMetadata"],
): SqlWorkspaceMetadataSnapshot => ({
  ...normalizeSqlWorkspaceMetadataSnapshot(snapshot),
  draftMetadata,
  updatedAt: new Date().toISOString(),
});

export const getActiveSqlDraftSnapshot = (
  snapshot: SqlWorkspaceMetadataSnapshot,
): SqlDraftSnapshot | null => {
  const normalizedSnapshot = normalizeSqlWorkspaceMetadataSnapshot(snapshot);
  return (
    normalizedSnapshot.drafts.find(
      (draft) => draft.id === normalizedSnapshot.activeDraftId,
    ) || normalizedSnapshot.drafts[0] || null
  );
};

export const upsertActiveSqlDraftSnapshot = (
  snapshot: SqlWorkspaceMetadataSnapshot,
  draftInput: {
    sql: string;
    selectedDialect: SqlDialectId;
    label?: string;
    id?: string;
  },
): SqlWorkspaceMetadataSnapshot => {
  const normalizedSnapshot = normalizeSqlWorkspaceMetadataSnapshot(snapshot);
  const updatedAt = new Date().toISOString();
  const activeDraftId = draftInput.id || normalizedSnapshot.activeDraftId || "active-draft";
  const nextDraft = createSqlDraftSnapshot({
    id: activeDraftId,
    label: draftInput.label || "Query draft",
    sql: draftInput.sql,
    selectedDialect: draftInput.selectedDialect,
    updatedAt,
  });
  const remainingDrafts = normalizedSnapshot.drafts.filter((draft) => draft.id !== activeDraftId);
  const drafts = [nextDraft, ...remainingDrafts].slice(0, MAX_SQL_DRAFT_SNAPSHOTS);

  return {
    ...normalizedSnapshot,
    selectedDialect: draftInput.selectedDialect,
    activeDraftId,
    draftMetadata: {
      draftCount: drafts.length,
      lastDraftSavedAt: updatedAt,
    },
    drafts,
    updatedAt,
  };
};
