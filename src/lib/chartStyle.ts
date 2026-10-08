// Per-chart donut ⇄ bar preference, persisted in localStorage. Ids name the
// chart *concept*, not its location — the same id is shared by the Dashboard
// card, the per-page card, and the PDF report section that show the same
// distribution, so one toggle keeps every surface in sync. Kept react-free so
// the PDF stack (dashboardReport.ts) can read preferences at generation time.

export type ChartStyle = "donut" | "bar"

export type ChartStyleId =
  | "agent-deployment" // AI Agents — Deployment Types (Dashboard, Agents, report)
  | "agent-risk" // AI Agents — Risk Breakdown (Dashboard, Agents, report)
  | "mcp-categories" // MCP Servers — Categories (Dashboard, Mcps, report)
  | "mcp-risk" // MCP Servers — Risk Breakdown (Dashboard, Mcps, report)
  | "agent-top-rules" // Agent Issues — Top Risk Rules (Dashboard, report)
  | "mcp-top-rules" // MCP Issues — Top Risk Rules (Dashboard, report)
  | "llm-publisher" // LLM Models — Publisher distribution (LLM Models inventory)

const storageKey = (id: ChartStyleId) => `chart-style:${id}`

export const getChartStyle = (id: ChartStyleId): ChartStyle => {
  try {
    return localStorage.getItem(storageKey(id)) === "bar" ? "bar" : "donut"
  } catch {
    return "donut"
  }
}

export const setChartStyle = (id: ChartStyleId, style: ChartStyle) => {
  try {
    localStorage.setItem(storageKey(id), style)
  } catch {
    // Storage unavailable (private mode) — the toggle still works for the session.
  }
}
