import { Badge } from "@/components/ui/badge";
import { transformMcpName } from "@/lib/utils";
import { mcpAccessEnabled } from "@/lib/featureFlags";
import { connectorsBackTarget, DEFAULT_MCP_ACCESS_POLICY_NAME } from "@/lib/appUtils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import { Shield, Plus, Trash2, Power, AlertTriangle, PowerOff, ChevronDown, ChevronUp, Filter, MessageSquare, Code, ExternalLink, ArrowLeft } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { MultiSelect } from "@/components/ui/multi-select";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchMcpCatalogMap } from "@/lib/mcpCatalog";
import { useOrg } from "@/contexts/OrgContext";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useUrlArrayFilter } from "@/hooks/use-url-filters";
import { traceforcApi } from "@/integrations/traceforce/client";
import { userGroupSourceEnumFromString } from "@/lib/idpGroups";
import { getPolicyStatusBadge, getPolicyAssignmentBadge, getDeviceAssignmentBadge, getAssignmentTypeOptions, getRiskFrameworkBadge, getUserGroupSourceLabel, POLICY_CATEGORY_MAP, POLICY_CATEGORY_AGENT_TYPES, POLICY_CATEGORY_LOGGING } from "@/lib/appUtils";

// AI Access policy category (POLICY_CATEGORY_MAP[5]). The New Policy wizard offers it
// as a third category alongside General Purpose (1) and Coding (2).
const AI_ACCESS_CATEGORY = 5;

