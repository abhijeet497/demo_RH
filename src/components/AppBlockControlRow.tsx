import { useEffect, useState, type ReactNode } from "react"
import { Edit2, Info } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table"
import { MultiSelect } from "@/components/ui/multi-select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  originOptions,
  appOptions,
  resolveBlockedApps,
  fetchAppBlockConfig,
  saveAppBlockConfig,
  type AppBlockConfig,
} from "@/lib/appBlockPolicy"
import { useBlockableAgents } from "@/hooks/use-blockable-agents"
import { useToast } from "@/hooks/use-toast"

// ===========================================================================
// Blocked AI applications — ONE row inside Policy Controls (the AI Access policy).
//
// PROXY-based: the admin blocks an AI app's NETWORK access by ORIGIN (selected
// countries) and/or by selecting specific apps. The on-device Scout proxy drops
// connections to those apps' domains — covering the desktop app, browser, and CLI,
// and working even on cert-pinned apps. No MDM required.
//
// Blockable apps + origins come from real agent_catalog data (hosts/origin_country)
// via useBlockableAgents. Selection persists per-policy to policies.ai_access_config
// (JSONB) via saveAppBlockConfig; the device-config resolver reads it to derive each
// device's blocked_agent_types.
// ===========================================================================

const AppBlockControlRow = ({
  policyId,
}: {
  policyId: string
}) => {
  const { apps, loading, error: appsError } = useBlockableAgents()
  const totalApps = apps.length
  const { toast } = useToast()

  const [saved, setSaved] = useState<AppBlockConfig | null>(null)
  const [draft, setDraft] = useState<AppBlockConfig | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoadError(false)
    fetchAppBlockConfig(policyId)
      .then((cfg) => { if (!cancelled) setSaved(cfg) })
      .catch(() => { if (!cancelled) setLoadError(true) })
    return () => { cancelled = true }
  }, [policyId])

  // A failed policy-config read or blockable-apps catalog read: show an explicit
  // unavailable row, NOT a misleading "0 of 0" / disabled control (which would read as
  // a real, saved "off" state).
  if (loadError || appsError) {
    return (
      <TableRow>
        <TableCell />
        <TableCell>
          <div className="font-medium text-primary">Blocked AI applications</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Couldn't load — the policy or app catalog is unavailable. Refresh to retry.
          </div>
        </TableCell>
        <TableCell colSpan={3} className="text-sm text-muted-foreground">Unavailable</TableCell>
      </TableRow>
    )
  }

  // Still loading the policy config or the app catalog: show a skeleton row rather than an
  // empty table under the headers (or a brief "0 of 0 applications blocked" before the
  // catalog lands once the config has arrived).
  if (!saved || loading) {
    return (
      <TableRow>
        <TableCell><Skeleton className="h-5 w-9" /></TableCell>
        <TableCell><Skeleton className="h-5 w-56" /></TableCell>
        <TableCell colSpan={3}><Skeleton className="h-5 w-40" /></TableCell>
      </TableRow>
    )
  }

  const blockedCount = resolveBlockedApps(saved, apps).length
  const effectiveEnabled = saved.enabled
  const rowDisabled = !effectiveEnabled

  // Optimistic write with rollback: saveAppBlockConfig throws on a failed write, so on
  // error we restore the previous config and tell the admin, instead of leaving the UI
  // showing an unsaved change as saved until refresh. Returns whether the save stuck.
  const persist = async (next: AppBlockConfig): Promise<boolean> => {
    // Serialize: ignore a new save while one is in flight, so two rapid toggles can't
    // write out of order (leaving the DB at the older value) or roll a late failure back
    // over a newer successful write. Both entry points are also disabled while saving.
    if (saving) return false
    const prev = saved
    setSaving(true)
    setSaved(next)
    try {
      await saveAppBlockConfig(policyId, next)
      return true
    } catch {
      setSaved(prev)
      toast({ title: "Error", description: "Couldn't save the change. Please try again.", variant: "destructive" })
      return false
    } finally {
      setSaving(false)
    }
  }

  const openEditor = () => setDraft({ ...saved })

  const update = (patch: Partial<AppBlockConfig>) =>
    setDraft(draft ? { ...draft, ...patch } : draft)

  const draftBlockedApps = draft ? resolveBlockedApps(draft, apps) : []

  // The "Select AI apps" dropdown is for EXPLICIT app picks only (block_agent_types).
  // Origin is a SEPARATE, dynamic rule (block_origins, resolved per-device by
  // getBlockedAgentTypesForDevice): origin-matched apps are deliberately NOT ticked here —
  // they show in the "Applications that will be blocked" preview below. This keeps the
  // dropdown ticks in sync with the saved config, and preserves the dynamic origin rule
  // (a new app from a blocked origin is auto-covered without re-editing the app list).
  const allAppIds = apps.map((a) => a.id)
  const allAppsSelected = !!draft && totalApps > 0 && draft.blockApps.length === totalApps
  const toggleSelectAllApps = () => update({ blockApps: allAppsSelected ? [] : allAppIds })

  return (
    <>
      <TableRow className={rowDisabled ? "opacity-50" : ""}>
        <TableCell>
          <Switch
            checked={effectiveEnabled}
            disabled={saving}
            aria-label="Enable blocked AI applications control"
            onCheckedChange={(checked) => { void persist({ ...saved, enabled: checked }) }}
          />
        </TableCell>
        <TableCell>
          <div className="font-medium text-primary">Blocked AI applications</div>
          <div className="text-xs text-muted-foreground mt-1">
            Block selected AI applications from communicating with their AI agents
          </div>
        </TableCell>
        <TableCell className="font-medium">
          {rowDisabled ? (
            <span className="text-muted-foreground">Disabled</span>
          ) : (
            <div>
              <div>Block selected AI applications</div>
              <div className="mt-1 text-xs font-normal text-muted-foreground">
                {blockedCount} of {totalApps} applications blocked
              </div>
            </div>
          )}
        </TableCell>
        <TableCell>
          {rowDisabled ? (
            <span className="text-muted-foreground">Disabled</span>
          ) : (
            <Badge variant="destructive">Block</Badge>
          )}
        </TableCell>
        <TableCell>
          {!rowDisabled && (
            <Button
              variant="ghost"
              size="sm"
              aria-label="Edit blocked AI applications"
              onClick={openEditor}
            >
              <Edit2 className="h-4 w-4" />
            </Button>
          )}
        </TableCell>
      </TableRow>

      <Dialog open={!!draft} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col gap-4">
          {draft && (
            <>
              <DialogHeader>
                <DialogTitle>Block AI applications</DialogTitle>
                <DialogDescription>
                  Block AI applications by origin, or select specific apps. Blocked applications can't
                  communicate with their AI agents on devices in this policy's user groups.
                </DialogDescription>
              </DialogHeader>

              <>
                  <div className="flex items-center justify-between rounded-md border bg-muted/30 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold">Applications to block</p>
                      <p className="text-xs text-muted-foreground">
                        {draftBlockedApps.length} of {totalApps} applications blocked
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">On match</div>
                      <Badge variant="destructive">Block</Badge>
                    </div>
                  </div>

                  <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
                    {/* Policy Controls — toggled filters, aligned filter | selection */}
                    <div className="rounded-lg border">
                      <div className="grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] items-center gap-4 border-b bg-muted/30 px-4 py-2">
                        <span className="w-9" />
                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Filter</span>
                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Selection</span>
                      </div>

                      {/* Origin — toggled */}
                      <ControlRow
                        toggle={
                          <Switch
                            checked={draft.blockByOrigin}
                            aria-label="Enable origin filter"
                            onCheckedChange={(v) => update({ blockByOrigin: v })}
                          />
                        }
                        title="Origin"
                        hint="Block all AI apps that originate from the selected countries."
                      >
                        <MultiSelect
                          options={originOptions(apps)}
                          selectedIds={draft.blockOrigins}
                          onChange={(ids) => update({ blockOrigins: ids })}
                          placeholder="Select origins to block"
                          searchPlaceholder="Search origins..."
                          label="origin"
                          disabled={!draft.blockByOrigin}
                        />
                      </ControlRow>

                      {/* Specific apps — always available (no toggle) */}
                      <ControlRow
                        title="Select AI apps"
                        hint="Block these specific apps, in addition to the origins above."
                      >
                        <MultiSelect
                          options={appOptions(apps)}
                          selectedIds={draft.blockApps}
                          onChange={(ids) => update({ blockApps: ids })}
                          placeholder="Select apps to block"
                          searchPlaceholder="Search apps..."
                          label="app"
                          selectAllLabel="Select all"
                          selectAllChecked={allAppsSelected}
                          onToggleSelectAll={toggleSelectAllApps}
                        />
                      </ControlRow>
                    </div>

                    <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      Blocked applications can't communicate with their AI agents on managed devices —
                      this covers the desktop app, browser, and command-line access.
                    </p>

                    {/* Resolved preview */}
                    <div className="rounded-lg border">
                      <div className="border-b bg-muted/30 px-4 py-2">
                        <p className="text-sm font-medium">
                          Applications that will be blocked ({draftBlockedApps.length})
                        </p>
                      </div>
                      {draftBlockedApps.length === 0 ? (
                        <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                          No applications selected yet — choose an origin or select specific apps above.
                        </p>
                      ) : (
                        <Table>
                          <TableBody>
                            {draftBlockedApps.map((app) => (
                              <TableRow key={app.id}>
                                <TableCell>
                                  <div className="text-sm font-medium">{app.name}</div>
                                  <div className="mt-0.5 text-xs text-muted-foreground">
                                    {app.hosts.join(", ")}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </div>
                  </div>
                </>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDraft(null)}>Cancel</Button>
                {totalApps > 0 && (
                  <Button disabled={saving} onClick={async () => { if (await persist(draft)) setDraft(null) }}>Save changes</Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

// One control row: [toggle | filter label+hint | selection], columns aligned
// with the header. Mirrors the Model Selection "Policy Controls" layout. The
// toggle slot is optional (rows without a toggle keep the columns aligned).
function ControlRow({
  toggle,
  title,
  hint,
  children,
}: {
  toggle?: ReactNode
  title: string
  hint: string
  children: ReactNode
}) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] items-center gap-4 border-b px-4 py-3 last:border-b-0">
      <div className="flex w-9 justify-start">{toggle}</div>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <div>{children}</div>
    </div>
  )
}

export default AppBlockControlRow
