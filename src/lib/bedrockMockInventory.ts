// Example AWS Bedrock AgentCore inventory for the UI-only build (no API calls).
// Same shape as GET /api/v1/bedrock-inventory. Built from a test account, with the
// account ID and every endpoint replaced by placeholders.
import type { Inventory } from "@/lib/bedrockInventory"

// Account 123456789012 ("Production"), from the test account.
const PRODUCTION: Inventory = {
  "account": "123456789012",
  "accounts": [
    "123456789012"
  ],
  "regions": [
    {
      "account": "123456789012",
      "region": "ap-south-1",
      "runtimes": [
        {
          "agentRuntimeArn": "arn:aws:bedrock-agentcore:ap-south-1:123456789012:runtime/ec2_hello_agent-Ex00000001",
          "agentRuntimeId": "ec2_hello_agent-Ex00000001",
          "agentRuntimeName": "ec2_hello_agent",
          "agentRuntimeVersion": "1",
          "lastUpdatedAt": "2026-09-24T11:34:29.623953568Z",
          "status": "READY",
          "endpoints": [
            {
              "id": "DEFAULT",
              "name": "DEFAULT",
              "status": "READY",
              "liveVersion": "1",
              "lastUpdatedAt": "2026-09-24T11:34:29.623957017Z"
            }
          ],
          "mcpRefs": [],
          "deploymentType": 7
        },
        {
          "agentRuntimeArn": "arn:aws:bedrock-agentcore:ap-south-1:123456789012:runtime/hello_agent-Ex00000002",
          "agentRuntimeId": "hello_agent-Ex00000002",
          "agentRuntimeName": "hello_agent",
          "agentRuntimeVersion": "1",
          "lastUpdatedAt": "2026-09-23T08:33:50.147943077Z",
          "status": "READY",
          "endpoints": [
            {
              "id": "DEFAULT",
              "name": "DEFAULT",
              "status": "READY",
              "liveVersion": "1",
              "lastUpdatedAt": "2026-09-23T08:33:50.147972833Z"
            }
          ],
          "mcpRefs": [],
          "deploymentType": 7
        },
        {
          "agentRuntimeArn": "arn:aws:bedrock-agentcore:ap-south-1:123456789012:runtime/new_Test-Ex00000003",
          "agentRuntimeId": "new_Test-Ex00000003",
          "agentRuntimeName": "new_Test",
          "agentRuntimeVersion": "1",
          "lastUpdatedAt": "2026-10-05T12:38:21.626505397Z",
          "status": "READY",
          "endpoints": [
            {
              "id": "DEFAULT",
              "name": "DEFAULT",
              "status": "READY",
              "liveVersion": "1",
              "lastUpdatedAt": "2026-10-05T12:38:21.626537281Z"
            }
          ],
          "mcpRefs": [],
          "deploymentType": 7
        },
        {
          "agentRuntimeArn": "arn:aws:bedrock-agentcore:ap-south-1:123456789012:runtime/test_ssh_runtime-Ex00000004",
          "agentRuntimeId": "test_ssh_runtime-Ex00000004",
          "agentRuntimeName": "test_ssh_runtime",
          "agentRuntimeVersion": "1",
          "lastUpdatedAt": "2026-09-26T08:11:10.198455945Z",
          "status": "READY",
          "endpoints": [
            {
              "id": "DEFAULT",
              "name": "DEFAULT",
              "status": "READY",
              "liveVersion": "1",
              "lastUpdatedAt": "2026-09-26T08:11:10.198460511Z"
            }
          ],
          "mcpRefs": [],
          "deploymentType": 7
        }
      ],
      "harnesses": [
        {
          "harnessName": "test_hello_harness",
          "name": "test_hello_harness",
          "harnessId": "test_hello_harness-Ex00000005",
          "harnessVersion": "3",
          "arn": "arn:aws:bedrock-agentcore:ap-south-1:123456789012:harness/test_hello_harness-Ex00000005",
          "status": "READY",
          "agentRuntimeArn": "arn:aws:bedrock-agentcore:ap-south-1:123456789012:runtime/harness_test_hello_harness-Ex00000006",
          "mcpRefs": [
            {
              "url": "",
              "kind": "gateway",
              "gateway": {
                "name": "test-gateway",
                "relation": "routed",
                "gatewayId": "test-gateway-Ex00000007",
                "gatewayArn": "arn:aws:bedrock-agentcore:ap-south-1:123456789012:gateway/test-gateway-Ex00000007",
                "gatewayUrl": "https://test-gateway-example001.gateway.bedrock-agentcore.ap-south-1.amazonaws.com/mcp"
              },
              "reference": "test-gateway-Ex00000007"
            },
            {
              "url": "",
              "kind": "gateway",
              "gateway": {
                "name": "test-GW-2",
                "relation": "routed",
                "gatewayId": "test-gw-2-Ex00000008",
                "gatewayArn": "arn:aws:bedrock-agentcore:ap-south-1:123456789012:gateway/test-gw-2-Ex00000008",
                "gatewayUrl": "https://test-gw-2-example002.gateway.bedrock-agentcore.ap-south-1.amazonaws.com/mcp"
              },
              "reference": "test-gw-2-Ex00000008"
            }
          ],
          "mcpUrls": []
        }
      ],
      "gateways": [
        {
          "name": "test-gateway",
          "gatewayId": "test-gateway-Ex00000007",
          "gatewayArn": "arn:aws:bedrock-agentcore:ap-south-1:123456789012:gateway/test-gateway-Ex00000007",
          "gatewayUrl": "https://test-gateway-example001.gateway.bedrock-agentcore.ap-south-1.amazonaws.com/mcp",
          "authorizerType": "NONE",
          "protocolType": "MCP",
          "status": "READY",
          "targets": [
            {
              "name": "notes",
              "tools": [
                {
                  "name": "save_note",
                  "description": "Saves a note"
                }
              ],
              "status": "READY",
              "targetId": "EXTARGET01",
              "lambdaArn": "arn:aws:lambda:ap-south-1:123456789012:function:save_note",
              "targetType": "LAMBDA",
              "credentialProviderType": "GATEWAY_IAM_ROLE"
            },
            {
              "name": "stream",
              "status": "READY",
              "targetId": "EXTARGET02",
              "targetType": "MCP_SERVER",
              "mcpEndpoint": "https://example-function.lambda-url.ap-south-1.on.aws/",
              "lastSynchronizedAt": "2026-09-27T07:39:36.616310129Z",
              "credentialProviderType": "GATEWAY_IAM_ROLE"
            }
          ],
          "interceptors": [
            {
              "lambdaArn": "arn:aws:lambda:ap-south-1:123456789012:function:request_interceptor",
              "interceptionPoints": [
                "REQUEST"
              ],
              "passRequestHeaders": false
            },
            {
              "lambdaArn": "arn:aws:lambda:ap-south-1:123456789012:function:response_interceptor",
              "interceptionPoints": [
                "RESPONSE"
              ],
              "passRequestHeaders": false
            }
          ],
          "policyEngineMode": "LOG_ONLY",
          "policyEngineArn": "arn:aws:bedrock-agentcore:ap-south-1:123456789012:policy-engine/test_policy_engine-Ex00000009",
          "responseStreaming": true,
          "supportedVersions": [
            "2026-07-28",
            "2025-11-25"
          ],
          "roleArn": "arn:aws:iam::123456789012:role/service-role/AmazonBedrockAgentCoreGatewayDefaultServiceRoleExample"
        },
        {
          "name": "test-GW-2",
          "gatewayId": "test-gw-2-Ex00000008",
          "gatewayArn": "arn:aws:bedrock-agentcore:ap-south-1:123456789012:gateway/test-gw-2-Ex00000008",
          "gatewayUrl": "https://test-gw-2-example002.gateway.bedrock-agentcore.ap-south-1.amazonaws.com/mcp",
          "authorizerType": "NONE",
          "protocolType": "MCP",
          "status": "READY",
          "targets": [],
          "interceptors": [
            {
              "lambdaArn": "arn:aws:lambda:ap-south-1:123456789012:function:request_interceptor",
              "interceptionPoints": [
                "REQUEST"
              ],
              "passRequestHeaders": false
            },
            {
              "lambdaArn": "arn:aws:lambda:ap-south-1:123456789012:function:response_interceptor",
              "interceptionPoints": [
                "RESPONSE"
              ],
              "passRequestHeaders": false
            }
          ],
          "responseStreaming": false,
          "supportedVersions": [
            "2025-11-25",
            "2026-07-28"
          ],
          "exceptionLevel": "DEBUG",
          "roleArn": "arn:aws:iam::123456789012:role/service-role/AmazonBedrockAgentCoreGatewayDefaultServiceRoleExample"
        }
      ],
      "memories": [],
      "oauth2CredentialProviders": [],
      "apiKeyCredentialProviders": [],
      "workloadIdentities": []
    }
  ]
}

