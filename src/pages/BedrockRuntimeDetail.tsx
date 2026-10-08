import { useAuth } from "@/contexts/AuthContext"
import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ChevronDown, ChevronRight, Download, Info, Network, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { BedrockStatusBadge } from "@/components/BedrockStatusBadge";
import { downloadCsv, csvTimestamp } from "@/lib/csvUtils";
import {
  detectMcpServerType,
  fetchMcpDetectionCatalog,
  fetchOrgMcpRollup,
  type McpDetectionEntry,
  type McpOrgRollup,
} from "@/lib/mcpDetection";
import {
  DISTRIBUTION_CHANNEL_MAP,
  getDistributionChannelBadge,
  getRiskLevel,
  getScoreBadgeWithDiff,
} from "@/lib/appUtils";
import { useOrg } from "@/contexts/OrgContext";
import {
  BEDROCK_LOGO_URL,
  connectedMcpsForRuntime,
  fetchInventory,
  findRuntime,
  harnessesForRuntime,
  harnessName,
  isHarnessOwned,
  mcpLinksForRuntime,
  workloadIdentityForGateway,
  workloadIdentityForRuntime,
  type AgentRuntime,
  type ConnectedMcp,
  type Gateway,
  type GatewayTarget,
  type Harness,
  type Inventory,
  type McpLink,
  type RegionInventory,
  type WorkloadIdentity,
} from "@/lib/bedrockInventory";

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1">
    <p className="text-sm text-muted-foreground">{label}</p>
    <div className="text-sm font-medium break-all">{children}</div>
  </div>
);

const WorkloadIdentityValue = ({ identity }: { identity?: WorkloadIdentity }) =>
  identity ? (
    <div className="space-y-0.5">
      <div className="text-sm">{identity.name ?? "-"}</div>
      <div className="font-mono text-xs text-muted-foreground break-all">
        {identity.workloadIdentityArn ?? "-"}
      </div>
    </div>
  ) : (
    <span className="text-sm text-muted-foreground">None</span>
  );

const ViaBadge = ({ via }: { via: string }) => (
  <Badge variant="outline" className="font-normal">
    {via === "runtime" ? "declared by runtime" : `via harness ${via}`}
  </Badge>
);

const routeLabel = (mcp: ConnectedMcp) => {
  if (!mcp.gatewayName) return "Direct connection";
  return mcp.gatewayRelation === "sharedEndpoint"
    ? `Direct connection — bypasses gateway ${mcp.gatewayName}`
    : `Via gateway ${mcp.gatewayName}`;
};

const OverviewCard = ({
  runtime,
  region,
  identity,
}: {
  runtime: AgentRuntime;
  region: string;
  identity?: WorkloadIdentity;
}) => (
  <Card>
    <CardHeader>
      <CardTitle>Runtime</CardTitle>
    </CardHeader>
    <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Field label="Status">
        <BedrockStatusBadge status={runtime.status} />
      </Field>
      <Field label="Runtime ID">
        <span className="font-mono text-xs">{runtime.agentRuntimeId ?? "-"}</span>
      </Field>
      <Field label="Region">{region}</Field>
      <Field label="Version">{runtime.agentRuntimeVersion ?? "-"}</Field>
      <Field label="Harness-owned">{isHarnessOwned(runtime) ? "yes" : "no"}</Field>
      <Field label="Last updated">{runtime.lastUpdatedAt ?? "-"}</Field>
      <Field label="Endpoints">
        {runtime.endpoints?.length ? (
          <div className="flex flex-wrap gap-1">
            {runtime.endpoints.map((endpoint, i) => (
              <Badge key={endpoint.name ?? i} variant="secondary">
                {endpoint.name ?? "-"}
                {endpoint.status ? ` · ${endpoint.status}` : ""}
              </Badge>
            ))}
          </div>
        ) : (
          <span className="text-muted-foreground">None</span>
        )}
      </Field>
      <div className="sm:col-span-2 lg:col-span-3">
        <Field label="ARN">
          <span className="font-mono text-xs">{runtime.agentRuntimeArn ?? "-"}</span>
        </Field>
      </div>
      <div className="sm:col-span-2 lg:col-span-3">
        <Field label="Workload identity">
          <WorkloadIdentityValue identity={identity} />
        </Field>
      </div>
      {runtime.description && (
        <div className="sm:col-span-2 lg:col-span-3">
          <Field label="Description">{runtime.description}</Field>
        </div>
      )}
    </CardContent>
  </Card>
);

