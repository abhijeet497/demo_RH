import { useState, useEffect, useMemo } from "react"
import { supabase } from "@/integrations/supabase/client"
import { useLocation, useNavigate, useSearchParams } from "react-router-dom"
import { useOrg } from "@/contexts/OrgContext"
import { useAuth } from "@/contexts/AuthContext"
import { formatDistanceToNow } from "date-fns"
import { Users, Filter, ChevronDown, ChevronUp, ArrowLeft, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MultiSelect } from "@/components/ui/multi-select"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Card, CardContent } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { DistributionCard } from "@/components/charts/DistributionCard"
import { MetricCard } from "@/components/charts/MetricCard"
import AgentsTable from "@/components/AgentsTable"
import { useUrlArrayFilter, useUrlFilterParams } from "@/hooks/use-url-filters"
import { awsBedrockEnabled } from "@/lib/featureFlags"
import {
  fetchInventory, flattenRuntimes, runtimeToAgentRow, syncedAtMs, bedrockFilterOptions,
  BEDROCK_ENVIRONMENT_LABEL, BEDROCK_ENVIRONMENT_OPTION, BEDROCK_ENVIRONMENT_VALUE,
} from "@/lib/bedrockInventory"
import { RED_TEAM_AGENT } from "@/lib/redteam/targetAgent"
import {
  getRiskLevel, formatScore, getEffectivePlan,
  RISK_LEVEL_OPTIONS, PLAN_OPTIONS, PERFORMANCE_OPTIONS,
  AGENT_DEPLOYMENT_TYPE_MAP, DEPLOYMENT_TYPE_CHART_COLORS,
  RISK_CHART_COLORS, ENVIRONMENT_OPTIONS, deviceOptions
} from "@/lib/appUtils"
import {
  COPILOT_LOGO_URL, COPILOT_SOURCE_LABEL as COPILOT_ENVIRONMENT_LABEL, COPILOT_ENVIRONMENT_OPTION, COPILOT_ENVIRONMENT_VALUE,
} from "@/lib/copilot"
import { getCopilotConnections, listCopilotAgents } from "@/lib/copilotMock"
import type { CopilotAgentSummary, CopilotConnection } from "@/lib/copilotTypes"
import { copilotEnabled } from "@/lib/featureFlags"

const copilotAgentToRow = (a: CopilotAgentSummary) => ({
  id: `copilot:${a.id}`,
  source: "copilot",
  detail_path: `/copilot-agents/${encodeURIComponent(a.id)}`,
  logo_url: COPILOT_LOGO_URL,
  agent_name: a.name,
  description: null,
  copilot_platform: a.platform,
  copilot_status: a.published_status,
  agent_type: null,
  plan: null,
  base_score: null,
  actual_score: null,
  active_issues: null,
  active_users: a.active_users,
  deployment_types: [],
  sandbox_runtime_types: [],
  has_host_instances: false,
  environment_labels: [COPILOT_ENVIRONMENT_LABEL],
  last_active_at: a.last_used_date,
  blocked: a.is_blocked,
  instance_count: null,
  tenant_id: a.tenant_id,
  tenant_domain: a.tenant_id,
})
type CopilotAgentRow = ReturnType<typeof copilotAgentToRow>


const DEPLOYMENT_TYPE_OPTIONS = Object.entries(AGENT_DEPLOYMENT_TYPE_MAP).map(([value, label]) => ({
  value, label
}))

