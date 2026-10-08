// Central place for build-time feature flags (Vite env vars). Importing from
// here keeps the flag's env-var name and parsing in one spot instead of being
// re-derived in every consumer.

// Gates the org-access UI (the /org-access add-organization page + OrgContext role bootstrap).
// OFF by default so the feature is inert and the UI behaves exactly as before. Set
// VITE_ENG382_MULTI_ORG="true" per-environment (Vercel) ONLY after the org-access API endpoints
// (POST /api/v1/orgs, GET /api/v1/org-access-grants, DELETE /api/v1/org-access-grants/:id) are live in
// that environment. Gating on the flag decouples merging the UI from the backend deploy order.
export const MULTI_ORG_ENABLED = import.meta.env.VITE_ENG382_MULTI_ORG === 'true';

/**
 * Gates the MCP-access feature: the admin "MCP Access" route/nav, the policy
 * editor, and the regular-user flow (via AuthContext). Off by default; enable
 * with VITE_MCP_ACCESS_ENABLED=true ONLY after the mcp-access API is live in
 * that environment (PUT /api/v1/policies/:id and mcp-catalog?include_scores) —
 * gating on the flag decouples merging the UI from the backend deploy order.
 */
export const mcpAccessEnabled = import.meta.env.VITE_MCP_ACCESS_ENABLED === "true"

/**
 * Gates the Microsoft 365 Copilot integration: the Settings tile, the Dashboard
 * tenants card, Copilot rows and filters on AI Agents, and the Copilot routes.
 * Off by default; it runs on mock data (lib/copilotMock) until the cloud
 * connections API and the collector ingest are live. Enable with
 * VITE_COPILOT_ENABLED=true in preview/dev only until then.
 */
export const copilotEnabled = import.meta.env.VITE_COPILOT_ENABLED === "true"

/**
 * When true, forces useAuth().isRegularUser (overrides JWT entitlement in AuthContext).
 * Set VITE_REGULAR_USER_MODE=true to preview the regular-user experience.
 */
export const REGULAR_USER_MODE = import.meta.env.VITE_REGULAR_USER_MODE === "true"

/**
 * Dev/preview-only runtime view switcher (UserMenu "View as user/admin"):
 * flips the same simulation VITE_REGULAR_USER_MODE forces, without a rebuild.
 * Gated off production the same way as SandboxSetupCard/DownloadScannerDialog;
 * VITE_VERCEL_ENV is statically inlined at build time, so production builds
 * dead-code-eliminate the switcher entirely. UI simulation only — API calls
 * keep the real session.
 */
export const viewSwitcherEnabled = import.meta.env.VITE_VERCEL_ENV !== "production"

/**
 * Shows Google and Microsoft OAuth alongside SSO in non-trial mode.
 * Off by default; enable with VITE_ALLOW_OAUTH=true.
 */
export const OAUTH_IN_NON_TRIAL_ENABLED =
  import.meta.env.VITE_ALLOW_OAUTH === "true"

/**
 * Minutes of user inactivity (no mouse/keyboard/touch) before automatic
 * sign-out, and how many minutes before that the warning dialog shows
 * (ENG-537; NIST 800-63B AAL2 asks for 30). Override per-environment with
 * VITE_IDLE_TIMEOUT_MINUTES / VITE_IDLE_WARNING_MINUTES; set the timeout
 * to 0 to disable idle sign-out entirely.
 */
export const IDLE_TIMEOUT_MINUTES = Number.isFinite(
  Number(import.meta.env.VITE_IDLE_TIMEOUT_MINUTES)
)
  ? Number(import.meta.env.VITE_IDLE_TIMEOUT_MINUTES)
  : 30;

export const IDLE_WARNING_MINUTES = Number.isFinite(
  Number(import.meta.env.VITE_IDLE_WARNING_MINUTES)
)
  ? Number(import.meta.env.VITE_IDLE_WARNING_MINUTES)
  : 2;

/**
 * Gates the AWS Bedrock AgentCore UI: the Settings integration, the AI Agents
 * environment option and the runtime detail pages. Off by default; set
 * VITE_AWS_BEDROCK_ENABLED=true in preview/dev only until the backend ships.
 */
export const awsBedrockEnabled = import.meta.env.VITE_AWS_BEDROCK_ENABLED === "true"
