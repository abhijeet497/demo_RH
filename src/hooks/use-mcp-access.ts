import { useCallback, useEffect, useRef, useState } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { traceforcApi } from "@/integrations/traceforce/client"
import { transformMcpName } from "@/lib/utils"
import { extractApiError, friendlyLoadError } from "@/lib/api-errors"
import { getUserGroupSourceLabel } from "@/lib/appUtils"
import { userGroupSourceEnumFromString } from "@/lib/idpGroups"
import type {
  McpAccessRequestDto,
  McpAccessDecisionListDto,
  McpAccessAction,
  McpRequestStatus,
  MyMcpVerdictDto,
  AggregatedRequesterDto,
  UserGroupListItem,
  McpAccessGroupStatusDto,
  McpAccessCoverageDto,
  DecisionActionBody,
} from "@/integrations/traceforce/types"

// ============================================================================
// ENG-324 / ENG-349 / ENG-519 — MCP access data layer.
//
// USER FLOW: backed by the Traceforce REST API —
//   GET  /api/v1/mcp-access/requests   -> useMyMcpRequests
//   POST /api/v1/mcp-access/requests   -> createMcpAccessRequest
//   GET  /api/v1/mcp-access/my-mcps    -> useMyMcpVerdicts (effective verdict
//     per governed MCP, resolved on the fly)
//
// ADMIN FLOW: requests are the ASK; decisions are the ACCESS CHANGE (an
// append-only ledger — latest decision per target beats the policy verdict) —
//   GET  /org-requests      -> useAggregatedMcpRequests (pending tab)
//   POST /requests/resolve  -> approveMcpRequests / declineMcpRequests
//     Approve records an ALLOW decision for the scope (approving an ask
//     necessarily grants access) and sweeps the matching pending requests.
//     Decline closes the asks with a note and touches NO access — no ledger
//     row, the policy stays in charge. A standing block is a deliberate,
//     separate act (POST /decisions), not a request outcome.
//   GET  /decisions         -> useMcpRequestHistory (access-change timeline)
//   GET  /status?view=rollup-> useMcpAccessStatusMap (per-MCP verdict counts)
//   GET  /status?view=groups-> useMcpAccessGroupStatus (one MCP's per-group
//     verdict with its provenance — the Access popover / Set Access panel)
//
// Enums are numeric on the wire (request status 1=pending,2=approved,3=denied,4=satisfied (policy-granted),5=canceled (withdrawn by the requester);
// decision action 1=allow,2=block; verdict 1=allow,2=block,3=needs_review;
// scope 1=ORG,2=GROUP — there is no per-user scope). Request and decision rows
// carry mcp_server_name; the catalog (useMcpCatalog) is only for the Set Access
// picker and a fallback.
// ============================================================================

export type { McpRequestStatus } from "@/integrations/traceforce/types"

/** Scope an admin can pick when approving/declining/deciding: ORG (1) or GROUP (2). */
export type AdminScope = 1 | 2

/** A user's own access request, enriched with the resolved MCP display name. */
export interface MyMcpRequest extends McpAccessRequestDto {
  /** Resolved from mcp_server_type via the mcp_catalog. */
  mcp_server_name: string
}

export interface OrgUserGroup {
  id: string
  name: string
  /** IdP-synced (sized by user_count) vs Traceforce-created (by device_count). */
  synced: boolean
  user_count: number
  device_count: number
}

const toOrgUserGroup = (g: UserGroupListItem): OrgUserGroup => ({
  id: g.id,
  name: groupLabel(g.name, userGroupSourceEnumFromString(g.source)),
  synced: g.synced,
  user_count: g.user_count,
  device_count: g.device_count,
})

interface ListState<T> {
  data: T[]
  loading: boolean
  error: string | null
  refetch: () => void
}

/** A single entry in the MCP catalog (used to label rows and populate pickers). */
export interface McpCatalogEntry {
  type: number
  name: string
}

