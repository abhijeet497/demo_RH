import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { type ChartDatum } from "@/lib/dashboardCharts"

// Full-width 100%-stacked horizontal bar with an inline legend beneath —
// the dashboard's form for single-dimension distributions that span the page
// (mirrored in the PDF report so the chart reads the same on both surfaces).
// onSegmentClick follows DonutChart's contract: absent = non-interactive.
export const StackedBar = ({
  data,
  onSegmentClick,
}: {
  data: ChartDatum[]
  onSegmentClick?: (name: string) => void
}) => {
  const total = data.reduce((sum, d) => sum + d.value, 0)
  if (total === 0) {
    return <p className="text-sm text-muted-foreground">No data</p>
  }
  return (
    <TooltipProvider>
      <div className="space-y-2">
        <div className="flex h-4 w-full overflow-hidden rounded-full">
          {data.map((d) => (
            <Tooltip key={d.name}>
              <TooltipTrigger asChild>
                <div
                  className={`h-full ${onSegmentClick ? "cursor-pointer hover:opacity-80" : ""}`}
                  style={{ width: `${(d.value / total) * 100}%`, backgroundColor: d.color }}
                  onClick={onSegmentClick ? () => onSegmentClick(d.name) : undefined}
                />
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  {d.name}: {d.value} ({Math.round((d.value / total) * 100)}%)
                </p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {data.map((d) => (
            <span key={d.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: d.color }} />
              {d.name}
              <span className="font-medium tabular-nums text-foreground">{d.value}</span>
            </span>
          ))}
        </div>
      </div>
    </TooltipProvider>
  )
}
