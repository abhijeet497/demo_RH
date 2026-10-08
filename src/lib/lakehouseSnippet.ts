// Pure builder for the Lakehouse `main.tf` snippet shown in the Lakehouse
// setup panel. Kept side-effect-free and dependency-free so it stays trivially
// unit-testable: given the customer's S3 storage config plus the remote-state
// toggle, it returns the exact HCL we render in the <pre> and hand to Copy /
// Download. Nothing here reads component state or the DOM.
//
// The bucket / region / prefix are injected from the storage config the
// customer already gave us (not editable in the panel). Only the Terraform
// remote-state backend is driven by the panel's toggle + inputs.

/** The customer's S3 storage config — the logs bucket the lakehouse reads. */
export interface LakehouseStorageConfig {
  /** Logs bucket name (config.bucket). */
  bucket: string
  /** Logs bucket region (config.region); also the provider region. */
  region: string
  /** Optional key prefix (config.key_prefix); empty means the bucket root. */
  keyPrefix?: string
}

/** Panel-driven options: the "Store state in S3" toggle and its inputs. */
export interface LakehouseSnippetOptions {
  /** The default-ON "Store state in S3 (recommended)" control. */
  remoteState: boolean
  /** Bucket for Terraform state; only used when remoteState is true. */
  stateBucket?: string
  /** Region the state bucket lives in; only used when remoteState is true. */
  stateRegion?: string
}

const MODULE_REF = "1.3.0"
const MODULE_SOURCE = `github.com/traceforce/traceforce-lakehouse//terraform/aws?ref=${MODULE_REF}`

/**
 * Escape a value for embedding inside an HCL double-quoted string.
 *
 * Backslash is escaped first (so the backslashes we add next aren't
 * re-escaped), then the double-quote, then Terraform's template openers
 * `${` -> `$${` and `%{` -> `%%{`. Without this a config value containing a quote would break out
 * of the string, and one containing `${...}` or `%{...}` would be evaluated as a Terraform
 * template — either of which corrupts (or injects into) the generated HCL.
 */
