/**
 * E-1 — Explore Three-Room state machine.
 *
 * Pure state-management hook introduced as the foundation for the E-2/E-3/E-4
 * Three Rooms redesign (Compose → Refine → Answer). E-1 is infrastructure
 * only: this hook does not render any UI, does not hide any existing Explore
 * sections, and does not change any backend, governance, SQL execution, or
 * provider behavior. Consumers in E-2+ will read `currentRoom` to gate the
 * eventual room-specific layouts.
 *
 * Notes:
 *   - The hook is intentionally observational at the App level today: the
 *     room is derived from existing events (humanAnalyzeStage flips, query
 *     results becoming available, dataset clear), and no consumer currently
 *     changes its rendering based on the value. This lets us land the state
 *     foundation safely without any visual regression.
 *   - Goto callbacks have stable identity (useCallback) so consumers can put
 *     them in effect dependency arrays without retriggering.
 *   - No URL hash routing in E-1 — we keep room state in memory only to avoid
 *     touching existing navigation persistence. A future slice can layer
 *     hash/query routing on top of this hook.
 */

import { useCallback, useMemo, useState } from "react";

type ExploreRoom = "compose" | "refine" | "answer";

const EXPLORE_ROOMS: readonly ExploreRoom[] = ["compose", "refine", "answer"] as const;

const DEFAULT_INITIAL_ROOM: ExploreRoom = "compose";

const isExploreRoom = (value: unknown): value is ExploreRoom =>
  typeof value === "string" && (EXPLORE_ROOMS as readonly string[]).includes(value);

type UseExploreRoomOptions = {
  initialRoom?: ExploreRoom;
};

type UseExploreRoomResult = {
  currentRoom: ExploreRoom;
  isComposeRoom: boolean;
  isRefineRoom: boolean;
  isAnswerRoom: boolean;
  goToCompose: () => void;
  goToRefine: () => void;
  goToAnswer: () => void;
  resetExploreRoom: () => void;
};

function useExploreRoom(options?: UseExploreRoomOptions): UseExploreRoomResult {
  const initialRoom: ExploreRoom =
    options?.initialRoom && isExploreRoom(options.initialRoom)
      ? options.initialRoom
      : DEFAULT_INITIAL_ROOM;

  const [currentRoom, setCurrentRoom] = useState<ExploreRoom>(initialRoom);

  const goToCompose = useCallback(() => {
    setCurrentRoom("compose");
  }, []);

  const goToRefine = useCallback(() => {
    setCurrentRoom("refine");
  }, []);

  const goToAnswer = useCallback(() => {
    setCurrentRoom("answer");
  }, []);

  const resetExploreRoom = useCallback(() => {
    setCurrentRoom(DEFAULT_INITIAL_ROOM);
  }, []);

  return useMemo<UseExploreRoomResult>(
    () => ({
      currentRoom,
      isComposeRoom: currentRoom === "compose",
      isRefineRoom: currentRoom === "refine",
      isAnswerRoom: currentRoom === "answer",
      goToCompose,
      goToRefine,
      goToAnswer,
      resetExploreRoom,
    }),
    [currentRoom, goToCompose, goToRefine, goToAnswer, resetExploreRoom],
  );
}

export {
  useExploreRoom,
  isExploreRoom,
  DEFAULT_INITIAL_ROOM,
  EXPLORE_ROOMS,
};
export type { ExploreRoom, UseExploreRoomOptions, UseExploreRoomResult };
export default useExploreRoom;
