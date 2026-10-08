import { useCallback, useEffect, useRef, useState } from "react"
import { ArrowLeft, Download, Loader2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import { ConnectionStateBadge } from "@/components/CopilotConnectionStateBadge"
import { COPILOT_POLL_MS, copilotWaitExpired, copilotConnectionMessage, findNewTenant, formatRelative, normalizeUiState } from "@/lib/copilot"
import { disconnectCopilotConnection, getCopilotConnections, startWaitingForNewTenant } from "@/lib/copilotMock"
import type { CopilotConnection } from "@/lib/copilotTypes"

const Code = ({ children }: { children: React.ReactNode }) => (
  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{children}</code>
)

export default function CopilotTerraformSetup({ onConnectionsChange }: { onConnectionsChange?: () => void }) {
  const { toast } = useToast()
  const [connections, setConnections] = useState<CopilotConnection[] | null>(null)
  const [waiting, setWaiting] = useState<"off" | "polling" | "timeout">("off")
  const [showForm, setShowForm] = useState(false)
  const [confirm, setConfirm] = useState<CopilotConnection | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)
  const snapshot = useRef<string[]>([])
  const waitStarted = useRef(0)

  const load = useCallback(async () => {
    const list = await getCopilotConnections()
    setConnections(list)
    return list
  }, [])

  useEffect(() => {
    let cancelled = false
    getCopilotConnections().then((list) => { if (!cancelled) setConnections(list) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (waiting !== "polling") return
    let cancelled = false
    const id = setInterval(async () => {
      if (copilotWaitExpired(waitStarted.current)) {
        clearInterval(id)
        if (!cancelled) setWaiting("timeout")
        return
      }
      let list: CopilotConnection[]
      try {
        list = await getCopilotConnections()
      } catch {
        return // try again on the next tick
      }
      if (cancelled) return
      setConnections(list)
      if (findNewTenant(snapshot.current, list)) {
        clearInterval(id)
        setWaiting("off")
        setShowForm(false)
        toast({ title: "Tenant connected" })
        onConnectionsChange?.()
      }
    }, COPILOT_POLL_MS)
    return () => { cancelled = true; clearInterval(id) }
  }, [waiting, toast, onConnectionsChange])

  const beginWaiting = () => {
    snapshot.current = (connections ?? []).map((c) => c.id)
    waitStarted.current = Date.now()
    setWaiting("polling")
  }

  const handleDownload = () => {
    toast({ title: "The Terraform module download will be available soon." })
    startWaitingForNewTenant()
    beginWaiting()
    setShowForm(false)
  }

  const handleDisconnect = async () => {
    if (!confirm) return
    setDisconnecting(true)
    try {
      await disconnectCopilotConnection(confirm.id)
      await load()
      onConnectionsChange?.()
      toast({ title: "Tenant disconnected" })
      setConfirm(null)
    } catch {
      toast({ title: "Could not disconnect the tenant", description: "Please try again.", variant: "destructive" })
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <div className="space-y-8">
      {!showForm && (
      <section className="space-y-3">
        {waiting === "polling" && (
          <Alert role="status">
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertDescription>Waiting for a new tenant to report…</AlertDescription>
          </Alert>
        )}
        {waiting === "timeout" && (
          <Alert role="status">
            <AlertDescription className="space-y-2">
              <p>
                No new tenant yet. Check that <Code>terraform apply</Code> finished and that the Function app is running
                in your Azure portal.
              </p>
              <Button size="sm" variant="outline" onClick={beginWaiting}>Keep waiting</Button>
            </AlertDescription>
          </Alert>
        )}
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Connected tenants</h3>
          {!!connections?.length && (
            <Button size="sm" onClick={() => setShowForm(true)}>
              <Plus className="mr-2 h-4 w-4" />Add connection
            </Button>
          )}
        </div>
        {connections === null ? (
          <Skeleton className="h-24 w-full" />
        ) : connections.length === 0 ? (
          <div className="space-y-3 rounded-lg border border-dashed p-6 text-center">
            <p className="text-sm text-muted-foreground">No tenants connected yet</p>
            <Button size="sm" onClick={() => setShowForm(true)}>
              <Plus className="mr-2 h-4 w-4" />Add your first tenant
            </Button>
          </div>
        ) : (
          connections.map((c) => {
            const state = normalizeUiState(c.ui_state)
            const message = copilotConnectionMessage(c)
            const synced = formatRelative(c.last_synced_at)
            return (
              <div key={c.id} className="space-y-3 rounded-lg border p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="break-all font-mono text-sm font-medium">{c.tenant_id}</p>
                  <ConnectionStateBadge state={c.ui_state} />
                </div>
                <p className="text-sm text-muted-foreground">
                  {c.agent_count} agents · {synced ? `Last synced ${synced}` : "Never synced"}
                </p>
                {message && (
                  state === "attention_customer" ? (
                    <Alert variant="destructive"><AlertDescription>{message}</AlertDescription></Alert>
                  ) : (
                    <Alert role="status"><AlertDescription>{message}</AlertDescription></Alert>
                  )
                )}
                <Button size="sm" variant="outline" onClick={() => setConfirm(c)}>Disconnect</Button>
              </div>
            )
          })
        )}
      </section>
      )}

      {showForm && (
        <section className="space-y-4 rounded-lg border p-4">
          <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>
            <ArrowLeft className="mr-2 h-4 w-4" />Back to tenants
          </Button>
          <h3 className="text-sm font-semibold">Add connection</h3>
          <p className="text-sm text-muted-foreground">
            Traceforce collects your Microsoft 365 Copilot agents with a small collector that runs in your own Azure
            subscription. Deploy it once per Microsoft 365 tenant.
          </p>
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Prerequisites</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>An Azure subscription that belongs to the tenant you are connecting</li>
              <li>Global Administrator or Privileged Role Administrator in that tenant</li>
              <li>Owner or Contributor on that subscription</li>
              <li>At least one Agent 365 licence in the tenant</li>
              <li>Azure CLI and Terraform installed on your machine</li>
              <li>An Azure region that offers the Functions Flex Consumption plan</li>
              <li>Microsoft global cloud (not GCC High, DoD or 21Vianet)</li>
            </ul>
          </div>
          <Button onClick={handleDownload}><Download className="mr-2 h-4 w-4" />Download Terraform module</Button>
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Steps</h3>
            <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
              <li>Unzip the module into a new folder for this tenant (one folder per tenant).</li>
              <li>Sign in: <Code>az login --tenant &lt;your-tenant-id&gt;</Code></li>
              <li>Select the subscription: <Code>az account set --subscription &lt;subscription-id&gt;</Code></li>
              <li>Review the changes: <Code>terraform init</Code>, then <Code>terraform plan</Code>.</li>
              <li>
                Set the collector secret as an environment variable, so it never appears in your command history.
                Bash: <Code>read -rs TF_VAR_traceforce_client_secret && export TF_VAR_traceforce_client_secret</Code>.
                PowerShell: <Code>$env:TF_VAR_traceforce_client_secret = [Net.NetworkCredential]::new('', (Read-Host -AsSecureString)).Password</Code>
              </li>
              <li>Deploy: <Code>terraform apply -var="subscription_id=&lt;subscription-id&gt;"</Code></li>
              <li>Wait here. Your tenant appears in the list within a few minutes.</li>
            </ol>
          </div>
          <p className="text-sm text-muted-foreground">
            The same download works for every tenant. Keep each tenant's folder: you need it for <Code>terraform destroy</Code>.
          </p>
        </section>
      )}

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && !disconnecting && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect this tenant?</AlertDialogTitle>
            <AlertDialogDescription>
              Traceforce will stop accepting data from tenant <span className="break-all font-mono">{confirm?.tenant_id}</span> and
              hide its agents. The collector keeps running in your Azure subscription until you remove it: run{" "}
              <Code>terraform destroy</Code> in that tenant's folder.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={disconnecting}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={disconnecting} onClick={(e) => { e.preventDefault(); handleDisconnect() }}>
              {disconnecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
