import { useState } from "react";
import type { DatasetMetadata } from "../dataset/datasetTypes";
import type { FilterDefinition, FilterState } from "./filterTypes";

function useFilterController() {
  const [filterValues, setFilterValues] = useState<Record<string, FilterState>>({});

  const updateFilter = (columnName: string, value: FilterState) => {
    setFilterValues((currentValues) => ({
      ...currentValues,
      [columnName]: {
        ...currentValues[columnName],
        ...value,
      },
    }));
  };

  const buildBackendFilters = (dataset: DatasetMetadata | null): FilterDefinition[] => {
    if (!dataset) return [];

    return dataset.schema
      .map((column) => {
        const value = filterValues[column.name] || {};

        if (column.inferred_type === "numeric") {
          return {
            column: column.name,
            type: column.inferred_type,
            min: value.min || null,
            max: value.max || null,
          };
        }

        if (column.inferred_type === "date") {
          return {
            column: column.name,
            type: column.inferred_type,
            start: value.start || null,
            end: value.end || null,
          };
        }

        if (column.inferred_type === "boolean") {
          return {
            column: column.name,
            type: column.inferred_type,
            value: value.value === "" || value.value === undefined ? null : value.value === "true",
          };
        }

        return {
          column: column.name,
          type: column.inferred_type,
          values: value.values || [],
        };
      })
      .filter((filter) =>
        Object.entries(filter).some(
          ([key, value]) =>
            key !== "column" &&
            key !== "type" &&
            value !== null &&
            value !== "" &&
            (!Array.isArray(value) || value.length > 0),
        ),
      );
  };

  const createFilterLabels = (filters: ReturnType<typeof buildBackendFilters>) => filters.map((filter) => {
    if ("values" in filter && Array.isArray(filter.values) && filter.values.length > 0) {
      return `${filter.column}: ${filter.values.join(", ")}`;
    }
    if ("value" in filter && filter.value !== null) return `${filter.column}: ${filter.value}`;
    if ("start" in filter || "end" in filter) {
      return `${filter.column}: ${filter.start || "any"} to ${filter.end || "any"}`;
    }
    if ("min" in filter || "max" in filter) {
      return `${filter.column}: ${filter.min || "min"} to ${filter.max || "max"}`;
    }
    return filter.column;
  });

  return {
    filterValues,
    setFilterValues,
    updateFilter,
    buildBackendFilters,
    createFilterLabels,
  };
}

export default useFilterController;