// Account 210987654321 ("Staging"): invented example data in two Regions, so
// the AWS account and Region filters have something to narrow down.
const STAGING = "210987654321"
const runtime = (region: string, name: string, id: string, status = "READY") => ({
  agentRuntimeArn: "arn:aws:bedrock-agentcore:" + region + ":" + STAGING + ":runtime/" + name + "-" + id,
  agentRuntimeId: name + "-" + id,
  agentRuntimeName: name,
  agentRuntimeVersion: "3",
  lastUpdatedAt: "2026-10-02T11:20:00Z",
  status,
  endpoints: [{ id: "DEFAULT", name: "DEFAULT", status, liveVersion: "3", lastUpdatedAt: "2026-10-02T11:20:00Z" }],
  mcpRefs: [],
  deploymentType: 7,
})
const emptyLists = { memories: [], oauth2CredentialProviders: [], apiKeyCredentialProviders: [], workloadIdentities: [] }

const STAGING_REGIONS: Inventory["regions"] = [
  {
    account: STAGING,
    region: "us-east-1",
    runtimes: [
      runtime("us-east-1", "support_bot", "Qx81LmTa2c"),
      runtime("us-east-1", "invoice_agent", "Hb27PwKe9d"),
      runtime("us-east-1", "pricing_assistant", "Rt55NvYc4e", "UPDATING"),
    ],
    harnesses: [],
    gateways: [
      {
        name: "staging-tools",
        gatewayId: "staging-tools-example003",
        gatewayArn: "arn:aws:bedrock-agentcore:us-east-1:" + STAGING + ":gateway/staging-tools-example003",
        gatewayUrl: "https://staging-tools-example003.gateway.bedrock-agentcore.us-east-1.amazonaws.com/mcp",
        authorizerType: "CUSTOM_JWT",
        protocolType: "MCP",
        status: "READY",
        targets: [{ targetId: "STG0001", name: "crm-lookup", status: "READY", targetType: "lambda" }],
        interceptors: [],
        supportedVersions: ["2025-11-25"],
      },
    ],
    ...emptyLists,
  },
  {
    account: STAGING,
    region: "eu-west-1",
    runtimes: [runtime("eu-west-1", "eu_support_bot", "Kd93SjWb1f")],
    harnesses: [],
    gateways: [],
    ...emptyLists,
  },
]

export const MOCK_BEDROCK_INVENTORY: Inventory = {
  account: PRODUCTION.account,
  accounts: [...(PRODUCTION.accounts ?? []), STAGING],
  regions: [...PRODUCTION.regions, ...STAGING_REGIONS],
}