// ---------------------------------------------------------------------------
// MCP display-name resolution. Request and decision rows carry mcp_server_name;
// the catalog (GET /api/v1/mcp-catalog, the same source the MCP Registry
// renders) is only for the Set Access picker and a fallback, then
// "Connector #<type>" when it has no entry either.
// ---------------------------------------------------------------------------
export function useMcpCatalog(enabled = true): {
  map: Map<number, string>
  options: McpCatalogEntry[]
  loaded: boolean
  error: string | null
} {
  const { session } = useAuth()
  const accessToken = session?.access_token
  const [map, setMap] = useState<Map<number, string>>(new Map())
  const [options, setOptions] = useState<McpCatalogEntry[]>([])
  // Tracks whether the fetch has settled (success, error, or empty). Don't derive
  // this from options.length — an errored or legitimately-empty catalog would then
  // look like it's loading forever.
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Not needed yet (e.g. Connector Access before Set Access opens): rows
    // carry their own names, so skip the ~9k-row download until asked.
    if (!enabled) return
    let active = true
    ;(async () => {
      if (!accessToken) {
        if (!active) return
        setMap(new Map())
        setOptions([])
        setError(null)
        setLoaded(true)
        return
      }
      const rows = await fetchAllPages((next_token) =>
        traceforcApi.listMcpCatalog(accessToken, {
          sort_by: "name",
          sort_order: "asc",
          next_token,
        }),
      )
      const nextMap = new Map<number, string>()
      for (const row of rows) {
        nextMap.set(row.mcp_server_type, transformMcpName(row.mcp_server_name))
      }
      const nextOptions = Array.from(nextMap, ([type, name]) => ({ type, name })).sort((a, b) =>
        a.name.localeCompare(b.name),
      )
      if (!active) return
      setMap(nextMap)
      setOptions(nextOptions)
      setError(null)
    })()
      .catch((e: any) => {
        if (!active) return
        // Surface the failure so consumers can disable/flag the picker instead of
        // silently rendering an empty dropdown.
        setError(friendlyLoadError(e?.message ?? "Failed to load the connector catalog"))
      })
      .finally(() => {
        if (active) setLoaded(true)
      })
    return () => {
      active = false
    }
  }, [accessToken, enabled])

  return { map, options, loaded, error }
}

const mcpName = (map: Map<number, string>, type: number) => map.get(type) ?? `Connector #${type}`

// Prefer the name the server joined onto the row (authoritative — same catalog
// source, and it arrives WITH the row, so there's no separate catalog-fetch
// race that would flash "Connector #<type>"). Run it through transformMcpName so it
// matches the catalog map exactly (useMcpCatalog stores transformed names, e.g.
// GitHub URLs shortened) — otherwise the two sources would display differently.
// Fall back to the map only when the server didn't supply a name.
const resolveMcpName = (serverName: string | null | undefined, map: Map<number, string>, type: number) =>
  serverName?.trim() ? transformMcpName(serverName) : mcpName(map, type)

const EMPTY_NAME_MAP = new Map<number, string>()

/** Drain a cursor-paginated list endpoint into a single array. */
export async function fetchAllPages<T>(
  page: (nextToken?: string) => Promise<{ data?: { data: T[]; next_token: string | null }; error?: string }>,
): Promise<T[]> {
  const all: T[] = []
  let nextToken: string | undefined
  do {
    const res = await page(nextToken)
    if (res.error) throw new Error(res.error)
    all.push(...(res.data?.data ?? []))
    nextToken = res.data?.next_token ?? undefined
  } while (nextToken)
  return all
}

/** A pending org-request that something still blocks. The server can return
 * [] for a request nothing blocks any more (closed on the next sweep); those
 * are hidden and not counted. */
function isOpenAsk(r: McpAccessRequestDto): boolean {
  return r.status === 1 && (r.blocking_group_ids?.length ?? 0) > 0
}

/** A group's display name with its IdP ("Engineering (Okta)"), as on the
 * policy pages: two IdPs can each have an "Engineering". */
export function groupLabel(name: string, source: number): string {
  return `${name} (${getUserGroupSourceLabel(source)})`
}

/** Fetch every org group with its member roster (GET /user-groups?include_members). */
function fetchOrgGroups(accessToken: string): Promise<UserGroupListItem[]> {
  return fetchAllPages<UserGroupListItem>((next_token) =>
    traceforcApi.listUserGroups(accessToken, {
      include_members: true,
      sort_by: "name",
      sort_order: "asc",
      next_token,
    }),
  )
}

// ---------------------------------------------------------------------------
// Queries (user flow — REST)
// ---------------------------------------------------------------------------

/** The current user's own MCP access requests. Pass enabled=false to skip the
 * fetch (e.g. the registry only needs these for regular users). */
export function useMyMcpRequests(enabled = true): ListState<MyMcpRequest> {
  const { session } = useAuth()
  const accessToken = session?.access_token
  // Names come joined onto each row (resolveMcpName); no catalog download
  // (~9k entries) just for the rare row without one ("Connector #<type>").
  const nameMap = EMPTY_NAME_MAP
  const [rows, setRows] = useState<McpAccessRequestDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    // Signed out (or session expired), or disabled: clear any stale rows and
    // stop loading, otherwise the spinner sticks and a previous user's data lingers.
    if (!enabled || !accessToken) {
      setRows([])
      setError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      setRows(await fetchAllPages((next_token) => traceforcApi.listMyMcpRequests(accessToken, { next_token })))
    } catch (e: any) {
      setError(friendlyLoadError(e?.message ?? "Failed to load requests"))
    } finally {
      setLoading(false)
    }
  }, [accessToken, enabled])

  useEffect(() => {
    fetch()
  }, [fetch])

  const data = rows.map((r) => ({
    ...r,
    mcp_server_name: resolveMcpName(r.mcp_server_name, nameMap, r.mcp_server_type),
  }))
  return { data, loading, error, refetch: fetch }
}

