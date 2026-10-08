// Where a connector instance is configured: a config file (plus the Claude Code
// project it is scoped to, if any), or the web app it was connected in.

export interface ConnectorLocation {
  location: string
  project_path: string | null
}

const WEB_APPS: Record<string, string> = {
  '.claude.ai': 'Claude.ai',
  '.chatgpt.com': 'ChatGPT',
}

export const webAppName = (location: string): string | undefined => WEB_APPS[location]

// Project-level config files (e.g. <repo>/.cursor/mcp.json) report the file itself as the project.
export const scopedProject = ({ location, project_path }: ConnectorLocation) =>
  project_path && project_path !== location ? project_path : null

export const connectorLocationText = (loc: ConnectorLocation) => {
  const app = webAppName(loc.location)
  if (app) return `${app} account`
  const project = scopedProject(loc)
  return project ? `${loc.location} (project: ${project})` : loc.location
}
