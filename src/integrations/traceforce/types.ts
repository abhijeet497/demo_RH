export interface TraceforceApiClient {
  id: string
  client_id: string;
  client_secret: string;
  name: string;
}

export interface TraceforceApiError {
  error: string;
  message?: string;
}

export interface TraceforceApiResponse<T = any> {
  data?: T;
  error?: string;
  message?: string;
  /** Stable machine-readable error code from the backend error contract ({ error, code }). */
  code?: string;
  /** For 400 validation errors, the offending request-body field path (e.g. "config.account"). */
  field?: string;
  statusCode?: number;
}

export interface TraceforceInstaller {
  supported_os: string[];
}

export interface TraceforceInstallerDownload {
  download_url: string;
  os: string;
  version?: string;
  mode?: string;
}

/** Raw macOS configuration-profile download: the .mobileconfig bytes plus the
 * server-provided attachment filename (from Content-Disposition), or null when the
 * header is absent so the caller can fall back to a default name. */
export interface CertificateProfileDownload {
  blob: Blob;
  filename: string | null;
}

export interface AlertNotification {
  id: string;
  configuration: {
    webhook_url: string | null;
    alert_notification_type: 1 | 2; // 1 = Slack, 2 = Teams
    frequency?: 1 | 2 | 3; // 1 = Hourly, 2 = Daily, 3 = Weekly (optional for backwards compatibility)
  };
  created_at: string;
  updated_at: string;
}

export interface MdmIntegration {
  id: string;
  provider: number;
  credentials: Record<string, string>;
  status: number; // 1 = pending, 2 = connected, 3 = disconnected
  error_code?: number; // HTTP status code (401, 403, 500, etc.)
  is_customer_error?: boolean; // True if customer can fix (bad creds, missing permissions)
  last_error?: string;
  last_synced?: string;
  created_at: string;
  updated_at: string;
}

export interface CustomerStorage {
  id: string;
  provider: number;
  config: Record<string, string>;
  status: number; // 1 = pending, 2 = connected, 3 = disconnected
  error_code?: number; // HTTP status code (403, 404, etc.)
  is_customer_error?: boolean; // True if customer can fix (bad bucket, missing permissions)
  last_error?: string;
  last_validated_at?: string;
  created_at: string;
  updated_at: string;
}

export interface LatestVersions {
  scout: string;
  extension: string;
}

export interface UserGroup {
  id: string;
  name: string;
  user_group_source: number;
  created_at: string;
  updated_at: string;
  user_group_devices: { device_id: string }[];
}

export interface UserGroupCreateRequest {
  name: string;
  device_ids: string[];
}

export interface UserGroupUpdateRequest {
  name: string;
  device_ids: string[];
}

export interface OrgInvitee {
  user_id: string;
  email?: string;
  role: string | null;
  invited_at?: string;
  email_confirmed_at?: string;
  last_sign_in_at?: string;
  profile_created_at: string | null;
  status: 'pending' | 'active';
}

export interface InviteListResult {
  data: OrgInvitee[];
  total: number;
  /** Users in this org who were added via the invite API (metadata invited_org_id). */
  invited_count: number;
  offset: number;
  limit: number;
}

// ===========================================================================
// ENG-324 / ENG-519 — MCP access (user flow). Mirrors scout.proto enums:
//   request status (MCPAccessRequestStatus): 0 unspecified · 1 pending · 2 approved · 3 denied · 4 satisfied (policy-granted) · 5 canceled (withdrawn by the requester)
//   scope (MCPPermissionScope):              1 ORG · 2 GROUP
//   decision action (MCPAccessDecision):     1 allow · 2 block
//   verdict (MCPAccessVerdict):              1 allow · 2 block · 3 needs_review
// Request and decision rows carry mcp_server_name; the catalog (useMcpCatalog)
// is only for the Set Access picker and a fallback.
// ===========================================================================
export type McpRequestStatus = 0 | 1 | 2 | 3 | 4 | 5;
export type McpScopeType = 0 | 1 | 2; // 0 UNKNOWN · 1 ORG · 2 GROUP
export type McpAccessAction = 1 | 2; // MCPAccessDecision: 1 allow · 2 block
export type McpAccessVerdict = 1 | 2 | 3; // 1 allow · 2 block · 3 needs_review

/** Cursor-paginated list envelope returned by the GET /mcp-access/* endpoints. */
export interface Paginated<T> {
  data: T[];
  next_token: string | null; // opaque cursor; null when there are no more pages
  has_more: boolean;
}

/** Query params shared by the cursor-paginated MCP-access list endpoints. */
export interface McpAccessListParams {
  status?: number; // optional status filter (admin list endpoints; enum int)
  sort_by?: string; // field to sort by (e.g. created_at, updated_at; name for the user-groups endpoints)
  sort_order?: 'asc' | 'desc'; // default desc
  limit?: number; // 1–1000, default 1000
  next_token?: string; // opaque cursor from a prior response; omit on the first call
  include_members?: boolean; // user-groups list only — embed members[] per group
}

