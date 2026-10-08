import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { Plus, Pencil, Trash2, Eye, EyeOff, X, AlertCircle, Waypoints } from "lucide-react"
import { Session } from "@supabase/supabase-js"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Link } from "react-router-dom"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { useOrg } from "@/contexts/OrgContext"
import { traceforcApi } from "@/integrations/traceforce/client"
import type {
  OtelDestination,
  OtelDestinationHeaderInput,
  OtelDestinationInput,
  OtelProtocol,
} from "@/integrations/traceforce/types"
import {
  OTEL_MAX_DESTINATIONS,
  OTEL_PROTOCOL_OPTIONS,
  getOtelDestinationName,
  getOtelProtocolLabel,
  validateOtelEndpoint,
} from "@/lib/appUtils"
import { apiErrorText } from "@/lib/api-errors"

// One editable header row. `saved` rows come from an existing destination: the server
// never returns their values, so the key is fixed and a blank value means "keep".
interface HeaderRow {
  id: number
  key: string
  value: string
  saved: boolean
  show: boolean
}

interface FormState {
  name: string
  endpoint: string
  protocol: OtelProtocol
  headers: HeaderRow[]
  nextId: number
}

const emptyForm = (): FormState => ({
  name: "",
  endpoint: "",
  protocol: "http/protobuf",
  headers: [{ id: 1, key: "", value: "", saved: false, show: false }],
  nextId: 2,
})

const formFromDestination = (d: OtelDestination): FormState => ({
  name: d.name ?? "",
  endpoint: d.endpoint,
  protocol: d.protocol,
  headers: d.header_keys.map((key, i) => ({ id: i + 1, key, value: "", saved: true, show: false })),
  nextId: d.header_keys.length + 1,
})

// The endpoint is a base URL; the exporter appends the per-signal path (/v1/logs, /v1/traces,
// /v1/metrics). The placeholder shows the shape; validateOtelEndpoint explains a wrong one.
const endpointPlaceholder = (protocol: OtelProtocol): string =>
  protocol === "grpc" ? "https://collector.example.com:4317" : "https://collector.example.com:4318"

/**
 * Turn header rows into the API shape, or return an error. Rows with both fields
 * blank are ignored so a stray empty row never blocks saving.
 */
const buildHeaders = (
  rows: HeaderRow[],
  mode: "create" | "update"
): { headers: OtelDestinationHeaderInput[] } | { error: string } => {
  const headers: OtelDestinationHeaderInput[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    const key = row.key.trim()
    const value = row.value
    if (!key && !value) continue
    if (!key) return { error: "Every header needs a name" }
    if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(key)) return { error: `"${key}" is not a valid header name` }
    const lower = key.toLowerCase()
    if (seen.has(lower)) return { error: `Header "${key}" is listed twice` }
    seen.add(lower)
    if (row.saved && !value) {
      headers.push({ key })
    } else if (!value) {
      return { error: `Enter a value for header "${key}"` }
    } else {
      headers.push({ key, value })
    }
  }
  return { headers }
}

interface OtelExportSectionProps {
  session: Session | null
  /** Fired after every successful load or mutation so the Settings tile stays in sync. */
  onChanged?: (destinations: OtelDestination[]) => void
}

