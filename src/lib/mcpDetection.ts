import { supabase } from "@/integrations/supabase/client";
import { formatScore } from "@/lib/appUtils";
import { fetchAllRows } from "@/lib/supabasePaging";

/**
 * One entry of `mcp_catalog_all.detection_patterns.url_patterns`. A `host`
 * beginning with "." matches that domain and any subdomain; otherwise the host
 * must match exactly. `paths` are prefixes and any one of them qualifies.
 */
export interface McpUrlPattern {
  host: string;
  paths?: string[];
}

/** The whole `detection_patterns` column; only URLs are observable for a remote MCP. */
export interface McpDetectionPatterns {
  url_patterns?: McpUrlPattern[];
  package_patterns?: string[];
  is_bridge_proxy?: boolean;
}

export interface McpDetectionEntry {
  mcpServerType: number;
  name: string;
  categoryName: string | null;
  urlPatterns: McpUrlPattern[];
}

interface McpCatalogRow {
  mcp_server_type: number;
  mcp_server_name: string | null;
  category_id: string | null;
  detection_patterns: McpDetectionPatterns | null;
}

/**
 * The whole catalog visible to the active org (global rows + that org's own),
 * paged past PostgREST's row cap. The org filter matches mcpCatalog.ts: a
 * multi-org admin can read several orgs' private rows, and only the active
 * org's may be used.
 */
export async function fetchMcpDetectionCatalog(orgId: string): Promise<McpDetectionEntry[]> {
  const [catalogRows, categoryResult] = await Promise.all([
    fetchAllRows<McpCatalogRow>((from, to) =>
      supabase
        .from("mcp_catalog_all")
        .select("mcp_server_type, mcp_server_name, category_id, detection_patterns")
        .or(`org_id.is.null,org_id.eq.${orgId}`)
        .order("mcp_server_type", { ascending: true })
        .range(from, to) as unknown as PromiseLike<{ data: McpCatalogRow[] | null; error: { message: string } | null }>,
    ),
    supabase.from("mcp_categories").select("id, name"),
  ]);

  if (categoryResult.error) throw categoryResult.error;

  const categoryNames = new Map((categoryResult.data ?? []).map((c) => [c.id, c.name]));

  // Rows whose patterns only cover packages (stdio servers) can never match a
  // URL, so they are dropped rather than carried through every lookup.
  return catalogRows.flatMap((row) => {
    const urlPatterns = (row.detection_patterns?.url_patterns ?? []).filter(
      (pattern) => typeof pattern?.host === "string" && pattern.host.length > 0,
    );
    if (urlPatterns.length === 0) return [];
    return [
      {
        mcpServerType: row.mcp_server_type,
        name: row.mcp_server_name ?? "Unknown",
        categoryName: (row.category_id && categoryNames.get(row.category_id)) || null,
        urlPatterns,
      },
    ];
  });
}

/** What the org already knows about an MCP type, independent of any one agent. */
export interface McpOrgRollup {
  distributionChannels: number[];
  baseScore: number | null;
  actualScore: number | null;
}

/**
 * Channels and risk scores the org has actually observed, keyed by MCP type.
 * `active_mcp_servers` carries the same scores AgentDetail reads and already
 * rolls up the channels it builds by hand from the instance rows.
 */
export async function fetchOrgMcpRollup(orgId: string): Promise<Map<number, McpOrgRollup>> {
  const { data, error } = await supabase
    .from("active_mcp_servers")
    .select("mcp_server_type, distribution_channels, base_score, actual_score")
    .eq("org_id", orgId);

  if (error) throw error;

  const byType = new Map<number, McpOrgRollup>();
  for (const row of data ?? []) {
    if (row.mcp_server_type == null) continue;
    const rollup = byType.get(row.mcp_server_type) ?? {
      distributionChannels: [],
      baseScore: null,
      actualScore: null,
    };
    const channels = new Set(rollup.distributionChannels);
    if (Array.isArray(row.distribution_channels)) {
      for (const channel of row.distribution_channels) {
        if (typeof channel === "number") channels.add(channel);
      }
    }
    byType.set(row.mcp_server_type, {
      distributionChannels: [...channels],
      baseScore: rollup.baseScore ?? formatScore(row.base_score),
      actualScore: rollup.actualScore ?? formatScore(row.actual_score),
    });
  }
  return byType;
}

const hostMatches = (host: string, pattern: string) => {
  const suffix = pattern.toLowerCase();
  return suffix.startsWith(".")
    ? host === suffix.slice(1) || host.endsWith(suffix)
    : host === suffix;
};

const pathMatches = (path: string, prefixes?: string[]) =>
  !prefixes?.length || prefixes.some((prefix) => path.startsWith(prefix));

/**
 * Resolves a URL to its catalog entry, preferring the most specific pattern:
 * several entries can claim the same host (`.amazonaws.com` covers every AWS
 * service), so a pattern that also pins the path, and then a longer host, wins.
 */
export function detectMcpServerType(
  url: string,
  catalog: McpDetectionEntry[],
): McpDetectionEntry | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const host = parsed.hostname.toLowerCase();

  let best: McpDetectionEntry | null = null;
  let bestScore = -1;
  for (const entry of catalog) {
    for (const pattern of entry.urlPatterns) {
      if (!hostMatches(host, pattern.host) || !pathMatches(parsed.pathname, pattern.paths)) {
        continue;
      }
      const score = pattern.host.length + (pattern.paths?.length ? 1000 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = entry;
      }
    }
  }
  return best;
}
