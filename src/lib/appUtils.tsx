import { Badge, type BadgeVariant } from "@/components/ui/badge"
import { HelpCircle, Info, AlertTriangle, AlertCircle, XCircle } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import type { MdmIntegration, ContainmentOp, OtelDestination, OtelProtocol, McpSourceType } from "@/integrations/traceforce/types"

// ============================================================================
// PLAN UTILITIES
// ============================================================================

export const PLAN_MAP: Record<number, string> = {
  0: "Unspecified",
  1: "Personal",
  2: "Enterprise",
  3: "Small Business",
}

export const PLAN_VALUES = Object.keys(PLAN_MAP)

export const PLAN_OPTIONS = [
  { value: "all", label: "All Plans" },
  ...Object.entries(PLAN_MAP).map(([value, label]) => ({ value, label }))
]

export const isValidPlan = (value: string): boolean => 
  PLAN_VALUES.includes(value)

export const getPlan = (plan: number | null): string => {
  if (plan === null) return "Unknown"
  return PLAN_MAP[plan] || `Unknown`
}

const PLAN_VARIANT_MAP: Record<number, BadgeVariant> = {
  0: "secondary",    // Unspecified - grey
  1: "destructive",  // Personal - red
  2: "success",      // Enterprise - green
  3: "warning",      // Small Business - yellow
}

export const getPlanBadgeVariant = (plan: number | null): BadgeVariant => {
  if (plan === null) return "outline"
  return PLAN_VARIANT_MAP[plan] || "outline"
}

export const getPlanBadge = (plan: number | null) => {
  const planLabel = getPlan(plan)
  const variant = getPlanBadgeVariant(plan)
  
  return <Badge variant={variant}>{planLabel}</Badge>
}

/** Mirrors scout-proto AgentIdentity_AGENT_IDENTITY_GLEAN */
export const AGENT_TYPE_GLEAN = 50
/** AgentPlanType ENTERPRISE */
export const AGENT_PLAN_ENTERPRISE = 2

/**
 * Glean is enterprise-only, so it ALWAYS resolves to Enterprise regardless of the
 * stored plan (account-less installs are stored as UNSPECIFIED (0) because we do not
 * yet extract a Glean account). getEffectivePlan returns Glean's CANONICAL plan
 * (Enterprise), which is both:
 *   - what to DISPLAY (labels / badges / client-side filtering), and
 *   - where Glean's GLOBAL reference data lives (agent_baseline_scores / the risk
 *     framework shown in AgentRegistry) — so it is the correct p_plan for THAT RPC.
 * Do NOT use it for ORG-SPECIFIC data queries (agent_instances / accounts / issues /
 * scores) — those live under the agent's STORED plan (0 for account-less Glean).
 * Remove once Glean account extraction lands.
 */
export const getEffectivePlan = (
  agentType: number | null | undefined,
  plan: number | null
): number | null => {
  if (agentType === AGENT_TYPE_GLEAN) {
    return AGENT_PLAN_ENTERPRISE
  }
  return plan
}

// ============================================================================
// POLICY UTILITIES
// ============================================================================

export const POLICY_STATUS_MAP: Record<number, string> = {
  0: "Unknown",
  1: "Active",
  2: "Inactive",
}

export const getPolicyStatus = (status: number | null): string => {
  if (status === null) return "Unknown"
  return POLICY_STATUS_MAP[status] || "Unknown"
}

export const getPolicyStatusBadgeVariant = (status: number | null): BadgeVariant => {
  if (status === null) return "outline"
  return status === 1 ? "default" : "secondary"
}

export const getPolicyStatusBadge = (status: number | null) => {
  const label = getPolicyStatus(status)
  const variant = getPolicyStatusBadgeVariant(status)
  
  return <Badge variant={variant}>{label}</Badge>
}

/** Mirrors scout-proto PolicyCategory enum */
export const POLICY_CATEGORY_LOGGING = 3;
export const POLICY_CATEGORY_AI_ACCESS = 5;

/** The seeded org-wide MCP access policy. Identified BY NAME across surfaces
 * (the Policies delete guard and the editor's rename/delete locks both key on
 * it) — which is why it is not renamable and no other policy may take this
 * name. */
export const DEFAULT_MCP_ACCESS_POLICY_NAME = "Connector Access Policy"

/** Mirrors scout-proto AgentIdentity_AGENT_IDENTITY_CLAUDE */
export const AGENT_TYPE_CLAUDE = 1;
export const AGENT_TYPE_CHATGPT = 3;
/**
 * Agents whose activity logs do not pass through the on-device collector yet, so an OTLP
 * destination cannot receive them (browser-agent history is uploaded by scout directly; ENG-845).
 */
export const OTEL_FORWARDING_UNSUPPORTED_AGENT_TYPES: ReadonlySet<number> = new Set([AGENT_TYPE_CHATGPT]);

/**
 * UI-only display override: in logging policies, Claude is presented as
 * "Claude Cowork". Intentionally not backed by the catalog/DB — remove once
 * the catalog exposes the desired name.
 */
export const getAgentDisplayName = (
  policyCategory: number | null | undefined,
  agentType: number,
  catalogName: string
): string => {
  if (policyCategory === POLICY_CATEGORY_LOGGING && agentType === AGENT_TYPE_CLAUDE) {
    return "Claude Cowork";
  }
  return catalogName;
};

/** Mirrors scout-proto RiskRuleType values. */
export const RISK_RULE_TYPE_SENSITIVE_DATA = 9;
export const RISK_RULE_TYPE_RISKY_ACTION_HANDLING = 19;

/**
 * UI-only display override (same spirit as getAgentDisplayName above): in
 * Sensitive Data Handling / Risky Action Handling issues, Claude (type 1)
 * detections come from the Cowork sandbox pipeline, so the agent is
 * presented as "Claude Cowork".
 */
export const getIssueAgentDisplayName = (
  riskRuleType: number | null | undefined,
  agentType: number,
  catalogName: string
): string => {
  if (
    (riskRuleType === RISK_RULE_TYPE_SENSITIVE_DATA ||
      riskRuleType === RISK_RULE_TYPE_RISKY_ACTION_HANDLING) &&
    agentType === AGENT_TYPE_CLAUDE
  ) {
    return "Claude Cowork";
  }
  return catalogName;
};

export const POLICY_CATEGORY_MAP: Record<number, string> = {
  1: "General Purpose Agents",
  2: "Coding Agents",
  3: "Logging",
  5: "AI Access",
}

export const getPolicyCategory = (category: number | null): string => {
  if (category === null) return "All"
  return POLICY_CATEGORY_MAP[category] || "Unknown"
}

export const POLICY_CATEGORY_AGENT_TYPES: Record<number, number[]> = {
  1: [1, 3, 41],  // Claude, ChatGPT, M365 Copilot
  2: [2, 111, 8, 103],  // Cursor, Claude Code, GitHub Copilot, ChatGPT Codex
  3: [1, 3, 2, 8, 111],   // Logging: Claude, ChatGPT, Cursor, GitHub Copilot, Claude Code
}

export const POLICY_ASSIGNMENT_TYPE_MAP: Record<number, string> = {
  1: "All",
  2: "Specific",
}

export const getPolicyAssignmentType = (assignmentType: number | null): string => {
  if (assignmentType === null) return "Unknown"
  return POLICY_ASSIGNMENT_TYPE_MAP[assignmentType] || "Unknown"
}

export const getPolicyAssignmentLabel = (
  assignmentType: number | null,
  entityType: number | null,
  count: number | null
): string => {
  if (assignmentType === null || entityType === null) return "Unknown Assignment"
  
  if (assignmentType === 1) {
    return entityType === 1 ? "All Agents" : "All Connectors"
  } else if (assignmentType === 2) {
    if (count !== null && count > 0) {
      return entityType === 1 ? `${count} Selected Agents` : `${count} Selected Connectors`
    } else {
      return "Not Assigned"
    }
  }
  return "Unknown Assignment"
}

export const getPolicyAssignmentBadgeVariant = (
  assignmentType: number | null,
  entityType: number | null,
  count: number | null
): BadgeVariant => {
  if (assignmentType === null || entityType === null) return "outline"
  
  if (assignmentType === 1) {
    return entityType === 1 ? "success" : "warning"
  } else if (assignmentType === 2) {
    if (count !== null && count > 0) {
      return entityType === 1 ? "success" : "warning"
    } else {
      return "outline"
    }
  }
  return "outline"
}

export const getPolicyAssignmentBadge = (
  assignmentType: number | null,
  entityType: number | null,
  count: number | null
) => {
  const label = getPolicyAssignmentLabel(assignmentType, entityType, count)
  const variant = getPolicyAssignmentBadgeVariant(assignmentType, entityType, count)
  
  return <Badge variant={variant}>{label}</Badge>
}

export const getDeviceAssignmentLabel = (
  employeeAssignmentType: number | null,
  userGroupCount: number | null
): string => {
  if (employeeAssignmentType === 1) return "All Users"
  if (employeeAssignmentType === 2 && userGroupCount && userGroupCount > 0) {
    return `${userGroupCount} User ${userGroupCount === 1 ? 'Group' : 'Groups'}`
  }
  if (employeeAssignmentType === 2) return "Not Assigned"
  return "Unknown"
}

export const getDeviceAssignmentBadgeVariant = (
  employeeAssignmentType: number | null,
  entityType: number | null,
  userGroupCount: number | null
): BadgeVariant => {
  const isAssigned = employeeAssignmentType === 1 ||
    (employeeAssignmentType === 2 && userGroupCount !== null && userGroupCount > 0)
  if (!isAssigned) return "outline"
  return entityType === 1 ? "success" : "warning"
}

export const getDeviceAssignmentBadge = (
  employeeAssignmentType: number | null,
  entityType: number | null,
  userGroupCount: number | null
) => {
  const label = getDeviceAssignmentLabel(employeeAssignmentType, userGroupCount)
  const variant = getDeviceAssignmentBadgeVariant(employeeAssignmentType, entityType, userGroupCount)
  return <Badge variant={variant}>{label}</Badge>
}

