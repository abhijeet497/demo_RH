import { useState, useEffect, useMemo } from "react"
import { supabase } from "@/integrations/supabase/client"
import { useLocation, useNavigate, useSearchParams } from "react-router-dom"
import { useOrg } from "@/contexts/OrgContext"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MultiSelect } from "@/components/ui/multi-select"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Card, CardContent } from "@/components/ui/card"
import { Filter, ChevronDown, ChevronUp, Network, ArrowLeft } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { DistributionCard } from "@/components/charts/DistributionCard"
import { StackedBar } from "@/components/charts/StackedBar"
import { buildAuthTypeDistribution } from "@/lib/dashboardCharts"
import { MetricCard } from "@/components/charts/MetricCard"
import McpsTable from "@/components/McpsTable"
import { AllowAccessDialog } from "@/components/AllowAccessDialog"
import { transformMcpName } from "@/lib/utils"
import { useUrlArrayFilter } from "@/hooks/use-url-filters"
import { fetchMcpCatalogMap } from "@/lib/mcpCatalog"
import { mcpAccessEnabled } from "@/lib/featureFlags"
import { ConnectorAccessCard } from "@/components/ConnectorAccessCard"
import { useConnectorAccess } from "@/hooks/use-connector-access"
import {
  getRiskLevel,
  RISK_LEVEL_OPTIONS, PERFORMANCE_OPTIONS,
  formatScore,
  RISK_CHART_COLORS, DISTRIBUTION_CHANNEL_CHART_COLORS, getCategoryColor,
  ENVIRONMENT_OPTIONS, AUTH_TYPE_MAP, AUTH_TYPE_DISPLAY_ORDER, deviceOptions
} from "@/lib/appUtils"

const MANAGED_BY_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'user', label: 'User' },
  { value: 'unknown', label: 'Unknown' },
]

// Values are the proto auth types as strings; 0 doubles as the "nothing
// detected" bucket, mirroring the charts' Unknown.
const AUTH_TYPE_FILTER_OPTIONS = AUTH_TYPE_DISPLAY_ORDER.map(t => ({
  value: String(t),
  label: AUTH_TYPE_MAP[t],
}))

