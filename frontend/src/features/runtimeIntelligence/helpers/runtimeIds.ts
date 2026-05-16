export const normalizeRuntimeIdPart = (value: string | number | null | undefined) =>
  String(value ?? "none")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "none";

export const createRuntimeId = (...parts: Array<string | number | null | undefined>) =>
  parts.map(normalizeRuntimeIdPart).join(":");

export const createMetadataHash = (value: unknown) => {
  const source = JSON.stringify(value, Object.keys((value || {}) as object).sort());
  let hash = 0;

  for (let index = 0; index < source.length; index += 1) {
    hash = (hash << 5) - hash + source.charCodeAt(index);
    hash |= 0;
  }

  return `hash:${Math.abs(hash).toString(16)}`;
};
