import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/contexts/AuthContext"
import { bedrockApi } from "@/lib/bedrockMockApi"
import { MAX_CONNECTION_NAME_LENGTH } from "@/lib/awsConnections"
import { downloadBlob } from "@/lib/csvUtils"
import { ArrowLeft, CheckCircle2, Cloud, Download, Loader2, XCircle } from "lucide-react"
import {
  APPLY_COMMAND,
  BEDROCK_ROLE_NAME,
  DEPLOY_STEPS,
  TEMPLATE_FILE_NAME,
  TRUSTED_ROLE_ARN,
  accountIdFromRoleArn,
  buildBedrockTerraform,
} from "@/lib/bedrockTerraform"


const Chip = ({ children }: { children: string }) => (
  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">{children}</code>
)

interface Props {
  /**
   * Called once the server has verified the role and saved the connection. The
   * caller usually closes this form, so it should confirm the save itself.
   */
  onSaved?: (saved: { accountId: string; regions: string[] }) => void
  /** Shown as "Back to connections" when there are connections to go back to. */
  onCancel?: () => void
}

/**
 * Form for connecting one AWS account ("Add connection").
 *
 * The admin configures everything in Terraform — account and Regions — and
 * types only the role ARN Terraform prints, plus an optional name for the
 * connection card. The server reads the Regions back from the role's tag when
 * it verifies it, then saves the connection.
 */
export default function BedrockTerraformSetup({ onSaved, onCancel }: Props) {
  const { session } = useAuth()
  const [name, setName] = useState("")
  const [roleArn, setRoleArn] = useState("")
  const [saved, setSaved] = useState<{ accountId: string; regions: string[] } | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [verifyError, setVerifyError] = useState<string | null>(null)

  const template = useMemo(() => buildBedrockTerraform(), [])

  const roleArnError = roleArn.trim() && !accountIdFromRoleArn(roleArn)
    ? "Expected arn:aws:iam::<12-digit account>:role/<name>"
    : null

  /**
   * Verify, then save — never save unverified.
   *
   * The server assumes the role, asks STS which account it landed in, and reads
   * the Regions tag. That is the only thing that proves the template was
   * applied, in the account named.
   */
  const handleVerifyAndSave = async () => {
    if (!accountIdFromRoleArn(roleArn)) return
    if (!session?.access_token) {
      setVerifyError("You need to be signed in to verify a connection.")
      return
    }

    setVerifying(true)
    setVerifyError(null)
    setSaved(null)
    try {
      const { data, error } = await bedrockApi.verifyCloudConnection(session.access_token, roleArn.trim(), name.trim() || undefined)
      if (error || !data?.verified || !data.accountId || !data.regions?.length) {
        setVerifyError(error ?? "Could not verify that role.")
        return
      }
      setSaved({ accountId: data.accountId, regions: data.regions })
      onSaved?.({ accountId: data.accountId, regions: data.regions })
    } catch (e) {
      setVerifyError(e instanceof Error ? e.message : "Could not verify that role.")
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div className="space-y-5">
      {onCancel && (
        <Button variant="ghost" size="sm" className="-ml-2" onClick={onCancel}>
          <ArrowLeft className="h-4 w-4" /> Back to connections
        </Button>
      )}
      <p className="text-sm text-muted-foreground">
        Deploy cross-account access so Traceforce can collect Bedrock AgentCore inventory.
      </p>

      <div className="space-y-1.5 rounded-lg border bg-muted/30 p-3">
        <div className="flex items-center gap-2 font-medium">
          <Cloud className="h-4 w-4 text-primary" />
          {BEDROCK_ROLE_NAME}
        </div>
        <p className="text-sm text-muted-foreground">
          Creates a read-only role for AgentCore inventory collection, and trusts the Traceforce
          role below to assume it.
        </p>
        <p className="break-all font-mono text-xs text-muted-foreground">{TRUSTED_ROLE_ARN}</p>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium">Deploy in each AWS account</h3>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          {DEPLOY_STEPS.map((step) => <li key={step}>{step}</li>)}
        </ol>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => downloadBlob(new Blob([template]), TEMPLATE_FILE_NAME)}>
            <Download className="h-4 w-4" /> Download Terraform Template
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Then run <Chip>{APPLY_COMMAND}</Chip>.
        </p>
      </div>

      <div className="space-y-2 rounded-lg border p-3">
        <h3 className="text-sm font-medium">Connect</h3>
        <div className="space-y-1.5">
          <Label htmlFor="tf-conn-name">Connection name (optional)</Label>
          <Input
            id="tf-conn-name"
            value={name}
            maxLength={MAX_CONNECTION_NAME_LENGTH}
            onChange={(e) => setName(e.target.value)}
            placeholder="Production"
          />
          <p className="text-xs text-muted-foreground">Shown on the connection card. Leave empty to use the account ID.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tf-role-arn">Role ARN</Label>
          <Input
            id="tf-role-arn"
            value={roleArn}
            onChange={(e) => { setRoleArn(e.target.value); setSaved(null) }}
            placeholder={`arn:aws:iam::<account-id>:role/${BEDROCK_ROLE_NAME}`}
            className="font-mono text-xs"
            aria-invalid={!!roleArnError}
          />
          {roleArnError && <p className="text-xs text-destructive">{roleArnError}</p>}
        </div>
        <Button size="sm" disabled={!roleArn.trim() || !!roleArnError || verifying} onClick={handleVerifyAndSave}>
          {verifying && <Loader2 className="h-4 w-4 animate-spin" />}
          {verifying ? "Verifying…" : "Verify and save connection"}
        </Button>
        {saved && (
          <p className="flex items-center gap-2 text-sm text-primary">
            <CheckCircle2 className="h-4 w-4" />
            Verified and connected to account {saved.accountId} ({saved.regions.join(", ")})
          </p>
        )}
        {verifyError && (
          <p className="flex items-start gap-2 text-sm text-destructive">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" /> {verifyError}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Verifying assumes this role from Traceforce, confirms it lands in the account named in the
          ARN, and reads the Regions you set in Terraform. Nothing is saved until that succeeds.
        </p>
      </div>
    </div>
  )
}
