import { useState, type ReactNode } from "react"
import { ChevronDown, Copy, Download, Terminal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { useToast } from "@/hooks/use-toast"
import { downloadBlob } from "@/lib/csvUtils"
import {
  buildLakehouseSnippet,
  buildLakehouseSnippetAzure,
  buildLakehouseSnippetGcp,
  buildSnowflakeEnvExports,
  cloudForProvider,
  lakehouseMissingInputs,
} from "@/lib/lakehouseSnippet"
import type { CustomerStorage } from "@/integrations/traceforce/types"

// Lakehouse setup panel body. Rendered inside the shared Settings Sheet
// (sm:max-w-lg, overflow-y-auto), which supplies the "Lakehouse" title and the
// tagline in its header — so this component starts at the trust strip and lays
// out the one-scroll, 3-step flow beneath it.
//
// Only reachable when the storage provider is a fully-configured S3 (provider 2) or
// GCS (provider 1) bucket, or Azure Blob Storage (provider 3) container. The bucket /
// region / prefix (or account / container / prefix on Azure) are injected into the
// Terraform snippet from that config. Values the storage config doesn't carry are
// collected in the panel: the project on GCS; on Azure, the logs storage account's
// resource group plus the Snowflake organization/account/user (identifying, not secret,
// info -- SNOWFLAKE_PRIVATE_KEY is the only credential still left as an environment
// variable). The Terraform remote-state backend is editable on all three. Location is
// derived from the bucket / storage account by the module.

const CLONE_CMD =
  "git clone https://github.com/traceforce/traceforce-lakehouse.git ~/traceforce-lakehouse && mkdir -p ~/.agents/skills && cp -R ~/traceforce-lakehouse/skills/traceforce-lakehouse ~/.agents/skills/"
const MARKETPLACE_CMD = "/plugin marketplace add traceforce/traceforce-lakehouse"
const INSTALL_CMD = "/plugin install traceforce-lakehouse@traceforce"
const APPLY_COMMAND = "terraform init && terraform apply"
// Azure-only follow-ups: the first apply stops on Snowflake's Entra admin-consent URL, query
// access is a Snowflake role grant, and the skill queries Snowflake through the Python connector.
const AZURE_CONSENT_URL_CMD = "terraform output -raw azure_consent_url"
const AZURE_READER_ROLE_CMD = "terraform output -raw reader_role_name"
const SNOWFLAKE_CONNECTOR_CMD = "pip install snowflake-connector-python"

async function writeClipboard(
  text: string,
  label: string,
  toast: ReturnType<typeof useToast>["toast"],
) {
  try {
    await navigator.clipboard.writeText(text)
    toast({ title: "Success", description: `${label} copied to clipboard` })
  } catch {
    toast({ title: "Error", description: `Failed to copy ${label}`, variant: "destructive" })
  }
}

/** A fixed, always-copyable code box: mono <pre> with a ghost copy button in
 * the corner (mirrors SandboxSetupCard). Used only for boxes whose text has no
 * placeholders, so the ghost overlay can never copy an unfilled value. */
const CopyBox = ({ text, label }: { text: string; label: string }) => {
  const { toast } = useToast()
  return (
    <div className="relative">
      <pre className="text-xs p-3 pr-12 bg-muted rounded-md overflow-x-auto font-mono whitespace-pre-wrap">
        {text}
      </pre>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => writeClipboard(text, label, toast)}
        className="absolute top-2 right-2 h-7 w-7 p-0"
        aria-label={`Copy ${label}`}
      >
        <Copy className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

/** A bottom disclosure — collapsed by default, chevron rotates when open. */
const Disclosure = ({ label, children }: { label: string; children: ReactNode }) => (
  <Collapsible className="group border-t border-border/50 pt-3">
    <CollapsibleTrigger className="flex w-full items-center gap-1.5 text-sm font-medium text-left">
      <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
      {label}
    </CollapsibleTrigger>
    <CollapsibleContent className="pt-2 text-sm text-muted-foreground space-y-2">
      {children}
    </CollapsibleContent>
  </Collapsible>
)

const StepHeader = ({ children }: { children: ReactNode }) => (
  <h3 className="text-sm font-semibold text-foreground">{children}</h3>
)

const Code = ({ children }: { children: ReactNode }) => (
  <code className="text-xs px-1 py-0.5 rounded bg-muted font-mono">{children}</code>
)

/** A labelled text input in the Step 1 config boxes. */
const Field = ({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) => (
  <div className="space-y-2">
    <Label htmlFor={id}>{label}</Label>
    <Input id={id} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
  </div>
)

interface LakehouseSetupSheetProps {
  customerStorage: CustomerStorage
}

const LakehouseSetupSheet = ({ customerStorage }: LakehouseSetupSheetProps) => {
  const { toast } = useToast()
  const cloud = cloudForProvider(customerStorage.provider)
  const isGcs = cloud === "gcp"
  const isAzure = cloud === "azure"
  const bucket = customerStorage.config.bucket ?? "" // S3 / GCS
  const region = customerStorage.config.region ?? "" // S3 only; GCS config has no region
  const account = customerStorage.config.account ?? "" // Azure only
  const container = customerStorage.config.container ?? "" // Azure only
  const tenantId = customerStorage.config.tenant_id ?? "" // Azure only; required at storage setup
  const keyPrefix = customerStorage.config.key_prefix ?? ""

  // Remote state is the recommended default. The state bucket (or, on Azure, storage account)
  // must differ from the logs one. S3: its region is seeded from the logs region but editable.
  // GCS: no region.
  const [remoteState, setRemoteState] = useState(true)
  const [stateBucket, setStateBucket] = useState("")
  const [stateRegion, setStateRegion] = useState(region) // S3 only
  // GCS-only: the module reads the project from the provider (not in the GCS storage config),
  // so collect it here.
  const [project, setProject] = useState("")
  // Azure-only: the azurerm provider needs the subscription ID (AzureRM v4 no longer infers it
  // from the CLI) and the module needs the logs storage account's resource group (neither is in
  // the Azure storage config); the azurerm backend is addressed by resource group + account + container.
  const [subscriptionId, setSubscriptionId] = useState("")
  const [resourceGroup, setResourceGroup] = useState("")
  // Azure-only: the snowflake provider's organization_name/account_name/user are identifying,
  // not secret, info (same as GCP's project) -- embedded directly in the generated file, unlike
  // SNOWFLAKE_PRIVATE_KEY, which stays an environment variable the customer sets themselves.
  const [organizationName, setOrganizationName] = useState("")
  const [accountName, setAccountName] = useState("")
  const [snowflakeUser, setSnowflakeUser] = useState("")
  const [stateResourceGroup, setStateResourceGroup] = useState("")
  const [stateStorageAccount, setStateStorageAccount] = useState("")
  const [stateContainer, setStateContainer] = useState("")

  const trimmedStateBucket = stateBucket.trim()
  const trimmedStateRegion = stateRegion.trim()
  const trimmedProject = project.trim()
  const trimmedSubscriptionId = subscriptionId.trim()
  const trimmedResourceGroup = resourceGroup.trim()
  const trimmedOrganizationName = organizationName.trim()
  const trimmedAccountName = accountName.trim()
  const trimmedSnowflakeUser = snowflakeUser.trim()
  const trimmedStateResourceGroup = stateResourceGroup.trim()
  const trimmedStateStorageAccount = stateStorageAccount.trim()
  const trimmedStateContainer = stateContainer.trim()
  const stateBucketMatchesLogs =
    remoteState && !isAzure && trimmedStateBucket !== "" && trimmedStateBucket === bucket
  const stateAccountMatchesLogs =
    remoteState && isAzure && trimmedStateStorageAccount !== "" && trimmedStateStorageAccount === account

  // Guard Copy/Download so a half-filled config can't be shipped (rules + tests in lakehouseSnippet).
  const missingInputs = lakehouseMissingInputs(
    cloud,
    { bucket, account },
    {
      remoteState,
      stateBucket,
      stateRegion,
      project,
      subscriptionId,
      resourceGroup,
      organizationName,
      accountName,
      user: snowflakeUser,
      stateResourceGroup,
      stateStorageAccount,
      stateContainer,
    },
  )
  const snippetActionsDisabled = missingInputs.length > 0
  // Distinguishes "the Snowflake fields specifically are what's missing" from "something else
  // in step 1 is" -- the Step 2 Snowflake hint must not claim the former when it's really the
  // latter (e.g. resourceGroup empty while organizationName/accountName/user are already filled).
  const snowflakeFieldsMissing = missingInputs.some(
    (f) => f === "organizationName" || f === "accountName" || f === "user",
  )

  const snippet = isAzure
    ? buildLakehouseSnippetAzure(
        { account, container, tenantId, keyPrefix },
        {
          subscriptionId: trimmedSubscriptionId,
          resourceGroup: trimmedResourceGroup,
          organizationName: trimmedOrganizationName,
          accountName: trimmedAccountName,
          user: trimmedSnowflakeUser,
          remoteState,
          stateResourceGroup: trimmedStateResourceGroup,
          stateStorageAccount: trimmedStateStorageAccount,
          stateContainer: trimmedStateContainer,
        },
      )
    : isGcs
      ? buildLakehouseSnippetGcp(
          { bucket, keyPrefix },
          {
            project: trimmedProject,
            remoteState,
            stateBucket: trimmedStateBucket,
          },
        )
      : buildLakehouseSnippet(
          { bucket, region, keyPrefix },
          { remoteState, stateBucket: trimmedStateBucket, stateRegion: trimmedStateRegion },
        )

  // Azure step 2: the skill needs all five SNOWFLAKE_* variables (unlike Terraform, which only
  // reads SNOWFLAKE_PRIVATE_KEY that way) -- three of them are already known from the panel
  // above, so give real export commands instead of just naming the variables and leaving the
  // customer to look up their own values a second time. Built via buildSnowflakeEnvExports so
  // the panel-entered values are shell-escaped rather than interpolated raw.
  const snowflakeEnvExports = buildSnowflakeEnvExports(trimmedOrganizationName, trimmedAccountName)

  const contextParts = isAzure
    ? ["Azure Blob Storage", account, container]
    : isGcs
      ? ["Google Cloud Storage", bucket]
      : ["Amazon S3", bucket, region]
  if (keyPrefix) contextParts.push(`prefix "${keyPrefix}"`)

  // Name the cloud in the prompt so the agent picks the right engine (fixed at setup, not
  // inferred from whichever cloud credentials are on the machine).
  const cloudName = { aws: "AWS (Athena)", gcp: "GCP (BigQuery)", azure: "Azure (Snowflake)" }[cloud]
  const prompt = `Using the TraceForce lakehouse on ${cloudName}, what are some questions I can ask about our AI-agent activity?`

  return (
    <div className="space-y-6">
      {/* Prerequisites */}
      <div className="flex items-center gap-2 text-sm">
        <Terminal className="h-4 w-4 shrink-0 text-muted-foreground" />
        {isAzure ? (
          <span>
            Requires <span className="font-medium">Terraform 1.5+</span>, the{" "}
            <span className="font-medium">Azure CLI</span> and{" "}
            <span className="font-medium">Snowflake</span> key-pair auth. Sign in (<Code>az login</Code>)
            to the subscription that owns that storage account, and set{" "}
            <Code>SNOWFLAKE_PRIVATE_KEY</Code> — the one secret Terraform needs (organization,
            account, and user are filled in below).
          </span>
        ) : isGcs ? (
          <span>
            Requires <span className="font-medium">Terraform 1.5+</span> and the{" "}
            <span className="font-medium">gcloud CLI</span>. Sign in (<Code>gcloud auth login</Code>),
            make the project that owns that bucket your default (
            <Code>gcloud config set project &lt;project-id&gt;</Code>), then run{" "}
            <Code>gcloud auth application-default login</Code> — the credentials Terraform uses.
          </span>
        ) : (
          <span>
            Requires <span className="font-medium">Terraform 1.5+</span> and{" "}
            <span className="font-medium">AWS CLI v2</span>. Be signed in to the account that owns
            that bucket, with its region (<Code>{region}</Code>) as your CLI default.
          </span>
        )}
      </div>

      {/* Storage context */}
      <div className="text-xs text-muted-foreground space-y-0.5">
        <p>Uses the storage you configured:</p>
        <p className="font-mono break-words text-foreground/80">{contextParts.join(" · ")}</p>
      </div>

      {/* Step 1 */}
      <div className="space-y-3">
        <StepHeader>1. Deploy the lakehouse</StepHeader>
        <p className="text-sm text-muted-foreground">
          {isAzure
            ? "Run this Terraform module in a terminal signed in to Azure, in the subscription that owns that storage account."
            : isGcs
              ? "Run this Terraform module in a terminal signed in to GCP, in the project that owns that bucket."
              : "Run this Terraform module in a terminal signed in to AWS, in the AWS account that owns that bucket."}
        </p>

        {/* GCS-only: project (module input not in the storage config). */}
        {isGcs && (
          <div className="space-y-3 rounded-md border p-3">
            <Field
              id="lakehouse-project"
              label="GCP project ID"
              placeholder="e.g. acme-prod-482913 (the project ID, not its display name)"
              value={project}
              onChange={setProject}
            />
          </div>
        )}

        {/* Azure-only: subscription ID + logs storage account's resource group (provider / module
            inputs not in the storage config), plus the Snowflake identity fields (organization/
            account/user) -- identifying, not secret, so they're collected here and embedded
            directly rather than left to an env var like SNOWFLAKE_PRIVATE_KEY. */}
        {isAzure && (
          <div className="space-y-3 rounded-md border p-3">
            <Field
              id="lakehouse-subscription-id"
              label="Subscription ID"
              placeholder="e.g. 00000000-0000-0000-0000-000000000000 (az account show --query id -o tsv)"
              value={subscriptionId}
              onChange={setSubscriptionId}
            />
            <Field
              id="lakehouse-resource-group"
              label="Resource group"
              placeholder={`the resource group that owns ${account || "that storage account"}`}
              value={resourceGroup}
              onChange={setResourceGroup}
            />
            <Field
              id="lakehouse-snowflake-organization"
              label="Snowflake organization name"
              placeholder="Snowsight account selector, top-left"
              value={organizationName}
              onChange={setOrganizationName}
            />
            <Field
              id="lakehouse-snowflake-account"
              label="Snowflake account name"
              placeholder="the account name, not the account locator"
              value={accountName}
              onChange={setAccountName}
            />
            <Field
              id="lakehouse-snowflake-user"
              label="Snowflake user"
              placeholder="the Snowflake user Terraform authenticates as"
              value={snowflakeUser}
              onChange={setSnowflakeUser}
            />
          </div>
        )}

        <div className="space-y-3 rounded-md border p-3">
          <div className="flex items-center gap-3">
            <Switch id="lakehouse-remote-state" checked={remoteState} onCheckedChange={setRemoteState} />
            <Label htmlFor="lakehouse-remote-state" className="cursor-pointer">
              Store Terraform state in {isAzure ? "Azure Storage" : isGcs ? "GCS" : "S3"} (recommended)
            </Label>
          </div>
          {remoteState && isAzure && (
            <div className="space-y-3">
              <Field
                id="lakehouse-state-resource-group"
                label="State resource group"
                value={stateResourceGroup}
                onChange={setStateResourceGroup}
              />
              <Field
                id="lakehouse-state-storage-account"
                label="State storage account"
                placeholder="a storage account for Terraform state"
                value={stateStorageAccount}
                onChange={setStateStorageAccount}
              />
              <Field
                id="lakehouse-state-container"
                label="State container"
                placeholder="e.g. tfstate"
                value={stateContainer}
                onChange={setStateContainer}
              />
              <p className="text-xs text-muted-foreground">
                A separate storage account you own in the same subscription, not your storage account.
                The backend authenticates to it via Entra ID, not a storage key, so your signed-in
                identity also needs the <span className="font-medium">Storage Blob Data Contributor</span>{" "}
                role on this account (owning the subscription alone doesn't grant blob data access).
              </p>
              {stateAccountMatchesLogs && (
                <p className="text-xs text-destructive">
                  That's your logs storage account. Use a different account for Terraform state.
                </p>
              )}
            </div>
          )}
          {remoteState && !isAzure && (
            <div className="space-y-3">
              <Field
                id="lakehouse-state-bucket"
                label="State bucket"
                placeholder="a bucket for Terraform state"
                value={stateBucket}
                onChange={setStateBucket}
              />
              {!isGcs && (
                <Field
                  id="lakehouse-state-region"
                  label="State bucket region"
                  value={stateRegion}
                  onChange={setStateRegion}
                />
              )}
              <p className="text-xs text-muted-foreground">
                {isGcs
                  ? "A separate GCS bucket you own, not your storage bucket."
                  : "A separate S3 bucket you own, not your storage bucket. Any region works."}
              </p>
              {stateBucketMatchesLogs && (
                <p className="text-xs text-destructive">
                  That's your logs bucket. Use a different bucket for Terraform state.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Hero main.tf: single Copy button (no ghost overlay, so a placeholder
            can't be copied) plus Download. */}
        <pre className="text-xs p-3 bg-muted rounded-md overflow-x-auto font-mono">
          {snippet}
        </pre>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => writeClipboard(snippet, "main.tf", toast)}
            disabled={snippetActionsDisabled}
          >
            <Copy className="h-3.5 w-3.5 mr-2" />
            Copy
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadBlob(new Blob([snippet]), "main.tf")}
            disabled={snippetActionsDisabled}
          >
            <Download className="h-3.5 w-3.5 mr-2" />
            Download main.tf
          </Button>
        </div>

        <CopyBox text={APPLY_COMMAND} label="Command" />

        {/* Azure: the first apply against a Snowflake account + Azure tenant pair stops on a
            consent error (once per pair), and nobody can query until the reader role is granted. */}
        {isAzure && (
          <>
            <p className="text-sm text-muted-foreground">
              The first time, the apply stops partway with an error naming a consent URL. That's
              expected: an Azure AD admin opens it and grants consent to Snowflake's service
              principal, then run <Code>terraform apply</Code> again. To print the URL:
            </p>
            <CopyBox text={AZURE_CONSENT_URL_CMD} label="Command" />
            <p className="text-sm text-muted-foreground">
              Then grant query access — to a dedicated reader user, not the user above (that one
              ran Terraform and likely holds a broader role; the agent should only ever hold the
              read-only role). Print the read-only role (already quoted) and run{" "}
              <Code>GRANT ROLE &lt;role&gt; TO USER &lt;reader-user&gt;</Code> in Snowsight, or
              uncomment <Code>reader_users</Code> above before applying:
            </p>
            <CopyBox text={AZURE_READER_ROLE_CMD} label="Command" />
          </>
        )}
      </div>

      {/* Step 2 */}
      <div className="space-y-3">
        <StepHeader>2. Add the lakehouse skill to your agent</StepHeader>

        {isAzure && (
          <>
            <p className="text-sm text-muted-foreground">
              The skill queries Snowflake with Python, using all five <Code>SNOWFLAKE_*</Code>{" "}
              variables as environment variables (unlike Terraform, which only reads{" "}
              <Code>SNOWFLAKE_PRIVATE_KEY</Code> that way). Set these in your terminal{" "}
              <span className="font-medium">before</span> starting your agent below — once an
              agent is running, it can't pick up environment variables set afterward.
            </p>
            {snippetActionsDisabled ? (
              <p className="text-sm text-muted-foreground">
                {snowflakeFieldsMissing
                  ? "Fill in the Snowflake fields in step 1 first; the export commands for them appear here once they're set."
                  : "Fill in the remaining required fields in step 1 first; the export commands below appear once they're set."}
              </p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Organization and account match what you entered above; swap in your dedicated
                  reader user (not the user above — that one ran Terraform) and its private key
                  path:
                </p>
                <CopyBox text={snowflakeEnvExports} label="Command" />
              </>
            )}
            <p className="text-sm text-muted-foreground">Then install the connector:</p>
            <CopyBox text={SNOWFLAKE_CONNECTOR_CMD} label="Command" />
          </>
        )}

        <p className="text-sm text-muted-foreground">
          {isAzure ? "Now start Claude Code, and run these one at a time:" : "In Claude Code, run these one at a time:"}
        </p>
        <CopyBox text={MARKETPLACE_CMD} label="Command" />
        <CopyBox text={INSTALL_CMD} label="Command" />

        <Collapsible className="group">
          <CollapsibleTrigger className="flex items-center gap-1.5 text-sm font-medium">
            <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
            Using Cursor, Copilot, Codex, or another agent?
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2 space-y-2">
            <p className="text-sm text-muted-foreground">
              Cursor, Copilot and Codex load skills from <Code>~/.agents/skills</Code>. Copy it there,
              then start a new session:
            </p>
            <CopyBox text={CLONE_CMD} label="Command" />
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Step 3 */}
      <div className="space-y-3">
        <StepHeader>3. Ask your agent</StepHeader>
        <p className="text-sm text-muted-foreground">In the same terminal, ask your agent:</p>
        <CopyBox text={prompt} label="Prompt" />
      </div>

      {/* Bottom disclosures */}
      <div className="space-y-3">
        <Disclosure label="What the agent can and can't access">
          <p>
            {isGcs
              ? "Read-only: it only runs read queries (SELECT)."
              : "Read-only: it can only run read queries (SELECT / SHOW / DESCRIBE), never writing or deleting."}
          </p>
        </Disclosure>
        <Disclosure label="Not seeing data?">
          <p>
            An empty result soon after setup is usually just the first load still running; check
            again shortly.
          </p>
          <p>
            If the agent doesn't seem to know the lakehouse, re-run the Step 2 install and start a
            fresh session.
          </p>
          {isAzure ? (
            <p>
              A Snowflake or auth problem surfaces as an error, not emptiness. Make sure the{" "}
              <Code>SNOWFLAKE_*</Code> variables are set in that terminal and your user has been
              granted the reader role.
            </p>
          ) : isGcs ? (
            <p>
              A GCP or auth problem surfaces as an error, not emptiness. Make sure you're signed in
              (<Code>gcloud auth login</Code>) and the lakehouse project is your default (
              <Code>gcloud config set project &lt;project-id&gt;</Code>).
            </p>
          ) : (
            <p>
              An AWS or region problem surfaces as an AWS error, not emptiness. Make sure you're
              signed in and <Code>AWS_REGION</Code> is set.
            </p>
          )}
        </Disclosure>
      </div>
    </div>
  )
}

export default LakehouseSetupSheet
