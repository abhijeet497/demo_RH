import { useEffect, useMemo, useState } from "react"
import { CheckCircle2, ChevronDown, ChevronUp, Filter, MoreVertical, XCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MultiSelect } from "@/components/ui/multi-select"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { MapPolicyCatalogRule, MapPolicyMapping } from "@/integrations/traceforce/types"
import { cn } from "@/lib/utils"

export type MappingStatusFilter = "all" | MapPolicyMapping["status"]

const STATUS_SORT_ORDER: Record<MapPolicyMapping["status"], number> = {
  mapped: 0,
  needs_review: 1,
  unmapped: 2,
  excluded: 3,
}

export function mappingStatusCounts(mappings: MapPolicyMapping[]) {
  return {
    mapped: mappings.filter((m) => m.status === "mapped").length,
    needsReview: mappings.filter((m) => m.status === "needs_review").length,
    unmapped: mappings.filter((m) => m.status === "unmapped").length,
    excluded: mappings.filter((m) => m.status === "excluded").length,
    total: mappings.length,
  }
}

function sortMappingsByStatus(mappings: MapPolicyMapping[]): MapPolicyMapping[] {
  return [...mappings].sort(
    (a, b) => (STATUS_SORT_ORDER[a.status] ?? 99) - (STATUS_SORT_ORDER[b.status] ?? 99),
  )
}

/** Parser often sets title = requirement_text.slice(0, 120); avoid showing both. */
function controlDisplayText(title: string | null | undefined, requirementText: string | null | undefined) {
  const t = (title ?? "").trim()
  const r = (requirementText ?? "").trim()
  if (!t && !r) return { heading: "Untitled", body: null as string | null }
  if (!r) return { heading: t, body: null }
  if (!t || r === t || r.startsWith(t)) return { heading: r, body: null }
  return { heading: t, body: r }
}

function statusBadge(status: MapPolicyMapping["status"]) {
  return (
    <Badge variant={status === "mapped" ? "default" : "secondary"}>
      {status.replace("_", " ")}
    </Badge>
  )
}

type FrameworkMappingTableProps = {
  mappings: MapPolicyMapping[]
  /** When provided, default rule / desired state are editable selects. */
  catalog?: MapPolicyCatalogRule[]
  showFilters?: boolean
  /** Native select avoids dialog overflow clipping; collapsible matches Agents/Mcps. */
  filterLayout?: "native" | "collapsible"
  defaultFilter?: MappingStatusFilter
  metaRight?: string
  className?: string
  onUpdateMapping?: (id: string, patch: Partial<MapPolicyMapping>) => void
}

