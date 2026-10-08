import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts"
import { cn } from "@/lib/utils"
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export interface DonutChartData {
  name: string
  value: number
  color: string
}

interface DonutChartProps {
  data: DonutChartData[]
  size?: number
  maxLegendItems?: number
  onSegmentClick?: (name: string) => void
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    const total = payload[0].payload.total || 1
    const percentage = ((data.value / total) * 100).toFixed(1)
    return (
      <div className="bg-popover border border-border rounded-md px-3 py-2 shadow-md">
        <p className="text-sm font-medium">{data.name}</p>
        <p className="text-xs text-muted-foreground">
          {data.value} ({percentage}%)
        </p>
      </div>
    )
  }
  return null
}

export const DonutChart = ({ data, size = 120, maxLegendItems, onSegmentClick }: DonutChartProps) => {
  const isClickable = !!onSegmentClick
  const total = data.reduce((sum, d) => sum + d.value, 0)
  const dataWithTotal = data.map(d => ({ ...d, total }))

  // Truncate legend if maxLegendItems is set
  const displayData = maxLegendItems ? data.slice(0, maxLegendItems) : data
  const hiddenData = maxLegendItems ? data.slice(maxLegendItems) : []
  const hiddenCount = hiddenData.length
  const useColumns = data.length > 6

  if (data.length === 0 || total === 0) {
    return (
      <div className="flex items-center justify-center" style={{ height: size }}>
        <p className="text-sm text-muted-foreground">No data</p>
      </div>
    )
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-4">
        {/* Chart - fixed size */}
        <div className="flex-shrink-0" style={{ width: size, height: size }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={dataWithTotal}
                cx="50%"
                cy="50%"
                innerRadius="55%"
                outerRadius="85%"
                paddingAngle={2}
                dataKey="value"
              >
                {dataWithTotal.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.color} 
                    stroke="none" 
                    style={isClickable ? { cursor: 'pointer' } : undefined}
                    onClick={isClickable ? () => onSegmentClick(entry.name) : undefined}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        
        {/* Legend - vertical stack on right, optional 2-column grid */}
        <div className={cn(
          "flex flex-col gap-1.5 min-w-0 flex-1",
          useColumns && "grid grid-cols-2 gap-x-3 gap-y-1.5"
        )}>
          {displayData.map((item) => (
            <div 
              key={item.name} 
              className={cn("flex items-center justify-between gap-2", isClickable && "cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1")}
              onClick={isClickable ? () => onSegmentClick(item.name) : undefined}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <div 
                  className="w-2 h-2 rounded-full flex-shrink-0" 
                  style={{ backgroundColor: item.color }}
                />
                <UITooltip>
                  <TooltipTrigger asChild>
                    <span className={cn("text-xs text-muted-foreground truncate", isClickable ? "cursor-pointer" : "cursor-default")}>
                      {item.name}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    {item.name}
                  </TooltipContent>
                </UITooltip>
              </div>
              <span className="text-xs font-medium tabular-nums">{item.value}</span>
            </div>
          ))}
          {hiddenCount > 0 && (
            <UITooltip>
              <TooltipTrigger asChild>
                <span className="text-xs text-muted-foreground cursor-help underline decoration-dotted underline-offset-2">
                  +{hiddenCount} more
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <div className="flex flex-col gap-1">
                  {hiddenData.map((item) => (
                    <div 
                      key={item.name} 
                      className={cn("flex items-center justify-between gap-3 px-1 py-0.5 rounded-sm", isClickable && "cursor-pointer hover:bg-muted/50")}
                      onClick={isClickable ? () => onSegmentClick(item.name) : undefined}
                    >
                      <div className="flex items-center gap-1.5">
                        <div 
                          className="w-2 h-2 rounded-full flex-shrink-0" 
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-xs">{item.name}</span>
                      </div>
                      <span className="text-xs font-medium tabular-nums">{item.value}</span>
                    </div>
                  ))}
                </div>
              </TooltipContent>
            </UITooltip>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}