function hclEscape(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    // Function form: a literal replacement string would treat `$$` as an
    // escaped single `$`, silently turning this into a no-op.
    .replace(/\$\{/g, () => "$${")
    .replace(/%\{/g, "%%{")
}

/**
 * Escape a value for embedding inside a single-quoted POSIX shell string.
 *
 * Single quotes make `$`, backticks, double quotes, and backslashes all literal, so the only
 * character that needs handling is an embedded single quote itself: it closes the quoted
 * string, so we close it, append a literal, backslash-escaped quote outside the quoting, then
 * reopen -- the standard `'\''` idiom. Without this, a config value containing shell
 * metacharacters (e.g. `$(...)`) would be executed instead of treated as a literal when a
 * customer pastes the generated command into their shell.
 */
function shellEscape(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`
}

/**
 * Normalize a logs key prefix: strip leading and trailing slashes. The module
 * rejects a slashed prefix (e.g. a pasted `/traceforce/logs` or `traceforce/`),
 * so a value that is only slashes collapses to empty (bucket root) and any
 * wrapping slashes are trimmed before it reaches `logs_prefix`.
 */
function normalizeKeyPrefix(prefix: string): string {
  return prefix.replace(/^\/+/, "").replace(/\/+$/, "")
}

/**
 * Build the `main.tf` HCL for the Lakehouse Terraform module.
 *
 * - `required_version` is pinned to `>= 1.5` (the module's floor; no 1.10-only backend features).
 * - The AWS provider region is the logs bucket's region.
 * - The module `logs_bucket` / `logs_prefix` come from the storage config; an
 *   empty (or slash-only) prefix renders `logs_prefix = ""` with a note that
 *   TraceForce writes at the bucket root.
 * - When `remoteState` is on, a `backend "s3"` block is prepended inside the
 *   `terraform {}` block; when off, it is omitted entirely.
 * - Two optional inputs ship commented out, each with a symptom that tells the
 *   operator when to uncomment it.
 *
 * Every interpolated value (bucket, region, prefix, state bucket/region) is
 * HCL-escaped so it can't break out of its string or inject Terraform syntax.
 */
export function buildLakehouseSnippet(
  config: LakehouseStorageConfig,
  options: LakehouseSnippetOptions,
): string {
  const lines: string[] = []

  lines.push("terraform {")
  lines.push('  required_version = ">= 1.5"')
  if (options.remoteState) {
    lines.push("")
    lines.push('  backend "s3" {')
    lines.push(`    bucket       = "${hclEscape(options.stateBucket ?? "")}"`)
    lines.push('    key          = "traceforce-lakehouse/terraform.tfstate"')
    lines.push(`    region       = "${hclEscape(options.stateRegion ?? "")}"`)
    lines.push("  }")
  }
  lines.push("}")
  lines.push("")

  lines.push('provider "aws" {')
  lines.push(`  region = "${hclEscape(config.region)}"`)
  lines.push("}")
  lines.push("")

  lines.push('module "lakehouse" {')
  lines.push(`  source = "${MODULE_SOURCE}"`)
  lines.push("")
  lines.push(`  logs_bucket = "${hclEscape(config.bucket)}"`)
  const keyPrefix = normalizeKeyPrefix(config.keyPrefix ?? "")
  if (keyPrefix) {
    lines.push(`  logs_prefix = "${hclEscape(keyPrefix)}"`)
  } else {
    lines.push('  logs_prefix = ""  # TraceForce writes at the bucket root')
  }
  lines.push("")
  lines.push(
    '  # logs_kms_key_arn = "arn:aws:kms:REGION:ACCOUNT:key/KEY_ID"  # uncomment if queries fail with a KMS access-denied error (logs bucket uses a customer-managed key)',
  )
  lines.push(
    "  # create_glue_integration = false  # uncomment if apply fails because a Glue catalog integration already exists in this account",
  )
  lines.push(
    '  # query_trusted_principals = ["arn:aws:iam::OTHER_ACCOUNT_ID:root"]  # uncomment to let a separate team (no access to this account) assume a read-only role to query; then give them the query_role_arn output',
  )
  lines.push("}")
  lines.push("")
  // Re-exported so `terraform output -raw query_policy_json` works (README, Deploy — AWS step 3).
  lines.push('output "query_policy_json" { value = module.lakehouse.query_policy_json }')

  return lines.join("\n") + "\n"
}

// ---------------------------------------------------------------------------------------
// GCP variant. Same shape as the AWS builder above, for a customer whose Storage Provider
// is a GCS bucket: emits a `main.tf` for the terraform/gcp module (BigQuery + BigLake
// managed Iceberg). Differences from AWS: the state backend is `gcs` (bucket + prefix, no
// region/key); the provider is `google` and needs a project; the module derives its
// location from the logs bucket, so project is the only value the customer supplies.
// ---------------------------------------------------------------------------------------

/** The customer's GCS storage config — the logs bucket the lakehouse reads. */
export interface LakehouseGcsStorageConfig {
  /** Logs bucket name (config.bucket). No gs:// prefix. */
  bucket: string
  /** Optional key prefix (config.key_prefix); empty means the bucket root. */
  keyPrefix?: string
}

/** Panel-driven options for the GCP snippet. */
export interface LakehouseGcsSnippetOptions {
  /** GCP project ID (not the display name) that owns the bucket and runs BigQuery. */
  project: string
  /** The default-ON "Store state in GCS (recommended)" control. */
  remoteState: boolean
  /** GCS bucket for Terraform state; only used when remoteState is true. */
  stateBucket?: string
}

const MODULE_SOURCE_GCP = `github.com/traceforce/traceforce-lakehouse//terraform/gcp?ref=${MODULE_REF}`

/**
 * Build the `main.tf` HCL for the GCP Lakehouse Terraform module. Mirrors
 * {@link buildLakehouseSnippet}: `required_version >= 1.5`, an optional remote-state
 * backend (here `gcs`, which takes bucket + prefix), the `google` provider (project only — the
 * module derives the BigQuery location from the logs bucket), and the module block with
 * `logs_bucket` / `logs_prefix`. One
 * optional input (`query_members`) ships commented out. Every interpolated value is
 * HCL-escaped.
 */
export function buildLakehouseSnippetGcp(
  config: LakehouseGcsStorageConfig,
  options: LakehouseGcsSnippetOptions,
): string {
  const lines: string[] = []

  lines.push("terraform {")
  lines.push('  required_version = ">= 1.5"')
  if (options.remoteState) {
    lines.push("")
    lines.push('  backend "gcs" {')
    lines.push(`    bucket = "${hclEscape(options.stateBucket ?? "")}"`)
    lines.push('    prefix = "traceforce-lakehouse"')
    lines.push("  }")
  }
  lines.push("}")
  lines.push("")

  lines.push('provider "google" {')
  lines.push(`  project = "${hclEscape(options.project)}"`)
  lines.push("}")
  lines.push("")

  lines.push('module "lakehouse" {')
  lines.push(`  source = "${MODULE_SOURCE_GCP}"`)
  lines.push("")
  lines.push(`  logs_bucket = "${hclEscape(config.bucket)}"`)
  const keyPrefix = normalizeKeyPrefix(config.keyPrefix ?? "")
  if (keyPrefix) {
    lines.push(`  logs_prefix = "${hclEscape(keyPrefix)}"`)
  } else {
    lines.push('  logs_prefix = ""  # TraceForce writes at the bucket root')
  }
  lines.push("")
  lines.push(
    '  # query_members = ["group:security@your-domain.com"]  # uncomment to grant a separate team read-only access to query the dataset; they also need roles/bigquery.jobUser in their own project',
  )
  lines.push("}")

  return lines.join("\n") + "\n"
}

// ---------------------------------------------------------------------------------------
// Azure variant, for a customer whose Storage Provider is an Azure Blob Storage container:
// emits a `main.tf` for the terraform/azure module (Snowflake over Iceberg). Differences from
// AWS/GCP: the module is a child module, so the root declares required_providers itself; the
// state backend is `azurerm` (resource group + storage account + container); three providers
// (azurerm, azuread, snowflake) -- the snowflake provider's organization_name/account_name/user
// are identifying, not secret, info (same as GCP's project), so they're collected in the panel
// and embedded directly, unlike SNOWFLAKE_PRIVATE_KEY (the one real secret), which stays an
// environment variable Terraform reads at apply time, never written into this file; and the
// subscription ID (AzureRM v4 no longer infers it from the CLI's active context) and the logs
// storage account's resource group aren't in the storage config, so they're collected in the
// panel. tenant_id IS already in the storage config (required at storage setup) and is set
// explicitly on azurerm/azuread/the backend, rather than left to the Azure CLI's active
// context, so a customer signed into multiple Entra tenants can't silently target the wrong one.
// ---------------------------------------------------------------------------------------

/** The customer's Azure Blob storage config — the container the lakehouse reads. */
export interface LakehouseAzureStorageConfig {
  /** Logs storage account name (config.account). */
  account: string
  /** Logs container name (config.container). */
  container: string
  /** Directory (Entra) tenant ID that owns the storage account (config.tenant_id) -- a required
   * field of the Azure storage config, so always present once the storage provider is connected.
   * Set explicitly on every Azure provider/backend below rather than left to the Azure CLI's
   * current context: a user signed into multiple tenants would otherwise nondeterministically
   * target whichever one the CLI happens to default to. */
  tenantId: string
  /** Optional key prefix (config.key_prefix); empty means the container root. */
  keyPrefix?: string
}

/** Panel-driven options for the Azure snippet. */
export interface LakehouseAzureSnippetOptions {
  /** Azure subscription ID that owns the logs storage account (azurerm provider subscription_id). */
  subscriptionId: string
  /** Resource group that owns the logs storage account. */
  resourceGroup: string
  /** Snowflake organization name (Snowsight account selector, top-left; snowflake provider organization_name). */
  organizationName: string
  /** Snowflake account name, not the account locator (snowflake provider account_name). */
  accountName: string
  /** Snowflake user Terraform authenticates as, key-pair auth (snowflake provider user). */
  user: string
  /** The default-ON "Store state in Azure Storage (recommended)" control. */
  remoteState: boolean
  /** Resource group of the state storage account (in subscriptionId); only used when remoteState is true. */
  stateResourceGroup?: string
  /** Storage account for Terraform state; only used when remoteState is true. */
  stateStorageAccount?: string
  /** Container for Terraform state; only used when remoteState is true. */
  stateContainer?: string
}

const MODULE_SOURCE_AZURE = `github.com/traceforce/traceforce-lakehouse//terraform/azure?ref=${MODULE_REF}`

/**
 * Build the `main.tf` HCL for the Azure Lakehouse Terraform module. Mirrors
 * {@link buildLakehouseSnippet}: `required_version >= 1.5`, an optional remote-state backend
 * (here `azurerm` with Entra ID auth, and its own explicit tenant_id/subscription_id since a
 * backend initializes independently of the provider), the providers (azurerm/azuread both
 * pinned to the storage config's tenant_id, azurerm also to the panel's subscription ID since
 * AzureRM v4 requires it explicitly; snowflake's organization_name/account_name/user filled in
 * from the panel too -- identifying, not secret, info, so SNOWFLAKE_PRIVATE_KEY is the only
 * credential still left as an environment variable), and the module block with
 * `iceberg_storage_account_name` (required by the module, no default -- suggested here via
 * {@link suggestIcebergStorageAccountName}, not read back from anything), `logs_storage_account_name`
 * / `logs_container_name` / `logs_prefix` from the storage config, and `logs_resource_group_name`
 * from the panel. Two optional inputs ship commented out (no `alarm_notification_email` option,
 * matching AWS/GCP: Snowflake only emails a verified Snowflake user's address, so a placeholder
 * team address would fail on apply if uncommented).
 * The consent URL and reader role are re-exported as outputs for the post-apply steps. Every
 * interpolated value is HCL-escaped.
 */
/**
 * Suggest a globally-unique Azure storage account name for the module's Iceberg storage account
 * (required, no default -- the module itself won't derive one, since any value derived from a
 * mutable input could silently change later and force a destructive replace). Truncates the
 * PREFIX of the logs account name (not the whole concatenation), so this never collides with the
 * logs account name itself even when that name is already at Azure's 24-char max.
 */
function suggestIcebergStorageAccountName(logsAccountName: string): string {
  const suffix = "lakehouse"
  return `${logsAccountName.slice(0, 24 - suffix.length)}${suffix}`
}

export function buildLakehouseSnippetAzure(
  config: LakehouseAzureStorageConfig,
  options: LakehouseAzureSnippetOptions,
): string {
  const lines: string[] = []

  lines.push("terraform {")
  lines.push('  required_version = ">= 1.5"')
  if (options.remoteState) {
    lines.push("")
    lines.push('  backend "azurerm" {')
    // The backend initializes independently of the provider, so it needs the subscription and
    // tenant too, not just Terraform's own provider config.
    lines.push(`    subscription_id      = "${hclEscape(options.subscriptionId)}"`)
    lines.push(`    tenant_id            = "${hclEscape(config.tenantId)}"`)
    lines.push(`    resource_group_name  = "${hclEscape(options.stateResourceGroup ?? "")}"`)
    lines.push(`    storage_account_name = "${hclEscape(options.stateStorageAccount ?? "")}"`)
    lines.push(`    container_name       = "${hclEscape(options.stateContainer ?? "")}"`)
    lines.push('    key                  = "traceforce-lakehouse/terraform.tfstate"')
    lines.push("    use_azuread_auth     = true")
    lines.push("  }")
  }
  lines.push("")
  lines.push("  required_providers {")
  lines.push("    azurerm = {")
  lines.push('      source  = "hashicorp/azurerm"')
  lines.push('      version = "~> 4.0"')
  lines.push("    }")
  lines.push("    azuread = {")
  lines.push('      source  = "hashicorp/azuread"')
  lines.push('      version = "~> 3.0"')
  lines.push("    }")
  lines.push("    snowflake = {")
  lines.push('      source  = "snowflakedb/snowflake"')
  lines.push('      version = "~> 2.0"')
  lines.push("    }")
  lines.push("  }")
  lines.push("}")
  lines.push("")

  lines.push('provider "azurerm" {')
  lines.push(`  subscription_id = "${hclEscape(options.subscriptionId)}"`)
  lines.push(`  tenant_id       = "${hclEscape(config.tenantId)}"`)
  lines.push("  features {}")
  lines.push("}")
  lines.push("")
  // tenant_id pins azuread to the same directory as azurerm, rather than whichever tenant the
  // Azure CLI's current context happens to default to (per the provider's own docs) -- a
  // customer signed into multiple Entra tenants would otherwise nondeterministically target
  // the wrong one.
  lines.push('provider "azuread" {')
  lines.push(`  tenant_id = "${hclEscape(config.tenantId)}"`)
  lines.push("}")
  lines.push("")
  lines.push('provider "snowflake" {')
  lines.push(`  organization_name = "${hclEscape(options.organizationName)}"`)
  lines.push(`  account_name      = "${hclEscape(options.accountName)}"`)
  lines.push(`  user              = "${hclEscape(options.user)}"`)
  lines.push('  authenticator     = "SNOWFLAKE_JWT" # key-pair auth; this module always uses it, not a choice')
  lines.push("")
  lines.push("  # private_key is the one real secret here -- deliberately not set above like the rest:")
  lines.push("  # reads from SNOWFLAKE_PRIVATE_KEY in the environment, never hardcoded in this file.")
  lines.push("")
  lines.push("  preview_features_enabled = [")
  lines.push('    "snowflake_external_table_resource",')
  lines.push('    "snowflake_iceberg_table_resource",')
  lines.push('    "snowflake_email_notification_integration_resource",')
  lines.push('    "snowflake_alert_resource",')
  lines.push("  ]")
  lines.push("}")
  lines.push("")

  lines.push('module "lakehouse" {')
  lines.push(`  source = "${MODULE_SOURCE_AZURE}"`)
  lines.push("")
  // Required by the module, with no default -- suggested here as a truncated prefix of the logs
  // account name (already a real, existing, globally-unique Azure storage account) plus a fixed
  // suffix, the same shape the module itself used to compute automatically; customers should
  // treat it as fixed once applied, since changing it later destroys and recreates the storage
  // account, deleting the Iceberg table files.
  lines.push(
    `  iceberg_storage_account_name = "${hclEscape(suggestIcebergStorageAccountName(config.account))}"`,
  )
  lines.push("")
  lines.push(`  logs_storage_account_name = "${hclEscape(config.account)}"`)
  lines.push(`  logs_resource_group_name  = "${hclEscape(options.resourceGroup)}"`)
  lines.push(`  logs_container_name       = "${hclEscape(config.container)}"`)
  const keyPrefix = normalizeKeyPrefix(config.keyPrefix ?? "")
  if (keyPrefix) {
    lines.push(`  logs_prefix               = "${hclEscape(keyPrefix)}"`)
  } else {
    lines.push('  logs_prefix               = ""  # TraceForce writes at the container root')
  }
  lines.push("")
  lines.push(
    '  # reader_users = ["JDOE"]  # uncomment to grant existing Snowflake users read-only access; otherwise GRANT the reader_role_name output by hand',
  )
  lines.push(
    '  # warehouse_size = "SMALL"  # uncomment if ad-hoc queries feel slow (default XSMALL)',
  )
  lines.push("}")
  lines.push("")
  lines.push('output "azure_consent_url" { value = module.lakehouse.azure_consent_url }')
  lines.push('output "reader_role_name" { value = module.lakehouse.reader_role_name }')

  return lines.join("\n") + "\n"
}

// ---------------------------------------------------------------------------------------
// Shell command generation for the Azure panel's "export the Snowflake env vars" step. Pure
// and shell-escaped -- unlike buildLakehouseSnippetAzure's HCL output, these values are meant
// to be pasted into a real shell, so each one goes through shellEscape rather than hclEscape.
// ---------------------------------------------------------------------------------------

/**
 * Build the `export SNOWFLAKE_...` command block for the Azure panel's Step 2. Organization and
 * account come straight from customer-entered panel fields (shell-escaped before being embedded
 * in a double-quoted `export FOO="..."` line -- otherwise a value containing shell
 * metacharacters, e.g. `$(...)`, would execute instead of being treated as a literal when pasted
 * into a real shell).
 *
 * user is deliberately NOT a parameter: the Step 1 Snowflake user is who Terraform ran
 * `terraform apply` as (typically holding a broad role like ACCOUNTADMIN), and the agent
 * querying the lakehouse should authenticate as a separate, dedicated user holding only the
 * read-only reader role instead -- reusing the deploy user's key here would hand the agent's
 * shell a full-privilege credential whose restriction to read-only then depends entirely on
 * snowflake_query.sh's own USE ROLE/USE SECONDARY ROLES NONE preamble, not on the credential
 * itself. SNOWFLAKE_USER is a placeholder for the customer to fill in with that dedicated user,
 * the same way SNOWFLAKE_PRIVATE_KEY already is.
 */
export function buildSnowflakeEnvExports(organizationName: string, accountName: string): string {
  return [
    `export SNOWFLAKE_ORGANIZATION_NAME=${shellEscape(organizationName)}`,
    `export SNOWFLAKE_ACCOUNT_NAME=${shellEscape(accountName)}`,
    'export SNOWFLAKE_USER="YOUR_READER_USER"',
    'export SNOWFLAKE_AUTHENTICATOR="SNOWFLAKE_JWT"',
    'export SNOWFLAKE_PRIVATE_KEY="$(cat /path/to/your/key.p8)"',
  ].join("\n")
}

// ---------------------------------------------------------------------------------------
// Required-input check for the setup panel. Pure so every cloud's required fields are unit
// tested: the panel keeps Copy / Download disabled while this returns anything, so a
// half-filled main.tf can't be shipped.
// ---------------------------------------------------------------------------------------

export type LakehouseCloud = "aws" | "gcp" | "azure"

/** The logs location from the storage config, compared against the state location. */
export interface LakehouseLogsLocation {
  /** S3 / GCS logs bucket (config.bucket). */
  bucket?: string
  /** Azure logs storage account (config.account). */
  account?: string
}

/** Everything the panel collects. Only the fields for the given cloud are consulted. */
export interface LakehousePanelInputs {
  remoteState: boolean
  stateBucket?: string // AWS / GCP
  stateRegion?: string // AWS
  project?: string // GCP
  subscriptionId?: string // Azure
  resourceGroup?: string // Azure
  organizationName?: string // Azure
  accountName?: string // Azure
  user?: string // Azure
  stateResourceGroup?: string // Azure
  stateStorageAccount?: string // Azure
  stateContainer?: string // Azure
}

/** A panel input that is missing, or (for state bucket / account) reuses the logs location. */
export type LakehouseMissingInput = Exclude<keyof LakehousePanelInputs, "remoteState">

/**
 * Return the panel inputs that still block Copy / Download, in panel order; empty means the
 * snippet is complete. Values are trimmed first, so whitespace-only counts as missing.
 *
 * - GCP always needs `project`; Azure always needs `subscriptionId`, `resourceGroup`,
 *   `organizationName`, `accountName` and `user` (provider / module inputs, independent of
 *   remote state -- the Snowflake identity fields are collected because they're embedded
 *   directly in the generated file, unlike SNOWFLAKE_PRIVATE_KEY, which stays an environment
 *   variable). AWS has none.
 * - With remote state on: AWS needs `stateBucket` + `stateRegion`, GCP `stateBucket`, Azure
 *   `stateResourceGroup` + `stateStorageAccount` + `stateContainer`. A state bucket / account
 *   equal to the logs one is reported too — state must live somewhere else.
 * - With remote state off, the state inputs are ignored.
 */
export function lakehouseMissingInputs(
  cloud: LakehouseCloud,
  logs: LakehouseLogsLocation,
  inputs: LakehousePanelInputs,
): LakehouseMissingInput[] {
  const missing: LakehouseMissingInput[] = []
  const blank = (key: LakehouseMissingInput) => (inputs[key] ?? "").trim() === ""
  const require = (...keys: LakehouseMissingInput[]) => {
    for (const key of keys) if (blank(key)) missing.push(key)
  }

  if (cloud === "gcp") require("project")
  if (cloud === "azure") require("subscriptionId", "resourceGroup", "organizationName", "accountName", "user")

  if (inputs.remoteState) {
    if (cloud === "azure") {
      require("stateResourceGroup")
      const stateAccount = (inputs.stateStorageAccount ?? "").trim()
      if (stateAccount === "" || stateAccount === logs.account) missing.push("stateStorageAccount")
      require("stateContainer")
    } else {
      const stateBucket = (inputs.stateBucket ?? "").trim()
      if (stateBucket === "" || stateBucket === logs.bucket) missing.push("stateBucket")
      if (cloud === "aws") require("stateRegion")
    }
  }

  return missing
}

// ---------------------------------------------------------------------------------------
// Lakehouse tile gating, derived from the storage config. Pure so it can be unit tested.
// ---------------------------------------------------------------------------------------

/** The slice of the customer's storage record the tile gating reads. */
export interface LakehouseStorageRecord {
  /** 1 = GCS, 2 = S3, 3 = Azure Blob Storage. */
  provider: number
  /** 2 = connected (not pending / disconnected / erroring). */
  status: number
  config: Record<string, string | undefined>
}

export type LakehouseTileState = "ready" | "needs-storage" | "unsupported"

/** Storage provider id → the lakehouse cloud whose module and panel copy apply. */
export const cloudForProvider = (provider: number): LakehouseCloud =>
  provider === 1 ? "gcp" : provider === 3 ? "azure" : "aws"

/**
 * Lakehouse tile state for a storage config. A connected S3 provider (bucket + region), GCS
 * provider (bucket only — buckets are global / multi-region, so no region) or Azure provider
 * (account + container + tenant_id) is a real query target (`ready`); any other configured
 * provider is "coming soon" (`unsupported`); no or incomplete config routes the admin to storage
 * setup (`needs-storage`). Azure requires tenant_id here too: buildLakehouseSnippetAzure always
 * embeds it in the generated provider/backend blocks, so a config missing it would open the
 * panel and let Copy/Download ship a `tenant_id = ""` that fails at terraform apply.
 */
/** Nonblank the same way lakehouseMissingInputs treats a panel field: present and not just
 *  whitespace. A plain truthiness check (`!!value`) would read "   " as ready, same as
 *  a legacy or API-created record with a technically-present but blank field. */
const nonBlank = (value: string | undefined): boolean => (value ?? "").trim() !== ""

export function lakehouseTileState(
  storage: LakehouseStorageRecord | null | undefined,
): LakehouseTileState {
  if (!storage) return "needs-storage"
  const { provider, config } = storage
  if (provider !== 1 && provider !== 2 && provider !== 3) return "unsupported"
  if (storage.status !== 2) return "needs-storage"
  const ready =
    provider === 2
      ? nonBlank(config.bucket) && nonBlank(config.region)
      : provider === 1
        ? nonBlank(config.bucket)
        : nonBlank(config.account) && nonBlank(config.container) && nonBlank(config.tenant_id)
  return ready ? "ready" : "needs-storage"
}
