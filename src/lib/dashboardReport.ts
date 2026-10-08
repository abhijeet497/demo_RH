import jsPDF from "jspdf"
import autoTable, { type RowInput } from "jspdf-autotable"
import { format as formatDate } from "date-fns"
import {
  AGENT_DEPLOYMENT_TYPE_MAP,
  CUSTOM_MCP_SERVER_TYPE,
  RISK_CHART_COLORS,
  getRiskLevel,
  LOW_RISK_THRESHOLD,
  MEDIUM_RISK_THRESHOLD,
  HIGH_RISK_THRESHOLD,
} from "./appUtils"
import {
  type ChartDatum,
  type AffectedDevice,
  type IssueTypeRow,
  buildAuthTypeDistribution,
  buildCategoryDistribution,
  buildDeploymentDistribution,
  buildIssueTypeChartData,
  buildIssueTypeDistribution,
  buildRiskDistribution,
} from "./dashboardCharts"
import { type ChartStyle, getChartStyle } from "./chartStyle"
import { ORGANIZATIONS_SECTION, REPORT_SECTIONS, type ReportSection } from "./reportSections"
import {
  type OrgScorecardRow,
  ORG_STATUS_LABELS,
  orgScorecardStatus,
  orgScorecardSentence,
} from "./orgScorecard"

// ============================================================================
// Types
// ============================================================================

export type ReportAgent = {
  agent_name: string
  base_score: number | null
  actual_score: number | null
  instance_count: number | null
  deployment_types: number[] | null
}

export type ReportMcp = {
  mcp_server_name: string
  mcp_server_type?: number | null
  base_score: number | null
  actual_score: number | null
  instance_count: number | null
  category_id?: string | null
  category_name: string | null
  auth_types?: number[] | null
}

export type ReportIssueRow = {
  risk_rule_id: string
  risk_rule_name: string
  name: string
  last_seen_at: string | null
  trigger_score: number | null
  incident_count: number | null
  applicable_to: number | null
  affected_devices: AffectedDevice[] | null
}

export type ReportInput = {
  generatedAt: Date
  // Org email_domains the snapshot covers (ENG-454 cross-org scope). Empty = suppress the cover
  // scope line (non-admin/single-org callers can't resolve domains; their scope is implicit).
  scopeDomains: string[]
  // Single predicate for the Organizations section (shared with the dialog via
  // getReportSections) — single-org and non-admin reports omit it.
  multiOrg: boolean
  // Pre-ordered rows from get_org_scorecard_rollup for the report's org scope.
  scorecard: OrgScorecardRow[]
  deviceCount: number
  agents: ReportAgent[]
  mcps: ReportMcp[]
  agentIssues: ReportIssueRow[]
  mcpIssues: ReportIssueRow[]
}

// ============================================================================
// Constants
// ============================================================================

const PAGE_MARGIN = 14 // mm
const PAGE_WIDTH_A4 = 210
const PAGE_HEIGHT_A4 = 297

const COLORS = {
  primary: [37, 99, 235] as const, // blue-600
  text: [17, 24, 39] as const, // gray-900
  subtext: [107, 114, 128] as const, // gray-500
  divider: [229, 231, 235] as const, // gray-200
  headerBg: [243, 244, 246] as const, // gray-100
  low: [34, 197, 94] as const, // green-500
  medium: [234, 179, 8] as const, // yellow-500
  high: [249, 115, 22] as const, // orange-500
  critical: [239, 68, 68] as const, // red-500
  unknown: [156, 163, 175] as const, // gray-400
}

const APPLICABLE_TO_CONTROLLABLE = 1

// ============================================================================
// Helpers
// ============================================================================

const effectiveScore = (a: { base_score: number | null; actual_score: number | null }) =>
  a.actual_score ?? a.base_score

const calculateOverallRiskScore = (
  rows: { base_score: number | null; actual_score: number | null }[],
) => {
  const scores = rows
    .map(effectiveScore)
    .filter((score): score is number => score !== null)

  if (scores.length === 0) return null

  return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
}

const formatScoreValue = (score: number | null | undefined) =>
  score == null ? "—" : Math.round(score).toString()

const filterControllable = <T extends ReportIssueRow>(rows: T[]) =>
  rows.filter((r) => r.applicable_to === APPLICABLE_TO_CONTROLLABLE)

const countDevices = (rows: ReportIssueRow[]) => {
  const set = new Set<string>()
  filterControllable(rows).forEach((r) =>
    r.affected_devices?.forEach((d) => {
      if (d?.device_id) set.add(d.device_id)
    }),
  )
  return set.size
}

const countIncidents = (rows: ReportIssueRow[]) =>
  filterControllable(rows).reduce((sum, r) => sum + (r.incident_count ?? 0), 0)

const riskBuckets = (rows: { base_score: number | null; actual_score: number | null }[]) => {
  const counts = { low: 0, medium: 0, high: 0, critical: 0, unknown: 0 }
  rows.forEach((r) => {
    const score = effectiveScore(r)
    if (score == null) {
      counts.unknown += 1
      return
    }
    if (score < LOW_RISK_THRESHOLD) counts.low += 1
    else if (score < MEDIUM_RISK_THRESHOLD) counts.medium += 1
    else if (score < HIGH_RISK_THRESHOLD) counts.high += 1
    else counts.critical += 1
  })
  return counts
}

const formatDeploymentTypes = (types: number[] | null | undefined) => {
  if (!types?.length) return "—"
  return [...new Set(types)]
    .map((t) => AGENT_DEPLOYMENT_TYPE_MAP[t] ?? `Type ${t}`)
    .join(", ")
}

// ============================================================================
// Layout helpers
// ============================================================================

type DocCtx = {
  doc: jsPDF
  cursorY: number
}

const ensureSpace = (ctx: DocCtx, needed: number) => {
  if (ctx.cursorY + needed > PAGE_HEIGHT_A4 - PAGE_MARGIN - 10) {
    ctx.doc.addPage()
    ctx.cursorY = PAGE_MARGIN
  }
}

const drawSectionTitle = (ctx: DocCtx, title: string) => {
  ensureSpace(ctx, 16)
  ctx.doc.setFont("helvetica", "bold")
  ctx.doc.setFontSize(14)
  ctx.doc.setTextColor(...COLORS.text)
  ctx.doc.text(title, PAGE_MARGIN, ctx.cursorY)
  ctx.cursorY += 3
  ctx.doc.setDrawColor(...COLORS.divider)
  ctx.doc.setLineWidth(0.3)
  ctx.doc.line(
    PAGE_MARGIN,
    ctx.cursorY,
    PAGE_WIDTH_A4 - PAGE_MARGIN,
    ctx.cursorY,
  )
  ctx.cursorY += 6
}

const drawSubsectionTitle = (
  ctx: DocCtx,
  title: string,
  description?: string,
) => {
  const contentWidth = PAGE_WIDTH_A4 - PAGE_MARGIN * 2

  ctx.doc.setFont("helvetica", "normal")
  ctx.doc.setFontSize(9)
  const descLines: string[] = description
    ? (ctx.doc.splitTextToSize(description, contentWidth) as string[])
    : []
  const descHeight = descLines.length * 3.6
  ensureSpace(ctx, 6 + descHeight + 3)

  ctx.doc.setFont("helvetica", "bold")
  ctx.doc.setFontSize(12)
  ctx.doc.setTextColor(...COLORS.primary)
  ctx.doc.text(title, PAGE_MARGIN, ctx.cursorY + 4.5)

  const accentY = ctx.cursorY + 5.5
  ctx.doc.setDrawColor(...COLORS.primary)
  ctx.doc.setLineWidth(0.6)
  const titleWidth = ctx.doc.getTextWidth(title)
  ctx.doc.line(PAGE_MARGIN, accentY, PAGE_MARGIN + titleWidth, accentY)
  ctx.doc.setLineWidth(0.1)
  ctx.cursorY += 7

  if (descLines.length > 0) {
    ctx.doc.setFont("helvetica", "normal")
    ctx.doc.setFontSize(9)
    ctx.doc.setTextColor(...COLORS.subtext)
    descLines.forEach((line, i) => {
      ctx.doc.text(line, PAGE_MARGIN, ctx.cursorY + 3 + i * 3.6)
    })
    ctx.cursorY += descHeight
  }

  ctx.cursorY += 3
}