// ===========================================================================
// MCP catalog — GET /api/v1/mcp-catalog (global directory, admin + user).
// Replaces the McpRegistry / useMcpCatalog Supabase `.from('mcp_catalog')` reads.
// Policies.tsx / PolicyDetail.tsx now read the combined mcp_catalog_all view
// (global + org entries) via src/lib/mcpCatalog instead of this endpoint.
// ===========================================================================

/** Auth method string enums published by the API (same as MCP Instances auth_type). */
export type McpAuthType = 'basic_auth' | 'token' | 'oauth' | 'no_auth';

/** MCP catalog source_type string enums published by the API. */
export type McpSourceType =
  | 'official'
  | 'community'
  | 'reference'
  | 'archived'
  | 'openai'
  | 'anthropic';

/** Catalog execution_environment string enums (same as MCP Instances deployment_model). */
export type McpExecutionEnvironment =
  | 'local_process'
  | 'local_container'
  | 'local_service'
  | 'remote';

/** A row from GET /api/v1/mcp-catalog. */
export interface McpCatalogDto {
  id: string;
  mcp_server_type: number;
  mcp_server_name: string;
  source_type: McpSourceType | null;
  description: string | null;
  website: string | null;
  logo_url: string | null;
  authentication_methods: McpAuthType[] | null;
  execution_environment: McpExecutionEnvironment[] | null;
  category_id: string | null;
  category_name: string | null;
  /** Average baseline risk score; null when unscored. Present only when the
   * request passed include_scores=true. */
  avg_baseline_score?: number | null;
}

/** Query params for GET /api/v1/mcp-catalog. */
export interface McpCatalogListParams {
  search?: string;
  sort_by?: 'name' | 'mcp_server_type';
  sort_order?: 'asc' | 'desc';
  /** MCP source string enums (CSV on the wire). */
  source_type?: McpSourceType[];
  /** Leave out these MCP sources (CSV on the wire). */
  exclude_source_type?: McpSourceType[];
  /** Auth method string enums (CSV on the wire): basic_auth, token, oauth, no_auth. */
  authentication_methods?: McpAuthType[];
  /** Execution environment string enums (CSV on the wire): local_process, local_container, local_service, remote. */
  execution_environment?: McpExecutionEnvironment[];
  /** Include avg_baseline_score per entry (default false). */
  include_scores?: boolean;
  /** Columns `search` matches: "all" (name and description, default) or "name". */
  search_fields?: 'all' | 'name';
  /** Only these mcp_server_type values (CSV on the wire). */
  mcp_server_type?: number[];
  /** Leave out these mcp_server_type values (CSV on the wire). */
  exclude_mcp_server_type?: number[];
  /** Only entries with this access outcome for the caller: allowed (including
   * ungoverned) / blocked = blocked or needing review (requestable). CSV on
   * the wire. */
  access_status?: ('allowed' | 'blocked')[];
  /** Include `total` (entries matching the filters, all pages) in the response. */
  include_total?: boolean;
  limit?: number;
  next_token?: string;
}

/** A row from GET/POST /api/v1/mcp-access/requests. The resolution fields are
 * what the requester may see about their own ask; who decided (and the admin
 * note) lives on the admin-only decision row, linked via decision_id (set when
 * a decision's sweep approved/denied the request; NULL while pending and on a
 * pure decline — a decline changes no access, so no decision exists). */
export interface McpAccessRequestDto {
  id: string;
  org_id: string;
  requester_id: string;
  /** The requester's email (org-requests only; null if the user is gone). */
  requester_email?: string | null;
  reason: string;
  mcp_server_type: number;
  /** Display name joined from the catalog on GET (null if the catalog lacks
   * this type). null on the create response body (the insert has no join). */
  mcp_server_name?: string | null;
  status: McpRequestStatus;
  resolution_note: string | null;
  resolved_at: string | null;
  decision_id: string | null;
  created_at: string;
  updated_at: string;
  /** org-requests only, PENDING rows: the scopes blocking the requester now
   * (live, not stored); null = the ungrouped scope. null on closed rows. */
  blocking_group_ids?: (string | null)[] | null;
}

/** A row from GET /api/v1/mcp-access/my-mcps — one per MCP a policy applies
 * to for the caller (absent = nothing applies: nothing restricts them, and
 * nothing is requestable). `verdict` is their effective, server-collapsed
 * access outcome. Verdicts only — provenance is admin-side.
 * Computed on the fly; `{ data: [...] }`, no pagination. */
