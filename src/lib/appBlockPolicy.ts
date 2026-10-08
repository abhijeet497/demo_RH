// Model + persistence for the "Blocked AI applications" policy control.
//
// PROXY-based blocking (not MDM): the admin blocks an AI app's NETWORK access by
// ORIGIN (selected countries) and/or by selecting specific apps. Enforcement is by
// the on-device Scout proxy, which drops connections to the app's domains — so it
// covers the desktop app, browser, and CLI, and works even on cert-pinned apps.
//
// The blockable apps + their origins/hosts are REAL data from agent_catalog
// (hosts TEXT[], origin_country) — see use-blockable-agents.ts. This module owns the
// config shape, the resolve logic, and per-policy persistence.
//
// Persistence is per-policy in policies.ai_access_config (JSONB) via the fetch/save
// functions below; the device-config resolver (getBlockedAgentTypesForDevice) reads it
// to derive each device's blocked_agent_types.

// A blockable AI app, projected from an agent_catalog row that has curated hosts.
import { supabase } from "@/integrations/supabase/client"

export interface BlockableApp {
  id: string // agent_type as string — the stable key the proxy blocks by
  name: string // agent_name
  origin: string // origin_country, e.g. "China" ("Unknown" when unset)
  hosts: string[] // the domains the proxy drops
}

// Block config: block apps by ORIGIN (selected countries) and/or by selecting
// SPECIFIC apps. Both are additive — an app is blocked if it matches a selected
// origin OR is explicitly selected.
export interface AppBlockConfig {
  enabled: boolean
  blockByOrigin: boolean // whether the origin filter is active (its toggle)
  blockOrigins: string[] // selected origin_country values
  blockApps: string[] // specific app ids (agent_type strings), additive to origin
}

const emptyConfig = (): AppBlockConfig => ({
  enabled: false,
  blockByOrigin: true,
  blockOrigins: [],
  blockApps: [],
})

// Distinct origins present in the blockable app list, as MultiSelect options.
export function originOptions(apps: BlockableApp[]): { id: string; name: string }[] {
  return Array.from(new Set(apps.map((a) => a.origin)))
    .sort((a, b) => a.localeCompare(b))
    .map((o) => ({ id: o, name: o }))
}

// The blockable apps as MultiSelect options.
export function appOptions(apps: BlockableApp[]): { id: string; name: string }[] {
  return apps
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((a) => ({ id: a.id, name: a.name }))
}

// matchesConfig — the single "blocked by this config" rule, shared by the list and the
// single-agent helpers: an agent matches when it is explicitly selected (blockApps /
// block_agent_types) OR its origin is in a selected origin (blockByOrigin / block_origins).
// It does NOT consider cfg.enabled — callers add that where needed. A null/undefined origin
// normalizes to "Unknown", the SAME mapping use-blockable-agents and the device-config
// resolver (COALESCE(origin_country, 'Unknown')) use, so an unknown-origin agent reads
// consistently everywhere.
export function matchesConfig(
  cfg: AppBlockConfig,
  agentType: number | string,
  originCountry: string | null | undefined,
): boolean {
  const byOrigin = cfg.blockByOrigin && cfg.blockOrigins.includes(originCountry ?? "Unknown")
  return byOrigin || cfg.blockApps.includes(String(agentType))
}

// resolveBlockedApps — the apps a config effectively blocks (origin-matched ∪ explicit).
// Returns BlockableApp[] so callers don't re-map ids back to apps.
export function resolveBlockedApps(cfg: AppBlockConfig, apps: BlockableApp[]): BlockableApp[] {
  return apps.filter((a) => matchesConfig(cfg, a.id, a.origin))
}

// isAgentBlocked — a single agent (by agent_type + origin_country) is blocked when the
// control is enabled AND it matches the config. Used by the AgentsTable column.
export function isAgentBlocked(
  cfg: AppBlockConfig,
  agentType: number | string,
  originCountry: string | null | undefined,
): boolean {
  return cfg.enabled && matchesConfig(cfg, agentType, originCountry)
}

