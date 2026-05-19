import { routeActivationIntegrityRegistry } from "./routeActivationIntegrityRegistry";
import { navigationRoutedDetailActivations } from "./routedDetailActivation";

export type ControlledHashDetailRouteId = (typeof navigationRoutedDetailActivations)[number]["routeId"];

export type ControlledHashDetailEvent = {
  readonly routeId: ControlledHashDetailRouteId;
  readonly activationId: string;
  readonly active: boolean;
  readonly action: "open" | "close" | "sync";
  readonly metadataOnly: false;
};

export type ControlledHashDetailResult = {
  readonly accepted: boolean;
  readonly routeId: ControlledHashDetailRouteId;
  readonly activationId: string | null;
  readonly active: boolean;
  readonly reason: "controlled-route" | "unsupported-route";
  readonly metadataOnly: false;
};

export type ControlledHashDetailUnsubscribe = () => void;

const controlledActivationEntries = routeActivationIntegrityRegistry.filter(
  (entry) =>
    entry.activation.activationMode === "controlled-hash-route" &&
    entry.activation.hashRouteAddressable &&
    entry.activation.restorationCapability === "hash_addressable_only" &&
    entry.issues.length === 0,
);

const controlledRouteIds = new Set<string>(
  controlledActivationEntries.map((entry) => entry.activation.routeId),
);

const getControlledActivation = (routeId: ControlledHashDetailRouteId) =>
  controlledActivationEntries.find((entry) => entry.activation.routeId === routeId)?.activation || null;

const getHashForRoute = (routeId: ControlledHashDetailRouteId) => `#${routeId}`;

export const getCurrentControlledHashDetailRoute = (): ControlledHashDetailRouteId | null => {
  const currentRoute = globalThis.location?.hash.replace(/^#/, "") || "";
  if (!controlledRouteIds.has(currentRoute)) return null;

  return currentRoute as ControlledHashDetailRouteId;
};

export const isControlledHashDetailRouteActive = (routeId: ControlledHashDetailRouteId) =>
  getCurrentControlledHashDetailRoute() === routeId;

export const openControlledHashDetailRoute = (
  routeId: ControlledHashDetailRouteId,
): ControlledHashDetailResult => {
  const activation = getControlledActivation(routeId);

  if (!activation) {
    return {
      accepted: false,
      routeId,
      activationId: null,
      active: false,
      reason: "unsupported-route",
      metadataOnly: false,
    };
  }

  const routeHash = getHashForRoute(routeId);
  if (globalThis.location?.hash !== routeHash) {
    globalThis.history.pushState({ detailRouteId: routeId }, "", routeHash);
  }

  return {
    accepted: true,
    routeId,
    activationId: activation.activationId,
    active: true,
    reason: "controlled-route",
    metadataOnly: false,
  };
};

export const closeControlledHashDetailRoute = (
  routeId: ControlledHashDetailRouteId,
): ControlledHashDetailResult => {
  const activation = getControlledActivation(routeId);

  if (!activation) {
    return {
      accepted: false,
      routeId,
      activationId: null,
      active: false,
      reason: "unsupported-route",
      metadataOnly: false,
    };
  }

  if (globalThis.location?.hash === getHashForRoute(routeId)) {
    globalThis.history.replaceState(
      globalThis.history.state,
      "",
      `${globalThis.location.pathname}${globalThis.location.search}`,
    );
  }

  return {
    accepted: true,
    routeId,
    activationId: activation.activationId,
    active: false,
    reason: "controlled-route",
    metadataOnly: false,
  };
};

export const subscribeControlledHashDetailRoute = (
  routeId: ControlledHashDetailRouteId,
  onChange: (event: ControlledHashDetailEvent) => void,
): ControlledHashDetailUnsubscribe => {
  const activation = getControlledActivation(routeId);

  if (!activation) {
    return () => undefined;
  }

  const syncRouteState = () => {
    onChange({
      routeId,
      activationId: activation.activationId,
      active: isControlledHashDetailRouteActive(routeId),
      action: "sync",
      metadataOnly: false,
    });
  };

  syncRouteState();
  globalThis.addEventListener("hashchange", syncRouteState);
  globalThis.addEventListener("popstate", syncRouteState);

  return () => {
    globalThis.removeEventListener("hashchange", syncRouteState);
    globalThis.removeEventListener("popstate", syncRouteState);
  };
};
