import { useEffect, useMemo, useState } from "react"
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom"
import { ArrowLeft, Users, Clock, Download, Loader2, ExternalLink } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { DeviceOwnerHeader } from "@/components/DeviceOwnerHeader"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useAuth } from "@/contexts/AuthContext"
import { useOrg } from "@/contexts/OrgContext"
import { useToast } from "@/hooks/use-toast"
import { traceforcApi } from "@/integrations/traceforce/client"
import type { LlmModelDto, LlmModelDeviceDto, LlmModelInstanceDto, MdmIntegration } from "@/integrations/traceforce/types"
import { anyMdmNeedsAttention } from "@/lib/appUtils"
import { downloadCsv, csvTimestamp } from "@/lib/csvUtils"
import { weightLabel, isUnlistedLlmModelType, groupInstancesByName, type LlmModelNameRow } from "@/lib/llmModels"

const weightVariant = (w: string) => (w === 'Open' ? 'success' : w === 'Restricted' ? 'warning' : 'secondary')

/** Device owner email, truncated with the full value on hover (as on McpDetail). */
const OwnerEmailCell = ({ email }: { email: string | null }) => (
  <TableCell>
    {email ? (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="truncate cursor-default max-w-[150px]">{email}</div>
          </TooltipTrigger>
          <TooltipContent><p>{email}</p></TooltipContent>
        </Tooltip>
      </TooltipProvider>
    ) : (
      <span className="text-muted-foreground">-</span>
    )}
  </TableCell>
)

const LlmModelDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { session } = useAuth()
  const { activeOrgId } = useOrg()
  const { toast } = useToast()

  const [model, setModel] = useState<LlmModelDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showUserActivityModal, setShowUserActivityModal] = useState(false)
  const [userActivityData, setUserActivityData] = useState<LlmModelDeviceDto[]>([])
  const [userActivityLoading, setUserActivityLoading] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)
  const [unlistedInstances, setUnlistedInstances] = useState<LlmModelInstanceDto[]>([])
  const [unlistedLoading, setUnlistedLoading] = useState(false)
  const [selectedName, setSelectedName] = useState<LlmModelNameRow | null>(null)
  const [mdmIntegrations, setMdmIntegrations] = useState<MdmIntegration[]>([])
  const [mdmLoaded, setMdmLoaded] = useState(false)

  const mdmNeedsAttention = anyMdmNeedsAttention(mdmIntegrations)
  const mdmNotConfigured = mdmLoaded && mdmIntegrations.length === 0

  useEffect(() => {
    const token = session?.access_token
    if (!token || !id) return
    let cancelled = false
    setLoading(true)
    setError(null)
    setNotFound(false)
    traceforcApi.getLlmModel(token, id)
      .then((mRes) => {
        if (cancelled) return
        if (mRes.error || !mRes.data) {
          if (mRes.statusCode === 404) setNotFound(true)
          else setError(mRes.error ?? 'Failed to load model')
          return
        }
        setModel(mRes.data)
      })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load model') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [activeOrgId, session?.access_token, id])

  // Custom and Unknown each group many different models, so their page lists the
  // models by name (from their instances) instead of catalog details.
  const isUnlisted = model ? isUnlistedLlmModelType(model.llm_model_type) : false
  useEffect(() => {
    const token = session?.access_token
    if (!token || !id || !isUnlisted) return
    let cancelled = false
    setUnlistedLoading(true)
    traceforcApi.listAllLlmModelInstances(token, { llm_model_ids: [id] })
      .then((data) => { if (!cancelled) setUnlistedInstances(data) })
      .catch(() => {
        if (cancelled) return
        setUnlistedInstances([])
        toast({ title: "Error", description: "Failed to load models", variant: "destructive" })
      })
      .finally(() => { if (!cancelled) setUnlistedLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrgId, session?.access_token, id, isUnlisted])
  const nameRows = useMemo(() => groupInstancesByName(unlistedInstances), [unlistedInstances])

  useEffect(() => {
    if (session?.access_token) {
      fetchMdmIntegration()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.access_token])

  const fetchMdmIntegration = async () => {
    if (!session?.access_token) return
    try {
      const response = await traceforcApi.getMdmIntegration(session.access_token)
      if (response.error) {
        throw new Error(response.error)
      }
      if (response.data) {
        setMdmIntegrations(response.data)
      }
      setMdmLoaded(true)
    } catch (error) {
      console.error('Error fetching MDM integration:', error)
    }
  }

  const handleShowUserActivity = async () => {
    const token = session?.access_token
    if (!token || !id) return
    setUserActivityLoading(true)
    setShowUserActivityModal(true)

    try {
      // Default order is most recent check-in first, like the MCP dialog.
      const response = await traceforcApi.listLlmModelDevices(token, id, { limit: 100 })
      if (response.error) throw new Error(response.error)
      setUserActivityData(response.data?.data ?? [])
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load user activity",
        variant: "destructive",
      })
      setShowUserActivityModal(false)
    } finally {
      setUserActivityLoading(false)
    }
  }

  const handleExportUsers = async () => {
    const token = session?.access_token
    if (!token || !id || !model) return

    setExportLoading(true)

    try {
      // Drain on a key that does not change while paging (last_seen_at does).
      const data = await traceforcApi.listAllLlmModelDevices(token, id, { sort_by: 'device_native_id', sort_order: 'asc' })

      const csvData = data.map(device => ({
        'Device ID': device.device_native_id || '-',
        'Device Owner': device.device_owner_email || '-',
        'Device Name': device.device_friendly_name || '-',
        'Platform': device.platform || '-',
        'OS Version': device.os_version || '-',
        'Host': device.api_hosts.join(', ') || '-',
        'Device Last Seen': device.last_seen_at || '-'
      }))

      const modelName = model.model_name.replace(/[^a-zA-Z0-9]/g, '-')
      downloadCsv(csvData, `active-devices-${modelName}-${csvTimestamp()}.csv`)
    } catch (error) {
      console.error('Error exporting active users:', error)
      toast({
        title: "Error",
        description: "Failed to export active users",
        variant: "destructive",
      })
    } finally {
      setExportLoading(false)
    }
  }

  const handleExportNames = () => {
    if (!model) return
    const csvData = nameRows.map(row => ({
      'Model Name': row.name,
      'Devices': row.devices.length,
      'Hosts': row.api_hosts.join(', ') || '-',
      'Last Seen': new Date(row.last_seen_at).toLocaleString()
    }))
    const modelName = model.model_name.replace(/[^a-zA-Z0-9]/g, '-')
    downloadCsv(csvData, `llm-models-${modelName}-${csvTimestamp()}.csv`)
  }

  const handleExportNameDevices = () => {
    if (!selectedName) return
    const csvData = selectedName.devices.map(device => ({
      'Device ID': device.device_native_id || '-',
      'Device Owner': device.device_owner_email || '-',
      'Host': device.api_hosts.join(', ') || '-',
      'Last Seen': new Date(device.last_seen_at).toLocaleString()
    }))
    const name = selectedName.name.replace(/[^a-zA-Z0-9]/g, '-')
    downloadCsv(csvData, `llm-model-devices-${name}-${csvTimestamp()}.csv`)
  }

  const getBackButton = () => {
    const sourceDevice = searchParams.get('source_device')
    const backSearch = (location.state?.backSearch as string) || ''

    if (sourceDevice) {
      return {
        path: `/devices/${sourceDevice}`,
        label: 'Back to Device'
      }
    }
    return {
      // Restore the query string the LLM models list was showing when it opened
      // this page, so its filters/search survive the in-app back button.
      path: `/llm-models${backSearch ? `?${backSearch}` : ''}`,
      label: 'Back to LLM Models'
    }
  }

  const backButton = getBackButton()
  const goBack = () => navigate(backButton.path)

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Button variant="ghost" onClick={goBack}><ArrowLeft className="h-4 w-4" />{backButton.label}</Button>
        <div className="space-y-2"><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-64" /><Skeleton className="h-3 w-40" /></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (notFound || error || !model) {
    return (
      <div className="p-6 space-y-6">
        <Button variant="ghost" onClick={goBack}><ArrowLeft className="h-4 w-4" />{backButton.label}</Button>
        <div className={error ? "text-destructive" : "text-muted-foreground"}>{error ?? 'Model not found'}</div>
      </div>
    )
  }

  const wl = weightLabel(model.weight)
  const apiHosts = [...(model.api_hosts ?? [])].sort()
  const hostBadges = apiHosts.length
    ? <div className="flex flex-wrap gap-1">{apiHosts.map((h) => <Badge key={h} variant="outline">{h}</Badge>)}</div>
    : <span className="text-muted-foreground">{'—'}</span>
  const details: { label: string; value: React.ReactNode }[] = [
    { label: 'Model Family', value: model.model_family ?? '—' },
    { label: 'Publisher', value: model.publisher ?? '—' },
    { label: 'Model Origin', value: model.origin_country ?? '—' },
    { label: 'Weight', value: <Badge variant={weightVariant(wl)}>{wl}</Badge> },
    { label: 'Host', value: hostBadges },
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={goBack}>
          <ArrowLeft className="h-4 w-4" />
          {backButton.label}
        </Button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold text-foreground">{model.model_name}</h1>
            {model.website && (
              <a
                href={model.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="Visit website"
              >
                <ExternalLink className="h-5 w-5" />
              </a>
            )}
          </div>
          {model.description && (
            <p className="text-muted-foreground">{model.description}</p>
          )}
          {model.last_seen_at && (
            <div className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
              <Clock className="h-3 w-3" />
              Last seen {formatDistanceToNow(new Date(model.last_seen_at), { addSuffix: true })}
            </div>
          )}
        </div>
      </div>

      {/* Active Users card below the header, in the same 1/3-width grid as the MCP and Agent detail pages. */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card
          className="cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => handleShowUserActivity()}
        >
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Active Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(model.active_devices ?? 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Model Details card, full width. */}
      <div className="mb-8">
        {isUnlisted ? (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Models{unlistedLoading ? '' : ` (${nameRows.length})`}</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportNames}
                disabled={unlistedLoading || nameRows.length === 0}
                className="gap-2 text-foreground"
              >
                <Download className="h-4 w-4" />
                Export All
              </Button>
            </CardHeader>
            <CardContent>
              <div className="max-h-[440px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Model Name</TableHead>
                      <TableHead>Devices</TableHead>
                      <TableHead>Hosts</TableHead>
                      <TableHead>Last Seen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unlistedLoading ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <TableRow key={i}>
                          {Array.from({ length: 4 }).map((__, j) => <TableCell key={j}><Skeleton className="h-4 w-24" /></TableCell>)}
                        </TableRow>
                      ))
                    ) : nameRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No models found</TableCell>
                      </TableRow>
                    ) : (
                      nameRows.map((row) => (
                        <TableRow key={row.name}>
                          <TableCell className="font-mono text-sm">{row.name}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => setSelectedName(row)}>
                              <Badge variant="secondary">{row.devices.length}</Badge>
                            </Button>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {row.api_hosts.map((h) => <Badge key={h} variant="outline">{h}</Badge>)}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {new Date(row.last_seen_at).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader><CardTitle>Model Details</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {details.map((detail) => (
                  <div key={detail.label} className="space-y-1">
                    <div className="text-sm text-muted-foreground">{detail.label}</div>
                    <div className="text-sm font-medium text-foreground">{detail.value}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={showUserActivityModal} onOpenChange={setShowUserActivityModal}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Active Users - {model.model_name}</DialogTitle>
            <DialogDescription>
              Showing up to 100 most recent active users
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportUsers}
                disabled={exportLoading}
                className="gap-2"
              >
                {exportLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Export All
              </Button>
            </div>
            <ScrollArea className="h-[50vh] border rounded-md">
              {userActivityLoading ? (
                <div className="p-4 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : userActivityData.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  No active users found
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className={mdmNotConfigured || mdmNeedsAttention ? '[&>th]:align-top' : ''}>
                      <TableHead>Device ID</TableHead>
                      <TableHead>
                        <DeviceOwnerHeader mdmIntegrations={mdmIntegrations} mdmNotConfigured={mdmNotConfigured} mdmNeedsAttention={mdmNeedsAttention} />
                      </TableHead>
                      <TableHead>Device Name</TableHead>
                      <TableHead>Platform</TableHead>
                      <TableHead>OS Version</TableHead>
                      <TableHead>Host</TableHead>
                      <TableHead>Device Last Seen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {userActivityData.map((device) => (
                      <TableRow key={device.device_id}>
                        <TableCell className="font-medium font-mono">
                          <Link to={`/devices/${device.device_id}`} className="text-foreground hover:text-primary transition-colors">
                            {device.device_native_id}
                          </Link>
                        </TableCell>
                        <OwnerEmailCell email={device.device_owner_email} />
                        <TableCell className="text-muted-foreground">
                          {device.device_friendly_name || '-'}
                        </TableCell>
                        <TableCell>
                          {device.platform || '-'}
                        </TableCell>
                        <TableCell>
                          {device.os_version || '-'}
                        </TableCell>
                        <TableCell>
                          {device.api_hosts.length ? (
                            <div className="flex flex-wrap gap-1">
                              {device.api_hosts.map((h) => <Badge key={h} variant="outline">{h}</Badge>)}
                            </div>
                          ) : '-'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(device.last_seen_at).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedName} onOpenChange={(open) => { if (!open) setSelectedName(null) }}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="font-mono">{selectedName?.name}</DialogTitle>
            <DialogDescription>
              Showing {selectedName?.devices.length ?? 0} device{selectedName?.devices.length === 1 ? '' : 's'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={handleExportNameDevices} className="gap-2">
                <Download className="h-4 w-4" />
                Export All
              </Button>
            </div>
            <ScrollArea className="h-[50vh] border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow className={mdmNotConfigured || mdmNeedsAttention ? '[&>th]:align-top' : ''}>
                    <TableHead>Device ID</TableHead>
                    <TableHead>
                      <DeviceOwnerHeader mdmIntegrations={mdmIntegrations} mdmNotConfigured={mdmNotConfigured} mdmNeedsAttention={mdmNeedsAttention} />
                    </TableHead>
                    <TableHead>Host</TableHead>
                    <TableHead>Last Seen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(selectedName?.devices ?? []).map((device) => (
                    <TableRow key={device.device_id ?? device.device_native_id ?? device.last_seen_at}>
                      <TableCell className="font-medium font-mono">
                        {device.device_id ? (
                          <Link to={`/devices/${device.device_id}`} className="text-foreground hover:text-primary transition-colors">
                            {device.device_native_id || '-'}
                          </Link>
                        ) : (
                          device.device_native_id || '-'
                        )}
                      </TableCell>
                      <OwnerEmailCell email={device.device_owner_email} />
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {device.api_hosts.map((h) => <Badge key={h} variant="outline">{h}</Badge>)}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(device.last_seen_at).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default LlmModelDetail