export interface MyMcpVerdictDto {
  mcp_server_type: number;
  verdict: McpAccessVerdict;
}

export interface CreateMcpAccessRequestBody {
  mcp_server_type: number;
  reason: string;
}

// ===========================================================================
// ENG-349 / ENG-519 — MCP access (admin flow). Mirrors the /mcp-access/
// {org-requests,requests/resolve,decisions,status} routes. Access decisions
// live in an APPEND-ONLY ledger (latest decision per target wins over the
// policy verdict); effective status is resolved on the fly — nothing stores
// a permission status anymore.
// ===========================================================================

/** A row in the mcp_access_decisions ledger (GET/POST /mcp-access/decisions).
 * group_name is the immutable snapshot taken at decision time (a later group
 * rename doesn't rewrite history); decided_by is NULL for system decisions. */
export interface McpAccessDecisionDto {
  id: string;
  org_id: string;
  action: McpAccessAction; // 1 allow · 2 block
  scope_type: McpScopeType; // 1 ORG · 2 GROUP
  group_id: string | null; // set only for GROUP scope
  group_name: string | null; // snapshot at decision time; NULL for ORG scope
  mcp_server_type: number;
  decided_by: string | null; // acting admin; NULL = system
  decision_reason: string | null;
  created_at: string;
}

/** GET /decisions list rows additionally carry how many requests the decision
 * swept up when it was made (0 = a manual decision with no request attached). */
export interface McpAccessDecisionListDto extends McpAccessDecisionDto {
  resolved_count: number;
  /** The deciding admin's email (null for system decisions). */
  decided_by_email: string | null;
  /** Display name joined from the catalog on GET (null if the catalog lacks
   * this type). */
  mcp_server_name?: string | null;
}

/**
 * Body for POST /mcp-access/decisions — record one access change (allow/block)
 * for a scope. Appends a ledger row and resolves every matching pending
 * request in the same transaction (allow → APPROVED, block → DENIED).
 */
export type DecisionActionBody =
  | { action: McpAccessAction; scope_type: 1; mcp_server_type: number; decision_reason?: string }
  | { action: McpAccessAction; scope_type: 2; group_id: string; mcp_server_type: number; decision_reason?: string };

/** Response from POST /mcp-access/decisions. */
export interface DecisionActionResponse {
  decision: McpAccessDecisionDto;
  decided_count: number;
  request_ids: string[];
}

/** Body for POST /mcp-access/decisions/batch — several decisions in one
 * transaction: all land or none do. */
export interface DecisionBatchBody {
  decisions: DecisionActionBody[];
}

/** Response from POST /mcp-access/decisions/batch. */
export interface DecisionBatchResponse {
  decisions: McpAccessDecisionDto[];
  decided_count: number;
}

/**
 * Body for POST /mcp-access/requests/resolve — the Pending tab's single
 * action. status 2 (approve) also records an ALLOW decision for the scope
 * (approving an ask necessarily grants access); status 3 (decline) closes the
 * matching requests with the note and touches NO access — no ledger row, the
 * policy stays in charge. A scope matches the pending requests of people it
 * currently blocks (ORG: everyone); approve closes only those who can now use
 * the MCP.
 */
export type ResolveRequestsBody =
  // lift_group_blocks (org-scoped approve only): also remove explicit group
  // blocks on this MCP so the people they block are granted too.
  // ungrouped_only (org-scoped decline only): decline ONLY the requests of
  // people the ungrouped scope blocks, leaving the rest untouched.
  | { mcp_server_type: number; scope_type: 1; status: 2 | 3; resolution_note?: string; lift_group_blocks?: boolean; ungrouped_only?: boolean }
  | { mcp_server_type: number; scope_type: 2; group_id: string; status: 2 | 3; resolution_note?: string };

/** Response from POST /mcp-access/requests/resolve. decision is set only on approve. */
export interface ResolveRequestsResponse {
  resolved_count: number;
  request_ids: string[];
  decision: McpAccessDecisionDto | null;
}

// ===========================================================================
// PUT /api/v1/policies/:id — transactional policy save (MCP access policies
// only for now). Every section is optional; the endpoint applies exactly what
// is sent, all in one transaction (a failure changes nothing).
// ===========================================================================

export interface UpdatePolicyBody {
  /** 1 active · 2 inactive. Omit to leave activation untouched. */
  policy_status?: 1 | 2;
  /** Which devices the policy governs. */
  assignment?: {
    /** 1 organization-wide · 2 specific user groups. */
    employee_assignment_type: 1 | 2;
    /** Non-empty for type 2; empty for type 1. */
    group_ids: string[];
  };
  /** MCP access conditions. */
  mcp_access?: {
    /** Max allowed risk score (10 block-all, 40/60/80 = up to Low/Medium/High, null = allow all). */
    risk_threshold?: number | null;
    denied_categories?: { enabled: boolean; category_ids: string[] };
    /** Connector exceptions: MCP types the policy always allows, ahead of its
     * risk and category conditions (the policies.exception_types column).
     * FULL list, replace semantics; omit to leave unchanged. Explicit
     * decisions still outrank them. Server-enforced: positive registry types
     * only. */
    exception_types?: number[];
  };
}

