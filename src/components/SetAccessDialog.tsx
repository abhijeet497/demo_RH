import { useCallback, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { Check, ChevronsUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MultiSelect } from "@/components/ui/multi-select"
import { cn } from "@/lib/utils"
import { isGovernableMcpType } from "@/lib/appUtils"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/AuthContext"
import {
  setMcpAccessDecision,
  useMcpAccessGroupStatus,
  type McpCatalogEntry,
  type OrgUserGroup,
} from "@/hooks/use-mcp-access"
import { McpAccessLines } from "@/components/McpAccessLines"

// ===========================================================================
// Set Access — the deliberate access-change dialog (admin).
//
// Records an explicit ALLOW/BLOCK decision for an (MCP, scope) via
// POST /decisions: the decision overrides the policy verdict (latest decision
// per target wins). An allow approves the pending requests of people it
// unblocks; a block declines those of people it now blocks. This is the only
// UI path that creates a standing block — the Pending tab's Decline never
// touches access.
//
// The group picker lists only groups an access policy covers: a decision on
// any other group does nothing until a policy applies to it, so offering one
// would let an admin save something with no effect. With none covered, the
// dialog points to setting up a policy first.
// ===========================================================================

const SetAccessDialog = ({
  open,
  onOpenChange,
  mcp,
  catalog = [],
  groups,
  onSaved,
  catalogError = null,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Preselected MCP (row entry point); null = show the picker. */
  mcp: { type: number; name: string } | null
  /** Catalog entries for the picker (page-level fetch). Only read when `mcp`
   * is null; row entry points (MCP preselected) can omit it. */
  catalog?: McpCatalogEntry[]
  /** Every org group (page-level fetch) — governed or not; see header note. */
  groups: OrgUserGroup[]
  /** Fired after a decision persists so the host can refetch its tabs. */
  onSaved: () => void
  /** Catalog fetch error — an empty picker must say why, not "No connectors found". */
  catalogError?: string | null
}) => {
  const { toast } = useToast()
  const { session } = useAuth()
  const [pickedType, setPickedType] = useState<number | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [action, setAction] = useState<1 | 2>(1)
  const [scope, setScope] = useState<"org" | "groups">("org")
  const [groupIds, setGroupIds] = useState<string[]>([])
  const [reason, setReason] = useState("")
  const [saving, setSaving] = useState(false)

  const target = mcp ?? (pickedType != null
    ? { type: pickedType, name: catalog.find((c) => c.type === pickedType)?.name ?? `Connector #${pickedType}` }
    : null)

  // Only governable registry MCPs are decidable (see isGovernableMcpType).
  const pickable = useMemo(
    () => catalog.filter((c) => isGovernableMcpType(c.type)),
    [catalog],
  )

  const reset = useCallback(() => {
    setPickedType(null)
    setAction(1)
    setScope("org")
    setGroupIds([])
    setReason("")
  }, [])

  // The picked MCP's per-group access (feeds the Current-access panel AND
  // which groups the picker offers). null until it settles successfully.
  const { rows: statusRows, error: statusError } = useMcpAccessGroupStatus(
    open && target ? target.type : null,
  )

  // A group absent from the resolver rows has no access policy (neither
  // specific nor org-wide) — decisions for it are dormant until one applies.
  const governedIds = useMemo(
    () => new Set((statusRows ?? []).filter((r) => r.group_id).map((r) => r.group_id as string)),
    [statusRows],
  )
  // Group id → display name (the caller names groups with their IdP).
  const groupLabels = useMemo(() => new Map(groups.map((g) => [g.id, g.name])), [groups])
  const groupOptions = useMemo(
    () => groups.filter((g) => governedIds.has(g.id)).sort((a, b) => a.name.localeCompare(b.name)),
    [groups, governedIds],
  )

  const incomplete = !target || (scope === "groups" && groupIds.length === 0)

  const handleSave = async () => {
    if (!target || !session?.access_token) return
    setSaving(true)

    // One decision per selected group, sequentially. Each is independent: a
    // mid-run failure must not hide the decisions already persisted — the host
    // still refetches and the failed groups stay selected for a retry that
    // won't re-post the saved ones.
    const targetGroupIds = scope === "org" ? [null] : groupIds
    const savedGroupIds: string[] = []
    let failure: string | null = null
    for (const groupId of targetGroupIds) {
      try {
        await setMcpAccessDecision(session.access_token, {
          action,
          scopeType: groupId === null ? 1 : 2,
          groupId,
          mcpServerType: target.type,
          reason,
        })
          if (groupId !== null) savedGroupIds.push(groupId)
      } catch (e: any) {
        failure = e?.message ?? "Request failed."
        break
      }
    }
    setSaving(false)

    const anySaved = scope === "org" ? failure === null : savedGroupIds.length > 0
    if (anySaved) onSaved() // something persisted — the host's tabs must refresh either way

    if (failure !== null) {
      if (scope === "groups" && savedGroupIds.length > 0) {
        // Partial: keep the dialog open with only the UNSAVED groups selected.
        setGroupIds(groupIds.filter((id) => !savedGroupIds.includes(id)))
        toast({
          title: `Saved ${savedGroupIds.length} of ${groupIds.length} groups`,
          description: `${failure} The remaining groups are still selected. Retry to finish.`,
          variant: "destructive",
        })
      } else {
        toast({ title: "Could not save decision", description: failure, variant: "destructive" })
      }
      return
    }

    toast({ title: "Decision saved" })
    onOpenChange(false)
    reset()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) reset()
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Set Access{target ? ` — ${target.name}` : ""}</DialogTitle>
          <DialogDescription>
            Allow or block this connector for the users you choose, whatever the policy says.
          </DialogDescription>
        </DialogHeader>

        {!mcp && (
          <div className="space-y-2">
            <Label>Connector</Label>
            {/* modal: a non-modal popover inside a modal dialog loses wheel
                events to the dialog's scroll lock (Radix quirk). */}
            <Popover modal open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                  {target?.name ?? "Search the catalog…"}
                  <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command>
                  <CommandInput placeholder="Search connectors…" />
                  <CommandList>
                    <CommandEmpty>
                      {catalogError ? `Couldn't load the catalog: ${catalogError}` : "No connectors found."}
                    </CommandEmpty>
                    <CommandGroup>
                      {pickable.map((p) => (
                        <CommandItem
                          key={p.type}
                          value={p.name}
                          onSelect={() => {
                            setPickedType(p.type)
                            setPickerOpen(false)
                          }}
                        >
                          <Check
                            className={cn("mr-2 h-4 w-4", pickedType === p.type ? "opacity-100" : "opacity-0")}
                          />
                          {p.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        )}

        {target && (
          <div className="space-y-1.5 rounded-md border bg-muted/30 px-3 py-2.5">
            <p className="text-xs font-medium text-muted-foreground">Current access</p>
            <McpAccessLines rows={statusRows} error={statusError} groupLabels={groupLabels} />
          </div>
        )}

        <div className="space-y-2">
          <Label>Decision</Label>
          <RadioGroup
            value={String(action)}
            onValueChange={(v) => setAction(Number(v) as 1 | 2)}
            className="flex gap-6"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="1" id="set-access-allow" />
              <Label htmlFor="set-access-allow" className="font-normal">Allow</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="2" id="set-access-block" />
              <Label htmlFor="set-access-block" className="font-normal">Block</Label>
            </div>
          </RadioGroup>
        </div>

        <div className="space-y-2">
          <Label>For</Label>
          <Select value={scope} onValueChange={(v) => setScope(v as "org" | "groups")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="org">All users</SelectItem>
              <SelectItem value="groups">Selected groups</SelectItem>
            </SelectContent>
          </Select>
          {scope === "groups" &&
            (statusRows !== null && groupOptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No access policy covers any group yet.{" "}
                <Link to="/policies" className="text-foreground underline-offset-4 hover:underline">
                  Set one up →
                </Link>
              </p>
            ) : (
              <MultiSelect
                options={groupOptions}
                selectedIds={groupIds}
                onChange={setGroupIds}
                placeholder={statusError ? "Couldn't load groups" : statusRows === null ? "Loading groups…" : "Select groups…"}
                searchPlaceholder="Search groups…"
                emptyMessage="No groups found."
                label="group"
              />
            ))}
        </div>

        <div className="space-y-2">
          <Label htmlFor="set-access-reason">
            Reason <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="set-access-reason"
            placeholder="Why this decision…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={1000}
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => {
              // Radix only routes internally-initiated closes (Escape/X) through
              // onOpenChange — a controlled close must reset explicitly, or the
              // stale form greets the next open.
              onOpenChange(false)
              reset()
            }}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button disabled={incomplete || saving} onClick={handleSave}>
            {saving ? "Saving…" : "Save decision"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default SetAccessDialog
