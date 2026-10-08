import { useCallback, useEffect, useRef, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { ArrowLeft, Search, Users as UsersIcon } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { useOrg } from "@/contexts/OrgContext"
import { traceforcApi } from "@/integrations/traceforce/client"
import type { DirectoryUser } from "@/integrations/traceforce/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { useUrlFilterParams } from "@/hooks/use-url-filters"
import { apiErrorText } from "@/lib/api-errors"
import { getUserGroupSourceBadge } from "@/lib/appUtils"
import { userGroupSourceEnumFromString } from "@/lib/idpGroups"

// Server-side pagination: a directory can be far larger than a device fleet, so
// rows are fetched a page at a time through the public API's cursor pagination.
const PAGE_SIZE = 25

// The API requires at least 2 characters of search; shorter input is treated as
// "no search" so a half-typed query shows everything instead of erroring.
const SEARCH_MIN_CHARS = 2

// Group chips shown inline per row; the rest collapse into a +N badge with a
// hover list. Keeps row height stable for users in many groups.
const GROUP_CHIP_LIMIT = 3

type GroupOption = {
  id: string
  name: string
}

// Labels for non-active member states; active is the norm and gets no badge.
// null = the IdP never reported a state (the API's null-for-unknown convention).
const MEMBER_STATE_LABELS: Record<string, string> = { suspended: "Suspended", inactive: "Inactive" }
const memberStateLabel = (state: DirectoryUser["state"]): string =>
  (state && MEMBER_STATE_LABELS[state]) || "Unknown"

/**
 * Directory Users — the users an identity provider has synced into Traceforce,
 * filterable by group. Reached from the sidebar (all users), the eye action on an
 * IdP group row (pre-filtered via ?group=, source_devices=true), or View Groups in
 * the Directory Sync drawer (source_settings=true). The back link follows the
 * source param, like every other page that can be entered from more than one place.
 *
 * Reads entirely through the public API: GET /api/v1/directory-users for the
 * rows (device resolution, liveness, and case-insensitive email matching all
 * live server-side) and GET /api/v1/user-groups?synced=true for the picker —
 * no direct Supabase reads remain on this page.
 *
 * Deliberately NOT the Devices page: an IdP group's membership is a list of
 * identities, and those identities resolve to devices only through the MDM's
 * owner email. Filtering the device table by an IdP group therefore shows an empty
 * table for a group that genuinely has members, which reads as "the sync did not
 * work". This page answers the question the group row actually raises — who is in
 * this group — and reports the device resolution alongside it.
 */
const DirectoryUsers = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { session } = useAuth()
  const { activeOrgId } = useOrg()
  const { toast } = useToast()
  const token = session?.access_token

  // Filters live in the URL so the page is linkable and Back restores them.
  // updateParams (shared hook) does one atomic multi-key update (and preserves
  // history state). Cursor positions are NOT in the URL: tokens are opaque,
  // short-lived, and meaningless to share — deep links land on page one.
  const { searchParams, updateParams } = useUrlFilterParams()
  const groupFilter = searchParams.get("group") || ""
  const searchTerm = searchParams.get("q") || ""

  // Debounce ONLY the search term: typing updates the URL per keystroke, but
  // the fetch waits for 300ms of quiet. The debounce effect also resets the
  // cursor in the same batch, so a filter change fires exactly ONE fetch.
  const [debouncedSearch, setDebouncedSearch] = useState(searchTerm)
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchTerm)
      setCursor(null)
      setPrevCursors([])
    }, 300)
    return () => clearTimeout(t)
  }, [searchTerm])

  const [groups, setGroups] = useState<GroupOption[] | null>(null)
  const [rows, setRows] = useState<DirectoryUser[] | null>(null)
  const [loading, setLoading] = useState(false)
  // Set when the LIST fetch failed: the table renders the error instead of the
  // onboarding empty state — "No directory users yet. Connect…" on a 500 or a
  // stale deployment reads as data loss to a connected org.
  const [loadError, setLoadError] = useState<string | null>(null)

  // Cursor pagination state: `cursor` is the token THIS page was requested with
  // (null = first page), `nextCursor` is where Next goes, and `prevCursors` is
  // the trail back — cursors are forward-only, so Previous replays the stack.
  const [cursor, setCursor] = useState<string | null>(null)
  const [prevCursors, setPrevCursors] = useState<(string | null)[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)

  // groupFilter derives from the URL, so it can change without any handler
  // running (sidebar link back to the bare page, browser Back). A cursor names
  // a position in the OLD group's result set — the API applies it silently —
  // so the reset must track the value itself, not the handlers: adjust state
  // during render (react.dev "adjusting state when a prop changes"), which
  // re-renders before the fetch effect fires. A useEffect would be too late —
  // the fetch effect would run in the same commit with the stale cursor in
  // its closure and fire one wrong request per change.
  const [prevGroup, setPrevGroup] = useState(groupFilter)
  if (prevGroup !== groupFilter) {
    setPrevGroup(groupFilter)
    setCursor(null)
    setPrevCursors([])
  }

  // The group picker only lists LIVE IdP-synced groups (synced=true — a manual
  // Traceforce group has no directory members; the API's active-view read keeps
  // tombstoned groups out).
  useEffect(() => {
    if (!token) return
    let cancelled = false
    void (async () => {
      try {
        const data = await traceforcApi.listAllUserGroups(token, { synced: true })
        if (cancelled) return
        setGroups(data.map((g) => ({ id: g.id, name: g.name })))
      } catch (e) {
        if (cancelled) return
        toast({ title: "Could not load groups", description: e instanceof Error ? e.message : "Unexpected error", variant: "destructive" })
        setGroups([])
      }
    })()
    return () => { cancelled = true }
  }, [token, activeOrgId, toast])

  // Group/page changes fetch instantly, so requests overlap on any quick
  // interaction and can resolve out of order; only the most recently started
  // one may commit rows, or a stale filter's page wins the race.
  const fetchSeq = useRef(0)

  const fetchUsers = useCallback(async () => {
    if (!token) return
    const seq = ++fetchSeq.current
    setLoading(true)
    try {
      const search = debouncedSearch.trim()
      const res = await traceforcApi.listDirectoryUsers(token, {
        user_group_ids: groupFilter ? [groupFilter] : undefined,
        search: search.length >= SEARCH_MIN_CHARS ? search : undefined,
        limit: PAGE_SIZE,
        next_token: cursor ?? undefined,
      })
      if (seq !== fetchSeq.current) return
      if (res.error) {
        // apiErrorText maps the awkward shapes (proxy HTML, 404 "is the API
        // deployment current?") that res.message renders badly.
        setLoadError(apiErrorText(res))
        setRows([])
        setHasMore(false)
        setNextCursor(null)
        return
      }
      setLoadError(null)
      setRows(res.data?.data ?? [])
      setNextCursor(res.data?.next_token ?? null)
      setHasMore(res.data?.has_more ?? false)
    } finally {
      if (seq === fetchSeq.current) setLoading(false)
    }
  }, [token, groupFilter, debouncedSearch, cursor, toast])

  useEffect(() => { void fetchUsers() }, [fetchUsers])

  const selectedGroup = groups?.find((g) => g.id === groupFilter) ?? null

  // The cursor reset happens in the prevGroup render adjustment above — it
  // tracks the URL value itself, so Back/sidebar navigation resets too.
  const changeGroup = (value: string) => {
    updateParams({ group: value === "all" ? null : value })
  }
  const changeSearch = (value: string) => {
    updateParams({ q: value || null })
    // The cursor reset rides with the debounce effect, not here — resetting per
    // keystroke would refetch page one on every character before the debounce.
  }
  const goNext = () => {
    if (!nextCursor) return
    setPrevCursors((stack) => [...stack, cursor])
    setCursor(nextCursor)
  }
  const goPrevious = () => {
    setPrevCursors((stack) => {
      if (stack.length === 0) return stack
      setCursor(stack[stack.length - 1])
      return stack.slice(0, -1)
    })
  }

  // Same source_* convention as McpDetail and Agents: the origin names itself in
  // the URL and passes its query string as backSearch so its filters survive the
  // round trip. Sidebar arrivals have no origin and get no back link.
  const getBackButton = () => {
    const backSearch = (location.state?.backSearch as string) || ""
    if (searchParams.get("source_devices")) {
      return { path: `/devices?${backSearch || "tab=user-groups"}`, label: "Back to User Groups" }
    }
    if (searchParams.get("source_settings")) {
      return { path: "/settings?drawer=idp", label: "Back to Settings" }
    }
    return null
  }
  const backButton = getBackButton()

  return (
    <div className="p-6 space-y-6">
      {backButton && (
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(backButton.path)}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            {backButton.label}
          </Button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UsersIcon className="h-5 w-5" />
            Directory Users
          </CardTitle>
          <CardDescription>
            {selectedGroup
              ? <>Users in <span className="font-medium text-foreground">{selectedGroup.name}</span>, synced from your identity provider.</>
              : "Users synced from your identity provider. Membership is read-only in Traceforce."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users by email..."
                value={searchTerm}
                onChange={(e) => changeSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={groupFilter || "all"} onValueChange={changeGroup}>
              <SelectTrigger className="sm:w-64">
                <SelectValue placeholder="All groups" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All groups</SelectItem>
                {(groups || []).map((g) => (
                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Group</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-center">Devices</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows === null || loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={4}><Skeleton className="h-5 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : loadError ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      <div className="space-y-3">
                        <p>Couldn't load directory users. {loadError}</p>
                        <Button variant="outline" size="sm" onClick={() => void fetchUsers()}>
                          Try again
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      {searchTerm
                        ? "No users matching your search"
                        : selectedGroup
                          ? "This group has no directory members yet. Assign users to the group in your identity provider, then sync."
                          : (
                            <div className="space-y-3">
                              <p>No directory users yet. Connect an identity provider and sync to import them.</p>
                              {/* The action the copy names must be reachable from here —
                                  the drawer URL handles both the no-integration and
                                  existing-integration cases. */}
                              <Button variant="outline" size="sm" onClick={() => navigate("/settings?drawer=idp")}>
                                Connect identity provider
                              </Button>
                            </div>
                          )}
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r) => {
                    // Guarded: an API predating the one-row-per-user reshape sends
                    // `group` (singular) — with no ErrorBoundary in the app, an
                    // unguarded .map here would white-screen the whole SPA during
                    // a deploy window.
                    const groups = r.groups ?? []
                    return (
                    <TableRow key={r.email}>
                      <TableCell className="font-medium">
                        {r.email}
                        {/* Non-active members resolve NO devices (the API reports
                            device_count 0 for them), so surface the state instead
                            of implying enforcement reach. */}
                        {r.state !== "active" && (
                          <Badge variant="outline" className="ml-2 text-muted-foreground">
                            {memberStateLabel(r.state)}
                          </Badge>
                        )}
                      </TableCell>
                      {/* One row per user: group name-only chips (the provider has
                          its own Source column), capped at GROUP_CHIP_LIMIT so a
                          user in 10–20 groups can't blow up the row — the rest sit
                          behind a +N badge with a hover list. */}
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {groups.slice(0, GROUP_CHIP_LIMIT).map((g) => (
                            <Badge key={g.id} variant="outline">{g.name}</Badge>
                          ))}
                          {groups.length > GROUP_CHIP_LIMIT && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge variant="secondary" className="cursor-default">
                                    +{groups.length - GROUP_CHIP_LIMIT}
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div className="max-w-64">
                                    {groups.slice(GROUP_CHIP_LIMIT).map((g) => g.name).join(", ")}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </TableCell>
                      {/* A user's groups can in principle span providers; render
                          each distinct source once. */}
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {[...new Set(groups.map((g) => g.source))].map((source) => (
                            <span key={source ?? "unknown"}>
                              {getUserGroupSourceBadge(userGroupSourceEnumFromString(source))}
                            </span>
                          ))}
                        </div>
                      </TableCell>
                      {/* Active members show the real number, including 0. The dash
                          is reserved for non-active members, whose count is forced
                          0 by the API because policies can't reach them — a literal
                          0 there would read as "measured, none" rather than
                          "not applicable". */}
                      <TableCell className="text-center">
                        {r.state === "active"
                          ? r.device_count
                          : <span className="text-muted-foreground">-</span>}
                      </TableCell>
                    </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Cursor pagination has no total, so the footer reports the page,
                not the universe: "Page N" from the trail length. */}
            <p className="text-sm text-muted-foreground">
              {rows === null || loading || loadError
                ? ""
                : rows.length === 0
                  ? "No users"
                  : `Page ${prevCursors.length + 1} · ${rows.length} user${rows.length === 1 ? "" : "s"}`}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={prevCursors.length === 0 || loading}
                onClick={goPrevious}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!hasMore || loading}
                onClick={goNext}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default DirectoryUsers
