import { useMemo, useState, useEffect } from "react"
import { useLocation, useNavigate, useSearchParams } from "react-router-dom"
import { ArrowLeft, Brain, Filter, ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MultiSelect } from "@/components/ui/multi-select"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Card, CardContent } from "@/components/ui/card"
import { DistributionCard } from "@/components/charts/DistributionCard"
import { MetricCard } from "@/components/charts/MetricCard"
import LlmModelsTable from "@/components/LlmModelsTable"
import { useUrlArrayFilter } from "@/hooks/use-url-filters"
import { useAuth } from "@/contexts/AuthContext"
import { useOrg } from "@/contexts/OrgContext"
import { useToast } from "@/hooks/use-toast"
import { traceforcApi } from "@/integrations/traceforce/client"
import type { DeviceListItem, LlmModelDto, LlmModelInstanceDto } from "@/integrations/traceforce/types"
import { deviceOptions } from "@/lib/appUtils"
import { weightLabel, toDistribution, catalogLogosByType, scopeModelsToDevices } from "@/lib/llmModels"

const uniq = (values: string[]) => Array.from(new Set(values.filter(Boolean))).sort()

const LlmModels = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { session } = useAuth()
  const { activeOrgId } = useOrg()
  const { toast } = useToast()

  const [models, setModels] = useState<LlmModelDto[]>([])
  const [logos, setLogos] = useState<Map<number, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [publisherFilters, setPublisherFilters] = useUrlArrayFilter('publisher')
  const [originFilters, setOriginFilters] = useUrlArrayFilter('origin')
  const [hostFilters, setHostFilters] = useUrlArrayFilter('apiHost')
  const [weightFilters, setWeightFilters] = useUrlArrayFilter('weight')
  const [deviceIdFilters, setDeviceIdFilters] = useUrlArrayFilter('deviceId')
  const [devices, setDevices] = useState<DeviceListItem[]>([])
  const [deviceInstances, setDeviceInstances] = useState<LlmModelInstanceDto[]>([])
  const [deviceLoading, setDeviceLoading] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const deviceKey = deviceIdFilters.join(',')

  useEffect(() => {
    const token = session?.access_token
    if (!token) return
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([
      traceforcApi.listAllLlmModels(token),
      // Logos come from the catalog; a catalog failure only costs the logos.
      traceforcApi.listAllLlmCatalog(token).catch(() => []),
    ])
      .then(([data, catalog]) => {
        if (cancelled) return
        setModels(data)
        setLogos(catalogLogosByType(catalog))
      })
      .catch((e) => {
        if (cancelled) return
        const msg = e instanceof Error ? e.message : 'Failed to load LLM models'
        setError(msg)
        toast({ title: 'Failed to load LLM models', description: msg, variant: 'destructive' })
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // activeOrgId re-runs on org switch; access_token re-runs on late session hydration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrgId, session?.access_token])

  // Devices for the Device filter (as on the MCP list).
  useEffect(() => {
    const token = session?.access_token
    if (!token) return
    let cancelled = false
    traceforcApi.listAllDevices(token, { sort_by: 'name', sort_order: 'asc' })
      .then((data) => { if (!cancelled) setDevices(data) })
      .catch((e) => console.error('Error fetching devices:', e))
    return () => { cancelled = true }
  }, [activeOrgId, session?.access_token])

  // With a device filter, only those devices' models, with their per-device values
  // (as the MCP list does).
  useEffect(() => {
    const token = session?.access_token
    if (!token || deviceIdFilters.length === 0) {
      setDeviceInstances([])
      setDeviceLoading(false)
      return
    }
    let cancelled = false
    setDeviceLoading(true)
    traceforcApi.listAllLlmModelInstances(token, { device_ids: deviceIdFilters })
      .then((data) => { if (!cancelled) setDeviceInstances(data) })
      .catch((e) => {
        if (cancelled) return
        setDeviceInstances([])
        toast({ title: 'Failed to load LLM models', description: e instanceof Error ? e.message : undefined, variant: 'destructive' })
      })
      .finally(() => { if (!cancelled) setDeviceLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrgId, session?.access_token, deviceKey])

  const publisherOptions = useMemo(() => uniq(models.map(m => m.publisher ?? 'Unknown')), [models])
  const originOptions = useMemo(() => uniq(models.map(m => m.origin_country ?? 'Unknown')), [models])
  const hostOptions = useMemo(() => uniq(models.flatMap(m => m.api_hosts ?? [])), [models])
  const weightOptions = useMemo(() => uniq(models.map(m => weightLabel(m.weight))), [models])

  const scopedModels = deviceIdFilters.length > 0 ? scopeModelsToDevices(models, deviceInstances) : models
  const filteredModels = scopedModels.filter((model) => {
    const matchesPublisher = publisherFilters.length === 0 || publisherFilters.includes(model.publisher ?? 'Unknown')
    const matchesOrigin = originFilters.length === 0 || originFilters.includes(model.origin_country ?? 'Unknown')
    const matchesHost = hostFilters.length === 0 || (model.api_hosts ?? []).some(h => hostFilters.includes(h))
    const matchesWeight = weightFilters.length === 0 || weightFilters.includes(weightLabel(model.weight))
    return matchesPublisher && matchesOrigin && matchesHost && matchesWeight
  })

  // Cards and chart follow the filtered list, like the MCP list.
  const publisherDistribution = toDistribution(filteredModels.map(m => m.publisher ?? 'Unknown'))
  const totals = { types: filteredModels.length, instances: filteredModels.reduce((sum, m) => sum + (m.instance_count ?? 0), 0) }

  const appliedFilters = [
    publisherFilters.length > 0,
    originFilters.length > 0,
    hostFilters.length > 0,
    weightFilters.length > 0,
    deviceIdFilters.length > 0,
  ].filter(Boolean).length

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
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
            <Brain className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">LLM Models</h1>
            <p className="text-muted-foreground">Traceforce auto-discovers the LLM models in use across your organization</p>
          </div>
        </div>
      </div>

      <div className="space-y-4 mb-4">
        <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline">
              <Filter className="h-4 w-4" />
              Filters
              {appliedFilters > 0 && <Badge variant="secondary" className="ml-1">{appliedFilters}</Badge>}
              {filtersOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Card className="mt-4">
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Publisher</label>
                    <MultiSelect
                      options={publisherOptions.map(p => ({ id: p, name: p }))}
                      selectedIds={publisherFilters}
                      onChange={setPublisherFilters}
                      placeholder="All"
                      searchPlaceholder="Search publishers..."
                      emptyMessage="No publishers found."
                      label="publisher"
                      compact
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Origin</label>
                    <MultiSelect
                      options={originOptions.map(o => ({ id: o, name: o }))}
                      selectedIds={originFilters}
                      onChange={setOriginFilters}
                      placeholder="All"
                      searchPlaceholder="Search origins..."
                      emptyMessage="No origins found."
                      label="origin"
                      compact
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">API Host</label>
                    <MultiSelect
                      options={hostOptions.map(o => ({ id: o, name: o }))}
                      selectedIds={hostFilters}
                      onChange={setHostFilters}
                      placeholder="All"
                      searchPlaceholder="Search API hosts..."
                      emptyMessage="No API hosts found."
                      label="API host"
                      compact
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Weight</label>
                    <MultiSelect
                      options={weightOptions.map(o => ({ id: o, name: o }))}
                      selectedIds={weightFilters}
                      onChange={setWeightFilters}
                      placeholder="All"
                      searchPlaceholder="Search weights..."
                      emptyMessage="No weights found."
                      label="weight"
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MetricCard title="Models in Use" loading={loading || deviceLoading}>
          <div className="flex items-center justify-center gap-8 h-[120px]">
            <div className="flex flex-col items-center justify-center">
              <p className="text-4xl font-bold">{totals.types}</p>
              <p className="text-sm text-muted-foreground">Types</p>
            </div>
            <div className="flex flex-col items-center justify-center">
              <p className="text-4xl font-bold">{totals.instances}</p>
              <p className="text-sm text-muted-foreground">Instances</p>
            </div>
          </div>
        </MetricCard>
        <DistributionCard
          id="llm-publisher"
          title="Model Publisher"
          maxLegendItems={5}
          loading={loading || deviceLoading}
          data={publisherDistribution}
          onItemClick={(name) => {
            setPublisherFilters(
              publisherFilters.includes(name) ? publisherFilters.filter(f => f !== name) : [...publisherFilters, name]
            )
            setFiltersOpen(true)
          }}
        />
      </div>

      {error ? (
        <Card>
          <CardContent className="py-8 text-center text-destructive">{error}</CardContent>
        </Card>
      ) : (
        <LlmModelsTable syncSearchToUrl models={filteredModels} logos={logos} loading={loading || deviceLoading} />
      )}
    </div>
  )
}

export default LlmModels