/**
 * The caller's effective verdict per GOVERNED MCP (GET /my-mcps). An MCP
 * absent from the map is ungoverned: nothing restricts the caller and nothing
 * is requestable — the registry shows it as Allowed. Drives "request exactly
 * what blocks you":
 *   verdict 1 → Allowed;
 *   verdict 2/3 → Blocked + "Request access" (one request), or "Requested"
 *     while any pending request exists.
 */
export function useMyMcpVerdicts(enabled = true): {
  byMcp: Map<number, MyMcpVerdictDto>
  loading: boolean
  error: string | null
  refetch: () => void
} {
  const { session } = useAuth()
  const accessToken = session?.access_token
  const [byMcp, setByMcp] = useState<Map<number, MyMcpVerdictDto>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!enabled || !accessToken) {
      setByMcp(new Map())
      setError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await traceforcApi.listMyMcps(accessToken)
      if (res.error) throw new Error(res.error)
      setByMcp(new Map((res.data?.data ?? []).map((r) => [r.mcp_server_type, r])))
    } catch (e: any) {
      setError(friendlyLoadError(e?.message ?? "Failed to load connector access"))
    } finally {
      setLoading(false)
    }
  }, [accessToken, enabled])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { byMcp, loading, error, refetch: fetch }
}

// ---------------------------------------------------------------------------
// Per-MCP access status (org catalog view) — a single high-level status per
// mcp_server_type, so pages like Mcps.tsx can show "is this MCP that's
// actively in use actually sanctioned?" without pulling in the full admin
// request UI. Composed from:
//   GET /mcp-access/status?view=rollup     per-verdict governed-group counts
//                                          (resolver: decision > policy)
//   GET /mcp-access/org-requests?status=1  pending requests
// ---------------------------------------------------------------------------

/** High-level access status for one MCP, derived from the resolver's
 * per-group verdict counts — a pure verdict rollup (request counts are a
 * separate affordance, never a status). An MCP absent from the rollup is
 * ungoverned: "none" (no policy — it runs as before, nothing is enforced). */
export type McpAccessStatus =
  | "allowed" // every governed group allows it
  | "varies" // groups disagree (some allow, some block / need review)
  | "blocked" // no group allows it, at least one blocks it
  | "needs_review" // unscored/undecided everywhere it's governed
  | "none" // ungoverned

export interface McpAccessStatusInfo {
  status: McpAccessStatus
  /** Pending request count, regardless of status (rendered as an "N requests"
   * link beside the badge, deep-linking to the Pending tab), so waiting
   * requests stay visible whatever the verdict. Always 0 under a device scope. */
  pendingCount: number
  /** Under a device scope: selected devices no access policy covers for it. */
  ungovernedCount?: number
}

export interface McpAccessStatusState {
  data: Map<number, McpAccessStatusInfo>
  /** Open requests across every connector, including ones not in `data`.
   * Org-wide only: 0 under a device scope. */
  pendingTotal: number
  /** Under a device scope, the rollup's coverage of the selected devices.
   * Null until loaded. */
  coverage: McpAccessCoverageDto | null
  loading: boolean
  error: string | null
  refetch: () => void
}

/**
 * Access status per MCP type, for annotating MCP catalog rows: org-wide, or
 * under `deviceIds` what scout enforces on those devices (the server collapses
 * each device's groups; here only the device counts become a badge). Pending
 * requests are counted org-wide only. Doesn't depend on the admin
 * request-aggregation hooks, so pages that only need the status can use this alone.
 */