// The read-only Assigned Users view on the policy detail pages: the badge, the
// first few live groups, and a prompt when a Selected Users scope has no live
// groups left. liveGroups excludes tombstoned groups; hasGhostGroups says
// whether tombstoned attachments remain.
export const getDeviceAssignmentContent = (
  employeeAssignmentType: number | null,
  entityType: number | null,
  liveGroups: { id: string; name: string }[],
  hasGhostGroups = false,
) => {
  const badge = getDeviceAssignmentBadge(employeeAssignmentType, entityType, liveGroups.length)
  if (employeeAssignmentType !== 2) return badge

  if (liveGroups.length > 0) {
    return (
      <div className="space-y-2">
        <div>{badge}</div>
        <div className="space-y-1">
          {liveGroups.slice(0, 3).map(group => (
            <div key={group.id} className="text-sm text-muted-foreground">
              {group.name}
            </div>
          ))}
          {liveGroups.length > 3 && (
            <div className="text-sm text-muted-foreground">
              +{liveGroups.length - 3} more
            </div>
          )}
        </div>
      </div>
    )
  }

  // No groups left (deleting a group cascades its policy links away): the
  // policy applies to no devices, so add the remedy below the "Not Assigned"
  // badge.
  return (
    <div className="space-y-2">
      <div>{badge}</div>
      <p className="text-sm text-yellow-600">
        {/* Ghost-aware: hidden tombstoned attachments still exist and revive
            on reconnect/re-sync — telling the admin "no groups assigned" here
            would invite the All Users switch, whose save sends [] and
            hard-deletes the preserved attachments. Not attributed solely to a
            disconnect: the reconcile pass also tombstones groups deleted
            upstream while the integration stays connected. */}
        {hasGhostGroups
          ? "All assigned groups were removed from your IdP or its integration was disconnected, so this policy currently applies to no devices. Reconnect or re-sync to restore them, or select new groups."
          : "No users assigned. Select user groups or switch to All Users."}
      </p>
    </div>
  )
}

export const getAssignmentTypeOptions = (entityType: number | null): { value: string; label: string }[] => {
  if (entityType === null) return []
  
  if (entityType === 1) {
    // Agent framework
    return [
      { value: "1", label: "All Agents" },
      { value: "2", label: "Selected Agents" }
    ]
  } else if (entityType === 2) {
    // MCP framework
    return [
      { value: "1", label: "All Connectors" },
      { value: "2", label: "Selected Connectors" }
    ]
  }
  return []
}

// ============================================================================
// ENTITY TYPE UTILITIES
// ============================================================================

export const ENTITY_TYPE_MAP: Record<number, string> = {
  0: "Unknown",
  1: "Agent",
  2: "Connector",
}

export const getEntityType = (entityType: number | null): string => {
  if (entityType === null) return "Unknown"
  return ENTITY_TYPE_MAP[entityType] || "Unknown"
}

export const getRiskFrameworkBadgeVariant = (entityType: number | null): BadgeVariant => {
  if (entityType === null) return "outline"
  switch (entityType) {
    case 1:
      return "success"
    case 2:
      return "warning"
    default:
      return "outline"
  }
}

export const getRiskFrameworkTypeBadge = (entityType: number | null) => {
  const label = `${getEntityType(entityType)} Framework`
  const variant = getRiskFrameworkBadgeVariant(entityType)
  
  return <Badge variant={variant}>{label}</Badge>
}

export const getRiskFrameworkBadge = (frameworkName: string | null, entityType: number | null) => {
  if (!frameworkName) {
    return <Badge variant="outline">No framework</Badge>
  }
  
  const variant = getRiskFrameworkBadgeVariant(entityType)
  return <Badge variant={variant}>{frameworkName}</Badge>
}

// ============================================================================
// AGENT UTILITIES
// ============================================================================

export const AGENT_STATUS_MAP: Record<number, string> = {
  0: "unknown",
  1: "active",
  2: "pending",
  3: "approved",
  4: "rejected",
}

export const getAgentStatus = (status: number | null): string => {
  if (status === null) return "unknown"
  return AGENT_STATUS_MAP[status] || "unknown"
}

// ============================================================================
// ISSUE STATUS UTILITIES
// ============================================================================

export const ISSUE_STATUS_MAP: Record<number, string> = {
  0: "Unknown",
  1: "Active",
  2: "Resolved",
  3: "Dismissed",
}

export const ISSUE_STATUS_VALUES = Object.keys(ISSUE_STATUS_MAP).filter(k => k !== "0")

export const ISSUE_STATUS_OPTIONS = Object.entries(ISSUE_STATUS_MAP)
  .filter(([value]) => value !== "0")
  .map(([value, label]) => ({ value, label }))

export const ISSUE_STATUS_TABS = [
  { value: "1", label: "Active" },
  { value: "3", label: "Dismissed" },
  { value: "2", label: "Resolved" },
]

export const isValidIssueStatus = (value: string): boolean => 
  ISSUE_STATUS_VALUES.includes(value)

export const getIssueStatusLabel = (status: number | null): string => {
  if (status === null) return "Unknown"
  return ISSUE_STATUS_MAP[status] || "Unknown"
}

export const getIssueStatusBadgeVariant = (status: number | null): BadgeVariant => {
  if (status === null) return "outline"
  switch (status) {
    case 1:
      return "destructive"
    case 2:
      return "success"
    case 3:
      return "secondary"
    default:
      return "outline"
  }
}

export const getIssueStatusBadge = (status: number | null) => {
  const label = getIssueStatusLabel(status)
  const variant = getIssueStatusBadgeVariant(status)
  
  return <Badge variant={variant}>{label}</Badge>
}

// ============================================================================
// DISMISSAL REASON UTILITIES
// ============================================================================

export const DISMISSAL_REASON_MAP: Record<number, string> = {
  0: "Unknown",
  1: "False Positive",
  2: "Risk Accepted",
  3: "Other",
}

export const DISMISSAL_REASON_OPTIONS = Object.entries(DISMISSAL_REASON_MAP)
  .filter(([value]) => value !== "0")
  .map(([value, label]) => ({ value, label }))

// ============================================================================
// RISK UTILITIES
// ============================================================================

export const SEVERITY_LEVELS = [
  { label: "Low", bgClass: "bg-success" },
  { label: "Medium", bgClass: "bg-warning" },
  { label: "High", bgClass: "bg-danger" },
  { label: "Critical", bgClass: "bg-destructive" },
] as const


// These bands are duplicated in SQL by get_org_scorecard_rollup
// (nextjs-user-management migration 20260713000000) — change them together.
export const LOW_RISK_THRESHOLD = 40
export const MEDIUM_RISK_THRESHOLD = 60
export const HIGH_RISK_THRESHOLD = 80

export const formatScore = (score: number | null): number | null => {
  if (score === null) return null
  return Math.round(score)
}

export const getRiskLevel = (score: number | null): string => {
  if (score === null) return "Unknown"
  if (score < LOW_RISK_THRESHOLD) return "Low"
  if (score < MEDIUM_RISK_THRESHOLD) return "Medium"
  if (score < HIGH_RISK_THRESHOLD) return "High"
  return "Critical"
}

export const getRiskTextColor = (score: number | null): string => {
  if (score === null) return "text-muted-foreground"
  if (score < LOW_RISK_THRESHOLD) return "text-green-600"
  if (score < MEDIUM_RISK_THRESHOLD) return "text-yellow-600"
  if (score < HIGH_RISK_THRESHOLD) return "text-orange-600"
  return "text-red-600"
}

export const getRiskBorderColor = (score: number | null): string => {
  if (score === null) return "border-gray-200 dark:border-gray-800"
  if (score < LOW_RISK_THRESHOLD) return "border-green-200 dark:border-green-800"
  if (score < MEDIUM_RISK_THRESHOLD) return "border-yellow-200 dark:border-yellow-800"
  if (score < HIGH_RISK_THRESHOLD) return "border-orange-200 dark:border-orange-800"
  return "border-red-200 dark:border-red-800"
}

export const getRiskIcon = (score: number | null) => {
  if (score === null) return <HelpCircle className="h-5 w-5" />
  if (score < LOW_RISK_THRESHOLD) return <Info className="h-5 w-5" />
  if (score < MEDIUM_RISK_THRESHOLD) return <AlertTriangle className="h-5 w-5" />
  if (score < HIGH_RISK_THRESHOLD) return <AlertCircle className="h-5 w-5" />
  return <XCircle className="h-5 w-5" />
}

export const getRiskBadgeVariant = (score: number | null): BadgeVariant => {
  if (score === null) return "outline"
  if (score < LOW_RISK_THRESHOLD) return "success"
  if (score < MEDIUM_RISK_THRESHOLD) return "warning"
  if (score < HIGH_RISK_THRESHOLD) return "danger"
  return "destructive"
}

export const getRiskBadge = (score: number | null) => {
  const level = getRiskLevel(score)
  const variant = getRiskBadgeVariant(score)

  return <Badge variant={variant}>{level}</Badge>
}

export const getScoreBadge = (score: number | null, trendArrow?: string | null, trendColor?: string | null) => {
  if (score === null) return null
  const variant = getRiskBadgeVariant(score)

  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge variant={variant}>
        {score}
      </Badge>
      {trendArrow && (
        <span className={`text-sm font-semibold ${trendColor || ''}`}>{trendArrow}</span>
      )}
    </span>
  )
}

export const getRiskDifferenceIndicator = (
  baselineScore: number | null,
  actualScore: number | null
): { text: string; colorClass: string } | null => {
  if (baselineScore === null || actualScore === null) return null
  if (baselineScore === actualScore) return null
  
  const diff = actualScore - baselineScore
  const isImprovement = diff < 0
  
  return {
    text: isImprovement ? `↓${diff}` : `↑+${diff}`,
    colorClass: isImprovement ? "text-green-600" : "text-red-600"
  }
}

export const getScoreBadgeWithDiff = (
  baselineScore: number | null,
  actualScore: number | null
) => {
  // Both null -> return null (show N/A in UI)
  if (baselineScore === null && actualScore === null) return null
  
  // Only actual exists -> show actual (no diff indicator)
  if (baselineScore === null && actualScore !== null) {
    const variant = getRiskBadgeVariant(actualScore)
    return (
      <span className="inline-flex items-center gap-1.5">
        <Badge variant={variant}>{actualScore}</Badge>
      </span>
    )
  }
  
  // Baseline exists (with or without actual) -> show baseline with optional diff
  const variant = getRiskBadgeVariant(baselineScore)
  const diff = getRiskDifferenceIndicator(baselineScore, actualScore)

  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge variant={variant}>{baselineScore}</Badge>
      {diff && (
        <span className={`text-sm font-semibold ${diff.colorClass}`}>
          ({diff.text})
        </span>
      )}
    </span>
  )
}

// Helper to get the effective score for display (baseline with diff, or just actual if no baseline)
export const getEffectiveScoreDisplay = (
  baselineScore: number | null,
  actualScore: number | null
): { score: number | null; diff: { text: string; colorClass: string } | null } => {
  // Both null
  if (baselineScore === null && actualScore === null) {
    return { score: null, diff: null }
  }
  
  // Only actual exists
  if (baselineScore === null && actualScore !== null) {
    return { score: actualScore, diff: null }
  }
  
  // Baseline exists (with or without actual)
  return { 
    score: baselineScore, 
    diff: getRiskDifferenceIndicator(baselineScore, actualScore) 
  }
}

export const getTrendArrow = (actualScore: number | null, baselineScore: number | null): string | null => {
  if (actualScore === null || baselineScore === null || actualScore === baselineScore) return null
  return actualScore < baselineScore ? "↓" : "↑"
}

export const getTrendColor = (actualScore: number | null, baselineScore: number | null): string | null => {
  if (actualScore === null || baselineScore === null || actualScore === baselineScore) return null
  return actualScore < baselineScore ? "text-green-600" : "text-red-600"
}

