import { useState } from "react"
import { ArrowLeft, ExternalLink, MoreVertical, Target } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"
import { useRedTeam, RED_TEAM_TARGET, type Finding } from "@/lib/redteam/store"
import { ASSESSMENT, ATTACK_TYPES, BRAINTRUST, summarizeAttacks } from "@/lib/redteam/dataset"
import { TargetCard } from "@/components/redteam/TargetCard"
import { AttackPlanCard } from "@/components/redteam/AttackPlanCard"
import { RedTeamAgentTable } from "@/components/redteam/RedTeamAgentTable"
import { PromptfooView } from "@/components/redteam/PromptfooView"
import { BraintrustView } from "@/components/redteam/BraintrustView"
import { RegressionView } from "@/components/redteam/RegressionView"
import { FindingDialog, FindingsTable } from "@/components/redteam/RedTeamFindings"

const Stat = ({ label, value, tone }: { label: string; value: string | number; tone?: string }) => (
  <div className="rounded-lg border p-4">
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className={`mt-1 text-2xl font-bold ${tone ?? ""}`}>{value}</div>
  </div>
)

// Same date format the Agent Issues table uses for "Issue Detected".
const fmtDetected = (iso: string) => {
  const d = new Date(iso)
  return `${d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })} ${d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`
}

const Overview = () => {
  const { selectedAttacks } = useRedTeam()
  const s = summarizeAttacks(selectedAttacks)
  const plan = ATTACK_TYPES.filter((t) => selectedAttacks.includes(t.plugin))
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Attacks run" value={s.total} />
        <Stat label="Attacks succeeded" value={s.failed} tone="text-danger" />
        <Stat label="Attacks resisted" value={s.passed} tone="text-success" />
        <Stat label="Pass rate" value={`${s.passRate}%`} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Test summary</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <div className="text-xs text-muted-foreground">Tested on</div>
            <div>{fmtDetected(ASSESSMENT.recordedAt)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Proof</div>
            <a
              href={BRAINTRUST.traceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              View the full recording <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">What was tested</div>
            <div className="mb-1.5">
              {s.total} simulated attacks across {plan.length} attack type{plan.length === 1 ? "" : "s"}
            </div>
            <div className="flex flex-wrap gap-1">
              {plan.map((t) => (
                <Badge key={t.plugin} variant="secondary">{t.label}</Badge>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">How</div>
            <div>Single-step and multi-step attacks (up to 3 turns).</div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * Red Teaming. Two states: pick an attack plan and an agent, or focus on one
 * agent's run and results. `preview` skips the org-backed agent list (used by
 * the unauthenticated preview route) and defaults to the recorded target.
 */
const RedTeaming = ({ preview = false }: { preview?: boolean }) => {
  const { target, runState, findings, reset } = useRedTeam()
  const { toast } = useToast()
  const [openId, setOpenId] = useState<string | null>(null)
  const [view, setView] = useState<"list" | "agent">(target || preview ? "agent" : "list")
  const current: Finding | null = openId ? findings.find((f) => f.id === openId) ?? null : null
  const shownTarget = target ?? (preview ? RED_TEAM_TARGET : null)
  const focused = view === "agent" && shownTarget

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
            <Target className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Red Teaming</h1>
            <p className="text-muted-foreground">
              Test your AI agents, confirm what happened, and track the fix.
            </p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={() => {
                reset()
                setOpenId(null)
                setView("list")
                toast({ title: "Red Teaming cleared" })
              }}
            >
              Clear results
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {!focused && (
        <>
          <AttackPlanCard />
          {!preview && <RedTeamAgentTable onFocus={() => setView("agent")} />}
        </>
      )}

      {focused && (
        <>
          {!preview && (
            <Button variant="ghost" className="-ml-2 gap-1.5" onClick={() => setView("list")}>
              <ArrowLeft className="h-4 w-4" />
              Back to agents
            </Button>
          )}
          {/* The preview route has no agent list, so expose the plan here for review. */}
          {preview && <AttackPlanCard />}
          <TargetCard target={shownTarget} />
          {runState === "completed" && (
            <Tabs defaultValue="overview">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="findings">Findings ({findings.length})</TabsTrigger>
                <TabsTrigger value="attacks">Attacks</TabsTrigger>
                <TabsTrigger value="evidence">Evidence</TabsTrigger>
                <TabsTrigger value="regression">Regression</TabsTrigger>
              </TabsList>
              <TabsContent value="overview"><Overview /></TabsContent>
              <TabsContent value="findings">
                <Card>
                  <CardContent className="pt-6">
                    <FindingsTable onOpen={(f) => setOpenId(f.id)} />
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="attacks"><PromptfooView onOpenFinding={setOpenId} /></TabsContent>
              <TabsContent value="evidence"><BraintrustView /></TabsContent>
              <TabsContent value="regression"><RegressionView /></TabsContent>
            </Tabs>
          )}
        </>
      )}

      <FindingDialog finding={current} onClose={() => setOpenId(null)} />
    </div>
  )
}

export default RedTeaming
