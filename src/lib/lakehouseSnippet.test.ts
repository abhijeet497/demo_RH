import { describe, it, expect } from "bun:test"

import {
  buildLakehouseSnippet,
  buildLakehouseSnippetAzure,
  buildLakehouseSnippetGcp,
  buildSnowflakeEnvExports,
  cloudForProvider,
  lakehouseMissingInputs,
  lakehouseTileState,
  type LakehouseCloud,
  type LakehouseMissingInput,
  type LakehousePanelInputs,
} from "./lakehouseSnippet"

const baseConfig = { bucket: "my-logs", region: "us-east-1" }
const noRemoteState = { remoteState: false }

describe("buildLakehouseSnippet", () => {
  it("renders the core module block with the storage bucket and region", () => {
    const out = buildLakehouseSnippet(baseConfig, noRemoteState)
    expect(out).toContain('required_version = ">= 1.5"')
    expect(out).toContain('region = "us-east-1"')
    expect(out).toContain(
      'source = "github.com/traceforce/traceforce-lakehouse//terraform/aws?ref=1.3.0"',
    )
    expect(out).toContain('logs_bucket = "my-logs"')
    // optional inputs ship commented so they never apply unless uncommented
    expect(out).toContain('# query_trusted_principals')
    expect(out).toContain('output "query_policy_json" { value = module.lakehouse.query_policy_json }')
    // remoteState off -> no backend block
    expect(out).not.toContain('backend "s3"')
  })

  it("emits a backend block with escaped state bucket/region when remoteState is on", () => {
    const out = buildLakehouseSnippet(baseConfig, {
      remoteState: true,
      stateBucket: "tf-state",
      stateRegion: "eu-west-1",
    })
    expect(out).toContain('backend "s3"')
    expect(out).toContain('bucket       = "tf-state"')
    expect(out).toContain('region       = "eu-west-1"')
    expect(out).not.toContain('use_lockfile')
  })

  it("strips leading/trailing slashes from the key prefix", () => {
    const out = buildLakehouseSnippet(
      { ...baseConfig, keyPrefix: "/traceforce/logs/" },
      noRemoteState,
    )
    expect(out).toContain('logs_prefix = "traceforce/logs"')
    // must not leak the wrapping slashes the module rejects
    expect(out).not.toContain('logs_prefix = "/traceforce/logs/"')
  })

  it("treats a slash-only prefix as the bucket root", () => {
    const out = buildLakehouseSnippet(
      { ...baseConfig, keyPrefix: "///" },
      noRemoteState,
    )
    expect(out).toContain(
      'logs_prefix = ""  # TraceForce writes at the bucket root',
    )
  })

  it("HCL-escapes quotes and the ${ template opener in interpolated values", () => {
    const out = buildLakehouseSnippet(
      {
        bucket: 'evil"bucket${var.x}',
        region: 'us-"east"-1',
        keyPrefix: 'a${b}"c',
      },
      {
        remoteState: true,
        stateBucket: 'st${x}"y',
        stateRegion: 'r"${z}',
      },
    )
    // bucket: " -> \" and ${ -> $${
    expect(out).toContain('logs_bucket = "evil\\"bucket$${var.x}"')
    // region likewise
    expect(out).toContain('region = "us-\\"east\\"-1"')
    // prefix (internal slashes-free) escaped, not stripped away
    expect(out).toContain('logs_prefix = "a$${b}\\"c"')
    // backend state values escaped too
    expect(out).toContain('bucket       = "st$${x}\\"y"')
    expect(out).toContain('region       = "r\\"$${z}"')
    // the raw, unescaped forms must never appear
    expect(out).not.toContain('"evil"bucket${var.x}"')
  })

  it("escapes the %{ directive opener", () => {
    const out = buildLakehouseSnippet({ ...baseConfig, keyPrefix: "a%{b" }, noRemoteState)
    expect(out).toContain('logs_prefix = "a%%{b"')
  })

  it("escapes a backslash before the characters that need escaping", () => {
    const out = buildLakehouseSnippet(
      { ...baseConfig, bucket: 'back\\slash' },
      noRemoteState,
    )
    expect(out).toContain('logs_bucket = "back\\\\slash"')
  })
})

