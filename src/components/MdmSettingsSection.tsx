import { useState, useEffect } from "react"
import { Plus, Pencil, Trash2, Eye, EyeOff, AlertTriangle } from "lucide-react"
import { Session } from "@supabase/supabase-js"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useToast } from "@/hooks/use-toast"
import { traceforcApi } from "@/integrations/traceforce/client"
import type { MdmIntegration } from "@/integrations/traceforce/types"
import {
  MDM_PROVIDER_FIELDS,
  MDM_PROVIDER_OPTIONS,
  MDM_ERROR_HOST_UNREACHABLE,
  getMdmDefaultCredentials,
  getMdmProviderLabel,
  getMdmSummary,
  getMdmUrlFieldLabel,
  sortMdmByCreatedAt,
} from "@/lib/appUtils"
import type { MdmProviderField } from "@/lib/appUtils"

// Per-field validation error to display, gated on `touched` so it surfaces only after the user
// leaves the field (blur) or attempts to submit — not on every keystroke. Validation rules live
// on the field definition (MdmProviderField.validate) so providers can opt in without page changes.
const fieldError = (
  field: MdmProviderField,
  value: string | undefined,
  touched: boolean
): string | null => {
  if (!touched || !field.validate) return null
  const v = value ?? ""
  if (v.trim().length === 0) return null // empties are handled by the required-fields check
  return field.validate(v)
}

interface MdmSettingsSectionProps {
  session: Session | null
  onStatusChange?: (lines: string[]) => void
  onWarningChange?: (hasWarning: boolean) => void
}

