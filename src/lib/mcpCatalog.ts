// Combined-catalog reads (ENG org-catalog): mcp_catalog_all UNIONs the global
// catalog (org_id NULL) with each org's private org_mcp_catalog entries. It is
// a UNION view with no PostgREST relationships, so pages cannot embed it the
// way they embedded mcp_catalog!inner — instead they select mcp_server_type
// from their (already org-scoped) parent rows and resolve catalog fields
// through the map returned here. mcp_server_type is the only join key valid
// across both catalogs: org-matched mcp_servers rows carry mcp_catalog_id NULL
// (the FK can only point at the global table), and type bands (global
// < 1,000,000, org >= 1,000,000, Custom sentinel 999,999,999) keep one type
// from ever matching both arms of the UNION.
//
// The explicit org predicate is required even though the view is
// security_invoker: multi-org admins can read several orgs' entries under
// RLS, and only the active org's rows may win.
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { fetchAllRows } from "@/lib/supabasePaging";

// "Combined" (not McpCatalogEntry): use-mcp-access.ts already exports a
// differently-shaped McpCatalogEntry for the REST catalog. Key/name are
// narrowed non-null from the generated view row: view columns type as
// nullable, but both are NOT NULL in both underlying tables.
export interface CombinedCatalogEntry {
  mcp_server_type: number;
  mcp_server_name: string;
  description: string | null;
  website: string | null;
  logo_url: string | null;
  category_id: string | null;
  /** Resolved from mcp_categories; null when the entry has no category. */
  category_name: string | null;
  /** MCPSourceType int enum (5 ChatGPT, 6 Claude); 0 = unknown. */
  source_type: number | null;
  /** NULL for global-catalog rows, the owning org for org-catalog rows. */
  org_id: string | null;
}

type CatalogRow = Pick<
  Database["public"]["Views"]["mcp_catalog_all"]["Row"],
  "mcp_server_type" | "mcp_server_name" | "description" | "website" | "logo_url" | "category_id" | "source_type" | "org_id"
>;

const CATALOG_COLUMNS =
  "mcp_server_type, mcp_server_name, description, website, logo_url, category_id, source_type, org_id";

// Per-request cap for .in() lists: keeps the filter URL-safe, and — since the
// org predicate leaves at most one row per type — each response stays under
// PostgREST's 1000-row cap, so chunks never truncate.
const IN_CHUNK = 500;

/**
 * Fetch the catalog entries visible to `orgId` (global + that org's private
 * entries) keyed by mcp_server_type. Pass `types` to restrict the fetch to the
 * mcp_server_type values a page actually renders; omit it for pickers that
 * list the whole visible catalog.
 */
export async function fetchMcpCatalogMap(
  orgId: string,
  types?: number[],
): Promise<Map<number, CombinedCatalogEntry>> {
  const orgPredicate = `org_id.is.null,org_id.eq.${orgId}`;
  if (types !== undefined && types.length === 0) return new Map();

  const fetchCatalogRows = async (): Promise<CatalogRow[]> => {
    if (types !== undefined) {
      const rows: CatalogRow[] = [];
      for (let i = 0; i < types.length; i += IN_CHUNK) {
        const { data, error } = await supabase
          .from("mcp_catalog_all")
          .select(CATALOG_COLUMNS)
          .or(orgPredicate)
          .in("mcp_server_type", types.slice(i, i + IN_CHUNK));
        if (error) throw error;
        rows.push(...(data ?? []));
      }
      return rows;
    }
    // Unfiltered reads drain past PostgREST's 1000-row cap (the global catalog
    // alone is several thousand entries). mcp_server_type totally orders the
    // view — bands keep it unique across both UNION arms under the org
    // predicate — satisfying fetchAllRows' deterministic-order contract.
    return fetchAllRows<CatalogRow>((from, to) =>
      supabase
        .from("mcp_catalog_all")
        .select(CATALOG_COLUMNS)
        .or(orgPredicate)
        .order("mcp_server_type", { ascending: true })
        .range(from, to),
    );
  };

  // mcp_categories is a handful of globally-readable rows, so fetch it whole,
  // in parallel with the catalog — an .in() on the rows' category ids would
  // serialize the two reads for no data savings.
  const fetchCategoryNames = async (): Promise<Map<string, string>> => {
    const { data, error } = await supabase.from("mcp_categories").select("id, name");
    if (error) throw error;
    return new Map((data ?? []).map((c) => [c.id, c.name]));
  };

  const [rows, categoryNames] = await Promise.all([fetchCatalogRows(), fetchCategoryNames()]);

  const map = new Map<number, CombinedCatalogEntry>();
  for (const row of rows) {
    // The generated view row types every column nullable; key and name are
    // NOT NULL in both base tables, so a null here is unreachable.
    if (row.mcp_server_type == null || row.mcp_server_name == null) continue;
    // Type bands make duplicate keys impossible; if a band violation ever
    // produces one, the org row wins so the tenant's own naming shows.
    if (row.org_id === null && map.has(row.mcp_server_type)) continue;
    map.set(row.mcp_server_type, {
      mcp_server_type: row.mcp_server_type,
      mcp_server_name: row.mcp_server_name,
      description: row.description,
      website: row.website,
      logo_url: row.logo_url,
      category_id: row.category_id,
      category_name: row.category_id ? (categoryNames.get(row.category_id) ?? null) : null,
      source_type: row.source_type,
      org_id: row.org_id,
    });
  }
  return map;
}
