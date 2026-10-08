// ENG-454: shared row shape + presentation logic for the "Organizations" list
// (dashboard card + PDF report section). One source of truth so screen and
// report can never disagree on a status or sentence. Rows arrive pre-ordered
// from get_org_scorecard_rollup — consumers must never re-sort them.

export type OrgScorecardRow = {
  org_id: string
  email_domain: string
  live_devices: number
  crit_types: number
  high_types: number
  med_types: number
  low_types: number
  devices_crit_high: number
  devices_any: number
  // Entity split of crit_types (migration 20260915000000). Optional so a UI deployed ahead of
  // the migration still type-checks and renders the aggregated sentence for those rows.
  agent_crit_types?: number
  mcp_crit_types?: number
}

export type OrgScorecardStatus = "attention" | "watch" | "ok" | "notReporting"

export const ORG_STATUS_LABELS: Record<OrgScorecardStatus, string> = {
  attention: "Needs attention",
  watch: "Watch",
  ok: "OK",
  notReporting: "No devices",
}

// Status boundaries are exactly the ranking formula's tiers (see the RPC's
// migration header): scored severities present → attention; unscored
// severities only → watch. A watch row can therefore never outrank an
// attention row — badge/order inversions are impossible by construction.
export function orgScorecardStatus(row: OrgScorecardRow): OrgScorecardStatus {
  if (row.crit_types + row.high_types > 0) return "attention"
  if (row.med_types + row.low_types > 0) return "watch"
  if (row.live_devices > 0) return "ok"
  return "notReporting"
}

// "5 critical, 8 high — on 41 of 64 devices" / "4 medium — on 3 of 18 devices"
// / "no open issues" / "" (no devices). The device clause counts devices
// with a critical/high issue for attention rows, any open issue for watch rows.
export function orgScorecardSentence(row: OrgScorecardRow): string {
  const status = orgScorecardStatus(row)
  if (status === "notReporting") return ""
  if (status === "ok") return "no open issues"
  const parts: string[] = []
  if (row.crit_types > 0) parts.push(`${row.crit_types} critical`)
  if (row.high_types > 0) parts.push(`${row.high_types} high`)
  if (status === "watch") {
    if (row.med_types > 0) parts.push(`${row.med_types} medium`)
    if (row.low_types > 0) parts.push(`${row.low_types} low`)
  }
  const affected = status === "attention" ? row.devices_crit_high : row.devices_any
  const devWord = row.live_devices === 1 ? "device" : "devices"
  return `${parts.join(", ")} — on ${affected} of ${row.live_devices} ${devWord}`
}

// The dashboard renders the leading "N critical" in the risk color; the PDF
// uses the plain sentence. Split here so both stay one string apart.
export function orgScorecardSentenceParts(row: OrgScorecardRow): {
  critical: string
  rest: string
} {
  const sentence = orgScorecardSentence(row)
  if (row.crit_types > 0 && orgScorecardStatus(row) === "attention") {
    const critical = `${row.crit_types} critical`
    return { critical, rest: sentence.slice(critical.length) }
  }
  return { critical: "", rest: sentence }
}
