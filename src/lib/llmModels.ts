// Shared helpers for the LLM Models feature (inventory, registry, detail).
import type { LlmCatalogEntryDto, LlmModelDto, LlmModelInstanceDto, LlmWeight } from "@/integrations/traceforce/types"
import { getCategoryColor } from "@/lib/appUtils"

/** Per-org feature flag for the LLM Models UI. Every LLM surface is gated on it.
 * Separate from enable_llm_discovery (on-device collection), so an org can
 * collect before the pages are shown, or hide the pages without stopping
 * collection. */
export const LLM_UI_FLAG = 'enable_llm_models_ui'

/** Model types that are not a single catalog model: Unknown (no model name seen) and
 * Custom (every model that is not in the catalog), like MCP's CUSTOM_MCP_SERVER_TYPE. */
export const UNKNOWN_LLM_MODEL_TYPE = 0
export const CUSTOM_LLM_MODEL_TYPE = 999999999
export const isUnlistedLlmModelType = (type: number): boolean =>
  type === UNKNOWN_LLM_MODEL_TYPE || type === CUSTOM_LLM_MODEL_TYPE

/** Display shape for an LLM model on the registry pages, mapped from the catalog DTO. */
export interface LlmModel {
  id: string
  llm_model_type: number
  model_name: string
  publisher: string
  origin: string
  weight: string
  deployment_types: string[]
  logo_url?: string
}

/** Map the API `weight` string enum ('open' | 'closed' | 'restricted') to its
 * badge label; null/undefined (no catalog row) reads as Unknown. */
export const weightLabel = (weight: LlmWeight | null | undefined): string => {
  switch (weight) {
    case 'open': return 'Open'
    case 'closed': return 'Closed'
    case 'restricted': return 'Restricted'
    default: return 'Unknown'
  }
}

/** Count occurrences of each label and shape them for DistributionCard (sorted desc,
 * colored like the MCP charts). */
export const toDistribution = (items: string[]): { name: string; value: number; color: string }[] => {
  const counts = new Map<string, number>()
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1)
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, value], i) => ({ name, value, color: getCategoryColor(i) }))
}

/** Scope the org's models to the given devices' instances, as the MCP device tab
 * and device filter do: keep the types seen there and show those devices' API
 * hosts, instance count and first/last seen instead of the org-wide values. */
export const scopeModelsToDevices = (models: LlmModelDto[], instances: LlmModelInstanceDto[]): LlmModelDto[] => {
  const byType = new Map<number, { hosts: Set<string>; count: number; first: string; last: string }>()
  for (const i of instances) {
    const t = byType.get(i.llm_model_type)
    if (!t) {
      byType.set(i.llm_model_type, { hosts: new Set([i.api_host]), count: 1, first: i.first_seen_at, last: i.last_seen_at })
      continue
    }
    t.hosts.add(i.api_host)
    t.count++
    if (i.first_seen_at < t.first) t.first = i.first_seen_at
    if (i.last_seen_at > t.last) t.last = i.last_seen_at
  }
  return models.flatMap((m) => {
    const t = byType.get(m.llm_model_type)
    return t ? [{ ...m, api_hosts: [...t.hosts].sort(), instance_count: t.count, first_seen_at: t.first, last_seen_at: t.last }] : []
  })
}

/** One device that used a model name, for the Custom page's per-name dialog. */
export interface LlmModelNameDevice {
  device_id: string | null
  device_native_id: string | null
  device_owner_email: string | null
  api_hosts: string[]
  last_seen_at: string
}

/** One row per model name seen under a type. Custom groups many different models,
 * so its page lists them by name with the devices that used each. */
export interface LlmModelNameRow {
  name: string
  api_hosts: string[]
  last_seen_at: string
  devices: LlmModelNameDevice[]
}

export const groupInstancesByName = (instances: LlmModelInstanceDto[]): LlmModelNameRow[] => {
  const byName = new Map<string, Map<string, LlmModelNameDevice>>()
  for (const i of instances) {
    const devices = byName.get(i.llm_model_native_id) ?? new Map<string, LlmModelNameDevice>()
    byName.set(i.llm_model_native_id, devices)
    const key = i.device_id ?? `native:${i.device_native_id ?? i.id}`
    const d = devices.get(key)
    if (!d) {
      devices.set(key, { device_id: i.device_id, device_native_id: i.device_native_id, device_owner_email: i.device_owner_email, api_hosts: [i.api_host], last_seen_at: i.last_seen_at })
      continue
    }
    if (!d.api_hosts.includes(i.api_host)) d.api_hosts.push(i.api_host)
    if (i.last_seen_at > d.last_seen_at) d.last_seen_at = i.last_seen_at
  }
  return Array.from(byName, ([name, devices]) => {
    const list = Array.from(devices.values()).sort((a, b) => (a.last_seen_at < b.last_seen_at ? 1 : -1))
    return {
      name,
      api_hosts: Array.from(new Set(list.flatMap((d) => d.api_hosts))).sort(),
      last_seen_at: list[0].last_seen_at,
      devices: list,
    }
  }).sort((a, b) => b.devices.length - a.devices.length || a.name.localeCompare(b.name))
}

/** llm_model_type -> catalog logo_url. Logos live only on the catalog (as for
 * MCPs), so inventory rows look them up here by type. */
export const catalogLogosByType = (catalog: LlmCatalogEntryDto[]): Map<number, string> =>
  new Map(catalog.flatMap((e): [number, string][] => (e.logo_url ? [[e.llm_model_type, e.logo_url]] : [])))

/** LlmModel plus the descriptive extras the catalog provides directly. */
export type RegistryModel = LlmModel & { description?: string | null; website?: string | null; model_family?: string | null }

/** Map a catalog entry (GET /api/v1/llm-model-catalog) onto the registry display shape. */
export const catalogToRegistryModel = (dto: LlmCatalogEntryDto): RegistryModel => ({
  id: dto.id,
  llm_model_type: dto.llm_model_type,
  model_name: dto.model_name,
  publisher: dto.publisher ?? 'Unknown',
  model_family: dto.model_family ?? null,
  origin: dto.origin_country ?? 'Unknown',
  weight: weightLabel(dto.weight),
  deployment_types: Array.isArray(dto.hosted_by) ? dto.hosted_by : [],
  logo_url: dto.logo_url ?? undefined,
  description: dto.description,
  website: dto.website,
})
