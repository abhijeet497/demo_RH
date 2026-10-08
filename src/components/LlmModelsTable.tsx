import { useState, useMemo } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { Brain, Search, Download, Loader2 } from "lucide-react"
import { useTableSort } from "@/hooks/use-table-sort"
import { useUrlStringFilter } from "@/hooks/use-url-filters"
import { SortableTableHead } from "@/components/SortableTableHead"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useToast } from "@/hooks/use-toast"
import { downloadCsv, csvTimestamp } from "@/lib/csvUtils"
import { weightLabel } from "@/lib/llmModels"
import type { LlmModelDto } from "@/integrations/traceforce/types"

interface LlmModelsTableProps {
  models: LlmModelDto[]
  /** llm_model_type -> catalog logo_url. */
  logos?: Map<number, string>
  loading?: boolean
  syncSearchToUrl?: boolean
  /** Row click override (the device tab links back to the device, as McpsTable does). */
  onRowClick?: (model: LlmModelDto) => void
  /** Hide Active Users (the device tab already scopes to one device). */
  hideActiveDevices?: boolean
}

const COLUMN_COUNT = 8

const LlmModelsTable = ({ models, logos, loading = false, syncSearchToUrl = false, onRowClick, hideActiveDevices = false }: LlmModelsTableProps) => {
  const columnCount = hideActiveDevices ? COLUMN_COUNT - 1 : COLUMN_COUNT
  const { toast } = useToast()
  const location = useLocation()
  const navigate = useNavigate()
  const [localSearchTerm, setLocalSearchTerm] = useState("")
  const [urlSearchTerm, setUrlSearchTerm] = useUrlStringFilter('search')
  const searchTerm = syncSearchToUrl ? urlSearchTerm : localSearchTerm
  const setSearchTerm = syncSearchToUrl ? setUrlSearchTerm : setLocalSearchTerm
  const [exportLoading, setExportLoading] = useState(false)
  const { sort, handleSort, sortItems } = useTableSort()

  // Whole-row click opens the model detail, carrying the current filters in router
  // state so the detail page's back button restores the filtered list (as McpsTable does).
  const openModel = (model: LlmModelDto) => {
    navigate(`/llm-models/${model.id}`, { state: { backSearch: location.search.replace(/^\?/, '') } })
  }

  const filteredModels = models.filter((model) => {
    if (!searchTerm) return true
    const lower = searchTerm.toLowerCase()
    return model.model_name.toLowerCase().includes(lower) ||
      (model.description ?? '').toLowerCase().includes(lower) ||
      (model.publisher ?? '').toLowerCase().includes(lower) ||
      (model.origin_country ?? '').toLowerCase().includes(lower)
  })

  const sortedModels = useMemo(() => {
    return sortItems(filteredModels, (model, column) => {
      switch (column) {
        case 'name': return model.model_name.toLowerCase()
        case 'model_family': return (model.model_family ?? '').toLowerCase()
        case 'devices': return model.active_devices
        case 'first_seen': return model.first_seen_at ? new Date(model.first_seen_at).getTime() : 0
        case 'last_seen': return model.last_seen_at ? new Date(model.last_seen_at).getTime() : 0
        default: return null
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredModels, sort])

  const handleExportCsv = () => {
    setExportLoading(true)
    try {
      const rows = filteredModels.map((model) => ({
        'Model Name': model.model_name,
        'Description': model.description ?? '-',
        'Model Family': model.model_family ?? '-',
        'Host': (model.api_hosts ?? []).join(', ') || '-',
        'Weight': weightLabel(model.weight),
        'Model Origin': model.origin_country ?? '-',
        ...(hideActiveDevices ? {} : { 'Active Users': model.active_devices }),
        'First Seen': model.first_seen_at ? new Date(model.first_seen_at).toLocaleDateString() : '-',
        'Last Seen': model.last_seen_at ? new Date(model.last_seen_at).toLocaleString() : '-',
      }))
      downloadCsv(rows, `llm-models-${csvTimestamp()}.csv`)
    } catch (e) {
      console.error('Export failed:', e)
      toast({ title: 'Export failed', description: 'Could not generate CSV', variant: 'destructive' })
    } finally {
      setExportLoading(false)
    }
  }

  return (
    <div className="border rounded-lg">
      {/* 8px column padding, as on the Connectors and Devices tables; the
          search/filter bar row keeps its own padding. */}
      <Table className="[&_tbody_td]:px-2 [&_thead_tr:last-child_th]:px-2">
        <TableHeader>
          <TableRow>
            <TableHead colSpan={columnCount} className="border-b-0 pb-4 pt-6">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="relative max-w-sm">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search LLM models..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-10"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportCsv}
                  disabled={exportLoading || filteredModels.length === 0}
                  className="gap-2 text-foreground"
                >
                  {exportLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Export
                </Button>
              </div>
            </TableHead>
          </TableRow>
          <TableRow>
            <SortableTableHead column="name" currentColumn={sort.column} direction={sort.direction} onSort={handleSort}>Model</SortableTableHead>
            <SortableTableHead column="model_family" currentColumn={sort.column} direction={sort.direction} onSort={handleSort}>Model Family</SortableTableHead>
            <TableHead>Host</TableHead>
            <TableHead>Weight</TableHead>
            <TableHead>Model Origin</TableHead>
            {!hideActiveDevices && <SortableTableHead column="devices" currentColumn={sort.column} direction={sort.direction} onSort={handleSort}>Active Users</SortableTableHead>}
            <SortableTableHead column="first_seen" currentColumn={sort.column} direction={sort.direction} onSort={handleSort}>First Seen</SortableTableHead>
            <SortableTableHead column="last_seen" currentColumn={sort.column} direction={sort.direction} onSort={handleSort}>Last Seen</SortableTableHead>
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
                {Array.from({ length: columnCount - 1 }).map((__, i) => (
                  <TableCell key={i}><Skeleton className="h-4 w-20" /></TableCell>
                ))}
              </TableRow>
            ))
          ) : sortedModels.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columnCount} className="text-center py-8 text-muted-foreground">
                No models found matching your criteria
              </TableCell>
            </TableRow>
          ) : (
            sortedModels.map((model) => {
              const wl = weightLabel(model.weight)
              const hosts = model.api_hosts ?? []
              const logo = logos?.get(model.llm_model_type)
              return (
                <TableRow key={model.id} className="cursor-pointer hover:bg-muted/50" onClick={() => (onRowClick ? onRowClick(model) : openModel(model))}>
                  <TableCell className="max-w-xs">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-muted/50 overflow-hidden shrink-0">
                        {logo ? (
                          <img src={logo} alt={model.publisher ?? ''} className="h-7 w-7 object-contain" />
                        ) : (
                          <Brain className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-foreground line-clamp-1">{model.model_name}</div>
                        {model.description && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="text-sm text-muted-foreground line-clamp-2 underline-offset-4 cursor-help hover:opacity-80 transition-opacity">
                                  {model.description}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-sm">
                                <p className="text-sm whitespace-normal">{model.description}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{model.model_family ?? '-'}</TableCell>
                  <TableCell>
                    {hosts.length ? (
                      <div className="flex flex-wrap gap-1">
                        {hosts.map((host) => (
                          <Badge key={host} variant="outline">{host}</Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={wl === 'Open' ? 'success' : wl === 'Restricted' ? 'warning' : 'secondary'}>
                      {wl}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{model.origin_country ?? '-'}</TableCell>
                  {!hideActiveDevices && <TableCell className="text-sm">{model.active_devices}</TableCell>}
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {model.first_seen_at
                      ? new Date(model.first_seen_at).toLocaleDateString()
                      : '-'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {model.last_seen_at
                      ? new Date(model.last_seen_at).toLocaleString()
                      : '-'}
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}

export default LlmModelsTable
