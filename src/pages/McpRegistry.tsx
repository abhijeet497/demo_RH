import { useState, useEffect, useRef, useMemo } from "react"
import { orgRpcArgs } from '@/lib/orgScope';
import { useNavigate } from "react-router-dom"
import { useUrlFilterParams, useUrlStringFilter, useUrlArrayFilter } from "@/hooks/use-url-filters"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Skeleton } from "@/components/ui/skeleton"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { MultiSelect } from "@/components/ui/multi-select"
import { Network, Shield, Filter, TrendingUp, TrendingDown, Equal, Info, AlertCircle, ArrowLeft, ExternalLink, ChevronDown, ChevronUp, Search, X, Send, Clock, ShieldAlert, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AdvisoryLink } from "@/components/AdvisoryLink"
import { format } from "date-fns"
import { useAuth } from "@/contexts/AuthContext"
import { supabase } from "@/integrations/supabase/client"
import { traceforcApi } from "@/integrations/traceforce/client"
import { useOrg } from "@/contexts/OrgContext"
import { useToast } from "@/hooks/use-toast"
import { transformMcpName } from "@/lib/utils"
import { getRiskTextColor, getRiskBadge, formatScore, getTrendColor, getTrendText, getTrendArrow, MCP_SOURCE_TYPE_FILTER_OPTIONS, isBrowserAppConnectorSourceType, getMcpSourceTypeBadge } from "@/lib/appUtils"
import RequestMcpAccessDialog from "@/components/RequestMcpAccessDialog"
import { McpToolsCard } from "@/components/McpToolsCard"
import { useMyMcpVerdicts, useMyMcpRequests } from "@/hooks/use-mcp-access"
import { friendlyLoadError } from "@/lib/api-errors"
import type { McpAuthType, McpCatalogDto, McpSourceType } from "@/integrations/traceforce/types"

// View states: 'grid' shows the tile grid, 'detail' shows the risk breakdown
type ViewState = 'grid' | 'detail'

/** The green "Allowed" badge (grid cards and detail view). */
const allowedBadgeClass = "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-700"

// Maximum number of items to display in grid view
const MAX_GRID_ITEMS = 15
// The catalog's "Custom" placeholder: never shown as a tile or counted.
const CUSTOM_MCP_SERVER_TYPE = 999999999
// Wait this long after the last keystroke before searching the server.
const SEARCH_DEBOUNCE_MS = 300

// Regular users see only what access policies can govern. ChatGPT / Claude
// browser-app connectors run inside those apps, not on a device, so there is
// nothing to request or approve — the user catalog leaves them out entirely
// (grid, counts, search, deep links; the Source picker doesn't offer them).
// The API filters sources by inclusion, so a user's unfiltered grid asks for
// every other source; entries with no known source (null) are left out too.
// Admins keep the full registry: they manage those entries even though
// access doesn't apply.
const USER_VISIBLE_SOURCE_TYPES = MCP_SOURCE_TYPE_FILTER_OPTIONS.map((o) => o.value as McpSourceType).filter(
  (v) => !isBrowserAppConnectorSourceType(v),
)

type CatalogEntity = {
  name: string
  display_name: string
  type: number
  source_type: McpSourceType | null
  description: string | null
  website: string | null
  logo_url: string | null
  authentication_methods: McpAuthType[] | null
}

const toCatalogEntity = (item: McpCatalogDto): CatalogEntity => ({
  name: item.mcp_server_name,
  display_name: transformMcpName(item.mcp_server_name),
  type: item.mcp_server_type,
  source_type: item.source_type ?? 'community',
  description: item.description,
  website: item.website,
  logo_url: item.logo_url,
  authentication_methods: item.authentication_methods,
})

// Fallback entity resolver: when the catalog API is unreachable (e.g. a UI-only
// preview with no backend) resolve the connector straight from mcp_catalog so the
// detail still renders its header, supabase-backed risk scores, and vulnerabilities
// instead of bouncing to an empty grid. source_type/auth badges are left off here
// because the table stores them as numeric codes the API normally maps to labels.
const resolveEntityFromCatalog = async (type: number): Promise<CatalogEntity | null> => {
  const { data, error } = await supabase
    .from('mcp_catalog')
    .select('mcp_server_name, mcp_server_type, description, website, logo_url')
    .eq('mcp_server_type', type)
    .maybeSingle()
  if (error || !data) return null
  return {
    name: data.mcp_server_name,
    display_name: transformMcpName(data.mcp_server_name),
    type: data.mcp_server_type,
    source_type: null,
    description: data.description,
    website: data.website,
    logo_url: data.logo_url,
    authentication_methods: null,
  }
}

const AUTH_METHOD_LABELS: Record<McpAuthType, string> = {
  basic_auth: "Password",
  token: "Token",
  oauth: "OAuth",
  no_auth: "None",
}

const getAuthMethodLabel = (method: McpAuthType | string) =>
  AUTH_METHOD_LABELS[method as McpAuthType] || "Unknown"

const SEVERITY_BADGE_VARIANT: Record<string, "destructive" | "warning" | "success"> = {
  Error: "destructive",
  Warning: "warning",
  Note: "success",
}

function severityLabel(severity: string): string {
  const s = (severity || "").toLowerCase()
  if (s === "error") return "Error"
  if (s === "warning") return "Warning"
  if (s === "note") return "Note"
  return severity || "—"
}

