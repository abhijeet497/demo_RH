import type { McpAccessGroupStatusDto, McpAccessVerdict } from "@/integrations/traceforce/types"

// ---------------------------------------------------------------------------
// "Who can use this connector, and why", from the resolver (GET
// /status?view=groups). The resolver speaks per group; admins think per
// reason, so rows merge into one line per reason: "Allowed: Engineering (Okta)
// / by Engineering Access Policy". Shared by the Connectors popover and the
// Set Access dialog so both say the same thing in the same words.
// ---------------------------------------------------------------------------

export interface MergedAccessLine {
  key: string
  /** 1 allowed, 2 blocked, 3 blocked because the risk is unknown; null = no
   * access policy covers these people, so they can use it. */
  verdict: McpAccessVerdict | null
  /** Who: "All users", "All other users", or group names. */
  who: string
  /** Why, in plain words: "by <policy>", "by an admin", "Risk unknown", … */
  reason: string
  /** Where the reason is owned; null = nowhere to go. */
  target: { kind: "policy"; policyId: string } | { kind: "history" } | null
}

/** The line when no access policy covers anyone. */
export const ACCESS_OFF_LINE: Pick<MergedAccessLine, "verdict" | "who" | "reason"> = {
  verdict: null,
  who: "All users",
  reason: "Access control is off",
}

type Draft = Omit<MergedAccessLine, "who"> & { groups: string[]; orgWide: boolean }

const VERDICT_RANK: Record<McpAccessVerdict, number> = { 1: 0, 2: 1, 3: 2 }

/** Every group name, sorted: the names are the answer (the hosts scroll). */
const listGroups = (names: string[]) => [...names].sort((a, b) => a.localeCompare(b)).join(", ")

/** Device scope: blocked lines first, since any one blocks the device. */
const DEVICE_VERDICT_RANK: Record<McpAccessVerdict, number> = { 2: 0, 3: 1, 1: 2 }

export interface DeviceScopeLines {
  /** Selected devices no access policy covers for it: one closing line,
   * "N devices · No access policy covers them" (they can use it). */
  ungovernedCount: number
}

/** Resolver rows → one line per reason: named groups first, then "All
 * other users". `groupLabels` maps group id → display name (with its IdP); rows fall
 * back to the resolver's name. Empty rows = no access policy covers anyone
 * (the caller says so). With `deviceScope` the rows are the devices' own
 * scopes (the caller filters them): every line names its groups, the
 * ungrouped scope as "Users not in any group", blocked lines first. Pure; exported
 * for the renderers and for tests. */
export function mergeAccessLines(
  rows: McpAccessGroupStatusDto[],
  groupLabels?: Map<string, string>,
  deviceScope?: DeviceScopeLines,
): MergedAccessLine[] {
  // The ungrouped scope only exists under an active org-wide policy, so its
  // row means everyone is covered. Without it, an org-wide admin decision
  // only reaches the covered groups (decisions on uncovered people are inert),
  // so it lists those groups instead of claiming "Everyone". Under a device
  // scope nothing speaks for everyone: lines are the devices' groups.
  const everyoneCovered = !deviceScope && rows.some((r) => r.group_id === null)

  const byKey = new Map<string, Draft>()
  for (const row of rows) {
    let draft: Omit<Draft, "groups">
    if (row.decision_id) {
      const orgWide = everyoneCovered && row.decision_scope === 1
      draft = {
        key: `decision-${orgWide ? "org" : "group"}-${row.verdict}`,
        verdict: row.verdict,
        reason: "by an admin",
        target: { kind: "history" },
        orgWide,
      }
    } else {
      const orgWide = !deviceScope && row.policy_assignment_type === 1
      // Risk unknown blocks by default, not by the policy's rules, so it
      // isn't attributed to the policy.
      draft =
        row.verdict === 3
          ? { key: `review-${orgWide ? "org" : "group"}`, verdict: 3, reason: "Risk unknown", target: null, orgWide }
          : {
              key: `policy-${row.policy_id ?? "none"}-${row.verdict}`,
              verdict: row.verdict,
              reason: `by ${row.policy_name ?? "a policy"}`,
              target: row.policy_id ? { kind: "policy", policyId: row.policy_id } : null,
              orgWide,
            }
    }
    const line = byKey.get(draft.key) ?? { ...draft, groups: [] }
    // The ungrouped scope folds into its org-wide line without a name.
    if (row.group_id !== null) {
      line.groups.push(groupLabels?.get(row.group_id) ?? row.group_name ?? "Unknown group")
    } else if (deviceScope) {
      line.groups.push("Users not in any group")
    }
    byKey.set(draft.key, line)
  }

  const drafts = [...byKey.values()]
  const rank = deviceScope ? DEVICE_VERDICT_RANK : VERDICT_RANK
  const named = drafts
    .filter((d) => !d.orgWide)
    .map(({ groups, orgWide: _orgWide, ...rest }) => ({ ...rest, who: listGroups(groups) }))
    .sort((a, b) => rank[a.verdict as McpAccessVerdict] - rank[b.verdict as McpAccessVerdict] || a.who.localeCompare(b.who))
  const orgWide = drafts
    .filter((d) => d.orgWide)
    .map(({ groups: _groups, orgWide: _orgWide, ...rest }) => ({
      ...rest,
      who: named.length > 0 ? "All other users" : "All users",
    }))

  const lines: MergedAccessLine[] = [...named, ...orgWide]
  if (deviceScope) {
    const n = deviceScope.ungovernedCount
    if (n > 0) {
      lines.push({
        key: "uncovered-devices",
        verdict: null,
        who: `${n} ${n === 1 ? "device" : "devices"}`,
        reason: `No access policy covers ${n === 1 ? "it" : "them"}`,
        target: null,
      })
    }
  } else if (rows.length > 0 && !everyoneCovered) {
    lines.push({
      key: "uncovered",
      verdict: null,
      who: "All other users",
      reason: "No access policy covers them",
      target: null,
    })
  }
  return lines
}
