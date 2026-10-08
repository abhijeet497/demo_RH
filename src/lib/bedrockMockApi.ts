/**
 * Mock of the AWS Bedrock API calls, for the UI-only build: no request leaves
 * the browser. Same method names and { data, error } responses as traceforcApi,
 * so going live is swapping `bedrockApi` below back to traceforcApi.
 *
 * Connections live in memory for the session: Add connection, Check again and
 * Disconnect all work, and the AI Agents list follows the connected accounts.
 */
import type { TraceforceApiResponse } from "@/integrations/traceforce/types"
import type { Inventory } from "@/lib/bedrockInventory"
import type { AwsConnection } from "@/lib/awsConnections"
import { MOCK_BEDROCK_INVENTORY } from "@/lib/bedrockMockInventory"
import { accountIdFromRoleArn } from "@/lib/bedrockTerraform"

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString()

// One healthy account with agents, and one whose last sync failed (shows Check again).
const initialConnections = (): AwsConnection[] => [
  {
    id: "mock-aws-1", accountId: "123456789012", name: "Production",
    roleArn: "arn:aws:iam::123456789012:role/BedrockInventoryRole", regions: ["ap-south-1"],
    status: 2, errorCode: null, lastError: null, lastSyncedAt: hoursAgo(0.5), createdAt: hoursAgo(48),
  },
  {
    id: "mock-aws-2", accountId: "210987654321", name: "Staging",
    roleArn: "arn:aws:iam::210987654321:role/BedrockInventoryRole", regions: ["us-east-1", "eu-west-1"],
    status: 3, errorCode: "AccessDenied",
    lastError: "Traceforce could not assume BedrockInventoryRole. Check that the Terraform template is still applied in this account.",
    lastSyncedAt: hoursAgo(1), createdAt: hoursAgo(24),
  },
]

let connections = initialConnections()
const delay = () => new Promise((r) => setTimeout(r, 300))

export const bedrockMockApi = {
  async getBedrockInventory(_accessToken: string): Promise<TraceforceApiResponse<unknown>> {
    await delay()
    // Every account that has not been disconnected shows its agents, whatever its
    // last sync status, as with the real API (a failed sync keeps the last agents).
    const live = new Set(connections.map((c) => c.accountId))
    const inventory: Inventory = {
      ...MOCK_BEDROCK_INVENTORY,
      accounts: (MOCK_BEDROCK_INVENTORY.accounts ?? []).filter((a) => live.has(a)),
      regions: MOCK_BEDROCK_INVENTORY.regions.filter((r) => live.has(r.account ?? "")),
      // The oldest sync among the accounts shown, as the real API reports it.
      syncedAt: connections.map((c) => c.lastSyncedAt).filter((t): t is string => !!t).sort()[0],
    }
    return { data: inventory }
  },

  async listCloudConnections(_accessToken: string): Promise<TraceforceApiResponse<{ connections: AwsConnection[] }>> {
    await delay()
    return { data: { connections: connections.map((c) => ({ ...c })) } }
  },

  async verifyCloudConnection(
    _accessToken: string,
    roleArn: string,
    name?: string,
  ): Promise<TraceforceApiResponse<{ verified: boolean; accountId?: string; assumedRoleArn?: string; regions?: string[] }>> {
    await delay()
    const accountId = accountIdFromRoleArn(roleArn)
    if (!accountId) return { error: "role_arn must look like arn:aws:iam::<12-digit account>:role/<name>" }
    const existing = connections.find((c) => c.accountId === accountId)
    const regions = existing?.regions ?? ["ap-south-1"]
    const saved: AwsConnection = {
      id: existing?.id ?? `mock-aws-${Date.now()}`, accountId, roleArn: roleArn.trim(),
      name: name || existing?.name || null, regions,
      // Mirrors the API: a connected account stays connected, anything else waits for the next sync.
      status: existing?.status === 2 ? 2 : 1, errorCode: null, lastError: null,
      lastSyncedAt: existing?.lastSyncedAt ?? null, createdAt: existing?.createdAt ?? new Date().toISOString(),
    }
    connections = existing ? connections.map((c) => (c.id === existing.id ? saved : c)) : [...connections, saved]
    return { data: { verified: true, accountId, regions } }
  },

  async disconnectCloudConnection(_accessToken: string, id: string): Promise<TraceforceApiResponse<{ disconnected: boolean }>> {
    await delay()
    if (!connections.some((c) => c.id === id)) return { error: "Connection not found" }
    connections = connections.filter((c) => c.id !== id)
    return { data: { disconnected: true } }
  },
}

/** Reset the in-memory connections (tests). */
export const resetBedrockMock = () => { connections = initialConnections() }

/** What the AWS Bedrock screens call. Swap to traceforcApi when the backend ships. */
export const bedrockApi = bedrockMockApi
