// Single source of truth for the security report's section list. Used both
// on the PDF cover page (table of contents) and in the dashboard's
// "Generate Report" dialog. Kept in a standalone module with no heavy
// dependencies so consumers can read it without pulling in the PDF stack.

export type ReportSection = {
  title: string
  description: string
}

// ENG-454: included as section 2 only when the report scope spans multiple
// organizations — single-org reports (and their dialog numbering) are
// unchanged. Kept out of REPORT_SECTIONS so existing index-based consumers
// stay valid; use getReportSections() wherever scope is known.
export const ORGANIZATIONS_SECTION: ReportSection = {
  title: "Organizations",
  description:
    "Where to focus first, based on each organization's open critical and high-severity issues.",
}

export const getReportSections = (opts: { multiOrg: boolean }): ReportSection[] =>
  opts.multiOrg
    ? [REPORT_SECTIONS[0], ORGANIZATIONS_SECTION, ...REPORT_SECTIONS.slice(1)]
    : REPORT_SECTIONS

export const REPORT_SECTIONS: ReportSection[] = [
  {
    title: "Executive Summary",
    description:
      "Open agent and connector issues, affected devices, and charts for risk breakdown and top risk rules.",
  },
  {
    title: "Inventory Overview",
    description:
      "Charts of AI agent deployment types and connector categories (custom connectors excluded), tables of the top 5 most popular AI agents and connectors by instance count, and connector authentication methods.",
  },
  {
    title: "AI Agents — Risk & Inventory",
    description:
      "Risk distribution bar chart (critical excluded) and the top 10 highest-risk AI agents.",
  },
  {
    title: "Connectors — Risk & Inventory",
    description:
      "Risk distribution bar chart (critical excluded) and the top 10 highest-risk connectors.",
  },
  {
    title: "Agent Issues — Risk Rule Breakdown",
    description:
      "Stat tiles, a donut chart with two-column legend, and a table of the top 5 most critical open agent issues (risk attribute, incidents, affected devices, last detection).",
  },
  {
    title: "Connector Issues — Risk Rule Breakdown",
    description:
      "Stat tiles, a donut chart with two-column legend, and a table of the top 5 most critical open connector issues (risk attribute, incidents, affected devices, last detection).",
  },
]