export function useMcpAccessStatusMap(enabled = true, deviceIds?: string[]): McpAccessStatusState {
  const { session } = useAuth()
  const accessToken = session?.access_token
  const [statusMap, setStatusMap] = useState<Map<number, McpAccessStatusInfo>>(new Map())
  const [pendingTotal, setPendingTotal] = useState(0)
  const [coverage, setCoverage] = useState<McpAccessCoverageDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Keyed on the ids, not the array, so a caller's fresh [id] doesn't refetch.
  const deviceKey = deviceIds?.join(",") ?? ""
  // The devices the last load settled for: until it matches deviceKey this is
  // loading (the first load, or a device-scope change — a refetch of the same
  // scope, e.g. after an allow, keeps showing the current data), and a
  // superseded fetch (the filter changed meanwhile) is dropped.
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  const latestKey = useRef(deviceKey)
  useEffect(() => {
    latestKey.current = deviceKey
  }, [deviceKey])
  // The devices statusMap's verdicts and coverage are for (null: none).
  const dataKey = useRef<string | null>(null)

  const fetch = useCallback(async () => {
    if (!enabled || !accessToken) {
      setStatusMap(new Map())
      setPendingTotal(0)
      dataKey.current = null
      setCoverage(null)
      setError(null)
      // Enabled but no token yet: stays loading until the token arrives.
      setLoadedKey(enabled ? null : deviceKey)
      return
    }
    setError(null)
    const stale = () => latestKey.current !== deviceKey
    const device_ids = deviceKey ? deviceKey.split(",") : undefined
    try {
      const [rollupRes, pending] = await Promise.all([
        traceforcApi.getMcpAccessRollup(accessToken, device_ids),
        // Org-wide only: a device scope shows no request counts.
        device_ids
          ? Promise.resolve([])
          : fetchAllPages((next_token) => traceforcApi.listOrgMcpRequests(accessToken, { status: 1, next_token })),
      ])
      if (stale()) return
      if (rollupRes.error) throw new Error(rollupRes.error)
      const rollup = rollupRes.data?.data ?? []

      const pendingCountByType = new Map<number, number>()
      let openAsks = 0
      for (const r of pending) {
        if (!isOpenAsk(r)) continue
        openAsks++
        pendingCountByType.set(r.mcp_server_type, (pendingCountByType.get(r.mcp_server_type) ?? 0) + 1)
      }

      const next = new Map<number, McpAccessStatusInfo>()
      // Governed MCPs: derive the status from the per-verdict group counts.
      // Verdicts already encode decision-beats-policy, so no precedence logic
      // lives here — only the rollup-to-badge collapse. (An MCP governed by a
      // single group has one nonzero bucket, so it shows that group's own
      // verdict — "Varies" needs at least two disagreeing groups.) Under a
      // device scope the counts are devices; a type is present only when some
      // device is governed, and the ungoverned ones beside it are allowed.
      for (const r of rollup) {
        const allowed = r.allowed_count + (r.ungoverned_count ?? 0)
        const status: McpAccessStatus =
          allowed > 0
            ? r.blocked_count > 0 || r.needs_review_count > 0
              ? "varies"
              : "allowed"
            : r.blocked_count > 0
              ? "blocked"
              : "needs_review"
        next.set(r.mcp_server_type, {
          status,
          pendingCount: pendingCountByType.get(r.mcp_server_type) ?? 0,
          ungovernedCount: r.ungoverned_count,
        })
      }
      setStatusMap(next)
      setPendingTotal(openAsks)
      dataKey.current = deviceKey
      setCoverage(rollupRes.data?.coverage ?? null)
    } catch (e: any) {
      if (stale()) return
      // A failed refresh keeps the last good data (verdicts and coverage), but
      // a failed load for other devices mustn't show the previous scope's:
      // clear it, so the column shows "—" with the error.
      if (dataKey.current !== deviceKey) {
        setStatusMap(new Map())
        setPendingTotal(0)
        setCoverage(null)
        dataKey.current = null
      }
      setError(friendlyLoadError(e?.message ?? "Failed to load connector access status"))
    } finally {
      if (!stale()) setLoadedKey(deviceKey)
    }
  }, [accessToken, enabled, deviceKey])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { data: statusMap, pendingTotal, coverage, loading: loadedKey !== deviceKey, error, refetch: fetch }
}

/** MCP types default to "none" (ungoverned, nothing requested) when absent
 * from the status map — e.g. still loading, or genuinely no policy covers it. */
export const getMcpAccessStatus = (
  map: Map<number, McpAccessStatusInfo>,
  mcpServerType: number,
): McpAccessStatusInfo => map.get(mcpServerType) ?? { status: "none", pendingCount: 0 }

/**
 * One MCP's per-group effective access (GET /status?view=groups), fetched while
 * `mcpServerType` is non-null and refetched when it changes. `rows` is null
 * until a fetch settles successfully — callers must stay silent about
 * governance until then (a failure must not read as "no policy applies").
 */
export function useMcpAccessGroupStatus(mcpServerType: number | null): {
  rows: McpAccessGroupStatusDto[] | null
  error: string | null
} {
  const { session } = useAuth()
  const accessToken = session?.access_token
  const [rows, setRows] = useState<McpAccessGroupStatusDto[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setRows(null)
    setError(null)
    if (mcpServerType === null || !accessToken) return
    let active = true
    ;(async () => {
      const res = await traceforcApi.getMcpAccessGroupStatus(accessToken, [mcpServerType])
      if (!active) return
      if (res.error) setError(friendlyLoadError(res.error))
      else setRows(res.data?.data ?? [])
    })()
    return () => {
      active = false
    }
  }, [mcpServerType, accessToken])

  return { rows, error }
}

