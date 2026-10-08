import { useEffect, useState } from "react"

import { supabase } from "@/integrations/supabase/client"
import type { BlockableApp } from "@/lib/appBlockPolicy"

// useBlockableAgents fetches the AI apps that can be blocked by the Scout proxy:
// agent_catalog rows that have curated network hosts. agent_catalog is a global,
// public-read catalog, so this reads it directly. Rows without hosts can't be
// blocked at the network layer yet, so they are filtered out. origin_country falls
// back to "Unknown" so the origin filter always has a value to group by.
//
// Until agent_catalog.hosts / origin_country are backfilled (currently only the
// curated apps carry them), this list is small — that is the real, current state.
export function useBlockableAgents(): { apps: BlockableApp[]; loading: boolean; error: string | null } {
  const [apps, setApps] = useState<BlockableApp[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from("agent_catalog")
        .select("agent_type, agent_name, origin_country, hosts")
      if (cancelled) return
      if (error) {
        setError(error.message)
        setApps([])
        setLoading(false)
        return
      }
      const mapped: BlockableApp[] = (data ?? [])
        .filter((r) => Array.isArray(r.hosts) && r.hosts.length > 0)
        .map((r) => ({
          id: String(r.agent_type),
          name: r.agent_name,
          origin: r.origin_country ?? "Unknown",
          hosts: r.hosts ?? [],
        }))
      setError(null)
      setApps(mapped)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return { apps, loading, error }
}
