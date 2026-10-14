import { flattenRuntimes, runtimeToAgentRow } from "@/lib/bedrockInventory"
import { MOCK_BEDROCK_INVENTORY } from "@/lib/bedrockMockInventory"

/**
 * The red-team target: the mock Bedrock AgentCore `invoice_agent` runtime. It
 * appears in the AI Agents inventory and opens through the standard Bedrock
 * runtime detail page like any other runtime. Only its display name is set;
 * everything else is the mock inventory's real shape.
 */
export const RED_TEAM_RUNTIME = {
  account: "210987654321",
  region: "us-east-1",
  runtimeId: "invoice_agent-Hb27PwKe9d",
  displayName: "Invoice Operations Agent",
} as const

export const isRedTeamRuntime = (account?: string, region?: string, runtimeId?: string) =>
  account === RED_TEAM_RUNTIME.account &&
  region === RED_TEAM_RUNTIME.region &&
  runtimeId === RED_TEAM_RUNTIME.runtimeId

/** Mock inventory with the target runtime carrying its display name. */
export const RED_TEAM_INVENTORY = {
  ...MOCK_BEDROCK_INVENTORY,
  regions: MOCK_BEDROCK_INVENTORY.regions.map((r) => ({
    ...r,
    runtimes: r.runtimes.map((rt) =>
      rt.agentRuntimeId === RED_TEAM_RUNTIME.runtimeId
        ? { ...rt, agentRuntimeName: RED_TEAM_RUNTIME.displayName }
        : rt,
    ),
  })),
}

/** Inventory row for the AI Agents list; its detail_path is the Bedrock runtime page. */
export const RED_TEAM_AGENT =
  flattenRuntimes(RED_TEAM_INVENTORY)
    .map(runtimeToAgentRow)
    .find((r) => r.id.endsWith(`:${RED_TEAM_RUNTIME.runtimeId}`)) ?? null