/** Severity order for sorting: Error < Warning < Note */
const SEVERITY_SORT_ORDER: Record<string, number> = { Error: 0, Warning: 1, Note: 2 }

/** Returns the first complete sentence (up to first . ! or ?), or the whole message if short. */
function firstCompleteSentence(msg: string): string {
  const trimmed = msg.trim()
  if (!trimmed) return trimmed
  const match = trimmed.match(/^[^.!?]*[.!?]/)
  if (match) return match[0].trim()
  if (trimmed.length <= 120) return trimmed
  const atWord = trimmed.slice(0, 120).match(/^.*\s/)?.[0]?.trim() ?? trimmed.slice(0, 120)
  return `${atWord}…`
}

export default function McpRegistries() {
  const { toast } = useToast()
  const { isRegularUser, session } = useAuth()
  const navigate = useNavigate()
  const { activeOrgId } = useOrg()
  // Access badges are a regular-user concept (all render points are
  // isRegularUser-gated below) — don't fire the fetch for admins.
  // Verdicts, not just the allow set: the chrome tells blocked (requestable or
  // already requested) from allowed (including ungoverned).
  const { byMcp: myVerdicts, loading: verdictsLoading, error: verdictsError, refetch: refetchVerdicts } = useMyMcpVerdicts(isRegularUser)
  // The caller's own requests — used to tell an already-requested blocked
  // connector (shows "Requested") from one still worth a button. Regular-user only.
  const { data: myRequests, loading: requestsLoading, error: requestsError, refetch: refetchRequests } = useMyMcpRequests(isRegularUser)
  const { searchParams, updateParams } = useUrlFilterParams()
  const hasAttemptedAutoSearch = useRef(false)
  // Guards the grid-reset branch of the searchParams effect below. Filter
  // setters now write the URL, which re-fires that effect; without this guard a
  // filter change in grid view would re-run the reset and clobber the typed
  // search query.
  const hasResetGridState = useRef(false)

  // View state: 'grid' shows tiles, 'detail' shows risk breakdown
  // A deep link opens straight into the detail view (no wasted grid request).
  const [viewState, setViewState] = useState<ViewState>(() =>
    searchParams.has('mcp_server_type') ? 'detail' : 'grid',
  )
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedEntityName, setSelectedEntityName] = useState("")
  const [searchResults, setSearchResults] = useState<any>(null)
  const [frameworkLoading, setFrameworkLoading] = useState(true)
  const [entityDetailsLoading, setEntityDetailsLoading] = useState(false)
  const [noResults, setNoResults] = useState(false)
  // URL-persisted filters (survive grid↔detail transitions and navigation)
  const [performanceFilter, setPerformanceFilter] = useUrlStringFilter('performance', 'all')
  // Multi-select filters use string ids (same pattern as Mcps.tsx); empty = all
  const [sourceTypeFilter, setSourceTypeFilter] = useUrlArrayFilter('sourceType')
  const [filtersOpen, setFiltersOpen] = useState(false)
  /** Access filter ids: "allowed" | "blocked"; empty = all. */
  const [approvalStatusFilter, setApprovalStatusFilter] = useUrlArrayFilter('approvalStatus')
  const [requestDialogOpen, setRequestDialogOpen] = useState(false)
  // The grid is searched and filtered on the server, one page at a time: the
  // catalog has thousands of entries and the grid shows MAX_GRID_ITEMS.
  // gridResult is one response: its tiles, its total, and whether it was a
  // search / filtered, so the heading and badge never mix two requests.
  const [gridResult, setGridResult] = useState<{
    entities: CatalogEntity[]
    total: number | null
    searched: boolean
    filtered: boolean
  } | null>(null)
  const [catalogTotal, setCatalogTotal] = useState<number | null>(null)
  const catalogTotalRef = useRef<number | null>(null)
  const [gridLoading, setGridLoading] = useState(false)
  const [debouncedSearch, setDebouncedSearch] = useState("")
  // Sets the search box and the server search together, for searches set by
  // code (back to grid, ?q=, entering a detail view): no 300ms window where
  // the grid would search the previous text.
  const setSearchNow = (value: string) => {
    setSearchQuery(value)
    setDebouncedSearch(value.trim())
  }
  // The deep-link type in the URL right now, so a late lookup can tell it
  // was superseded (Back, another tile).
  const urlTypeRef = useRef<string | null>(null)
  urlTypeRef.current = searchParams.get('mcp_server_type')
  const [frameworkId, setFrameworkId] = useState<string | null>(null)
  const [selectedMcpServerType, setSelectedMcpServerType] = useState<number | null>(null)
  const [vulnerabilities, setVulnerabilities] = useState<Array<{
    id: string
    rule_id: string
    severity: string
    message: string | null
    mcp_tool_name: string
    created_at: string
    vuln_rules: { case_id: string; vulnerability_type: string | null; description: string | null } | null
    mcp_catalog: { mcp_server_name: string; logo_url: string | null } | null
    advisory_id: string | null
    advisory_published: boolean
    // SARIF result properties; carries advisoryUrl for an advisory that is
    // public somewhere other than the global database.
    mcp_tool_input: { advisoryUrl?: string } | null
  }>>([])
  const [vulnerabilitiesLoading, setVulnerabilitiesLoading] = useState(false)
  const [vulnerabilitySortColumn, setVulnerabilitySortColumn] = useState<'mcp_tool_name' | 'severity' | 'first_seen' | 'last_seen'>('mcp_tool_name')
  const [vulnerabilitySortDir, setVulnerabilitySortDir] = useState<'asc' | 'desc'>('asc')
  const [vulnFilterVulnerability, setVulnFilterVulnerability] = useState<string>('All')
  const [vulnFilterToolName, setVulnFilterToolName] = useState<string>('All')
  const [vulnFilterSeverity, setVulnFilterSeverity] = useState<string>('All Severities')
  const sourceMcp = searchParams.get('source_mcp')

  const handleVulnerabilitySort = (column: 'mcp_tool_name' | 'severity' | 'first_seen' | 'last_seen') => {
    if (vulnerabilitySortColumn === column) {
      setVulnerabilitySortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setVulnerabilitySortColumn(column)
      setVulnerabilitySortDir('asc')
    }
  }

  const vulnerabilityFilterOptions = useMemo(() => {
    const types = new Set<string>()
    vulnerabilities.forEach((v) => {
      const label = v.vuln_rules?.vulnerability_type ?? v.vuln_rules?.case_id ?? v.rule_id ?? ''
      if (label) types.add(label)
    })
    return Array.from(types).sort()
  }, [vulnerabilities])

  const toolNameFilterOptions = useMemo(() => {
    const names = new Set<string>()
    vulnerabilities.forEach((v) => {
      const name = v.mcp_tool_name?.trim() || '—'
      if (name) names.add(name)
    })
    return Array.from(names).sort((a, b) => (a === '—' ? 1 : b === '—' ? -1 : a.localeCompare(b)))
  }, [vulnerabilities])

  const filteredAndSortedVulnerabilities = useMemo(() => {
    let list = vulnerabilities.filter((v) => {
      if (vulnFilterVulnerability !== 'All') {
        const label = v.vuln_rules?.vulnerability_type ?? v.vuln_rules?.case_id ?? v.rule_id ?? ''
        if (label !== vulnFilterVulnerability) return false
      }
      if (vulnFilterToolName !== 'All') {
        const name = v.mcp_tool_name?.trim() || '—'
        if (name !== vulnFilterToolName) return false
      }
      if (vulnFilterSeverity !== 'All Severities') {
        if (severityLabel(v.severity) !== vulnFilterSeverity) return false
      }
      return true
    })
    const dir = vulnerabilitySortDir === 'asc' ? 1 : -1
    list = [...list]
    list.sort((a, b) => {
      if (vulnerabilitySortColumn === 'mcp_tool_name') {
        const sa = (a.mcp_tool_name || '').toLowerCase()
        const sb = (b.mcp_tool_name || '').toLowerCase()
        return dir * (sa < sb ? -1 : sa > sb ? 1 : 0)
      }
      if (vulnerabilitySortColumn === 'severity') {
        const sa = SEVERITY_SORT_ORDER[severityLabel(a.severity)] ?? 99
        const sb = SEVERITY_SORT_ORDER[severityLabel(b.severity)] ?? 99
        return dir * (sa - sb)
      }
      if (vulnerabilitySortColumn === 'first_seen' || vulnerabilitySortColumn === 'last_seen') {
        const ta = a.created_at ? new Date(a.created_at).getTime() : 0
        const tb = b.created_at ? new Date(b.created_at).getTime() : 0
        return dir * (ta - tb)
      }
      return 0
    })
    return list
  }, [vulnerabilities, vulnFilterVulnerability, vulnFilterToolName, vulnFilterSeverity, vulnerabilitySortColumn, vulnerabilitySortDir])

  /** Load vulnerabilities for the selected MCP using mcp_catalog_id (resolved from mcp_server_type). */
  const loadVulnerabilitiesForMcp = async (mcpServerType: number) => {
    setVulnerabilitiesLoading(true)
    setVulnerabilities([])
    try {
      const { data: cat } = await supabase
        .from('mcp_catalog')
        .select('id')
        .eq('mcp_server_type', mcpServerType)
        .maybeSingle()
      if (!cat?.id) {
        setVulnerabilities([])
        return
      }
      const { data, error } = await supabase
        .from('vuln_baseline_findings')
        .select('id, rule_id, severity, message, mcp_tool_name, created_at, advisory_id, advisory_published, mcp_tool_input, vuln_rules ( case_id, vulnerability_type, description ), mcp_catalog ( mcp_server_name, logo_url )')
        .eq('mcp_catalog_id', (cat as { id: string }).id)
        .order('created_at', { ascending: false })
      if (error) {
        setVulnerabilities([])
        return
      }
      setVulnerabilities((data ?? []) as unknown as typeof vulnerabilities)
    } catch {
      setVulnerabilities([])
    } finally {
      setVulnerabilitiesLoading(false)
    }
  }

  // Chrome states, keyed on the caller's EFFECTIVE verdict + their own pending
  // requests. Exactly one shows:
  //   verdict 1 → "Allowed" badge;
  //   verdict 2/3 with no pending request → Blocked badge + "Request access"
  //     button (the ONLY state with a button; one request covers every
  //     blocking scope);
  //   verdict 2/3 with a pending request → Blocked badge + "Requested";
  //   absent (ungoverned) → "Allowed": nothing governs this MCP for the
  //     user, so there's nothing to request (the API rejects such asks).
  const selectedVerdict =
    selectedMcpServerType != null ? myVerdicts.get(selectedMcpServerType) : undefined
  const hasApprovedAccess = selectedVerdict?.verdict === 1
  const isBlocked = selectedVerdict?.verdict === 2 || selectedVerdict?.verdict === 3
  const hasPendingRequest = useMemo(
    () =>
      selectedMcpServerType != null &&
      myRequests.some((r) => r.mcp_server_type === selectedMcpServerType && r.status === 1),
    [myRequests, selectedMcpServerType],
  )
  const isRequestable = isBlocked && !hasPendingRequest
  const isPending = isBlocked && hasPendingRequest

  // Grid cards show the caller's status like the detail view: Blocked (verdict
  // 2/3; value = whether they already have a pending request) or Allowed
  // (everything else, incl. connectors no access policy covers).
  const blockedMcpTypes = useMemo(() => {
    const pending = new Set(myRequests.filter((r) => r.status === 1).map((r) => r.mcp_server_type))
    return new Map(
      [...myVerdicts.values()]
        .filter((v) => v.verdict === 2 || v.verdict === 3)
        .map((v) => [v.mcp_server_type, pending.has(v.mcp_server_type)]),
    )
  }, [myVerdicts, myRequests])

  // Access filter, resolved on the server from the caller's own access:
  // allowed (including connectors no access policy covers, which the detail
  // view also shows as Allowed) / blocked. Regular users only: the control is
  // hidden for admins, so a shared URL can't strand them on it.
  const accessStatusKey = isRegularUser
    ? approvalStatusFilter.filter((v) => v === "allowed" || v === "blocked").join(",")
    : ""
  // Only source values the API knows (a hand-edited URL would 400 the page),
  // and for regular users none their picker doesn't offer (browser apps).
  const sourceTypeKey = sourceTypeFilter
    .filter((v) => MCP_SOURCE_TYPE_FILTER_OPTIONS.some((o) => o.value === v))
    .filter((v) => !isRegularUser || !isBrowserAppConnectorSourceType(v as McpSourceType))
    .join(",")
  
  const updateUrlParams = (mcpServerType: number) => {
    // Merge-style: only touch the keys this transition owns (mcp_server_type,
    // q) so filter params and source_mcp survive entering the detail view.
    updateParams({ mcp_server_type: mcpServerType.toString(), q: null }, { replace: false })
  }

  // Handle clicking on an MCP tile to go to detail view
  const handleSelectMcp = (entity: CatalogEntity) => {
    // The URL effect must not look this entry up again (handleSearch loads it).
    hasAttemptedAutoSearch.current = true
    setSearchNow(entity.display_name)
    setSelectedEntityName(entity.name)
    setSelectedMcpServerType(entity.type)
    setViewState('detail')
    updateUrlParams(entity.type)
    handleSearch(entity)
  }

  // Handle going back to grid view with optional search query
  const handleBackToGrid = (newSearchQuery?: string) => {
    setSearchNow(newSearchQuery || "")
    setViewState('grid')
    setSearchResults(null)
    setSelectedEntityName("")
    setSelectedMcpServerType(null)
    setNoResults(false)
    // Merge-style: only touch the keys this transition owns (mcp_server_type,
    // q). Filter params live in the URL and persist across back-to-grid.
    updateParams({ mcp_server_type: null, q: newSearchQuery || null }, { replace: false })
  }

  useEffect(() => {
    loadFramework()
  }, [activeOrgId])

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // The cached "of N" total is per role (a regular user's excludes browser-app
  // connectors): forget it on a role flip so the next grid load refetches it.
  useEffect(() => {
    catalogTotalRef.current = null
    setCatalogTotal(null)
  }, [isRegularUser])

  // Grid page: search (2+ characters, names only) and filters run on the server.
  useEffect(() => {
    const accessToken = session?.access_token
    if (!frameworkId || !accessToken || viewState !== 'grid') return
    const search = debouncedSearch.length >= 2 ? debouncedSearch : undefined
    const selectedSources = sourceTypeKey ? (sourceTypeKey.split(",") as McpSourceType[]) : []
    const accessStatus = accessStatusKey ? (accessStatusKey.split(",") as ('allowed' | 'blocked')[]) : []
    // "Filtered" is the user's own choice; narrowing a regular user to
    // USER_VISIBLE_SOURCE_TYPES is the catalog they see, not a filter on it.
    const filtered = selectedSources.length > 0 || accessStatus.length > 0
    const sourceTypes = isRegularUser && selectedSources.length === 0 ? USER_VISIBLE_SOURCE_TYPES : selectedSources
    let active = true
    setGridLoading(true)
    ;(async () => {
      try {
        const [page, unfiltered] = await Promise.all([
          traceforcApi.listMcpCatalog(accessToken, {
            sort_by: 'mcp_server_type',
            sort_order: 'asc',
            limit: MAX_GRID_ITEMS,
            include_total: true,
            exclude_mcp_server_type: [CUSTOM_MCP_SERVER_TYPE],
            search,
            search_fields: 'name',
            source_type: sourceTypes,
            access_status: accessStatus,
          }),
          // The badge's "of N" is the whole catalog the caller can see; fetch
          // it once when the first page is already narrowed (e.g. filters
          // from the URL).
          (search || filtered) && catalogTotalRef.current === null
            ? traceforcApi.listMcpCatalog(accessToken, {
                limit: 1,
                include_total: true,
                exclude_mcp_server_type: [CUSTOM_MCP_SERVER_TYPE],
                source_type: isRegularUser ? USER_VISIBLE_SOURCE_TYPES : [],
              })
            : null,
        ])
        if (!active) return
        const allTotal = search || filtered ? unfiltered?.data?.total : page.data?.total
        if (allTotal != null) {
          catalogTotalRef.current = allTotal
          setCatalogTotal(allTotal)
        }
        if (page.error) throw new Error(page.error)
        setGridResult({
          entities: (page.data?.data ?? []).map(toCatalogEntity),
          total: page.data?.total ?? null,
          searched: !!search,
          filtered,
        })
      } catch (error) {
        if (!active) return
        console.error('Error loading connectors:', error)
        toast({
          title: "Error",
          description: friendlyLoadError((error as Error)?.message ?? "Failed to load connector list"),
          variant: "destructive",
        })
      } finally {
        if (active) setGridLoading(false)
      }
    })()
    return () => {
      active = false
    }
    // isRegularUser: the request narrows to USER_VISIBLE_SOURCE_TYPES for
    // regular users, so a role flip (View as user/admin) must reload the grid.
  }, [frameworkId, session?.access_token, viewState, debouncedSearch, sourceTypeKey, accessStatusKey, isRegularUser])

  // Handle URL params - when mcp_server_type is in URL, go directly to detail view
  useEffect(() => {
    const mcpServerType = searchParams.get('mcp_server_type')
    const searchFromUrl = searchParams.get('q')
    
    // Reset state when navigating to page without mcp_server_type param
    if (!mcpServerType) {
      // Run once per detail→grid (or initial-load) transition. Filter-only URL
      // updates re-fire this effect and must not re-run the reset.
      if (hasResetGridState.current) return
      hasResetGridState.current = true
      // If there's a search query in URL, use it; otherwise clear
      setSearchNow(searchFromUrl || "")
      setSelectedEntityName("")
      setSearchResults(null)
      // A lookup superseded by this transition never clears its own flag.
      setEntityDetailsLoading(false)
      setSelectedMcpServerType(null)
      setNoResults(false)
      setViewState('grid')
      hasAttemptedAutoSearch.current = false
      return
    }
    hasResetGridState.current = false

    const accessToken = session?.access_token
    if (
      mcpServerType &&
      frameworkId &&
      accessToken &&
      !hasAttemptedAutoSearch.current
    ) {
      hasAttemptedAutoSearch.current = true
      setEntityDetailsLoading(true)
      const type = parseInt(mcpServerType)
      ;(async () => {
        const res = await traceforcApi.listMcpCatalog(accessToken, {
          mcp_server_type: [type],
          // A regular user's link to a browser-app connector is "not found":
          // it's outside their catalog (USER_VISIBLE_SOURCE_TYPES).
          source_type: isRegularUser ? USER_VISIBLE_SOURCE_TYPES : [],
          limit: 1,
        })
        // Superseded (Back, another tile) while in flight: drop it.
        if (urlTypeRef.current !== mcpServerType) return
        // The type check also guards an API without the mcp_server_type
        // filter, which would return the first catalog row.
        const item = res.data?.data?.find((row) => row.mcp_server_type === type)
        // Prefer the org-scoped catalog API. Only if that call actually FAILED
        // (e.g. a UI-only preview with no backend) fall back to a direct mcp_catalog
        // read so the detail still renders its header, supabase risk scores, and
        // vulnerabilities. A successful-but-empty response means the connector isn't
        // in this org's registry, so the "not found" path below is preserved.
        const entity = item
          ? toCatalogEntity(item)
          : res.error
            ? await resolveEntityFromCatalog(type)
            : null
        if (urlTypeRef.current !== mcpServerType) return
        if (!entity) {
          setEntityDetailsLoading(false)
          toast({
            title: res.error ? "Error" : "Connector not found",
            description: res.error
              ? friendlyLoadError(res.error)
              : "That connector is not in the registry.",
            variant: "destructive",
          })
          setViewState('grid')
          updateParams({ mcp_server_type: null }, { replace: true })
          return
        }
        setSearchNow(entity.display_name)
        setSelectedEntityName(entity.name)
        setSelectedMcpServerType(entity.type)
        setViewState('detail')
        handleSearch(entity)
      })()
    }
  }, [searchParams, frameworkId, session?.access_token])

  // Note: Removed the sourceTypeFilter effect that auto-updates the detail view
  // Filters now only affect the grid view, not the detail view

  const handleSearch = async (entity: CatalogEntity) => {
    const entityName = entity.name
    const entityType = entity.type
    if (!frameworkId) return
    
    setEntityDetailsLoading(true)
    setNoResults(false)
    loadVulnerabilitiesForMcp(entityType)
    // Another connector (or the grid) may be in the URL by the time the scores
    // arrive: then this response is stale and must not touch the page.
    const superseded = () => urlTypeRef.current !== String(entityType)
    let stale = false
    try {
      const { data, error } = await supabase.rpc('get_mcp_risk_framework_with_scores', {
        ...orgRpcArgs(activeOrgId), // scope scores to the ACTIVE org (subsidiary-aware)
        p_framework_id: frameworkId,
        p_mcp_server_type: entityType
      })

      if ((stale = superseded())) return
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
        
        const isCustomMcp = entityType === 999999999

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

        setSearchResults({
          entity_name: entityName,
          entity_display_name: transformMcpName(entityName),
          entity_source_type: isCustomMcp ? undefined : entity.source_type,
          entity_description: entity.description,
          entity_website: entity.website,
          entity_logo_url: entity.logo_url,
          entity_authentication_methods: entity.authentication_methods,
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
      if ((stale = superseded())) return
      console.error('Error searching MCP:', error)
      toast({
        title: "Error",
        description: "Failed to load connector risk scores",
        variant: "destructive",
      })
      setSearchResults(null)
    } finally {
      if (!stale) setEntityDetailsLoading(false)
    }
  }

  const loadFramework = async () => {
    try {
      setFrameworkLoading(true)
      const { data, error } = await supabase
        .from('risk_framework' as any)
        .select('id')
        .eq('org_id', activeOrgId!)
        .eq('entity_type', 2)
        .eq('name', 'Default Connector Risk Framework')
        .maybeSingle()

      if (error) throw error
      if (data) {
        setFrameworkId((data as any).id)
      }
    } catch (error) {
      console.error('Error loading MCP framework:', error)
      toast({
        title: "Error",
        description: "Failed to load connector framework",
        variant: "destructive",
      })
    } finally {
      setFrameworkLoading(false)
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
    if (sourceMcp) {
      navigate(`/mcps/${sourceMcp}`)
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {sourceMcp && (
        <Button variant="ghost" onClick={handleBackToSource}>
          <ArrowLeft className="h-4 w-4" />
          Back to Connector Details
        </Button>
      )}
      
      <div className="flex items-center gap-3">
        <Network className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Connector Registry</h1>
          <p className="text-muted-foreground">
            Search and view risk scores for connectors.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Search and Filters - only shown in grid view */}
        {viewState === 'grid' && (
          <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={frameworkLoading ? "Loading..." : "Search connectors..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  disabled={frameworkLoading}
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

              <CollapsibleTrigger asChild>
                <Button variant="outline">
                  <Filter className="h-4 w-4" />
                  Filters
                  {(() => {
                    const appliedFilters = [
                      sourceTypeFilter.length > 0,
                      approvalStatusFilter.length > 0,
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
            </div>

            <CollapsibleContent>
              <Card className="mt-4">
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {isRegularUser && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground">Access Status</label>
                        <MultiSelect
                          options={[
                            { id: "allowed", name: "Allowed" },
                            { id: "blocked", name: "Blocked" },
                          ]}
                          selectedIds={approvalStatusFilter}
                          onChange={setApprovalStatusFilter}
                          placeholder="All"
                          searchPlaceholder="Search..."
                          emptyMessage="No options found."
                          label="status"
                          compact
                        />
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">Source</label>
                      <MultiSelect
                        // Users never see browser connectors (USER_VISIBLE_SOURCE_TYPES),
                        // so their filter doesn't offer those sources either.
                        options={MCP_SOURCE_TYPE_FILTER_OPTIONS.filter(
                          (o) => !isRegularUser || !isBrowserAppConnectorSourceType(o.value as McpSourceType),
                        ).map((o) => ({
                          id: o.value,
                          name: o.label,
                        }))}
                        selectedIds={sourceTypeFilter}
                        onChange={setSourceTypeFilter}
                        placeholder="All"
                        searchPlaceholder="Search sources..."
                        emptyMessage="No sources found."
                        label="source"
                        compact
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Search box - shown in detail view to go back to grid with search */}
        {viewState === 'detail' && (
          <div className="flex items-center gap-2">
            <form 
              // Remount per connector so the uncontrolled input picks up its
              // name (a deep link mounts this before the name is known).
              key={selectedMcpServerType ?? 'none'}
              onSubmit={(e) => {
                e.preventDefault()
                const formData = new FormData(e.currentTarget)
                const query = formData.get('detailSearch') as string
                handleBackToGrid(query)
              }}
              className="flex items-center gap-2"
            >
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  name="detailSearch"
                  placeholder="Search connectors..."
                  className="pl-10 w-64"
                  defaultValue={searchQuery}
                />
              </div>
              <Button type="submit" variant="outline" size="sm">
                Search
              </Button>
            </form>
          </div>
        )}

        {noResults && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md border border-red-200">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <span className="font-medium">
              No results found for "{searchQuery}"
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

        {/* Grid view - show MCPs grid with search and filter */}
        {viewState === 'grid' && !entityDetailsLoading && (gridResult !== null || gridLoading) && (() => {
          const filteredEntities = gridResult?.entities ?? []
          const narrowed = !!gridResult && (gridResult.searched || gridResult.filtered)
          const shownCount = gridResult?.total ?? filteredEntities.length
          const badge = narrowed
            ? catalogTotal !== null
              ? `${shownCount} of ${catalogTotal} connectors`
              : `${shownCount} connectors`
            : `${catalogTotal ?? shownCount} total connectors`

          return (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold">
                    {gridResult?.searched ? 'Search Results' : 'Popular Connectors'}
                  </h2>
                  <Badge variant="secondary">
                    {gridResult ? badge : 'Loading…'}
                  </Badge>
                </div>
                <span className="text-sm text-muted-foreground">
                  Select a connector to view its risk profile
                </span>
              </div>
              
              {gridLoading && filteredEntities.length === 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" role="status" aria-busy="true" aria-label="Loading connectors">
                  {Array.from({ length: 6 }, (_, i) => (
                    <Skeleton key={i} className="h-36 w-full" />
                  ))}
                </div>
              ) : filteredEntities.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-4 rounded-md border">
                  <AlertCircle className="h-4 w-4" />
                  <span>No connectors found matching your search or filters.</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredEntities
                    .map((entity) => (
                      <Card 
                        key={entity.type}
                        className="cursor-pointer hover:border-primary transition-colors"
                        onClick={() => handleSelectMcp(entity)}
                      >
                        <CardContent className="p-4 flex flex-col h-full">
                          <div className="flex items-start gap-3 flex-1">
                            {entity.logo_url && (
                              <img 
                                src={entity.logo_url} 
                                alt={entity.display_name} 
                                className="h-10 w-10 object-contain flex-shrink-0" 
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-base">{entity.display_name}</span>
                                {isRegularUser && !verdictsLoading && !verdictsError && !requestsLoading && !requestsError && (
                                  blockedMcpTypes.has(entity.type) ? (
                                    <Badge
                                      variant="outline"
                                      className="border-red-500 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 dark:border-red-700"
                                    >
                                      {blockedMcpTypes.get(entity.type) ? "Blocked · Requested" : "Blocked"}
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className={allowedBadgeClass}>
                                      Allowed
                                    </Badge>
                                  )
                                )}
                              </div>
                              {entity.description && (
                                <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                                  {entity.description}
                                </p>
                              )}
                            </div>
                          </div>
                          
                          <div className="border-t mt-4 pt-3 grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs font-medium text-muted-foreground tracking-wide">Source</p>
                              <div className="mt-1">
                                {getMcpSourceTypeBadge(entity.source_type)}
                              </div>
                            </div>
                            <div>
                              <p className="text-xs font-medium text-muted-foreground tracking-wide">Auth Method</p>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {entity.authentication_methods && entity.authentication_methods.length > 0 ? (
                                  entity.authentication_methods.map((m, idx) => (
                                    <Badge key={idx} variant="outline" className="text-xs">
                                      {getAuthMethodLabel(m)}
                                    </Badge>
                                  ))
                                ) : (
                                  <span className="text-sm text-muted-foreground">—</span>
                                )}
                              </div>
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

        {/* Detail view - entity header, then Tools, then the risk breakdown */}
        {viewState === 'detail' && !entityDetailsLoading && searchResults && (
          <>
          {/* Entity header */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {searchResults.entity_logo_url && (
                      <div className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0">
                        <img src={searchResults.entity_logo_url} alt={searchResults.entity_display_name} className="h-6 w-6" />
                      </div>
                    )}
                    <h3 className="text-xl font-semibold">{searchResults.entity_display_name}</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Source:</span>
                      {getMcpSourceTypeBadge(searchResults.entity_source_type)}
                    </div>
                    {searchResults.entity_authentication_methods && searchResults.entity_authentication_methods.length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Auth Method:</span>
                        {searchResults.entity_authentication_methods.map((m: McpAuthType, idx: number) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {getAuthMethodLabel(m)}
                          </Badge>
                        ))}
                      </div>
                    )}
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
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <p className="text-sm text-muted-foreground leading-relaxed truncate max-w-xl cursor-default">
                            {searchResults.entity_description}
                          </p>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" align="start" className="max-w-sm whitespace-normal">
                          {searchResults.entity_description}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
                
                <div className="flex flex-wrap items-center justify-end gap-x-6 gap-y-3 shrink-0">
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

                  {/* Access chrome is fail-CLOSED: until we know the caller's
                      verdicts AND their pending requests we render no request
                      button (guessing would show false "Allowed" badges,
                      trigger 409 storms, or show "Request access" for an ask
                      that's already pending). But never SILENT — a fetch
                      failure shows an inline error so the user knows it's
                      temporary, not "you're locked out". A failed request-list
                      load is fail-closed too: without it we can't tell Pending
                      from requestable, so we surface the error rather than
                      guess. */}
                  {isRegularUser && (verdictsError || requestsError) ? (
                    <span className="text-sm text-destructive">
                      Couldn&apos;t load your access — retry shortly.
                    </span>
                  ) : isRegularUser && (verdictsLoading || requestsLoading) ? (
                    <Skeleton className="h-8 w-32" />
                  ) : (
                  isRegularUser && (
                    hasApprovedAccess ? (
                      <Badge
                        variant="outline"
                        className={allowedBadgeClass}
                      >
                        Allowed
                      </Badge>
                    ) : isRequestable ? (
                      /* Blocked, not asked yet: the status, then the ONLY state
                         with a button. One request covers every blocking
                         scope at once. */
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className="border-red-500 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 dark:border-red-700"
                        >
                          Blocked
                        </Badge>
                        <Button
                          variant="default"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => setRequestDialogOpen(true)}
                        >
                          <Send className="h-4 w-4" />
                          Request access
                        </Button>
                      </div>
                    ) : isPending ? (
                      /* Blocked, already asked: nothing left to ask for; the
                         admin decides next. */
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className="border-red-500 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 dark:border-red-700"
                        >
                          Blocked
                        </Badge>
                        <span className="inline-flex items-center gap-1.5 text-sm text-amber-700 dark:text-amber-300">
                          <Clock className="h-3.5 w-3.5" />
                          Requested
                        </span>
                      </div>
                    ) : (
                      /* Ungoverned: no policy governs this connector for the
                         caller, so they can use it and there's nothing to
                         request. From their side that's simply Allowed. */
                      <Badge
                        variant="outline"
                        className={allowedBadgeClass}
                      >
                        Allowed
                      </Badge>
                    )
                  ))}

                  {/* Regular users only: admins can't submit requests. */}
                  {isRegularUser && isRequestable && (
                    <RequestMcpAccessDialog
                      open={requestDialogOpen}
                      onOpenChange={setRequestDialogOpen}
                      mcpServerType={selectedMcpServerType}
                      mcpServerName={searchQuery || selectedEntityName}
                      onSubmitted={() => {
                        refetchRequests()
                        refetchVerdicts()
                      }}
                    />
                  )}
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Tools this connector exposes — surfaced above the risk breakdown,
              mirroring the vulnerabilities section pattern. */}
          <McpToolsCard mcpServerType={selectedMcpServerType} />

          {/* Vulnerabilities – filtered by mcp_catalog_id (from mcp_server_type).
              Omit the whole card when there are no findings, like McpToolsCard. */}
          {selectedMcpServerType != null && (vulnerabilitiesLoading || vulnerabilities.length > 0) && (
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">Vulnerabilities Found</CardTitle>
                  {!vulnerabilitiesLoading && (
                    <Badge variant="secondary">{vulnerabilities.length} finding{vulnerabilities.length !== 1 ? 's' : ''}</Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Select value={vulnFilterVulnerability} onValueChange={setVulnFilterVulnerability}>
                    <SelectTrigger className="w-[180px] h-8 text-xs">
                      <SelectValue placeholder="Vulnerability" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All Vulnerabilities</SelectItem>
                      {vulnerabilityFilterOptions.map((opt) => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={vulnFilterToolName} onValueChange={setVulnFilterToolName}>
                    <SelectTrigger className="w-[160px] h-8 text-xs">
                      <SelectValue placeholder="Tool name" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All Tools</SelectItem>
                      {toolNameFilterOptions.map((opt) => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={vulnFilterSeverity} onValueChange={setVulnFilterSeverity}>
                    <SelectTrigger className="w-[150px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All Severities">All Severities</SelectItem>
                      <SelectItem value="Error">Error</SelectItem>
                      <SelectItem value="Warning">Warning</SelectItem>
                      <SelectItem value="Note">Note</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {vulnerabilitiesLoading ? (
                <div className="p-6 space-y-3">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : filteredAndSortedVulnerabilities.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground">
                  No findings match the selected filters.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vulnerability</TableHead>
                      <TableHead>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="-ml-2 h-8 font-medium inline-flex items-center gap-1"
                          onClick={() => handleVulnerabilitySort('mcp_tool_name')}
                        >
                          Tool name
                          {vulnerabilitySortColumn === 'mcp_tool_name' ? (
                            vulnerabilitySortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5 shrink-0" /> : <ArrowDown className="h-3.5 w-3.5 shrink-0" />
                          ) : (
                            <ArrowUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          )}
                        </Button>
                      </TableHead>
                      <TableHead>Finding Details</TableHead>
                      <TableHead>CVE / GHSA</TableHead>
                      <TableHead>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="-ml-2 h-8 font-medium inline-flex items-center gap-1"
                          onClick={() => handleVulnerabilitySort('severity')}
                        >
                          Severity
                          {vulnerabilitySortColumn === 'severity' ? (
                            vulnerabilitySortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5 shrink-0" /> : <ArrowDown className="h-3.5 w-3.5 shrink-0" />
                          ) : (
                            <ArrowUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          )}
                        </Button>
                      </TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="-ml-2 h-8 font-medium inline-flex items-center gap-1"
                          onClick={() => handleVulnerabilitySort('first_seen')}
                        >
                          First Seen
                          {vulnerabilitySortColumn === 'first_seen' ? (
                            vulnerabilitySortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5 shrink-0" /> : <ArrowDown className="h-3.5 w-3.5 shrink-0" />
                          ) : (
                            <ArrowUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          )}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="-ml-2 h-8 font-medium inline-flex items-center gap-1"
                          onClick={() => handleVulnerabilitySort('last_seen')}
                        >
                          Last Seen
                          {vulnerabilitySortColumn === 'last_seen' ? (
                            vulnerabilitySortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5 shrink-0" /> : <ArrowDown className="h-3.5 w-3.5 shrink-0" />
                          ) : (
                            <ArrowUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          )}
                        </Button>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAndSortedVulnerabilities.map((v) => (
                      <TableRow key={v.id}>
                        <TableCell className="font-medium">
                          {v.vuln_rules?.vulnerability_type ?? v.message ?? v.vuln_rules?.case_id ?? v.rule_id}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{v.mcp_tool_name || "—"}</TableCell>
                        <TableCell className="text-muted-foreground max-w-[320px]">
                          {v.message ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="cursor-default block line-clamp-2">
                                  {firstCompleteSentence(v.message)}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-sm whitespace-pre-wrap">
                                {v.message}
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          <AdvisoryLink
                            id={v.advisory_id}
                            published={v.advisory_published}
                            url={v.mcp_tool_input?.advisoryUrl ?? null}
                          />
                        </TableCell>
                        <TableCell>
                          <Badge variant={SEVERITY_BADGE_VARIANT[severityLabel(v.severity)] ?? "secondary"}>
                            {severityLabel(v.severity)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="destructive">Active</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {v.created_at ? format(new Date(v.created_at), "yyyy-MM-dd") : "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {v.created_at ? format(new Date(v.created_at), "yyyy-MM-dd") : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
          )}

          {/* Risk attributes */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold">Risk Attributes</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Detailed risk scoring for this connector.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
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
                                      <p className="text-sm">Baseline scores represent the inherent risk level of the connector</p>
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
                                        <p className="text-sm">Actual scores are calculated across all instances of the connector in your organization</p>
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
          </>
        )}
      </div>
    </div>
  )
}
