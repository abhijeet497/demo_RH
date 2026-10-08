import { Key, Plus, Trash2, Copy, Eye, EyeOff, Bell, Download, Link, AlertTriangle, Pencil, HardDrive, ArrowRight, ExternalLink, Box, Lock, ShieldCheck, Database, Waypoints, Cloud } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useAuth } from "@/contexts/AuthContext"
import { useOrg } from "@/contexts/OrgContext"
import { orgRpcArgs } from "@/lib/orgScope"
import { supabase } from "@/integrations/supabase/client"
import { useState, useEffect, useRef, useCallback } from "react"
import { useSearchParams, useNavigate } from "react-router-dom"
import { formatDistanceToNow } from "date-fns"
import { useToast } from "@/hooks/use-toast"
import { traceforcApi } from "@/integrations/traceforce/client"
import type { TraceforceApiClient, AlertNotification, CustomerStorage, IdpIntegration, OtelDestination } from "@/integrations/traceforce/types"
import DirectorySyncDrawer from "@/components/DirectorySyncDrawer"
import SandboxSetupCard from "@/components/SandboxSetupCard"
import AwsBedrockConnections from "@/components/AwsBedrockConnections"
import { awsBedrockEnabled } from "@/lib/featureFlags"
import LakehouseSetupSheet from "@/components/LakehouseSetupSheet"
import { lakehouseTileState } from "@/lib/lakehouseSnippet"
import DownloadScannerDialog from "@/components/DownloadScannerDialog"
import { apiErrorText } from "@/lib/api-errors"
import MdmSettingsSection from "@/components/MdmSettingsSection"
import OtelExportSection from "@/components/OtelExportSection"
import CopilotTerraformSetup from "@/components/CopilotTerraformSetup"
import { getCopilotConnections } from "@/lib/copilotMock"
import { copilotTileSummary, needsAttention } from "@/lib/copilot"
import type { CopilotConnection } from "@/lib/copilotTypes"
import { copilotEnabled } from "@/lib/featureFlags"
import { getFrequencyLabel, FREQUENCY_OPTIONS, getAlertNotificationTypeLabel, ALERT_NOTIFICATION_TYPE_OPTIONS, DEFAULT_FREQUENCY, CUSTOMER_STORAGE_PROVIDER_OPTIONS, CUSTOMER_STORAGE_PROVIDER_FIELDS, getCustomerStorageProviderLabel, getMdmSummary, providerLabel, pickPrimaryIdpIntegration, isLiveDirectoryState, isLiveLinkedIdpState, IDP_SETUP_DESCRIPTION, validateAzureContainerName, getOtelSummary, USER_ACTIVITY_LOGGING_RISK_RULE_TYPE } from "@/lib/appUtils"

const OTEL_EXPORT_TILE_PITCH = 'Also send a copy of agent activity to your own OTLP collectors. Traceforce storage is unaffected.'

