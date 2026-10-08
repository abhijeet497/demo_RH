import {
  AGENT_DEPLOYMENT_TYPE_MAP,
  AUTH_TYPE_CHART_COLORS,
  AUTH_TYPE_DISPLAY_ORDER,
  AUTH_TYPE_MAP,
  DEPLOYMENT_TYPE_CHART_COLORS,
  RISK_CHART_COLORS,
  getCategoryColor,
  getRiskLevel,
} from "./appUtils"

export type AgentChartRow = {
  base_score: number | null
  actual_score: number | null
  instance_count: number | null
  deployment_types: number[] | null
}

export type McpChartRow = {
  base_score: number | null
  actual_score: number | null
  instance_count: number | null
  category_id: string | null
  category_name: string | null
}

export type IssuesStats = {
  issuesCount: number
  affectedDevices: number
}

// Devices are counted by row id: several machines can share a serial.
export type AffectedDevice = { device_id: string; device_native_id: string }

export type IssueTypeRow = {
  risk_rule_id: string
  risk_rule_name: string
  incident_count: number | null
  applicable_to: number | null
  affected_devices: AffectedDevice[] | null
  trigger_score?: number | null
}

export type IssueBucket = {
  riskRuleId: string
  name: string
  incidentCount: number
}

export type ChartDatum = { name: string; value: number; color: string }

export const TOP_ISSUE_TYPES_COUNT = 8
export const APPLICABLE_TO_CONTROLLABLE = 1

export const filterControllable = (rows: IssueTypeRow[]) =>
  rows.filter((r) => r.applicable_to === APPLICABLE_TO_CONTROLLABLE)

export const buildIssuesStats = (rows: IssueTypeRow[]): IssuesStats => {
  const controllable = filterControllable(rows)
  const devices = new Set<string>()
  controllable.forEach((row) => {
    row.affected_devices?.forEach((d) => {
      if (d?.device_id) devices.add(d.device_id)
    })
  })
  return {
    issuesCount: controllable.length,
    affectedDevices: devices.size,
  }
}

export const buildIssueTypeDistribution = (
  rows: IssueTypeRow[],
  limit: number = TOP_ISSUE_TYPES_COUNT,
): IssueBucket[] => {
  const map = new Map<string, IssueBucket>()
  filterControllable(rows).forEach((row) => {
    const existing = map.get(row.risk_rule_id)
    const incidents = row.incident_count ?? 0
    if (existing) {
      existing.incidentCount += incidents
    } else {
      map.set(row.risk_rule_id, {
        riskRuleId: row.risk_rule_id,
        name: row.risk_rule_name,
        incidentCount: incidents,
      })
    }
  })
  return [...map.values()]
    .filter((b) => b.incidentCount > 0)
    .sort((a, b) => b.incidentCount - a.incidentCount)
    .slice(0, limit)
}

export const buildIssueTypeChartData = (buckets: IssueBucket[]): ChartDatum[] =>
  buckets.map((b, i) => ({
    name: b.name,
    value: b.incidentCount,
    color: getCategoryColor(i),
  }))

export const buildRiskDistribution = (
  rows: { base_score: number | null; actual_score: number | null }[],
): ChartDatum[] => {
  const counts = { low: 0, medium: 0, high: 0, critical: 0 }
  rows.forEach((r) => {
    const score = r.actual_score ?? r.base_score
    const level = getRiskLevel(score).toLowerCase()
    if (level in counts) counts[level as keyof typeof counts]++
  })
  return [
    { name: "Low", value: counts.low, color: RISK_CHART_COLORS.low },
    { name: "Medium", value: counts.medium, color: RISK_CHART_COLORS.medium },
    { name: "High", value: counts.high, color: RISK_CHART_COLORS.high },
    { name: "Critical", value: counts.critical, color: RISK_CHART_COLORS.critical },
  ].filter((d) => d.value > 0)
}

export const buildDeploymentDistribution = (rows: AgentChartRow[]): ChartDatum[] => {
  const counts: Record<number, number> = {}
  let agentsWithNoTypes = 0
  rows.forEach((a) => {
    if (!a.deployment_types?.length) {
      agentsWithNoTypes++
    } else {
      a.deployment_types.forEach((type: number) => {
        counts[type] = (counts[type] || 0) + 1
      })
    }
  })
  if (agentsWithNoTypes > 0) {
    counts[0] = (counts[0] || 0) + agentsWithNoTypes
  }
  return Object.entries(counts)
    .filter(([, count]) => count > 0)
    .map(([type, count]) => ({
      name: AGENT_DEPLOYMENT_TYPE_MAP[Number(type)],
      value: count,
      color: DEPLOYMENT_TYPE_CHART_COLORS[Number(type)],
    }))
}

// Auth-type distribution over rolled-up MCP server rows. Each server counts once
// per detected method (Unknown/0 values inside a server's set are ignored);
// servers with nothing detected fall into the Unknown bucket. Fixed display
// order with Unknown gray and last — shared by the MCPs page, dashboard, and PDF.
export const buildAuthTypeDistribution = (
  rows: { auth_types?: number[] | null }[],
): ChartDatum[] => {
  const counts = new Map<number, number>()
  const known = new Set(AUTH_TYPE_DISPLAY_ORDER)
  rows.forEach((row) => {
    const detected = (row.auth_types ?? []).filter((t) => t !== 0)
    // Values outside the known enum (scout newer than this UI) fold into
    // Unknown — same fallback the table badges/CSV use — so a server never
    // silently vanishes from the chart.
    const buckets = new Set(detected.map((t) => (known.has(t) ? t : 0)))
    if (buckets.size === 0) buckets.add(0)
    buckets.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1))
  })
  return AUTH_TYPE_DISPLAY_ORDER.map((type) => ({
    name: AUTH_TYPE_MAP[type] ?? "Unknown",
    value: counts.get(type) ?? 0,
    color: AUTH_TYPE_CHART_COLORS[type],
  })).filter((d) => d.value > 0)
}

export const buildCategoryDistribution = (rows: McpChartRow[]): ChartDatum[] => {
  const counts: Record<string, { name: string; count: number }> = {}
  rows.forEach((m) => {
    const categoryId = m.category_id || "unknown"
    const categoryName = m.category_name || "Unknown"
    if (!counts[categoryId]) {
      counts[categoryId] = { name: categoryName, count: 0 }
    }
    counts[categoryId].count++
  })
  return Object.entries(counts)
    .filter(([, data]) => data.count > 0)
    .map(([, data], index) => ({
      name: data.name,
      value: data.count,
      color: getCategoryColor(index),
    }))
    .sort((a, b) => b.value - a.value)
}
