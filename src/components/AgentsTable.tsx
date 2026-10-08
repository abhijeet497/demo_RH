import { useState, useMemo } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { Users, Search, Download, Loader2, Info } from "lucide-react"
import { useTableSort } from "@/hooks/use-table-sort"
import { useUrlStringFilter } from "@/hooks/use-url-filters"
import { SortableTableHead } from "@/components/SortableTableHead"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { useAiAccessBlockConfig } from "@/hooks/use-ai-access-block-config"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useToast } from "@/hooks/use-toast"
import {
  getRiskLevel, getPlan, getPlanBadge, getEffectivePlan,
  formatScore, getAgentDeploymentTypeBadge,
  getAgentDeploymentType, getScoreBadgeWithDiff,
  getHostBadge, getSandboxRuntimeType, getSandboxRuntimeTypeBadge, getEnvironmentBadge,
} from "@/lib/appUtils"
import { formatCopilotDate } from "@/lib/copilot"
import { downloadCsv, csvTimestamp } from "@/lib/csvUtils"

// Placeholder for columns that do not apply to a row (e.g. risk on Copilot agents).
const NOT_APPLICABLE = <span className="text-muted-foreground">—</span>

interface AgentsTableProps {
  agents: any[]
  loading: boolean
  deviceSpecificDeploymentTypes?: Map<string, Set<number>>
  deviceSpecificHasHostInstances?: Map<string, boolean>
  deviceSpecificSandboxRuntimeTypes?: Map<string, Set<number>>
  hasDeviceFilter?: boolean
  onRowClick?: (agent: any) => void
  hideActiveDevices?: boolean
  hideActiveIssues?: boolean
  // Two-way ?search= sync for standalone list pages. Off by default: DeviceDetail
  // embeds both tables on one page, and they'd fight over a shared URL key.
  syncSearchToUrl?: boolean
  // Shows the "AI App Access" column (Allowed/Blocked), resolved from the AI Access
  // policy's Blocked-AI-applications selection against each agent's origin/type.
  showEnforcementStatus?: boolean
}

