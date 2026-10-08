import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/AuthContext"
import { AccessLinesList } from "@/components/AccessLinesList"
import { setMcpAccessDecisions } from "@/hooks/use-mcp-access"
import { users, peopleStillBlocked, peopleStuck, type BlockedSet } from "@/lib/accessUsage"

// "Allow" on the Connectors page: lets the people already using a
// blocked connector keep using it, by allowing their groups. Opened from a
// row's popover (that connector's lines) or the toolbar (every line). Group
// access for anything else belongs to policies and requests.

const stay = (n: number) => `${users(n)} ${n === 1 ? "stays" : "stay"} blocked`

export function AllowAccessDialog({
  open,
  onOpenChange,
  types,
  blocked,
  connectorName,
  groupLabel,
  groupSize,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The connectors it covers: one (a popover) or the list's (the toolbar). */
  types: number[]
  /** The lines to offer (one connector's, or all) and the devices behind them. */
  blocked: BlockedSet
  connectorName: (type: number) => string
  groupLabel: (groupId: string) => string
  groupSize: (groupId: string) => string | undefined
  /** After any allow lands, so the host refetches access. */
  onSaved: () => void
}) {
  const { toast } = useToast()
  const { session } = useAuth()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [reason, setReason] = useState("")
  const [saving, setSaving] = useState(false)

  // Each open starts with every group line checked; "not in any group" lines
  // (they allow the connector for all users) start unchecked, unless one is a
  // single connector's only line: then it's the only way to allow it.
  useEffect(() => {
    if (open) {
      const only = types.length === 1 && blocked.lines.length === 1
      setSelected(new Set(blocked.lines.filter((l) => only || l.groupId !== null).map((l) => l.key)))
      setReason("")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the dialog opens
  }, [open])

  // Only those the checkboxes leave blocked: no checkbox here lifts an
  // admin's block (the popover's lines explain those).
  const unchecked = peopleStillBlocked(blocked, selected) - peopleStuck(blocked)

  const title = types.length === 1 ? `Allow ${connectorName(types[0])}` : "Allow in-use connectors"

  // All checked lines in one call: they land whole or not at all.
  const save = async () => {
    if (!session?.access_token) return
    setSaving(true)
    try {
      await setMcpAccessDecisions(
        session.access_token,
        blocked.lines
          .filter((l) => selected.has(l.key))
          .map((l) => ({ action: 1, scopeType: l.groupId ? 2 : 1, groupId: l.groupId, mcpServerType: l.type, reason })),
      )
      toast({ title: "Success", description: "Access allowed" })
      onOpenChange(false)
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Failed to allow access",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
      // On failure too: a line may have gone stale (the host's refetch drops it).
      onSaved()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Access is given to whole groups.</DialogDescription>
        </DialogHeader>
        <AccessLinesList
          lines={blocked.lines}
          connectorName={connectorName}
          groupLabel={groupLabel}
          groupSize={groupSize}
          selected={selected}
          onChange={setSelected}
          verb="Allow"
        />
        <div className="space-y-2">
          <Label htmlFor="allow-access-reason">
            Reason <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="allow-access-reason"
            placeholder="Why they need it…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={1000}
          />
        </div>
        <DialogFooter className="items-center sm:justify-between">
          <span className="text-sm text-muted-foreground">{unchecked > 0 && stay(unchecked)}</span>
          <div className="flex gap-2">
            <Button variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button disabled={saving || selected.size === 0} onClick={() => void save()}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Allow
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