export interface UpdatePolicyResponse {
  policy: {
    id: string;
    policy_status: number;
    risk_threshold: number | null;
    /** policies.exception_types after the save. */
    exception_types: number[];
    employee_assignment_type: number;
    updated_at: string;
  };
}

/** One row of GET /mcp-access/status?view=rollup — per-verdict counts over the
 * MCP's governed groups (the inventory badge derives from these). MCPs with no
 * governed group are ABSENT from the response ("no policy"). */
export interface McpAccessRollupDto {
  mcp_server_type: number;
  allowed_count: number;
  blocked_count: number;
  needs_review_count: number;
  /** With device_ids only: counts are DEVICES, all the selected ones (each
   * device's groups collapsed the way scout enforces), and this is the
   * selected devices no policy governs for it. */
  ungoverned_count?: number;
}

/** Top-level `coverage` of GET /mcp-access/status?view=rollup, with
 * device_ids only: the selected devices' enforcement. */
export interface McpAccessCoverageDto {
  device_count?: number;
  /** Devices some access policy governs. */
  enforced_device_count?: number;
  /** The policies governing those devices. */
  policy_ids?: string[];
  /** The devices' scopes; null = not in any group. */
  scope_group_ids?: (string | null)[];
}

export interface McpAccessRollupResponse {
  data: McpAccessRollupDto[];
  coverage?: McpAccessCoverageDto;
}

/** One row of GET /mcp-access/status?view=groups — the effective verdict for
 * one (MCP, group) with its provenance: decision_* set when an admin decision
 * won, policy_* when a policy decided (mutually exclusive). group_id NULL is
 * the ungrouped scope (devices whose owner is in no group). */
export interface McpAccessGroupStatusDto {
  mcp_server_type: number;
  group_id: string | null;
  group_name: string | null;
  verdict: McpAccessVerdict;
  decision_id: string | null;
  decision_scope: McpScopeType | null; // 1 org · 2 group when a decision won
  policy_id: string | null;
  policy_name: string | null;
  policy_assignment_type: number | null; // 1 org-wide/default · 2 specific
}

// ===========================================================================
// Aggregated admin view — composed client-side (no dedicated API endpoint).
// We list pending requests (GET /org-requests?status=1) and org groups with
// their members (GET /user-groups?include_members=true), then roll the requests
// up per mcp_server_type and bucket each requester under every scope blocking
// them now (or Ungrouped), so the admin can grant at group scope.
// ===========================================================================

/** A requester entry in the aggregated view, tagged with the scopes blocking them. */
export interface AggregatedRequesterDto {
  user_id: string;
  email: string | null;
  reason: string;
  /** ISO — the created_at of the underlying McpAccessRequestDto. */
  requested_at: string;
  /** The scopes blocking this requester now, from the request's
   * blocking_group_ids. id null = the ungrouped scope. */
  blocking: { id: string | null; name: string }[];
}


/** A finding row from GET /api/v1/sensitive-data-findings. */
export interface FindingListItem {
  id: string;
  category: string;
  type: string;
  status: string;
  source: 'file' | 'message';
  encoding_type: string | null;
  message_timestamp: string | null;
  message_id: string;
  agent_account_id: string;
  agent_email: string;
  agent_name: string;
  device_id: string | null;
  device_native_id: string | null;
  device_friendly_name: string | null;
  device_owner_email: string | null;
  conversation_id: string;
  conversation_name: string | null;
  conversation_path: string | null;
  file_id: string | null;
  file_name: string | null;
  file_path: string | null;
  archive_inner_path: string | null;
  /** 1-based; null when source=message. */
  start_line: number | null;
  end_line: number | null;
  source_path: string | null;
  snippet_path: string | null;
  status_comment: string | null;
  status_updated_at: string | null;
  status_updated_by: string | null;
}

/** Exact per-account finding totals from GET /api/v1/sensitive-data-findings/counts. */
export interface FindingCountsAccount {
  agent_account_id: string;
  open_count: number;
  closed_count: number;
  container_count: number;
}

/** Containment operation kinds — the only values the containment API accepts. */
export type ContainmentOp = 'write' | 'delete';

