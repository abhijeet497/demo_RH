import { describe, expect, test } from "bun:test"
import { COPILOT_POLL_MS, availableToLabel, channelLabel, copilotWaitExpired, copilotConnectionMessage, copilotTileSummary, deployedToLabel, findNewTenant, formatCopilotDate } from "./copilot"

describe("connection waiting", () => {
  test("polls every 12 seconds", () => expect(COPILOT_POLL_MS).toBe(12_000))
  test("times out after 15 minutes, not before", () => {
    expect(copilotWaitExpired(1_000, 900_999)).toBe(false)
    expect(copilotWaitExpired(1_000, 901_000)).toBe(true)
  })
})

describe("tile summary", () => {
  test("no connections", () => expect(copilotTileSummary([])).toBe("Not connected"))
  test("one connection", () =>
    expect(copilotTileSummary([{ ui_state: "connected" }])).toBe("1 tenant · 1 connected · 0 need attention"))
  test("mixed states", () =>
    expect(
      copilotTileSummary([
        { ui_state: "connected" },
        { ui_state: "attention_customer" },
        { ui_state: "attention_platform" },
        { ui_state: "stale" },
      ]),
    ).toBe("4 tenants · 1 connected · 3 need attention"))
})

describe("messages", () => {
  const m = (ui_state: string, reason?: string, message = "raw message") =>
    copilotConnectionMessage({ ui_state: ui_state as never, error: reason ? { reason, message } : null })
  test("licence_required", () => expect(m("attention_customer", "licence_required")).toBe("An Agent 365 licence is required in this tenant."))
  test("permission_missing", () =>
    expect(m("attention_customer", "permission_missing")).toBe(
      "The collector is missing the CopilotPackages.Read.All permission. Re-run terraform apply as a Global Administrator.",
    ))
  test("unknown customer reason shows error.message", () => expect(m("attention_customer", "weird", "Boom")).toBe("Boom"))
  test("platform", () =>
    expect(m("attention_platform", "x")).toBe("Something went wrong on Traceforce's side. We've been alerted; the next hourly run will retry."))
  test("stale", () =>
    expect(m("stale")).toBe("No report from this tenant's collector in the last 2 hours. Check the Function app in your Azure portal."))
  test("unknown ui_state is treated as platform", () =>
    expect(m("mystery")).toBe("Something went wrong on Traceforce's side. We've been alerted; the next hourly run will retry."))
  test("connected has no message", () => expect(m("connected")).toBeNull())
})

describe("formatCopilotDate", () => {
  test("date-only values keep their calendar day", () =>
    expect(formatCopilotDate("2026-10-07")).toBe(new Date(2026, 9, 7).toLocaleDateString()))
  test("midnight-UTC usage dates keep their calendar day", () =>
    expect(formatCopilotDate("2026-09-25T00:00:00Z")).toBe(new Date(2026, 8, 25).toLocaleDateString()))
  test("null stays null", () => expect(formatCopilotDate(null)).toBeNull())
})

describe("new tenant check", () => {
  test("finds id not in snapshot", () => expect(findNewTenant(["a", "b"], [{ id: "a" }, { id: "b" }, { id: "c" }])?.id).toBe("c"))
  test("none when unchanged", () => expect(findNewTenant(["a"], [{ id: "a" }])).toBeUndefined())
})

describe("Graph code labels", () => {
  test("known codes get labels", () => {
    expect(availableToLabel("allowedForAll")).toBe("All users")
    expect(deployedToLabel("acquiredForNone")).toBe("Not deployed by admin")
    expect(channelLabel("MsTeams")).toBe("Teams")
  })
  test("unknown codes are shown as-is", () => expect(channelLabel("newChannel")).toBe("newChannel"))
})