const HarnessesCard = ({ harnesses }: { harnesses: Harness[] }) => (
  <Card>
    <CardHeader>
      <div className="flex items-center gap-2">
        <Wrench className="h-5 w-5 text-primary" />
        <CardTitle>Harnesses</CardTitle>
      </div>
      <CardDescription>
        Harnesses that deploy and manage this runtime.
      </CardDescription>
    </CardHeader>
    <CardContent>
      {harnesses.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          This runtime is not deployed by a harness.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>ID</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>Connector tools</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {harnesses.map((h) => (
              <TableRow key={h.harnessId ?? harnessName(h)}>
                <TableCell className="font-medium">{harnessName(h)}</TableCell>
                <TableCell className="font-mono text-xs">{h.harnessId ?? "-"}</TableCell>
                <TableCell>
                  <BedrockStatusBadge status={h.status} />
                </TableCell>
                <TableCell>{h.harnessVersion ?? "-"}</TableCell>
                <TableCell>{(h.mcpRefs ?? h.mcpUrls)?.length ?? 0}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </CardContent>
  </Card>
);

/**
 * What sits behind each gateway target.
 *
 * A target is either an MCP server reached by URL or a Lambda that declares its
 * tools inline — AgentCore returns one arm or the other, never both, so a dash
 * in a column means "not this kind of target", not missing data. These fields
 * only exist because the collector calls GetGatewayTarget; the list API returns
 * name and status alone.
 */
/**
 * How a gateway is controlled, as opposed to what it connects to.
 *
 * Inbound auth, the policy engine and the interceptors are the three things
 * that decide whether a tool call is allowed through, so they are shown
 * together and always shown — "no interceptors" and "LOG_ONLY" are findings in
 * their own right, and hiding them when unset would make an uncontrolled
 * gateway look the same as one nobody has inspected.
 */
const GatewayControls = ({ gateway }: { gateway: Gateway }) => {
  const enforcing = gateway.policyEngineMode === "ENFORCE"
  return (
    <div className="rounded-md bg-muted/40 p-4 space-y-4">
      {/* Label above value, so each control reads as its own fact rather than
          running together into one line of badges. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Inbound auth</p>
          <Badge variant={gateway.authorizerType === "NONE" ? "destructive" : "outline"}>
            {gateway.authorizerType ?? "unknown"}
          </Badge>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Policy engine</p>
          {gateway.policyEngineMode ? (
            <Badge variant={enforcing ? "default" : "secondary"}>{gateway.policyEngineMode}</Badge>
          ) : (
            <Badge variant="outline">Not configured</Badge>
          )}
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Response streaming</p>
          <p className="text-sm">
            {gateway.responseStreaming === undefined
              ? "Unknown"
              : gateway.responseStreaming
                ? "On"
                : "Off"}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">MCP versions</p>
          <p className="text-sm">
            {gateway.supportedVersions?.length ? gateway.supportedVersions.join(", ") : "-"}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Interceptors ({gateway.interceptors?.length ?? 0})
          {gateway.exceptionLevel ? ` · exception level ${gateway.exceptionLevel}` : ""}
        </p>
        {gateway.interceptors?.length ? (
          <div className="space-y-2">
            {gateway.interceptors.map((ic, i) => (
              <div
                key={ic.lambdaArn ?? i}
                className="flex flex-wrap items-center gap-2 rounded border bg-background px-3 py-2"
              >
                {(ic.interceptionPoints ?? []).map((p) => (
                  <Badge key={p} variant="outline" className="shrink-0">
                    {p}
                  </Badge>
                ))}
                <span className="font-mono text-xs break-all">{ic.lambdaArn ?? "-"}</span>
                {ic.passRequestHeaders === false && (
                  <span className="text-xs text-muted-foreground">headers not passed</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            None — nothing inspects traffic through this gateway.
          </p>
        )}
      </div>
    </div>
  )
}

/** A gateway rendered as one collapsible block: summary on the row, detail inside. */
const GatewayBlock = ({
  gateway,
  regionInventory,
  badges,
  reference,
  defaultOpen = false,
}: {
  gateway: Gateway
  regionInventory: RegionInventory
  badges?: React.ReactNode
  reference?: string
  defaultOpen?: boolean
}) => {
  const [open, setOpen] = useState(defaultOpen)
  const targetCount = gateway.targets?.length ?? 0
  const toolCount = (gateway.targets ?? []).reduce((n, t) => n + (t.tools?.length ?? 0), 0)

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border">
      <CollapsibleTrigger className="flex w-full flex-wrap items-center gap-2 p-4 text-left hover:bg-accent/40">
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <Badge variant="secondary" className="gap-1">
          <Network className="h-3 w-3" />
          {gateway.name ?? gateway.gatewayId}
        </Badge>
        <BedrockStatusBadge status={gateway.status} />
        {badges}
        <span className="text-xs text-muted-foreground">
          {targetCount} connector{targetCount === 1 ? "" : "s"} · {toolCount} tool
          {toolCount === 1 ? "" : "s"}
        </span>
        {reference && (
          <span className="ml-auto font-mono text-xs text-muted-foreground">{reference}</span>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-4 border-t p-4">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Gateway URL</p>
          <p className="font-mono text-xs break-all">{gateway.gatewayUrl ?? "-"}</p>
        </div>
        <GatewayControls gateway={gateway} />
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Workload identity</p>
          <WorkloadIdentityValue identity={workloadIdentityForGateway(regionInventory, gateway)} />
        </div>
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Connectors ({gateway.targets?.length ?? 0})
          </p>
          <GatewayTargetsTable targets={gateway.targets} />
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

const GatewayTargetsTable = ({ targets }: { targets?: GatewayTarget[] }) => {
  if (!targets?.length) {
    return <p className="text-sm text-muted-foreground">No targets configured.</p>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Target</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Auth</TableHead>
          <TableHead>Connector endpoint</TableHead>
          <TableHead>Tools</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {targets.map((t, j) => (
          <TableRow key={t.targetId ?? j}>
            <TableCell className="font-medium">{t.name ?? "-"}</TableCell>
            <TableCell>
              {t.targetType ? <Badge variant="outline">{t.targetType}</Badge> : "-"}
            </TableCell>
            <TableCell>
              <BedrockStatusBadge status={t.status} />
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {t.credentialProviderType ?? "-"}
            </TableCell>
            <TableCell className="font-mono text-xs break-all">
              {t.mcpEndpoint ?? t.lambdaArn ?? "-"}
            </TableCell>
            <TableCell className="text-xs">
              {t.tools?.length ? (
                <div className="flex flex-wrap gap-1">
                  {t.tools.map((tool, k) => (
                    <Badge key={tool.name ?? k} variant="secondary" title={tool.description}>
                      {tool.name}
                    </Badge>
                  ))}
                </div>
              ) : (
                "-"
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

/**
 * The AgentCore gateways this runtime actually reaches.
 *
 * Only referenced gateways: a gateway the runtime does not name tells you
 * nothing about this runtime, and listing the region's others here invited the
 * reading that the agent is connected to them. Unreferenced gateways belong on
 * a gateways page, not on an agent's.
 *
 * A runtime references a gateway either by naming it in its tools config, or by
 * carrying its URL in an environment variable. Harness-owned runtimes inherit
 * their harness's references, which is why most links here arrive "via harness".
 */
const GatewaysCard = ({
  links,
  regionInventory,
}: {
  links: McpLink[];
  regionInventory: RegionInventory;
}) => (
  <Card>
    <CardHeader>
      <div className="flex items-center gap-2">
        <Network className="h-5 w-5 text-primary" />
        <CardTitle>Gateways</CardTitle>
      </div>
      <CardDescription>
        AgentCore gateways this runtime reaches, and the connectors behind them. Includes gateways
        that front a server this runtime reaches directly, which are marked bypassed.
      </CardDescription>
    </CardHeader>
    <CardContent>
      {links.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No AgentCore gateways are associated with this runtime.
        </p>
      ) : (
        <div className="space-y-3">
          {links.map((link, i) => (
            <GatewayBlock
              key={`${link.reference}-${i}`}
              gateway={link.gateway!}
              regionInventory={regionInventory}
              reference={link.reference}
              badges={<ViaBadge via={link.via} />}
              defaultOpen
            />
          ))}
        </div>
      )}
    </CardContent>
  </Card>
);

const ConnectedMcpsSection = ({
  mcps,
  detectionCatalog,
  orgMcpByType,
}: {
  mcps: ConnectedMcp[];
  detectionCatalog: McpDetectionEntry[];
  orgMcpByType: Map<number, McpOrgRollup>;
}) => {
  // The endpoint-derived name is the fallback: it still identifies the server
  // when no catalog pattern claims the URL.
  const rows = mcps.map((mcp) => {
    const detected = detectMcpServerType(mcp.url, detectionCatalog);
    const orgMcp = detected ? orgMcpByType.get(detected.mcpServerType) : undefined;
    return {
      ...mcp,
      // Only a catalog match is a type. Falling back to the connector's own
      // name here put "notes" and "stream" in a Type column, which reads as a
      // classification we never made — the name has its own column now.
      typeName: detected?.name ?? null,
      categoryName: detected?.categoryName ?? null,
      distributionChannels: orgMcp?.distributionChannels ?? [],
      baseScore: orgMcp?.baseScore ?? null,
      actualScore: orgMcp?.actualScore ?? null,
    };
  });

  const handleExport = () => {
    downloadCsv(
      rows.map((mcp) => ({
        'Connector': mcp.name,
        'Connector Type': mcp.typeName ?? '',
        'Target Type': mcp.targetType ?? '',
        'Tools': (mcp.tools ?? []).map((t) => t.name).filter(Boolean).join(', '),
        'Endpoint': mcp.url,
        'Category': mcp.categoryName ?? 'N/A',
        'Managed By': mcp.distributionChannels
          .filter((c) => c !== 0)
          .map((c) => DISTRIBUTION_CHANNEL_MAP[c] ?? 'Unknown')
          .join(', ') || '-',
        'Risk': mcp.baseScore != null ? getRiskLevel(mcp.actualScore ?? mcp.baseScore) : '-',
        'Route': routeLabel(mcp),
        'Source': mcp.viaHarness ? `Harness ${mcp.viaHarness}` : 'Runtime',
      })),
      `connected-connectors-${csvTimestamp()}.csv`,
    );
  };

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead colSpan={8} className="border-b-0 pb-4 pt-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-foreground">Connected Connectors</h2>
                {rows.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExport}
                    className="gap-2 text-foreground"
                  >
                    <Download className="h-4 w-4" />
                    Export All
                  </Button>
                )}
              </div>
            </TableHead>
          </TableRow>
          <TableRow>
            <TableHead>Connector</TableHead>
            {/*
              Two different things, deliberately separate. Connector Type is the
              Traceforce catalog classification that drives Risk and Managed By,
              and is blank when no catalog pattern claims the URL. Target Type is
              how AgentCore reaches it — LAMBDA, MCP_SERVER and so on.
            */}
            <TableHead>Connector Type</TableHead>
            <TableHead>Target Type</TableHead>
            <TableHead>Category</TableHead>
            <TableHead className="whitespace-nowrap">
              <div className="flex items-center gap-1">
                <span>Risk</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="bg-accent/10 backdrop-blur-sm border-accent/20">
                      <p>Inherent risk level. Change from actual shown when available.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </TableHead>
            <TableHead>Managed By</TableHead>
            <TableHead>Connector Instances</TableHead>
            <TableHead>Tools</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                No connected connectors
              </TableCell>
            </TableRow>
          ) : (
            <TooltipProvider>
              {rows.map((mcp) => (
                <TableRow key={mcp.id} className="hover:bg-muted/50">
                  <TableCell>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="font-medium text-foreground cursor-help">
                          {mcp.name}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-sm space-y-1">
                        <p className="text-sm font-mono whitespace-normal break-all">
                          {mcp.url}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {routeLabel(mcp)}
                          {mcp.viaHarness ? ` · from harness ${mcp.viaHarness}` : ""}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    {mcp.typeName ? (
                      <span className="text-sm">{mcp.typeName}</span>
                    ) : (
                      <span className="text-sm text-muted-foreground">Unrecognized</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {mcp.targetType ? (
                      <Badge variant="outline">{mcp.targetType}</Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{mcp.categoryName || "N/A"}</Badge>
                  </TableCell>
                  <TableCell>
                    {getScoreBadgeWithDiff(mcp.baseScore, mcp.actualScore) ?? (
                      <span className="text-muted-foreground">N/A</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {mcp.distributionChannels.filter((c) => c !== 0).length > 0 ? (
                        mcp.distributionChannels
                          .filter((c) => c !== 0)
                          .sort((a, b) => a - b)
                          .map((channel) => (
                            <span key={channel}>{getDistributionChannelBadge(channel)}</span>
                          ))
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">-</span>
                  </TableCell>
                  {/*
                    Tools come from the target's inline schema, which only
                    Lambda targets carry. An MCP server lists its tools over the
                    wire, so we cannot know them from the control plane — that
                    is "Unavailable", which is not the same as "none".
                  */}
                  <TableCell>
                    {mcp.tools?.length ? (
                      <div className="flex flex-wrap gap-1">
                        {mcp.tools.map((tool, i) => (
                          <Badge key={tool.name ?? i} variant="secondary" title={tool.description}>
                            {tool.name}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-sm text-muted-foreground cursor-help">
                            Unavailable
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="text-xs">
                            This connector does not declare its tools in AgentCore. Listing them
                            needs a live MCP call to the gateway, which inventory does not make.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TooltipProvider>
          )}
        </TableBody>
      </Table>
    </div>
  );
};

const BedrockRuntimeDetail = () => {
  const { account, region = "", runtimeId = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { activeOrgId } = useOrg();
  const { session } = useAuth();
  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [detectionCatalog, setDetectionCatalog] = useState<McpDetectionEntry[]>([]);
  const [orgMcpByType, setOrgMcpByType] = useState<Map<number, McpOrgRollup>>(new Map());
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reload, setReload] = useState(0);
  // Query string the AI Agents list was showing, restored on Back so filters survive.
  const backSearch: string = location.state?.backSearch || "";

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadFailed(false);
    // The catalog and org lookups only enrich the MCP rows, so a failure in
    // either must not keep the rest of the runtime from rendering.
    const emptyRollup = () => new Map<number, McpOrgRollup>();
    Promise.all([
      fetchInventory(session?.access_token).catch(() => {
        if (!cancelled) setLoadFailed(true);
        return null;
      }),
      activeOrgId ? fetchMcpDetectionCatalog(activeOrgId).catch(() => []) : [],
      activeOrgId ? fetchOrgMcpRollup(activeOrgId).catch(emptyRollup) : emptyRollup(),
    ])
      .then(([data, catalog, orgMcps]) => {
        if (cancelled) return;
        setInventory(data);
        setDetectionCatalog(catalog);
        setOrgMcpByType(orgMcps);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [activeOrgId, session?.access_token, reload]);

  const found = inventory ? findRuntime(inventory, account, region, runtimeId) : null;

  const backButton = (
    <Button variant="ghost" onClick={() => navigate(`/agents${backSearch ? `?${backSearch}` : ""}`)}>
      <ArrowLeft className="h-4 w-4" />
      Back to AI Agents
    </Button>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">Loading…</div>
    );
  }

  if (!found) {
    return (
      <div className="p-6 space-y-6">
        {backButton}
        <Card>
          <CardHeader>
            <CardTitle>{loadFailed ? "Couldn't load this runtime" : "Runtime not found"}</CardTitle>
            <CardDescription>
              {loadFailed ? (
                "The cloud inventory didn't load. Check your connection and try again."
              ) : (
                <>
                  No AgentCore runtime {runtimeId ? <code className="font-mono">{runtimeId}</code> : null}{" "}
                  in {region || "this region"}. It may have been removed, or its AWS account disconnected.
                </>
              )}
            </CardDescription>
            {loadFailed && (
              <Button size="sm" variant="outline" className="w-fit" onClick={() => setReload((n) => n + 1)}>
                Try again
              </Button>
            )}
          </CardHeader>
        </Card>
      </div>
    );
  }

  const { regionInventory, runtime } = found;
  const runtimeAccount = regionInventory.account ?? inventory!.account ?? account ?? "-";
  const harnesses = harnessesForRuntime(regionInventory, runtime);
  const gatewayLinks = mcpLinksForRuntime(regionInventory, runtime).filter((l) => l.gateway);
  const connectedMcps = connectedMcpsForRuntime(regionInventory, runtime);

  return (
    <div className="p-6 space-y-6">
      {backButton}

      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-lg overflow-hidden bg-muted/50 flex items-center justify-center shrink-0">
          <img
            src={BEDROCK_LOGO_URL}
            alt="AWS Bedrock"
            className="h-10 w-10 object-contain"
          />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            {runtime.agentRuntimeName ?? runtime.agentRuntimeId}
          </h1>
          <p className="text-muted-foreground">
            AWS Bedrock AgentCore runtime — account {runtimeAccount} · {regionInventory.region}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold">{harnesses.length}</div>
            <p className="text-sm text-muted-foreground">Harnesses</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold">{gatewayLinks.length}</div>
            <p className="text-sm text-muted-foreground">Gateways</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold">{connectedMcps.length}</div>
            <p className="text-sm text-muted-foreground">Connected Connectors</p>
          </CardContent>
        </Card>
      </div>

      <OverviewCard
        runtime={runtime}
        region={regionInventory.region}
        identity={workloadIdentityForRuntime(regionInventory, runtime)}
      />
      <ConnectedMcpsSection
        mcps={connectedMcps}
        detectionCatalog={detectionCatalog}
        orgMcpByType={orgMcpByType}
      />
      <HarnessesCard harnesses={harnesses} />
      <GatewaysCard links={gatewayLinks} regionInventory={regionInventory} />
    </div>
  );
};

export default BedrockRuntimeDetail;
