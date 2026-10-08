import { supabase } from "@/integrations/supabase/client"
import { traceforcApi } from "@/integrations/traceforce/client"
import { extractApiError } from "@/lib/api-errors"
import { fetchAllRows } from "@/lib/supabasePaging"

// ---------------------------------------------------------------------------
// Who uses which connector, and which groups would have to be allowed to keep
// them working. Shared by the Connectors page's "Allow" dialog (people blocked
// today) and the policy editor's keep step (people a change would newly block).
//
// The unit of access is a group: a line is (connector, group), and allowing it
// lets everyone in that group use the connector. A device follows the rule the
// device config uses: it can use a connector when none of its scopes (its
// groups, or "no group") blocks it. groupId null = people not in any group;
// the only allow that reaches them is one for all users.
// ---------------------------------------------------------------------------

/** One device using a connector: who owns it (a device with no owner counts
 * as one person) and its scopes (its groups; [null] when it has none). */
export interface DeviceUse {
  person: string
  scopes: (string | null)[]
}

/** Connector type → the devices using it. */
export type UsageByType = Map<number, DeviceUse[]>

/** One scope's access to a connector: 1 allowed, 2 blocked, 3 blocked
 * (risk unknown). hasDecision = an admin's allow/block, not a policy. No entry
 * for a scope = nothing covers it, so it doesn't block. */
export interface ScopeAccess {
  verdict: number
  hasDecision: boolean
}

export type AccessByScope = Map<string | null, ScopeAccess>

export const lineKey = (type: number, groupId: string | null) => `${type}|${groupId ?? ""}`

/** A connector × group that, if allowed, unblocks the people listed. */
export interface AccessLine {
  key: string
  type: number
  groupId: string | null
  /** People using the connector in this group who are (or would be) blocked. */
  people: Set<string>
}

/** A device that is (or would be) blocked, with the lines that block it.
 * stuck = an admin's block in one of its scopes holds it, which an allow here
 * can't lift: it gets no lines (keys empty) and stays blocked whatever is
 * checked. */
interface BlockedDevice {
  type: number
  person: string
  keys: string[]
  stuck: boolean
}

export interface BlockedSet {
  lines: AccessLine[]
  devices: BlockedDevice[]
}

const blocks = (a: ScopeAccess | undefined) => a !== undefined && a.verdict !== 1

function collect(
  usage: UsageByType,
  types: Iterable<number>,
  /** The access each scope ends up with; undefined = skip this device. */
  accessFor: (type: number, device: DeviceUse) => (ScopeAccess | undefined)[] | undefined,
): BlockedSet {
  const lines = new Map<string, AccessLine>()
  const devices: BlockedDevice[] = []
  for (const type of types) {
    for (const device of usage.get(type) ?? []) {
      const access = accessFor(type, device)
      if (!access || !access.some(blocks)) continue
      // An admin's block is deliberate and isn't lifted here, so allowing the
      // device's other groups wouldn't unblock it: no lines, no line counts.
      if (access.some((a) => blocks(a) && a!.hasDecision)) {
        devices.push({ type, person: device.person, keys: [], stuck: true })
        continue
      }
      const keys: string[] = []
      device.scopes.forEach((scope, i) => {
        if (!blocks(access[i])) return
        const key = lineKey(type, scope)
        keys.push(key)
        const line = lines.get(key) ?? { key, type, groupId: scope, people: new Set<string>() }
        line.people.add(device.person)
        lines.set(key, line)
      })
      devices.push({ type, person: device.person, keys, stuck: false })
    }
  }
  return { lines: [...lines.values()], devices }
}

/** People using a connector who are blocked today (Connectors page). */
export function blockedNow(usage: UsageByType, accessByType: Map<number, AccessByScope>): BlockedSet {
  return collect(usage, accessByType.keys(), (type, device) => {
    const byScope = accessByType.get(type)!
    return device.scopes.map((s) => byScope.get(s))
  })
}

/** People using a connector whom a policy change would newly block (policy
 * editor). `after` gives a scope's access once the change is saved. */
