import { ArrowLeft, AlertTriangle, Eye, Laptop, Key, Filter, ChevronDown, ChevronUp, CheckCircle2, XCircle } from "lucide-react"
import { orgRpcArgs } from '@/lib/orgScope';
import { supabase } from "@/integrations/supabase/client"
import { transformMcpName } from "@/lib/utils"
import { fetchMcpCatalogMap } from "@/lib/mcpCatalog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MultiSelect } from "@/components/ui/multi-select"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Skeleton } from "@/components/ui/skeleton"
import { useLocation, useNavigate, useSearchParams } from "react-router-dom"
import { useEffect, useState } from "react"
import { useOrg } from "@/contexts/OrgContext"
import { useToast } from "@/hooks/use-toast"
import { useUrlArrayFilter, useUrlStringFilter } from "@/hooks/use-url-filters"
import { getPlan, getEffectivePlan, ISSUE_STATUS_TABS, isValidIssueStatus, deviceOptions } from "@/lib/appUtils"
import { demoteWithinRiskBands } from "@/lib/issueOrdering"
import { fetchAllRows } from "@/lib/supabasePaging"
import McpIssuesTable from "@/components/McpIssuesTable"

const McpIssues = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { toast } = useToast()
  const { activeOrgId } = useOrg()
  const [searchParams] = useSearchParams()

  const [violations, setViolations] = useState<any[]>([])
  const [summaryStats, setSummaryStats] = useState<{ totalIncidents: number | null, issuesCount: number | null, affectedDevices: number | null }>({ totalIncidents: null, issuesCount: null, affectedDevices: null })
  const [issuesLoading, setIssuesLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedRiskAttributes, setSelectedRiskAttributes] = useUrlArrayFilter('risk_attribute')
  const [selectedMcpServers, setSelectedMcpServers] = useUrlArrayFilter('mcp')
  const [statusParam, setSelectedStatus] = useUrlStringFilter('status', "1")
  // Invalid deep-link statuses fall back to Active rather than reaching the queries as NaN.
  const selectedStatus = isValidIssueStatus(statusParam) ? statusParam : "1"
  const [selectedDeviceIds, setSelectedDeviceIds] = useUrlArrayFilter('deviceId')
  const [mcpServers, setMcpServers] = useState<any[]>([])
  const [selectedAgents, setSelectedAgents] = useUrlArrayFilter('agent')
  const [agents, setAgents] = useState<any[]>([])
  const [devices, setDevices] = useState<any[]>([])
  const [riskAttributes, setRiskAttributes] = useState<any[]>([])
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [mcpServersLoading, setMcpServersLoading] = useState(true)
  const [agentsLoading, setAgentsLoading] = useState(true)
  const [devicesLoading, setDevicesLoading] = useState(true)
  const [riskAttributesLoading, setRiskAttributesLoading] = useState(true)
  const [metricsLoading, setMetricsLoading] = useState(true)

  useEffect(() => {
    let mcpServersLoaded = false
    let agentsLoaded = false
    let devicesLoaded = false
    let riskAttributesLoaded = false

    const checkReady = () => {
      if (mcpServersLoaded && agentsLoaded && devicesLoaded && riskAttributesLoaded) {
        setIsReady(true)
      }
    }

    const fetchDevices = async () => {
      try {
        setDevicesLoading(true)
        const { data, error } = await supabase.from('devices_with_owners').select('id, friendly_name, device_native_id, owner_email').eq('org_id', activeOrgId!)
          .order('friendly_name')

        if (error) throw error
        setDevices(data || [])
        devicesLoaded = true
        checkReady()
      } catch (err) {
        console.error('Error fetching devices:', err)
        toast({
          title: "Error",
          description: "Failed to load devices filter",
          variant: "destructive",
        })
        devicesLoaded = true
        checkReady()
      } finally {
        setDevicesLoading(false)
      }
    }

    const fetchMcpServers = async () => {
      try {
        setMcpServersLoading(true)
        const { data, error } = await supabase.from('active_mcp_servers').select(`
            id,
            mcp_server_type
          `).eq('org_id', activeOrgId!)

        if (error) throw error

        // Resolve names through the combined global+org catalog by
        // mcp_server_type: org-catalog servers carry mcp_catalog_id NULL, so
        // the old mcp_catalog!inner embed dropped them.
        const catalog = await fetchMcpCatalogMap(
          activeOrgId!,
          [...new Set((data || []).map((mcp: any) => mcp.mcp_server_type).filter((t): t is number => t != null))],
        )

        const mappedMcps = (data || [])
          // Rows in neither catalog stay hidden, matching the old !inner embed.
          .filter((mcp: any) => catalog.has(mcp.mcp_server_type))
          .map((mcp: any) => ({
            id: mcp.id,
            name: transformMcpName(catalog.get(mcp.mcp_server_type)!.mcp_server_name),
            mcp_server_type: mcp.mcp_server_type
          }))

        setMcpServers(mappedMcps)
        mcpServersLoaded = true
        checkReady()
      } catch (err) {
        console.error('Error fetching MCP servers:', err)
        toast({
          title: "Error",
          description: "Failed to load connectors filter",
          variant: "destructive",
        })
        mcpServersLoaded = true
        checkReady()
      } finally {
        setMcpServersLoading(false)
      }
    }

    const fetchAgents = async () => {
      try {
        setAgentsLoading(true)
        const { data, error } = await supabase.from('active_agents').select(`
            id,
            agent_type,
            plan,
            agent_catalog!inner (
              agent_name
            )
          `).eq('org_id', activeOrgId!)

        if (error) throw error

        const transformedAgents = (data || []).map((agent: any) => ({
          id: agent.id,
          name: agent.agent_catalog.agent_name,
          agent_type: agent.agent_type,
          plan: agent.plan
        }))

        setAgents(transformedAgents)
        agentsLoaded = true
        checkReady()
      } catch (err) {
        console.error('Error fetching agents:', err)
        toast({
          title: "Error",
          description: "Failed to load agents filter",
          variant: "destructive",
        })
        agentsLoaded = true
        checkReady()
      } finally {
        setAgentsLoading(false)
      }
    }

    const fetchRiskRules = async () => {
      try {
        setRiskAttributesLoading(true)
        const { data, error } = await supabase.from('mcp_server_issues').select(`
            issue_type_controls!inner(
              issue_types!inner(
                risk_rules!inner(
                  id,
                  name
                )
              )
            )
          `).eq('org_id', activeOrgId!)

        if (error) throw error

        const uniqueRiskRules = new Map<string, string>()
        data?.forEach((issue: any) => {
          const riskRule = issue.issue_type_controls.issue_types.risk_rules
          uniqueRiskRules.set(riskRule.id, riskRule.name)
        })

        const typeOptions = Array.from(uniqueRiskRules.entries())
          .map(([id, name]) => ({
            id,
            name
          }))
          .sort((a, b) => a.name.localeCompare(b.name))

        setRiskAttributes(typeOptions)
        riskAttributesLoaded = true
        checkReady()
      } catch (err) {
        console.error('Error fetching risk rules:', err)
        toast({
          title: "Error",
          description: "Failed to load risk attributes filter",
          variant: "destructive",
        })
        setRiskAttributes([])
        riskAttributesLoaded = true
        checkReady()
      } finally {
        setRiskAttributesLoading(false)
      }
    }

    fetchMcpServers()
    fetchAgents()
    fetchDevices()
    fetchRiskRules()
  }, [activeOrgId])

  const getFilterParams = () => {
    let filterMcpServerTypes: number[] | null = null
    let filterAgentTypes: number[] | null = null
    let filterPlans: number[] | null = null
    let filterRiskRuleIds: string[] | null = null
    const filterStatus: number = parseInt(selectedStatus)

    if (selectedMcpServers.length > 0) {
      const selectedMcpData = mcpServers.filter(m => selectedMcpServers.includes(m.id))
      if (selectedMcpData.length > 0) {
        filterMcpServerTypes = [...new Set(selectedMcpData.map(m => m.mcp_server_type))]
      }
    }

    if (selectedAgents.length > 0) {
      const selectedAgentData = agents.filter(a => selectedAgents.includes(a.id))
      if (selectedAgentData.length > 0) {
        filterAgentTypes = [...new Set(selectedAgentData.map(a => a.agent_type))]
        filterPlans = [...new Set(selectedAgentData.map(a => a.plan))]
      }
    }

    if (selectedRiskAttributes.length > 0) {
      filterRiskRuleIds = selectedRiskAttributes
    }

    return { filterMcpServerTypes, filterAgentTypes, filterPlans, filterRiskRuleIds, filterStatus }
  }

  const fetchIssues = async () => {
    try {
      setIssuesLoading(true)

      const { filterMcpServerTypes, filterAgentTypes, filterPlans, filterRiskRuleIds, filterStatus } = getFilterParams()

      const [{ data, error }, rowCounts] = await Promise.all([
        supabase
          .rpc('get_mcp_server_issues_by_issue_type', { ...orgRpcArgs(activeOrgId),
            p_mcp_server_types: filterMcpServerTypes,
            p_agent_types: filterAgentTypes,
            p_plans: filterPlans,
            p_risk_rule_ids: filterRiskRuleIds,
            p_status: filterStatus
          })
          .order('trigger_score', { ascending: false })
          .order('display_order', { ascending: true }),
        // "N incidents" counts the incidents modal's rows (one per connector, agent
        // account and device, locations bundled), with the modal's filters incl. devices.
        supabase.rpc('get_mcp_server_issue_row_counts', {
          p_device_ids: selectedDeviceIds.length > 0 ? selectedDeviceIds : null,
          p_mcp_server_types: filterMcpServerTypes,
          p_agent_types: filterAgentTypes,
          p_plans: filterPlans,
          p_status: filterStatus
        }),
      ])

      if (error) throw error
      // Before the row-count RPC is deployed, fall back to the raw incident count.
      if (rowCounts.error) console.error('Error fetching incident row counts:', rowCounts.error)
      const rowCountByIssueType = rowCounts.error
        ? null
        : new Map((rowCounts.data || []).map(r => [r.issue_type_control_id, Number(r.row_count)] as const))

      let mappedViolations = (data || []).map((issue: any) => ({
        issue_type_control_id: issue.issue_type_control_id,
        name: issue.name,
        risk_rule_id: issue.risk_rule_id,
        risk_rule_type: issue.risk_rule_type,
        risk_rule_name: issue.risk_rule_name,
        risk_framework_rule_id: issue.risk_framework_rule_id,
        trigger_score: issue.trigger_score,
        issue_status: issue.issue_status,
        last_seen_at: issue.last_seen_at,
        affected_devices: issue.affected_devices,
        incident_count: rowCountByIssueType ? (rowCountByIssueType.get(issue.issue_type_control_id) ?? 0) : issue.incident_count,
        framework_id: issue.framework_id,
        applicable_to: issue.applicable_to,
        remediation_text: issue.remediation_text
      }))

      // Drop issue types with no modal rows under these filters (as DeviceDetail does),
      // so no "0 incidents" badge opens an empty modal.
      if (rowCountByIssueType) {
        mappedViolations = mappedViolations.filter(v => v.incident_count > 0)
      }

      // Filter by device IDs if selected (client-side filtering)
      const selectedDeviceRowIds = new Set(selectedDeviceIds)
      if (selectedDeviceRowIds.size > 0) {
        mappedViolations = mappedViolations.filter(violation => {
          return violation.affected_devices.some((device: any) =>
            selectedDeviceRowIds.has(device.device_id)
          )
        }).map(violation => ({
          ...violation,
          affected_devices: violation.affected_devices.filter((device: any) =>
            selectedDeviceRowIds.has(device.device_id)
          )
        }))
      }

      setViolations(demoteWithinRiskBands(mappedViolations))
      setError(null)

      // Recalculate metrics if device filter is applied
      if (selectedDeviceRowIds.size > 0) {
        const totalIncidents = mappedViolations.reduce((sum, v) => sum + (v.incident_count || 0), 0)
        // affected_devices was narrowed to the selected devices above.
        const affectedDevices = new Set(mappedViolations.flatMap(v => v.affected_devices.map((d: any) => d.device_id))).size
        setSummaryStats({
          totalIncidents,
          issuesCount: mappedViolations.length,
          affectedDevices
        })
        setMetricsLoading(false)
      }
    } catch (err) {
      console.error('Error fetching issues:', err)
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setIssuesLoading(false)
      if (selectedDeviceIds.length > 0) {
        setMetricsLoading(false)
      }
    }
  }

  useEffect(() => {
    if (!isReady) return
    fetchIssues()
  }, [isReady, selectedMcpServers, selectedAgents, selectedRiskAttributes, selectedStatus, selectedDeviceIds, mcpServers, agents, activeOrgId])

  const fetchMetrics = async () => {
    if (selectedDeviceIds.length > 0) {
      setMetricsLoading(false)
      return
    }

    try {
      setMetricsLoading(true)
      const { filterMcpServerTypes, filterAgentTypes, filterPlans, filterRiskRuleIds, filterStatus } = getFilterParams()

      const { data, error } = await supabase
        .rpc('get_mcp_server_issues_metrics_summary', {
          ...orgRpcArgs(activeOrgId), // scope metrics to the ACTIVE org (subsidiary-aware), matching the list
          p_mcp_server_types: filterMcpServerTypes,
          p_agent_types: filterAgentTypes,
          p_plans: filterPlans,
          p_risk_rule_ids: filterRiskRuleIds,
          p_status: filterStatus
        })

      if (error) throw error

      const metrics = data?.[0]
      if (metrics) {
        setSummaryStats({
          totalIncidents: Number(metrics.total_incidents) || 0,
          issuesCount: Number(metrics.issues_count) || 0,
          affectedDevices: Number(metrics.affected_devices) || 0
        })
      }
    } catch (err) {
      console.error('Error fetching metrics:', err)
    } finally {
      setMetricsLoading(false)
    }
  }

  useEffect(() => {
    if (!isReady) return
    fetchMetrics()
  }, [isReady, selectedMcpServers, selectedAgents, selectedRiskAttributes, selectedStatus, selectedDeviceIds, mcpServers, agents])

  const fetchDeviceData = async (issueTypeControlId: string) => {
    const { filterMcpServerTypes, filterAgentTypes, filterPlans, filterStatus } = getFilterParams()

    // Paged: dismiss/reopen "All" act on every row returned, so none may be cut at the 1000-row cap.
    const data = await fetchAllRows((from, to) => {
      let query = supabase
        .rpc('get_device_mcp_server_issues_extended', {
          p_device_ids: selectedDeviceIds.length > 0 ? selectedDeviceIds : null,
          p_sandbox_ids: null,
        })
        .eq('issue_type_control_id', issueTypeControlId)
        .eq('issue_status', filterStatus)

      if (filterMcpServerTypes !== null && filterMcpServerTypes.length > 0) {
        query = query.in('mcp_server_type', filterMcpServerTypes)
      }

      if (filterAgentTypes !== null && filterAgentTypes.length > 0) {
        query = query.in('agent_type', filterAgentTypes)
      }

      if (filterPlans !== null && filterPlans.length > 0) {
        query = query.in('plan', filterPlans)
      }

      // issue_ids breaks last_seen_at ties, so page order is deterministic.
      return query.order('last_seen_at', { ascending: false }).order('issue_ids').range(from, to)
    })

    return data.map((issue: any) => ({
      device_id: issue.device_id,
      deviceId: issue.device_native_id,
      deviceName: issue.friendly_name || issue.device_native_id,
      ownerEmail: issue.owner_email,
      mcpServerName: issue.mcp_server_name,
      mcpNativeId: issue.mcp_native_id,
      locations: issue.locations ?? [],
      agentName: issue.agent_name,
      plan: getPlan(getEffectivePlan(issue.agent_type, issue.plan)),
      agentEmail: issue.agent_email,
      lastSeen: new Date(issue.last_seen_at).toLocaleString(),
      issueIds: issue.issue_ids || [],
      metadata: issue.metadata?.[0] || null
    }))
  }

  const handleRefresh = () => {
    fetchIssues()
    fetchMetrics()
  }

  const handleIssueTypeClick = (riskRuleId: string, frameworkId: string) => {
    const params = new URLSearchParams()
    params.set('risk_attribute', riskRuleId)
    params.set('source_mcp_issues', 'true')

    if (selectedMcpServers.length > 0) params.set('mcp', selectedMcpServers.join(','))
    if (selectedAgents.length > 0) params.set('agent', selectedAgents.join(','))
    if (selectedStatus !== '1') params.set('status', selectedStatus)

    navigate(`/risk-frameworks/${frameworkId}?${params.toString()}`, { state: { backSearch: searchParams.toString() } })
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        {searchParams.get('source_mcp') ? (
          <Button variant="ghost" onClick={() => navigate(`/mcps/${searchParams.get('source_mcp')}`)}>
            <ArrowLeft className="h-4 w-4" />
            Back to Connector
          </Button>
        ) : searchParams.get('source_devices') ? (
          <Button variant="ghost" onClick={() => {
            const backSearch = (location.state?.backSearch as string) || ''
            navigate(`/devices${backSearch ? `?${backSearch}` : ''}`)
          }}>
            <ArrowLeft className="h-4 w-4" />
            Back to Devices
          </Button>
        ) : searchParams.get('source_device') ? (
          <Button variant="ghost" onClick={() => navigate(`/devices/${searchParams.get('source_device')}`)}>
            <ArrowLeft className="h-4 w-4" />
            Back to Device
          </Button>
        ) : null}
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-lg bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
            <Eye className="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Connector Issues</h1>
            <p className="text-muted-foreground">Security issues detected across connectors</p>
          </div>
        </div>
      </div>

      <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="mb-4 gap-2">
            <Filter className="h-4 w-4" />
            Filters
            {(() => {
              const appliedFilters = [
                selectedRiskAttributes.length > 0,
                selectedMcpServers.length > 0,
                selectedAgents.length > 0,
                selectedDeviceIds.length > 0,
                selectedStatus !== "1"
              ].filter(Boolean).length

              return appliedFilters > 0 ? (
                <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5 text-xs">
                  {appliedFilters}
                </Badge>
              ) : null
            })()}
            {filtersOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ISSUE_STATUS_TABS.map((tab) => (
                        <SelectItem key={tab.value} value={tab.value}>{tab.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Risk Attribute</label>
                  <MultiSelect
                    options={riskAttributes}
                    selectedIds={selectedRiskAttributes}
                    onChange={setSelectedRiskAttributes}
                    placeholder="All"
                    searchPlaceholder="Search risk attributes..."
                    emptyMessage="No risk attributes found."
                    label="risk attribute"
                    disabled={riskAttributesLoading}
                    compact
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Connector</label>
                  <MultiSelect
                    options={mcpServers.map(s => ({ id: s.id, name: s.name }))}
                    selectedIds={selectedMcpServers}
                    onChange={setSelectedMcpServers}
                    placeholder="All"
                    searchPlaceholder="Search connectors..."
                    emptyMessage="No connectors found."
                    label="connector"
                    disabled={mcpServersLoading}
                    compact
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Agent</label>
                  <MultiSelect
                    options={agents.map(a => ({ id: a.id, name: `${a.name} (${getPlan(getEffectivePlan(a.agent_type, a.plan))})` }))}
                    selectedIds={selectedAgents}
                    onChange={setSelectedAgents}
                    placeholder="All"
                    searchPlaceholder="Search agents..."
                    emptyMessage="No agents found."
                    label="agent"
                    disabled={agentsLoading}
                    compact
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Device</label>
                  <MultiSelect
                    options={deviceOptions(devices)}
                    selectedIds={selectedDeviceIds}
                    onChange={setSelectedDeviceIds}
                    placeholder="All"
                    searchPlaceholder="Search devices..."
                    emptyMessage="No devices found."
                    label="device"
                    disabled={devicesLoading}
                    compact
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>


      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Issues
            </CardTitle>
          </CardHeader>
          <CardContent>
            {metricsLoading || summaryStats.issuesCount === null ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold text-destructive">
                {summaryStats.issuesCount}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Laptop className="h-4 w-4" />
              Affected Devices
            </CardTitle>
          </CardHeader>
          <CardContent>
            {metricsLoading || summaryStats.affectedDevices === null ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold text-warning">
                {summaryStats.affectedDevices}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <McpIssuesTable
        violations={violations}
        selectedStatus={selectedStatus}
        loading={issuesLoading}
        error={error}
        onRefresh={handleRefresh}
        fetchDeviceData={fetchDeviceData}
        onIssueTypeClick={handleIssueTypeClick}
      />
    </div>
  )
}

export default McpIssues