/** Finding counts for one container (conversation or attachment) and type. */
export interface FindingCountsGroup {
  agent_account_id: string;
  conversation_id: string;
  conversation_name: string | null;
  file_id: string | null;
  file_name: string | null;
  /** Sensitive-data counts groups carry `type` on the wire (the SD type name).
   * Containment groups do NOT — it is absent on the raw response and the UI
   * synthesizes it from the subcategory name at the fetch boundary
   * ({ ...g, type }); incidents group by risky_action_category /
   * risky_action_subcategory instead. Optional so the containment response type
   * matches the wire (it is only guaranteed present post-synthesis). */
  type?: string;
  /** Containment only: the RiskyActionCategory / RiskyActionSubcategory string
   * enum NAMES the incident groups by (e.g. "shared_db_destroyed"). The UI
   * normalizes the subcategory name onto `type` at the fetch boundary. Counts are
   * grouped per (conversation, category, subcategory) only — the tool is NOT a
   * group dimension; it is a per-event detail on ContainmentFinding. */
  risky_action_category?: string;
  risky_action_subcategory?: string;
  open_count: number;
  closed_count: number;
  latest_timestamp: string | null;
}

/** Response of GET /api/v1/sensitive-data-findings/counts. */
export interface FindingCountsResponse {
  accounts: FindingCountsAccount[];
  groups: FindingCountsGroup[];
}

// ===========================================================================
// Multi-org access (ENG-382) — org switcher + Org Access admin UI.
// ===========================================================================

/** A node in a grant's reachable org subtree (child + descendants). */
export interface OrgNode {
  org_id: string;
  /** The org's primary domain — its display label everywhere in the app. */
  email_domain: string;
  /** Extra domains beyond email_domain (the org's SAML SSO domain set); [] for no-sign-in orgs. */
  additional_domains: string[];
  children: OrgNode[];
}

/** One row from GET /api/v1/org-access-grants. */
export interface OrgAccessGrant {
  id: string;
  created_at: string;
  child_org: {
    org_id: string;
    /** The org's primary domain — its display label everywhere in the app. */
    email_domain: string;
    /** Extra domains beyond email_domain (the org's SAML SSO domain set); [] for no-sign-in orgs. */
    additional_domains: string[];
    /**
     * True if the org has a sign-in method (SAML SSO) configured; false = a no-sign-in org, nobody
     * from its domain can sign in.
     */
    has_sso: boolean;
  };
  /** Nested descendants reachable through this grant (may be empty). */
  subtree: OrgNode[];
}

export interface OrgAccessGrantsResponse {
  grants: OrgAccessGrant[];
}

/** One org the signed-in admin can switch into (GET /api/v1/accessible-orgs). */
export interface AccessibleOrg {
  org_id: string;
  email_domain: string;
  /** True for the admin's home organization. */
  is_home: boolean;
  /**
   * Immediate parent in the accessible set, when the API provides it.
   * Absent/null for the home org; used to render nested trees.
   */
  parent_org_id?: string | null;
}

export interface AccessibleOrgsResponse {
  orgs: AccessibleOrg[];
}

export interface OrgContextState {
  orgRole: 'admin' | 'user';
  homeOrgId: string | null;
  activeOrgId: string | null;
  isMultiOrg: boolean;
  accessibleOrgs: AccessibleOrg[];
  accessibleOrgsResolved: boolean;
  error: boolean;
  loading: boolean;
  setActiveOrg: (id: string) => void;
  refresh: () => Promise<void>;
}

/** Desired-state option on a risk rule (from issue_types.expected_value). */
export interface MapPolicyCatalogIssueType {
  id: string;
  expected_value: string;
  trigger_score: number;
}

export interface MapPolicyCatalogRule {
  risk_rule_id: string;
  name: string;
  description: string | null;
  issue_types: MapPolicyCatalogIssueType[];
}

export interface MapPolicyControl {
  id: string;
  title: string;
  requirement_text: string;
  source_excerpt?: string;
}

export type MapPolicyMappingStatus = 'mapped' | 'needs_review' | 'unmapped' | 'excluded';

export interface MapPolicyMapping extends MapPolicyControl {
  risk_rule_id: string | null;
  risk_rule_name: string | null;
  issue_type_id: string | null;
  /** Mapped desired state from the risk framework catalog. */
  expected_value: string | null;
  confidence: number;
  status: MapPolicyMappingStatus;
}

export interface MapPolicyResponse {
  source_file_name: string;
  framework_id: string;
  framework_name: string;
  entity_type: 1 | 2;
  controls: MapPolicyControl[];
  mappings: MapPolicyMapping[];
  catalog: MapPolicyCatalogRule[];
  /** anthropic when LLM mapping succeeded; lexical on fallback. */
  mapper: 'anthropic' | 'lexical';
  /** Present when the upload was a PDF — which deterministic converter produced text. */
  pdf_converter?: 'pdfjs' | 'pdfminer' | 'streams';
  summary: {
    control_count: number;
    mapped_count: number;
    needs_review_count: number;
    unmapped_count: number;
  };
}

