import { Crosshair } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useRedTeam } from "@/lib/redteam/store"
import { ATTACK_TYPES, RH_REQUIREMENTS, summarizeAttacks } from "@/lib/redteam/dataset"

const RhBadge = ({ code }: { code: string }) => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        {/* Badge is a plain component; give the trigger a DOM node to attach its ref to. */}
        <span className="inline-flex">
          <Badge variant="outline" className="cursor-help font-mono text-[11px]">{code}</Badge>
        </span>
      </TooltipTrigger>
      <TooltipContent>{RH_REQUIREMENTS[code] ?? code}</TooltipContent>
    </Tooltip>
  </TooltipProvider>
)

/** Choose which attack types a test includes; each shows the RH requirements it covers. */
export const AttackPlanCard = () => {
  const { selectedAttacks, setSelectedAttacks } = useRedTeam()
  const summary = summarizeAttacks(selectedAttacks)

  const toggle = (plugin: string, on: boolean) =>
    setSelectedAttacks(on ? [...selectedAttacks, plugin] : selectedAttacks.filter((p) => p !== plugin))

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Crosshair className="h-4 w-4 text-primary" />
              Attack plan
            </CardTitle>
            <CardDescription>
              Choose what to test for. Each attack type is mapped to the Robinhood requirement it exercises.
            </CardDescription>
          </div>
          <div className="text-sm text-muted-foreground">
            {selectedAttacks.length} of {ATTACK_TYPES.length} types · {summary.total} attacks
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-2">
          {ATTACK_TYPES.map((t) => {
            const on = selectedAttacks.includes(t.plugin)
            return (
              <label
                key={t.plugin}
                className={`flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors ${
                  on ? "border-primary/40 bg-primary/5" : "hover:bg-muted/40"
                }`}
              >
                <Checkbox checked={on} onCheckedChange={(v) => toggle(t.plugin, v === true)} className="mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{t.label}</span>
                    {t.rh.map((code) => (
                      <RhBadge key={code} code={code} />
                    ))}
                  </div>
                  <div className="mt-0.5 text-sm text-muted-foreground">{t.description}</div>
                </div>
              </label>
            )
          })}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Every type runs single-step and multi-step variants (multi-step covers RT-03). Before/after regression
          covers RT-05; recorded evidence covers RT-06.
        </p>
        {selectedAttacks.length === 0 && (
          <p className="mt-2 text-sm text-danger">Select at least one attack type to run a test.</p>
        )}
      </CardContent>
    </Card>
  )
}