export const getTrendText = (actualScore: number | null, baselineScore: number | null): string | null => {
  const arrow = getTrendArrow(actualScore, baselineScore)
  if (!arrow) return null
  return actualScore! < baselineScore! ? `${arrow} Better` : `${arrow} Worse`
}

export const RISK_LEVEL_MAP: Record<string, string> = {
  "low": "Low Risk",
  "medium": "Medium Risk",
  "high": "High Risk",
  "critical": "Critical Risk",
}

export const RISK_LEVEL_VALUES = Object.keys(RISK_LEVEL_MAP)

export const RISK_LEVEL_OPTIONS = [
  { value: "all", label: "All Risk Levels" },
  ...Object.entries(RISK_LEVEL_MAP).map(([value, label]) => ({ value, label }))
]

export const isValidRiskLevel = (value: string): boolean => 
  RISK_LEVEL_VALUES.includes(value)

// ============================================================================
// PERFORMANCE FILTER UTILITIES
// ============================================================================

export const PERFORMANCE_MAP: Record<string, string> = {
  "better": "Actual better than Baseline",
  "worse": "Actual worse than Baseline",
  "same": "Actual same as Baseline",
}

export const PERFORMANCE_VALUES = Object.keys(PERFORMANCE_MAP)

export const PERFORMANCE_OPTIONS = [
  { value: "all", label: "All Performance" },
  ...Object.entries(PERFORMANCE_MAP).map(([value, label]) => ({ value, label }))
]

export const isValidPerformance = (value: string): boolean => 
  PERFORMANCE_VALUES.includes(value)

// ============================================================================
// CONTROLLABLE RISK RULE TYPES
// Risk rule types (proto integers) that the binary processor currently
// evaluates instance-level issues for. All others are acknowledgement-only.
// ============================================================================

export const SENSITIVE_DATA_HANDLING_RISK_RULE_TYPE = 9
export const SENSITIVE_DATA_DETECTION_DOCS_URL =
  "https://traceforce.readme.io/docs/sensitive-data-detection"

export const CONNECTOR_RISK_CONTAINMENT_RULE_TYPE = 19
export const RISKY_ACTION_DETECTION_DOCS_URL =
  "https://traceforce.readme.io/docs/risky-action-detection"

export const PROMPT_INJECTION_RESILIENCE_RULE_TYPE = 36

export const MODEL_SELECTION_RISK_RULE_TYPE = 15

// UI-only display names for control requirements whose catalog
// expected_value reads awkwardly. Unmapped values render as-is.
const REQUIREMENT_DISPLAY_LABELS: Record<string, string> = {
  "On (Prompt Injection Detection)": "Disallow prompt injection",
  "Only company email permitted": "Disallow personal email",
}

export const getRequirementDisplayLabel = (expectedValue: string): string =>
  REQUIREMENT_DISPLAY_LABELS[expectedValue] ?? expectedValue

export const CONTROLLABLE_RISK_RULE_TYPES = new Set<number>([
  // Agent
  1,    // MFA Support
  4,    // Identity Federation
  6,    // Training Data Usage
  SENSITIVE_DATA_HANDLING_RISK_RULE_TYPE, // Sensitive Data
  MODEL_SELECTION_RISK_RULE_TYPE, // Model Selection (PolicyDetail shows it only on AI Access policies with the LLM models UI)
  16,   // User Activity Logging
  CONNECTOR_RISK_CONTAINMENT_RULE_TYPE, // Connector Risk Containment
  PROMPT_INJECTION_RESILIENCE_RULE_TYPE, // Prompt Injection Resilience
  21,   // Connector Support
  // MCP
  1000, // Auth Method
  1001, // Permission Enforcement
  1002, // Secrets Exposure
  1003, // Unsafe Local System Commands
  1004, // Execution Mode
  1005, // Connection Security
  1007, // Version Control
])

// ============================================================================
// REMEDIATION UTILITIES
// ============================================================================

export const getRemediationBadge = (name: string | null, remediationType: number | null) => {
  if (!name) return <Badge variant="outline">N/A</Badge>;
  switch (remediationType) {
    case 2: return <Badge variant="secondary">{name}</Badge>;
    case 3: return <Badge variant="warning">{name}</Badge>;
    case 4: return <Badge variant="destructive">{name}</Badge>;
    case 5: return <Badge variant="success">{name}</Badge>;
    default: return <Badge variant="outline">{name}</Badge>;
  }
};

const REMEDIATION_DISPLAY_NAMES: Record<number, Record<number, string>> = {
  4: { 4: 'Block login' },       // Identity Federation: Block
  9: { 3: 'Warn user', 4: 'Block user' },         // Sensitive Data Handling: Warn / Block
  15: { 4: 'Block user' },       // Model Selection: Block
  16: { 5: 'Enable logging' },   // User Activity Logging: Enable
  19: { 3: 'Warn user', 4: 'Block user' },        // Connector Risk Containment: Warn / Block
};

export const getRemediationDisplayName = (riskRuleType: number, remediationType: number, fallback: string) => {
  return REMEDIATION_DISPLAY_NAMES[riskRuleType]?.[remediationType] || fallback;
};

// ============================================================================
// ALERT NOTIFICATION UTILITIES
// ============================================================================

export const ALERT_NOTIFICATION_TYPE_MAP: Record<number, string> = {
  1: "Slack",
  2: "Teams",
}

export const ALERT_NOTIFICATION_TYPE_OPTIONS = Object.entries(ALERT_NOTIFICATION_TYPE_MAP).map(([value, label]) => ({ value, label }))

export const getAlertNotificationTypeLabel = (type: number | undefined): string => {
  if (!type) return "Unknown"
  return ALERT_NOTIFICATION_TYPE_MAP[type] || "Unknown"
}

export const FREQUENCY_MAP: Record<number, string> = {
  1: "Hourly",
  2: "Daily",
  3: "Weekly",
}

export const DEFAULT_FREQUENCY = 1

export const FREQUENCY_OPTIONS = Object.entries(FREQUENCY_MAP).map(([value, label]) => ({ value, label }))

export const getFrequencyLabel = (frequency: number | undefined): string => {
  const freq = frequency ?? DEFAULT_FREQUENCY;
  return FREQUENCY_MAP[freq] || "Unknown"
}

// ============================================================================
// DEPLOYMENT MODEL UTILITIES
// ============================================================================

export const DEPLOYMENT_MODEL_MAP: Record<number, string> = {
  0: "Unknown",
  1: "Local Process",
  2: "Local Container",
  3: "Local Service",
  4: "Remote",
}

export const getDeploymentModel = (model: number | null): string => {
  if (model === null) return "Unknown"
  return DEPLOYMENT_MODEL_MAP[model] || "Unknown"
}

// ============================================================================
// AUTH TYPE UTILITIES
// ============================================================================

export const AUTH_TYPE_MAP: Record<number, string> = {
  0: "Unknown",
  1: "Password",
  2: "Token",
  3: "OAuth",
  4: "No Auth",
}

export const getAuthType = (type: number | null): string => {
  if (type === null) return "Unknown"
  return AUTH_TYPE_MAP[type] || "Unknown"
}

// Badge colors mirror AUTH_TYPE_CHART_COLORS so the table reads like the
// charts (same convention as getDistributionChannelBadge / Managed By).
// Unknown (0) is rendered by the caller as muted text, not a badge.
export const getAuthTypeBadge = (type: number) => {
  const bgColor = AUTH_TYPE_CHART_COLORS[type] ?? AUTH_TYPE_CHART_COLORS[0]
  return (
    <Badge
      variant="default"
      className="text-xs font-medium"
      style={{ backgroundColor: bgColor, borderColor: bgColor }}
    >
      {getAuthType(type)}
    </Badge>
  )
}

// One auth palette + display order shared by the MCPs-page donut, the dashboard
// bar, and the PDF report, so the same method is the same color everywhere.
// Unknown is gray and always last — present but de-emphasized.
export const AUTH_TYPE_CHART_COLORS: Record<number, string> = {
  3: "hsl(217, 91%, 60%)",  // OAuth - blue
  2: "hsl(271, 81%, 56%)",  // Token - purple
  1: "hsl(35, 85%, 55%)",   // Password - yellow
  4: "hsl(187, 85%, 43%)",  // No Auth - cyan
  0: "hsl(220, 9%, 46%)",   // Unknown - gray (matches the app's unspecified gray)
}
export const AUTH_TYPE_DISPLAY_ORDER = [3, 2, 1, 4, 0]
// Rank for sorting detected methods everywhere they're listed (table badges,
// CSV) so surface order always matches the charts; unrecognized values last.
export const authTypeDisplayRank = (t: number) => {
  const i = AUTH_TYPE_DISPLAY_ORDER.indexOf(t)
  return i === -1 ? AUTH_TYPE_DISPLAY_ORDER.length : i
}

// Custom (uncatalogued) MCP servers. Identity-based charts (popularity,
// report categories) exclude them; property charts (auth, risk) include them.
export const CUSTOM_MCP_SERVER_TYPE = 999999999

/** Governable = a real registry MCP. Excludes the non-positive sentinel types
 * (0 = Unknown) and the Custom bucket (999999999) — inventory lifecycle
 * states, never decidable, exceptable, or counted by access policies. One
 * definition so the Set Access picker, the policy editor, and any future
 * surface can't drift. */
export const isGovernableMcpType = (type: number) =>
  type > 0 && type !== CUSTOM_MCP_SERVER_TYPE

// ChatGPT / Claude "connectors" are browser-app integrations, not MCP servers a
// device runs — nothing a device-side policy could enforce. This predicate only
// IDENTIFIES them; what to do with the answer is the caller's call (the access
// policy editor drops them from its catalog, the Connectors table shows them
// as "Allowed"). The resolver gives them no verdicts (20261003100320), and
// devices can't detect them (no detection patterns). The catalog stores the proto MCPSourceType number (Supabase reads);
// the REST API publishes the string enum (McpSourceType). One predicate
// accepts both so every surface shares one definition.
export const MCP_SOURCE_TYPE_OPENAI = 5
export const MCP_SOURCE_TYPE_ANTHROPIC = 6
/** The same sources as REST API values, e.g. for the catalog's exclude_source_type. */
export const BROWSER_APP_SOURCE_TYPES: McpSourceType[] = ["openai", "anthropic"]
export const isBrowserAppConnectorSourceType = (
  sourceType: number | McpSourceType | null | undefined,
) =>
  sourceType === MCP_SOURCE_TYPE_OPENAI ||
  sourceType === MCP_SOURCE_TYPE_ANTHROPIC ||
  (typeof sourceType === "string" && BROWSER_APP_SOURCE_TYPES.includes(sourceType))


// ============================================================================
// MCP SOURCE TYPE UTILITIES
// ============================================================================
// Mirrors scout-proto MCPSourceType via the API string enums.

export const MCP_SOURCE_TYPE_MAP: Record<string, string> = {
  official: "Official",
  community: "Community",
  reference: "Anthropic Reference",
  archived: "Archived",
  openai: "ChatGPT",
  anthropic: "Claude",
}

