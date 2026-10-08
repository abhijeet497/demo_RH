import { useEffect, useRef, useState } from "react"
import type React from "react"
import { useNavigate } from "react-router-dom"
import { AlertTriangle, ExternalLink, Loader2, RefreshCw, Unplug, Users, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/AuthContext"
import { traceforcApi } from "@/integrations/traceforce/client"
import type { IdpIntegration, TraceforceApiResponse } from "@/integrations/traceforce/types"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { providerLabel, pickPrimaryIdpIntegration, getDirectoryStateLabel, isLiveDirectoryState, isLiveLinkedIdpState, IDP_SETUP_DESCRIPTION, IDP_DELTA_SYNC_LABEL } from "@/lib/appUtils"
import { apiErrorText } from "@/lib/api-errors"

/** Narrow an unknown catch value (network failure, thrown Error) for display. */
const errorMessage = (e: unknown): string =>
  e instanceof Error ? e.message : String(e)

/** Drawer timestamps are absolute (product decision; the tile uses relative). */
const timestampOrNever = (value: string | null) =>
  value ? new Date(value).toLocaleString() : "Never"

/** Button content that swaps to a spinner while its action is in flight. */
const busyContent = (active: boolean, Icon: LucideIcon, label: string, busyText: string) =>
  active
    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{busyText}</>
    : <><Icon className="h-4 w-4 mr-2" />{label}</>

// ---------------------------------------------------------------------------
// Directory Sync drawer.
//
// This deliberately does NOT show a SCIM base URL or a bearer token. WorkOS
// exposes no API that returns either value, and no endpoint that creates a
// directory — both live exclusively in the WorkOS Admin Portal. So the connect
// flow is a redirect: the backend creates/resolves the customer's WorkOS
// organization, mints a single-use portal link, and we hand the admin over.
// They pick their provider and copy their SCIM credentials there.
//
// Every state shown here is the backend's server-derived ui_state; the drawer
// never re-derives lifecycle from raw columns.
// ---------------------------------------------------------------------------

interface DirectorySyncDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Notifies the parent after any state change so tiles can re-render. */
  onChanged?: (integration: IdpIntegration | null) => void
  /** Mirrors the Identity Provider card description so both stay in sync.
   * Defaults to IDP_SETUP_DESCRIPTION. */
  description?: React.ReactNode
  /** Preloaded integration from the parent (fetched at page load), so opening
   * the drawer renders instantly instead of flashing a loading state; the
   * drawer still refreshes in the background on open. */
  integration?: IdpIntegration | null
}

const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex items-start justify-between gap-4 py-2 border-b border-border/50 last:border-0">
    <Label className="text-muted-foreground font-normal">{label}</Label>
    <div className="text-sm text-right">{value}</div>
  </div>
)

