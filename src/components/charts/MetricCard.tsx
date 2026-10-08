import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

interface MetricCardProps {
  title: string
  loading?: boolean
  /** Optional control rendered on the right side of the header (e.g. a chart-style toggle). */
  action?: React.ReactNode
  children: React.ReactNode
}

export const MetricCard = ({ title, loading, action, children }: MetricCardProps) => {
  return (
    <Card>
      <CardHeader className="py-3 px-4 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {action}
      </CardHeader>
      <CardContent className="px-4 pb-3 pt-0">
        {loading ? (
          <div className="flex items-center gap-4">
            <Skeleton className="h-[120px] w-[120px] rounded-full flex-shrink-0" />
            <div className="flex flex-col gap-2 flex-1">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  )
}