/**
 * Every org group as {id, name} (GET /user-groups, no rosters) — for pickers
 * that need the list but not the members, e.g. Set Access on the inventory
 * page, which doesn't load the aggregated request view.
 */
export function useOrgUserGroups(enabled = true): ListState<OrgUserGroup> {
  const { session } = useAuth()
  const accessToken = session?.access_token
  const [data, setData] = useState<OrgUserGroup[]>([])
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!enabled || !accessToken) {
      setData([])
      setError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const groups = await fetchAllPages<UserGroupListItem>((next_token) =>
        traceforcApi.listUserGroups(accessToken, { sort_by: "name", sort_order: "asc", next_token }),
      )
      setData(groups.map(toOrgUserGroup))
    } catch (e) {
      setError(friendlyLoadError(e instanceof Error ? e.message : "Failed to load groups"))
    } finally {
      setLoading(false)
    }
  }, [accessToken, enabled])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { data, loading, error, refetch: fetch }
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Create an MCP access request (user flow — REST). One request per
 * (user, MCP); the server routes it to every scope blocking the user. */
export async function createMcpAccessRequest(
  accessToken: string,
  input: { mcpServerType: number; reason: string },
): Promise<void> {
  const res = await traceforcApi.createMcpAccessRequest(accessToken, {
    mcp_server_type: input.mcpServerType,
    reason: input.reason,
  })
  if (res.error) throw new Error(extractApiError(res.error))
}

/** Withdraw one of the caller's own pending MCP access requests (marks it CANCELED; user flow — REST). */
export async function cancelMcpAccessRequest(accessToken: string, requestId: string): Promise<void> {
  const res = await traceforcApi.cancelMcpAccessRequest(accessToken, requestId)
  if (res.error) throw new Error(extractApiError(res.error))
}

/** Outcome of an approve/decline: how many pending requests it resolved. */
export interface RequestResolutionResult {
  /** Number of matching pending requests approved or declined. */
  resolvedCount: number
}

/** Shared approve/decline implementation: builds the resolve body and POSTs
 * /requests/resolve, mapping API errors to thrown Errors. */
async function resolveMcpRequests(
  accessToken: string,
  input: {
    scopeType: AdminScope
    groupId?: string | null
    mcpServerType: number
    status: 2 | 3 // 2 approve · 3 decline
    note?: string | null
    liftGroupBlocks?: boolean
    ungroupedOnly?: boolean
  },
): Promise<RequestResolutionResult> {
  const note = input.note?.trim() || undefined
  const body =
    input.scopeType === 2
      ? {
          mcp_server_type: input.mcpServerType,
          scope_type: 2 as const,
          group_id: input.groupId!,
          status: input.status,
          resolution_note: note,
        }
      : {
          mcp_server_type: input.mcpServerType,
          scope_type: 1 as const,
          status: input.status,
          resolution_note: note,
          lift_group_blocks: input.liftGroupBlocks || undefined,
          ungrouped_only: input.ungroupedOnly || undefined,
        }
  const res = await traceforcApi.resolveMcpRequests(accessToken, body)
  if (res.error) throw new Error(extractApiError(res.error))
  return { resolvedCount: res.data?.resolved_count ?? 0 }
}

/**
 * [admin] Approve the pending requests for an (MCP, scope). Approving an ask
 * necessarily grants the scope access, so this also records an ALLOW decision
 * in the ledger (it shows up in History). In the same transaction it closes
 * every pending request for this MCP whose requester can now use it; people
 * still blocked by another scope stay pending (they move to that scope's
 * card), as do explicitly blocked groups unless liftGroupBlocks lifts them.
 */
export async function approveMcpRequests(
  accessToken: string,
  input: {
    scopeType: AdminScope
    groupId?: string | null
    mcpServerType: number
    note?: string | null
    /** Org-wide approve only: also lift explicit group blocks on this MCP so
     * the people they block are granted too. Without it they keep their block
     * and those requests stay pending (close-iff-granted). */
    liftGroupBlocks?: boolean
  },
): Promise<RequestResolutionResult> {
  if (input.scopeType === 2 && !input.groupId) {
    throw new Error("Select a group before approving group-scoped access.")
  }
  return resolveMcpRequests(accessToken, { ...input, status: 2 })
}

/** A group holding an explicit (Set Access) block on an MCP — the scopes an
 * org-wide approve does NOT grant unless the admin lifts them. */
export interface ExplicitGroupBlock {
  groupId: string
  groupName: string | null
}

