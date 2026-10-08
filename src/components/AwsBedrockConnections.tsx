import { useCallback, useEffect, useRef, useState } from "react"
import { Loader2, Plus, Server, XCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import BedrockTerraformSetup from "@/components/BedrockTerraformSetup"
import { useAuth } from "@/contexts/AuthContext"
import { useOrg } from "@/contexts/OrgContext"
import { useToast } from "@/hooks/use-toast"
import { bedrockApi } from "@/lib/bedrockMockApi"
import { type AwsConnection, connectionState, connectionTitle, syncedText } from "@/lib/awsConnections"

const StatusBadge = ({ status }: { status: number }) => {
  const state = connectionState(status)
  if (state === "connected") return <Badge className="bg-success text-success-foreground hover:bg-success/90">Connected</Badge>
  if (state === "failed") return <Badge variant="destructive">Action needed</Badge>
  return <Badge variant="secondary">Checking…</Badge>
}

/**
 * Settings → AWS Bedrock: one card per connected AWS account, with Add
 * connection, Check again (re-verify an account whose last sync failed) and
 * Disconnect. Each account syncs and reports status on its own.
 */
export default function AwsBedrockConnections() {
  const { session } = useAuth()
  const { activeOrgId } = useOrg()
  const { toast } = useToast()
  const [connections, setConnections] = useState<AwsConnection[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [checkingId, setCheckingId] = useState<string | null>(null)
  const [pending, setPending] = useState<AwsConnection | null>(null)

  const token = session?.access_token
  // Only the latest request may update the list: after an org switch, a slower
  // response for the previous org must not overwrite the new org's cards.
  const latestLoad = useRef(0)
  const load = useCallback(async () => {
    if (!token) return
    const request = ++latestLoad.current
    const { data, error } = await bedrockApi.listCloudConnections(token)
    if (request !== latestLoad.current) return
    if (error) { setLoadError(error); setConnections([]); return }
    setLoadError(null)
    setConnections(data?.connections ?? [])
  }, [token])

  // Reload when the org changes: connections belong to the active org.
  useEffect(() => { setAdding(false); load() }, [load, activeOrgId])

  const checkAgain = async (c: AwsConnection) => {
    if (!token || !c.roleArn) return
    setCheckingId(c.id)
    try {
      const { error } = await bedrockApi.verifyCloudConnection(token, c.roleArn, c.name ?? undefined)
      toast(error
        ? { title: "Still can't reach this account", description: error, variant: "destructive" }
        : { title: "Role verified. The next sync will confirm the connection." })
      await load()
    } finally {
      setCheckingId(null)
    }
  }

  const disconnect = async () => {
    if (!token || !pending) return
    const target = pending
    setPending(null)
    const { error } = await bedrockApi.disconnectCloudConnection(token, target.id)
    toast(error
      ? { title: "Couldn't disconnect the account", description: error, variant: "destructive" }
      : { title: "Account disconnected. Traceforce stopped syncing it." })
    await load()
  }

  if (connections === null) {
    return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading connections…</div>
  }

  if (adding) {
    return (
      <BedrockTerraformSetup
        onCancel={() => setAdding(false)}
        onSaved={({ accountId, regions }) => {
          // The form unmounts here, so its own success line would never show.
          toast({ title: `Connected account ${accountId}`, description: `Regions: ${regions.join(", ")}. Agents appear after the next hourly sync.` })
          setAdding(false)
          load()
        }}
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-medium">Connections</h3>
          <p className="text-sm text-muted-foreground">One connection per AWS account. Each account syncs and reports status on its own.</p>
        </div>
        {connections.length > 0 && (
          <Button size="sm" onClick={() => setAdding(true)} className="shrink-0"><Plus className="h-4 w-4" /> Add connection</Button>
        )}
      </div>

      {loadError ? (
        <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-destructive">
          <XCircle className="h-4 w-4 shrink-0" /> Couldn't load your AWS connections: {loadError}
          <Button size="sm" variant="outline" onClick={() => load()}>Try again</Button>
        </div>
      ) : connections.length === 0 ? (
        <div className="space-y-3 rounded-lg border border-dashed p-8 text-center">
          <Server className="mx-auto h-8 w-8 text-muted-foreground" />
          <div>
            <p className="font-medium">No connections yet</p>
            <p className="text-sm text-muted-foreground">Connect an AWS account to start inventorying its Bedrock AgentCore agents.</p>
          </div>
          <Button size="sm" onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Add connection</Button>
        </div>
      ) : (
        <ul className="space-y-3">
          {connections.map((c) => {
            const failed = connectionState(c.status) === "failed"
            return (
              <li key={c.id} className="space-y-2 rounded-lg border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium" title={connectionTitle(c)}>{connectionTitle(c)}</p>
                    <p className="text-xs text-muted-foreground">{syncedText(c)}</p>
                  </div>
                  <StatusBadge status={c.status} />
                </div>
                <dl className="grid grid-cols-[5.5rem_1fr] gap-x-2 gap-y-1 text-xs">
                  <dt className="text-muted-foreground">Account ID</dt>
                  <dd className="font-mono">{c.accountId}</dd>
                  <dt className="text-muted-foreground">Role ARN</dt>
                  <dd className="break-all font-mono text-muted-foreground">{c.roleArn ?? "—"}</dd>
                  <dt className="text-muted-foreground">Regions</dt>
                  <dd className="flex flex-wrap gap-1">
                    {c.regions.map((r) => <span key={r} className="rounded-full border bg-muted px-2 py-0.5 font-mono text-[11px]">{r}</span>)}
                  </dd>
                </dl>
                {failed && (
                  <p className="flex items-start gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
                    <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {c.lastError || "The last sync could not reach this account."}
                  </p>
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                  {failed && c.roleArn && (
                    <Button size="sm" variant="outline" className="h-7 text-xs" disabled={checkingId === c.id} onClick={() => checkAgain(c)}>
                      {checkingId === c.id && <Loader2 className="h-3 w-3 animate-spin" />} Check again
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setPending(c)}>Disconnect</Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect {pending ? connectionTitle(pending) : ""}?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="block font-mono text-xs">{pending?.accountId}</span>
              Traceforce stops syncing this account and its agents disappear from AI Agents. To also remove
              Traceforce&apos;s access, run <code>terraform destroy</code> in that account. Connecting it again
              later brings it back.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={disconnect}>Disconnect</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