// ===========================================================================
// Identity Provider (WorkOS Directory Sync) — /api/v1/settings/idp-integrations
// ===========================================================================

/** Server-derived lifecycle state; drives every button in the drawer.
 *
 * The server owns this vocabulary; at runtime a value outside this union
 * (added server-side before the UI catches up) deliberately FAILS OPEN: the
 * drawer's rendering chain only special-cases pending_setup and disconnected,
 * so an unknown state gets the linked view with Sync/Reconfigure/Disconnect —
 * all safe, idempotent operations — rather than a dead end. Keep any new
 * state's default behavior safe under that assumption. */
export type IdpUiState =
  | 'pending_setup'      // row exists, WorkOS setup unfinished
  | 'discovering'        // directory linked, first sync not yet completed
  | 'connected'          // syncing normally
  | 'attention_customer' // sync failing on the customer's side (e.g. IdP credentials)
  | 'attention_platform' // sync failing on our side
  | 'disconnecting'      // disconnected but mirrored groups not yet torn down
  | 'disconnected';      // disconnected and fully torn down

export interface IdpIntegration {
  id: string;
  /** "unknown" until the directory is linked (provider is chosen inside WorkOS). */
  provider:
    | 'okta' | 'entra' | 'onelogin' | 'gsuite'
    | 'cyberark' | 'jumpcloud' | 'pingfederate' | 'rippling' | 'sailpoint'
    | 'unknown';
  /** Raw sync status. Prefer ui_state, which folds in directory state and errors. */
  status: 'unknown' | 'pending' | 'connected' | 'disconnected';
  /** Raw WorkOS directory type, e.g. "okta scim v2.0". Null until linked. */
  directory_type: string | null;
  /** Raw WorkOS-reported directory state (passthrough; "linked" ≡ "active"). */
  directory_state: string | null;
  directory_linked: boolean;
  last_synced: string | null;
  /** When the last directory EVENT actually arrived from the IdP (WorkOS
   * sync_cursor_event_at). Unlike last_synced (a poller run stamp), this only
   * moves when data arrives — the admin's self-diagnosis signal for IdP-side
   * push failures, which are invisible to us by SCIM protocol.
   * Optional for the deploy window: an API that predates the field sends
   * undefined and the drawer hides the row (undefined = field not deployed;
   * null = deployed, no event yet). */
  last_event_received_at?: string | null;
  last_reconciled_at: string | null;
  disconnected_at: string | null;
  /** The last sync failure, or null when healthy. */
  error: {
    http_status: number | null;
    is_customer_error: boolean;
    message: string;
  } | null;
  /** Live mirror sizes, computed per request. */
  counts: {
    groups_live: number;
    directory_users_live: number;
    policies_attached: number;
  };
  ui_state: IdpUiState;
  created_at: string;
}

/** GET /api/v1/settings/idp-integrations */
export interface IdpIntegrationListResponse {
  /** Every integration for the org, including disconnected ones. Newest first. */
  integrations: IdpIntegration[];
  /** True when an unlinked setup is in flight; a second connect would 409. */
  pending_setup_exists: boolean;
}

/** POST /api/v1/settings/idp-integrations and POST .../{id}/reconnect */
export interface IdpConnectResponse {
  integration: IdpIntegration;
  /** Single-use, short-lived WorkOS Admin Portal link. Redirect immediately; never cache. */
  portal_url: string;
}

/** POST .../{id}/sync — 202; the run itself is asynchronous. */
export interface IdpSyncQueuedResponse {
  queued: boolean;
  mode: 'delta' | 'reconcile';
}

/** DELETE .../{id} — 202; the teardown is asynchronous. */
export interface IdpDisconnectResponse {
  disconnected: boolean;
  /** False means the async teardown could not be queued — retry the DELETE. */
  teardown_queued: boolean;
  teardown_error?: string;
  groups_affected: number;
  policies_affected: number;
}

// ===========================================================================
// Directory Users — GET /api/v1/directory-users (public API). The Directory
// Users page reads through it so browser code never queries the database
// directly. Cursor-paginated via the shared Paginated<T> envelope.
// ===========================================================================

/** ONE ROW PER USER — email is the row key; groups carries every membership
 * (only the matching ones when user_group_ids filters). */
export interface DirectoryUser {
  email: string;
  /** IdP-reported lifecycle; null if unknown (public-API convention: no
   * "unknown" string). Only "active" members resolve to devices and are
   * reached by group-scoped policies; providers report deactivated users as
   * "inactive". */
  state: 'active' | 'suspended' | 'inactive' | null;
  groups: {
    id: string;
    name: string;
    /** Provider vocabulary string ("okta", "jumpcloud", …); null if unknown. */
    source: string | null;
  }[];
  /** Live devices resolved via the MDM owner-email mapping — case-insensitive,
   * server-side. Always 0 for non-active members (mirrors enforcement reach). */
  device_count: number;
}

