import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/integrations/supabase/client"
import { useNavigate } from "react-router-dom"
import {
  LayoutDashboard,
  Users,
  Network,
  Monitor,
  AlertTriangle,
  ArrowRight,
  FileText,
  Download,
  Loader2,
} from "lucide-react"
import { useOrg } from "@/contexts/OrgContext"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { OrgTreeMultiSelect } from "@/components/OrgTreeMultiSelect"
import { useToast } from "@/hooks/use-toast"
import { DistributionCard } from "@/components/charts/DistributionCard"
import { MetricCard } from "@/components/charts/MetricCard"
import { CopilotTenantsCard } from "@/components/CopilotTenantsCard"
import { copilotEnabled } from "@/lib/featureFlags"
import { StackedBar } from "@/components/charts/StackedBar"
import {
  AGENT_DEPLOYMENT_TYPE_MAP,
  AUTH_TYPE_DISPLAY_ORDER,
  AUTH_TYPE_MAP,
  CUSTOM_MCP_SERVER_TYPE,
  getRiskBadge,
  getRiskLevel,
  getRiskTextColor,
} from "@/lib/appUtils"
import {
  type AgentChartRow,
  type McpChartRow,
  type IssuesStats,
  type IssueTypeRow,
  type IssueBucket,
  buildIssuesStats,
  buildIssueTypeDistribution,
  buildIssueTypeChartData,
  buildRiskDistribution,
  buildDeploymentDistribution,
  buildCategoryDistribution,
  buildAuthTypeDistribution,
} from "@/lib/dashboardCharts"
import type {
  ReportAgent,
  ReportIssueRow,
  ReportMcp,
} from "@/lib/dashboardReport"
import { getReportSections } from "@/lib/reportSections"
import { type OrgScorecardRow, orgScorecardStatus } from "@/lib/orgScorecard"
import { OrganizationsCard, type OrgIssueBreakdown } from "@/components/OrganizationsCard"
import { DASHBOARD_ORG_FILTER_KEY } from "@/lib/storageKeys"

