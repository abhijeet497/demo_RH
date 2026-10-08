import { describe, expect, test } from "bun:test"
import { bedrockFilterOptions, syncedAtMs } from "./bedrockInventory"

describe("syncedAtMs", () => {
  test("parses the ISO time the API returns", () => {
    expect(syncedAtMs({ regions: [], syncedAt: "2026-10-07T06:16:51.278Z" })).toBe(Date.parse("2026-10-07T06:16:51.278Z"))
  })

  test("no syncedAt (no account connected) gives null", () => {
    expect(syncedAtMs({ regions: [] })).toBeNull()
  })

  test("an unparseable syncedAt gives null instead of an Invalid Date that crashes formatting", () => {
    expect(syncedAtMs({ regions: [], syncedAt: "not a date" })).toBeNull()
  })
})

describe("bedrockFilterOptions", () => {
  const rows = [
    { bedrock_account: "111111111111", bedrock_region: "ap-south-1" },
    { bedrock_account: "111111111111", bedrock_region: "ap-south-1" },
    { bedrock_account: "222222222222", bedrock_region: "us-east-1" },
    { bedrock_account: "222222222222", bedrock_region: "eu-west-1" },
    { bedrock_account: undefined, bedrock_region: "us-west-2" },
  ]
  const ids = (o: { id: string }[]) => o.map((x) => x.id)

  test("lists each account and region once, sorted", () => {
    const o = bedrockFilterOptions(rows, [])
    expect(ids(o.accounts)).toEqual(["111111111111", "222222222222"])
    expect(ids(o.regions)).toEqual(["ap-south-1", "eu-west-1", "us-east-1"])
  })

  test("regions are limited to the selected account", () => {
    expect(ids(bedrockFilterOptions(rows, ["222222222222"]).regions)).toEqual(["eu-west-1", "us-east-1"])
  })

  test("the account list stays complete while one is selected", () => {
    expect(ids(bedrockFilterOptions(rows, ["222222222222"]).accounts)).toEqual(["111111111111", "222222222222"])
  })

  test("rows without an account or region are skipped", () => {
    expect(ids(bedrockFilterOptions(rows, []).regions)).not.toContain("us-west-2")
  })

  test("no runtimes gives no options", () => {
    expect(bedrockFilterOptions([], [])).toEqual({ accounts: [], regions: [] })
  })
})
