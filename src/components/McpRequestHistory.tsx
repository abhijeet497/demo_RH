import { useState } from "react"
import { Check, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { MultiSelect } from "@/components/ui/multi-select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDateShort } from "@/lib/utils"
import type { McpRequestHistoryRow } from "@/hooks/use-mcp-access"

// ===========================================================================
// MCP access history — admin view.
//
// A flat, read-only timeline of ACCESS CHANGES: one row per allow/block
// decision in the ledger, newest first (request approvals and manual "Set
// Access" decisions alike — "Closed N requests" marks decisions that closed
// pending requests). Declines are deliberately absent: they change no access; the
// outcome lives on the request row, which the requester sees on My Requests.
// ===========================================================================

const ActionBadge = ({ action }: { action: 1 | 2 }) =>
  action === 1 ? (
    <Badge variant="success" className="gap-1">
      <Check className="h-3 w-3" />
      Allowed
    </Badge>
  ) : (
    <Badge variant="destructive" className="gap-1">
      <X className="h-3 w-3" />
      Blocked
    </Badge>
  )

const personLabel = (email: string | null, id: string | null) =>
  email ?? (id ? id.slice(0, 8) + "…" : "—")

const McpRequestHistory = ({
  rows,
  loading,
  error,
  mcpTypeFilter,
  onClearMcpFilter,
  initialGroupFilters = [],
}: {
  rows: McpRequestHistoryRow[]
  loading: boolean
  error: string | null
  /** Deep-link filter (e.g. from the MCPs table's Access Status column) —
   * restricts the list to a single mcp_server_type. Takes priority over the
   * free-text search box. */
  mcpTypeFilter?: number | null
  onClearMcpFilter?: () => void
  /** Group context carried in via ?group= — seeds the group filter. */
  initialGroupFilters?: string[]
}) => {
  const [query, setQuery] = useState("")
  const [groupFilters, setGroupFilters] = useState<string[]>(initialGroupFilters)

  /** The label the group column renders for a row — also the filter key. */
  const rowGroupLabel = (r: McpRequestHistoryRow) =>
    r.scope_type === 1 ? "All users" : r.group_name ?? "—"

  // Group filter options from the data itself (distinct decision scopes).
  const groupOptions = [...new Set(rows.map(rowGroupLabel))]
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({ id: name, name }))

  const q = query.trim().toLowerCase()
  const filtered = (
    mcpTypeFilter != null
      ? rows.filter((r) => r.mcp_server_type === mcpTypeFilter)
      : q
        ? rows.filter(
            (r) =>
              r.mcp_server_name.toLowerCase().includes(q) ||
              (r.decided_by_email ?? "").toLowerCase().includes(q) ||
              (r.group_name ?? "").toLowerCase().includes(q),
          )
        : rows
  ).filter((r) => groupFilters.length === 0 || groupFilters.includes(rowGroupLabel(r)))

  const filteredMcpName = mcpTypeFilter != null ? filtered[0]?.mcp_server_name : null

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Every access decision, newest first.
        </p>
        <div className="flex items-center gap-2">
          <div className="w-48">
            <MultiSelect
              options={groupOptions}
              selectedIds={groupFilters}
              onChange={setGroupFilters}
              placeholder="All groups"
              searchPlaceholder="Search groups..."
              emptyMessage="No groups found."
              label="group"
              compact
            />
          </div>
          {mcpTypeFilter == null && (
            <Input
              placeholder="Filter by connector, admin, or group…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="max-w-sm"
            />
          )}
        </div>
      </div>

      {mcpTypeFilter != null && (
        <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
          <span className="text-muted-foreground">
            Filtered to <span className="font-medium text-foreground">{filteredMcpName ?? "this connector"}</span>
          </span>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={onClearMcpFilter}>
            Clear
          </Button>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {error ? (
            <p className="py-8 text-center text-sm text-destructive">
              Couldn&apos;t load history: {error}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Connector</TableHead>
                  <TableHead>Decision</TableHead>
                  <TableHead>User group</TableHead>
                  <TableHead>Decided by</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 6 }).map((__, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                      {mcpTypeFilter != null
                        ? "No access decisions for this connector — its status may come from an access policy. Decisions recorded here override policy."
                        : query
                          ? `No decisions match "${query}".`
                          : groupFilters.length > 0
                            ? "No access decisions for the selected groups."
                            : "No access decisions yet."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.mcp_server_name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <ActionBadge action={r.action} />
                          {/* Pending requests this decision closed (approved by an
                              allow, declined by a block). */}
                          {r.resolved_count > 0 && (
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              Closed {r.resolved_count} {r.resolved_count === 1 ? "request" : "requests"}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {/* scope 1 = org-wide (group_name is always null there);
                            group decisions show the name snapshotted at decision
                            time, so renames/deletions don't rewrite history. */}
                        {rowGroupLabel(r)}
                      </TableCell>
                      <TableCell>{personLabel(r.decided_by_email, r.decided_by)}</TableCell>
                      <TableCell className="max-w-xs text-sm text-muted-foreground">
                        {r.decision_reason ? (
                          <span className="line-clamp-2">{r.decision_reason}</span>
                        ) : (
                          <span className="text-muted-foreground/60">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {formatDateShort(r.created_at)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default McpRequestHistory