const OtelExportSection = ({ session, onChanged }: OtelExportSectionProps) => {
  const { toast } = useToast()
  const token = session?.access_token

  const [destinations, setDestinations] = useState<OtelDestination[]>([])
  const { activeOrgId } = useOrg()
  // destination id -> logging policies whose control selects it. Shown on the row so an admin
  // sees what pausing or removing a destination affects before clicking. Best-effort: a failed
  // read only hides the label (mirrors PolicyOtlpForwardingCard's "Also used by" lookup).
  const [usage, setUsage] = useState<Record<string, { id: string; name: string }[]>>({})
  useEffect(() => {
    if (!activeOrgId) return
    let cancelled = false
    setUsage({})
    supabase
      .from("policy_controls")
      .select("policy_id, settings, policies!inner(name)")
      .eq("org_id", activeOrgId)
      .not("settings->otel_destination_ids", "is", null)
      .then(({ data, error }) => {
        if (cancelled || error || !data) return
        const next: Record<string, { id: string; name: string }[]> = {}
        for (const row of data) {
          const ids = (row.settings as { otel_destination_ids?: unknown } | null)?.otel_destination_ids
          if (!Array.isArray(ids)) continue
          const name = (row.policies as { name?: string } | null)?.name ?? "Untitled policy"
          for (const id of ids) {
            if (typeof id !== "string") continue
            const list = (next[id] ??= [])
            if (!list.some((p) => p.id === row.policy_id)) list.push({ id: row.policy_id, name })
          }
        }
        setUsage(next)
      })
    return () => { cancelled = true }
  }, [activeOrgId])
  // Mirror of `destinations` for async handlers: an in-flight toggle must merge its result into the
  // LATEST list, not a snapshot captured at click time (which would clobber a concurrent edit/remove).
  const destinationsRef = useRef(destinations)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Add / edit dialog
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<OtelDestination | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [endpointTouched, setEndpointTouched] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Delete confirmation
  const [pendingDelete, setPendingDelete] = useState<OtelDestination | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Per-row toggle in flight, so a slow PATCH can't be double-fired.
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const publish = useCallback(
    (next: OtelDestination[]) => {
      destinationsRef.current = next
      setDestinations(next)
      onChanged?.(next)
    },
    [onChanged]
  )

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setLoadError(null)
    const res = await traceforcApi.listOtelDestinations(token)
    if (res.error) {
      setLoadError(res.error)
    } else {
      publish(res.data ?? [])
    }
    setLoading(false)
  }, [token, publish])

  useEffect(() => {
    void load()
  }, [load])

  // One destination at a time in the UI for now (the backend allows multiple).
  const canAddMore = destinations.length < OTEL_MAX_DESTINATIONS

  const openAdd = () => {
    setEditing(null)
    setForm(emptyForm())
    setEndpointTouched(false)
    setFormError(null)
    setDialogOpen(true)
  }

  const openEdit = (d: OtelDestination) => {
    setEditing(d)
    setForm(formFromDestination(d))
    setEndpointTouched(false)
    setFormError(null)
    setDialogOpen(true)
  }

  const endpointError = useMemo(() => validateOtelEndpoint(form.endpoint), [form.endpoint])
  const showEndpointError = endpointTouched && endpointError !== null
  const nameMissing = form.name.trim().length === 0
  const canSubmit = !nameMissing && endpointError === null && !saving

  const patchForm = (patch: Partial<FormState>) => {
    setForm((f) => ({ ...f, ...patch }))
    setFormError(null)
  }

  const patchHeader = (id: number, patch: Partial<HeaderRow>) => {
    setForm((f) => ({ ...f, headers: f.headers.map((h) => (h.id === id ? { ...h, ...patch } : h)) }))
    setFormError(null)
  }

  const addHeaderRow = () =>
    setForm((f) => ({
      ...f,
      headers: [...f.headers, { id: f.nextId, key: "", value: "", saved: false, show: false }],
      nextId: f.nextId + 1,
    }))

  const removeHeaderRow = (id: number) =>
    setForm((f) => ({ ...f, headers: f.headers.filter((h) => h.id !== id) }))

  const handleSave = async () => {
    if (!token) return
    setEndpointTouched(true)
    const name = form.name.trim()
    if (!name) {
      setFormError("Name is required")
      return
    }
    if (endpointError) return
    const built = buildHeaders(form.headers, editing ? "update" : "create")
    if ("error" in built) {
      setFormError(built.error)
      return
    }
    setSaving(true)
    const endpoint = form.endpoint
    let res
    if (editing) {
      const update: Partial<OtelDestinationInput> = { name, endpoint, protocol: form.protocol }
      // A headers_unavailable row opens with no header rows; sending headers: [] would wipe the
      // stored secret. Only send headers when the admin actually entered some (the full desired set).
      if (!editing.headers_unavailable || built.headers.length > 0) {
        update.headers = built.headers
      }
      res = await traceforcApi.updateOtelDestination(token, editing.id, update)
    } else {
      res = await traceforcApi.createOtelDestination(token, {
        name,
        endpoint,
        protocol: form.protocol,
        headers: built.headers,
        enabled: true,
      })
    }
    setSaving(false)
    if (res.error || !res.data) {
      // Someone else removed it while this dialog was open: refresh instead of showing a stale error.
      if (editing && res.statusCode === 404) {
        setDialogOpen(false)
        toast({ title: "Destination no longer exists", description: "Refreshing the list.", variant: "destructive" })
        void load()
        return
      }
      setFormError(apiErrorText(res))
      return
    }
    const saved = res.data
    // Merge against the LATEST list (via the ref), like handleToggle, so a concurrent toggle/remove
    // of another row that resolved during this await is not clobbered by a pre-op snapshot.
    publish(editing
      ? destinationsRef.current.map((d) => (d.id === saved.id ? saved : d))
      : [...destinationsRef.current, saved])
    setDialogOpen(false)
    toast({
      title: editing ? "Destination updated" : "Destination added",
      description: editing
        ? `${getOtelDestinationName(saved)} is updated.`
        : `Select ${getOtelDestinationName(saved)} in a logging policy to forward its activity logs.`,
    })
  }

  const handleToggle = async (d: OtelDestination, enabled: boolean) => {
    if (!token || togglingId) return
    setTogglingId(d.id)
    // Optimistic, keyed by id against the LATEST list (via the ref): flip just this row so a
    // concurrent edit/remove of another row during the PATCH survives — we never republish a
    // stale snapshot.
    publish(destinationsRef.current.map((x) => (x.id === d.id ? { ...x, enabled } : x)))
    const res = await traceforcApi.updateOtelDestination(token, d.id, { enabled })
    setTogglingId(null)
    if (res.error || !res.data) {
      // Revert only this row's switch; if it was removed meanwhile it's simply absent now (no resurrection).
      publish(destinationsRef.current.map((x) => (x.id === d.id ? { ...x, enabled: d.enabled } : x)))
      if (res.statusCode === 404) {
        toast({ title: "Destination no longer exists", description: "Refreshing the list.", variant: "destructive" })
        void load()
        return
      }
      toast({ title: "Could not update destination", description: apiErrorText(res), variant: "destructive" })
      return
    }
    const updated = res.data
    // Merge the server row by id into the current list (not a pre-op snapshot).
    publish(destinationsRef.current.map((x) => (x.id === updated.id ? updated : x)))
  }

  const handleDelete = async () => {
    if (!token || !pendingDelete) return
    setDeleting(true)
    const res = await traceforcApi.deleteOtelDestination(token, pendingDelete.id)
    setDeleting(false)
    if (res.error) {
      // Already gone: just refresh and close.
      if (res.statusCode === 404) {
        setPendingDelete(null)
        toast({ title: "Destination already removed", description: "Refreshing the list." })
        void load()
        return
      }
      toast({ title: "Could not remove destination", description: apiErrorText(res), variant: "destructive" })
      return
    }
    publish(destinationsRef.current.filter((d) => d.id !== pendingDelete.id))
    toast({ title: "Destination removed", description: `Policies that used ${getOtelDestinationName(pendingDelete)} no longer forward to it.` })
    setPendingDelete(null)
  }

  const headerSummary = (d: OtelDestination): string => {
    if (d.header_keys.length === 0) return "No headers"
    const noun = d.header_keys.length === 1 ? "header" : "headers"
    return `${d.header_keys.length} ${noun} · ${d.header_keys.join(", ")}`
  }

  const enabledCount = destinations.filter((d) => d.enabled).length

  // Hidden once the UI cap is reached (the backend allows multiple; the UI shows one for now).
  const addButton = canAddMore ? (
    <Button onClick={openAdd} size="sm">
      <Plus className="h-4 w-4 mr-2" />
      Add destination
    </Button>
  ) : null

  const renderBody = () => {
    if (loadError) {
      return (
        <div className="text-center py-8 space-y-3">
          <p className="text-destructive text-sm">Failed to load OpenTelemetry destinations</p>
          <Button variant="outline" size="sm" onClick={() => void load()}>Retry</Button>
        </div>
      )
    }
    if (loading) {
      return (
        <div className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )
    }
    if (destinations.length === 0) {
      return (
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center">
            <div className="h-11 w-11 rounded-lg bg-primary/10 flex items-center justify-center">
              <Waypoints className="h-5 w-5 text-primary" />
            </div>
            <div className="font-semibold">No destinations configured</div>
            <p className="text-sm text-muted-foreground max-w-sm">
              Send a copy of your agents' logs, traces and metrics to your own OTLP collector (Datadog, Honeycomb, Grafana, …), alongside Traceforce.
            </p>
            <Button onClick={openAdd}>
              <Plus className="h-4 w-4 mr-2" />
              Add OTLP destination
            </Button>
          </div>
          <div className="rounded-lg bg-muted/50 p-4 space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">What you will need</div>
            <ul className="list-disc pl-5 text-sm space-y-1">
              <li>The collector's <strong>OTLP endpoint</strong> (base URL)</li>
              <li>Its <strong>protocol</strong>: HTTP/protobuf, HTTP/JSON, or gRPC</li>
              <li>Any <strong>headers</strong> it needs, such as an API key</li>
            </ul>
          </div>
        </div>
      )
    }
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 rounded-md bg-muted/50 p-3 text-xs">
          <span className="rounded border bg-background px-2 py-1 font-medium">Your agents</span>
          <span aria-hidden="true" className="text-muted-foreground">→</span>
          <span className="rounded border bg-background px-2 py-1 font-medium">Traceforce agent on each device</span>
          <span aria-hidden="true" className="text-muted-foreground">→</span>
          <span className="rounded bg-primary/10 px-2 py-1 font-semibold text-primary">
            {enabledCount} enabled {enabledCount === 1 ? "destination" : "destinations"}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Destinations
          </div>
          {addButton}
        </div>

        <div className="space-y-3">
          {destinations.map((d) => {
            const busy = togglingId === d.id
            return (
              <div
                key={d.id}
                className={`rounded-lg border p-4 space-y-3 ${d.enabled ? "" : "opacity-70"}`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold truncate">{getOtelDestinationName(d)}</span>
                  <Badge variant="secondary" className="font-normal shrink-0">{getOtelProtocolLabel(d.protocol)}</Badge>
                  {!d.enabled && <Badge variant="outline" className="font-normal shrink-0 text-muted-foreground">Paused</Badge>}
                  <div className="flex-1" />
                  <Switch
                    checked={d.enabled}
                    // Disable EVERY row's switch while any toggle is in flight (not just this row's):
                    // handleToggle serializes on togglingId and silently drops a second click, so the
                    // switch must not stay clickable on other rows mid-toggle. Edit/Remove stay per-row
                    // busy (they merge by id, so a concurrent edit/remove of another row survives).
                    disabled={togglingId !== null}
                    onCheckedChange={(v) => void handleToggle(d, v)}
                    aria-label={`Enable ${getOtelDestinationName(d)}`}
                  />
                  <Button variant="outline" size="icon" className="h-9 w-9" disabled={busy} aria-label={`Edit ${getOtelDestinationName(d)}`} onClick={() => openEdit(d)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 text-destructive hover:text-destructive"
                    disabled={busy}
                    aria-label={`Remove ${getOtelDestinationName(d)}`}
                    onClick={() => setPendingDelete(d)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {(() => {
                  const used = usage[d.id] ?? []
                  if (used.length === 0) return <div className="text-xs text-muted-foreground">Not selected by any logging policy</div>
                  return (
                    <div className="text-xs text-muted-foreground truncate">
                      Used by {used.length === 1 ? "1 policy" : `${used.length} policies`}:{" "}
                      {used.map((p, i) => (
                        <span key={p.id}>
                          {i > 0 && ", "}
                          <Link to={`/policies/${p.id}`} className="underline underline-offset-2 hover:text-foreground">{p.name}</Link>
                        </span>
                      ))}
                    </div>
                  )
                })()}
                <div className="rounded-md bg-muted/50 p-3 space-y-2">
                  <div>
                    <div className="text-xs text-muted-foreground mb-0.5">OTLP endpoint</div>
                    <div className="font-mono text-xs truncate" title={d.endpoint}>{d.endpoint}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-0.5">OTLP headers</div>
                    <div className="text-xs font-medium truncate">
                      {d.headers_unavailable ? "Couldn't read headers — you can still edit or remove this destination" : headerSummary(d)}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <>
      {renderBody()}

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!saving) setDialogOpen(open) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit OTLP destination" : "Add OTLP destination"}</DialogTitle>
            <DialogDescription>
              Logging policies that select this destination also forward their activity logs here.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="otel-name">
                Name <span className="text-destructive" aria-hidden="true">*</span>
              </Label>
              <Input
                id="otel-name"
                value={form.name}
                onChange={(e) => patchForm({ name: e.target.value })}
                placeholder="e.g. Honeycomb (production)"
                maxLength={80}
                aria-required="true"
              />
            </div>

            <div className="space-y-2">
              <Label id="otel-protocol-label">OTLP protocol</Label>
              <ToggleGroup
                type="single"
                aria-labelledby="otel-protocol-label"
                value={form.protocol}
                onValueChange={(v) => { if (v) patchForm({ protocol: v as OtelProtocol }) }}
                className="grid grid-cols-3 gap-1 rounded-md bg-muted p-1"
              >
                {OTEL_PROTOCOL_OPTIONS.map((o) => (
                  <ToggleGroupItem
                    key={o.value}
                    value={o.value}
                    className="h-9 data-[state=on]:bg-background data-[state=on]:shadow-sm"
                  >
                    <span className="text-xs font-semibold">{o.label}</span>
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="otel-endpoint">
                OTLP endpoint <span className="text-destructive" aria-hidden="true">*</span>
              </Label>
              <Input
                id="otel-endpoint"
                type="url"
                value={form.endpoint}
                onChange={(e) => patchForm({ endpoint: e.target.value })}
                onBlur={() => setEndpointTouched(true)}
                placeholder={endpointPlaceholder(form.protocol)}
                aria-required="true"
                aria-invalid={showEndpointError || undefined}
                className={`font-mono text-xs ${showEndpointError ? "border-destructive" : ""}`}
              />
              {showEndpointError && <p className="text-xs text-destructive">{endpointError}</p>}
            </div>

            <div className="space-y-2">
              <span className="text-sm font-medium">
                OTLP headers <span className="text-muted-foreground font-normal">(optional)</span>
              </span>
              <div className="space-y-2">
                {form.headers.map((row, i) => (
                  <div key={row.id} className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)_2.5rem] gap-2 items-center">
                    <Input
                      aria-label={`Header ${i + 1} name`}
                      value={row.key}
                      onChange={(e) => patchHeader(row.id, { key: e.target.value })}
                      placeholder="Header name"
                      readOnly={row.saved}
                      className={`font-mono text-xs ${row.saved ? "bg-muted/50" : ""}`}
                    />
                    <div className="relative">
                      <Input
                        aria-label={`Header ${i + 1} value`}
                        type={row.show ? "text" : "password"}
                        autoComplete="off"
                        value={row.value}
                        onChange={(e) => patchHeader(row.id, { value: e.target.value })}
                        placeholder={row.saved ? "•••••••• (unchanged)" : "Value"}
                        className="font-mono text-xs pr-10"
                      />
                      <button
                        type="button"
                        aria-label={row.show ? `Hide header ${i + 1} value` : `Show header ${i + 1} value`}
                        onClick={() => patchHeader(row.id, { show: !row.show })}
                        className="absolute right-1 top-1 h-8 w-8 flex items-center justify-center rounded text-muted-foreground hover:text-foreground"
                      >
                        {row.show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-10 w-10"
                      aria-label={`Remove header ${i + 1}`}
                      onClick={() => removeHeaderRow(row.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between gap-3">
                <Button type="button" variant="outline" size="sm" className="border-dashed" onClick={addHeaderRow}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add header
                </Button>
                <span className="text-xs text-muted-foreground text-right">
                  {editing ? "Leave a saved value blank to keep it; type to replace." : "Values are hidden after you save."}
                </span>
              </div>
            </div>

            {formError && (
              <div role="alert" className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {formError}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button type="button" onClick={() => void handleSave()} disabled={!canSubmit}>
              {saving ? "Saving..." : editing ? "Save changes" : "Add destination"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => { if (!open && !deleting) setPendingDelete(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove destination?</AlertDialogTitle>
            <AlertDialogDescription>
              Policies that use <strong className="text-foreground">{pendingDelete ? getOtelDestinationName(pendingDelete) : ""}</strong> stop forwarding immediately. Header values can't be recovered.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); void handleDelete() }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Removing..." : "Remove destination"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export default OtelExportSection
