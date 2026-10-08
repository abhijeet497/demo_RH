import { getRiskLevel } from "./appUtils"

// Risk rules whose issues sort to the BOTTOM of their risk band on the issue
// list pages, keyed by the stable scout.proto RiskRuleType enum (surfaced by
// the issue RPCs since 20260715000001). Presentation-only demotion: the server
// order (trigger_score DESC, display_order ASC) still decides everything else,
// and a demoted critical stays among the criticals — it never drops into a
// lower band. This exists because display_order can't demote across score
// ties within a band, and lowering trigger_score would change risk semantics,
// not just ordering.
export const DEMOTED_RISK_RULE_TYPES = new Set<number>([
  1001, // RISK_RULE_TYPE_MCP_PERMISSION_ENFORCEMENT
])

const RISK_BAND_RANK: Record<string, number> = {
  Critical: 4,
  High: 3,
  Medium: 2,
  Low: 1,
  Unknown: 0,
}

// Stable sort: compares only (band, demoted) so non-demoted rows never move
// relative to each other — input must already be in the desired base order.
// risk_rule_type is optional so rows from a not-yet-migrated backend degrade
// to a no-op demotion instead of breaking.
export const demoteWithinRiskBands = <
  T extends { trigger_score: number | null; risk_rule_type?: number | null },
>(
  rows: T[],
): T[] =>
  [...rows].sort((a, b) => {
    const bandDiff =
      (RISK_BAND_RANK[getRiskLevel(b.trigger_score)] ?? 0) -
      (RISK_BAND_RANK[getRiskLevel(a.trigger_score)] ?? 0)
    if (bandDiff !== 0) return bandDiff
    return (
      Number(a.risk_rule_type != null && DEMOTED_RISK_RULE_TYPES.has(a.risk_rule_type)) -
      Number(b.risk_rule_type != null && DEMOTED_RISK_RULE_TYPES.has(b.risk_rule_type))
    )
  })
