import type { ReactNode } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { ChevronDown } from "lucide-react"
import { MetricCard } from "@/components/charts/MetricCard"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { AccessPoliciesState } from "@/hooks/use-access-policies"
import type { AccessDeviceScope } from "@/hooks/use-connector-access"
import { connectorsBackState } from "@/lib/appUtils"

// "Connector Access" card on the Connectors page, laid out like "Connectors in
// Use": is access control on, and is anything waiting on the admin.
//   · On / Off → the active access policies (popover), or when off the default
//     access policy, where it is turned on
//   · pending request count ("—" if it couldn't load) → Connector Access
//     pending tab
// Under a device filter it is "Access on {device}" / "Access on N devices":
// the policies that apply there (popover), how many of the devices they cover,
// or that none does → Policies. No request counts there.
// Every link carries source_mcps so the destination offers a way back here.

interface ConnectorAccessCardProps {
  access: AccessPoliciesState
  /** Pending access requests across all connectors. */
  requestCount: number
  /** The request count (and under a device filter, the coverage) is still loading. */
  requestsLoading: boolean
  /** The request count failed to load: "—", not a confident 0. */
  requestsError: boolean
  /** Scoped to these devices (the device filter). */
  devices?: AccessDeviceScope
  /** With one device filtered, its display name. */
  deviceName?: string
}

export function ConnectorAccessCard({
  access,
  requestCount,
  requestsLoading,
  requestsError,
  devices,
  deviceName,
}: ConnectorAccessCardProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { policies, defaultPolicyId, loading, error } = access
  const go = (path: string) =>
    navigate(`${path}${path.includes("?") ? "&" : "?"}source_mcps=true`, {
      state: connectorsBackState(location),
    })

  // Under a device filter, only the policies governing those devices.
  const governing = devices?.coverage ? new Set(devices.coverage.policy_ids ?? []) : null
  const shown = governing ? policies.filter((p) => governing.has(p.id)) : policies
  const groupPolicies = shown.filter((p) => !p.orgWide).sort((a, b) => a.name.localeCompare(b.name))
  const orgWidePolicies = shown.filter((p) => p.orgWide).sort((a, b) => a.name.localeCompare(b.name))
  const groupCount = new Set(groupPolicies.flatMap((p) => p.groups.map((g) => g.id))).size
  const on = policies.length > 0
  const deviceCount = devices?.coverage?.device_count ?? devices?.deviceIds.length ?? 0
  const enforced = devices?.coverage?.enforced_device_count ?? 0
  const offPath = defaultPolicyId ? `/policies/${defaultPolicyId}/access` : "/policies"

  const stat = "text-4xl font-bold"
  const label = "text-sm text-muted-foreground"

  const policiesPopover = (trigger: ReactNode) => (
    <Popover>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="center" className="w-80 p-0">
        <div className="px-2 py-1.5">
          {[...groupPolicies, ...orgWidePolicies].map((p) => (
            <button
              key={p.id}
              type="button"
              className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/50"
              onClick={() => go(`/policies/${p.id}/access`)}
            >
              <div className="font-medium">{p.name}</div>
              <div className="text-xs text-muted-foreground">
                {p.orgWide
                  ? groupPolicies.length > 0
                    ? "All other users"
                    : "All users"
                  : p.groups.map((g) => g.label).join(", ")}
              </div>
            </button>
          ))}
        </div>
        <button
          type="button"
          className="flex w-full items-center border-t px-4 py-2.5 text-sm text-primary hover:bg-muted/50"
          onClick={() => go("/policies")}
        >
          Manage policies →
        </button>
      </PopoverContent>
    </Popover>
  )

  if (devices) {
    const line = "text-xl font-semibold"
    const covered = enforced > 0 && shown.length > 0
    return (
      <MetricCard
        title={deviceCount === 1 ? `Access on ${deviceName ?? "this device"}` : `Access on ${deviceCount} devices`}
        loading={loading || requestsLoading}
      >
        {error || !devices.coverage ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Couldn&apos;t load access</p>
        ) : (
          <div className="flex flex-col items-center py-6">
            {covered ? (
              policiesPopover(
                <button type="button" className={`${line} inline-flex items-center gap-1 hover:opacity-80`}>
                  {shown.length === 1 ? `${shown[0].name} applies` : `${shown.length} access policies apply`}
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </button>,
              )
            ) : (
              <button type="button" className={`${line} hover:opacity-80`} onClick={() => go(on ? "/policies" : offPath)}>
                No access policy covers {deviceCount === 1 ? "this device" : "these devices"}
              </button>
            )}
            {covered && enforced < deviceCount && (
              <p className={label}>
                {enforced} of {deviceCount} covered
              </p>
            )}
          </div>
        )}
      </MetricCard>
    )
  }

  const coverage = !on
    ? "Not enforced"
    : orgWidePolicies.length > 0
      ? "All users"
      : `${groupCount} ${groupCount === 1 ? "group" : "groups"}`

  return (
    <MetricCard title="Connector Access" loading={loading || requestsLoading}>
      {error ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Couldn&apos;t load access</p>
      ) : (
        <div className="flex items-center justify-center gap-8 py-2">
          <div className="flex flex-col items-center">
            {on ? (
              policiesPopover(
                <button type="button" className={`${stat} inline-flex items-center gap-1 hover:opacity-80`}>
                  On
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                </button>,
              )
            ) : (
              <button type="button" className={`${stat} hover:opacity-80`} onClick={() => go(offPath)}>
                Off
              </button>
            )}
            <p className={label}>{coverage}</p>
          </div>
          <div className="flex flex-col items-center">
            <button
              type="button"
              className={`${stat} hover:opacity-80`}
              onClick={() => go("/mcp-access?tab=pending")}
            >
              {requestsError ? "—" : requestCount}
            </button>
            <p className={label}>{!requestsError && requestCount === 1 ? "Request" : "Requests"}</p>
          </div>
        </div>
      )}
    </MetricCard>
  )
}