/**
 * [admin] Explicitly blocked groups per MCP, for the request queue. Detection
 * is precise: a block verdict whose winning provenance is a GROUP-scoped
 * decision (Set Access → Block). Policy-caused blocks are excluded — a plain
 * approve already outranks policy. Missing key = no explicit blocks.
 *
 * Degrades safely: on fetch failure the map is empty, the queue renders its
 * normal buttons, and the backend's close-iff-granted rule still keeps
 * blocked-group requests pending.
 */
export function useMcpExplicitBlocks(mcpServerTypes: number[]): Map<number, ExplicitGroupBlock[]> {
  const { session } = useAuth()
  const accessToken = session?.access_token
  const [map, setMap] = useState<Map<number, ExplicitGroupBlock[]>>(new Map())

  // Keyed on the ARRAY IDENTITY, deliberately: every mutation path (queue
  // approve/decline, Set Access save) refetches the entries and produces a
  // fresh array, so a block created anywhere refreshes this map with no
  // dedicated plumbing. A string/dedup key would skip exactly those refetches
  // (same MCPs pending → same key → stale map → missing lift affordances).
  useEffect(() => {
    const types = [...new Set(mcpServerTypes)].sort((a, b) => a - b)
    if (!accessToken || types.length === 0) {
      setMap(new Map())
      return
    }
    let active = true
    ;(async () => {
      const res = await traceforcApi.getMcpAccessGroupStatus(accessToken, types)
      if (res.error) throw new Error(extractApiError(res.error))
      const next = new Map<number, ExplicitGroupBlock[]>()
      for (const row of res.data?.data ?? []) {
        // verdict 2 = block; decision_scope 2 = a group-scoped decision won.
        if (row.verdict !== 2 || row.decision_scope !== 2 || !row.group_id) continue
        const list = next.get(row.mcp_server_type) ?? []
        list.push({ groupId: row.group_id, groupName: row.group_name })
        next.set(row.mcp_server_type, list)
      }
      if (active) setMap(next)
    })().catch((e) => {
      // Degrading to "no explicit blocks" keeps the queue usable (plain
      // approve buttons; the backend's close-iff-granted rule still keeps
      // blocked requests pending) — but say so, or a broken fetch is invisible.
      console.warn("Explicit-block fetch failed; queue renders without lift affordances", e)
      if (active) setMap(new Map())
    })
    return () => {
      active = false
    }
  }, [accessToken, mcpServerTypes])

  return map
}

// ---------------------------------------------------------------------------
// Aggregated admin view (composed client-side — no dedicated endpoint).
//
// Built from two REST calls (composed here; no aggregated endpoint exists):
//   listOrgMcpRequests -> GET /api/v1/mcp-access/org-requests?status=1   pending requests (+ requester_email)
//   fetchOrgGroups     -> GET /api/v1/user-groups?include_members=true   groups + member roster
// We roll the requests up by mcp_server_type and bucket each requester under
// every scope blocking them now (blocking_group_ids; null = Ungrouped), so the
// admin can grant to a whole group rather than approving one user at a time.
// ---------------------------------------------------------------------------

/** Display name of the ungrouped scope (blocking id null) in the admin view. */
export const UNGROUPED_LABEL = "Users not in any group"

/** One MCP entry in the aggregated view (all requesters + resolved name). */
export interface AggregatedMcpEntry {
  mcp_server_type: number
  mcp_server_name: string
  requesters: AggregatedRequesterDto[]
}

/** Full member roster per group: groupId -> member emails (from include_members). */
export type GroupMembers = Map<string, string[]>

export interface AggregatedState extends ListState<AggregatedMcpEntry> {
  /** Member roster per group (emails), for the "view all users" dialog. */
  groupMembers: GroupMembers
  /** Every org group as {id,name} — the Set Access dialog's group picker
   * (fetched here at page level so opening the dialog is instant). */
  groups: OrgUserGroup[]
}

/**
 * Aggregated pending requests for the admin page. Fetches org-requests
 * (requester_email on each row) and the org groups with rosters, so the whole
 * MCP Access page can be driven from this one hook plus useMcpRequestHistory.
 * nameMap is only a fallback (empty unless Set Access loaded the catalog).
 */
