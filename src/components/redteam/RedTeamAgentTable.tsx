import { useMemo, useState } from "react"
import { Eye, Loader2, Play, Search, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MultiSelect } from "@/components/ui/multi-select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useToast } from "@/hooks/use-toast"
import {
  ENVIRONMENT_OPTIONS,
  RISK_LEVEL_OPTIONS,
  getEnvironmentBadge,
  getRiskLevel,
  getScoreBadgeWithDiff,
} from "@/lib/appUtils"
import { awsBedrockEnabled } from "@/lib/featureFlags"
import { BEDROCK_ENVIRONMENT_LABEL, BEDROCK_ENVIRONMENT_OPTION, BEDROCK_ENVIRONMENT_VALUE } from "@/lib/bedrockInventory"
import { useRedTeamAgents, type RedTeamAgentRow } from "@/hooks/useRedTeamAgents"
import { useRedTeam, assessmentAvailable } from "@/lib/redteam/store"

/**
 * Pick which agent to test. Same agents, badges and filter controls as the AI
 * Agents page; only agents with a recorded assessment can be tested.
 */
export const RedTeamAgentTable = ({ onFocus }: { onFocus: () => void }) => {
  const { agents, loading } = useRedTeamAgents()
  const { target, runState, findings, selectedAttacks, startTest } = useRedTeam()
  const { toast } = useToast()
  const [search, setSearch] = useState("")
  const [riskFilters, setRiskFilters] = useState<string[]>([])
  const [envFilters, setEnvFilters] = useState<string[]>([])

  const environmentOptions = useMemo(
    () => [
      ...ENVIRONMENT_OPTIONS.filter((o) => o.value !== "all"),
      ...(awsBedrockEnabled ? [BEDROCK_ENVIRONMENT_OPTION] : []),
    ],
    [],
  )

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return agents.filter((a) => {
      if (q && !(a.agent_name?.toLowerCase().includes(q) || a.description?.toLowerCase().includes(q))) return false
      if (riskFilters.length) {
        const level = getRiskLevel(a.actual_score ?? a.base_score).toLowerCase()
        if (!riskFilters.includes(level)) return false
      }
      if (envFilters.length) {
        const matches =
          (envFilters.includes("host") && a.has_host_instances) ||
          (envFilters.includes(BEDROCK_ENVIRONMENT_VALUE) && a.environment_labels.includes(BEDROCK_ENVIRONMENT_LABEL)) ||
          a.sandbox_runtime_types.some((t) => envFilters.includes(String(t)))
        if (!matches) return false
      }
      return true
    })
  }, [agents, search, riskFilters, envFilters])

  const noPlan = selectedAttacks.length === 0
  const busy = runState === "running"
  const testable = visible.filter((a) => assessmentAvailable(a.id))

  const test = (a: RedTeamAgentRow) => {
    startTest({ id: a.id, name: a.agent_name, environment: a.environment_labels[0] ?? "Host" })
    onFocus()
  }

  const testAll = () => {
    if (!testable.length) {
      toast({
        title: "Nothing to test yet",
        description: `None of the ${visible.length} agents shown has a recorded assessment.`,
      })
      return
    }
    const skipped = visible.length - testable.length
    toast({
      title: `Testing ${testable.length} of ${visible.length} agents`,
      description: skipped ? `${skipped} skipped — no assessment recorded yet.` : undefined,
    })
    test(testable[0])
  }

  const statusFor = (a: RedTeamAgentRow) => {
    if (!assessmentAvailable(a.id)) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help text-sm text-muted-foreground">Not available</span>
            </TooltipTrigger>
            <TooltipContent>No red team assessment recorded for this agent yet.</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )
    }
    const isTarget = target?.id === a.id
    if (isTarget && busy) {
      return (
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Testing…
        </span>
      )
    }
    if (isTarget && runState === "completed") {
      const n = findings.filter((f) => f.status === "active").length
      return n > 0 ? <Badge variant="danger">{n} finding{n === 1 ? "" : "s"}</Badge> : <Badge variant="success">No findings</Badge>
    }
    return <Badge variant="secondary">Not tested</Badge>
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-primary" />
              Agents
            </CardTitle>
            <CardDescription>Find an agent and test it, or test everything in the current filter.</CardDescription>
          </div>
          <Button variant="outline" className="gap-2" disabled={loading || busy || noPlan || !visible.length} onClick={testAll}>
            <Play className="h-4 w-4" />
            Test all ({visible.length})
          </Button>
        </div>
        {/* Same labeled filter pattern as the AI Agents page (label + compact MultiSelect). */}
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search agents…" className="pl-9" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Risk Level</label>
            <MultiSelect
              options={RISK_LEVEL_OPTIONS.filter((o) => o.value !== "all").map((o) => ({ id: o.value, name: o.label }))}
              selectedIds={riskFilters}
              onChange={setRiskFilters}
              placeholder="All"
              searchPlaceholder="Search risk levels..."
              emptyMessage="No risk levels found."
              label="risk level"
              compact
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Environment</label>
            <MultiSelect
              options={environmentOptions.map((o) => ({ id: o.value, name: o.label }))}
              selectedIds={envFilters}
              onChange={setEnvFilters}
              placeholder="All"
              searchPlaceholder="Search environments..."
              emptyMessage="No environments found."
              label="environment"
              compact
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Agent</TableHead>
              <TableHead>Environment</TableHead>
              <TableHead>Risk</TableHead>
              <TableHead>Red teaming</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                  <TableCell />
                </TableRow>
              ))
            ) : visible.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  No agents match your filters
                </TableCell>
              </TableRow>
            ) : (
              visible.map((a) => {
                const testableRow = assessmentAvailable(a.id)
                const isTarget = target?.id === a.id
                const hasResults = isTarget && runState === "completed"
                return (
                  <TableRow key={a.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted/50">
                          {a.logo_url ? <img src={a.logo_url} alt="" className="h-7 w-7 object-contain" /> : <Users className="h-4 w-4 text-primary" />}
                        </div>
                        <div>
                          <div className="font-medium">{a.agent_name}</div>
                          {a.description && <div className="line-clamp-1 max-w-md text-sm text-muted-foreground">{a.description}</div>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {a.environment_labels.length
                          ? a.environment_labels.map((l) => <span key={l}>{getEnvironmentBadge(l)}</span>)
                          : a.has_host_instances
                            ? <Badge>Host</Badge>
                            : <span className="text-muted-foreground">—</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      {getScoreBadgeWithDiff(a.base_score, a.actual_score) ?? <span className="text-sm text-muted-foreground">Not scored</span>}
                    </TableCell>
                    <TableCell>{statusFor(a)}</TableCell>
                    <TableCell className="text-right">
                      {hasResults ? (
                        <Button size="sm" variant="outline" className="gap-1.5" onClick={onFocus}>
                          <Eye className="h-3.5 w-3.5" />
                          View results
                        </Button>
                      ) : (
                        <Button size="sm" className="gap-1.5" disabled={!testableRow || busy || noPlan} onClick={() => test(a)}>
                          <Play className="h-3.5 w-3.5" />
                          Test
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