const drawParagraph = (ctx: DocCtx, text: string, opts?: { size?: number; color?: readonly [number, number, number] }) => {
  const size = opts?.size ?? 10
  const color = opts?.color ?? COLORS.subtext
  ctx.doc.setFont("helvetica", "normal")
  ctx.doc.setFontSize(size)
  ctx.doc.setTextColor(...color)
  const lines = ctx.doc.splitTextToSize(text, PAGE_WIDTH_A4 - PAGE_MARGIN * 2)
  ensureSpace(ctx, lines.length * (size * 0.4) + 2)
  ctx.doc.text(lines, PAGE_MARGIN, ctx.cursorY)
  ctx.cursorY += lines.length * (size * 0.4) + 2
}

const drawTable = (
  ctx: DocCtx,
  head: string[][],
  body: RowInput[],
  opts?: { columnStyles?: Record<number, Partial<{ halign: "left" | "right" | "center"; cellWidth: number | "auto" }>> },
) => {
  autoTable(ctx.doc, {
    head,
    body,
    startY: ctx.cursorY,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 2.5,
      textColor: [...COLORS.text] as [number, number, number],
      lineColor: [...COLORS.divider] as [number, number, number],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [...COLORS.headerBg] as [number, number, number],
      textColor: [...COLORS.text] as [number, number, number],
      fontStyle: "bold",
      lineWidth: 0,
    },
    alternateRowStyles: {
      fillColor: [250, 250, 252],
    },
    columnStyles: opts?.columnStyles,
    didDrawPage: () => {
      // No-op; page numbering handled at the end.
    },
  })
  // @ts-expect-error - lastAutoTable is added by the plugin at runtime.
  ctx.cursorY = (ctx.doc.lastAutoTable?.finalY ?? ctx.cursorY) + 8
}

const drawStatGrid = (
  ctx: DocCtx,
  stats: { label: string; value: string; sub?: string }[],
) => {
  const cols = stats.length === 6 ? 3 : Math.min(stats.length, 5)
  const gap = 4
  const cardWidth = (PAGE_WIDTH_A4 - PAGE_MARGIN * 2 - gap * (cols - 1)) / cols
  const cardHeight = 22
  const rows = Math.ceil(stats.length / cols)
  ensureSpace(ctx, rows * (cardHeight + gap))

  // Render text shrunk just enough to fit the card's inner width, so narrower
  // multi-column layouts don't overflow into neighbouring cards.
  const innerWidth = cardWidth - 6
  const drawFitted = (
    text: string,
    x: number,
    y: number,
    baseSize: number,
    minSize: number,
  ) => {
    let size = baseSize
    while (size > minSize && ctx.doc.getTextWidth(text) > innerWidth) {
      size -= 0.5
      ctx.doc.setFontSize(size)
    }
    ctx.doc.text(text, x, y)
  }

  stats.forEach((stat, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const x = PAGE_MARGIN + col * (cardWidth + gap)
    const y = ctx.cursorY + row * (cardHeight + gap)

    ctx.doc.setDrawColor(...COLORS.divider)
    ctx.doc.setFillColor(252, 252, 253)
    ctx.doc.roundedRect(x, y, cardWidth, cardHeight, 1.5, 1.5, "FD")

    ctx.doc.setFont("helvetica", "normal")
    ctx.doc.setFontSize(8)
    ctx.doc.setTextColor(...COLORS.subtext)
    drawFitted(stat.label, x + 4, y + 6, 8, 6.5)

    ctx.doc.setFont("helvetica", "bold")
    ctx.doc.setFontSize(16)
    ctx.doc.setTextColor(...COLORS.text)
    drawFitted(stat.value, x + 4, y + 14, 16, 11)

    if (stat.sub) {
      ctx.doc.setFont("helvetica", "normal")
      ctx.doc.setFontSize(7)
      ctx.doc.setTextColor(...COLORS.subtext)
      drawFitted(stat.sub, x + 4, y + 19, 7, 5.5)
    }
  })

  ctx.cursorY += rows * (cardHeight + gap) + 2
}

// Brand banner gradient stops (navy → teal → green → yellow), reused for the
// canvas-rendered cover banner and the deterministic vector fallback below.
const BRAND_BANNER_STOPS: { offset: number; color: [number, number, number] }[] = [
  { offset: 0.0, color: [31, 44, 69] }, // #1F2C45 deep navy
  { offset: 0.18, color: [68, 113, 147] }, // #447193 slate-blue
  { offset: 0.34, color: [92, 160, 126] }, // #5CA07E teal-green
  { offset: 0.5, color: [120, 181, 112] }, // #78B570 green
  { offset: 0.66, color: [201, 215, 108] }, // #C9D76C lime
  { offset: 0.82, color: [224, 227, 110] }, // #E0E36E yellow-green
  { offset: 1.0, color: [238, 235, 140] }, // #EEEB8C pale yellow
]

const sampleBrandStop = (p: number): [number, number, number] => {
  const t = Math.min(1, Math.max(0, p))
  for (let i = 0; i < BRAND_BANNER_STOPS.length - 1; i += 1) {
    const a = BRAND_BANNER_STOPS[i]
    const b = BRAND_BANNER_STOPS[i + 1]
    if (t >= a.offset && t <= b.offset) {
      const k = (t - a.offset) / (b.offset - a.offset || 1)
      return [
        Math.round(a.color[0] + (b.color[0] - a.color[0]) * k),
        Math.round(a.color[1] + (b.color[1] - a.color[1]) * k),
        Math.round(a.color[2] + (b.color[2] - a.color[2]) * k),
      ]
    }
  }
  return BRAND_BANNER_STOPS[BRAND_BANNER_STOPS.length - 1].color
}

// Vector fallback: paints the banner using ~120 thin vertical strips so the
// cover always shows the brand gradient even if no canvas/image path is taken.
const drawBannerStrips = (
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
) => {
  const strips = 120
  const stripWidth = width / strips
  for (let i = 0; i < strips; i += 1) {
    const p = (i + 0.5) / strips
    const [r, g, b] = sampleBrandStop(p)
    doc.setFillColor(r, g, b)
    // Slight overlap avoids hairline gaps at print resolutions.
    doc.rect(x + i * stripWidth, y, stripWidth + 0.05, height, "F")
  }
}

const COVER_BANNER_HEIGHT_MM = 70
const COVER_CONTENT_TOP_MM = COVER_BANNER_HEIGHT_MM + 20

const drawCover = (ctx: DocCtx, input: ReportInput) => {
  const { doc } = ctx

  // Always paint the deterministic vector strips first so the banner is never
  // bright blue, even if the canvas-image fallback fails.
  drawBannerStrips(doc, 0, 0, PAGE_WIDTH_A4, COVER_BANNER_HEIGHT_MM)

  // Overlay the canvas-rendered image when available — it adds the soft halo
  // and the left-side scrim that improves wordmark legibility.
  const bannerImage = renderBannerImage(COVER_BANNER_HEIGHT_MM)
  if (bannerImage) {
    doc.addImage(
      bannerImage,
      "JPEG",
      0,
      0,
      PAGE_WIDTH_A4,
      COVER_BANNER_HEIGHT_MM,
      "tf-banner",
      "FAST",
    )
  }

  doc.setFont("helvetica", "bold")
  doc.setFontSize(28)
  doc.setTextColor(255, 255, 255)
  doc.text("Traceforce", PAGE_MARGIN, 32)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(16)
  doc.text("Security Posture Report", PAGE_MARGIN, 44)

  doc.setFontSize(11)
  doc.text(
    `Generated ${formatDate(input.generatedAt, "MMM d, yyyy 'at' h:mm a")}`,
    PAGE_MARGIN,
    56,
  )

  if (input.scopeDomains.length > 0) {
    doc.setFontSize(9)
    const scope = `Scope: ${input.scopeDomains.join(", ")}`
    // Cap at two lines so the text stays inside the 70mm banner; a very long org list ellipsizes.
    const lines = doc.splitTextToSize(scope, PAGE_WIDTH_A4 - PAGE_MARGIN * 2) as string[]
    const shown = lines.slice(0, 2)
    if (lines.length > 2) shown[1] = `${shown[1].replace(/,?\s*\S*$/, "")} …`
    doc.text(shown, PAGE_MARGIN, 62)
  }

  ctx.cursorY = COVER_CONTENT_TOP_MM
}