export function FrameworkMappingTable({
  mappings,
  catalog = [],
  showFilters = false,
  filterLayout = "native",
  defaultFilter = "all",
  metaRight,
  className,
  onUpdateMapping,
}: FrameworkMappingTableProps) {
  const [statusFilter, setStatusFilter] = useState<MappingStatusFilter>(defaultFilter)
  const [statusFilters, setStatusFilters] = useState<string[]>(() =>
    defaultFilter === "all" ? [] : [defaultFilter],
  )
  const [filtersOpen, setFiltersOpen] = useState(false)
  const canEditRules = catalog.length > 0 && !!onUpdateMapping
  const canAct = !!onUpdateMapping

  useEffect(() => {
    setStatusFilter(defaultFilter)
    setStatusFilters(defaultFilter === "all" ? [] : [defaultFilter])
  }, [defaultFilter])

  const counts = useMemo(() => mappingStatusCounts(mappings), [mappings])

  const statusFilterOptions = useMemo(
    () => [
      { id: "mapped", name: `Mapped (${counts.mapped})` },
      { id: "needs_review", name: `Needs review (${counts.needsReview})` },
      { id: "unmapped", name: `Unmapped (${counts.unmapped})` },
      { id: "excluded", name: `Excluded (${counts.excluded})` },
    ],
    [counts],
  )

  const filteredMappings = useMemo(() => {
    const filtered = !showFilters
      ? mappings
      : filterLayout === "collapsible"
        ? statusFilters.length === 0
          ? mappings
          : mappings.filter((m) => statusFilters.includes(m.status))
        : statusFilter === "all"
          ? mappings
          : mappings.filter((m) => m.status === statusFilter)
    // mapped → needs_review → unmapped → excluded
    return sortMappingsByStatus(filtered)
  }, [mappings, showFilters, filterLayout, statusFilter, statusFilters])

  const filterOptions: { key: MappingStatusFilter; label: string }[] = [
    { key: "all", label: `All (${counts.total})` },
    { key: "mapped", label: `Mapped (${counts.mapped})` },
    { key: "needs_review", label: `Needs review (${counts.needsReview})` },
    { key: "unmapped", label: `Unmapped (${counts.unmapped})` },
    { key: "excluded", label: `Excluded (${counts.excluded})` },
  ]

  return (
    <div className={cn("space-y-4 flex flex-col min-h-0 min-w-0", className)}>
      {showFilters && filterLayout === "collapsible" && (
        <div className="space-y-4 shrink-0">
          <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="outline">
                <Filter className="h-4 w-4" />
                Filters
                {(() => {
                  const appliedFilters = [statusFilters.length > 0].filter(Boolean).length
                  return appliedFilters > 0 ? (
                    <Badge variant="secondary" className="ml-1">
                      {appliedFilters}
                    </Badge>
                  ) : null
                })()}
                {filtersOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <Card className="mt-4">
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">Status</label>
                      <MultiSelect
                        options={statusFilterOptions}
                        selectedIds={statusFilters}
                        onChange={setStatusFilters}
                        placeholder="All statuses"
                        searchPlaceholder="Search statuses..."
                        emptyMessage="No statuses found."
                        label="status"
                        compact
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </CollapsibleContent>
          </Collapsible>
          {metaRight ? <p className="text-xs text-muted-foreground">{metaRight}</p> : null}
        </div>
      )}

      {showFilters && filterLayout === "native" && (
        <div className="flex flex-wrap items-end justify-between gap-4 shrink-0">
          <div className="w-full max-w-xs space-y-2">
            <label
              htmlFor="framework-mapping-status-filter"
              className="text-sm font-medium text-muted-foreground"
            >
              Status
            </label>
            <select
              id="framework-mapping-status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as MappingStatusFilter)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-medium ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              {filterOptions.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          {metaRight ? <p className="text-xs text-muted-foreground pb-2">{metaRight}</p> : null}
        </div>
      )}

      {!showFilters && metaRight ? (
        <p className="text-xs text-muted-foreground shrink-0">{metaRight}</p>
      ) : null}

      <div className="min-h-0 min-w-0 flex-1 overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Source rule</TableHead>
            <TableHead className={canEditRules ? "min-w-[220px]" : "min-w-[200px]"}>Risk evaluation criterion</TableHead>
            <TableHead className={canEditRules ? "min-w-[160px]" : undefined}>Desired state</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[56px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredMappings.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                No controls in this filter.
              </TableCell>
            </TableRow>
          ) : (
            filteredMappings.map((m) => {
              const rule = catalog.find((r) => r.risk_rule_id === m.risk_rule_id)
              const { heading, body } = controlDisplayText(m.title, m.requirement_text)
              return (
                <TableRow
                  key={m.id}
                  className={cn(m.status === "excluded" && "bg-muted/30 opacity-80")}
                >
                  <TableCell className="align-top">
                    <div className="font-medium">{heading}</div>
                    {body && (
                      <div className="text-xs text-muted-foreground line-clamp-2">
                        {body}
                      </div>
                    )}
                    {m.confidence > 0 && m.status !== "excluded" && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Confidence level:{" "}
                        <span className="font-medium text-foreground tabular-nums">
                          {Math.round(m.confidence * 100)}%
                        </span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="align-top">
                    {canEditRules ? (
                      <Select
                        value={m.risk_rule_id ?? undefined}
                        onValueChange={(v) =>
                          onUpdateMapping?.(m.id, {
                            risk_rule_id: v,
                            ...(m.status === "excluded" ? {} : { status: "mapped" }),
                          })
                        }
                      >
                        <SelectTrigger className="h-9 text-left [&>span]:min-w-0 [&>span]:flex-1 [&>span]:text-left">
                          <SelectValue placeholder="Select a rule…" />
                        </SelectTrigger>
                        <SelectContent align="start">
                          {catalog.map((r) => (
                            <SelectItem key={r.risk_rule_id} value={r.risk_rule_id} className="text-left">
                              {r.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="font-medium">{m.risk_rule_name || "—"}</div>
                    )}
                    {/* Inline the criterion's definition so users don't have to
                        cross-reference the "Risk evaluation criteria" tab. */}
                    {rule?.description && (
                      <p className="mt-1.5 text-xs text-muted-foreground line-clamp-3">
                        {rule.description}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="align-top">
                    {canEditRules ? (
                      <Select
                        value={m.issue_type_id || "__none__"}
                        disabled={!m.risk_rule_id}
                        onValueChange={(v) =>
                          onUpdateMapping?.(m.id, {
                            issue_type_id: v === "__none__" ? null : v,
                          })
                        }
                      >
                        <SelectTrigger className="h-9 text-left [&>span]:min-w-0 [&>span]:flex-1 [&>span]:text-left">
                          <SelectValue placeholder="Select…" />
                        </SelectTrigger>
                        <SelectContent align="start">
                          <SelectItem value="__none__" className="text-left">— None —</SelectItem>
                          {(rule?.issue_types || []).map((it) => (
                            <SelectItem key={it.id} value={it.id} className="text-left">
                              {it.expected_value}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      m.expected_value || "—"
                    )}
                  </TableCell>
                  <TableCell className="align-top">{statusBadge(m.status)}</TableCell>
                  <TableCell className="align-top">
                    {canAct && m.status !== "unmapped" ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {m.status === "needs_review" && (
                            <DropdownMenuItem
                              disabled={!m.risk_rule_id}
                              onClick={() => onUpdateMapping?.(m.id, { status: "mapped" })}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                              Mark as mapped
                            </DropdownMenuItem>
                          )}
                          {m.status === "excluded" ? (
                            <DropdownMenuItem
                              disabled={!m.risk_rule_id}
                              onClick={() => onUpdateMapping?.(m.id, { status: "mapped" })}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                              Include in framework
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => onUpdateMapping?.(m.id, { status: "excluded" })}
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Exclude from framework
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
      </div>
    </div>
  )
}
