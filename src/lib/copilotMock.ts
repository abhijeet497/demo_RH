// Mock-only data source for the Microsoft Copilot integration. ALL values are
// fake, but every field and value shape matches a real Graph Copilot Studio
// agent (catalog/packages/{id}). Swap these functions for real API calls later.
import type { CopilotAgentDetail, CopilotAgentSummary, CopilotConnection, CopilotTool } from "./copilotTypes"

const DELAY = 300
const wait = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), DELAY))
const ago = (ms: number) => new Date(Date.now() - ms).toISOString()
const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR
// Graph sends usage dates as midnight UTC.
const usedAgo = (ms: number) => `${ago(ms).slice(0, 10)}T00:00:00Z`

const T1 = "11111111-1111-4111-8111-111111111111"
const T2 = "22222222-2222-4222-8222-222222222222"
const T3 = "33333333-3333-4333-8333-333333333333"
const T4 = "44444444-4444-4444-8444-444444444444"
const OWNER_1 = "00000000-0000-4000-8000-000000000001"
const OWNER_2 = "00000000-0000-4000-8000-000000000002"

const C1 = "c0000000-0000-4000-8000-000000000001"
const C2 = "c0000000-0000-4000-8000-000000000002"
const C3 = "c0000000-0000-4000-8000-000000000003"
const C4 = "c0000000-0000-4000-8000-000000000004"

function buildConnections(): CopilotConnection[] {
  return [
    { id: C1, tenant_id: T1, ui_state: "connected", error: null, agent_count: 3,
      last_synced_at: ago(20 * MIN), last_reported_at: ago(20 * MIN), created_at: ago(30 * DAY) },
    { id: C2, tenant_id: T2, ui_state: "attention_customer",
      error: { reason: "licence_required", message: "Graph denied the Copilot catalog (HTTP 403)" },
      agent_count: 0, last_synced_at: null, last_reported_at: ago(40 * MIN), created_at: ago(10 * DAY) },
    { id: C3, tenant_id: T3, ui_state: "stale", error: null, agent_count: 2,
      last_synced_at: ago(3 * HOUR), last_reported_at: ago(3 * HOUR), created_at: ago(5 * DAY) },
  ]
}

// Real tools: name includes the connector, connection_name is "Connector - Action",
// auth is Invoker, tool_type is api_action, approval_mode is "never" or absent.
const tool = (connector: string, action: string, permission: CopilotTool["permission"],
  description: string | null, approval_mode: string | null = "never"): CopilotTool => ({
  name: `${connector} ${action}`, connection_name: `${connector} - ${action}`, description,
  approval_mode, auth_type: "Invoker", tool_type: "api_action", permission,
})

const POST_MESSAGE = tool("Microsoft Teams", "Post message in a chat or channel", "write", "Posts a message to a chat or a channel")
const GET_EMAILS = tool("Office 365 Outlook", "Get emails (V3)", "read", "This operation gets emails from a folder via graph apis.")
const GET_PROFILE = tool("Office 365 Users", "Get my profile (V2)", "read", "Retrieves the profile of the current user.")

function detail(d: Omit<CopilotAgentDetail, "tool_count" | "write_tool_count" | "active_users" | "last_used_date">): CopilotAgentDetail {
  return {
    ...d,
    active_users: d.usage.active_users,
    last_used_date: d.usage.last_used_date,
    tool_count: d.tools.length,
    write_tool_count: d.tools.filter((t) => t.permission === "write" || t.permission === "delete").length,
  }
}

const base = {
  platform: "Copilot Studio", is_blocked: false, description: null, instructions: null,
  available_to: "allowedForAll", deployed_to: "acquiredForNone", owner_id: OWNER_1, last_published_by: OWNER_1,
  channels: ["webchat", "directline", "MsTeams", "Microsoft365Copilot"], llm_models: ["GPT55Chat"],
  auth_types: ["Integrated"], agent_location: "india", tools: [],
}