type TocEntry = { title: string; pageNumber: number }

const drawTableOfContents = (ctx: DocCtx, entries: TocEntry[]) => {
  const { doc } = ctx

  // "Contents" heading, left-aligned at the page margin so it lines up with
  // every TOC row beneath it.
  doc.setFont("helvetica", "bold")
  doc.setFontSize(24)
  doc.setTextColor(...COLORS.text)
  const headingBaselineY = ctx.cursorY + 9
  doc.text("Contents", PAGE_MARGIN, headingBaselineY)

  const headingWidth = doc.getTextWidth("Contents")
  doc.setDrawColor(...COLORS.primary)
  doc.setLineWidth(1.2)
  doc.line(
    PAGE_MARGIN,
    headingBaselineY + 2.5,
    PAGE_MARGIN + headingWidth,
    headingBaselineY + 2.5,
  )

  ctx.cursorY = headingBaselineY + 14

  const numColWidth = 10
  const titleX = PAGE_MARGIN + numColWidth
  const rowHeight = 14
  const titleSize = 13
  const pageNumSize = 12

  entries.forEach((entry, idx) => {
    const rowTopY = ctx.cursorY
    const rowMidY = rowTopY + rowHeight / 2

    // Number badge.
    const circleR = 3.6
    const circleCx = PAGE_MARGIN + circleR
    const circleCy = rowMidY
    doc.setFillColor(...COLORS.primary)
    doc.circle(circleCx, circleCy, circleR, "F")
    doc.setFont("helvetica", "bold")
    doc.setFontSize(10)
    doc.setTextColor(255, 255, 255)
    doc.text(String(idx + 1), circleCx, circleCy + 1.4, { align: "center" })

    // Title.
    doc.setFont("helvetica", "bold")
    doc.setFontSize(titleSize)
    doc.setTextColor(...COLORS.text)
    const titleBaselineY = rowMidY + 1.5
    doc.text(entry.title, titleX, titleBaselineY)
    const titleWidth = doc.getTextWidth(entry.title)

    // Page number, right-aligned.
    const pageText = String(entry.pageNumber)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(pageNumSize)
    doc.setTextColor(...COLORS.text)
    const pageWidth = doc.getTextWidth(pageText)
    const pageX = PAGE_WIDTH_A4 - PAGE_MARGIN - pageWidth
    doc.text(pageText, pageX, titleBaselineY)

    // Leader dots between title and page number.
    doc.setFont("helvetica", "normal")
    doc.setFontSize(11)
    doc.setTextColor(...COLORS.subtext)
    const dotStartX = titleX + titleWidth + 2.5
    const dotEndX = pageX - 2.5
    if (dotEndX > dotStartX) {
      const dotSpacing = 2.2
      for (let x = dotStartX; x < dotEndX; x += dotSpacing) {
        doc.text(".", x, titleBaselineY)
      }
    }

    ctx.cursorY = rowTopY + rowHeight
  })
}

// ============================================================================
// Chart rendering (canvas → image)
// ============================================================================

const CHART_GAP_MM = 6
const CHART_DONUT_MM = 38
const CHART_LEGEND_MAX_ITEMS = 6
const CHART_CELL_HEIGHT_MM = 78

const renderDonutChartImage = (data: ChartDatum[], pixelSize = 600): string => {
  const canvas = document.createElement("canvas")
  canvas.width = pixelSize
  canvas.height = pixelSize
  const c = canvas.getContext("2d")
  if (!c) return ""
  const cx = pixelSize / 2
  const cy = pixelSize / 2
  const outerR = pixelSize * 0.42
  const innerR = pixelSize * 0.27

  const total = data.reduce((s, d) => s + Math.max(0, d.value), 0)

  if (total <= 0) {
    c.fillStyle = "#e5e7eb"
    c.beginPath()
    c.arc(cx, cy, outerR, 0, Math.PI * 2)
    c.fill()
    c.fillStyle = "#ffffff"
    c.beginPath()
    c.arc(cx, cy, innerR, 0, Math.PI * 2)
    c.fill()
    c.fillStyle = "#9ca3af"
    c.font = `${pixelSize * 0.06}px Helvetica, Arial, sans-serif`
    c.textAlign = "center"
    c.textBaseline = "middle"
    c.fillText("No data", cx, cy)
    return canvas.toDataURL("image/png")
  }

  let angle = -Math.PI / 2
  for (const d of data) {
    if (d.value <= 0) continue
    const slice = (d.value / total) * Math.PI * 2
    c.beginPath()
    c.moveTo(cx, cy)
    c.arc(cx, cy, outerR, angle, angle + slice)
    c.closePath()
    c.fillStyle = d.color
    c.fill()
    angle += slice
  }

  c.fillStyle = "#ffffff"
  c.beginPath()
  c.arc(cx, cy, innerR, 0, Math.PI * 2)
  c.fill()

  c.fillStyle = "#111827"
  c.font = `bold ${pixelSize * 0.13}px Helvetica, Arial, sans-serif`
  c.textAlign = "center"
  c.textBaseline = "middle"
  c.fillText(total.toLocaleString(), cx, cy - pixelSize * 0.025)

  c.fillStyle = "#6b7280"
  c.font = `${pixelSize * 0.05}px Helvetica, Arial, sans-serif`
  c.fillText("total", cx, cy + pixelSize * 0.075)

  return canvas.toDataURL("image/png")
}

// Parse "hsl(217, 91%, 60%)" or "#rrggbb" → RGB tuple for jsPDF
const parseColorToRgb = (color: string): [number, number, number] => {
  const hex = color.match(/^#([0-9a-f]{6})$/i)
  if (hex) {
    const v = parseInt(hex[1], 16)
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255]
  }
  const m = color.match(
    /hsl\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)%\s*,\s*(\d+(?:\.\d+)?)%\s*\)/i,
  )
  if (!m) return [156, 163, 175]
  const h = Number(m[1]) / 360
  const s = Number(m[2]) / 100
  const l = Number(m[3]) / 100
  const chroma = (1 - Math.abs(2 * l - 1)) * s
  const x = chroma * (1 - Math.abs(((h * 6) % 2) - 1))
  const mAdj = l - chroma / 2
  let r = 0
  let g = 0
  let b = 0
  if (h < 1 / 6) [r, g, b] = [chroma, x, 0]
  else if (h < 2 / 6) [r, g, b] = [x, chroma, 0]
  else if (h < 3 / 6) [r, g, b] = [0, chroma, x]
  else if (h < 4 / 6) [r, g, b] = [0, x, chroma]
  else if (h < 5 / 6) [r, g, b] = [x, 0, chroma]
  else [r, g, b] = [chroma, 0, x]
  return [
    Math.round((r + mAdj) * 255),
    Math.round((g + mAdj) * 255),
    Math.round((b + mAdj) * 255),
  ]
}

// Bar rows inside a chart cell — the report twin of the dashboard's BarChart
// component (same row order, colors, and bar-to-max scaling).
const CHART_BAR_MAX_ITEMS = 9

