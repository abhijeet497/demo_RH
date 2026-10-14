import { useState } from "react"
import { ChevronDown, ExternalLink, ShieldCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table"
import {
  BRAINTRUST,
  BT_ONLINE_SCORING,
  BT_SCORERS,
  OUTCOME_LABELS,
  SPAN_LABELS,
  SPAN_COUNTS,
  TRACES,
  UNSAFE_SPANS,
  type TraceSummary,
} from "@/lib/redteam/dataset"

const outcomeVariant = (o: TraceSummary["outcome"]) =>
  o === "action executed" ? "danger" : o === "data disclosed" ? "warning" : "secondary"

/** One recorded attack session, told step by step in plain language. */
const SessionCard = ({ trace }: { trace: TraceSummary }) => (
  <Card>
    <CardHeader className="pb-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-base">{OUTCOME_LABELS[trace.outcome]}</CardTitle>
        <Badge variant={outcomeVariant(trace.outcome)}>{trace.outcome}</Badge>
      </div>
      <CardDescription>
        Session <span className="font-mono">{trace.id}</span> · {trace.timeline.length} steps shown
      </CardDescription>
    </CardHeader>
    <CardContent>
      <ol className="space-y-2">
        {trace.timeline.map((span, i) => {
          const unsafe = UNSAFE_SPANS.has(span)
          return (
            <li key={i} className="flex gap-3 text-sm">
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                  unsafe ? "bg-danger text-danger-foreground" : "bg-muted"
                }`}
              >
                {i + 1}
              </span>
              <div>
                <span className={unsafe ? "font-medium text-danger" : ""}>{SPAN_LABELS[span] ?? span}</span>
                <span className="ml-2 font-mono text-[11px] text-muted-foreground">{span}</span>
              </div>
            </li>
          )
        })}
      </ol>
    </CardContent>
  </Card>
)

/** The "Evidence" tab: what the agent actually did, recorded step by step. */
export const BraintrustView = () => {
  const [techOpen, setTechOpen] = useState(false)
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle className="text-base">Recorded attack sessions</CardTitle>
              <CardDescription>
                {BRAINTRUST.traces} sessions recorded on{" "}
                {new Date(BRAINTRUST.uploadedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}.
                Every step the agent took was captured, so each finding is backed by what actually happened — not by an opinion.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a href={BRAINTRUST.traceUrl} target="_blank" rel="noopener noreferrer" className="gap-1">
                Open full recording <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-success">
            <ShieldCheck className="h-3.5 w-3.5" /> Recording verified
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {TRACES.map((t) => (
          <SessionCard key={t.id} trace={t} />
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">How results are judged</CardTitle>
          <CardDescription>Each session is checked against what the agent did, not what it said.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            {BT_SCORERS.map((s) => (
              <div key={s.name} className="rounded-lg border p-4">
                <div className="text-sm font-medium">{s.name}</div>
                <div className="mt-1 text-sm text-muted-foreground">{s.question}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {BT_ONLINE_SCORING[0].name} run automatically on {BT_ONLINE_SCORING[0].coverage};{" "}
            {BT_ONLINE_SCORING[1].name} runs on {BT_ONLINE_SCORING[1].coverage}.
          </p>
        </CardContent>
      </Card>

      <Collapsible open={techOpen} onOpenChange={setTechOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1 px-0">
            <ChevronDown className={`h-4 w-4 transition-transform ${techOpen ? "rotate-180" : ""}`} />
            Technical details
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="text-xs text-muted-foreground">
                Recorder: {BRAINTRUST.project} · {BRAINTRUST.traces} traces · {BRAINTRUST.spans} spans · {BRAINTRUST.rows} rows
              </div>
              <div className="flex flex-wrap gap-2">
                {BRAINTRUST.verified.map((v) => (
                  <Badge key={v} variant="success">{v}</Badge>
                ))}
              </div>
              <Table>
                <TableBody>
                  {SPAN_COUNTS.map((s) => (
                    <TableRow key={s.name}>
                      <TableCell className="font-mono text-xs">{s.name}</TableCell>
                      <TableCell className="text-right">{s.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