const gcpConfig = { bucket: "my-logs" }

describe("buildLakehouseSnippetGcp", () => {
  it("renders the core module block with the google provider and project", () => {
    const out = buildLakehouseSnippetGcp(gcpConfig, {
      project: "acme-prod",
      remoteState: false,
    })
    expect(out).toContain('required_version = ">= 1.5"')
    expect(out).toContain('provider "google"')
    expect(out).toContain('project = "acme-prod"')
    expect(out).toContain(
      'source = "github.com/traceforce/traceforce-lakehouse//terraform/gcp?ref=1.3.0"',
    )
    expect(out).toContain('logs_bucket = "my-logs"')
    // optional input ships commented
    expect(out).toContain('# query_members')
    // remoteState off -> no backend block
    expect(out).not.toContain('backend "gcs"')
  })

  it("emits a gcs backend (bucket + prefix, no region/key) when remoteState is on", () => {
    const out = buildLakehouseSnippetGcp(gcpConfig, {
      project: "acme-prod",
      remoteState: true,
      stateBucket: "tf-state",
    })
    expect(out).toContain('backend "gcs"')
    expect(out).toContain('bucket = "tf-state"')
    expect(out).toContain('prefix = "traceforce-lakehouse"')
    // GCS backend has no key/region, unlike S3
    expect(out).not.toContain("key    =")
    expect(out).not.toContain("region       =")
  })

  it("treats a slash-only prefix as the bucket root", () => {
    const out = buildLakehouseSnippetGcp(
      { ...gcpConfig, keyPrefix: "///" },
      { project: "p", remoteState: false },
    )
    expect(out).toContain('logs_prefix = ""  # TraceForce writes at the bucket root')
  })
})


const azureConfig = { account: "acmelogs", container: "logs", tenantId: "00000000-0000-0000-0000-000000000002" }
const azureNoRemoteState = {
  subscriptionId: "00000000-0000-0000-0000-000000000001",
  resourceGroup: "acme-logs-rg",
  organizationName: "acmeorg",
  accountName: "acmeaccount",
  user: "TF_DEPLOY_USER",
  remoteState: false,
}