const drawBarRowsInCell = (
  ctx: DocCtx,
  x: number,
  y: number,
  cellWidth: number,
  data: ChartDatum[],
) => {
  const rowHeight = 4.5
  const rowGap = 2.5
  const labelWidth = 26
  const contentX = x + 3
  const total = data.reduce((s, d) => s + Math.max(0, d.value), 0)
  const items = data.slice(0, CHART_BAR_MAX_ITEMS)
  const hidden = data.length - items.length
  const maxValue = Math.max(1, ...data.map((d) => d.value))

  ctx.doc.setFontSize(8)
  const valueLabels = items.map((d) => {
    const pct = total > 0 ? Math.round((d.value / total) * 100) : 0
    return `${d.value.toLocaleString()} (${pct}%)`
  })
  ctx.doc.setFont("helvetica", "bold")
  const valueWidth = valueLabels.reduce((m, l) => Math.max(m, ctx.doc.getTextWidth(l)), 0)
  const trackWidth = cellWidth - 6 - labelWidth - valueWidth - 4

  items.forEach((d, i) => {
    const rowY = y + i * (rowHeight + rowGap)
    const textBaselineY = rowY + rowHeight - 1.2

    ctx.doc.setFont("helvetica", "normal")
    ctx.doc.setTextColor(...COLORS.text)
    const lines = ctx.doc.splitTextToSize(d.name, labelWidth - 2)
    ctx.doc.text(lines[0], contentX, textBaselineY)

    ctx.doc.setFillColor(243, 244, 246)
    ctx.doc.roundedRect(contentX + labelWidth, rowY, trackWidth, rowHeight, 1, 1, "F")
    if (d.value > 0) {
      const fillWidth = Math.max(2, (d.value / maxValue) * trackWidth)
      const [r, g, b] = parseColorToRgb(d.color)
      ctx.doc.setFillColor(r, g, b)
      ctx.doc.roundedRect(contentX + labelWidth, rowY, fillWidth, rowHeight, 1, 1, "F")
    }

    ctx.doc.setFont("helvetica", "bold")
    ctx.doc.setTextColor(...COLORS.text)
    ctx.doc.text(
      valueLabels[i],
      x + cellWidth - 3 - ctx.doc.getTextWidth(valueLabels[i]),
      textBaselineY,
    )
  })

  if (hidden > 0) {
    ctx.doc.setFont("helvetica", "italic")
    ctx.doc.setTextColor(...COLORS.subtext)
    ctx.doc.text(`+${hidden} more`, contentX, y + items.length * (rowHeight + rowGap) + 3)
  }
}

const drawChartCell = (
  ctx: DocCtx,
  x: number,
  y: number,
  cellWidth: number,
  title: string,
  data: ChartDatum[],
  style: ChartStyle = "donut",
) => {
  ctx.doc.setFillColor(255, 255, 255)
  ctx.doc.setDrawColor(203, 213, 225) // slate-300 — visible against the tinted page
  ctx.doc.setLineWidth(0.35)
  ctx.doc.roundedRect(x, y, cellWidth, CHART_CELL_HEIGHT_MM, 1.5, 1.5, "FD")

  ctx.doc.setFont("helvetica", "bold")
  ctx.doc.setFontSize(10)
  ctx.doc.setTextColor(...COLORS.text)
  ctx.doc.text(title, x + 3, y + 5)

  if (style === "bar") {
    drawBarRowsInCell(ctx, x, y + 10, cellWidth, data)
    return
  }

  const donutY = y + 8
  const donutX = x + (cellWidth - CHART_DONUT_MM) / 2
  const dataURL = renderDonutChartImage(data)
  if (dataURL) {
    ctx.doc.addImage(
      dataURL,
      "PNG",
      donutX,
      donutY,
      CHART_DONUT_MM,
      CHART_DONUT_MM,
    )
  }

  const total = data.reduce((s, d) => s + Math.max(0, d.value), 0)
  const items = data.slice(0, CHART_LEGEND_MAX_ITEMS)
  const hidden = data.length - items.length

  let ly = donutY + CHART_DONUT_MM + 4
  ctx.doc.setFontSize(8)

  items.forEach((d) => {
    const [r, g, b] = parseColorToRgb(d.color)
    ctx.doc.setFillColor(r, g, b)
    ctx.doc.rect(x + 3, ly - 2.4, 2.5, 2.5, "F")

    const pct = total > 0 ? Math.round((d.value / total) * 100) : 0
    const valueLabel = `${d.value.toLocaleString()} (${pct}%)`
    ctx.doc.setFont("helvetica", "bold")
    const valueWidth = ctx.doc.getTextWidth(valueLabel)

    ctx.doc.setFont("helvetica", "normal")
    ctx.doc.setTextColor(...COLORS.text)
    const nameMaxWidth = cellWidth - 3 - 4 - valueWidth - 3
    const lines = ctx.doc.splitTextToSize(d.name, nameMaxWidth)
    ctx.doc.text(lines[0], x + 7, ly)

    ctx.doc.setFont("helvetica", "bold")
    ctx.doc.setTextColor(...COLORS.text)
    ctx.doc.text(valueLabel, x + cellWidth - 3 - valueWidth, ly)

    ly += 4.2
  })

  if (hidden > 0) {
    ctx.doc.setFont("helvetica", "italic")
    ctx.doc.setTextColor(...COLORS.subtext)
    ctx.doc.text(`+${hidden} more`, x + 7, ly)
  }
}

const drawChartGrid = (
  ctx: DocCtx,
  cells: { title: string; data: ChartDatum[]; style?: ChartStyle }[],
) => {
  const contentWidth = PAGE_WIDTH_A4 - PAGE_MARGIN * 2
  const cellWidth = (contentWidth - CHART_GAP_MM) / 2

  for (let i = 0; i < cells.length; i += 2) {
    ensureSpace(ctx, CHART_CELL_HEIGHT_MM + 4)
    const left = cells[i]
    const right = cells[i + 1]
    const rowY = ctx.cursorY
    drawChartCell(ctx, PAGE_MARGIN, rowY, cellWidth, left.title, left.data, left.style)
    if (right) {
      drawChartCell(
        ctx,
        PAGE_MARGIN + cellWidth + CHART_GAP_MM,
        rowY,
        cellWidth,
        right.title,
        right.data,
        right.style,
      )
    }
    ctx.cursorY += CHART_CELL_HEIGHT_MM + CHART_GAP_MM
  }
}

const drawHorizontalBarChart = (
  ctx: DocCtx,
  rows: { label: string; value: number; color: string }[],
  total: number,
) => {
  const cardPadX = 5
  const cardPadY = 5
  const labelWidth = 22
  const valueWidth = 28
  const barHeight = 6
  const rowGap = 3
  const cardX = PAGE_MARGIN
  const cardWidth = PAGE_WIDTH_A4 - PAGE_MARGIN * 2
  const trackWidth = cardWidth - cardPadX * 2 - labelWidth - valueWidth
  const blockHeight = rows.length * (barHeight + rowGap) + 2
  const cardHeight = blockHeight + cardPadY * 2

  ensureSpace(ctx, cardHeight + 2)

  const cardY = ctx.cursorY
  ctx.doc.setFillColor(255, 255, 255)
  ctx.doc.setDrawColor(203, 213, 225)
  ctx.doc.setLineWidth(0.35)
  ctx.doc.roundedRect(cardX, cardY, cardWidth, cardHeight, 1.5, 1.5, "FD")

  const maxValue = Math.max(1, ...rows.map((r) => r.value))
  const contentY = cardY + cardPadY
  const contentX = cardX + cardPadX

  rows.forEach((row, i) => {
    const y = contentY + i * (barHeight + rowGap)
    const textBaselineY = y + barHeight - 1.5

    ctx.doc.setFont("helvetica", "normal")
    ctx.doc.setFontSize(9)
    ctx.doc.setTextColor(...COLORS.text)
    ctx.doc.text(row.label, contentX, textBaselineY)

    ctx.doc.setFillColor(243, 244, 246)
    ctx.doc.roundedRect(
      contentX + labelWidth,
      y,
      trackWidth,
      barHeight,
      1,
      1,
      "F",
    )

    if (row.value > 0) {
      const fillWidth = Math.max(2, (row.value / maxValue) * trackWidth)
      const [r, g, b] = parseColorToRgb(row.color)
      ctx.doc.setFillColor(r, g, b)
      ctx.doc.roundedRect(
        contentX + labelWidth,
        y,
        fillWidth,
        barHeight,
        1,
        1,
        "F",
      )
    }

    const pct = total > 0 ? Math.round((row.value / total) * 100) : 0
    const valueLabel = `${row.value.toLocaleString()} (${pct}%)`
    ctx.doc.setFont("helvetica", "bold")
    ctx.doc.setFontSize(9)
    ctx.doc.setTextColor(...COLORS.text)
    const labelWidthPx = ctx.doc.getTextWidth(valueLabel)
    ctx.doc.text(
      valueLabel,
      cardX + cardWidth - cardPadX - labelWidthPx,
      textBaselineY,
    )
  })

  ctx.cursorY += cardHeight + 2
}

