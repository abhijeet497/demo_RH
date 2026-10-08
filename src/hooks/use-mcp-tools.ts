import { useEffect, useState } from "react"
import { supabase } from "@/integrations/supabase/client"
import { friendlyLoadError } from "@/lib/api-errors"

// Must stay ≤ PostgREST max-rows; page.length < TOOLS_PAGE_SIZE is the only
// termination signal, so a larger constant would silently truncate the list.
const TOOLS_PAGE_SIZE = 1000

// ---------------------------------------------------------------------------
// Tools an MCP server exposes, from the mcp_catalog_tools table (keyed by
// mcp_server_type). Used by the MCP Registry detail view.
// ---------------------------------------------------------------------------

export interface McpTool {
  id: string
  name: string
  description: string | null
  /** scout.ToolPermissionType: 0=UNKNOWN, 1=READ, 2=WRITE, 3=DELETE */
  permission_type: number
}

export interface McpToolsState {
  tools: McpTool[]
  loading: boolean
  error: string | null
}

export function useMcpTools(mcpServerType: number | null): McpToolsState {
  const [tools, setTools] = useState<McpTool[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // No MCP selected: clear any prior rows and don't sit in a loading state.
    if (mcpServerType == null) {
      setTools([])
      setError(null)
      setLoading(false)
      return
    }
    let active = true
    ;(async () => {
      setLoading(true)
      setError(null)
      const rows: McpTool[] = []
      let from = 0

      while (true) {
        const { data, error } = await supabase
          .from("mcp_catalog_tools")
          .select("id, name, description, permission_type")
          .eq("mcp_server_type", mcpServerType)
          .order("name", { ascending: true })
          .order("id", { ascending: true })
          .range(from, from + TOOLS_PAGE_SIZE - 1)
        if (error) throw new Error(error.message)

        const page = (data ?? []) as McpTool[]
        rows.push(...page)

        if (page.length < TOOLS_PAGE_SIZE) break
        from += TOOLS_PAGE_SIZE
      }

      if (!active) return
      setTools(rows)
    })()
      .catch((e: any) => {
        if (active) setError(friendlyLoadError(e?.message ?? "Failed to load tools"))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [mcpServerType])

  return { tools, loading, error }
}