const MdmSettingsSection = ({ session, onStatusChange, onWarningChange }: MdmSettingsSectionProps) => {
  const { toast } = useToast()

  // List state
  const [integrations, setIntegrations] = useState<MdmIntegration[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Add dialog state
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<string>("1")
  const [addCredentials, setAddCredentials] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  // Visibility is per field key, not one dialog-wide flag: a provider can have more
  // than one secret field (Mosyle: access_token + password), and revealing one must
  // never reveal the other.
  const [showAddSecret, setShowAddSecret] = useState<Record<string, boolean>>({})
  // Fields are validated on blur / submit (not every keystroke); track which were touched.
  const [addTouched, setAddTouched] = useState<Record<string, boolean>>({})

  // Edit dialog — keyed by integration.id so per-card isolation is guaranteed
  const [openEditId, setOpenEditId] = useState<string | null>(null)
  const [editCredentials, setEditCredentials] = useState<Record<string, string>>({})
  const [savingEdit, setSavingEdit] = useState(false)
  const [editTouched, setEditTouched] = useState<Record<string, boolean>>({})
  const [showEditSecret, setShowEditSecret] = useState<Record<string, boolean>>({})

  // Delete dialog — keyed by integration.id
  const [openDeleteId, setOpenDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchIntegrations = async () => {
    if (!session?.access_token) return
    setLoading(true)
    setLoadError(null)
    try {
      const res = await traceforcApi.getMdmIntegration(session.access_token)
      if (res.error) throw new Error(res.error)
      setIntegrations(res.data ?? [])
    } catch {
      // Surface error; do NOT clear already-loaded cards
      setLoadError("Failed to load MDM integration settings")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session?.access_token) {
      fetchIntegrations()
    }
  }, [session?.access_token])

  // Sidebar summary and warning callbacks
  useEffect(() => {
    // While we have no data of our own — still loading OR the fetch errored — leave the tile's
    // existing summary/warning untouched. Settings.tsx pre-populates the tile on page load, so
    // emitting getMdmSummary([]) here would wipe that prefetched state on a transient
    // section-fetch error (or flicker it during load). A successful empty result still emits
    // (loadError is null, loading is false) so a genuinely-disconnected tile clears correctly.
    if ((loading || loadError) && integrations.length === 0) {
      return
    }
    const { lines, hasWarning } = getMdmSummary(integrations)
    onWarningChange?.(hasWarning)
    onStatusChange?.(lines)
  }, [integrations, loading, loadError])

  const connected = new Set(integrations.map((i) => i.provider))
  const unconnectedOptions = MDM_PROVIDER_OPTIONS.filter(
    (o) => !connected.has(Number(o.value))
  )
  // Default the Add dialog to the first UNCONNECTED provider; the Select is filtered to
  // those, so defaulting to a connected "1" would leave the trigger showing a stale value.
  const defaultAddProvider = unconnectedOptions[0]?.value ?? "1"

  const handleAdd = async () => {
    if (!session?.access_token) return

    // Require every non-optional field for the selected provider (password fields ARE
    // required on create; fields flagged optional — e.g. JumpCloud's org_id — may be blank)
    const providerFields = MDM_PROVIDER_FIELDS[parseInt(selectedProvider)] ?? []
    const allFieldsFilled = providerFields.every(
      (field) => field.optional || addCredentials[field.key]?.trim()
    )
    if (!allFieldsFilled) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    // Block submit if any field's provider-supplied validator fails; mark fields touched so the
    // inline errors render.
    const hasInvalidField = providerFields.some((field) => {
      const v = addCredentials[field.key] ?? ""
      return v.trim().length > 0 && field.validate?.(v) != null
    })
    if (hasInvalidField) {
      setAddTouched(Object.fromEntries(providerFields.map((f) => [f.key, true])))
      return
    }

    setSaving(true)
    try {
      // Only send the selected provider's fields — switching providers in the Add dialog
      // can leave stale keys from the previous selection in addCredentials. Trim values so
      // copy/pasted whitespace (esp. in instance_url) isn't persisted.
      const credentials = Object.fromEntries(
        providerFields.map((field) => [field.key, (addCredentials[field.key] ?? "").trim()])
      )
      const res = await traceforcApi.createMdmIntegration(
        session.access_token,
        parseInt(selectedProvider),
        credentials
      )
      if (res.error || !res.data) {
        throw new Error(res.error ?? res.message ?? "Failed to connect MDM provider")
      }
      await fetchIntegrations()
      setShowAddDialog(false)
      setAddCredentials({})
      // Reset to the next unconnected provider (the one just added is now connected)
      const addedProvider = parseInt(selectedProvider)
      const nextOption = MDM_PROVIDER_OPTIONS.find(
        (o) => !connected.has(Number(o.value)) && Number(o.value) !== addedProvider
      )
      setSelectedProvider(nextOption?.value ?? "1")
      setShowAddSecret({})
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to connect MDM provider",
        variant: "destructive",
      })
      await fetchIntegrations()
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = async (integrationId: string) => {
    if (!session?.access_token) return
    const integration = integrations.find((i) => i.id === integrationId)
    // Block submit if any field's provider-supplied validator fails; mark fields touched so the
    // inline errors render.
    const editFields = integration ? MDM_PROVIDER_FIELDS[integration.provider] ?? [] : []
    const hasInvalidField = editFields.some((field) => {
      const v = editCredentials[field.key] ?? ""
      return v.trim().length > 0 && field.validate?.(v) != null
    })
    if (hasInvalidField) {
      setEditTouched(Object.fromEntries(editFields.map((f) => [f.key, true])))
      return
    }
    setSavingEdit(true)
    try {
      // Blank means "keep existing" (the backend merges the PUT body over the stored
      // secret; secrets rely on this since their inputs start empty) — EXCEPT for
      // optional non-secret fields, where blank is an explicit clear: the backend
      // merge overwrites with "" and the sync treats "" as unset (e.g. removing a
      // JumpCloud org_id after moving off an MSP key). Without this, a stored
      // optional value could never be removed from the UI.
      const clearable = new Set(
        editFields.filter((f) => f.optional && f.type !== "password").map((f) => f.key)
      )
      const filtered = Object.fromEntries(
        Object.entries(editCredentials)
          .filter(([k, v]) => v.trim() || clearable.has(k))
          .map(([k, v]) => [k, v.trim()])
      )
      const res = await traceforcApi.updateMdmIntegration(
        session.access_token,
        integrationId,
        filtered
      )
      if (res.error || !res.data) {
        throw new Error(res.error ?? res.message ?? "Failed to update MDM integration")
      }
      await fetchIntegrations()
      setOpenEditId(null)
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update MDM integration",
        variant: "destructive",
      })
      // Keep dialog open with values intact on failure
    } finally {
      setSavingEdit(false)
    }
  }

  const handleDelete = async (integrationId: string) => {
    if (!session?.access_token) return
    setDeleting(true)
    try {
      const res = await traceforcApi.deleteMdmIntegration(session.access_token, integrationId)
      if (res.error || !res.data?.success) {
        throw new Error(res.error ?? "Failed to remove MDM integration")
      }
      await fetchIntegrations()
      setOpenDeleteId(null)
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to remove MDM integration",
        variant: "destructive",
      })
      // Keep dialog open on failure
    } finally {
      setDeleting(false)
    }
  }

  // Only show the skeleton on the INITIAL load. On a refresh (after add/edit/remove)
  // keep the already-loaded cards and any open dialog mounted instead of replacing them
  // with the skeleton (Edge Case 2 — do not clear already-loaded cards).
  if (loading && integrations.length === 0) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  if (loadError && integrations.length === 0) {
    return <div className="text-center py-8 text-destructive">{loadError}</div>
  }

  return (
    <>
      {/* Transient re-fetch error alongside existing cards */}
      {loadError && integrations.length > 0 && (
        <div className="mb-4 text-sm text-destructive">{loadError}</div>
      )}

      {/* Per-integration cards */}
      {integrations.length > 0 && (
        <div className="space-y-6">
          {sortMdmByCreatedAt(integrations).map((integration) => {
            const fields: MdmProviderField[] = MDM_PROVIDER_FIELDS[integration.provider] ?? []
            const providerLabel = getMdmProviderLabel(integration.provider)

            return (
              <div key={integration.id} className="space-y-4">
                {/* Per-card error banner — fires on provider-agnostic is_customer_error flag */}
                {integration.is_customer_error === true && (
                    <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive">
                      <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                      <span>
                        <span className="font-semibold">ACTION REQUIRED:</span>{" "}
                        {integration.error_code === MDM_ERROR_HOST_UNREACHABLE
                          ? `Unable to reach the MDM host. Verify the ${getMdmUrlFieldLabel(integration.provider)} is correct.`
                          : integration.error_code === 403
                          ? "Permission denied. Verify this provider's credentials have the required permissions."
                          : "Unable to authenticate. Verify the credentials for this provider are correct and active."}{" "}
                        <a
                          href="https://traceforce.readme.io/docs/mdm-integration"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline hover:no-underline"
                        >
                          Learn more
                        </a>
                      </span>
                    </div>
                  )}

                <p className="text-sm text-muted-foreground">
                  MDM provider connected for device identity mapping.
                </p>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-md">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-muted-foreground mb-1">Provider</div>
                      <div className="text-sm">{providerLabel}</div>
                    </div>
                  </div>

                  {/* Generic credential rows driven by MDM_PROVIDER_FIELDS */}
                  {fields.map((field) => {
                    if (field.type === "password") {
                      return (
                        <div
                          key={field.key}
                          className="flex items-center justify-between p-3 bg-muted/50 rounded-md"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-muted-foreground mb-1">{field.label}</div>
                            <div className="font-mono text-sm text-muted-foreground">
                              ••••••••••••••••
                            </div>
                          </div>
                        </div>
                      )
                    }
                    const value = integration.credentials[field.key]
                    return value ? (
                      <div
                        key={field.key}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-md"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-muted-foreground mb-1">{field.label}</div>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="text-sm truncate cursor-default">{value}</div>
                              </TooltipTrigger>
                              <TooltipContent align="start">
                                <p>{value}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                    ) : null
                  })}
                </div>

                <div className="flex gap-2">
                  {/* Per-card Edit dialog */}
                  <Dialog
                    open={openEditId === integration.id}
                    onOpenChange={(open) => {
                      setEditTouched({})
                      if (open) {
                        const nonSecret: Record<string, string> = {}
                        fields.forEach((f) => {
                          if (f.type !== "password") {
                            nonSecret[f.key] = integration.credentials[f.key] ?? ""
                          }
                        })
                        setEditCredentials(nonSecret)
                        setShowEditSecret({})
                        setOpenEditId(integration.id)
                      } else {
                        setOpenEditId(null)
                      }
                    }}
                  >
                    <DialogTrigger asChild>
                      <Button variant="outline">
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Edit MDM Settings</DialogTitle>
                        <DialogDescription>
                          Update your MDM integration credentials.{" "}
                          <a
                            href="https://traceforce.readme.io/docs/mdm-integration"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary underline hover:no-underline"
                          >
                            Learn more
                          </a>
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        {/* Provider — static display label, not editable */}
                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-md">
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-muted-foreground mb-1">Provider</div>
                            <div className="text-sm">{providerLabel}</div>
                          </div>
                        </div>

                        {fields.map((field) => (
                          <div key={field.key} className="space-y-2">
                            <Label htmlFor={`edit-mdm-${integration.id}-${field.key}`}>
                              {field.label}
                              {field.optional && (
                                <span className="text-muted-foreground font-normal"> (optional)</span>
                              )}
                            </Label>
                            {field.type === "password" ? (
                              <div className="relative">
                                <Input
                                  id={`edit-mdm-${integration.id}-${field.key}`}
                                  type={showEditSecret[field.key] ? "text" : "password"}
                                  autoComplete="new-password"
                                  placeholder="Leave blank to keep existing"
                                  value={editCredentials[field.key] ?? ""}
                                  onChange={(e) =>
                                    setEditCredentials((p) => ({
                                      ...p,
                                      [field.key]: e.target.value,
                                    }))
                                  }
                                  className="pr-10"
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                                  onClick={() =>
                                    setShowEditSecret((p) => ({ ...p, [field.key]: !p[field.key] }))
                                  }
                                >
                                  {showEditSecret[field.key] ? (
                                    <EyeOff className="h-4 w-4" />
                                  ) : (
                                    <Eye className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                            ) : (
                              <Input
                                id={`edit-mdm-${integration.id}-${field.key}`}
                                type={field.type ?? "text"}
                                autoComplete="off"
                                placeholder={field.placeholder}
                                value={editCredentials[field.key] ?? ""}
                                onChange={(e) =>
                                  setEditCredentials((p) => ({
                                    ...p,
                                    [field.key]: e.target.value,
                                  }))
                                }
                                onBlur={() => setEditTouched((p) => ({ ...p, [field.key]: true }))}
                              />
                            )}
                            {field.helpText && (
                              <p className="text-sm text-muted-foreground">{field.helpText}</p>
                            )}
                            {fieldError(field, editCredentials[field.key], !!editTouched[field.key]) && (
                              <p className="text-sm text-destructive">
                                {fieldError(field, editCredentials[field.key], !!editTouched[field.key])}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setOpenEditId(null)}>
                          Cancel
                        </Button>
                        <Button onClick={() => handleEdit(integration.id)} disabled={savingEdit}>
                          {savingEdit ? "Saving..." : "Save"}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>

                  {/* Per-card Remove dialog */}
                  <Dialog
                    open={openDeleteId === integration.id}
                    onOpenChange={(open) => {
                      if (open) setOpenDeleteId(integration.id)
                      else setOpenDeleteId(null)
                    }}
                  >
                    <DialogTrigger asChild>
                      <Button variant="destructive">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Remove
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Remove MDM Settings</DialogTitle>
                        <DialogDescription>
                          Are you sure you want to remove {providerLabel}? Device owner data will no
                          longer be synced from {providerLabel}.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="flex justify-end gap-2 pt-4">
                        <Button variant="outline" onClick={() => setOpenDeleteId(null)}>
                          Cancel
                        </Button>
                        <Button
                          onClick={() => handleDelete(integration.id)}
                          disabled={deleting}
                          variant="destructive"
                        >
                          {deleting ? "Removing..." : "Remove"}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Empty state + Add dialog — hidden when all providers are connected */}
      {unconnectedOptions.length > 0 && (
        <div className={integrations.length > 0 ? "mt-6" : ""}>
          {integrations.length === 0 && (
            <p className="text-sm text-muted-foreground mb-4">
              No MDM provider connected. Connect one to enable device identity mapping.
            </p>
          )}
          <Dialog
            open={showAddDialog}
            onOpenChange={(open) => {
              setShowAddDialog(open)
              setAddTouched({})
              if (open) {
                // Ensure the Select starts on a valid (unconnected) provider, with that
                // provider's pre-fillable defaults seeded (e.g. JumpCloud's console URL).
                setSelectedProvider(defaultAddProvider)
                setAddCredentials(getMdmDefaultCredentials(parseInt(defaultAddProvider)))
              } else {
                setAddCredentials({})
                setSelectedProvider(defaultAddProvider)
                setShowAddSecret({})
              }
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Connect MDM Provider
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Connect MDM Provider</DialogTitle>
                <DialogDescription>
                  Enter your MDM credentials to enable device identity mapping.{" "}
                  <a
                    href="https://traceforce.readme.io/docs/mdm-integration"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline hover:no-underline"
                  >
                    Learn more
                  </a>
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="mdm-add-provider">MDM Provider</Label>
                  <Select
                    value={selectedProvider}
                    onValueChange={(v) => {
                      setSelectedProvider(v)
                      // Seed the new provider's defaults without clobbering anything the
                      // user already typed (typed values win over defaults).
                      setAddCredentials((p) => ({ ...getMdmDefaultCredentials(parseInt(v)), ...p }))
                    }}
                  >
                    <SelectTrigger id="mdm-add-provider">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {unconnectedOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Config form driven by MDM_PROVIDER_FIELDS (mirrors renderStorageConfigForm pattern) */}
                {(MDM_PROVIDER_FIELDS[parseInt(selectedProvider)] ?? []).map((field) => (
                  <div key={field.key} className="space-y-2">
                    <Label htmlFor={`mdm-add-${field.key}`}>
                      {field.label}
                      {field.optional && (
                        <span className="text-muted-foreground font-normal"> (optional)</span>
                      )}
                    </Label>
                    {field.type === "password" ? (
                      <div className="relative">
                        <Input
                          id={`mdm-add-${field.key}`}
                          type={showAddSecret[field.key] ? "text" : "password"}
                          autoComplete="new-password"
                          placeholder={field.placeholder}
                          value={addCredentials[field.key] ?? ""}
                          onChange={(e) =>
                            setAddCredentials((p) => ({ ...p, [field.key]: e.target.value }))
                          }
                          className="pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                          onClick={() =>
                            setShowAddSecret((p) => ({ ...p, [field.key]: !p[field.key] }))
                          }
                        >
                          {showAddSecret[field.key] ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    ) : (
                      <Input
                        id={`mdm-add-${field.key}`}
                        type={field.type ?? "text"}
                        autoComplete="off"
                        placeholder={field.placeholder}
                        value={addCredentials[field.key] ?? ""}
                        onChange={(e) =>
                          setAddCredentials((p) => ({ ...p, [field.key]: e.target.value }))
                        }
                        onBlur={() => setAddTouched((p) => ({ ...p, [field.key]: true }))}
                      />
                    )}
                    {field.helpText && (
                      <p className="text-sm text-muted-foreground">{field.helpText}</p>
                    )}
                    {fieldError(field, addCredentials[field.key], !!addTouched[field.key]) && (
                      <p className="text-sm text-destructive">
                        {fieldError(field, addCredentials[field.key], !!addTouched[field.key])}
                      </p>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAdd} disabled={saving}>
                  {saving ? "Connecting..." : "Connect"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </>
  )
}

export default MdmSettingsSection
