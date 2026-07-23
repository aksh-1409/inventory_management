'use client';

import { useState, useCallback, useMemo } from 'react';

interface UseSelectionOptions {
  totalCount: number;
}

export function useSelection({ totalCount }: UseSelectionOptions) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isAllPagesSelected, setIsAllPagesSelected] = useState(false);

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setIsAllPagesSelected(false);
  }, []);

  const selectPage = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids));
    setIsAllPagesSelected(false);
  }, []);

  const selectAll = useCallback(() => {
    setIsAllPagesSelected(true);
    setSelectedIds(new Set());
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setIsAllPagesSelected(false);
  }, []);

  const selectionCount = useMemo(() => {
    if (isAllPagesSelected) return totalCount;
    return selectedIds.size;
  }, [isAllPagesSelected, selectedIds.size, totalCount]);

  const isSelected = useCallback(
    (id: string) => {
      return selectedIds.has(id);
    },
    [selectedIds]
  );

  return {
    selectedIds,
    isAllPagesSelected,
    selectionCount,
    clearSelection,
    toggle,
    selectPage,
    selectAll,
    isSelected,
  };
}