const Policies = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { activeOrgId } = useOrg();
  const { session } = useAuth();
  const [policies, setPolicies] = useState<any[]>([]);
  const [selectedPolicies, setSelectedPolicies] = useState<string[]>([]);
  const [frameworkFilters, setFrameworkFilters] = useUrlArrayFilter('framework');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [isNewPolicyDialogOpen, setIsNewPolicyDialogOpen] = useState(false);
  const [policyName, setPolicyName] = useState("");
  // Inline name-collision error under the create dialog's name input (field
  // errors live inline; system errors stay toasts).
  const [policyNameError, setPolicyNameError] = useState<string | null>(null);
  const [policyDescription, setPolicyDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [dropdownsLoaded, setDropdownsLoaded] = useState(false);
  const [frameworks, setFrameworks] = useState<any[]>([]);
  const [selectedFramework, setSelectedFramework] = useState<any>(null);
  const [selectedAssignment, setSelectedAssignment] = useState("");
  const [mcpServers, setMcpServers] = useState<any[]>([]);
  const [selectedMcpIds, setSelectedMcpIds] = useState<string[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [step, setStep] = useState(1);
  const [policyCategory, setPolicyCategory] = useState(null);
  const [selectedRemediationId, setSelectedRemediationId] = useState<string>("");
  const [defaultRemediationId, setDefaultRemediationId] = useState<string>("");
  const [selectedDeviceAssignment, setSelectedDeviceAssignment] = useState("");
  const [userGroups, setUserGroups] = useState<any[]>([]);
  const [selectedUserGroupIds, setSelectedUserGroupIds] = useState<string[]>([]);
  const [showActivateDialog, setShowActivateDialog] = useState(false);
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => {
    const fetchPolicies = async () => {
      setLoading(true); // reset on re-run (e.g. active-org switch) so a re-fetch shows the loading state, not stale policies
      try {
        const policiesResult = await supabase
          .from('policies_with_metadata')
          .select(`
            id,
            name,
            description,
            policy_status,
            created_at,
            updated_at,
            framework_id,
            category,
            assignment_type,
            has_incomplete_controls,
            risk_framework!inner (
              name,
              entity_type
            ),
            employee_assignment_type,
            is_default,
            policy_agents(agent_type),
            policy_mcp_servers(count),
            policy_user_groups(user_groups!inner(deleted_at))
          `)
          .eq('org_id', activeOrgId!)
          .order('updated_at', { ascending: false });

        if (policiesResult.error) throw policiesResult.error;

        const mappedPolicies = (policiesResult.data || [])
          .map((policy: any) => ({
            id: policy.id,
            name: policy.name,
            description: policy.description,
            policy_status: policy.policy_status,
            created_at: policy.created_at,
            updated_at: policy.updated_at,
            framework_id: policy.framework_id,
            category: policy.category,
            framework_name: policy.risk_framework.name,
            framework_entity_type: policy.risk_framework.entity_type,
            assignment_type: policy.assignment_type,
            employee_assignment_type: policy.employee_assignment_type,
            agent_count: new Set((policy.policy_agents || []).map((a: any) => a.agent_type)).size || null,
            mcp_count: policy.policy_mcp_servers[0]?.count ?? null,
            // Live groups only: tombstoned IdP groups keep their attachment
            // rows for reconnect revival, but the detail pages HIDE them — a
            // ghost-inclusive count here would say 2 groups where the detail
            // says Not Assigned. Client-side count over the embed, same shape
            // as the policy_agents count above.
            user_group_count: (policy.policy_user_groups ?? []).filter((l: any) => l.user_groups?.deleted_at === null).length,
            has_incomplete_controls: policy.has_incomplete_controls,
            is_default: policy.is_default
          }))
          // MCP access policies (category 4) ride the dark mcp-access feature:
          // without the flag they must not be visible or activatable here.
          .filter((policy: any) => !policy.is_default && (mcpAccessEnabled || policy.category !== 4));

        setPolicies(mappedPolicies);
      } catch (error) {
        console.error('Error fetching policies:', error);
        toast({
          title: "Error",
          description: "Failed to load policies",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchPolicies();
  }, [toast, activeOrgId]);

  const fetchUserGroups = async () => {
    if (!session?.access_token) return;
    try {
      // GET /api/v1/user-groups: liveness lives server-side (tombstoned IdP
      // groups must not be offered for new scoping), and the client drains
      // the cursor so a big directory can't truncate the picker.
      const data = await traceforcApi.listAllUserGroups(session.access_token);

      setUserGroups(data.map((g) => ({
        id: g.id,
        name: `${g.name} (${getUserGroupSourceLabel(userGroupSourceEnumFromString(g.source))})`
      })));
    } catch (error) {
      console.error('Error fetching user groups:', error);
    }
  };

  useEffect(() => {
    const fetchCreatePolicyData = async () => {
      // The groups read needs the API token; the effect re-runs when the
      // session hydrates, so skipping here never strands the dialog data.
      if (!session?.access_token) return;
      try {
        const [frameworksResult, mcpCatalogMap, agentsResult, remediationsResult, userGroupsResult] = await Promise.all([
          supabase
            .from('risk_framework')
            .select('id, name, entity_type, org_id')
            .eq('org_id', activeOrgId!)
            .order('updated_at', { ascending: false }),
          // Combined catalog (global + this org's private entries) via
          // mcp_catalog_all — throws on error, so no .error check below.
          fetchMcpCatalogMap(activeOrgId!),
          supabase
            .from('agent_catalog')
            .select('agent_type, agent_name')
            .order('agent_name', { ascending: true }),
          supabase
            .from('remediation_controls')
            .select(`
              id,
              remediations!inner (
                remediation_type
              )
            `)
            // Scope to the active org — under the U-series subtree-broadened RLS this org-partitioned
            // table would otherwise merge remediation-control options across every accessible org
            // (same pattern as the issue_type_controls reads).
            .eq('org_id', activeOrgId!)
            .order('remediations(remediation_type)', { ascending: true }),
          // Same live-only + drained read as fetchUserGroups above.
          traceforcApi.listAllUserGroups(session.access_token)
        ]);

        if (frameworksResult.error) throw frameworksResult.error;
        if (agentsResult.error) throw agentsResult.error;
        if (remediationsResult.error) throw remediationsResult.error;
        // userGroupsResult is a plain array — listAllUserGroups throws on error.

        setFrameworks((frameworksResult.data || []).map((f: any) => ({
          id: f.id,
          name: f.name,
          type: f.entity_type,
          org_id: f.org_id
        })));

        // Sorted client-side — the old .order was server-side and the helper returns a Map.
        // Global entries only: policy_mcp_servers still FKs
        // mcp_catalog.mcp_server_type, so an org-catalog assignment cannot be
        // persisted — expose org entries here once that FK is relaxed.
        setMcpServers([...mcpCatalogMap.values()]
          .filter((mcp) => mcp.org_id === null)
          .sort((a, b) => a.mcp_server_name.localeCompare(b.mcp_server_name))
          .map((mcp) => ({
            id: String(mcp.mcp_server_type),
            name: transformMcpName(mcp.mcp_server_name)
          })));

        const agentOptions = (agentsResult.data || []).map((catalog: any) => ({
          id: String(catalog.agent_type),
          name: catalog.agent_name,
        }));
        setAgents(agentOptions);

        // Only the Report control id is needed — it is forced as the policy-wide default.
        const mappedRemediations = (remediationsResult.data || []).map((rc: any) => ({
          id: rc.id,
          remediation_type: rc.remediations.remediation_type
        }));

        // Default (and only) policy-wide remediation is type 1 "Report as Issue".
        const defaultRemediation = mappedRemediations.find((r: any) => r.remediation_type === 1);
        if (!defaultRemediation) {
          throw new Error("Default remediation (type 1) not found");
        }
        setDefaultRemediationId(defaultRemediation.id);
        setSelectedRemediationId(defaultRemediation.id);

        setUserGroups((userGroupsResult || []).map((g) => ({
          id: g.id,
          name: `${g.name} (${getUserGroupSourceLabel(userGroupSourceEnumFromString(g.source))})`
        })));

        setDropdownsLoaded(true);
      } catch (error) {
        console.error('Error fetching dropdown data:', error);
        toast({
          title: "Error",
          description: "Failed to load policy creation options",
          variant: "destructive",
        });
        setDropdownsLoaded(false);
      }
    };

    fetchCreatePolicyData();
    // session?.access_token: the groups read goes through the API now, so a
    // late-hydrating session must trigger a re-run rather than skip the picker.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast, activeOrgId, session?.access_token]);

  // Re-fetch user groups when tab regains focus (e.g. after creating groups in another tab)
  useEffect(() => {
    const onFocus = () => fetchUserGroups();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const handlePolicyClick = (policyId: string) => {
    // MCP access policies (category 4) route to their dedicated editor —
    // PolicyDetail renders scan-policy controls (framework rules, issue
    // types) that are meaningless and mis-editable for them. With the
    // feature flag off there is no editor, so they don't navigate at all.
    const policy = policies.find((p) => p.id === policyId);
    if (policy?.category === 4) {
      if (mcpAccessEnabled) navigate(`/policies/${policyId}/access`, { state: { backSearch: location.search.replace(/^\?/, '') } });
      return;
    }
    navigate(`/policies/${policyId}`, { state: { backSearch: location.search.replace(/^\?/, '') } });
  };

  const handleFrameworkFiltersChange = (values: string[]) => {
    setFrameworkFilters(values);
    // Changing the visible set invalidates the row selection.
    setSelectedPolicies([]);
  };

  const visiblePolicies = frameworkFilters.length === 0
    ? policies
    : policies.filter(p => frameworkFilters.includes(p.framework_id));

  const handleFrameworkChange = (frameworkId: string) => {
    const framework = frameworks.find(f => f.id === frameworkId);
    setSelectedFramework(framework ?? null);
  };

  const handleSelectCategory = (category: number) => {
    setPolicyCategory(category);
    if (category === AI_ACCESS_CATEGORY) {
      // AI Access governs ALL agents (not a selected set); the admin only picks the
      // user groups it applies to in step 3.
      setSelectedAgentIds([]);
      setSelectedAssignment("1");
    } else {
      const categoryAgents = agents.filter(a => (POLICY_CATEGORY_AGENT_TYPES[category] || []).includes(Number(a.id)));
      setSelectedAgentIds(categoryAgents.map(a => a.id));
      setSelectedAssignment("2");
    }
    const agentFramework = frameworks.find(f => f.type === 1);
    if (agentFramework) setSelectedFramework(agentFramework);
    setStep(3);
  };

  const handleCloseModal = () => {
    setPolicyName("");
    setPolicyNameError(null);
    setPolicyDescription("");
    setSelectedFramework(null);
    setSelectedAssignment("");
    setSelectedMcpIds([]);
    setSelectedAgentIds([]);
    setSelectedDeviceAssignment("");
    setSelectedUserGroupIds([]);
    setStep(1);
    setPolicyCategory(null);
    setSelectedRemediationId(defaultRemediationId);
    setIsNewPolicyDialogOpen(false);
  };

  const handleSelectPolicy = (policyId: string, checked: boolean) => {
    if (checked) {
      setSelectedPolicies([...selectedPolicies, policyId]);
    } else {
      setSelectedPolicies(selectedPolicies.filter(id => id !== policyId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedPolicies(visiblePolicies.map(p => p.id));
    } else {
      setSelectedPolicies([]);
    }
  };

  const handleActivateSelected = () => {
    if (selectedPolicies.length === 0) return;
    
    const inactivePolicies = policies.filter(p => selectedPolicies.includes(p.id) && p.policy_status === 2);
    
    if (inactivePolicies.length === 0) return;
    
    setShowActivateDialog(true);
  };

  const confirmActivate = async () => {
    setShowActivateDialog(false);
    
    const inactivePolicies = policies.filter(p => selectedPolicies.includes(p.id) && p.policy_status === 2);
    const inactivePolicyIds = inactivePolicies.map(p => p.id);
    
    try {
        const { data: updatedPolicies, error } = await supabase
          .from('policies')
          .update({ policy_status: 1 })
          .in('id', inactivePolicyIds)
          .select('id, updated_at');

        if (error) throw error;

        const updatedPoliciesMap = new Map(
          (updatedPolicies || []).map(p => [p.id, p.updated_at])
        );

        setPolicies(policies.map(p => 
          inactivePolicyIds.includes(p.id) 
            ? { ...p, policy_status: 1, updated_at: updatedPoliciesMap.get(p.id) || p.updated_at } 
            : p
        ));
        setSelectedPolicies([]);
        toast({
          title: "Success",
          description: `Activated ${inactivePolicies.length} policies`,
        });
    } catch (error) {
      console.error('Error activating policies:', error);
      toast({
        title: "Error",
        description: "Failed to activate policies",
        variant: "destructive",
      });
    }
  };

  const handleDeactivateSelected = () => {
    if (selectedPolicies.length === 0) return;
    
    const activePolicies = policies.filter(p => selectedPolicies.includes(p.id) && p.policy_status === 1);
    
    if (activePolicies.length === 0) return;
    
    setShowDeactivateDialog(true);
  };

  const confirmDeactivate = async () => {
    setShowDeactivateDialog(false);
    
    const activePolicies = policies.filter(p => selectedPolicies.includes(p.id) && p.policy_status === 1);
    const activePolicyIds = activePolicies.map(p => p.id);
    
    try {
        const { data: updatedPolicies, error } = await supabase
          .from('policies')
          .update({ policy_status: 2 })
          .in('id', activePolicyIds)
          .select('id, updated_at');

        if (error) throw error;

        const updatedPoliciesMap = new Map(
          (updatedPolicies || []).map(p => [p.id, p.updated_at])
        );

        setPolicies(policies.map(p => 
          activePolicyIds.includes(p.id) 
            ? { ...p, policy_status: 2, updated_at: updatedPoliciesMap.get(p.id) || p.updated_at } 
            : p
        ));
        setSelectedPolicies([]);
        toast({
          title: "Success",
          description: `Deactivated ${activePolicies.length} policies`,
        });
    } catch (error) {
      console.error('Error deactivating policies:', error);
      toast({
        title: "Error",
        description: "Failed to deactivate policies",
        variant: "destructive",
      });
    }
  };

  const deletablePolicies = selectedPolicies.filter(id => {
    const policy = policies.find(p => p.id === id);
    // Logging policies (category=3) are protected, matching PolicyDetail's hidden delete.
    // The seeded default access policy is protected BY NAME. The name stays a
    // stable key because the access editor locks renaming the default and
    // reserves this name (see DEFAULT_MCP_ACCESS_POLICY_NAME in appUtils and
    // McpAccessPolicyDetail's saveName). Every other access policy deletes
    // normally, with the editor's own delete-confirm.
    const isSeededAccessDefault =
      policy?.category === 4 && policy?.name === DEFAULT_MCP_ACCESS_POLICY_NAME;
    return policy && !policy.is_default && policy.category !== POLICY_CATEGORY_LOGGING && !isSeededAccessDefault;
  });

  const handleDeleteSelected = () => {
    if (deletablePolicies.length === 0) return;

    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    setShowDeleteDialog(false);

    try {
        const { error } = await supabase
          .from('policies')
          .delete()
          .in('id', deletablePolicies);

        if (error) throw error;

        setPolicies(policies.filter(p => !deletablePolicies.includes(p.id)));
        setSelectedPolicies([]);
        toast({
          title: "Success",
          description: `Deleted ${deletablePolicies.length} policies`,
        });
    } catch (error) {
      console.error('Error deleting policies:', error);
      toast({
        title: "Error",
        description: "Failed to delete policies",
        variant: "destructive",
      });
    }
  };

  const handleCreatePolicy = async () => {
    if (!policyName.trim() || !selectedFramework || !selectedAssignment || !selectedDeviceAssignment) return;

    // Pick the RPC + params per category, then share ONE try/catch (toast, navigate, and
    // the 23505 name-collision handling). AI Access uses a dedicated RPC: a category-5
    // policy over all agents, carrying its app-blocking selection in ai_access_config; the
    // RPC attaches only the Model Selection (rule 15) framework control, NOT the full agent
    // risk control set create_agent_policy would wrongly attach.
    const employeeAssignmentType = parseInt(selectedDeviceAssignment);
    // Keep the RPC-name union the typed supabase client expects, rather than widening to
    // `string` (which would relax rpc()'s function-name checking).
    let rpcFunction: 'create_ai_access_policy' | 'create_agent_policy' | 'create_mcp_policy';
    let params: any;

    if (policyCategory === AI_ACCESS_CATEGORY) {
      rpcFunction = 'create_ai_access_policy';
      params = {
        p_name: policyName.trim(),
        p_description: policyDescription.trim() || null,
        p_org_id: selectedFramework.org_id,
        p_employee_assignment_type: employeeAssignmentType,
        p_user_group_ids: employeeAssignmentType === 2 ? selectedUserGroupIds : [],
      };
    } else {
      const isAgentFramework = selectedFramework.type === 1;
      rpcFunction = isAgentFramework ? 'create_agent_policy' : 'create_mcp_policy';
      const assignmentType = parseInt(selectedAssignment);
      params = {
        p_name: policyName.trim(),
        p_description: policyDescription.trim() || null,
        p_framework_id: selectedFramework.id,
        p_assignment_type: assignmentType,
        p_org_id: selectedFramework.org_id,
        p_employee_assignment_type: employeeAssignmentType,
        // These RPC parameters remain for backwards compatibility, but their
        // creation settings are obsolete. New policies start inactive and use
        // the legacy balanced value until the database signature is updated.
        p_policy_status: 2,
        p_aggression_level: 2,
        p_remediation_control_id: selectedRemediationId,
        p_user_group_ids: employeeAssignmentType === 2 ? selectedUserGroupIds : [],
      };
      if (isAgentFramework) {
        params.p_agent_types = assignmentType === 2 ? selectedAgentIds.map(Number) : [];
        params.p_category = policyCategory;
      } else {
        params.p_mcp_server_types = assignmentType === 2 ? selectedMcpIds.map(Number) : [];
      }
    }

    try {
      const { data: policyId, error } = await supabase.rpc(rpcFunction, params);
      if (error) throw error;

      toast({
        title: "Success",
        description: "Policy created successfully",
      });
      navigate(`/policies/${policyId}`, { state: { backSearch: location.search.replace(/^\?/, '') } });
    } catch (error: any) {
      console.error('Error creating policy:', error);

      // Unique constraint violation on policy name: shown inline, under the
      // name input (the dialog stays open with the draft intact).
      if (error?.code === '23505' && error?.message?.includes('policies_name_org_key')) {
        setPolicyNameError("A policy with this name already exists.");
        // The name input (and this error) live on step 1; Create fires on the
        // last step — jump back so the failure is visible and fixable.
        setStep(1);
      } else {
        toast({
          title: "Error",
          description: "Failed to create policy. Please try again.",
          variant: "destructive",
        });
      }
    }
  };

  return (
    <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          {new URLSearchParams(location.search).has('source_mcps') && (
            <Button
              variant="ghost"
              onClick={() => {
                const t = connectorsBackTarget(location.state);
                navigate(t.path, { state: t.state });
              }}
            >
              <ArrowLeft className="h-4 w-4" />
              {connectorsBackTarget(location.state).label}
            </Button>
          )}
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Policies</h1>
            <p className="text-muted-foreground">Manage your organization's security policies and controls.</p>
          </div>
        </div>

        <div className="space-y-4 mb-4">
          <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="outline">
                <Filter className="h-4 w-4" />
                Filters
                {(() => {
                  const appliedFilters = [frameworkFilters.length > 0].filter(Boolean).length;
                  return appliedFilters > 0 ? (
                    <Badge variant="secondary" className="ml-1">
                      {appliedFilters}
                    </Badge>
                  ) : null;
                })()}
                {filtersOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <Card className="mt-4">
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">Risk framework</label>
                      <MultiSelect
                        options={frameworks.map(f => ({ id: f.id, name: f.name }))}
                        selectedIds={frameworkFilters}
                        onChange={handleFrameworkFiltersChange}
                        placeholder="All frameworks"
                        searchPlaceholder="Search frameworks..."
                        emptyMessage="No frameworks found."
                        label="framework"
                        disabled={!dropdownsLoaded}
                        compact
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </CollapsibleContent>
          </Collapsible>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                {selectedPolicies.length > 0 && (() => {
                  const activeCount = policies.filter(p => selectedPolicies.includes(p.id) && p.policy_status === 1).length;
                  const inactiveCount = policies.filter(p => selectedPolicies.includes(p.id) && p.policy_status === 2).length;
                  return (
                    <>
                      {inactiveCount > 0 && (
                        <Button 
                          onClick={handleActivateSelected}
                        >
                          <Power className="h-4 w-4" />
                          Activate Selected ({inactiveCount})
                        </Button>
                      )}
                      {activeCount > 0 && (
                        <Button 
                          onClick={handleDeactivateSelected}
                        >
                          <PowerOff className="h-4 w-4" />
                          Deactivate Selected ({activeCount})
                        </Button>
                      )}
                      {deletablePolicies.length > 0 && (
                        <Button
                          variant="destructive"
                          onClick={handleDeleteSelected}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete Selected ({deletablePolicies.length})
                        </Button>
                      )}
                    </>
                  );
                })()}
                 <Dialog open={isNewPolicyDialogOpen} onOpenChange={(open) => { if (!open) handleCloseModal(); else setIsNewPolicyDialogOpen(true); }}>
                   <DialogTrigger asChild>
                     <Button disabled={!dropdownsLoaded}>
                       <Plus className="h-4 w-4" />
                       New Policy
                     </Button>
                   </DialogTrigger>
                 <DialogContent className="sm:max-w-2xl">
                   <DialogHeader>
                     <DialogTitle>
                       {step === 1 ? "Create New Policy" :
                        step === 2 ? "Choose Agent Category" :
                        "Configure Policy"}
                     </DialogTitle>
                     <DialogDescription>
                       {step === 1 ? "Name your security policy." :
                        step === 2 ? "What kind of AI agents will this policy govern?" :
                        "Set framework, assignment, and device scope."}
                     </DialogDescription>
                   </DialogHeader>
                   <div className="mb-2">
                     <Progress value={(step / 3) * 100} className="h-1.5" />
                     <p className="text-xs text-muted-foreground mt-1">Step {step} of 3</p>
                   </div>

                   {/* Step 1: Name & Description */}
                   {step === 1 && (
                     <div className="space-y-4 py-2">
                       <div className="space-y-2">
                         <Label htmlFor="policy-name">Policy Name</Label>
                         <Input
                           id="policy-name"
                           placeholder="Enter policy name..."
                           value={policyName}
                           onChange={(e) => {
                             setPolicyName(e.target.value);
                             setPolicyNameError(null);
                           }}
                         />
                         {policyNameError && (
                           <p className="text-sm text-destructive">{policyNameError}</p>
                         )}
                       </div>
                       <div className="space-y-2">
                         <Label htmlFor="policy-description">Description</Label>
                         <Textarea
                           id="policy-description"
                           placeholder="Enter policy description..."
                           value={policyDescription}
                           onChange={(e) => setPolicyDescription(e.target.value)}
                           rows={3}
                         />
                       </div>
                       <div className="flex justify-end gap-2">
                         <Button variant="outline" onClick={handleCloseModal}>Cancel</Button>
                         <Button onClick={() => setStep(2)} disabled={!policyName.trim()}>Next</Button>
                       </div>
                     </div>
                   )}

                   {/* Step 2: General Purpose vs Coding vs AI Access */}
                   {step === 2 && (
                     <div className="space-y-4 py-2">
                       <div className="grid grid-cols-3 gap-3">
                         <button
                           type="button"
                           onClick={() => handleSelectCategory(1)}
                           className="flex flex-col items-center gap-3 rounded-lg border-2 p-6 transition-all hover:border-primary hover:bg-accent border-border"
                         >
                           <MessageSquare className="h-8 w-8 text-primary" />
                           <div className="text-center">
                             <p className="font-semibold text-foreground">{POLICY_CATEGORY_MAP[1]}</p>
                             <p className="text-xs text-muted-foreground mt-1">{agents.filter(a => (POLICY_CATEGORY_AGENT_TYPES[1] || []).includes(Number(a.id))).map(a => a.name).join(', ')}</p>
                           </div>
                         </button>
                         <button
                           type="button"
                           onClick={() => handleSelectCategory(2)}
                           className="flex flex-col items-center gap-3 rounded-lg border-2 p-6 transition-all hover:border-primary hover:bg-accent border-border"
                         >
                           <Code className="h-8 w-8 text-primary" />
                           <div className="text-center">
                             <p className="font-semibold text-foreground">{POLICY_CATEGORY_MAP[2]}</p>
                             <p className="text-xs text-muted-foreground mt-1">{agents.filter(a => (POLICY_CATEGORY_AGENT_TYPES[2] || []).includes(Number(a.id))).map(a => a.name).join(', ')}</p>
                           </div>
                         </button>
                         <button
                           type="button"
                           onClick={() => handleSelectCategory(AI_ACCESS_CATEGORY)}
                           className="flex flex-col items-center gap-3 rounded-lg border-2 p-6 transition-all hover:border-primary hover:bg-accent border-border"
                         >
                           <Shield className="h-8 w-8 text-primary" />
                           <div className="text-center">
                             <p className="font-semibold text-foreground">{POLICY_CATEGORY_MAP[AI_ACCESS_CATEGORY]}</p>
                             <p className="text-xs text-muted-foreground mt-1">Block selected AI applications from reaching their AI agents on devices</p>
                           </div>
                         </button>
                       </div>
                       <div className="flex justify-start">
                         <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
                       </div>
                     </div>
                   )}

                   {/* Step 3: Framework, Assignment, Devices */}
                   {step === 3 && (
                     <div className="space-y-4 py-2">
                       {policyCategory === AI_ACCESS_CATEGORY ? (
                         <div className="rounded-md border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                           AI Access policies derive from the Default Agent Risk Framework and apply to
                           all agents. Choose which users this policy applies to below.
                         </div>
                       ) : (
                         <>
                           <div className="space-y-2">
                             <Label htmlFor="policy-framework">Agent Risk Framework</Label>
                             <Select
                               value={selectedFramework?.id ?? ""}
                               onValueChange={handleFrameworkChange}
                             >
                               <SelectTrigger id="policy-framework">
                                 <SelectValue placeholder="Select an agent risk framework..." />
                               </SelectTrigger>
                               <SelectContent>
                                 {frameworks
                                   .filter((framework) => framework.type === 1)
                                   .map((framework) => (
                                     <SelectItem key={framework.id} value={framework.id}>
                                       {framework.name}
                                     </SelectItem>
                                   ))}
                               </SelectContent>
                             </Select>
                           </div>

                           <div className="space-y-2">
                             <Label>Select Agents</Label>
                             <MultiSelect
                               options={agents.filter(a => policyCategory ? (POLICY_CATEGORY_AGENT_TYPES[policyCategory] || []).includes(Number(a.id)) : true)}
                               selectedIds={selectedAgentIds}
                               onChange={setSelectedAgentIds}
                               placeholder="Select agents..."
                               searchPlaceholder="Search agents..."
                               emptyMessage="No agents found."
                               label="agent"
                             />
                           </div>
                         </>
                       )}

                       <div className="space-y-2">
                         <Label htmlFor="device-assignment">Assign Users</Label>
                         <Select
                           value={selectedDeviceAssignment}
                           onValueChange={(value) => {
                             setSelectedDeviceAssignment(value);
                             setSelectedUserGroupIds([]);
                           }}
                         >
                           <SelectTrigger>
                             <SelectValue placeholder="Select users..." />
                           </SelectTrigger>
                           <SelectContent>
                             <SelectItem value="1">All Users</SelectItem>
                             <SelectItem value="2">Selected Users</SelectItem>
                           </SelectContent>
                         </Select>
                       </div>
                       {selectedDeviceAssignment === '2' && (
                         <div>
                           <Label>Select User Groups</Label>
                           <MultiSelect
                             options={userGroups}
                             selectedIds={selectedUserGroupIds}
                             onChange={setSelectedUserGroupIds}
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
                       <div className="flex justify-between gap-2">
                         <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
                         <Button
                           onClick={handleCreatePolicy}
                           disabled={
                             !selectedFramework ||
                             !selectedDeviceAssignment ||
                             (policyCategory !== AI_ACCESS_CATEGORY && selectedAgentIds.length === 0) ||
                             (selectedDeviceAssignment === "2" && selectedUserGroupIds.length === 0)
                           }
                         >
                           Review and Activate Policy
                         </Button>
                       </div>
                     </div>
                   )}
                 </DialogContent>
               </Dialog>
            </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                 <TableRow>
                   <TableHead className="w-12">
                      <Checkbox
                        checked={selectedPolicies.length === visiblePolicies.length && visiblePolicies.length > 0}
                        onCheckedChange={handleSelectAll}
                        aria-label="Select all policies"
                        disabled={loading}
                      />
                   </TableHead>
                    <TableHead>Policy</TableHead>
                    <TableHead>Framework</TableHead>
                    <TableHead>Assigned Agents/Connectors</TableHead>
                    <TableHead>Assigned Users</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Last Updated</TableHead>
                 </TableRow>
              </TableHeader>
               <TableBody>
                  {loading ? (
                     Array.from({ length: 3 }).map((_, index) => (
                       <TableRow key={index}>
                         <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                         <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                         <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                         <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                         <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                         <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                         <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                         <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                       </TableRow>
                     ))
                 ) : visiblePolicies.length === 0 ? (
                     <TableRow>
                       <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                         {frameworkFilters.length > 0
                           ? "No policies implement this framework yet."
                           : "No policies found. Create your first policy to get started."}
                       </TableCell>
                     </TableRow>
                 ) : (
                   visiblePolicies.map((policy) => (
                     <TableRow
                       key={policy.id}
                       // Access policies (category 4) navigate to their own
                       // editor only when the feature is on (see
                       // handlePolicyClick) — don't advertise a dead click.
                       className={policy.category === 4 && !mcpAccessEnabled ? undefined : "cursor-pointer hover:bg-muted/50"}
                       onClick={() => handlePolicyClick(policy.id)}
                     >
                       <TableCell>
                         <Checkbox
                           checked={selectedPolicies.includes(policy.id)}
                           onCheckedChange={(checked) => handleSelectPolicy(policy.id, checked as boolean)}
                           aria-label={`Select ${policy.name}`}
                           onClick={(e) => e.stopPropagation()}
                         />
                       </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium text-foreground">
                              {policy.name}
                            </div>
                            {policy.description && (
                              <div className="text-sm text-muted-foreground">
                                {policy.description}
                              </div>
                            )}
                            {/* "Incomplete controls" is a scan-policy concept (unset
                                issue-type/remediation FKs). MCP access policies (category 4)
                                keep those FKs NULL permanently BY DESIGN — that's what keeps
                                their condition rows invisible to scan evaluation — so the
                                banner would be a false alarm on every access policy, forever. */}
                            {policy.has_incomplete_controls && policy.category !== 4 && (
                              <Badge className="mt-1 bg-yellow-500 text-black hover:bg-yellow-600">
                                <AlertTriangle className="h-3 w-3" />
                                Action Required: Configure Controls
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                          <TableCell>
                            <div 
                              className="cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (policy.framework_id) {
                                  navigate(`/risk-frameworks/${policy.framework_id}?source_policies=true`, { state: { backSearch: location.search.replace(/^\?/, '') } });
                                }
                              }}
                            >
                              {getRiskFrameworkBadge(policy.framework_name, policy.framework_entity_type)}
                            </div>
                          </TableCell>
                         <TableCell>
                           {getPolicyAssignmentBadge(
                             policy.assignment_type,
                             policy.framework_entity_type,
                             policy.framework_entity_type === 1 ? policy.agent_count : policy.mcp_count
                           )}
                         </TableCell>
                         <TableCell>
                           {getDeviceAssignmentBadge(
                             policy.employee_assignment_type,
                             policy.framework_entity_type,
                             policy.user_group_count
                           )}
                         </TableCell>
                         <TableCell>
                           {getPolicyStatusBadge(policy.policy_status)}
                         </TableCell>
                        <TableCell className="font-mono text-sm text-muted-foreground">
                          {new Date(policy.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="font-mono text-sm text-muted-foreground">
                          {new Date(policy.updated_at).toLocaleDateString()}
                        </TableCell>
                     </TableRow>
                   ))
                 )}
               </TableBody>
            </Table>
          </CardContent>
        </Card>

      <Dialog open={showActivateDialog} onOpenChange={setShowActivateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Activate Policies</DialogTitle>
            <DialogDescription>
              Are you sure you want to activate {policies.filter(p => selectedPolicies.includes(p.id) && p.policy_status === 2).length} selected {policies.filter(p => selectedPolicies.includes(p.id) && p.policy_status === 2).length === 1 ? 'policy' : 'policies'}?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setShowActivateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={confirmActivate} variant="default">
              Activate
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeactivateDialog} onOpenChange={setShowDeactivateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate Policies</DialogTitle>
            <DialogDescription>
              Are you sure you want to deactivate {policies.filter(p => selectedPolicies.includes(p.id) && p.policy_status === 1).length} selected {policies.filter(p => selectedPolicies.includes(p.id) && p.policy_status === 1).length === 1 ? 'policy' : 'policies'}?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setShowDeactivateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={confirmDeactivate} variant="default">
              Deactivate
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Policies</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {deletablePolicies.length} selected {deletablePolicies.length === 1 ? 'policy' : 'policies'}? This action cannot be undone.
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
    </div>
  );
};

export default Policies;