import { Box, X } from "lucide-react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { formatDistanceToNow } from "date-fns"
import { getSandboxRuntimeTypeBadge } from "@/lib/appUtils"

export interface SandboxRow {
  id: string
  parent_device_id: string
  sandbox_native_id: string | null
  workspace_folder: string | null
  runtime_type: number
  friendly_name: string | null
  os_version: string | null
  last_seen_at: string | null
}

interface SandboxesTableProps {
  sandboxes: SandboxRow[]
  loading: boolean
  selectedIds: string[]
  onSelectionChange: (ids: string[]) => void
}

const workspaceBasename = (folder: string | null): string => {
  if (!folder) return "—"
  const parts = folder.split("/").filter(Boolean)
  return parts[parts.length - 1] || folder
}

const SandboxesTable = ({ sandboxes, loading, selectedIds, onSelectionChange }: SandboxesTableProps) => {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  const allSelected = sandboxes.length > 0 && selectedIds.length === sandboxes.length
  const someSelected = selectedIds.length > 0 && !allSelected

  const toggleAll = (checked: boolean) => {
    onSelectionChange(checked ? sandboxes.map(s => s.id) : [])
  }

  const toggleOne = (id: string, checked: boolean) => {
    onSelectionChange(checked ? [...selectedIds, id] : selectedIds.filter(x => x !== id))
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <Box className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Sandboxes</span>
        <span className="text-sm text-muted-foreground tabular-nums">({sandboxes.length})</span>
        {selectedIds.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-7 px-2 text-xs gap-1"
            onClick={() => onSelectionChange([])}
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </Button>
        )}
      </div>
      {sandboxes.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <p className="text-sm text-muted-foreground">No sandboxes detected on this device yet.</p>
          <Link
            to="/settings?section=sandbox-setup"
            className="inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline mt-2"
          >
            How to enable →
          </Link>
        </div>
      ) : (
        <>
      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40px]">
              <Checkbox
                checked={allSelected ? true : someSelected ? "indeterminate" : false}
                onCheckedChange={(c) => toggleAll(!!c)}
                aria-label="Select all sandboxes"
              />
            </TableHead>
            <TableHead>Workspace</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Sandbox ID</TableHead>
            <TableHead>OS</TableHead>
            <TableHead>Last seen</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sandboxes.map((s) => {
            const isSelected = selectedIds.includes(s.id)
            const name = workspaceBasename(s.workspace_folder)
            return (
              <TableRow
                key={s.id}
                className={`cursor-pointer ${isSelected ? "bg-muted/50" : ""}`}
                data-state={isSelected ? "selected" : undefined}
                onClick={() => toggleOne(s.id, !isSelected)}
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={(c) => toggleOne(s.id, !!c)}
                    aria-label={`Select sandbox ${name}`}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{name}</span>
                    {s.workspace_folder && s.workspace_folder !== name && (
                      <span className="text-xs text-muted-foreground">{s.workspace_folder}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {getSandboxRuntimeTypeBadge(s.runtime_type)}
                </TableCell>
                <TableCell>
                  {s.sandbox_native_id ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="truncate cursor-default text-xs font-mono text-muted-foreground">
                            {s.sandbox_native_id}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-mono">{s.sandbox_native_id}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <span className="text-sm">{s.os_version || "—"}</span>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground">
                    {s.last_seen_at ? formatDistanceToNow(new Date(s.last_seen_at), { addSuffix: true }) : "—"}
                  </span>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
        </>
      )}
    </div>
  )
}

export default SandboxesTable