describe("buildLakehouseSnippetAzure", () => {
  it("renders the providers and module block from the storage config and resource group", () => {
    const out = buildLakehouseSnippetAzure(azureConfig, azureNoRemoteState)
    expect(out).toContain('required_version = ">= 1.5"')
    expect(out).toContain('source  = "hashicorp/azurerm"')
    expect(out).toContain('source  = "hashicorp/azuread"')
    expect(out).toContain('source  = "snowflakedb/snowflake"')
    // AzureRM v4 requires the subscription explicitly; tenant_id is pinned too, on both
    // providers, rather than left to the Azure CLI's current context.
    expect(out).toContain(
      'provider "azurerm" {\n  subscription_id = "00000000-0000-0000-0000-000000000001"\n  tenant_id       = "00000000-0000-0000-0000-000000000002"\n  features {}\n}',
    )
    expect(out).toContain('provider "azuread" {\n  tenant_id = "00000000-0000-0000-0000-000000000002"\n}')
    // Snowflake identity is embedded directly (identifying, not secret, info); only
    // SNOWFLAKE_PRIVATE_KEY stays an environment variable, never written into this file.
    expect(out).toContain('organization_name = "acmeorg"')
    expect(out).toContain('account_name      = "acmeaccount"')
    expect(out).toContain('user              = "TF_DEPLOY_USER"')
    expect(out).toContain('authenticator     = "SNOWFLAKE_JWT"')
    expect(out).toContain('SNOWFLAKE_PRIVATE_KEY')
    expect(out).not.toContain('SNOWFLAKE_ORGANIZATION_NAME')
    expect(out).not.toContain('SNOWFLAKE_ACCOUNT_NAME')
    expect(out).not.toContain('SNOWFLAKE_USER')
    expect(out).toContain('"snowflake_iceberg_table_resource",')
    expect(out).toContain(
      'source = "github.com/traceforce/traceforce-lakehouse//terraform/azure?ref=1.3.0"',
    )
    expect(out).toContain('logs_storage_account_name = "acmelogs"')
    expect(out).toContain('logs_resource_group_name  = "acme-logs-rg"')
    expect(out).toContain('logs_container_name       = "logs"')
    expect(out).toContain('logs_prefix               = ""  # TraceForce writes at the container root')
    // optional inputs ship commented -- no alarm_notification_email, matching AWS/GCP (Snowflake
    // only emails a verified Snowflake user's address, so a placeholder team address would fail
    // on apply if uncommented)
    expect(out).toContain('iceberg_storage_account_name = "acmelogslakehouse"')
    expect(out).toContain("# reader_users")
    expect(out).toContain("# warehouse_size")
    expect(out).not.toContain("alarm_notification_email")
    expect(out).toContain('output "azure_consent_url" { value = module.lakehouse.azure_consent_url }')
    expect(out).toContain('output "reader_role_name" { value = module.lakehouse.reader_role_name }')
    // remoteState off -> no backend block
    expect(out).not.toContain('backend "azurerm"')
  })

  it("emits an azurerm backend with Entra ID auth when remoteState is on", () => {
    const out = buildLakehouseSnippetAzure(azureConfig, {
      ...azureNoRemoteState,
      remoteState: true,
      stateResourceGroup: "acme-tf-rg",
      stateStorageAccount: "acmetfstate",
      stateContainer: "tfstate",
    })
    expect(out).toContain('backend "azurerm"')
    // backend doesn't inherit the provider's subscription
    expect(out).toContain('subscription_id      = "00000000-0000-0000-0000-000000000001"')
    expect(out).toContain('resource_group_name  = "acme-tf-rg"')
    expect(out).toContain('storage_account_name = "acmetfstate"')
    expect(out).toContain('container_name       = "tfstate"')
    expect(out).toContain('key                  = "traceforce-lakehouse/terraform.tfstate"')
    expect(out).toContain("use_azuread_auth     = true")
  })

  it("strips leading/trailing slashes from the key prefix", () => {
    const out = buildLakehouseSnippetAzure(
      { ...azureConfig, keyPrefix: "/traceforce/logs/" },
      azureNoRemoteState,
    )
    expect(out).toContain('logs_prefix               = "traceforce/logs"')
  })

  it("treats a slash-only prefix as the container root", () => {
    const out = buildLakehouseSnippetAzure({ ...azureConfig, keyPrefix: "///" }, azureNoRemoteState)
    expect(out).toContain('logs_prefix               = ""  # TraceForce writes at the container root')
  })

  it("HCL-escapes interpolated values", () => {
    const out = buildLakehouseSnippetAzure(
      { account: 'a"b', container: "c${x}", tenantId: 'tid"${w}', keyPrefix: 'p${q}"r' },
      {
        subscriptionId: 'sub"${z}',
        resourceGroup: "rg%{y}",
        organizationName: 'org"${o}',
        accountName: "acct%{p}",
        user: 'us${er}"name',
        remoteState: true,
        stateResourceGroup: 's"rg',
        stateStorageAccount: "s${a}",
        stateContainer: 'back\\slash',
      },
    )
    expect(out).toContain('logs_storage_account_name = "a\\"b"')
    expect(out).toContain('logs_container_name       = "c$${x}"')
    expect(out).toContain('logs_resource_group_name  = "rg%%{y}"')
    expect(out).toContain('organization_name = "org\\"$${o}"')
    expect(out).toContain('account_name      = "acct%%{p}"')
    expect(out).toContain('user              = "us$${er}\\"name"')
    expect(out).toContain('subscription_id = "sub\\"$${z}"')
    expect(out).toContain('tenant_id       = "tid\\"$${w}"')
    expect(out).toContain('resource_group_name  = "s\\"rg"')
    expect(out).toContain('storage_account_name = "s$${a}"')
    expect(out).toContain('container_name       = "back\\\\slash"')
    expect(out).toContain('logs_prefix               = "p$${q}\\"r"')
    // the raw, unescaped forms must never appear
    expect(out).not.toContain('"a"b"')
    expect(out).not.toContain('"c${x}"')
  })
})

