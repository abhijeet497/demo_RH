import { useEffect, useState } from "react"

import { supabase } from "@/integrations/supabase/client"
import { useOrg } from "@/contexts/OrgContext"
import { useFeatureFlag } from "@/hooks/use-feature-flag"
import { normalizeConfig, isAgentBlocked, type AppBlockConfig } from "@/lib/appBlockPolicy"

// AI App Access status for an agent, resolved from the org's AI Access policies:
//   "blocked"  — an ACTIVE, enabled, ORG-WIDE (all users) policy blocks it: blocked
//                for everyone.
//   "partial"  — only a GROUP-SCOPED (specific user groups) policy blocks it: blocked
//                for some users/devices, not org-wide. An Agents row aggregates many
//                users, so this must not read as a flat "Blocked".
//   "allowed"  — no active policy blocks it.
export type AiAccessStatus = "blocked" | "partial" | "allowed"

// useAiAccessBlockConfig loads the org's ACTIVE, enabled AI Access policies
// (category 5) and exposes status(agentType, origin). Only active policies count, so
// the "AI App Access" column reflects what is actually enforced on devices (an
// inactive/disabled policy blocks nothing). Reads policies.ai_access_config +
// employee_assignment_type directly (org-scoped by RLS).
//
// loading/error are surfaced so callers do NOT render missing data as "Allowed":
// until the query succeeds the status is unknown, and on failure it is unavailable —
// never silently permissive.
// `enabled` lets a caller skip the query entirely — AgentsTable is reused (e.g. on
// DeviceDetail) WITHOUT the AI App Access column, and must not fire an org-wide policy
// read it won't use. When disabled the hook stays idle (not loading, allowed).
// `enforced` reports whether the org's `enable_agent_blocking` feature flag is on.
// The policy selection only actually blocks on devices when the flag is on (it
// defaults OFF per org); with it off, the UI must not claim "Blocked" — scout
// enforces nothing. Callers render a distinct "Not enforced" state from this.
export function useAiAccessBlockConfig(enabled = true): {
  status: (agentType: number | string, origin: string | null | undefined) => AiAccessStatus
  loading: boolean
  error: boolean
  enforced: boolean
} {
  const { activeOrgId } = useOrg()
  const { enabled: agentBlockingOn, isLoading: flagLoading, error: flagError } = useFeatureFlag("enable_agent_blocking")
  const [orgWide, setOrgWide] = useState<AppBlockConfig[]>([])
  const [groupScoped, setGroupScoped] = useState<AppBlockConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!enabled) {
      // Column hidden: reset to an idle, non-loading, allow-all state and skip the query.
      setOrgWide([])
      setGroupScoped([])
      setError(false)
      setLoading(false)
      return
    }
    if (!activeOrgId) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(false)
      const { data, error: queryError } = await supabase
        .from("policies")
        .select("ai_access_config, employee_assignment_type, policy_user_groups(user_groups!inner(deleted_at))")
        .eq("org_id", activeOrgId)
        .eq("category", 5)
        .eq("policy_status", 1)
      if (cancelled) return
      if (queryError) {
        setError(true)
        setLoading(false)
        return
      }
      const rows = (data ?? [])
        .map((r) => ({
          cfg: normalizeConfig(r.ai_access_config),
          scope: r.employee_assignment_type,
          // Live groups only — tombstoned (deleted_at set) attachments are kept for
          // reconnect revival but govern no one; PolicyDetail shows such a policy as
          // "Not Assigned". Same filter Policies.tsx uses for user_group_count.
          liveGroups: ((r.policy_user_groups ?? []) as any[]).filter((l) => l.user_groups?.deleted_at === null).length,
        }))
        .filter((x) => x.cfg.enabled)
      // employee_assignment_type: 1 = all users (org-wide), 2 = specific groups.
      setOrgWide(rows.filter((x) => x.scope === 1).map((x) => x.cfg))
      // A scope-2 policy with no LIVE group applies to nobody, so it must NOT read as
      // "Some groups" — only include it when it still has at least one live group.
      setGroupScoped(rows.filter((x) => x.scope === 2 && x.liveGroups > 0).map((x) => x.cfg))
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [activeOrgId, enabled])

  const status = (agentType: number | string, origin: string | null | undefined): AiAccessStatus => {
    if (orgWide.some((c) => isAgentBlocked(c, agentType, origin))) return "blocked"
    if (groupScoped.some((c) => isAgentBlocked(c, agentType, origin))) return "partial"
    return "allowed"
  }

  // Fold the flag's load/error into `loading`/`error` only when the column is shown.
  // loading -> the badge shows a neutral placeholder (never a premature status) until the
  // flag resolves. error -> a FAILED flag read must not read as "flag off / Not enforced"
  // (devices may still be enforcing); the caller renders "Unavailable" from `error`.
  // When disabled, the hook stays idle.
  return {
    status,
    loading: loading || (enabled && flagLoading),
    error: error || (enabled && flagError),
    enforced: agentBlockingOn,
  }
}
