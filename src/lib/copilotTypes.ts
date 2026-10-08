export type CopilotUiState = "connected" | "attention_customer" | "attention_platform" | "stale"

export interface CopilotConnection {
  id: string
  tenant_id: string // lower-case GUID
  ui_state: CopilotUiState
  error: { reason: string; message: string } | null
  agent_count: number
  last_synced_at: string | null
  last_reported_at: string | null
  created_at: string
}

export interface CopilotAgentSummary {
  id: string
  connection_id: string
  tenant_id: string
  name: string
  platform: string | null
  published_status: string | null
  is_blocked: boolean
  active_users: number | null
  last_used_date: string | null // Graph sends midnight UTC, e.g. 2026-09-25T00:00:00Z
  tool_count: number
  write_tool_count: number
}

export interface CopilotTool {
  name: string
  description: string | null
  connection_name: string | null
  approval_mode: string | null
  auth_type: string | null
  tool_type: string | null
  permission: "read" | "write" | "delete" | "unknown"
}

export interface CopilotAgentDetail extends CopilotAgentSummary {
  description: string | null
  instructions: string | null
  last_published_at: string | null
  available_to: string | null // Graph code, e.g. allowedForAll
  deployed_to: string | null // Graph code, e.g. acquiredForNone
  owner_id: string | null
  last_published_by: string | null // missing on Draft agents
  channels: string[]
  llm_models: string[]
  auth_types: string[] // AuthenticationSettings[].Type, e.g. Integrated
  agent_location: string | null
  tools: CopilotTool[]
  usage: {
    active_users: number | null
    total_sessions: number | null
    last_used_date: string | null
    exception_rate: number | null // scale not confirmed yet; shown as-is
    total_run_time_hours: number | null
  }
  created_at: string | null
  modified_at: string | null
}