// Session-persisted org selection (mirrors how the tenant switcher persists the active org):
// the filter survives navigation, so the default only matters on first load. Best-effort —
// private mode / ITP failures just skip persistence.
function readStoredOrgFilter(): string[] {
  try {
    const raw = sessionStorage.getItem(DASHBOARD_ORG_FILTER_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : []
  } catch {
    return []
  }
}

function calculateOverallRiskScore(
  rows: Array<Pick<AgentChartRow, "actual_score" | "base_score">>,
): number | null {
  const scores = rows
    .map((row) => row.actual_score ?? row.base_score)
    .filter((score): score is number => score !== null)

  if (scores.length === 0) return null

  const average = scores.reduce((sum, score) => sum + score, 0) / scores.length
  return Math.round(average)
}

function writeStoredOrgFilter(ids: string[]): void {
  try {
    sessionStorage.setItem(DASHBOARD_ORG_FILTER_KEY, JSON.stringify(ids))
  } catch { /* best-effort */ }
}

// Optional extensions over the chart-row subsets: the generated rollup Returns
// carry these fields (auth_types once types are regenerated), and optional props
// keep the rpc rows assignable either way.
type AgentRow = AgentChartRow & { agent_name?: string | null }
type McpRow = McpChartRow & {
  mcp_server_type?: number
  mcp_server_name?: string | null
  auth_types?: number[] | null
}

type ReportSnapshot = {
  generatedAt: Date
  scopeDomains: string[]
  // Single predicate for the Organizations report section — dialog list, snapshot fetch, and
  // PDF builders all key off this one flag (reportSections.ts's single-source contract).
  multiOrg: boolean
  scorecard: OrgScorecardRow[]
  deviceCount: number
  agents: ReportAgent[]
  mcps: ReportMcp[]
  agentIssues: ReportIssueRow[]
  mcpIssues: ReportIssueRow[]
}

// ENG-454: localized cast (McpDetail-style) so the row type is the shared OrgScorecardRow,
// including the optional agent_crit_types / mcp_crit_types added by migration 20260915000000.
// Removable once the generated types are regenerated against that migration.
const scorecardRpc = (orgIds: string[]) =>
  (supabase.rpc as unknown as (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: OrgScorecardRow[] | null; error: { message: string } | null }>)(
    "get_org_scorecard_rollup",
    { p_org_ids: orgIds },
  )

// One fetch shape serves both the dashboard load and the report snapshot — the rollups return
// everything both consume (ReportIssueRow is the issue rows' full wire shape; IssueTypeRow the
// charts' structural subset; the issue casts bridge the generated Json type for
// affected_devices, same as the pre-rollup code did).
const fetchDashboardData = (orgIds: string[]) =>
  Promise.all([
    supabase.from("devices_with_owners").select("id", { count: "exact", head: true }).in('org_id', orgIds),
    supabase.rpc("get_active_agents_rollup", { p_org_ids: orgIds }),
    supabase.rpc("get_active_mcp_servers_rollup", { p_org_ids: orgIds }),
    supabase.rpc("get_agent_issues_by_issue_type_rollup", {
      p_org_ids: orgIds,
      p_agent_types: null,
      p_plans: null,
      p_risk_rule_ids: null,
      p_status: 1,
    }),
    supabase.rpc("get_mcp_server_issues_by_issue_type_rollup", {
      p_org_ids: orgIds,
      p_mcp_server_types: null,
      p_agent_types: null,
      p_plans: null,
      p_risk_rule_ids: null,
      p_status: 1,
    }),
  ])

interface SummaryCardProps {
  label: string
  value: number
  subValue?: string
  icon: React.ReactNode
  loading?: boolean
  /** Present only when single-org drill-down is allowed. */
  onView?: () => void
}

const SummaryCard = ({ label, value, subValue, icon, loading, onView }: SummaryCardProps) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 py-3 px-4">
      <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
        {icon}
        {label}
      </CardTitle>
      {/* Drill-down targets are single-org list pages; hidden when the dashboard spans
          multiple orgs — "View" has no honest destination there. Charts gate the same way. */}
      {onView && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-xs text-muted-foreground"
          onClick={onView}
        >
          View
          <ArrowRight className="h-3 w-3" />
        </Button>
      )}
    </CardHeader>
    <CardContent className="px-4 pb-4 pt-0">
      {loading ? (
        <Skeleton className="h-9 w-24" />
      ) : (
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold tabular-nums">{value}</span>
          {subValue && <span className="text-xs text-muted-foreground">{subValue}</span>}
        </div>
      )}
    </CardContent>
  </Card>
)

