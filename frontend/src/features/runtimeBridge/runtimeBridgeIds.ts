type RuntimeBridgeIdPart = string | number | boolean | null | undefined;

const normalizeRuntimeBridgeIdPart = (part: RuntimeBridgeIdPart) => {
  if (part === null || part === undefined) return "";

  return String(part)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

export const createRuntimeBridgeId = (...parts: RuntimeBridgeIdPart[]) => {
  const normalizedParts = parts.map(normalizeRuntimeBridgeIdPart).filter(Boolean);
  return normalizedParts.length > 0 ? normalizedParts.join(":") : "runtime-bridge";
};

export const createBridgeNodeId = (
  kind: RuntimeBridgeIdPart,
  sourceId: RuntimeBridgeIdPart,
) => createRuntimeBridgeId("bridge-node", kind, sourceId);

export const createBridgeEdgeId = (
  kind: RuntimeBridgeIdPart,
  fromId: RuntimeBridgeIdPart,
  toId: RuntimeBridgeIdPart,
) => createRuntimeBridgeId("bridge-edge", kind, fromId, toId);

export const createBridgeReferenceId = (
  kind: RuntimeBridgeIdPart,
  sourceId: RuntimeBridgeIdPart,
) => createRuntimeBridgeId("bridge-reference", kind, sourceId);
