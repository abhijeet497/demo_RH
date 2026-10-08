import { describe, expect, test } from "bun:test"
import { connectionState, connectionTitle, syncedText } from "./awsConnections"

describe("connectionState", () => {
  test("maps IntegrationStatus values", () => {
    expect(connectionState(1)).toBe("pending")
    expect(connectionState(2)).toBe("connected")
    expect(connectionState(3)).toBe("failed")
  })

  test("an unknown status reads as pending, not connected", () => {
    expect(connectionState(0)).toBe("pending")
    expect(connectionState(99)).toBe("pending")
  })
})

describe("connectionTitle", () => {
  test("uses the name when there is one", () => {
    expect(connectionTitle({ name: "Production", accountId: "111122223333" })).toBe("Production")
  })

  test("falls back to the account ID for no name or a blank one", () => {
    expect(connectionTitle({ name: null, accountId: "111122223333" })).toBe("111122223333")
    expect(connectionTitle({ name: "   ", accountId: "111122223333" })).toBe("111122223333")
  })
})

describe("syncedText", () => {
  const base = { status: 2, lastSyncedAt: "2026-10-07T09:16:53Z" }
  const now = Date.parse("2026-10-07T09:46:53Z")

  test("shows how long ago a connected account synced", () => {
    expect(syncedText(base, now)).toBe("Last synced 30 minutes ago")
  })

  test("a pending connection says it is waiting for the first sync", () => {
    expect(syncedText({ ...base, status: 1 }, now)).toBe("Waiting for the first sync. This runs hourly.")
  })

  test("no sync time yet", () => {
    expect(syncedText({ ...base, lastSyncedAt: null }, now)).toBe("Not synced yet")
  })

  test("an unparseable sync time does not throw", () => {
    expect(() => syncedText({ ...base, lastSyncedAt: "garbage" }, now)).not.toThrow()
    expect(syncedText({ ...base, lastSyncedAt: "garbage" }, now)).toBe("Not synced yet")
  })
})