export interface DirectoryUserListParams {
  /** CSV of group UUIDs (same parameter as the devices endpoint). */
  user_group_ids?: string[];
  /** Case-insensitive email substring; the API requires at least 2 characters. */
  search?: string;
  limit?: number;
  /** Opaque cursor from the previous response, passed verbatim. */
  next_token?: string;
}

// ===========================================================================
// User groups — GET /api/v1/user-groups. The same list the User Group
// Management tab and the group pickers show: both group kinds, with counts
// resolved server-side (devices via user_group_resolved_devices, users =
// live directory members). Cursor-paginated via Paginated<T>.
// ===========================================================================

export interface UserGroupListItem {
  id: string;
  name: string;
  /** Provider vocabulary string; "traceforce" for groups created in this UI,
   * otherwise the IdP the group was synced from. Null if unknown. */
  source: string | null;
  /** True for IdP-synced (directory-managed) groups — name and membership are
   * read-only in this UI. */
  synced: boolean;
  /** Live devices this group resolves to: assigned devices for Traceforce
   * groups, active-member owner-email resolution for synced groups. */
  device_count: number;
  /** Live directory members; always 0 for Traceforce-created groups. */
  user_count: number;
  created_at: string;
  /** Manual edits stamp this; null if never modified. Directory sync updates
   * updated_at instead. */
  last_modified_at: string | null;
  updated_at: string;
  /** Distinct device-owner emails in the group. Present only when the list
   * was fetched with include_members=true. */
  members?: { owner_email: string }[];
}

/** GET /api/v1/user-groups/{id} — the list shape plus the group's DIRECT
 * device assignments (unfiltered by device liveness: soft-deleted members
 * must survive an edit round-trip). Empty for IdP-synced groups. */
export interface UserGroupDetail extends UserGroupListItem {
  device_ids: string[];
}

// ===========================================================================
// Devices — GET /api/v1/devices. The Device Management table's read: counts,
// component versions, and RESOLVED user groups (direct assignments plus
// IdP-synced groups the owner belongs to via the MDM owner email — the same
// membership group-scoped policies enforce against).
// ===========================================================================

export interface DeviceListItem {
  id: string;
  device_native_id: string;
  friendly_name: string | null;
  platform: string | null;
  os_version: string | null;
  owner_email: string | null;
  owner_name: string | null;
  last_seen_at: string | null;
  sandbox_count: number;
  agent_count: number;
  mcp_count: number;
  llm_model_count: number;
  active_issues: number;
  agent_issues: number;
  mcp_issues: number;
  scout_version: string | null;
  scout_version_status: 'latest' | 'outdated' | null;
  chrome_extension_version: string | null;
  chrome_extension_version_status: 'latest' | 'outdated' | 'not_installed' | null;
  edge_extension_version: string | null;
  edge_extension_version_status: 'latest' | 'outdated' | 'not_installed' | null;
  os_users: string[];
  user_groups: { id: string; name: string; source: string | null }[];
}

export interface DeviceListParams {
  search?: string;
  platform?: string[];
  user_group_ids?: string[];
  has_issues?: boolean;
  sort_by?: 'last_seen_at' | 'agents' | 'mcps' | 'issues' | 'name';
  sort_order?: 'asc' | 'desc';
  limit?: number;
  next_token?: string;
}

export interface UserGroupListParams {
  /** true → only IdP-synced groups; false → only Traceforce-created groups. */
  synced?: boolean;
  /** Embed each group's distinct device-owner roster (admin-only capability
   * of the org-wide endpoint). */
  include_members?: boolean;
  /** Case-insensitive name substring; the API requires at least 2 characters. */
  search?: string;
  sort_by?: 'name' | 'created_at' | 'last_modified_at' | 'device_count';
  sort_order?: 'asc' | 'desc';
  limit?: number;
  /** Opaque cursor from the previous response, passed verbatim. */
  next_token?: string;
}

// ===========================================================================
// LLM models (ENG-743) — GET /api/v1/llm-models (org inventory),
// /api/v1/llm-model-catalog (global + org-private registry), and
// /api/v1/llm-model-instances (per-device sightings). Descriptive fields come
// from the LLM catalog joined on llm_model_type. weight is the openness class
// ('open' | 'closed' | 'restricted', null = Unknown); llm_model_type 0 = Unknown and
// 999999999 = Custom are valid sentinels that may have no catalog row.
// ===========================================================================

/** Model-weight openness class as returned by the API (null = Unknown). */
export type LlmWeight = 'open' | 'closed' | 'restricted';

