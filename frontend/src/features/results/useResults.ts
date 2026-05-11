import { useState } from "react";
import type { ResultState, ResultTabKey } from "./resultTypes";

export const createEmptyResultState = (): ResultState => ({
  columns: [],
  rows: [],
  totalCount: 0,
  page: 1,
  rowsPerPage: 25,
  sortColumn: "",
  sortDirection: "ASC",
});

function useResults() {
  const [activeResultTab, setActiveResultTab] = useState<ResultTabKey>("preview");
  const [previewResult, setPreviewResult] = useState<ResultState>(createEmptyResultState);
  const [filteredResult, setFilteredResult] = useState<ResultState>(createEmptyResultState);
  const [queriedResult, setQueriedResult] = useState<ResultState>(createEmptyResultState);

  const activeResult =
    activeResultTab === "queried"
      ? queriedResult
      : activeResultTab === "filtered"
        ? filteredResult
        : previewResult;

  const resultRows = activeResult.rows;
  const resultColumns = activeResult.columns;
  const resultPage = activeResult.page;
  const resultRowsPerPage = activeResult.rowsPerPage;
  const resultTotalCount = activeResult.totalCount;
  const resultTotalPages = Math.max(1, Math.ceil((resultTotalCount || 0) / resultRowsPerPage));
  const hasFilteredResults = filteredResult.columns.length > 0;

  const resetResults = () => {
    setPreviewResult(createEmptyResultState());
    setFilteredResult(createEmptyResultState());
    setQueriedResult(createEmptyResultState());
  };

  return {
    activeResultTab,
    setActiveResultTab,
    previewResult,
    setPreviewResult,
    filteredResult,
    setFilteredResult,
    queriedResult,
    setQueriedResult,
    activeResult,
    resultRows,
    resultColumns,
    resultPage,
    resultRowsPerPage,
    resultTotalCount,
    resultTotalPages,
    hasFilteredResults,
    resetResults,
  };
}

export default useResults;
