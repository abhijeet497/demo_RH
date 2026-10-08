import { useEffect, useMemo, useState } from "react"
import { useUrlArrayFilter, useUrlFilterParams, useUrlStringFilter } from "@/hooks/use-url-filters"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { MultiSelect } from "@/components/ui/multi-select"
import { Skeleton } from "@/components/ui/skeleton"
import { Brain, Filter, AlertCircle, Search, X, ChevronDown, ChevronUp, ExternalLink } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { useOrg } from "@/contexts/OrgContext"
import { useToast } from "@/hooks/use-toast"
import { traceforcApi } from "@/integrations/traceforce/client"
import { catalogToRegistryModel, isUnlistedLlmModelType, type RegistryModel } from "@/lib/llmModels"

const uniq = (values: string[]) => Array.from(new Set(values.filter(Boolean))).sort()
const weightVariant = (w: string) => (w === 'Open' ? 'success' : w === 'Restricted' ? 'warning' : 'secondary')

export default function LlmModelRegistry() {
  const { searchParams, updateParams } = useUrlFilterParams()
  const { session } = useAuth()
  const { activeOrgId } = useOrg()
  const { toast } = useToast()

  const [models, setModels] = useState<RegistryModel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // URL-backed so it survives detail round-trips, browser back/forward, and sharing.
  const [searchQuery, setSearchQuery] = useUrlStringFilter('q')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [publisherFilters, setPublisherFilters] = useUrlArrayFilter('publisher')
  const [originFilters, setOriginFilters] = useUrlArrayFilter('origin')
  const [weightFilters, setWeightFilters] = useUrlArrayFilter('weight')

  useEffect(() => {
    const token = session?.access_token
    if (!token) return
    let cancelled = false
    setLoading(true)
    setError(null)
    traceforcApi.listAllLlmCatalog(token)
      .then((data) => {
        if (cancelled) return
        // Hide Custom and Unknown: they aren't catalog models to browse (as the MCP
        // registry hides its Custom entry).
        const real = data.filter((e) => !isUnlistedLlmModelType(e.llm_model_type))
        setModels(real.map(catalogToRegistryModel))
      })
      .catch((e) => {
        if (cancelled) return
        const msg = e instanceof Error ? e.message : 'Failed to load LLM catalog'
        setError(msg)
        toast({ title: 'Failed to load LLM catalog', description: msg, variant: 'destructive' })
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrgId, session?.access_token])

  const publisherOptions = useMemo(() => uniq(models.map(m => m.publisher)), [models])
  const originOptions = useMemo(() => uniq(models.map(m => m.origin)), [models])
  const weightOptions = useMemo(() => uniq(models.map(m => m.weight)), [models])

  const appliedFilters = [
    publisherFilters.length > 0,
    originFilters.length > 0,
    weightFilters.length > 0,
  ].filter(Boolean).length

  const filteredModels = models.filter((model) => {
    const q = searchQuery.trim().toLowerCase()
    const matchesSearch = !q ||
      model.model_name.toLowerCase().includes(q) ||
      model.publisher.toLowerCase().includes(q)
    const matchesPublisher = publisherFilters.length === 0 || publisherFilters.includes(model.publisher)
    const matchesOrigin = originFilters.length === 0 || originFilters.includes(model.origin)
    const matchesWeight = weightFilters.length === 0 || weightFilters.includes(model.weight)
    return matchesSearch && matchesPublisher && matchesOrigin && matchesWeight
  })

  // Detail shows on this page, keyed by ?llm_model_type (as the Agent and MCP
  // registries use ?agent_type / ?mcp_server_type). Pushing the URL lets browser
  // Back return to the grid; an unknown type falls back to the grid.
  const requestedType = searchParams.get('llm_model_type')
  const selectedModel = requestedType ? models.find((m) => String(m.llm_model_type) === requestedType) : undefined
  const viewState = requestedType && (loading || selectedModel) ? 'detail' : 'grid'

  const openModel = (model: RegistryModel) => {
    updateParams({ llm_model_type: String(model.llm_model_type), q: null }, { replace: false })
  }

  const backToGrid = (newSearchQuery?: string) => {
    updateParams({ llm_model_type: null, q: newSearchQuery || null }, { replace: false })
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Brain className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">LLM Model Registry</h1>
          <p className="text-muted-foreground">
            Search LLM models and review their publisher, origin and openness attributes.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {viewState === 'grid' && (
          <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search LLM models..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-9"
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                    onClick={() => setSearchQuery("")}
                    aria-label="Clear search"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
              <CollapsibleTrigger asChild>
                <Button variant="outline">
                  <Filter className="h-4 w-4" />
                  Filters
                  {appliedFilters > 0 && <Badge variant="secondary" className="ml-1">{appliedFilters}</Badge>}
                  {filtersOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent>
              <Card className="mt-4">
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  </div>
                </CardContent>
              </Card>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Search box - shown in detail view (as on the Agent registry) */}
        {viewState === 'detail' && (
          <form key={selectedModel?.id ?? 'loading'} onSubmit={(e) => { e.preventDefault(); const input = e.currentTarget.querySelector('input'); backToGrid(input?.value || ''); }} className="flex items-center gap-2">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search LLM models..."
                defaultValue={selectedModel?.model_name ?? ''}
                className="pl-9"
              />
            </div>
            <Button type="submit" size="sm">Search</Button>
          </form>
        )}

        {viewState === 'grid' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">
                  {searchQuery.trim() || appliedFilters > 0 ? 'Search Results' : 'Models'}
                </h2>
                {!loading && (
                  <Badge variant="secondary">
                    {searchQuery.trim() || appliedFilters > 0
                      ? `${filteredModels.length} of ${models.length}`
                      : `${models.length} total`} Models
                  </Badge>
                )}
              </div>
              <span className="text-sm text-muted-foreground">
                Select a model to view its full attribute profile
              </span>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i}><CardContent className="p-4"><div className="flex gap-3"><Skeleton className="h-10 w-10 rounded-lg" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-2/3" /></div></div></CardContent></Card>
                ))}
              </div>
            ) : error ? (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-3 py-4 rounded-md border">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            ) : filteredModels.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-4 rounded-md border">
                <AlertCircle className="h-4 w-4" />
                <span>No models found matching your search.</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredModels.map((model) => (
                  <Card
                    key={model.id}
                    role="button"
                    tabIndex={0}
                    className="cursor-pointer hover:border-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => openModel(model)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        openModel(model)
                      }
                    }}
                  >
                    <CardContent className="p-4 flex flex-col h-full">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-muted/50 overflow-hidden shrink-0">
                          {model.logo_url ? (
                            <img src={model.logo_url} alt={`${model.model_name} logo`} className="h-8 w-8 object-contain" />
                          ) : (
                            <Brain className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="font-semibold text-base">{model.model_name}</span>
                          {model.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{model.description}</p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Detail view (as on the Agent registry) */}
        {viewState === 'detail' && (loading || !selectedModel ? (
          <Card>
            <CardHeader>
              <Skeleton className="h-8 w-64 mb-4" />
              <Skeleton className="h-10 w-full" />
            </CardHeader>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  {selectedModel.logo_url && (
                    <div className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0">
                      <img src={selectedModel.logo_url} alt={selectedModel.model_name} className="h-6 w-6" />
                    </div>
                  )}
                  <h3 className="text-xl font-semibold">{selectedModel.model_name}</h3>
                  {selectedModel.website && (
                    <a
                      href={selectedModel.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      title="Visit website"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
                {selectedModel.description && (
                  <p className="text-sm text-muted-foreground leading-relaxed">{selectedModel.description}</p>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Model Family</div>
                  <div className="text-sm font-medium text-foreground">{selectedModel.model_family ?? '-'}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Publisher</div>
                  <div className="text-sm font-medium text-foreground">{selectedModel.publisher}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Origin</div>
                  <div className="text-sm font-medium text-foreground">{selectedModel.origin}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Weight</div>
                  <Badge variant={weightVariant(selectedModel.weight)}>{selectedModel.weight}</Badge>
                </div>
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Model Provided By</div>
                  {selectedModel.deployment_types.length ? (
                    <div className="flex flex-wrap gap-1">{selectedModel.deployment_types.map((t) => <Badge key={t} variant="outline">{t}</Badge>)}</div>
                  ) : (
                    <span className="text-sm text-muted-foreground">-</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