describe("lakehouseMissingInputs", () => {
  const logs = { bucket: "my-logs", account: "acmelogs" }

  // A fully-filled panel per cloud, plus that cloud's required inputs with remote state on / off.
  const cases: {
    cloud: LakehouseCloud
    complete: LakehousePanelInputs
    requiredWithRemoteState: LakehouseMissingInput[]
    requiredWithoutRemoteState: LakehouseMissingInput[]
  }[] = [
    {
      cloud: "aws",
      complete: { remoteState: true, stateBucket: "tf-state", stateRegion: "us-east-1" },
      requiredWithRemoteState: ["stateBucket", "stateRegion"],
      requiredWithoutRemoteState: [],
    },
    {
      cloud: "gcp",
      complete: { remoteState: true, project: "acme-prod", stateBucket: "tf-state" },
      requiredWithRemoteState: ["project", "stateBucket"],
      requiredWithoutRemoteState: ["project"],
    },
    {
      cloud: "azure",
      complete: {
        remoteState: true,
        subscriptionId: "00000000-0000-0000-0000-000000000001",
        resourceGroup: "acme-logs-rg",
        organizationName: "acmeorg",
        accountName: "acmeaccount",
        user: "TF_DEPLOY_USER",
        stateResourceGroup: "acme-tf-rg",
        stateStorageAccount: "acmetfstate",
        stateContainer: "tfstate",
      },
      requiredWithRemoteState: [
        "subscriptionId",
        "resourceGroup",
        "organizationName",
        "accountName",
        "user",
        "stateResourceGroup",
        "stateStorageAccount",
        "stateContainer",
      ],
      requiredWithoutRemoteState: ["subscriptionId", "resourceGroup", "organizationName", "accountName", "user"],
    },
  ]

  for (const { cloud, complete, requiredWithRemoteState, requiredWithoutRemoteState } of cases) {
    describe(cloud, () => {
      it("reports nothing when every required input is filled", () => {
        expect(lakehouseMissingInputs(cloud, logs, complete)).toEqual([])
      })

      it("reports every required input when the panel is empty (remote state on)", () => {
        expect(lakehouseMissingInputs(cloud, logs, { remoteState: true })).toEqual(
          requiredWithRemoteState,
        )
      })

      it("reports only the non-state inputs when remote state is off", () => {
        expect(lakehouseMissingInputs(cloud, logs, { remoteState: false })).toEqual(
          requiredWithoutRemoteState,
        )
        // state inputs are ignored once remote state is off
        expect(lakehouseMissingInputs(cloud, logs, { ...complete, remoteState: false })).toEqual([])
      })

      for (const key of requiredWithRemoteState) {
        it(`blocks when ${key} is missing`, () => {
          expect(lakehouseMissingInputs(cloud, logs, { ...complete, [key]: undefined })).toEqual([key])
        })

        it(`treats a whitespace-only ${key} as missing`, () => {
          expect(lakehouseMissingInputs(cloud, logs, { ...complete, [key]: "   " })).toEqual([key])
        })
      }
    })
  }

  it("blocks a state bucket that is the logs bucket (AWS / GCP)", () => {
    for (const cloud of ["aws", "gcp"] as const) {
      const complete = cases.find((c) => c.cloud === cloud)!.complete
      expect(
        lakehouseMissingInputs(cloud, logs, { ...complete, stateBucket: " my-logs " }),
      ).toEqual(["stateBucket"])
    }
  })

  it("blocks a state storage account that is the logs account (Azure)", () => {
    const complete = cases.find((c) => c.cloud === "azure")!.complete
    expect(
      lakehouseMissingInputs("azure", logs, { ...complete, stateStorageAccount: "acmelogs" }),
    ).toEqual(["stateStorageAccount"])
  })

  it("ignores other clouds' inputs", () => {
    // an Azure-only field doesn't satisfy GCP's project, and vice versa
    expect(
      lakehouseMissingInputs("gcp", logs, { remoteState: false, subscriptionId: "x", resourceGroup: "y" }),
    ).toEqual(["project"])
    expect(
      lakehouseMissingInputs("azure", logs, { remoteState: false, project: "p" }),
    ).toEqual(["subscriptionId", "resourceGroup", "organizationName", "accountName", "user"])
  })
})

