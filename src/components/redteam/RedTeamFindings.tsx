import { useState } from "react"
import { ExternalLink, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"
import { useRedTeam, type Finding } from "@/lib/redteam/store"
import { AGENT, ASSESSMENT, BRAINTRUST, PROMPTFOO_RESULTS, REDTEAM_ISSUE_TYPES } from "@/lib/redteam/dataset"

// Same date format the Agent Issues table uses for "Issue Detected".
const fmtDetected = (iso: string) => {
  const d = new Date(iso)
  return `${d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })} ${d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`
}

export const SeverityBadge = ({ s }: { s: Finding["severity"] }) => (
  <Badge variant={s === "High" ? "danger" : "warning"}>{s}</Badge>
)

export const StatusBadge = ({ f }: { f: Finding }) =>
  f.status === "fix-proposed" ? (
    <Badge variant="secondary">Fix proposed</Badge>
  ) : (
    <Badge variant="destructive">Active</Badge>
  )

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div>
    <h3 className="mb-2 text-sm font-semibold">{title}</h3>
    {children}
  </div>
)

export const FindingDialog = ({
  finding,
  onClose,
}: {
  finding: Finding | null
  onClose: () => void
}) => {
  const { proposeFix, addToRegression } = useRedTeam()
  const { toast } = useToast()
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState("")

  const tests = finding ? PROMPTFOO_RESULTS.filter((r) => finding.tests.includes(r.idx)) : []

  // The Dialog root stays mounted and only toggles `open`, like the app's own
  // incident modal. Mounting a dialog already-open from a closing dropdown
  // menu races its dismiss layer and can leave the page unclickable.
  return (
    <Dialog open={!!finding} onOpenChange={(v) => { if (!v) { setEditing(false); onClose() } }}>
      {finding && (
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle>{finding.title}</DialogTitle>
            <SeverityBadge s={finding.severity} />
            <StatusBadge f={finding} />
          </div>
          <DialogDescription>
            {finding.agentName} · {AGENT.environment} · {finding.category}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <Section title="What happened">
            <p className="text-sm text-muted-foreground">{finding.whatHappened}</p>
            <p className="mt-2 text-sm"><span className="font-medium">Impact: </span>{finding.impact}</p>
          </Section>

          <Section title="Evidence">
            <ol className="space-y-2">
              {finding.evidence.map((e, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                    {i + 1}
                  </span>
                  <span className="text-muted-foreground">{e}</span>
                </li>
              ))}
            </ol>
            {finding.receipt && (
              <div className="mt-3">
                <div className="mb-1 text-xs font-medium text-muted-foreground">
                  Tool receipt ({finding.tool})
                </div>
                <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-md border bg-muted/40 p-3 text-xs">
                  {finding.receipt}
                </pre>
              </div>
            )}
          </Section>

          <Section title="Failed tests">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Test</TableHead>
                  <TableHead>Strategy</TableHead>
                  <TableHead>Scorer</TableHead>
                  <TableHead>Result</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tests.map((t) => (
                  <TableRow key={t.idx}>
                    <TableCell>#{t.idx}</TableCell>
                    <TableCell>{t.strategy}</TableCell>
                    <TableCell className="font-mono text-xs">{t.scorer}</TableCell>
                    <TableCell>
                      <span className="font-medium text-danger">FAIL</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-2 flex flex-wrap gap-4 text-sm">
              <span className="text-muted-foreground">Promptfoo {ASSESSMENT.evalId}</span>
              <a
                href={BRAINTRUST.traceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                View trace in Braintrust <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </Section>

          <Separator />

          <Section title="Remediation">
            <p className="text-sm text-muted-foreground">{finding.recommendedFix}</p>
            {finding.proposedFix && !editing && (
              <div className="mt-3 rounded-md border bg-muted/30 p-3 text-sm">
                <div className="mb-1 text-xs font-medium text-muted-foreground">Proposed fix</div>
                {finding.proposedFix}
              </div>
            )}
            {editing ? (
              <div className="mt-3 space-y-2">
                <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} className="text-sm" />
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      proposeFix(finding.id, text)
                      setEditing(false)
                      toast({ title: "Fix proposed", description: "The finding stays open until a regression run passes." })
                    }}
                  >
                    Save proposed fix
                  </Button>
                  <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <Button
                className="mt-3 gap-2"
                variant={finding.proposedFix ? "outline" : "default"}
                onClick={() => {
                  setText(finding.proposedFix ?? finding.recommendedFix)
                  setEditing(true)
                }}
              >
                <ShieldAlert className="h-4 w-4" />
                {finding.proposedFix ? "Edit proposed fix" : "Remediate"}
              </Button>
            )}
          </Section>

          <Section title="Regression coverage">
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">Observed (vulnerable target)</div>
                <div className="mt-1">{tests.length} of {tests.length} attempts failed</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">Expected safe behavior</div>
                <div className="mt-1">{finding.expectedSafe}</div>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Dataset: {finding.dataset} · Scorer: {finding.scorer}. The fix is verified when the
              same cases pass on a re-run with the same scorers.
            </p>
            <Button
              className="mt-3"
              variant={finding.inRegression ? "outline" : "default"}
              disabled={finding.inRegression}
              onClick={() => {
                addToRegression(finding.id)
                toast({ title: "Added to regression", description: `Tracked in “${finding.dataset}”.` })
              }}
            >
              {finding.inRegression ? "Tracked in regression dataset" : "Add to regression tests"}
            </Button>
          </Section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { setEditing(false); onClose() }}>Close</Button>
        </DialogFooter>
      </DialogContent>
      )}
    </Dialog>
  )
}

