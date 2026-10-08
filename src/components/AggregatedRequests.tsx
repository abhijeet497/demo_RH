import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ChevronRight,
  Layers,
  Check,
  X,
  Building2,
  UserCircle2,
  Unlock,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { MultiSelect } from "@/components/ui/multi-select"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn, formatDateShort } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/AuthContext"
import {
  approveMcpRequests,
  declineMcpRequests,
  useMcpExplicitBlocks,
  UNGROUPED_LABEL as UNGROUPED,
  type ExplicitGroupBlock,
  type AggregatedMcpEntry,
  type GroupMembers,
} from "@/hooks/use-mcp-access"
import type { AggregatedRequesterDto } from "@/integrations/traceforce/types"

// ===========================================================================
// Aggregated MCP access requests — admin view.
//
// Rolls up pending requests per MCP → per group, so the admin can allow an
// entire group rather than approving one user at a time. The rollup is composed
// client-side from the spec endpoints (no dedicated aggregated route):
//   GET /mcp-access/org-requests?status=1           (pending requests)
//   GET /user-groups?include_members                (groups + member rosters)
// See useAggregatedMcpRequests for the join.
// ===========================================================================

const displayEmail = (r: { email: string | null; user_id: string }) =>
  r.email ?? r.user_id.slice(0, 8) + "…"

const initials = (r: { email: string | null; user_id: string }) => {
  const s = r.email ?? r.user_id
  return s.slice(0, 2).toUpperCase()
}

// --- Derived shape ----------------------------------------------------------
interface GroupRollup {
  groupId: string | null // null for ungrouped
  groupName: string
  requesters: AggregatedRequesterDto[]
}

/** Roll an MCP's requesters up into per-group buckets: each requester sits
 * under every scope blocking them now, so a person blocked by two groups shows
 * on both cards. The ungrouped scope (id null) is the Ungrouped bucket. */
function rollupByGroup(mcp: AggregatedMcpEntry): GroupRollup[] {
  const buckets = new Map<string, GroupRollup>()
  for (const r of mcp.requesters) {
    for (const g of r.blocking) {
      const key = g.id ?? UNGROUPED
      const existing = buckets.get(key)
      if (existing) {
        existing.requesters.push(r)
      } else {
        buckets.set(key, { groupId: g.id, groupName: g.name, requesters: [r] })
      }
    }
  }
  return Array.from(buckets.values()).sort((a, b) => {
    if (a.groupId === null) return 1
    if (b.groupId === null) return -1
    return b.requesters.length - a.requesters.length
  })
}

// ---------------------------------------------------------------------------
const Avatar = ({ r }: { r: AggregatedRequesterDto }) => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-[10px] font-medium text-primary ring-2 ring-background">
          {initials(r)}
        </span>
      </TooltipTrigger>
      <TooltipContent>{displayEmail(r)}</TooltipContent>
    </Tooltip>
  </TooltipProvider>
)

interface MemberRow {
  /** email when known, otherwise the requester's user_id (id-only fallback). */
  key: string
  email: string | null
  requested: boolean
  reason?: string
  requestedAt?: string
}

/**
 * Merge a group's full roster (emails, from include_members) with the requesters
 * already known. Requesters are matched to roster members by email.
 */
function buildMemberRows(group: GroupRollup, rosterEmails: string[]): MemberRow[] {
  const requesterByEmail = new Map<string, AggregatedRequesterDto>()
  const requestersNoEmail: AggregatedRequesterDto[] = []
  for (const r of group.requesters) {
    if (r.email) requesterByEmail.set(r.email, r)
    else requestersNoEmail.push(r)
  }

  // For ungrouped there's no roster — fall back to the requesters themselves.
  const emails = rosterEmails.length
    ? Array.from(new Set([...rosterEmails, ...requesterByEmail.keys()]))
    : Array.from(requesterByEmail.keys())

  const rows: MemberRow[] = emails.map((email) => {
    const r = requesterByEmail.get(email)
    return {
      key: email,
      email,
      requested: !!r,
      reason: r?.reason,
      requestedAt: r?.requested_at,
    }
  })

  // Requesters whose email couldn't be resolved (id-only) — show them anyway.
  for (const r of requestersNoEmail) {
    rows.push({
      key: r.user_id,
      email: null,
      requested: true,
      reason: r.reason,
      requestedAt: r.requested_at,
    })
  }

  return rows.sort((a, b) => {
    if (a.requested !== b.requested) return Number(b.requested) - Number(a.requested)
    if (a.requested && b.requested)
      return new Date(b.requestedAt!).getTime() - new Date(a.requestedAt!).getTime()
    return (a.email ?? a.key).localeCompare(b.email ?? b.key)
  })
}

