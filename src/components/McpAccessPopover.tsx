import { useState, type ReactNode } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { AccessLine, McpAccessLines } from "@/components/McpAccessLines"
import type { MergedAccessLine } from "@/lib/mcpAccessLines"
import { useMcpAccessGroupStatus } from "@/hooks/use-mcp-access"
import { connectorsBackState } from "@/lib/appUtils"

// ---------------------------------------------------------------------------
// User Access badge + click popover on the Connectors page: who can use this
// connector, and why. Governed connectors fetch one line per reason from the
// resolver when the popover opens (so the table never pays for rows nobody
// expands); connectors no policy reaches show one fixed line. Reasons link to
// where they're owned (a policy, or this connector's History), and every link
// carries source_mcps so the destination offers a way back here.
// ---------------------------------------------------------------------------

interface McpAccessPopoverProps {
  /** The User Access badge (the trigger). */
  badge: ReactNode
  mcpName: string
  /** Fetch the per-group lines for this connector when opened. */
  mcpType?: number
  /** Or show one fixed line, for connectors no policy reaches. */
  fixedLine?: Pick<MergedAccessLine, "verdict" | "who" | "reason">
  /** Group id → display name with its IdP. */
  groupLabels?: Map<string, string>
  /** Scoped to devices: only their scopes' lines (null = not in any group),
   * under a one-line rule saying how they combine (none when it doesn't apply). */
  deviceScope?: { scopeGroupIds: (string | null)[]; ungovernedCount: number; header?: string }
  /** People using this connector who are blocked today and an allow here can
   * unblock (an admin's block isn't lifted here, so its people aren't counted). */
  blockedPeople?: number
  /** Footer action when people using it are blocked: opens the allow dialog. */
  onAllowAccess?: () => void
  /** Footer link otherwise, e.g. to turn on access control. */
  footerLink?: { label: string; path: string }
}

export function McpAccessPopover({
  badge,
  mcpName,
  mcpType,
  fixedLine,
  groupLabels,
  deviceScope,
  blockedPeople = 0,
  onAllowAccess,
  footerLink,
}: McpAccessPopoverProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const { rows: allRows, error } = useMcpAccessGroupStatus(open && mcpType != null && !fixedLine ? mcpType : null)
  // Under a device scope, only the devices' own scopes: the server already
  // combined them into the badge; these rows only say which ones decided it.
  const scopes = deviceScope ? new Set(deviceScope.scopeGroupIds) : null
  const rows = scopes && allRows ? allRows.filter((r) => scopes.has(r.group_id)) : allRows

  const go = (path: string) =>
    navigate(`${path}${path.includes("?") ? "&" : "?"}source_mcps=true`, {
      state: connectorsBackState(location),
    })
  const goTo = (line: MergedAccessLine) => {
    if (!line.target) return
    go(
      line.target.kind === "policy"
        ? `/policies/${line.target.policyId}/access`
        : `/mcp-access?tab=history&mcpType=${mcpType}`,
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex rounded-sm hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={(e) => e.stopPropagation()}
        >
          {badge}
        </button>
      </PopoverTrigger>
      {/* align="end": the badge is in the table's last column, so the popover
          opens leftward under it instead of being pushed against the window edge. */}
      <PopoverContent align="end" className="w-80 p-0" onClick={(e) => e.stopPropagation()}>
        <div className="border-b px-4 py-2.5 text-sm">
          <div className="break-words font-medium">{mcpName}</div>
          {deviceScope?.header && !fixedLine && <div className="text-xs text-muted-foreground">{deviceScope.header}</div>}
        </div>
        <div className="px-2.5 py-2">
          {fixedLine ? (
            <div className="px-1.5 py-1">
              <AccessLine line={fixedLine} />
            </div>
          ) : (
            <McpAccessLines
              rows={rows}
              error={error}
              groupLabels={groupLabels}
              deviceScope={deviceScope}
              onLineClick={goTo}
            />
          )}
        </div>
        {blockedPeople > 0 && onAllowAccess ? (
          <div className="flex items-center justify-between gap-3 border-t px-4 py-2.5 text-sm">
            <span className="text-muted-foreground">
              {blockedPeople} {blockedPeople === 1 ? "user uses this but is" : "users use this but are"} blocked
            </span>
            <button
              type="button"
              className="shrink-0 font-medium text-primary hover:underline"
              onClick={() => {
                setOpen(false)
                onAllowAccess()
              }}
            >
              Allow
            </button>
          </div>
        ) : (
          footerLink && (
            <button
              type="button"
              className="flex w-full items-center border-t px-4 py-2.5 text-sm text-primary hover:bg-muted/50"
              onClick={() => go(footerLink.path)}
            >
              {footerLink.label}
            </button>
          )
        )}
      </PopoverContent>
    </Popover>
  )
}
