import type { TraceforceApiClient as TraceforceApiClientType, TraceforceApiResponse, TraceforceInstaller, TraceforceInstallerDownload, CertificateProfileDownload, AlertNotification, MdmIntegration, CustomerStorage, LatestVersions, UserGroup, UserGroupCreateRequest, UserGroupUpdateRequest, InviteListResult, OrgAccessGrantsResponse, AccessibleOrgsResponse, McpAccessRequestDto, MyMcpVerdictDto, CreateMcpAccessRequestBody, Paginated, McpAccessListParams, McpAccessDecisionListDto, DecisionActionBody, DecisionActionResponse, DecisionBatchBody, DecisionBatchResponse, ResolveRequestsBody, ResolveRequestsResponse, McpAccessRollupResponse, McpAccessGroupStatusDto, FindingListItem, FindingCountsResponse, MapPolicyResponse, McpCatalogDto, McpCatalogListParams, UpdatePolicyBody, UpdatePolicyResponse, IdpIntegrationListResponse, IdpConnectResponse, IdpSyncQueuedResponse, IdpDisconnectResponse, OtelDestination, OtelDestinationInput, DirectoryUser, DirectoryUserListParams, UserGroupListItem, UserGroupDetail, UserGroupListParams, DeviceListItem, DeviceListParams, LlmModelDto, LlmModelListParams, LlmCatalogEntryDto, LlmCatalogListParams, LlmModelDeviceDto, LlmModelDeviceListParams, LlmModelInstanceDto, LlmModelInstanceListParams } from './types';
import { MULTI_ORG_ENABLED } from '@/lib/featureFlags';
import { apiErrorText } from '@/lib/api-errors';
import type { AwsConnection } from '@/lib/awsConnections';

/** Build a `?…` query string from MCP-access pagination params (omits empty values). */
function mcpAccessQuery(params: McpAccessListParams = {}): string {
  const qs = new URLSearchParams();
  if (params.status != null) qs.set('status', String(params.status));
  if (params.sort_by) qs.set('sort_by', params.sort_by);
  if (params.sort_order) qs.set('sort_order', params.sort_order);
  if (params.limit != null) qs.set('limit', String(params.limit));
  if (params.next_token) qs.set('next_token', params.next_token);
  if (params.include_members) qs.set('include_members', 'true');
  const s = qs.toString();
  return s ? `?${s}` : '';
}

/** Build a `?…` query string for GET /api/v1/mcp-catalog. */
function mcpCatalogQuery(params: McpCatalogListParams = {}): string {
  const qs = new URLSearchParams();
  if (params.search) qs.set('search', params.search);
  if (params.sort_by) qs.set('sort_by', params.sort_by);
  if (params.sort_order) qs.set('sort_order', params.sort_order);
  if (params.source_type?.length) qs.set('source_type', params.source_type.join(','));
  if (params.exclude_source_type?.length) {
    qs.set('exclude_source_type', params.exclude_source_type.join(','));
  }
  if (params.authentication_methods?.length) {
    qs.set('authentication_methods', params.authentication_methods.join(','));
  }
  if (params.execution_environment?.length) {
    qs.set('execution_environment', params.execution_environment.join(','));
  }
  if (params.include_scores) qs.set('include_scores', 'true');
  if (params.search_fields) qs.set('search_fields', params.search_fields);
  if (params.mcp_server_type?.length) qs.set('mcp_server_type', params.mcp_server_type.join(','));
  if (params.exclude_mcp_server_type?.length) {
    qs.set('exclude_mcp_server_type', params.exclude_mcp_server_type.join(','));
  }
  if (params.access_status?.length) qs.set('access_status', params.access_status.join(','));
  if (params.include_total) qs.set('include_total', 'true');
  if (params.limit != null) qs.set('limit', String(params.limit));
  if (params.next_token) qs.set('next_token', params.next_token);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

/** Build a `?…` query string for GET /api/v1/llm-models. */
function llmModelQuery(params: LlmModelListParams = {}): string {
  const qs = new URLSearchParams();
  if (params.search) qs.set('search', params.search);
  if (params.sort_by) qs.set('sort_by', params.sort_by);
  if (params.sort_order) qs.set('sort_order', params.sort_order);
  if (params.limit != null) qs.set('limit', String(params.limit));
  if (params.next_token) qs.set('next_token', params.next_token);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

/** Build a `?…` query string for GET /api/v1/llm-model-catalog. */
function llmCatalogQuery(params: LlmCatalogListParams = {}): string {
  const qs = new URLSearchParams();
  if (params.search) qs.set('search', params.search);
  if (params.sort_by) qs.set('sort_by', params.sort_by);
  if (params.sort_order) qs.set('sort_order', params.sort_order);
  if (params.limit != null) qs.set('limit', String(params.limit));
  if (params.next_token) qs.set('next_token', params.next_token);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

/** Build a `?…` query string for GET /api/v1/llm-models/{id}/devices. */
function llmModelDeviceQuery(params: LlmModelDeviceListParams = {}): string {
  const qs = new URLSearchParams();
  if (params.sort_by) qs.set('sort_by', params.sort_by);
  if (params.sort_order) qs.set('sort_order', params.sort_order);
  if (params.limit != null) qs.set('limit', String(params.limit));
  if (params.next_token) qs.set('next_token', params.next_token);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

/** Build a `?…` query string for GET /api/v1/llm-model-instances. */
function llmModelInstanceQuery(params: LlmModelInstanceListParams = {}): string {
  const qs = new URLSearchParams();
  if (params.search) qs.set('search', params.search);
  if (params.sort_by) qs.set('sort_by', params.sort_by);
  if (params.sort_order) qs.set('sort_order', params.sort_order);
  if (params.llm_model_ids?.length) qs.set('llm_model_ids', params.llm_model_ids.join(','));
  if (params.device_ids?.length) qs.set('device_ids', params.device_ids.join(','));
  if (params.limit != null) qs.set('limit', String(params.limit));
  if (params.next_token) qs.set('next_token', params.next_token);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

/** Pull the attachment filename out of a Content-Disposition header (prefers the
 * RFC 5987 filename* form, falls back to plain filename), or null if absent —
 * lets a byte download keep the server-chosen name (traceforce-<orgSlug>.mobileconfig). */
function contentDispositionFilename(header: string | null): string | null {
  if (!header) return null;
  const star = header.match(/filename\*=(?:UTF-8'')?([^;]+)/i);
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1].trim().replace(/^"|"$/g, ''));
    } catch { /* malformed encoding — fall back to the plain filename */ }
  }
  const plain = header.match(/filename="?([^";]+)"?/i);
  return plain?.[1]?.trim() ?? null;
}

const TRACEFORCE_API_ENDPOINT = import.meta.env.VITE_TRACEFORCE_API_ENDPOINT;

/** Hard ceiling on any single request. fetch() has no default timeout, so without
 * this a backend that accepts the connection but never responds leaves the promise
 * pending forever — which freezes callers that await it (e.g. the multi-group MCP
 * request dialog stuck on "Submitting…"). */
const REQUEST_TIMEOUT_MS = 30000;
/** Document extract + Anthropic mapping can take several minutes on large policies. */
const MAP_POLICY_TIMEOUT_MS = 300000;

class TraceforceApiClient {
  private baseUrl: string;
  private activeOrgId: string | null = null;
  private onOrgRevoked: ((revokedOrgId: string) => void) | null = null;

  setActiveOrgId(id: string | null): void {
    this.activeOrgId = id;
  }

  setOnOrgRevoked(callback: ((revokedOrgId: string) => void) | null): void {
    this.onOrgRevoked = callback;
  }

