import { bedrockApi } from "@/lib/bedrockMockApi";
// Shapes match the JSON emitted by bedrock-exploration/inventory/agentcore_inventory.py --json

// How an MCP reference relates to a gateway: "routed" means the call goes
// through the gateway, "sharedEndpoint" means it reaches the same downstream
// server directly and bypasses it. The collector only records the latter within
// a project, so it always denotes a real bypass rather than a coincidence.
export type GatewayRelation = "routed" | "sharedEndpoint";

export interface McpGatewayRef {
  gatewayId?: string;
  // Written by the collector Lambda; identifies the gateway across accounts.
  gatewayArn?: string;
  name?: string;
  gatewayUrl?: string;
  project?: string;
  relation?: GatewayRelation;
}

export interface McpRef {
  reference: string;
  url: string;
  kind?: string;
  gateway?: McpGatewayRef;
}

export interface RuntimeEndpoint {
  name?: string;
  id?: string;
  status?: string;
  liveVersion?: string;
  lastUpdatedAt?: string;
}

export interface AgentRuntime {
  agentRuntimeArn?: string;
  agentRuntimeId?: string;
  agentRuntimeName?: string;
  agentRuntimeVersion?: string;
  description?: string;
  lastUpdatedAt?: string;
  status?: string;
  endpoints?: RuntimeEndpoint[];
  mcpRefs?: McpRef[];
  project?: string;
  /** AGENT_DEPLOYMENT_TYPE_* — set by the server (see utils/cloud/agentcore-mapper.ts). */
  deploymentType?: number;
}

export interface Harness {
  harnessName?: string;
  name?: string;
  harnessId?: string;
  harnessVersion?: string;
  arn?: string;
  status?: string;
  agentRuntimeArn?: string;
  mcpRefs?: McpRef[];
  mcpUrls?: string[];
  project?: string;
}

export interface GatewayTargetTool {
  name?: string;
  description?: string;
}

export interface GatewayTarget {
  name?: string;
  targetId?: string;
  status?: string;
  description?: string;
  targetType?: string;
  mcpEndpoint?: string | null;
  /** Lambda behind the target, when it is backed by a function rather than a URL. */
  lambdaArn?: string;
  /** How the gateway authenticates to the target, e.g. GATEWAY_IAM_ROLE. */
  credentialProviderType?: string;
  /** Tools the target exposes, from an inline tool schema. */
  tools?: GatewayTargetTool[];
  lastSynchronizedAt?: string;
}

/** A Lambda AgentCore runs on traffic through a gateway — the control point. */
export interface GatewayInterceptor {
  lambdaArn?: string;
  interceptionPoints?: string[];
  passRequestHeaders?: boolean;
}

export interface Gateway {
  name?: string;
  gatewayId?: string;
  gatewayArn?: string;
  gatewayUrl?: string;
  authorizerType?: string;
  protocolType?: string;
  description?: string;
  status?: string;
  project?: string;
  targets?: GatewayTarget[];
  /** Lambdas that see traffic through this gateway, with the points they run at. */
  interceptors?: GatewayInterceptor[];
  /** ENFORCE actually blocks tool calls; LOG_ONLY only records what it would block. */
  policyEngineMode?: string;
  policyEngineArn?: string;
  responseStreaming?: boolean;
  supportedVersions?: string[];
  exceptionLevel?: string;
  roleArn?: string;
}

export interface WorkloadIdentity {
  name?: string;
  workloadIdentityArn?: string;
}

export interface RegionInventory {
  account?: string;
  region: string;
  runtimes: AgentRuntime[];
  harnesses: Harness[];
  gateways: Gateway[];
  memories: unknown[];
  oauth2CredentialProviders: { name?: string }[];
  apiKeyCredentialProviders: { name?: string }[];
  workloadIdentities: WorkloadIdentity[];
}

export interface Inventory {
  // Single-account inventories use `account`; multi-account inventories put
  // the account on each region and list all account IDs in `accounts`.
  account?: string;
  accounts?: string[];
  regions: RegionInventory[];
  // When the least recently synced account was last synced from AWS (ISO).
  syncedAt?: string;
}

export interface FlatAgentRuntime extends AgentRuntime {
  account: string;
  region: string;
}

