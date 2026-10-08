// Pure logic for the Microsoft Copilot integration UI.
import { formatDistanceToNow } from "date-fns"
import type { CopilotConnection, CopilotTool } from "./copilotTypes"

export const COPILOT_LOGO_URL = "/logos/m365_copilot.png"
export const COPILOT_SOURCE_LABEL = "Microsoft 365 Copilot"
export const COPILOT_ENVIRONMENT_VALUE = "m365_copilot"
export const COPILOT_ENVIRONMENT_OPTION = { value: COPILOT_ENVIRONMENT_VALUE, label: COPILOT_SOURCE_LABEL }
export const COPILOT_POLL_MS = 12_000
export const COPILOT_WAIT_LIMIT_MS = 15 * 60_000
export const copilotWaitExpired = (started: number, now = Date.now()) =>
  now - started >= COPILOT_WAIT_LIMIT_MS

const KNOWN_STATES = ["connected", "attention_customer", "attention_platform", "stale"]

/** Unknown ui_state values are treated as attention_platform. */
export const normalizeUiState = (s: string): CopilotConnection["ui_state"] =>
  (KNOWN_STATES.includes(s) ? s : "attention_platform") as CopilotConnection["ui_state"]

export const needsAttention = (c: Pick<CopilotConnection, "ui_state">) =>
  normalizeUiState(c.ui_state) !== "connected"

export function copilotTileSummary(connections: Pick<CopilotConnection, "ui_state">[]): string {
  if (connections.length === 0) return "Not connected"
  const n = connections.length
  const attention = connections.filter(needsAttention).length
  const connected = n - attention
  return `${n} ${n === 1 ? "tenant" : "tenants"} · ${connected} connected · ${attention} need attention`
}

export const STATE_LABELS: Record<CopilotConnection["ui_state"], string> = {
  connected: "Connected",
  attention_customer: "Action needed",
  attention_platform: "Issue on our side",
  stale: "No recent report",
}

export function copilotConnectionMessage(
  c: Pick<CopilotConnection, "ui_state" | "error">,
): string | null {
  const state = normalizeUiState(c.ui_state)
  if (state === "stale")
    return "No report from this tenant's collector in the last 2 hours. Check the Function app in your Azure portal."
  if (state === "attention_platform")
    return "Something went wrong on Traceforce's side. We've been alerted; the next hourly run will retry."
  if (state === "attention_customer") {
    const reason = c.error?.reason
    if (reason === "licence_required") return "An Agent 365 licence is required in this tenant."
    if (reason === "permission_missing")
      return "The collector is missing the CopilotPackages.Read.All permission. Re-run terraform apply as a Global Administrator."
    return c.error?.message ?? null
  }
  return null
}

/** The first connection whose id was not in the snapshot taken when waiting started. */
export const findNewTenant = <T extends { id: string }>(snapshotIds: string[], current: T[]): T | undefined =>
  current.find((c) => !snapshotIds.includes(c.id))

export const isRiskyTool = (t: Pick<CopilotTool, "permission" | "approval_mode">) =>
  (t.permission === "write" || t.permission === "delete") && t.approval_mode === "never"

export const formatRelative = (iso: string | null): string | null =>
  iso ? formatDistanceToNow(new Date(iso), { addSuffix: true }) : null

/**
 * Formats a Copilot date for display. Graph sends usage dates as midnight UTC
 * ("2026-09-25T00:00:00Z"), which would show as the previous day west of UTC,
 * so date-only and midnight-UTC values are read as local dates instead.
 */
export function formatCopilotDate(v: string | null): string | null {
  if (!v) return null
  const day = /^(\d{4}-\d{2}-\d{2})(T00:00:00(\.0+)?Z)?$/.exec(v)
  const date = day ? new Date(`${day[1]}T00:00:00`) : new Date(v)
  return date.toLocaleDateString()
}

// Readable labels for Graph codes; unknown codes are shown as-is.
const AVAILABLE_TO: Record<string, string> = {
  allowedForAll: "All users", allowedForSome: "Some users", allowedForNone: "No users",
}
const DEPLOYED_TO: Record<string, string> = {
  acquiredForAll: "Deployed to all users", acquiredForSome: "Deployed to some users", acquiredForNone: "Not deployed by admin",
}
const CHANNELS: Record<string, string> = {
  MsTeams: "Teams", Microsoft365Copilot: "Microsoft 365 Copilot", webchat: "Web chat", directline: "Direct Line",
}
export const availableToLabel = (v: string | null) => (v ? AVAILABLE_TO[v] ?? v : null)
export const deployedToLabel = (v: string | null) => (v ? DEPLOYED_TO[v] ?? v : null)
export const channelLabel = (v: string) => CHANNELS[v] ?? v