  constructor() {
    // Use proxy in development, direct URL in production
    if (import.meta.env.DEV) {
      this.baseUrl = '/traceforce-api';
    } else {
      if (!TRACEFORCE_API_ENDPOINT) {
        throw new Error('VITE_TRACEFORCE_API_ENDPOINT environment variable is not configured');
      }
      this.baseUrl = TRACEFORCE_API_ENDPOINT;
    }
  }

  private async makeRequest<T>(
    endpoint: string,
    accessToken: string,
    options: RequestInit = {},
    // skipOrgScope: do NOT attach X-Active-Org-Id. Use for identity-scoped endpoints whose result must
    // not depend on the active org — notably GET /accessible-orgs, the source of truth for the org set:
    // scoping it by the active org is circular and would 403 right after that org's access is revoked.
    skipOrgScope = false,
    timeoutMs = REQUEST_TIMEOUT_MS,
    // 'blob' returns the raw response bytes as { blob, filename } instead of JSON-parsing.
    // Used for binary/attachment downloads (e.g. the macOS .mobileconfig profile); the
    // header/auth/org-scope/timeout/error handling below is shared with the JSON path.
    responseType: 'json' | 'blob' = 'json',
  ): Promise<TraceforceApiResponse<T>> {
    // Abort the request if it exceeds timeoutMs so a hung connection
    // surfaces as an error instead of a promise that never settles.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const requestOrgId = (MULTI_ORG_ENABLED && !skipOrgScope) ? this.activeOrgId : null;

      // Build with a Headers object (case-INSENSITIVE) seeded from caller options, then .set() the
      // enforced headers LAST so they always win — a call site can never override auth or tenant
      // scoping (Authorization / Content-Type / X-Active-Org-Id), and a differently-cased caller key
      // (e.g. lowercase 'authorization') can't slip through as a duplicate (a plain object would).
      const headers = new Headers(options.headers);
      headers.set('Authorization', `Bearer ${accessToken}`);
      // FormData must keep the browser-generated multipart boundary; do not force JSON.
      // For all other requests, Content-Type is enforced as application/json (callers cannot override).
      const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
      if (isFormData) {
        headers.delete('Content-Type');
      } else {
        headers.set('Content-Type', 'application/json');
      }
      if (requestOrgId) {
        headers.set('X-Active-Org-Id', requestOrgId);
      } else {
        // Not scoping by active org (skipOrgScope, flag off, or no active org) — strip any caller-seeded
        // header so skipOrgScope's "identity-scoped" guarantee can't be defeated by options.headers.
        headers.delete('X-Active-Org-Id');
      }

      // Add Vercel protection bypass header if available
      const vercelBypass = import.meta.env.VITE_VERCEL_PROTECTION_BYPASS;
      if (vercelBypass) {
        headers.set('x-vercel-protection-bypass', vercelBypass);
      }

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        // Auto-revert the active org if the backend says it's no longer accessible.
        if (response.status === 403 && errorText.includes('ORG_NOT_ACCESSIBLE') && requestOrgId) {
          this.onOrgRevoked?.(requestOrgId);
        }
        // Additively expose the structured error body ({ error, code, field }) so callers can route on the
        // stable `code` instead of scraping the human string. `error` is left byte-for-byte unchanged
        // (every existing caller reads it as a string). A non-JSON body (e.g. a proxy HTML 502)
        // simply leaves code/message undefined → the caller falls back to its generic handling.
        let code: string | undefined;
        let message: string | undefined;
        let field: string | undefined;
        try {
          const parsed = JSON.parse(errorText);
          code = typeof parsed?.code === 'string' ? parsed.code : undefined;
          field = typeof parsed?.field === 'string' ? parsed.field : undefined;
          // The backend puts its human message under `error`; fall back to `message` for safety.
          message = typeof parsed?.error === 'string' ? parsed.error
            : typeof parsed?.message === 'string' ? parsed.message : undefined;
        } catch { /* non-JSON error body — leave code/message undefined */ }
        return {
          error: `API returned ${response.status}: ${errorText}`,
          message,
          code,
          field,
          statusCode: response.status,
        };
      }

      // Binary/attachment endpoints hand back raw bytes, not JSON — return the Blob and
      // the server-chosen download filename (Content-Disposition) so the caller can save it.
      if (responseType === 'blob') {
        const blob = await response.blob();
        const filename = contentDispositionFilename(response.headers.get('Content-Disposition'));
        return { data: { blob, filename } as T };
      }

