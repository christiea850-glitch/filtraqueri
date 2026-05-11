import { useState } from "react";
import type { HistoryItem } from "./historyTypes";

function useQueryHistory() {
  const [queryHistory, setQueryHistory] = useState<HistoryItem[]>([]);

  const addHistory = (action: string, detail: string, resultCount: number) => {
    setQueryHistory((currentHistory) => [
      {
        id: Date.now(),
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        action,
        detail,
        resultCount,
      },
      ...currentHistory.slice(0, 7),
    ]);
  };

  const clearHistory = () => {
    setQueryHistory([]);
  };

  return {
    queryHistory,
    setQueryHistory,
    addHistory,
    clearHistory,
  };
}

export default useQueryHistory;