export const BEDROCK_LOGO_URL = "/logos/aws_bedrock.png";

export const BEDROCK_ENVIRONMENT_LABEL = "AWS Bedrock";

// Sentinel for the Environment filter, alongside the "host" one. Runtimes have
// no sandbox runtime type, so they can't be selected through that enum.
export const BEDROCK_ENVIRONMENT_VALUE = "aws_bedrock";

export const BEDROCK_ENVIRONMENT_OPTION = {
  value: BEDROCK_ENVIRONMENT_VALUE,
  label: BEDROCK_ENVIRONMENT_LABEL,
};

export const bedrockScopeKey = (account: string, region: string) =>
  `${account}:${region}`;

type FilterOption = { id: string; name: string };

/**
 * Options for the AI Agents "AWS account" and "Region" filters. Regions are
 * limited to the selected accounts (all accounts when none is selected), so the
 * Region list never offers a region the chosen account has no agents in.
 */
export function bedrockFilterOptions(
  rows: { bedrock_account?: string; bedrock_region?: string }[],
  selectedAccounts: string[],
): { accounts: FilterOption[]; regions: FilterOption[] } {
  const accounts = new Set<string>();
  const regions = new Set<string>();
  for (const r of rows) {
    if (!r.bedrock_account || !r.bedrock_region) continue;
    accounts.add(r.bedrock_account);
    if (selectedAccounts.length === 0 || selectedAccounts.includes(r.bedrock_account)) regions.add(r.bedrock_region);
  }
  const toOptions = (s: Set<string>) => Array.from(s).sort().map((v) => ({ id: v, name: v }));
  return { accounts: toOptions(accounts), regions: toOptions(regions) };
}

export const formatBedrockScope = (account: string, region: string) =>
  `${account}/${region}`;

// PLAN_MAP entry for "Unspecified" — AgentCore has no licensing plan concept.
const PLAN_UNSPECIFIED = 0;

// AGENT_DEPLOYMENT_TYPE_MAP entry for "Cloud" (AGENT_DEPLOYMENT_TYPE_CLOUD in
// scout.proto). Only a fallback: the server sets `deploymentType` on each
// runtime.
const DEPLOYMENT_TYPE_CLOUD = 7;

export const normalizeUrl = (url?: string | null) => (url ?? "").replace(/\/+$/, "");

export const isHarnessOwned = (runtime: AgentRuntime) =>
  (runtime.agentRuntimeName ?? "").startsWith("harness_");

export const harnessName = (h: Harness) => h.harnessName ?? h.name ?? "-";

export const bedrockRuntimePath = (account: string, region: string, runtimeId?: string) =>
  `/bedrock-inventory/${encodeURIComponent(account)}/${encodeURIComponent(region)}/${encodeURIComponent(runtimeId ?? "")}`;

const EMPTY_INVENTORY: Inventory = { regions: [] };

/**
 * Load the AgentCore inventory of the active org.
 *
 * The one place every page loads inventory through. The backend reads it from
 * the database (cloud_agents / cloud_gateways), which the collector refreshes
 * from AWS every hour, so the call is cheap and needs no client cache. An org
 * with no AWS account connected gets an empty inventory back.
 *
 * For now this goes through bedrockApi, which is mock data (bedrockMockApi.ts):
 * the UI ships before the backend.
 */
export async function fetchInventory(accessToken?: string): Promise<Inventory> {
  if (!accessToken) return EMPTY_INVENTORY;

  const { data, error } = await bedrockApi.getBedrockInventory(accessToken);
  if (error) throw new Error(error);

  return data as Inventory;
}

/**
 * When the inventory was last synced from AWS, in ms, or null when unknown (no
 * account connected yet). Never an invalid time: formatting one throws.
 */
export function syncedAtMs(inventory: Inventory): number | null {
  const ms = inventory.syncedAt ? Date.parse(inventory.syncedAt) : NaN;
  return Number.isFinite(ms) ? ms : null;
}

export const flattenRuntimes = (inventory: Inventory): FlatAgentRuntime[] =>
  inventory.regions.flatMap((r) =>
    r.runtimes.map((rt) => ({
      account: r.account ?? inventory.account ?? "",
      region: r.region,
      ...rt,
    })),
  );

