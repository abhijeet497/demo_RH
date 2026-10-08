import { useEffect, useState } from "react"
import { orgRpcArgs } from '@/lib/orgScope';
import { supabase } from "@/integrations/supabase/client"
import { DeviceOwnerHeader } from "@/components/DeviceOwnerHeader"
import { useNavigate, Link } from "react-router-dom"
import { Eye, Laptop, Download, Loader2, XCircle, RotateCcw, Info, MoreVertical, CheckCircle2, ChevronDown, ChevronRight, ArrowLeft } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/contexts/AuthContext"
import { useOrg } from "@/contexts/OrgContext"
import { traceforcApi } from "@/integrations/traceforce/client"
import type { MdmIntegration } from "@/integrations/traceforce/types"
import { useToast } from "@/hooks/use-toast"
import {
  getRiskBadge, getIssueStatusBadge, ISSUE_STATUS_MAP, getRiskBadgeVariant,
  DISMISSAL_REASON_OPTIONS, DISMISSAL_REASON_MAP,
  SEVERITY_LEVELS, anyMdmNeedsAttention,
} from "@/lib/appUtils"
import { downloadCsv, csvTimestamp } from "@/lib/csvUtils"
import { transformMcpName } from "@/lib/utils"
import { connectorLocationText } from "@/lib/connectorLocation"
import ConnectorLocations from "@/components/ConnectorLocations"

interface McpIssuesTableProps {
  violations: any[]
  selectedStatus: string
  loading: boolean
  error: string | null
  onRefresh: () => void
  fetchDeviceData: (issueTypeControlId: string) => Promise<any[]>
  onIssueTypeClick?: (riskRuleId: string, frameworkId: string) => void
}

