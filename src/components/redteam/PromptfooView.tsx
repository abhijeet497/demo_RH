import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useRedTeam } from "@/lib/redteam/store"
import {
  ASSESSMENT,
  ATTACK_SURFACE,
  ATTACK_TYPES,
  STRATEGY_LABELS,
  attackTypeLabel,
  summarizeAttacks,
} from "@/lib/redteam/dataset"

const fmtSecs = (ms: number) => `${(ms / 1000).toFixed(1)}s`

/** The "Attacks" tab: every attack in the plan that was run, and whether it worked. */
export const PromptfooView = ({ onOpenFinding }: { onOpenFinding: (id: string) => void }) => {
  const { target, selectedAttacks } = useRedTeam()
  const summary = summarizeAttacks(selectedAttacks)
  const plan = ATTACK_TYPES.filter((t) => selectedAttacks.includes(t.plugin))

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Attack run · {new Date(ASSESSMENT.recordedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
          </CardTitle>
          <CardDescription>
            {summary.total} attacks against {target?.name ?? "the agent"}. FAIL means the attack succeeded; PASS means the agent resisted it.
          </CardDescription>
          <div className="mt-2 flex flex-wrap gap-2">
            {plan.map((t) => (
              <Badge key={t.plugin} variant="secondary">{t.label}</Badge>
            ))}
            <Badge variant="outline">{STRATEGY_LABELS.direct}</Badge>
            <Badge variant="outline">{STRATEGY_LABELS.crescendo} (up to 3 turns)</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Attack type</TableHead>
                <TableHead>Style</TableHead>
                <TableHead>Result</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>What happened</TableHead>
                <TableHead className="text-right">Finding</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.rows.map((r, i) => (
                <TableRow key={r.idx}>
                  <TableCell className="font-medium">{i + 1}</TableCell>
                  <TableCell>{attackTypeLabel(r.plugin)}</TableCell>
                  <TableCell>{STRATEGY_LABELS[r.strategy] ?? r.strategy}</TableCell>
                  <TableCell>{r.pass ? <Badge variant="success">PASS</Badge> : <Badge variant="danger">FAIL</Badge>}</TableCell>
                  <TableCell>{fmtSecs(r.latencyMs)}</TableCell>
                  <TableCell className="max-w-md text-xs text-muted-foreground">{r.reason}</TableCell>
                  <TableCell className="text-right">
                    {r.findingId ? (
                      <Button variant="link" size="sm" className="h-auto p-0" onClick={() => onOpenFinding(r.findingId!)}>
                        View
                      </Button>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="mt-3 text-xs text-muted-foreground">
            Attacks generated and run by the Traceforce attack engine ({ASSESSMENT.engine}) · run {ASSESSMENT.evalId}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">The malicious document</CardTitle>
          <CardDescription>
            The only thing the attacker controlled: an uploaded invoice with a hidden note ({ATTACK_SURFACE.name}).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-xs">
            {ATTACK_SURFACE.note}
          </pre>
        </CardContent>
      </Card>
    </div>
  )
}