export const MCP_SOURCE_TYPE_FILTER_OPTIONS = Object.entries(MCP_SOURCE_TYPE_MAP).map(
  ([value, label]) => ({ value, label }),
)

export const getMcpSourceType = (sourceType: string | null | undefined): string => {
  if (sourceType === null || sourceType === undefined) return "Unknown"
  return MCP_SOURCE_TYPE_MAP[sourceType] || "Unknown"
}

export const getMcpSourceTypeBadge = (sourceType: string | null | undefined) => {
  if (sourceType === null || sourceType === undefined) return null
  return <Badge variant="outline">{getMcpSourceType(sourceType)}</Badge>
}

// Mirrors scout-proto ToolPermissionType enum (mcp_catalog_tools.permission_type).
export const TOOL_PERMISSION_TYPE = {
  UNKNOWN: 0,
  READ: 1,
  WRITE: 2,
  DELETE: 3,
} as const

export const TOOL_PERMISSION_TYPE_MAP: Record<number, string> = {
  [TOOL_PERMISSION_TYPE.UNKNOWN]: "Unknown",
  [TOOL_PERMISSION_TYPE.READ]: "Read",
  [TOOL_PERMISSION_TYPE.WRITE]: "Write",
  [TOOL_PERMISSION_TYPE.DELETE]: "Delete",
}

/** Label for a tool action; null / out-of-range fall back to Unknown. */
export const getToolPermissionType = (actionType: number | null | undefined): string => {
  if (actionType == null) return TOOL_PERMISSION_TYPE_MAP[TOOL_PERMISSION_TYPE.UNKNOWN]
  return TOOL_PERMISSION_TYPE_MAP[actionType] ?? TOOL_PERMISSION_TYPE_MAP[TOOL_PERMISSION_TYPE.UNKNOWN]
}

export const getToolPermissionTypeBadge = (actionType: number | null | undefined) => {
  const resolved =
    actionType != null && actionType in TOOL_PERMISSION_TYPE_MAP
      ? actionType
      : TOOL_PERMISSION_TYPE.UNKNOWN
  const label = getToolPermissionType(resolved)

  if (resolved === TOOL_PERMISSION_TYPE.DELETE) {
    return <Badge variant="destructive" className="text-xs font-semibold">{label}</Badge>
  }
  if (resolved === TOOL_PERMISSION_TYPE.WRITE) {
    return (
      <Badge
        variant="default"
        className="text-xs font-semibold border-transparent bg-blue-600 text-white hover:bg-blue-600/80 dark:bg-blue-500 dark:hover:bg-blue-500/80"
      >
        {label}
      </Badge>
    )
  }
  if (resolved === TOOL_PERMISSION_TYPE.READ) {
    return <Badge variant="success" className="text-xs font-semibold">{label}</Badge>
  }
  return <Badge variant="secondary" className="text-xs font-semibold">{label}</Badge>
}

// ============================================================================
// MCP ACCESS STATUS UTILITIES
// ============================================================================
// Renders the per-MCP status computed by useMcpAccessStatusMap (hooks/use-mcp-access).
// Kept loosely typed here (rather than importing the hook's type) to avoid a
// lib -> hooks import; the shape is just { status, pendingCount } plus the
// caller-supplied alwaysAllowed flag for the two ungoverned buckets (Custom,
// browser-app connectors).

type McpAccessStatusBadgeInfo = {
  status: "allowed" | "varies" | "blocked" | "needs_review" | "none"
  pendingCount: number
  /** Connectors no policy reaches: the aggregated Custom bucket (excluded by
   * the resolver) and ChatGPT / Claude browser-app connectors
   * (isBrowserAppConnectorSourceType). Nothing on a device enforces either,
   * so they read "Allowed" whatever the resolver says. */
  alwaysAllowed?: boolean
  /** Scoped to devices (a device filter, DeviceDetail): differing verdicts
   * are devices' ("Varies by device"). */
  deviceScoped?: boolean
}

/** Single source of the User Access vocabulary, shared by the badge and the
 * CSV export so the two never drift. It answers "can users use it?":
 * ungoverned ("none") and unenforceable connectors are Allowed, and an
 * unscored one is blocked until someone reviews it. Request counts are a
 * separate affordance, never a status. */
export const getMcpAccessStatusLabel = (info: McpAccessStatusBadgeInfo): string => {
  if (info.alwaysAllowed) return "Allowed"
  switch (info.status) {
    case "varies":
      return info.deviceScoped ? "Varies by device" : "Varies by group"
    case "blocked":
      return "Blocked"
    case "needs_review":
      return "Blocked · Needs review"
    default:
      return "Allowed"
  }
}

/** The badge alone. Pending requests are the caller's to render (the
 * inventory shows an "N requests" link beside it) — a count is an affordance,
 * never part of the verdict. */
export const getMcpAccessStatusBadge = (info: McpAccessStatusBadgeInfo) => {
  const label = getMcpAccessStatusLabel(info)

  // Multi-word labels ("Varies by group") must not break across lines in a
  // narrow table cell.
  const nowrap = "whitespace-nowrap"
  if (info.alwaysAllowed) return <Badge variant="success" className={nowrap}>{label}</Badge>
  switch (info.status) {
    case "varies":
      return <Badge variant="secondary" className={nowrap}>{label}</Badge>
    case "blocked":
      return <Badge variant="destructive" className={nowrap}>{label}</Badge>
    case "needs_review":
      // Orange, not red: still blocked (the label says so), but it needs
      // someone's attention, so it stands out from decided blocks.
      return <Badge variant="warning" className={nowrap}>{label}</Badge>
    default:
      return <Badge variant="success" className={nowrap}>{label}</Badge>
  }
}

// ============================================================================
// DISTRIBUTION CHANNEL UTILITIES
// ============================================================================

export const DISTRIBUTION_CHANNEL_MAP: Record<number, string> = {
  0: "Unknown",
  1: "Admin",
  2: "Admin",
  3: "User",
}

export const getDistributionChannel = (channel: number | null): string => {
  if (channel === null) return "Unknown"
  return DISTRIBUTION_CHANNEL_MAP[channel] || "Unknown"
}

export const getDistributionChannelBadge = (channel: number) => {
  const label = getDistributionChannel(channel)
  // Map channel to chart color keys
  const colorKey = (channel === 1 || channel === 2) ? 'admin' : channel === 3 ? 'user' : 'unknown'
  const bgColor = DISTRIBUTION_CHANNEL_CHART_COLORS[colorKey]
  
  return (
    <Badge 
      variant="default" 
      className="text-xs font-medium"
      style={{ backgroundColor: bgColor, borderColor: bgColor }}
    >
      {label}
    </Badge>
  )
}

// ============================================================================
// AGENT DEPLOYMENT TYPE UTILITIES
// ============================================================================

export const AGENT_DEPLOYMENT_TYPE_MAP: Record<number, string> = {
  0: "Unknown",
  1: "Desktop App",
  2: "VSCode Extension",
  3: "CLI",
  4: "Web Browser",
  5: "AI Browser",
  6: "Daemon",
  7: "Cloud",
}

export const getAgentDeploymentType = (type: number | null): string => {
  if (type === null) return "Unknown"
  return AGENT_DEPLOYMENT_TYPE_MAP[type] || "Unknown"
}

export const getAgentDeploymentTypeBadge = (type: number | null) => {
  const label = getAgentDeploymentType(type)
  return <Badge variant="default" className="font-semibold">{label}</Badge>
}

export const getAgentNameBadge = (agentName: string) => {
  return <Badge variant="default" className="text-xs font-semibold">{agentName}</Badge>
}

// ============================================================================
// SANDBOX RUNTIME TYPE / ENVIRONMENT UTILITIES
// ============================================================================
// runtime_type values come from the proto SandboxRuntimeType enum. The
// Environment column composes a "Host" pill (sandbox_id IS NULL on instances)
// with one pill per distinct runtime type joined from sandboxes.

export const SANDBOX_RUNTIME_TYPE_MAP: Record<number, string> = {
  0: "Unknown",
  1: "Dev Container",
}

export const getSandboxRuntimeType = (type: number | null): string => {
  if (type === null) return "Unknown"
  return SANDBOX_RUNTIME_TYPE_MAP[type] || "Unknown"
}

export const getSandboxRuntimeTypeBadge = (type: number | null) => {
  const label = getSandboxRuntimeType(type)
  return <Badge variant="default" className="font-semibold">{label}</Badge>
}

export const getHostBadge = () => {
  return <Badge variant="default" className="font-semibold">Host</Badge>
}

// For rows that name their own environment (e.g. "AWS Bedrock" or
// "Microsoft 365 Copilot") instead of deriving it from host/sandbox telemetry.
export const getEnvironmentBadge = (label: string) => {
  return <Badge variant="default" className="font-semibold">{label}</Badge>
}

// "host" sentinel + every SANDBOX_RUNTIME_TYPE_MAP entry. Used by the
// Environment filter MultiSelect on Agents/Mcps pages.
export const ENVIRONMENT_OPTIONS = [
  { value: 'host', label: 'Host' },
  ...Object.entries(SANDBOX_RUNTIME_TYPE_MAP).map(([value, label]) => ({ value, label })),
]

// ============================================================================
// CHART COLOR UTILITIES
// ============================================================================

// Risk chart colors - match the CSS variables from index.css
export const RISK_CHART_COLORS: Record<string, string> = {
  low: "hsl(142, 76%, 36%)",      // --success
  medium: "hsl(35, 85%, 55%)",    // --warning
  high: "hsl(25, 90%, 55%)",      // --danger
  critical: "hsl(0, 84%, 60%)",   // --destructive
}

// Plan chart colors - match badge variants
export const PLAN_CHART_COLORS: Record<number, string> = {
  0: "hsl(220, 9%, 46%)",         // Unspecified - secondary/gray
  1: "hsl(0, 84%, 60%)",          // Personal - destructive/red
  2: "hsl(142, 76%, 36%)",        // Enterprise - success/green
  3: "hsl(35, 85%, 55%)",         // Small Business - warning/yellow
}

// Deployment type chart colors
export const DEPLOYMENT_TYPE_CHART_COLORS: Record<number, string> = {
  0: "hsl(220, 9%, 46%)",         // Unknown - gray
  1: "hsl(217, 91%, 60%)",        // Desktop App - blue
  2: "hsl(271, 81%, 56%)",        // VSCode Extension - purple
  3: "hsl(187, 85%, 43%)",        // CLI - cyan
  4: "hsl(239, 84%, 67%)",        // Web Browser - indigo
  5: "hsl(330, 81%, 60%)",        // AI Browser - pink
  6: "hsl(172, 66%, 50%)",        // Daemon - teal
  7: "hsl(25, 95%, 53%)",         // Cloud - orange
}

// Distribution channel chart colors
export const DISTRIBUTION_CHANNEL_CHART_COLORS: Record<string, string> = {
  admin: "hsl(187, 85%, 43%)",    // Admin - cyan (vibrant)
  user: "hsl(271, 81%, 56%)",     // User - purple
  unknown: "hsl(220, 9%, 46%)",   // Unknown - gray
}

