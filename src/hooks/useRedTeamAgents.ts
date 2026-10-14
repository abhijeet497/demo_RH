import { useEffect, useState } from "react"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/contexts/AuthContext"
import { useOrg } from "@/contexts/OrgContext"
import { formatScore } from "@/lib/appUtils"
import { awsBedrockEnabled } from "@/lib/featureFlags"
import { fetchInventory, flattenRuntimes, runtimeToAgentRow } from "@/lib/bedrockInventory"
import { RED_TEAM_AGENT } from "@/lib/redteam/targetAgent"

/** The subset of an AI Agents row the Red Teaming list needs. */
export interface RedTeamAgentRow {
  id: string
  agent_name: string
  description: string | null
  logo_url: string | null
  environment_labels: string[]
  has_host_instances: boolean
  sandbox_runtime_types: number[]
  base_score: number | null
  actual_score: number | null
  deployment_types: number[]
}

/**
 * Loads the same agents the AI Agents page shows — active agents for the org,
 * cloud (Bedrock) runtimes when enabled — plus the recorded red-team target.
 */
export const useRedTeamAgents = () => {
  const { activeOrgId } = useOrg()
  const { session } = useAuth()
  const [agents, setAgents] = useState<RedTeamAgentRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      const rows: RedTeamAgentRow[] = []

      try {
        if (activeOrgId) {
          const { data, error } = await supabase
            .from("active_agents")
            .select(
              `id, base_score, actual_score, deployment_types, has_host_instances, sandbox_runtime_types,
               agent_catalog!inner ( agent_name, description, logo_url )`,
            )
            .eq("org_id", activeOrgId)
            .gt("active_users", 0)
            .order("actual_score", { ascending: false, nullsFirst: false })
          if (error) throw error
          for (const item of (data ?? []) as any[]) {
            rows.push({
              id: item.id,
              agent_name: item.agent_catalog.agent_name,
              description: item.agent_catalog.description ?? null,
              logo_url: item.agent_catalog.logo_url ?? null,
              environment_labels: [],
              has_host_instances: !!item.has_host_instances,
              sandbox_runtime_types: item.sandbox_runtime_types ?? [],
              base_score: formatScore(item.base_score),
              actual_score: formatScore(item.actual_score),
              deployment_types: item.deployment_types ?? [],
            })
          }
        }
      } catch (e) {
        console.error("Red Teaming: could not load agents", e)
      }

      if (awsBedrockEnabled) {
        try {
          const inventory = await fetchInventory(session?.access_token)
          for (const r of flattenRuntimes(inventory).map(runtimeToAgentRow)) {
            rows.push(r as unknown as RedTeamAgentRow)
          }
        } catch {
          /* no cloud inventory for this org */
        }
      }

      // The recorded target may already be in the live inventory under its raw
      // runtime name; show it under its display name either way.
      if (RED_TEAM_AGENT) {
        const i = rows.findIndex((r) => r.id === RED_TEAM_AGENT.id)
        if (i >= 0) {
          rows[i] = { ...rows[i], agent_name: RED_TEAM_AGENT.agent_name, description: RED_TEAM_AGENT.description }
        } else {
          rows.push(RED_TEAM_AGENT as unknown as RedTeamAgentRow)
        }
      }

      if (!cancelled) {
        setAgents(rows)
        setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [activeOrgId, session?.access_token])

  return { agents, loading }
}