// Single full-width 100%-stacked bar with an inline legend — the report twin of
// the dashboard's StackedBar component (same segment order, labels, and colors).
const drawStackedBar = (ctx: DocCtx, data: ChartDatum[]) => {
  const total = data.reduce((sum, d) => sum + d.value, 0)
  if (total === 0) {
    drawParagraph(ctx, "No connectors in scope.")
    return
  }

  const cardPadX = 5
  const cardPadY = 5
  const barHeight = 7
  const cardX = PAGE_MARGIN
  const cardWidth = PAGE_WIDTH_A4 - PAGE_MARGIN * 2
  const trackWidth = cardWidth - cardPadX * 2

  // Pre-lay-out the legend so the card height accounts for wrapping (all five
  // buckets present can exceed one line).
  ctx.doc.setFont("helvetica", "normal")
  ctx.doc.setFontSize(8)
  const legendItems = data.map((d) => {
    const pct = Math.round((d.value / total) * 100)
    const label = `${d.name}  ${d.value.toLocaleString()} (${pct}%)`
    return { label, color: d.color, width: 3.2 + ctx.doc.getTextWidth(label) + 5 }
  })
  const legendRowHeight = 4.4
  let legendLines = 1
  {
    let x = 0
    legendItems.forEach((item) => {
      if (x > 0 && x + item.width > trackWidth) {
        legendLines++
        x = 0
      }
      x += item.width
    })
  }
  const cardHeight = cardPadY * 2 + barHeight + 3 + legendLines * legendRowHeight

  ensureSpace(ctx, cardHeight + 2)

  const cardY = ctx.cursorY
  ctx.doc.setFillColor(255, 255, 255)
  ctx.doc.setDrawColor(203, 213, 225)
  ctx.doc.setLineWidth(0.35)
  ctx.doc.roundedRect(cardX, cardY, cardWidth, cardHeight, 1.5, 1.5, "FD")

  // Segments (plain rects inside a rounded clip is overkill for jsPDF — round only
  // the track ends by drawing the first/last segments over a rounded backdrop).
  const barX = cardX + cardPadX
  const barY = cardY + cardPadY
  ctx.doc.setFillColor(243, 244, 246)
  ctx.doc.roundedRect(barX, barY, trackWidth, barHeight, 1, 1, "F")
  let segX = barX
  data.forEach((d) => {
    const segWidth = (d.value / total) * trackWidth
    const [r, g, b] = parseColorToRgb(d.color)
    ctx.doc.setFillColor(r, g, b)
    ctx.doc.rect(segX, barY, segWidth, barHeight, "F")
    segX += segWidth
  })

  // Inline legend: swatch + "Label N (P%)" per segment, wrapping as pre-computed.
  let legendX = barX
  let legendY = barY + barHeight + 3 + 3.2
  ctx.doc.setFont("helvetica", "normal")
  ctx.doc.setFontSize(8)
  legendItems.forEach((item) => {
    if (legendX > barX && legendX + item.width > barX + trackWidth) {
      legendX = barX
      legendY += legendRowHeight
    }
    const [r, g, b] = parseColorToRgb(item.color)
    ctx.doc.setFillColor(r, g, b)
    ctx.doc.circle(legendX + 1.2, legendY - 1, 1.2, "F")
    ctx.doc.setTextColor(...COLORS.text)
    ctx.doc.text(item.label, legendX + 3.2, legendY)
    legendX += item.width
  })

  ctx.cursorY += cardHeight + 2
}

// ============================================================================
// Sections
// ============================================================================

const buildExecutiveSummary = (ctx: DocCtx, input: ReportInput) => {
  drawSectionTitle(ctx, "Executive Summary")

  const agentRisk = riskBuckets(input.agents)
  const mcpRisk = riskBuckets(input.mcps)
  const agentControllable = filterControllable(input.agentIssues)
  const mcpControllable = filterControllable(input.mcpIssues)
  const overallRiskScore = calculateOverallRiskScore([...input.agents, ...input.mcps])

  drawStatGrid(ctx, [
    {
      label: "Overall Risk",
      value: overallRiskScore === null ? "—" : `${overallRiskScore} / 100`,
      sub: getRiskLevel(overallRiskScore),
    },
    {
      label: "Devices",
      value: input.deviceCount.toLocaleString(),
      sub: "monitored",
    },
    {
      label: "High Risk Agents",
      value: (agentRisk.high + agentRisk.critical).toLocaleString(),
      sub: `of ${input.agents.length} types`,
    },
    {
      label: "High Risk Connectors",
      value: (mcpRisk.high + mcpRisk.critical).toLocaleString(),
      sub: `of ${input.mcps.length} types`,
    },
    {
      label: "Agent Issues",
      value: agentControllable.length.toLocaleString(),
      sub: `${countDevices(input.agentIssues)} devices · ${countIncidents(input.agentIssues).toLocaleString()} incidents`,
    },
    {
      label: "Connector Issues",
      value: mcpControllable.length.toLocaleString(),
      sub: `${countDevices(input.mcpIssues)} devices · ${countIncidents(input.mcpIssues).toLocaleString()} incidents`,
    },
  ])

  const agentIssuesForCharts = input.agentIssues as unknown as IssueTypeRow[]
  const mcpIssuesForCharts = input.mcpIssues as unknown as IssueTypeRow[]

  const RISK_LEGEND_ORDER = ["Critical", "High", "Medium", "Low"]
  const sortRiskBySeverity = (data: ChartDatum[]) =>
    [...data].sort((a, b) => {
      const ai = RISK_LEGEND_ORDER.indexOf(a.name)
      const bi = RISK_LEGEND_ORDER.indexOf(b.name)
      const aRank = ai === -1 ? RISK_LEGEND_ORDER.length : ai
      const bRank = bi === -1 ? RISK_LEGEND_ORDER.length : bi
      return aRank - bRank
    })

  const charts: { title: string; data: ChartDatum[]; style: ChartStyle }[] = [
    {
      title: "AI Agents — Risk Breakdown",
      data: sortRiskBySeverity(buildRiskDistribution(input.agents)),
      style: getChartStyle("agent-risk"),
    },
    {
      title: "Connectors — Risk Breakdown",
      data: sortRiskBySeverity(buildRiskDistribution(input.mcps)),
      style: getChartStyle("mcp-risk"),
    },
    {
      title: "Agent Issues — Top Risk Rules",
      data: buildIssueTypeChartData(
        buildIssueTypeDistribution(agentIssuesForCharts),
      ),
      style: getChartStyle("agent-top-rules"),
    },
    {
      title: "Connector Issues — Top Risk Rules",
      data: buildIssueTypeChartData(
        buildIssueTypeDistribution(mcpIssuesForCharts),
      ),
      style: getChartStyle("mcp-top-rules"),
    },
  ]

  drawChartGrid(ctx, charts)
}

const UNKNOWN_RISK_COLOR = "hsl(220, 9%, 46%)"

const drawRiskBarChart = (
  ctx: DocCtx,
  title: string,
  description: string,
  rows: { base_score: number | null; actual_score: number | null }[],
) => {
  const buckets = riskBuckets(rows)
  const visibleTotal =
    buckets.low + buckets.medium + buckets.high + buckets.unknown

  const contextLine =
    buckets.critical > 0
      ? `${visibleTotal.toLocaleString()} of ${rows.length.toLocaleString()} shown · ${buckets.critical.toLocaleString()} critical excluded.`
      : `${visibleTotal.toLocaleString()} total.`

  drawSubsectionTitle(ctx, title, `${description} ${contextLine}`)

  if (visibleTotal === 0) {
    drawParagraph(ctx, "No data to display.")
    return
  }

  const barRows = [
    { label: "High", value: buckets.high, color: RISK_CHART_COLORS.high },
    { label: "Medium", value: buckets.medium, color: RISK_CHART_COLORS.medium },
    { label: "Low", value: buckets.low, color: RISK_CHART_COLORS.low },
    ...(buckets.unknown > 0
      ? [{ label: "Unknown", value: buckets.unknown, color: UNKNOWN_RISK_COLOR }]
      : []),
  ]

  drawHorizontalBarChart(ctx, barRows, visibleTotal)
}