// The exact main.tf an Azure customer copies / downloads. Fragment checks above can miss a stray,
// dropped or reordered line; this pins the whole file. This output passes
// `terraform init -backend=false && terraform validate` against terraform/azure.
const AZURE_FULL_MAIN_TF = `terraform {
  required_version = ">= 1.5"

  backend "azurerm" {
    subscription_id      = "00000000-0000-0000-0000-000000000001"
    tenant_id            = "00000000-0000-0000-0000-000000000002"
    resource_group_name  = "acme-tf-rg"
    storage_account_name = "acmetfstate"
    container_name       = "tfstate"
    key                  = "traceforce-lakehouse/terraform.tfstate"
    use_azuread_auth     = true
  }

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
    azuread = {
      source  = "hashicorp/azuread"
      version = "~> 3.0"
    }
    snowflake = {
      source  = "snowflakedb/snowflake"
      version = "~> 2.0"
    }
  }
}

provider "azurerm" {
  subscription_id = "00000000-0000-0000-0000-000000000001"
  tenant_id       = "00000000-0000-0000-0000-000000000002"
  features {}
}

provider "azuread" {
  tenant_id = "00000000-0000-0000-0000-000000000002"
}

provider "snowflake" {
  organization_name = "acmeorg"
  account_name      = "acmeaccount"
  user              = "TF_DEPLOY_USER"
  authenticator     = "SNOWFLAKE_JWT" # key-pair auth; this module always uses it, not a choice

  # private_key is the one real secret here -- deliberately not set above like the rest:
  # reads from SNOWFLAKE_PRIVATE_KEY in the environment, never hardcoded in this file.

  preview_features_enabled = [
    "snowflake_external_table_resource",
    "snowflake_iceberg_table_resource",
    "snowflake_email_notification_integration_resource",
    "snowflake_alert_resource",
  ]
}

module "lakehouse" {
  source = "github.com/traceforce/traceforce-lakehouse//terraform/azure?ref=1.3.0"

  iceberg_storage_account_name = "acmelogslakehouse"

  logs_storage_account_name = "acmelogs"
  logs_resource_group_name  = "acme-logs-rg"
  logs_container_name       = "logs"
  logs_prefix               = "traceforce"

  # reader_users = ["JDOE"]  # uncomment to grant existing Snowflake users read-only access; otherwise GRANT the reader_role_name output by hand
  # warehouse_size = "SMALL"  # uncomment if ad-hoc queries feel slow (default XSMALL)
}

output "azure_consent_url" { value = module.lakehouse.azure_consent_url }
output "reader_role_name" { value = module.lakehouse.reader_role_name }
`