const Agents = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  // URL-backed multi-select filters (comma-separated values, empty array = "all")
  const [riskFilters, setRiskFilters] = useUrlArrayFilter('risk')
  const [planFilters, setPlanFilters] = useUrlArrayFilter('plan')
  const [performanceFilters, setPerformanceFilters] = useUrlArrayFilter('performance')
  const [deploymentTypeFilters, setDeploymentTypeFilters] = useUrlArrayFilter('deploymentType')
  const [rawEnvironmentFilters] = useUrlArrayFilter('environment')
  // With the flag off, an old ?environment=aws_bedrock link is ignored entirely.
  const environmentFilters = useMemo(
    () => awsBedrockEnabled ? rawEnvironmentFilters : rawEnvironmentFilters.filter(v => v !== BEDROCK_ENVIRONMENT_VALUE),
    [rawEnvironmentFilters],
  )
  const [awsAccountFilters] = useUrlArrayFilter('awsAccount')
  const [awsRegionFilters, setAwsRegionFilters] = useUrlArrayFilter('awsRegion')
  const [deviceIdFilters, setDeviceIdFilters] = useUrlArrayFilter('deviceId')
  const [tenantFilters, setTenantFilters] = useUrlArrayFilter('tenant')
  // Mock Microsoft 365 Copilot tenants and agents (no API yet).
  const [copilotConnections, setCopilotConnections] = useState<CopilotConnection[]>([])
  const [copilotRows, setCopilotRows] = useState<CopilotAgentRow[]>([])
  useEffect(() => {
    if (!copilotEnabled) return
    let cancelled = false
    Promise.all([getCopilotConnections(), listCopilotAgents()]).then(([conns, list]) => {
      if (cancelled) return
      setCopilotConnections(conns)
      setCopilotRows(list.map(copilotAgentToRow))
    })
    return () => { cancelled = true }
  }, [])
  const { updateParams } = useUrlFilterParams()
  // Leaving the AWS Bedrock environment also clears its account and region
  // sub-filters. One updateParams call: two setters in one event clobber each other.
  const setEnvironmentFilters = (values: string[]) => updateParams({
    environment: values.length ? values.join(',') : null,
    ...(values.includes(BEDROCK_ENVIRONMENT_VALUE) ? {} : { awsAccount: null, awsRegion: null }),
  })
  // Changing accounts also clears the region choice: a region picked for one
  // account may not exist in the next.
  const setAwsAccountFilters = (values: string[]) => updateParams({
    awsAccount: values.length ? values.join(',') : null,
    awsRegion: null,
  })
  const [agents, setAgents] = useState<any[]>([])
  // AgentCore runtimes, from the cloud inventory API (synced from AWS hourly).
  const [bedrockRuntimes, setBedrockRuntimes] = useState<any[]>([])
  // When the cloud inventory was last synced from AWS, and a counter the
  // Refresh button bumps to load it again.
  const [bedrockSyncedAt, setBedrockSyncedAt] = useState<number | null>(null)
  const [bedrockReload, setBedrockReload] = useState(0)
  const [bedrockRefreshing, setBedrockRefreshing] = useState(false)
  const [bedrockError, setBedrockError] = useState(false)
  const { session } = useAuth()
  const [devices, setDevices] = useState<any[]>([])
  const [deviceSpecificDeploymentTypes, setDeviceSpecificDeploymentTypes] = useState<Map<string, Set<number>>>(new Map())
  const [deviceSpecificLastActive, setDeviceSpecificLastActive] = useState<Map<string, any>>(new Map())
  const [deviceSpecificFirstSeen, setDeviceSpecificFirstSeen] = useState<Map<string, string>>(new Map())
  const [deviceSpecificInstanceCount, setDeviceSpecificInstanceCount] = useState<Map<string, number>>(new Map())
  const [deviceSpecificHasHostInstances, setDeviceSpecificHasHostInstances] = useState<Map<string, boolean>>(new Map())
  const [deviceSpecificSandboxRuntimeTypes, setDeviceSpecificSandboxRuntimeTypes] = useState<Map<string, Set<number>>>(new Map())
  const [loading, setLoading] = useState(true)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const { toast } = useToast()
  const { activeOrgId } = useOrg()

  useEffect(() => {
    fetchAgents()
    fetchDevices()
  }, [searchParams, activeOrgId])

  // AgentCore runtimes come from the cloud inventory API, scoped to the active
  // org, so they are reloaded when the org changes. An org with no AWS account
  // connected gets none.
  useEffect(() => {
    if (!awsBedrockEnabled) return
    let cancelled = false
    setBedrockRefreshing(true)
    fetchInventory(session?.access_token)
      .then(inventory => {
        if (cancelled) return
        setBedrockRuntimes(flattenRuntimes(inventory).map(runtimeToAgentRow))
        // No sync time means no account connected (or none synced yet): no bar.
        setBedrockSyncedAt(syncedAtMs(inventory))
        setBedrockError(false)
      })
      .catch(() => {
        if (cancelled) return
        setBedrockRuntimes([])
        setBedrockSyncedAt(null)
        setBedrockError(true)
      })
      .finally(() => !cancelled && setBedrockRefreshing(false))
    return () => { cancelled = true }
  }, [session?.access_token, activeOrgId, bedrockReload])

  const fetchAgents = async () => {
    try {
      setLoading(true)

      let query = supabase.from('active_agents').select(`
          id,
          plan,
          agent_type,
          base_score,
          actual_score,
          active_issues,
          active_users,
          updated_at,
          deployment_types,
          last_active_at,
          first_seen_at,
          instance_count,
          has_host_instances,
          sandbox_runtime_types,
          agent_catalog!inner (
            agent_name,
            description,
            logo_url,
            origin_country,
            hosts
          )
        `).eq('org_id', activeOrgId!)
        .gt('active_users', 0)

      // Start device metadata query and instance count in parallel
      let deviceMetadataPromise = null
      if (deviceIdFilters.length > 0) {
        deviceMetadataPromise = supabase
          .rpc('get_device_agent_metadata', {
            p_device_ids: deviceIdFilters,
            p_sandbox_ids: null,
          })
      }

      // Server-side filtering when devices are selected
      if (deviceIdFilters.length > 0) {
        // First, get the distinct (agent_type, plan) combinations for these devices
        const { data: deviceAgentData, error: deviceError } = await supabase.from('active_agent_devices').select('agent_type, plan').eq('org_id', activeOrgId!)
          .in('device_id', deviceIdFilters)

        if (deviceError) throw deviceError

        if (deviceAgentData && deviceAgentData.length > 0) {
          // Create a set of unique (agent_type, plan) pairs
          const agentTypePlanPairs = Array.from(
            new Set(deviceAgentData.map(d => `${d.agent_type}:${d.plan}`))
          )

          // Filter agents to only those matching the device's agent_type and plan combinations
          // Use .or() with and() conditions for tuple matching
          const orConditions = agentTypePlanPairs.map(pair => {
            const [agentType, plan] = pair.split(':')
            return `and(agent_type.eq.${agentType},plan.eq.${plan})`
          }).join(',')

          query = query.or(orConditions)
        } else {
          // No agents found for these devices, set empty array and return early
          setAgents([])
          setLoading(false)
          return
        }
      }

      const [agentsResult, deviceMetadataResult] = await Promise.all([
        query.order('actual_score', { ascending: false, nullsFirst: false }),
        deviceMetadataPromise
      ])

      const { data, error } = agentsResult
      if (error) throw error

      // Process device metadata into Maps (merge across devices)
      if (deviceMetadataResult?.data) {
        const typeMap = new Map<string, Set<number>>()
        const lastActiveMap = new Map<string, any>()
        const firstSeenMap = new Map<string, string>()
        const instanceCountMap = new Map<string, number>()
        const hostMap = new Map<string, boolean>()
        const runtimeMap = new Map<string, Set<number>>()
        deviceMetadataResult.data.forEach((row: any) => {
          const key = `${row.agent_type}:${row.plan}`
          const existing = typeMap.get(key) || new Set<number>()
          ;(row.deployment_types || []).forEach((type: number) => existing.add(type))
          typeMap.set(key, existing)
          if (row.last_active_at && (!lastActiveMap.has(key) || row.last_active_at > lastActiveMap.get(key))) {
            lastActiveMap.set(key, row.last_active_at)
          }
          if (row.first_seen_at && (!firstSeenMap.has(key) || row.first_seen_at < firstSeenMap.get(key)!)) {
            firstSeenMap.set(key, row.first_seen_at)
          }
          instanceCountMap.set(key, (instanceCountMap.get(key) || 0) + (row.instance_count ?? 0))
          if (row.has_host_instances) hostMap.set(key, true)
          const existingRuntimes = runtimeMap.get(key) || new Set<number>()
          ;(row.sandbox_runtime_types || []).forEach((t: number) => existingRuntimes.add(t))
          runtimeMap.set(key, existingRuntimes)
        })
        setDeviceSpecificDeploymentTypes(typeMap)
        setDeviceSpecificLastActive(lastActiveMap)
        setDeviceSpecificFirstSeen(firstSeenMap)
        setDeviceSpecificInstanceCount(instanceCountMap)
        setDeviceSpecificHasHostInstances(hostMap)
        setDeviceSpecificSandboxRuntimeTypes(runtimeMap)
      } else {
        setDeviceSpecificDeploymentTypes(new Map())
        setDeviceSpecificLastActive(new Map())
        setDeviceSpecificFirstSeen(new Map())
        setDeviceSpecificInstanceCount(new Map())
        setDeviceSpecificHasHostInstances(new Map())
        setDeviceSpecificSandboxRuntimeTypes(new Map())
      }

      setAgents((data || []).map((item: any) => ({
        id: item.id,
        agent_type: item.agent_type,
        plan: item.plan,
        base_score: formatScore(item.base_score),
        actual_score: formatScore(item.actual_score),
        active_issues: item.active_issues,
        active_users: item.active_users,
        updated_at: item.updated_at,
        deployment_types: item.deployment_types,
        last_active_at: item.last_active_at,
        first_seen_at: item.first_seen_at,
        instance_count: item.instance_count,
        has_host_instances: item.has_host_instances,
        sandbox_runtime_types: item.sandbox_runtime_types,
        agent_name: item.agent_catalog.agent_name,
        description: item.agent_catalog.description,
        logo_url: item.agent_catalog.logo_url,
        origin_country: item.agent_catalog.origin_country ?? null,
        hosts: item.agent_catalog.hosts ?? [],
      })))
    } catch (error: any) {
      console.error('Error fetching agents:', error)
      toast({
        title: "Error",
        description: "Failed to load agents data",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchDevices = async () => {
    try {
      const { data, error } = await supabase.from('devices_with_owners').select('id, friendly_name, device_native_id, owner_email').eq('org_id', activeOrgId!)
        .order('friendly_name')

      if (error) throw error
      setDevices(data || [])
    } catch (error: any) {
      console.error('Error fetching devices:', error)
    }
  }

  // Page-level filters (risk, plan, performance, deployment type) — search is handled by AgentsTable
  const matchesFilters = (agent: any) => {
    const effectiveScore = agent.actual_score ?? agent.base_score
    const riskLevel = getRiskLevel(effectiveScore)
    const matchesRisk = riskFilters.length === 0 || riskFilters.includes(riskLevel.toLowerCase())

    const matchesPlan = planFilters.length === 0 || planFilters.includes(String(getEffectivePlan(agent.agent_type, agent.plan)))

    const matchesPerformance = performanceFilters.length === 0 ||
      (agent.actual_score !== null && agent.base_score !== null && (
        (performanceFilters.includes('better') && agent.actual_score < agent.base_score) ||
        (performanceFilters.includes('worse') && agent.actual_score > agent.base_score) ||
        (performanceFilters.includes('same') && agent.actual_score === agent.base_score)
      ))

    const matchesDeploymentType = deploymentTypeFilters.length === 0 ||
      (agent.deployment_types || []).some((type: number) => deploymentTypeFilters.includes(String(type)))

    const matchesBedrockScope =
      (awsAccountFilters.length === 0 || awsAccountFilters.includes(agent.bedrock_account)) &&
      (awsRegionFilters.length === 0 || awsRegionFilters.includes(agent.bedrock_region))
    const matchesEnvironment = environmentFilters.length === 0 ||
      (environmentFilters.includes('host') && agent.has_host_instances) ||
      (environmentFilters.includes(COPILOT_ENVIRONMENT_VALUE) &&
        (agent.environment_labels || []).includes(COPILOT_ENVIRONMENT_LABEL)) ||
      (environmentFilters.includes(BEDROCK_ENVIRONMENT_VALUE) &&
        (agent.environment_labels || []).includes(BEDROCK_ENVIRONMENT_LABEL) &&
        matchesBedrockScope) ||
      (agent.sandbox_runtime_types || []).some((t: number) => environmentFilters.includes(String(t)))

    // Device filtering is now done server-side, so we don't need to check it here

    // Only Copilot agents have a tenant, so picking a tenant hides device agents
    // (just as a device filter hides Copilot rows).
    const matchesTenant = !copilotEnabled || tenantFilters.length === 0 ||
      (!!agent.tenant_id && tenantFilters.includes(agent.tenant_id))

    return matchesRisk && matchesPlan && matchesPerformance && matchesDeploymentType && matchesEnvironment && matchesTenant
  }

  const filteredAgents = agents.filter(matchesFilters).map(agent => {
    if (deviceIdFilters.length === 0) return agent
    const key = `${agent.agent_type}:${agent.plan}`
    return {
      ...agent,
      last_active_at: deviceSpecificLastActive.get(key) || null,
      first_seen_at: deviceSpecificFirstSeen.get(key) || null,
    }
  })

  // Mock Microsoft 365 Copilot agents (no device association).
  const filteredCopilotAgents = deviceIdFilters.length > 0
    ? []
    : copilotRows.filter(matchesFilters)

  // Runtimes have no scores, plan, or device association, so they drop out of
  // every filter above; device filtering is server-side and excludes them too.
  const filteredBedrockRuntimes = deviceIdFilters.length > 0
    ? []
    : bedrockRuntimes.filter(matchesFilters)

  // Always offered. Without an AWS connection the inventory is empty, so
  // selecting it simply shows an empty list.
  const environmentOptions = [
    ...ENVIRONMENT_OPTIONS,
    ...(copilotEnabled ? [COPILOT_ENVIRONMENT_OPTION] : []),
    ...(awsBedrockEnabled ? [BEDROCK_ENVIRONMENT_OPTION] : []),
  ]
  // With the flag off, an old ?environment=aws_bedrock link must not show the AWS filters or hide the charts.
  const bedrockSelected = awsBedrockEnabled && environmentFilters.includes(BEDROCK_ENVIRONMENT_VALUE)

  const bedrockOptions = useMemo(
    () => bedrockFilterOptions(bedrockRuntimes, awsAccountFilters),
    [bedrockRuntimes, awsAccountFilters],
  )

  const totalInstances = filteredAgents.reduce((sum, agent) => {
    if (deviceIdFilters.length > 0) {
      const key = `${agent.agent_type}:${agent.plan}`
      return sum + (deviceSpecificInstanceCount.get(key) ?? 0)
    }
    return sum + (agent.instance_count ?? 0)
  }, 0)

  // Chart data aggregations

  const deploymentDistribution = useMemo(() => {
    const counts: Record<number, number> = {}
    let agentsWithNoTypes = 0
    const hasDeviceFilter = deviceIdFilters.length > 0

    filteredAgents.forEach(a => {
      // Use device-specific deployment types when filter is active
      const key = `${a.agent_type}:${a.plan}`
      const types = hasDeviceFilter && deviceSpecificDeploymentTypes.has(key)
        ? Array.from(deviceSpecificDeploymentTypes.get(key)!)
        : a.deployment_types

      if (!types?.length) {
        agentsWithNoTypes++
      } else {
        types.forEach((type: number) => {
          counts[type] = (counts[type] || 0) + 1
        })
      }
    })
    if (agentsWithNoTypes > 0) {
      counts[0] = (counts[0] || 0) + agentsWithNoTypes
    }
    return Object.entries(counts)
      .filter(([_, count]) => count > 0)
      .map(([type, count]) => ({
        name: AGENT_DEPLOYMENT_TYPE_MAP[Number(type)],
        value: count,
        color: DEPLOYMENT_TYPE_CHART_COLORS[Number(type)]
      }))
  }, [filteredAgents, deviceIdFilters, deviceSpecificDeploymentTypes])

  const riskDistribution = useMemo(() => {
    const counts = { low: 0, medium: 0, high: 0, critical: 0 }
    filteredAgents.forEach(a => {
      const effectiveScore = a.actual_score ?? a.base_score
      const level = getRiskLevel(effectiveScore).toLowerCase()
      if (level in counts) counts[level as keyof typeof counts]++
    })
    return [
      { name: 'Low', value: counts.low, color: RISK_CHART_COLORS.low },
      { name: 'Medium', value: counts.medium, color: RISK_CHART_COLORS.medium },
      { name: 'High', value: counts.high, color: RISK_CHART_COLORS.high },
      { name: 'Critical', value: counts.critical, color: RISK_CHART_COLORS.critical },
    ].filter(d => d.value > 0)
  }, [filteredAgents])

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        {searchParams.get('source_device') && (
          <Button variant="ghost" onClick={() => navigate(`/devices/${searchParams.get('source_device')}`)}>
            <ArrowLeft className="h-4 w-4" />
            Back to Device
          </Button>
        )}
        {searchParams.get('source_devices') && (
          <Button variant="ghost" onClick={() => {
            const backSearch = (location.state?.backSearch as string) || ''
            navigate(`/devices${backSearch ? `?${backSearch}` : ''}`)
          }}>
            <ArrowLeft className="h-4 w-4" />
            Back to Devices
          </Button>
        )}
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-lg bg-primary/10">
            <Users className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              AI Agents
            </h1>
            <p className="text-muted-foreground">Traceforce auto-discovers your AI agents, identifies toolchain dependencies and mitigates risks</p>
          </div>
        </div>
        {/* Re-reads the stored inventory. The collector syncs AWS hourly. */}
        {(bedrockSyncedAt !== null || bedrockError) && (
          <div className="ml-auto flex items-center gap-2">
            {bedrockError ? (
              <span className="text-xs text-destructive">Couldn't load cloud agents.</span>
            ) : (
              <span className="text-xs text-muted-foreground">
                Cloud agents synced {formatDistanceToNow(new Date(bedrockSyncedAt!), { addSuffix: true })}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBedrockReload(n => n + 1)}
              disabled={bedrockRefreshing}
            >
              <RefreshCw className={`h-4 w-4 ${bedrockRefreshing ? 'animate-spin' : ''}`} />
              {bedrockError ? 'Try again' : 'Refresh'}
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-4 mb-4">
        <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline">
              <Filter className="h-4 w-4" />
              Filters
              {(() => {
                const appliedFilters = [
                  riskFilters.length > 0,
                  planFilters.length > 0,
                  performanceFilters.length > 0,
                  deploymentTypeFilters.length > 0,
                  environmentFilters.length > 0,
                  bedrockSelected &&
                    awsAccountFilters.length > 0,
                  bedrockSelected &&
                    awsRegionFilters.length > 0,
                  deviceIdFilters.length > 0,
                  copilotEnabled && tenantFilters.length > 0
                ].filter(Boolean).length

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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Risk Level</label>
                    <MultiSelect
                      options={RISK_LEVEL_OPTIONS.filter(o => o.value !== 'all').map(o => ({ id: o.value, name: o.label }))}
                      selectedIds={riskFilters}
                      onChange={setRiskFilters}
                      placeholder="All"
                      searchPlaceholder="Search risk levels..."
                      emptyMessage="No risk levels found."
                      label="risk level"
                      compact
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Plan</label>
                    <MultiSelect
                      options={PLAN_OPTIONS.filter(o => o.value !== 'all').map(o => ({ id: o.value, name: o.label }))}
                      selectedIds={planFilters}
                      onChange={setPlanFilters}
                      placeholder="All"
                      searchPlaceholder="Search plans..."
                      emptyMessage="No plans found."
                      label="plan"
                      compact
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Deployment Type</label>
                    <MultiSelect
                      options={DEPLOYMENT_TYPE_OPTIONS.map(o => ({ id: o.value, name: o.label }))}
                      selectedIds={deploymentTypeFilters}
                      onChange={setDeploymentTypeFilters}
                      placeholder="All"
                      searchPlaceholder="Search deployment types..."
                      emptyMessage="No deployment types found."
                      label="type"
                      compact
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Environment</label>
                    <MultiSelect
                      options={environmentOptions.map(o => ({ id: o.value, name: o.label }))}
                      selectedIds={environmentFilters}
                      onChange={setEnvironmentFilters}
                      placeholder="All"
                      searchPlaceholder="Search environments..."
                      emptyMessage="No environments found."
                      label="environment"
                      compact
                    />
                  </div>

                  {copilotEnabled && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">Tenant</label>
                      <MultiSelect
                        options={copilotConnections.map(c => ({ id: c.tenant_id, name: c.tenant_id }))}
                        selectedIds={tenantFilters}
                        onChange={setTenantFilters}
                        placeholder="All"
                        searchPlaceholder="Search tenants..."
                        emptyMessage="No Microsoft 365 tenants connected."
                        label="tenant"
                        compact
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Performance</label>
                    <MultiSelect
                      options={PERFORMANCE_OPTIONS.filter(o => o.value !== 'all').map(o => ({ id: o.value, name: o.label }))}
                      selectedIds={performanceFilters}
                      onChange={setPerformanceFilters}
                      placeholder="All"
                      searchPlaceholder="Search performance..."
                      emptyMessage="No options found."
                      label="option"
                      compact
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Device</label>
                    <MultiSelect
                      options={deviceOptions(devices)}
                      selectedIds={deviceIdFilters}
                      onChange={setDeviceIdFilters}
                      placeholder="All"
                      searchPlaceholder="Search devices..."
                      emptyMessage="No devices found."
                      label="device"
                      compact
                    />
                  </div>

                  {/* AWS account and Region: separate cells, shown only for AWS Bedrock. */}
                  {bedrockSelected && (
                    <>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground">AWS account</label>
                        <MultiSelect
                          options={bedrockOptions.accounts}
                          selectedIds={awsAccountFilters}
                          onChange={setAwsAccountFilters}
                          placeholder="All"
                          searchPlaceholder="Search accounts..."
                          emptyMessage="No AWS accounts found."
                          label="account"
                          compact
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground">Region</label>
                        <MultiSelect
                          options={bedrockOptions.regions}
                          selectedIds={awsRegionFilters}
                          onChange={setAwsRegionFilters}
                          placeholder="All"
                          searchPlaceholder="Search regions..."
                          emptyMessage="No regions found."
                          label="region"
                          compact
                        />
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Metric Charts. They summarise device agents, so they are hidden while
          the AWS Bedrock environment is selected. */}
      {!bedrockSelected && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <MetricCard title="Agents in Use" loading={loading}>
            <div className="flex items-center justify-center gap-8 h-[120px]">
              <div className="flex flex-col items-center justify-center">
                {/* Types counts every row in the table, Copilot included; Instances stays device-only. */}
                <p className="text-4xl font-bold">{filteredAgents.length + filteredCopilotAgents.length}</p>
                <p className="text-sm text-muted-foreground">Types</p>
              </div>
              <div className="flex flex-col items-center justify-center">
                <p className="text-4xl font-bold">{totalInstances}</p>
                <p className="text-sm text-muted-foreground">Instances</p>
              </div>
            </div>
          </MetricCard>
          <DistributionCard id="agent-deployment" title="Deployment Types" loading={loading} data={deploymentDistribution} onItemClick={(name) => {
            const entry = Object.entries(AGENT_DEPLOYMENT_TYPE_MAP).find(([_, label]) => label === name)
            if (entry) {
              const key = entry[0]
              setDeploymentTypeFilters(
                deploymentTypeFilters.includes(key) ? deploymentTypeFilters.filter(f => f !== key) : [...deploymentTypeFilters, key]
              )
              setFiltersOpen(true)
            }
          }} />
          <DistributionCard id="agent-risk" title="Risk Breakdown" loading={loading} data={riskDistribution} onItemClick={(name) => {
            const key = name.toLowerCase()
            setRiskFilters(
              riskFilters.includes(key) ? riskFilters.filter(f => f !== key) : [...riskFilters, key]
            )
            setFiltersOpen(true)
          }} />
        </div>
      )}

      <AgentsTable
        syncSearchToUrl
        showEnforcementStatus
        agents={[...filteredAgents, ...filteredCopilotAgents, ...filteredBedrockRuntimes, ...(RED_TEAM_AGENT ? [RED_TEAM_AGENT] : [])]}
        loading={loading}
        deviceSpecificDeploymentTypes={deviceSpecificDeploymentTypes}
        deviceSpecificHasHostInstances={deviceSpecificHasHostInstances}
        deviceSpecificSandboxRuntimeTypes={deviceSpecificSandboxRuntimeTypes}
        hasDeviceFilter={deviceIdFilters.length > 0}
      />
    </div>
  )
}

export default Agents