const buildAgentRiskInventory = (ctx: DocCtx, input: ReportInput) => {
  drawSectionTitle(ctx, "AI Agents — Risk & Inventory")

  drawRiskBarChart(
    ctx,
    "Risk distribution",
    "Share of AI agent types across High, Medium, and Low risk tiers.",
    input.agents,
  )

  drawSubsectionTitle(
    ctx,
    "Highest-risk AI agents",
    "Top 10 AI agent types ranked by effective risk score, with instances and deployment context.",
  )

  const topAgents = [...input.agents]
    .sort((a, b) => (effectiveScore(b) ?? -1) - (effectiveScore(a) ?? -1))
    .slice(0, 10)
  if (topAgents.length === 0) {
    drawParagraph(ctx, "No AI agents in use.")
    return
  }
  drawTable(
    ctx,
    [["Agent", "Risk", "Score", "Instances", "Deployment"]],
    topAgents.map((a) => [
      a.agent_name,
      getRiskLevel(effectiveScore(a)),
      formatScoreValue(effectiveScore(a)),
      (a.instance_count ?? 0).toLocaleString(),
      formatDeploymentTypes(a.deployment_types),
    ]),
    {
      columnStyles: {
        0: { cellWidth: 55 },
        1: { cellWidth: 22 },
        2: { halign: "right", cellWidth: 18 },
        3: { halign: "right", cellWidth: 22 },
        4: { cellWidth: 65 },
      },
    },
  )
}

const buildMcpRiskInventory = (ctx: DocCtx, input: ReportInput) => {
  drawSectionTitle(ctx, "Connectors — Risk & Inventory")

  drawRiskBarChart(
    ctx,
    "Risk distribution",
    "Share of connector types across High, Medium, and Low risk tiers.",
    input.mcps,
  )

  drawSubsectionTitle(
    ctx,
    "Highest-risk connectors",
    "Top 10 connector types ranked by effective risk score, with category and instance counts.",
  )

  const topMcps = [...input.mcps]
    .sort((a, b) => (effectiveScore(b) ?? -1) - (effectiveScore(a) ?? -1))
    .slice(0, 10)
  if (topMcps.length === 0) {
    drawParagraph(ctx, "No connectors in use.")
    return
  }
  drawTable(
    ctx,
    [["Connector", "Category", "Risk", "Score", "Instances"]],
    topMcps.map((m) => [
      m.mcp_server_name,
      m.category_name ?? "—",
      getRiskLevel(effectiveScore(m)),
      formatScoreValue(effectiveScore(m)),
      (m.instance_count ?? 0).toLocaleString(),
    ]),
    {
      columnStyles: {
        0: { cellWidth: 55 },
        1: { cellWidth: 65 },
        2: { cellWidth: 22 },
        3: { halign: "right", cellWidth: 18 },
        4: { halign: "right", cellWidth: 22 },
      },
    },
  )
}

const ISSUE_BREAKDOWN_TOP_N = 10
const ISSUE_DETAILS_LIMIT = 5

const drawDonutWithLegend = (
  ctx: DocCtx,
  chartData: ChartDatum[],
  donutSize: number,
) => {
  if (chartData.length === 0) return

  const padX = 6
  const padY = 6
  const cardW = PAGE_WIDTH_A4 - PAGE_MARGIN * 2
  const innerW = cardW - padX * 2
  const donutLegendGap = 8
  const legendW = innerW - donutSize - donutLegendGap
  const rowHeight = 5.4
  const legendBlockH = chartData.length * rowHeight
  const innerH = Math.max(donutSize, legendBlockH)
  const cardH = innerH + padY * 2

  ensureSpace(ctx, cardH + 2)

  const cardX = PAGE_MARGIN
  const cardY = ctx.cursorY

  ctx.doc.setFillColor(255, 255, 255)
  ctx.doc.setDrawColor(203, 213, 225)
  ctx.doc.setLineWidth(0.35)
  ctx.doc.roundedRect(cardX, cardY, cardW, cardH, 1.5, 1.5, "FD")

  // Donut, vertically centered within the inner area.
  const donutX = cardX + padX
  const donutY = cardY + padY + (innerH - donutSize) / 2
  const dataURL = renderDonutChartImage(chartData, 800)
  if (dataURL) {
    ctx.doc.addImage(dataURL, "PNG", donutX, donutY, donutSize, donutSize)
  }

  // Legend on the right, vertically centered.
  const legendX = donutX + donutSize + donutLegendGap
  const legendTopY = cardY + padY + (innerH - legendBlockH) / 2
  const total = chartData.reduce((s, d) => s + d.value, 0)

  // Pre-measure the widest value label so every value column right-aligns at
  // exactly the same x for a tidy column.
  ctx.doc.setFont("helvetica", "bold")
  ctx.doc.setFontSize(9)
  const valueLabels = chartData.map((d) => {
    const pct = total > 0 ? Math.round((d.value / total) * 100) : 0
    return `${d.value.toLocaleString()} · ${pct}%`
  })
  const maxValueWidth = valueLabels.reduce(
    (m, label) => Math.max(m, ctx.doc.getTextWidth(label)),
    0,
  )

  const valueRightX = legendX + legendW
  const nameX = legendX + 4
  const nameMaxWidth = legendW - 4 - maxValueWidth - 4

  chartData.forEach((d, i) => {
    // Center text baseline within the row so the swatch and label line up
    // consistently across every entry.
    const baselineY = legendTopY + i * rowHeight + 3.6
    const swatchY = baselineY - 2.6

    const [r, g, b] = parseColorToRgb(d.color)
    ctx.doc.setFillColor(r, g, b)
    ctx.doc.roundedRect(legendX, swatchY, 2.8, 2.8, 0.4, 0.4, "F")

    const lines = ctx.doc.splitTextToSize(d.name, nameMaxWidth) as string[]
    ctx.doc.setFont("helvetica", "normal")
    ctx.doc.setFontSize(9)
    ctx.doc.setTextColor(...COLORS.text)
    ctx.doc.text(lines[0] ?? "", nameX, baselineY)

    ctx.doc.setFont("helvetica", "bold")
    ctx.doc.setFontSize(9)
    ctx.doc.setTextColor(...COLORS.text)
    ctx.doc.text(valueLabels[i], valueRightX, baselineY, { align: "right" })
  })

  ctx.cursorY = cardY + cardH + 2
}

const drawIssueDetailsTable = (
  ctx: DocCtx,
  rows: ReportIssueRow[],
  limit: number = ISSUE_DETAILS_LIMIT,
) => {
  const controllable = filterControllable(rows).filter(
    (r) => (r.incident_count ?? 0) > 0,
  )
  const sorted = [...controllable].sort(
    (a, b) => (b.trigger_score ?? 0) - (a.trigger_score ?? 0),
  )
  const visible = sorted.slice(0, limit)
  const hidden = sorted.length - visible.length

  if (visible.length === 0) {
    drawParagraph(ctx, "No open controllable issues to detail.")
    return
  }

  drawTable(
    ctx,
    [["Risk Attribute", "Issue", "Incidents", "Devices", "Last Detected"]],
    visible.map((r) => {
      const deviceCount = new Set(
        (r.affected_devices ?? []).map((d) => d.device_id),
      ).size
      const lastSeen = r.last_seen_at
        ? formatDate(new Date(r.last_seen_at), "MMM d, yyyy")
        : "—"
      return [
        r.risk_rule_name,
        r.name,
        (r.incident_count ?? 0).toLocaleString(),
        deviceCount.toLocaleString(),
        lastSeen,
      ]
    }),
    {
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 70 },
        2: { halign: "right", cellWidth: 22 },
        3: { halign: "right", cellWidth: 22 },
        4: { cellWidth: 33 },
      },
    },
  )

  if (hidden > 0) {
    drawParagraph(
      ctx,
      `Showing top ${limit} of ${sorted.length} open issues, ranked by risk score.`,
      { size: 8 },
    )
  }
}

