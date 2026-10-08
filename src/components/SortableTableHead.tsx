import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import { TableHead } from "@/components/ui/table"
import type { SortDirection } from "@/hooks/use-table-sort"
import { cn } from "@/lib/utils"

interface SortableTableHeadProps {
  column: string
  currentColumn: string | null
  direction: SortDirection
  onSort: (column: string) => void
  children: React.ReactNode
  className?: string
}

export function SortableTableHead({
  column,
  currentColumn,
  direction,
  onSort,
  children,
  className,
}: SortableTableHeadProps) {
  const isActive = currentColumn === column

  const Icon = isActive
    ? direction === 'desc'
      ? ArrowDown
      : ArrowUp
    : ArrowUpDown

  return (
    <TableHead
      className={cn("cursor-pointer select-none hover:bg-muted/50 transition-colors", className)}
      onClick={() => onSort(column)}
    >
      <div className="flex items-center gap-1.5">
        {children}
        <Icon
          className={cn(
            "h-4 w-4 shrink-0 opacity-90",
            isActive ? "text-foreground" : "text-muted-foreground"
          )}
        />
      </div>
    </TableHead>
  )
}