/** A row from GET /api/v1/llm-models — one LLM model in use in the org. */
export interface LlmModelDto {
  id: string;
  llm_model_type: number;
  model_name: string;
  publisher: string | null;
  /** Catalog model family (e.g. "Claude Opus"); null when the catalog has none for the model. */
  model_family: string | null;
  origin_country: string | null;
  /** Openness class ('open' | 'closed' | 'restricted'); null when the type has no catalog row (Unknown). */
  weight: LlmWeight | null;
  hosted_by: string[];
  /** Distinct API hosts this model was observed on across the org (e.g. api.openai.com). */
  api_hosts: string[];
  active_devices: number;
  instance_count: number;
  /** Omitted until an instance has been seen. */
  first_seen_at?: string;
  last_seen_at?: string;
  /** Catalog description: returned on the list + detail; omitted if none. */
  description?: string;
  /** Detail endpoint (GET /api/v1/llm-models/{id}) only; omitted if none. */
  website?: string;
}

export interface LlmModelListParams {
  search?: string;
  sort_by?: 'name' | 'devices';
  sort_order?: 'asc' | 'desc';
  limit?: number;
  next_token?: string;
}

/** A row from GET /api/v1/llm-model-catalog — a global or org-private registry entry. */
export interface LlmCatalogEntryDto {
  id: string;
  llm_model_type: number;
  model_name: string;
  publisher: string | null;
  /** Catalog model family (e.g. "Claude Opus"); null when the catalog has none for the model. */
  model_family: string | null;
  origin_country: string | null;
  weight: LlmWeight | null;
  hosted_by: string[];
  description: string | null;
  website: string | null;
  logo_url: string | null;
}

export interface LlmCatalogListParams {
  search?: string;
  sort_by?: 'name' | 'llm_model_type';
  sort_order?: 'asc' | 'desc';
  limit?: number;
  next_token?: string;
}

/** A row from GET /api/v1/llm-models/{id}/devices — a device where a model was seen. */
export interface LlmModelDeviceDto {
  device_id: string;
  device_native_id: string;
  device_friendly_name: string | null;
  platform: string;
  os_version: string | null;
  device_owner_email: string | null;
  api_hosts: string[];
  last_seen_at: string;
}

export interface LlmModelDeviceListParams {
  sort_by?: 'last_seen_at' | 'device_native_id' | 'device_owner_email';
  sort_order?: 'asc' | 'desc';
  limit?: number;
  next_token?: string;
}

/** A row from GET /api/v1/llm-model-instances — one per-device sighting of a model on an API host. */
export interface LlmModelInstanceDto {
  id: string;
  llm_model_id: string | null;
  llm_model_type: number;
  model_name: string | null;
  publisher: string | null;
  llm_model_native_id: string;
  api_host: string;
  device_id: string | null;
  device_native_id: string | null;
  device_friendly_name: string | null;
  device_owner_email: string | null;
  sandbox_id: string | null;
  first_seen_at: string;
  last_seen_at: string;
}

export interface LlmModelInstanceListParams {
  search?: string;
  sort_by?: 'last_seen_at' | 'model_name' | 'device_native_id' | 'device_owner_email';
  sort_order?: 'asc' | 'desc';
  llm_model_ids?: string[];
  device_ids?: string[];
  limit?: number;
  next_token?: string;
}

// ---------------------------------------------------------------------------
// OpenTelemetry export (OTel chaining): extra OTLP destinations configured under
// Settings › Observability. A logging policy that selects one also sends that
// policy's activity logs there, on top of Traceforce's own copy.
// ---------------------------------------------------------------------------

export type OtelProtocol = 'http/protobuf' | 'http/json' | 'grpc';

export interface OtelDestination {
  id: string;
  /** Admin-chosen display name (required); unique per org. */
  name: string | null;
  /**
   * Base OTLP URL: scheme + host + port, optionally followed by a vendor base path prefix
   * (e.g. Grafana Cloud `…/otlp`, Dynatrace `…/api/v2/otlp`). The exporter appends the per-signal
   * path (`/v1/logs`, `/v1/traces`, `/v1/metrics`); only a trailing `/v1/(traces|logs|metrics)` is rejected.
   */
  endpoint: string;
  protocol: OtelProtocol;
  /** Header names only. Values are write-only and never returned. */
  header_keys: string[];
  enabled: boolean;
  /** True when the server couldn't read the headers secret; the row still lists so Edit/Remove work. */
  headers_unavailable?: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * One header in a create/update body. Omitting `value` on update keeps the stored
 * value for that key; a key missing from the array is removed. On create every
 * entry must carry a value.
 */
export interface OtelDestinationHeaderInput {
  key: string;
  value?: string;
}

export interface OtelDestinationInput {
  name: string;
  endpoint: string;
  protocol: OtelProtocol;
  headers: OtelDestinationHeaderInput[];
  enabled?: boolean;
}
