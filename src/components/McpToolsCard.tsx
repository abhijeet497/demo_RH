import { useEffect, useRef, useState } from "react"
import { Wrench, AlertCircle } from "lucide-react"
import { Link } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useMcpTools, type McpTool } from "@/hooks/use-mcp-tools"
import { getAgentNameBadge, getToolPermissionTypeBadge, TOOL_PERMISSION_TYPE } from "@/lib/appUtils"
import { cn } from "@/lib/utils"

function ToolNameCell({ name }: { name: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [truncated, setTruncated] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const check = () => setTruncated(el.scrollWidth > el.clientWidth + 1)
    check()
    // ResizeObserver may be absent in older browsers / non-DOM environments;
    // the initial check() above still runs, we just skip live resize tracking.
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(check)
    observer.observe(el)
    return () => observer.disconnect()
  }, [name])

  return (
    <TooltipProvider>
      <Tooltip open={truncated ? open : false} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <div
            ref={ref}
            className={cn(
              "truncate font-mono text-sm font-medium",
              truncated && "cursor-help",
            )}
          >
            {name}
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-md">
          <p className="break-all font-mono text-sm">{name}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function ToolDescriptionCell({ description }: { description: string | null }) {
  if (!description) {
    return <span className="text-sm text-muted-foreground">Unavailable</span>
  }
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {/* break-all keeps long URLs from widening the table; line-clamp caps height. */}
          <div className="line-clamp-3 min-w-0 cursor-help break-all text-sm text-muted-foreground hover:opacity-80 transition-opacity">
            {description}
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-md">
          {/* Cap height so very long descriptions scroll instead of overflowing the viewport. */}
          <p className="max-h-[min(24rem,50vh)] overflow-y-auto break-all whitespace-pre-wrap text-sm">
            {description}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

type McpToolsTableViewProps = {
  tools: McpTool[]
  loading: boolean
  error: string | null
  /** MOCK Invoked by / Access columns — inventory detail only. */
  showMockUsage?: boolean
  agents?: { id: string | null; name: string }[]
  /** Scrollport max height (default matches card body). */
  maxHeightClassName?: string
  className?: string
  emptyDescription?: string
}

/** Presentational tools table (Tool / Description / Permission). */
export function McpToolsTableView({
  tools,
  loading,
  error,
  showMockUsage = false,
  agents = [],
  maxHeightClassName = "[&>div]:max-h-80",
  className,
  emptyDescription = "No tools used",
}: McpToolsTableViewProps) {
  if (loading) {
    return (
      <div className={cn("space-y-2", className)}>
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive",
          className,
        )}
      >
        <AlertCircle className="h-4 w-4 shrink-0" />
        {error}
      </div>
    )
  }

  return (
    // Constrain the Table wrapper's overflow-auto so the header can stick while rows scroll.
    <div className={cn("min-w-0 rounded-lg border", maxHeightClassName, className)}>
      {/* table-fixed + max-w-0 on Description keeps long URLs from expanding the dialog. */}
      <Table className="table-fixed w-full">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="sticky top-0 z-10 w-[28%] bg-background">Tool</TableHead>
            <TableHead className="sticky top-0 z-10 w-[56%] bg-background">Description</TableHead>
            <TableHead className="sticky top-0 z-10 w-[16%] bg-background">Permission</TableHead>
            {showMockUsage && (
              <>
                <TableHead className="sticky top-0 z-10 w-[170px] bg-background">Invoked by</TableHead>
                <TableHead className="sticky top-0 z-10 w-[110px] bg-background">Access</TableHead>
              </>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {tools.length === 0 ? (
            <TableRow>
              <TableCell className="text-sm italic text-muted-foreground">—</TableCell>
              <TableCell className="max-w-0 text-sm text-muted-foreground">{emptyDescription}</TableCell>
              <TableCell />
              {showMockUsage && (
                <>
                  <TableCell className="text-sm italic text-muted-foreground">—</TableCell>
                  <TableCell className="text-sm italic text-muted-foreground">—</TableCell>
                </>
              )}
            </TableRow>
          ) : (
            tools.map((tool, index) => {
              // MOCK — no real per-tool agent/access data exists yet.
              // Assign 1–3 of the real connected agents per tool so a tool
              // can show multiple invokers, cycling without repeats.
              const invokers = agents.length
                ? Array.from(
                    { length: Math.min((index % 3) + 1, agents.length) },
                    (_, k) => agents[(index + k) % agents.length],
                  )
                : []
              const blocked =
                tool.permission_type === TOOL_PERMISSION_TYPE.DELETE || index % 4 === 1
              return (
                <TableRow key={tool.id}>
                  <TableCell className="max-w-0">
                    <ToolNameCell name={tool.name} />
                  </TableCell>
                  <TableCell className="max-w-0">
                    <ToolDescriptionCell description={tool.description} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{getToolPermissionTypeBadge(tool.permission_type)}</TableCell>
                  {showMockUsage && (
                    <>
                      <TableCell>
                        {/* Blocked tools aren't invoked — show em dash instead of agents. */}
                        {!blocked && invokers.length ? (
                          <div className="flex flex-wrap gap-1">
                            {invokers.map((agent) =>
                              agent.id ? (
                                <Link key={agent.id} to={`/agents/${agent.id}`}>
                                  {getAgentNameBadge(agent.name)}
                                </Link>
                              ) : (
                                <span key={agent.name}>{getAgentNameBadge(agent.name)}</span>
                              ),
                            )}
                          </div>
                        ) : (
                          <span className="text-sm italic text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={blocked ? "destructive" : "secondary"}>
                          {blocked ? "Blocked" : "Allowed"}
                        </Badge>
                      </TableCell>
                    </>
                  )}
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}

/** Fetches and renders the tools table for an MCP server type. */
export function McpToolsTable({
  mcpServerType,
  showMockUsage = false,
  agents = [],
  maxHeightClassName,
  className,
}: {
  mcpServerType: number | null
  showMockUsage?: boolean
  agents?: { id: string | null; name: string }[]
  maxHeightClassName?: string
  className?: string
}) {
  const { tools, loading, error } = useMcpTools(mcpServerType)
  return (
    <McpToolsTableView
      tools={tools}
      loading={loading}
      error={error}
      showMockUsage={showMockUsage}
      agents={agents}
      maxHeightClassName={maxHeightClassName}
      className={className}
    />
  )
}

/**
 * Tools an MCP server exposes to agents, shown on the registry/inventory detail views.
 * Fetched from mcp_catalog_tools by mcp_server_type.
 *
 * `showMockUsage` adds "Invoked by" and "Access" columns. These are MOCK
 * placeholders: the schema has no per-tool agent-invocation link or per-tool
 * allow/block policy yet. "Invoked by" cycles the real connected `agents`
 * (a tool may be invoked by several), rendered as badges like the inventory
 * agents table; "Access" is a deterministic allow/block stand-in. Replace both
 * with real data once the backend exposes it.
 */
export function McpToolsCard({
  mcpServerType,
  showMockUsage = false,
  agents = [],
}: {
  mcpServerType: number | null
  showMockUsage?: boolean
  agents?: { id: string | null; name: string }[]
}) {
  const { tools, loading, error } = useMcpTools(mcpServerType)

  // Once the fetch settles with no tools, omit the card entirely rather than
  // showing an empty "Available Tools" box. Loading/error still render so the
  // skeleton and load failures stay visible.
  if (!loading && !error && tools.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <Wrench className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Available Tools</h3>
          {!loading && !error && <Badge variant="secondary">{tools.length}</Badge>}
        </div>
      </CardHeader>
      <CardContent>
        <McpToolsTableView
          tools={tools}
          loading={loading}
          error={error}
          showMockUsage={showMockUsage}
          agents={agents}
          emptyDescription="Unavailable"
        />
      </CardContent>
    </Card>
  )
}