export function findRuntime(
  inventory: Inventory,
  account: string | undefined,
  region: string,
  runtimeId: string,
) {
  const regionInventory = inventory.regions.find(
    (r) =>
      r.region === region &&
      (!account || (r.account ?? inventory.account) === account),
  );
  const runtime = regionInventory?.runtimes.find((rt) => rt.agentRuntimeId === runtimeId);
  return regionInventory && runtime ? { regionInventory, runtime } : null;
}

export const workloadIdentityForRuntime = (
  regionInventory: RegionInventory,
  runtime: AgentRuntime,
) =>
  regionInventory.workloadIdentities.find(
    (identity) => identity.name === runtime.agentRuntimeId,
  );

export const workloadIdentityForGateway = (
  regionInventory: RegionInventory,
  gateway: Gateway,
) =>
  regionInventory.workloadIdentities.find(
    (identity) => identity.name === gateway.gatewayId,
  );

// A harness deploys exactly one runtime. Newer inventories record the link as an
// ARN; older ones only expose the naming convention AgentCore uses when it
// creates the runtime, which is `harness_<harnessName>`.
export function harnessesForRuntime(
  regionInventory: RegionInventory,
  runtime: AgentRuntime,
): Harness[] {
  return regionInventory.harnesses.filter((h) =>
    h.agentRuntimeArn && runtime.agentRuntimeArn
      ? h.agentRuntimeArn === runtime.agentRuntimeArn
      : runtime.agentRuntimeName === `harness_${harnessName(h)}`,
  );
}

export interface McpLink {
  reference: string;
  url: string;
  // "runtime" when the runtime itself declares the MCP URL, otherwise the name
  // of the harness that contributes it.
  via: string;
  gateway?: Gateway;
  relation?: GatewayRelation;
}

// Older inventories recorded a harness's MCPs as bare URLs, before the
// collector resolved them into annotated references.
const harnessMcpRefs = (harness: Harness): McpRef[] =>
  harness.mcpRefs ?? (harness.mcpUrls ?? []).map((url) => ({ reference: url, url }));

// Resolution follows agentcore_inventory.py. The collector already decided which
// gateway a reference involves and how, so trust its annotation and use it to
// pull the full gateway record (the annotation carries no targets). URL matching
// remains for inventories collected before annotations existed, and only ever
// finds the routed case.
export function mcpLinksForRuntime(
  regionInventory: RegionInventory,
  runtime: AgentRuntime,
): McpLink[] {
  const byUrl = new Map<string, Gateway>();
  const byId = new Map<string, Gateway>();
  for (const gateway of regionInventory.gateways) {
    const url = normalizeUrl(gateway.gatewayUrl);
    if (url) byUrl.set(url, gateway);
    if (gateway.gatewayId) byId.set(gateway.gatewayId, gateway);
  }

  const resolve = (ref: McpRef): Pick<McpLink, "gateway" | "relation"> => {
    if (ref.gateway) {
      const full = ref.gateway.gatewayId ? byId.get(ref.gateway.gatewayId) : undefined;
      return { gateway: full ?? ref.gateway, relation: ref.gateway.relation ?? "routed" };
    }
    const gateway = byUrl.get(normalizeUrl(ref.url));
    return gateway ? { gateway, relation: "routed" } : {};
  };

  const links: McpLink[] = (runtime.mcpRefs ?? []).map((ref) => ({
    reference: ref.reference,
    url: ref.url,
    via: "runtime",
    ...resolve(ref),
  }));

  for (const harness of harnessesForRuntime(regionInventory, runtime)) {
    for (const ref of harnessMcpRefs(harness)) {
      links.push({
        reference: ref.reference,
        url: ref.url,
        via: harnessName(harness),
        ...resolve(ref),
      });
    }
  }
  return links;
}

const mcpHostname = (url: string) => {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};