// ---------------------------------------------------------------------------
/** Popup listing every member of a group; requesters are highlighted. */
const GroupUsersDialog = ({
  mcpName,
  group,
  rosterEmails,
  onOpenChange,
}: {
  mcpName: string
  group: GroupRollup | null
  rosterEmails: string[]
  onOpenChange: (open: boolean) => void
}) => {
  const members = useMemo(
    () => (group ? buildMemberRows(group, rosterEmails) : []),
    [group, rosterEmails],
  )
  const requestedCount = members.filter((m) => m.requested).length

  return (
    <Dialog open={!!group} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{group?.groupName}</DialogTitle>
          <DialogDescription>
            {group?.groupId
              ? `${requestedCount} of ${members.length} members requested ${mcpName}. Approving allows ${mcpName} for this group.`
              : `${requestedCount} ${requestedCount === 1 ? "user" : "users"} not in any group requested ${mcpName}. Approve it for all users, or decline these requests.`}
          </DialogDescription>
        </DialogHeader>
        <ul className="max-h-80 space-y-2 overflow-y-auto">
            {members.map((m) => (
              <li
                key={m.key}
                className={cn(
                  "flex items-start gap-3 rounded-md border p-3",
                  m.requested ? "border-primary/40 bg-primary/5" : "opacity-80",
                )}
              >
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-medium text-primary ring-2 ring-background">
                  {(m.email ?? m.key).slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">
                      {m.email ?? m.key.slice(0, 8) + "…"}
                    </span>
                    {m.requested ? (
                      <Badge className="shrink-0 gap-1">
                        <Check className="h-3 w-3" />
                        Requested · {formatDateShort(m.requestedAt!)}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="shrink-0 text-muted-foreground">
                        Member
                      </Badge>
                    )}
                  </div>
                  {m.requested ? (
                    <p className="mt-0.5 text-sm text-muted-foreground">{m.reason}</p>
                  ) : (
                    <p className="mt-0.5 text-sm italic text-muted-foreground">
                      Has not requested {mcpName}.
                    </p>
                  )}
                </div>
              </li>
            ))}
        </ul>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
const McpRow = ({
  mcp,
  groupMembers,
  explicitBlocks,
  onMutated,
  defaultOpen = false,
}: {
  mcp: AggregatedMcpEntry
  groupMembers: GroupMembers
  /** Groups holding an explicit (Set Access) block on this MCP — an org-wide
   * approve does not grant these unless the admin lifts the blocks. */
  explicitBlocks: ExplicitGroupBlock[]
  onMutated: () => void
  /** Expand on mount — used when arriving via a deep link filtered to this
   * single MCP, where the point of the click is to see the detail. */
  defaultOpen?: boolean
}) => {
  const { toast } = useToast()
  const { session } = useAuth()
  // Default collapsed — a long list of MCPs is easier to scan when only the
  // summary row is visible; admin expands the MCPs they care about.
  const [open, setOpen] = useState(defaultOpen)
  const [viewGroup, setViewGroup] = useState<GroupRollup | null>(null)
  const [busy, setBusy] = useState(false)
  // The action awaiting confirmation (null when no dialog is open). EVERY
  // approve/decline confirms — group-scoped actions change access too, and a
  // single stray click shouldn't. The decline confirm additionally carries the
  // optional note to the requesters. group undefined = org-wide.
  // ungroupedOnly (decline of the ungrouped row): decline ONLY the requests of
  // people the ungrouped scope blocks. No group is set in that case.
  const [confirmAction, setConfirmAction] = useState<{ kind: "approve" | "decline"; group?: GroupRollup; ungroupedOnly?: boolean } | null>(null)
  // Note sent to requesters on decline (resolution_note); reset per dialog.
  const [declineNote, setDeclineNote] = useState("")
  const groups = useMemo(() => rollupByGroup(mcp), [mcp])
  const requestCount = mcp.requesters.length
  const ungroupedCount = groups.find((g) => g.groupId === null)?.requesters.length ?? 0
  const requestsWord = (n: number) => `${n} ${n === 1 ? "request" : "requests"}`
  const namedGroups = groups.filter((g) => g.groupId !== null).length

  // Explicit (Set Access) group blocks: an org-wide approve doesn't grant
  // these scopes (a group decision outranks an org one), so their rows offer
  // "Lift block & approve" and the org-wide confirm becomes a keep/lift
  // choice. Counts split what the org approve grants vs what stays pending,
  // per request (a person on two cards counts once): the org allow grants
  // everyone no explicit group block holds back.
  const explicitBlockIds = new Set(explicitBlocks.map((b) => b.groupId))
  const isExplicitlyBlocked = (g?: GroupRollup | null) =>
    !!g?.groupId && explicitBlockIds.has(g.groupId)
  const grantableCount = mcp.requesters.filter((r) =>
    r.blocking.every((b) => b.id === null || !explicitBlockIds.has(b.id)),
  ).length
  const blockedRequestCount = requestCount - grantableCount
  // A group approve closes only the requests that group alone blocks; people
  // another group still blocks stay pending (and stay on that group's card).
  const groupApproveCopy = (g: GroupRollup) => {
    const closes = g.requesters.filter((r) => r.blocking.length === 1).length
    const stays = g.requesters.length - closes
    return `approves ${closes} pending ${closes === 1 ? "request" : "requests"}${
      stays > 0
        ? `; ${stays} ${stays === 1 ? "stays" : "stay"} pending because another group still blocks them`
        : ""
    }.`
  }
  // Names come from the block list, not the queue rollup: lifting affects
  // every explicitly blocked group, including ones with no pending requests.
  const blockedNames = explicitBlocks.map((b) => b.groupName ?? "Unknown group")

  // Age of the oldest and newest pending requests across every requester, so the
  // row shows how long the longest-waiting request has sat ("oldest request 3d
  // ago") and how recent the most recent one is — without expanding the MCP.
  const { oldestAge, latestAge } = useMemo(() => {
    const formatAge = (ts: number) => {
      const ms = Date.now() - ts
      const days = Math.floor(ms / 86_400_000)
      if (days >= 1) return `${days}d ago`
      const hours = Math.floor(ms / 3_600_000)
      if (hours >= 1) return `${hours}h ago`
      const minutes = Math.max(1, Math.floor(ms / 60_000))
      return `${minutes}m ago`
    }
    const timestamps = mcp.requesters
      .map((r) => new Date(r.requested_at).getTime())
      .filter((n) => Number.isFinite(n))
    if (!timestamps.length) return { oldestAge: null, latestAge: null }
    return {
      oldestAge: formatAge(Math.min(...timestamps)),
      latestAge: formatAge(Math.max(...timestamps)),
    }
  }, [mcp.requesters])

  const token = useCallback(() => {
    if (session?.access_token) return session.access_token
    toast({
      title: "Not signed in",
      description: "Your session has expired. Please sign in again.",
      variant: "destructive",
    })
    return null
  }, [session, toast])

  // Approving grants the scope access going forward (it records an ALLOW
  // decision — it shows up in History) and, in the same call, approves the
  // pending requests of everyone who can now use the MCP: people another
  // scope still blocks stay pending (an explicitly blocked group's too, unless
  // liftBlocks removes those blocks).
  const handleApprove = async (scopeType: 1 | 2, group?: GroupRollup, liftBlocks?: boolean) => {
    const t = token()
    if (!t) return
    setBusy(true)
    try {
      await approveMcpRequests(t, {
        scopeType,
        groupId: scopeType === 2 ? group?.groupId ?? null : null,
        mcpServerType: mcp.mcp_server_type,
        liftGroupBlocks: scopeType === 1 ? liftBlocks : undefined,
      })
      // Title-only, naming the ACT (an allow decision at the chosen scope) —
      // "requests approved" could be false when every pending ask sits behind
      // a kept group block. The confirm dialog stated the full consequence.
      toast({ title: "Access allowed" })
      onMutated()
    } catch (e: any) {
      toast({ title: "Could not approve", description: e?.message ?? "Try again.", variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  // Declining is a pure "no, not now": the requests of everyone the scope
  // blocks close, wherever else they're listed (the requesters see Declined on
  // My Requests), and access is UNTOUCHED — no standing block is created, so
  // whatever policy says keeps applying. A standing block is not a request
  // outcome: Set Access is hidden; standing blocks are legacy or API-only.
  const handleDecline = async (scopeType: 1 | 2, group?: GroupRollup, ungroupedOnly?: boolean) => {
    const t = token()
    if (!t) return
    setBusy(true)
    try {
      const { resolvedCount } = await declineMcpRequests(t, {
        scopeType,
        groupId: scopeType === 2 ? group?.groupId ?? null : null,
        mcpServerType: mcp.mcp_server_type,
        note: declineNote,
        ungroupedOnly,
      })
      // 0 when the list was stale (those people moved or their requests
      // closed); the refetch shows where they are now.
      toast(resolvedCount > 0 ? { title: "Requests declined" } : { title: "Nothing to decline", description: "These requests changed. The list is updated." })
      onMutated()
    } catch (e: any) {
      toast({ title: "Could not decline", description: e?.message ?? "Try again.", variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  // Clicking a summary chip expands the MCP and scrolls the group card into view.
  const groupCardRefs = useMemo(() => new Map<string, HTMLDivElement | null>(), [])
  const focusGroup = (key: string) => {
    setOpen(true)
    // Wait a frame for the collapsible content to mount before scrolling.
    requestAnimationFrame(() => {
      groupCardRefs.get(key)?.scrollIntoView({ behavior: "smooth", block: "nearest" })
    })
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border-b last:border-b-0">
      {/* The toggle is a semantic button (keyboard-accessible on its own); the
          approve/decline actions sit outside it so we don't nest buttons in a button. */}
      <div className="flex flex-col gap-2 px-4 py-3 hover:bg-muted/40 sm:flex-row sm:items-center sm:gap-3">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex flex-1 items-center gap-3 rounded-sm text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronRight
              className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")}
            />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium">{mcp.mcp_server_name}</span>
                <span className="text-xs text-muted-foreground">
                  {requestCount} pending {requestCount === 1 ? "request" : "requests"}
                  {namedGroups > 0 && ` · ${namedGroups} ${namedGroups === 1 ? "group" : "groups"}`}
                  {oldestAge && ` · oldest request ${oldestAge}`}
                  {latestAge && oldestAge !== latestAge && ` · latest request ${latestAge}`}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {groups.map((g) => {
                  const ungrouped = g.groupId === null
                  const key = g.groupId ?? UNGROUPED
                  return (
                    <Badge
                      key={key}
                      variant={ungrouped ? "outline" : "secondary"}
                      className="cursor-pointer gap-1 font-normal"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        focusGroup(key)
                      }}
                    >
                      {ungrouped ? (
                        <UserCircle2 className="h-3 w-3" />
                      ) : (
                        <Layers className="h-3 w-3" />
                      )}
                      {ungrouped ? `${g.requesters.length} not in any group` : `${g.requesters.length} in ${g.groupName}`}
                    </Badge>
                  )
                })}
              </div>
            </div>
          </button>
        </CollapsibleTrigger>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button
            size="sm"
            className="gap-1.5"
            disabled={busy}
            onClick={() => setConfirmAction({ kind: "approve" })}
          >
            <Building2 className="h-4 w-4" />
            Approve for all users
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-destructive"
            disabled={busy}
            onClick={() => setConfirmAction({ kind: "decline" })}
          >
            <X className="h-4 w-4" />
            Decline
          </Button>
        </div>
      </div>

      <CollapsibleContent>
        <div className="space-y-2 bg-muted/20 px-4 pb-4 pt-1">
          {groups.map((g) => {
            const ungrouped = g.groupId === null
            const key = g.groupId ?? UNGROUPED
            return (
              <div
                key={key}
                ref={(el) => groupCardRefs.set(key, el)}
                className="flex flex-col gap-3 rounded-md border bg-background p-3 sm:flex-row sm:items-center"
              >
                <div className="flex min-w-[180px] items-center gap-2">
                  {ungrouped ? (
                    <UserCircle2 className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Layers className="h-4 w-4 text-primary" />
                  )}
                  <span className={cn("font-medium", ungrouped && "text-muted-foreground")}>
                    {g.groupName}
                  </span>
                  <Badge variant="secondary">{g.requesters.length}</Badge>
                </div>

                <button
                  type="button"
                  onClick={() => setViewGroup(g)}
                  className="flex flex-1 flex-wrap items-center gap-3 rounded-md text-left hover:opacity-80"
                  title="View all users"
                >
                  <div className="flex -space-x-1.5">
                    {g.requesters.slice(0, 5).map((r) => (
                      <Avatar key={r.user_id} r={r} />
                    ))}
                    {g.requesters.length > 5 && (
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground ring-2 ring-background">
                        +{g.requesters.length - 5}
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-medium text-primary underline-offset-2 hover:underline">
                    View all
                  </span>
                </button>

                <div className="flex items-center gap-2">
                  {ungrouped ? (
                    // Ungrouped requesters belong to no group, so there's no
                    // group scope to grant at — the only grant is org-wide
                    // (Approve for all users). Decline, though, CAN be scoped to
                    // just these requesters (ungrouped_only), so a "no, not
                    // now" here doesn't also decline grouped requesters.
                    <>
                      <Button
                        size="sm"
                        className="gap-1.5"
                        disabled={busy}
                        onClick={() => setConfirmAction({ kind: "approve" })}
                      >
                        <Building2 className="h-4 w-4" />
                        Approve for all users
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-destructive"
                        disabled={busy}
                        onClick={() => setConfirmAction({ kind: "decline", ungroupedOnly: true })}
                      >
                        <X className="h-4 w-4" />
                        Decline
                      </Button>
                    </>
                  ) : (
                    <>
                      {/* An explicitly blocked group's approve IS a block
                          lift (a newer group allow outranks the old block) —
                          the label says so; no separate state badge needed. */}
                      <Button
                        size="sm"
                        className="gap-1.5"
                        disabled={busy}
                        onClick={() => setConfirmAction({ kind: "approve", group: g })}
                      >
                        {isExplicitlyBlocked(g) ? (
                          <>
                            <Unlock className="h-4 w-4" />
                            Lift block & approve
                          </>
                        ) : (
                          <>
                            <Check className="h-4 w-4" />
                            Approve for {g.groupName}
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-destructive"
                        disabled={busy}
                        onClick={() => setConfirmAction({ kind: "decline", group: g })}
                      >
                        <X className="h-4 w-4" />
                        Decline
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </CollapsibleContent>

      <GroupUsersDialog
        mcpName={mcp.mcp_server_name}
        group={viewGroup}
        rosterEmails={viewGroup?.groupId ? groupMembers.get(viewGroup.groupId) ?? [] : []}
        onOpenChange={(o) => !o && setViewGroup(null)}
      />

      {/* Org-wide approve is the widest-reaching action here, and declines
          carry the optional note to the requesters — both confirm first. */}
      <AlertDialog
        open={confirmAction !== null}
        onOpenChange={(o) => {
          if (!o) {
            setConfirmAction(null)
            setDeclineNote("")
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.kind === "approve"
                ? confirmAction.group
                  ? isExplicitlyBlocked(confirmAction.group)
                    ? `Lift ${confirmAction.group.groupName}'s block on ${mcp.mcp_server_name}?`
                    : `Approve ${mcp.mcp_server_name} for ${confirmAction.group.groupName}?`
                  : `Approve ${mcp.mcp_server_name} for all users?`
                : confirmAction?.ungroupedOnly
                  ? `Decline the requests for ${mcp.mcp_server_name} from users not in any group?`
                  : confirmAction?.group
                    ? `Decline ${confirmAction.group.groupName}'s requests for ${mcp.mcp_server_name}?`
                    : `Decline all pending requests for ${mcp.mcp_server_name}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.kind === "approve"
                ? confirmAction.group
                  ? isExplicitlyBlocked(confirmAction.group)
                    ? `Removes the explicit block and allows ${mcp.mcp_server_name} for ${confirmAction.group.groupName} going forward; ${groupApproveCopy(confirmAction.group)}`
                    : `Allows ${mcp.mcp_server_name} for ${confirmAction.group.groupName} going forward, and ${groupApproveCopy(confirmAction.group)}`
                  : explicitBlocks.length > 0
                    ? `Allows ${mcp.mcp_server_name} for all users going forward, and approves ${grantableCount} pending ${grantableCount === 1 ? "request" : "requests"}. ${blockedRequestCount} ${blockedRequestCount === 1 ? "request stays" : "requests stay"} pending unless you lift the explicit ${explicitBlocks.length === 1 ? "block" : "blocks"} on: ${blockedNames.join(", ")}.`
                    : `Allows ${mcp.mcp_server_name} for all users going forward, and approves all ${requestCount} pending ${requestCount === 1 ? "request" : "requests"} for it.`
                : (
                    <>
                      <span className="block">
                        {confirmAction?.group
                          ? `Declines ${requestsWord(confirmAction.group.requesters.length)} from ${confirmAction.group.groupName} members.`
                          : confirmAction?.ungroupedOnly
                            ? `Declines ${requestsWord(ungroupedCount)} from users not in any group.`
                            : `Declines all ${requestsWord(requestCount)} for ${mcp.mcp_server_name}.`}
                      </span>
                      <span className="block">This doesn&apos;t block them. They can request again.</span>
                    </>
                  )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {confirmAction?.kind === "decline" && (
            <Textarea
              placeholder="Note to the requesters (optional) — shown on their declined request"
              value={declineNote}
              onChange={(e) => setDeclineNote(e.target.value)}
              maxLength={1000}
              rows={2}
            />
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            {/* Org-wide approve over explicit group blocks forks into a
                deliberate choice — blocks never fall silently. Each fork
                button states and passes its own lift flag. */}
            {confirmAction?.kind === "approve" && !confirmAction.group && explicitBlocks.length > 0 ? (
              <>
                <AlertDialogAction
                  disabled={busy}
                  onClick={async (e) => {
                    e.preventDefault()
                    await handleApprove(1, undefined, false)
                    setConfirmAction(null)
                    setDeclineNote("")
                  }}
                >
                  Keep blocks & approve
                </AlertDialogAction>
                <AlertDialogAction
                  disabled={busy}
                  onClick={async (e) => {
                    e.preventDefault()
                    await handleApprove(1, undefined, true)
                    setConfirmAction(null)
                    setDeclineNote("")
                  }}
                >
                  Lift blocks & approve
                </AlertDialogAction>
              </>
            ) : (
              <AlertDialogAction
                disabled={busy}
                className={
                  confirmAction?.kind === "decline"
                    ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    : undefined
                }
                onClick={async (e) => {
                  e.preventDefault()
                  const action = confirmAction
                  if (action?.kind === "approve") {
                    await handleApprove(action.group ? 2 : 1, action.group)
                  } else if (action?.kind === "decline") {
                    await handleDecline(action.group ? 2 : 1, action.group, action.ungroupedOnly)
                  }
                  setConfirmAction(null)
                  setDeclineNote("")
                }}
              >
                {confirmAction?.kind === "approve"
                  ? confirmAction.group
                    ? isExplicitlyBlocked(confirmAction.group)
                      ? "Lift block & approve"
                      : `Approve for ${confirmAction.group.groupName}`
                    : "Approve for all users"
                  : "Decline requests"}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Collapsible>
  )
}

// ---------------------------------------------------------------------------
const AggregatedRequests = ({
  entries,
  groupMembers,
  loading,
  error,
  onMutated,
  onPendingCountChange,
  mcpTypeFilter,
  onClearMcpFilter,
  initialGroupFilters = [],
}: {
  /** Aggregated pending requests, fetched once by the parent (McpAccess). */
  entries: AggregatedMcpEntry[]
  groupMembers: GroupMembers
  loading: boolean
  error: string | null
  /** Re-fetch the aggregated requests after an approve/decline. */
  onMutated: () => void
  /** Reports the total number of pending requests (sum across MCPs) to the parent. */
  onPendingCountChange?: (count: number) => void
  /** Deep-link filter (e.g. from the MCPs table's Access Status column) —
   * restricts the list to a single mcp_server_type. Takes priority over the
   * free-text search box. */
  mcpTypeFilter?: number | null
  onClearMcpFilter?: () => void
  /** Group context carried in via ?group= — seeds the group filter. */
  initialGroupFilters?: string[]
}) => {
  const [query, setQuery] = useState("")
  const [groupFilters, setGroupFilters] = useState<string[]>(initialGroupFilters)
  const data = entries

  // Explicit group blocks for every MCP in the queue (one fetch), so rows can
  // offer "Lift block & approve" and the org-wide confirm can fork. Refreshes
  // whenever the entries refetch (every mutation path, incl. Set Access saves).
  const queueMcpTypes = useMemo(() => data.map((m) => m.mcp_server_type), [data])
  const explicitBlocksByMcp = useMcpExplicitBlocks(queueMcpTypes)

  // Group filter options from the data itself (every scope blocking a requester),
  // keyed by name — group names are what the rows render.
  const groupOptions = [
    ...new Set(
      data.flatMap((m) =>
        m.requesters.flatMap((r) => r.blocking.map((g) => g.name)),
      ),
    ),
  ]
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({ id: name, name }))

  /** An MCP entry matches when a selected group blocks any of its requesters. */
  const matchesGroupFilter = (m: AggregatedMcpEntry): boolean =>
    groupFilters.length === 0 ||
    m.requesters.some((r) => r.blocking.some((g) => groupFilters.includes(g.name)))

  // Each pending request maps to exactly one requester entry under one MCP, so the
  // total pending count is the sum of requesters across all MCP rows. Reported
  // UNFILTERED — the tab badge is the org-wide truth, not the current view.
  const pendingCount = data.reduce((n, m) => n + m.requesters.length, 0)
  useEffect(() => {
    onPendingCountChange?.(pendingCount)
  }, [pendingCount, onPendingCountChange])

  const filtered = (
    mcpTypeFilter != null
      ? data.filter((m) => m.mcp_server_type === mcpTypeFilter)
      : data.filter((m) => m.mcp_server_name.toLowerCase().includes(query.trim().toLowerCase()))
  ).filter(matchesGroupFilter)

  const filteredMcpName = mcpTypeFilter != null ? filtered[0]?.mcp_server_name : null

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Pending connector access requests</p>
        <div className="flex items-center gap-2">
          <div className="w-48">
            <MultiSelect
              options={groupOptions}
              selectedIds={groupFilters}
              onChange={setGroupFilters}
              placeholder="All groups"
              searchPlaceholder="Search groups..."
              emptyMessage="No groups found."
              label="group"
              compact
            />
          </div>
          {mcpTypeFilter == null && (
            <Input
              placeholder="Filter by connector…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="max-w-xs"
            />
          )}
        </div>
      </div>

      {mcpTypeFilter != null && (
        <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
          <span className="text-muted-foreground">
            Filtered to <span className="font-medium text-foreground">{filteredMcpName ?? "this connector"}</span>
          </span>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={onClearMcpFilter}>
            Clear
          </Button>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {error ? (
            <p className="py-8 text-center text-sm text-destructive">
              Couldn&apos;t load requests: {error}
            </p>
          ) : loading ? (
            <div className="divide-y">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-8 w-28" />
                  <Skeleton className="h-8 w-20" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {mcpTypeFilter != null
                ? "No pending requests for this connector."
                : query
                  ? `No connectors match "${query}".`
                  : groupFilters.length > 0
                    ? "No pending requests from the selected groups."
                    : "No pending requests."}
            </p>
          ) : (
            filtered.map((mcp) => (
              <McpRow
                key={mcp.mcp_server_type}
                mcp={mcp}
                groupMembers={groupMembers}
                explicitBlocks={explicitBlocksByMcp.get(mcp.mcp_server_type) ?? []}
                onMutated={onMutated}
                defaultOpen={mcpTypeFilter != null}
              />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default AggregatedRequests