export const DirectorySyncDrawer = ({ open, onOpenChange, onChanged, description, integration: preloaded }: DirectorySyncDrawerProps) => {
  const { toast } = useToast()
  const { session } = useAuth()
  const navigate = useNavigate()
  const token = session?.access_token

  const [integration, setIntegration] = useState<IdpIntegration | null>(preloaded ?? null)

  // Keep the internal copy seeded from the parent's page-load fetch; onChanged
  // reports back up, so the two stay consistent without extra requests.
  useEffect(() => {
    if (preloaded !== undefined) setIntegration(preloaded)
  }, [preloaded])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<null | "connect" | "sync" | "disconnect">(null)

  // Product decision: one IdP per org, but the API is list-shaped so nothing
  // here breaks if a second integration appears — the PRIMARY one is rendered
  // (live linked > pending > disconnected, see pickPrimaryIdpIntegration).
  const uiState = integration?.ui_state
  const isLinked = isLiveLinkedIdpState(uiState)
  // Picks the copy WITHIN the server-derived "discovering" state:
  // linked-and-first-sync-running vs the IdP has never pushed (e.g. a wrong
  // SCIM token, which fails silently on the IdP's side).
  const directoryLive = isLiveDirectoryState(integration?.directory_state)
  // The customer deleted the WorkOS directory (synthetic state the worker
  // writes after tombstoning the mirror). Terminal for this connection —
  // only Disconnect → Reconnect recovers it — so the banner becomes a step
  // guide and the action stack changes shape.
  const directoryDeleted = (integration?.directory_state ?? "").toLowerCase() === "deleted"

  // Loads overlap (reopen, token refresh, post-action reloads) and resolve in
  // any order; only the most recently STARTED one may commit state, or a slow
  // stale response overwrites a fresh one — and leaks upward via onChanged.
  const loadSeq = useRef(0)

  const load = async (opts?: { silent?: boolean }) => {
    if (!token) return
    const seq = ++loadSeq.current
    const isCurrent = () => seq === loadSeq.current
    setLoading(true)
    try {
      const res = await traceforcApi.listIdpIntegrations(token)
      if (!isCurrent()) return
      if (res.error) {
        // silent = background refresh (the setup poll): a transient blip must
        // not fire the destructive toast at an admin who did nothing.
        if (!opts?.silent) toast({ title: "Could not load the identity provider", description: apiErrorText(res), variant: "destructive" })
        return
      }
      const next = pickPrimaryIdpIntegration(res.data?.integrations ?? [])
      setIntegration(next)
      onChanged?.(next)

      // Stray pending rows (setups abandoned mid-wizard) are deliberately NOT
      // reaped here. A client-side DELETE would act on this list snapshot: the
      // row can get linked by the WorkOS webhook between the list and the
      // delete, and while the primary is `disconnecting` a coexisting pending
      // row is a legitimate reconnect-fresh setup, not garbage — in both cases
      // the unconditional DELETE would tear down a real directory. Strays are
      // never rendered (pickPrimaryIdpIntegration ranks them below anything
      // live) and the backend's 7-day lazy expiry collects them.
    } catch (e) {
      if (isCurrent() && !opts?.silent) toast({ title: "Could not load the identity provider", description: errorMessage(e), variant: "destructive" })
    } finally {
      if (isCurrent()) setLoading(false)
    }
  }

  useEffect(() => {
    if (open) void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, token])

  // pending_setup and discovering only resolve server-side (worker discovery /
  // the first sync), and this is the drawer the app auto-opens right after the
  // WorkOS callback — without a poll the admin watches a spinner that only
  // updates on close/reopen. Silent ticks so a background blip never toasts;
  // loadSeq already serializes overlapping responses; the cleanup clears the
  // interval on close or as soon as the state moves on.
  useEffect(() => {
    if (!open || (uiState !== "pending_setup" && uiState !== "discovering")) return
    const timer = setInterval(() => { void load({ silent: true }) }, 12_000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, uiState, token])

  // Directory Users answers what this drawer's numbers raise — who was synced
  // and what devices they resolve to — so View Groups lands there, unfiltered
  // (all groups); the group picker on that page narrows from the whole roster.
  const viewSyncedGroups = () => {
    onOpenChange(false)
    navigate("/directory-users?source_settings=true")
  }

  // Configure, resume, and reconfigure all end in the WorkOS Admin Portal; which
  // endpoint mints the link depends on the lifecycle state:
  //  - no integration          -> connect (creates the pending row first)
  //  - disconnected            -> reconnect (revives the SAME row: tombstoned
  //                               groups and their policy assignments come back)
  //  - anything else           -> portal-link (fresh single-use link)
  const openPortal = async () => {
    if (!token) return
    setBusy("connect")
    // The linked "adjust" flow opens the portal in a NEW TAB — but window.open
    // after an await is outside the click gesture and gets popup-blocked, so the
    // tab is pre-opened synchronously here and pointed at the URL once minted.
    const adjustTab = isLinked ? window.open("", "_blank") : null
    try {
      let res: TraceforceApiResponse<{ portal_url: string }>
      if (!integration) {
        res = await traceforcApi.connectIdpIntegration(token)
        // One setup in flight per org: a 409 means a pending row already exists
        // (another tab, or an earlier abandoned click). A 502
        // IDP_PORTAL_LINK_FAILED means connect DID create the row but the
        // portal mint failed — the backend expects the client to resume. Both
        // recover identically: find the pending row, mint via portal-link, so
        // a transient WorkOS blip becomes a same-click success.
        if (res.code === "IDP_PENDING_SETUP_EXISTS" || res.code === "IDP_PORTAL_LINK_FAILED") {
          const list = await traceforcApi.listIdpIntegrations(token)
          const pending = list.data?.integrations?.find((i) => i.ui_state === "pending_setup")
          if (pending) res = await traceforcApi.getIdpPortalLink(token, pending.id)
        }
      } else if (uiState === "disconnected") {
        res = await traceforcApi.reconnectIdpIntegration(token, integration.id)
        // Reconnect revives the SAME row before minting, so the two failure
        // shapes converge on a direct re-mint (no re-list needed): a 502
        // IDP_PORTAL_LINK_FAILED left the row revived with no portal URL, and
        // a 409 IDP_INTEGRATION_NOT_DISCONNECTED is the retry after exactly
        // that — the row is already pending_setup again.
        if (res.code === "IDP_PORTAL_LINK_FAILED" || res.code === "IDP_INTEGRATION_NOT_DISCONNECTED") {
          res = await traceforcApi.getIdpPortalLink(token, integration.id)
        }
      } else {
        res = await traceforcApi.getIdpPortalLink(token, integration.id)
      }

      if (res.error) {
        adjustTab?.close()
        if (res.code === "IDP_TEARDOWN_IN_PROGRESS") {
          // Reconnect raced the async teardown. The leftovers clean themselves
          // up (the worker's sweep), so this needs customer copy plus a state
          // resync — the API's message is developer-facing ("call DELETE
          // again"), which means nothing in this UI. No retry affordance: the
          // case that needs one presents as `disconnecting`, which already has
          // Retry disconnect.
          toast({
            title: "Previous directory still being cleaned up",
            description: "This finishes automatically — try reconnecting in a few minutes.",
          })
          setBusy(null)
          void load({ silent: true })
          return
        }
        toast({ title: "Could not open the WorkOS Admin Portal", description: apiErrorText(res), variant: "destructive" })
        setBusy(null)
        return
      }

      const portalUrl = res.data?.portal_url
      if (!portalUrl) throw new Error("No portal link was returned")

      if (isLinked) {
        // Reconfigure on a LINKED integration opens the portal's management page,
        // which has no "return to Traceforce" button — a full navigation would
        // strand the admin there. New tab instead; Traceforce stays open behind.
        if (adjustTab) {
          adjustTab.opener = null
          adjustTab.location.href = portalUrl
        } else {
          // Popup fully blocked even synchronously — degrade to same-tab rather
          // than doing nothing. This deliberately accepts the stranding the
          // comment above avoids: a silently dead button is worse, and the
          // admin can always reopen Traceforce in another tab.
          window.location.href = portalUrl
        }
        setBusy(null)
        return
      }

      // Setup flows (configure / continue / reconnect) use a full navigation, not
      // a new tab: the portal wizard redirects back to /settings when the admin
      // finishes, and that round trip is how the app knows to refresh and kick a
      // discovery sync. Reset busy first — a back/bfcache restore revives this
      // React state, and a stuck busy leaves every button disabled on "Opening…".
      setBusy(null)
      window.location.href = portalUrl
    } catch (e) {
      adjustTab?.close()
      toast({ title: "Could not open the WorkOS Admin Portal", description: errorMessage(e), variant: "destructive" })
      setBusy(null)
    }
  }

  // Queues the Go sync worker (202) and defaults to a full reconcile — the
  // admin clicking "Sync now" wants the mirror authoritatively refreshed.
  // No reload afterwards: the run is asynchronous, so nothing server-side has
  // changed yet — counts update on the next drawer open.
  const syncNow = async () => {
    if (!token || !integration) return
    setBusy("sync")
    const res = await traceforcApi.syncIdpIntegration(token, integration.id)
    setBusy(null)
    if (res.error) {
      toast({ title: "Sync failed to queue", description: apiErrorText(res), variant: "destructive" })
      return
    }
    toast({
      title: "Sync queued",
      description: "Groups and users are refreshing in the background. Counts update within a few minutes.",
    })
  }

  const disconnect = async () => {
    if (!token || !integration) return
    setBusy("disconnect")
    const res = await traceforcApi.deleteIdpIntegration(token, integration.id)
    if (res.error) {
      setBusy(null)
      toast({ title: "Could not disconnect", description: apiErrorText(res), variant: "destructive" })
      return
    }
    const data = res.data
    if (data && !data.teardown_queued) {
      // The disconnect itself succeeded, but the async teardown was not queued:
      // synced groups may keep granting access until Disconnect is retried.
      toast({
        title: "Disconnected — cleanup not queued",
        description: data.teardown_error ?? "Synced groups may still grant access. Click Disconnect again to retry the cleanup.",
        variant: "destructive",
      })
    } else {
      // Name the blast radius concretely: synced groups stop matching devices,
      // and any policy scoped to one narrows.
      const affected = data?.policies_affected ?? 0
      toast({
        title: "Identity provider disconnected",
        description: affected > 0
          ? `${data?.groups_affected ?? 0} synced group(s) will no longer match devices, affecting ${affected} policy/policies. Reconnecting later restores them.`
          : `${data?.groups_affected ?? 0} synced group(s) will no longer match devices.`,
      })
    }
    await load()
    setBusy(null)
  }

  // Cancel an unfinished setup. Same endpoint as disconnect; nothing was ever
  // synced, so this is a clean abort with no blast radius.
  const cancelSetup = async () => {
    if (!token || !integration) return
    setBusy("disconnect")
    const res = await traceforcApi.deleteIdpIntegration(token, integration.id)
    if (res.error) {
      setBusy(null)
      toast({ title: "Could not cancel the setup", description: apiErrorText(res), variant: "destructive" })
      return
    }
    toast({ title: "Setup cancelled", description: "You can configure an identity provider again at any time." })
    await load()
    setBusy(null)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto flex flex-col">
        <SheetHeader>
          <SheetTitle>Identity Provider</SheetTitle>
          <SheetDescription asChild>
            <div>{description ?? IDP_SETUP_DESCRIPTION}</div>
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 flex-1 space-y-6">
          {loading && !integration ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : !integration || uiState === "disconnected" ? (
            <>
              {uiState === "disconnected" ? (
                <div className="space-y-2">
                  <p className="text-sm text-foreground">
                    <span className="font-medium">This identity provider was disconnected</span>
                    {integration.disconnected_at && <> on {timestampOrNever(integration.disconnected_at)}</>}.
                  </p>
                  {/* The restoration promise is tied to the LAST connected
                      provider: revival operates on the last disconnect's
                      tombstones, so the promise is only made when the provider
                      is known — a row disconnected before discovery has none. */}
                  {integration.provider && integration.provider !== "unknown" && (
                    <p className="text-sm text-muted-foreground">
                      Reconnecting with <span className="font-medium text-foreground">{providerLabel(integration.provider)}</span> restores{" "}
                      <span className="font-medium text-foreground">your synced groups and their policy assignments</span> after the first sync.
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground/80">
                    You'll go through the same WorkOS setup — a new SCIM endpoint
                    and token to configure in your identity provider, completing
                    all the steps until you're returned here.
                  </p>
                </div>
              ) : (
                // First-run body: sets expectations BEFORE the click — the admin
                // needs IdP admin access, and setup is only done once the portal
                // returns them here (mid-abandoned setups were a real support
                // pattern). Steps mirror the portal's actual sequence.
                <div className="space-y-3 text-sm text-muted-foreground">
                  <p>
                    Setup happens in the WorkOS Admin Portal, our directory-sync
                    partner. You'll need admin access to your identity provider
                    to complete it.
                  </p>
                  <ol className="space-y-2">
                    <li className="flex gap-2">
                      <span className="font-medium text-foreground">1.</span>
                      <span>Click Configure below — you'll be taken to WorkOS.</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="font-medium text-foreground">2.</span>
                      <span>Choose your provider — Okta, Microsoft Entra ID, JumpCloud, and more.</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="font-medium text-foreground">3.</span>
                      <span>Copy the SCIM endpoint and token shown there into your identity provider, then assign the users and groups to sync.</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="font-medium text-foreground">4.</span>
                      <span>Complete all the remaining steps — you'll be returned to Traceforce automatically when setup is finished.</span>
                    </li>
                  </ol>
                  <p className="text-xs text-muted-foreground/80">
                    Groups and users import automatically within a few minutes of
                    your provider's first push and stay in sync from then on.
                    Membership is managed in your provider and read-only here.
                  </p>
                </div>
              )}
              <Button className="w-full" disabled={busy !== null || !token} onClick={openPortal}>
                {busyContent(busy === "connect", ExternalLink, uiState === "disconnected" ? "Reconnect in WorkOS" : "Configure in WorkOS", "Opening…")}
              </Button>
            </>
          ) : uiState === "pending_setup" ? (
            <>
              {/* Honest for BOTH arrivals here: the callback sends
                  idp_setup=complete even when the admin abandoned the portal,
                  and a genuinely finished setup still reads pending_setup until
                  worker discovery claims the directory (up to ~5 minutes) — so
                  this copy must not presume either case. */}
              <p className="text-sm text-muted-foreground">
                Directory setup was started. If you finished the steps in WorkOS,
                your directory will be detected and the first sync will start
                within about 5 minutes. If you didn't finish, continue in WorkOS
                — or cancel setup to start over. Unfinished setups expire on
                their own after 7 days.
              </p>
              <div className="flex flex-col gap-2">
                <Button disabled={busy !== null} onClick={openPortal}>
                  {busyContent(busy === "connect", ExternalLink, "Continue in WorkOS", "Opening…")}
                </Button>
                <Button variant="ghost" className="text-destructive" disabled={busy !== null} onClick={cancelSetup}>
                  {busy === "disconnect"
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Cancelling…</>
                    : "Cancel setup"}
                </Button>
              </div>
            </>
          ) : (
            <>
              {/* No banner when healthy: the header already says "• Connected",
                  and a green box repeating it is noise — banners are reserved
                  for states that need the admin's attention. */}
              {uiState === "discovering" && (directoryLive ? (
                <div className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                  Directory linked — waiting for the first sync to complete.
                </div>
              ) : (
                // The IdP has NEVER pushed to this directory. Warning (amber),
                // not destructive (red): this is also the normal state while an
                // admin is mid-setup pasting credentials — red is reserved for
                // the attention_* failure states. It only persists when the
                // SCIM endpoint/token in the IdP is wrong.
                <div className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    Your identity provider has not connected to this directory
                    yet. If you finished setup, verify the SCIM endpoint and
                    token in your identity provider — Reconfigure in WorkOS
                    shows them. Groups and users import automatically once the
                    first push arrives.
                  </span>
                </div>
              ))}
              {/* Curated copy only — error.message is the Go worker's raw error
                  chain (WorkOS JSON, internal directory ids): an ops diagnostic
                  that lives in the DB and CloudWatch, never in customer UI. */}
              {(uiState === "attention_customer" || uiState === "attention_platform") && (directoryDeleted ? (
                // Red carries the ALERT (icon + summary); the explanation and
                // the recovery steps are content, not error — standard body
                // color for readability on the tinted background, with the
                // actionable words bolded for scanning.
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-destructive" />
                  <div className="space-y-2 text-foreground">
                    <p>
                      <span className="font-medium text-destructive">The WorkOS directory behind this connection was deleted</span>,
                      and its synced groups and users have been removed from Traceforce.
                    </p>
                    <ol className="space-y-1">
                      <li>1. Click <span className="font-medium">Disconnect</span> below.</li>
                      <li>2. Then <span className="font-medium">Reconnect</span> — you'll set up a fresh directory in WorkOS.</li>
                      <li>3. Reconnecting with the same provider restores your synced groups and their policy assignments after the first sync.</li>
                    </ol>
                  </div>
                </div>
              ) : (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    {uiState === "attention_platform"
                      ? "The sync is failing. The problem is on our side — no action is needed from you, and we are on it."
                      : (integration.directory_state ?? "").toLowerCase() === "invalid_credentials"
                        ? "Your identity provider rejected the connection (e.g. expired credentials). Reconfigure in WorkOS to review it."
                        : "The sync is failing. This needs a fix on your identity provider's side (e.g. expired credentials) — Reconfigure in WorkOS to review the connection."}
                  </span>
                </div>
              ))}
              {uiState === "disconnecting" && (
                <div className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning flex items-start gap-2">
                  <Loader2 className="h-4 w-4 shrink-0 mt-0.5 animate-spin" />
                  <span>
                    Disconnecting — synced groups are still being removed and may keep
                    matching devices until this finishes. If it does not complete,
                    click Retry disconnect.
                  </span>
                </div>
              )}

              <div className="space-y-0">
                <Row label="Provider" value={providerLabel(integration.provider)} />
                <Row
                  label="Directory status"
                  value={directoryDeleted
                    ? <span className="font-medium text-destructive">Deleted</span>
                    : getDirectoryStateLabel(integration.directory_state)}
                />
                {/* A deleted directory's mirror was tombstoned: zeroed counts
                    read as "nothing ever existed" and advancing run timestamps
                    as "still working" — both hidden; the banner tells the story. */}
                {!directoryDeleted && (
                  <>
                    <Row label="Groups synced" value={integration.counts.groups_live} />
                    <Row label="Directory users" value={integration.counts.directory_users_live} />
                    <Row label="Policies using synced groups" value={integration.counts.policies_attached} />
                  </>
                )}
                {/* Hidden while discovering (both flavors): last_synced stamps
                    every successful worker RUN, including vacuous runs before
                    the IdP's first push — shown next to "has not connected
                    yet" it reads as "synced and found nothing". The rows
                    return once the first data sync completes the state. */}
                {uiState !== "discovering" && !directoryDeleted && (
                  <>
                    {/* Static product fact: the delta-sync schedule
                        (rate(5 minutes) on the idp-sync lambda). Sets the
                        expectation for how fast an IdP change shows up here. */}
                    <Row label="Sync interval" value={IDP_DELTA_SYNC_LABEL} />
                    <Row label="Last checked for updates" value={timestampOrNever(integration.last_synced)} />
                    {/* Only moves when a directory event actually arrives — the
                        self-diagnosis signal for IdP-side push failures, which
                        never reach us (SCIM: the IdP fails at WorkOS's door and
                        the stream just goes quiet while "Last checked for
                        updates" advances).
                        undefined = the API predates the field (deploy window):
                        hide the row rather than show a lying "Never" — it
                        self-activates when the API side ships. */}
                    {integration.last_event_received_at !== undefined && (
                      <Row label="Last update from provider" value={timestampOrNever(integration.last_event_received_at)} />
                    )}
                  </>
                )}
              </div>

              <div className="flex flex-col gap-2">
                {uiState === "disconnecting" ? (
                  <Button variant="outline" className="text-destructive" disabled={busy !== null} onClick={disconnect}>
                    {busyContent(busy === "disconnect", Unplug, "Retry disconnect", "Retrying…")}
                  </Button>
                ) : directoryDeleted ? (
                  <>
                    {/* Sync can never succeed against a deleted directory —
                        disabled (the banner above says why; no tooltip) rather
                        than hidden, so the feature stays discoverable.
                        Reconfigure is HIDDEN, not disabled: the portal would
                        offer creating a directory nothing can ever claim (the
                        row's directory id is COALESCE-locked), and a disabled
                        trap still reads as "the obvious fix". Disconnect is
                        this state's one real action (the banner's step 1), so
                        it gets the outline prominence. */}
                    <span className="w-full cursor-not-allowed">
                      <Button className="w-full" disabled>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Sync now
                      </Button>
                    </span>
                    <Button variant="outline" className="text-destructive" disabled={busy !== null} onClick={disconnect}>
                      {busyContent(busy === "disconnect", Unplug, "Disconnect", "Disconnecting…")}
                    </Button>
                  </>
                ) : (
                  <>
                    {integration.counts.groups_live > 0 && (
                      <Button variant="outline" disabled={busy !== null} onClick={viewSyncedGroups}>
                        <Users className="h-4 w-4 mr-2" />
                        View Groups
                      </Button>
                    )}
                    <Button disabled={busy !== null} onClick={syncNow}>
                      {busyContent(busy === "sync", RefreshCw, "Sync now", "Queueing…")}
                    </Button>
                    <Button variant="outline" disabled={busy !== null} onClick={openPortal}>
                      {busyContent(busy === "connect", ExternalLink, "Reconfigure in WorkOS", "Opening…")}
                    </Button>
                    {/* Confirmed because it is the one destructive one-click in
                        the drawer (tears down the WorkOS directory, tombstones
                        every synced group, narrows scoped policies) — matching
                        the MDM tile's Remove. Only THIS button: Retry disconnect
                        must stay one-click (its failure toast says to click it
                        again), Cancel setup has no blast radius, and the
                        deleted-directory state's Disconnect is the guided step 1
                        of an already-empty mirror. */}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" className="text-destructive" disabled={busy !== null}>
                          {busyContent(busy === "disconnect", Unplug, "Disconnect", "Disconnecting…")}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Disconnect this identity provider?</AlertDialogTitle>
                          <AlertDialogDescription>
                            {integration.counts.groups_live} synced group(s) will stop matching devices
                            {integration.counts.policies_attached > 0 && <>, narrowing {integration.counts.policies_attached} assigned policy/policies</>}
                            , and the WorkOS directory will be deleted. Reconnecting later restores
                            the groups and their policy assignments.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={disconnect}
                          >
                            Disconnect
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

export default DirectorySyncDrawer
