import { useState, useMemo, type ReactNode } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { Server, Search, Download, Loader2, Info, ShieldCheck } from "lucide-react"
import { useTableSort } from "@/hooks/use-table-sort"
import { useUrlStringFilter } from "@/hooks/use-url-filters"
import { SortableTableHead } from "@/components/SortableTableHead"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useToast } from "@/hooks/use-toast"
import {
  getRiskLevel,
  getAgentNameBadge, getDistributionChannelBadge, getScoreBadgeWithDiff,
  DISTRIBUTION_CHANNEL_MAP, AUTH_TYPE_MAP, getAuthTypeBadge, authTypeDisplayRank,
  getHostBadge, getSandboxRuntimeType, getSandboxRuntimeTypeBadge,
  getMcpAccessStatusBadge, getMcpAccessStatusLabel, isGovernableMcpType,
  isBrowserAppConnectorSourceType, connectorsBackState,
} from "@/lib/appUtils"
import { downloadCsv, csvTimestamp } from "@/lib/csvUtils"
import { transformMcpName } from "@/lib/utils"
import { getMcpAccessStatus, type McpAccessStatusInfo } from "@/hooks/use-mcp-access"
import type { AccessDeviceScope } from "@/hooks/use-connector-access"
import { McpAccessPopover } from "@/components/McpAccessPopover"
import { ACCESS_OFF_LINE } from "@/lib/mcpAccessLines"

// Connectors no policy reaches, with the popover's reason: the aggregated
// Custom bucket (connectors we don't recognize, excluded by the resolver) and
// ChatGPT / Claude browser-app connectors (the resolver gives them no verdicts,
// and devices can't detect them). Null for every governable connector.
const alwaysAllowedReason = (mcp: { mcp_server_type: number; source_type?: number | null }): string | null => {
  if (!isGovernableMcpType(mcp.mcp_server_type)) return "Connectors we don't recognize are allowed"
  if (isBrowserAppConnectorSourceType(mcp.source_type)) return "Access control for this connector is coming soon"
  return null
}

/** The device popover's rule line, only when the devices' groups have to
 * combine (2+ groups). */
const deviceRule = (scopeGroupIds: (string | null)[], one: boolean): string | undefined =>
  scopeGroupIds.filter((id) => id !== null).length < 2
    ? undefined
    : one
      ? "Every group this device is in must allow it"
      : "Every group a device is in must allow it"

interface McpsTableProps {
  mcps: any[]
  loading: boolean
  deviceSpecificAgentNames?: Map<number, Set<string>>
  deviceSpecificDistributionChannels?: Map<number, Set<number>>
  deviceSpecificHasHostInstances?: Map<number, boolean>
  deviceSpecificSandboxRuntimeTypes?: Map<number, Set<number>>
  hasDeviceFilter?: boolean
  onRowClick?: (mcp: any) => void
  hideActiveDevices?: boolean
  hideActiveIssues?: boolean
  // Two-way ?search= sync for standalone list pages. Off by default: DeviceDetail
  // embeds both tables on one page, and they'd fight over a shared URL key.
  syncSearchToUrl?: boolean
  // Org-wide MCP access status (allowed/blocked/needs_review/varies/none,
  // plus the pending request count) keyed by mcp_server_type. Omitted entirely hides the Access column
  // (e.g. on pages that don't have admin visibility into MCP access).
  accessStatusByType?: Map<number, McpAccessStatusInfo>
  // While the status map is loading (or after it failed), rows must NOT claim
  // "Allowed" — an empty map is indistinguishable from access control being
  // off. Loading renders a skeleton; an error renders a muted dash.
  accessStatusLoading?: boolean
  accessStatusError?: string | null
  // Connector type → people using it who are blocked today (the host loads
  // usage and access). Drives the popover footer and the toolbar button.
  blockedPeopleByType?: Map<number, number>
  // "Allow" for these connectors' blocked users: one from a popover,
  // the current list's from the toolbar. The host owns the dialog. Omitted
  // hides both.
  onAllowAccess?: (types: number[]) => void
  // An active org-wide access policy covers everyone. Without one, people
  // outside the covered groups can use every connector, so a connector blocked
  // for the covered groups reads "Varies by group". Defaults to covered.
  everyoneCovered?: boolean
  // Group id → display name with its IdP, for the popover's group names.
  groupLabels?: Map<string, string>
  // Where "Turn on access control" goes; set only when no policy covers anyone.
  turnOnAccessPath?: string
  // Scoped to devices (a device filter, DeviceDetail): the column says what
  // those devices enforce, without request counts.
  accessDeviceScope?: AccessDeviceScope
}