export function newlyBlocked(
  usage: UsageByType,
  before: Map<number, AccessByScope>,
  after: (type: number, scope: string | null, before: ScopeAccess | undefined) => ScopeAccess | undefined,
): BlockedSet {
  return collect(usage, usage.keys(), (type, device) => {
    const byScope = before.get(type) ?? new Map()
    if (device.scopes.some((s) => blocks(byScope.get(s)))) return undefined // already blocked
    return device.scopes.map((s) => after(type, s, byScope.get(s)))
  })
}

/** People still blocked with these lines allowed. An allow for all users (the
 * "not in any group" line) also covers every other group's line for that
 * connector: it outranks any policy. */
export function peopleStillBlocked(set: BlockedSet, allowed: Set<string>): number {
  const people = new Set<string>()
  for (const d of set.devices) {
    const allUsers = allowed.has(lineKey(d.type, null))
    if (d.stuck || (!allUsers && d.keys.some((k) => !allowed.has(k)))) people.add(d.person)
  }
  return people.size
}

/** People an admin's block keeps blocked whatever is checked (a subset of
 * peopleStillBlocked's count): that block isn't lifted here. */
export const peopleStuck = (set: BlockedSet) => new Set(set.devices.filter((d) => d.stuck).map((d) => d.person)).size

export const users = (n: number) => `${n} ${n === 1 ? "user" : "users"}`

/** A group's size, from the user group list: members for an IdP-synced group,
 * devices for one created in Traceforce. */
export const groupSize = (g: { synced: boolean; user_count: number; device_count: number }) =>
  g.synced
    ? `${g.user_count} ${g.user_count === 1 ? "member" : "members"}`
    : `${g.device_count} ${g.device_count === 1 ? "device" : "devices"}`

/** Distinct people across the given lines. */
export const peopleIn = (lines: AccessLine[]) => new Set(lines.flatMap((l) => [...l.people])).size

/** Current access for these connectors in the scopes their in-use devices are
 * in (GET /status?view=groups&in_use=true), chunked to the endpoint's 100-type
 * cap; chunks run in parallel. Throws on any failure: a list we can't stand
 * behind is worse than none (fail closed). */
export async function fetchAccessByScope(token: string, types: number[]): Promise<Map<number, AccessByScope>> {
  const out = new Map<number, AccessByScope>()
  const chunks: number[][] = []
  for (let i = 0; i < types.length; i += 100) chunks.push(types.slice(i, i + 100))
  const results = await Promise.all(chunks.map((c) => traceforcApi.getMcpAccessGroupStatus(token, c, { inUse: true })))
  for (const res of results) {
    if (res.error) throw new Error(extractApiError(res.error))
    for (const row of res.data?.data ?? []) {
      const byScope = out.get(row.mcp_server_type) ?? new Map<string | null, ScopeAccess>()
      byScope.set(row.group_id, { verdict: row.verdict, hasDecision: row.decision_id !== null })
      out.set(row.mcp_server_type, byScope)
    }
  }
  return out
}

/** The latest admin decision per target for these connectors, read from the
 * decision ledger newest first (the resolver's order: created_at, then id).
 * Key lineKey(type, groupId) → action (1 allow, 2 block); groupId null = the
 * decision for all users. Throws on failure (fail closed). */
export async function fetchLatestDecisions(orgId: string, types: number[]): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  if (types.length === 0) return out
  const rows = await fetchAllRows<{ mcp_server_type: number; scope_type: number; group_id: string | null; action: number }>(
    (from, to) =>
      supabase
        .from("mcp_access_decisions")
        .select("mcp_server_type, scope_type, group_id, action")
        .eq("org_id", orgId)
        .in("mcp_server_type", types)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, to),
  )
  for (const r of rows) {
    if (r.scope_type === 2 && !r.group_id) continue
    const key = lineKey(r.mcp_server_type, r.scope_type === 2 ? r.group_id : null)
    if (!out.has(key)) out.set(key, r.action)
  }
  return out
}
