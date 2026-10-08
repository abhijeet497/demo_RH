import { useEffect, useState } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { useOrg } from "@/contexts/OrgContext"
import { supabase } from "@/integrations/supabase/client"
import { fetchAllRows } from "@/lib/supabasePaging"
import { blockedNow, fetchAccessByScope, type BlockedSet, type DeviceUse, type UsageByType } from "@/lib/accessUsage"

export interface AccessUsageState {
  /** Connector type → the devices using it, with owner and groups. */
  usage: UsageByType
  loading: boolean
  error: string | null
}

/** Who uses which connector, and in which groups: the input to the "Allow" dialog
 * on the Connectors page and the policy editor's keep step. Group membership
 * is user_group_resolved_devices (manual groups plus IdP groups, deleted
 * groups excluded), the same rule devices enforce with. People are device
 * owners; a device with no owner counts as one person. Reads groups only for
 * devices in use; `deviceIds` narrows it to those devices (a device filter). */
export function useAccessUsage(enabled: boolean, deviceIds?: string[]): AccessUsageState {
  const { activeOrgId } = useOrg()
  const [state, setState] = useState<AccessUsageState>({
    usage: new Map(),
    loading: enabled,
    error: null,
  })
  // Keyed on the ids, not the array, so a caller's fresh [id] doesn't refetch.
  const deviceKey = deviceIds?.join(",") ?? ""

  useEffect(() => {
    if (!enabled || !activeOrgId) return
    let cancelled = false
    setState((s) => ({ ...s, loading: true, error: null }))
    ;(async () => {
      try {
        // Paged: PostgREST caps unpaged reads at 1000 rows; ORDER keeps the
        // offset pages from skipping rows.
        const usageRows = await fetchAllRows<{ device_id: string; mcp_server_type: number; owner_email: string | null }>(
          (from, to) => {
            let q = supabase
              .from("active_mcp_devices")
              .select("device_id, mcp_server_type, owner_email")
              .eq("org_id", activeOrgId)
            if (deviceKey) q = q.in("device_id", deviceKey.split(","))
            return q.order("device_id").order("mcp_server_type").range(from, to)
          },
        )
        // Groups for the devices in use only, in URL-sized chunks run in parallel.
        const deviceIds = [...new Set(usageRows.map((r) => r.device_id).filter((id) => id != null))]
        const chunks: string[][] = []
        for (let i = 0; i < deviceIds.length; i += 100) chunks.push(deviceIds.slice(i, i + 100))
        const groupRows = (
          await Promise.all(
            chunks.map((ids) =>
              fetchAllRows<{ user_group_id: string; device_id: string }>((from, to) =>
                supabase
                  .from("user_group_resolved_devices")
                  .select("user_group_id, device_id")
                  .eq("org_id", activeOrgId)
                  .in("device_id", ids)
                  .order("user_group_id")
                  .order("device_id")
                  .range(from, to),
              ),
            ),
          )
        ).flat()

        const groupsByDevice = new Map<string, string[]>()
        for (const r of groupRows) {
          const g = groupsByDevice.get(r.device_id)
          if (g) g.push(r.user_group_id)
          else groupsByDevice.set(r.device_id, [r.user_group_id])
        }
        const usage: UsageByType = new Map()
        for (const r of usageRows) {
          if (r.device_id == null || r.mcp_server_type == null) continue
          const groups = groupsByDevice.get(r.device_id) ?? []
          const use: DeviceUse = {
            person: r.owner_email ? r.owner_email.toLowerCase() : `device:${r.device_id}`,
            scopes: groups.length > 0 ? groups : [null],
          }
          const list = usage.get(r.mcp_server_type)
          if (list) list.push(use)
          else usage.set(r.mcp_server_type, [use])
        }
        if (!cancelled) setState({ usage, loading: false, error: null })
      } catch (e) {
        if (!cancelled) {
          setState((s) => ({
            ...s,
            loading: false,
            error: e instanceof Error ? e.message : "Couldn't load connector usage",
          }))
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled, activeOrgId, deviceKey])

  return state
}

const NO_BLOCKED: BlockedSet = { lines: [], devices: [] }

/** People using a connector who are blocked today (Connectors page): the lines
 * the "Allow" dialog offers. Reads current per-group access only for connectors
 * in use whose status shows someone blocked. Empty while loading or on error
 * (the actions stay hidden rather than guess). A result counts only for the
 * usage and status it was read from: once a refetch brings new status (after
 * an allow), the old set is dropped until the new one is read. */
export function useBlockedNow(
  enabled: boolean,
  usage: UsageByType,
  statusByType: Map<number, { status: string }>,
): BlockedSet {
  const { session } = useAuth()
  const token = session?.access_token
  const [blocked, setBlocked] = useState<{
    usage: UsageByType
    status: Map<number, { status: string }>
    set: BlockedSet
  } | null>(null)

  useEffect(() => {
    if (!enabled || !token) return
    const settle = (set: BlockedSet) => setBlocked({ usage, status: statusByType, set })
    const types = [...usage.keys()].filter((t) => {
      const s = statusByType.get(t)?.status
      return s === "blocked" || s === "needs_review" || s === "varies"
    })
    if (types.length === 0) {
      settle(NO_BLOCKED)
      return
    }
    let cancelled = false
    fetchAccessByScope(token, types)
      .then((access) => {
        if (!cancelled) settle(blockedNow(usage, access))
      })
      .catch(() => {
        if (!cancelled) settle(NO_BLOCKED)
      })
    return () => {
      cancelled = true
    }
  }, [enabled, token, usage, statusByType])

  return blocked && blocked.usage === usage && blocked.status === statusByType ? blocked.set : NO_BLOCKED
}
