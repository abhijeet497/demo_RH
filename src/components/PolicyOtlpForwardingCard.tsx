import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Waypoints, Pencil, ExternalLink, AlertTriangle } from "lucide-react"
import { Session } from "@supabase/supabase-js"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { traceforcApi } from "@/integrations/traceforce/client"
import type { OtelDestination } from "@/integrations/traceforce/types"
import { getOtelDestinationName, getOtelProtocolLabel, OTEL_FORWARDING_UNSUPPORTED_AGENT_TYPES } from "@/lib/appUtils"

// Sentinel radio value for "Don't forward". Real destination ids are UUIDs, so it can't collide.
const NONE = "__none__"

interface PolicyOtlpForwardingCardProps {
  session: Session | null
  policyId: string
  orgId: string
  /** Current selection from the policy's User Activity Logging control; null = not forwarding. */
  otelDestinationId: string | null
  /**
   * The policy's assigned agents (specific-agent logging policies only). When non-empty, a
   * per-agent forwarding selector is shown, constrained to these; empty/undefined (e.g. an
   * "All Agents" policy) means forward from every agent.
   */
  forwardAgents?: { type: number; name: string }[]
  /** Current per-agent forwarding subset from settings.otel_forward_agent_types; null/absent = all. */
  forwardAgentTypes?: number[] | null
  /** Called after a successful save with the new destination, the forwarding subset (null = all), and updated_at. */
  onSaved: (otelDestinationId: string | null, forwardAgentTypes: number[] | null, updatedAt: string) => void
}

/**
 * Logging policy › "OTLP forwarding": pick one of the org's OTLP destinations (configured
 * under Settings › Observability) to also receive this policy's activity logs, and — for a
 * specific-agent policy — choose which of its agents forward there.
 *
 * Reads destinations from the Traceforce API (masked; never header values) and saves the
 * selection through the set_policy_otel_destination RPC, which stores it on the policy's
 * User Activity Logging control settings after checking the destination's org and status and
 * that the forwarding agents are a subset of the policy's assigned agents.
 */