const McpsTable = ({
  mcps,
  loading,
  deviceSpecificAgentNames,
  deviceSpecificDistributionChannels,
  deviceSpecificHasHostInstances,
  deviceSpecificSandboxRuntimeTypes,
  hasDeviceFilter = false,
  onRowClick,
  hideActiveDevices = false,
  hideActiveIssues = false,
  syncSearchToUrl = false,
  accessStatusByType,
  accessStatusLoading = false,
  accessStatusError = null,
  blockedPeopleByType,
  onAllowAccess,
  everyoneCovered = true,
  groupLabels,
  turnOnAccessPath,
  accessDeviceScope,
}: McpsTableProps) => {
  const showAccessStatus = !!accessStatusByType
  // The map's contents are only trustworthy once the fetch settled without
  // error; before that, absence-of-row must not render as "Allowed". A
  // stale-but-present map from a failed REFETCH stays usable.
  const accessStatusReady =
    !accessStatusLoading && (!accessStatusError || (accessStatusByType?.size ?? 0) > 0)
  // What the User Access column shows for a connector (see everyoneCovered).
  // Device counts already say whether devices differ: no rewrite there.
  const userAccessInfo = (info: McpAccessStatusInfo): McpAccessStatusInfo & { deviceScoped?: boolean } =>
    accessDeviceScope
      ? { ...info, deviceScoped: true }
      : !everyoneCovered && (info.status === "blocked" || info.status === "needs_review")
        ? { ...info, status: "varies" }
        : info
  const oneDevice = accessDeviceScope?.deviceIds.length === 1
  const accessHeader = !accessDeviceScope
    ? "User Access"
    : oneDevice
      ? "Access on this device"
      : "Access on these devices"
  const accessHeaderHint = !accessDeviceScope
    ? "Whether your users can use this connector."
    : oneDevice
      ? "Whether this device can use this connector."
      : "Whether these devices can use this connector."
  // Who a device-scoped popover's fixed line is about.
  const deviceWho = oneDevice ? "This device" : "These devices"
  // A device-scoped "none": no access policy governs it there, so it's allowed.
  const deviceNoneLine = accessDeviceScope && {
    verdict: 1 as const,
    who: deviceWho,
    reason: `No access policy covers ${oneDevice ? "it" : "them"}`,
  }
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

  const filteredMcps = mcps.filter((mcp) => {
    if (!searchTerm) return true
    const lower = searchTerm.toLowerCase()
    return mcp.mcp_server_name?.toLowerCase().includes(lower) ||
           mcp.description?.toLowerCase().includes(lower) ||
           (mcp.agent_names?.some((agent: string) => agent.toLowerCase().includes(lower)) || false)
  })

  const sortedMcps = useMemo(() => {
    return sortItems(filteredMcps, (mcp, column) => {
      switch (column) {
        case 'name': return mcp.mcp_server_name?.toLowerCase()
        case 'risk': return mcp.actual_score ?? mcp.base_score
        case 'issues': return mcp.active_issues
        case 'devices': return mcp.active_users
        case 'first_seen': return mcp.first_seen_at ? new Date(mcp.first_seen_at).getTime() : null
        default: return null
      }
    })
  }, [filteredMcps, sort])

  // Connectors in the current list (search/filter applied) with people using
  // them who are blocked: what the toolbar's "Allow in-use connectors" offers. Connectors
  // no policy reaches read "Allowed", so they're left out.
  const blockedTypesInList = useMemo(
    () =>
      sortedMcps
        .filter((mcp) => !alwaysAllowedReason(mcp))
        .map((mcp) => mcp.mcp_server_type as number)
        .filter((type) => (blockedPeopleByType?.get(type) ?? 0) > 0),
    [sortedMcps, blockedPeopleByType],
  )

  const handleExportCsv = () => {
    setExportLoading(true)
    try {
      const rows = filteredMcps.map((mcp) => {
        const envParts: string[] = []
        if (mcp.has_host_instances) envParts.push('Host')
        ;(mcp.sandbox_runtime_types || []).forEach((t: number) => envParts.push(getSandboxRuntimeType(t)))
        const row: Record<string, any> = {
          'Connector Name': transformMcpName(mcp.mcp_server_name),
          'Description': mcp.description ?? '-',
          'Category': mcp.category_name ?? '-',
          'Associated Agents': (mcp.agent_names || []).join(', ') || '-',
          'Managed By': (mcp.distribution_channels || [])
            .filter((c: number) => c !== 0)
            .map((c: number) => DISTRIBUTION_CHANNEL_MAP[c] ?? 'Unknown')
            .join(', ') || '-',
          'Authentication': (mcp.auth_types || [])
            .filter((t: number) => t !== 0)
            .sort((a: number, b: number) => authTypeDisplayRank(a) - authTypeDisplayRank(b))
            .map((t: number) => AUTH_TYPE_MAP[t] ?? 'Unknown')
            .join(', ') || '-',
          'Environment': envParts.join(', ') || '-',
          'Risk': mcp.base_score != null ? getRiskLevel(mcp.actual_score ?? mcp.base_score) : '-',
        }
        if (!hideActiveIssues) {
          row['Active Issues'] = mcp.active_issues ?? '-'
        }
        if (!hideActiveDevices) {
          row['Active Users'] = mcp.active_users ?? '-'
        }
        row['First Seen'] = mcp.first_seen_at ? new Date(mcp.first_seen_at).toLocaleDateString() : '-'
        if (showAccessStatus) {
          const info = userAccessInfo(getMcpAccessStatus(accessStatusByType!, mcp.mcp_server_type))
          // Same vocabulary as the badge (shared label helper); unknown while
          // the status map is loading or failed, rather than a guess.
          row[accessHeader] = accessStatusReady
            ? getMcpAccessStatusLabel({ ...info, alwaysAllowed: !!alwaysAllowedReason(mcp) })
            : '—'
        }
        return row
      })
      const timestamp = csvTimestamp()
      downloadCsv(rows, `connectors-${timestamp}.csv`)
    } catch (e) {
      console.error('Export failed:', e)
      toast({ title: 'Export failed', description: 'Could not generate CSV', variant: 'destructive' })
    } finally {
      setExportLoading(false)
    }
  }

  const handleRowClick = (mcp: any) => {
    if (onRowClick) {
      onRowClick(mcp)
    } else {
      // Carry the list's current query string so the detail page's back button
      // can restore the filtered view (same pattern as Devices -> DeviceDetail).
      navigate(`/mcps/${mcp.id}`, { state: { backSearch: location.search.replace(/^\?/, '') } })
    }
  }

  return (
    <div className="border rounded-lg">
      {/* 8px column padding (not the default 16px) on the header row and data
          rows, so all twelve columns fit a 14" laptop without sideways scroll.
          The search/filter bar row keeps its own padding. */}
      <Table className="[&_tbody_td]:px-2 [&_thead_tr:last-child_th]:px-2">
        <TableHeader>
          <TableRow>
            <TableHead colSpan={10 - (hideActiveIssues ? 1 : 0) - (hideActiveDevices ? 1 : 0) + (showAccessStatus ? 1 : 0)} className="border-b-0 pb-4 pt-6">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="relative max-w-sm">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search connectors..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-10"
                  />
                </div>
                <div className="flex items-center gap-2">
                {/* Bulk allow: every connector in the current list that
                    someone can't use, in one dialog; shown only when there is one.
                    Single connectors are allowed from the User Access popover. */}
                {onAllowAccess && blockedTypesInList.length > 0 && (
                  <Button size="sm" onClick={() => onAllowAccess(blockedTypesInList)} className="gap-2">
                    <ShieldCheck className="h-4 w-4" />
                    Allow in-use connectors
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportCsv}
                  disabled={exportLoading || filteredMcps.length === 0}
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
              </div>
            </TableHead>
          </TableRow>
          <TableRow>
            <SortableTableHead column="name" currentColumn={sort.column} direction={sort.direction} onSort={handleSort}>Connector</SortableTableHead>
            <TableHead>Category</TableHead>
            <TableHead>Associated Agents</TableHead>
            <TableHead>Managed By</TableHead>
            <TableHead>Authentication</TableHead>
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
            {showAccessStatus && (
              <TableHead className="whitespace-nowrap">
                <span>{accessHeader}</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 ml-1 inline text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="bg-accent/10 backdrop-blur-sm border-accent/20">
                      <p>{accessHeaderHint}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </TableHead>
            )}
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
                <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                {!hideActiveIssues && <TableCell><Skeleton className="h-4 w-12" /></TableCell>}
                {!hideActiveDevices && <TableCell><Skeleton className="h-4 w-12" /></TableCell>}
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                {showAccessStatus && <TableCell><Skeleton className="h-5 w-28" /></TableCell>}
              </TableRow>
            ))
          ) : filteredMcps.length === 0 ? (
            <TableRow>
              <TableCell colSpan={10 - (hideActiveIssues ? 1 : 0) - (hideActiveDevices ? 1 : 0) + (showAccessStatus ? 1 : 0)} className="text-center py-8 text-muted-foreground">
                No connectors found matching your criteria
              </TableCell>
            </TableRow>
          ) : (
            sortedMcps.map((mcp) => (
              <TableRow
                key={mcp.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleRowClick(mcp)}
              >
                <TableCell className="max-w-xs">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-muted/50 overflow-hidden shrink-0">
                      {mcp.logo_url ? (
                        <img
                          src={mcp.logo_url}
                          alt={mcp.mcp_server_name}
                          className="h-8 w-8 object-contain"
                        />
                      ) : (
                        <Server className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-foreground line-clamp-1">
                        {transformMcpName(mcp.mcp_server_name)}
                      </div>
                      {mcp.description && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="text-sm text-muted-foreground line-clamp-2 underline-offset-4 cursor-help hover:opacity-80 transition-opacity">
                                {mcp.description}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-sm">
                              <p className="text-sm whitespace-normal">{mcp.description}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {/* Org-catalog entries may have no category (nullable category_id). */}
                  {mcp.category_name ? (
                    <Badge variant="secondary">{mcp.category_name}</Badge>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {mcp.agent_names && mcp.agent_names.length > 0 ? (
                      (() => {
                        const deviceAgents = deviceSpecificAgentNames?.get(mcp.mcp_server_type)

                        const agentsToShow = hasDeviceFilter && deviceAgents
                          ? mcp.agent_names.filter((name: string) => deviceAgents.has(name))
                          : mcp.agent_names

                        if (agentsToShow.length === 0) {
                          return <span className="text-muted-foreground text-sm">No agents</span>
                        }

                        return agentsToShow
                          .sort((a: string, b: string) => a.localeCompare(b))
                          .map((agentName: string) => (
                            <span key={agentName}>
                              {getAgentNameBadge(agentName)}
                            </span>
                          ))
                      })()
                    ) : (
                      <span className="text-muted-foreground text-sm">No agents</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {mcp.distribution_channels && mcp.distribution_channels.filter((c: number) => c !== 0).length > 0 ? (
                      (() => {
                        const deviceChannels = deviceSpecificDistributionChannels?.get(mcp.mcp_server_type)

                        const channelsToShow = hasDeviceFilter && deviceChannels
                          ? mcp.distribution_channels.filter((c: number) => c !== 0 && deviceChannels.has(c))
                          : mcp.distribution_channels.filter((c: number) => c !== 0)

                        if (channelsToShow.length === 0) {
                          return <span className="text-muted-foreground text-sm">-</span>
                        }

                        return channelsToShow
                          .sort((a: number, b: number) => a - b)
                          .map((channel: number) => (
                            <span key={channel}>
                              {getDistributionChannelBadge(channel)}
                            </span>
                          ))
                      })()
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {(() => {
                      // Drop Unknown (0) from the badges; nothing detected renders muted
                      // "-", matching the Managed By cell (charts keep an Unknown bucket).
                      const detected = (mcp.auth_types || []).filter((t: number) => t !== 0)
                      if (detected.length === 0) {
                        return <span className="text-muted-foreground text-sm">-</span>
                      }
                      return detected
                        .sort((a: number, b: number) => authTypeDisplayRank(a) - authTypeDisplayRank(b))
                        .map((type: number) => <span key={type}>{getAuthTypeBadge(type)}</span>)
                    })()}
                  </div>
                </TableCell>
                <TableCell>
                  {(() => {
                    const deviceHost = deviceSpecificHasHostInstances?.get(mcp.mcp_server_type)
                    const deviceRuntimes = deviceSpecificSandboxRuntimeTypes?.get(mcp.mcp_server_type)
                    const showHost = hasDeviceFilter && deviceSpecificHasHostInstances
                      ? !!deviceHost
                      : !!mcp.has_host_instances
                    const runtimesToShow: number[] = hasDeviceFilter && deviceRuntimes
                      ? (mcp.sandbox_runtime_types || []).filter((t: number) => deviceRuntimes.has(t))
                      : (mcp.sandbox_runtime_types || [])
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
                  {getScoreBadgeWithDiff(mcp.base_score, mcp.actual_score) ?? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="font-medium text-muted-foreground cursor-help border-b border-dotted border-muted-foreground">N/A</span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Scores may take up to 10 minutes to calculate. For connectors not present in the Atlas Registry, baseline scores cannot be calculated.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </TableCell>
                {!hideActiveIssues && (
                  <TableCell>
                    {mcp.active_issues !== null ? (
                      <span className="font-medium text-destructive">
                        {mcp.active_issues}
                      </span>
                    ) : (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="font-medium text-muted-foreground cursor-help border-b border-dotted border-muted-foreground">N/A</span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Active issues may take up to 10 minutes to calculate.</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </TableCell>
                )}
                {!hideActiveDevices && (
                  <TableCell>
                    {mcp.active_users !== null ? (
                      <span className="font-medium text-foreground">
                        {mcp.active_users}
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
                  {mcp.first_seen_at
                    ? new Date(mcp.first_seen_at).toLocaleDateString()
                    : '-'}
                </TableCell>
                {showAccessStatus && (
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {(() => {
                      // Not trustworthy yet: loading shows a skeleton, a failed
                      // first load a muted dash — never a false "Allowed".
                      if (!accessStatusReady) {
                        return accessStatusLoading ? (
                          <Skeleton className="h-5 w-20" />
                        ) : (
                          <span className="text-muted-foreground" title={accessStatusError ?? undefined}>—</span>
                        )
                      }
                      const info = userAccessInfo(getMcpAccessStatus(accessStatusByType!, mcp.mcp_server_type))
                      const reason = alwaysAllowedReason(mcp)
                      const name = transformMcpName(mcp.mcp_server_name)
                      const badgeEl = getMcpAccessStatusBadge({ ...info, alwaysAllowed: !!reason })
                      // Every badge opens the popover: connectors no policy
                      // reaches show one fixed line; governed ones list who can
                      // use it and why, with "Allow" when someone can't.
                      const badge: ReactNode = reason ? (
                        <McpAccessPopover
                          badge={badgeEl}
                          mcpName={name}
                          fixedLine={{ verdict: 1, who: accessDeviceScope ? deviceWho : "All users", reason }}
                        />
                      ) : info.status === "none" ? (
                        <McpAccessPopover
                          badge={badgeEl}
                          mcpName={name}
                          fixedLine={deviceNoneLine || ACCESS_OFF_LINE}
                          footerLink={turnOnAccessPath ? { label: "Turn on access control →", path: turnOnAccessPath } : undefined}
                        />
                      ) : (
                        <McpAccessPopover
                          badge={badgeEl}
                          mcpName={name}
                          mcpType={mcp.mcp_server_type}
                          groupLabels={groupLabels}
                          deviceScope={
                            accessDeviceScope && {
                              scopeGroupIds: accessDeviceScope.coverage?.scope_group_ids ?? [],
                              ungovernedCount: info.ungovernedCount ?? 0,
                              header: deviceRule(accessDeviceScope.coverage?.scope_group_ids ?? [], oneDevice),
                            }
                          }
                          blockedPeople={blockedPeopleByType?.get(mcp.mcp_server_type) ?? 0}
                          onAllowAccess={onAllowAccess ? () => onAllowAccess([mcp.mcp_server_type]) : undefined}
                        />
                      )
                      return (
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          {badge}
                          {/* At-a-glance request signal, beside the badge (below it
                              when the column is squeezed); shown whenever something
                              still blocks a requester. Org-wide only: a device
                              scope has no request counts. */}
                          {info.pendingCount > 0 && (
                            <button
                              type="button"
                              className="text-xs text-muted-foreground hover:text-primary hover:underline"
                              onClick={() =>
                                navigate(`/mcp-access?tab=pending&mcpType=${mcp.mcp_server_type}&source_mcps=true`, {
                                  state: connectorsBackState(location),
                                })
                              }
                            >
                              {info.pendingCount} {info.pendingCount === 1 ? "request" : "requests"}
                            </button>
                          )}
                        </div>
                      )
                    })()}
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

export default McpsTable
