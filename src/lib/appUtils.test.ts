import { describe, it, expect } from "bun:test"

import { validateAzureContainerName } from "./appUtils"

describe("validateAzureContainerName", () => {
  it("accepts a valid container name", () => {
    expect(validateAzureContainerName("traceforce-logs")).toEqual({ normalized: "traceforce-logs", error: null })
  })

  it("trims and lowercases, returning the normalized form to actually save", () => {
    expect(validateAzureContainerName("  Traceforce-Logs  ")).toEqual({ normalized: "traceforce-logs", error: null })
  })

  // Mirrors common/azurewif.ValidateContainerName: an unvalidated container gets joined
  // straight into the request URL there, and "a/b" would redirect the write to container "a"
  // with blobs prefixed "b/" instead of a container literally named "a/b" (which can't exist).
  it("rejects a value containing a slash", () => {
    expect(validateAzureContainerName("a/b").error).not.toBeNull()
  })

  it("rejects too short", () => {
    expect(validateAzureContainerName("ab").error).not.toBeNull()
  })

  it("rejects too long", () => {
    expect(validateAzureContainerName("a".repeat(64)).error).not.toBeNull()
  })

  it("accepts a single hyphen", () => {
    expect(validateAzureContainerName("acme-logs")).toEqual({ normalized: "acme-logs", error: null })
  })

  it("rejects consecutive hyphens", () => {
    expect(validateAzureContainerName("acme--logs").error).not.toBeNull()
  })

  it("rejects a leading hyphen", () => {
    expect(validateAzureContainerName("-acmelogs").error).not.toBeNull()
  })

  it("rejects a trailing hyphen", () => {
    expect(validateAzureContainerName("acmelogs-").error).not.toBeNull()
  })

  it("rejects empty", () => {
    expect(validateAzureContainerName("").error).not.toBeNull()
  })

  // Azure's own reserved containers are real, addressable containers (Microsoft Learn), but
  // this module deliberately does not support pointing a customer's logs at one of Azure's own
  // system/reserved containers -- matches common/azurewif.ValidateContainerName's final
  // behavior in the lakehouse-export repo (an earlier version allowlisted $root, since reverted).
  for (const reserved of ["$root", "$web", "$logs", "$blobchangefeed"]) {
    it(`rejects the reserved ${reserved} container`, () => {
      expect(validateAzureContainerName(reserved).error).not.toBeNull()
    })
  }
})
