// The Bedrock AgentCore Terraform template shown in the AWS connect panel.
//
// ONE static template, the same for every customer and every download. The
// admin supplies the account and the Regions through
// standard Terraform variables (a .tfvars file, -var, or TF_VAR_*), and runs it
// once per AWS account. Nothing about the customer is baked in, so the form only
// asks for what Terraform hands back: the role ARN.
//
// Scope, deliberately: this creates ONE cross-account IAM role that Traceforce
// can assume to LIST AgentCore inventory. It does not create a gateway or an
// interceptor — see the note at the bottom of this file.

/**
 * The Traceforce role that the customer's role must trust.
 *
 * Per environment, because it differs: production assumes
 * `customer-storage-prod` (below), other environments set
 * VITE_TRACEFORCE_TRUSTED_ROLE_ARN. It is only the variable's default, so the
 * template text stays the same everywhere within one environment.
 *
 * Must match the server's CUSTOMER_STORAGE_ROLE_ARN for the same environment.
 */
export const TRUSTED_ROLE_ARN =
  import.meta.env.VITE_TRACEFORCE_TRUSTED_ROLE_ARN ||
  "arn:aws:iam::865117862743:role/customer-storage-prod"

/** Name of the role the template creates in the customer account. */
export const BEDROCK_ROLE_NAME = "BedrockInventoryRole"

/**
 * Tag the template puts on the role listing the Regions it may read. The server
 * reads it back after assuming the role, which is how Regions reach Traceforce
 * without a form field. Space-separated: IAM tag values cannot contain commas.
 */
export const REGIONS_TAG = "traceforce-regions"

/** File name the template downloads as. */
export const TEMPLATE_FILE_NAME = "main.tf"

/** Minimum Terraform the template is known to work with. */
const REQUIRED_VERSION = ">= 1.5"

/**
 * Escape a value for embedding inside an HCL double-quoted string.
 *
 * Backslash first (so the backslashes we add next aren't re-escaped), then the
 * double-quote, then Terraform's interpolation opener `${` -> `$${`. Only the
 * trusted role ARN is embedded, and it comes from build config, but escaping
 * keeps a bad value from corrupting the template.
 */
function hclEscape(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    // Function form: a literal replacement string would treat `$$` as an
    // escaped single `$`, silently turning this into a no-op.
    .replace(/\$\{/g, () => "$${")
}

/**
 * The static `main.tf`.
 *
 * - `allowed_account_ids` makes Terraform refuse to run if the credentials in
 *   the environment resolve to any account other than `account_id`.
 * - Permissions are READ-ONLY (`List*` / `Get*`) and fenced to `regions`.
 *   Nothing here can create, modify or delete anything, or invoke a model.
 * - `iam:GetRole` on the role itself, so Traceforce can read the Regions tag.
 */
export function buildBedrockTerraform(trustedRoleArn: string = TRUSTED_ROLE_ARN): string {
  return `terraform {
  required_version = "${REQUIRED_VERSION}"
}

variable "account_id" {
  description = "AWS account to create the role in. Terraform refuses to run against any other account."
  type        = string
}

variable "regions" {
  description = "AWS Regions where Traceforce may read Bedrock AgentCore inventory."
  type        = list(string)

  validation {
    condition     = length(var.regions) > 0 && length(var.regions) <= 10
    error_message = "List between 1 and 10 Regions."
  }
}

variable "trusted_role_arn" {
  description = "Traceforce role allowed to assume this role. Keep the default unless Traceforce asks you to change it."
  type        = string
  default     = "${hclEscape(trustedRoleArn)}"
}

provider "aws" {
  region              = var.regions[0]
  allowed_account_ids = [var.account_id]
}

# Role Traceforce assumes to read AgentCore inventory in this account.
resource "aws_iam_role" "traceforce_bedrock" {
  name = "${BEDROCK_ROLE_NAME}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { AWS = var.trusted_role_arn }
      Action    = "sts:AssumeRole"
    }]
  })

  # Traceforce reads this back to learn which Regions to collect.
  tags = {
    "${REGIONS_TAG}" = join(" ", var.regions)
  }
}

resource "aws_iam_role_policy" "traceforce_bedrock" {
  name = "${BEDROCK_ROLE_NAME}-bedrock"
  role = aws_iam_role.traceforce_bedrock.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Inventory"
        Effect = "Allow"
        Action = [
          "bedrock:List*",
          "bedrock:Get*",
          "bedrock-agentcore:List*",
          "bedrock-agentcore:Get*",
        ]
        Resource  = "*"
        Condition = { StringEquals = { "aws:RequestedRegion" = var.regions } }
      },
      {
        Sid      = "ReadOwnRegionsTag"
        Effect   = "Allow"
        Action   = "iam:GetRole"
        Resource = aws_iam_role.traceforce_bedrock.arn
      },
    ]
  })
}

output "role_arn" {
  description = "Paste this into Traceforce to finish connecting."
  value       = aws_iam_role.traceforce_bedrock.arn
}
`
}

export const DEPLOY_STEPS: string[] = [
  `Download ${TEMPLATE_FILE_NAME} into its own folder. The same template works for every AWS account.`,
  "Create one .tfvars file per AWS account with account_id and regions (for example, regions = [\"us-east-1\"]).",
  "Point your AWS credentials at that account (for example, set AWS_PROFILE).",
  "Keep separate Terraform state per account: use a folder or a workspace per account (terraform workspace new <name>). Reusing one state for a second account would replace the first account's role.",
  'Run "terraform init", then terraform apply "-var-file=<account>.tfvars" and confirm. Keep the quotes: PowerShell otherwise splits the argument at the dot.',
  'Copy the "role_arn" output and paste it below.',
]

// "; " rather than "&&" and a quoted -var-file, so it runs unchanged in
// PowerShell (5.1 has no &&, and splits -var-file=x.tfvars at the dot) and bash.
export const APPLY_COMMAND = 'terraform init; terraform apply "-var-file=<account>.tfvars"'

/**
 * Derive the account id from a role ARN.
 *
 * NOTE: this is a local format check only. It does NOT prove the role exists or
 * that we can assume it — that needs the server-side verify call. Callers must
 * not present its result as a verified connection.
 */
export function accountIdFromRoleArn(roleArn: string): string | null {
  return roleArn.trim().match(/^arn:aws:iam::(\d{12}):role\/[\w+=,.@\-/]+$/)?.[1] ?? null
}

// ---------------------------------------------------------------------------
// Not generated here, on purpose: the Traceforce gateway and its interceptor.
//
// An earlier draft emitted `aws_bedrockagentcore_gateway` and
// `aws_bedrockagentcore_interceptor`. The second does not exist in the AWS
// provider — an interceptor is configured as an `interceptor_configuration`
// block inside the gateway resource, not as a standalone resource — and the
// gateway was emitted with only a `name`, while the API also requires an
// authorizer type and a role ARN. `terraform apply` would have failed on both.
//
// Listing agents needs neither, so they are left out until the gateway flow is
// built properly.
// ---------------------------------------------------------------------------