// Top-5 popularity list: rank, name, instance bar + count, risk badge. Deliberately
// thinner than the report's popularity tables (no score/category/deployment columns) —
// the dashboard card answers "what's most used and how risky", the report elaborates.
const PopularList = ({
  rows,
}: {
  // detail = muted secondary line: deployment surfaces for agents, category for
  // MCPs — the "why are there N instances" hint, kept symmetric across the pair.
  // Rows are deliberately not clickable: the only cheap target is the list-page
  // search box, which over-matches (name/description/agents) and doesn't scope
  // the page's metrics — a misleading half-drill-through.
  rows: { name: string; detail: string; instances: number; score: number | null }[]
}) => {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No data</p>
  }
  const max = Math.max(...rows.map((r) => r.instances), 1)
  return (
    <div className="space-y-3">
      {rows.map((row, i) => (
        // Rank-based key: names can collide (uncatalogued rows all map to
        // "Unknown", and the agents rollup is per (agent_type, plan)).
        <div key={`${i}-${row.name}`} className="flex items-center gap-3">
          <span className="w-5 shrink-0 text-sm font-medium tabular-nums text-muted-foreground">
            {i + 1}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-sm font-medium">{row.name}</span>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {row.instances} {row.instances === 1 ? "instance" : "instances"}
              </span>
            </div>
            <div className="mt-0.5 flex items-center justify-between gap-2">
              <span className="truncate text-xs text-muted-foreground">{row.detail}</span>
              <span className="shrink-0">{getRiskBadge(row.score)}</span>
            </div>
            <div className="mt-1 h-1.5 w-full rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary/70"
                style={{ width: `${(row.instances / max) * 100}%` }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

const Dashboard = () => {
  const { toast } = useToast()
  const navigate = useNavigate()
  const { activeOrgId, homeOrgId, accessibleOrgs, accessibleOrgsResolved, isMultiOrg, orgRole, setActiveOrg } =
    useOrg()
  const [loading, setLoading] = useState(true)
  const [deviceCount, setDeviceCount] = useState(0)
  const [agents, setAgents] = useState<AgentRow[]>([])
  const [mcps, setMcps] = useState<McpRow[]>([])
  const [agentIssuesStats, setAgentIssuesStats] = useState<IssuesStats | null>(null)
  const [mcpIssuesStats, setMcpIssuesStats] = useState<IssuesStats | null>(null)
  const [agentIssueTypes, setAgentIssueTypes] = useState<IssueBucket[]>([])
  const [mcpIssueTypes, setMcpIssueTypes] = useState<IssueBucket[]>([])
  const [selectedOrgIds, setSelectedOrgIds] = useState<string[]>(readStoredOrgFilter)

  const [reportOpen, setReportOpen] = useState(false)
  const [reportLoading, setReportLoading] = useState(false)
  const [reportError, setReportError] = useState<string | null>(null)
  const [reportSnapshot, setReportSnapshot] = useState<ReportSnapshot | null>(null)
  const [generatingPdf, setGeneratingPdf] = useState(false)

  // ENG-454: cross-org slicing. The org filter exists only at home scope — switched into a
  // subsidiary, the dashboard stays pinned to that org (what a native admin of it would see).
  const orgFilterVisible = isMultiOrg && orgRole === "admin" && activeOrgId === homeOrgId

  // Default scope = every accessible org (empty selection), the aggregate the customer asked
  // for and the vendor-standard parent-dashboard landing view. At home scope a session-persisted
  // selection is restored (set once, sticks across navigation); any other org pins to it.
  // Lazy state init + the bail-out below keep the mount a SINGLE fetch: a fresh array identity
  // here would ripple through validSelectedOrgIds -> orgIds and refire the data effect.
  useEffect(() => {
    const next = activeOrgId && activeOrgId === homeOrgId ? readStoredOrgFilter() : []
    setSelectedOrgIds((prev) =>
      prev.length === next.length && prev.every((id, i) => id === next[i]) ? prev : next,
    )
  }, [activeOrgId, homeOrgId])

  const handleOrgFilterChange = (ids: string[]) => {
    setSelectedOrgIds(ids)
    writeStoredOrgFilter(ids)
  }

  // Selections are intersected with the live accessible set (mid-session revocation): Supabase
  // reads for a revoked org never 403 — RLS just returns empty rows — so a stale id would
  // silently understate the data behind the "N orgs selected" trigger.
  const validSelectedOrgIds = useMemo(
    () => selectedOrgIds.filter((id) => accessibleOrgs.some((o) => o.org_id === id)),
    [selectedOrgIds, accessibleOrgs],
  )

  // Empty selection = no filter = every accessible org (same semantics as the other filter bars).
  const orgIds = useMemo(() => {
    if (!orgFilterVisible) return activeOrgId ? [activeOrgId] : []
    return validSelectedOrgIds.length > 0 ? validSelectedOrgIds : accessibleOrgs.map((o) => o.org_id)
  }, [orgFilterVisible, activeOrgId, validSelectedOrgIds, accessibleOrgs])

  // Hold the first fetch until the accessible-orgs question settles: without this, every
  // multi-org admin's hard load renders home-only numbers, then re-skeletons into the aggregate
  // (with View buttons flashing in and out). Bounded: the API client aborts at 30s and the flag
  // flips on failure too, so a broken fill degrades to a home-only dashboard — never a wedge.
  // Only home scope waits; a subsidiary-pinned admin's scope never depends on the fill.
  const awaitingOrgScope = !accessibleOrgsResolved && activeOrgId === homeOrgId

  // Drill-down (View buttons, chart segment clicks) is only honest while exactly one org is in
  // scope — list pages are single-org. Empty filter (= all orgs) and multi-select stay non-drillable.
  // If the selected org isn't the active tenant, navigateToOrgPage switches into it first.
  const drillEnabled = !awaitingOrgScope && orgIds.length === 1
  const drillOrgId = drillEnabled ? orgIds[0] : null

  const navigateToOrgPage = (path: string) => {
    if (!drillOrgId) return
    if (drillOrgId !== activeOrgId) setActiveOrg(drillOrgId)
    navigate(path)
  }

  // Domains behind the current scope, for the report cover/dialog. Empty for non-admins (no
  // accessibleOrgs to resolve against) — their reports stay implicit-single-org, as today.
  const scopeDomains = useMemo(
    () =>
      orgIds
        .map((id) => accessibleOrgs.find((o) => o.org_id === id)?.email_domain)
        .filter((d): d is string => !!d),
    [orgIds, accessibleOrgs],
  )

  // The Organizations list always spans the FULL accessible set, independent of the org filter —
  // it's the comparison surface driving the filter, so it must not vanish when a row is clicked.
  const [scorecard, setScorecard] = useState<OrgScorecardRow[] | null>(null)
  const [scorecardError, setScorecardError] = useState(false)
  useEffect(() => {
    if (!orgFilterVisible) return
    let cancelled = false
    const fetchScorecard = async () => {
      const res = await scorecardRpc(accessibleOrgs.map((o) => o.org_id))
      if (cancelled) return
      if (res.error) {
        // Keep already-rendered rows on a transient refetch failure (OrgContext.refresh
        // convention); the inline error state is only for having nothing to show at all.
        console.error("Error loading organizations list:", res.error)
        setScorecardError(true)
        return
      }
      setScorecardError(false)
      setScorecard(res.data ?? [])
    }
    fetchScorecard()
    return () => {
      cancelled = true
    }
  }, [orgFilterVisible, accessibleOrgs])

  // Needs-attention rows show "N critical agent / M critical connector" links. The split now
  // arrives on the scorecard row itself (agent_crit_types / mcp_crit_types, migration
  // 20260915000000). This used to be a separate fetch of both issue-type rollups PER attention
  // org, in parallel: ~60 heavy RPCs per page load for a large MSP parent, which monopolized the
  // shared PostgREST pool and caused the 2026-09-21 outage. Never reintroduce a per-org fetch here.
  // Rows from a database that predates the migration lack the two columns; those orgs get no
  // entry and OrganizationsCard renders the aggregated sentence instead of the split links.
  const orgIssueBreakdown = useMemo<Record<string, OrgIssueBreakdown>>(
    () =>
      Object.fromEntries(
        (scorecard ?? [])
          .filter((r) => orgScorecardStatus(r) === "attention")
          // High-only attention rows (crit_types 0) keep the aggregated sentence rather than
          // "0 critical agent · 0 critical connector" links.
          .filter((r) => r.crit_types > 0)
          .filter((r) => typeof r.agent_crit_types === "number" && typeof r.mcp_crit_types === "number")
          .map((r) => [r.org_id, { agentIssues: r.agent_crit_types!, mcpIssues: r.mcp_crit_types! }] as const),
      ),
    [scorecard],
  )

  const openOrgIssuesPage = (orgId: string, path: "/agent-issues" | "/mcp-issues") => {
    if (orgId !== activeOrgId) setActiveOrg(orgId)
    navigate(path)
  }

  useEffect(() => {
    if (orgIds.length === 0 || awaitingOrgScope) return
    let cancelled = false

    const fetchAll = async () => {
      setLoading(true)
      try {
        const [devicesRes, agentsRes, mcpsRes, agentIssueTypesRes, mcpIssueTypesRes] =
          await fetchDashboardData(orgIds)

        if (cancelled) return

        if (devicesRes.error) throw devicesRes.error
        if (agentsRes.error) throw agentsRes.error
        if (mcpsRes.error) throw mcpsRes.error
        if (agentIssueTypesRes.error) throw agentIssueTypesRes.error
        if (mcpIssueTypesRes.error) throw mcpIssueTypesRes.error

        setDeviceCount(devicesRes.count ?? 0)
        setAgents(agentsRes.data ?? [])
        setMcps(mcpsRes.data ?? [])

        const agentIssueRows = (agentIssueTypesRes.data ?? []) as unknown as IssueTypeRow[]
        const mcpIssueRows = (mcpIssueTypesRes.data ?? []) as unknown as IssueTypeRow[]

        setAgentIssuesStats(buildIssuesStats(agentIssueRows))
        setMcpIssuesStats(buildIssuesStats(mcpIssueRows))
        setAgentIssueTypes(buildIssueTypeDistribution(agentIssueRows))
        setMcpIssueTypes(buildIssueTypeDistribution(mcpIssueRows))
      } catch (error) {
        if (cancelled) return
        console.error("Error loading dashboard:", error)
        toast({
          title: "Error",
          description: "Failed to load dashboard data",
          variant: "destructive",
        })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchAll()
    return () => {
      cancelled = true
    }
  }, [toast, orgIds, awaitingOrgScope])

  useEffect(() => {
    if (!reportOpen || orgIds.length === 0 || awaitingOrgScope) return
    let cancelled = false

    const fetchReport = async () => {
      setReportLoading(true)
      setReportError(null)
      // A snapshot from a previous org selection must not stay downloadable while the new one loads.
      setReportSnapshot(null)
      try {
        const [
          [devicesRes, agentsRes, mcpsRes, agentIssuesRes, mcpIssuesRes],
          reportScorecardRes,
        ] = await Promise.all([
          fetchDashboardData(orgIds),
          // The report's Organizations section covers the REPORT scope (unlike the dashboard
          // card, which always spans the accessible set); single-org scope omits the section.
          orgIds.length > 1
            ? scorecardRpc(orgIds)
            : Promise.resolve({ data: [] as OrgScorecardRow[], error: null }),
        ])

        if (cancelled) return

        if (devicesRes.error) throw devicesRes.error
        if (agentsRes.error) throw agentsRes.error
        if (mcpsRes.error) throw mcpsRes.error
        if (agentIssuesRes.error) throw agentIssuesRes.error
        if (mcpIssuesRes.error) throw mcpIssuesRes.error
        if (reportScorecardRes.error) throw reportScorecardRes.error

        const reportAgents: ReportAgent[] = (agentsRes.data ?? [])
          // Parity with the previous agent_catalog!inner read: uncataloged agents stay in the
          // charts (the rollup joins the catalog LEFT) but out of the report tables.
          .filter((row) => row.agent_catalog_id !== null)
          .map((row) => ({
            agent_name: row.agent_name ?? "Unknown",
            base_score: row.base_score,
            actual_score: row.actual_score,
            instance_count: row.instance_count,
            deployment_types: row.deployment_types,
          }))

        const reportMcps: ReportMcp[] = (mcpsRes.data ?? []).map((row) => ({
          mcp_server_name: row.mcp_server_name,
          mcp_server_type: row.mcp_server_type,
          base_score: row.base_score,
          actual_score: row.actual_score,
          instance_count: row.instance_count,
          category_id: row.category_id,
          category_name: row.category_name,
          // Generated rollup Returns predate auth_types; drop the cast on types regen.
          auth_types: (row as { auth_types?: number[] | null }).auth_types ?? null,
        }))

        const reportAgentIssues = (agentIssuesRes.data ?? []) as unknown as ReportIssueRow[]
        const reportMcpIssues = (mcpIssuesRes.data ?? []) as unknown as ReportIssueRow[]

        setReportSnapshot({
          generatedAt: new Date(),
          scopeDomains,
          multiOrg: orgIds.length > 1,
          scorecard: reportScorecardRes.data ?? [],
          deviceCount: devicesRes.count ?? 0,
          agents: reportAgents,
          mcps: reportMcps,
          agentIssues: reportAgentIssues,
          mcpIssues: reportMcpIssues,
        })
      } catch (err) {
        console.error("Error loading report data:", err)
        if (!cancelled) {
          setReportError(
            err instanceof Error ? err.message : "Failed to load report data",
          )
          toast({
            title: "Error",
            description: "Failed to load report data",
            variant: "destructive",
          })
        }
      } finally {
        if (!cancelled) setReportLoading(false)
      }
    }

    fetchReport()
    return () => {
      cancelled = true
    }
  }, [reportOpen, toast, orgIds, scopeDomains, awaitingOrgScope])

  const handleDownloadPdf = async () => {
    if (!reportSnapshot || generatingPdf) return
    setGeneratingPdf(true)
    try {
      const { generateDashboardReport } = await import("@/lib/dashboardReport")
      await generateDashboardReport({
        ...reportSnapshot,
        generatedAt: new Date(),
      })
      toast({
        title: "Report ready",
        description: "Your security report has been downloaded.",
      })
      setReportOpen(false)
    } catch (err) {
      console.error("Failed to generate report:", err)
      toast({
        title: "Error",
        description: "Failed to generate PDF report.",
        variant: "destructive",
      })
    } finally {
      setGeneratingPdf(false)
    }
  }

  const agentInstances = useMemo(
    () => agents.reduce((sum, a) => sum + (a.instance_count ?? 0), 0),
    [agents],
  )
  const mcpInstances = useMemo(
    () => mcps.reduce((sum, m) => sum + (m.instance_count ?? 0), 0),
    [mcps],
  )
  const overallRiskScore = useMemo(
    () => calculateOverallRiskScore([...agents, ...mcps]),
    [agents, mcps],
  )
  const agentRisk = useMemo(() => buildRiskDistribution(agents), [agents])
  const mcpRisk = useMemo(() => buildRiskDistribution(mcps), [mcps])
  const deploymentDistribution = useMemo(() => buildDeploymentDistribution(agents), [agents])
  const categoryDistribution = useMemo(() => buildCategoryDistribution(mcps), [mcps])

  // Popularity = instance volume across the selected scope. Custom MCP servers are
  // excluded (no meaningful identity to rank), matching the report tables; auth below
  // includes them — auth is a property, not an identity.
  const popularAgents = useMemo(
    () =>
      [...agents]
        .sort((a, b) => (b.instance_count ?? 0) - (a.instance_count ?? 0))
        .slice(0, 5),
    [agents],
  )
  const popularMcps = useMemo(
    () =>
      mcps
        .filter((m) => m.mcp_server_type !== CUSTOM_MCP_SERVER_TYPE)
        .sort((a, b) => (b.instance_count ?? 0) - (a.instance_count ?? 0))
        .slice(0, 5),
    [mcps],
  )
  const authDistribution = useMemo(() => buildAuthTypeDistribution(mcps), [mcps])

  const agentIssueTypeChart = useMemo(
    () => buildIssueTypeChartData(agentIssueTypes),
    [agentIssueTypes],
  )
  const mcpIssueTypeChart = useMemo(
    () => buildIssueTypeChartData(mcpIssueTypes),
    [mcpIssueTypes],
  )

  const handleRiskSegmentClick = (target: "/agents" | "/mcps") => (name: string) => {
    const key = name.toLowerCase()
    navigateToOrgPage(`${target}?risk=${encodeURIComponent(key)}`)
  }

  const handleDeploymentSegmentClick = (name: string) => {
    const entry = Object.entries(AGENT_DEPLOYMENT_TYPE_MAP).find(([, label]) => label === name)
    if (entry) {
      navigateToOrgPage(`/agents?deploymentType=${encodeURIComponent(entry[0])}`)
    }
  }

  const handleAuthSegmentClick = (name: string) => {
    const type = AUTH_TYPE_DISPLAY_ORDER.find((t) => AUTH_TYPE_MAP[t] === name)
    navigateToOrgPage(type !== undefined ? `/mcps?auth=${type}` : "/mcps")
  }

  const handleCategorySegmentClick = (name: string) => {
    const match = mcps.find((m) => (m.category_name ?? "Unknown") === name)
    if (match?.category_id) {
      navigateToOrgPage(`/mcps?category=${encodeURIComponent(match.category_id)}`)
    } else {
      navigateToOrgPage("/mcps")
    }
  }

  const handleAgentIssueTypeClick = (name: string) => {
    const match = agentIssueTypes.find((b) => b.name === name)
    if (match) {
      navigateToOrgPage(`/agent-issues?risk_attribute=${encodeURIComponent(match.riskRuleId)}`)
    } else {
      navigateToOrgPage("/agent-issues")
    }
  }

  const handleMcpIssueTypeClick = (name: string) => {
    const match = mcpIssueTypes.find((b) => b.name === name)
    if (match) {
      navigateToOrgPage(`/mcp-issues?risk_attribute=${encodeURIComponent(match.riskRuleId)}`)
    } else {
      navigateToOrgPage("/mcp-issues")
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-lg bg-primary/10">
            <LayoutDashboard className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Dashboard
            </h1>
            <p className="text-muted-foreground">
              High-level overview of AI inventory and top security issues
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-baseline gap-2 whitespace-nowrap">
            <span className="text-sm text-muted-foreground">Overall risk</span>
            {loading ? (
              <Skeleton className="h-7 w-12" />
            ) : (
              <div className={`flex items-baseline gap-1.5 ${getRiskTextColor(overallRiskScore)}`}>
                <span className="text-2xl font-bold tabular-nums">
                  {overallRiskScore ?? "—"}
                </span>
                {overallRiskScore !== null && (
                  <span className="text-sm font-medium">/ 100</span>
                )}
                <span className="text-sm font-medium">
                  {getRiskLevel(overallRiskScore)}
                </span>
              </div>
            )}
          </div>
          {orgFilterVisible && (
            <div className="w-full sm:w-64">
              <OrgTreeMultiSelect
                selectedIds={validSelectedOrgIds}
                onChange={handleOrgFilterChange}
                placeholder={`All Organizations (${accessibleOrgs.length})`}
                searchPlaceholder="Search organizations..."
                emptyMessage="No organizations found."
                label="organization"
              />
            </div>
          )}
          <Button
            size="lg"
            onClick={() => setReportOpen(true)}
            className="shrink-0"
          >
            <FileText className="h-4 w-4" />
            Generate Report
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <SummaryCard
          label="Devices"
          value={deviceCount}
          icon={<Monitor className="h-4 w-4" />}
          loading={loading}
          onView={drillEnabled ? () => navigateToOrgPage("/devices") : undefined}
        />
        <SummaryCard
          label="AI Agents"
          value={agentInstances}
          subValue={`${agents.length} types`}
          icon={<Users className="h-4 w-4" />}
          loading={loading}
          onView={drillEnabled ? () => navigateToOrgPage("/agents") : undefined}
        />
        <SummaryCard
          label="Connectors"
          value={mcpInstances}
          subValue={`${mcps.length} types`}
          icon={<Network className="h-4 w-4" />}
          loading={loading}
          onView={drillEnabled ? () => navigateToOrgPage("/mcps") : undefined}
        />
        <SummaryCard
          label="Agent Issues"
          value={agentIssuesStats?.issuesCount ?? 0}
          subValue={
            agentIssuesStats
              ? `${agentIssuesStats.affectedDevices} devices affected`
              : undefined
          }
          icon={<AlertTriangle className="h-4 w-4" />}
          loading={loading}
          onView={drillEnabled ? () => navigateToOrgPage("/agent-issues") : undefined}
        />
        <SummaryCard
          label="Connector Issues"
          value={mcpIssuesStats?.issuesCount ?? 0}
          subValue={
            mcpIssuesStats
              ? `${mcpIssuesStats.affectedDevices} devices affected`
              : undefined
          }
          icon={<AlertTriangle className="h-4 w-4" />}
          loading={loading}
          onView={drillEnabled ? () => navigateToOrgPage("/mcp-issues") : undefined}
        />
      </div>

      {orgFilterVisible && (
        <OrganizationsCard
          rows={scorecard}
          error={scorecardError && scorecard === null}
          selectedOrgId={validSelectedOrgIds.length === 1 ? validSelectedOrgIds[0] : null}
          onSelectOrg={(orgId) =>
            handleOrgFilterChange(
              validSelectedOrgIds.length === 1 && validSelectedOrgIds[0] === orgId
                ? []
                : [orgId],
            )
          }
          issueBreakdown={orgIssueBreakdown}
          onOpenAgentIssues={(orgId) => openOrgIssuesPage(orgId, "/agent-issues")}
          onOpenMcpIssues={(orgId) => openOrgIssuesPage(orgId, "/mcp-issues")}
        />
      )}

      {copilotEnabled && <CopilotTenantsCard />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DistributionCard
          id="agent-deployment"
          title="AI Agents — Deployment Types"
          loading={loading}
          data={deploymentDistribution}
          onItemClick={drillEnabled ? handleDeploymentSegmentClick : undefined}
        />
        <DistributionCard
          id="mcp-categories"
          title="Connectors — Categories"
          loading={loading}
          data={categoryDistribution}
          maxLegendItems={5}
          onItemClick={drillEnabled ? handleCategorySegmentClick : undefined}
        />
        <DistributionCard
          id="agent-risk"
          title="AI Agents — Risk Breakdown"
          loading={loading}
          data={agentRisk}
          onItemClick={drillEnabled ? handleRiskSegmentClick("/agents") : undefined}
        />
        <DistributionCard
          id="mcp-risk"
          title="Connectors — Risk Breakdown"
          loading={loading}
          data={mcpRisk}
          onItemClick={drillEnabled ? handleRiskSegmentClick("/mcps") : undefined}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DistributionCard
          id="agent-top-rules"
          title="Agent Issues — Top Risk Rules"
          loading={loading}
          data={agentIssueTypeChart}
          maxLegendItems={5}
          onItemClick={drillEnabled ? handleAgentIssueTypeClick : undefined}
        />
        <DistributionCard
          id="mcp-top-rules"
          title="Connector Issues — Top Risk Rules"
          loading={loading}
          data={mcpIssueTypeChart}
          maxLegendItems={5}
          onItemClick={drillEnabled ? handleMcpIssueTypeClick : undefined}
        />
      </div>

      <MetricCard title="Connectors — Authentication" loading={loading}>
        <StackedBar
          data={authDistribution}
          onSegmentClick={drillEnabled ? handleAuthSegmentClick : undefined}
        />
      </MetricCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <MetricCard title="Most Popular AI Agents" loading={loading}>
          <PopularList
            rows={popularAgents.map((a) => ({
              name: a.agent_name ?? "Unknown",
              detail:
                (a.deployment_types ?? [])
                  .filter((t) => t !== 0)
                  .map((t) => AGENT_DEPLOYMENT_TYPE_MAP[t])
                  .join(" · ") || "Unknown",
              instances: a.instance_count ?? 0,
              score: a.actual_score ?? a.base_score,
            }))}
          />
        </MetricCard>
        <MetricCard title="Most Popular Connectors" loading={loading}>
          <PopularList
            rows={popularMcps.map((m) => ({
              name: m.mcp_server_name ?? "Unknown",
              detail: m.category_name ?? "Unknown",
              instances: m.instance_count ?? 0,
              score: m.actual_score ?? m.base_score,
            }))}
          />
        </MetricCard>
      </div>


      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Security Report
            </DialogTitle>
            <DialogDescription>
              An executive briefing on your organization's AI agent and connector
              security posture — quantifying risk exposure, surfacing
              top concerns, and prioritizing remediation.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {reportError && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4" />
                {reportError}
              </div>
            )}

            {scopeDomains.length > 0 && (
              <p className="text-sm">
                <span className="font-medium">Scope:</span>{" "}
                <span className="text-muted-foreground">{scopeDomains.join(", ")}</span>
              </p>
            )}

            <div>
              <p className="text-sm font-medium mb-2">
                What's included in the PDF
              </p>
              <ol className="space-y-3">
                {getReportSections({ multiOrg: orgIds.length > 1 }).map((section, idx) => (
                  <li key={section.title} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {idx + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium">{section.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {section.description}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReportOpen(false)}
              disabled={generatingPdf}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDownloadPdf}
              disabled={
                reportLoading ||
                !!reportError ||
                !reportSnapshot ||
                generatingPdf
              }
            >
              {generatingPdf ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {generatingPdf ? "Generating…" : "Download PDF"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Dashboard