const Mcps = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  // URL-backed multi-select filters (comma-separated values, empty array = "all")
  const [riskFilters, setRiskFilters] = useUrlArrayFilter('risk')
  const [categoryFilters, setCategoryFilters] = useUrlArrayFilter('category')
  const [managedByFilters, setManagedByFilters] = useUrlArrayFilter('managedBy')
  const [environmentFilters, setEnvironmentFilters] = useUrlArrayFilter('environment')
  const [authFilters, setAuthFilters] = useUrlArrayFilter('auth')
  const [deviceIdFilters, setDeviceIdFilters] = useUrlArrayFilter('deviceId')
  const [mcpData, setMcpData] = useState<any[]>([])
  const [devices, setDevices] = useState<any[]>([])
  const [deviceSpecificAgentNames, setDeviceSpecificAgentNames] = useState<Map<number, Set<string>>>(new Map())
  const [deviceSpecificDistributionChannels, setDeviceSpecificDistributionChannels] = useState<Map<number, Set<number>>>(new Map())
  const [deviceSpecificInstanceCount, setDeviceSpecificInstanceCount] = useState<Map<number, number>>(new Map())
  const [deviceSpecificFirstSeen, setDeviceSpecificFirstSeen] = useState<Map<number, string>>(new Map())
  const [deviceSpecificHasHostInstances, setDeviceSpecificHasHostInstances] = useState<Map<number, boolean>>(new Map())
  const [deviceSpecificSandboxRuntimeTypes, setDeviceSpecificSandboxRuntimeTypes] = useState<Map<number, Set<number>>>(new Map())
  const [loading, setLoading] = useState(true)
  const [performanceFilters, setPerformanceFilters] = useUrlArrayFilter('performance')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [categories, setCategories] = useState<any[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const { toast } = useToast()
  const { activeOrgId } = useOrg()
  // User Access column + Connector Access card, scoped to the device filter.
  const access = useConnectorAccess(mcpAccessEnabled, deviceIdFilters)
  const connectorNameByType = useMemo(
    () => new Map(mcpData.map((m) => [m.mcp_server_type as number, transformMcpName(m.mcp_server_name)])),
    [mcpData],
  )

  useEffect(() => {
    async function fetchCategories() {
      setCategoriesLoading(true)
      try {
        const { data, error } = await supabase
          .from('mcp_categories')
          .select('id, name')
          .order('name')
        
        if (error) throw error
        
        const mappedCategories = (data || []).map((item: any) => ({
          id: item.id,
          name: item.name
        }))
        
        setCategories(mappedCategories)
      } catch (error) {
        console.error('Error fetching categories:', error)
      } finally {
        setCategoriesLoading(false)
      }
    }
    
    fetchCategories()
  }, [])

  useEffect(() => {
    fetchDevices()
  }, [activeOrgId])

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

  useEffect(() => {
    async function fetchMcpData() {
      setLoading(true)
      try {
        // Start device metadata query and instance count in parallel
        let deviceMetadataPromise = null
        if (deviceIdFilters.length > 0) {
          deviceMetadataPromise = supabase
            .rpc('get_device_mcp_metadata', {
              p_device_ids: deviceIdFilters,
              p_sandbox_ids: null,
            })
        }

        // If deviceIdFilters is set, first get the mcp_server_type values that have these devices
        let filteredMcpServerTypes: number[] | null = null
        if (deviceIdFilters.length > 0) {
          const { data: deviceMcpData } = await supabase.from('active_mcp_devices').select('mcp_server_type').eq('org_id', activeOrgId!)
            .in('device_id', deviceIdFilters)

          filteredMcpServerTypes = [...new Set(deviceMcpData?.map(d => d.mcp_server_type).filter(Boolean) || [])]

          // If no MCPs found for these devices, return empty array
          if (filteredMcpServerTypes.length === 0) {
            setMcpData([])
            setLoading(false)
            return
          }
        }

        let query = supabase.from('active_mcp_servers').select(`
            id,
            mcp_server_type,
            base_score,
            actual_score,
            active_issues,
            active_users,
            updated_at,
            agent_names,
            distribution_channels,
            auth_types,
            instance_count,
            first_seen_at,
            has_host_instances,
            sandbox_runtime_types
          `).eq('org_id', activeOrgId!)
          .gt('active_users', 0)

        // Apply server-side device filter
        if (filteredMcpServerTypes && filteredMcpServerTypes.length > 0) {
          query = query.in('mcp_server_type', filteredMcpServerTypes)
        }

        const [mcpResult, deviceMetadataResult] = await Promise.all([
          query.order('actual_score', { ascending: false, nullsFirst: false }),
          deviceMetadataPromise
        ])

        // Errors toast from the outer catch so the catalog fetch below gets
        // the same user-visible failure as the servers query.
        const { data, error } = mcpResult
        if (error) throw error

        // Process device metadata into Maps (merge across devices)
        if (deviceMetadataResult?.data) {
          const agentNamesMap = new Map<number, Set<string>>()
          const distributionChannelsMap = new Map<number, Set<number>>()
          const instanceCountMap = new Map<number, number>()
          const firstSeenMap = new Map<number, string>()
          const hostMap = new Map<number, boolean>()
          const runtimeMap = new Map<number, Set<number>>()
          deviceMetadataResult.data.forEach((row: any) => {
            const existingAgents = agentNamesMap.get(row.mcp_server_type) || new Set<string>()
            ;(row.agent_names || []).forEach((name: string) => existingAgents.add(name))
            agentNamesMap.set(row.mcp_server_type, existingAgents)

            const existingChannels = distributionChannelsMap.get(row.mcp_server_type) || new Set<number>()
            ;(row.distribution_channels || []).forEach((channel: number) => existingChannels.add(channel))
            distributionChannelsMap.set(row.mcp_server_type, existingChannels)

            instanceCountMap.set(row.mcp_server_type, (instanceCountMap.get(row.mcp_server_type) || 0) + (row.instance_count ?? 0))
            if (row.first_seen_at && (!firstSeenMap.has(row.mcp_server_type) || row.first_seen_at < firstSeenMap.get(row.mcp_server_type)!)) {
              firstSeenMap.set(row.mcp_server_type, row.first_seen_at)
            }

            if (row.has_host_instances) hostMap.set(row.mcp_server_type, true)
            const existingRuntimes = runtimeMap.get(row.mcp_server_type) || new Set<number>()
            ;(row.sandbox_runtime_types || []).forEach((t: number) => existingRuntimes.add(t))
            runtimeMap.set(row.mcp_server_type, existingRuntimes)
          })
          setDeviceSpecificAgentNames(agentNamesMap)
          setDeviceSpecificDistributionChannels(distributionChannelsMap)
          setDeviceSpecificInstanceCount(instanceCountMap)
          setDeviceSpecificFirstSeen(firstSeenMap)
          setDeviceSpecificHasHostInstances(hostMap)
          setDeviceSpecificSandboxRuntimeTypes(runtimeMap)
        } else {
          setDeviceSpecificAgentNames(new Map())
          setDeviceSpecificDistributionChannels(new Map())
          setDeviceSpecificInstanceCount(new Map())
          setDeviceSpecificFirstSeen(new Map())
          setDeviceSpecificHasHostInstances(new Map())
          setDeviceSpecificSandboxRuntimeTypes(new Map())
        }

        // Resolve catalog fields through the combined global+org catalog by
        // mcp_server_type: org-catalog servers carry mcp_catalog_id NULL, so
        // the old mcp_catalog!inner embed dropped them.
        const catalog = await fetchMcpCatalogMap(
          activeOrgId!,
          [...new Set((data || []).map((item: any) => item.mcp_server_type).filter((t): t is number => t != null))],
        )

        // Map MCP data (device_ids not needed - affected_devices count comes from mcp_servers table)
        const mcpsWithDevices = (data || [])
          // Types in neither catalog stay hidden like the old !inner embed;
          // unlike it, uncategorized entries are now kept (intended).
          .filter((item: any) => catalog.has(item.mcp_server_type))
          .map((item: any) => {
            const entry = catalog.get(item.mcp_server_type)!
            return {
              id: item.id,
              mcp_server_type: item.mcp_server_type,
              base_score: formatScore(item.base_score),
              actual_score: formatScore(item.actual_score),
              active_issues: item.active_issues,
              active_users: item.active_users,
              updated_at: item.updated_at,
              mcp_server_name: entry.mcp_server_name,
              description: entry.description,
              category_id: entry.category_id,
              category_name: entry.category_name,
              logo_url: entry.logo_url,
              source_type: entry.source_type,
              agent_names: item.agent_names && Array.isArray(item.agent_names) ? item.agent_names : null,
              distribution_channels: item.distribution_channels && Array.isArray(item.distribution_channels) ? item.distribution_channels : null,
              auth_types: item.auth_types && Array.isArray(item.auth_types) ? item.auth_types : null,
              instance_count: item.instance_count,
              first_seen_at: item.first_seen_at,
              has_host_instances: item.has_host_instances,
              sandbox_runtime_types: item.sandbox_runtime_types,
            }
          })

        setMcpData(mcpsWithDevices)
      } catch (error: any) {
        console.error('Error fetching MCP data:', error)
        toast({
          title: "Error",
          description: "Failed to load connector data",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchMcpData()
  }, [toast, searchParams, activeOrgId])


  const filteredMcps = mcpData.filter((mcp) => {
    const effectiveScore = mcp.actual_score ?? mcp.base_score
    const riskLevel = getRiskLevel(effectiveScore)
    const matchesRisk = riskFilters.length === 0 || riskFilters.includes(riskLevel.toLowerCase())
    const matchesCategory = categoryFilters.length === 0 || categoryFilters.includes(mcp.category_id)

    const matchesPerformance = performanceFilters.length === 0 ||
      (mcp.actual_score !== null && mcp.base_score !== null && (
        (performanceFilters.includes('better') && mcp.actual_score < mcp.base_score) ||
        (performanceFilters.includes('worse') && mcp.actual_score > mcp.base_score) ||
        (performanceFilters.includes('same') && mcp.actual_score === mcp.base_score)
      ))

    const matchesManagedBy = managedByFilters.length === 0 ||
      (mcp.distribution_channels || []).some((channel: number) => {
        const key = (channel === 1 || channel === 2) ? 'admin' : channel === 3 ? 'user' : 'unknown'
        return managedByFilters.includes(key)
      })

    const matchesEnvironment = environmentFilters.length === 0 ||
      (environmentFilters.includes('host') && mcp.has_host_instances) ||
      (mcp.sandbox_runtime_types || []).some((t: number) => environmentFilters.includes(String(t)))

    // Same bucketing as buildAuthTypeDistribution: detected methods (unrecognized
    // values fold into 0), 0 when nothing detected — so the filter always agrees
    // with the donut.
    const matchesAuth = authFilters.length === 0 || (() => {
      const detected = (mcp.auth_types || [])
        .filter((t: number) => t !== 0)
        .map((t: number) => (AUTH_TYPE_MAP[t] ? t : 0))
      const buckets = detected.length > 0 ? detected : [0]
      return buckets.some((t: number) => authFilters.includes(String(t)))
    })()

    // Device filter is now handled server-side

    return matchesRisk && matchesCategory && matchesPerformance && matchesManagedBy && matchesEnvironment && matchesAuth
  }).map(mcp => {
    if (deviceIdFilters.length === 0) return mcp
    return { ...mcp, first_seen_at: deviceSpecificFirstSeen.get(mcp.mcp_server_type) || null }
  })

  const totalInstances = filteredMcps.reduce((sum, mcp) => {
    if (deviceIdFilters.length > 0) {
      return sum + (deviceSpecificInstanceCount.get(mcp.mcp_server_type) ?? 0)
    }
    return sum + (mcp.instance_count ?? 0)
  }, 0)

  // Chart data aggregations
  const categoryDistribution = useMemo(() => {
    const counts: Record<string, { name: string, count: number }> = {}
    filteredMcps.forEach(m => {
      const categoryId = m.category_id || 'unknown'
      const categoryName = m.category_name || 'Unknown'
      if (!counts[categoryId]) {
        counts[categoryId] = { name: categoryName, count: 0 }
      }
      counts[categoryId].count++
    })
    return Object.entries(counts)
      .filter(([_, data]) => data.count > 0)
      .map(([_, data], index) => ({
        name: data.name,
        value: data.count,
        color: getCategoryColor(index)
      }))
      .sort((a, b) => b.value - a.value)
  }, [filteredMcps])

  const managedByDistribution = useMemo(() => {
    const counts = { admin: 0, user: 0, unknown: 0 }
    const hasDeviceFilter = deviceIdFilters.length > 0
    
    filteredMcps.forEach(m => {
      // Use device-specific channels when filter is active
      const channels = hasDeviceFilter && deviceSpecificDistributionChannels.has(m.mcp_server_type)
        ? Array.from(deviceSpecificDistributionChannels.get(m.mcp_server_type)!)
        : m.distribution_channels
      
      if (!channels?.length) {
        counts.unknown++
      } else {
        channels.forEach((channel: number) => {
          if (channel === 1 || channel === 2) counts.admin++
          else if (channel === 3) counts.user++
          else counts.unknown++
        })
      }
    })
    return [
      { name: 'Admin', value: counts.admin, color: DISTRIBUTION_CHANNEL_CHART_COLORS.admin },
      { name: 'User', value: counts.user, color: DISTRIBUTION_CHANNEL_CHART_COLORS.user },
      { name: 'Unknown', value: counts.unknown, color: DISTRIBUTION_CHANNEL_CHART_COLORS.unknown },
    ].filter(d => d.value > 0)
  }, [filteredMcps, deviceIdFilters, deviceSpecificDistributionChannels])

  const authTypeDistribution = useMemo(
    () => buildAuthTypeDistribution(filteredMcps),
    [filteredMcps],
  )

  const riskDistribution = useMemo(() => {
    const counts = { low: 0, medium: 0, high: 0, critical: 0 }
    filteredMcps.forEach(m => {
      const effectiveScore = m.actual_score ?? m.base_score
      const level = getRiskLevel(effectiveScore).toLowerCase()
      if (level in counts) counts[level as keyof typeof counts]++
    })
    return [
      { name: 'Low', value: counts.low, color: RISK_CHART_COLORS.low },
      { name: 'Medium', value: counts.medium, color: RISK_CHART_COLORS.medium },
      { name: 'High', value: counts.high, color: RISK_CHART_COLORS.high },
      { name: 'Critical', value: counts.critical, color: RISK_CHART_COLORS.critical },
    ].filter(d => d.value > 0)
  }, [filteredMcps])

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
            <Network className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Connectors
            </h1>
            <p className="text-muted-foreground">
              Manage Model Context Protocols and their agent associations
            </p>
          </div>
        </div>
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
                  categoryFilters.length > 0,
                  performanceFilters.length > 0,
                  managedByFilters.length > 0,
                  authFilters.length > 0,
                  environmentFilters.length > 0,
                  deviceIdFilters.length > 0
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4">
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
                    <label className="text-sm font-medium text-muted-foreground">Category</label>
                    <MultiSelect
                      options={categories.map(c => ({ id: c.id, name: c.name }))}
                      selectedIds={categoryFilters}
                      onChange={setCategoryFilters}
                      placeholder="All"
                      searchPlaceholder="Search categories..."
                      emptyMessage="No categories found."
                      label="category"
                      disabled={categoriesLoading}
                      compact
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Managed By</label>
                    <MultiSelect
                      options={MANAGED_BY_OPTIONS.map(o => ({ id: o.value, name: o.label }))}
                      selectedIds={managedByFilters}
                      onChange={setManagedByFilters}
                      placeholder="All"
                      searchPlaceholder="Search..."
                      emptyMessage="No options found."
                      label="option"
                      compact
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Authentication</label>
                    <MultiSelect
                      options={AUTH_TYPE_FILTER_OPTIONS.map(o => ({ id: o.value, name: o.label }))}
                      selectedIds={authFilters}
                      onChange={setAuthFilters}
                      placeholder="All"
                      searchPlaceholder="Search..."
                      emptyMessage="No options found."
                      label="option"
                      compact
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Environment</label>
                    <MultiSelect
                      options={ENVIRONMENT_OPTIONS.map(o => ({ id: o.value, name: o.label }))}
                      selectedIds={environmentFilters}
                      onChange={setEnvironmentFilters}
                      placeholder="All"
                      searchPlaceholder="Search environments..."
                      emptyMessage="No environments found."
                      label="environment"
                      compact
                    />
                  </div>

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
                </div>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Metric Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <MetricCard title="Connectors in Use" loading={loading}>
          <div className="flex items-center justify-center h-[120px]">
            <div className="flex items-center justify-center gap-8">
              <div className="flex flex-col items-center justify-center">
                <p className="text-4xl font-bold">{filteredMcps.length}</p>
                <p className="text-sm text-muted-foreground">Types</p>
              </div>
              <div className="flex flex-col items-center justify-center">
                <p className="text-4xl font-bold">{totalInstances}</p>
                <p className="text-sm text-muted-foreground">Instances</p>
              </div>
            </div>
          </div>
        </MetricCard>
        <DistributionCard id="mcp-categories" title="Categories" loading={loading} data={categoryDistribution} maxLegendItems={5} onItemClick={(name) => {
          const cat = categories.find(c => c.name === name)
          if (cat) {
            setCategoryFilters(
              categoryFilters.includes(cat.id) ? categoryFilters.filter(f => f !== cat.id) : [...categoryFilters, cat.id]
            )
            setFiltersOpen(true)
          }
        }} />
        <DistributionCard id="mcp-risk" title="Risk Breakdown" loading={loading} data={riskDistribution} onItemClick={(name) => {
          const key = name.toLowerCase()
          setRiskFilters(
            riskFilters.includes(key) ? riskFilters.filter(f => f !== key) : [...riskFilters, key]
          )
          setFiltersOpen(true)
        }} />
      </div>

      <div className={`grid grid-cols-1 gap-4 ${mcpAccessEnabled ? "lg:grid-cols-3" : "lg:grid-cols-2"}`}>
        {mcpAccessEnabled && (
          <ConnectorAccessCard
            access={access.policies}
            requestCount={access.status.pendingTotal}
            requestsLoading={access.status.loading}
            requestsError={!!access.status.error}
            devices={access.deviceScope}
            deviceName={
              deviceIdFilters.length === 1
                ? deviceOptions(devices).find((d) => d.id === deviceIdFilters[0])?.name
                : undefined
            }
          />
        )}
        <MetricCard title="Managed By" loading={loading}>
          <StackedBar data={managedByDistribution} onSegmentClick={(name) => {
            const key = name.toLowerCase()
            setManagedByFilters(
              managedByFilters.includes(key) ? managedByFilters.filter(f => f !== key) : [...managedByFilters, key]
            )
            setFiltersOpen(true)
          }} />
        </MetricCard>
        <MetricCard title="Authentication" loading={loading}>
          <StackedBar data={authTypeDistribution} onSegmentClick={(name) => {
            const type = AUTH_TYPE_DISPLAY_ORDER.find(t => AUTH_TYPE_MAP[t] === name)
            if (type === undefined) return
            const key = String(type)
            setAuthFilters(
              authFilters.includes(key) ? authFilters.filter(f => f !== key) : [...authFilters, key]
            )
            setFiltersOpen(true)
          }} />
        </MetricCard>
      </div>

      <McpsTable
        syncSearchToUrl
        mcps={filteredMcps}
        loading={loading}
        deviceSpecificAgentNames={deviceSpecificAgentNames}
        deviceSpecificDistributionChannels={deviceSpecificDistributionChannels}
        deviceSpecificHasHostInstances={deviceSpecificHasHostInstances}
        deviceSpecificSandboxRuntimeTypes={deviceSpecificSandboxRuntimeTypes}
        hasDeviceFilter={deviceIdFilters.length > 0}
        {...access.tableProps}
      />
      {mcpAccessEnabled && (
        <AllowAccessDialog
          {...access.allowDialogProps}
          connectorName={(type) => connectorNameByType.get(type) ?? `Connector ${type}`}
        />
      )}
    </div>
  )
}

export default Mcps