export interface ConnectedMcp {
  id: string;
  name: string;
  url: string;
  // The gateway involved, if any. Read it with gatewayRelation: "routed" means
  // the server is reached through this gateway, "sharedEndpoint" means the
  // gateway fronts the same server but is bypassed by this connection.
  gatewayName?: string;
  gatewayRelation?: GatewayRelation;
  // Set when the URL comes from a harness rather than the runtime itself.
  viaHarness?: string;
  // How the connector is reached behind the gateway: LAMBDA, MCP_SERVER, ...
  // Only set for gateway targets; a direct MCP URL has no AgentCore target.
  targetType?: string;
  // Tools the target declares inline. Lambda targets carry these; an MCP server
  // only lists its tools over the wire, so an empty list is not "no tools".
  tools?: GatewayTargetTool[];
}

// The MCP servers a runtime talks to, whether directly or behind a gateway.
export function connectedMcpsForRuntime(
  regionInventory: RegionInventory,
  runtime: AgentRuntime,
): ConnectedMcp[] {
  const seen = new Set<string>();
  const rows: ConnectedMcp[] = [];

  const push = (name: string, url: string, extra: Partial<ConnectedMcp>) => {
    const key = normalizeUrl(url);
    if (!key || seen.has(key)) return;
    seen.add(key);
    rows.push({ id: `${runtime.agentRuntimeId}:${key}`, name, url, ...extra });
  };

  for (const link of mcpLinksForRuntime(regionInventory, runtime)) {
    const viaHarness = link.via === "runtime" ? undefined : link.via;

    if (!link.gateway) {
      push(mcpHostname(link.url), link.url, { viaHarness });
      continue;
    }

    const gatewayName = link.gateway.name ?? link.gateway.gatewayId ?? "gateway";

    // A bypassing connection already points at the downstream server, so the
    // URL is the MCP server itself — expanding the gateway's targets would
    // describe a route this connection doesn't take.
    if (link.relation === "sharedEndpoint") {
      push(mcpHostname(link.url), link.url, {
        gatewayName,
        gatewayRelation: "sharedEndpoint",
        viaHarness,
      });
      continue;
    }

    // A target is reached either by URL or as a Lambda. Both are connectors the
    // agent can call through the gateway, and dropping the Lambda ones would
    // hide every tool-style target — which is most of them in practice.
    const targets = (link.gateway.targets ?? []).filter((t) => t.mcpEndpoint || t.lambdaArn);
    if (targets.length === 0) {
      push(gatewayName, link.url, { gatewayName, gatewayRelation: "routed", viaHarness });
      continue;
    }
    for (const target of targets) {
      const endpoint = (target.mcpEndpoint ?? target.lambdaArn)!;
      push(target.name ?? mcpHostname(endpoint), endpoint, {
        gatewayName,
        gatewayRelation: "routed",
        viaHarness,
        targetType: target.targetType,
        tools: target.tools,
      });
    }
  }
  return rows;
}

// Adapts a runtime to the row shape the agents table already reads. Everything
// AgentCore can't supply stays null so the table renders its usual N/A, and the
// columns it drops (status, region, harness ownership) are folded into the
// description line.
export function runtimeToAgentRow(runtime: FlatAgentRuntime) {
  const details = [
    isHarnessOwned(runtime) ? "AgentCore runtime (harness-owned)" : "AgentCore runtime",
    runtime.status,
  ].filter(Boolean);

  return {
    id: `bedrock:${runtime.account}:${runtime.region}:${runtime.agentRuntimeId}`,
    detail_path: bedrockRuntimePath(runtime.account, runtime.region, runtime.agentRuntimeId),
    agent_name: runtime.agentRuntimeName ?? runtime.agentRuntimeId ?? "Unnamed runtime",
    description: details.join(" · "),
    agent_type: null,
    plan: PLAN_UNSPECIFIED,
    base_score: null,
    actual_score: null,
    active_issues: null,
    active_users: null,
    deployment_types: [runtime.deploymentType ?? DEPLOYMENT_TYPE_CLOUD],
    sandbox_runtime_types: [],
    environment_labels: [
      BEDROCK_ENVIRONMENT_LABEL,
      formatBedrockScope(runtime.account, runtime.region),
    ],
    bedrock_account: runtime.account,
    bedrock_region: runtime.region,
    bedrock_scope_key: bedrockScopeKey(runtime.account, runtime.region),
    has_host_instances: false,
    // lastUpdatedAt is a config change, not activity; no activity time is collected yet.
    last_active_at: null,
    logo_url: BEDROCK_LOGO_URL,
  };
}
