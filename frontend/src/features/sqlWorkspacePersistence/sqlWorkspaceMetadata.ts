import type { SqlDialectId } from "../sqlIntelligence";
import {
  MAX_SQL_DRAFT_SNAPSHOTS,
  MAX_SQL_DRAFT_TEXT_LENGTH,
  MAX_SQL_SNIPPET_DESCRIPTION_LENGTH,
  MAX_SQL_SNIPPET_NAME_LENGTH,
  MAX_SQL_SNIPPET_TAGS,
  MAX_SQL_SNIPPET_TAG_LENGTH,
  MAX_SQL_SNIPPET_TEXT_LENGTH,
  MAX_SQL_SNIPPETS,
  SQL_DRAFT_SNAPSHOT_VERSION,
  SQL_SNIPPET_SNAPSHOT_VERSION,
  SQL_WORKSPACE_METADATA_VERSION,
  type SqlDraftSnapshot,
  type SqlSnippetSnapshot,
  type SqlWorkspaceMetadataSnapshot,
} from "./sqlWorkspaceMetadataTypes";

const supportedDialects = new Set<SqlDialectId>(["duckdb", "mariadb", "oracle"]);

const isSqlDialectId = (value: unknown): value is SqlDialectId =>
  typeof value === "string" && supportedDialects.has(value as SqlDialectId);

const normalizeDraftText = (value: unknown) =>
  typeof value === "string" ? value.slice(0, MAX_SQL_DRAFT_TEXT_LENGTH) : "";

const normalizeSnippetText = (value: unknown) =>
  typeof value === "string" ? value.slice(0, MAX_SQL_SNIPPET_TEXT_LENGTH) : "";

const normalizeDraftLabel = (value: unknown, fallback: string) =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, 80) : fallback;

const normalizeSnippetName = (value: unknown, fallback: string) =>
  typeof value === "string" && value.trim()
    ? value.trim().slice(0, MAX_SQL_SNIPPET_NAME_LENGTH)
    : fallback;

const normalizeSnippetDescription = (value: unknown) =>
  typeof value === "string" && value.trim()
    ? value.trim().slice(0, MAX_SQL_SNIPPET_DESCRIPTION_LENGTH)
    : null;

const normalizeSnippetTags = (value: unknown) =>
  Array.isArray(value)
    ? Array.from(
        new Set(
          value
            .filter((tag): tag is string => typeof tag === "string" && Boolean(tag.trim()))
            .map((tag) => tag.trim().slice(0, MAX_SQL_SNIPPET_TAG_LENGTH)),
        ),
      ).slice(0, MAX_SQL_SNIPPET_TAGS)
    : [];

const normalizeDraftId = (value: unknown, fallback: string) =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, 80) : fallback;

const normalizeSnippetId = (value: unknown, fallback: string) =>
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

export const createSqlSnippetSnapshot = ({
  id = `snippet-${Date.now()}`,
  name = "Saved SQL snippet",
  sql = "",
  dialect = "duckdb",
  createdAt = new Date().toISOString(),
  updatedAt = createdAt,
  tags = [],
  description = null,
}: Partial<SqlSnippetSnapshot> = {}): SqlSnippetSnapshot => ({
  version: SQL_SNIPPET_SNAPSHOT_VERSION,
  id: normalizeSnippetId(id, `snippet-${Date.now()}`),
  name: normalizeSnippetName(name, "Saved SQL snippet"),
  sql: normalizeSnippetText(sql),
  dialect: isSqlDialectId(dialect) ? dialect : "duckdb",
  createdAt: normalizeTimestamp(createdAt),
  updatedAt: normalizeTimestamp(updatedAt),
  tags: normalizeSnippetTags(tags),
  description: normalizeSnippetDescription(description),
});

