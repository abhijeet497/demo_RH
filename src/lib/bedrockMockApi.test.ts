import { beforeEach, describe, expect, test } from "bun:test"
import { bedrockMockApi as api, resetBedrockMock } from "./bedrockMockApi"
import { findRuntime, type Inventory } from "./bedrockInventory"

const TOKEN = "t"
const list = async () => (await api.listCloudConnections(TOKEN)).data!.connections
const inventory = async () => (await api.getBedrockInventory(TOKEN)).data as Inventory

beforeEach(() => resetBedrockMock())

describe("bedrockMockApi", () => {
  test("starts with a connected and a failed account", async () => {
    const c = await list()
    expect(c.map((x) => x.status)).toEqual([2, 3])
  })

  test("inventory has agents for both accounts across three regions, with a sync time", async () => {
    const inv = await inventory()
    expect(inv.accounts).toEqual(["123456789012", "210987654321"])
    expect(inv.regions.map((r) => r.region)).toEqual(["ap-south-1", "us-east-1", "eu-west-1"])
    expect(inv.regions.flatMap((r) => r.runtimes).length).toBe(8)
    expect(inv.syncedAt).toBeTruthy()
  })

  test("add connection: a new account appears as pending", async () => {
    const r = await api.verifyCloudConnection(TOKEN, "arn:aws:iam::555566667777:role/BedrockInventoryRole", "Sandbox")
    expect(r.data?.verified).toBe(true)
    const added = (await list()).find((x) => x.accountId === "555566667777")
    expect(added?.status).toBe(1)
    expect(added?.name).toBe("Sandbox")
  })

  test("a bad role ARN is rejected", async () => {
    const r = await api.verifyCloudConnection(TOKEN, "not-an-arn")
    expect(r.error).toBeTruthy()
    expect((await list()).length).toBe(2)
  })

  test("check again on the failed account clears its error and keeps its name", async () => {
    const failed = (await list()).find((x) => x.status === 3)!
    await api.verifyCloudConnection(TOKEN, failed.roleArn!)
    const after = (await list()).find((x) => x.id === failed.id)!
    expect(after.status).toBe(1)
    expect(after.lastError).toBeNull()
    expect(after.name).toBe("Staging")
  })

  test("disconnect removes the account and its agents", async () => {
    const connected = (await list()).find((x) => x.status === 2)!
    expect((await api.disconnectCloudConnection(TOKEN, connected.id)).data?.disconnected).toBe(true)
    expect((await list()).some((x) => x.id === connected.id)).toBe(false)
    const left = await inventory()
    expect(left.regions.some((r) => r.account === connected.accountId)).toBe(false)
    expect(left.regions.flatMap((r) => r.runtimes).length).toBe(4)
    expect((await api.disconnectCloudConnection(TOKEN, connected.id)).error).toBeTruthy()
  })

  test("re-adding the connected account through the form keeps it connected and named", async () => {
    await api.verifyCloudConnection(TOKEN, "arn:aws:iam::123456789012:role/BedrockInventoryRole")
    const c = (await list()).filter((x) => x.accountId === "123456789012")
    expect(c.length).toBe(1)
    expect(c[0].status).toBe(2)
    expect(c[0].name).toBe("Production")
  })

  test("every mock runtime opens on its detail page", async () => {
    const inv = await inventory()
    for (const r of inv.regions) for (const rt of r.runtimes) {
      expect(findRuntime(inv, r.account, r.region, rt.agentRuntimeId!)).not.toBeNull()
    }
  })

  test("mock IDs stay consistent: gateway links resolve and runtime IDs match their ARNs", async () => {
    const inv = await inventory()
    for (const r of inv.regions) {
      const gatewayIds = new Set(r.gateways.map((g) => g.gatewayId))
      for (const h of r.harnesses) for (const ref of h.mcpRefs ?? []) {
        if (ref.gateway?.gatewayId) expect(gatewayIds.has(ref.gateway.gatewayId)).toBe(true)
      }
      for (const g of r.gateways) expect(g.gatewayArn?.endsWith("/" + g.gatewayId)).toBe(true)
      for (const rt of r.runtimes) expect(rt.agentRuntimeArn?.endsWith("/" + rt.agentRuntimeId)).toBe(true)
    }
  })

  test("synced time is the oldest of the accounts shown, not the freshest", async () => {
    const oldest = (await list()).map((c) => c.lastSyncedAt!).sort()[0]
    expect((await inventory()).syncedAt).toBe(oldest)
  })
})
