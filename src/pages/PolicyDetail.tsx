import { useParams, useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { transformMcpName } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { MultiSelect } from "@/components/ui/multi-select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CategoryChecklistEditor } from "@/components/CategoryChecklistEditor";
import { ArrowLeft, Shield, Settings, Layers, Edit2, Check, X, Trash2, AlertTriangle, ExternalLink, Lock, Info, Power, PowerOff, Ban } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { userGroupSourceEnumFromString } from "@/lib/idpGroups";
import { fetchMcpCatalogMap } from "@/lib/mcpCatalog";
import { fetchAllRows } from "@/lib/supabasePaging";
import { useOrg } from "@/contexts/OrgContext";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { traceforcApi } from "@/integrations/traceforce/client";
import { getPolicyStatusBadge, getPolicyAssignmentBadge, getAssignmentTypeOptions, CONTROLLABLE_RISK_RULE_TYPES, getDeviceAssignmentContent, getUserGroupSourceLabel, getRemediationBadge, getRemediationDisplayName, POLICY_CATEGORY_AGENT_TYPES, POLICY_CATEGORY_LOGGING, POLICY_CATEGORY_AI_ACCESS, AGENT_TYPE_CLAUDE, getAgentDisplayName, SENSITIVE_DATA_DETECTION_DOCS_URL, SENSITIVE_DATA_HANDLING_RISK_RULE_TYPE, SENSITIVE_DATA_CATEGORY_LABELS, SENSITIVE_DATA_TYPES_BY_CATEGORY, SENSITIVE_DATA_TYPE_LABELS, SENSITIVE_DATA_ISSUE_DETAIL_ALL, normalizeSensitiveDataTypes, CONNECTOR_RISK_CONTAINMENT_RULE_TYPE, RISKY_ACTION_DETECTION_DOCS_URL, RISKY_ACTION_CATEGORY_LABELS, RISKY_ACTION_SUBCATEGORIES_BY_CATEGORY, RISKY_ACTION_SUBCATEGORY_LABELS, normalizeRiskyActionSubcategories, CONTAINMENT_ISSUE_DETAIL_NONE_DETECTED, USER_ACTIVITY_LOGGING_RISK_RULE_TYPE, MODEL_SELECTION_RISK_RULE_TYPE, getRequirementDisplayLabel } from "@/lib/appUtils";
import { ClaudeLoggingSetupDialog } from "@/components/ClaudeLoggingSetupDialog";
import PolicyOtlpForwardingCard from "@/components/PolicyOtlpForwardingCard";
import { mcpAccessEnabled } from "@/lib/featureFlags";
import { catalogToRegistryModel, isUnlistedLlmModelType, LLM_UI_FLAG, type RegistryModel } from "@/lib/llmModels";
import { useFeatureFlag } from "@/hooks/use-feature-flag";
import AppBlockControlRow from "@/components/AppBlockControlRow";

// AI Access policies (category 5) host the Blocked AI applications control.
const isAiAccessPolicy = (p: any) => p?.category === POLICY_CATEGORY_AI_ACCESS;

const ALERT_NOTIFICATION_REMEDIATION_TYPE = 2;
const BLOCK_REMEDIATION_TYPE = 4;

function isLoggingPolicy(policy: { category?: number | null } | null | undefined): boolean {
  return policy?.category === POLICY_CATEGORY_LOGGING;
}

/** Model Selection (rule 15) on the AI Access policy, behind the LLM models UI.
 * On is the rule's "Allow models of selected categories" choice (issue detail 140); off is its
 * highest choice with remediation None, as for other rules. The dialog's choices are saved in
 * policy_controls.settings.model_selection, which get_enforcement_controls resolves into the
 * allow-list the device enforces. */
const MODEL_SELECTION_ISSUE_DETAIL_ON = 140;

/** The dialog's filters: llm_host_catalog host patterns, llm_model_catalog.model_family values and
 * llm_model_type values (kept as strings for MultiSelect). An empty list leaves that filter unused;
 * with all three empty every model is blocked. */
type ModelSelection = { hosts: string[]; model_families: string[]; models: string[] };
const EMPTY_MODEL_SELECTION: ModelSelection = { hosts: [], model_families: [], models: [] };
/** The host of a settings.model_selection row that applies on every host. */
const ANY_MODEL_HOST = '*';
/** How many hosts, and how many models, the review table lists before "+N more". */
const MODEL_SELECTION_REVIEW_SHOWN = 4;

/** A catalog model with its family. */
type SelectionModel = RegistryModel & { model_family: string | null };
/** An llm_host_catalog row: a host pattern and the provider behind it. */
type SelectionHost = { host_pattern: string; provider: string };

/** settings.model_selection is a list of host rows, { hosts: [{ host, model_families, models }] }, as
 * llm_resolve_model_selection (nextjs) reads it. The dialog reads the rows back into one set of
 * filters: the rows' hosts and the union of their families and models. */
const readModelSelection = (settings: unknown): ModelSelection => {
  const ms = (settings as { model_selection?: unknown } | null | undefined)?.model_selection as
    | { hosts?: unknown; filters?: { hosts?: unknown; model_families?: unknown; models?: unknown } }
    | null
    | undefined;
  const strings = (value: unknown) =>
    Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && v.trim() !== '') : [];
  const nums = (value: unknown) =>
    Array.isArray(value) ? value.filter((v) => Number.isInteger(v)).map(String) : [];
  const unique = (values: string[]) => Array.from(new Set(values));
  const rows = ms?.hosts;
  // Legacy shape (pre per-host rows): model_selection.filters.{hosts, model_families, models}. Read it
  // so opening such a policy doesn't show empty and silently overwrite it on save - it normalizes to
  // the per-host { hosts: [...] } shape the moment it is saved.
  if (!Array.isArray(rows) && ms?.filters && typeof ms.filters === 'object') {
    const f = ms.filters;
    const legacyHosts = strings(f.hosts);
    return {
      hosts: legacyHosts.some((h) => h === ANY_MODEL_HOST) ? [] : unique(legacyHosts),
      model_families: unique(strings(f.model_families)),
      models: unique(nums(f.models)),
    };
  }
  if (!Array.isArray(rows)) return EMPTY_MODEL_SELECTION;
  type Row = { host: string; model_families?: unknown; models?: unknown };
  const valid = rows.filter((row): row is Row =>
    !!row && typeof row === 'object' && typeof row.host === 'string' && row.host.trim() !== '');
  return {
    hosts: valid.some((row) => row.host === ANY_MODEL_HOST) ? [] : unique(valid.map((row) => row.host)),
    model_families: unique(valid.flatMap((row) => strings(row.model_families))),
    models: unique(valid.flatMap((row) => nums(row.models))),
  };
};

const isModelSelectionEmpty = (selection: ModelSelection) =>
  selection.hosts.length === 0 && selection.model_families.length === 0 && selection.models.length === 0;

/** True when a host actually serves a model: the host's provider is in the model's hosted_by
 * (deployment_types). Drives the dialog's cascade (which families/models a host offers) and the
 * per-host sanitize on save - the device resolver still ignores hosted_by at runtime, so enforcement
 * stays decoupled from this mapping. */
const isModelServableOnHost = (model: SelectionModel, host: string, hosts: SelectionHost[]): boolean => {
  const providers = hosts.filter((h) => h.host_pattern === host).map((h) => h.provider);
  const served = Array.isArray(model.deployment_types) ? model.deployment_types : [];
  return providers.some((p) => served.includes(p));
};

/** The dropdown options. The dialog cascades Host -> Family -> Model: when a host is chosen, only the
 * models it can serve count (union across the chosen hosts), so the Family list is those models'
 * families and the Model list is those models narrowed to the chosen families. No host chosen = the
 * whole catalog. */
const modelSelectionOptions = (selection: ModelSelection, models: SelectionModel[], hosts: SelectionHost[]) => {
  const onSelectedHosts = (m: SelectionModel) =>
    selection.hosts.length === 0 || selection.hosts.some((h) => isModelServableOnHost(m, h, hosts));
  const hostModels = models.filter(onSelectedHosts);
  const inFamilies = selection.model_families.length
    ? hostModels.filter((m) => m.model_family !== null && selection.model_families.includes(m.model_family))
    : hostModels;
  return {
    hosts: Array.from(new Set(hosts.map((h) => h.host_pattern))).sort().map((h) => ({ id: h, name: h })),
    families: Array.from(new Set(hostModels.flatMap((m) => (m.model_family ? [m.model_family] : [])))).sort().map((f) => ({ id: f, name: f })),
    models: inFamilies.map((m) => ({ id: String(m.llm_model_type), name: m.model_name })),
  };
};

type ModelSelectionRow = { host: string; model_families: string[]; models: number[] };

/** Turns one flat selection into the per-host rows we save, sanitized per host: a chosen model or
 * family a host can't serve is dropped from that host. It stays ONE combined filter - we never ask
 * for different lists per host; the per-host differences are only what each host can actually serve.
 * Families stay dynamic (not materialized to ids) so future catalog models are still covered. The
 * ANY_MODEL_HOST row is left as-is (host unknown). A host left with none of the chosen models/families
 * is dropped, because an empty row would read as "no constraint" = allow everything there. */
const buildModelSelectionRows = (
  selection: ModelSelection,
  models: SelectionModel[],
  hosts: SelectionHost[],
): { rows: ModelSelectionRow[] } => {
  const modelById = new Map(models.map((m) => [String(m.llm_model_type), m] as const));
  const hadPicks = selection.model_families.length > 0 || selection.models.length > 0;
  const targetHosts = selection.hosts.length ? selection.hosts : [ANY_MODEL_HOST];
  const rows: ModelSelectionRow[] = [];
  for (const host of targetHosts) {
    if (host === ANY_MODEL_HOST) {
      rows.push({ host, model_families: selection.model_families, models: selection.models.map(Number) });
      continue;
    }
    const servable = (m: SelectionModel) => isModelServableOnHost(m, host, hosts);
    const keptFamilies = selection.model_families.filter((f) =>
      models.some((m) => m.model_family === f && servable(m)));
    const keptModelIds = selection.models.filter((id) => {
      const m = modelById.get(id);
      return !!m && servable(m);
    });
    // A host that serves none of the chosen models/families is dropped - an empty row would read as
    // "no constraint" = allow everything there.
    if (hadPicks && keptFamilies.length === 0 && keptModelIds.length === 0) continue;
    rows.push({ host, model_families: keptFamilies, models: keptModelIds.map(Number) });
  }
  return { rows };
};

/** The rows a selection saves: one per chosen host with only the models/families that host can serve
 * (see buildModelSelectionRows), or one ANY_MODEL_HOST row when no host is chosen. Nothing selected
 * stays { hosts: [] } (block every model). */
const toModelSelectionSettings = (selection: ModelSelection, models: SelectionModel[], hosts: SelectionHost[]) => {
  if (isModelSelectionEmpty(selection)) return { hosts: [] };
  return { hosts: buildModelSelectionRows(selection, models, hosts).rows };
};

type ModelSelectionReviewRow = {
  hosts: string[];
  families: { family: string; allowed: number; total: number }[];
  models: SelectionModel[];
};

/** Rows for the dialog's "Review allowed models" table. Each saved host is resolved to its allowed
 * models (Host AND Family AND Model, mirroring llm_resolve_model_selection); hosts that end up
 * allowing the exact same set (e.g. api.anthropic.com + claude.ai) are combined into one row. Also
 * returns the de-duplicated union of allowed models across hosts. */
const modelSelectionReviewRows = (selection: ModelSelection, models: SelectionModel[], hosts: SelectionHost[]) => {
  // Nothing selected = block every model. buildModelSelectionRows would otherwise emit an unconstrained
  // '*' row (= allow all), so short-circuit to an empty result here.
  if (isModelSelectionEmpty(selection)) {
    return { reviewRows: [] as ModelSelectionReviewRow[], unionAllowed: [] as SelectionModel[] };
  }
  const familyOf = (m: SelectionModel) => m.model_family ?? '-';
  const familyTotal = (family: string) => models.filter((m) => familyOf(m) === family).length;
  const { rows } = buildModelSelectionRows(selection, models, hosts);
  const resolveAllowed = (row: ModelSelectionRow): SelectionModel[] => {
    const famSet = row.model_families.length ? new Set(row.model_families) : null;
    const modSet = row.models.length ? new Set(row.models.map(String)) : null;
    return models.filter((m) => {
      if (famSet && (m.model_family === null || !famSet.has(m.model_family))) return false;
      if (modSet && !modSet.has(String(m.llm_model_type))) return false;
      return true;
    });
  };
  // Combine hosts whose resolved allowed set is identical into one row, keyed by the sorted model ids.
  const groups = new Map<string, { hosts: string[]; allowed: SelectionModel[] }>();
  for (const row of rows) {
    const allowed = resolveAllowed(row);
    const key = allowed.map((m) => m.llm_model_type).sort((a, b) => a - b).join(',');
    const group = groups.get(key);
    if (group) group.hosts.push(row.host);
    else groups.set(key, { hosts: [row.host], allowed });
  }
  const reviewRows: ModelSelectionReviewRow[] = Array.from(groups.values()).map((group) => {
    const families = Array.from(new Set(group.allowed.map(familyOf))).sort().map((family) => ({
      family,
      allowed: group.allowed.filter((m) => familyOf(m) === family).length,
      total: familyTotal(family),
    }));
    return { hosts: group.hosts, families, models: group.allowed };
  });
  const unionAllowed = Array.from(
    new Map(reviewRows.flatMap((r) => r.models).map((m) => [m.llm_model_type, m] as const)).values(),
  );
  return { reviewRows, unionAllowed };
};

/** Summary of what a selection allows, for the "Effective model access" line and the control-row
 * subtitle: the union of allowed models across hosts, and the kept hosts (null = any host). */
const previewModelSelection = (selection: ModelSelection, models: SelectionModel[], hosts: SelectionHost[]) => {
  if (isModelSelectionEmpty(selection)) {
    return { allowedModels: [] as SelectionModel[], destinations: null as string[] | null };
  }
  const { reviewRows, unionAllowed } = modelSelectionReviewRows(selection, models, hosts);
  const destinations = selection.hosts.length
    ? reviewRows.flatMap((r) => r.hosts).filter((h) => h !== ANY_MODEL_HOST)
    : null;
  return { allowedModels: unionAllowed, destinations };
};

/** Drops family and model choices the lists above them no longer offer, cascading Host -> Family ->
 * Model. Runs on every dropdown change (updateModelSelection), so removing a host or family also
 * drops any family/model it no longer allows. */
const pruneModelSelection = (selection: ModelSelection, models: SelectionModel[], hosts: SelectionHost[]): ModelSelection => {
  const families = new Set(modelSelectionOptions(selection, models, hosts).families.map((o) => o.id));
  const withFamilies = { ...selection, model_families: selection.model_families.filter((f) => families.has(f)) };
  const modelIds = new Set(modelSelectionOptions(withFamilies, models, hosts).models.map((o) => o.id));
  return { ...withFamilies, models: selection.models.filter((id) => modelIds.has(id)) };
};

