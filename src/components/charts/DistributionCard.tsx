import { useState } from "react"
import { PieChart, BarChart3 } from "lucide-react"
import { cn } from "@/lib/utils"
import { MetricCard } from "@/components/charts/MetricCard"
import { DonutChart } from "@/components/charts/DonutChart"
import { BarChart } from "@/components/charts/BarChart"
import { type ChartDatum } from "@/lib/dashboardCharts"
import { type ChartStyle, type ChartStyleId, getChartStyle, setChartStyle } from "@/lib/chartStyle"

// MetricCard for a single-dimension distribution with a user-toggleable chart
// style (donut ⇄ bar). The choice persists per chart id (see chartStyle.ts)
// and is mirrored by the PDF report, which reads the same preference.
export const DistributionCard = ({
  id,
  title,
  loading,
  data,
  maxLegendItems,
  onItemClick,
}: {
  id: ChartStyleId
  title: string
  loading?: boolean
  data: ChartDatum[]
  maxLegendItems?: number
  onItemClick?: (name: string) => void
}) => {
  const [style, setStyle] = useState<ChartStyle>(() => getChartStyle(id))
  const pick = (next: ChartStyle) => {
    setChartStyle(id, next)
    setStyle(next)
  }

  return (
    <MetricCard title={title} loading={loading} action={<StyleToggle value={style} onChange={pick} />}>
      {style === "bar" ? (
        <BarChart data={data} maxItems={maxLegendItems} onBarClick={onItemClick} />
      ) : (
        <DonutChart data={data} maxLegendItems={maxLegendItems} onSegmentClick={onItemClick} />
      )}
    </MetricCard>
  )
}

const StyleToggle = ({
  value,
  onChange,
}: {
  value: ChartStyle
  onChange: (style: ChartStyle) => void
}) => (
  <div className="flex items-center gap-0.5 rounded-md border border-border p-0.5">
    {(
      [
        { style: "donut" as const, label: "Donut chart", Icon: PieChart },
        { style: "bar" as const, label: "Bar chart", Icon: BarChart3 },
      ]
    ).map(({ style, label, Icon }) => (
      <button
        key={style}
        type="button"
        aria-label={label}
        aria-pressed={value === style}
        onClick={() => onChange(style)}
        className={cn(
          "rounded p-1 transition-colors",
          value === style
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </button>
    ))}
  </div>
)
