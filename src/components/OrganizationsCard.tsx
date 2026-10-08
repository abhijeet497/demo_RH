import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import {
  type OrgScorecardRow,
  type OrgScorecardStatus,
  ORG_STATUS_LABELS,
  orgScorecardStatus,
  orgScorecardSentenceParts,
} from "@/lib/orgScorecard"

// ENG-454: the "Organizations" list — which org needs attention first. Rows
// arrive pre-ordered from get_org_scorecard_rollup (never re-sorted here);
// clicking a row narrows the dashboard's org filter to that org (clicking the
// selected row again clears back to all). Needs-attention rows also show
// linked agent/MCP issue counts that switch into that org then open the page.

// Semantic severity tokens (same trio SEVERITY_LEVELS uses in appUtils) so dark mode is
// correct by construction; notReporting has no matching token — hollow muted ring instead.
const STATUS_DOT_CLASS: Record<OrgScorecardStatus, string> = {
  attention: "bg-destructive",
  watch: "bg-warning",
  ok: "bg-success",
  notReporting: "border border-muted-foreground/60",
}

// Beyond this many rows, the quiet groups (OK / No devices) collapse
// behind a "Show more" control; attention and watch rows always render.
const COLLAPSE_THRESHOLD = 8

export type OrgIssueBreakdown = {
  agentIssues: number
  mcpIssues: number
}

interface OrganizationsCardProps {
  rows: OrgScorecardRow[] | null // null = loading
  error?: boolean
  selectedOrgId: string | null
  onSelectOrg: (orgId: string) => void
  /** Controllable open critical-issue counts per org (attention rows). */
  issueBreakdown?: Record<string, OrgIssueBreakdown>
  /** True while attention-row critical counts are still loading — never fall back to the
   * aggregated severity sentence, or it flashes before the agent/MCP split arrives. */
  issueBreakdownLoading?: boolean
  onOpenAgentIssues?: (orgId: string) => void
  onOpenMcpIssues?: (orgId: string) => void
}

const IssueCountLink = ({
  count,
  label,
  onClick,
}: {
  count: number
  label: string
  onClick: () => void
}) => (
  <button
    type="button"
    className="font-medium text-destructive underline-offset-2 hover:underline tabular-nums"
    onClick={(e) => {
      e.stopPropagation()
      onClick()
    }}
  >
    {count} {label}
  </button>
)

const OrgRow = ({
  row,
  selected,
  onSelect,
  breakdown,
  breakdownLoading,
  onOpenAgentIssues,
  onOpenMcpIssues,
}: {
  row: OrgScorecardRow
  selected: boolean
  onSelect: () => void
  breakdown?: OrgIssueBreakdown
  breakdownLoading?: boolean
  onOpenAgentIssues?: (orgId: string) => void
  onOpenMcpIssues?: (orgId: string) => void
}) => {
  const status = orgScorecardStatus(row)
  const muted = status === "notReporting"
  const { critical, rest } = orgScorecardSentenceParts(row)
  const isAttention = status === "attention"
  const showIssueLinks =
    isAttention && breakdown && onOpenAgentIssues && onOpenMcpIssues
  // Only an explicit loading flag shows the skeleton. A missing breakdown means the split is
  // unavailable (scorecard row predates migration 20260915000000): render the aggregated sentence.
  const showAttentionSkeleton = isAttention && !!breakdownLoading

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onSelect()
        }
      }}
      aria-pressed={selected}
      title={
        selected
          ? "Filtered to this organization — click to show all"
          : "Filter the dashboard to this organization"
      }
      className={cn(
        "flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left hover:bg-muted/50",
        selected && "bg-muted/50 ring-1 ring-primary",
      )}
    >
      <span className="flex w-32 shrink-0 items-center gap-1.5">
        <span className={cn("h-2 w-2 shrink-0 rounded-full", STATUS_DOT_CLASS[status])} />
        <span className={cn("text-xs font-medium", muted && "text-muted-foreground")}>
          {ORG_STATUS_LABELS[status]}
        </span>
      </span>
      <span
        className={cn(
          "min-w-0 truncate text-sm font-medium",
          muted && "text-muted-foreground font-normal",
        )}
      >
        {row.email_domain}
      </span>
      <span className="min-w-0 truncate text-sm text-muted-foreground tabular-nums">
        {showIssueLinks ? (
          <>
            <IssueCountLink
              count={breakdown.agentIssues}
              label={breakdown.agentIssues === 1 ? "critical agent issue" : "critical agent issues"}
              onClick={() => onOpenAgentIssues(row.org_id)}
            />
            <span className="mx-1.5 text-muted-foreground/60">·</span>
            <IssueCountLink
              count={breakdown.mcpIssues}
              label={breakdown.mcpIssues === 1 ? "critical connector issue" : "critical connector issues"}
              onClick={() => onOpenMcpIssues(row.org_id)}
            />
          </>
        ) : showAttentionSkeleton ? (
          // Hold the slot while critical agent/MCP counts load — never flash the old
          // aggregated "N critical, M high" sentence.
          <Skeleton className="inline-block h-4 w-48 align-middle" />
        ) : (
          <>
            {critical && <span className="font-medium text-destructive">{critical}</span>}
            {rest}
          </>
        )}
      </span>
    </div>
  )
}

export function OrganizationsCard({
  rows,
  error,
  selectedOrgId,
  onSelectOrg,
  issueBreakdown,
  issueBreakdownLoading,
  onOpenAgentIssues,
  onOpenMcpIssues,
}: OrganizationsCardProps) {
  const [showAll, setShowAll] = useState(false)

  const loading = rows === null
  const active = (rows ?? []).filter((r) => {
    const s = orgScorecardStatus(r)
    return s === "attention" || s === "watch"
  })
  const quiet = (rows ?? []).filter((r) => {
    const s = orgScorecardStatus(r)
    return s === "ok" || s === "notReporting"
  })
  const collapseQuiet =
    !showAll && (rows?.length ?? 0) > COLLAPSE_THRESHOLD && quiet.length > 0

  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Organizations
        </CardTitle>
      </CardHeader>
      <CardContent className="px-2 pb-3 pt-0">
        {error ? (
          <p className="px-2 py-1.5 text-sm text-muted-foreground">
            Couldn't load organizations.
          </p>
        ) : loading ? (
          <div className="space-y-2 px-2">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-2/3" />
          </div>
        ) : (
          <div className="space-y-0.5">
            {active.length === 0 && (
              <p className="px-2 py-1.5 text-sm text-muted-foreground">
                All organizations look good — no open critical or high issues.
              </p>
            )}
            {active.map((row) => (
              <OrgRow
                key={row.org_id}
                row={row}
                selected={row.org_id === selectedOrgId}
                onSelect={() => onSelectOrg(row.org_id)}
                breakdown={issueBreakdown?.[row.org_id]}
                breakdownLoading={issueBreakdownLoading}
                onOpenAgentIssues={onOpenAgentIssues}
                onOpenMcpIssues={onOpenMcpIssues}
              />
            ))}
            {!collapseQuiet &&
              quiet.map((row) => (
                <OrgRow
                  key={row.org_id}
                  row={row}
                  selected={row.org_id === selectedOrgId}
                  onSelect={() => onSelectOrg(row.org_id)}
                />
              ))}
            {collapseQuiet &&
              quiet
                .filter((row) => row.org_id === selectedOrgId)
                .map((row) => (
                  <OrgRow key={row.org_id} row={row} selected onSelect={() => onSelectOrg(row.org_id)} />
                ))}
            {collapseQuiet && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground"
                onClick={() => setShowAll(true)}
              >
                Show {quiet.length} more
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
