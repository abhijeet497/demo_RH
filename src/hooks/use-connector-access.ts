import { useMemo, useState } from "react"
import { useMcpAccessStatusMap, useOrgUserGroups, type McpAccessStatusInfo } from "@/hooks/use-mcp-access"
import { useAccessPolicies } from "@/hooks/use-access-policies"
import { useAccessUsage, useBlockedNow } from "@/hooks/use-access-usage"
import { groupSize, peopleIn, type AccessLine } from "@/lib/accessUsage"
import type { McpAccessCoverageDto } from "@/integrations/traceforce/types"

// The User Access column, its popovers and the "Allow" dialog for a
// connectors table (Connectors page, DeviceDetail): access status, policies,
// group names, who uses what and who of them is blocked, and the allow
// dialog's state. With deviceIds, all of it is scoped to those devices.

/** A connectors table scoped to devices (a device filter, DeviceDetail). */
export interface AccessDeviceScope {
  deviceIds: string[]
  /** The rollup's coverage of those devices; null until loaded. */
  coverage: McpAccessCoverageDto | null
}

const NO_ACCESS_STATUS = new Map<number, McpAccessStatusInfo>()

export function useConnectorAccess(enabled: boolean, deviceIds?: string[]) {
  // Keyed on the ids: a caller's fresh [id] mustn't recompute the scope.
  const deviceKey = deviceIds?.join(",") ?? ""
  const scopedIds = useMemo(() => (deviceKey ? deviceKey.split(",") : undefined), [deviceKey])

  const status = useMcpAccessStatusMap(enabled, scopedIds)
  // Active access policies: the Connector Access card, and whether everyone is
  // covered (the User Access column's "Varies by group" rule).
  const policies = useAccessPolicies(enabled)
  // Group names with their IdP, for the popovers and the allow dialog, and
  // their sizes for the dialog.
  const orgGroups = useOrgUserGroups(enabled)
  const groupLabels = useMemo(() => new Map(orgGroups.data.map((g) => [g.id, g.name])), [orgGroups.data])
  const groupSizes = useMemo(() => new Map(orgGroups.data.map((g) => [g.id, groupSize(g)])), [orgGroups.data])
  // Allowing groups: who uses each connector and who of them is blocked today.
  // Loads in the background; until it settles (or if it fails) the actions
  // stay hidden.
  const usage = useAccessUsage(enabled, scopedIds)
  const blockedNow = useBlockedNow(
    enabled && !usage.loading && !usage.error && !status.loading,
    usage.usage,
    status.data,
  )
  const blockedPeopleByType = useMemo(() => {
    const byType = new Map<number, AccessLine[]>()
    for (const line of blockedNow.lines) byType.set(line.type, [...(byType.get(line.type) ?? []), line])
    return new Map([...byType].map(([t, lines]) => [t, peopleIn(lines)]))
  }, [blockedNow])

  const deviceScope = useMemo<AccessDeviceScope | undefined>(
    () => (scopedIds ? { deviceIds: scopedIds, coverage: status.coverage } : undefined),
    [scopedIds, status.coverage],
  )

  // The connectors the open dialog covers (one from a popover, the list's from
  // the toolbar). Kept apart from `open` so the close animation doesn't flash
  // an empty list.
  const [allowTypes, setAllowTypes] = useState<number[]>([])
  const [allowOpen, setAllowOpen] = useState(false)
  const allowBlocked = useMemo(() => {
    const types = new Set(allowTypes)
    return {
      lines: blockedNow.lines.filter((l) => types.has(l.type)),
      devices: blockedNow.devices.filter((d) => types.has(d.type)),
    }
  }, [allowTypes, blockedNow])

  return {
    status,
    policies,
    deviceScope,
    /** Props for McpsTable's User Access column. */
    tableProps: {
      // Without the policies, "Varies by group" can't be told from Blocked:
      // an empty map with the error makes the column show "—" (fail closed).
      accessStatusByType: enabled ? (policies.error ? NO_ACCESS_STATUS : status.data) : undefined,
      accessStatusLoading: enabled ? status.loading || policies.loading : false,
      accessStatusError: enabled ? status.error ?? (policies.error ? "Couldn't load access policies" : null) : null,
      everyoneCovered: policies.everyoneCovered,
      groupLabels,
      // Only while access control is off: a device no policy covers in an org
      // that has policies gets no link, as on the inventory.
      turnOnAccessPath:
        policies.policies.length > 0
          ? undefined
          : policies.defaultPolicyId
            ? `/policies/${policies.defaultPolicyId}/access`
            : "/policies",
      blockedPeopleByType: enabled ? blockedPeopleByType : undefined,
      onAllowAccess: enabled
        ? (types: number[]) => {
            setAllowTypes(types)
            setAllowOpen(true)
          }
        : undefined,
      accessDeviceScope: deviceScope,
    },
    /** Props for AllowAccessDialog, all but connectorName. */
    allowDialogProps: {
      open: allowOpen,
      onOpenChange: setAllowOpen,
      types: allowTypes,
      blocked: allowBlocked,
      groupLabel: (groupId: string) => groupLabels.get(groupId) ?? "Unknown group",
      groupSize: (groupId: string) => groupSizes.get(groupId),
      // An allow changes access (and may close requests): refresh the
      // column, which re-reads who is blocked.
      onSaved: () => status.refetch(),
    },
  }
}
