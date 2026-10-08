import { useState, useMemo } from "react"

export type SortDirection = 'desc' | 'asc' | null

export interface SortState {
  column: string | null
  direction: SortDirection
}

export function useTableSort() {
  const [sort, setSort] = useState<SortState>({ column: null, direction: null })

  const handleSort = (column: string) => {
    setSort(prev => {
      if (prev.column !== column) return { column, direction: 'desc' }
      if (prev.direction === 'desc') return { column, direction: 'asc' }
      if (prev.direction === 'asc') return { column: null, direction: null }
      return { column, direction: 'desc' }
    })
  }

  const sortItems = <T,>(
    items: T[],
    getValue: (item: T, column: string) => string | number | null | undefined
  ): T[] => {
    if (!sort.column || !sort.direction) return items

    return [...items].sort((a, b) => {
      const aVal = getValue(a, sort.column!)
      const bVal = getValue(b, sort.column!)

      // Nulls always last
      if (aVal == null && bVal == null) return 0
      if (aVal == null) return 1
      if (bVal == null) return -1

      const multiplier = sort.direction === 'desc' ? -1 : 1

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return multiplier * aVal.localeCompare(bVal)
      }

      return multiplier * ((aVal as number) - (bVal as number))
    })
  }

  return { sort, handleSort, sortItems }
}