interface McpCompatRow {
  mcp_server_type: number;
  risk_rule_id: string;
  remediation_id: string;
  is_available: boolean;
}

// Drains the compatibility set for the given types (or the whole table when
// omitted), optionally scoped to specific risk rules. Chunked .in() keeps the
// URL bounded, and each chunk is paged past PostgREST's 1000-row cap — a
// policy's assigned types alone can hold thousands of compat rows. The triple
// ORDER BY is the table's unique key, so .range() pages partition
// deterministically.
const COMPAT_IN_CHUNK = 500;
async function fetchCompatRows(types?: number[], riskRuleIds?: string[]): Promise<McpCompatRow[]> {
  const chunks: (number[] | undefined)[] = [];
  if (types === undefined) {
    chunks.push(undefined);
  } else {
    if (types.length === 0) return [];
    for (let i = 0; i < types.length; i += COMPAT_IN_CHUNK) {
      chunks.push(types.slice(i, i + COMPAT_IN_CHUNK));
    }
  }
  const rows: McpCompatRow[] = [];
  for (const chunk of chunks) {
    rows.push(
      ...(await fetchAllRows<McpCompatRow>((from, to) => {
        let query = supabase
          .from('mcp_remediation_compatibility')
          .select('mcp_server_type, risk_rule_id, remediation_id, is_available');
        if (chunk) query = query.in('mcp_server_type', chunk);
        if (riskRuleIds?.length) query = query.in('risk_rule_id', riskRuleIds);
        return query
          .order('mcp_server_type')
          .order('risk_rule_id')
          .order('remediation_id')
          .range(from, to);
      })),
    );
  }
  return rows;
}

const groupCompatByType = (rows: McpCompatRow[]): Map<number, McpCompatRow[]> => {
  const byType = new Map<number, McpCompatRow[]>();
  for (const row of rows) {
    const list = byType.get(row.mcp_server_type);
    if (list) list.push(row);
    else byType.set(row.mcp_server_type, [row]);
  }
  return byType;
};

const getAssignmentContent = (policy: any, selectedEntities: any[]) => {
  if (policy.assignment_type === 2 && selectedEntities.length > 0) {
    return (
      <div className="space-y-2">
        <div>
          {getPolicyAssignmentBadge(policy.assignment_type, policy.framework_entity_type, policy.entity_count)}
        </div>
        <div className="space-y-1">
          {selectedEntities.slice(0, 3).map(entity => (
            <div key={entity.id} className="text-sm text-muted-foreground">
              {entity.name}
            </div>
          ))}
          {selectedEntities.length > 3 && (
            <div className="text-sm text-muted-foreground">
              +{selectedEntities.length - 3} more
            </div>
          )}
        </div>
      </div>
    );
  }
  
  return getPolicyAssignmentBadge(policy.assignment_type, policy.framework_entity_type, policy.entity_count);
};

const PolicyDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { session } = useAuth();
  const { enabled: llmEnabled } = useFeatureFlag(LLM_UI_FLAG);
  const { activeOrgId } = useOrg();
  const [customerStorage, setCustomerStorage] = useState<any>(null);
  const [customerStorageLoaded, setCustomerStorageLoaded] = useState(false);
  const [policy, setPolicy] = useState<any>(null);
  const [controls, setControls] = useState<any>({});
  const [policyLoading, setPolicyLoading] = useState(true);
  const [controlsLoading, setControlsLoading] = useState(true);
  // Bumped to reload controls from the DB after an RPC that mutates them server-side.
  const [controlsRefreshKey, setControlsRefreshKey] = useState(0);
  const [editingControl, setEditingControl] = useState<any>(null);
  const [showEditControlDialog, setShowEditControlDialog] = useState(false);
  const [editedIssueTypeControlId, setEditedIssueTypeControlId] = useState<string | null>(null);
  const [editedRemediationControlId, setEditedRemediationControlId] = useState<string | null>(null);
  const [editedRedactAuditLogs, setEditedRedactAuditLogs] = useState<boolean>(true);
  // null = "all in-scope types" (the clean default); [] = "explicitly none"
  // (invalid, blocks Save); non-empty = an explicit subset. The null vs []
  // distinction is what lets unselect-all be caught instead of collapsing to "all".
  const [editedSensitiveDataTypes, setEditedSensitiveDataTypes] = useState<number[] | null>(null);
  // Risky Action Handling (rule 19) subcategory allowlist: null = "all detected"
  // (default), non-empty = the explicit included set, [] = none (invalid, blocks
  // Save). Persists to policy_controls.settings.enabled_risky_action_subcategories
  // (flat included list, same contract as enabled_sensitive_data_types). The
  // per-category Switch is a bulk add/remove over this list.
  const [editedRiskyActionSubcategories, setEditedRiskyActionSubcategories] = useState<number[] | null>(null);
  const [editingPolicy, setEditingPolicy] = useState(false);
  const [editedPolicyName, setEditedPolicyName] = useState<string>("");
  // Inline name-collision error under the name input (field errors live
  // inline; system errors stay toasts).
  const [policyNameError, setPolicyNameError] = useState<string | null>(null);
  const [editedPolicyDescription, setEditedPolicyDescription] = useState<string>("");
  const [remediations, setRemediations] = useState<any[]>([]);
  const [selectedEntities, setSelectedEntities] = useState<any[]>([]);
  const [editingAssignment, setEditingAssignment] = useState(false);
  const [editedAssignmentType, setEditedAssignmentType] = useState<string>("");
  const [editedEntityIds, setEditedEntityIds] = useState<string[]>([]);
  const [availableEntities, setAvailableEntities] = useState<any[]>([]);
  const [showClaudeSetupDialog, setShowClaudeSetupDialog] = useState(false);
  const [issueTypesByRiskRule, setIssueTypesByRiskRule] = useState<Record<string, { options: any[], disabledOption: any | null }>>({});
  const [remediationsLoaded, setRemediationsLoaded] = useState(false);
  const [entitiesLoaded, setEntitiesLoaded] = useState(false);
  const [selectedUserGroups, setSelectedUserGroups] = useState<any[]>([]);
  const [editingDeviceAssignment, setEditingDeviceAssignment] = useState(false);
  const [editedDeviceAssignmentType, setEditedDeviceAssignmentType] = useState<string>("");
  const [editedUserGroupIds, setEditedUserGroupIds] = useState<string[]>([]);
  const [availableUserGroups, setAvailableUserGroups] = useState<any[]>([]);
  const [userGroupsLoaded, setUserGroupsLoaded] = useState(false);
  const [showToggleStatusDialog, setShowToggleStatusDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDisableControlDialog, setShowDisableControlDialog] = useState(false);
  const [pendingDisableControl, setPendingDisableControl] = useState<any>(null);
  // The Model Selection dialog edits the rule-15 control through the shared control-edit state
  // (editingControl / editedIssueTypeControlId / editedRemediationControlId); these hold its choices.
  const [showModelSelectionDialog, setShowModelSelectionDialog] = useState(false);
  const [modelSelectionStep, setModelSelectionStep] = useState<'configure' | 'review'>('configure');
  const [modelSelection, setModelSelection] = useState<ModelSelection>(EMPTY_MODEL_SELECTION);
  const [showAllReviewHosts, setShowAllReviewHosts] = useState(false);
  const [showAllReviewModels, setShowAllReviewModels] = useState(false);
  const [modelSelectionSaving, setModelSelectionSaving] = useState(false);
  const [llmCatalogModels, setLlmCatalogModels] = useState<SelectionModel[] | null>(null);
  const [llmHosts, setLlmHosts] = useState<SelectionHost[] | null>(null);
  const [llmCatalogLoading, setLlmCatalogLoading] = useState(false);
  const [llmCatalogError, setLlmCatalogError] = useState<string | null>(null);
   const [highlightStorageWarning, setHighlightStorageWarning] = useState(false);
   const storageWarningRef = useRef<HTMLDivElement>(null);

   const storageNotConfigured = customerStorageLoaded && !customerStorage;
   const storageHasError = customerStorageLoaded && customerStorage?.is_customer_error;

  useEffect(() => {
    if (!session?.access_token) return;
    traceforcApi.getCustomerStorage(session.access_token).then(response => {
      setCustomerStorage(response.data || null);
      setCustomerStorageLoaded(true);
    }).catch(() => setCustomerStorageLoaded(true));
  }, [session?.access_token]);

  useEffect(() => {
    const fetchPolicyData = async () => {
      if (!id) return;

      setPolicyLoading(true);
      try {
        // Query 1: Fetch policy with framework join
        const policyResult = await supabase
          .from('policies_with_metadata')
          .select(`
            id,
            name,
            description,
            policy_status,
            created_at,
            updated_at,
            framework_id,
            assignment_type,
            employee_assignment_type,
            has_incomplete_controls,
            org_id,
            category,
            is_default,
            risk_framework!inner (
              name,
              entity_type
            )
          `)
          .eq('org_id', activeOrgId!)
          .eq('id', id)
          .single();

        if (policyResult.error) throw policyResult.error;

        const mappedPolicy = {
          id: policyResult.data.id,
          name: policyResult.data.name,
          description: policyResult.data.description,
          policy_status: policyResult.data.policy_status,
          created_at: policyResult.data.created_at,
          updated_at: policyResult.data.updated_at,
          framework_id: policyResult.data.framework_id,
          framework_name: policyResult.data.risk_framework.name,
          framework_entity_type: policyResult.data.risk_framework.entity_type,
          assignment_type: policyResult.data.assignment_type,
          employee_assignment_type: policyResult.data.employee_assignment_type,
          has_incomplete_controls: policyResult.data.has_incomplete_controls,
          org_id: policyResult.data.org_id,
          category: policyResult.data.category,
          is_default: policyResult.data.is_default,
          entity_count: 0
        };

        // MCP access policies (category 4) have no surface here: this page is
        // the scan-policy editor (framework rules, issue types, remediations),
        // all meaningless — and mis-editable — for an access policy. Bounce to
        // their dedicated editor (or the list when the feature is off).
        if (mappedPolicy.category === 4) {
          navigate(mcpAccessEnabled ? `/policies/${id}/access` : '/policies', { replace: true, state: location.state });
          return;
        }

        // Query 2: Fetch assigned agents or MCPs based on entity type
        let assignedEntities: any[] = [];
        let entityCount = 0;

        if (mappedPolicy.assignment_type === 2) {
          if (mappedPolicy.framework_entity_type === 1) {
            // Fetch assigned agents with catalog names via FK
            const agentsResult = await supabase
              .from('policy_agents')
              .select('agent_type, agent_catalog!inner(agent_name, agent_remediation_compatibility(risk_rule_id, remediation_id, is_available))')
              .eq('policy_id', id);

            if (agentsResult.error) throw agentsResult.error;

            const uniqueAgents = new Map<number, any>();
            for (const item of agentsResult.data || []) {
              if (!uniqueAgents.has(item.agent_type)) {
                uniqueAgents.set(item.agent_type, {
                  id: String(item.agent_type),
                  name: getAgentDisplayName(mappedPolicy.category, item.agent_type, item.agent_catalog.agent_name),
                  catalogName: item.agent_catalog.agent_name,
                  catalogType: item.agent_type,
                  compatibility: item.agent_catalog.agent_remediation_compatibility || []
                });
              }
            }
            assignedEntities = Array.from(uniqueAgents.values());
            entityCount = assignedEntities.length;
          } else if (mappedPolicy.framework_entity_type === 2) {
            // Fetch assigned MCP types, then resolve names via the combined
            // catalog (mcp_catalog_all is a UNION view with no PostgREST
            // relationship to embed, and org-catalog types only exist there).
            // Compatibility is keyed by mcp_server_type, so it fetches
            // separately for the same types.
            const mcpsResult = await supabase
              .from('policy_mcp_servers')
              .select('mcp_server_type')
              .eq('policy_id', id);

            if (mcpsResult.error) throw mcpsResult.error;

            const mcpTypes = (mcpsResult.data || []).map((item: any) => item.mcp_server_type);
            const [catalogMap, compatRows] = await Promise.all([
              fetchMcpCatalogMap(activeOrgId!, mcpTypes),
              fetchCompatRows(mcpTypes),
            ]);

            const compatByType = groupCompatByType(compatRows);

            assignedEntities = (mcpsResult.data || []).map((item: any) => {
              // A type missing from the map (e.g. a catalog entry removed after
              // assignment) keeps its row with the fallback name.
              const name = transformMcpName(catalogMap.get(item.mcp_server_type)?.mcp_server_name || 'Unknown connector');
              return {
                id: String(item.mcp_server_type),
                name,
                catalogName: name,
                catalogType: item.mcp_server_type,
                compatibility: compatByType.get(item.mcp_server_type) || []
              };
            });
            entityCount = assignedEntities.length;
          }
        }

        mappedPolicy.entity_count = entityCount;

        // Query 3: Fetch assigned user groups
        let assignedUserGroups: any[] = [];
        if (mappedPolicy.employee_assignment_type === 2) {
          // deleted_at rides along: attachments deliberately SURVIVE on
          // tombstoned (disconnected) IdP groups so a reconnect restores the
          // policy wiring. They are HIDDEN everywhere on this page (product
          // decision) — the deleted flag keeps them out of the UI while their
          // ids keep round-tripping through saves, never silently dropped.
          const userGroupsResult = await supabase
            .from('policy_user_groups')
            .select(`
              user_groups!inner (
                id,
                name,
                user_group_source,
                deleted_at
              )
            `)
            .eq('policy_id', id);

          if (userGroupsResult.error) throw userGroupsResult.error;

          assignedUserGroups = (userGroupsResult.data || []).map((item: any) => ({
            id: item.user_groups.id,
            name: `${item.user_groups.name} (${getUserGroupSourceLabel(item.user_groups.user_group_source)})`,
            deleted: !!item.user_groups.deleted_at,
          }));
        }
        (mappedPolicy as any).user_group_count = assignedUserGroups.filter((g: any) => !g.deleted).length;

        setPolicy(mappedPolicy);
        setSelectedEntities(assignedEntities);
        setSelectedUserGroups(assignedUserGroups);
      } catch (error) {
        console.error('Error fetching policy data:', error);
        toast({
          title: "Error",
          description: "Failed to load policy details",
          variant: "destructive",
        });
      } finally {
        setPolicyLoading(false);
      }
    };

    fetchPolicyData();
  }, [id, toast, activeOrgId]);

  useEffect(() => {
    // Ignore a response that lands after the route (or refresh key) moved on: the previous
    // policy's controls must never replace the current policy's, or anything rendered from
    // `controls` (the OTLP forwarding card saves back to it) would act on the wrong policy.
    let cancelled = false;
    const fetchPolicyControls = async () => {
      if (!id) return;

      setControlsLoading(true);
      try {
        const controlsResult = await supabase
          .from('policy_controls')
          .select(`
            id,
            issue_type_control_id,
            remediation_control_id,
            settings,
            risk_framework_rules!inner (
              id,
              risk_rules!inner (
                id,
                name,
                description,
                scoring_criteria,
                display_order,
                risk_rule_type,
                risk_categories!inner (
                  id,
                  name,
                  display_order
                )
              )
            ),
            remediation_controls (
              remediations!inner (
                name,
                remediation_type
              )
            ),
            issue_type_controls (
              id,
              issue_types (
                expected_value
              )
            )
          `)
          .eq('policy_id', id);

        if (controlsResult.error) throw controlsResult.error;

        const mappedControls = (controlsResult.data || [])
          .map((control: any) => ({
            id: control.id,
            issue_type_control_id: control.issue_type_control_id,
            expected_value: control.issue_type_controls?.issue_types?.expected_value || null,
            remediation_control_id: control.remediation_control_id,
            risk_rule_id: control.risk_framework_rules.risk_rules.id,
            rule_id: control.risk_framework_rules.id,
            rule_name: control.risk_framework_rules.risk_rules.name,
            rule_description: control.risk_framework_rules.risk_rules.description,
            scoring_criteria: control.risk_framework_rules.risk_rules.scoring_criteria,
            risk_rule_type: control.risk_framework_rules.risk_rules.risk_rule_type,
            rule_display_order: control.risk_framework_rules.risk_rules.display_order,
            category_id: control.risk_framework_rules.risk_rules.risk_categories.id,
            category_name: control.risk_framework_rules.risk_rules.risk_categories.name,
            category_display_order: control.risk_framework_rules.risk_rules.risk_categories.display_order,
            action: control.remediation_controls?.remediations?.name || null,
            remediation_type: control.remediation_controls?.remediations?.remediation_type || null,
            settings: control.settings || {},
            redact_audit_logs: control.settings?.redact_audit_logs !== false,
            enabled_sensitive_data_types: Array.isArray(control.settings?.enabled_sensitive_data_types) ? control.settings.enabled_sensitive_data_types : [],
            enabled_risky_action_subcategories: control.settings?.enabled_risky_action_subcategories ?? null
          }))
          .sort((a, b) => {
            if (a.category_display_order !== b.category_display_order) {
              return a.category_display_order - b.category_display_order
            }
            return a.rule_display_order - b.rule_display_order
          });

        const controllable: any = {};
        const acknowledgement: any = {};
        for (const control of mappedControls) {
          const target = CONTROLLABLE_RISK_RULE_TYPES.has(control.risk_rule_type) ? controllable : acknowledgement;
          if (!target[control.category_name]) target[control.category_name] = [];
          target[control.category_name].push(control);
        }

        if (cancelled) return;
        setControls({ controllable, acknowledgement });
      } catch (error) {
        if (cancelled) return;
        console.error('Error fetching policy controls:', error);
        toast({
          title: "Error",
          description: "Failed to load policy controls",
          variant: "destructive",
        });
      } finally {
        if (!cancelled) setControlsLoading(false);
      }
    };

    fetchPolicyControls();
    return () => { cancelled = true; };
  }, [id, toast, controlsRefreshKey]);

  useEffect(() => {
    const fetchIssueTypes = async () => {
      try {
        const { data, error } = await supabase
          .from('issue_type_controls')
          .select('id, issue_types!inner(id, risk_rule_id, expected_value, trigger_score, applicable_to, issue_detail)')
          // Scope to the active org — under the U-series subtree-broadened RLS this same
          // org-partitioned table would otherwise merge trigger-score options across every accessible
          // org (matches the sibling reads at AgentIssuesTable / McpIssuesTable).
          .eq('org_id', activeOrgId!)
          .not('issue_types.expected_value', 'is', null)
          .eq('issue_types.applicable_to', 1)
          .order('issue_types(trigger_score)', { ascending: true });

        if (error) throw error;

        // Group by risk_rule_id, sorted ascending by trigger_score
        // Dedup by expected_value within each rule, keeping the lower trigger_score
        const allByRule: Record<string, any[]> = {};
        (data || []).forEach((itc: any) => {
          const ruleId = itc.issue_types.risk_rule_id;
          if (!allByRule[ruleId]) allByRule[ruleId] = [];
          const existing = allByRule[ruleId].find(
            (item: any) => item.expected_value === itc.issue_types.expected_value
          );
          if (!existing) {
            allByRule[ruleId].push({
              id: itc.id,
              expected_value: itc.issue_types.expected_value,
              trigger_score: itc.issue_types.trigger_score,
              issue_detail: itc.issue_types.issue_detail,
            });
          }
        });

        // Separate max (disabled) from selectable options per rule
        const grouped: Record<string, { options: any[], disabledOption: any | null }> = {};
        for (const [ruleId, items] of Object.entries(allByRule)) {
          if (items.length <= 1) {
            grouped[ruleId] = { options: [], disabledOption: items[0] || null };
          } else {
            grouped[ruleId] = {
              options: items.slice(0, -1),
              disabledOption: items[items.length - 1],
            };
          }
        }
        setIssueTypesByRiskRule(grouped);
      } catch (error) {
        console.error('Error fetching issue types:', error);
      }
    };
    fetchIssueTypes();
  }, [activeOrgId]);

  useEffect(() => {
    const fetchRemediationControls = async () => {
      try {
        const { data, error } = await supabase
          .from('remediation_controls')
          .select(`
            id,
            remediation_id,
            remediations!inner (
              name,
              scope,
              remediation_type,
              is_enforcement
            )
          `)
          // Scope to the active org — under the U-series subtree-broadened RLS this org-partitioned
          // table would otherwise merge remediation-control options across every accessible org
          // (same pattern as the issue_type_controls read above).
          .eq('org_id', activeOrgId!)
          .order('remediations(name)', { ascending: true });

        if (error) throw error;

        const mappedRemediations = (data || []).map((item: any) => ({
          id: item.id,
          remediation_id: item.remediation_id,
          name: item.remediations.name,
          scope: item.remediations.scope,
          remediation_type: item.remediations.remediation_type,
          is_enforcement: item.remediations.is_enforcement
        }));
        
        setRemediations(mappedRemediations);
        setRemediationsLoaded(true);
      } catch (error) {
        console.error('Error fetching remediation controls:', error);
        setRemediationsLoaded(false);
      }
    };

    fetchRemediationControls();
  }, [activeOrgId]);

  // Model Selection is checked on every AI request the device sees, whichever agent sent it. So on
  // the AI Access policy its Block doesn't depend on the policy's agents or on compatibility rows:
  // it is offered on "All agents" too, and it never limits which agents the policy can have.
  const isAgentIndependentRule = (riskRuleId: string) =>
    isAiAccessPolicy(policy) &&
    ([...Object.values(controls.controllable || {}).flat(), ...Object.values(controls.acknowledgement || {}).flat()] as any[])
      .some((c: any) => c.risk_rule_id === riskRuleId && c.risk_rule_type === MODEL_SELECTION_RISK_RULE_TYPE);

  useEffect(() => {
    const fetchAvailableEntities = async () => {
      if (!policy) return;

      // Hoisted from filterEligible: the MCP branch also gates its compat
      // fetch on whether any device-scoped remediation is configured at all.
      const allControls = [...Object.values(controls.controllable || {}).flat(), ...Object.values(controls.acknowledgement || {}).flat()] as any[];
      // Model Selection's Block never limits the agents (see isAgentIndependentRule).
      const scopedRequirements = allControls
        .filter((c: any) => c.remediation_control_id &&
          !(c.risk_rule_type === MODEL_SELECTION_RISK_RULE_TYPE && isAiAccessPolicy(policy)))
        .map((c: any) => {
          const rem = remediations.find((r: any) => r.id === c.remediation_control_id);
          return rem?.scope === 2 ? { risk_rule_id: c.risk_rule_id, remediation_id: rem.remediation_id } : null;
        })
        .filter(Boolean);

      const filterEligible = (entities: any[]) => {
        if (scopedRequirements.length === 0) return entities;

        return entities.filter((e: any) =>
          scopedRequirements.every((req: any) =>
            (e.compatibility || []).some((c: any) => c.risk_rule_id === req.risk_rule_id && c.remediation_id === req.remediation_id)
          )
        );
      };

      try {
        if (policy.framework_entity_type === 1) {
          // Fetch available agents from catalog
          const { data, error } = await supabase
            .from('agent_catalog')
            .select('agent_type, agent_name, agent_remediation_compatibility(risk_rule_id, remediation_id, is_available)')
            .order('agent_name', { ascending: true });

          if (error) throw error;

          const mappedAgents = (data || []).map((catalog: any) => ({
            id: String(catalog.agent_type),
            name: getAgentDisplayName(policy.category, catalog.agent_type, catalog.agent_name),
            catalogName: catalog.agent_name,
            catalogType: catalog.agent_type,
            compatibility: catalog.agent_remediation_compatibility || []
          }));

          // Categories with a defined agent allow-list (General Purpose, Coding, Logging)
          // are restricted to it; categories without one (uncategorized) allow any agent.
          const allowedAgentTypes = POLICY_CATEGORY_AGENT_TYPES[policy.category];
          const filteredAgents = allowedAgentTypes
            ? mappedAgents.filter((a: any) => allowedAgentTypes.includes(Number(a.id)))
            : mappedAgents;
          setAvailableEntities(filterEligible(filteredAgents));
          setEntitiesLoaded(true);
        } else if (policy.framework_entity_type === 2) {
          // Fetch available MCPs from the catalog. Compat feeds filterEligible
          // only, so skip that read entirely when no device-scoped remediation
          // is configured, and scope it to the configured rules otherwise —
          // the table holds thousands of rows.
          const catalogMap = await fetchMcpCatalogMap(activeOrgId!);
          const compatByType = scopedRequirements.length === 0
            ? new Map<number, McpCompatRow[]>()
            : groupCompatByType(await fetchCompatRows(
                undefined,
                [...new Set(scopedRequirements.map((req: any) => req.risk_rule_id))] as string[],
              ));

          // Global entries only: policy_mcp_servers still FKs
          // mcp_catalog.mcp_server_type, so an org-catalog assignment cannot
          // be persisted — expose org entries once that FK is relaxed.
          const mappedMcps = [...catalogMap.values()]
            .filter((mcp) => mcp.org_id === null)
            .sort((a, b) => a.mcp_server_name.localeCompare(b.mcp_server_name))
            .map((mcp) => ({
              id: String(mcp.mcp_server_type),
              name: transformMcpName(mcp.mcp_server_name),
              catalogName: transformMcpName(mcp.mcp_server_name),
              catalogType: mcp.mcp_server_type,
              compatibility: compatByType.get(mcp.mcp_server_type) || []
            }));

          setAvailableEntities(filterEligible(mappedMcps));
          setEntitiesLoaded(true);
        }
      } catch (error) {
        console.error('Error fetching available entities:', error);
        setEntitiesLoaded(false);
      }
    };

    fetchAvailableEntities();
  }, [policy, controls, remediations]);

  const fetchAvailableUserGroups = async () => {
    if (!policy || !session?.access_token) return;

    try {
      // GET /api/v1/user-groups: live groups only, server-side (tombstoned IdP
      // groups must not be offered for NEW assignment). Groups that are
      // already attached stay hidden everywhere (visibleUserGroups); their
      // attachment ids are preserved at SAVE time instead — see the ghost
      // handling in handleSaveDeviceAssignment. The client drains the cursor
      // so a big directory can't truncate the picker.
      const data = await traceforcApi.listAllUserGroups(session.access_token);

      const mapped = data.map((g) => ({
        id: g.id,
        name: `${g.name} (${getUserGroupSourceLabel(userGroupSourceEnumFromString(g.source))})`
      }));

      setAvailableUserGroups(mapped);
      setUserGroupsLoaded(true);
    } catch (error) {
      console.error('Error fetching available user groups:', error);
      setUserGroupsLoaded(false);
    }
  };

  useEffect(() => {
    fetchAvailableUserGroups();
  }, [policy, activeOrgId]);

  // Re-fetch user groups when tab regains focus (e.g. after creating groups in another tab)
  useEffect(() => {
    const onFocus = () => fetchAvailableUserGroups();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [policy]);

  // The Model Selection row summarises its saved selection against the LLM catalogs.
  useEffect(() => {
    if (llmEnabled && isAiAccessPolicy(policy)) loadModelSelectionCatalogs();
  }, [llmEnabled, policy?.category, session?.access_token]);

  const cancelAllEdits = () => {
    setPolicyNameError(null);
    // Cancel control edits
    setEditingControl(null);
    setShowEditControlDialog(false);
    setShowModelSelectionDialog(false);
    setEditedIssueTypeControlId(null);
    setEditedRemediationControlId(null);
    setEditedRedactAuditLogs(true);
    setEditedSensitiveDataTypes(null);
    setEditedRiskyActionSubcategories(null);

    // Cancel policy edits
    setEditingPolicy(false);
    setEditedPolicyName("");
    setEditedPolicyDescription("");
    
    // Cancel assignment edits
    setEditingAssignment(false);
    setEditedAssignmentType("");
    setEditedEntityIds([]);

    // Cancel device assignment edits
    setEditingDeviceAssignment(false);
    setEditedDeviceAssignmentType("");
    setEditedUserGroupIds([]);
  };

  const handleEditControl = (control: any) => {
    cancelAllEdits();
    setEditingControl(control);
    const opts = issueTypesByRiskRule[control.risk_rule_id]?.options || [];
    const match = opts.find((it: any) => it.id === control.issue_type_control_id)
      || opts.find((it: any) => it.expected_value === control.expected_value);
    setEditedIssueTypeControlId(match?.id || control.issue_type_control_id);
    // Rule 19 has no Requirement (removed from the UI) — detection is driven by the
    // category/subcategory checklist. Enable/disable still rides the dial under the
    // hood: DialEnforcesOperationKey on the device gates on issue_detail, and only
    // NONE_DETECTED (180) enforces write AND delete, so an enabled control is pinned to it.
    if (control.risk_rule_type === CONNECTOR_RISK_CONTAINMENT_RULE_TYPE) {
      const enforcingOption = opts.find((it) => it.issue_detail === CONTAINMENT_ISSUE_DETAIL_NONE_DETECTED);
      if (enforcingOption) setEditedIssueTypeControlId(enforcingOption.id);
    }
    // Rule 9 (Sensitive Data Handling) also has no Requirement (removed from the
    // UI) — detection is driven by the category/type checklist. An enabled control
    // is pinned to issue_detail 80 (NONE_DETECTED = all categories enforced); off
    // rides the disabledOption + remediation None, so the dial value only matters
    // when on. Mirrors the rule-19 pin above.
    if (control.risk_rule_type === SENSITIVE_DATA_HANDLING_RISK_RULE_TYPE) {
      const allOption = opts.find((it) => it.issue_detail === SENSITIVE_DATA_ISSUE_DETAIL_ALL);
      if (allOption) setEditedIssueTypeControlId(allOption.id);
    }
    setEditedRemediationControlId(control.remediation_control_id);
    setEditedRedactAuditLogs(control.redact_audit_logs !== false);
    setEditedSensitiveDataTypes(normalizeSensitiveDataTypes(control.enabled_sensitive_data_types));
    setEditedRiskyActionSubcategories(normalizeRiskyActionSubcategories(control.enabled_risky_action_subcategories));
    setShowEditControlDialog(true);
  };

  // A Sensitive Data control must detect at least one data type. null = "all"
  // (valid, clears the key on save); an explicit empty list [] is invalid and
  // must block Save. Mirrors isRiskyActionSelectionEmptyForControl.
  const isSensitiveDataSelectionEmpty = (): boolean => {
    if (!editingControl || editingControl.risk_rule_type !== SENSITIVE_DATA_HANDLING_RISK_RULE_TYPE) return false;
    return editedSensitiveDataTypes !== null && editedSensitiveDataTypes.length === 0;
  };

  // A Risky Action control must detect at least one subcategory. null = "all"
  // (valid, clears the key on save); an explicit empty list [] is invalid and
  // must block Save.
  const isRiskyActionSelectionEmptyForControl = (): boolean => {
    if (!editingControl || editingControl.risk_rule_type !== CONNECTOR_RISK_CONTAINMENT_RULE_TYPE) return false;
    return editedRiskyActionSubcategories !== null && editedRiskyActionSubcategories.length === 0;
  };

  // A Model Selection saves once the catalogs its dialog shows are loaded. Nothing selected is a
  // valid choice: it blocks every model.
  const isModelSelectionInvalid = (): boolean =>
    !!editingControl && editingControl.risk_rule_type === MODEL_SELECTION_RISK_RULE_TYPE && (!llmCatalogModels || !llmHosts);

  // Why the Model Selection dialog can't save yet, in plain words (null = it can).
  const getModelSelectionBlockReason = (): string | null => {
    if (!llmCatalogModels || !llmHosts) return null;
    if (editedIssueTypeControlId === null) return "Model Selection's issue types are not set up yet.";
    if (editingControl && getAvailableRemediationsForRiskRule(editingControl.risk_rule_id).length === 0) {
      return 'No action is available for Model Selection yet.';
    }
    if (editedRemediationControlId === null) return 'Choose what happens on a violation.';
    // Every chosen host serves none of the chosen models (sanitize dropped them all). Saving now would
    // write { hosts: [] } = block everything, which the admin did not intend - block it instead.
    if (!isModelSelectionEmpty(modelSelection) &&
        buildModelSelectionRows(modelSelection, llmCatalogModels, llmHosts).rows.length === 0) {
      return 'None of the selected models are served on the selected hosts.';
    }
    return null;
  };

  const handleSaveControl = async () => {
    if (!editingControl || editedIssueTypeControlId === null || editedRemediationControlId === null) return;
    if (isSensitiveDataSelectionEmpty() || isRiskyActionSelectionEmptyForControl() || isModelSelectionInvalid()) return;

    const issueTypeChanged = editedIssueTypeControlId !== editingControl.issue_type_control_id;
    const remediationChanged = editedRemediationControlId !== editingControl.remediation_control_id;
    const redactionChanged = editingControl.risk_rule_type === USER_ACTIVITY_LOGGING_RISK_RULE_TYPE &&
      editedRedactAuditLogs !== (editingControl.redact_audit_logs !== false);
    const currentTypes = new Set<number>(normalizeSensitiveDataTypes(editingControl.enabled_sensitive_data_types) ?? []);
    // null ("all") persists as an empty set, same as the DB's absent-key shape.
    const nextTypes = new Set<number>(editedSensitiveDataTypes ?? []);
    const typesChanged = editingControl.risk_rule_type === SENSITIVE_DATA_HANDLING_RISK_RULE_TYPE &&
      (currentTypes.size !== nextTypes.size || ![...currentTypes].every((t) => nextTypes.has(t)));
    // Risky Action Handling subcategory allowlist (rule 19), same null-as-empty-set
    // shape as the sensitive-data types above.
    const currentRiskySubs = new Set<number>(normalizeRiskyActionSubcategories(editingControl.enabled_risky_action_subcategories) ?? []);
    const nextRiskySubs = new Set<number>(editedRiskyActionSubcategories ?? []);
    const riskyActionsChanged = editingControl.risk_rule_type === CONNECTOR_RISK_CONTAINMENT_RULE_TYPE &&
      (currentRiskySubs.size !== nextRiskySubs.size || ![...currentRiskySubs].every((t) => nextRiskySubs.has(t)));
    // Model Selection (rule 15): the dialog's choices, stored as settings.model_selection.
    const nextModelSelection = editingControl.risk_rule_type === MODEL_SELECTION_RISK_RULE_TYPE
      ? toModelSelectionSettings(modelSelection, llmCatalogModels ?? [], llmHosts ?? [])
      : null;
    const modelSelectionChanged = nextModelSelection !== null &&
      JSON.stringify(nextModelSelection) !== JSON.stringify(editingControl.settings?.model_selection ?? null);

    if (!issueTypeChanged && !remediationChanged && !redactionChanged && !typesChanged && !riskyActionsChanged && !modelSelectionChanged) {
      cancelAllEdits();
      return;
    }

    try {
      const updates: any = {};
      if (issueTypeChanged) updates.issue_type_control_id = editedIssueTypeControlId;
      if (remediationChanged) updates.remediation_control_id = editedRemediationControlId;
      if (redactionChanged || typesChanged || riskyActionsChanged || modelSelectionChanged) {
        // Merge onto a single base so redaction and data-type keys coexist and
        // any other existing settings keys are preserved.
        const nextSettings: any = { ...(editingControl.settings || {}) };
        if (redactionChanged) {
          // Redact ON removes the key (absent means redact); OFF stores false.
          if (editedRedactAuditLogs) delete nextSettings.redact_audit_logs;
          else nextSettings.redact_audit_logs = false;
        }
        if (typesChanged) {
          // Only an explicit subset is stored; null ("all") drops the key. An
          // explicit-none ([]) never reaches here — Save is blocked upstream.
          if (editedSensitiveDataTypes && editedSensitiveDataTypes.length > 0) nextSettings.enabled_sensitive_data_types = editedSensitiveDataTypes;
          else delete nextSettings.enabled_sensitive_data_types;
        }
        if (riskyActionsChanged) {
          // Only an explicit subset is stored; null ("all") drops the key. An
          // explicit-none ([]) never reaches here — Save is blocked upstream.
          if (editedRiskyActionSubcategories && editedRiskyActionSubcategories.length > 0) nextSettings.enabled_risky_action_subcategories = editedRiskyActionSubcategories;
          else delete nextSettings.enabled_risky_action_subcategories;
        }
        if (modelSelectionChanged) nextSettings.model_selection = nextModelSelection;
        updates.settings = nextSettings;
      }

      const { error } = await supabase
        .from('policy_controls')
        .update(updates)
        .eq('id', editingControl.id);

      if (error) throw error;

      // Best-effort update of policy timestamp (non-critical)
      const { data: policyData } = await supabase
        .from('policies')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', policy.id)
        .select('updated_at')
        .single();

      const remediationControl = remediations.find(r => r.id === editedRemediationControlId);

      // Update controls state — find which section the control belongs to
      const section = CONTROLLABLE_RISK_RULE_TYPES.has(editingControl.risk_rule_type) ? 'controllable' : 'acknowledgement';
      const updatedControls = { ...controls, [section]: { ...controls[section] } };
      const categoryName = editingControl.category_name;
      updatedControls[section][categoryName] = updatedControls[section][categoryName].map((control: any) =>
        control.id === editingControl.id
          ? {
              ...control,
              issue_type_control_id: editedIssueTypeControlId,
              expected_value: (() => {
                const ruleData = issueTypesByRiskRule[editingControl.risk_rule_id];
                if (!ruleData) return null;
                const allItems = [...ruleData.options, ...(ruleData.disabledOption ? [ruleData.disabledOption] : [])];
                return allItems.find((it: any) => it.id === editedIssueTypeControlId)?.expected_value || null;
              })(),
              remediation_control_id: editedRemediationControlId,
              action: remediationControl?.name || null,
              remediation_type: remediationControl?.remediation_type || null,
              ...((redactionChanged || typesChanged || riskyActionsChanged || modelSelectionChanged) && {
                settings: updates.settings,
                ...(redactionChanged && { redact_audit_logs: editedRedactAuditLogs }),
                ...(typesChanged && { enabled_sensitive_data_types: editedSensitiveDataTypes ?? [] }),
                ...(riskyActionsChanged && { enabled_risky_action_subcategories: editedRiskyActionSubcategories ?? null })
              })
            }
          : control
      );
      setControls(updatedControls);

      // Check if all controls are configured (always check for consistency)
      const allControls = [...Object.values(updatedControls.controllable).flat(), ...Object.values(updatedControls.acknowledgement).flat()];
      const allConfigured = allControls.every((c: any) =>
        c.issue_type_control_id !== null && c.remediation_control_id !== null
      );

      // Update policy with timestamp and incomplete flag
      setPolicy({
        ...policy,
        ...(policyData?.updated_at && { updated_at: policyData.updated_at }),
        has_incomplete_controls: !allConfigured
      });

      cancelAllEdits();

      // User Activity Logging just switched to Enable logging (from Alert/Report/disabled) —
      // nudge the admin to finish Claude's own admin-console setup if Claude is assigned here.
      if (
        editingControl.risk_rule_type === USER_ACTIVITY_LOGGING_RISK_RULE_TYPE &&
        policy.framework_entity_type === 1 &&
        remediationControl?.remediation_type === 5 &&
        editingControl.remediation_type !== 5 &&
        selectedEntities.some((e: any) => e.id === String(AGENT_TYPE_CLAUDE))
      ) {
        setShowClaudeSetupDialog(true);
      }

      // Scroll to storage warning if activity logging was just saved with unhealthy storage
      if (
        editingControl.risk_rule_type === 16 &&
        remediationControl?.remediation_type === 5 &&
        (storageNotConfigured || storageHasError)
      ) {
        setTimeout(() => {
          storageWarningRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setHighlightStorageWarning(true);
          setTimeout(() => setHighlightStorageWarning(false), 2000);
        }, 100);
      }
    } catch (error) {
      console.error('Error updating control:', error);
      toast({
        title: "Error",
        description: "Failed to update control",
        variant: "destructive",
      });
    }
  };

  const handleToggleControl = (control: any, enabled: boolean) => {
    const ruleData = issueTypesByRiskRule[control.risk_rule_id];
    if (!ruleData?.disabledOption) return;

    if (!enabled) {
      // If already off (disabled or unconfigured, e.g. toggled on then back off without saving), just cancel edit mode
      const isAlreadyOff = control.issue_type_control_id === ruleData.disabledOption.id || !control.issue_type_control_id;
      if (isAlreadyOff) {
        cancelAllEdits();
        return;
      }
      setPendingDisableControl(control);
      setShowDisableControlDialog(true);
    } else {
      // Model Selection opens its own dialog, pinned to the "on" choice.
      if (control.risk_rule_type === MODEL_SELECTION_RISK_RULE_TYPE) {
        openModelSelection(control);
        return;
      }
      // Toggling on — open the edit modal so the user picks a value
      cancelAllEdits();
      setEditingControl(control);
      setEditedIssueTypeControlId(null);
      setEditedRemediationControlId(null);
      // Rule 19 (Risky Action Handling) has no Requirement (removed from the UI) —
      // detection is driven by the category/subcategory checklist. Enable/disable
      // rides the dial under the hood, so re-enabling pins the control to NONE_DETECTED (180) here
      // (same as handleEditControl); otherwise editedIssueTypeControlId stays null and
      // the Save button never enables when re-enabling a previously-disabled control.
      if (control.risk_rule_type === CONNECTOR_RISK_CONTAINMENT_RULE_TYPE) {
        const enforcingOption = (ruleData.options || []).find(
          (it: any) => it.issue_detail === CONTAINMENT_ISSUE_DETAIL_NONE_DETECTED
        );
        if (enforcingOption) setEditedIssueTypeControlId(enforcingOption.id);
      }
      // Rule 9 (Sensitive Data Handling) mirrors rule 19: no Requirement, pinned to
      // issue_detail 80 (all categories) when enabled so Save enables on re-enable.
      if (control.risk_rule_type === SENSITIVE_DATA_HANDLING_RISK_RULE_TYPE) {
        const allOption = (ruleData.options || []).find(
          (it: any) => it.issue_detail === SENSITIVE_DATA_ISSUE_DETAIL_ALL
        );
        if (allOption) setEditedIssueTypeControlId(allOption.id);
      }
      setEditedRedactAuditLogs(control.redact_audit_logs !== false);
      setEditedSensitiveDataTypes(normalizeSensitiveDataTypes(control.enabled_sensitive_data_types));
      setEditedRiskyActionSubcategories(normalizeRiskyActionSubcategories(control.enabled_risky_action_subcategories));
      setShowEditControlDialog(true);
    }
  };

  const confirmDisableControl = async () => {
    const control = pendingDisableControl;
    if (!control) return;
    const ruleData = issueTypesByRiskRule[control.risk_rule_id];
    if (!ruleData?.disabledOption) return;

    try {
      const noneRemediation = remediations.find((r: any) => r.remediation_type === 0);
      const noneRemediationControlId = noneRemediation?.id || null;

      const { error } = await supabase
        .from('policy_controls')
        .update({ issue_type_control_id: ruleData.disabledOption.id, remediation_control_id: noneRemediationControlId })
        .eq('id', control.id);

      if (error) throw error;

      const section = CONTROLLABLE_RISK_RULE_TYPES.has(control.risk_rule_type) ? 'controllable' : 'acknowledgement';
      const updatedControls = { ...controls, [section]: { ...controls[section] } };
      updatedControls[section][control.category_name] = updatedControls[section][control.category_name].map((c: any) =>
        c.id === control.id
          ? { ...c, issue_type_control_id: ruleData.disabledOption.id, expected_value: ruleData.disabledOption.expected_value, remediation_control_id: noneRemediationControlId, action: noneRemediation?.name || null, remediation_type: 0 }
          : c
      );
      setControls(updatedControls);
    } catch (error) {
      console.error('Error disabling control:', error);
      toast({ title: "Error", description: "Failed to disable rule", variant: "destructive" });
    } finally {
      setShowDisableControlDialog(false);
      setPendingDisableControl(null);
    }
  };

  const handleEditPolicy = () => {
    cancelAllEdits();
    setEditingPolicy(true);
    setEditedPolicyName(policy.name);
    setEditedPolicyDescription(policy.description || "");
  };

  const handleSavePolicy = async () => {
    if (!policy || !editedPolicyName.trim()) return;

    const nameChanged = editedPolicyName.trim() !== policy.name;
    const descriptionChanged = editedPolicyDescription.trim() !== (policy.description || "");

    if (!nameChanged && !descriptionChanged) {
      cancelAllEdits();
      return;
    }

    try {
      const updates: any = {};
      if (nameChanged) updates.name = editedPolicyName.trim();
      if (descriptionChanged) updates.description = editedPolicyDescription.trim() || null;

      const { data, error } = await supabase
        .from('policies')
        .update(updates)
        .eq('id', policy.id)
        .select('updated_at')
        .single();

      if (error) throw error;

      setPolicy(prev => prev ? { 
        ...prev, 
        name: editedPolicyName.trim(),
        description: editedPolicyDescription.trim() || "",
        updated_at: data.updated_at
      } : null);
      
      cancelAllEdits();
      toast({
        title: "Success",
        description: "Policy updated successfully",
      });
    } catch (error: any) {
      console.error('Error updating policy:', error);
      
      if (error?.code === '23505' && error?.message?.includes('policies_name_org_key')) {
        setPolicyNameError("A policy with this name already exists.");
      } else {
        toast({
          title: "Error",
          description: "Failed to update policy",
          variant: "destructive",
        });
      }
    }
  };

  const handleEditAssignment = () => {
    if (!policy) return;
    
    cancelAllEdits();
    setEditingAssignment(true);
    setEditedAssignmentType(policy.assignment_type.toString());
    
    const currentEntityIds = selectedEntities.map(entity => entity.id);
    setEditedEntityIds(currentEntityIds);
  };

  const handleSaveAssignment = async () => {
    if (!policy) return;

    const assignmentType = parseInt(editedAssignmentType);
    const currentEntityIds = new Set(selectedEntities.map(e => e.id));
    const newEntityIds = new Set(editedEntityIds);
    
    const assignmentTypeChanged = assignmentType !== policy.assignment_type;
    const entitiesChanged = 
      currentEntityIds.size !== newEntityIds.size ||
      ![...currentEntityIds].every(id => newEntityIds.has(id));

    if (!assignmentTypeChanged && !entitiesChanged) {
      cancelAllEdits();
      return;
    }

    // Validate compatibility with scope=2 remediations on current controls
    const allControls = [...Object.values(controls.controllable || {}).flat(), ...Object.values(controls.acknowledgement || {}).flat()] as any[];
    const hasScopedRemediations = allControls.some((control: any) => {
      if (!control.remediation_control_id || isAgentIndependentRule(control.risk_rule_id)) return false;
      const rem = remediations.find((r: any) => r.id === control.remediation_control_id);
      return rem && rem.scope === 2;
    });

    if (hasScopedRemediations) {
      if (assignmentType === 1) {
        toast({
          title: "Incompatible assignment",
          description: `Not all ${policy.framework_entity_type === 1 ? 'agents' : 'connectors'} support current remediation settings. Update the controls or create a separate policy.`,
          variant: "destructive",
        });
        return;
      }

      const newEntities = availableEntities.filter((e: any) => newEntityIds.has(e.id));
      const incompatibleNames = new Map<number, string>();
      for (const control of allControls) {
        if (!control.remediation_control_id || isAgentIndependentRule(control.risk_rule_id)) continue;
        const rem = remediations.find((r: any) => r.id === control.remediation_control_id);
        if (!rem || rem.scope === 1) continue;
        for (const e of newEntities) {
          if (!(e.compatibility || []).some((c: any) => c.risk_rule_id === control.risk_rule_id && c.remediation_id === rem.remediation_id)) {
            incompatibleNames.set(e.catalogType, e.catalogName);
          }
        }
      }
      if (incompatibleNames.size > 0) {
        const names = [...incompatibleNames.values()].join(', ');
        toast({
          title: "Incompatible assignment",
          description: `${names} doesn't support all current remediation settings. Update the controls or create a separate policy for these ${policy.framework_entity_type === 1 ? 'agents' : 'connectors'}.`,
          variant: "destructive",
        });
        return;
      }
    }

    try {
      const isAgentFramework = policy.framework_entity_type === 1;
      const rpcFunction = isAgentFramework ? 'update_agent_policy' : 'update_mcp_policy';

      const params: any = {
        p_policy_id: policy.id,
        p_assignment_type: assignmentType,
        p_employee_assignment_type: policy.employee_assignment_type,
        p_org_id: policy.org_id,
        p_user_group_ids: selectedUserGroups.map(g => g.id),
      };

      if (isAgentFramework) {
        params.p_agent_types = assignmentType === 2 ? editedEntityIds.map(Number) : [];
      } else {
        const entities = assignmentType === 2 ? editedEntityIds : [];
        params.p_mcp_server_types = entities.map(Number);
      }

      const { data: updatedAt, error } = await supabase.rpc(rpcFunction, params);

      if (error) throw error;

      // Refresh assigned entities
      let newAssignedEntities: any[] = [];
      if (assignmentType === 2) {
        newAssignedEntities = availableEntities.filter(entity => 
          editedEntityIds.includes(entity.id)
        );
      }

      setPolicy(prev => prev ? { ...prev, assignment_type: assignmentType, entity_count: newAssignedEntities.length, updated_at: updatedAt } : null);
      setSelectedEntities(newAssignedEntities);
      // update_agent_policy also prunes the rule-16 OTLP forwarding subset (and drops the
      // destinations when no forwarding agent remains), so reload controls from the DB instead of
      // keeping a stale local copy that the control-edit dialog would write back wholesale.
      if (isAgentFramework) setControlsRefreshKey((k) => k + 1);

      // Claude was just turned on for Logging — nudge the admin to also configure
      // Cowork's OTLP export in claude.ai's own admin console.
      if (
        isLoggingPolicy(policy) &&
        isAgentFramework &&
        newEntityIds.has(String(AGENT_TYPE_CLAUDE)) &&
        !currentEntityIds.has(String(AGENT_TYPE_CLAUDE))
      ) {
        setShowClaudeSetupDialog(true);
      }

      cancelAllEdits();

      toast({
        title: "Success",
        description: "Assigned " + (policy.framework_entity_type === 1 ? "Agents" : "Connectors") + " updated successfully",
      });
    } catch (error) {
      console.error('Error updating assignment:', error);
      toast({
        title: "Error",
        description: "Failed to update Assigned " + (policy.framework_entity_type === 1 ? "Agents" : "Connectors"),
        variant: "destructive",
      });
    }
  };

  // Tombstoned (disconnected) attachments are hidden from the card, the badge
  // count, and the picker — only live groups render. Their ids still ride
  // along in every specific-groups save (see handleSaveDeviceAssignment), so
  // a reconnect can revive them.
  const visibleUserGroups = selectedUserGroups.filter((g: any) => !g.deleted);

  const handleEditDeviceAssignment = () => {
    if (!policy) return;

    cancelAllEdits();
    setEditingDeviceAssignment(true);
    setEditedDeviceAssignmentType(policy.employee_assignment_type.toString());
    setEditedUserGroupIds(visibleUserGroups.map(g => g.id));
  };

  const handleSaveDeviceAssignment = async () => {
    if (!policy) return;

    const deviceAssignmentType = parseInt(editedDeviceAssignmentType);
    // Dirty check over LIVE groups only: hidden tombstoned attachments are not
    // editable here and must not make an untouched dialog look changed.
    const currentGroupIds = new Set(visibleUserGroups.map(g => g.id));
    const newGroupIds = new Set(editedUserGroupIds);

    const typeChanged = deviceAssignmentType !== policy.employee_assignment_type;
    const groupsChanged =
      currentGroupIds.size !== newGroupIds.size ||
      ![...currentGroupIds].every(id => newGroupIds.has(id));

    if (!typeChanged && !groupsChanged) {
      cancelAllEdits();
      return;
    }

    try {
      const isAgentFramework = policy.framework_entity_type === 1;
      const rpcFunction = isAgentFramework ? 'update_agent_policy' : 'update_mcp_policy';

      // Hidden tombstoned attachments ride along in every specific-groups save
      // (the RPC's scope sync is delete-and-reinsert; omitting them would drop
      // the revival wiring). Set() dedupes a ghost revived and re-picked
      // mid-session (the RPC's SELECT DISTINCT would tolerate the duplicate,
      // but don't rely on that). Switching to org-wide sends [] deliberately —
      // a scope change is an explicit statement that groups no longer govern
      // this policy.
      const ghostUserGroups = selectedUserGroups.filter((g: any) => g.deleted);
      const sentGroupIds = deviceAssignmentType === 2
        ? [...new Set([...editedUserGroupIds, ...ghostUserGroups.map(g => g.id)])]
        : [];
      const params: any = {
        p_policy_id: policy.id,
        p_assignment_type: policy.assignment_type,
        p_employee_assignment_type: deviceAssignmentType,
        p_org_id: policy.org_id,
        p_user_group_ids: sentGroupIds,
      };
      if (isAgentFramework) {
        params.p_agent_types = selectedEntities.map(e => Number(e.id));
      } else {
        params.p_mcp_server_types = selectedEntities.map(e => Number(e.id));
      }

      const { data: updatedAt, error } = await supabase.rpc(rpcFunction, params);

      if (error) throw error;

      let newUserGroups: any[] = [];
      if (deviceAssignmentType === 2) {
        // Rebuild from the ids actually SENT, never from availableUserGroups
        // alone: a group tombstoned mid-session (disconnect after page load)
        // has left the live options, but the RPC just re-inserted its
        // attachment — dropping it from state here would make the NEXT save's
        // payload omit it, silently deleting the attachment the load path
        // promises to preserve. An id with no live option is carried forward
        // flagged deleted, so future saves treat it as a ghost.
        const liveById = new Map(availableUserGroups.map((g: any) => [g.id, g]));
        const priorById = new Map(selectedUserGroups.map((g: any) => [g.id, g]));
        newUserGroups = sentGroupIds.map(id =>
          liveById.get(id) ?? { ...(priorById.get(id) ?? { id, name: id }), deleted: true }
        );
      }

      setPolicy(prev => prev ? { ...prev, employee_assignment_type: deviceAssignmentType, user_group_count: newUserGroups.filter((g: any) => !g.deleted).length, updated_at: updatedAt } : null);
      setSelectedUserGroups(newUserGroups);
      cancelAllEdits();

      toast({
        title: "Success",
        description: "Assigned Users updated successfully",
      });
    } catch (error) {
      console.error('Error updating device assignment:', error);
      toast({
        title: "Error",
        description: "Failed to update Assigned Users",
        variant: "destructive",
      });
    }
  };

  const handleToggleStatus = () => {
    if (!policy) return;
    setShowToggleStatusDialog(true);
  };

  const confirmToggleStatus = async () => {
    if (!policy) return;
    setShowToggleStatusDialog(false);

    const newStatus = policy.policy_status === 1 ? 2 : 1;
    const action = newStatus === 1 ? 'activate' : 'deactivate';

    try {
      const { data, error } = await supabase
        .from('policies')
        .update({ policy_status: newStatus })
        .eq('id', policy.id)
        .select('updated_at')
        .single();

      if (error) throw error;

      setPolicy(prev => prev ? {
        ...prev,
        policy_status: newStatus,
        updated_at: data.updated_at
      } : null);

      // Activating the Logging policy makes any already-assigned Claude agent's
      // logging go live — nudge the admin to finish Claude's own admin-console setup.
      if (
        newStatus === 1 &&
        isLoggingPolicy(policy) &&
        policy.framework_entity_type === 1 &&
        selectedEntities.some((e: any) => e.id === String(AGENT_TYPE_CLAUDE))
      ) {
        setShowClaudeSetupDialog(true);
      }

      toast({
        title: "Success",
        description: `Policy ${action}d successfully`,
      });
    } catch (error) {
      console.error('Error updating policy status:', error);
      toast({
        title: "Error",
        description: `Failed to ${action} policy`,
        variant: "destructive",
      });
    }
  };

  const handleDeletePolicy = () => {
    if (!policy) return;
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (!policy) return;
    setShowDeleteDialog(false);

    try {
      const { error } = await supabase
        .from('policies')
        .delete()
        .eq('id', policy.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Policy deleted successfully",
      });

      const backSearch = (location.state?.backSearch as string) || '';
      navigate(`/policies${backSearch ? `?${backSearch}` : ''}`);
    } catch (error) {
      console.error('Error deleting policy:', error);
      toast({
        title: "Error",
        description: "Failed to delete policy",
        variant: "destructive",
      });
    }
  };

  const getRemediationsForRiskRule = (riskRuleId: string, entities: any[]) => {
    return remediations.filter((r) => {
      if (
        r.remediation_type === 0 ||
        r.remediation_type === ALERT_NOTIFICATION_REMEDIATION_TYPE
      ) return false;
      if (isAgentIndependentRule(riskRuleId)) return r.remediation_type === BLOCK_REMEDIATION_TYPE;
      if (r.scope === 1) return true;
      if (!policy || policy.assignment_type === 1 || entities.length === 0) return false;
      const compatible = entities.every((e: any) =>
        (e.compatibility || []).some((c: any) => c.risk_rule_id === riskRuleId && c.remediation_id === r.remediation_id)
      );
      if (!compatible) return false;
      return entities.some((e: any) =>
        (e.compatibility || []).some((c: any) => c.risk_rule_id === riskRuleId && c.remediation_id === r.remediation_id && (!r.is_enforcement || c.is_available))
      );
    });
  };

  const getAvailableRemediationsForRiskRule = (riskRuleId: string) =>
    getRemediationsForRiskRule(riskRuleId, selectedEntities);

  const isEnforceableForPolicy = (riskRuleId: string) =>
    getAvailableRemediationsForRiskRule(riskRuleId).some((r: any) => r.is_enforcement);

  const loadModelSelectionCatalogs = () => {
    const token = session?.access_token;
    if (!token || llmCatalogLoading || (llmCatalogModels && llmHosts)) return;
    setLlmCatalogLoading(true);
    setLlmCatalogError(null);
    Promise.all([
      traceforcApi.listAllLlmCatalog(token),
      supabase.from('llm_host_catalog' as any).select('host_pattern, provider'),
    ])
      .then(([catalog, hostsResult]) => {
        if (hostsResult.error) throw new Error(hostsResult.error.message);
        const real = catalog.filter((e) => !isUnlistedLlmModelType(e.llm_model_type));
        setLlmCatalogModels(real
          .map((e) => ({ ...catalogToRegistryModel(e), model_family: e.model_family ?? null }))
          .sort((a, b) => a.model_name.localeCompare(b.model_name)));
        setLlmHosts((hostsResult.data || []) as unknown as SelectionHost[]);
      })
      .catch((e) => setLlmCatalogError(e instanceof Error ? e.message : 'Failed to load the LLM model catalog'))
      .finally(() => setLlmCatalogLoading(false));
  };

  // Opens the Model Selection dialog on the rule-15 control (edit, or toggling it on). Saving always
  // pins the "on" choice, the way rules 9 and 19 pin their enforcing choice.
  const openModelSelection = (control: { risk_rule_id: string; remediation_control_id: string | null; settings?: unknown }) => {
    cancelAllEdits();
    setEditingControl(control);
    const opts = issueTypesByRiskRule[control.risk_rule_id]?.options || [];
    setEditedIssueTypeControlId(opts.find((it) => it.issue_detail === MODEL_SELECTION_ISSUE_DETAIL_ON)?.id ?? null);
    // Keep the saved action when the list still offers it. Otherwise start on Block when it is the
    // only action offered; with more than one, nothing is picked so the admin chooses.
    const savedRemediation = remediations.find((r) => r.id === control.remediation_control_id);
    const violationOptions = getAvailableRemediationsForRiskRule(control.risk_rule_id);
    const onlyBlock = violationOptions.length === 1 && violationOptions[0].is_enforcement ? violationOptions[0].id : null;
    setEditedRemediationControlId(
      savedRemediation && violationOptions.some((r) => r.id === savedRemediation.id) ? savedRemediation.id : onlyBlock
    );
    setModelSelection(readModelSelection(control.settings));
    setShowAllReviewHosts(false);
    setShowAllReviewModels(false);
    setModelSelectionStep('configure');
    setShowModelSelectionDialog(true);
    loadModelSelectionCatalogs();
  };

  const saveModelSelection = async () => {
    setModelSelectionSaving(true);
    try {
      await handleSaveControl();
    } finally {
      setModelSelectionSaving(false);
    }
  };

  // The row's line under the requirement. A control saved with an action that isn't sent to devices
  // (Report, Alert) enforces nothing, whatever its selection.
  const getModelSelectionSummary = (control: { remediation_control_id?: string | null; settings?: { model_selection?: unknown } }): string => {
    if (remediationsLoaded && !remediations.find((r) => r.id === control.remediation_control_id)?.is_enforcement) {
      return 'Not enforced - choose Block to enforce it';
    }
    const selection = readModelSelection(control.settings);
    if (isModelSelectionEmpty(selection)) return 'No models selected - no model is allowed';
    if (!llmCatalogModels || !llmHosts) return 'Selection saved';
    const { allowedModels, destinations } = previewModelSelection(selection, llmCatalogModels, llmHosts);
    const models = `${allowedModels.length} of ${llmCatalogModels.length} models allowed`;
    return destinations ? `${models}, on ${destinations.length} host${destinations.length === 1 ? '' : 's'}` : models;
  };

  const getUnsupportedEntitiesForControl = (control: any) => {
    if (isLoggingPolicy(policy)) return null;
    if (isAgentIndependentRule(control.risk_rule_id)) return null;
    if (!policy || policy.assignment_type !== 2 || !control.remediation_control_id) return null;
    const rem = remediations.find((r: any) => r.id === control.remediation_control_id);
    if (!rem || rem.scope !== 2) return null;
    const unsupported = selectedEntities.filter((e: any) =>
      !(e.compatibility || []).some((c: any) =>
        c.risk_rule_id === control.risk_rule_id && c.remediation_id === rem.remediation_id && c.is_available
      )
    );
    if (unsupported.length === 0 || unsupported.length === selectedEntities.length) return null;
    return unsupported.map((e: any) => e.catalogName);
  };

  const getBackButton = () => {
    const sourceAgent = searchParams.get('source_agent')
    const sourceMcp = searchParams.get('source_mcp')
    
    if (sourceAgent) {
      return {
        path: `/agents/${sourceAgent}`,
        label: 'Back to Agent'
      }
    } else if (sourceMcp) {
      return {
        path: `/mcps/${sourceMcp}`,
        label: 'Back to Connector'
      }
    } else {
      const backSearch = (location.state?.backSearch as string) || ''
      return {
        path: `/policies${backSearch ? `?${backSearch}` : ''}`,
        label: 'Back to Policies'
      }
    }
  }

  const backButton = getBackButton()

  const renderControlsTable = (controlsList: any[]) => {
    const allControls = [...controlsList].sort((a, b) => {
      return a.category_display_order - b.category_display_order || a.rule_display_order - b.rule_display_order;
    });

    return (
      <div className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]"></TableHead>
              <TableHead className="w-[350px]">Rule</TableHead>
              <TableHead>Requirement</TableHead>
              <TableHead className="w-[200px]">On Violation</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allControls.map((control) => {
              const ruleData = issueTypesByRiskRule[control.risk_rule_id];
              const isUnconfigured = !control.issue_type_control_id;
              const isDisabled = isUnconfigured || ruleData?.disabledOption?.id === control.issue_type_control_id;
              const hasOptions = (ruleData?.options?.length || 0) > 0;
              return (
                <TableRow key={control.id} className={isDisabled ? 'opacity-50' : ''}>
                  <TableCell>
                    <Switch
                      checked={!isDisabled}
                      disabled={!hasOptions}
                      onCheckedChange={(checked) => handleToggleControl(control, checked)}
                    />
                  </TableCell>
                  <TableCell>
                    <div
                      className="font-medium text-primary cursor-pointer hover:underline"
                      onClick={() => {
                        if (policy?.framework_id && control.risk_rule_id) {
                          const params = new URLSearchParams();
                          params.set('risk_attribute', control.risk_rule_id);
                          params.set('source_policy', policy.id);
                          navigate(`/risk-frameworks/${policy.framework_id}?${params.toString()}`);
                        }
                      }}
                    >
                      {control.rule_name}
                    </div>
                    {control.rule_description && (
                      <div className="text-xs text-muted-foreground mt-1">{control.rule_description}</div>
                    )}
                    {control.risk_rule_type === SENSITIVE_DATA_HANDLING_RISK_RULE_TYPE && (
                      <a
                        href={SENSITIVE_DATA_DETECTION_DOCS_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        Detection coverage
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    {control.risk_rule_type === CONNECTOR_RISK_CONTAINMENT_RULE_TYPE && (
                      <a
                        href={RISKY_ACTION_DETECTION_DOCS_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        Detection coverage
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    {(() => {
                      // Sensitive Data Handling (rule 9) has no Requirement (removed),
                      // so never surface the pinned dial's expected_value. Show the
                      // narrowed type subset, or a plain "all" label when every type is
                      // on (null/empty allowlist = all detected). Mirrors rule 19 below.
                      if (!isDisabled && control.risk_rule_type === SENSITIVE_DATA_HANDLING_RISK_RULE_TYPE) {
                        const sel = normalizeSensitiveDataTypes(control.enabled_sensitive_data_types);
                        if (sel && sel.length > 0) {
                          const labels = sel
                            .map((t: number) => SENSITIVE_DATA_TYPE_LABELS[t])
                            .filter(Boolean);
                          return (
                            <button
                              type="button"
                              onClick={() => handleEditControl(control)}
                              disabled={!remediationsLoaded}
                              className="text-sm font-medium text-left underline decoration-dotted underline-offset-2 hover:opacity-80 transition-opacity disabled:cursor-not-allowed"
                            >
                              Disallow certain types of sensitive data ({labels.length})
                            </button>
                          );
                        }
                        return (
                          <span className="text-sm font-medium">Disallow all types of sensitive data</span>
                        );
                      }
                      // Risky Action Handling (rule 19) has no Requirement (removed),
                      // so never surface the underlying dial's expected_value
                      // ("Disallow write and delete operations") here. Show the
                      // narrowed subcategory subset, or a plain "all" label when every
                      // risky action is on (null/empty allowlist = all detected).
                      if (!isDisabled && control.risk_rule_type === CONNECTOR_RISK_CONTAINMENT_RULE_TYPE) {
                        const sel = normalizeRiskyActionSubcategories(control.enabled_risky_action_subcategories);
                        if (sel && sel.length > 0) {
                          const labels = sel
                            .map((t: number) => RISKY_ACTION_SUBCATEGORY_LABELS[t])
                            .filter(Boolean);
                          return (
                            <button
                              type="button"
                              onClick={() => handleEditControl(control)}
                              disabled={!remediationsLoaded}
                              className="text-sm font-medium text-left underline decoration-dotted underline-offset-2 hover:opacity-80 transition-opacity disabled:cursor-not-allowed"
                            >
                              Disallow certain types of risky actions ({labels.length})
                            </button>
                          );
                        }
                        return (
                          <span className="text-sm font-medium">Disallow all types of risky actions</span>
                        );
                      }
                      if (!isDisabled && control.risk_rule_type === MODEL_SELECTION_RISK_RULE_TYPE) {
                        return (
                          <div>
                            <span className="font-semibold">{control.expected_value}</span>
                            <div className="text-xs text-muted-foreground mt-1">{getModelSelectionSummary(control)}</div>
                          </div>
                        );
                      }
                      return (
                        <div className="flex items-center gap-2">
                          {!isDisabled && control.expected_value ? (
                            <span className="font-semibold">{getRequirementDisplayLabel(control.expected_value)}</span>
                          ) : isUnconfigured ? (
                            <span className="text-yellow-600">Not configured</span>
                          ) : (
                            <span className="text-muted-foreground">Disabled</span>
                          )}
                        </div>
                      );
                    })()}
                  </TableCell>
                  <TableCell>
                    {!isDisabled ? (
                      <div>
                        {getRemediationBadge(getRemediationDisplayName(control.risk_rule_type, control.remediation_type, control.action), control.remediation_type)}
                        {(() => {
                          const unsupported = getUnsupportedEntitiesForControl(control);
                          if (!unsupported) return null;
                          return <div className="text-xs text-muted-foreground mt-1">Not yet supported for {unsupported.join(', ')}</div>;
                        })()}
                        {control.risk_rule_type === USER_ACTIVITY_LOGGING_RISK_RULE_TYPE && control.remediation_type === 5 && (
                          control.redact_audit_logs !== false
                            ? <div className="text-xs text-muted-foreground mt-1">Sensitive data redacted</div>
                            : <div className="text-xs text-yellow-600 mt-1">Sensitive data not redacted</div>
                        )}
                      </div>
                    ) : isUnconfigured ? (
                      <span className="text-yellow-600">Not configured</span>
                    ) : (
                      <span className="text-muted-foreground">Disabled</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {!isDisabled ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => control.risk_rule_type === MODEL_SELECTION_RISK_RULE_TYPE ? openModelSelection(control) : handleEditControl(control)}
                        disabled={!remediationsLoaded}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate(backButton.path)}>
          <ArrowLeft className="h-4 w-4" />
          {backButton.label}
        </Button>
        {policyLoading ? (
          <>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-6 w-20 ml-auto" />
          </>
        ) : !policy ? (
          <div className="text-muted-foreground">Policy not found</div>
        ) : (
          <>
            <div className="flex-1">
              {editingPolicy ? (
              <div className="space-y-3">
                <Input
                  value={editedPolicyName}
                  onChange={(e) => {
                    setEditedPolicyName(e.target.value);
                    setPolicyNameError(null);
                  }}
                  className="text-2xl font-bold border-primary max-w-2xl"
                  placeholder="Policy name..."
                />
                {policyNameError && (
                  <p className="text-sm text-destructive">{policyNameError}</p>
                )}
                <Textarea
                  value={editedPolicyDescription}
                  onChange={(e) => setEditedPolicyDescription(e.target.value)}
                  className="text-muted-foreground resize-none max-w-2xl"
                  placeholder="Policy description..."
                  rows={2}
                />
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    onClick={handleSavePolicy}
                    disabled={!editedPolicyName.trim()}
                  >
                    <Check className="h-4 w-4" />
                    Save
                  </Button>
                  <Button size="sm" variant="outline" onClick={cancelAllEdits}>
                    <X className="h-4 w-4" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-bold text-foreground">{policy.name}</h1>
                  {getPolicyStatusBadge(policy.policy_status)}
                  <div className="flex items-center gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={handleToggleStatus}
                          aria-label={policy.policy_status === 1 ? "Deactivate policy" : "Activate policy"}
                        >
                          {policy.policy_status === 1
                            ? <PowerOff className="h-4 w-4" />
                            : <Power className="h-4 w-4" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {policy.policy_status === 1 ? "Deactivate policy" : "Activate policy"}
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={handleEditPolicy}
                          aria-label="Edit policy"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Edit policy</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
                {policy.description && (
                  <p className="text-muted-foreground">
                    {policy.description}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Created {new Date(policy.created_at).toLocaleDateString()} · Updated {new Date(policy.updated_at).toLocaleDateString()}
                </p>
                {policy.has_incomplete_controls && (
                  <Badge className="mt-2 bg-yellow-500 text-black hover:bg-yellow-600">
                    <AlertTriangle className="h-3 w-3" />
                    Action Required: Configure Controls
                  </Badge>
                )}
              </div>
            )}
            </div>
            <div className="ml-auto flex items-center gap-2">
              {!policy.is_default && !isLoggingPolicy(policy) && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeletePolicy}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              )}
            </div>
          </>
        )}
      </div>

      {policyLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : policy ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Framework
              </CardTitle>
            </CardHeader>
            <CardContent>
               {policy.framework_name ? (
                 <div className="w-full">
                   <Button 
                     variant="link" 
                     className="h-auto p-0 text-md hover:text-primary transition-colors text-left justify-start w-full whitespace-normal break-words"
                     onClick={() => {
                       if (policy.framework_id) {
                         navigate(`/risk-frameworks/${policy.framework_id}?source_policy=${policy.id}`);
                       }
                     }}
                   >
                     {policy.framework_name}
                   </Button>
                 </div>
              ) : (
                <p className="text-md font-bold text-muted-foreground">None</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Shield className="h-4 w-4" />
                {policy.framework_entity_type === 1 ? 'Assigned Agents' : 'Assigned Connectors'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {editingAssignment ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="assignment">Assignment</Label>
                    {(() => {
                      // Category policies are scoped to a fixed agent/MCP set (POLICY_CATEGORY_AGENT_TYPES),
                      // so "All Agents/MCPs" (assignment_type 1) is not offered — EXCEPT AI Access
                      // (category 5), which governs ALL agents (assignment_type stays 1). For it, offer
                      // ONLY "All Agents" so the editor renders it as immutable static text instead of
                      // a bogus "Selected Agents" with no valid selection UI.
                      const assignmentOptions = getAssignmentTypeOptions(policy.framework_entity_type)
                        .filter((option) =>
                          isAiAccessPolicy(policy)
                            ? option.value === "1"
                            : policy.category == null || option.value !== "1");
                      // A single option is not a choice — render it as static text, not a dead dropdown.
                      if (assignmentOptions.length <= 1) {
                        return (
                          <p className="text-sm text-muted-foreground">
                            {assignmentOptions[0]?.label}
                          </p>
                        );
                      }
                      return (
                        <Select
                          value={editedAssignmentType}
                          onValueChange={(value) => {
                            setEditedAssignmentType(value);
                            if (value === "1") {
                              setEditedEntityIds([]);
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {assignmentOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      );
                    })()}
                  </div>
                  {editedAssignmentType === '2' && (
                    <div>
                      <Label htmlFor="entities">
                        {policy.framework_entity_type === 1 ? 'Select Agents' : 'Select Connectors'}
                      </Label>
                      <p className="text-xs text-muted-foreground mt-1 mb-2">
                        Only {policy.framework_entity_type === 1 ? 'agents' : 'connectors'} that support this policy's remediation requirements are shown
                      </p>
                      <MultiSelect
                        options={availableEntities}
                        selectedIds={editedEntityIds}
                        onChange={setEditedEntityIds}
                        placeholder={policy.framework_entity_type === 1 ? 'Select agents...' : 'Select connectors...'}
                        searchPlaceholder={policy.framework_entity_type === 1 ? 'Search agents...' : 'Search connectors...'}
                        emptyMessage={policy.framework_entity_type === 1 ? 'No agents found.' : 'No connectors found.'}
                        label={policy.framework_entity_type === 1 ? 'agent' : 'connector'}
                      />
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      onClick={handleSaveAssignment}
                      disabled={editedAssignmentType === '2' && editedEntityIds.length === 0}
                    >
                      <Check className="h-4 w-4" />
                      Save
                    </Button>
                    <Button size="sm" variant="outline" onClick={cancelAllEdits}>
                      <X className="h-4 w-4" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {getAssignmentContent(policy, selectedEntities)}
                  </div>
                  <Button size="sm" variant="ghost" onClick={handleEditAssignment} disabled={!entitiesLoaded}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Assigned Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              {editingDeviceAssignment ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Assignment</Label>
                    <Select
                      value={editedDeviceAssignmentType}
                      onValueChange={(value) => {
                        setEditedDeviceAssignmentType(value);
                        if (value === "1") {
                          setEditedUserGroupIds([]);
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">All Users</SelectItem>
                        <SelectItem value="2">Selected Users</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {editedDeviceAssignmentType === '2' && (
                    <div>
                      <Label>Select User Groups</Label>
                      <MultiSelect
                        options={availableUserGroups}
                        selectedIds={editedUserGroupIds}
                        onChange={setEditedUserGroupIds}
                        placeholder="Select user groups..."
                        searchPlaceholder="Search user groups..."
                        emptyMessage="No user groups found."
                        label="user group"
                      />
                      <a href="/devices?tab=user-groups" target="_blank" rel="noopener noreferrer"
                        className="text-sm text-primary hover:text-primary/80 hover:underline inline-flex items-center gap-1 mt-1.5 font-medium">
                        Manage user groups <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleSaveDeviceAssignment}
                      disabled={editedDeviceAssignmentType === '2' && editedUserGroupIds.length === 0}
                    >
                      <Check className="h-4 w-4" />
                      Save
                    </Button>
                    <Button size="sm" variant="outline" onClick={cancelAllEdits}>
                      <X className="h-4 w-4" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {getDeviceAssignmentContent(policy.employee_assignment_type, policy.framework_entity_type, visibleUserGroups, selectedUserGroups.some((g: any) => g.deleted))}
                  </div>
                  <Button size="sm" variant="ghost" onClick={handleEditDeviceAssignment} disabled={!userGroupsLoaded}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {(() => {
        const hasActivityLogging = Object.values(controls.controllable || {}).flat().some(
          (c: any) => c.remediation_type === 5 && c.risk_rule_type === USER_ACTIVITY_LOGGING_RISK_RULE_TYPE
        );
        if (!isLoggingPolicy(policy) || !hasActivityLogging) return null;
        if (storageNotConfigured) {
          return (
            <Alert ref={storageWarningRef} className={`border-amber-500/50 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-200 transition-all duration-300 ${highlightStorageWarning ? 'ring-2 ring-foreground/50 shadow-lg' : ''}`}>
              <Lock className="h-4 w-4 !text-amber-600" />
              <AlertDescription className="flex items-center gap-2">
                <span className="font-semibold">ACTION REQUIRED:</span> User activity auditing requires a storage provider.
                <Button variant="link" className="h-auto p-0 text-sm font-medium text-amber-700 dark:text-amber-300 hover:text-amber-900" onClick={() => navigate('/settings?section=customer-storage')}>
                  Set up storage →
                </Button>
              </AlertDescription>
            </Alert>
          );
        }
        if (storageHasError) {
          return (
            <Alert ref={storageWarningRef} className={`border-red-500/50 bg-red-50 dark:bg-red-950/20 text-red-800 dark:text-red-200 transition-all duration-300 ${highlightStorageWarning ? 'ring-2 ring-foreground/50 shadow-lg' : ''}`}>
              <AlertTriangle className="h-4 w-4 !text-red-600" />
              <AlertDescription className="flex items-center gap-2">
                <span className="font-semibold">ACTION REQUIRED:</span> Your storage provider needs attention. Activity logs may not be collected.
                <Button variant="link" className="h-auto p-0 text-sm font-medium text-red-700 dark:text-red-300 hover:text-red-900" onClick={() => navigate('/settings?section=customer-storage')}>
                  Review settings →
                </Button>
              </AlertDescription>
            </Alert>
          );
        }
        return null;
      })()}

      {(() => {
        const hasActivityLogging = Object.values(controls.controllable || {}).flat().some(
          (c: any) => c.remediation_type === 5 && c.risk_rule_type === USER_ACTIVITY_LOGGING_RISK_RULE_TYPE
        );
        const claudeAssigned = selectedEntities.some((e: any) => e.id === String(AGENT_TYPE_CLAUDE));
        if (!isLoggingPolicy(policy) || policy.framework_entity_type !== 1 || !hasActivityLogging || policy.policy_status !== 1 || !claudeAssigned) return null;
        return (
          <Alert className="bg-background">
            <Info className="h-4 w-4" />
            <AlertDescription className="flex items-center gap-2">
              Don't forget to finish the setup in your Claude admin console.
              <Button
                variant="link"
                className="h-auto p-0 text-sm font-medium"
                onClick={() => setShowClaudeSetupDialog(true)}
              >
                View setup steps →
              </Button>
            </AlertDescription>
          </Alert>
        );
      })()}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Policy Controls
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Security controls and actions for this policy
          </p>
        </CardHeader>
        <CardContent>
          {controlsLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : (() => {
              const controllableFlat = Object.values(
                controls.controllable || {}
              ).flat() as any[];
              const acknowledgementFlat = Object.values(
                controls.acknowledgement || {}
              ).flat() as any[];

              let tableControllable: any[];
              if (isLoggingPolicy(policy)) {
                const ual = [...controllableFlat, ...acknowledgementFlat].filter(
                  (c) => c.risk_rule_type === USER_ACTIVITY_LOGGING_RISK_RULE_TYPE
                );
                const seen = new Set<string>();
                tableControllable = ual.filter((c) => {
                  if (seen.has(c.id)) return false;
                  seen.add(c.id);
                  return true;
                });
              } else {
                const withoutUAL = (c: any) =>
                  c.risk_rule_type !== USER_ACTIVITY_LOGGING_RISK_RULE_TYPE;
                // Model Selection only on the AI Access policy, behind the LLM models UI.
                const showModelSelection = llmEnabled && isAiAccessPolicy(policy);
                tableControllable = controllableFlat.filter(
                  (c) => withoutUAL(c) && (showModelSelection || c.risk_rule_type !== MODEL_SELECTION_RISK_RULE_TYPE)
                );
              }

              const hasControllable = tableControllable.length > 0;

              if (!hasControllable) {
                return (
                  <div className="text-center text-muted-foreground py-8">
                    {isLoggingPolicy(policy)
                      ? "No User Activity Logging control on this policy."
                      : "No controls defined for this policy."}
                  </div>
                );
              }

              return (
                <>
                  {hasControllable && (() => {
                    const allControllable = tableControllable;
                    const enforceable = allControllable.filter((c) =>
                      isEnforceableForPolicy(c.risk_rule_id)
                    );
                    const nonEnforceable = allControllable.filter(
                      (c) => !isEnforceableForPolicy(c.risk_rule_id)
                    );

                    return (
                      <div className="space-y-6">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold">
                            Enforceable Controls
                          </h3>
                          <Badge variant="secondary">
                            {allControllable.length}
                          </Badge>
                        </div>

                        {enforceable.length > 0 && (
                          <div className="space-y-3">
                            <div className="ml-1">
                              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                Enforceable by Traceforce
                              </h4>
                            </div>
                            {renderControlsTable(enforceable)}
                          </div>
                        )}

                        {nonEnforceable.length > 0 && (
                          <div className="space-y-3">
                            {enforceable.length > 0 && (
                              <div className="ml-1">
                                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                  Monitor & Alert
                                </h4>
                              </div>
                            )}
                            {renderControlsTable(nonEnforceable)}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </>
              );
            })()}
        </CardContent>
      </Card>

      {/* Route-identity guard (same as the OTLP card below): on an in-place :id
          navigation `policy` briefly holds the PREVIOUS policy while the new fetch runs.
          Mount only once the loaded policy matches the route, so AppBlockControlRow
          remounts for the new id and an immediate toggle can't write the previous
          policy's config to the new one. */}
      {isAiAccessPolicy(policy) && !policyLoading && policy?.id === id && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ban className="h-5 w-5" />
              AI Application Controls
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Controls for managing AI applications on managed devices.
            </p>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]"></TableHead>
                  <TableHead className="w-[350px]">Control</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[200px]">On match</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <AppBlockControlRow policyId={id!} />
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      {(() => {
        // OTLP forwarding: logging policies with the User Activity Logging control can
        // also send their activity logs to one OTLP destination from Settings › Observability.
        // Same gate as the storage alerts above, so the card never shows where it can't apply.
        const activityLoggingControl: any = Object.values(controls.controllable || {}).flat().find(
          (c: any) => c.remediation_type === 5 && c.risk_rule_type === USER_ACTIVITY_LOGGING_RISK_RULE_TYPE
        );
        // Policy and controls load independently on a route (:id) change; render the card only once
        // BOTH belong to the current route (policy.id === the route id, controls finished loading).
        // Otherwise a controls-first finish could pair the new control with the PREVIOUS policy's
        // id/org and save forwarding to the wrong policy.
        if (!isLoggingPolicy(policy) || !activityLoggingControl || controlsLoading || policyLoading || policy?.id !== id) return null;
        return (
          <PolicyOtlpForwardingCard
            session={session}
            policyId={policy.id}
            orgId={policy.org_id}
            otelDestinationId={activityLoggingControl.settings?.otel_destination_ids?.[0] ?? null}
            // Specific-agent logging policies expose a per-agent forwarding subset, constrained
            // to the policy's assigned agents. "All Agents" policies have no selectedEntities, so
            // the card hides the selector and forwards from every agent.
            forwardAgents={(selectedEntities || []).map((e: { catalogType?: number; id: string; name?: string }) => ({ type: Number(e.catalogType ?? e.id), name: e.name ?? String(e.id) }))}
            forwardAgentTypes={activityLoggingControl.settings?.otel_forward_agent_types ?? null}
            onSaved={(otelDestinationId, forwardAgentTypes, updatedAt) => {
              // The control-edit dialog saves the whole settings object from this state, so
              // it must carry the new keys or the next edit of this control would drop them.
              setControls((prev: any) => ({
                ...prev,
                controllable: {
                  ...prev.controllable,
                  [activityLoggingControl.category_name]: prev.controllable[activityLoggingControl.category_name].map((c: any) => {
                    if (c.id !== activityLoggingControl.id) return c;
                    const settings = { ...(c.settings || {}) };
                    if (otelDestinationId) settings.otel_destination_ids = [otelDestinationId];
                    else delete settings.otel_destination_ids;
                    if (otelDestinationId && forwardAgentTypes && forwardAgentTypes.length > 0) settings.otel_forward_agent_types = forwardAgentTypes;
                    else delete settings.otel_forward_agent_types;
                    return { ...c, settings };
                  }),
                },
              }));
              setPolicy((prev: any) => prev ? { ...prev, updated_at: updatedAt } : prev);
            }}
          />
        );
      })()}

      <Dialog open={showToggleStatusDialog} onOpenChange={setShowToggleStatusDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{policy?.policy_status === 1 ? 'Deactivate' : 'Activate'} Policy</DialogTitle>
            <DialogDescription>
              Are you sure you want to {policy?.policy_status === 1 ? 'deactivate' : 'activate'} policy "{policy?.name}"?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setShowToggleStatusDialog(false)}>
              Cancel
            </Button>
            <Button onClick={confirmToggleStatus} variant="default">
              {policy?.policy_status === 1 ? 'Deactivate' : 'Activate'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Policy</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete policy "{policy?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button onClick={confirmDelete} variant="destructive">
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showDisableControlDialog} onOpenChange={(open) => { if (!open) { setShowDisableControlDialog(false); setPendingDisableControl(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disable Rule</DialogTitle>
            <DialogDescription>
              Are you sure you want to disable this rule?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => { setShowDisableControlDialog(false); setPendingDisableControl(null); }}>
              Cancel
            </Button>
            <Button onClick={confirmDisableControl} variant="destructive">
              Disable
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showEditControlDialog}
        onOpenChange={(open) => { if (!open) cancelAllEdits(); }}
      >
        {/* max-h + scroll: the type-checkbox list can outgrow short viewports,
            and the base DialogContent is overflow-hidden with no height cap —
            without this the Save/Cancel row gets clipped off-screen. */}
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingControl?.rule_name || 'Edit Control'}</DialogTitle>
            {editingControl?.rule_description && (
              <DialogDescription>
                {editingControl.rule_description}
              </DialogDescription>
            )}
          </DialogHeader>
          {editingControl && (() => {
            const customControls: React.ReactNode[] = [];

            // User Activity Logging: redaction of sensitive data in stored logs.
            if (
              editingControl.risk_rule_type === USER_ACTIVITY_LOGGING_RISK_RULE_TYPE &&
              remediations.find(r => r.id === editedRemediationControlId)?.remediation_type === 5
            ) {
              customControls.push(
                <div key="redact" className="flex items-center gap-2">
                  <Checkbox
                    id="edit-control-redact"
                    checked={editedRedactAuditLogs}
                    onCheckedChange={(checked) => setEditedRedactAuditLogs(!!checked)}
                  />
                  <label htmlFor="edit-control-redact" className="text-sm text-muted-foreground cursor-pointer">
                    Redact sensitive data in stored logs
                  </label>
                </div>
              );
            }

            // Sensitive Data Handling (rule 9) and Risky Action Handling (rule 19)
            // share one category/item checklist over a flat included allowlist
            // (null = all detected). No Requirement scoping — the dial is pinned
            // (80 / 180) and detection is driven entirely by the checklist. See
            // CategoryChecklistEditor for the selection math (null <-> all).
            if (editingControl.risk_rule_type === SENSITIVE_DATA_HANDLING_RISK_RULE_TYPE) {
              customControls.push(
                <CategoryChecklistEditor
                  key="sensitive-data-categories"
                  idPrefix="sd"
                  categoryLabels={SENSITIVE_DATA_CATEGORY_LABELS}
                  idsByCategory={SENSITIVE_DATA_TYPES_BY_CATEGORY}
                  itemLabels={SENSITIVE_DATA_TYPE_LABELS}
                  selected={editedSensitiveDataTypes}
                  onChange={setEditedSensitiveDataTypes}
                  description="Selected data types will be detected and disallowed."
                  emptyMessage="Select at least one data type to detect."
                />
              );
            }

            if (editingControl.risk_rule_type === CONNECTOR_RISK_CONTAINMENT_RULE_TYPE) {
              customControls.push(
                <CategoryChecklistEditor
                  key="risky-action-categories"
                  idPrefix="ra"
                  categoryLabels={RISKY_ACTION_CATEGORY_LABELS}
                  idsByCategory={RISKY_ACTION_SUBCATEGORIES_BY_CATEGORY}
                  itemLabels={RISKY_ACTION_SUBCATEGORY_LABELS}
                  selected={editedRiskyActionSubcategories}
                  onChange={setEditedRiskyActionSubcategories}
                  description="Selected operations will be detected and disallowed."
                  emptyMessage="Select at least one risky action to detect."
                />
              );
            }

            return (
              <div className="space-y-4 py-2">
                {/* Rule 19 (Risky Action Handling) and rule 9 (Sensitive Data Handling)
                    have no Requirement — it's removed here; detection is driven by the
                    category/subcategory checklist and enable/disable rides the pinned
                    dial (180 / 80) under the hood. The grid collapses to one column so
                    On Violation isn't left half-width. */}
                <div className={`grid grid-cols-1 gap-4 ${editingControl.risk_rule_type === CONNECTOR_RISK_CONTAINMENT_RULE_TYPE || editingControl.risk_rule_type === SENSITIVE_DATA_HANDLING_RISK_RULE_TYPE ? '' : 'sm:grid-cols-2'}`}>
                  {editingControl.risk_rule_type !== CONNECTOR_RISK_CONTAINMENT_RULE_TYPE && editingControl.risk_rule_type !== SENSITIVE_DATA_HANDLING_RISK_RULE_TYPE && (
                  <div className="space-y-2">
                    <Label htmlFor="edit-control-requirement">Requirement</Label>
                    <Select
                      value={editedIssueTypeControlId || ''}
                      onValueChange={setEditedIssueTypeControlId}
                    >
                      <SelectTrigger id="edit-control-requirement" className="w-full">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {(issueTypesByRiskRule[editingControl.risk_rule_id]?.options || []).map((it: any) => (
                          <SelectItem key={it.id} value={it.id}>
                            {getRequirementDisplayLabel(it.expected_value)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="edit-control-violation">On Violation</Label>
                    <Select
                      value={editedRemediationControlId || ''}
                      onValueChange={setEditedRemediationControlId}
                    >
                      <SelectTrigger id="edit-control-violation" className="w-full">
                        <SelectValue placeholder="Select action" />
                      </SelectTrigger>
                      <SelectContent>
                        {getAvailableRemediationsForRiskRule(editingControl.risk_rule_id).map((remediation) => (
                          <SelectItem key={remediation.id} value={remediation.id}>
                            {getRemediationDisplayName(editingControl.risk_rule_type, remediation.remediation_type, remediation.name)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Per-rule custom controls; the section is omitted when the rule has none. */}
                {customControls.length > 0 && (
                  <div className="border-t pt-4">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Custom Controls
                    </Label>
                    <div className="mt-3 space-y-3">
                      {customControls}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={cancelAllEdits}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveControl}
              disabled={!editedIssueTypeControlId || !editedRemediationControlId || isSensitiveDataSelectionEmpty() || isRiskyActionSelectionEmptyForControl()}
            >
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showModelSelectionDialog}
        onOpenChange={(open) => {
          if (!open) {
            cancelAllEdits();
            setModelSelectionStep('configure');
          }
        }}
      >
        <DialogContent className="flex max-h-[92vh] w-[calc(100vw-2rem)] max-w-6xl flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl">
          <DialogHeader className="border-b px-6 py-4 text-left">
            <DialogTitle>{modelSelectionStep === 'configure' ? 'Model Selection' : 'Review allowed models'}</DialogTitle>
            <DialogDescription>
              {modelSelectionStep === 'configure'
                ? 'Configure how LLM Models are approved for usage.'
                : 'Review the models allowed by these controls before saving.'}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6">
            {(() => {
              const models = llmCatalogModels ?? [];
              const hosts = llmHosts ?? [];
              const options = modelSelectionOptions(modelSelection, models, hosts);
              const filterRows: Array<{
                key: keyof ModelSelection;
                name: string;
                description: string;
                options: { id: string; name: string }[];
                placeholder: string;
                searchPlaceholder: string;
                emptyMessage: string;
                itemLabel: string;
                pluralLabel?: string;
              }> = [
                { key: 'hosts', name: 'Host', description: 'Allow only requests to these hosts.', options: options.hosts, placeholder: 'Select hosts', searchPlaceholder: 'Search hosts...', emptyMessage: 'No hosts found.', itemLabel: 'host' },
                { key: 'model_families', name: 'Model Family', description: 'Allow only models of these families.', options: options.families, placeholder: 'Select model families', searchPlaceholder: 'Search model families...', emptyMessage: 'No model families found.', itemLabel: 'model family', pluralLabel: 'model families' },
                { key: 'models', name: 'Model', description: 'Allow only these models.', options: options.models, placeholder: 'Select models', searchPlaceholder: 'Search models...', emptyMessage: 'No models found.', itemLabel: 'model' },
              ];
              const updateModelSelection = (key: keyof ModelSelection, values: string[]) =>
                setModelSelection((current) => pruneModelSelection({ ...current, [key]: values }, models, hosts));
              const { reviewRows, unionAllowed } = modelSelectionReviewRows(modelSelection, models, hosts);
              const allowedModels = unionAllowed;
              const destinations = modelSelection.hosts.length
                ? reviewRows.flatMap((r) => r.hosts).filter((h) => h !== ANY_MODEL_HOST)
                : null;
              const hiddenReviewHosts = reviewRows.length - MODEL_SELECTION_REVIEW_SHOWN;
              const nothingSelected = isModelSelectionEmpty(modelSelection);
              const violationOptions = editingControl ? getAvailableRemediationsForRiskRule(editingControl.risk_rule_id) : [];
              const selectedViolation = violationOptions.find((r) => r.id === editedRemediationControlId);

              if (llmCatalogError) {
                return <div className="rounded-md border px-4 py-8 text-center text-sm text-destructive">{llmCatalogError}</div>;
              }
              if (llmCatalogModels === null || llmHosts === null) {
                return (
                  <>
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-64 w-full" />
                  </>
                );
              }

              return (
                <>
                  <div className="flex items-center justify-between rounded-md border bg-muted/30 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Effective model access</p>
                      <p className="text-xs text-muted-foreground">
                        {nothingSelected
                          ? 'No models selected - no model is allowed'
                          : `${allowedModels.length} of ${models.length} models allowed${destinations
                            ? `, on ${destinations.length} host${destinations.length === 1 ? '' : 's'}`
                            : ', on any intercepted LLM host'}`}
                      </p>
                    </div>
                    <Badge variant={allowedModels.length > 0 ? 'default' : 'destructive'} className="rounded-full px-3 py-1">
                      {allowedModels.length} allowed
                    </Badge>
                  </div>

                  {modelSelectionStep === 'configure' ? (
                    <div className="overflow-hidden rounded-md border">
                      <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-start gap-2">
                          <Settings className="mt-0.5 h-4 w-4 text-foreground" />
                          <div>
                            <p className="text-sm font-semibold text-foreground">Policy Controls</p>
                            <p className="text-xs text-muted-foreground">
                              A model is allowed only when it meets all the filters you&apos;ve applied. To skip a filter, leave it blank.
                              If no filters are selected, models are not allowed. Models not in the catalog are always allowed.
                              When a device is in more than one group, a model is allowed on a host only when every group covering the device allows it there.
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Label htmlFor="model-selection-violation" className="whitespace-nowrap text-xs text-muted-foreground">On violation</Label>
                          <Select
                            value={editedRemediationControlId ?? ''}
                            onValueChange={setEditedRemediationControlId}
                            disabled={violationOptions.length === 0}
                          >
                            <SelectTrigger id="model-selection-violation" className="h-9 w-44">
                              <SelectValue placeholder={violationOptions.length === 0 ? 'No action available' : 'Select action'} />
                            </SelectTrigger>
                            <SelectContent>
                              {violationOptions.map((remediation) => (
                                <SelectItem key={remediation.id} value={remediation.id}>
                                  {getRemediationDisplayName(MODEL_SELECTION_RISK_RULE_TYPE, remediation.remediation_type, remediation.name)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="hidden grid-cols-[minmax(240px,1fr)_minmax(260px,1.15fr)] border-b bg-muted/30 px-4 py-2 text-[11px] font-medium uppercase text-muted-foreground sm:grid">
                        <span>Inventory filter</span>
                        <span>Allowed values</span>
                      </div>

                      <div className="divide-y">
                        {filterRows.map((row) => (
                          <div key={row.key} className="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(240px,1fr)_minmax(260px,1.15fr)] sm:items-start">
                            <div>
                              <p className="text-xs font-semibold text-primary">{row.name}</p>
                              <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">{row.description}</p>
                            </div>
                            <MultiSelect
                              options={row.options}
                              selectedIds={modelSelection[row.key]}
                              onChange={(values) => updateModelSelection(row.key, values)}
                              placeholder={row.placeholder}
                              searchPlaceholder={row.searchPlaceholder}
                              emptyMessage={row.emptyMessage}
                              label={row.itemLabel}
                              pluralLabel={row.pluralLabel}
                              selectAllLabel="Select all"
                              selectAllChecked={row.options.length > 0 && row.options.every((o) => modelSelection[row.key].includes(o.id))}
                              onToggleSelectAll={() => updateModelSelection(row.key, row.options.length > 0 && row.options.every((o) => modelSelection[row.key].includes(o.id)) ? [] : row.options.map((o) => o.id))}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-md border">
                      <div className="border-b px-4 py-3">
                        <p className="text-sm font-semibold text-foreground">Review allowed models</p>
                        {allowedModels.length === 0 && selectedViolation?.is_enforcement && (
                          <p className="mt-1 text-xs text-destructive">
                            No model is allowed. Every AI model request on this policy&apos;s devices will be treated as a violation
                            ({getRemediationDisplayName(MODEL_SELECTION_RISK_RULE_TYPE, selectedViolation.remediation_type, selectedViolation.name)}).
                          </p>
                        )}
                      </div>
                      <div className="max-h-[48vh] overflow-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[24%]">Host</TableHead>
                              <TableHead className="w-[26%]">Model Family</TableHead>
                              <TableHead>Models</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {reviewRows.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={3} className="h-28 text-center text-muted-foreground">No models are allowed by the current controls.</TableCell>
                              </TableRow>
                            ) : (
                              <>
                                {(showAllReviewHosts ? reviewRows : reviewRows.slice(0, MODEL_SELECTION_REVIEW_SHOWN)).map((row) => (
                                  <TableRow key={row.hosts.join(',')}>
                                    <TableCell className="align-top font-medium">
                                      {row.hosts.map((h) => (
                                        <p key={h}>{h === ANY_MODEL_HOST ? 'Any intercepted LLM host' : h}</p>
                                      ))}
                                    </TableCell>
                                    <TableCell className="align-top">
                                      <div className="flex flex-col items-start gap-1.5">
                                        {row.families.map((f) => (
                                          <div key={f.family} className="flex items-center gap-2">
                                            <Badge variant="outline">{f.family}</Badge>
                                            <span className="text-xs text-muted-foreground">{f.allowed} of {f.total}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </TableCell>
                                    <TableCell className="align-top">
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        {(showAllReviewModels ? row.models : row.models.slice(0, MODEL_SELECTION_REVIEW_SHOWN)).map((model) => (
                                          <Badge key={model.id} variant="secondary">{model.model_name}</Badge>
                                        ))}
                                        {row.models.length > MODEL_SELECTION_REVIEW_SHOWN && (
                                          <Button
                                            variant="link"
                                            size="sm"
                                            className="h-auto p-0 text-xs"
                                            aria-expanded={showAllReviewModels}
                                            onClick={() => setShowAllReviewModels((shown) => !shown)}
                                          >
                                            {showAllReviewModels ? 'Show less' : `+${row.models.length - MODEL_SELECTION_REVIEW_SHOWN} more`}
                                          </Button>
                                        )}
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                                {hiddenReviewHosts > 0 && (
                                  <TableRow>
                                    <TableCell colSpan={3}>
                                      <Button
                                        variant="link"
                                        size="sm"
                                        className="h-auto p-0 text-xs"
                                        aria-expanded={showAllReviewHosts}
                                        onClick={() => setShowAllReviewHosts((shown) => !shown)}
                                      >
                                        {showAllReviewHosts ? 'Show fewer' : `+${hiddenReviewHosts} more`}
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                )}
                              </>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                      <div className="space-y-1 border-t px-4 py-3 text-xs">
                        <p>
                          <span className="font-semibold text-foreground">Blocked: </span>
                          <span className="text-muted-foreground">
                            {allowedModels.length === 0
                              ? 'every model'
                              : destinations
                                ? 'other models on these hosts, and all other LLM hosts'
                                : 'other models'}
                          </span>
                        </p>
                        <p>
                          <span className="font-semibold text-foreground">Device in more than one group: </span>
                          <span className="text-muted-foreground">a model is allowed on a host only when every group covering the device allows it there</span>
                        </p>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
          <div className="flex items-center justify-between border-t bg-muted/20 px-6 py-4">
            {(() => {
              const blockReason = modelSelectionStep === 'review' ? getModelSelectionBlockReason() : null;
              return (
                <>
                  <div className="flex items-center gap-3">
                    {modelSelectionStep === 'review' && (
                      <Button variant="outline" disabled={modelSelectionSaving} onClick={() => setModelSelectionStep('configure')}>Back</Button>
                    )}
                    {blockReason && <p className="text-xs text-destructive">{blockReason}</p>}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" disabled={modelSelectionSaving} onClick={cancelAllEdits}>Cancel</Button>
                    {modelSelectionStep === 'configure' ? (
                      <Button disabled={llmCatalogModels === null || llmHosts === null} onClick={() => setModelSelectionStep('review')}>Next</Button>
                    ) : (
                      <Button disabled={modelSelectionSaving || blockReason !== null || isModelSelectionInvalid()} onClick={saveModelSelection}>
                        {modelSelectionSaving ? 'Saving...' : 'Save changes'}
                      </Button>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>

      <ClaudeLoggingSetupDialog open={showClaudeSetupDialog} onOpenChange={setShowClaudeSetupDialog} />
    </div>
  );
};

export default PolicyDetail;