// normalizeConfig merges a stored ai_access_config JSONB (possibly null or partial)
// with defaults, so consumers always get a complete config.
//
// STORED SHAPE (snake_case, int agent types — matches MCP Access / Model Selection):
//   { enabled, block_by_origin, block_origins:[string], block_agent_types:[int] }
// The UI keeps its own camelCase/string shape internally (blockApps = agent_type
// strings), so this maps at the DB boundary; saveAppBlockConfig maps back.
export function normalizeConfig(raw: unknown): AppBlockConfig {
  const base = emptyConfig()
  if (!raw || typeof raw !== "object") return base
  const p = raw as Record<string, unknown>
  return {
    // Strict boolean: the device-config resolver only treats the JSON boolean `true`
    // as enabled (ai_access_config -> 'enabled' = 'true'::jsonb), so a non-boolean
    // truthy value must NOT read as enabled here — that would show "on" in the UI
    // while devices treat it as off.
    enabled: p.enabled === true,
    blockByOrigin: typeof p.block_by_origin === "boolean" ? p.block_by_origin : base.blockByOrigin,
    // Keep only string origins — a hand-edited/corrupt array must not carry non-strings
    // into the origin selection the resolver matches on.
    blockOrigins: Array.isArray(p.block_origins)
      ? p.block_origins.filter((x): x is string => typeof x === "string")
      : base.blockOrigins,
    // Stored as int agent types; the UI works in string ids (agent_type as string).
    // Accept numbers (and numeric strings defensively) and normalize to strings.
    blockApps: Array.isArray(p.block_agent_types)
      ? p.block_agent_types
          .filter((x) => typeof x === "number" || (typeof x === "string" && /^\d+$/.test(x)))
          .map((x) => String(x))
      : base.blockApps,
  }
}

// fetchAppBlockConfig reads the AI Access policy's Blocked-AI-applications selection
// from policies.ai_access_config. policyId is the real category-5 policy's UUID.
export async function fetchAppBlockConfig(policyId: string): Promise<AppBlockConfig> {
  const { data, error } = await supabase
    .from("policies")
    .select("ai_access_config")
    .eq("id", policyId)
    .single()
  // Surface the failure instead of swallowing it: a null from an RLS denial / network
  // error / missing migration must NOT be normalized into a legitimate "disabled"
  // config (which would misreport an unavailable policy as off). The caller renders an
  // unavailable/retry state from the thrown error.
  if (error) throw error
  return normalizeConfig(data?.ai_access_config)
}

// saveAppBlockConfig persists the selection to policies.ai_access_config. The
// device-config resolver (getBlockedAgentTypesForDevice) reads this to tell each
// device which agents to drop.
export async function saveAppBlockConfig(policyId: string, cfg: AppBlockConfig): Promise<void> {
  // Map the UI's internal shape to the stored snake_case shape with INT agent types
  // (matches MCP Access / Model Selection and what the resolver reads).
  const stored = {
    enabled: cfg.enabled,
    block_by_origin: cfg.blockByOrigin,
    block_origins: cfg.blockOrigins,
    block_agent_types: cfg.blockApps
      .map((id) => Number(id))
      .filter((n) => Number.isInteger(n)),
  }
  const { data, error } = await supabase
    .from("policies")
    .update({ ai_access_config: stored as unknown as Record<string, unknown> })
    .eq("id", policyId)
    .select("id")
  // Propagate write failures so the caller can roll back the optimistic update and
  // tell the admin, instead of showing an unsaved change as saved until refresh.
  if (error) throw error
  // RLS can silently narrow the update to zero rows (no error, no write) — e.g. a
  // non-admin, even though the Policies RLS already requires is_admin(). Treat
  // "updated nothing" as a failed write so the optimistic update rolls back rather
  // than showing as saved.
  if (!data || data.length === 0) {
    throw new Error("Update affected no rows — not permitted or policy not found")
  }
}