      // Some endpoints (e.g. DELETE/cancel) return 204 or an empty body with no
      // JSON to parse. Calling response.json() on those throws "Unexpected end
      // of JSON input", so read as text first and only parse when non-empty.
      if (response.status === 204) {
        return { data: undefined as T };
      }
      const text = await response.text();
      // Treat a whitespace-only body the same as empty — otherwise a stray
      // trailing newline would make JSON.parse throw and surface an OK response
      // as an error.
      if (!text.trim()) {
        return { data: undefined as T };
      }
      const data = JSON.parse(text);
      return { data };
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return {
          error: `Request timed out after ${timeoutMs / 1000}s. Please try again.`,
        };
      }
      return {
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Fetch API clients from TRACEFORCE
   */
  async getApiClients(accessToken: string): Promise<TraceforceApiResponse<TraceforceApiClientType[]>> {
    return this.makeRequest<TraceforceApiClientType[]>('/api/v1/api-clients', accessToken, {
      method: 'GET',
    });
  }

  /**
   * Create a new API client in TRACEFORCE
   */
  async createApiClient(accessToken: string, name: string): Promise<TraceforceApiResponse<TraceforceApiClientType>> {
    return this.makeRequest<TraceforceApiClientType>('/api/v1/api-clients', accessToken, {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  /**
   * Delete an API client in TRACEFORCE
   */
  async deleteApiClient(accessToken: string, id: string): Promise<TraceforceApiResponse<void>> {
    return this.makeRequest<void>(`/api/v1/api-clients/${id}`, accessToken, {
      method: 'DELETE',
    });
  }

  /**
   * Get list of supported OS for installers
   */
  async getInstallers(accessToken: string): Promise<TraceforceApiResponse<TraceforceInstaller>> {
    return this.makeRequest<TraceforceInstaller>('/api/v1/installers', accessToken, {
      method: 'GET',
    });
  }

  /**
   * Get download link for specific OS installer. Pass mode to select the
   * deployment variant (mdm or selfserve); omit it to use the server default (mdm).
   */
  async getInstallerByOs(accessToken: string, os: string, mode?: string): Promise<TraceforceApiResponse<TraceforceInstallerDownload>> {
    const query = mode ? `?mode=${encodeURIComponent(mode)}` : '';
    return this.makeRequest<TraceforceInstallerDownload>(`/api/v1/installers/${os}${query}`, accessToken, {
      method: 'GET',
    });
  }

  /**
   * Download the org's macOS configuration profile (.mobileconfig). Admin-scoped and
   * enterprise-only; the org is resolved from the request (X-Active-Org-Id), no device
   * credential. Returns the raw profile bytes (not JSON) plus the server-provided
   * attachment filename. The org CA is provisioned on demand on the first download and
   * the profile is generated on the fly (never stored).
   */
  async getCertificateProfile(accessToken: string): Promise<TraceforceApiResponse<CertificateProfileDownload>> {
    return this.makeRequest<CertificateProfileDownload>('/api/v1/installers/macos-profile', accessToken, {
      method: 'GET',
    }, false, REQUEST_TIMEOUT_MS, 'blob');
  }

  /**
   * Get alert notification settings
   */
  async getAlertNotifications(accessToken: string): Promise<TraceforceApiResponse<AlertNotification[]>> {
    return this.makeRequest<AlertNotification[]>('/api/v1/settings/alert-notifications', accessToken, {
      method: 'GET',
    });
  }

  /**
   * Create alert notification settings
   */
  async createAlertNotification(accessToken: string, webhookUrl: string, notificationType: 1 | 2, frequency: 1 | 2 | 3): Promise<TraceforceApiResponse<AlertNotification>> {
    return this.makeRequest<AlertNotification>('/api/v1/settings/alert-notifications', accessToken, {
      method: 'POST',
      body: JSON.stringify({ 
        configuration: {
          webhook_url: webhookUrl,
          alert_notification_type: notificationType,
          frequency: frequency
        }
      }),
    });
  }

  /**
   * Update alert notification settings
   */
  async updateAlertNotification(accessToken: string, id: string, webhookUrl: string | undefined, notificationType: 1 | 2, frequency: 1 | 2 | 3): Promise<TraceforceApiResponse<AlertNotification>> {
    const configuration: Record<string, unknown> = {
      alert_notification_type: notificationType,
      frequency: frequency
    };
    if (webhookUrl !== undefined) {
      configuration.webhook_url = webhookUrl;
    }
    return this.makeRequest<AlertNotification>(`/api/v1/settings/alert-notifications/${id}`, accessToken, {
      method: 'PUT',
      body: JSON.stringify({ configuration }),
    });
  }

  /**
   * Delete alert notification settings
   */
  async deleteAlertNotification(accessToken: string, id: string): Promise<TraceforceApiResponse<{ success: boolean }>> {
    return this.makeRequest<{ success: boolean }>(`/api/v1/settings/alert-notifications/${id}`, accessToken, {
      method: 'DELETE',
    });
  }

  /**
   * Get MDM integration settings
   * Returns a list of connected MDM integrations (F2 contract).
   */
  async getMdmIntegration(accessToken: string): Promise<TraceforceApiResponse<MdmIntegration[]>> {
    // F2 backend endpoint now returns MdmIntegration[] — call it directly.
    // (DEV mock removed: it returned fake mock-jamf-001 / mock-intune-1 rows whose
    //  non-UUID ids caused real edit/delete/create calls to 500.)
    return this.makeRequest<MdmIntegration[]>('/api/v1/settings/mdm-integration', accessToken, {
      method: 'GET',
    });
  }

  /**
   * Create MDM integration
   */
  async createMdmIntegration(accessToken: string, provider: number, credentials: Record<string, string>): Promise<TraceforceApiResponse<MdmIntegration>> {
    return this.makeRequest<MdmIntegration>('/api/v1/settings/mdm-integration', accessToken, {
      method: 'POST',
      body: JSON.stringify({ provider, credentials }),
    });
  }

  /**
   * Update MDM integration
   */
  async updateMdmIntegration(accessToken: string, id: string, credentials: Record<string, string>): Promise<TraceforceApiResponse<MdmIntegration>> {
    return this.makeRequest<MdmIntegration>(`/api/v1/settings/mdm-integration/${id}`, accessToken, {
      method: 'PUT',
      body: JSON.stringify({ credentials }),
    });
  }

  /**
   * Delete MDM integration
   */
  async deleteMdmIntegration(accessToken: string, id: string): Promise<TraceforceApiResponse<{ success: boolean }>> {
    return this.makeRequest<{ success: boolean }>(`/api/v1/settings/mdm-integration/${id}`, accessToken, {
      method: 'DELETE',
    });
  }

  /**
   * Prove the customer's AWS role can be assumed, then save it as one of the
   * org's AWS connections (one per account; reconnecting updates it). Regions
   * come back from the role's `traceforce-regions` tag, set in their Terraform.
   * Also how "Check again" retries a connection whose last sync failed.
   */
  async verifyCloudConnection(
    accessToken: string,
    roleArn: string,
    name?: string,
  ): Promise<TraceforceApiResponse<{ verified: boolean; accountId?: string; assumedRoleArn?: string; regions?: string[] }>> {
    return this.makeRequest<{ verified: boolean; accountId?: string; assumedRoleArn?: string; regions?: string[] }>(
      '/api/v1/cloud-connections/verify',
      accessToken,
      { method: 'POST', body: JSON.stringify({ role_arn: roleArn, ...(name ? { name } : {}) }) },
    );
  }

  /** The org's connected AWS accounts. */
  async listCloudConnections(accessToken: string): Promise<TraceforceApiResponse<{ connections: AwsConnection[] }>> {
    return this.makeRequest<{ connections: AwsConnection[] }>('/api/v1/cloud-connections', accessToken, {
      method: 'GET',
    });
  }

  /** Disconnect one AWS account: its agents are removed and syncing stops. */
  async disconnectCloudConnection(accessToken: string, id: string): Promise<TraceforceApiResponse<{ disconnected: boolean }>> {
    return this.makeRequest<{ disconnected: boolean }>(`/api/v1/cloud-connections/${encodeURIComponent(id)}`, accessToken, {
      method: 'DELETE',
    });
  }

  /**
   * The active org's Bedrock AgentCore inventory, across every connected AWS
   * account. Served from the database, which the collector Lambda syncs hourly.
   */
  async getBedrockInventory(accessToken: string): Promise<TraceforceApiResponse<unknown>> {
    return this.makeRequest<unknown>('/api/v1/bedrock-inventory', accessToken, {
      method: 'GET',
    });
  }

  /**
   * Get customer storage configuration
   */
  async getCustomerStorage(accessToken: string): Promise<TraceforceApiResponse<CustomerStorage>> {
    return this.makeRequest<CustomerStorage>('/api/v1/settings/customer-storage', accessToken, {
      method: 'GET',
    });
  }

  /**
   * Create customer storage configuration
   */
  async createCustomerStorage(accessToken: string, provider: number, config: Record<string, string>): Promise<TraceforceApiResponse<CustomerStorage>> {
    return this.makeRequest<CustomerStorage>('/api/v1/settings/customer-storage', accessToken, {
      method: 'POST',
      body: JSON.stringify({ provider, config }),
    });
  }

  /**
   * Update customer storage configuration
   */
  async updateCustomerStorage(accessToken: string, id: string, config: Record<string, string>): Promise<TraceforceApiResponse<CustomerStorage>> {
    return this.makeRequest<CustomerStorage>(`/api/v1/settings/customer-storage/${id}`, accessToken, {
      method: 'PUT',
      body: JSON.stringify({ config }),
    });
  }

  /**
   * Delete customer storage configuration
   */
  async deleteCustomerStorage(accessToken: string, id: string): Promise<TraceforceApiResponse<{ success: boolean }>> {
    return this.makeRequest<{ success: boolean }>(`/api/v1/settings/customer-storage/${id}`, accessToken, {
      method: 'DELETE',
    });
  }

  // ---------------------------------------------------------------------------
  // OpenTelemetry export destinations (OTel chaining)
  // ---------------------------------------------------------------------------

  /**
   * List the org's OTLP destinations. Header values are never returned, only keys.
   */
  async listOtelDestinations(accessToken: string): Promise<TraceforceApiResponse<OtelDestination[]>> {
    return this.makeRequest<OtelDestination[]>('/api/v1/settings/otel-destinations', accessToken, {
      method: 'GET',
    });
  }

  /**
   * Create an OTLP destination. Every header must carry a value.
   */
  async createOtelDestination(accessToken: string, input: OtelDestinationInput): Promise<TraceforceApiResponse<OtelDestination>> {
    return this.makeRequest<OtelDestination>('/api/v1/settings/otel-destinations', accessToken, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  /**
   * Partially update a destination. `headers`, when present, is the full desired set:
   * an entry without `value` keeps the stored secret, a missing key is removed.
   */
  async updateOtelDestination(accessToken: string, id: string, input: Partial<OtelDestinationInput>): Promise<TraceforceApiResponse<OtelDestination>> {
    return this.makeRequest<OtelDestination>(`/api/v1/settings/otel-destinations/${id}`, accessToken, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  }

  async deleteOtelDestination(accessToken: string, id: string): Promise<TraceforceApiResponse<{ success: boolean }>> {
    return this.makeRequest<{ success: boolean }>(`/api/v1/settings/otel-destinations/${id}`, accessToken, {
      method: 'DELETE',
    });
  }

  /**
   * Get latest component versions
   */
  async getVersions(accessToken: string): Promise<TraceforceApiResponse<LatestVersions>> {
    return this.makeRequest<LatestVersions>('/api/v1/versions', accessToken, {
      method: 'GET',
    });
  }

  /**
   * Get content preview for a sensitive data finding
   */
  async getFindingContent(accessToken: string, findingId: string): Promise<TraceforceApiResponse<{
    id: string
    source: 'file' | 'message'
    content: string
    highlight_start: number
    highlight_end: number
    encoding_type: string | null
    decoded_match?: string
    archive_inner_path?: string
  }>> {
    return this.makeRequest(`/api/v1/sensitive-data-findings/${findingId}/content`, accessToken, {
      method: 'GET',
    });
  }

  /**
   * Get the verbatim tool input (the full command) for a containment event.
   * The event's `operation` field is the display-safe summary; this is its
   * full-context counterpart, read from the customer-storage snippet.
   */
  async getContainmentFindingContent(accessToken: string, findingId: string): Promise<TraceforceApiResponse<{
    id: string
    content: string
  }>> {
    return this.makeRequest(`/api/v1/connector-containment-findings/${findingId}/content`, accessToken, {
      method: 'GET',
    });
  }

  /**
   * Get download URL for a finding's source artifact (redacted attachment or
   * stored conversation portion)
   */
  async getFindingSourceDownloadUrl(accessToken: string, findingId: string): Promise<TraceforceApiResponse<{ id: string; url: string; expires_at: string }>> {
    return this.makeRequest(`/api/v1/sensitive-data-findings/${findingId}/source/download`, accessToken, {
      method: 'GET',
    });
  }

  /**
   * Get finding counts grouped by container (conversation/attachment) and type
   */
  async getFindingCounts(accessToken: string, params: { agent_account_ids: string[]; category?: string }): Promise<TraceforceApiResponse<FindingCountsResponse>> {
    const search = new URLSearchParams({ agent_account_ids: params.agent_account_ids.join(',') });
    if (params.category) search.set('category', params.category);
    return this.makeRequest(`/api/v1/sensitive-data-findings/counts?${search}`, accessToken, {
      method: 'GET',
    });
  }

  /**
   * Get connector containment finding counts grouped by conversation, category,
   * and subcategory. risky_action_category is the string enum name.
   */
  async getContainmentFindingCounts(accessToken: string, params: { agent_account_ids: string[]; risky_action_category?: string }): Promise<TraceforceApiResponse<FindingCountsResponse>> {
    const search = new URLSearchParams({ agent_account_ids: params.agent_account_ids.join(',') });
    if (params.risky_action_category != null) search.set('risky_action_category', params.risky_action_category);
    return this.makeRequest(`/api/v1/connector-containment-findings/counts?${search}`, accessToken, {
      method: 'GET',
    });
  }

  /**
   * Get a signed download URL for a containment event's source activity object
   */
  async getContainmentSourceDownloadUrl(accessToken: string, eventId: string): Promise<TraceforceApiResponse<{ id: string; url: string; expires_at: string }>> {
    return this.makeRequest(`/api/v1/connector-containment-findings/${eventId}/source/download`, accessToken, {
      method: 'GET',
    });
  }

  /**
   * List connector containment findings for a conversation's category/subcategory
   * group. Category/subcategory are the string enum names.
   */
  async listContainmentFindings(accessToken: string, params: {
    conversation_ids: string[]
    // Category incident dimension: pass the incident's category name (and the
    // counts row's subcategory name) to list exactly its events.
    risky_action_category?: string
    risky_action_subcategory?: string
    status?: string[]
    limit?: number
    next_token?: string
  }): Promise<TraceforceApiResponse<{
    data: Array<{
      id: string
      // Open vocabulary on the wire (the API passes new op kinds through
      // without a version bump); ContainmentOp lists the KNOWN kinds and
      // stays the type for values the UI sends (filters/close).
      op: string
      risky_action_category: string | null
      risky_action_subcategory: string | null
      tool_name: string
      operation: string
      tool_use_id: string | null
      prompt_id: string | null
      hook_event_name: string | null
      detected_at: string | null
      status: string
      agent_account_id: string
      agent_email: string
      agent_name: string
      device_id: string | null
      device_native_id: string | null
      device_friendly_name: string | null
      device_owner_email: string | null
      conversation_id: string
      conversation_name: string | null
      snippet_path: string | null
      source_path: string | null
      status_comment: string | null
      status_updated_at: string | null
      status_updated_by: string | null
    }>
    next_token: string | null
    has_more: boolean
  }>> {
    const search = new URLSearchParams({ conversation_ids: params.conversation_ids.join(',') });
    if (params.risky_action_category != null) search.set('risky_action_category', params.risky_action_category);
    if (params.risky_action_subcategory != null) search.set('risky_action_subcategory', params.risky_action_subcategory);
    if (params.status?.length) search.set('status', params.status.join(','));
    if (params.limit) search.set('limit', String(params.limit));
    if (params.next_token) search.set('next_token', params.next_token);
    return this.makeRequest(`/api/v1/connector-containment-findings?${search}`, accessToken, {
      method: 'GET',
    });
  }

  /**
   * Close (or re-reason) containment findings: exact ids, or a
   * conversation-and-category group's open subset (subcategory optionally narrows it).
   * Category/subcategory are the string enum names.
   */
  async closeContainmentFindings(accessToken: string, body: {
    finding_ids?: string[]
    conversation_id?: string
    // Category incident group key (subcategory optionally narrows to one row).
    risky_action_category?: string
    risky_action_subcategory?: string
    status: string
    comment?: string
  }): Promise<TraceforceApiResponse<{ updated_count: number }>> {
    return this.makeRequest(`/api/v1/connector-containment-findings/close`, accessToken, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /**
   * Get the structured injection evidence for a finding, read from the
   * customer-storage snippet: the origin (the source the model named — an MCP
   * tool id, a file path, a URL, or "user_prompt") and the verbatim triggering
   * instruction (masked + capped; empty when none was recorded).
   */
  async getPromptInjectionFindingContent(accessToken: string, findingId: string): Promise<TraceforceApiResponse<{
    id: string
    origin: string
    instruction: string
  }>> {
    return this.makeRequest(`/api/v1/prompt-injection-findings/${findingId}/content`, accessToken, {
      method: 'GET',
    });
  }

  /**
   * Get a signed download URL for a prompt-injection finding's source activity
   * object (the stored conversation activity the flag came from)
   */
  async getPromptInjectionSourceDownloadUrl(accessToken: string, findingId: string): Promise<TraceforceApiResponse<{ id: string; url: string; expires_at: string }>> {
    return this.makeRequest(`/api/v1/prompt-injection-findings/${findingId}/source/download`, accessToken, {
      method: 'GET',
    });
  }

  /**
   * Get prompt-injection finding counts grouped by conversation. Unlike
   * containment there is no op/tool sub-dimension — the group is one
   * conversation.
   */
  async getPromptInjectionFindingCounts(accessToken: string, params: { agent_account_ids: string[] }): Promise<TraceforceApiResponse<FindingCountsResponse>> {
    const search = new URLSearchParams({ agent_account_ids: params.agent_account_ids.join(',') });
    return this.makeRequest(`/api/v1/prompt-injection-findings/counts?${search}`, accessToken, {
      method: 'GET',
    });
  }

  /**
   * List prompt-injection findings for one or more conversation groups. The
   * group key is the conversation alone (no op/tool/file dimension).
   */
  async listPromptInjectionFindings(accessToken: string, params: {
    conversation_ids: string[]
    status?: string[]
    limit?: number
    next_token?: string
  }): Promise<TraceforceApiResponse<{
    data: Array<{
      id: string
      // The assistant-response message the flag was read from (exposed as
      // message_id to match sensitive-data-findings).
      message_id: string
      // The model's short, sanitized attack description; null when it emitted none.
      description: string | null
      detected_at: string | null
      status: string
      agent_account_id: string
      agent_email: string
      agent_name: string
      device_id: string | null
      device_native_id: string | null
      device_friendly_name: string | null
      device_owner_email: string | null
      conversation_id: string
      conversation_name: string | null
      snippet_path: string | null
      source_path: string | null
      status_comment: string | null
      status_updated_at: string | null
      status_updated_by: string | null
    }>
    next_token: string | null
    has_more: boolean
  }>> {
    const search = new URLSearchParams({ conversation_ids: params.conversation_ids.join(',') });
    if (params.status?.length) search.set('status', params.status.join(','));
    if (params.limit) search.set('limit', String(params.limit));
    if (params.next_token) search.set('next_token', params.next_token);
    return this.makeRequest(`/api/v1/prompt-injection-findings?${search}`, accessToken, {
      method: 'GET',
    });
  }

  /**
   * Close (or re-reason) prompt-injection findings: exact ids, or one
   * conversation's open subset (the group is the conversation alone)
   */
  async closePromptInjectionFindings(accessToken: string, body: {
    finding_ids?: string[]
    conversation_id?: string
    status: string
    comment?: string
  }): Promise<TraceforceApiResponse<{ updated_count: number }>> {
    return this.makeRequest(`/api/v1/prompt-injection-findings/close`, accessToken, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /**
   * Close (or re-reason) findings: exact ids, or a container-and-type group's
   * open subset
   */
  async closeFindings(accessToken: string, body: {
    finding_ids?: string[]
    conversation_id?: string
    file_id?: string
    type?: string
    status: string
    comment?: string
  }): Promise<TraceforceApiResponse<{ updated_count: number }>> {
    return this.makeRequest(`/api/v1/sensitive-data-findings/close`, accessToken, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /**
   * List sensitive data findings (cursor-paginated)
   */
  async listFindings(accessToken: string, params: {
    conversation_ids?: string[]
    file_ids?: string[]
    type?: string
    status?: string[]
    source?: string
    sort_by?: 'message_timestamp' | 'start_line'
    sort_order?: 'asc' | 'desc'
    limit?: number
    next_token?: string
  }): Promise<TraceforceApiResponse<{
    data: FindingListItem[]
    next_token: string | null
    has_more: boolean
  }>> {
    const search = new URLSearchParams();
    if (params.conversation_ids?.length) search.set('conversation_ids', params.conversation_ids.join(','));
    if (params.file_ids?.length) search.set('file_ids', params.file_ids.join(','));
    if (params.type) search.set('type', params.type);
    if (params.status?.length) search.set('status', params.status.join(','));
    if (params.source) search.set('source', params.source);
    if (params.sort_by) search.set('sort_by', params.sort_by);
    if (params.sort_order) search.set('sort_order', params.sort_order);
    if (params.limit) search.set('limit', String(params.limit));
    if (params.next_token) search.set('next_token', params.next_token);
    const qs = search.toString();
    return this.makeRequest(`/api/v1/sensitive-data-findings${qs ? `?${qs}` : ''}`, accessToken, {
      method: 'GET',
    });
  }

  /**
   * Create a user group
   */
  async createUserGroup(accessToken: string, body: UserGroupCreateRequest): Promise<TraceforceApiResponse<UserGroup>> {
    return this.makeRequest<UserGroup>('/api/v1/user-groups', accessToken, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /**
   * Update a user group
   */
  async updateUserGroup(accessToken: string, id: string, body: UserGroupUpdateRequest): Promise<TraceforceApiResponse<UserGroup>> {
    return this.makeRequest<UserGroup>(`/api/v1/user-groups/${id}`, accessToken, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  /**
   * Delete a user group
   */
  async deleteUserGroup(accessToken: string, id: string): Promise<TraceforceApiResponse<{ message: string }>> {
    return this.makeRequest<{ message: string }>(`/api/v1/user-groups/${id}`, accessToken, {
      method: 'DELETE',
    });
  }

  /**
   * List users invited to the organization (Supabase invite flow).
   */
  async listInvitees(
    accessToken: string,
    params?: { limit?: number; offset?: number; status?: 'pending' | 'active' | 'all' }
  ): Promise<TraceforceApiResponse<InviteListResult>> {
    const sp = new URLSearchParams();
    if (params?.limit != null) sp.set('limit', String(params.limit));
    if (params?.offset != null) sp.set('offset', String(params.offset));
    if (params?.status && params.status !== 'all') sp.set('status', params.status);
    const q = sp.toString();
    return this.makeRequest<InviteListResult>(`/api/v1/invite${q ? `?${q}` : ''}`, accessToken, {
      method: 'GET',
    });
  }

  /**
   * Send a Supabase email invite to join the organization.
   */
  async inviteUserByEmail(
    accessToken: string,
    body: { email: string; redirectTo?: string; role?: string }
  ): Promise<TraceforceApiResponse<{ user_id: string; email: string; message?: string }>> {
    return this.makeRequest<{ user_id: string; email: string; message?: string }>('/api/v1/invite', accessToken, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /**
   * Create or link a child org. Exactly one of sso_metadata_url / sso_metadata_xml / no_sso;
   * no_sso: true creates the org without any sign-in method (an existing org for the domain is a
   * 409, except a no-sign-in org this org created — that is re-linked, e.g. after a revoke; the
   * metadata flow re-links those too). Response org.sso_upgraded: true means this submit attached
   * SSO to an existing no-sign-in org (upgrade) and nothing was created.
   */
  async createOrLinkOrg(
    accessToken: string,
    // additional_domains: extra SSO domains registered alongside child_email_domain (the primary).
    // Only valid with SAML metadata — the backend rejects it combined with no_sso.
    body: { child_email_domain: string; sso_metadata_url?: string; sso_metadata_xml?: string; no_sso?: boolean; additional_domains?: string[] }
    // domains_error: PARTIAL SUCCESS — the org was linked and the grant minted, but some
    // additional_domains couldn't be added (finish via Manage domains). Treat as success + warning.
  ): Promise<TraceforceApiResponse<{ org: { org_id: string; created: boolean; sso_upgraded: boolean }; grant: { id: string; created_at: string }; domains_error?: { code: 'DOMAIN_CONFLICT' | 'SSO_UPSTREAM'; message: string } }>> {
    return this.makeRequest<{ org: { org_id: string; created: boolean; sso_upgraded: boolean }; grant: { id: string; created_at: string }; domains_error?: { code: 'DOMAIN_CONFLICT' | 'SSO_UPSTREAM'; message: string } }>('/api/v1/orgs', accessToken, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async getOrgAccessGrants(accessToken: string): Promise<TraceforceApiResponse<OrgAccessGrantsResponse>> {
    return this.makeRequest<OrgAccessGrantsResponse>('/api/v1/org-access-grants', accessToken, {
      method: 'GET',
    });
  }

  async revokeOrgAccessGrant(accessToken: string, id: string): Promise<TraceforceApiResponse<{ grant: { id: string } }>> {
    return this.makeRequest<{ grant: { id: string } }>(`/api/v1/org-access-grants/${encodeURIComponent(id)}`, accessToken, {
      method: 'DELETE',
    });
  }

  /**
   * Add an additional email domain to a child org's SAML SSO domain set. Admin-only; the org must
   * be an SSO org the caller's org holds a direct grant to. Returns the updated additional-domain
   * list (primary excluded).
   */
  async addOrgDomain(accessToken: string, orgId: string, domain: string): Promise<TraceforceApiResponse<{ additional_domains: string[] }>> {
    return this.makeRequest<{ additional_domains: string[] }>(`/api/v1/orgs/${encodeURIComponent(orgId)}/domains`, accessToken, {
      method: 'POST',
      body: JSON.stringify({ domain }),
    });
  }

  /**
   * Remove an additional email domain from a child org's SAML SSO domain set (the primary domain
   * can't be removed). Returns the updated additional-domain list (primary excluded).
   */
  async removeOrgDomain(accessToken: string, orgId: string, domain: string): Promise<TraceforceApiResponse<{ additional_domains: string[] }>> {
    return this.makeRequest<{ additional_domains: string[] }>(`/api/v1/orgs/${encodeURIComponent(orgId)}/domains/${encodeURIComponent(domain)}`, accessToken, {
      method: 'DELETE',
    });
  }

  async getAccessibleOrgs(accessToken: string): Promise<TraceforceApiResponse<AccessibleOrgsResponse>> {
    // skipOrgScope: this endpoint defines the accessible set, so it must not be scoped by the active
    // org (avoids a circular 403 when refreshing right after the active org's access is revoked).
    return this.makeRequest<AccessibleOrgsResponse>('/api/v1/accessible-orgs', accessToken, {
      method: 'GET',
    }, true);
  }

  // MCP catalog (global directory; admin + user) -----------------------------

  /** List MCP catalog entries (cursor-paginated; optional search / source_type / auth filters). */
  async listMcpCatalog(accessToken: string, params: McpCatalogListParams = {}): Promise<TraceforceApiResponse<Paginated<McpCatalogDto> & { total?: number }>> {
    return this.makeRequest<Paginated<McpCatalogDto> & { total?: number }>(`/api/v1/mcp-catalog${mcpCatalogQuery(params)}`, accessToken, {
      method: 'GET',
    });
  }

  // LLM models (ENG-743) -----------------------------------------------------

  /** List LLM models in use in the org (cursor-paginated; optional search). */
  async listLlmModels(accessToken: string, params: LlmModelListParams = {}): Promise<TraceforceApiResponse<Paginated<LlmModelDto>>> {
    return this.makeRequest<Paginated<LlmModelDto>>(`/api/v1/llm-models${llmModelQuery(params)}`, accessToken, {
      method: 'GET',
    });
  }

  /** Get a single LLM model by id (adds description / website / logo_url). */
  async getLlmModel(accessToken: string, id: string): Promise<TraceforceApiResponse<LlmModelDto>> {
    return this.makeRequest<LlmModelDto>(`/api/v1/llm-models/${id}`, accessToken, {
      method: 'GET',
    });
  }

  /** List devices where a specific LLM model was observed (cursor-paginated). */
  async listLlmModelDevices(accessToken: string, id: string, params: LlmModelDeviceListParams = {}): Promise<TraceforceApiResponse<Paginated<LlmModelDeviceDto>>> {
    return this.makeRequest<Paginated<LlmModelDeviceDto>>(`/api/v1/llm-models/${id}/devices${llmModelDeviceQuery(params)}`, accessToken, {
      method: 'GET',
    });
  }

  /** List LLM catalog entries (global + org-private registry; cursor-paginated). */
  async listLlmCatalog(accessToken: string, params: LlmCatalogListParams = {}): Promise<TraceforceApiResponse<Paginated<LlmCatalogEntryDto>>> {
    return this.makeRequest<Paginated<LlmCatalogEntryDto>>(`/api/v1/llm-model-catalog${llmCatalogQuery(params)}`, accessToken, {
      method: 'GET',
    });
  }

  /** List per-device LLM model sightings (cursor-paginated; filter by model / device). */
  async listLlmModelInstances(accessToken: string, params: LlmModelInstanceListParams = {}): Promise<TraceforceApiResponse<Paginated<LlmModelInstanceDto>>> {
    return this.makeRequest<Paginated<LlmModelInstanceDto>>(`/api/v1/llm-model-instances${llmModelInstanceQuery(params)}`, accessToken, {
      method: 'GET',
    });
  }

  /** Drain the full LLM inventory through the cursor for the LLM Models page,
   * which filters and sorts client-side. */
  async listAllLlmModels(accessToken: string, params?: Omit<LlmModelListParams, 'limit' | 'next_token'>): Promise<LlmModelDto[]> {
    return this.drainPages(
      (next_token) => this.listLlmModels(accessToken, { ...params, limit: 1000, next_token }),
      'Failed to load LLM models',
    );
  }

  /** Drain the full LLM catalog through the cursor for the LLM Model Registry,
   * which filters and sorts client-side. */
  async listAllLlmCatalog(accessToken: string, params?: Omit<LlmCatalogListParams, 'limit' | 'next_token'>): Promise<LlmCatalogEntryDto[]> {
    return this.drainPages(
      (next_token) => this.listLlmCatalog(accessToken, { ...params, limit: 1000, next_token }),
      'Failed to load LLM catalog',
    );
  }

  /** Drain every device for one LLM model through the cursor (Model Detail
   * "Where It's Used"), so a model on more than one page of devices isn't truncated. */
  async listAllLlmModelDevices(accessToken: string, id: string, params?: Omit<LlmModelDeviceListParams, 'limit' | 'next_token'>): Promise<LlmModelDeviceDto[]> {
    return this.drainPages(
      (next_token) => this.listLlmModelDevices(accessToken, id, { ...params, limit: 1000, next_token }),
      'Failed to load model devices',
    );
  }

  /** Drain all LLM model instances (optionally scoped by device_ids / llm_model_ids)
   * through the cursor -- used by Device Detail and the Devices LLM rollup. */
  async listAllLlmModelInstances(accessToken: string, params?: Omit<LlmModelInstanceListParams, 'limit' | 'next_token'>): Promise<LlmModelInstanceDto[]> {
    return this.drainPages(
      // Stable key by default: last_seen_at moves while paging.
      (next_token) => this.listLlmModelInstances(accessToken, { sort_by: 'device_native_id', sort_order: 'asc', ...params, limit: 1000, next_token }),
      'Failed to load LLM model instances',
    );
  }

  // ENG-324 — MCP access (user flow) -----------------------------------------

  /** List the caller's own MCP access requests (newest first, cursor-paginated). */
  async listMyMcpRequests(accessToken: string, params: McpAccessListParams = {}): Promise<TraceforceApiResponse<Paginated<McpAccessRequestDto>>> {
    return this.makeRequest<Paginated<McpAccessRequestDto>>(`/api/v1/mcp-access/requests${mcpAccessQuery(params)}`, accessToken, {
      method: 'GET',
    });
  }

  /** Create a new MCP access request (requester_id / org_id / status are stamped server-side). */
  async createMcpAccessRequest(accessToken: string, body: CreateMcpAccessRequestBody): Promise<TraceforceApiResponse<McpAccessRequestDto>> {
    return this.makeRequest<McpAccessRequestDto>('/api/v1/mcp-access/requests', accessToken, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /** Withdraw one of the caller's own pending MCP access requests (marks it CANCELED). */
  async cancelMcpAccessRequest(accessToken: string, id: string): Promise<TraceforceApiResponse<void>> {
    return this.makeRequest<void>(`/api/v1/mcp-access/requests/${id}`, accessToken, {
      method: 'DELETE',
    });
  }

  /** The caller's effective verdict per MCP a policy applies to (absent MCP =
   * nothing applies, nothing requestable).
   * Powers the registry's access chrome.
   * Computed set — not paginated. */
  async listMyMcps(accessToken: string): Promise<TraceforceApiResponse<{ data: MyMcpVerdictDto[] }>> {
    return this.makeRequest<{ data: MyMcpVerdictDto[] }>('/api/v1/mcp-access/my-mcps', accessToken, {
      method: 'GET',
    });
  }

  /** [admin] List every MCP access request in the caller's org (cursor-paginated). */
  async listOrgMcpRequests(accessToken: string, params: McpAccessListParams = {}): Promise<TraceforceApiResponse<Paginated<McpAccessRequestDto>>> {
    return this.makeRequest<Paginated<McpAccessRequestDto>>(`/api/v1/mcp-access/org-requests${mcpAccessQuery(params)}`, accessToken, {
      method: 'GET',
    });
  }

  /** [admin] The decision ledger, newest first (the History tab). Each row
   * carries resolved_count — how many requests that decision swept up. */
  async listMcpDecisions(accessToken: string, params: McpAccessListParams = {}): Promise<TraceforceApiResponse<Paginated<McpAccessDecisionListDto>>> {
    return this.makeRequest<Paginated<McpAccessDecisionListDto>>(`/api/v1/mcp-access/decisions${mcpAccessQuery(params)}`, accessToken, {
      method: 'GET',
    });
  }

  /**
   * [admin] Resolve the pending requests for one (MCP, scope) — the Pending
   * tab's approve/decline. status 2 (approve) also records an ALLOW decision
   * for the scope; status 3 (decline) closes the requests and touches no
   * access (no ledger row — policy stays in charge).
   */
  async resolveMcpRequests(accessToken: string, body: ResolveRequestsBody): Promise<TraceforceApiResponse<ResolveRequestsResponse>> {
    return this.makeRequest<ResolveRequestsResponse>('/api/v1/mcp-access/requests/resolve', accessToken, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /** [admin] Save a policy edit as one transaction (conditions, assignment,
   * activation, exception allows — all-or-nothing). MCP access policies only
   * for now. */
  async updatePolicy(accessToken: string, policyId: string, body: UpdatePolicyBody): Promise<TraceforceApiResponse<UpdatePolicyResponse>> {
    return this.makeRequest<UpdatePolicyResponse>(`/api/v1/policies/${policyId}`, accessToken, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  /** [admin] Effective access per MCP, resolved on the fly (decision > policy):
   * per-verdict governed-group counts. MCPs with no governed group are absent
   * ("no policy"). With deviceIds, per MCP in use on any of them, per-verdict
   * counts over ALL the DEVICES, plus their coverage. Computed set — not paginated. */
  async getMcpAccessRollup(accessToken: string, deviceIds?: string[]): Promise<TraceforceApiResponse<McpAccessRollupResponse>> {
    const devices = deviceIds?.length ? `&device_ids=${deviceIds.join(',')}` : '';
    return this.makeRequest<McpAccessRollupResponse>(`/api/v1/mcp-access/status?view=rollup${devices}`, accessToken, {
      method: 'GET',
    });
  }

  /** [admin] Effective access per governed group for the given MCP(s), with
   * provenance (the winning decision, or the governing policy). Groups absent
   * from the result are ungoverned; a group_id of null is the
   * ungrouped-devices scope. Computed set — not paginated. inUse: only the
   * scopes devices using each MCP are in (in_use=true), not every governed
   * group. */
  async getMcpAccessGroupStatus(
    accessToken: string,
    mcpServerTypes: number[],
    opts: { inUse?: boolean } = {},
  ): Promise<TraceforceApiResponse<{ data: McpAccessGroupStatusDto[] }>> {
    const inUse = opts.inUse ? '&in_use=true' : '';
    return this.makeRequest<{ data: McpAccessGroupStatusDto[] }>(`/api/v1/mcp-access/status?view=groups&mcp_server_types=${mcpServerTypes.join(',')}${inUse}`, accessToken, {
      method: 'GET',
    });
  }

  /**
   * [admin] Record one access decision (allow/block) for a scope — the "Set
   * Access" act. Appends to the decision ledger (latest decision per target
   * wins over the policy verdict) and resolves every matching pending request
   * in the same transaction (allow → approved, block → denied).
   */
  async mcpDecisionAction(accessToken: string, body: DecisionActionBody): Promise<TraceforceApiResponse<DecisionActionResponse>> {
    return this.makeRequest<DecisionActionResponse>('/api/v1/mcp-access/decisions', accessToken, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /** [admin] Record several access decisions atomically (all or none). */
  async setMcpAccessDecisions(accessToken: string, decisions: DecisionActionBody[]): Promise<TraceforceApiResponse<DecisionBatchResponse>> {
    const body: DecisionBatchBody = { decisions };
    return this.makeRequest<DecisionBatchResponse>('/api/v1/mcp-access/decisions/batch', accessToken, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /**
   * [admin] Map a company policy (PDF / Word .docx) onto an existing risk framework
   * with suggested desired states (expected_value / issue_type_id).
   */
  async mapPolicyToRiskFramework(
    accessToken: string,
    args: {
      file: File;
      entityType?: 1 | 2;
      frameworkId?: string;
    },
  ): Promise<TraceforceApiResponse<MapPolicyResponse>> {
    const form = new FormData();
    form.append('file', args.file);
    if (args.entityType != null) form.append('entity_type', String(args.entityType));
    if (args.frameworkId) form.append('framework_id', args.frameworkId);

    return this.makeRequest<MapPolicyResponse>(
      '/api/v1/risk-frameworks/map-policy',
      accessToken,
      { method: 'POST', body: form },
      false,
      MAP_POLICY_TIMEOUT_MS,
    );
  }

  // ===========================================================================
  // Identity Provider (WorkOS Directory Sync) — /api/v1/settings/idp-integrations
  // ===========================================================================

  /** [admin] List the org's IdP integrations (including disconnected ones). */
  async listIdpIntegrations(accessToken: string): Promise<TraceforceApiResponse<IdpIntegrationListResponse>> {
    return this.makeRequest<IdpIntegrationListResponse>('/api/v1/settings/idp-integrations', accessToken, {
      method: 'GET',
    });
  }

  /**
   * [admin] Start the connect flow: creates the pending integration and returns a
   * single-use WorkOS Admin Portal link. There is no provider argument on purpose:
   * the admin picks their provider (and copies the SCIM endpoint + token) inside
   * the portal. 409 IDP_PENDING_SETUP_EXISTS means a setup is already in flight —
   * resume it via getIdpPortalLink instead.
   */
  async connectIdpIntegration(accessToken: string): Promise<TraceforceApiResponse<IdpConnectResponse>> {
    return this.makeRequest<IdpConnectResponse>('/api/v1/settings/idp-integrations', accessToken, {
      method: 'POST',
    });
  }

  /** [admin] Mint a fresh Admin Portal link for an existing integration (resume an
   * unfinished setup, or adjust a connected directory). Links are single-use and
   * short-lived, so this is called per click rather than cached. */
  async getIdpPortalLink(accessToken: string, id: string): Promise<TraceforceApiResponse<{ portal_url: string }>> {
    return this.makeRequest<{ portal_url: string }>(`/api/v1/settings/idp-integrations/${id}/portal-link`, accessToken, {
      method: 'POST',
    });
  }

  /** [admin] Queue an async sync run (202). Defaults to a full reconcile — the
   * "Sync Now" behavior; the run itself can take minutes on a large directory. */
  async syncIdpIntegration(
    accessToken: string,
    id: string,
    mode: 'delta' | 'reconcile' = 'reconcile',
  ): Promise<TraceforceApiResponse<IdpSyncQueuedResponse>> {
    return this.makeRequest<IdpSyncQueuedResponse>(`/api/v1/settings/idp-integrations/${id}/sync`, accessToken, {
      method: 'POST',
      body: JSON.stringify({ mode }),
    });
  }

  /** [admin] Disconnect: deletes the WorkOS directory and queues the teardown that
   * tombstones every synced group/user/membership (202, asynchronous). Retryable —
   * call again if teardown_queued came back false. */
  async deleteIdpIntegration(accessToken: string, id: string): Promise<TraceforceApiResponse<IdpDisconnectResponse>> {
    return this.makeRequest<IdpDisconnectResponse>(`/api/v1/settings/idp-integrations/${id}`, accessToken, {
      method: 'DELETE',
    });
  }

  /** [admin] Reconnect a DISCONNECTED integration in place — same row, so its
   * tombstoned groups revive on the next sync and their policy assignments
   * reattach. Returns a fresh portal link for the new directory setup. */
  async reconnectIdpIntegration(accessToken: string, id: string): Promise<TraceforceApiResponse<IdpConnectResponse>> {
    return this.makeRequest<IdpConnectResponse>(`/api/v1/settings/idp-integrations/${id}/reconnect`, accessToken, {
      method: 'POST',
    });
  }

  // ===========================================================================
  // Directory Users — /api/v1/directory-users (public API; the Directory Users
  // page reads through it so browser code never queries the database directly)
  // ===========================================================================

  /** List IdP-synced directory users, one row per user with their groups.
   * Cursor-paginated: pass the previous response's next_token verbatim to get
   * the next page; omit it for the first page. */
  async listDirectoryUsers(
    accessToken: string,
    params?: DirectoryUserListParams,
  ): Promise<TraceforceApiResponse<Paginated<DirectoryUser>>> {
    const sp = new URLSearchParams();
    if (params?.user_group_ids?.length) sp.set('user_group_ids', params.user_group_ids.join(','));
    if (params?.search) sp.set('search', params.search);
    if (params?.limit != null) sp.set('limit', String(params.limit));
    if (params?.next_token) sp.set('next_token', params.next_token);
    const q = sp.toString();
    return this.makeRequest<Paginated<DirectoryUser>>(`/api/v1/directory-users${q ? `?${q}` : ''}`, accessToken, {
      method: 'GET',
    });
  }

  async listUserGroups(
    accessToken: string,
    params?: UserGroupListParams,
  ): Promise<TraceforceApiResponse<Paginated<UserGroupListItem>>> {
    const sp = new URLSearchParams();
    if (params?.synced != null) sp.set('synced', String(params.synced));
    if (params?.include_members) sp.set('include_members', 'true');
    if (params?.search) sp.set('search', params.search);
    if (params?.sort_by) sp.set('sort_by', params.sort_by);
    if (params?.sort_order) sp.set('sort_order', params.sort_order);
    if (params?.limit != null) sp.set('limit', String(params.limit));
    if (params?.next_token) sp.set('next_token', params.next_token);
    const q = sp.toString();
    return this.makeRequest<Paginated<UserGroupListItem>>(`/api/v1/user-groups${q ? `?${q}` : ''}`, accessToken, {
      method: 'GET',
    });
  }

  async listDevices(
    accessToken: string,
    params?: DeviceListParams,
  ): Promise<TraceforceApiResponse<Paginated<DeviceListItem>>> {
    const sp = new URLSearchParams();
    if (params?.search) sp.set('search', params.search);
    if (params?.platform?.length) sp.set('platform', params.platform.join(','));
    if (params?.user_group_ids?.length) sp.set('user_group_ids', params.user_group_ids.join(','));
    if (params?.has_issues != null) sp.set('has_issues', String(params.has_issues));
    if (params?.sort_by) sp.set('sort_by', params.sort_by);
    if (params?.sort_order) sp.set('sort_order', params.sort_order);
    if (params?.limit != null) sp.set('limit', String(params.limit));
    if (params?.next_token) sp.set('next_token', params.next_token);
    const q = sp.toString();
    return this.makeRequest<Paginated<DeviceListItem>>(`/api/v1/devices${q ? `?${q}` : ''}`, accessToken, {
      method: 'GET',
    });
  }

  /** Shared cursor drain for the listAll* helpers: pages at the API's max
   * (1000) until has_more goes false, throwing on the first failed page so
   * callers surface one honest error instead of silently rendering a
   * truncated list. The thrown message goes through apiErrorText so 401/403/
   * proxy-HTML shapes reach the UI as friendly copy — consumers render it
   * raw. */
  private async drainPages<T>(
    page: (next_token: string | undefined) => Promise<TraceforceApiResponse<Paginated<T>>>,
    fallbackMsg: string,
  ): Promise<T[]> {
    const all: T[] = [];
    let next_token: string | undefined;
    do {
      const res = await page(next_token);
      if (res.error || !res.data) throw new Error(apiErrorText(res) || fallbackMsg);
      all.push(...res.data.data);
      next_token = res.data.has_more ? res.data.next_token ?? undefined : undefined;
    } while (next_token);
    return all;
  }

  /** Drain the full device list through the cursor for the Device Management
   * table, which filters and sorts client-side. */
  async listAllDevices(
    accessToken: string,
    params?: Omit<DeviceListParams, 'limit' | 'next_token'>,
  ): Promise<DeviceListItem[]> {
    return this.drainPages(
      (next_token) => this.listDevices(accessToken, { ...params, limit: 1000, next_token }),
      'Failed to load devices',
    );
  }

  async getUserGroup(
    accessToken: string,
    id: string,
  ): Promise<TraceforceApiResponse<UserGroupDetail>> {
    return this.makeRequest<UserGroupDetail>(`/api/v1/user-groups/${id}`, accessToken, {
      method: 'GET',
    });
  }

  /** Drain the full user-groups list through the cursor (max page size 1000)
   * for consumers that need every group at once — the groups tab and the
   * scoping pickers. Throws on the first failed page so callers surface one
   * error instead of silently rendering a truncated list. */
  async listAllUserGroups(
    accessToken: string,
    params?: Omit<UserGroupListParams, 'limit' | 'next_token'>,
  ): Promise<UserGroupListItem[]> {
    return this.drainPages(
      (next_token) => this.listUserGroups(accessToken, { ...params, limit: 1000, next_token }),
      'Failed to load user groups',
    );
  }

}

// Export singleton instance
export const traceforcApi = new TraceforceApiClient();

// Export class for potential custom instances
export { TraceforceApiClient };