const buildIssueBreakdownPage = (
  ctx: DocCtx,
  source: "Agent" | "MCP",
  rows: ReportIssueRow[],
) => {
  const sourceLabel = source === "MCP" ? "Connector" : source
  const sectionTitle = `${sourceLabel} Issues — Risk Rule Breakdown`
  drawSectionTitle(ctx, sectionTitle)

  const controllable = filterControllable(rows)
  const totalIssueTypes = controllable.length
  const totalIncidents = countIncidents(rows)
  const affectedDevices = countDevices(rows)

  drawStatGrid(ctx, [
    {
      label: "Issue Types",
      value: totalIssueTypes.toLocaleString(),
      sub: "open & controllable",
    },
    { label: "Total Incidents", value: totalIncidents.toLocaleString() },
    { label: "Affected Devices", value: affectedDevices.toLocaleString() },
  ])

  drawSubsectionTitle(
    ctx,
    "Distribution by risk rule",
    `Top ${ISSUE_BREAKDOWN_TOP_N} risk rules ranked by incident count. Donut slices and legend percentages reflect each rule's share of the total incidents shown.`,
  )

  const issuesAsTypeRows = rows as unknown as IssueTypeRow[]
  const buckets = buildIssueTypeDistribution(
    issuesAsTypeRows,
    ISSUE_BREAKDOWN_TOP_N,
  )
  const chartData = buildIssueTypeChartData(buckets)

  if (chartData.length === 0) {
    drawParagraph(ctx, "No open controllable issues to break down.")
    return
  }

  drawDonutWithLegend(ctx, chartData, 52)

  drawSubsectionTitle(
    ctx,
    "Issue details",
    "Top 5 most critical open controllable issues, with risk attribute, incident count, affected devices, and last detection.",
  )

  drawIssueDetailsTable(ctx, rows)
}

const POPULARITY_TOP_N = 5

const buildInventoryOverview = (ctx: DocCtx, input: ReportInput) => {
  drawSectionTitle(ctx, "Inventory Overview")

  const cataloguedMcps = input.mcps.filter(
    (m) => m.mcp_server_type !== CUSTOM_MCP_SERVER_TYPE,
  )
  const customMcpCount = input.mcps.length - cataloguedMcps.length

  const mcpsForCategory = cataloguedMcps.map((m) => ({
    base_score: m.base_score,
    actual_score: m.actual_score,
    instance_count: m.instance_count,
    category_id: m.category_id ?? null,
    category_name: m.category_name,
  }))

  const distributionDescription =
    customMcpCount > 0
      ? `Distribution of AI agent types across deployment surfaces and connector types across categories. Values represent the count of distinct types. ${customMcpCount.toLocaleString()} custom connector type${customMcpCount === 1 ? "" : "s"} excluded.`
      : "Distribution of AI agent types across deployment surfaces and connector types across categories. Values represent the count of distinct types."

  drawSubsectionTitle(
    ctx,
    "Deployment types & categories",
    distributionDescription,
  )

  drawChartGrid(ctx, [
    {
      title: "AI Agents — Deployment Types",
      data: buildDeploymentDistribution(input.agents),
      style: getChartStyle("agent-deployment"),
    },
    {
      title: "Connectors — Categories",
      data: buildCategoryDistribution(mcpsForCategory),
      style: getChartStyle("mcp-categories"),
    },
  ])

  // Auth spans ALL servers (custom included) — authentication is a property of
  // every server, unlike the identity-keyed popularity/category views below.
  drawSubsectionTitle(
    ctx,
    "Connectors — Authentication",
    "How connectors in scope authenticate, by count of connector types using each method.",
  )
  drawStackedBar(ctx, buildAuthTypeDistribution(input.mcps))

  // Hard break: distributions (charts + auth) on one page, popularity tables
  // on the next — also removes any title-orphan risk for the tables.
  ctx.doc.addPage()
  ctx.cursorY = PAGE_MARGIN

  drawSubsectionTitle(
    ctx,
    "Most popular AI agents",
    `Top ${POPULARITY_TOP_N} AI agent types by instance count, with their effective risk score and deployment surfaces.`,
  )

  const popularAgents = [...input.agents]
    .filter((a) => (a.instance_count ?? 0) > 0)
    .sort((a, b) => (b.instance_count ?? 0) - (a.instance_count ?? 0))
    .slice(0, POPULARITY_TOP_N)

  if (popularAgents.length === 0) {
    drawParagraph(ctx, "No AI agents in use.")
  } else {
    drawTable(
      ctx,
      [["Agent", "Instances", "Risk", "Score", "Deployment"]],
      popularAgents.map((a) => [
        a.agent_name,
        (a.instance_count ?? 0).toLocaleString(),
        getRiskLevel(effectiveScore(a)),
        formatScoreValue(effectiveScore(a)),
        formatDeploymentTypes(a.deployment_types),
      ]),
      {
        columnStyles: {
          0: { cellWidth: 50 },
          1: { halign: "right", cellWidth: 25 },
          2: { cellWidth: 22 },
          3: { halign: "right", cellWidth: 18 },
          4: { cellWidth: 67 },
        },
      },
    )
  }

  const popularMcpsSubtitle =
    customMcpCount > 0
      ? `Top ${POPULARITY_TOP_N} catalogued connector types by instance count (custom connectors excluded), with category and effective risk score.`
      : `Top ${POPULARITY_TOP_N} connector types by instance count, with category and effective risk score.`

  drawSubsectionTitle(ctx, "Most popular connectors", popularMcpsSubtitle)

  const popularMcps = [...cataloguedMcps]
    .filter((m) => (m.instance_count ?? 0) > 0)
    .sort((a, b) => (b.instance_count ?? 0) - (a.instance_count ?? 0))
    .slice(0, POPULARITY_TOP_N)

  if (popularMcps.length === 0) {
    drawParagraph(ctx, "No catalogued connectors in use.")
  } else {
    drawTable(
      ctx,
      [["Connector", "Category", "Instances", "Risk", "Score"]],
      popularMcps.map((m) => [
        m.mcp_server_name,
        m.category_name ?? "—",
        (m.instance_count ?? 0).toLocaleString(),
        getRiskLevel(effectiveScore(m)),
        formatScoreValue(effectiveScore(m)),
      ]),
      {
        columnStyles: {
          0: { cellWidth: 55 },
          1: { cellWidth: 60 },
          2: { halign: "right", cellWidth: 25 },
          3: { cellWidth: 22 },
          4: { halign: "right", cellWidth: 20 },
        },
      },
    )
  }

}

const buildOrganizations = (ctx: DocCtx, input: ReportInput) => {
  drawSectionTitle(ctx, ORGANIZATIONS_SECTION.title)
  drawParagraph(
    ctx,
    "Where to focus first, based on each organization's open critical and high-severity issues.",
  )
  if (input.scorecard.length === 0) {
    drawParagraph(ctx, "No organization data was available for this scope.")
    return
  }
  drawTable(
    ctx,
    [["Organization", "Status", "Open issues"]],
    input.scorecard.map((row) => [
      row.email_domain,
      ORG_STATUS_LABELS[orgScorecardStatus(row)],
      orgScorecardSentence(row) || "—",
    ]),
    { columnStyles: { 0: { cellWidth: 55 }, 1: { cellWidth: 32 } } },
  )
}

