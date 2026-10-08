// Hoisted from McpAccessPolicyDetail so every unpaged Supabase read that can
// exceed PostgREST's server cap shares one drain loop instead of growing
// page-local copies.

/** Matches the server's max_rows cap, so a short page means "done". */
export const SUPABASE_PAGE_SIZE = 1000

/**
 * Drain a Supabase read past PostgREST's 1000-row cap with .range() pages
 * (same loop as use-mcp-tools). Callers MUST supply a deterministic .order()
 * — including a unique tiebreaker such as .order("id") when the primary sort
 * key can tie — offset pages over an unordered result can skip or repeat rows.
 */
export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const all: T[] = []
  for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
    const { data, error } = await page(from, from + SUPABASE_PAGE_SIZE - 1)
    if (error) throw new Error(error.message)
    all.push(...(data ?? []))
    if (!data || data.length < SUPABASE_PAGE_SIZE) return all
  }
}