// Stale-while-revalidate cache for the Identity Provider tile. The tile's
// fetch takes a beat on every page load, and flashing the setup pitch at an
// admin whose directory is connected reads as "the connection is gone" — so
// the last known state renders instantly and the fetch corrects it. Keyed by
// org (multi-org admins), holds only server-derived display state (provider,
// ui_state, last_synced — nothing sensitive). Best-effort: storage can be
// full or blocked, and the fetch is always the source of truth.
const idpTileCacheKey = (orgId: string) => `tf-idp-tile:${orgId}`
const readIdpTileCache = (orgId: string | null): IdpIntegration | null => {
  if (!orgId) return null
  try {
    const raw = localStorage.getItem(idpTileCacheKey(orgId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as IdpIntegration
    // Shape-check every field the tile and the drawer render before the fetch
    // corrects the cache: the key is unversioned, so an older build's schema
    // can be sitting here, and a render throw (formatDistanceToNow on a bad
    // last_synced, a missing counts object) takes down the whole route —
    // there is no ErrorBoundary. Wrong shape → drop the entry, render the
    // skeleton, let the fetch rebuild it.
    const validTimestamp = (v: unknown) =>
      v === null || (typeof v === "string" && !Number.isNaN(new Date(v).getTime()))
    if (
      typeof parsed?.id !== "string" ||
      typeof parsed?.ui_state !== "string" ||
      typeof parsed?.provider !== "string" ||
      typeof parsed?.counts?.groups_live !== "number" ||
      typeof parsed?.counts?.directory_users_live !== "number" ||
      typeof parsed?.counts?.policies_attached !== "number" ||
      // Load-bearing at render: isLiveDirectoryState reads it and the drawer
      // lowercases it, so a non-string cached value is a crash loop here.
      (parsed?.directory_state !== null && typeof parsed?.directory_state !== "string") ||
      !validTimestamp(parsed?.last_synced) ||
      !validTimestamp(parsed?.last_reconciled_at)
    ) {
      localStorage.removeItem(idpTileCacheKey(orgId))
      return null
    }
    return parsed
  } catch {
    return null
  }
}
const writeIdpTileCache = (orgId: string | null, integration: IdpIntegration | null) => {
  if (!orgId) return
  try {
    if (integration) localStorage.setItem(idpTileCacheKey(orgId), JSON.stringify(integration))
    else localStorage.removeItem(idpTileCacheKey(orgId))
  } catch {
    /* best-effort */
  }
}

const Settings = () => {
  const { session } = useAuth()
  const { activeOrgId } = useOrg()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedSection, setSelectedSection] = useState<string | null>(null)

  // Identity Provider state from GET /api/v1/settings/idp-integrations. The
  // drawer owns every mutation and reports back through onChanged, so the tile
  // and the drawer cannot disagree about whether a directory is connected.
  // undefined = nothing known yet this session (render the org's cached state,
  // else a skeleton); null = loaded, no integration configured.
  const [idpIntegration, setIdpIntegrationState] = useState<IdpIntegration | null | undefined>(undefined)
  // Every authoritative update (fetch result, drawer onChanged) also refreshes
  // the tile cache so the next page load starts from it.
  const setIdpIntegration = useCallback((next: IdpIntegration | null) => {
    setIdpIntegrationState(next)
    writeIdpTileCache(activeOrgId, next)
  }, [activeOrgId])
  // Seed from the cache once the org resolves — but never overwrite a state
  // the fetch (or the drawer) has already committed.
  useEffect(() => {
    if (!activeOrgId) return
    setIdpIntegrationState((cur) => cur !== undefined ? cur : readIdpTileCache(activeOrgId) ?? undefined)
  }, [activeOrgId])
  const [idpDrawerOpen, setIdpDrawerOpen] = useState(false)
  const idpConnected = idpIntegration?.ui_state === "connected"
  // A linked-but-unhealthy directory (discovering / attention_* / disconnecting)
  // must not read as "not set up" — the setup pitch invites a second setup.
  const idpLinked = isLiveLinkedIdpState(idpIntegration?.ui_state)
  // The two "discovering" flavors get different labels: directory linked with
  // the first sync in flight is genuine background work ("Connecting…"), but
  // an unlinked directory means the admin left the IdP-side setup unfinished —
  // nothing is happening until they act, so the label must not imply progress.
  const idpDirectoryLive = isLiveDirectoryState(idpIntegration?.directory_state)
  // One status label per lifecycle state, shared by the tile and the drawer
  // header. Settled vocabulary: "<Provider> • <State>" for resting states,
  // "<verb>ing …" phrases for transitions. Notable choices:
  //  - disconnected is dormant, NOT "never configured": revivable data sits one
  //    Reconnect away, so it must not show the setup pitch (null → pitch);
  //  - unlinked-discovering means the admin left IdP-side setup unfinished —
  //    nothing progresses until they act, so no "Connecting…";
  //  - a failing integration must not lead with "Connected".
  const idpStatusText = (() => {
    const ui = idpIntegration?.ui_state
    const provider = providerLabel(idpIntegration?.provider)
    if (ui === "disconnected") return `${provider} • Disconnected`
    if (!idpLinked) return null
    if (ui === "disconnecting") return `Disconnecting ${provider}…`
    if (ui === "discovering") return idpDirectoryLive ? `Connecting ${provider}…` : "IdP setup incomplete"
    if (ui === "attention_customer" || ui === "attention_platform") return `${provider} • Action Required`
    return `${provider} • Connected`
  })()

  // Load the integration for the tile. The drawer reloads it too, but the tile
  // has to render its state before anyone opens the drawer.
  const loadIdpIntegration = useCallback(async () => {
    if (!session?.access_token) return null
    const res = await traceforcApi.listIdpIntegrations(session.access_token)
    if (res.error) {
      console.error("Error fetching IdP integrations:", res.error)
      // Resolve a still-pending skeleton to the default tile rather than
      // leaving it shimmering forever; a cached state stays as-is (the cache
      // is not invalidated by a transient fetch failure).
      setIdpIntegrationState((cur) => (cur === undefined ? null : cur))
      return null
    }
    const integration = pickPrimaryIdpIntegration(res.data?.integrations)
    setIdpIntegration(integration)
    return integration
    // setIdpIntegration is a dep, not just lint hygiene: it closes over
    // activeOrgId for the tile-cache write, so a stale closure after an org
    // switch would cache one org's state under the other org's key — and the
    // recreated callback re-running the effect below doubles as the refetch
    // on switch.
  }, [session?.access_token, setIdpIntegration])

  useEffect(() => {
    void loadIdpIntegration()
  }, [loadIdpIntegration])

  // Open the drawer on demand via ?drawer=idp (the WorkOS portal callback and
  // "Set up IdP" links elsewhere use it), then clear the param. The idp_setup
  // param rides along on the callback return: the portal redirect carries no
  // trusted state, so this authenticated screen is what refreshes the row and
  // kicks the discovery sync for the directory the admin just created.
  useEffect(() => {
    const wantsDrawer = searchParams.get("drawer") === "idp"
    const setup = searchParams.get("idp_setup")
    if (!wantsDrawer && !setup) return
    if (setup && !session?.access_token) return

    setSearchParams({}, { replace: true })

    if (setup === "error") {
      // Generic copy only — idp_setup=error just picks which banner shows.
      // Echoing an idp_error param would let any crafted link put arbitrary
      // text inside a trusted toast (React escapes it, but the words still
      // read as ours).
      toast({
        title: "Directory setup did not complete",
        description: "You can pick up where you left off in WorkOS.",
        variant: "destructive",
      })
      setIdpDrawerOpen(true)
      return
    }

    if (setup === "complete") {
      void (async () => {
        const integration = await loadIdpIntegration()
        if (!integration) {
          // The refresh right after the portal redirect failed; the drawer's own
          // load retries and surfaces any error — don't claim success here.
          setIdpDrawerOpen(true)
          return
        }
        // Kick a sync so discovery claims the directory the admin just created
        // now instead of on the ~5-minute schedule. Right after the portal
        // callback the row is normally still `pending_setup` (only worker
        // discovery links it) and the sync route accepts that on purpose —
        // it rejects only rows with `disconnected_at` set. Mirror exactly
        // that rule here: skip only `disconnecting`/`disconnected` (during
        // reconnect-fresh the primary can still be the old teardown row).
        let importing = false
        if (
          session?.access_token &&
          integration.ui_state !== "disconnecting" &&
          integration.ui_state !== "disconnected"
        ) {
          const res = await traceforcApi.syncIdpIntegration(session.access_token, integration.id)
          importing = !res.error
        }
        toast({
          title: "Directory setup finished",
          description: importing
            ? "Importing your groups and users now. This can take a few minutes."
            : "Your groups and users will be imported automatically within a few minutes.",
        })
        setIdpDrawerOpen(true)
      })()
      return
    }

    setIdpDrawerOpen(true)
  }, [searchParams, setSearchParams, session?.access_token, loadIdpIntegration, toast])

  const MAX_API_CLIENTS = 2
  const [visibleCredentials, setVisibleCredentials] = useState<Set<string>>(new Set())
  const [apiClients, setApiClients] = useState<TraceforceApiClient[]>([])
  const canCreateMore = apiClients.length < MAX_API_CLIENTS
  const [loadingApiClients, setLoadingApiClients] = useState(true)
  const [apiClientLoadingError, setApiClientLoadingError] = useState(false)
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const toggleCredentialsVisibility = (clientId: string) => {
    setVisibleCredentials(prev => {
      const next = new Set(prev)
      if (next.has(clientId)) next.delete(clientId)
      else next.add(clientId)
      return next
    })
  }
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [clientName, setClientName] = useState("")
  const [alertNotifications, setAlertNotifications] = useState<AlertNotification[]>([])
  const [loadingAlertNotifications, setLoadingAlertNotifications] = useState(true)
  const [alertNotificationLoadingError, setAlertNotificationLoadingError] = useState(false)
  const [webhookUrl, setWebhookUrl] = useState("")
  const [notificationType, setNotificationType] = useState<"1" | "2">("1")
  const [frequency, setFrequency] = useState<"1" | "2" | "3">(DEFAULT_FREQUENCY.toString() as "1" | "2" | "3")
  const [savingWebhook, setSavingWebhook] = useState(false)
  const [showAddWebhookDialog, setShowAddWebhookDialog] = useState(false)
  const [showUpdateWebhookDialog, setShowUpdateWebhookDialog] = useState(false)
  const [showDeleteWebhookDialog, setShowDeleteWebhookDialog] = useState(false)
  const [deletingWebhook, setDeletingWebhook] = useState(false)

  // MDM section summary — one line per connected provider; fetched on load below, then kept
  // fresh via MdmSettingsSection callbacks
  const [mdmLines, setMdmLines] = useState<string[]>([])
  const [mdmHasWarning, setMdmHasWarning] = useState(false)
  // OpenTelemetry export tile summary. null = not loaded (or failed); the tile then shows
  // its setup pitch. OtelExportSection owns every mutation and reports back via onChanged,
  // the same contract MdmSettingsSection uses, so tile and sheet cannot disagree.
  const [otelDestinations, setOtelDestinations] = useState<OtelDestination[] | null>(null)
  useEffect(() => {
    if (!session?.access_token) return
    let cancelled = false
    traceforcApi
      .listOtelDestinations(session.access_token)
      .then((res) => {
        if (cancelled || res.error) return
        // Seed only: never overwrite a value OtelExportSection has already published.
        // A slow initial GET could otherwise resolve after a create and revert the tile.
        setOtelDestinations((prev) => prev ?? (res.data ?? []))
      })
      .catch(() => { /* tile falls back to its pitch */ })
    return () => { cancelled = true }
  }, [session?.access_token])
  const otelSummary = otelDestinations ? getOtelSummary(otelDestinations) : null

  // Populate the MDM tile summary/warning on page load, independent of whether the MDM
  // section has been opened (MdmSettingsSection only mounts when opened; its callbacks then
  // keep this fresh). Without this the tile wouldn't show a 401/403 warning until clicked in.
  useEffect(() => {
    if (!session?.access_token) return
    let cancelled = false
    traceforcApi
      .getMdmIntegration(session.access_token)
      .then((res) => {
        if (cancelled || res.error || !res.data) return
        const { lines, hasWarning } = getMdmSummary(res.data)
        setMdmLines(lines)
        setMdmHasWarning(hasWarning)
      })
      .catch(() => {
        /* leave the tile at default; the section populates it when opened */
      })
    return () => {
      cancelled = true
    }
  }, [session?.access_token])

  // Storage Provider state
  const [customerStorage, setCustomerStorage] = useState<CustomerStorage | null>(null)
  const [loadingCustomerStorage, setLoadingCustomerStorage] = useState(true)
  const [customerStorageLoadingError, setCustomerStorageLoadingError] = useState(false)
  const [selectedCustomerStorageProvider, setSelectedCustomerStorageProvider] = useState<string>("1")
  const [customerStorageConfig, setCustomerStorageConfig] = useState<Record<string, string>>({})
  // The API reports only its first failing config field, so one slot is enough.
  const [customerStorageFieldError, setCustomerStorageFieldError] = useState<{ key: string; message: string } | null>(null)
  const [savingCustomerStorage, setSavingCustomerStorage] = useState(false)
  const [showAddCustomerStorageDialog, setShowAddCustomerStorageDialog] = useState(false)
  const [showEditCustomerStorageDialog, setShowEditCustomerStorageDialog] = useState(false)
  const [showDeleteCustomerStorageDialog, setShowDeleteCustomerStorageDialog] = useState(false)
  const [deletingCustomerStorage, setDeletingCustomerStorage] = useState(false)
  const [customerStorageModalView, setCustomerStorageModalView] = useState<'config' | 'logging'>('config')
  // Microsoft 365 Copilot tenants (mock data until the API lands).
  const [copilotTenants, setCopilotTenants] = useState<CopilotConnection[] | null>(null)
  const refreshCopilotTenants = useCallback(() => {
    getCopilotConnections().then(setCopilotTenants)
  }, [])
  useEffect(() => {
    if (!copilotEnabled) return
    let cancelled = false
    getCopilotConnections().then((list) => { if (!cancelled) setCopilotTenants(list) })
    return () => { cancelled = true }
  }, [])
  const [loggingEligiblePolicies, setLoggingEligiblePolicies] = useState<any[]>([])
  const [selectedLoggingPolicies, setSelectedLoggingPolicies] = useState<Set<string>>(new Set())
  const [redactedLoggingPolicies, setRedactedLoggingPolicies] = useState<Set<string>>(new Set())
  const [savingLogging, setSavingLogging] = useState(false)
  const [fetchingLoggingPolicies, setFetchingLoggingPolicies] = useState(false)

  const createApiClient = async () => {
    if (!session?.access_token || !clientName.trim()) {
      return
    }

    setCreating(true)
    try {
      const response = await traceforcApi.createApiClient(session.access_token, clientName.trim())
      
      if (response.error) {
        throw new Error(response.error)
      }
      
      if (response.data) {
        setApiClients(prev => [...prev, response.data as TraceforceApiClient])
        setShowCreateDialog(false)
        setClientName("")
        toast({
          title: "Success",
          description: "API client created successfully",
        })
      }
    } catch (error) {
      console.error('Error creating API client:', error)
      toast({
        title: "Error",
        description: "Failed to create API client",
        variant: "destructive",
      })
    } finally {
      setCreating(false)
    }
  }

  const deleteApiClient = async (clientId: string) => {
    if (!session?.access_token) {
      return
    }

    setDeletingId(clientId)
    try {
      const response = await traceforcApi.deleteApiClient(session.access_token, clientId)

      if (response.error) {
        throw new Error(response.error)
      }

      setApiClients(prev => prev.filter(client => client.id !== clientId))
      toast({
        title: "Success",
        description: "API client deleted successfully",
      })
    } catch (error) {
      console.error('Error deleting API client:', error)
      toast({
        title: "Error",
        description: "Failed to delete API client",
        variant: "destructive",
      })
    } finally {
      setDeletingId(null)
    }
  }

  const fetchTraceforceApiKeys = async () => {
    setLoadingApiClients(true)
    
    if (!session?.access_token) {
      setLoadingApiClients(false)
      return
    }
    setApiClientLoadingError(false)
    try {
      const response = await traceforcApi.getApiClients(session.access_token)
      
      if (response.error) {
        throw new Error(response.error)
      }

      if (response.data && response.data.length > 0) {
        setApiClients(response.data as TraceforceApiClient[])
      }
    } catch (error) {
      console.error('Error fetching API keys:', error)
      setApiClientLoadingError(true)
      toast({
        title: "Error",
        description: "Failed to fetch API keys",
        variant: "destructive",
      })
    } finally {
      setLoadingApiClients(false)
    }
  }

  useEffect(() => {
    if (session?.access_token) {
      fetchTraceforceApiKeys()
    }
  }, [session?.access_token])

  useEffect(() => {
    if (session?.access_token) {
      fetchAlertNotifications()
      fetchCustomerStorage()
    }
  }, [session?.access_token])

  // Handle URL param to auto-open section
  useEffect(() => {
    const section = searchParams.get('section')
    if (section === 'identity-provider') {
      // The IdP tile opens the drawer, not the shared section Sheet —
      // renderSectionContent has no case for it, so the generic path would
      // show a blank sheet. Mirrors what activateTile does on click.
      setIdpDrawerOpen(true)
    } else if (section === 'microsoft-copilot' && !copilotEnabled) {
      // Hidden behind the feature flag: ignore direct links to it.
    } else if (section === 'aws-bedrock-role' && !awsBedrockEnabled) {
      // Hidden behind the feature flag: ignore direct links to it.
    } else if (section) {
      setSelectedSection(section)
    }
  }, [searchParams])

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast({
        title: "Success",
        description: `${type} copied to clipboard`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to copy ${type}`,
        variant: "destructive",
      })
    }
  }


  const fetchAlertNotifications = async () => {
    if (!session?.access_token) return

    setLoadingAlertNotifications(true)
    setAlertNotificationLoadingError(false)
    try {
      const response = await traceforcApi.getAlertNotifications(session.access_token)
      
      if (response.error) {
        throw new Error(response.error)
      }

      if (response.data) {
        setAlertNotifications(response.data)
      } else {
        setAlertNotifications([])
      }
      setWebhookUrl("")
      setNotificationType("1")
      setFrequency(DEFAULT_FREQUENCY.toString() as "1" | "2" | "3")
    } catch (error) {
      console.error('Error fetching alert notifications:', error)
      setAlertNotificationLoadingError(true)
      toast({
        title: "Error",
        description: "Failed to load alert notification settings",
        variant: "destructive",
      })
    } finally {
      setLoadingAlertNotifications(false)
    }
  }

  const saveWebhook = async () => {
    const isUpdate = alertNotifications.length > 0
    if (!session?.access_token || (!isUpdate && !webhookUrl.trim())) {
      return
    }

    setSavingWebhook(true)
    try {
      const typeValue = parseInt(notificationType) as 1 | 2
      const frequencyValue = parseInt(frequency) as 1 | 2 | 3
      let response
      if (isUpdate) {
        response = await traceforcApi.updateAlertNotification(
          session.access_token,
          alertNotifications[0].id,
          webhookUrl.trim() || undefined,
          typeValue,
          frequencyValue
        )
      } else {
        response = await traceforcApi.createAlertNotification(
          session.access_token,
          webhookUrl,
          typeValue,
          frequencyValue
        )
      }

      if (response.error) {
        throw new Error(response.error)
      }

      const typeName = notificationType === "1" ? "Slack" : "Teams"
      toast({
        title: "Success",
        description: `${typeName} webhook URL saved successfully`,
      })
      
      setWebhookUrl("")
      setNotificationType("1")
      setFrequency(DEFAULT_FREQUENCY.toString() as "1" | "2" | "3")
      setShowAddWebhookDialog(false)
      setShowUpdateWebhookDialog(false)
      
      await fetchAlertNotifications()
    } catch (error) {
      console.error('Error saving webhook:', error)
      toast({
        title: "Error",
        description: "Failed to save webhook URL",
        variant: "destructive",
      })
    } finally {
      setSavingWebhook(false)
    }
  }

  const deleteWebhook = async () => {
    if (!session?.access_token || alertNotifications.length === 0) {
      return
    }

    setDeletingWebhook(true)
    try {
      const response = await traceforcApi.deleteAlertNotification(
        session.access_token,
        alertNotifications[0].id
      )

      if (response.error || !response.data?.success) {
        throw new Error(response.error || 'Failed to delete webhook')
      }

      setAlertNotifications([])
      setWebhookUrl("")
      setNotificationType("1")
      setFrequency(DEFAULT_FREQUENCY.toString() as "1" | "2" | "3")

      toast({
        title: "Success",
        description: "Webhook URL removed successfully",
      })

      setShowDeleteWebhookDialog(false)
    } catch (error) {
      console.error('Error deleting webhook:', error)
      toast({
        title: "Error",
        description: "Failed to remove webhook URL",
        variant: "destructive",
      })
    } finally {
      setDeletingWebhook(false)
    }
  }

  const fetchCustomerStorage = async () => {
    if (!session?.access_token) return

    setLoadingCustomerStorage(true)
    setCustomerStorageLoadingError(false)
    try {
      const response = await traceforcApi.getCustomerStorage(session.access_token)

      if (response.error) {
        throw new Error(response.error)
      }

      setCustomerStorage(response.data || null)
      resetCustomerStorageForm()
    } catch (error) {
      console.error('Error fetching storage provider:', error)
      setCustomerStorageLoadingError(true)
      toast({
        title: "Error",
        description: "Failed to load storage provider settings",
        variant: "destructive",
      })
    } finally {
      setLoadingCustomerStorage(false)
    }
  }

  const resetCustomerStorageForm = () => {
    setSelectedCustomerStorageProvider("1")
    setCustomerStorageConfig({})
    setCustomerStorageFieldError(null)
  }

  const closeStorageModal = () => {
    setShowAddCustomerStorageDialog(false)
    setShowEditCustomerStorageDialog(false)
    resetCustomerStorageForm()
    setCustomerStorageModalView('config')
    setLoggingEligiblePolicies([])
    setSelectedLoggingPolicies(new Set())
    setRedactedLoggingPolicies(new Set())
    fetchCustomerStorage()
  }

  const prefetchLoggingPolicies = async () => {
    setFetchingLoggingPolicies(true)
    try {
      const { data, error } = await supabase.rpc('get_agent_enforceable_policies_for_remediation_type', {
        ...orgRpcArgs(activeOrgId), // scope to the ACTIVE org (subsidiary-aware)
        p_remediation_type: 5,
        p_risk_rule_type: USER_ACTIVITY_LOGGING_RISK_RULE_TYPE
      })
      if (error) throw error
      const policies = data || []
      setLoggingEligiblePolicies(policies)
      setSelectedLoggingPolicies(new Set(policies.filter((p: any) => p.has_remediation).map((p: any) => p.policy_id)))
      setRedactedLoggingPolicies(new Set(policies.filter((p: any) => p.redact_audit_logs !== false).map((p: any) => p.policy_id)))
    } catch (error) {
      console.error('Error fetching logging policies:', error)
    } finally {
      setFetchingLoggingPolicies(false)
    }
  }

  const saveLogging = async () => {
    setSavingLogging(true)
    try {
      const enableIds = loggingEligiblePolicies
        .filter((p: any) => selectedLoggingPolicies.has(p.policy_id) && !p.has_remediation)
        .map((p: any) => p.policy_id)
      const disableIds = loggingEligiblePolicies
        .filter((p: any) => !selectedLoggingPolicies.has(p.policy_id) && p.has_remediation)
        .map((p: any) => p.policy_id)

      if (enableIds.length > 0 || disableIds.length > 0) {
        const { error } = await supabase.rpc('set_policy_remediation_control', {
          ...orgRpcArgs(activeOrgId), // scope the mutation to the ACTIVE org (subsidiary-aware)
          p_enable_policy_ids: enableIds,
          p_disable_policy_ids: disableIds,
          p_remediation_type: 5,
          p_risk_rule_type: USER_ACTIVITY_LOGGING_RISK_RULE_TYPE
        })
        if (error) throw error
      }

      // Persist redaction changes for selected policies only; deselected policies
      // keep their stored setting.
      const redactIds = loggingEligiblePolicies
        .filter((p: any) => selectedLoggingPolicies.has(p.policy_id) && redactedLoggingPolicies.has(p.policy_id) && p.redact_audit_logs === false)
        .map((p: any) => p.policy_id)
      const unredactIds = loggingEligiblePolicies
        .filter((p: any) => selectedLoggingPolicies.has(p.policy_id) && !redactedLoggingPolicies.has(p.policy_id) && p.redact_audit_logs !== false)
        .map((p: any) => p.policy_id)
      if (redactIds.length > 0 || unredactIds.length > 0) {
        const { error } = await supabase.rpc('set_policy_audit_redaction', {
          ...orgRpcArgs(activeOrgId), // scope the mutation to the ACTIVE org (subsidiary-aware)
          p_redact_policy_ids: redactIds,
          p_unredact_policy_ids: unredactIds,
          p_risk_rule_type: USER_ACTIVITY_LOGGING_RISK_RULE_TYPE
        })
        if (error) throw error
      }

      closeStorageModal()
    } catch (error) {
      console.error('Error saving logging policies:', error)
      toast({
        title: "Error",
        description: "Failed to save activity auditing settings",
        variant: "destructive",
      })
    } finally {
      setSavingLogging(false)
    }
  }

  const handleCustomerStorageConfigChange = (key: string, value: string) => {
    setCustomerStorageConfig(prev => ({ ...prev, [key]: value }))
    setCustomerStorageFieldError(e => (e?.key === key ? null : e))
  }

  const saveCustomerStorage = async () => {
    if (!session?.access_token) return

    const provider = parseInt(selectedCustomerStorageProvider)
    const requiredFields = (CUSTOMER_STORAGE_PROVIDER_FIELDS[provider] || []).filter(f => f.key !== 'key_prefix')
    if (!requiredFields.every(f => customerStorageConfig[f.key]?.trim())) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    // container is validated against its trimmed/lowercased form, so the SAVED config must use
    // that same normalized form too -- otherwise a value like "  Traceforce-Logs  " passes the
    // check but gets persisted with the spaces/casing that made it invalid in the first place
    // (Azure container paths are case-sensitive). account isn't checked here: the API already
    // does that on save (see the comment above validateAzureContainerName in appUtils.tsx).
    let configToSave = customerStorageConfig
    if (provider === 3) {
      const containerResult = validateAzureContainerName(customerStorageConfig.container)
      if (containerResult.error) {
        setCustomerStorageFieldError({ key: "container", message: containerResult.error })
        return
      }
      configToSave = { ...customerStorageConfig, container: containerResult.normalized }
    }

    setSavingCustomerStorage(true)
    setCustomerStorageFieldError(null)
    try {
      let response
      if (customerStorage) {
        response = await traceforcApi.updateCustomerStorage(
          session.access_token,
          customerStorage.id,
          configToSave
        )
      } else {
        response = await traceforcApi.createCustomerStorage(
          session.access_token,
          parseInt(selectedCustomerStorageProvider),
          configToSave
        )
      }

      if (response.error) {
        console.error('Storage provider save error:', response.error)
        // A 400 naming a config field is input validation: show it under that input.
        const key = response.statusCode === 400 ? response.field?.replace(/^config\./, '') : undefined
        if (key && response.message && CUSTOMER_STORAGE_PROVIDER_FIELDS[provider]?.some(f => f.key === key)) {
          setCustomerStorageFieldError({ key, message: response.message })
        } else {
          toast({ title: "Error", description: apiErrorText(response), variant: "destructive" })
        }
        return
      }

      toast({
        title: "Success",
        description: "Storage provider saved successfully",
      })

      setCustomerStorageModalView('logging')
    } catch (error) {
      console.error('Error saving storage provider:', error)
      toast({
        title: "Error",
        description: "Failed to save storage provider",
        variant: "destructive",
      })
    } finally {
      setSavingCustomerStorage(false)
    }
  }

  const deleteCustomerStorage = async () => {
    if (!session?.access_token || !customerStorage) return

    setDeletingCustomerStorage(true)
    try {
      const response = await traceforcApi.deleteCustomerStorage(
        session.access_token,
        customerStorage.id
      )

      if (response.error || !response.data?.success) {
        console.error('Storage provider delete error:', response.error)
        throw new Error(response.error || 'Failed to delete storage provider')
      }

      setCustomerStorage(null)
      resetCustomerStorageForm()

      toast({
        title: "Success",
        description: "Storage provider removed successfully",
      })

      setShowDeleteCustomerStorageDialog(false)
    } catch (error) {
      console.error('Error deleting storage provider:', error)
      toast({
        title: "Error",
        description: "Failed to remove storage provider",
        variant: "destructive",
      })
    } finally {
      setDeletingCustomerStorage(false)
    }
  }

  const getStorageStatusText = () => {
    if (loadingCustomerStorage) return "Loading..."
    if (customerStorage) {
      let text = `${getCustomerStorageProviderLabel(customerStorage.provider)} connected`
      if (customerStorage.last_validated_at) {
        text += ` · Last validated ${formatDistanceToNow(new Date(customerStorage.last_validated_at), { addSuffix: true })}`
      } else if (customerStorage.error_code) {
        text += ` · Validation failed`
      } else {
        text += ` · Waiting for first validation`
      }
      return text
    }
    return null
  }

  // Render section content inside sheet
  const renderSectionContent = () => {
    switch (selectedSection) {
      case 'api-clients':
        return renderApiClientsContent()
      case 'downloads':
        return renderDownloadsContent()
      case 'sandbox-setup':
        return <SandboxSetupCard />
      case 'notifications':
        return renderNotificationsContent()
      case 'mdm-integration':
        return <MdmSettingsSection session={session} onStatusChange={setMdmLines} onWarningChange={setMdmHasWarning} />
      case 'otel-export':
        return <OtelExportSection session={session} onChanged={setOtelDestinations} />
      case 'customer-storage':
        return renderStorageContent()
      case 'microsoft-copilot':
        return copilotEnabled ? <CopilotTerraformSetup onConnectionsChange={refreshCopilotTenants} /> : null
      case 'aws-bedrock-role':
        return awsBedrockEnabled ? <AwsBedrockConnections /> : null
      case 'lakehouse':
        // Gate the setup sheet on the same readiness check the tile uses (a connected
        // S3 or GCS provider with a bucket, or Azure provider with an account, container, and
        // tenant_id). A non-null storage record that isn't a ready target — reachable via the
        // ?section= deep link even though the tile is non-clickable — must not open the setup
        // form; show the gated state instead.
        if (lakehouseReady && customerStorage) {
          return <LakehouseSetupSheet customerStorage={customerStorage} />
        }
        return (
          <div className="text-sm text-muted-foreground">
            {lakehouseState === 'unsupported' ? (
              <p>
                Lakehouse is available for Amazon S3, Google Cloud Storage and Azure Blob Storage. Coming soon for{' '}
                {getCustomerStorageProviderLabel(customerStorage?.provider)}.
              </p>
            ) : (
              <>
                <p>Connect an Amazon S3, Google Cloud Storage or Azure Blob Storage provider to set up the Lakehouse.</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 w-fit"
                  onClick={() => setSelectedSection('customer-storage')}
                >
                  Set up storage
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </>
            )}
          </div>
        )
      default:
        return null
    }
  }

  const renderCreateDialog = () => (
    <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
      <div className="inline-flex items-center gap-3">
        <DialogTrigger asChild>
          <Button className="gap-2" disabled={!canCreateMore}>
            <Plus className="h-4 w-4" />
            Create API Client
          </Button>
        </DialogTrigger>
        {!canCreateMore && (
          <span className="text-sm text-muted-foreground">
            Limit of {MAX_API_CLIENTS} reached.
          </span>
        )}
      </div>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create API Client</DialogTitle>
          <DialogDescription>
            Enter a name for your API client. It must be unique within your organization.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="client-name">Client Name</Label>
            <Input
              id="client-name"
              placeholder="Enter client name"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setShowCreateDialog(false)
              setClientName("")
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={createApiClient}
            disabled={creating || !clientName.trim()}
          >
            {creating ? "Creating..." : "Create"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )

  const renderApiClientsContent = () => (
    <>
      {apiClientLoadingError ? (
        <div className="text-center py-8 text-destructive">
          Failed to load API clients
        </div>
      ) : loadingApiClients ? (
        <div className="space-y-4">
          <Skeleton className="h-6 w-48" />
          <div className="grid gap-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </div>
      ) : apiClients.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-muted-foreground mb-4">
            No API clients yet. Create one to get started.
          </div>
          {renderCreateDialog()}
        </div>
      ) : (
        <div className="space-y-6">
          {apiClients.map((client) => {
            const isVisible = visibleCredentials.has(client.id)
            const isDeleting = deletingId === client.id
            return (
              <div key={client.id} className="space-y-4 border rounded-md p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Name:</span>
                    <h3 className="text-sm font-medium">{client.name}</h3>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleCredentialsVisibility(client.id)}
                      className="gap-2"
                    >
                      {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      {isVisible ? "Hide" : "Show"}
                    </Button>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={isDeleting}
                          className="gap-2"
                        >
                          <Trash2 className="h-4 w-4" />
                          {isDeleting ? "Deleting..." : "Delete"}
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Delete API Client</DialogTitle>
                          <DialogDescription>
                            Are you sure you want to delete this API client? This action cannot be undone and will permanently remove the client credentials. All devices and clients using this API client will stop working until new credentials are created and deployed.
                            {client.client_id && (
                              <div className="mt-2 p-2 bg-muted rounded text-xs font-mono">
                                Client ID: {client.client_id}
                              </div>
                            )}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="flex justify-end gap-2 pt-4">
                          <DialogTrigger asChild>
                            <Button variant="outline">Cancel</Button>
                          </DialogTrigger>
                          <Button
                            onClick={() => deleteApiClient(client.id)}
                            disabled={isDeleting}
                            variant="destructive"
                          >
                            {isDeleting ? "Deleting..." : "Delete"}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>

                <div className="grid gap-3">
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-md">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-muted-foreground mb-1">Client ID</div>
                      <div className="font-mono text-sm">
                        {isVisible ? client.client_id : "••••••••••••••••"}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(client.client_id ?? '', 'Client ID')}
                      className="ml-2"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-md">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-muted-foreground mb-1">Client Secret</div>
                      <div className="font-mono text-sm">
                        {isVisible ? client.client_secret : "••••••••••••••••"}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(client.client_secret ?? '', 'Client Secret')}
                      className="ml-2"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
          <div>{renderCreateDialog()}</div>
        </div>
      )}
    </>
  )

  const renderDownloadsContent = () => (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Download scanner packages for different operating systems to deploy in your environment.
      </p>
      <DownloadScannerDialog />
    </div>
  )

  const renderNotificationsContent = () => (
    <>
      {alertNotificationLoadingError ? (
        <div className="text-center py-8 text-destructive">
          Failed to load alert notification settings
        </div>
      ) : loadingAlertNotifications ? (
        <div className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : alertNotifications.length === 0 || !alertNotifications[0].configuration?.webhook_url?.trim() ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            No webhook configured. Add a webhook URL to receive alert notifications for security events and findings.
          </p>
          <Dialog open={showAddWebhookDialog} onOpenChange={setShowAddWebhookDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Alert Settings
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Webhook</DialogTitle>
                <DialogDescription>
                  Enter your webhook URL to receive alert notifications.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="notification-type">Notification Type</Label>
                  <Select value={notificationType} onValueChange={(value) => setNotificationType(value as "1" | "2")}>
                    <SelectTrigger id="notification-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ALERT_NOTIFICATION_TYPE_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="frequency">Frequency</Label>
                  <Select value={frequency} onValueChange={(value) => setFrequency(value as "1" | "2" | "3")}>
                    <SelectTrigger id="frequency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FREQUENCY_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-webhook">Webhook URL</Label>
                  <Input
                    id="add-webhook"
                    type="url"
                    placeholder={notificationType === "1" ? "https://hooks.slack.com/services/..." : "https://outlook.office.com/webhook/..."}
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowAddWebhookDialog(false)}>Cancel</Button>
                <Button 
                  onClick={saveWebhook} 
                  disabled={savingWebhook || !webhookUrl.trim()}
                >
                  {savingWebhook ? "Saving..." : "Save"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Configure webhook to receive alert notifications for security events and findings.
          </p>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-md">
              <div className="flex-1 min-w-0">
                <div className="text-xs text-muted-foreground mb-1">Notification Type</div>
                <div className="text-sm">
                  {getAlertNotificationTypeLabel(alertNotifications[0].configuration.alert_notification_type)}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-md">
              <div className="flex-1 min-w-0">
                <div className="text-xs text-muted-foreground mb-1">Frequency</div>
                <div className="text-sm">
                  {getFrequencyLabel(alertNotifications[0].configuration.frequency)}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-md">
              <div className="flex-1 min-w-0">
                <div className="text-xs text-muted-foreground mb-1">Webhook URL</div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="font-mono text-sm truncate cursor-default">
                        {alertNotifications[0].configuration.webhook_url}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent align="start">
                      <p>{alertNotifications[0].configuration.webhook_url}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Dialog open={showUpdateWebhookDialog} onOpenChange={(open) => {
              setShowUpdateWebhookDialog(open)
              if (open && alertNotifications[0]?.configuration) {
                const config = alertNotifications[0].configuration
                setNotificationType(config.alert_notification_type.toString() as "1" | "2")
                setFrequency((config.frequency ?? DEFAULT_FREQUENCY).toString() as "1" | "2" | "3")
              }
            }}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Alert Settings</DialogTitle>
                  <DialogDescription>
                    Update your alert notification settings.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="update-notification-type">Notification Type</Label>
                    <Select value={notificationType} onValueChange={(value) => setNotificationType(value as "1" | "2")}>
                      <SelectTrigger id="update-notification-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ALERT_NOTIFICATION_TYPE_OPTIONS.map(option => (
                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="update-frequency">Frequency</Label>
                    <Select value={frequency} onValueChange={(value) => setFrequency(value as "1" | "2" | "3")}>
                      <SelectTrigger id="update-frequency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FREQUENCY_OPTIONS.map(option => (
                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="update-webhook">Webhook URL</Label>
                    <Input
                      id="update-webhook"
                      type="url"
                      placeholder="Leave blank to keep existing"
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowUpdateWebhookDialog(false)}>Cancel</Button>
                  <Button
                    onClick={saveWebhook}
                    disabled={savingWebhook}
                  >
                    {savingWebhook ? "Updating..." : "Update"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={showDeleteWebhookDialog} onOpenChange={setShowDeleteWebhookDialog}>
              <DialogTrigger asChild>
                <Button 
                  variant="destructive"
                  disabled={deletingWebhook}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {deletingWebhook ? "Removing..." : "Remove"}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Remove Alert Settings</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to remove the alert settings? You will no longer receive alert notifications until you set up new alert settings.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setShowDeleteWebhookDialog(false)}>Cancel</Button>
                  <Button 
                    onClick={deleteWebhook}
                    disabled={deletingWebhook}
                    variant="destructive"
                  >
                    {deletingWebhook ? "Removing..." : "Remove"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      )}
    </>
  )

  const renderLoggingPoliciesUI = (idPrefix: string) => (
    <div className="py-4 space-y-2">
      {fetchingLoggingPolicies ? (
        <>
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </>
      ) : loggingEligiblePolicies.length === 0 ? (
        <p className="text-sm text-muted-foreground">No eligible policies found.</p>
      ) : (
        <>
          {loggingEligiblePolicies.length > 1 && (
            <div className="flex items-center gap-3 py-1 border-b mb-1">
              <Checkbox
                id={`log-policy-all-${idPrefix}`}
                checked={loggingEligiblePolicies.every(p => selectedLoggingPolicies.has(p.policy_id))}
                onCheckedChange={(checked) => {
                  setSelectedLoggingPolicies(checked
                    ? new Set(loggingEligiblePolicies.map(p => p.policy_id))
                    : new Set()
                  )
                }}
              />
              <label htmlFor={`log-policy-all-${idPrefix}`} className="text-sm cursor-pointer font-medium">Select all</label>
            </div>
          )}
          {loggingEligiblePolicies.map((p: any) => (
            <div key={p.policy_id}>
              <div className="flex items-center gap-3 py-1">
                <Checkbox
                  id={`log-policy-${idPrefix}-${p.policy_id}`}
                  checked={selectedLoggingPolicies.has(p.policy_id)}
                  onCheckedChange={(checked) => {
                    setSelectedLoggingPolicies(prev => {
                      const next = new Set(prev)
                      if (checked) next.add(p.policy_id)
                      else next.delete(p.policy_id)
                      return next
                    })
                  }}
                />
                <label htmlFor={`log-policy-${idPrefix}-${p.policy_id}`} className="text-sm cursor-pointer">{p.policy_name}</label>
                <a href={`/policies/${p.policy_id}`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
              {selectedLoggingPolicies.has(p.policy_id) && (
                <div className="flex items-center gap-3 py-1 pl-7">
                  <Checkbox
                    id={`log-redact-${idPrefix}-${p.policy_id}`}
                    checked={redactedLoggingPolicies.has(p.policy_id)}
                    onCheckedChange={(checked) => {
                      setRedactedLoggingPolicies(prev => {
                        const next = new Set(prev)
                        if (checked) next.add(p.policy_id)
                        else next.delete(p.policy_id)
                        return next
                      })
                    }}
                  />
                  <label htmlFor={`log-redact-${idPrefix}-${p.policy_id}`} className="text-xs text-muted-foreground cursor-pointer">
                    Redact sensitive data in stored logs
                  </label>
                </div>
              )}
            </div>
          ))}
          <p className="text-xs text-muted-foreground pt-2">Only policies that can enforce user activity auditing are shown.</p>
        </>
      )}
    </div>
  )

  const renderStorageConfigForm = (isEdit: boolean) => (
    <>
      <DialogHeader>
        <DialogTitle>{isEdit ? 'Edit Storage Provider' : 'Configure Storage Provider'}</DialogTitle>
        <DialogDescription>
          {isEdit ? 'Update your storage configuration.' : 'Enter your storage details to enable data export.'} <a href="https://traceforce.readme.io/docs/storage-provider-integration" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:no-underline">Learn more</a>
          {!isEdit && (
            <span className="block mt-2 text-xs">Once configured, we'll attempt to backfill up to 7 days of prior data, though some content may no longer be available.</span>
          )}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-4">
        {isEdit && customerStorage ? (
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-md">
            <div className="flex-1 min-w-0">
              <div className="text-xs text-muted-foreground mb-1">Provider</div>
              <div className="text-sm">
                {getCustomerStorageProviderLabel(customerStorage.provider)}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="cs-provider">Storage Provider</Label>
            <Select value={selectedCustomerStorageProvider} onValueChange={(value) => {
              setSelectedCustomerStorageProvider(value)
              setCustomerStorageConfig({})
              setCustomerStorageFieldError(null)
            }}>
              <SelectTrigger id="cs-provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CUSTOMER_STORAGE_PROVIDER_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {CUSTOMER_STORAGE_PROVIDER_FIELDS[parseInt(selectedCustomerStorageProvider)]?.map(field => {
          const id = `${isEdit ? 'edit-' : ''}cs-${field.key}`
          const err = customerStorageFieldError?.key === field.key ? customerStorageFieldError.message : null
          return (
            <div key={field.key} className="space-y-2">
              <Label htmlFor={id}>{field.label}</Label>
              <Input
                id={id}
                type={field.type || "text"}
                placeholder={field.placeholder}
                value={customerStorageConfig[field.key] || ""}
                onChange={(e) => handleCustomerStorageConfigChange(field.key, e.target.value)}
                aria-invalid={!!err}
                aria-describedby={err ? `${id}-error` : undefined}
                className={err ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {err && <p id={`${id}-error`} role="alert" className="text-xs text-destructive">{err}</p>}
            </div>
          )
        })}
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={closeStorageModal}>Cancel</Button>
        <Button onClick={saveCustomerStorage} disabled={savingCustomerStorage}>
          {savingCustomerStorage ? "Saving..." : "Save"}
        </Button>
      </div>
    </>
  )

  const renderStorageContent = () => (
    <>
      {customerStorage?.is_customer_error && customerStorage?.error_code === 403 && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive mb-4">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span><span className="font-semibold">ACTION REQUIRED:</span> Permission denied. Verify the required permissions are configured for your storage. <a href="https://traceforce.readme.io/docs/storage-provider-integration" target="_blank" rel="noopener noreferrer" className="underline hover:no-underline">Learn more</a></span>
        </div>
      )}
      {customerStorage?.is_customer_error && customerStorage?.error_code === 404 && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive mb-4">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span><span className="font-semibold">ACTION REQUIRED:</span> Storage not found. Verify the storage configuration is correct. <a href="https://traceforce.readme.io/docs/storage-provider-integration" target="_blank" rel="noopener noreferrer" className="underline hover:no-underline">Learn more</a></span>
        </div>
      )}
      {customerStorage?.is_customer_error && customerStorage?.error_code && customerStorage.error_code !== 403 && customerStorage.error_code !== 404 && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive mb-4">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span><span className="font-semibold">ACTION REQUIRED:</span> Storage validation failed. Verify the storage configuration is correct, or contact support if this persists. <a href="https://traceforce.readme.io/docs/storage-provider-integration" target="_blank" rel="noopener noreferrer" className="underline hover:no-underline">Learn more</a></span>
        </div>
      )}
      {customerStorageLoadingError ? (
        <div className="text-center py-8 text-destructive">
          Failed to load storage provider settings
        </div>
      ) : loadingCustomerStorage ? (
        <div className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : !customerStorage ? (
        <div>
          <Dialog open={showAddCustomerStorageDialog} onOpenChange={(open) => {
            setShowAddCustomerStorageDialog(open)
            if (open) {
              setCustomerStorageFieldError(null)
              prefetchLoggingPolicies()
            } else {
              closeStorageModal()
            }
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Configure Storage
              </Button>
            </DialogTrigger>
            <DialogContent>
              {customerStorageModalView === 'config' ? (
                renderStorageConfigForm(false)
              ) : (
                <>
                  <DialogHeader>
                    <DialogTitle>User Activity Auditing</DialogTitle>
                    <DialogDescription>
                      Storage provider configured. Select policies to enable activity auditing.
                    </DialogDescription>
                  </DialogHeader>
                  {renderLoggingPoliciesUI('add')}
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={closeStorageModal} disabled={savingLogging}>Skip</Button>
                    <Button onClick={saveLogging} disabled={savingLogging || fetchingLoggingPolicies}>
                      {savingLogging ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </>
              )}
            </DialogContent>
          </Dialog>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Storage configured for data export.
          </p>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-md">
              <div className="flex-1 min-w-0">
                <div className="text-xs text-muted-foreground mb-1">Provider</div>
                <div className="text-sm">
                  {getCustomerStorageProviderLabel(customerStorage.provider)}
                </div>
              </div>
            </div>

            {CUSTOMER_STORAGE_PROVIDER_FIELDS[customerStorage.provider]?.map(field => (
              customerStorage.config[field.key] && (
                <div key={field.key} className="flex items-center justify-between p-3 bg-muted/50 rounded-md">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-muted-foreground mb-1">{field.label}</div>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="text-sm truncate cursor-default">
                            {customerStorage.config[field.key]}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent align="start">
                          <p>{customerStorage.config[field.key]}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              )
            ))}
          </div>

          <div className="flex gap-2">
            <Dialog open={showEditCustomerStorageDialog} onOpenChange={(open) => {
              setShowEditCustomerStorageDialog(open)
              if (open && customerStorage) {
                setSelectedCustomerStorageProvider(customerStorage.provider.toString())
                setCustomerStorageConfig(customerStorage.config || {})
                setCustomerStorageFieldError(null)
                prefetchLoggingPolicies()
              } else if (!open) {
                closeStorageModal()
              }
            }}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              </DialogTrigger>
              <DialogContent>
                {customerStorageModalView === 'config' ? (
                  renderStorageConfigForm(true)
                ) : (
                  <>
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        User Activity Auditing
                        <Badge variant="secondary" className="font-normal">Optional</Badge>
                      </DialogTitle>
                      <DialogDescription>
                        Store full conversation history for the policies you select.
                      </DialogDescription>
                    </DialogHeader>
                    {renderLoggingPoliciesUI('edit')}
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={closeStorageModal} disabled={savingLogging}>Skip</Button>
                      <Button onClick={saveLogging} disabled={savingLogging || fetchingLoggingPolicies}>
                        {savingLogging ? "Saving..." : "Save"}
                      </Button>
                    </div>
                  </>
                )}
              </DialogContent>
            </Dialog>

            <Dialog open={showDeleteCustomerStorageDialog} onOpenChange={setShowDeleteCustomerStorageDialog}>
              <DialogTrigger asChild>
                <Button
                  variant="destructive"
                  disabled={deletingCustomerStorage}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {deletingCustomerStorage ? "Removing..." : "Remove"}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Remove Storage Provider</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to remove the storage provider configuration? Data will no longer be exported to {getCustomerStorageProviderLabel(customerStorage.provider)}.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setShowDeleteCustomerStorageDialog(false)}>Cancel</Button>
                  <Button
                    onClick={deleteCustomerStorage}
                    disabled={deletingCustomerStorage}
                    variant="destructive"
                  >
                    {deletingCustomerStorage ? "Removing..." : "Remove"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      )}
    </>
  )

  const getSectionTitle = () => {
    switch (selectedSection) {
      case 'api-clients': return 'API Clients'
      case 'downloads': return 'Downloads'
      case 'sandbox-setup': return 'Sandbox Setup'
      case 'notifications': return 'Alert Notifications'
      case 'mdm-integration': return 'Device Identity Mapping'
      case 'customer-storage': return 'Storage Provider'
      case 'microsoft-copilot': return 'Microsoft Copilot Integration'
      case 'aws-bedrock-role': return 'AWS Bedrock Integration'
      case 'lakehouse': return 'Lakehouse'
      case 'otel-export': return 'OTLP Forwarding'
      default: return ''
    }
  }

  const getSectionDescription = () => {
    switch (selectedSection) {
      case 'api-clients': return 'Manage your API clients'
      case 'downloads': return 'Download client packages and tools'
      case 'sandbox-setup': return 'Enable AI-assistant monitoring inside dev containers'
      case 'notifications': return 'Configure how you receive alerts'
      case 'mdm-integration': return 'Connect MDM providers to associate devices with their owners'
      case 'customer-storage': return 'Configure storage to export data to your own infrastructure'
      case 'microsoft-copilot': return 'Collect Microsoft 365 Copilot agents with a collector in your own Azure subscription'
      case 'aws-bedrock-role': return 'Deploy cross-account access for Bedrock AgentCore inventory collection'
      case 'lakehouse': return 'Query your AI-agent activity in plain language, in your own cloud.'
      case 'otel-export': return 'Send a copy of agent logs, traces and metrics to your own OTLP collectors, alongside Traceforce. Logging policies choose the destinations.'
      default: return ''
    }
  }

  // Lakehouse tile gating, derived from the storage config (rules + tests in lakehouseSnippet).
  const lakehouseState = lakehouseTileState(customerStorage)
  const lakehouseReady = lakehouseState === 'ready'

  const sections = [
    {
      label: 'Essentials',
      tiles: [
        {
          id: 'api-clients',
          icon: Key,
          title: 'API Clients',
          description: 'Manage your API clients',
          hasWarning: false,
          learnMoreUrl: null,
          navigateTo: null,
        },
        {
          id: 'downloads',
          icon: Download,
          title: 'Download Packages',
          description: 'Download client packages and tools.',
          hasWarning: false,
          learnMoreUrl: 'https://traceforce.readme.io/docs/quickstart#deployment',
          navigateTo: null,
        },
        {
          id: 'sandbox-setup',
          icon: Box,
          title: 'Sandbox Setup',
          description: 'Enable AI-assistant monitoring inside dev containers.',
          hasWarning: false,
          learnMoreUrl: 'https://traceforce.readme.io/docs/sandbox-setup',
          navigateTo: null,
        },
      ],
    },
    {
      label: 'User Management',
      tiles: [
        {
          id: 'mdm-integration',
          icon: Link,
          title: 'Device Identity Mapping',
          description: mdmLines.length > 0
            ? <>{mdmLines.map((line, idx) => <span key={idx} className="block">{line}</span>)}</>
            : 'Connect MDM providers to associate devices with their owners.',
          hasWarning: mdmHasWarning,
          learnMoreUrl: mdmLines.length === 0 ? 'https://traceforce.readme.io/docs/mdm-integration' : null,
          navigateTo: null,
        },
        {
          id: 'identity-provider',
          icon: idpLinked ? ShieldCheck : Lock,
          title: 'Identity Provider',
          // Keyed on idpLinked, not idpConnected: an unhealthy-but-linked
          // directory shows its provider status (plus the warning triangle),
          // never the setup pitch. Last-synced only when actually connected.
          // While nothing is known yet (first load, no cached state) a skeleton
          // renders instead — flashing the setup pitch at a connected org reads
          // as "the connection is gone".
          description: idpIntegration === undefined
            ? <Skeleton className="h-4 w-64 mt-1" />
            : idpStatusText
              ? `${idpStatusText}${idpConnected && idpIntegration?.last_synced ? ` · Last checked for updates ${formatDistanceToNow(new Date(idpIntegration.last_synced), { addSuffix: true })}` : ''}`
              : IDP_SETUP_DESCRIPTION,
          // Warns on the failure states AND on an unfinished IdP-side setup
          // (discovering with the directory still unlinked): that state never
          // resolves without the admin acting, unlike linked-discovering.
          hasWarning:
            idpIntegration?.ui_state === 'attention_customer' ||
            idpIntegration?.ui_state === 'attention_platform' ||
            (idpIntegration?.ui_state === 'discovering' && !idpDirectoryLive),
          learnMoreUrl: null,
          navigateTo: null,
        },
      ],
    },
    {
      label: 'Storage',
      tiles: [
        {
          id: 'customer-storage',
          icon: HardDrive,
          title: 'Storage Provider',
          description: getStorageStatusText() ?? 'Configure storage to export data to your own infrastructure.',
          hasWarning: customerStorage?.is_customer_error && (customerStorage?.error_code === 403 || customerStorage?.error_code === 404),
          learnMoreUrl: !customerStorage ? 'https://traceforce.readme.io/docs/storage-provider-integration' : null,
          navigateTo: null,
        },
        {
          // Renders its own gated card via renderLakehouseTile; the generic
          // tile fields are unused.
          id: 'lakehouse',
        },
      ],
    },
    ...(copilotEnabled || awsBedrockEnabled ? [{
      label: 'Cloud Integrations',
      tiles: [
        ...(copilotEnabled ? [{
          id: 'microsoft-copilot',
          icon: Cloud,
          title: 'Microsoft Copilot Integration',
          description: copilotTenants === null
            ? <Skeleton className="h-4 w-48" />
            : copilotTileSummary(copilotTenants),
          hasWarning: !!copilotTenants?.some(needsAttention),
          learnMoreUrl: null,
          navigateTo: null,
        }] : []),
        ...(awsBedrockEnabled ? [{
          id: 'aws-bedrock-role',
          icon: Cloud,
          title: 'AWS Bedrock Integration',
          description: 'Deploy cross-account access for Bedrock AgentCore inventory collection.',
          hasWarning: false,
          learnMoreUrl: null,
          navigateTo: null,
        }] : []),
      ],
    }] : []),
    {
      label: 'Observability',
      tiles: [
        {
          id: 'otel-export',
          icon: Waypoints,
          title: 'OTLP Forwarding',
          description: otelSummary
            ? <><span className="block">{OTEL_EXPORT_TILE_PITCH}</span><span className="block">{otelSummary}</span></>
            : OTEL_EXPORT_TILE_PITCH,
          hasWarning: false,
          learnMoreUrl: null,
          navigateTo: null,
        },
      ],
    },
    {
      label: 'Workflows',
      tiles: [
        {
          id: 'notifications',
          icon: Bell,
          title: 'Alert Notifications',
          description: 'Configure how you receive alerts',
          hasWarning: false,
          learnMoreUrl: null,
          navigateTo: null,
        },
      ],
    },
  ]

  // One activation path for click and keyboard, so the two can't diverge.
  const activateTile = (tile: typeof sections[0]['tiles'][0]) => {
    if (tile.navigateTo) navigate(tile.navigateTo)
    else if (tile.id === 'identity-provider') setIdpDrawerOpen(true)
    else setSelectedSection(tile.id)
  }

  // The Lakehouse tile has three gated states (ready / needs-storage / unsupported)
  // that don't fit the generic tile, so it renders its own card.
  const renderLakehouseTile = () => {
    if (loadingCustomerStorage) {
      return (
        <Card key="lakehouse" className="relative">
          <CardHeader className="pb-3">
            <Skeleton className="h-10 w-10 rounded-lg mb-2" />
            <Skeleton className="h-5 w-40 mb-1" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </CardHeader>
        </Card>
      )
    }
    const disabled = lakehouseState === 'unsupported'
    const clickable = lakehouseState === 'ready'
    const description =
      lakehouseState === 'unsupported'
        ? `Available for Amazon S3, Google Cloud Storage and Azure Blob Storage. Coming soon for ${getCustomerStorageProviderLabel(customerStorage?.provider)}.`
        : 'Query your AI-agent activity in plain language, in your own cloud account.'
    return (
      <Card
        key="lakehouse"
        className={`relative transition-colors ${clickable ? 'cursor-pointer hover:bg-accent/50' : ''} ${disabled ? 'opacity-60' : ''}`}
        onClick={clickable ? () => setSelectedSection('lakehouse') : undefined}
        role={clickable ? 'button' : undefined}
        tabIndex={clickable ? 0 : undefined}
        onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedSection('lakehouse') } } : undefined}
        aria-disabled={disabled || undefined}
      >
        {lakehouseState === 'needs-storage' && (
          <div className="absolute top-3 right-3">
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </div>
        )}
        <CardHeader className="pb-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
            <Database className="h-5 w-5 text-primary" />
          </div>
          <CardTitle className="text-base flex items-center gap-2">
            Lakehouse
            <Badge variant="secondary" className="font-normal">Early access</Badge>
          </CardTitle>
          <CardDescription className="text-sm line-clamp-2">{description}</CardDescription>
          {lakehouseState === 'needs-storage' && (
            <Button
              variant="outline"
              size="sm"
              className="mt-3 w-fit"
              onClick={(e) => { e.stopPropagation(); setSelectedSection('customer-storage') }}
            >
              Set up storage
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </CardHeader>
      </Card>
    )
  }

  const renderTile = (tile: typeof sections[0]['tiles'][0]) => {
    if (tile.id === 'lakehouse') return renderLakehouseTile()
    const Icon = tile.icon
    const isNavTile = !!tile.navigateTo
    return (
      <Card
        key={tile.id}
        className="cursor-pointer hover:bg-accent/50 transition-colors relative"
        onClick={() => activateTile(tile)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activateTile(tile) } }}
      >
        {tile.hasWarning && (
          <div className="absolute top-3 right-3">
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </div>
        )}
        {isNavTile && (
          <div className="absolute top-3 right-3">
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
        <CardHeader className="pb-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <CardTitle className="text-base">{tile.title}</CardTitle>
          {/* Clamp single-string descriptions to 2 lines; let multi-line JSX descriptions
              (e.g. the MDM tile's per-provider lines) render in full so none get clipped. */}
          <CardDescription className={typeof tile.description === 'string' ? 'text-sm line-clamp-2' : 'text-sm'}>
            {tile.description}
            {tile.learnMoreUrl && (
              <>
                {' '}
                <a
                  href={tile.learnMoreUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline hover:no-underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  Learn more
                </a>
              </>
            )}
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground">Manage your account and application preferences</p>
      </div>

      {sections.map((section) => (
        <div key={section.label} className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">{section.label}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {section.tiles.map(renderTile)}
          </div>
        </div>
      ))}

      {/* Directory Sync drawer for the Identity Provider tile */}
      <DirectorySyncDrawer
        open={idpDrawerOpen}
        onOpenChange={setIdpDrawerOpen}
        integration={idpIntegration}
        // Undefined lets the drawer's IDP_SETUP_DESCRIPTION default apply — one
        // copy of the pitch, not three. Any linked state shows provider status.
        description={idpStatusText ?? undefined}
        onChanged={setIdpIntegration}
      />

      {/* Sheet for section content */}
      <Sheet open={!!selectedSection} onOpenChange={(open) => { if (!open) setSelectedSection(null) }}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{getSectionTitle()}</SheetTitle>
            <SheetDescription>{getSectionDescription()}</SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            {renderSectionContent()}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

export default Settings