const drawFooter = (doc: jsPDF, generatedAt: Date) => {
  const total = doc.getNumberOfPages()
  for (let i = 1; i <= total; i += 1) {
    doc.setPage(i)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.setTextColor(...COLORS.subtext)
    const stamp = formatDate(generatedAt, "yyyy-MM-dd HH:mm")
    doc.text(
      `Traceforce Security Report · ${stamp}`,
      PAGE_MARGIN,
      PAGE_HEIGHT_A4 - 8,
    )
    const pageLabel = `Page ${i} of ${total}`
    const w = doc.getTextWidth(pageLabel)
    doc.text(pageLabel, PAGE_WIDTH_A4 - PAGE_MARGIN - w, PAGE_HEIGHT_A4 - 8)
  }
}

// ============================================================================
// Page background (subtle brand gradient)
// ============================================================================

// Builds a faint navy → teal → green → yellow gradient PNG that mirrors the
// TraceForce table-throw artwork. A high-alpha white overlay keeps text and
// charts legible on top.
const renderBackgroundImage = (): string | null => {
  if (typeof document === "undefined") return null
  const widthPx = 900
  const heightPx = Math.round(widthPx * (PAGE_HEIGHT_A4 / PAGE_WIDTH_A4))
  const canvas = document.createElement("canvas")
  canvas.width = widthPx
  canvas.height = heightPx
  const c = canvas.getContext("2d")
  if (!c) return null

  const horiz = c.createLinearGradient(0, 0, widthPx, 0)
  horiz.addColorStop(0.0, "#1F2C45") // deep navy
  horiz.addColorStop(0.18, "#447193") // slate-blue
  horiz.addColorStop(0.34, "#5CA07E") // teal-green
  horiz.addColorStop(0.5, "#78B570") // green
  horiz.addColorStop(0.66, "#C9D76C") // lime
  horiz.addColorStop(0.82, "#E0E36E") // yellow-green
  horiz.addColorStop(1.0, "#EEEB8C") // pale yellow
  c.fillStyle = horiz
  c.fillRect(0, 0, widthPx, heightPx)

  // Vertical halo darkens top/bottom to echo the artwork's framing navy.
  const vert = c.createLinearGradient(0, 0, 0, heightPx)
  vert.addColorStop(0.0, "rgba(15, 24, 50, 0.55)")
  vert.addColorStop(0.5, "rgba(15, 24, 50, 0.00)")
  vert.addColorStop(1.0, "rgba(15, 24, 50, 0.55)")
  c.fillStyle = vert
  c.fillRect(0, 0, widthPx, heightPx)

  // White overlay keeps text and tables fully readable; tweak alpha to taste.
  c.fillStyle = "rgba(255, 255, 255, 0.86)"
  c.fillRect(0, 0, widthPx, heightPx)

  return canvas.toDataURL("image/jpeg", 0.88)
}

const paintBackground = (doc: jsPDF, dataURL: string | null) => {
  if (!dataURL) return
  doc.addImage(
    dataURL,
    "JPEG",
    0,
    0,
    PAGE_WIDTH_A4,
    PAGE_HEIGHT_A4,
    "tf-bg",
    "FAST",
  )
}

// Full-saturation version of the brand gradient used on the cover banner.
// Echoes the page background but without the white overlay so the header
// reads as the brand swatch and visually anchors the page tint below it.
const renderBannerImage = (heightMm: number): string | null => {
  if (typeof document === "undefined") return null
  const widthPx = 1200
  const heightPx = Math.round(widthPx * (heightMm / PAGE_WIDTH_A4))
  const canvas = document.createElement("canvas")
  canvas.width = widthPx
  canvas.height = heightPx
  const c = canvas.getContext("2d")
  if (!c) return null

  const horiz = c.createLinearGradient(0, 0, widthPx, 0)
  horiz.addColorStop(0.0, "#1F2C45")
  horiz.addColorStop(0.18, "#447193")
  horiz.addColorStop(0.34, "#5CA07E")
  horiz.addColorStop(0.5, "#78B570")
  horiz.addColorStop(0.66, "#C9D76C")
  horiz.addColorStop(0.82, "#E0E36E")
  horiz.addColorStop(1.0, "#EEEB8C")
  c.fillStyle = horiz
  c.fillRect(0, 0, widthPx, heightPx)

  // Subtle navy darkening at the very top edge to mirror the artwork's halo.
  const vert = c.createLinearGradient(0, 0, 0, heightPx)
  vert.addColorStop(0.0, "rgba(15, 24, 50, 0.45)")
  vert.addColorStop(0.6, "rgba(15, 24, 50, 0.00)")
  vert.addColorStop(1.0, "rgba(15, 24, 50, 0.10)")
  c.fillStyle = vert
  c.fillRect(0, 0, widthPx, heightPx)

  // Soft left-side scrim keeps the white wordmark readable over the lighter
  // half of the gradient.
  const scrim = c.createLinearGradient(0, 0, widthPx, 0)
  scrim.addColorStop(0.0, "rgba(15, 24, 50, 0.40)")
  scrim.addColorStop(0.45, "rgba(15, 24, 50, 0.10)")
  scrim.addColorStop(0.7, "rgba(15, 24, 50, 0.00)")
  scrim.addColorStop(1.0, "rgba(15, 24, 50, 0.00)")
  c.fillStyle = scrim
  c.fillRect(0, 0, widthPx, heightPx)

  return canvas.toDataURL("image/jpeg", 0.92)
}

// ============================================================================
// Public API
// ============================================================================

export const generateDashboardReport = async (input: ReportInput): Promise<void> => {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const ctx: DocCtx = { doc, cursorY: PAGE_MARGIN }

  const backgroundImage = renderBackgroundImage()

  // Wrap addPage so every new page (including ones created implicitly by
  // ensureSpace / autoTable overflow) gets the brand background.
  const originalAddPage = doc.addPage.bind(doc)
  doc.addPage = ((...args: Parameters<typeof originalAddPage>) => {
    const result = originalAddPage(...args)
    paintBackground(doc, backgroundImage)
    return result
  }) as typeof doc.addPage

  paintBackground(doc, backgroundImage)
  drawCover(ctx, input)

  const tocEntries: TocEntry[] = []
  const sectionBuilders: { section: ReportSection; build: () => void }[] = [
    {
      section: REPORT_SECTIONS[0], // Executive Summary
      build: () => buildExecutiveSummary(ctx, input),
    },
    // Organizations: multi-org scope only — single-org reports keep today's
    // exact section list and numbering. Same predicate as the dialog's
    // getReportSections call, carried on the snapshot.
    ...(input.multiOrg
      ? [
          {
            section: ORGANIZATIONS_SECTION,
            build: () => buildOrganizations(ctx, input),
          },
        ]
      : []),
    {
      section: REPORT_SECTIONS[1], // Inventory Overview
      build: () => buildInventoryOverview(ctx, input),
    },
    {
      section: REPORT_SECTIONS[2], // AI Agents — Risk & Inventory
      build: () => buildAgentRiskInventory(ctx, input),
    },
    {
      section: REPORT_SECTIONS[3], // MCP Servers — Risk & Inventory
      build: () => buildMcpRiskInventory(ctx, input),
    },
    {
      section: REPORT_SECTIONS[4], // Agent Issues — Risk Rule Breakdown
      build: () => buildIssueBreakdownPage(ctx, "Agent", input.agentIssues),
    },
    {
      section: REPORT_SECTIONS[5], // MCP Issues — Risk Rule Breakdown
      build: () => buildIssueBreakdownPage(ctx, "MCP", input.mcpIssues),
    },
  ]

  for (const { section, build } of sectionBuilders) {
    doc.addPage()
    ctx.cursorY = PAGE_MARGIN
    const pageNumber = doc.getNumberOfPages()
    tocEntries.push({ title: section.title, pageNumber })
    build()
  }

  // Now that all sections are laid out, return to the cover and paint the
  // table of contents with accurate page numbers.
  const lastPage = doc.getNumberOfPages()
  doc.setPage(1)
  ctx.cursorY = COVER_CONTENT_TOP_MM
  drawTableOfContents(ctx, tocEntries)
  doc.setPage(lastPage)

  drawFooter(doc, input.generatedAt)

  const stamp = formatDate(input.generatedAt, "yyyy-MM-dd")
  doc.save(`traceforce-security-report-${stamp}.pdf`)
}
