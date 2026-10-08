import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { type ChartDatum } from "@/lib/dashboardCharts"

// Horizontal bar list — the bar twin of DonutChart for single-dimension
// distributions inside a MetricCard (mirrored in the PDF report's chart cells).
// Bars are scaled to the largest value (magnitude comparison), rows keep the
// caller's order, and colors match the donut's segments so a category keeps
// its identity when the user flips chart styles.
// onBarClick follows DonutChart's onSegmentClick contract: absent = non-interactive.
export const BarChart = ({
  data,
  maxItems,
  onBarClick,
}: {
  data: ChartDatum[]
  maxItems?: number
  onBarClick?: (name: string) => void
}) => {
  const isClickable = !!onBarClick
  const total = data.reduce((sum, d) => sum + d.value, 0)

  if (data.length === 0 || total === 0) {
    return (
      <div className="flex items-center justify-center h-[120px]">
        <p className="text-sm text-muted-foreground">No data</p>
      </div>
    )
  }

  const displayData = maxItems ? data.slice(0, maxItems) : data
  const hiddenData = maxItems ? data.slice(maxItems) : []
  const maxValue = Math.max(...data.map((d) => d.value), 1)
  const pct = (value: number) => Math.round((value / total) * 100)

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col justify-center gap-1.5 min-h-[120px] py-1">
        {displayData.map((d) => (
          <Tooltip key={d.name}>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  "flex items-center gap-2",
                  isClickable && "cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1",
                )}
                onClick={isClickable ? () => onBarClick(d.name) : undefined}
              >
                <span className="w-24 flex-shrink-0 truncate text-xs text-muted-foreground">
                  {d.name}
                </span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max((d.value / maxValue) * 100, 2)}%`,
                      backgroundColor: d.color,
                    }}
                  />
                </div>
                <span className="w-8 flex-shrink-0 text-right text-xs font-medium tabular-nums">
                  {d.value}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top">
              {d.name}: {d.value} ({pct(d.value)}%)
            </TooltipContent>
          </Tooltip>
        ))}
        {hiddenData.length > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-xs text-muted-foreground cursor-help underline decoration-dotted underline-offset-2">
                +{hiddenData.length} more
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <div className="flex flex-col gap-1">
                {hiddenData.map((d) => (
                  <div
                    key={d.name}
                    className={cn(
                      "flex items-center justify-between gap-3 px-1 py-0.5 rounded-sm",
                      isClickable && "cursor-pointer hover:bg-muted/50",
                    )}
                    onClick={isClickable ? () => onBarClick(d.name) : undefined}
                  >
                    <div className="flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: d.color }}
                      />
                      <span className="text-xs">{d.name}</span>
                    </div>
                    <span className="text-xs font-medium tabular-nums">{d.value}</span>
                  </div>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  )
}