describe("buildLakehouseSnippetAzure full output", () => {
  it("matches the expected main.tf exactly (remote state on, prefix set)", () => {
    const out = buildLakehouseSnippetAzure(
      { account: "acmelogs", container: "logs", tenantId: "00000000-0000-0000-0000-000000000002", keyPrefix: "traceforce" },
      {
        subscriptionId: "00000000-0000-0000-0000-000000000001",
        resourceGroup: "acme-logs-rg",
        organizationName: "acmeorg",
        accountName: "acmeaccount",
        user: "TF_DEPLOY_USER",
        remoteState: true,
        stateResourceGroup: "acme-tf-rg",
        stateStorageAccount: "acmetfstate",
        stateContainer: "tfstate",
      },
    )
    expect(out).toBe(AZURE_FULL_MAIN_TF)
  })

  it("with remote state off, differs only by dropping the backend block", () => {
    const out = buildLakehouseSnippetAzure(
      { account: "acmelogs", container: "logs", tenantId: "00000000-0000-0000-0000-000000000002", keyPrefix: "traceforce" },
      {
        subscriptionId: "00000000-0000-0000-0000-000000000001",
        resourceGroup: "acme-logs-rg",
        organizationName: "acmeorg",
        accountName: "acmeaccount",
        user: "TF_DEPLOY_USER",
        remoteState: false,
      },
    )
    const backendBlock = AZURE_FULL_MAIN_TF.slice(
      AZURE_FULL_MAIN_TF.indexOf('\n  backend "azurerm" {'),
      AZURE_FULL_MAIN_TF.indexOf("\n  required_providers {"),
    )
    expect(out).toBe(AZURE_FULL_MAIN_TF.replace(backendBlock, ""))
  })
})

describe("Lakehouse tile gating", () => {
  const record = (provider: number, status: number, config: Record<string, string | undefined>) => ({
    provider,
    status,
    config,
  })
  const connected = 2

  it("needs storage when there is no storage record at all", () => {
    expect(lakehouseTileState(null)).toBe("needs-storage")
    expect(lakehouseTileState(undefined)).toBe("needs-storage")
  })

  it("maps provider ids to the right cloud", () => {
    expect(cloudForProvider(1)).toBe("gcp")
    expect(cloudForProvider(2)).toBe("aws")
    expect(cloudForProvider(3)).toBe("azure")
  })

  it("is unsupported for a provider id outside 1/2/3", () => {
    for (const provider of [0, 4, 99]) {
      expect(lakehouseTileState(record(provider, connected, {}))).toBe("unsupported")
    }
  })

  const cases: {
    label: string
    provider: number
    ready: Record<string, string>
    incomplete: Record<string, string>[]
  }[] = [
    {
      label: "S3 (provider 2): needs bucket + region",
      provider: 2,
      ready: { bucket: "my-logs", region: "us-east-1" },
      incomplete: [
        { region: "us-east-1" },
        { bucket: "my-logs" },
        {},
        // A legacy/API-created record can have a technically-present but blank field --
        // plain truthiness (!!"   ") would wrongly read this as ready.
        { bucket: "   ", region: "us-east-1" },
        { bucket: "my-logs", region: "   " },
      ],
    },
    {
      label: "GCS (provider 1): needs only bucket, no region",
      provider: 1,
      ready: { bucket: "my-logs" },
      incomplete: [{}, { bucket: "   " }],
    },
    {
      label: "Azure (provider 3): needs account + container + tenant_id",
      provider: 3,
      ready: {
        account: "acmelogs",
        container: "logs",
        tenant_id: "00000000-0000-0000-0000-000000000000",
      },
      incomplete: [
        { container: "logs", tenant_id: "00000000-0000-0000-0000-000000000000" },
        { account: "acmelogs", tenant_id: "00000000-0000-0000-0000-000000000000" },
        { account: "acmelogs", container: "logs" },
        { account: "", container: "logs", tenant_id: "00000000-0000-0000-0000-000000000000" },
        { account: "acmelogs", container: "", tenant_id: "00000000-0000-0000-0000-000000000000" },
        { account: "acmelogs", container: "logs", tenant_id: "" },
        {},
        // Same whitespace-only regression as S3/GCS above, for each of Azure's three fields.
        { account: "   ", container: "logs", tenant_id: "00000000-0000-0000-0000-000000000000" },
        { account: "acmelogs", container: "   ", tenant_id: "00000000-0000-0000-0000-000000000000" },
        { account: "acmelogs", container: "logs", tenant_id: "   " },
      ],
    },
  ]

  for (const { label, provider, ready, incomplete } of cases) {
    describe(label, () => {
      it("is ready when connected with every required field", () => {
        expect(lakehouseTileState(record(provider, connected, ready))).toBe("ready")
      })

      for (const config of incomplete) {
        it(`needs storage when the config is ${JSON.stringify(config)}`, () => {
          expect(lakehouseTileState(record(provider, connected, config))).toBe("needs-storage")
        })
      }

      it("needs storage unless the provider is connected, even with a complete config", () => {
        for (const status of [1, 3, 4]) {
          // 1 = pending, 3 = disconnected, anything else = not connected
          expect(lakehouseTileState(record(provider, status, ready))).toBe("needs-storage")
        }
      })
    })
  }

  it("Azure: key_prefix is optional alongside the required account + container + tenant_id", () => {
    expect(
      lakehouseTileState(
        record(3, connected, {
          account: "acmelogs",
          container: "logs",
          key_prefix: "traceforce",
          tenant_id: "00000000-0000-0000-0000-000000000000",
        }),
      ),
    ).toBe("ready")
  })

  it("Azure needs storage when tenant_id is missing, even with account + container present", () => {
    expect(
      lakehouseTileState(record(3, connected, { account: "acmelogs", container: "logs" })),
    ).toBe("needs-storage")
  })

  it("Azure does not accept S3/GCS config keys as an Azure config", () => {
    expect(lakehouseTileState(record(3, connected, { bucket: "my-logs", region: "us-east-1" }))).toBe(
      "needs-storage",
    )
  })
})

