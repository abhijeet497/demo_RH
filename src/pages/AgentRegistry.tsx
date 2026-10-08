import { useState, useEffect, useRef } from "react"
import { orgRpcArgs } from '@/lib/orgScope';
import { useNavigate } from "react-router-dom"
import { useUrlFilterParams, useUrlStringFilter } from "@/hooks/use-url-filters"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Skeleton } from "@/components/ui/skeleton"
import { Users, Filter, TrendingUp, TrendingDown, Equal, Info, AlertCircle, ArrowLeft, ExternalLink, Search, X } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { useOrg } from "@/contexts/OrgContext"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/AuthContext"
import { cn } from "@/lib/utils"
import { getRiskTextColor, getRiskBadge, formatScore, getTrendColor, getTrendText, getTrendArrow, getPlan, AGENT_TYPE_GLEAN, AGENT_PLAN_ENTERPRISE, isValidPlan } from "@/lib/appUtils"

// View states: 'grid' shows the tile grid, 'detail' shows the risk breakdown
type ViewState = 'grid' | 'detail'

// Maximum number of items to display in grid view
const MAX_GRID_ITEMS = 15

export default function AgentRegistries() {
  const { toast } = useToast()
  const { isRegularUser } = useAuth()
  const navigate = useNavigate()
  const { activeOrgId } = useOrg()
  const { searchParams, updateParams } = useUrlFilterParams()
  const hasAttemptedAutoSearch = useRef(false)
  
  // View state: 'grid' shows tiles, 'detail' shows risk breakdown
  const [viewState, setViewState] = useState<ViewState>('grid')
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<any>(null)
  const [frameworkLoading, setFrameworkLoading] = useState(true)
  const [entityDetailsLoading, setEntityDetailsLoading] = useState(false)
  const [noResults, setNoResults] = useState(false)
  // URL-persisted filters. `plan` follows the standard: default '1' is omitted
  // from the URL, absence means '1' (inbound ?plan=<p> deep links still apply).
  const [planParam, setPlanFilter] = useUrlStringFilter('plan', '1')
  // Invalid deep-link plans fall back to '1' rather than reaching the RPC as NaN.
  const planFilter = isValidPlan(planParam) ? planParam : '1'
  const [performanceFilter, setPerformanceFilter] = useUrlStringFilter('performance', 'all')
  const [entityNames, setEntityNames] = useState<Array<{name: string, type: number, description: string | null, website: string | null, logo_url: string | null}>>([])
  const [frameworkId, setFrameworkId] = useState<string | null>(null)
  const [selectedAgentType, setSelectedAgentType] = useState<number | null>(null)
  const sourceAgent = searchParams.get('source_agent')

  const updateUrlParams = (agentType: number, plan?: string) => {
    // Merge-style: only touch the keys this transition owns (agent_type, q, and
    // optionally plan) so other filters (performance) and source_agent survive.
    // Write every key in ONE call — the URL hook clobbers multiple setters fired in
    // the same event (see use-url-filters.ts).
    updateParams(
      { agent_type: agentType.toString(), q: null, ...(plan !== undefined ? { plan } : {}) },
      { replace: false },
    )
  }

  // Handle clicking on an agent tile to go to detail view
  const handleSelectAgent = (entity: typeof entityNames[0]) => {
    setSearchQuery(entity.name)
    setSelectedAgentType(entity.type)
    setViewState('detail')
    // Glean is enterprise-only and its risk framework/baseline lives at Enterprise(2);
    // enter its detail view there (not the default plan) so its data is shown. Write
    // agent_type + plan together in a single URL update to avoid clobbering.
    const isGlean = entity.type === AGENT_TYPE_GLEAN
    const entryPlan = isGlean ? AGENT_PLAN_ENTERPRISE : parseInt(planFilter)
    updateUrlParams(entity.type, isGlean ? String(AGENT_PLAN_ENTERPRISE) : undefined)
    performSearch(entity.name, entity.type, entryPlan)
  }

  // Handle going back to grid view
  const handleBackToGrid = (newSearchQuery?: string) => {
    setViewState('grid')
    setSearchResults(null)
    setSelectedAgentType(null)
    setNoResults(false)
    // Merge-style: only touch the keys this transition owns (agent_type, q).
    // Filters intentionally persist across back-to-grid.
    updateParams({ agent_type: null, q: newSearchQuery || null }, { replace: false })
  }

  useEffect(() => {
    loadFramework()
  }, [activeOrgId])

  useEffect(() => {
    if (frameworkId) {
      loadEntityNames()
    }
  }, [frameworkId])

  // Handle URL params - when agent_type is in URL, go directly to detail view
  useEffect(() => {
    const agentType = searchParams.get('agent_type')
    // Absent plan means the default ('1') — the standard omits default values
    // from the URL, so auto-search must not require the param to exist.
    const rawPlan = searchParams.get('plan') ?? '1'
    const plan = isValidPlan(rawPlan) ? rawPlan : '1'
    const searchFromUrl = searchParams.get('q')
    
    // Reset state when navigating to page without agent_type param
    if (!agentType) {
      // If there's a search query in URL, use it; otherwise clear
      setSearchQuery(searchFromUrl || "")
      setSearchResults(null)
      setSelectedAgentType(null)
      setNoResults(false)
      setViewState('grid')
      hasAttemptedAutoSearch.current = false
      return
    }
    
    if (
      agentType &&
      frameworkId &&
      entityNames.length > 0 &&
      !hasAttemptedAutoSearch.current
    ) {
      const selectedEntity = entityNames.find(e => e.type === parseInt(agentType))
      if (selectedEntity) {
        hasAttemptedAutoSearch.current = true
        setSearchQuery(selectedEntity.name)
        setSelectedAgentType(selectedEntity.type)
        setViewState('detail')
        // Glean's framework/baseline lives at Enterprise(2); enter there regardless of
        // the URL plan so its data is shown (score-click deep links already pass 2).
        const entryPlan = selectedEntity.type === AGENT_TYPE_GLEAN ? AGENT_PLAN_ENTERPRISE : parseInt(plan)
        if (selectedEntity.type === AGENT_TYPE_GLEAN && plan !== String(AGENT_PLAN_ENTERPRISE)) {
          setPlanFilter(String(AGENT_PLAN_ENTERPRISE))
        }
        performSearch(selectedEntity.name, selectedEntity.type, entryPlan)
      }
    }
  }, [searchParams, entityNames, frameworkId])

  const performSearch = async (entityName: string, entityType: number, planOverride?: number) => {
    if (!frameworkId) return
    
    setEntityDetailsLoading(true)
    setNoResults(false)
    try {
      // Query the plan carried in the URL/state as-is. For Glean this is Enterprise(2),
      // set at the entry points (deep-link + grid) — exactly where its global risk
      // framework/baseline lives — so no display/stored translation is needed here.
      const plan = planOverride !== undefined ? planOverride : parseInt(planFilter)
      const { data, error } = await supabase.rpc('get_agent_risk_framework_with_scores', {
        ...orgRpcArgs(activeOrgId), // scope scores to the ACTIVE org (subsidiary-aware)
        p_framework_id: frameworkId,
        p_agent_type: entityType,
        p_plan: plan
      })

      if (error) throw error

      if (data && data.length > 0) {
        const baselineScoresArray = data
          .map((row: any) => row.baseline_score)
          .filter((score: any): score is number => score !== null && score !== undefined)
        const overallScore = baselineScoresArray.length > 0 
          ? formatScore(baselineScoresArray.reduce((sum: number, score: number) => sum + score, 0) / baselineScoresArray.length)
          : null
        
        // Regular users only see baseline data — never compute or retain
        // org-level "Actual" scores client-side (would otherwise be readable
        // via devtools/state inspection even though the UI hides them).
        const actualScoresArray = isRegularUser
          ? []
          : data
              .map((row: any) => row.actual_score)
              .filter((score: any): score is number => score !== null && score !== undefined)
        const actualOverallScore = actualScoresArray.length > 0
          ? formatScore(actualScoresArray.reduce((sum: number, score: number) => sum + score, 0) / actualScoresArray.length)
          : null
        
        if (overallScore === null && actualOverallScore === null) {
          setSearchResults(null)
          setNoResults(true)
          return
        }

        const groupedItems = data.reduce((acc: any, row: any) => {
          const item = {
            id: row.framework_rule_id,
            rule_name: row.rule_name,
            scoring_criteria: row.scoring_criteria,
            baseline_score: formatScore(row.baseline_score),
            actual_score: isRegularUser ? null : formatScore(row.actual_score),
            baseline_rationale: row.baseline_rationale
          }
          
          if (!acc[row.category_name]) {
            acc[row.category_name] = []
          }
          acc[row.category_name].push(item)
          return acc
        }, {})

        const selectedEntity = entityNames.find(e => e.name === entityName)
        setSearchResults({
          entity_name: entityName,
          entity_description: selectedEntity?.description,
          entity_website: selectedEntity?.website,
          entity_logo_url: selectedEntity?.logo_url,
          groupedItems,
          overallScore,
          actualOverallScore
        })
        setNoResults(false)
      } else {
        setSearchResults(null)
        setNoResults(true)
      }
    } catch (error) {
      console.error('Error searching agent:', error)
      toast({
        title: "Error",
        description: "Failed to load agent risk scores",
        variant: "destructive",
      })
      setSearchResults(null)
    } finally {
      setEntityDetailsLoading(false)
    }
  }

  const handleSearch = async (entityName: string, entityType: number) => {
    return performSearch(entityName, entityType)
  }

  const handlePlanClick = (plan: string) => {
    setPlanFilter(plan)
    if (selectedAgentType !== null) {
      const e = entityNames.find(x => x.type === selectedAgentType)
      if (e) performSearch(e.name, e.type, parseInt(plan))
    }
  }

  const loadFramework = async () => {
    try {
      setFrameworkLoading(true)
      const { data, error } = await supabase
        .from('risk_framework' as any)
        .select('id')
        .eq('org_id', activeOrgId!)
        .eq('entity_type', 1)
        .eq('name', 'Default Agent Risk Framework')
        .maybeSingle()

      if (error) throw error
      if (data) {
        setFrameworkId((data as any).id)
      }
    } catch (error) {
      console.error('Error loading agent framework:', error)
      toast({
        title: "Error",
        description: "Failed to load agent framework",
        variant: "destructive",
      })
    } finally {
      setFrameworkLoading(false)
    }
  }

  const loadEntityNames = async () => {
    try {
      const { data, error } = await supabase
        .from('agent_catalog')
        .select('agent_name, agent_type, description, website, logo_url')
        .order('agent_type', { ascending: true })
        .order('agent_name', { ascending: true })

      if (error) throw error
      
      const entities = (data || []).map((item: any) => ({
        name: item.agent_name,
        type: item.agent_type,
        description: item.description,
        website: item.website,
        logo_url: item.logo_url
      }))
      setEntityNames(entities)
    } catch (error) {
      console.error('Error loading agent names:', error)
      toast({
        title: "Error",
        description: "Failed to load agent list",
        variant: "destructive",
      })
    }
  }

  const getFilteredAttributes = (items: any[]) => {
    if (performanceFilter === 'all') return items
    
    return items.filter(item => {
      if (item.baseline_score === null || item.baseline_score === undefined) return false
      if (item.actual_score === null || item.actual_score === undefined) return false
      
      if (performanceFilter === 'better') {
        return item.actual_score < item.baseline_score
      } else if (performanceFilter === 'worse') {
        return item.actual_score > item.baseline_score
      } else if (performanceFilter === 'same') {
        return item.actual_score === item.baseline_score
      }
      
      return true
    })
  }

  const handleBackToSource = () => {
    if (sourceAgent) {
      navigate(`/agents/${sourceAgent}`)
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {sourceAgent && (
        <Button variant="ghost" onClick={handleBackToSource}>
          <ArrowLeft className="h-4 w-4" />
          Back to Agent Details
        </Button>
      )}
      
      <div className="flex items-center gap-3">
        <Users className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">AI Agent Registry</h1>
          <p className="text-muted-foreground">
            Search and view risk scores for AI agents.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Search - only shown in grid view */}
        {viewState === 'grid' && (
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={frameworkLoading ? "Loading..." : "Search agents..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={frameworkLoading || entityNames.length === 0}
              className="pl-9 pr-9"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                onClick={() => setSearchQuery("")}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}

        {/* Search box - shown in detail view */}
        {viewState === 'detail' && (
          <form onSubmit={(e) => { e.preventDefault(); const input = e.currentTarget.querySelector('input'); handleBackToGrid(input?.value || ''); }} className="flex items-center gap-2">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search agents..."
                defaultValue={searchQuery}
                className="pl-9"
              />
            </div>
            <Button type="submit" size="sm">Search</Button>
          </form>
        )}

        {/* Plan filter in detail view */}
        {viewState === 'detail' && (
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Plan:</span>
            <div className="flex gap-2">
              <Button variant={planFilter === '1' ? 'default' : 'outline'} size="sm" onClick={() => handlePlanClick('1')}>Personal</Button>
              <Button variant={planFilter === '3' ? 'default' : 'outline'} size="sm" onClick={() => handlePlanClick('3')}>Small Business</Button>
              <Button variant={planFilter === '2' ? 'default' : 'outline'} size="sm" onClick={() => handlePlanClick('2')}>Enterprise</Button>
              <Button variant={planFilter === '0' ? 'default' : 'outline'} size="sm" onClick={() => handlePlanClick('0')}>Unspecified</Button>
            </div>
          </div>
        )}

        {noResults && viewState === 'detail' && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md border border-red-200">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <span className="font-medium">
              No results found for "{searchQuery}" in {getPlan(parseInt(planFilter))} plan
            </span>
          </div>
        )}

        {entityDetailsLoading && (
          <Card>
            <CardHeader>
              <Skeleton className="h-8 w-64 mb-4" />
              <Skeleton className="h-10 w-full" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Grid view - show agents grid with search */}
        {viewState === 'grid' && !entityDetailsLoading && entityNames.length > 0 && (() => {
          const totalAgentCount = entityNames.length
          const filteredEntities = entityNames.filter(e => {
            if (!searchQuery.trim()) return true
            return e.name.toLowerCase().includes(searchQuery.toLowerCase())
          })
          
          return (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold">{searchQuery.trim() ? 'Search Results' : 'Popular Agents'}</h2>
                  <Badge variant="secondary">{searchQuery.trim() ? `${filteredEntities.length} of ${totalAgentCount}` : `${totalAgentCount} total`} Agents</Badge>
                </div>
                <span className="text-sm text-muted-foreground">
                  Select an Agent to view its risk profile
                </span>
              </div>
              
              {filteredEntities.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-4 rounded-md border">
                  <AlertCircle className="h-4 w-4" />
                  <span>No agents found matching your search.</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredEntities
                    .slice(0, MAX_GRID_ITEMS)
                    .map((entity) => (
                    <Card 
                      key={entity.name}
                      className="cursor-pointer hover:border-primary transition-colors"
                      onClick={() => handleSelectAgent(entity)}
                    >
                      <CardContent className="p-4 flex flex-col h-full">
                        <div className="flex items-start gap-3 flex-1">
                          {entity.logo_url && (
                            <img 
                              src={entity.logo_url} 
                              alt={entity.name} 
                              className="h-10 w-10 object-contain flex-shrink-0" 
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <span className="font-semibold text-base">{entity.name}</span>
                            {entity.description && (
                              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                                {entity.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )
        })()}

        {/* Detail view - show risk breakdown */}
        {viewState === 'detail' && !entityDetailsLoading && searchResults && (
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    {searchResults.entity_logo_url && (
                      <div className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0">
                        <img src={searchResults.entity_logo_url} alt={searchResults.entity_name} className="h-6 w-6" />
                      </div>
                    )}
                    <h3 className="text-xl font-semibold">{searchResults.entity_name}</h3>
                    {searchResults.entity_website && (
                      <a 
                        href={searchResults.entity_website} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        title="Visit website"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                  {searchResults.entity_description && (
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {searchResults.entity_description}
                    </p>
                  )}
                </div>
                
                <div className="flex items-center gap-6">
                  <div className="flex flex-col items-center gap-1 px-4 py-2 bg-muted/50 rounded-lg">
                    <span className="text-xs text-muted-foreground uppercase tracking-wide">Baseline</span>
                    {searchResults.overallScore !== null ? (
                      <div className="flex items-center gap-2">
                        {getRiskBadge(searchResults.overallScore)}
                        <span className={`text-2xl font-bold ${getRiskTextColor(searchResults.overallScore)}`}>
                          {searchResults.overallScore}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">N/A</span>
                    )}
                  </div>
                  
                  {!isRegularUser && (
                    <div className="flex flex-col items-center gap-1 px-4 py-2 bg-muted/50 rounded-lg">
                      <span className="text-xs text-muted-foreground uppercase tracking-wide">Actual</span>
                      {searchResults.actualOverallScore !== null ? (
                        <div className="flex items-center gap-2">
                          {getRiskBadge(searchResults.actualOverallScore)}
                          <span className={`text-2xl font-bold ${getRiskTextColor(searchResults.actualOverallScore)}`}>
                            {searchResults.actualOverallScore}
                          </span>
                          {searchResults.overallScore !== null && (
                            <span className={`text-lg ${getTrendColor(searchResults.actualOverallScore, searchResults.overallScore)}`}>
                              {searchResults.actualOverallScore === searchResults.overallScore ? (
                                <Equal className="h-5 w-5" />
                              ) : (
                                getTrendArrow(searchResults.actualOverallScore, searchResults.overallScore)
                              )}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">N/A</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {planFilter === '0' && (
                <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
                  <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <AlertDescription className="text-blue-900 dark:text-blue-100">
                    Using Personal plan baseline scores as reference
                  </AlertDescription>
                </Alert>
              )}
              
              {/* Filter compares Actual vs Baseline, so it's meaningless
                  (and would leak derived Actual data) for regular users. */}
              {!isRegularUser && (
              <div className="flex items-center justify-between gap-4 py-2 border-y">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Filter:</span>
                  <div className="flex gap-1">
                    <Button
                      variant={performanceFilter === 'all' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPerformanceFilter('all')}
                      className="h-7 px-2"
                    >
                      All
                    </Button>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant={performanceFilter === 'better' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setPerformanceFilter('better')}
                            className="h-7 w-7 p-0"
                          >
                            <TrendingDown className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Better than baseline</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant={performanceFilter === 'worse' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setPerformanceFilter('worse')}
                            className="h-7 w-7 p-0"
                          >
                            <TrendingUp className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Worse than baseline</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant={performanceFilter === 'same' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setPerformanceFilter('same')}
                            className="h-7 w-7 p-0"
                          >
                            <Equal className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Same as baseline</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  {(() => {
                    const allItems = Object.values(searchResults.groupedItems).flat()
                    const totalItems = allItems.length
                    const filteredItems = getFilteredAttributes(allItems as any[]).length
                    return `${filteredItems} / ${totalItems} attributes`
                  })()}
                </div>
              </div>
              )}

              <div className="space-y-6">
                {Object.entries(searchResults.groupedItems).map(([category, items]) => {
                  const filteredItems = getFilteredAttributes(items as any[])
                  if (filteredItems.length === 0) return null
                  
                  return (
                    <div key={category} className="space-y-3">
                      <Badge variant="default" className="font-medium">
                        {category}
                      </Badge>
                      
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[200px]">Attribute</TableHead>
                            <TableHead className="w-[100px]">
                              <div className="inline-flex items-center gap-1">
                                <span>Baseline</span>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-xs">
                                      <p className="text-sm">Baseline scores represent the inherent risk level of the agent</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                            </TableHead>
                            {!isRegularUser && (
                              <TableHead className="w-[100px]">
                                <div className="inline-flex items-center gap-1">
                                  <span>Actual</span>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-xs">
                                        <p className="text-sm">Actual scores are calculated across all instances of the agent in your organization</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>
                              </TableHead>
                            )}
                            <TableHead>Scoring Criteria</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredItems.map((item, index) => {
                            const isBaselineNull = item.baseline_score === null || item.baseline_score === undefined
                            const isActualNull = item.actual_score === null || item.actual_score === undefined
                            return (
                              <TableRow key={index}>
                                <TableCell className="font-medium">{item.rule_name}</TableCell>
                                <TableCell>
                                  {item.baseline_rationale ? (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className={`font-semibold underline decoration-dotted underline-offset-4 cursor-help hover:opacity-80 transition-opacity ${isBaselineNull ? 'text-muted-foreground' : getRiskTextColor(item.baseline_score)}`}>
                                            {isBaselineNull ? 'N/A' : item.baseline_score}
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent className="max-w-sm">
                                          <p className="text-sm whitespace-normal">{item.baseline_rationale}</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  ) : (
                                    <span className={`font-semibold ${isBaselineNull ? 'text-muted-foreground' : getRiskTextColor(item.baseline_score)}`}>
                                      {isBaselineNull ? 'N/A' : item.baseline_score}
                                    </span>
                                  )}
                                </TableCell>
                                {!isRegularUser && (
                                  <TableCell>
                                    {!isActualNull ? (
                                      <div className="flex items-center gap-1.5">
                                        <span className={`font-semibold ${getRiskTextColor(item.actual_score)}`}>
                                          {item.actual_score}
                                        </span>
                                        {getTrendArrow(item.actual_score, item.baseline_score) && (
                                          <span className={`text-xs ${getTrendColor(item.actual_score, item.baseline_score)}`}>
                                            {getTrendArrow(item.actual_score, item.baseline_score)}
                                          </span>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-muted-foreground">N/A</span>
                                    )}
                                  </TableCell>
                                )}
                                <TableCell className="text-sm text-muted-foreground">{item.scoring_criteria}</TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