// Category chart colors - dynamic palette
const CATEGORY_COLOR_PALETTE = [
  "hsl(217, 91%, 60%)",   // blue
  "hsl(271, 81%, 56%)",   // purple
  "hsl(142, 76%, 36%)",   // green
  "hsl(35, 85%, 55%)",    // yellow
  "hsl(330, 81%, 60%)",   // pink
  "hsl(187, 85%, 43%)",   // cyan
  "hsl(25, 90%, 55%)",    // orange
  "hsl(172, 66%, 50%)",   // teal
  "hsl(239, 84%, 67%)",   // indigo
  "hsl(0, 84%, 60%)",     // red
]

export const getCategoryColor = (index: number): string => {
  return CATEGORY_COLOR_PALETTE[index % CATEGORY_COLOR_PALETTE.length]
}

// ============================================================================
// USER GROUP SOURCE UTILITIES
// ============================================================================

// Enum values match scout-proto UserGroupSource: 1 manual, 2 okta, 3 entra,
// 4 onelogin, 5 gsuite. 2-5 are IdP-synced groups (read-only in the UI —
// membership is managed in the identity provider).
const USER_GROUP_SOURCE_MAP: Record<number, string> = {
  1: "Traceforce",
  2: "Okta",
  3: "Entra",
  4: "OneLogin",
  5: "Google Workspace",
  // scout-proto v1.1.24: every WorkOS SCIM directory provider.
  6: "CyberArk",
  7: "JumpCloud",
  8: "PingFederate",
  9: "Rippling",
  10: "SailPoint",
}

export const getUserGroupSourceLabel = (source: number): string => {
  return USER_GROUP_SOURCE_MAP[source] || "Unknown"
}

// Provider badge colors, keyed by UserGroupSource enum. Labels come from
// USER_GROUP_SOURCE_MAP above — one name table, not two.
const SOURCE_BADGE_CLASS: Record<number, string> = {
  2: "bg-blue-600 hover:bg-blue-600 text-white", // Okta
  3: "bg-indigo-600 hover:bg-indigo-600 text-white", // Entra
  4: "bg-slate-600 hover:bg-slate-600 text-white", // OneLogin
  5: "bg-emerald-600 hover:bg-emerald-600 text-white", // Google Workspace
  6: "bg-cyan-700 hover:bg-cyan-700 text-white", // CyberArk
  7: "bg-teal-600 hover:bg-teal-600 text-white", // JumpCloud
  8: "bg-rose-600 hover:bg-rose-600 text-white", // PingFederate
  // amber-700, not 600: amber-600 on white text is ~3:1, below WCAG AA for
  // badge-size type.
  9: "bg-amber-700 hover:bg-amber-700 text-white", // Rippling
  10: "bg-violet-600 hover:bg-violet-600 text-white", // SailPoint
}

/** Badge for the user-groups table: IdP-synced groups get a provider-colored
 * treatment; Traceforce groups the default badge. */
export const getUserGroupSourceBadge = (source: number) => {
  const cls = SOURCE_BADGE_CLASS[source]
  if (cls) return <Badge className={cls}>{getUserGroupSourceLabel(source)}</Badge>
  return <Badge variant={source === 1 ? "default" : "secondary"}>{getUserGroupSourceLabel(source)}</Badge>
}

// ============================================================================
// IDENTITY PROVIDER UTILITIES
// ============================================================================

/** Customer-facing provider strings from GET /api/v1/settings/idp-integrations.
 * FULL names, used in settings/drawer copy; the group-table badges above use
 * the short forms from USER_GROUP_SOURCE_MAP on purpose (badge real estate).
 * Keys mirror the API's provider vocabulary (UserGroupSource 2..5). */
export const IDP_PROVIDER_MAP: Record<string, string> = {
  okta: "Okta",
  entra: "Microsoft Entra ID",
  onelogin: "OneLogin",
  gsuite: "Google Workspace",
  cyberark: "CyberArk",
  jumpcloud: "JumpCloud",
  pingfederate: "PingFederate",
  rippling: "Rippling",
  sailpoint: "SailPoint",
}

/** The Identity Provider tile/drawer pitch — one string, used by both. */
export const IDP_SETUP_DESCRIPTION =
  "Configure your Identity Provider to import your Enterprise Users & Groups"

/** Customer-facing label for the delta-sync cadence. Mirrors the idp-sync
 * lambda's delta schedule (rate(5 minutes) in terraform/controlplane/dp/
 * idp-sync.tf) — keep in step if that schedule changes. */
export const IDP_DELTA_SYNC_LABEL = "5 mins"

/** True for states where a directory is linked and operable (sync/reconfigure/
 * disconnect): everything except an unfinished setup or a disconnected row.
 * Deliberately a denylist: an unknown future ui_state counts as live, matching
 * the drawer's fail-open rendering (see IdpUiState in traceforce/types). */
export const isLiveLinkedIdpState = (state: string | null | undefined): boolean =>
  !!state && state !== "pending_setup" && state !== "disconnected"

/** True when the raw WorkOS directory_state says the IdP has successfully
 * pushed: "linked" (SCIM) ≡ "active" (the Go worker's vocabulary) — mirrors
 * the server's DIRECTORY_STATES_LIVE. Anything else (unlinked, validating,
 * the synthetic "deleted") means the IdP has never connected, or stopped.
 * Presentation only: it splits copy WITHIN the server-derived "discovering"
 * ui_state; lifecycle itself stays server-derived. */
export const isLiveDirectoryState = (state: string | null | undefined): boolean =>
  ["linked", "active"].includes((state ?? "").toLowerCase())

/** Customer-facing labels for the raw WorkOS directory_state passthrough —
 * "linked"/"active" are the same state in two vocabularies (SCIM vs the Go
 * worker), and snake_case strings aren't UI. Unknown values fall back to the
 * raw string so a new WorkOS state degrades to visible, not blank. */
const DIRECTORY_STATE_LABEL_MAP: Record<string, string> = {
  linked: "Linked",
  active: "Linked",
  unlinked: "Not connected",
  validating: "Validating",
  invalid_credentials: "Invalid credentials",
  deleting: "Deleting",
  deleted: "Deleted",
}

export const getDirectoryStateLabel = (state: string | null | undefined): string =>
  state ? (DIRECTORY_STATE_LABEL_MAP[state.toLowerCase()] ?? state) : "—"

/** "unknown" (provider not discovered yet) falls back to the generic label. */
export const providerLabel = (provider: string | null | undefined): string =>
  (provider && IDP_PROVIDER_MAP[provider]) || "Identity provider"

/**
 * Pick the integration the Identity Provider tile/drawer should present.
 *
 * The API returns newest-first, but newest is the wrong primary when a stray
 * unfinished setup coexists with a live linked integration (possible because
 * the one-setup-in-flight rule only constrains UNLINKED rows): showing the
 * pending row would hide a healthy connection behind "setup not finished".
 * Priority: live linked (connected/discovering/attention/disconnecting) >
 * pending setup > disconnected.
 */
export const pickPrimaryIdpIntegration = <T extends { ui_state: string }>(
  integrations: T[] | null | undefined,
): T | null => {
  if (!integrations?.length) return null
  const rank = (s: string) =>
    s === "pending_setup" ? 1 : s === "disconnected" ? 2 : 0
  return [...integrations].sort((a, b) => rank(a.ui_state) - rank(b.ui_state))[0]
}

// ============================================================================
// MDM PROVIDER UTILITIES
// ============================================================================

export const MDM_PROVIDER_MAP: Record<number, string> = {
  1: "Jamf Pro",
  2: "Microsoft Intune",
  3: "JumpCloud",
  5: "NinjaOne",
  6: "Mosyle",
  7: "Iru",
}

export const MDM_PROVIDER_OPTIONS = Object.entries(MDM_PROVIDER_MAP).map(([value, label]) => ({ value, label }))

export const getMdmProviderLabel = (type: number | undefined): string => {
  if (!type) return "Unknown"
  return MDM_PROVIDER_MAP[type] || "Unknown"
}

// True if ANY connected MDM provider is in a customer-fixable error state.
// Keyed on is_customer_error (provider-agnostic) — NOT on error_code, because
// Jamf reports 401/403 while Intune/Entra reports 400 + AADSTS for the same class
// of failure. The data plane already sets is_customer_error=true for both.
export const anyMdmNeedsAttention = (integrations: MdmIntegration[]): boolean =>
  integrations.some((i) => i.is_customer_error === true)

// Sort MDM integrations by creation date (oldest first) for a stable display order
// everywhere they're listed (settings panel, tile, Device Owner tooltips).
export const sortMdmByCreatedAt = (integrations: MdmIntegration[]): MdmIntegration[] =>
  [...integrations].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )

// error_code the data plane sets when a customer-supplied MDM host doesn't resolve (DNS
// NXDOMAIN) — HTTP 502 (Bad Gateway), reused to mean "couldn't reach the upstream MDM host".
// Kept in sync with the Go const ErrCodeHostUnreachable in traceforce common/utils; the banner
// maps it to a host-specific "verify the instance URL".
export const MDM_ERROR_HOST_UNREACHABLE = 502

// Matches proto MdmIntegrationStatus DISCONNECTED (types.ts: 3 = disconnected).
const MDM_STATUS_DISCONNECTED = 3

// Human-readable sync status for one MDM provider. A failure takes precedence over
// last_synced/never-synced so a failed integration never reads as "Waiting for sync".
// Checked on status as well as error_code: the data plane only sets error_code for
// classified API errors, so a transport/parse failure would otherwise read as waiting.
export const getMdmSyncStatusText = (i: MdmIntegration): string => {
  if (i.error_code || i.status === MDM_STATUS_DISCONNECTED) return "Sync failed"
  if (i.last_synced) return `Last synced ${formatDistanceToNow(new Date(i.last_synced), { addSuffix: true })}`
  return "Waiting for first sync"
}

/**
 * Compute the Settings-tile MDM summary lines + warning flag from the integrations list.
 * One line per connected provider ("<Provider> connected · <status>"), shared so the tile
 * (fetched on page load) and MdmSettingsSection stay consistent.
 */
export const getMdmSummary = (
  integrations: MdmIntegration[]
): { lines: string[]; hasWarning: boolean } => {
  // Reuse the centralized predicate so the tile warning can't drift from the other surfaces.
  const hasWarning = anyMdmNeedsAttention(integrations)
  const lines = sortMdmByCreatedAt(integrations).map(
    (i) => `${getMdmProviderLabel(i.provider)} connected · ${getMdmSyncStatusText(i)}`
  )
  return { lines, hasWarning }
}