export function useAggregatedMcpRequests(nameMap: Map<number, string>): AggregatedState {
  const { session } = useAuth()
  const accessToken = session?.access_token
  const [entries, setEntries] = useState<AggregatedMcpEntry[]>([])
  const [groupMembers, setGroupMembers] = useState<GroupMembers>(new Map())
  const [groups, setGroups] = useState<OrgUserGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!accessToken) {
      setEntries([])
      setGroupMembers(new Map())
      setGroups([])
      setError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [requests, orgGroups] = await Promise.all([
        // status 1 = PENDING — only undecided requests are actionable here.
        fetchAllPages((next_token) => traceforcApi.listOrgMcpRequests(accessToken, { status: 1, next_token })),
        // Groups (include_members) — gives each group's roster for the users
        // dialog, the id->name lookup used to label requests, and the {id,name}
        // list for the Grant dialog's scope picker.
        fetchOrgGroups(accessToken),
      ])

      // Group rosters (groupId -> emails) for the "view all users" dialog, plus a
      // groupId -> name lookup to label the scopes blocking a requester.
      const rosters: GroupMembers = new Map()
      const groupNameById = new Map<string, string>()
      for (const g of orgGroups) {
        rosters.set(g.id, (g.members ?? []).map((m) => m.owner_email))
        groupNameById.set(g.id, groupLabel(g.name, userGroupSourceEnumFromString(g.source)))
      }

      // Roll requests up per MCP, tagging each requester with every scope
      // blocking them now (server-computed, live). null = the ungrouped scope.
      const byMcp = new Map<number, AggregatedRequesterDto[]>()
      // Server-joined name per type (arrives on the request rows). Preferred
      // over the catalog map on render, so names never wait on the catalog.
      const nameByMcp = new Map<number, string>()
      for (const req of requests) {
        if (!isOpenAsk(req)) continue
        const email = req.requester_email ?? null
        const blocking = (req.blocking_group_ids ?? []).map((id) => ({
          id,
          name: id ? groupNameById.get(id) ?? "Unknown group" : UNGROUPED_LABEL,
        }))
        const arr = byMcp.get(req.mcp_server_type) ?? []
        arr.push({
          user_id: req.requester_id,
          email,
          reason: req.reason,
          requested_at: req.created_at,
          blocking,
        })
        byMcp.set(req.mcp_server_type, arr)
        if (req.mcp_server_name?.trim() && !nameByMcp.has(req.mcp_server_type)) {
          nameByMcp.set(req.mcp_server_type, req.mcp_server_name)
        }
      }

      setEntries(
        Array.from(byMcp, ([mcp_server_type, requesters]) => ({
          mcp_server_type,
          mcp_server_name: nameByMcp.get(mcp_server_type) ?? "", // else catalog on render
          requesters,
        })),
      )
      setGroupMembers(rosters)
      setGroups(orgGroups.map(toOrgUserGroup))
    } catch (e: any) {
      setError(friendlyLoadError(e?.message ?? "Failed to load aggregated requests"))
    } finally {
      setLoading(false)
    }
  }, [accessToken])

  useEffect(() => { fetch() }, [fetch])

  const data = entries.map((e) => ({
    ...e,
    mcp_server_name: resolveMcpName(e.mcp_server_name, nameMap, e.mcp_server_type),
  }))

  return { data, loading, error, refetch: fetch, groupMembers, groups }
}

// ---------------------------------------------------------------------------
// Access-change history (admin view) — the decision ledger, one row per admin
// action, for the History tab:
//   GET /mcp-access/decisions   the ledger, newest first (resolved_count =
//                               requests each decision swept; 0 = manual)
// Group names come from the rows themselves (snapshotted at decision time, so
// a later rename/deletion doesn't rewrite what a past decision says) — no
// groups fetch needed. Declines are absent by design: they change no access;
// the outcome lives on the request row, which the requester sees.
// ---------------------------------------------------------------------------

/** One access decision row, enriched with display labels. */
export interface McpRequestHistoryRow {
  id: string
  mcp_server_type: number
  mcp_server_name: string
  /** 1 = allow · 2 = block (MCPAccessDecision). */
  action: McpAccessAction
  /** 1 = org-wide · 2 = group (render scope 1 as "All users"). */
  scope_type: 1 | 2
  /** Group name snapshot at decision time; null for org-wide decisions. */
  group_name: string | null
  /** Admin who decided (resolved to an email); null = system. */
  decided_by: string | null
  decided_by_email: string | null
  decision_reason: string | null
  /** Pending requests this decision swept up (0 = manual, no request attached). */
  resolved_count: number
  created_at: string
}

/**
 * The access-change timeline (every allow/block decision), newest first.
 * nameMap is only a fallback (empty unless Set Access loaded the catalog).
 */