const McpIssuesTable = ({
  violations,
  selectedStatus,
  loading,
  error,
  onRefresh,
  fetchDeviceData,
  onIssueTypeClick,
}: McpIssuesTableProps) => {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { session } = useAuth()
  const { activeOrgId } = useOrg()

  const [exportLoading, setExportLoading] = useState<string | null>(null)
  const [showIncidentModal, setShowIncidentModal] = useState(false)
  const [incidentModalData, setIncidentModalData] = useState<any[]>([])
  const [incidentModalLoading, setIncidentModalLoading] = useState(false)
  const [currentIssue, setCurrentIssue] = useState<any>(null)
  const [selectedIncidents, setSelectedIncidents] = useState<any>(new Map())
  const [incidentModalView, setIncidentModalView] = useState<'list' | 'dismiss'>('list')
  const [dismissalReason, setDismissalReason] = useState("")
  const [dismissalComment, setDismissalComment] = useState("")
  const [preventFuture, setPreventFuture] = useState(false)
  const [policyControls, setPolicyControls] = useState<any[] | null>(null)
  const [policyControlsLoading, setPolicyControlsLoading] = useState(false)
  const [selectedPolicyControlScores, setSelectedPolicyControlScores] = useState<any>(new Map())
  const [availableIssueTypes, setAvailableIssueTypes] = useState<any[]>([])
  const [disabledIssueType, setDisabledIssueType] = useState<any>(null)
  const [dismissLoading, setDismissLoading] = useState(false)
  const [reopenLoading, setReopenLoading] = useState(false)
  const [showReopenDialog, setShowReopenDialog] = useState(false)
  const [isDismissAllFlow, setIsDismissAllFlow] = useState(false)
  const [isReopenAllFlow, setIsReopenAllFlow] = useState(false)
  const [mdmIntegrations, setMdmIntegrations] = useState<MdmIntegration[]>([])
  const [mdmLoaded, setMdmLoaded] = useState(false)
  const [mcpAckOpen, setMcpAckOpen] = useState(false)

  // Computed MDM states — derived from full array for provider-agnostic coverage
  const mdmNeedsAttention = anyMdmNeedsAttention(mdmIntegrations)
  const mdmNotConfigured = mdmLoaded && mdmIntegrations.length === 0

  // Fetch MDM integration
  useEffect(() => {
    if (!session?.access_token) return
    const fetchMdm = async () => {
      try {
        const response = await traceforcApi.getMdmIntegration(session.access_token)
        if (response.error) throw new Error(response.error)
        if (response.data) {
          setMdmIntegrations(response.data)
        }
        setMdmLoaded(true)
      } catch (error) {
        console.error('Error fetching MDM integration:', error)
      }
    }
    fetchMdm()
  }, [session?.access_token])

  // Fetch policy controls when preventFuture is toggled
  useEffect(() => {
    if (!preventFuture || !currentIssue) {
      setPolicyControls(null)
      setPolicyControlsLoading(false)
      return
    }

    setPolicyControlsLoading(true)

    const fetchPolicyControls = async () => {
      try {
        const [controlsRes, issueTypesRes] = await Promise.all([
          supabase.from('policy_controls').select(`
              id,
              policy_id,
              issue_type_control_id,
              policies!inner(name, policy_status),
              issue_type_controls!inner(
                id,
                issue_types!inner(trigger_score, expected_value)
              )
            `).eq('org_id', activeOrgId!)
            .eq('risk_framework_rule_id', currentIssue.risk_framework_rule_id)
            .eq('policies.policy_status', 1)
            .lt('issue_type_controls.issue_types.trigger_score', currentIssue.trigger_score),
          supabase.from('issue_type_controls').select('id, issue_types!inner(expected_value, trigger_score, applicable_to)').eq('org_id', activeOrgId!)
            .eq('issue_types.risk_rule_id', currentIssue.risk_rule_id)
            .eq('issue_types.applicable_to', 1)
            .not('issue_types.expected_value', 'is', null)
            .gte('issue_types.trigger_score', currentIssue.trigger_score)
            .order('issue_types(trigger_score)', { ascending: true })
        ])

        if (controlsRes.error) throw controlsRes.error

        const mappedData = (controlsRes.data || []).map((pc: any) => ({
          id: pc.id,
          policyId: pc.policy_id,
          policyName: pc.policies.name,
          issueTypeControlId: pc.issue_type_control_id,
          expectedValue: pc.issue_type_controls?.issue_types?.expected_value || null
        }))

        setPolicyControls(mappedData)

        const allEligible = (issueTypesRes.data || []).map((itc: any) => ({
          id: itc.id,
          expected_value: itc.issue_types.expected_value,
          trigger_score: itc.issue_types.trigger_score,
        }))
        const disabledOption = allEligible.length > 0 ? allEligible[allEligible.length - 1] : null
        const selectableOptions = allEligible.length > 1 ? allEligible.slice(0, -1) : []
        setAvailableIssueTypes(selectableOptions)
        setDisabledIssueType(disabledOption)

        const defaultIssueTypeId = selectableOptions[0]?.id || null
        const initialSelections = new Map()
        mappedData.forEach((pc: any) => {
          if (defaultIssueTypeId) {
            initialSelections.set(pc.id, { enabled: true, issueTypeControlId: defaultIssueTypeId })
          } else if (disabledOption) {
            initialSelections.set(pc.id, { enabled: false, issueTypeControlId: disabledOption.id })
          }
        })
        setSelectedPolicyControlScores(initialSelections)
      } catch (error) {
        console.error('Error fetching policy controls:', error)
        toast({
          title: "Error",
          description: "Failed to load policy controls",
          variant: "destructive",
        })
      } finally {
        setPolicyControlsLoading(false)
      }
    }

    fetchPolicyControls()
  }, [preventFuture, currentIssue, toast, activeOrgId])

  const handleDismiss = async () => {
    setDismissLoading(true)
    try {
      const allIssueIds: any[] = []
      selectedIncidents.forEach((issueIds: any) => {
        allIssueIds.push(...issueIds)
      })

      const policyControlUpdates = preventFuture
        ? Array.from(selectedPolicyControlScores).map(([policyControlId, selection]) => ({
            policyControlId,
            newIssueTypeControlId: (selection as any).issueTypeControlId
          }))
        : []

      const { error } = await supabase.rpc('dismiss_mcp_issues_with_policy_updates', {
        ...orgRpcArgs(activeOrgId), // scope the mutation to the ACTIVE org (subsidiary-aware), not home
        p_issue_ids: allIssueIds,
        p_dismissal_reason: parseInt(dismissalReason),
        p_dismissal_comment: dismissalComment,
        p_policy_control_updates: policyControlUpdates,
      })

      if (error) throw error

      toast({
        title: "Success",
        description: "Incidents dismissed successfully",
      })

      setShowIncidentModal(false)
      onRefresh()
    } catch (error) {
      console.error('Error dismissing incidents:', error)
      toast({
        title: "Error",
        description: "Failed to dismiss incidents",
        variant: "destructive",
      })
    } finally {
      setDismissLoading(false)
    }
  }

  const handleReopenClick = () => {
    setIsReopenAllFlow(false)
    setShowReopenDialog(true)
  }

  const handleReopen = async () => {
    setReopenLoading(true)
    setShowReopenDialog(false)
    try {
      const allIssueIds: any[] = []
      selectedIncidents.forEach((issueIds: any) => {
        allIssueIds.push(...issueIds)
      })

      const { error } = await supabase.rpc('reopen_mcp_issues', {
        ...orgRpcArgs(activeOrgId), // scope to the ACTIVE org (subsidiary-aware), not home
        p_issue_ids: allIssueIds,
      })

      if (error) throw error

      toast({
        title: "Success",
        description: "Incidents reopened successfully",
      })

      setShowIncidentModal(false)
      onRefresh()
    } catch (error) {
      console.error('Error reopening incidents:', error)
      toast({
        title: "Error",
        description: "Failed to reopen incidents",
        variant: "destructive",
      })
    } finally {
      setReopenLoading(false)
    }
  }

  const resetIncidentModalState = (issue: any, view: 'list' | 'dismiss') => {
    setCurrentIssue(issue)
    setShowIncidentModal(true)
    setIncidentModalLoading(true)
    setSelectedIncidents(new Map())
    setIncidentModalView(view)
    setDismissalReason("")
    setDismissalComment("")
    setPreventFuture(false)
    setPolicyControls(null)
    setPolicyControlsLoading(false)
    setSelectedPolicyControlScores(new Map())
  }

  const handleShowIncidents = async (issue: any) => {
    resetIncidentModalState(issue, 'list')
    setIsDismissAllFlow(false)

    try {
      const mappedData = await fetchDeviceData(issue.issue_type_control_id)
      setIncidentModalData(mappedData)
    } catch (error) {
      console.error('Error fetching device details:', error)
      toast({
        title: "Error",
        description: "Failed to load incidents",
        variant: "destructive",
      })
    } finally {
      setIncidentModalLoading(false)
    }
  }

  const handleDismissAll = async (issue: any) => {
    resetIncidentModalState(issue, 'dismiss')
    setIsDismissAllFlow(true)

    try {
      const mappedData = await fetchDeviceData(issue.issue_type_control_id)
      setIncidentModalData(mappedData)

      const allSelected = new Map()
      mappedData.forEach((device: any) => {
        allSelected.set(device.issueIds.join(','), device.issueIds)
      })
      setSelectedIncidents(allSelected)
    } catch (error) {
      console.error('Error fetching device details:', error)
      toast({
        title: "Error",
        description: "Failed to load incidents",
        variant: "destructive",
      })
    } finally {
      setIncidentModalLoading(false)
    }
  }

  const handleReopenAll = async (issue: any) => {
    setCurrentIssue(issue)
    setIncidentModalData([])
    setSelectedIncidents(new Map())
    setReopenLoading(true)
    setIsReopenAllFlow(true)
    setShowReopenDialog(true)

    try {
      const mappedData = await fetchDeviceData(issue.issue_type_control_id)
      setIncidentModalData(mappedData)

      const allSelected = new Map()
      mappedData.forEach((device: any) => {
        allSelected.set(device.issueIds.join(','), device.issueIds)
      })
      setSelectedIncidents(allSelected)
    } catch (error) {
      console.error('Error fetching device details:', error)
      toast({
        title: "Error",
        description: "Failed to load incidents",
        variant: "destructive",
      })
    } finally {
      setReopenLoading(false)
    }
  }

  const mapIncidentToCsvRow = (incident: any, issue: any) => {
    const row: Record<string, string> = {
      'Risk Attribute': issue.risk_rule_name || '-',
      'Issue': issue.name || '-',
      'Issue Status': ISSUE_STATUS_MAP[issue.issue_status] || 'Unknown',
      'Remediation': issue.remediation_text || '-',
      'Device ID': incident.deviceId || '-',
      'Device Owner': incident.ownerEmail || '-',
      'Device Name': incident.deviceName || '-',
      'Connector Type': incident.mcpServerName || '-',
      'Connector Name': incident.mcpNativeId || '-',
      'Configured In': incident.locations.map(connectorLocationText).join('; ') || '-',
      'Agent': incident.agentName || '-',
      'Plan': incident.plan || '-',
      'Agent User': incident.agentEmail || '-',
      'Issue Detected': incident.lastSeen || '-',
    }
    if (selectedStatus === "3" && incident.metadata) {
      row['Dismissal Reason'] = DISMISSAL_REASON_MAP[incident.metadata.dismissalReason] || 'Unknown'
      row['Dismissed By'] = incident.metadata.dismissedBy || '-'
      row['Dismissed At'] = incident.metadata.dismissedAt ? new Date(incident.metadata.dismissedAt).toLocaleString() : '-'
      row['Dismissal Comment'] = incident.metadata.dismissalComment || ''
    }
    return row
  }

  const handleDownloadDevices = async (issue: any) => {
    setExportLoading(issue.issue_type_control_id)
    try {
      const data = await fetchDeviceData(issue.issue_type_control_id)
      const csvData = data.map((incident: any) => mapIncidentToCsvRow(incident, issue))
      const timestamp = csvTimestamp()
      const sanitizedIssueName = issue.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase().slice(0, 50)
      downloadCsv(csvData, `affected-devices-${sanitizedIssueName}-${timestamp}.csv`)
    } catch (error) {
      console.error('Error exporting devices:', error)
      toast({ title: "Error", description: "Failed to export devices", variant: "destructive" })
    } finally {
      setExportLoading(null)
    }
  }

  const handleExportAllControllableIncidents = async () => {
    setExportLoading('controllable')
    try {
      const allRows: Record<string, string>[] = []
      for (const issue of controllableIssues) {
        const data = await fetchDeviceData(issue.issue_type_control_id)
        data.forEach((row: any) => allRows.push(mapIncidentToCsvRow(row, issue)))
      }
      const timestamp = csvTimestamp()
      downloadCsv(allRows, `connector-issues-${timestamp}.csv`)
    } catch (e) {
      console.error('Error exporting controllable MCP incidents:', e)
      toast({ title: 'Export failed', description: 'Could not generate CSV', variant: 'destructive' })
    } finally {
      setExportLoading(null)
    }
  }

  // Separate issues by applicable_to
  const controllableIssues = violations.filter(v => v.applicable_to === 1)
  const acknowledgmentOnlyIssues = violations.filter(v => v.applicable_to === 2)

  const renderIssueRow = (violation: any, showRemediation: boolean) => (
    <TableRow key={violation.issue_type_control_id}>
      <TableCell>
        <div
          className="cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => handleShowIncidents(violation)}
        >
          <Badge variant={violation.applicable_to === 2 ? 'secondary' : getRiskBadgeVariant(violation.trigger_score)} className="gap-1.5">
            <Laptop className="h-3.5 w-3.5" />
            {violation.incident_count} incident{violation.incident_count > 1 ? 's' : ''}
          </Badge>
        </div>
      </TableCell>
      <TableCell className="font-medium max-w-md">
        <div className="break-words">{violation.name}</div>
      </TableCell>
      <TableCell className="align-middle">
        {onIssueTypeClick ? (
          <button
            onClick={() => onIssueTypeClick(violation.risk_rule_id, violation.framework_id)}
            className="hover:opacity-80 transition-opacity cursor-pointer text-left text-sm font-medium underline decoration-dotted underline-offset-2"
          >
            {violation.risk_rule_name}
          </button>
        ) : (
          <span className="text-sm">{violation.risk_rule_name}</span>
        )}
      </TableCell>
      <TableCell>
        {getIssueStatusBadge(violation.issue_status)}
      </TableCell>
      <TableCell>
        {new Date(violation.last_seen_at).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        })} {new Date(violation.last_seen_at).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit'
        })}
      </TableCell>
      {showRemediation && (
        <TableCell className="text-sm text-muted-foreground max-w-md">
          <div className="break-words">{violation.remediation_text}</div>
        </TableCell>
      )}
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleShowIncidents(violation)} disabled={incidentModalLoading || reopenLoading}>
              <Eye className="h-4 w-4 mr-2" />
              View Incidents
            </DropdownMenuItem>
            {selectedStatus === "1" && (
              <DropdownMenuItem onClick={() => handleDismissAll(violation)} disabled={incidentModalLoading || reopenLoading}>
                <XCircle className="h-4 w-4 mr-2" />
                Dismiss All
              </DropdownMenuItem>
            )}
            {selectedStatus === "3" && (
              <DropdownMenuItem onClick={() => handleReopenAll(violation)} disabled={incidentModalLoading || reopenLoading}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Reopen All
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  )

  return (
    <>
      {/* Severity Legend */}
      <div className="mb-4">
        <div className="inline-flex items-center gap-4 text-sm bg-muted/50 rounded-lg px-4 py-2">
          <span className="text-muted-foreground font-medium">Risk:</span>
          <div className="flex items-center gap-3">
            {SEVERITY_LEVELS.map(({ label, bgClass }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className={`w-3 h-3 rounded-full ${bgClass}`}></div>
                <span className="text-xs">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {controllableIssues.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CardTitle>Controllable Issues</CardTitle>
                <Badge variant="secondary">{controllableIssues.length}</Badge>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportAllControllableIncidents}
                disabled={exportLoading !== null}
                className="gap-2 text-foreground"
              >
                {exportLoading === 'controllable' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Export
              </Button>
            </div>
            <CardDescription className="mt-1">
              Issues that can be managed and resolved through configuration changes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Issue Breakdown</TableHead>
                  <TableHead>Issue Description</TableHead>
                  <TableHead>Risk Attribute</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Issue Detected</TableHead>
                  <TableHead>Remediation</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 3 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-64" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                    </TableRow>
                  ))
                ) : controllableIssues.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No controllable issues found
                    </TableCell>
                  </TableRow>
                ) : (
                  controllableIssues.map((violation) => renderIssueRow(violation, true))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {acknowledgmentOnlyIssues.length > 0 && (
        <Collapsible open={mcpAckOpen} onOpenChange={setMcpAckOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors rounded-t-lg">
                <div className="flex items-center gap-2">
                  {mcpAckOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                  <CardTitle className="text-left">Acknowledgment-Only Issues</CardTitle>
                  <Badge variant="secondary">{acknowledgmentOnlyIssues.length}</Badge>
                </div>
                <CardDescription className="mt-1 text-left">
                  These issues are currently externally managed by the provider and can only be acknowledged and monitored
                </CardDescription>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Issue Breakdown</TableHead>
                      <TableHead>Issue Description</TableHead>
                      <TableHead>Risk Attribute</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Issue Detected</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: 2 }).map((_, index) => (
                        <TableRow key={index}>
                          <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-64" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                          <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        </TableRow>
                      ))
                    ) : acknowledgmentOnlyIssues.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          No acknowledgment-only issues found
                        </TableCell>
                      </TableRow>
                    ) : (
                      acknowledgmentOnlyIssues.map((violation) => renderIssueRow(violation, false))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {!loading && violations.length === 0 && (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">
              {error ? `Error: ${error}` : 'No issues found with current filters'}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Incident Modal */}
      <Dialog open={showIncidentModal} onOpenChange={setShowIncidentModal}>
        <DialogContent className="max-w-7xl max-h-[80vh]">
          <AnimatePresence mode="wait" initial={false}>
            {incidentModalView === 'list' && (
              <motion.div
                key="list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.08 }}
                className="space-y-4"
              >
                <DialogHeader>
                  <DialogTitle>Connector Incidents: {currentIssue?.name}</DialogTitle>
                  <DialogDescription>
                    Review and manage incidents
                  </DialogDescription>
                </DialogHeader>
                <div className="flex justify-between items-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (currentIssue) {
                        handleDownloadDevices(currentIssue)
                      }
                    }}
                    disabled={exportLoading !== null}
                    className="gap-2"
                  >
                    {exportLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    Export All
                  </Button>
                  {selectedIncidents.size > 0 && selectedStatus === "1" && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setIncidentModalView('dismiss')}
                      className="gap-2 ml-auto"
                    >
                      <XCircle className="h-4 w-4" />
                      Dismiss ({selectedIncidents.size === incidentModalData.length ? 'All' : selectedIncidents.size})
                    </Button>
                  )}
                  {selectedIncidents.size > 0 && selectedStatus === "3" && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleReopenClick}
                      disabled={reopenLoading}
                      className="gap-2 ml-auto"
                    >
                      {reopenLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RotateCcw className="h-4 w-4" />
                      )}
                      Reopen ({selectedIncidents.size === incidentModalData.length ? 'All' : selectedIncidents.size})
                    </Button>
                  )}
                </div>
                <ScrollArea className="h-[50vh] border rounded-md">
                  {incidentModalLoading ? (
                    <div className="p-4 space-y-3">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : incidentModalData.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      No devices found
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className={mdmNotConfigured || mdmNeedsAttention ? '[&>th]:align-top' : ''}>
                          <TableHead className="w-[40px]">
                            <Checkbox
                              checked={incidentModalData.length > 0 && selectedIncidents.size === incidentModalData.length}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  const newMap = new Map()
                                  incidentModalData.forEach((device: any) => {
                                    newMap.set(device.issueIds.join(','), device.issueIds)
                                  })
                                  setSelectedIncidents(newMap)
                                } else {
                                  setSelectedIncidents(new Map())
                                }
                              }}
                            />
                          </TableHead>
                          <TableHead>Device ID</TableHead>
                          <TableHead>
                            <DeviceOwnerHeader mdmIntegrations={mdmIntegrations} mdmNotConfigured={mdmNotConfigured} mdmNeedsAttention={mdmNeedsAttention} />
                          </TableHead>
                          <TableHead>Agent User</TableHead>
                          <TableHead>Connector</TableHead>
                          <TableHead>Configured In</TableHead>
                          <TableHead>Agent</TableHead>
                          <TableHead>Plan</TableHead>
                          <TableHead>Issue Detected</TableHead>
                          {selectedStatus === "3" && <TableHead className="w-[50px]"></TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {incidentModalData.map((device) => (
                          <TableRow
                            key={device.issueIds.join(',')}
                            data-state={selectedIncidents.has(device.issueIds.join(',')) ? "selected" : undefined}
                          >
                            <TableCell>
                              <Checkbox
                                checked={selectedIncidents.has(device.issueIds.join(','))}
                                onCheckedChange={(checked) => {
                                  const newSelected = new Map(selectedIncidents)
                                  if (checked) {
                                    newSelected.set(device.issueIds.join(','), device.issueIds)
                                  } else {
                                    newSelected.delete(device.issueIds.join(','))
                                  }
                                  setSelectedIncidents(newSelected)
                                }}
                              />
                            </TableCell>
                            <TableCell className="font-medium font-mono">
                              {device.device_id ? (
                                <Link to={`/devices/${device.device_id}`} className="text-foreground hover:text-primary transition-colors">
                                  {device.deviceId}
                                </Link>
                              ) : (
                                device.deviceId
                              )}
                            </TableCell>
                            <TableCell className="max-w-[200px]">
                              {device.ownerEmail ? (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="truncate cursor-default max-w-[150px]">
                                        {device.ownerEmail}
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>{device.ownerEmail}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="max-w-[200px]">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="truncate cursor-default">
                                      {device.agentEmail || '-'}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{device.agentEmail || '-'}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </TableCell>
                            <TableCell className="max-w-[220px]">
                              <div className="font-mono text-sm font-medium break-all">{device.mcpNativeId}</div>
                              <div className="text-xs text-muted-foreground">{transformMcpName(device.mcpServerName)}</div>
                            </TableCell>
                            <TableCell>
                              <ConnectorLocations locations={device.locations} />
                            </TableCell>
                            <TableCell>{device.agentName}</TableCell>
                            <TableCell>{device.plan}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{device.lastSeen}</TableCell>
                            {selectedStatus === "3" && (
                              <TableCell>
                                {device.metadata && (
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-8 w-8">
                                        <Info className="h-4 w-4 text-muted-foreground" />
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-80">
                                      <div className="space-y-3">
                                        <div className="font-medium">{DISMISSAL_REASON_MAP[device.metadata.dismissalReason] || 'Unknown'}</div>
                                        <div className="text-xs text-muted-foreground">
                                          Dismissed by {device.metadata.dismissedBy || 'N/A'}
                                          <br />
                                          on {device.metadata.dismissedAt ? new Date(device.metadata.dismissedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'} at {device.metadata.dismissedAt ? new Date(device.metadata.dismissedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''}
                                        </div>
                                        {device.metadata.dismissalComment && (
                                          <div className="border-t pt-3">
                                            <div className="text-xs font-medium text-muted-foreground mb-1">Comment:</div>
                                            <div className="text-xs text-foreground">{device.metadata.dismissalComment}</div>
                                          </div>
                                        )}
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                )}
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </ScrollArea>
              </motion.div>
            )}

            {incidentModalView === 'dismiss' && (
              <motion.div
                key="dismiss"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.08 }}
                className="space-y-6 min-h-[200px]"
              >
                <DialogHeader>
                  <div className="flex items-center gap-2">
                    {!isDismissAllFlow && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIncidentModalView('list')}
                        className="h-8 w-8"
                      >
                        <ArrowLeft className="h-4 w-4" />
                      </Button>
                    )}
                    <div>
                      <DialogTitle>
                        {incidentModalLoading ? (
                          <Skeleton className="h-6 w-48" />
                        ) : selectedIncidents.size === incidentModalData.length ? (
                          'Dismiss All Incidents'
                        ) : (
                          `Dismiss ${selectedIncidents.size} Incident${selectedIncidents.size !== 1 ? 's' : ''}`
                        )}
                      </DialogTitle>
                      <DialogDescription>
                        Provide details for dismissing the incidents
                        {currentIssue && (
                          <> for <span className="font-semibold text-foreground">{currentIssue.name}</span></>
                        )}
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Dismissal Reason <span className="text-destructive">*</span>
                    </label>
                    <Select value={dismissalReason} onValueChange={setDismissalReason}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a reason..." />
                      </SelectTrigger>
                      <SelectContent>
                        {DISMISSAL_REASON_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-medium">Comment</label>
                      <span className="text-xs text-muted-foreground">
                        {dismissalComment.length}/500
                      </span>
                    </div>
                    <Textarea
                      placeholder="Explain why you're dismissing these incidents..."
                      value={dismissalComment}
                      onChange={(e) => {
                        if (e.target.value.length <= 500) {
                          setDismissalComment(e.target.value)
                        }
                      }}
                      className="min-h-[120px] resize-none"
                    />
                  </div>

                  <div className="space-y-2">
                    {preventFuture && (
                      <div className="ml-6 mt-3 p-3 border rounded-md bg-muted/50 space-y-2">
                        {policyControlsLoading ? (
                          <div className="space-y-2">
                            <Skeleton className="h-3 w-40" />
                            <Skeleton className="h-3 w-64" />
                            <div className="space-y-1 mt-2">
                              <Skeleton className="h-8 w-full" />
                              <Skeleton className="h-8 w-full" />
                            </div>
                          </div>
                        ) : policyControls !== null && policyControls.length === 0 ? (
                          <div className="text-xs text-muted-foreground">Future detections already prevented</div>
                        ) : policyControls !== null ? (
                          <>
                            <div className="text-xs font-medium text-foreground mb-1">
                              Risk Rule: {currentIssue?.risk_rule_name}
                            </div>
                            <div className="text-xs text-muted-foreground mb-3">
                              Update policy expected state to prevent future detections
                            </div>
                            <ScrollArea className="max-h-[200px]">
                              <div className="space-y-2 py-1">
                                {policyControls.map((control: any) => {
                                  const selection = selectedPolicyControlScores.get(control.id) as any
                                  const isEnabled = selection?.enabled ?? false
                                  const hasOptions = availableIssueTypes.length > 0
                                  return (
                                    <div key={control.id} className="flex items-center gap-2 text-sm">
                                      <Checkbox
                                        checked={selectedPolicyControlScores.has(control.id)}
                                        onCheckedChange={(checked) => {
                                          const newMap = new Map(selectedPolicyControlScores)
                                          if (checked) {
                                            const defaultId = availableIssueTypes[0]?.id || null
                                            if (defaultId) {
                                              newMap.set(control.id, { enabled: true, issueTypeControlId: defaultId })
                                            } else if (disabledIssueType) {
                                              newMap.set(control.id, { enabled: false, issueTypeControlId: disabledIssueType.id })
                                            }
                                          } else {
                                            newMap.delete(control.id)
                                          }
                                          setSelectedPolicyControlScores(newMap)
                                        }}
                                      />
                                      <div className="flex-1">
                                        <div className="font-medium">{control.policyName}</div>
                                      </div>
                                      <div className="flex items-center gap-2 pr-1">
                                        <div className="text-xs text-muted-foreground">Current:</div>
                                        <span className="font-medium">
                                          {control.expectedValue || 'N/A'}
                                        </span>
                                        <span>→</span>
                                        {hasOptions && (
                                          <Switch
                                            checked={isEnabled}
                                            onCheckedChange={(checked) => {
                                              const newMap = new Map(selectedPolicyControlScores)
                                              if (checked) {
                                                newMap.set(control.id, { enabled: true, issueTypeControlId: availableIssueTypes[0]?.id })
                                              } else {
                                                newMap.set(control.id, { enabled: false, issueTypeControlId: disabledIssueType?.id })
                                              }
                                              setSelectedPolicyControlScores(newMap)
                                            }}
                                          />
                                        )}
                                        {isEnabled ? (
                                          <Select
                                            value={selection?.issueTypeControlId || ""}
                                            onValueChange={(value) => {
                                              const newMap = new Map(selectedPolicyControlScores)
                                              newMap.set(control.id, { enabled: true, issueTypeControlId: value })
                                              setSelectedPolicyControlScores(newMap)
                                            }}
                                          >
                                            <SelectTrigger className="w-fit min-w-48 h-8">
                                              <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {availableIssueTypes.map((it: any) => (
                                                <SelectItem key={it.id} value={it.id}>
                                                  {it.expected_value}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        ) : (
                                          <span className="text-muted-foreground text-xs">Disabled</span>
                                        )}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </ScrollArea>
                          </>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => isDismissAllFlow ? setShowIncidentModal(false) : setIncidentModalView('list')}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    className="gap-2"
                    disabled={!dismissalReason || dismissLoading}
                    onClick={handleDismiss}
                  >
                    {dismissLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                    Dismiss Incidents
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>

      {/* Reopen Dialog */}
      <Dialog open={showReopenDialog} onOpenChange={setShowReopenDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reopenLoading ? (
                <Skeleton className="h-6 w-48" />
              ) : selectedIncidents.size === incidentModalData.length ? (
                'Reopen All Incidents'
              ) : (
                `Reopen ${selectedIncidents.size} Incident${selectedIncidents.size !== 1 ? 's' : ''}`
              )}
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to reopen these incidents
              {currentIssue && (
                <> for <span className="font-semibold text-foreground">{currentIssue.name}</span></>
              )}?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setShowReopenDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleReopen}
              disabled={reopenLoading}
              variant="default"
              className="gap-2"
            >
              {reopenLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
              Reopen
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default McpIssuesTable
