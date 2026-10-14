import { useRef, useEffect, useState } from "react"
import { orgRpcArgs } from '@/lib/orgScope';
import { supabase } from "@/integrations/supabase/client"
import { DeviceOwnerHeader } from "@/components/DeviceOwnerHeader"
import { useNavigate, Link } from "react-router-dom"
import { ArrowLeft, AlertTriangle, Eye, EyeOff, Laptop, Download, Loader2, XCircle, RotateCcw, Info, MoreVertical, CheckCircle2, Lock, ChevronDown, ChevronLeft, ChevronRight, Copy, Check, Paperclip, MessageSquare, ExternalLink, Target } from "lucide-react"
import { useRedTeam, type Finding } from "@/lib/redteam/store"
import { FindingDialog, RedTeamIncidentsDialog, groupRedTeamFindings, type RedTeamGroup } from "@/components/redteam/RedTeamFindings"
import { ASSESSMENT, BRAINTRUST } from "@/lib/redteam/dataset"
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/contexts/AuthContext"
import { useOrg } from "@/contexts/OrgContext"
import { traceforcApi } from "@/integrations/traceforce/client"
import type { ContainmentOp } from "@/integrations/traceforce/types"
import type { MdmIntegration } from "@/integrations/traceforce/types"
import { useToast } from "@/hooks/use-toast"
import {
  getRiskBadge, getIssueStatusBadge, ISSUE_STATUS_MAP, getRiskBadgeVariant,
  DISMISSAL_REASON_OPTIONS, DISMISSAL_REASON_MAP,
  SEVERITY_LEVELS,
  ISSUE_DETAIL_TO_CATEGORY, SENSITIVE_DATA_TYPE_LABELS,
  FINDING_STATUS_LABELS, getFindingStatusBadgeClass,
  getStatusOptionsForCategory, FINDING_STATUS_DESCRIPTIONS,
  SENSITIVE_DATA_CATEGORY_API_STRINGS, SENSITIVE_DATA_TYPE_API_TO_NUM,
  FINDING_STATUS_API_TO_NUM, FINDING_STATUS_NUM_TO_API, OPEN_FINDING_STATUSES_API, CLOSED_FINDING_STATUSES_API,
  OPEN_COUNT_BADGE_CLASS, RESOLVED_BADGE_CLASS,
  CONTAINMENT_ISSUE_DETAILS, CONTAINMENT_OP_LABELS, CONTAINMENT_STATUS_OPTIONS,
  PROMPT_INJECTION_ISSUE_DETAILS,
  CONTAINMENT_ISSUE_DETAIL_TO_CATEGORY, RISKY_ACTION_SUBCATEGORY_LABELS,
  RISKY_ACTION_SUBCATEGORY_API_TO_NUM, RISKY_ACTION_CATEGORY_NUM_TO_API,
  anyMdmNeedsAttention, SENSITIVE_DATA_DETECTION_DOCS_URL,
  RISKY_ACTION_DETECTION_DOCS_URL
} from "@/lib/appUtils"
import { downloadCsv, csvTimestamp } from "@/lib/csvUtils"

// Nullish-tolerant: call sites pass currentIssue?.issue_detail, and an
// unloaded issue is neither kind.
const isSensitiveDataIssue = (issueDetail: number | undefined) =>
  issueDetail != null && issueDetail in ISSUE_DETAIL_TO_CATEGORY
const isContainmentIssue = (issueDetail: number | undefined) =>
  issueDetail != null && CONTAINMENT_ISSUE_DETAILS.has(issueDetail)
const isPromptInjectionIssue = (issueDetail: number | undefined) =>
  issueDetail != null && PROMPT_INJECTION_ISSUE_DETAILS.has(issueDetail)
const isExpandableFindingsIssue = (issueDetail: number) =>
  isSensitiveDataIssue(issueDetail) || isContainmentIssue(issueDetail) || isPromptInjectionIssue(issueDetail)

const findingTypeLabel = (issueDetail: number | undefined, type: string) => {
  if (issueDetail != null && isContainmentIssue(issueDetail)) {
    // Containment rows are keyed by the RiskyActionSubcategory NAME; map it to the
    // numeric label key, then fall back to the raw value.
    return RISKY_ACTION_SUBCATEGORY_LABELS[RISKY_ACTION_SUBCATEGORY_API_TO_NUM[type]] || type
  }
  return SENSITIVE_DATA_TYPE_LABELS[SENSITIVE_DATA_TYPE_API_TO_NUM[type]] || type
}

// Close-reason picker shared by the per-match Close-as (footer) and the group
// bulk close (header). Callers pass the reason options — category-scoped for
// sensitive data, the containment close set for containment — so the popover
// itself is issue-type agnostic.
const CloseReasonPopover = ({ options, trigger, onSubmit }: {
  options: Array<{ value: number; label: string }>
  trigger: React.ReactElement
  onSubmit: (status: number, comment: string) => void
}) => {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<number | null>(null)
  const [comment, setComment] = useState("")
  return (
    <Popover open={open} onOpenChange={(o) => {
      setOpen(o)
      if (!o) {
        setSelected(null)
        setComment("")
      }
    }}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="end" side="right" className="w-80 p-0 z-[200]">
        <div className="p-2">
          {options.map((option) => (
            <div
              key={option.value}
              onClick={() => setSelected(option.value)}
              className={`flex flex-col items-start p-3 cursor-pointer hover:bg-accent hover:text-accent-foreground ${
                selected === option.value ? 'bg-accent text-accent-foreground' : ''
              }`}
            >
              <div className="flex items-center gap-2 w-full">
                <div className={`w-2 h-2 rounded-full border ${
                  selected === option.value ? 'bg-primary border-primary' : 'border-muted-foreground'
                }`} />
                <div className="font-medium text-sm">{option.label}</div>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5 ml-4">
                {FINDING_STATUS_DESCRIPTIONS[option.value]}
              </div>
            </div>
          ))}
        </div>

        {selected && (
          <div className="border-t p-4 space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium">Comment</label>
                <span className="text-xs text-muted-foreground">{comment.length}/500</span>
              </div>
              <Textarea
                placeholder="Add a comment"
                value={comment}
                onChange={(e) => {
                  if (e.target.value.length <= 500) setComment(e.target.value)
                }}
                className="min-h-[80px] resize-none"
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" className="gap-2" onClick={() => {
                if (selected) {
                  onSubmit(selected, comment)
                  setOpen(false)
                }
              }}>
                Close
              </Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

const CopyableValue = ({ value, className = '' }: { value: string; className?: string }) => {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={handleCopy}
          className={`font-mono text-xs truncate ml-4 cursor-pointer hover:text-foreground transition-colors inline-flex items-center gap-1 min-w-0 ${className}`}
        >
          <span className="truncate">{value}</span>
          {copied ? <Check className="h-3 w-3 text-green-500 shrink-0" /> : <Copy className="h-3 w-3 opacity-0 group-hover:opacity-100 shrink-0" />}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-sm break-all font-mono text-xs">
        {value}
      </TooltipContent>
    </Tooltip>
  )
}

const ContentSnippet = ({
  content, highlightStart, highlightEnd, isRevealed, onToggleReveal, sensitiveOverride,
}: {
  content: string; highlightStart: number; highlightEnd: number
  isRevealed: boolean; onToggleReveal: () => void
  sensitiveOverride?: string
}) => {
  const highlightRef = useRef<HTMLSpanElement>(null)
  const before = content.slice(0, highlightStart)
  const sensitive = sensitiveOverride ?? content.slice(highlightStart, highlightEnd)
  const after = content.slice(highlightEnd)
  // No sensitive span to mark (e.g. prompt injection passes an empty 0,0 range):
  // render the content plain, so an empty highlight span doesn't show as a
  // stray yellow sliver.
  const hasHighlight = !!sensitiveOverride || highlightStart !== highlightEnd

  useEffect(() => {
    if (isRevealed && highlightRef.current) {
      // Small delay to ensure DOM is updated
      setTimeout(() => {
        highlightRef.current?.scrollIntoView({ block: 'start', inline: 'nearest', behavior: 'smooth' })
      }, 0)
    }
  }, [isRevealed])

  if (!isRevealed) {
    // Show concealed state - uniform 20 bullets with eye icon
    return (
      <span
        role="button"
        tabIndex={0}
        onClick={onToggleReveal}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleReveal(); } }}
        className="inline-flex items-center gap-1 px-2 py-1 rounded cursor-pointer transition-colors bg-muted hover:bg-muted/70"
        title="Click to reveal content"
      >
        <EyeOff className="h-3 w-3" />
        <span>{'•'.repeat(20)}</span>
      </span>
    )
  }

  // Show revealed state with highlighted sensitive portion - entire text clickable
  return (
    <span
      className="whitespace-pre-wrap break-all cursor-pointer"
      role="button"
      tabIndex={0}
      onClick={onToggleReveal}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleReveal(); } }}
      title="Click to conceal content"
    >
      <span>{before}</span>
      {hasHighlight && (
        <span
          ref={highlightRef}
          className="bg-yellow-200 dark:bg-yellow-900/50 text-foreground px-1 rounded"
        >
          {sensitiveOverride || sensitive}
        </span>
      )}
      <span>{after}</span>
    </span>
  )
}

// Renders a containment event's verbatim tool input. The document is whatever
// the agent sent — usually a JSON object ({"command": ..., "cwd": ...}),
// occasionally a bare string — so render generically: one labeled row per
// top-level field (string values verbatim, with their real newlines; anything
// else as compact JSON), or the raw text when the document isn't a non-empty
// JSON object. Generic on purpose: any agent's input shape renders correctly
// with no per-agent field vocabulary to maintain.
const ToolInputFields = ({ raw, shell = false }: { raw: string; shell?: boolean }) => {
  // Display strings are precomputed inside the try so a stringify failure on
  // exotic input (RangeError on pathologically deep nesting — the input is
  // agent-authored, so adversarial shapes are in scope) degrades to the
  // raw-text path instead of throwing mid-render and unmounting the app.
  let rows: [string, string][] | null = null
  try {
    const parsed = JSON.parse(raw)
    // A shell tool's input carries the command under full_command (the
    // untruncated line), with bash_command (just the leading word) and
    // description as redundant siblings — showing all three is noise. Render
    // the one command line as the "Full command" instead of a field dump.
    // Keyed on the caller's tool_name (shell), NOT on a "command" key, so an
    // MCP tool that happens to take a command arg still gets the full field view.
    if (shell && parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const cmd = parsed.full_command ?? parsed.command ?? parsed.bash_command
      if (typeof cmd === 'string' && cmd.trim()) {
        return <pre className="whitespace-pre-wrap break-all">{cmd}</pre>
      }
    }
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && Object.keys(parsed).length > 0) {
      // Drop fields whose value is empty (e.g. an empty cwd) — a label over a
      // bare em-dash is noise. Non-string values keep their compact JSON form
      // ("null"/"0"/"false" are meaningful, so they survive the filter).
      const entries = Object.entries(parsed)
        .map(([key, value]) =>
          [key, typeof value === 'string' ? value : JSON.stringify(value)] as [string, string]
        )
        .filter(([, value]) => value.trim() !== '')
      rows = entries.length > 0 ? entries : null
    }
  } catch { /* bare-string or unstringifiable tool input: render raw */ }
  if (!rows) return <pre className="whitespace-pre-wrap break-all">{raw.trim() ? raw : '—'}</pre>
  return (
    <div className="space-y-2">
      {rows.map(([key, value]) => (
        <div key={key}>
          <div className="text-xs text-muted-foreground mb-0.5 break-all">{key}</div>
          <pre className="whitespace-pre-wrap break-all">{value}</pre>
        </div>
      ))}
    </div>
  )
}