describe("buildSnowflakeEnvExports", () => {
  it("renders organization/account interpolated, and a reader-user placeholder, not the deploy user", () => {
    const out = buildSnowflakeEnvExports("acmeorg", "acmeaccount")
    expect(out).toContain("export SNOWFLAKE_ORGANIZATION_NAME='acmeorg'")
    expect(out).toContain("export SNOWFLAKE_ACCOUNT_NAME='acmeaccount'")
    // Deliberately NOT the Step 1 deploy user -- see the function's own doc comment for why
    // reusing that user's key here would be unsafe.
    expect(out).toContain('export SNOWFLAKE_USER="YOUR_READER_USER"')
    expect(out).toContain('export SNOWFLAKE_AUTHENTICATOR="SNOWFLAKE_JWT"')
    expect(out).toContain('export SNOWFLAKE_PRIVATE_KEY="$(cat /path/to/your/key.p8)"')
  })

  it("shell-escapes a command-substitution payload instead of letting it execute", () => {
    // The exact payload used to confirm the vulnerability live: bash -c with the OLD
    // (unescaped) interpolation actually ran `echo INJECTED` and produced "acmeINJECTED".
    const payload = "acme$(echo INJECTED)"
    const out = buildSnowflakeEnvExports(payload, "acmeaccount")
    expect(out).toContain("export SNOWFLAKE_ORGANIZATION_NAME='acme$(echo INJECTED)'")
    // single-quoted -- bash never treats $(...) as substitution inside single quotes
    expect(out).not.toContain('"acme$(echo INJECTED)"')
  })

  it("shell-escapes an embedded single quote using the close/escape/reopen idiom", () => {
    const out = buildSnowflakeEnvExports("acme'org", "acmeaccount")
    expect(out).toContain("export SNOWFLAKE_ORGANIZATION_NAME='acme'\\''org'")
  })
})