function buildAgents(): CopilotAgentDetail[] {
  return [
    detail({
      ...base, id: "a1", connection_id: C1, tenant_id: T1, name: "Contoso Sales Alerts",
      published_status: "Published",
      description: "Finds urgent customer emails and can notify the sales channel in Teams.",
      instructions: "Search the inbox for urgent customer emails.\nOnly post to Teams when the user explicitly asks.\nAlways state which tool you used.",
      tools: [POST_MESSAGE, GET_EMAILS, GET_PROFILE],
      usage: { active_users: 14, total_sessions: 120, last_used_date: usedAgo(DAY), exception_rate: 0, total_run_time_hours: 1.4 },
      last_published_at: ago(6 * DAY), created_at: ago(40 * DAY), modified_at: ago(6 * DAY),
    }),
    detail({
      ...base, id: "a2", connection_id: C1, tenant_id: T1, name: "Contoso Meeting Notes",
      published_status: "Published", owner_id: OWNER_2, last_published_by: OWNER_2,
      channels: ["MsTeams", "Microsoft365Copilot"],
      description: "Summarises recent emails before meetings.",
      instructions: "Summarise the user's recent emails.\nNever send anything.",
      tools: [GET_EMAILS, tool("Office 365 Users", "Get my profile (V2)", "read", null, null)],
      usage: { active_users: 3, total_sessions: 18, last_used_date: usedAgo(2 * DAY), exception_rate: 0, total_run_time_hours: 0.2 },
      last_published_at: ago(3 * DAY), created_at: ago(20 * DAY), modified_at: ago(3 * DAY),
    }),
    detail({
      // Draft: no publish info, empty description, no channels yet.
      ...base, id: "a3", connection_id: C1, tenant_id: T1, name: "Contoso Policy Draft",
      published_status: "Draft", last_published_by: null, channels: [], description: "",
      usage: { active_users: 0, total_sessions: 0, last_used_date: null, exception_rate: 0, total_run_time_hours: 0 },
      last_published_at: null, created_at: ago(2 * DAY), modified_at: ago(2 * DAY),
    }),
    detail({
      ...base, id: "a4", connection_id: C3, tenant_id: T3, name: "Fabrikam IT Triage",
      published_status: "Published", is_blocked: true, channels: ["MsTeams"],
      description: "Reads IT request emails and posts a triage note to the IT channel.",
      tools: [GET_EMAILS, POST_MESSAGE],
      usage: { active_users: 0, total_sessions: 4, last_used_date: usedAgo(9 * DAY), exception_rate: 0, total_run_time_hours: 0.05 },
      last_published_at: ago(30 * DAY), created_at: ago(60 * DAY), modified_at: ago(30 * DAY),
    }),
    detail({
      ...base, id: "a5", connection_id: C3, tenant_id: T3, name: "Northwind Inbox Watch",
      published_status: "Published",
      description: "Flags high-priority emails in the inbox.",
      tools: [GET_EMAILS],
      usage: { active_users: 2, total_sessions: 7, last_used_date: usedAgo(4 * DAY), exception_rate: 0, total_run_time_hours: 0.08 },
      last_published_at: ago(10 * DAY), created_at: ago(15 * DAY), modified_at: ago(10 * DAY),
    }),
  ]
}

let connections = buildConnections()
let agents = buildAgents()
let pollsUntilNewTenant: number | null = null

const summary = ({ id, connection_id, tenant_id, name, platform, published_status, is_blocked,
  active_users, last_used_date, tool_count, write_tool_count }: CopilotAgentDetail): CopilotAgentSummary => ({
  id, connection_id, tenant_id, name, platform, published_status, is_blocked,
  active_users, last_used_date, tool_count, write_tool_count,
})

export function getCopilotConnections(): Promise<CopilotConnection[]> {
  if (pollsUntilNewTenant !== null) {
    pollsUntilNewTenant -= 1
    if (pollsUntilNewTenant <= 0 && !connections.some((c) => c.id === C4)) {
      pollsUntilNewTenant = null
      connections.push({ id: C4, tenant_id: T4, ui_state: "connected", error: null, agent_count: 1,
        last_synced_at: ago(0), last_reported_at: ago(0), created_at: ago(0) })
      agents.push(detail({ ...base, id: "a6", connection_id: C4, tenant_id: T4, name: "Sample Onboarding Guide",
        published_status: "Published", channels: ["MsTeams"],
        description: "Answers new-starter questions using their profile.",
        tools: [GET_PROFILE],
        usage: { active_users: 0, total_sessions: 0, last_used_date: null, exception_rate: 0, total_run_time_hours: 0 },
        last_published_at: ago(HOUR), created_at: ago(DAY), modified_at: ago(HOUR) }))
    }
  }
  const sorted = [...connections].sort((a, b) => a.created_at.localeCompare(b.created_at))
  return wait(sorted.map((c) => ({ ...c })))
}

export function disconnectCopilotConnection(id: string): Promise<void> {
  connections = connections.filter((c) => c.id !== id)
  agents = agents.filter((a) => a.connection_id !== id)
  return wait(undefined)
}

export const listCopilotAgents = (): Promise<CopilotAgentSummary[]> => wait(agents.map(summary))

export const getCopilotAgent = (id: string): Promise<CopilotAgentDetail | null> =>
  wait(agents.find((a) => a.id === id) ?? null)

/** Mock: the 4th tenant appears on the 2nd poll after this call. */
export function startWaitingForNewTenant(): void {
  if (!connections.some((c) => c.id === C4)) pollsUntilNewTenant = 2
}
