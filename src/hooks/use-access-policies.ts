import { useEffect, useState } from "react"
import { useOrg } from "@/contexts/OrgContext"
import { supabase } from "@/integrations/supabase/client"
import { fetchAllRows } from "@/lib/supabasePaging"
import { DEFAULT_MCP_ACCESS_POLICY_NAME } from "@/lib/appUtils"
import { groupLabel } from "@/hooks/use-mcp-access"

/** An active access policy and who it covers (live groups only). */
export interface CoveringPolicy {
  id: string
  name: string
  orgWide: boolean
  groups: { id: string; label: string }[]
}

export interface AccessPoliciesState {
  /** Active access policies that cover someone. */
  policies: CoveringPolicy[]
  /** The seeded default access policy, active or not. */
  defaultPolicyId: string | null
  /** An active org-wide policy covers everyone; without one, users outside
   * the covered groups are not enforced (so they can use every connector). */
  everyoneCovered: boolean
  loading: boolean
  error: boolean
}

/** The org's active access policies (category 4) that cover someone, with
 * their live groups; the default policy's id; and whether everyone is
 * covered. For the Connectors page's card and its User Access column. */
export function useAccessPolicies(enabled: boolean): AccessPoliciesState {
  const { activeOrgId } = useOrg()
  const [policies, setPolicies] = useState<CoveringPolicy[]>([])
  const [defaultPolicyId, setDefaultPolicyId] = useState<string | null>(null)
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!enabled || !activeOrgId) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(false)
      try {
        const { data: rows, error: policiesErr } = await supabase
          .from("policies")
          .select("id, name, policy_status, employee_assignment_type")
          .eq("org_id", activeOrgId)
          .eq("category", 4)
        if (policiesErr) throw policiesErr
        const active = (rows ?? []).filter((p) => p.policy_status === 1)
        const groupScopedIds = active.filter((p) => p.employee_assignment_type === 2).map((p) => p.id)
        const links =
          groupScopedIds.length === 0
            ? []
            : await fetchAllRows<{
                policy_id: string
                user_groups: { id: string; name: string; user_group_source: number; deleted_at: string | null }
              }>((from, to) =>
                supabase
                  .from("policy_user_groups")
                  .select("policy_id, user_groups!inner(id, name, user_group_source, deleted_at)")
                  .in("policy_id", groupScopedIds)
                  .eq("org_id", activeOrgId)
                  .order("policy_id")
                  .order("user_group_id")
                  .range(from, to),
              )
        const covering: CoveringPolicy[] = active
          .map((p) => ({
            id: p.id,
            name: p.name,
            orgWide: p.employee_assignment_type !== 2,
            // Tombstoned (removed-in-IdP) groups cover no one, so they're left out.
            groups: links
              .filter((l) => l.policy_id === p.id && !l.user_groups.deleted_at)
              .map((l) => ({
                id: l.user_groups.id,
                label: groupLabel(l.user_groups.name, l.user_groups.user_group_source),
              }))
              .sort((a, b) => a.label.localeCompare(b.label)),
          }))
          // A group policy with no live groups enforces nothing.
          .filter((p) => p.orgWide || p.groups.length > 0)
        if (cancelled) return
        setPolicies(covering)
        setDefaultPolicyId((rows ?? []).find((p) => p.name === DEFAULT_MCP_ACCESS_POLICY_NAME)?.id ?? null)
      } catch {
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled, activeOrgId])

  return { policies, defaultPolicyId, everyoneCovered: policies.some((p) => p.orgWide), loading, error }
}