export const normalizeSqlSnippetSnapshot = (
  value: unknown,
  fallbackId = `snippet-${Date.now()}`,
): SqlSnippetSnapshot | null => {
  if (!value || typeof value !== "object") return null;

  const snippet = value as Partial<SqlSnippetSnapshot>;
  return createSqlSnippetSnapshot({
    id: normalizeSnippetId(snippet.id, fallbackId),
    name: normalizeSnippetName(snippet.name, "Saved SQL snippet"),
    sql: normalizeSnippetText(snippet.sql),
    dialect: isSqlDialectId(snippet.dialect) ? snippet.dialect : "duckdb",
    createdAt: normalizeTimestamp(snippet.createdAt),
    updatedAt: normalizeTimestamp(snippet.updatedAt),
    tags: normalizeSnippetTags(snippet.tags),
    description: normalizeSnippetDescription(snippet.description),
  });
};

const normalizeSqlSnippetSnapshots = (value: unknown): SqlSnippetSnapshot[] => {
  if (!Array.isArray(value)) return [];

  const seenIds = new Set<string>();
  const snippets: SqlSnippetSnapshot[] = [];

  value.slice(0, MAX_SQL_SNIPPETS).forEach((snippet, index) => {
    const normalizedSnippet = normalizeSqlSnippetSnapshot(snippet, `snippet-${index + 1}`);
    if (!normalizedSnippet || seenIds.has(normalizedSnippet.id)) return;

    seenIds.add(normalizedSnippet.id);
    snippets.push(normalizedSnippet);
  });

  return snippets;
};