export function useMcpRequestHistory(nameMap: Map<number, string>): ListState<McpRequestHistoryRow> {
  const { session } = useAuth()
  const accessToken = session?.access_token
  // Store the server-joined name (nullable) alongside each row; it's preferred
  // over nameMap at render time (same pattern as useAggregatedMcpRequests), so
  // the catalog loading in doesn't trigger a refetch here and names don't flash.
  const [rows, setRows] = useState<
    (Omit<McpRequestHistoryRow, "mcp_server_name"> & { mcp_server_name: string | null })[]
  >([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!accessToken) {
      setRows([])
      setError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const decisions = await fetchAllPages<McpAccessDecisionListDto>((next_token) =>
        traceforcApi.listMcpDecisions(accessToken, { next_token }),
      )

      // The endpoint returns newest-first; no client-side collapse needed —
      // each row already IS one decision.
      setRows(
        decisions.map((d) => ({
          id: d.id,
          mcp_server_type: d.mcp_server_type,
          mcp_server_name: d.mcp_server_name ?? null,
          action: d.action,
          scope_type: d.scope_type as 1 | 2,
          group_name: d.group_name,
          decided_by: d.decided_by,
          decided_by_email: d.decided_by_email,
          decision_reason: d.decision_reason,
          resolved_count: d.resolved_count,
          created_at: d.created_at,
        })),
      )
    } catch (e: any) {
      setError(friendlyLoadError(e?.message ?? "Failed to load decision history"))
    } finally {
      setLoading(false)
    }
  }, [accessToken])

  useEffect(() => {
    fetch()
  }, [fetch])

  const data = rows.map((r) => ({ ...r, mcp_server_name: resolveMcpName(r.mcp_server_name, nameMap, r.mcp_server_type) }))
  return { data, loading, error, refetch: fetch }
}

/**
 * [admin] Decline the pending requests for an (MCP, scope) — a pure "no, not
 * now". Every pending request whose requester this scope currently blocks is
 * declined (also removing it from other scopes' cards), with the note; access is
 * UNTOUCHED: no ledger row is written, so whatever policy says keeps applying
 * (and nothing appears in History — it shows access changes). A standing
 * block is a deliberate, separate act (POST /decisions with action=block).
 */
export async function declineMcpRequests(
  accessToken: string,
  input: {
    scopeType: AdminScope
    groupId?: string | null
    mcpServerType: number
    note?: string | null
    /** Org-scoped decline only: decline ONLY the requests of people the
     * ungrouped scope blocks, leaving the rest for this MCP untouched. */
    ungroupedOnly?: boolean
  },
): Promise<RequestResolutionResult> {
  if (input.scopeType === 2 && !input.groupId) {
    throw new Error("Select a group before declining group-scoped requests.")
  }
  return resolveMcpRequests(accessToken, { ...input, status: 3 })
}

/** Outcome of a Set Access decision: how many pending requests it swept.
 * Unread by callers today (success toasts are title-only); kept as the
 * endpoint's documented response shape. */
export interface DecisionResult {
  decidedCount: number
}

/**
 * [admin] Record one access decision (allow/block) for a scope — the "Set
 * Access" act. Appends to the decision ledger (latest decision per target
 * wins over the policy verdict; a decision on an ungoverned group sits
 * dormant and takes effect once the group gets an access policy) and, in the
 * same transaction, closes the matching pending requests whose scope's
 * verdict now matches the decision (close-iff-granted — an outranked or
 * ungoverned scope's requests stay pending).
 */
export async function setMcpAccessDecision(
  accessToken: string,
  input: DecisionInput,
): Promise<DecisionResult> {
  const res = await traceforcApi.mcpDecisionAction(accessToken, decisionBody(input))
  if (res.error) throw new Error(extractApiError(res.error))
  return { decidedCount: res.data?.decided_count ?? 0 }
}

/** [admin] Several decisions in one call, recorded in one transaction: they
 * land whole or not at all. The endpoint caps a call at 5000 decisions
 * (DecisionBatchSchema); above that it returns its validation error. */
export async function setMcpAccessDecisions(
  accessToken: string,
  inputs: DecisionInput[],
): Promise<DecisionResult> {
  const res = await traceforcApi.setMcpAccessDecisions(accessToken, inputs.map(decisionBody))
  if (res.error) throw new Error(extractApiError(res.error))
  return { decidedCount: res.data?.decided_count ?? 0 }
}

type DecisionInput = {
  action: McpAccessAction
  scopeType: AdminScope
  groupId?: string | null
  mcpServerType: number
  reason?: string | null
}

function decisionBody(input: DecisionInput): DecisionActionBody {
  if (input.scopeType === 2 && !input.groupId) {
    throw new Error("Select a group before deciding group-scoped access.")
  }
  const reason = input.reason?.trim() || undefined
  return input.scopeType === 2
    ? {
        action: input.action,
        scope_type: 2,
        group_id: input.groupId!,
        mcp_server_type: input.mcpServerType,
        decision_reason: reason,
      }
    : {
        action: input.action,
        scope_type: 1,
        mcp_server_type: input.mcpServerType,
        decision_reason: reason,
      }
}
