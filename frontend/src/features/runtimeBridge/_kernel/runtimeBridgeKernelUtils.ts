import type { RuntimeBridgeKernelPriority } from "./runtimeBridgeKernelTypes";

export const uniqueStable = <T extends string>(items: ReadonlyArray<T>): T[] => {
  const seen = new Set<string>();
  const values: T[] = [];

  for (const item of items) {
    if (!item || seen.has(item)) continue;
    seen.add(item);
    values.push(item);
  }

  return values;
};

export const scoreRuntimeBridgePriority = (priority: RuntimeBridgeKernelPriority) => {
  if (priority === "critical") return 4;
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  return 1;
};

export const sortRuntimeBridgePriorities = <TPriority extends RuntimeBridgeKernelPriority>(
  priorities: ReadonlyArray<TPriority>,
): TPriority[] =>
  uniqueStable(priorities).sort((left, right) => {
    const priorityDelta = scoreRuntimeBridgePriority(right) - scoreRuntimeBridgePriority(left);
    if (priorityDelta !== 0) return priorityDelta;
    return left.localeCompare(right);
  });

export const selectStrongestRuntimeBridgePriority = <TPriority extends RuntimeBridgeKernelPriority>(
  priorities: ReadonlyArray<TPriority>,
  fallback: TPriority,
): TPriority => sortRuntimeBridgePriorities(priorities)[0] || fallback;

export const sortRuntimeBridgeBundles = <
  TBundle extends {
    readonly priority: RuntimeBridgeKernelPriority;
    readonly bundleId: string;
  },
>(
  bundles: ReadonlyArray<TBundle>,
): TBundle[] =>
  [...bundles].sort((left, right) => {
    const priorityDelta = scoreRuntimeBridgePriority(right.priority) - scoreRuntimeBridgePriority(left.priority);
    if (priorityDelta !== 0) return priorityDelta;
    return left.bundleId.localeCompare(right.bundleId);
  });