export const createSqlWorkspaceMetadataSnapshot = ({
  selectedDialect = "duckdb",
  activeDraftId = null,
  activeSnippetId = null,
  drafts = [],
  snippets = [],
  draftCount = 0,
  lastDraftSavedAt = null,
  snippetCount = 0,
  lastSnippetSavedAt = null,
}: {
  selectedDialect?: SqlDialectId;
  activeDraftId?: string | null;
  activeSnippetId?: string | null;
  drafts?: SqlDraftSnapshot[];
  snippets?: SqlSnippetSnapshot[];
  draftCount?: number;
  lastDraftSavedAt?: string | null;
  snippetCount?: number;
  lastSnippetSavedAt?: string | null;
} = {}): SqlWorkspaceMetadataSnapshot => ({
  version: SQL_WORKSPACE_METADATA_VERSION,
  selectedDialect,
  activeSqlTab: "editor",
  activeDraftId,
  activeSnippetId,
  lastOpenedContext: "sqlWorkspace",
  draftMetadata: {
    draftCount: Math.min(Math.max(0, draftCount), MAX_SQL_DRAFT_SNAPSHOTS),
    lastDraftSavedAt,
  },
  snippetMetadata: {
    snippetCount: Math.min(Math.max(0, snippetCount), MAX_SQL_SNIPPETS),
    lastSnippetSavedAt,
  },
  drafts: drafts.slice(0, MAX_SQL_DRAFT_SNAPSHOTS),
  snippets: snippets.slice(0, MAX_SQL_SNIPPETS),
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
  const snippets = normalizeSqlSnippetSnapshots(snapshot.snippets);
  const activeDraftId =
    typeof snapshot.activeDraftId === "string" &&
    drafts.some((draft) => draft.id === snapshot.activeDraftId)
      ? snapshot.activeDraftId
      : drafts[0]?.id || null;
  const activeDraft = drafts.find((draft) => draft.id === activeDraftId);
  const activeSnippetId =
    typeof snapshot.activeSnippetId === "string" &&
    snippets.some((snippet) => snippet.id === snapshot.activeSnippetId)
      ? snapshot.activeSnippetId
      : null;
  const snippetMetadata =
    snapshot.snippetMetadata && typeof snapshot.snippetMetadata === "object"
      ? snapshot.snippetMetadata
      : null;

  return createSqlWorkspaceMetadataSnapshot({
    selectedDialect: activeDraft?.selectedDialect || (isSqlDialectId(snapshot.selectedDialect)
      ? snapshot.selectedDialect
      : "duckdb"),
    activeDraftId,
    activeSnippetId,
    drafts,
    snippets,
    draftCount:
      typeof draftMetadata?.draftCount === "number" && Number.isFinite(draftMetadata.draftCount)
        ? draftMetadata.draftCount
        : drafts.length,
    lastDraftSavedAt:
      typeof draftMetadata?.lastDraftSavedAt === "string"
        ? draftMetadata.lastDraftSavedAt
        : activeDraft?.updatedAt || null,
    snippetCount:
      typeof snippetMetadata?.snippetCount === "number" &&
      Number.isFinite(snippetMetadata.snippetCount)
        ? snippetMetadata.snippetCount
        : snippets.length,
    lastSnippetSavedAt:
      typeof snippetMetadata?.lastSnippetSavedAt === "string"
        ? snippetMetadata.lastSnippetSavedAt
        : snippets[0]?.updatedAt || null,
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

export const listSqlSnippets = (
  snapshot: SqlWorkspaceMetadataSnapshot,
): SqlSnippetSnapshot[] => normalizeSqlWorkspaceMetadataSnapshot(snapshot).snippets;

export const getSqlSnippet = (
  snapshot: SqlWorkspaceMetadataSnapshot,
  snippetId: string,
): SqlSnippetSnapshot | null =>
  normalizeSqlWorkspaceMetadataSnapshot(snapshot).snippets.find(
    (snippet) => snippet.id === snippetId,
  ) || null;

export const upsertSqlSnippet = (
  snapshot: SqlWorkspaceMetadataSnapshot,
  snippetInput: {
    id?: string;
    name: string;
    sql: string;
    dialect: SqlDialectId;
    tags?: string[];
    description?: string | null;
  },
): SqlWorkspaceMetadataSnapshot => {
  const normalizedSnapshot = normalizeSqlWorkspaceMetadataSnapshot(snapshot);
  const updatedAt = new Date().toISOString();
  const existingSnippet = snippetInput.id
    ? getSqlSnippet(normalizedSnapshot, snippetInput.id)
    : null;
  const snippet = createSqlSnippetSnapshot({
    id: snippetInput.id || `snippet-${Date.now()}`,
    name: snippetInput.name,
    sql: snippetInput.sql,
    dialect: snippetInput.dialect,
    createdAt: existingSnippet?.createdAt || updatedAt,
    updatedAt,
    tags: snippetInput.tags || existingSnippet?.tags || [],
    description:
      snippetInput.description !== undefined
        ? snippetInput.description
        : existingSnippet?.description || null,
  });
  const snippets = [
    snippet,
    ...normalizedSnapshot.snippets.filter((currentSnippet) => currentSnippet.id !== snippet.id),
  ].slice(0, MAX_SQL_SNIPPETS);

  return {
    ...normalizedSnapshot,
    activeSnippetId: snippet.id,
    snippetMetadata: {
      snippetCount: snippets.length,
      lastSnippetSavedAt: updatedAt,
    },
    snippets,
    updatedAt,
  };
};

export const deleteSqlSnippet = (
  snapshot: SqlWorkspaceMetadataSnapshot,
  snippetId: string,
): SqlWorkspaceMetadataSnapshot => {
  const normalizedSnapshot = normalizeSqlWorkspaceMetadataSnapshot(snapshot);
  const snippets = normalizedSnapshot.snippets.filter((snippet) => snippet.id !== snippetId);
  const updatedAt = new Date().toISOString();

  return {
    ...normalizedSnapshot,
    activeSnippetId:
      normalizedSnapshot.activeSnippetId === snippetId
        ? snippets[0]?.id || null
        : normalizedSnapshot.activeSnippetId,
    snippetMetadata: {
      snippetCount: snippets.length,
      lastSnippetSavedAt: snippets[0]?.updatedAt || null,
    },
    snippets,
    updatedAt,
  };
};
