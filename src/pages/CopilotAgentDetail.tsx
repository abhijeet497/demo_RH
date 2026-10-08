import { useEffect, useState } from "react"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"
import { AlertTriangle, ArrowLeft, Copy } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { COPILOT_LOGO_URL, availableToLabel, channelLabel, deployedToLabel, formatCopilotDate, isRiskyTool } from "@/lib/copilot"
import { getCopilotAgent } from "@/lib/copilotMock"
import type { CopilotAgentDetail as Detail, CopilotTool } from "@/lib/copilotTypes"

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1">
    <p className="text-sm text-muted-foreground">{label}</p>
    <div className="text-sm text-foreground">{children ?? "—"}</div>
  </div>
)

// An ID with a copy button; "—" when missing.
const IdValue = ({ v }: { v: string | null }) => {
  const { toast } = useToast()
  if (!v) return <>—</>
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(v)
      toast({ title: "Copied" })
    } catch {
      toast({ title: "Could not copy", variant: "destructive" })
    }
  }
  return (
    <span className="inline-flex items-center gap-1">
      <span className="break-all font-mono">{v}</span>
      <Button variant="ghost" size="icon" className="h-6 w-6" aria-label="Copy" onClick={copy}>
        <Copy className="h-3.5 w-3.5" />
      </Button>
    </span>
  )
}

const Chips = ({ items }: { items: string[] }) =>
  items.length ? (
    <div className="flex flex-wrap gap-1">{items.map((i) => <Badge key={i} variant="secondary">{i}</Badge>)}</div>
  ) : <span className="text-sm text-muted-foreground">None</span>

const PERMISSION_LABEL: Record<CopilotTool["permission"], string> = {
  read: "Read", write: "Write", delete: "Delete", unknown: "Unknown",
}

export default function CopilotAgentDetail() {
  const { agentId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [agent, setAgent] = useState<Detail | null | undefined>(undefined)
  const back = searchParams.get("back") ?? ""
  const goBack = () => navigate(`/agents${back ? `?${back}` : ""}`)

  useEffect(() => {
    let cancelled = false
    setAgent(undefined)
    getCopilotAgent(agentId ?? "").then((a) => { if (!cancelled) setAgent(a) })
    return () => { cancelled = true }
  }, [agentId])

  const BackButton = (
    <Button variant="ghost" onClick={goBack}><ArrowLeft className="mr-2 h-4 w-4" />Back to AI Agents</Button>
  )

  if (agent === undefined)
    return <div className="space-y-4 p-6">{BackButton}<Skeleton className="h-10 w-64" /><Skeleton className="h-48 w-full" /></div>
  if (agent === null)
    return <div className="space-y-4 p-6">{BackButton}<p className="text-lg font-medium">Agent not found</p></div>

  const u = agent.usage
  return (
    <div className="space-y-6 p-6">
      {BackButton}
      <div className="flex flex-wrap items-center gap-3">
        <img src={COPILOT_LOGO_URL} alt="" className="h-10 w-10 object-contain" />
        <h1 className="text-2xl font-bold">{agent.name}</h1>
        {agent.published_status && <Badge variant="outline">{agent.published_status}</Badge>}
        {agent.is_blocked && <Badge variant="destructive">Blocked</Badge>}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Overview</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Platform">{agent.platform}</Field>
          <Field label="Published status">{agent.published_status}</Field>
          <Field label="Blocked">{agent.is_blocked ? "Yes" : "No"}</Field>
          <Field label="Tenant"><span className="break-all font-mono">{agent.tenant_id}</span></Field>
          <Field label="Created">{formatCopilotDate(agent.created_at)}</Field>
          <Field label="Last modified">{formatCopilotDate(agent.modified_at)}</Field>
          <Field label="Last published">{formatCopilotDate(agent.last_published_at)}</Field>
          <Field label="Available to">{availableToLabel(agent.available_to)}</Field>
          <Field label="Deployment">{deployedToLabel(agent.deployed_to)}</Field>
          <Field label="Authentication">{agent.auth_types.join(", ") || null}</Field>
          <Field label="Agent location">{agent.agent_location}</Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Owner</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Owner ID"><IdValue v={agent.owner_id} /></Field>
          <Field label="Last published by"><IdValue v={agent.last_published_by} /></Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Description and Instructions</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Field label="Description"><p className="whitespace-pre-wrap">{agent.description || "—"}</p></Field>
          <Field label="Instructions"><p className="whitespace-pre-wrap">{agent.instructions || "—"}</p></Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Usage</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Active users">{u.active_users ?? "—"}</Field>
          <Field label="Total sessions">{u.total_sessions ?? "—"}</Field>
          <Field label="Last used">{formatCopilotDate(u.last_used_date) ?? "Never used"}</Field>
          <Field label="Error rate">{u.exception_rate}</Field>
          <Field label="Run time (hours)">{u.total_run_time_hours}</Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Channels and Models</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Channels"><Chips items={agent.channels.map(channelLabel)} /></Field>
          <Field label="Models"><Chips items={agent.llm_models} /></Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Tools</CardTitle></CardHeader>
        <CardContent>
          {agent.tools.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Access</TableHead>
                  <TableHead>Approval</TableHead><TableHead>Auth</TableHead><TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agent.tools.map((t, i) => {
                  const risky = isRiskyTool(t)
                  return (
                    <TableRow key={`${t.connection_name}:${t.name}:${i}`} className={cn(risky && "bg-destructive/10")}>
                      <TableCell className="font-medium">
                        {t.name}
                        {risky && (
                          <p className="mt-1 flex items-center gap-1 text-xs text-destructive">
                            <AlertTriangle className="h-3 w-3" />Can change data without asking the user
                          </p>
                        )}
                      </TableCell>
                      <TableCell>{t.tool_type ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={t.permission === "read" ? "secondary" : t.permission === "unknown" ? "outline" : "destructive"}>
                          {PERMISSION_LABEL[t.permission]}
                        </Badge>
                      </TableCell>
                      <TableCell>{t.approval_mode === "never" ? "Never asks" : t.approval_mode ?? "Not set"}</TableCell>
                      <TableCell>{t.auth_type ?? "—"}</TableCell>
                      <TableCell className="whitespace-pre-wrap text-sm text-muted-foreground">{t.description ?? "—"}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          ) : <p className="text-sm text-muted-foreground">No tools</p>}
        </CardContent>
      </Card>
    </div>
  )
}