// The literal "https://" prefix is required as well as the parsed protocol: the URL
// parser forgives "https:/host" (single slash), which the sync would then read as
// host "https" (Iru) or fail on with no banner (Jamf).
const isValidHttpsUrl = (value: string): boolean => {
  try { return new URL(value).protocol === "https:" && /^\s*https:\/\//i.test(value) } catch { return false }
}

// isValidHttpsUrl, but a bare hostname is also accepted (vendor consoles display
// API hosts without a scheme — Iru's Access page, NinjaOne's login URL). The
// value is trimmed first so a pasted leading space is not prefixed into the
// host; anything that starts with "scheme:/" (or "scheme:\") is validated as
// typed, so "https:/host" and "http://host" are rejected, while a bare host
// gets https:// prefixed. The syncs for these providers normalize to
// scheme://host, so paths/queries/fragments are tolerated here.
const isValidHttpsUrlOrHost = (value: string): boolean => {
  const t = value.trim()
  return isValidHttpsUrl(/^[a-z][a-z0-9+.-]*:[\/\\]/i.test(t) ? t : "https://" + t)
}

// Definition for one credential input of an MDM provider. `validate` is optional and
// provider-specific — it returns an error message for an invalid (non-empty) value, or null
// if valid — so the settings form can validate generically without hardcoding per-provider rules.
// `optional: true` exempts the field from the Add form's required check (a non-empty value is
// still run through `validate`) and renders an "(optional)" suffix on the label; the backend
// stores whatever keys are sent verbatim. `helpText` renders as muted guidance under the input
// for fields whose purpose isn't self-evident from the label. `defaultValue` pre-fills the
// Add form (the value most customers need, still editable — e.g. JumpCloud's US console URL).
export type MdmProviderField = {
  key: string
  label: string
  placeholder: string
  type?: string
  optional?: boolean
  helpText?: string
  defaultValue?: string
  validate?: (value: string) => string | null
}

export const MDM_PROVIDER_FIELDS: Record<number, MdmProviderField[]> = {
  1: [
    {
      key: "instance_url",
      label: "Instance URL",
      placeholder: "https://yourcompany.jamfcloud.com",
      validate: (v) =>
        isValidHttpsUrl(v) ? null : "Enter a valid https:// URL, e.g. https://yourcompany.jamfcloud.com",
    },
    { key: "client_id", label: "Client ID", placeholder: "Enter your Jamf API client ID" },
    { key: "client_secret", label: "Client Secret", placeholder: "Enter your Jamf API client secret", type: "password" },
  ],
  2: [
    { key: "tenant_id",     label: "Directory (tenant) ID",   placeholder: "Enter your Microsoft Entra directory (tenant) ID" },
    { key: "client_id",     label: "Application (client) ID", placeholder: "Enter your Microsoft Entra application (client) ID" },
    { key: "client_secret", label: "Client secret",           placeholder: "Enter your Microsoft Entra client secret", type: "password" },
  ],
  3: [
    {
      key: "base_url",
      label: "Console URL",
      placeholder: "https://console.jumpcloud.com",
      // Pre-filled: nearly every customer is on the US console; EU/India only swap
      // the host. A path/query is rejected because the sync appends its own API
      // paths — a pasted .../login or .../api would 404 with no customer-visible
      // banner (the data plane can't distinguish it from an outage).
      defaultValue: "https://console.jumpcloud.com",
      validate: (v) => {
        try {
          const u = new URL(v)
          if (!isValidHttpsUrl(v)) return "Enter a valid https:// URL, e.g. https://console.jumpcloud.com"
          // Reject any path, query or fragment (a URL copied from the console's address
          // bar carries a #/... route; Go would then request "/" and get HTML back).
          if ((u.pathname !== "/" && u.pathname !== "") || u.search || u.hash || /[?#]/.test(v)) {
            return "Enter just the console URL without a path, e.g. https://console.jumpcloud.com"
          }
          return null
        } catch {
          return "Enter a valid https:// URL, e.g. https://console.jumpcloud.com"
        }
      },
    },
    { key: "api_key", label: "API Key", placeholder: "Enter your JumpCloud API key", type: "password" },
    // Only MSP multi-tenant admin keys need an org id (sent as x-org-id by the sync);
    // single-tenant orgs leave it blank.
    {
      key: "org_id",
      label: "Organization ID",
      placeholder: "Enter your JumpCloud organization ID",
      optional: true,
      helpText:
        "Leave blank unless your account manages multiple JumpCloud organizations. Found in the JumpCloud Admin Portal under Settings.",
    },
  ],
  // NinjaOne (formerly NinjaRMM). The API host is the customer's regional console
  // host ("found on the login URL": app / us2 / eu / ca / oc / jp / fed
  // .ninjarmm.com) and the OAuth client app only works on its own instance. Keys
  // match the Go NinjaOneCredentials json tags; the client app is created as
  // "API Services (machine-to-machine)" with the Monitoring (read-only) scope.
  5: [
    {
      key: "instance_url",
      label: "Instance URL",
      placeholder: "https://app.ninjarmm.com",
      // Deliberately NOT pre-filled (unlike JumpCloud's Console URL): NinjaOne
      // spans seven regional instances with no evidence most customers are on
      // app.ninjarmm.com, OAuth client apps only work on their own instance, and
      // a wrong-region default fails as a credentials error rather than a URL
      // one. A defaultValue here would also be the first on a key another
      // provider shares (Jamf's instance_url), which the Add dialog's
      // merge-on-provider-switch would carry across. Path rejection isn't
      // needed here (unlike JumpCloud, whose sync uses the URL as given) — the
      // sync normalizes to scheme://host.
      validate: (v) =>
        isValidHttpsUrlOrHost(v) ? null : "Enter your NinjaOne instance URL, e.g. https://app.ninjarmm.com",
    },
    { key: "client_id", label: "Client ID", placeholder: "Enter your NinjaOne client ID" },
    { key: "client_secret", label: "Client Secret", placeholder: "Enter your NinjaOne client secret", type: "password" },
    // NinjaOne is MSP-first: one instance can host many organizations, and an
    // unscoped sync of an MSP-managed instance would pull other companies'
    // devices. Optional, like JumpCloud's org_id — blank syncs the whole
    // instance (the single-organization common case).
    {
      key: "organization_id",
      label: "Organization ID",
      placeholder: "Enter your NinjaOne organization ID",
      optional: true,
      helpText:
        "Leave blank unless your NinjaOne instance manages multiple organizations. When set, only that organization's devices are synced.",
    },
  ],
  // Mosyle Business. The API host is fixed (businessapi.mosyle.com) so there is no
  // URL field; the API requires all three values together — the access token
  // identifies the tenant integration and the admin account authenticates the
  // mandatory JWT login. Keys match the Go MosyleCredentials json tags.
  6: [
    { key: "access_token", label: "API Access Token", placeholder: "Enter your Mosyle API access token", type: "password" },
    { key: "email", label: "Admin Email", placeholder: "Enter your Mosyle admin email" },
    { key: "password", label: "Admin Password", placeholder: "Enter your Mosyle admin password", type: "password" },
  ],
  // Iru (formerly Kandji). The API URL is tenant-specific and shown verbatim in the
  // customer's console (Account -> Access) — accept the full URL, since tenants span
  // several hostname forms (api.kandji.io / api.eu.kandji.io / api.iru.com). The
  // token needs the "Device list" endpoint permission enabled.
  7: [
    {
      key: "api_url",
      label: "API URL",
      placeholder: "https://yourcompany.api.kandji.io",
      // The Iru console shows this value as a bare hostname ("yourcompany.api.kandji.io"),
      // so accept it without a scheme; the sync normalizes to https://host either way.
      validate: (v) =>
        isValidHttpsUrlOrHost(v) ? null : "Enter your Iru API URL, e.g. https://yourcompany.api.kandji.io",
    },
    { key: "api_token", label: "API Token", placeholder: "Enter your Iru API token", type: "password" },
  ],
}

// Label of the provider's URL credential field (key ending in "_url"), so error copy
// can name the field the customer actually saw ("Instance URL" for Jamf, "Console
// URL" for JumpCloud) instead of hardcoding one provider's wording. Falls back to
// "URL" for providers without a URL field.
export const getMdmUrlFieldLabel = (provider: number): string =>
  MDM_PROVIDER_FIELDS[provider]?.find((f) => f.key.endsWith("_url"))?.label ?? "URL"

// Pre-fillable defaults for the Add form, from MdmProviderField.defaultValue.
export const getMdmDefaultCredentials = (provider: number): Record<string, string> =>
  Object.fromEntries(
    (MDM_PROVIDER_FIELDS[provider] ?? [])
      .filter((f) => f.defaultValue)
      .map((f) => [f.key, f.defaultValue as string])
  )

// ============================================================================
// CUSTOMER STORAGE UTILITIES
// ============================================================================

export const CUSTOMER_STORAGE_PROVIDER_MAP: Record<number, string> = {
  1: "Google Cloud Storage",
  2: "Amazon S3",
  3: "Azure Blob Storage",
}

export const CUSTOMER_STORAGE_PROVIDER_OPTIONS = Object.entries(CUSTOMER_STORAGE_PROVIDER_MAP).map(([value, label]) => ({ value, label }))

export const getCustomerStorageProviderLabel = (type: number | undefined): string => {
  if (!type) return "Unknown"
  return CUSTOMER_STORAGE_PROVIDER_MAP[type] || "Unknown"
}

export const CUSTOMER_STORAGE_PROVIDER_FIELDS: Record<number, { key: string; label: string; placeholder: string; type?: string }[]> = {
  1: [
    { key: "bucket", label: "Bucket Name", placeholder: "my-audit-bucket" },
    { key: "key_prefix", label: "Key Prefix", placeholder: "traceforce/logs (optional)" },
  ],
  2: [
    { key: "bucket", label: "Bucket Name", placeholder: "my-audit-bucket" },
    { key: "region", label: "Region", placeholder: "us-east-1" },
    { key: "key_prefix", label: "Key Prefix", placeholder: "traceforce/logs (optional)" },
  ],
  3: [
    { key: "account", label: "Storage Account Name", placeholder: "myauditaccount" },
    { key: "container", label: "Container Name", placeholder: "audit-logs" },
    { key: "tenant_id", label: "Directory (Entra) Tenant ID", placeholder: "00000000-0000-0000-0000-000000000000" },
    { key: "key_prefix", label: "Key Prefix", placeholder: "traceforce/logs (optional)" },
  ],
}

/** Result of validating an Azure name field: normalized is the trimmed/lowercased value to
 *  actually save (only meaningful when error is null -- never save the raw input, or a value
 *  like "  Traceforce-Logs  " passes the check but gets persisted with the spaces/casing that
 *  made it invalid in the first place). */
export interface AzureNameValidation {
  normalized: string
  error: string | null
}

// Account name isn't checked here: the API already trims, lowercases and validates it on save
// (returning field: "config.account" on a bad value, which the inline field-error handling in
// saveCustomerStorage already surfaces), so a second client-side copy of the same rule would
// just be duplicated logic to keep in sync. Container has no such API-side check yet, so it
// still needs one here.

// Azure Storage container name rule (Microsoft Learn): 3-63 lowercase letters/digits/hyphens,
// starting with a letter or digit, no consecutive hyphens (so no trailing hyphen either).
// Azure's own reserved containers ($root, $web, $logs, $blobchangefeed) are deliberately NOT
// accepted: this module doesn't support pointing a customer's logs at one of Azure's own
// system/reserved containers (matches common/azurewif.ValidateContainerName's final behavior
// in the lakehouse-export repo -- an earlier version of that function allowlisted $root, since
// reverted).
const AZURE_CONTAINER_NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

export const validateAzureContainerName = (container: string): AzureNameValidation => {
  const normalized = container.trim().toLowerCase()
  if (normalized.length < 3 || normalized.length > 63 || !AZURE_CONTAINER_NAME_PATTERN.test(normalized)) {
    return { normalized, error: "Invalid container name: must be 3-63 lowercase letters, digits or hyphens, starting with a letter or digit and with no consecutive hyphens" }
  }
  return { normalized, error: null }
}

// Sensitive data findings
export const ISSUE_DETAIL_TO_CATEGORY: Record<number, number> = {
  81: 3, // Contact PII
  82: 2, // Identity & Financial PII
  83: 1, // Credentials
}

// Connector Risk Containment (rule 19) issue details — Incidents expand UI.
// Incidents are category-based (issue_detail 181-184, one per RiskyActionCategory).
// op is kept on finding rows for backwards compatibility but no longer mints
// incidents.
export const CONTAINMENT_ISSUE_DETAILS = new Set([181, 182, 183, 184])

// Maps a rule-19 category issue_detail (181-184) to its RiskyActionCategory id
// (1-4). The mapping is by NAME, not arithmetic: the issue_detail band is
// least->most severe while the category ids are severity-first, so they do not
// line up numerically (mirrors the lambda's containmentCategoryIssueDetail).
// Used to fetch a category incident's findings (filtered by risky_action_category).
// SD-style: each issue_detail row also carries the requirement dial (expected_value)
// and the category name shown in Agent Issues (issue_types.name). 180 = NONE_DETECTED.
export const CONTAINMENT_ISSUE_DETAIL_TO_CATEGORY: Record<number, number> = {
  181: 4, // Device or developer environment changed
  182: 3, // Device defenses disabled, or the device wiped
  183: 2, // Company systems changed
  184: 1, // Company data or infrastructure destroyed
}

// Rule-19 enforcing dial: issue_detail 180 = NONE_DETECTED. scout's
// DialEnforcesOperationKey enforces write + delete only when the dial is 180;
// the category values 181-184 enforce nothing. Categories/subcategories drive
// detection and the Requirement select is removed for rule 19, so the control is
// pinned to 180 (when that option exists) to enforce every selected subcategory.
export const CONTAINMENT_ISSUE_DETAIL_NONE_DETECTED = 180

// Prompt Injection Resilience (rule 36) issue details — Incidents expand UI.
// Only the event-driven DETECTED tier (212) surfaces findings to expand; the
// posture tiers (210 not-detected / 211 blocking-configurable) grade the
// resilience score and carry no per-conversation evidence.
export const PROMPT_INJECTION_ISSUE_DETAILS = new Set([212])

export const CONTAINMENT_OP_LABELS: Record<ContainmentOp, string> = {
  write: "Write",
  delete: "Delete",
}

// ============================================================================
// RISKY ACTION HANDLING (rule 19) custom-control metadata.
// A set of categories, each holding numeric subcategory ids. Each category has a
// master toggle (Switch) plus per-subcategory checkboxes. The selection persists
// to policy_controls.settings.enabled_risky_action_subcategories as a FLAT array
// of the detected (checked) subcategory ids — the "included" allowlist, mirroring
// Sensitive Data (see the selection-shape note below). Absent/null means every
// subcategory is detected (all on); a non-empty number[] is the explicit included
// set. An empty array is NOT a persisted "detect nothing":
// normalizeRiskyActionSubcategories collapses [] (and "all supported") back to
// null (= all), so [] exists only as transient editor state. A category's Switch
// adds/removes that category's subcategory ids in the flat set; bulk toggles do
// NOT separately remember individually-removed picks.
//
// Ids mirror scout-proto RiskyActionCategory / RiskyActionSubcategory: categories
// 1-4, subcategories banded by category (100s / 200s / 300s / 400s). Keep in sync
// when either side changes.
// ============================================================================

export const RISKY_ACTION_CATEGORY_LABELS: Record<number, string> = {
  1: "Company data or infrastructure destroyed",
  2: "Company data or infrastructure changed",
  3: "Device protections disabled or device wiped",
  4: "Device settings or local environment changed",
}

// Category id -> ordered list of RiskyActionSubcategory numeric ids (mirrors scout.proto)
export const RISKY_ACTION_SUBCATEGORIES_BY_CATEGORY: Record<number, number[]> = {
  1: [100, 101, 102],
  2: [200, 201, 202, 203, 204],
  3: [300, 301, 302, 303],
  4: [400, 401, 402, 403, 404, 405],
}

export const RISKY_ACTION_SUBCATEGORY_LABELS: Record<number, string> = {
  // Company data or infrastructure destroyed (category 1)
  100: "Deletes database data",
  101: "Destroys cloud infrastructure",
  102: "Deletes connected tool records",
  // Company data or infrastructure changed (category 2)
  200: "Changes cloud resources",
  201: "Changes a database",
  202: "Rewrites shared git history",
  203: "Creates or updates connected tool records",
  204: "Runs commands via connected tools",
  // Device protections disabled or device wiped (category 3)
  300: "Disables OS security features",
  301: "Wipes a disk or home folder",
  302: "Runs downloaded code",
  303: "Weakens file or system permissions",
  // Device settings or local environment changed (category 4)
  400: "Stops processes or services",
  401: "Changes system or network settings",
  402: "Installs system software",
  403: "Discards local git changes",
  404: "Changes a local database",
  405: "Changes data through a local connector",
}

// The containment findings REST API speaks string enum NAMES for
// risky_action_category/subcategory (mirroring Sensitive Data and the lakehouse
// export). These bridge the wire names to the numeric ids the label maps above use
// (and back, for the counts filter). Keep in sync with scout.proto / the nextjs
// api-mappings.ts RiskyAction block.
export const RISKY_ACTION_CATEGORY_API_TO_NUM: Record<string, number> = {
  company_data_or_infra_destroyed: 1,
  company_systems_changed: 2,
  device_defenses_disabled_or_wiped: 3,
  device_or_dev_env_changed: 4,
}
export const RISKY_ACTION_CATEGORY_NUM_TO_API: Record<number, string> = Object.fromEntries(
  Object.entries(RISKY_ACTION_CATEGORY_API_TO_NUM).map(([name, num]) => [num, name])
)
export const RISKY_ACTION_SUBCATEGORY_API_TO_NUM: Record<string, number> = {
  shared_db_destroyed: 100,
  cloud_infra_destroyed: 101,
  connector_records_deleted: 102,
  cloud_resources_changed: 200,
  shared_db_written: 201,
  shared_repo_history: 202,
  connector_records_written: 203,
  connector_commands_run: 204,
  core_protection_off: 300,
  device_wiped: 301,
  downloaded_code_run: 302,
  protection_loosened: 303,
  processes_services_stopped: 400,
  device_settings_changed: 401,
  software_installed: 402,
  local_work_discarded: 403,
  local_db_changed: 404,
  local_connector_writes: 405,
}

// Every risky-action subcategory id. The checklist is NOT scoped by the
// Requirement (unlike Sensitive Data), so this is the full "all" set that an
// absent settings.enabled_risky_action_subcategories key resolves to.
export const RISKY_ACTION_ALL_SUBCATEGORY_IDS: number[] = Object.values(
  RISKY_ACTION_SUBCATEGORIES_BY_CATEGORY
).flat()

// ---------------------------------------------------------------------------
// Selection shape: settings.enabled_risky_action_subcategories
//
//   null / absent  -> every subcategory detected (all on)
//   number[]       -> the explicit "included" set of detected subcategory ids
//
// Flat included allowlist, same shape/contract as enabled_sensitive_data_types
// (and what the get_enforcement_controls RPC union-merges). The per-category
// Switch in the UI is a bulk add/remove over this list; a category reads as "on"
// when any of its supported subcategories are selected. Storing the selected ids
// (rather than exclusions) means the device enforces the list directly and derives
// each finding's category from the subcategory band (floor(id/100)).
// ---------------------------------------------------------------------------

// Reads a stored "included" allowlist into its canonical form:
//   null      -> all detected (absent / non-array / empty raw array / covers every id)
//   number[]  -> the explicit included set (deduped, known ids only)
//   []        -> a NON-EMPTY raw array that contained no known ids: an explicit
//                (invalid) selection kept empty so the Save gate blocks it instead
//                of silently widening enforcement to "all".
// Set-valued, so ids are deduped before the "covers all" check: duplicate ids must
// not inflate the count and make a partial selection read as "all".
const normalizeAllowlist = (raw: unknown, allIds: number[]): number[] | null => {
  if (!Array.isArray(raw)) return null
  const all = new Set(allIds)
  const ids = Array.from(new Set(raw.filter((v): v is number => typeof v === 'number' && all.has(v))))
  if (ids.length === 0) return raw.length === 0 ? null : []
  return ids.length === all.size ? null : ids
}

/** Risky Action subcategory allowlist (settings.enabled_risky_action_subcategories). */
export const normalizeRiskyActionSubcategories = (raw: unknown): number[] | null =>
  normalizeAllowlist(raw, RISKY_ACTION_ALL_SUBCATEGORY_IDS)

export const SENSITIVE_DATA_TYPE_LABELS: Record<number, string> = {
  1: "API Key",
  2: "Private Key",
  3: "Password",
  4: "Database Connection String",
  100: "SSN",
  101: "Credit Card",
  102: "Bank Account Number",
  103: "Government ID",
  200: "Email Address",
  201: "Phone Number",
  202: "Physical Address",
}

export const SENSITIVE_DATA_CATEGORY_LABELS: Record<number, string> = {
  1: "Credentials",
  2: "Identity & Financial PII",
  3: "Contact PII",
}

// Category id -> ordered list of SensitiveDataType numeric ids (mirrors scout.proto)
export const SENSITIVE_DATA_TYPES_BY_CATEGORY: Record<number, number[]> = {
  1: [1, 2, 3, 4],         // API Key, Private Key, Password, DB Connection String
  2: [100, 101, 102, 103], // SSN, Credit Card, Bank Account, Government ID
  3: [200, 201, 202],      // Email, Phone, Physical Address
}

// ============================================================================
// SENSITIVE DATA HANDLING (rule 9) custom-control metadata — the rule-19 mirror.
// Rule 9 uses a single on/off dial pinned to issue_detail 80 (NONE_DETECTED =
// all categories enforced) plus a per-Category Switch + per-Type checkboxes over
// the flat settings.enabled_sensitive_data_types allowlist (null/absent = all
// types detected). SensitiveDataType is the analog of RiskyActionSubcategory, so
// these helpers mirror the RISKY_ACTION_* ones above. Keep in sync with
// scout-proto SensitiveDataCategory / SensitiveDataType.
// ============================================================================

// Rule-9 enforcing dial: issue_detail 80 = NONE_DETECTED. scout's
// sdcategory.Enforced enforces every category at 80; the per-Type allowlist
// narrows within it. The Requirement select is removed for rule 9 (mirroring
// rule 19's pin to 180), so an enabled control is pinned to 80. Off still rides
// the disabledOption (highest trigger_score) + remediation None, unchanged.
export const SENSITIVE_DATA_ISSUE_DETAIL_ALL = 80

// Every sensitive-data type id — the full "all" set an absent
// settings.enabled_sensitive_data_types key resolves to.
export const SENSITIVE_DATA_ALL_TYPE_IDS: number[] = Object.values(
  SENSITIVE_DATA_TYPES_BY_CATEGORY
).flat()

// ---------------------------------------------------------------------------
// Selection shape: settings.enabled_sensitive_data_types
//
//   null / absent  -> every type detected (all on)
//   number[]       -> the explicit "included" set of detected type ids
//
// Flat included allowlist, same shape/contract as
// enabled_risky_action_subcategories (and what the get_enforcement_controls RPC
// union-merges). The per-Category Switch in the UI is a bulk add/remove over
// this list; a category reads as "on" when any of its supported types are
// selected.
// ---------------------------------------------------------------------------

/** Sensitive Data type allowlist (settings.enabled_sensitive_data_types). */
export const normalizeSensitiveDataTypes = (raw: unknown): number[] | null =>
  normalizeAllowlist(raw, SENSITIVE_DATA_ALL_TYPE_IDS)

export const FINDING_STATUS_LABELS: Record<number, string> = {
  1: "Awaiting Review",
  2: "Under Review",
  3: "False Positive",
  4: "Revoked",
  5: "Used in Tests",
  6: "Won't Fix",
  7: "Acknowledged",
}

// The findings REST API speaks string enums; internal state and the label/badge
// maps above are keyed by the numeric values.
export const SENSITIVE_DATA_CATEGORY_API_STRINGS: Record<number, string> = {
  1: "credentials",
  2: "identity_financial_pii",
  3: "contact_pii",
}

export const SENSITIVE_DATA_TYPE_API_TO_NUM: Record<string, number> = {
  api_key: 1,
  private_key: 2,
  password: 3,
  database_connection_string: 4,
  ssn: 100,
  credit_card: 101,
  bank_account_number: 102,
  government_id: 103,
  email_address: 200,
  phone_number: 201,
  physical_address: 202,
}

export const FINDING_STATUS_API_TO_NUM: Record<string, number> = {
  awaiting_review: 1,
  under_review: 2,
  false_positive: 3,
  revoked: 4,
  used_in_tests: 5,
  wont_fix: 6,
  acknowledged: 7,
}

export const FINDING_STATUS_NUM_TO_API: Record<number, string> = Object.fromEntries(
  Object.entries(FINDING_STATUS_API_TO_NUM).map(([k, v]) => [v, k])
)

export const OPEN_FINDING_STATUSES_API = ["awaiting_review", "under_review"]
export const CLOSED_FINDING_STATUSES_API = ["false_positive", "revoked", "used_in_tests", "wont_fix", "acknowledged"]

// Badge coloring for open-work / all-resolved rollups (accounts, containers).
export const OPEN_COUNT_BADGE_CLASS = "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800"
export const RESOLVED_BADGE_CLASS = "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800"

// Status options by category
export const CREDENTIAL_STATUS_OPTIONS = [
  { value: 4, label: "Revoked" },
  { value: 5, label: "Used in Tests" },
  { value: 3, label: "False Positive" },
  { value: 6, label: "Won't Fix" },
]

export const PII_STATUS_OPTIONS = [
  { value: 3, label: "False Positive" },
  { value: 7, label: "Acknowledged" },
]

// Containment close reasons: the shared finding-status vocabulary minus the
// credential-specific reasons — mirrors the API's containment close schema
// (ContainmentCloseRequestSchema), which rejects revoked/used_in_tests.
export const CONTAINMENT_STATUS_OPTIONS = [
  { value: 3, label: "False Positive" },
  { value: 6, label: "Won't Fix" },
  { value: 7, label: "Acknowledged" },
]

export const FINDING_STATUS_DESCRIPTIONS: Record<number, string> = {
  3: "This alert is not valid",
  4: "This secret has been revoked",
  5: "This secret is not in production code",
  6: "This alert is not relevant",
  7: "This alert has been acknowledged",
}

export const getStatusOptionsForCategory = (category: number) => {
  switch (category) {
    case 1: // Credentials
      return CREDENTIAL_STATUS_OPTIONS
    case 2: // Identity & Financial PII
    case 3: // Contact PII
      return PII_STATUS_OPTIONS
    default:
      return []
  }
}

export const getFindingStatusBadgeClass = (status: number): string => {
  switch (status) {
    case 1: return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800"
    case 2: return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800"
    case 3: return "bg-muted text-muted-foreground border-border"
    case 4: return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800"
    case 5: return "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800"
    case 6: return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400 border-gray-200 dark:border-gray-800"
    case 7: return "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400 border-slate-200 dark:border-slate-800"
    default: return "bg-muted text-muted-foreground"
  }
}

export const formatStoragePath = (storage: any): string | null => {
  if (!storage) return null
  switch (storage.provider) {
    case 1: { // GCS
      if (!storage.bucket || !storage.source_file) return null
      const prefix = (storage.key_prefix || '').replace(/\/+$/, '')
      const objectPath = prefix ? `${prefix}/${storage.source_file}` : storage.source_file
      return `gs://${storage.bucket}/${objectPath}`
    }
    case 2: { // S3
      if (!storage.bucket || !storage.source_file) return null
      const prefix = (storage.key_prefix || '').replace(/\/+$/, '')
      const objectPath = prefix ? `${prefix}/${storage.source_file}` : storage.source_file
      return `s3://${storage.bucket}/${objectPath}`
    }
    case 3: { // Azure Blob Storage
      if (!storage.account || !storage.container || !storage.source_file) return null
      const prefix = (storage.key_prefix || '').replace(/\/+$/, '')
      const objectPath = prefix ? `${prefix}/${storage.source_file}` : storage.source_file
      return `https://${storage.account}.blob.core.windows.net/${storage.container}/${objectPath}`
    }
    default:
      return null
  }
}

// Device picker options: owner or hostname, then serial.
export const deviceOptions = (
  devices: { id: string; device_native_id: string; friendly_name?: string | null; owner_email?: string | null }[],
): { id: string; name: string }[] =>
  devices.map(d => ({
    id: d.id,
    name: d.owner_email
      ? `${d.owner_email} (${d.device_native_id})`
      : d.friendly_name
        ? `${d.friendly_name} (${d.device_native_id})`
        : d.device_native_id,
  }))

// ---------------------------------------------------------------------------
// OpenTelemetry export (OTel chaining)
// ---------------------------------------------------------------------------

/** The backend allows multiple destinations; the UI shows one at a time for now, so the Add
 * button hides once a destination exists. Enforced UI-only. */
export const OTEL_MAX_DESTINATIONS = 1

/** User Activity Logging risk-rule type; the control that stores a policy's OTLP destination. */
export const USER_ACTIVITY_LOGGING_RISK_RULE_TYPE = 16

export const OTEL_PROTOCOL_OPTIONS: { value: OtelProtocol; label: string }[] = [
  { value: "http/protobuf", label: "HTTP/protobuf" },
  { value: "http/json", label: "HTTP/JSON" },
  { value: "grpc", label: "gRPC" },
]

export const getOtelProtocolLabel = (protocol: OtelProtocol | string | undefined): string =>
  OTEL_PROTOCOL_OPTIONS.find((o) => o.value === protocol)?.label ?? String(protocol ?? "")

/**
 * The endpoint is a base OTLP URL (scheme + host + optional port, optionally a vendor path prefix
 * like /otlp): the exporter appends the per-signal path (/v1/logs, /v1/traces, /v1/metrics), so the base must not
 * already include that signal path. Returns an error message or null.
 */
export const validateOtelEndpoint = (value: string): string | null => {
  if (!value) return "Endpoint is required"
  if (value !== value.trim()) return "Remove the leading or trailing spaces"
  if (!/^https?:\/\/\S+$/i.test(value)) return "Enter a base URL starting with https:// or http://"
  let u: URL
  try {
    u = new URL(value)
  } catch {
    return "Enter a base URL starting with https:// or http://"
  }
  if (!u.hostname) return "Enter a base URL starting with https:// or http://"
  if (u.username || u.password) return "Put credentials in OTLP headers, not the endpoint URL"
  // Allow a vendor prefix (Grafana Cloud /otlp, Dynatrace /api/v2/otlp); the exporter appends
  // /v1/<signal>, so reject only an endpoint that already includes the signal path.
  if (/\/v1\/(traces|logs|metrics)\/?$/i.test(u.pathname)) return "Enter the base URL only; the signal path (/v1/logs, /v1/traces, /v1/metrics) is added automatically"
  if (u.search || u.hash) return "Enter the base URL only, without a query or fragment"
  return null
}

/** Display name for a destination: the admin's name, else the endpoint host. */
export const getOtelDestinationName = (d: Pick<OtelDestination, "name" | "endpoint">): string => {
  if (d.name && d.name.trim()) return d.name
  try {
    return new URL(d.endpoint).host
  } catch {
    return d.endpoint
  }
}

/** One-line summary for the Settings tile. Null when nothing is configured (tile shows its pitch). */
export const getOtelSummary = (destinations: OtelDestination[]): string | null => {
  if (destinations.length === 0) return null
  const enabled = destinations.filter((d) => d.enabled).length
  const noun = destinations.length === 1 ? "destination" : "destinations"
  const parts = [`${destinations.length} ${noun}`]
  if (enabled < destinations.length) parts.push(`${enabled} enabled`)
  return parts.join(" · ")
}

/** Navigation state for a link out of a connectors table (the Connectors page
 * or DeviceDetail): where "Back" returns, with that page's query string and its
 * own navigation state (DeviceDetail keeps the Devices list filters there). */
export const connectorsBackState = (location: { pathname: string; search: string; state: unknown }) => ({
  backPath: location.pathname,
  backSearch: location.search.replace(/^\?/, ""),
  backState: location.state,
})

/** The back button for a page opened from a connectors table (source_mcps):
 * the page it came from, with its filters; navigate with `{ state }`. */
export const connectorsBackTarget = (state: unknown): { path: string; label: string; state: unknown } => {
  const s = (state ?? {}) as { backPath?: string; backSearch?: string; backState?: unknown }
  const path = s.backPath || "/mcps"
  return {
    path: `${path}${s.backSearch ? `?${s.backSearch}` : ""}`,
    label: path.startsWith("/devices") ? "Back to device" : "Back to Connectors",
    state: s.backState,
  }
}
