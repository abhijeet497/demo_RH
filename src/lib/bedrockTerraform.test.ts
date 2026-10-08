import { describe, expect, it } from "bun:test"
import {
  BEDROCK_ROLE_NAME,
  REGIONS_TAG,
  TRUSTED_ROLE_ARN,
  accountIdFromRoleArn,
  buildBedrockTerraform,
} from "./bedrockTerraform"

const tf = buildBedrockTerraform()

describe("buildBedrockTerraform", () => {
  it("is static: the same text on every call", () => {
    expect(buildBedrockTerraform()).toBe(tf)
  })

  it("bakes in no customer values — they arrive as variables", () => {
    for (const v of ["account_id", "regions", "trusted_role_arn"]) {
      expect(tf).toContain(`variable "${v}"`)
    }
    expect(tf).not.toMatch(/\d{12}"\]/) // no hardcoded account in allowed_account_ids
  })

  it("pins the provider to the account and the first region from variables", () => {
    expect(tf).toContain("allowed_account_ids = [var.account_id]")
    expect(tf).toContain("region              = var.regions[0]")
  })

  it("defaults the trusted role to this environment's Traceforce role", () => {
    expect(tf).toContain(`default     = "${TRUSTED_ROLE_ARN}"`)
    expect(tf).toContain("Principal = { AWS = var.trusted_role_arn }")
  })

  it("tags the role with the regions, space-separated, for the server to read back", () => {
    expect(tf).toContain(`"${REGIONS_TAG}" = join(" ", var.regions)`)
  })

  it("lets the role read only its own tags", () => {
    expect(tf).toContain('Action   = "iam:GetRole"')
    expect(tf).toContain("Resource = aws_iam_role.traceforce_bedrock.arn")
  })

  it("creates the expected role name", () => {
    expect(tf).toContain(`name = "${BEDROCK_ROLE_NAME}"`)
  })

  it("fences inventory reads to the listed regions", () => {
    expect(tf).toContain('Condition = { StringEquals = { "aws:RequestedRegion" = var.regions } }')
  })

  it("keeps permissions read-only and grants no model invocation", () => {
    const actions = [...tf.matchAll(/"((?:bedrock|bedrock-agentcore|iam):[A-Za-z*]+)"/g)].map((m) => m[1])
    expect(actions.length).toBeGreaterThan(0)
    for (const a of actions) expect(a).toMatch(/:(List\*|Get\*|GetRole)$/)
    expect(tf).not.toContain("InvokeModel")
  })

  it("does not emit a gateway or interceptor", () => {
    expect(tf).not.toContain("aws_bedrockagentcore_gateway")
    expect(tf).not.toContain("interceptor")
  })

  it("outputs role_arn, which is what the customer pastes back", () => {
    expect(tf).toContain('output "role_arn"')
  })

  describe("HCL escaping of the trusted role default", () => {
    it("escapes a double quote so a value cannot break out of its string", () => {
      expect(buildBedrockTerraform('a"b')).toContain('default     = "a\\"b"')
    })

    it("neutralises Terraform interpolation so it is not evaluated", () => {
      expect(buildBedrockTerraform("${evil}")).toContain('default     = "$${evil}"')
    })
  })
})

describe("accountIdFromRoleArn", () => {
  it("extracts the account id from a well-formed role ARN", () => {
    expect(accountIdFromRoleArn("arn:aws:iam::123456789012:role/BedrockInventoryRole")).toBe("123456789012")
  })

  it("tolerates surrounding whitespace", () => {
    expect(accountIdFromRoleArn("  arn:aws:iam::123456789012:role/X  ")).toBe("123456789012")
  })

  it("rejects anything that is not a role ARN", () => {
    for (const bad of [
      "",
      "not-an-arn",
      "arn:aws:iam::123:role/TooShortAccount",
      "arn:aws:iam::123456789012:user/NotARole",
      "arn:aws:s3:::bucket",
    ]) expect(accountIdFromRoleArn(bad)).toBeNull()
  })
})