export const FindingsTable = ({ onOpen }: { onOpen: (f: Finding) => void }) => {
  const { findings } = useRedTeam()
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Finding</TableHead>
          <TableHead>Severity</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Agent</TableHead>
          <TableHead>Failed tests</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {findings.map((f) => (
          <TableRow key={f.id}>
            <TableCell className="font-medium">{f.title}</TableCell>
            <TableCell><SeverityBadge s={f.severity} /></TableCell>
            <TableCell>{f.category}</TableCell>
            <TableCell>{f.agentName}</TableCell>
            <TableCell>{f.tests.length}</TableCell>
            <TableCell><StatusBadge f={f} /></TableCell>
            <TableCell className="text-right">
              <Button variant="link" size="sm" className="h-auto p-0" onClick={() => onOpen(f)}>
                View finding
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

/**
 * One Agent Issues row per red-team issue type, aggregated across every tested
 * agent — the same model as the device issue rows (a type with N incidents).
 * An incident is one successful attack (a failed test) against one agent.
 */
export interface RedTeamGroup {
  plugin: string
  category: string
  title: string
  remediation: string
  severity: Finding["severity"]
  findings: Finding[]
  incidents: { finding: Finding; testIdx: number }[]
}

export const groupRedTeamFindings = (findings: Finding[]): RedTeamGroup[] => {
  const groups = new Map<string, RedTeamGroup>()
  for (const f of findings) {
    let g = groups.get(f.plugin)
    if (!g) {
      const meta = REDTEAM_ISSUE_TYPES[f.plugin]
      g = {
        plugin: f.plugin,
        category: f.category,
        title: meta?.title ?? f.category,
        remediation: meta?.remediation ?? f.recommendedFix,
        severity: f.severity,
        findings: [],
        incidents: [],
      }
      groups.set(f.plugin, g)
    }
    g.findings.push(f)
    if (f.severity === "High") g.severity = "High"
    for (const testIdx of f.tests) g.incidents.push({ finding: f, testIdx })
  }
  return [...groups.values()]
}

/** The per-agent incident list behind a grouped row, like "View Incidents". */
export const RedTeamIncidentsDialog = ({
  group,
  onClose,
  onOpenFinding,
}: {
  group: RedTeamGroup | null
  onClose: () => void
  onOpenFinding: (f: Finding) => void
}) => {
  // Always mounted; only `open` toggles (see FindingDialog).
  return (
    <Dialog open={!!group} onOpenChange={(v) => { if (!v) onClose() }}>
      {group && (
      <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Incidents: {group.title}</DialogTitle>
          <DialogDescription>
            {group.incidents.length} successful attack{group.incidents.length === 1 ? "" : "s"} across{" "}
            {group.findings.length} agent{group.findings.length === 1 ? "" : "s"} · {group.category}
          </DialogDescription>
        </DialogHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Agent</TableHead>
              <TableHead>Attack</TableHead>
              <TableHead>What happened</TableHead>
              <TableHead>Detected</TableHead>
              <TableHead className="text-right">Evidence</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {group.incidents.map(({ finding, testIdx }) => {
              const test = PROMPTFOO_RESULTS.find((r) => r.idx === testIdx)
              return (
                <TableRow key={`${finding.id}-${testIdx}`}>
                  <TableCell className="font-medium">{finding.agentName}</TableCell>
                  <TableCell className="text-sm">#{testIdx} · {test?.strategy ?? "—"}</TableCell>
                  <TableCell className="max-w-md text-sm">{finding.title}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{fmtDetected(ASSESSMENT.recordedAt)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="link" size="sm" className="h-auto p-0" onClick={() => onOpenFinding(finding)}>
                      View finding
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </DialogContent>
      )}
    </Dialog>
  )
}
