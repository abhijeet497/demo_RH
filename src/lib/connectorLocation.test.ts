import { describe, it, expect } from "bun:test"

import { scopedProject, connectorLocationText } from "./connectorLocation"

describe("scopedProject", () => {
  it("drops a project that is the config file itself", () => {
    const loc = "/Users/jane/repo/.cursor/mcp.json"
    expect(scopedProject({ location: loc, project_path: loc })).toBeNull()
    expect(scopedProject({ location: loc, project_path: null })).toBeNull()
  })

  it("keeps a Claude Code project scope, including the home dir", () => {
    expect(scopedProject({ location: "/Users/jane/.claude.json", project_path: "/Users/jane/repo" })).toBe("/Users/jane/repo")
    expect(scopedProject({ location: "/Users/jane/.claude.json", project_path: "/Users/jane" })).toBe("/Users/jane")
  })
})

describe("connectorLocationText", () => {
  it("formats locations for export", () => {
    expect(connectorLocationText({ location: "/Users/jane/.claude.json", project_path: "/Users/jane/repo" }))
      .toBe("/Users/jane/.claude.json (project: /Users/jane/repo)")
    expect(connectorLocationText({ location: "/Users/jane/.cursor/mcp.json", project_path: null })).toBe("/Users/jane/.cursor/mcp.json")
    expect(connectorLocationText({ location: ".claude.ai", project_path: null })).toBe("Claude.ai account")
    expect(connectorLocationText({ location: ".chatgpt.com", project_path: null })).toBe("ChatGPT account")
  })
})