const PolicyOtlpForwardingCard = ({ session, policyId, orgId, otelDestinationId, forwardAgents, forwardAgentTypes, onSaved }: PolicyOtlpForwardingCardProps) => {
  const navigate = useNavigate()
  const { toast } = useToast()
  const token = session?.access_token

  // undefined = loading; null = load failed (card still renders, without the picker).
  const [destinations, setDestinations] = useState<OtelDestination[] | null | undefined>(undefined)
  // destination id -> ids of OTHER policies already forwarding to it (for the picker note).
  const [usage, setUsage] = useState<Record<string, string[]>>({})

  const [pickerOpen, setPickerOpen] = useState(false)
  const [picked, setPicked] = useState<string>(NONE)
  // Checked agent types in the picker (specific-agent policies only).
  const [pickedAgents, setPickedAgents] = useState<Set<number>>(new Set())
  const [saving, setSaving] = useState(false)

  // The policy's agents, and whether a per-agent forwarding subset applies here at all.
  const agentOptions = forwardAgents ?? []
  const hasAgentScope = agentOptions.length > 0
  // Agents that can actually forward today; the rest stay visible but unpickable (ENG-845).
  const forwardableTypes = agentOptions.filter((a) => !OTEL_FORWARDING_UNSUPPORTED_AGENT_TYPES.has(a.type)).map((a) => a.type)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    traceforcApi.listOtelDestinations(token).then((res) => {
      if (cancelled) return
      setDestinations(res.error ? null : res.data ?? [])
    }).catch(() => { if (!cancelled) setDestinations(null) })
    return () => { cancelled = true }
  }, [token])

  // Which other policies in the org already forward where. Best-effort: a failure here
  // only hides the "Also used by…" note.
  useEffect(() => {
    if (!orgId) return
    let cancelled = false
    // Clear stale counts from the previous policyId/org before the scoped refetch, so the
    // "Also used by N other policies" note can't briefly show the wrong policy's numbers.
    setUsage({})
    supabase
      .from("policy_controls")
      .select("policy_id, settings")
      .eq("org_id", orgId)
      .not("settings->otel_destination_ids", "is", null)
      .then(({ data, error }) => {
        if (cancelled || error || !data) return
        const next: Record<string, string[]> = {}
        for (const row of data) {
          if (row.policy_id === policyId) continue
          const ids = (row.settings as { otel_destination_ids?: unknown } | null)?.otel_destination_ids
          if (!Array.isArray(ids)) continue
          for (const id of ids) {
            if (typeof id === "string") (next[id] ??= []).push(row.policy_id)
          }
        }
        setUsage(next)
      })
    return () => { cancelled = true }
  }, [orgId, policyId])

  const selected = useMemo(
    () => (destinations ?? []).find((d) => d.id === otelDestinationId) ?? null,
    [destinations, otelDestinationId]
  )

  const openPicker = () => {
    setPicked(otelDestinationId && selected ? otelDestinationId : NONE)
    // Default the agent subset to the stored one, or to ALL agents when none is stored
    // (absent = forward from all). Drop any stored type no longer assigned to the policy.
    const allTypes = forwardableTypes
    const initial = forwardAgentTypes && forwardAgentTypes.length > 0
      ? allTypes.filter((t) => forwardAgentTypes.includes(t))
      : allTypes
    setPickedAgents(new Set(initial))
    setPickerOpen(true)
  }

  const goToSettings = () => navigate("/settings?section=otel-export")

  const handleSave = async () => {
    const next = picked === NONE ? null : picked

    // Resolve the per-agent subset. null means "all agents forward": used when forwarding is
    // off, when this policy has no agent scope (e.g. All Agents), or when every agent is
    // checked (absent = all, future-inclusive). Otherwise it's the explicit checked subset.
    let fwd: number[] | null = null
    if (next && hasAgentScope) {
      const allTypes = forwardableTypes
      const chosen = allTypes.filter((t) => pickedAgents.has(t))
      if (chosen.length === 0) {
        toast({ title: "Select at least one agent", description: "Pick which agents forward, or choose \u201CDon't forward\u201D.", variant: "destructive" })
        return
      }
      // null (= every assigned agent, future-inclusive) only when the policy has no unsupported
      // agent; otherwise persist the explicit forwardable subset so the stored policy matches
      // what the dialog shows (ChatGPT unchecked), not "all agents".
      fwd = chosen.length === agentOptions.length ? null : chosen
    }

    // No-op if neither the destination nor the subset changed.
    const sortedOrNull = (a: number[] | null | undefined) => (a && a.length ? [...a].sort((x, y) => x - y) : null)
    const currentFwd = next ? sortedOrNull(forwardAgentTypes) : null
    if (next === otelDestinationId && JSON.stringify(sortedOrNull(fwd)) === JSON.stringify(currentFwd)) {
      setPickerOpen(false)
      return
    }

    setSaving(true)
    const { data, error } = await supabase.rpc("set_policy_otel_destination", {
      p_org_id: orgId,
      p_policy_id: policyId,
      // Always an array: the UI picks one today, but the RPC/device-config/scout handle N,
      // so enabling multi-select is a UI-only change. Empty array = stop forwarding.
      p_otel_destination_ids: next ? [next] : [],
      // Omitted (-> NULL) = forward from all the policy's agents; a subset = only those agents.
      p_forward_agent_types: fwd ?? undefined,
    })
    setSaving(false)
    if (error || !data) {
      console.error("Error saving OTLP forwarding:", error)
      toast({ title: "Could not save OTLP forwarding", description: error?.message ?? "Please try again.", variant: "destructive" })
      return
    }
    onSaved(next, fwd, data)
    setPickerOpen(false)
    const dest = next ? (destinations ?? []).find((d) => d.id === next) : null
    const agentNote = next && hasAgentScope && fwd
      ? ` from ${fwd.length === 1 ? "1 agent" : `${fwd.length} agents`}`
      : ""
    toast({
      title: next ? "OTLP forwarding enabled" : "OTLP forwarding turned off",
      description: next && dest
        ? `Activity logs from this policy will also be sent${agentNote} to ${getOtelDestinationName(dest)}.`
        : "Activity logs from this policy are no longer sent to an OTLP destination.",
    })
  }

  const renderBody = () => {
    if (destinations === undefined) {
      return <Skeleton className="h-16 w-full" />
    }
    if (destinations === null) {
      return (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-dashed p-4">
          <span className="text-sm text-muted-foreground">Could not load your OTLP destinations.</span>
          <Button variant="outline" size="sm" onClick={goToSettings}>
            Open Settings
            <ExternalLink className="h-4 w-4 ml-2" />
          </Button>
        </div>
      )
    }
    if (destinations.length === 0) {
      return (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-dashed p-4">
          <span className="text-sm text-muted-foreground">No OTLP destinations configured yet. Add one in Settings, then select it here.</span>
          <Button variant="outline" size="sm" onClick={goToSettings}>
            Configure in Settings
            <ExternalLink className="h-4 w-4 ml-2" />
          </Button>
        </div>
      )
    }
    if (!selected) {
      return (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-dashed p-4">
          <span className="text-sm text-muted-foreground">Not forwarding. Pick one of your configured destinations.</span>
          <Button size="sm" onClick={openPicker}>Select destination</Button>
        </div>
      )
    }
    // Which agents forward, when a strict subset is active (absent/all shows nothing extra).
    const scopeNames = hasAgentScope && forwardAgentTypes && forwardAgentTypes.length > 0 && forwardAgentTypes.length < agentOptions.length
      ? agentOptions.filter((a) => forwardAgentTypes.includes(a.type)).map((a) => a.name)
      : null
    return (
      <div className="space-y-2">
        <div className={`grid grid-cols-[minmax(0,12rem)_auto_minmax(0,1fr)] items-center gap-4 rounded-lg border p-3 ${selected.enabled ? "" : "border-destructive/40"}`}>
          <div className="min-w-0">
            <div className="font-semibold truncate">{getOtelDestinationName(selected)}</div>
            {!selected.enabled && (
              <div className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Paused in Settings
              </div>
            )}
          </div>
          <Badge variant="secondary" className="font-normal">{getOtelProtocolLabel(selected.protocol)}</Badge>
          <div className="font-mono text-xs truncate" title={selected.endpoint}>{selected.endpoint}</div>
        </div>
        {scopeNames && (
          <p className="text-xs text-muted-foreground">
            Forwarding from: {scopeNames.join(", ")} (other agents log to Traceforce only).
          </p>
        )}
      </div>
    )
  }

  const hasDestinations = Array.isArray(destinations) && destinations.length > 0

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Waypoints className="h-5 w-5" />
                OTLP forwarding
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1.5">
                Also send this policy's activity logs to an OpenTelemetry destination configured in Settings.
              </p>
            </div>
            {hasDestinations && (
              <Button variant="outline" size="sm" onClick={openPicker} className="shrink-0">
                <Pencil className="h-4 w-4 mr-2" />
                {selected ? "Change" : "Select"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {renderBody()}
          {hasDestinations && (
            <Button variant="link" className="h-auto p-0 text-sm font-medium" onClick={goToSettings}>
              Manage destinations in Settings →
            </Button>
          )}
        </CardContent>
      </Card>

      <Dialog open={pickerOpen} onOpenChange={(open) => { if (!saving) setPickerOpen(open) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Select OTLP destination</DialogTitle>
            <DialogDescription>Activity logs from this policy will also be sent to the destination you pick.</DialogDescription>
          </DialogHeader>

          <RadioGroup value={picked} onValueChange={setPicked} className="gap-0 rounded-lg border divide-y">
            <label className={`grid grid-cols-[1.125rem_minmax(0,1fr)] items-start gap-3.5 p-4 cursor-pointer ${picked === NONE ? "bg-primary/5" : ""}`}>
              <RadioGroupItem value={NONE} className="mt-0.5" aria-label="Don't forward" />
              <div className="space-y-1">
                <div className="font-semibold">Don't forward</div>
                <div className="text-xs text-muted-foreground">Activity logs are not sent to any OTLP destination.</div>
              </div>
            </label>
            {(destinations ?? []).map((d) => {
              const paused = !d.enabled
              const others = usage[d.id] ?? []
              const isPicked = picked === d.id
              return (
                <label
                  key={d.id}
                  className={`grid grid-cols-[1.125rem_minmax(0,1fr)] items-start gap-3.5 p-4 ${paused ? "cursor-not-allowed opacity-70" : "cursor-pointer"} ${isPicked ? "bg-primary/5" : ""}`}
                >
                  <RadioGroupItem value={d.id} disabled={paused} className="mt-0.5" aria-label={getOtelDestinationName(d)} />
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold truncate">{getOtelDestinationName(d)}</span>
                      <Badge variant="secondary" className="font-normal shrink-0">{getOtelProtocolLabel(d.protocol)}</Badge>
                    </div>
                    <div className="font-mono text-xs truncate" title={d.endpoint}>{d.endpoint}</div>
                    {paused ? (
                      <div className="text-xs text-muted-foreground">Paused in Settings. Turn it on there to select it.</div>
                    ) : others.length > 0 ? (
                      <div className="text-xs text-muted-foreground">
                        Also used by {others.length === 1 ? "1 other policy" : `${others.length} other policies`}
                      </div>
                    ) : null}
                  </div>
                </label>
              )
            })}
          </RadioGroup>

          {picked !== NONE && hasAgentScope && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Forward from these agents</div>
              <p className="text-xs text-muted-foreground">
                Only the selected agents send their activity logs to this destination. Every agent still logs to Traceforce.
              </p>
              <div className="rounded-lg border divide-y">
                {agentOptions.map((a) => {
                  const supported = !OTEL_FORWARDING_UNSUPPORTED_AGENT_TYPES.has(a.type)
                  return (
                    <label key={a.type} className={`flex items-center gap-3 p-3 ${supported ? "cursor-pointer" : "cursor-not-allowed"}`}>
                      <Checkbox
                        checked={supported && pickedAgents.has(a.type)}
                        disabled={!supported}
                        onCheckedChange={(v) =>
                          setPickedAgents((prev) => {
                            const nextSet = new Set(prev)
                            if (v === true) nextSet.add(a.type)
                            else nextSet.delete(a.type)
                            return nextSet
                          })
                        }
                        aria-label={a.name}
                      />
                      <span className={`text-sm ${supported ? "" : "text-muted-foreground"}`}>{a.name}</span>
                      {!supported && <Badge variant="outline" className="ml-auto font-normal text-muted-foreground">Coming soon</Badge>}
                    </label>
                  )
                })}
              </div>
              {pickedAgents.size === 0 && (
                <p className="text-xs text-destructive">
                  {forwardableTypes.length === 0
                    ? "None of this policy's agents can forward yet."
                    : "Select at least one agent, or choose “Don't forward”."}
                </p>
              )}
            </div>
          )}

          <Button variant="link" className="h-auto p-0 self-start text-sm font-medium" onClick={goToSettings}>
            Add or manage destinations in Settings →
          </Button>

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button variant="outline" onClick={() => setPickerOpen(false)} disabled={saving}>Cancel</Button>
            <Button
              onClick={() => void handleSave()}
              disabled={saving || (picked !== NONE && hasAgentScope && pickedAgents.size === 0)}
            >
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default PolicyOtlpForwardingCard
