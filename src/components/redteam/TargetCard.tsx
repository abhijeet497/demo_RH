import { CheckCircle2, Circle, Loader2, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useRedTeam, RED_TEAM_TARGET, type RedTeamTarget } from "@/lib/redteam/store"
import { AGENT, ASSESSMENT, ATTACK_TYPES, ORCHESTRATION_STAGES, summarizeAttacks } from "@/lib/redteam/dataset"

/** The agent under test, its attack plan, and the orchestration pipeline. */
export const TargetCard = ({ target }: { target: RedTeamTarget }) => {
  const { runState, stage, selectedAttacks, startTest } = useRedTeam()
  const running = runState === "running"
  const isRecorded = target.id === RED_TEAM_TARGET.id
  const plan = ATTACK_TYPES.filter((t) => selectedAttacks.includes(t.plugin))
  const summary = summarizeAttacks(selectedAttacks)

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">{target.name}</CardTitle>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="outline">{target.environment}</Badge>
              {isRecorded && (
                <span className="text-xs">
                  {AGENT.account} · {AGENT.region} · {AGENT.runtime}
                </span>
              )}
            </div>
            {isRecorded && (
              <div className="mt-2 text-xs text-muted-foreground">
                {AGENT.architecture.join(" → ")} · principal {AGENT.principal}
              </div>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Attack plan · {summary.total} attacks:</span>
              {plan.map((t) => (
                <Badge key={t.plugin} variant="secondary">{t.label}</Badge>
              ))}
            </div>
          </div>
          <Button onClick={() => startTest(target)} disabled={running || plan.length === 0} className="gap-2">
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {running ? "Testing…" : runState === "completed" ? "Test Agent again" : "Test Agent"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 md:grid-cols-5">
          {ORCHESTRATION_STAGES.map((s, i) => {
            const done = runState === "completed" || (running && i < stage)
            const current = running && i === stage
            return (
              <div
                key={s.key}
                className={`rounded-lg border p-3 ${
                  current ? "border-primary bg-primary/5" : done ? "border-success/40" : ""
                }`}
              >
                <div className="flex items-center gap-2 text-sm font-medium">
                  {done ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : current ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground" />
                  )}
                  {s.label}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{s.detail}</div>
              </div>
            )
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          Results are from a recorded test run ({new Date(ASSESSMENT.recordedAt).toLocaleDateString()}).
        </p>
      </CardContent>
    </Card>
  )
}