const AgentsTable = ({
  agents,
  loading,
  deviceSpecificDeploymentTypes,
  deviceSpecificHasHostInstances,
  deviceSpecificSandboxRuntimeTypes,
  hasDeviceFilter = false,
  onRowClick,
  hideActiveDevices = false,
  hideActiveIssues = false,
  syncSearchToUrl = false,
  showEnforcementStatus = false,
}: AgentsTableProps) => {
  const navigate = useNavigate()
  const location = useLocation()
  const { toast } = useToast()
  // ?search= is URL-backed when syncSearchToUrl; both flavors are always
  // called (hooks are unconditional) and the prop picks which one is live.
  const [localSearchTerm, setLocalSearchTerm] = useState("")
  const [urlSearchTerm, setUrlSearchTerm] = useUrlStringFilter('search')
  const searchTerm = syncSearchToUrl ? urlSearchTerm : localSearchTerm
  const setSearchTerm = syncSearchToUrl ? setUrlSearchTerm : setLocalSearchTerm
  const [exportLoading, setExportLoading] = useState(false)
  const { sort, handleSort, sortItems } = useTableSort()

  // AI App Access status is resolved from the org's ACTIVE AI Access policies
  // (category 5) against each agent's agent_type / origin_country — i.e. what is
  // actually enforced on devices. The hook is always called (unconditional).
  // Only query policies when the AI App Access column is actually shown — AgentsTable
  // is reused without it (e.g. DeviceDetail), which must not trigger an unused read.
  const { status: aiAccessStatus, loading: aiAccessLoading, error: aiAccessError, enforced: aiAccessEnforced } = useAiAccessBlockConfig(showEnforcementStatus)
  // Single source of truth for the AI App Access state, as text — the badge renders it
  // and handleExportCsv exports the same vocabulary (mirrors McpsTable's Access Status).
  const enforcementStatusLabel = (agent: any): string => {
    if (agent.source === 'copilot') return "—" // AI App Access policies cover device agents only
    // Until the policy + feature-flag queries resolve, status is unknown — "—", never a
    // premature "Allowed"/"Blocked". A FAILED read is "Unavailable", not a false "off".
    if (aiAccessLoading) return "—"
    if (aiAccessError) return "Unavailable"
    // Blocking is a per-org feature flag that defaults OFF. With it off, scout enforces
    // nothing, so the policy selection blocks nothing on devices — don't claim "Blocked".
    if (!aiAccessEnforced) return "Not enforced"
    // A hostless catalog row can't be blocked at the network layer (no hosts to drop),
    // so it is never Blocked even if its origin matches — mirrors useBlockableAgents,
    // which excludes hostless rows from the selectable list.
    if (!Array.isArray(agent.hosts) || agent.hosts.length === 0) return "Allowed"
    switch (aiAccessStatus(agent.agent_type, agent.origin_country)) {
      case "blocked": return "Blocked"
      // Blocked only by a group-scoped policy — not org-wide, since an Agents row
      // aggregates many users.
      case "partial": return "Some groups"
      default: return "Allowed"
    }
  }
  const enforcementBadge = (agent: any) => {
    switch (enforcementStatusLabel(agent)) {
      case "—": return <span className="text-muted-foreground">—</span>
      case "Unavailable": return <Badge variant="outline">Unavailable</Badge>
      case "Not enforced": return <Badge variant="outline" title="Agent blocking is disabled for this org">Not enforced</Badge>
      case "Blocked": return <Badge variant="destructive">Blocked</Badge>
      case "Some groups": return <Badge variant="secondary">Some groups</Badge>
      default: return <Badge variant="success">Allowed</Badge>
    }
  }

  // Tenant column appears once any row carries a Microsoft 365 tenant.
  const showTenant = agents.some((a) => a.tenant_domain)
  const colCount = 9 + (showEnforcementStatus ? 1 : 0) + (showTenant ? 1 : 0) - (hideActiveIssues ? 1 : 0) - (hideActiveDevices ? 1 : 0)
  const filteredAgents = agents.filter((agent) => {
    if (!searchTerm) return true
    const lower = searchTerm.toLowerCase()
    return agent.agent_name?.toLowerCase().includes(lower) ||
           agent.description?.toLowerCase().includes(lower)
  })

  const sortedAgents = useMemo(() => {
    return sortItems(filteredAgents, (agent, column) => {
      switch (column) {
        case 'name': return agent.agent_name?.toLowerCase()
        case 'risk': return agent.actual_score ?? agent.base_score
        case 'issues': return agent.active_issues
        case 'devices': return agent.active_users
        case 'first_seen': return agent.first_seen_at ? new Date(agent.first_seen_at).getTime() : null
        case 'last_active': return agent.last_active_at ? new Date(agent.last_active_at).getTime() : null
        default: return null
      }
    })
  }, [filteredAgents, sort])

  const handleExportCsv = () => {
    setExportLoading(true)
    try {
      const rows = filteredAgents.map((agent) => {
        const envParts: string[] = [...(agent.environment_labels || [])]
        if (agent.has_host_instances) envParts.push('Host')
        ;(agent.sandbox_runtime_types || []).forEach((t: number) => envParts.push(getSandboxRuntimeType(t)))
        const row: Record<string, any> = {
          'Agent Name': agent.agent_name ?? '-',
          ...(showTenant ? { 'Tenant': agent.tenant_domain ?? '-' } : {}),
          'Description': agent.description ?? '-',
          'Plan': agent.source === 'copilot' ? '-' : getPlan(getEffectivePlan(agent.agent_type, agent.plan)),
          'Deployment Types': agent.source === 'copilot'
            ? agent.copilot_platform ?? '-'
            : (agent.deployment_types || []).map((t: number) => getAgentDeploymentType(t)).join(', ') || '-',
          'Environment': envParts.join(', ') || '-',
          'Risk': agent.base_score != null ? getRiskLevel(agent.actual_score ?? agent.base_score) : '-',
        }
        if (!hideActiveIssues) {
          row['Active Issues'] = agent.active_issues ?? '-'
        }
        if (!hideActiveDevices) {
          row['Active Users'] = agent.active_users ?? '-'
        }
        row['First Seen'] = agent.first_seen_at ? new Date(agent.first_seen_at).toLocaleDateString() : '-'
        row['Last Active'] = !agent.last_active_at ? '-'
          : agent.source === 'copilot' ? formatCopilotDate(agent.last_active_at)
          : new Date(agent.last_active_at).toLocaleString()
        if (showEnforcementStatus) {
          // Same vocabulary as the on-screen badge, so the export matches the table.
          row['AI App Access'] = enforcementStatusLabel(agent)
        }
        return row
      })
      const timestamp = csvTimestamp()
      downloadCsv(rows, `agents-${timestamp}.csv`)
    } catch (e) {
      console.error('Export failed:', e)
      toast({ title: 'Export failed', description: 'Could not generate CSV', variant: 'destructive' })
    } finally {
      setExportLoading(false)
    }
  }

  const handleRowClick = (agent: any) => {
    if (onRowClick) {
      onRowClick(agent)
    } else if (agent.source === 'copilot') {
      // The Copilot detail page restores the filtered list from ?back=.
      navigate(`${agent.detail_path}?back=${encodeURIComponent(location.search.replace(/^\?/, ''))}`)
    } else {
      // Carry the list's current query string so the detail page's back button
      // can restore the filtered view (same pattern as Devices -> DeviceDetail).
      // Rows from other sources (e.g. AWS Bedrock runtimes) carry their own detail page.
      navigate(agent.detail_path ?? `/agents/${agent.id}`, { state: { backSearch: location.search.replace(/^\?/, '') } })
    }
  }

  return (
    <div className="border rounded-lg">
      {/* 8px column padding, as on the Connectors and Devices tables; the
          search/filter bar row keeps its own padding. */}
      <Table className="[&_tbody_td]:px-2 [&_thead_tr:last-child_th]:px-2">
        <TableHeader>
          <TableRow>
            <TableHead colSpan={colCount} className="border-b-0 pb-4 pt-6">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="relative max-w-sm">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search agents..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-10"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportCsv}
                  disabled={exportLoading || filteredAgents.length === 0}
                  className="gap-2 text-foreground"
                >
                  {exportLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  Export
                </Button>
              </div>
            </TableHead>
          </TableRow>
          <TableRow>
            <SortableTableHead column="name" currentColumn={sort.column} direction={sort.direction} onSort={handleSort}>Agent</SortableTableHead>
            {showTenant && <TableHead>Tenant</TableHead>}
            <TableHead>Plan</TableHead>
            <TableHead>Deployment Types</TableHead>
            <TableHead>Environment</TableHead>
            <SortableTableHead column="risk" currentColumn={sort.column} direction={sort.direction} onSort={handleSort} className="whitespace-nowrap">
              <span>Risk</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="bg-accent/10 backdrop-blur-sm border-accent/20">
                    <p>Inherent risk level. Change from actual shown when available.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </SortableTableHead>
            {!hideActiveIssues && <SortableTableHead column="issues" currentColumn={sort.column} direction={sort.direction} onSort={handleSort}>Active Issues</SortableTableHead>}
            {!hideActiveDevices && <SortableTableHead column="devices" currentColumn={sort.column} direction={sort.direction} onSort={handleSort}>Active Users</SortableTableHead>}
            <SortableTableHead column="first_seen" currentColumn={sort.column} direction={sort.direction} onSort={handleSort} className="whitespace-nowrap">First Seen</SortableTableHead>
            <SortableTableHead column="last_active" currentColumn={sort.column} direction={sort.direction} onSort={handleSort}>Last Active</SortableTableHead>
            {showEnforcementStatus && <TableHead className="whitespace-nowrap">AI App Access</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            Array.from({ length: 5 }).map((_, index) => (
              <TableRow key={index}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                  </div>
                </TableCell>
                {showTenant && <TableCell><Skeleton className="h-4 w-24" /></TableCell>}
                <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                {!hideActiveIssues && <TableCell><Skeleton className="h-4 w-12" /></TableCell>}
                {!hideActiveDevices && <TableCell><Skeleton className="h-4 w-12" /></TableCell>}
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                {showEnforcementStatus && <TableCell><Skeleton className="h-5 w-20" /></TableCell>}
              </TableRow>
            ))
          ) : filteredAgents.length === 0 ? (
            <TableRow>
              <TableCell colSpan={colCount} className="text-center py-8 text-muted-foreground">
                No agents found matching your criteria
              </TableCell>
            </TableRow>
          ) : (
            sortedAgents.map((agent) => (
              <TableRow
                key={agent.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleRowClick(agent)}
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-muted/50 overflow-hidden shrink-0">
                      {agent.logo_url ? (
                        <img
                          src={agent.logo_url}
                          alt={agent.agent_name}
                          className="h-8 w-8 object-contain"
                        />
                      ) : (
                        <Users className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <div>
                      <div className="font-medium text-foreground flex items-center gap-2">
                        {agent.agent_name}
                        {agent.source === 'copilot' && agent.copilot_status && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{agent.copilot_status}</Badge>
                        )}
                        {agent.blocked && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Blocked</Badge>
                        )}
                      </div>
                      {agent.description && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="text-sm text-muted-foreground line-clamp-2 max-w-md underline-offset-4 cursor-help hover:opacity-80 transition-opacity">
                                {agent.description}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-sm">
                              <p className="text-sm whitespace-normal">{agent.description}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  </div>
                </TableCell>
                {showTenant && (
                  <TableCell className="text-sm whitespace-nowrap">
                    {agent.source === 'copilot' && agent.tenant_id ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="font-mono cursor-help">{agent.tenant_id.slice(0, 8)}</span>
                          </TooltipTrigger>
                          <TooltipContent><p className="font-mono">{agent.tenant_id}</p></TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (agent.tenant_domain ?? NOT_APPLICABLE)}
                  </TableCell>
                )}
                <TableCell>
                  {agent.source === 'copilot'
                    ? NOT_APPLICABLE
                    : getPlanBadge(getEffectivePlan(agent.agent_type, agent.plan))}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {agent.source === 'copilot' ? (
                      <span className="text-sm">{agent.copilot_platform ?? '—'}</span>
                    ) : agent.deployment_types && agent.deployment_types.length > 0 ? (
                      (() => {
                        const agentKey = `${agent.agent_type}:${agent.plan}`
                        const deviceTypes = deviceSpecificDeploymentTypes?.get(agentKey)

                        // Filter to only device-specific types when device filter is active
                        const typesToShow = hasDeviceFilter && deviceTypes
                          ? agent.deployment_types.filter((type: number) => deviceTypes.has(type))
                          : agent.deployment_types

                        if (typesToShow.length === 0) {
                          return <span className="text-muted-foreground text-sm">None</span>
                        }

                        return typesToShow
                          .sort((a: number, b: number) => getAgentDeploymentType(a).localeCompare(getAgentDeploymentType(b)))
                          .map((type: number, index: number) => (
                            <span key={index}>
                              {getAgentDeploymentTypeBadge(type)}
                            </span>
                          ))
                      })()
                    ) : (
                      <span className="text-muted-foreground text-sm">None</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {(() => {
                    // Rows from sources without device telemetry name their own
                    // environment rather than deriving it from sandbox runtimes.
                    if (agent.environment_labels?.length) {
                      return (
                        <div className="flex flex-wrap gap-1">
                          {agent.environment_labels.map((label: string) => (
                            <span key={label}>{getEnvironmentBadge(label)}</span>
                          ))}
                        </div>
                      )
                    }
                    const agentKey = `${agent.agent_type}:${agent.plan}`
                    const deviceHost = deviceSpecificHasHostInstances?.get(agentKey)
                    const deviceRuntimes = deviceSpecificSandboxRuntimeTypes?.get(agentKey)
                    const showHost = hasDeviceFilter && deviceSpecificHasHostInstances
                      ? !!deviceHost
                      : !!agent.has_host_instances
                    const runtimesToShow: number[] = hasDeviceFilter && deviceRuntimes
                      ? (agent.sandbox_runtime_types || []).filter((t: number) => deviceRuntimes.has(t))
                      : (agent.sandbox_runtime_types || [])
                    if (!showHost && runtimesToShow.length === 0) {
                      return <span className="text-muted-foreground text-sm">None</span>
                    }
                    return (
                      <div className="flex flex-wrap gap-1">
                        {showHost && <span>{getHostBadge()}</span>}
                        {runtimesToShow
                          .sort((a: number, b: number) => getSandboxRuntimeType(a).localeCompare(getSandboxRuntimeType(b)))
                          .map((type: number) => (
                            <span key={type}>{getSandboxRuntimeTypeBadge(type)}</span>
                          ))}
                      </div>
                    )
                  })()}
                </TableCell>
                <TableCell>
                  {agent.source === 'copilot' ? NOT_APPLICABLE : getScoreBadgeWithDiff(agent.base_score, agent.actual_score) ?? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="font-medium text-muted-foreground cursor-help border-b border-dotted border-muted-foreground">N/A</span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Scores may take up to 10 minutes to calculate.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </TableCell>
                {!hideActiveIssues && (
                  <TableCell>
                    {agent.source === 'copilot' ? NOT_APPLICABLE : agent.active_issues !== null ? (
                      <span className="font-medium text-destructive">
                        {agent.active_issues}
                      </span>
                    ) : (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="font-medium text-muted-foreground cursor-help border-b border-dotted border-muted-foreground">N/A</span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Active issues may take up to 10 minutes to calculate. For agents without framework rule tracking, active issues cannot be reported.</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </TableCell>
                )}
                {!hideActiveDevices && (
                  <TableCell>
                    {agent.source === 'copilot' && agent.active_users === null ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="font-medium text-muted-foreground cursor-help">—</span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Not provided by Microsoft</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : agent.active_users !== null ? (
                      <span className="font-medium text-foreground">
                        {agent.active_users}
                      </span>
                    ) : (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="font-medium text-muted-foreground cursor-help border-b border-dotted border-muted-foreground">N/A</span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Active users may take up to 10 minutes to show up.</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </TableCell>
                )}
                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                  {agent.first_seen_at
                    ? new Date(agent.first_seen_at).toLocaleDateString()
                    : '-'}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                  {agent.source === 'copilot'
                    ? (formatCopilotDate(agent.last_active_at) ?? 'Never used')
                    : agent.last_active_at
                    ? new Date(agent.last_active_at).toLocaleString()
                    : '-'}
                </TableCell>
                {showEnforcementStatus && <TableCell>{enforcementBadge(agent)}</TableCell>}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

export default AgentsTable