// Maps a failed content-fetch response to the evidence pane's error key.
// Shared by the sensitive-data content fetch and the containment full-command
// fetch so the status-code vocabulary can't drift between the two.
const contentFetchErrorKey = (res: { statusCode?: number; code?: string }): string => {
  if (res.statusCode === 422) {
    // no_content = nothing was stored; content_unreadable = object exists but is unusable.
    return res.code === 'CONTENT_UNREADABLE' ? 'content_unreadable' : 'no_storage'
  }
  if (res.statusCode === 415) return 'unsupported_format'
  if (res.statusCode === 410) return 'expired'
  if (res.statusCode === 404) return 'not_found'
  return 'fetch_failed'
}

interface AgentIssuesTableProps {
  violations: any[]
  selectedStatus: string
  loading: boolean
  error: string | null
  onRefresh: () => void
  fetchDeviceData: (issueTypeControlId: string, limit?: number, riskRuleType?: number) => Promise<any[]>
  onIssueTypeClick?: (riskRuleId: string, frameworkId: string) => void
  /** Show red-team findings as rows in Controllable Issues (Agent Issues page only). */
  showRedTeamFindings?: boolean
}

const AgentIssuesTable = ({
  violations,
  selectedStatus,
  loading,
  error,
  onRefresh,
  fetchDeviceData,
  onIssueTypeClick,
  showRedTeamFindings = false,
}: AgentIssuesTableProps) => {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { session } = useAuth()
  const { activeOrgId } = useOrg()
  // Red-team findings join Controllable Issues only after a test has completed.
  const { findings: redTeamFindings, runState: redTeamRunState } = useRedTeam()
  const [redTeamFinding, setRedTeamFinding] = useState<Finding | null>(null)
  const [redTeamGroup, setRedTeamGroup] = useState<RedTeamGroup | null>(null)
  // One row per issue type, aggregated across every tested agent — the same
  // model as the device rows: a type with N incidents, drill in for the list.
  const redTeamRows: RedTeamGroup[] =
    showRedTeamFindings && redTeamRunState === "completed"
      ? groupRedTeamFindings(redTeamFindings)
      : []

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
  const [agentAckOpen, setAgentAckOpen] = useState(false)
  // Aggregated finding counts per account (exact) and per container×type group
  // (capped server-side at the newest containers per account).
  const [findingCounts, setFindingCounts] = useState<Map<string, { open_count: number; closed_count: number; container_count: number }>>(new Map())
  const [findingGroups, setFindingGroups] = useState<Map<string, any[]>>(new Map())
  const [findingsLoading, setFindingsLoading] = useState(false)
  // Level-2 group evidence modal: the selected container×type group and its
  // cursor-paginated match list (one tab's worth at a time).
  const [currentGroup, setCurrentGroup] = useState<any>(null)
  const [groupTab, setGroupTab] = useState<'open' | 'closed'>('open')
  // Latest-value mirror for async handlers that outlive a tab switch.
  const groupTabRef = useRef(groupTab)
  groupTabRef.current = groupTab
  const [groupMatches, setGroupMatches] = useState<any[]>([])
  const [groupNextToken, setGroupNextToken] = useState<string | null>(null)
  const [groupMatchesLoading, setGroupMatchesLoading] = useState(false)
  const [expandedIncidents, setExpandedIncidents] = useState<Set<string>>(new Set())
  const [customerStorage, setCustomerStorage] = useState<any>(null)
  const [customerStorageLoaded, setCustomerStorageLoaded] = useState(false)
  const [loggingEnabled, setLoggingEnabled] = useState<boolean | null>(null)
  const [loggingPolicyId, setLoggingPolicyId] = useState<string | null>(null)
  const [showFindingDetail, setShowFindingDetail] = useState(false)
  const [currentFinding, setCurrentFinding] = useState<any>(null)
  const [findingContent, setFindingContent] = useState<any>(null)
  const [findingContentLoading, setFindingContentLoading] = useState(false)
  const [findingContentError, setFindingContentError] = useState<string | null>(null)
  const [revealedData, setRevealedData] = useState(false)
  const [showDecoded, setShowDecoded] = useState(false)

  // Computed MDM states — derived from full array for provider-agnostic coverage
  const mdmNeedsAttention = anyMdmNeedsAttention(mdmIntegrations)
  const mdmNotConfigured = mdmLoaded && mdmIntegrations.length === 0

  // Computed storage states
  const storageNotConfigured = customerStorageLoaded && !customerStorage
  const storageHasError = customerStorageLoaded && customerStorage?.is_customer_error
  const storageHealthy = customerStorageLoaded && customerStorage && !customerStorage.is_customer_error

  useEffect(() => {
    if (session?.access_token) {
      fetchMdmIntegration()
      fetchCustomerStorage()
    }
  }, [session?.access_token])

  const fetchCustomerStorage = async () => {
    if (!session?.access_token) return
    try {
      const response = await traceforcApi.getCustomerStorage(session.access_token)
      if (response.error) {
        throw new Error(response.error)
      }
      if (response.data) {
        setCustomerStorage(response.data)
      }
      setCustomerStorageLoaded(true)
    } catch (error) {
      console.error('Error fetching customer storage:', error)
    }
  }

  // Logging (audit history) state for the finding-detail modal. has_remediation is
  // the real gate the device checks (ShouldEnableLogging); policy_status stays
  // active whether logging is on or off. The RPC also returns the policy id so the
  // CTA can deep-link to it. One category-3 logging policy in practice.
  useEffect(() => {
    if (!activeOrgId) return
    supabase.rpc('get_agent_enforceable_policies_for_remediation_type', {
      ...orgRpcArgs(activeOrgId),
      p_remediation_type: 5,
      p_risk_rule_type: 16,
    }).then(({ data, error }) => {
      if (error) {
        console.error('Error fetching logging policy state:', error)
        return
      }
      const rows = data || []
      const enabled = rows.find((p: any) => p.has_remediation)
      setLoggingEnabled(rows.length > 0 ? !!enabled : null)
      setLoggingPolicyId((enabled ?? rows[0])?.policy_id ?? null)
    })
  }, [activeOrgId])

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
        // Last item (highest trigger_score) is the disabled option
        const disabledOption = allEligible.length > 0 ? allEligible[allEligible.length - 1] : null
        const selectableOptions = allEligible.length > 1 ? allEligible.slice(0, -1) : []
        setAvailableIssueTypes(selectableOptions)
        setDisabledIssueType(disabledOption)

        const defaultIssueTypeId = selectableOptions[0]?.id || null
        const initialSelections = new Map()
        mappedData.forEach((pc: any) => {
          // Default: enabled with lowest option if options exist, otherwise disabled
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

      const { error } = await supabase.rpc('dismiss_agent_issues_with_policy_updates', {
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

      const { error } = await supabase.rpc('reopen_agent_issues', {
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
    setExpandedIncidents(new Set())
    setFindingCounts(new Map())
    setFindingGroups(new Map())
  }

  const fetchFindingCounts = async (issueDetail: number, accountIds: string[]) => {
    const accessToken = session?.access_token
    if (accountIds.length === 0 || !accessToken) return

    const containment = isContainmentIssue(issueDetail)
    const promptInjection = isPromptInjectionIssue(issueDetail)
    const category = ISSUE_DETAIL_TO_CATEGORY[issueDetail]
    const categoryString = SENSITIVE_DATA_CATEGORY_API_STRINGS[category]
    if (!containment && !promptInjection && (!category || !categoryString)) return

    setFindingsLoading(true)
    try {
      // Batch to the endpoint's per-request account cap; also keeps the query
      // string bounded for large incident lists.
      const chunks: string[][] = []
      for (let i = 0; i < accountIds.length; i += 100) chunks.push(accountIds.slice(i, i + 100))
      // The issue detail names the category: each rule-19 incident (181-184)
      // maps to one RiskyActionCategory, so the endpoint filters both counts and
      // groups to that category (mirrors sensitive data's category scoping).
      const containmentCategory = CONTAINMENT_ISSUE_DETAIL_TO_CATEGORY[issueDetail]
      const results = await Promise.all(chunks.map(chunk =>
        containment
          ? traceforcApi.getContainmentFindingCounts(accessToken, { agent_account_ids: chunk, risky_action_category: RISKY_ACTION_CATEGORY_NUM_TO_API[containmentCategory] })
          : promptInjection
          ? traceforcApi.getPromptInjectionFindingCounts(accessToken, { agent_account_ids: chunk })
          : traceforcApi.getFindingCounts(accessToken, {
              agent_account_ids: chunk,
              category: categoryString,
            })
      ))

      const counts = new Map<string, { open_count: number; closed_count: number; container_count: number }>()
      const groups = new Map<string, any[]>()
      for (const res of results) {
        if (res.error) throw new Error(res.error)
        for (const a of res.data?.accounts || []) {
          counts.set(a.agent_account_id, a)
        }
        for (const g of res.data?.groups || []) {
          // Containment groups carry the risky_action_subcategory NAME on the wire;
          // the group rendering and match fetching key off `type`, so normalize the
          // subcategory name onto `type` once here. A group without a subcategory
          // (legacy op-only rows) can't be labeled or re-fetched, so drop it.
          if (containment && !g.risky_action_subcategory) {
            console.warn('Skipping containment group without a subcategory:', g)
            continue
          }
          if (!groups.has(g.agent_account_id)) groups.set(g.agent_account_id, [])
          groups.get(g.agent_account_id)!.push(containment ? { ...g, type: g.risky_action_subcategory } : g)
        }
      }
      setFindingCounts(counts)
      setFindingGroups(groups)
    } catch (err) {
      console.error('Error fetching finding counts:', err)
    } finally {
      setFindingsLoading(false)
    }
  }

  // The REST API speaks string enums and pre-formatted storage paths; the modal
  // and label/badge maps are keyed by the numeric values, so convert each match
  // row into the internal finding shape once at the fetch boundary.
  const toInternalFinding = (r: any) => {
    if (isContainmentIssue(currentIssue?.issue_detail)) {
      return {
        id: r.id,
        // Containment rows are keyed by the risky_action_subcategory NAME (the label
        // unit for grouping + headings). Coalesce to '' so an absent value never
        // renders as "undefined". Rows are fetched filtered by the group's category
        // + subcategory, so today this always matches the guarded group.
        type: r.risky_action_subcategory ?? '',
        // op (write/delete) is the event's actual Operation, shown verbatim in the
        // detail panel. It is a separate dimension from the subcategory on `type`:
        // the detail's "Operation" field must expose write-vs-delete, not the
        // subcategory label.
        op: r.op,
        // Fail loud on an unknown status (API/UI vocabulary drift): the
        // fetch's catch shows an error instead of mislabeling a reviewed
        // finding as Open.
        finding_status: (() => {
          const status = FINDING_STATUS_API_TO_NUM[r.status]
          if (status === undefined) throw new Error(`Unknown containment finding status: ${r.status}`)
          return status
        })(),
        category: undefined,
        message_timestamp: r.detected_at,
        // Stable per-row id: the agent-supplied tool-use id when present, else
        // the finding's own id — never tool_name, which collides across rows.
        message_id: r.tool_use_id || r.id,
        // Dedicated field for display: the metadata panel labels it
        // "Tool Use ID", so it must never fall back to the row id.
        tool_use_id: r.tool_use_id || null,
        tool_name: r.tool_name || '',
        target_path: r.operation || '',
        archive_inner_path: null,
        encoding_type: null,
        start_line: null,
        end_line: null,
        file_id: null,
        conversation_id: r.conversation_id,
        conversation_name: r.conversation_name,
        file_name: null,
        source_path: r.source_path ?? null,
        snippet_path: r.snippet_path ?? null,
        metadata: {
          statusComment: r.status_comment,
          statusUpdatedAt: r.status_updated_at,
          statusUpdatedBy: r.status_updated_by,
        },
      }
    }
    if (isPromptInjectionIssue(currentIssue?.issue_detail)) {
      return {
        id: r.id,
        // Prompt injection has no type/op/file dimension — the finding IS the
        // conversation-level flag. The model's sanitized description is the
        // headline shown in the modal.
        type: undefined,
        finding_status: (() => {
          const status = FINDING_STATUS_API_TO_NUM[r.status]
          if (status === undefined) throw new Error(`Unknown prompt-injection finding status: ${r.status}`)
          return status
        })(),
        category: undefined,
        message_timestamp: r.detected_at,
        message_id: r.message_id,
        description: r.description ?? null,
        tool_use_id: null,
        tool_name: '',
        target_path: '',
        archive_inner_path: null,
        encoding_type: null,
        start_line: null,
        end_line: null,
        file_id: null,
        conversation_id: r.conversation_id,
        conversation_name: r.conversation_name,
        file_name: null,
        source_path: r.source_path ?? null,
        snippet_path: r.snippet_path ?? null,
        metadata: {
          statusComment: r.status_comment,
          statusUpdatedAt: r.status_updated_at,
          statusUpdatedBy: r.status_updated_by,
        },
      }
    }
    return {
      id: r.id,
      type: SENSITIVE_DATA_TYPE_API_TO_NUM[r.type],
      finding_status: FINDING_STATUS_API_TO_NUM[r.status],
      category: ISSUE_DETAIL_TO_CATEGORY[currentIssue?.issue_detail],
      message_timestamp: r.message_timestamp,
      message_id: r.message_id,
      archive_inner_path: r.archive_inner_path,
      encoding_type: r.encoding_type,
      start_line: r.start_line, // 1-based from the API
      end_line: r.end_line,
      file_id: r.file_id,
      conversation_id: r.conversation_id,
      conversation_name: r.conversation_name,
      file_name: r.file_name,
      source_path: r.source_path,
      snippet_path: r.snippet_path,
      metadata: {
        statusComment: r.status_comment,
        statusUpdatedAt: r.status_updated_at,
        statusUpdatedBy: r.status_updated_by,
      },
    }
  }

  // Fetch one page of a group's matches for the given tab. File groups read in
  // file order (line asc); conversation groups read chronologically. The
  // source=message filter keeps a conversation group from matching the
  // attachment findings that share its conversation_id.
  const fetchGroupMatches = async (group: any, tab: 'open' | 'closed', nextToken?: string) => {
    const accessToken = session?.access_token
    if (!accessToken) return null
    setGroupMatchesLoading(true)
    try {
      if (isContainmentIssue(currentIssue?.issue_detail)) {
        const res = await traceforcApi.listContainmentFindings(accessToken, {
          conversation_ids: [group.conversation_id],
          // Containment groups are scoped by category + subcategory (the
          // subcategory rides `type`, normalized at the counts fetch).
          risky_action_category: group.risky_action_category,
          risky_action_subcategory: group.risky_action_subcategory,
          // Groups are per-subcategory (not per-tool), so this fetches every event
          // of the conversation-and-subcategory; the tool is a per-event detail.
          // Containment reuses the shared finding-status vocabulary minus the
          // credential-only close reasons (revoked / used_in_tests), which the
          // endpoint rejects.
          status: tab === 'open'
            ? OPEN_FINDING_STATUSES_API
            : CLOSED_FINDING_STATUSES_API.filter(s => s !== 'revoked' && s !== 'used_in_tests'),
          limit: 50,
          next_token: nextToken,
        })
        if (res.error) throw new Error(res.error)
        return mapPage(res.data)
      }
      if (isPromptInjectionIssue(currentIssue?.issue_detail)) {
        const res = await traceforcApi.listPromptInjectionFindings(accessToken, {
          // The group is the conversation alone — no op/tool/file sub-dimension.
          conversation_ids: [group.conversation_id],
          // Prompt injection reuses the shared finding-status vocabulary minus
          // the credential-only close reasons, which the endpoint rejects.
          status: tab === 'open'
            ? OPEN_FINDING_STATUSES_API
            : CLOSED_FINDING_STATUSES_API.filter(s => s !== 'revoked' && s !== 'used_in_tests'),
          limit: 50,
          next_token: nextToken,
        })
        if (res.error) throw new Error(res.error)
        return mapPage(res.data)
      }
      const res = await traceforcApi.listFindings(accessToken, {
        ...(group.file_id
          ? { file_ids: [group.file_id] }
          : { conversation_ids: [group.conversation_id], source: 'message' }),
        type: group.type,
        status: tab === 'open' ? OPEN_FINDING_STATUSES_API : CLOSED_FINDING_STATUSES_API,
        sort_by: group.file_id ? 'start_line' : 'message_timestamp',
        sort_order: 'asc',
        limit: 50,
        next_token: nextToken,
      })
      if (res.error) throw new Error(res.error)
      return mapPage(res.data)
    } catch (err) {
      console.error('Error fetching group matches:', err)
      return null
    } finally {
      setGroupMatchesLoading(false)
    }
  }

  // Mapping happens INSIDE fetchGroupMatches' try so a validation throw in
  // toInternalFinding (e.g. an unknown containment status) lands in its
  // catch — an empty list beats rendering mislabeled rows.
  const mapPage = (page: any) => page ? { ...page, data: page.data.map(toInternalFinding) } : null

  // Generation counter guarding the group modal's async fetches: opening a
  // group, switching tabs, and closing the modal each bump it, and a fetch
  // whose generation is no longer current discards its result. Without this a
  // slow response can reopen a closed modal or render one tab's matches under
  // the other tab.
  const groupFetchGenRef = useRef(0)

  // Open the Level-2 evidence modal on a container×type group. Starts on the
  // Open tab when there is open work, else on Closed (audit/re-reason view).
  const handleOpenGroup = async (group: any) => {
    const gen = ++groupFetchGenRef.current
    const tab = group.open_count > 0 ? 'open' : 'closed'
    setCurrentGroup(group)
    setGroupTab(tab)
    setGroupMatches([])
    setGroupNextToken(null)
    setShowFindingDetail(true)
    setCurrentFinding(null)
    setFindingContent(null)
    setFindingContentError(null)
    const page = await fetchGroupMatches(group, tab)
    if (!page || gen !== groupFetchGenRef.current) return
    const matches = page.data
    setGroupMatches(matches)
    setGroupNextToken(page.next_token)
    if (matches.length > 0) handleViewFinding(matches[0])
  }

  const handleSwitchGroupTab = async (tab: 'open' | 'closed') => {
    if (!currentGroup || tab === groupTab) return
    const gen = ++groupFetchGenRef.current
    setGroupTab(tab)
    setGroupMatches([])
    setGroupNextToken(null)
    setCurrentFinding(null)
    setFindingContent(null)
    setFindingContentError(null)
    const page = await fetchGroupMatches(currentGroup, tab)
    if (!page || gen !== groupFetchGenRef.current) return
    const matches = page.data
    setGroupMatches(matches)
    setGroupNextToken(page.next_token)
    if (matches.length > 0) handleViewFinding(matches[0])
  }

  // Ref, not state: two same-tick callers must see the in-flight flag
  // immediately or they both fetch the same page and double-append it.
  const loadingMoreRef = useRef(false)

  const handleLoadMoreMatches = async () => {
    if (!currentGroup || !groupNextToken || loadingMoreRef.current) return null
    loadingMoreRef.current = true
    try {
      const gen = groupFetchGenRef.current
      const page = await fetchGroupMatches(currentGroup, groupTab, groupNextToken)
      if (!page || gen !== groupFetchGenRef.current) return null
      const matches = page.data
      setGroupMatches(prev => [...prev, ...matches])
      setGroupNextToken(page.next_token)
      return matches
    } finally {
      loadingMoreRef.current = false
    }
  }

  const currentMatchIndex = groupMatches.findIndex(f => f.id === currentFinding?.id)

  // Row labels: file matches by line, conversation matches by date and time.
  // Duplicates are fine; the selection highlight and evidence pane tell
  // identical-looking rows apart, and the pager gives exact position.
  const matchLabel = (m: any) => {
    if (isContainmentIssue(currentIssue?.issue_detail)) {
      const tool = m.tool_name || 'tool'
      if (!m.message_timestamp) return tool
      const t = new Date(m.message_timestamp)
      return `${tool} · ${t.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
    }
    if (isPromptInjectionIssue(currentIssue?.issue_detail)) {
      // The finding IS its description — that's the issue identity in the list.
      // Fall back to the detected time when the model emitted no description.
      if (m.description) return m.description
      if (!m.message_timestamp) return 'undated'
      const t = new Date(m.message_timestamp)
      return `${t.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
    }
    if (currentGroup?.file_id) return `line ${m.start_line ?? '?'}`
    if (!m.message_timestamp) return 'undated'
    const t = new Date(m.message_timestamp)
    return `${t.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
  }

  const handlePrevMatch = () => {
    if (currentMatchIndex > 0) handleViewFinding(groupMatches[currentMatchIndex - 1])
  }

  const handleNextMatch = async () => {
    if (currentMatchIndex >= 0 && currentMatchIndex < groupMatches.length - 1) {
      handleViewFinding(groupMatches[currentMatchIndex + 1])
    } else if (groupNextToken) {
      const more = await handleLoadMoreMatches()
      if (more?.length) handleViewFinding(more[0])
    }
  }

  const closeGroupModal = () => {
    groupFetchGenRef.current++
    viewedFindingIdRef.current = null
    setShowFindingDetail(false)
    setCurrentGroup(null)
    setGroupMatches([])
    setGroupNextToken(null)
    setCurrentFinding(null)
    setFindingContent(null)
    setFindingContentError(null)
  }

  // The match the evidence pane is showing. A slow content fetch for an
  // earlier selection must never render its (sensitive) text under a newer
  // match's header, so every post-await write checks this ref first.
  const viewedFindingIdRef = useRef<string | null>(null)

  const handleViewFinding = async (finding: any) => {
    viewedFindingIdRef.current = finding.id
    setCurrentFinding(finding)
    setFindingContent(null)
    setFindingContentError(null)
    setRevealedData(false)
    setShowDecoded(true)
    setShowFindingDetail(true)

    // Containment has no status auto-promote path, but the verbatim tool
    // input is fetched eagerly on view: operation/target is name-only (an
    // MCP tool name, or empty for shell), so the customer-storage snippet is
    // the panel's primary content. Same stale-response guard as the
    // sensitive-data fetch below.
    if (isContainmentIssue(currentIssue?.issue_detail)) {
      // Always fetch, mirroring the sensitive-data branch: the server returns
      // 422 NO_CONTENT when customer_storage is null (contentFetchErrorKey maps
      // that to 'no_storage'), so the evidence pane's storage messaging stays
      // server-driven and picks up a snippet added by a later flush on re-select.
      setFindingContentLoading(true)
      try {
        const accessToken = session?.access_token
        if (!accessToken) return

        const res = await traceforcApi.getContainmentFindingContent(accessToken, finding.id)
        if (viewedFindingIdRef.current !== finding.id) return
        if (res.data) {
          setFindingContent(res.data)
        } else if (res.error) {
          setFindingContentError(contentFetchErrorKey(res))
        }
      } catch (err) {
        if (viewedFindingIdRef.current === finding.id) setFindingContentError('fetch_failed')
      } finally {
        if (viewedFindingIdRef.current === finding.id) setFindingContentLoading(false)
      }
      return
    }

    // Prompt injection mirrors containment: the verbatim injection origin is
    // the panel's primary content, fetched eagerly, and there is no status
    // auto-promote path. The server returns 422 NO_CONTENT when nothing was
    // stored, so the evidence pane's messaging stays server-driven.
    if (isPromptInjectionIssue(currentIssue?.issue_detail)) {
      setFindingContentLoading(true)
      try {
        const accessToken = session?.access_token
        if (!accessToken) return

        const res = await traceforcApi.getPromptInjectionFindingContent(accessToken, finding.id)
        if (viewedFindingIdRef.current !== finding.id) return
        if (res.data) {
          setFindingContent(res.data)
        } else if (res.error) {
          setFindingContentError(contentFetchErrorKey(res))
        }
      } catch (err) {
        if (viewedFindingIdRef.current === finding.id) setFindingContentError('fetch_failed')
      } finally {
        if (viewedFindingIdRef.current === finding.id) setFindingContentLoading(false)
      }
      return
    }

    setFindingContentLoading(true)

    // Auto-update "Awaiting Review" to "Under Review" when viewing
    if (finding.finding_status === 1) {
      try {
        const { error } = await supabase
          .from('sensitive_data_findings')
          .update({ finding_status: 2 })
          .eq('id', finding.id)
          .eq('finding_status', 1) // Only update if still in "Awaiting Review"

        if (error) throw error

        // Update local state
        setGroupMatches(prev => prev.map(f =>
          f.id === finding.id ? { ...f, finding_status: 2 } : f
        ))

        // Update current finding for modal display
        if (viewedFindingIdRef.current === finding.id) {
          setCurrentFinding({ ...finding, finding_status: 2 })
        }
      } catch (err) {
        console.error('Error auto-updating finding status:', err)
      }
    }

    try {
      const accessToken = session?.access_token
      if (!accessToken) return

      const res = await traceforcApi.getFindingContent(accessToken, finding.id)
      if (viewedFindingIdRef.current !== finding.id) return
      if (res.data) {
        setFindingContent(res.data)
      } else if (res.error) {
        setFindingContentError(contentFetchErrorKey(res))
      }
    } catch (err) {
      if (viewedFindingIdRef.current === finding.id) setFindingContentError('fetch_failed')
    } finally {
      if (viewedFindingIdRef.current === finding.id) setFindingContentLoading(false)
    }
  }

  // One rendering of a failed content fetch — the message (and its
  // storage-settings links) per error key, shared by the sensitive-data
  // Content card and the containment Full command panel so the wording and
  // remediation links can't drift between the two. noun names the record
  // kind in user-facing text.
  const renderContentFetchError = (noun: 'finding' | 'event') => {
    switch (findingContentError) {
      case 'no_storage':
        return (
          <div className="flex flex-col gap-2 text-muted-foreground text-sm">
            <span>{storageNotConfigured
              ? 'Storage provider is not configured.'
              : `No content was captured for this ${noun}.`}</span>
            {storageNotConfigured && (
              <Button variant="link" className="h-auto p-0 text-xs justify-start inline-flex items-center gap-1"
                onClick={() => navigate('/settings?section=customer-storage')}>
                <Lock className="h-3 w-3" /> Set up →
              </Button>
            )}
            {storageHasError && (
              <Button variant="link" className="h-auto p-0 text-xs text-amber-600 hover:text-amber-700 justify-start inline-flex items-center gap-1"
                onClick={() => navigate('/settings?section=customer-storage')}>
                <AlertTriangle className="h-3 w-3" /> Action needed →
              </Button>
            )}
          </div>
        )
      case 'content_unreadable':
        return <div className="text-muted-foreground text-sm"><span>This content is unavailable.</span></div>
      case 'unsupported_format':
        return <div className="text-muted-foreground text-sm"><span>Content preview is not available for this file format.</span></div>
      case 'expired':
        return <div className="text-muted-foreground text-sm"><span>This content is no longer available in your storage. It may have been removed by a retention policy or deleted.</span></div>
      case 'not_found':
        return <div className="text-muted-foreground text-sm"><span>Content not found.</span></div>
      default:
        // fetch_failed (and any future key contentFetchErrorKey emits).
        return (
          <div className="flex flex-col gap-2 text-muted-foreground text-sm">
            <span>{storageNotConfigured
              ? 'Failed to load content.'
              : storageHasError
                ? 'Failed to load content. Your storage configuration needs attention.'
                : 'Failed to load content. Please try again later.'}</span>
            {storageNotConfigured && (
              <Button variant="link" className="h-auto p-0 text-xs justify-start inline-flex items-center gap-1"
                onClick={() => navigate('/settings?section=customer-storage')}>
                <Lock className="h-3 w-3" /> Set up →
              </Button>
            )}
            {storageHasError && (
              <Button variant="link" className="h-auto p-0 text-xs text-amber-600 hover:text-amber-700 justify-start inline-flex items-center gap-1"
                onClick={() => navigate('/settings?section=customer-storage')}>
                <AlertTriangle className="h-3 w-3" /> Action needed →
              </Button>
            )}
          </div>
        )
    }
  }

  // Finding ids with a close request in flight: a re-click while the first
  // call is pending must not run the close bookkeeping (and count bumps) twice.
  const closingIdsRef = useRef<Set<string>>(new Set())

  // Move n findings of the current group from open to closed in the Level-1
  // counts (group row, currentGroup, account rollup). Clamped at zero: counts
  // can be stale-low when findings arrive between the counts fetch and the
  // drill, and a negative badge is worse noise than an undercount.
  const bumpGroupCounts = (n: number) => {
    if (!currentGroup) return
    const sameGroup = (g: any) =>
      g.conversation_id === currentGroup.conversation_id &&
      g.file_id === currentGroup.file_id &&
      // Containment groups are per-subcategory (type = subcategory); sensitive-data
      // groups match on type too. The tool is a per-event detail, not a group key.
      g.type === currentGroup.type
    const bump = (g: any) => sameGroup(g)
      ? { ...g, open_count: Math.max(0, g.open_count - n), closed_count: g.closed_count + n }
      : g
    setFindingGroups(prev => {
      const next = new Map(prev)
      const accountGroups = next.get(currentGroup.agent_account_id)
      if (accountGroups) next.set(currentGroup.agent_account_id, accountGroups.map(bump))
      return next
    })
    setCurrentGroup((g: any) => g ? { ...g, open_count: Math.max(0, g.open_count - n), closed_count: g.closed_count + n } : g)
    setFindingCounts(prev => {
      const next = new Map(prev)
      const acct = next.get(currentGroup.agent_account_id)
      if (acct) next.set(currentGroup.agent_account_id, {
        ...acct,
        open_count: Math.max(0, acct.open_count - n),
        closed_count: acct.closed_count + n,
      })
      return next
    })
  }

  const handleUpdateFindingStatus = async (findingId: string, newStatus: number, comment: string = '') => {
    const accessToken = session?.access_token
    if (!accessToken || closingIdsRef.current.has(findingId)) return
    closingIdsRef.current.add(findingId)
    try {
      const res = isContainmentIssue(currentIssue?.issue_detail)
        ? await traceforcApi.closeContainmentFindings(accessToken, {
            finding_ids: [findingId],
            status: FINDING_STATUS_NUM_TO_API[newStatus],
            comment,
          })
        : isPromptInjectionIssue(currentIssue?.issue_detail)
        ? await traceforcApi.closePromptInjectionFindings(accessToken, {
            finding_ids: [findingId],
            status: FINDING_STATUS_NUM_TO_API[newStatus],
            comment,
          })
        : await traceforcApi.closeFindings(accessToken, {
            finding_ids: [findingId],
            status: FINDING_STATUS_NUM_TO_API[newStatus],
            comment,
          })
      if (res.error) throw new Error(res.error)

      // The endpoint returns a count; the client knows the rest and stamps the
      // row locally, mirroring what the server wrote.
      const updated = (res.data?.updated_count ?? 0) > 0
      if (updated) {
        const updatedFinding = {
          finding_status: newStatus,
          metadata: {
            statusComment: comment,
            statusUpdatedAt: new Date().toISOString(),
            statusUpdatedBy: session?.user?.email ?? '',
          },
        }
        // groupTabRef, not the closure: the user may have switched tabs while
        // the request was in flight, and the closed match must not be filtered
        // out of the Closed tab it now legitimately belongs to.
        const closedFromOpenTab = groupTabRef.current === 'open' && updatedFinding.finding_status >= 3

        if (closedFromOpenTab) {
          // Triage is the cursor: closing removes the match from the open tab
          // and advances to the next unresolved one (same index after removal).
          // Functional update so a Load more resolving mid-close is kept.
          setGroupMatches(prev => prev.filter(f => f.id !== findingId))
          const idx = groupMatches.findIndex(f => f.id === findingId)
          // Skip matches whose own close RPC is still in flight so the cursor
          // never advances onto a row that is about to disappear.
          const remaining = groupMatches.filter(f => f.id !== findingId && !closingIdsRef.current.has(f.id))
          const next = remaining[Math.min(Math.max(idx, 0), remaining.length - 1)]
          if (next) {
            handleViewFinding(next)
          } else if (groupNextToken) {
            // Loaded page exhausted but the server has more open matches.
            const more = await handleLoadMoreMatches()
            if (more?.length) {
              handleViewFinding(more[0])
            } else {
              setCurrentFinding(null)
              setFindingContent(null)
              setFindingContentError(null)
            }
          } else {
            setCurrentFinding(null)
            setFindingContent(null)
            setFindingContentError(null)
          }

          // Keep the Level-1 counts live: one fewer open, one more closed.
          bumpGroupCounts(1)
        } else {
          // Re-reasoning a closed match (or a same-tab status change): update in place.
          setGroupMatches(prev => prev.map(f =>
            f.id === findingId ? { ...f, finding_status: updatedFinding.finding_status, metadata: updatedFinding.metadata } : f
          ))
          if (currentFinding?.id === findingId) {
            setCurrentFinding(prev => prev ? ({
              ...prev,
              finding_status: updatedFinding.finding_status,
              metadata: updatedFinding.metadata
            }) : prev)
          }
        }

        toast({
          title: `Marked as ${FINDING_STATUS_LABELS[newStatus]}`,
          description: "Finding status has been updated.",
        })
      } else {
        toast({ title: "Not updated", description: "This finding no longer exists.", variant: "destructive" })
      }
    } catch (err) {
      console.error('Error updating finding status:', err)
      toast({ title: "Error", description: "Failed to update finding status", variant: "destructive" })
    } finally {
      closingIdsRef.current.delete(findingId)
    }
  }

  // Close every open match in the current group with one request. Scoped to
  // the open subset server-side, so already-closed reasons are never rewritten.
  const handleBulkClose = async (newStatus: number, comment: string) => {
    const accessToken = session?.access_token
    if (!currentGroup || !accessToken) return
    try {
      const res = isContainmentIssue(currentIssue?.issue_detail)
        ? await traceforcApi.closeContainmentFindings(accessToken, {
            conversation_id: currentGroup.conversation_id,
            // Category incident group key + the row's subcategory.
            risky_action_category: currentGroup.risky_action_category,
            risky_action_subcategory: currentGroup.risky_action_subcategory,
            // Groups are per-subcategory, so this closes every event of the
            // conversation-and-subcategory group (the tool is a per-event detail).
            status: FINDING_STATUS_NUM_TO_API[newStatus],
            comment,
          })
        : isPromptInjectionIssue(currentIssue?.issue_detail)
        ? await traceforcApi.closePromptInjectionFindings(accessToken, {
            // The group is the conversation alone — the close sweeps its open
            // findings, no op/tool/file sub-scope.
            conversation_id: currentGroup.conversation_id,
            status: FINDING_STATUS_NUM_TO_API[newStatus],
            comment,
          })
        : await traceforcApi.closeFindings(accessToken, {
            conversation_id: currentGroup.conversation_id,
            file_id: currentGroup.file_id ?? undefined,
            type: currentGroup.type,
            status: FINDING_STATUS_NUM_TO_API[newStatus],
            comment,
          })
      if (res.error) throw new Error(res.error)
      const n = res.data?.updated_count ?? 0

      bumpGroupCounts(n)
      // The open tab's list is now fully resolved; clear it rather than show
      // rows the server just closed.
      if (groupTabRef.current === 'open') {
        groupFetchGenRef.current++
        viewedFindingIdRef.current = null
        setGroupMatches([])
        setGroupNextToken(null)
        setCurrentFinding(null)
        setFindingContent(null)
        setFindingContentError(null)
      }
      toast({
        title: `Closed ${n} finding${n !== 1 ? 's' : ''} as ${FINDING_STATUS_LABELS[newStatus]}`,
        description: "Open findings in this group have been closed.",
      })
    } catch (err) {
      console.error('Error bulk closing findings:', err)
      toast({ title: "Error", description: "Failed to close findings", variant: "destructive" })
    }
  }

  // Download the redacted source artifact this finding came from: the stored
  // attachment/member file for attachment findings, the conversation delta
  // otherwise. Only offered when that object exists in customer storage.
  const handleDownloadFinding = async () => {
    if (!currentFinding || !session?.access_token) return
    try {
      const res = isContainmentIssue(currentIssue?.issue_detail)
        ? await traceforcApi.getContainmentSourceDownloadUrl(session.access_token, currentFinding.id)
        : isPromptInjectionIssue(currentIssue?.issue_detail)
        ? await traceforcApi.getPromptInjectionSourceDownloadUrl(session.access_token, currentFinding.id)
        : await traceforcApi.getFindingSourceDownloadUrl(session.access_token, currentFinding.id)
      if (res.data?.url) {
        window.open(res.data.url, '_blank', 'noopener,noreferrer')
      } else {
        toast({ title: "Error", description: "Failed to download finding source", variant: "destructive" })
      }
    } catch (err) {
      console.error('Error downloading finding source:', err)
      toast({ title: "Error", description: "Failed to download finding source", variant: "destructive" })
    }
  }

  const handleShowIncidents = async (issue: any) => {
    resetIncidentModalState(issue, 'list')
    setIsDismissAllFlow(false)

    try {
      const mappedData = await fetchDeviceData(issue.issue_type_control_id, undefined, issue.risk_rule_type)
      setIncidentModalData(mappedData)

      if (isExpandableFindingsIssue(issue.issue_detail)) {
        const accountIds = [...new Set(mappedData.map((d: any) => d.agent_account_id).filter(Boolean))]
        fetchFindingCounts(issue.issue_detail, accountIds)
      }
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
      const mappedData = await fetchDeviceData(issue.issue_type_control_id, undefined, issue.risk_rule_type)
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
      const mappedData = await fetchDeviceData(issue.issue_type_control_id, undefined, issue.risk_rule_type)
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
      'Agent': incident.agentName || '-',
      'Plan': incident.plan || '-',
      'Agent User': incident.agentEmail || '-',
      'Issue Detected': incident.lastSeen || '-',
      'Last Active': incident.lastActive || '-',
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
      const data = await fetchDeviceData(issue.issue_type_control_id, undefined, issue.risk_rule_type)
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
        const data = await fetchDeviceData(issue.issue_type_control_id, undefined, issue.risk_rule_type)
        data.forEach((row: any) => allRows.push(mapIncidentToCsvRow(row, issue)))
      }
      const timestamp = csvTimestamp()
      downloadCsv(allRows, `agent-issues-${timestamp}.csv`)
    } catch (e) {
      console.error('Error exporting controllable incidents:', e)
      toast({ title: 'Export failed', description: 'Could not generate CSV', variant: 'destructive' })
    } finally {
      setExportLoading(null)
    }
  }

  const handleIssueTypeClick = (riskRuleId: string, frameworkId: string) => {
    if (onIssueTypeClick) {
      onIssueTypeClick(riskRuleId, frameworkId)
    }
  }

  // Separate issues by applicable_to
  const controllableIssues = violations.filter(v => v.applicable_to === 1)
  const acknowledgmentOnlyIssues = violations.filter(v => v.applicable_to === 2)

  const renderIssueRow = (violation: any) => (
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
        <div className="space-y-1">
          {onIssueTypeClick ? (
            <button
              onClick={() => handleIssueTypeClick(violation.risk_rule_id, violation.framework_id)}
              className="hover:opacity-80 transition-opacity cursor-pointer text-left text-sm font-medium underline decoration-dotted underline-offset-2"
            >
              {violation.risk_rule_name}
            </button>
          ) : (
            <span className="text-sm">{violation.risk_rule_name}</span>
          )}
          {isSensitiveDataIssue(violation.issue_detail) && (
            <a
              href={SENSITIVE_DATA_DETECTION_DOCS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-fit items-center gap-1 text-xs text-primary hover:underline"
            >
              Detection coverage
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {isContainmentIssue(violation.issue_detail) && (
            <a
              href={RISKY_ACTION_DETECTION_DOCS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-fit items-center gap-1 text-xs text-primary hover:underline"
            >
              Detection coverage
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </TableCell>
      <TableCell>{getIssueStatusBadge(violation.issue_status)}</TableCell>
      <TableCell>
        {new Date(violation.last_seen_at).toLocaleDateString('en-US', {
          year: 'numeric', month: 'short', day: 'numeric'
        })} {new Date(violation.last_seen_at).toLocaleTimeString('en-US', {
          hour: '2-digit', minute: '2-digit'
        })}
      </TableCell>
      {violation.applicable_to === 1 && (
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

  // Same cells as renderIssueRow, fed by a grouped red-team issue type. The
  // incidents pill and the menu open the per-agent incident list.
  const renderRedTeamGroupRow = (group: RedTeamGroup) => {
    const detected = new Date(ASSESSMENT.recordedAt)
    const n = group.incidents.length
    return (
      <TableRow key={`rt-${group.plugin}`}>
        <TableCell>
          <div
            className="cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => setRedTeamGroup(group)}
          >
            <Badge variant={group.severity === "High" ? "danger" : "warning"} className="gap-1.5">
              <Target className="h-3.5 w-3.5" />
              {n} incident{n > 1 ? 's' : ''}
            </Badge>
          </div>
        </TableCell>
        <TableCell className="font-medium max-w-md">
          <div className="break-words">{group.title}</div>
        </TableCell>
        <TableCell className="align-middle">
          <div className="space-y-1">
            <button
              onClick={() => setRedTeamGroup(group)}
              className="hover:opacity-80 transition-opacity cursor-pointer text-left text-sm font-medium underline decoration-dotted underline-offset-2"
            >
              {group.category}
            </button>
            <a
              href={BRAINTRUST.traceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-fit items-center gap-1 text-xs text-primary hover:underline"
            >
              Trace in Braintrust
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </TableCell>
        <TableCell>{getIssueStatusBadge(1)}</TableCell>
        <TableCell>
          {detected.toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric'
          })} {detected.toLocaleTimeString('en-US', {
            hour: '2-digit', minute: '2-digit'
          })}
        </TableCell>
        <TableCell className="text-sm text-muted-foreground max-w-md">
          <div className="break-words">{group.remediation}</div>
        </TableCell>
        <TableCell>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {/* Defer one tick so the menu finishes closing before the dialog opens. */}
              <DropdownMenuItem onSelect={() => setTimeout(() => setRedTeamGroup(group), 0)}>
                <Eye className="h-4 w-4 mr-2" />
                View Incidents
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>
    )
  }

  return (
    <>
      <RedTeamIncidentsDialog
        group={redTeamGroup}
        onClose={() => setRedTeamGroup(null)}
        onOpenFinding={(f) => {
          setRedTeamGroup(null)
          // Let the incidents dialog close before the finding dialog opens.
          setTimeout(() => setRedTeamFinding(f), 0)
        }}
      />
      <FindingDialog finding={redTeamFinding} onClose={() => setRedTeamFinding(null)} />
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

      {!loading && (controllableIssues.length > 0 || redTeamRows.length > 0) && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CardTitle>Controllable Issues</CardTitle>
                <Badge variant="secondary">{controllableIssues.length + redTeamRows.length}</Badge>
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
                {controllableIssues.map(renderIssueRow)}
                {redTeamRows.map(renderRedTeamGroupRow)}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {!loading && acknowledgmentOnlyIssues.length > 0 && (
        <Collapsible open={agentAckOpen} onOpenChange={setAgentAckOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors rounded-t-lg">
                <div className="flex items-center gap-2">
                  {agentAckOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
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
                    {acknowledgmentOnlyIssues.map(renderIssueRow)}
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
                <DialogTitle>Agent Incidents: {currentIssue?.name}</DialogTitle>
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
                      {currentIssue && isExpandableFindingsIssue(currentIssue.issue_detail) && (
                        <TableHead className="w-[40px]"></TableHead>
                      )}
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
                      <TableHead>Agent</TableHead>
                      <TableHead>Plan</TableHead>
                      {currentIssue && isExpandableFindingsIssue(currentIssue.issue_detail) && (
                        <TableHead>Findings</TableHead>
                      )}
                      <TableHead>Issue Detected</TableHead>
                      <TableHead>Last Active</TableHead>
                      {selectedStatus === "3" && <TableHead className="w-[50px]"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {incidentModalData.map((device) => {
                      const showFindings = currentIssue && isExpandableFindingsIssue(currentIssue.issue_detail)
                      const accountCounts = showFindings ? findingCounts.get(device.agent_account_id) : undefined
                      const accountGroups = showFindings ? (findingGroups.get(device.agent_account_id) || []) : []
                      // Group the account's container×type rows by container
                      // (attachment or conversation), open work first, newest first.
                      const accountContainers = (() => {
                        const byKey = new Map<string, any>()
                        for (const g of accountGroups) {
                          const key = g.file_id ?? g.conversation_id
                          if (!byKey.has(key)) {
                            byKey.set(key, {
                              key,
                              file_id: g.file_id,
                              name: g.file_id ? g.file_name : g.conversation_name,
                              groups: [] as any[],
                              open: 0,
                              closed: 0,
                              latest: null as string | null,
                            })
                          }
                          const c = byKey.get(key)
                          c.groups.push(g)
                          c.open += g.open_count
                          c.closed += g.closed_count
                          if (g.latest_timestamp && (!c.latest || g.latest_timestamp > c.latest)) c.latest = g.latest_timestamp
                        }
                        const containers = [...byKey.values()]
                        // Newest activity first, both levels — matching the rest of
                        // the product and keeping row position stable as findings
                        // close (open/closed drives the badge, not the order).
                        const newestFirst = (aLatest: string | null, bLatest: string | null) =>
                          (bLatest || '').localeCompare(aLatest || '')
                        containers.sort((a, b) => newestFirst(a.latest, b.latest))
                        for (const c of containers) {
                          c.groups.sort((a: any, b: any) => newestFirst(a.latest_timestamp, b.latest_timestamp))
                        }
                        return containers
                      })()
                      const isExpanded = expandedIncidents.has(device.issueIds.join(','))
                      const colSpan = 8 + (showFindings ? 2 : 0) + (selectedStatus === "3" ? 1 : 0)

                      const handleToggleExpand = () => {
                        if (!showFindings || accountContainers.length === 0) return
                        setExpandedIncidents(prev => {
                          const next = new Set(prev)
                          const key = device.issueIds.join(',')
                          if (next.has(key)) next.delete(key)
                          else next.add(key)
                          return next
                        })
                      }

                      return (
                        <Collapsible key={device.issueIds.join(',')} open={isExpanded} asChild>
                          <>
                            <TableRow
                              data-state={selectedIncidents.has(device.issueIds.join(',')) ? "selected" : undefined}
                              className={showFindings && accountContainers.length > 0 ? "cursor-pointer" : ""}
                              onClick={handleToggleExpand}
                            >
                              {showFindings && (
                                <TableCell onClick={(e) => e.stopPropagation()}>
                                  {accountContainers.length > 0 && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6"
                                      onClick={handleToggleExpand}
                                    >
                                      <ChevronRight
                                        className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                      />
                                    </Button>
                                  )}
                                </TableCell>
                              )}
                              <TableCell onClick={(e) => e.stopPropagation()}>
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
                                        <div className="truncate cursor-default max-w-[200px]">
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
                                        {device.agentEmail}
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>{device.agentEmail}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </TableCell>
                              <TableCell>{device.agentName}</TableCell>
                              <TableCell>{device.plan}</TableCell>
                              {showFindings && (
                                <TableCell>
                                  {findingsLoading ? (
                                    <Skeleton className="h-5 w-20" />
                                  ) : accountCounts && accountCounts.open_count > 0 ? (
                                    <Badge variant="outline" className={OPEN_COUNT_BADGE_CLASS}>
                                      {accountCounts.open_count} open
                                    </Badge>
                                  ) : accountCounts && accountCounts.closed_count > 0 ? (
                                    <Badge variant="outline" className={RESOLVED_BADGE_CLASS}>
                                      <Check className="h-3 w-3 mr-1" /> resolved
                                    </Badge>
                                  ) : (
                                    <span className="text-muted-foreground text-sm">-</span>
                                  )}
                                </TableCell>
                              )}
                              <TableCell className="text-sm text-muted-foreground">{device.lastSeen}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{device.lastActive || '-'}</TableCell>
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
                                            <>
                                              <div className="border-t pt-3">
                                                <div className="text-xs font-medium text-muted-foreground mb-1">Comment:</div>
                                                <div className="text-xs text-foreground">{device.metadata.dismissalComment}</div>
                                              </div>
                                            </>
                                          )}
                                        </div>
                                      </PopoverContent>
                                    </Popover>
                                  )}
                                </TableCell>
                              )}
                            </TableRow>
                            <CollapsibleContent asChild>
                              <TableRow className="bg-muted/30 hover:bg-muted/30">
                                <TableCell colSpan={colSpan} className="p-0">
                                  <div className="px-8 py-3 space-y-3">
                                    {accountContainers.map((container: any) => (
                                      <div key={container.key}>
                                        <div className="flex items-center gap-2 py-1">
                                          {container.file_id
                                            ? <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                            : <MessageSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                                          <span className="text-sm font-medium truncate">
                                            {container.name || (container.file_id ? 'Attachment' : 'Untitled conversation')}
                                          </span>
                                          {container.latest && (
                                            <span className="text-xs text-muted-foreground shrink-0">
                                              {new Date(container.latest).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                            </span>
                                          )}
                                        </div>
                                        <div className="ml-6 divide-y divide-border/50">
                                          {container.groups.map((group: any) => (
                                            <div
                                              key={`${group.conversation_id}-${group.file_id}-${group.type}`}
                                              role="button"
                                              tabIndex={0}
                                              className="flex items-center justify-between py-1.5 cursor-pointer hover:bg-muted/50 rounded px-2 -mx-2"
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                handleOpenGroup(group)
                                              }}
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                  e.preventDefault()
                                                  e.stopPropagation()
                                                  handleOpenGroup(group)
                                                }
                                              }}
                                            >
                                              <span className="text-sm truncate">
                                                {isContainmentIssue(currentIssue?.issue_detail)
                                                  ? findingTypeLabel(currentIssue?.issue_detail, group.type)
                                                  : isPromptInjectionIssue(currentIssue?.issue_detail)
                                                  ? 'Prompt injection'
                                                  : findingTypeLabel(currentIssue?.issue_detail, group.type)}
                                              </span>
                                              <div className="flex items-center gap-3">
                                                <span className="text-sm text-muted-foreground">
                                                  {group.open_count > 0
                                                    ? <><span className="text-foreground font-medium">{group.open_count} open</span>{group.closed_count > 0 && ` · ${group.closed_count} closed`}</>
                                                    : `${group.closed_count} closed`}
                                                </span>
                                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    ))}
                                    {accountCounts && accountContainers.length < accountCounts.container_count && (
                                      <p className="text-xs text-muted-foreground">
                                        Showing the {accountContainers.length} most recently active conversations and attachments of {accountCounts.container_count}.
                                      </p>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            </CollapsibleContent>
                          </>
                        </Collapsible>
                      )
                    })}
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

      {/* Group Evidence Modal (Nested): master-detail over one container×type
          group. Left = paginated match list (Open/Closed tabs); right = the
          evidence pane for the selected match. */}
      <Dialog open={showFindingDetail} onOpenChange={(open) => { if (!open) closeGroupModal() }}>
        <DialogContent className="max-w-4xl z-[60] max-h-[85vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>
              {currentGroup
                ? `${
                    isContainmentIssue(currentIssue?.issue_detail)
                      ? findingTypeLabel(currentIssue?.issue_detail, currentGroup.type)
                      : isPromptInjectionIssue(currentIssue?.issue_detail)
                      ? 'Prompt injection'
                      : findingTypeLabel(currentIssue?.issue_detail, currentGroup.type)
                  } in ${(currentGroup.file_id ? currentGroup.file_name : currentGroup.conversation_name) || (currentGroup.file_id ? 'attachment' : 'untitled conversation')}`
                : isContainmentIssue(currentIssue?.issue_detail)
                  ? 'Containment Finding'
                  : isPromptInjectionIssue(currentIssue?.issue_detail)
                  ? 'Prompt Injection Finding'
                  : 'Sensitive Data Finding'}
            </DialogTitle>
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span>
                    {currentFinding && currentMatchIndex >= 0
                      ? `Match ${currentMatchIndex + 1} of ${groupTab === 'open' ? `${currentGroup?.open_count ?? groupMatches.length} open` : `${currentGroup?.closed_count ?? groupMatches.length} closed`}`
                      : groupTab === 'open' && currentGroup?.open_count === 0
                        ? 'All open matches resolved'
                        : ''}
                  </span>
                  {currentFinding?.message_timestamp && (
                    <>
                      <span>•</span>
                      <span>{new Date(currentFinding.message_timestamp).toLocaleString('en-US')}</span>
                    </>
                  )}
                </div>
                {currentGroup?.open_count > 0 && (isSensitiveDataIssue(currentIssue?.issue_detail) || isContainmentIssue(currentIssue?.issue_detail) || isPromptInjectionIssue(currentIssue?.issue_detail)) && (
                  <CloseReasonPopover
                    options={isContainmentIssue(currentIssue?.issue_detail) || isPromptInjectionIssue(currentIssue?.issue_detail)
                      ? CONTAINMENT_STATUS_OPTIONS
                      : getStatusOptionsForCategory(ISSUE_DETAIL_TO_CATEGORY[currentIssue?.issue_detail])}
                    trigger={
                      <Button variant="outline" size="sm" className="gap-1 text-xs shrink-0">
                        Close {currentGroup.open_count} open as
                        <ChevronRight className="h-3 w-3" />
                      </Button>
                    }
                    onSubmit={handleBulkClose}
                  />
                )}
              </div>
              <div className="flex items-center gap-2 text-sm">
                {currentFinding && (
                  <Badge
                    variant="outline"
                    className={isContainmentIssue(currentIssue?.issue_detail)
                      ? (groupTab === 'open' ? OPEN_COUNT_BADGE_CLASS : RESOLVED_BADGE_CLASS)
                      : getFindingStatusBadgeClass(currentFinding.finding_status)}
                  >
                    {isContainmentIssue(currentIssue?.issue_detail)
                      ? (groupTab === 'open' ? 'Open' : 'Closed')
                      : FINDING_STATUS_LABELS[currentFinding.finding_status]}
                  </Badge>
                )}
                {currentFinding?.metadata?.statusUpdatedBy && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-4 w-4 p-0">
                        <Info className="h-3 w-3 text-muted-foreground" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 z-[70]">
                      <div className="space-y-3">
                        <div className="font-medium">{FINDING_STATUS_LABELS[currentFinding.finding_status]}</div>
                        <div className="text-xs text-muted-foreground">
                          Updated by {currentFinding.metadata.statusUpdatedBy || 'N/A'}
                          <br />
                          on {currentFinding.metadata.statusUpdatedAt ? new Date(currentFinding.metadata.statusUpdatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'} at {currentFinding.metadata.statusUpdatedAt ? new Date(currentFinding.metadata.statusUpdatedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''}
                        </div>
                        {currentFinding.metadata.statusComment && (
                          <>
                            <div className="border-t pt-3">
                              <div className="text-xs font-medium text-muted-foreground mb-1">Comment:</div>
                              <div className="text-xs text-foreground">{currentFinding.metadata.statusComment}</div>
                            </div>
                          </>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            </div>
          </DialogHeader>

          <div className="flex gap-4 flex-1 min-h-0">
          {/* Match list pane */}
          <div className="w-56 shrink-0 flex flex-col border rounded-lg overflow-hidden">
            <div className="flex text-xs border-b bg-muted/30">
              <button
                onClick={() => handleSwitchGroupTab('open')}
                className={`flex-1 px-2 py-1.5 transition-colors ${groupTab === 'open' ? 'bg-background font-medium' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Open {currentGroup?.open_count ?? 0}
              </button>
              <button
                onClick={() => handleSwitchGroupTab('closed')}
                className={`flex-1 px-2 py-1.5 transition-colors ${groupTab === 'closed' ? 'bg-background font-medium' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Closed {currentGroup?.closed_count ?? 0}
              </button>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-1 space-y-0.5">
                {groupMatches.map((m: any) => (
                  <button
                    key={m.id}
                    onClick={() => handleViewFinding(m)}
                    className={`w-full flex items-center justify-between rounded px-2 py-1.5 text-left text-sm transition-colors ${
                      m.id === currentFinding?.id ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/50'
                    }`}
                  >
                    <span className="truncate">{matchLabel(m)}</span>
                    <span className="text-xs text-muted-foreground shrink-0 ml-2">
                      {isContainmentIssue(currentIssue?.issue_detail)
                        ? ''
                        : groupTab === 'closed'
                          ? FINDING_STATUS_LABELS[m.finding_status]
                          : m.finding_status === 2 ? 'Reviewing' : ''}
                    </span>
                  </button>
                ))}
                {groupMatchesLoading && (
                  <div className="flex items-center justify-center py-3 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                )}
                {!groupMatchesLoading && groupMatches.length === 0 && (
                  <p className="px-2 py-3 text-xs text-muted-foreground">
                    {groupTab === 'open' ? 'No open matches.' : 'No closed matches.'}
                  </p>
                )}
                {groupNextToken && !groupMatchesLoading && (
                  <Button variant="ghost" size="sm" className="w-full text-xs" onClick={handleLoadMoreMatches}>
                    Load more
                  </Button>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Evidence pane */}
          <div className="overflow-y-auto flex-1 min-h-0 space-y-4">
          {!currentFinding ? (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              {groupMatchesLoading
                ? <Loader2 className="h-5 w-5 animate-spin" />
                : groupTab === 'closed' ? 'No match selected.'
                : groupNextToken ? 'More matches available. Use Load more.'
                : 'All open matches resolved.'}
            </div>
          ) : isContainmentIssue(currentIssue?.issue_detail) ? (
          <div className="space-y-3">
            <div className="border rounded-lg overflow-hidden">
              <div className="px-4 py-2 bg-muted/30 border-b">
                <label className="text-sm font-medium">Event details</label>
              </div>
              <div className="p-4 space-y-3 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground mb-0.5">Operation</div>
                  <div>{CONTAINMENT_OP_LABELS[currentFinding.op as ContainmentOp] || currentFinding.op || '—'}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-0.5">Tool</div>
                  <div className="font-mono">{currentFinding.tool_name || '—'}</div>
                </div>
                {/* Target is name-only (an MCP tool name; empty for shell) —
                    the row only renders when there is a name to show. */}
                {currentFinding.target_path && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-0.5">Target</div>
                    <div className="font-mono break-all">{currentFinding.target_path}</div>
                  </div>
                )}
                {/* Verbatim tool input from the customer-storage snippet, fetched on view; always rendered so loading/content/no-content states surface via renderContentFetchError, mirroring the sensitive-data Content card. */}
                <div>
                  <div className="text-xs text-muted-foreground mb-0.5">
                    {currentFinding.tool_name === 'Bash' || currentFinding.tool_name === 'Shell' ? 'Full command' : 'Tool input'}
                  </div>
                  <ScrollArea className="h-40 rounded-lg bg-muted/50 p-4">
                    <div className="font-mono text-sm leading-relaxed">
                      {findingContentLoading ? (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" /> Loading content...
                        </div>
                      ) : findingContent ? (
                        <ToolInputFields raw={findingContent.content} shell={currentFinding.tool_name === 'Bash' || currentFinding.tool_name === 'Shell'} />
                      ) : findingContentError ? (
                        renderContentFetchError('event')
                      ) : (
                        <span className="text-muted-foreground">Content not available</span>
                      )}
                    </div>
                  </ScrollArea>
                </div>
                {currentFinding.message_timestamp && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-0.5">Detected</div>
                    <div>{new Date(currentFinding.message_timestamp).toLocaleString('en-US')}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Source-artifact slot: download the stored session activity this
                event's flush was uploaded in. Absent when audit logging was off
                for the agent at detection time. */}
            {currentFinding?.source_path && (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleDownloadFinding}>
                  <Download className="h-3 w-3" /> Download Source
                </Button>
              </div>
            )}

            {/* Metadata */}
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground hover:text-foreground p-0 h-auto">
                  <ChevronRight className="h-3 w-3 transition-transform [[data-state=open]>&]:rotate-90" /> Metadata
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <TooltipProvider>
                <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm overflow-hidden">
                  <div className="flex justify-between items-center group min-w-0">
                    <span className="text-muted-foreground shrink-0">Conversation:</span>
                    <CopyableValue value={currentFinding?.conversation_name || '-'} />
                  </div>
                  {currentFinding?.tool_use_id && (
                    <div className="flex justify-between items-center group min-w-0">
                      <span className="text-muted-foreground shrink-0">Tool Use ID:</span>
                      <CopyableValue value={currentFinding.tool_use_id} />
                    </div>
                  )}
                  {(currentFinding?.snippet_path || currentFinding?.source_path) && (
                    <div className="pt-2 mt-2 border-t space-y-2">
                      <div className="text-sm font-semibold text-foreground">Stored in your bucket</div>
                      {currentFinding?.snippet_path && (
                        <div className="flex justify-between items-center group min-w-0">
                          <span className="text-muted-foreground shrink-0">Tool input snippet:</span>
                          <CopyableValue value={currentFinding.snippet_path} />
                        </div>
                      )}
                      {currentFinding?.source_path && (
                        <div className="flex justify-between items-center group min-w-0">
                          <span className="text-muted-foreground shrink-0">Source activity:</span>
                          <CopyableValue value={currentFinding.source_path} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
                </TooltipProvider>
              </CollapsibleContent>
            </Collapsible>
          </div>
          ) : isPromptInjectionIssue(currentIssue?.issue_detail) ? (
          <div className="space-y-3">
            <div className="border rounded-lg overflow-hidden">
              <div className="px-4 py-2 bg-muted/30 border-b">
                <label className="text-sm font-medium">Injection details</label>
              </div>
              <div className="p-4 space-y-3 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground mb-0.5">Description</div>
                  <div>{currentFinding.description || 'No description provided.'}</div>
                </div>
                {/* The content endpoint returns { origin, instruction }. The
                    source is short, so it renders inline like Description; the
                    instruction gets its own box, concealed by default with the
                    shared reveal toggle. A finding with no instruction shows just
                    the source. Back-compat: a snippet stored before the structured
                    format ("origin\n\ninstruction") arrives with the whole blob in
                    origin, so split it here so the instruction still gets a box. */}
                {(() => {
                  let origin = (findingContent?.origin ?? '').trim()
                  let instruction = (findingContent?.instruction ?? '').trim()
                  if (!instruction && origin.includes('\n\n')) {
                    const idx = origin.indexOf('\n\n')
                    instruction = origin.slice(idx + 2).trim()
                    origin = origin.slice(0, idx).trim()
                  }
                  return (
                    <>
                      <div>
                        <div className="text-xs text-muted-foreground mb-0.5">Injection source</div>
                        <div className="font-mono text-sm break-all">
                          {findingContentLoading ? (
                            <span className="inline-flex items-center gap-2 text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" /> Loading content...
                            </span>
                          ) : findingContentError ? (
                            renderContentFetchError('finding')
                          ) : findingContent ? (
                            origin || <span className="text-muted-foreground">Not recorded</span>
                          ) : (
                            <span className="text-muted-foreground">Content not available</span>
                          )}
                        </div>
                      </div>
                      {findingContent && instruction && (
                        <div>
                          <div className="text-xs text-muted-foreground mb-0.5">Triggering instruction</div>
                          <ScrollArea className="h-40 rounded-lg bg-muted/50 p-4">
                            <div className="font-mono text-sm leading-relaxed">
                              <ContentSnippet
                                content={instruction}
                                highlightStart={0}
                                highlightEnd={0}
                                isRevealed={revealedData}
                                onToggleReveal={() => setRevealedData(prev => !prev)}
                              />
                            </div>
                          </ScrollArea>
                          <p className="text-xs text-muted-foreground mt-1">Click the concealed text to reveal. Click again to conceal.</p>
                        </div>
                      )}
                    </>
                  )
                })()}
                {currentFinding.message_timestamp && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-0.5">Detected</div>
                    <div>{new Date(currentFinding.message_timestamp).toLocaleString('en-US')}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Source-artifact slot: download the stored session activity this
                flag's flush was uploaded in. Absent when audit logging was off
                for the agent at detection time. */}
            {currentFinding?.source_path && (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleDownloadFinding}>
                  <Download className="h-3 w-3" /> Download Source
                </Button>
              </div>
            )}

            {/* Metadata */}
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground hover:text-foreground p-0 h-auto">
                  <ChevronRight className="h-3 w-3 transition-transform [[data-state=open]>&]:rotate-90" /> Metadata
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <TooltipProvider>
                <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm overflow-hidden">
                  <div className="flex justify-between items-center group min-w-0">
                    <span className="text-muted-foreground shrink-0">Conversation:</span>
                    <CopyableValue value={currentFinding?.conversation_name || '-'} />
                  </div>
                  {currentFinding?.message_id && (
                    <div className="flex justify-between items-center group min-w-0">
                      <span className="text-muted-foreground shrink-0">Message ID:</span>
                      <CopyableValue value={currentFinding.message_id} />
                    </div>
                  )}
                  {(currentFinding?.snippet_path || currentFinding?.source_path) && (
                    <div className="pt-2 mt-2 border-t space-y-2">
                      <div className="text-sm font-semibold text-foreground">Stored in your bucket</div>
                      {currentFinding?.snippet_path && (
                        <div className="flex justify-between items-center group min-w-0">
                          <span className="text-muted-foreground shrink-0">Injection origin snippet:</span>
                          <CopyableValue value={currentFinding.snippet_path} />
                        </div>
                      )}
                      {currentFinding?.source_path && (
                        <div className="flex justify-between items-center group min-w-0">
                          <span className="text-muted-foreground shrink-0">Source activity:</span>
                          <CopyableValue value={currentFinding.source_path} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
                </TooltipProvider>
              </CollapsibleContent>
            </Collapsible>
          </div>
          ) : (<>
          {/* Content area */}
          <div className="space-y-3">
            <div className="border rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-b">
                <label className="text-sm font-medium">
                  Content
                </label>
                {findingContent?.decoded_match && (
                  <div className="flex items-center gap-1 rounded-md border bg-background p-0.5 text-xs">
                    <button
                      onClick={() => setShowDecoded(false)}
                      className={`px-2 py-0.5 rounded transition-colors ${!showDecoded ? 'bg-muted font-medium' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      Original
                    </button>
                    <button
                      onClick={() => setShowDecoded(true)}
                      className={`px-2 py-0.5 rounded transition-colors ${showDecoded ? 'bg-muted font-medium' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      Decoded
                    </button>
                  </div>
                )}
              </div>
              <ScrollArea className="h-40 bg-muted/50 p-4">
              <div className="font-mono text-sm leading-relaxed">
                {findingContentLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading content...
                  </div>
                ) : findingContent ? (
                  <ContentSnippet
                    content={findingContent.content}
                    highlightStart={findingContent.highlight_start}
                    highlightEnd={findingContent.highlight_end}
                    isRevealed={revealedData}
                    onToggleReveal={() => setRevealedData(prev => !prev)}
                    sensitiveOverride={showDecoded ? findingContent.decoded_match : undefined}
                  />
                ) : findingContentError ? (
                  renderContentFetchError('finding')
                ) : (
                  <span className="text-muted-foreground">Content not available</span>
                )}
              </div>
            </ScrollArea>
            </div>
            {findingContent && (
              <p className="text-xs text-muted-foreground">Click on concealed data to reveal. Click again to conceal.</p>
            )}
          </div>

          {/* Source-artifact slot: download the redacted source when it exists in
              storage, otherwise explain its absence. The note only shows for findings
              that have an evidence snippet (storage configured, capture on) — a missing
              snippet is the not-configured case the content area above already handles. */}
          {(() => {
            if (currentFinding?.source_path) {
              return (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleDownloadFinding}>
                    <Download className="h-3 w-3" /> Download Source
                  </Button>
                </div>
              )
            }
            if (!currentFinding?.snippet_path) return null
            // Only speak to logging when storage is healthy. If storage is
            // unconfigured or errored, the content area above owns the messaging
            // (Set up / Action needed) and the source's absence can't be blamed
            // on logging, so showing a second, competing CTA would mislead.
            if (!storageHealthy) return null
            const noun = currentFinding?.file_id ? 'The full attachment' : 'Full conversation history'
            // Link to enable logging only when it is off; when logging is on the
            // absence is a one-off (transient upload miss), nothing to turn on.
            if (loggingEnabled === false) {
              return (
                <div className="flex items-start gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm">
                  <Info className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                  <div className="space-y-1">
                    <p>{noun} isn't stored. Audit logging stores it for future findings.</p>
                    <a
                      href={loggingPolicyId ? `/policies/${loggingPolicyId}` : '/policies'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      Turn on audit logging →
                    </a>
                  </div>
                </div>
              )
            }
            return (
              <div className="flex items-start gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm">
                <Info className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                <p>{noun} wasn't stored for this finding.</p>
              </div>
            )
          })()}

          {/* Metadata */}
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground hover:text-foreground p-0 h-auto">
                <ChevronRight className="h-3 w-3 transition-transform [[data-state=open]>&]:rotate-90" /> Metadata
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <TooltipProvider>
              <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm overflow-hidden">
                <div className="flex justify-between items-center group min-w-0">
                  <span className="text-muted-foreground shrink-0">Conversation:</span>
                  <CopyableValue value={currentFinding?.conversation_name || '-'} />
                </div>
                {currentFinding?.message_id && (
                  <div className="flex justify-between items-center group min-w-0">
                    <span className="text-muted-foreground shrink-0">Message ID:</span>
                    <CopyableValue value={currentFinding.message_id} />
                  </div>
                )}
                {currentFinding?.file_id && (
                  <div className="flex justify-between items-center group min-w-0">
                    <span className="text-muted-foreground shrink-0">Attachment:</span>
                    <CopyableValue value={currentFinding?.file_name || '-'} />
                  </div>
                )}
                {currentFinding?.archive_inner_path && (
                  <div className="flex justify-between items-center group min-w-0">
                    <span className="text-muted-foreground shrink-0">Archive Path:</span>
                    <CopyableValue value={currentFinding.archive_inner_path} />
                  </div>
                )}
                {currentFinding?.file_id && currentFinding?.start_line != null && currentFinding?.source_path && (
                  <div className="flex justify-between items-center group min-w-0">
                    <span className="text-muted-foreground shrink-0">Lines:</span>
                    <CopyableValue value={`${currentFinding.start_line}${currentFinding.start_line !== currentFinding.end_line ? `-${currentFinding.end_line}` : ''}`} />
                  </div>
                )}
                {currentFinding?.encoding_type && (
                  <div className="flex justify-between items-center group min-w-0">
                    <span className="text-muted-foreground shrink-0">Encoding:</span>
                    <CopyableValue value={currentFinding.encoding_type} />
                  </div>
                )}
                {(() => {
                  // Objects stored in the customer's bucket: the evidence snippet
                  // (present whenever the finding carries captured evidence) and the
                  // redacted source (attachment member or conversation delta), absent
                  // when audit logging is off. Absent rows hide; the download slot's
                  // note explains a missing source.
                  const evidencePath = currentFinding?.snippet_path
                  const sourcePath = currentFinding?.source_path
                  if (!evidencePath && !sourcePath) return null
                  const sourceLabel = currentFinding?.file_id ? 'Attachment' : 'Conversation'
                  return (
                    <div className="pt-2 mt-2 border-t space-y-2">
                      <div className="text-sm font-semibold text-foreground">Stored in your bucket</div>
                      {evidencePath && (
                        <div className="flex justify-between items-center group min-w-0">
                          <span className="text-muted-foreground shrink-0">Evidence snippet:</span>
                          <CopyableValue value={evidencePath} />
                        </div>
                      )}
                      {sourcePath && (
                        <div className="flex justify-between items-center group min-w-0">
                          <span className="text-muted-foreground shrink-0">{sourceLabel}:</span>
                          <CopyableValue value={sourcePath} />
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>
              </TooltipProvider>
            </CollapsibleContent>
          </Collapsible>
          </>)}
          </div>
          </div>

          <DialogFooter className="flex-shrink-0 sm:justify-between">
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                disabled={currentMatchIndex <= 0}
                onClick={handlePrevMatch}
              >
                <ChevronLeft className="h-4 w-4" /> Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                disabled={currentMatchIndex < 0 || groupMatchesLoading || (currentMatchIndex >= groupMatches.length - 1 && !groupNextToken)}
                onClick={handleNextMatch}
              >
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex gap-2 justify-end">
              {currentFinding && (isContainmentIssue(currentIssue?.issue_detail) ||
                isPromptInjectionIssue(currentIssue?.issue_detail) ||
                (isSensitiveDataIssue(currentIssue?.issue_detail) && typeof currentFinding.category === 'number')) && (
                <CloseReasonPopover
                  options={isContainmentIssue(currentIssue?.issue_detail) || isPromptInjectionIssue(currentIssue?.issue_detail)
                    ? CONTAINMENT_STATUS_OPTIONS
                    : getStatusOptionsForCategory(currentFinding.category)}
                  trigger={
                    <Button className="gap-2">
                      Close as
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  }
                  onSubmit={(status, comment) => {
                    if (currentFinding?.id) handleUpdateFindingStatus(currentFinding.id, status, comment)
                  }}
                />
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default AgentIssuesTable
