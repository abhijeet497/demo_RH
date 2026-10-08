import type { McpTool } from "@/hooks/use-mcp-tools"
import { TOOL_PERMISSION_TYPE } from "@/lib/appUtils"

/**
 * Parse scout.MCPToolsResult (or a tools array) from mcp_server_instances.tools JSONB.
 * Tolerates camelCase / snake_case and StringResult wrappers ({ value }).
 */
function stringResultValue(field: unknown): string | null {
  if (field == null) return null
  if (typeof field === "string") return field
  if (typeof field === "number" || typeof field === "boolean") return String(field)
  if (typeof field === "object" && field !== null && "value" in field) {
    const v = (field as { value?: unknown }).value
    return v == null || v === "" ? null : String(v)
  }
  return null
}

/** scout.ToolStatus: 1 = enabled. */
const TOOL_STATUS_ENABLED = 1
const TOOL_STATUS_UNKNOWN = 0

function parseToolStatus(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw
  const asString = typeof raw === "string" ? raw : stringResultValue(raw)
  if (asString == null || asString === "") return null
  const asNum = Number(asString)
  return Number.isNaN(asNum) ? null : asNum
}

function isKnownPermissionType(n: number): boolean {
  return Number.isInteger(n) && n >= TOOL_PERMISSION_TYPE.UNKNOWN && n <= TOOL_PERMISSION_TYPE.DELETE
}

function parsePermissionType(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw) && isKnownPermissionType(raw)) return raw
  const asString =
    typeof raw === "string" ? raw : stringResultValue(raw)
  if (asString == null || asString === "") return TOOL_PERMISSION_TYPE.UNKNOWN
  const asNum = Number(asString)
  if (!Number.isNaN(asNum) && isKnownPermissionType(asNum)) return asNum
  const upper = asString.toUpperCase()
  if (upper.includes("DELETE")) return TOOL_PERMISSION_TYPE.DELETE
  if (upper.includes("WRITE")) return TOOL_PERMISSION_TYPE.WRITE
  if (upper.includes("READ")) return TOOL_PERMISSION_TYPE.READ
  return TOOL_PERMISSION_TYPE.UNKNOWN
}

function toolListFromJson(toolsJson: unknown): unknown[] {
  if (!toolsJson) return []
  if (Array.isArray(toolsJson)) return toolsJson
  if (typeof toolsJson !== "object") return []

  const obj = toolsJson as Record<string, unknown>
  // scout.MCPToolsResult
  const direct = obj.tools ?? obj.Tools
  if (Array.isArray(direct)) return direct

  // Occasionally nested under tools_result
  const nested = obj.tools_result ?? obj.toolsResult
  if (nested && typeof nested === "object") {
    const nestedTools = (nested as Record<string, unknown>).tools
    if (Array.isArray(nestedTools)) return nestedTools
  }

  return []
}

export function parseMcpInstanceTools(
  toolsJson: unknown,
  options: { includeUnknownStatus?: boolean } = {},
): McpTool[] {
  return toolListFromJson(toolsJson)
    .map((raw) => {
      if (!raw || typeof raw !== "object") return null
      const t = raw as Record<string, unknown>
      const name =
        stringResultValue(t.name) ??
        (typeof t.name === "string" ? t.name : null)
      if (!name) return null

      // Only enabled tools are shown; rows without a status (older payloads)
    // are kept for backward compatibility. Browser connector actions may be
    // stored with UNKNOWN status, so instance-level callers can include those.
      const toolStatus = parseToolStatus(t.tool_status ?? t.toolStatus)
    if (
      toolStatus != null &&
      toolStatus !== TOOL_STATUS_ENABLED &&
      !(options.includeUnknownStatus && toolStatus === TOOL_STATUS_UNKNOWN)
    ) return null

      const description =
        stringResultValue(t.description) ??
        (typeof t.description === "string" ? t.description : null)

      const permissionType = parsePermissionType(
        t.permission_type ?? t.permissionType ?? t.action_type ?? t.actionType,
      )

      // Name is unique within an instance tool list (and across collectToolsFromInstances).
      return {
        id: name,
        name,
        description,
        permission_type: permissionType,
      } satisfies McpTool
    })
    .filter((t): t is McpTool => t != null)
}

/** Deduplicate tools across MCP instances by name (first wins). */
export function collectToolsFromInstances(
  instances: { tools?: unknown }[],
): McpTool[] {
  const byName = new Map<string, McpTool>()
  for (const instance of instances) {
    for (const tool of parseMcpInstanceTools(instance.tools)) {
      if (!byName.has(tool.name)) byName.set(tool.name, tool)
    }
  }
  return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name))
}
