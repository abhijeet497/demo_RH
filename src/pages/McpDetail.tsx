import { ArrowLeft, Users, Shield, AlertTriangle, Download, Loader2, Info, Laptop, ExternalLink, ChevronRight, Unplug, Wrench } from "lucide-react"
import { orgRpcArgs } from '@/lib/orgScope';
import { supabase } from "@/integrations/supabase/client"
import { DeviceOwnerHeader } from "@/components/DeviceOwnerHeader"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useLocation, useNavigate, useParams, useSearchParams, Link } from "react-router-dom"
import { useState, useEffect, useMemo, useCallback } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { useOrg } from "@/contexts/OrgContext"
import { useAuth } from "@/contexts/AuthContext"
import { traceforcApi } from "@/integrations/traceforce/client"
import type { MdmIntegration } from "@/integrations/traceforce/types"
import { useToast } from "@/hooks/use-toast"
import { getPolicyStatusBadge, getPolicyAssignmentBadge, getRiskTextColor, getRiskBadge, getRiskBorderColor, getRiskIcon, formatScore, getPlanBadge, getPlan, getEffectivePlan, getAuthType, getDeploymentModel, getDistributionChannel, getDistributionChannelBadge, getRiskDifferenceIndicator, getScoreBadgeWithDiff, getEffectiveScoreDisplay, anyMdmNeedsAttention, CUSTOM_MCP_SERVER_TYPE } from "@/lib/appUtils"
import { downloadCsv, csvTimestamp } from "@/lib/csvUtils"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { transformMcpName } from "@/lib/utils"
import { mcpAccessEnabled } from "@/lib/featureFlags"
import { McpToolsTableView } from "@/components/McpToolsCard"
import { collectToolsFromInstances, parseMcpInstanceTools } from "@/lib/mcpInstanceTools"
import { connectorLocationText } from "@/lib/connectorLocation"
import ConnectorLocations from "@/components/ConnectorLocations"
import { fetchMcpCatalogMap } from "@/lib/mcpCatalog"

const McpDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { toast } = useToast()
  const { session } = useAuth()
  const { activeOrgId } = useOrg()
  const [searchParams] = useSearchParams()
  const [mcp, setMcp] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [mcpFrameworkId, setMcpFrameworkId] = useState<string | null>(null)
  const [policies, setPolicies] = useState<any[]>([])
  const [policiesLoading, setPoliciesLoading] = useState(true)
  const [vulnerabilities, setVulnerabilities] = useState<any[]>([])
  const [vulnerabilitiesLoading, setVulnerabilitiesLoading] = useState(true)
  const [exportLoading, setExportLoading] = useState(false)
  const [agentsExportLoading, setAgentsExportLoading] = useState(false)
  const [agents, setAgents] = useState<any[]>([])
  const [agentsLoading, setAgentsLoading] = useState(true)
  const [showUserActivityModal, setShowUserActivityModal] = useState(false)
  const [userActivityData, setUserActivityData] = useState<any[]>([])
  const [userActivityLoading, setUserActivityLoading] = useState(false)
  const [showMcpInstancesModal, setShowMcpInstancesModal] = useState(false)
  const [showToolsModal, setShowToolsModal] = useState(false)
  const [selectedToolInstance, setSelectedToolInstance] = useState<any>(null)
  const [selectedMcpInstances, setSelectedMcpInstances] = useState<any[]>([])
  const [selectedAgent, setSelectedAgent] = useState<any>(null)
  const [allMcpInstances, setAllMcpInstances] = useState<any[]>([])
  const [mdmIntegrations, setMdmIntegrations] = useState<MdmIntegration[]>([])
  const [mdmLoaded, setMdmLoaded] = useState(false)

  // Computed MDM states — derived from full array for provider-agnostic coverage
  const mdmNeedsAttention = anyMdmNeedsAttention(mdmIntegrations)
  const mdmNotConfigured = mdmLoaded && mdmIntegrations.length === 0

  const instancesForAgent = useCallback(
    (agent: { agent_type: number; plan: number | null; notInstalled?: boolean }) =>
      allMcpInstances.filter(
        (instance) =>
          instance.agent_type === agent.agent_type &&
          (agent.notInstalled
            ? !instance.linked_plans || instance.linked_plans.length === 0
            : (instance.linked_plans || []).includes(agent.plan)),
      ),
    [allMcpInstances],
  )

  // Custom (uncatalogued) MCPs share type 999999999 — tools aren't meaningful to show.
  const isCustomMcp = mcp?.mcp_server_type === CUSTOM_MCP_SERVER_TYPE

  // Tools discovered on this agent's MCP instances (mcp_server_instances.tools JSON).
  const toolsByAgentKey = useMemo(() => {
    const map = new Map<string, ReturnType<typeof collectToolsFromInstances>>()
    if (isCustomMcp) return map
    for (const agent of agents) {
      const key = `${agent.agent_id ?? "ni"}-${agent.agent_type}-${agent.plan ?? "none"}`
      map.set(key, collectToolsFromInstances(instancesForAgent(agent)))
    }
    return map
  }, [agents, instancesForAgent, isCustomMcp])

  const selectedAgentTools = useMemo(() => {
    if (isCustomMcp || !selectedAgent) return []
    const key = `${selectedAgent.agent_id ?? "ni"}-${selectedAgent.agent_type}-${selectedAgent.plan ?? "none"}`
    return toolsByAgentKey.get(key) ?? collectToolsFromInstances(instancesForAgent(selectedAgent))
  }, [selectedAgent, toolsByAgentKey, instancesForAgent, isCustomMcp])

  useEffect(() => {
    if (session?.access_token) {
      fetchMdmIntegration()
    }
  }, [session?.access_token])

  const fetchMdmIntegration = async () => {
    if (!session?.access_token) return
    try {
      const response = await traceforcApi.getMdmIntegration(session.access_token)
      if (response.error) {
        throw new Error(response.error)
      }
      if (response.data) {
        setMdmIntegrations(response.data)
      }
      setMdmLoaded(true)
    } catch (error) {
      console.error('Error fetching MDM integration:', error)
    }
  }

  useEffect(() => {
    const fetchMcp = async () => {
      if (!id) return
      
      setLoading(true)
      
      try {
        const { data, error } = await supabase
          .from('active_mcp_servers')
          .select(`
            id,
            org_id,
            mcp_server_type,
            base_score,
            actual_score,
            active_issues,
            active_users,
            updated_at
          `)
          .eq('org_id', activeOrgId!)
          .eq('id', id)
          .maybeSingle() as { data: any, error: any }

        if (error) throw error

        if (!data) {
          setMcp(null)
          setLoading(false)
          return
        }

        // Catalog fields come from mcp_catalog_all (global + active-org entries)
        // resolved by mcp_server_type — an mcp_catalog embed can't see org-catalog
        // MCPs (their mcp_catalog_id is NULL). A type in neither catalog keeps the
        // old !inner semantics and renders "Connector not found".
        const catalogMap = await fetchMcpCatalogMap(activeOrgId!, [data.mcp_server_type])
        const catalogEntry = catalogMap.get(data.mcp_server_type)
        if (!catalogEntry) {
          setMcp(null)
          setLoading(false)
          return
        }

        // Get associated agents for this MCP
        const { data: instances, error: instanceError } = await supabase
          .from('mcp_server_instances_with_agent_catalog')
          .select(`
            agent_name
          `)
          .eq('org_id', activeOrgId!)
          .eq('mcp_server_id', data.id)

        if (instanceError) throw instanceError
        
        // Extract unique agent names
        const agents = [...new Set(
          instances
            ?.map((instance: any) => instance.agent_name)
            .filter(Boolean) || []
        )]
        
        const mappedMcp = {
          id: data.id,
          org_id: data.org_id,
          mcp_server_type: data.mcp_server_type,
          base_score: formatScore(data.base_score),
          actual_score: formatScore(data.actual_score),
          active_issues: data.active_issues,
          active_users: data.active_users,
          updated_at: data.updated_at,
          mcp_server_name: catalogEntry.mcp_server_name,
          description: catalogEntry.description,
          website: catalogEntry.website,
          agents: agents
        }
        
        setMcp(mappedMcp)
      } catch (error) {
        console.error('Error fetching MCP:', error)
        toast({
          title: "Error",
          description: "Failed to load connector data",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchMcp()
  }, [id, toast, activeOrgId])

  useEffect(() => {
    const fetchFramework = async () => {
      try {
        const { data, error } = await supabase
          .from('risk_framework')
          .select('id')
          .eq('org_id', activeOrgId!)
          .eq('entity_type', 2)
          .eq('name', 'Default Connector Risk Framework')
          .maybeSingle()

        if (error) {
          console.error('Error fetching framework:', error)
          return
        }
        
        if (!data) {
          console.error('No MCP framework found')
          return
        }

        setMcpFrameworkId(data.id)
      } catch (error) {
        console.error('Error fetching framework:', error)
      }
    }
    
    fetchFramework()
  }, [activeOrgId])

  useEffect(() => {
    const fetchVulnerabilities = async () => {
      if (!mcp?.mcp_server_type) return
      
      try {
        setVulnerabilitiesLoading(true)
        
        // Fetch top 3 MCP risk rules from view
        const { data: mcpRiskRules, error: rulesError } = await supabase
          .from('mcp_server_issues_by_risk_rule')
          .select(`
            risk_rule_id,
            risk_rule_name,
            risk_rule_description,
            max_trigger_score,
            total_issues
          `)
          .eq('org_id', activeOrgId!)
          .eq('mcp_server_type', mcp.mcp_server_type)
          .eq('issue_status', 1)
          .order('max_trigger_score', { ascending: false })
          .order('total_issues', { ascending: false })
          .limit(3)
        
        if (rulesError) throw rulesError
        
        // Fetch issue types for each risk rule in parallel
        const issueDetailsResults = await Promise.all(
          (mcpRiskRules || []).map(rule =>
            supabase
              .rpc('get_mcp_server_issues_by_issue_type', {
                ...orgRpcArgs(activeOrgId),
                p_mcp_server_types: [mcp.mcp_server_type],
                p_risk_rule_ids: [rule.risk_rule_id],
                p_status: 1
              })
              .eq('applicable_to', 1)
              .order('trigger_score', { ascending: false })
              .order('incident_count', { ascending: false })
              .limit(3)
          )
        )
        
        // Helper to map issue types to consistent structure
        const mapIssueDetails = (issues: any[]) => 
          issues.map(issue => ({
            issueDetail: issue.name,
            count: issue.incident_count
          }))
        
        // Build vulnerability cards
        const topVulnerabilities = (mcpRiskRules || []).map((rule, index) => {
          const issueDetailsResult = issueDetailsResults[index]
          if (issueDetailsResult.error) {
            console.error('Error fetching issue details for rule:', rule.risk_rule_id, issueDetailsResult.error)
            return null
          }
          
          const issueDetails = issueDetailsResult.data || []
          
          return {
            ruleId: rule.risk_rule_id,
            ruleName: rule.risk_rule_name,
            consequence: rule.risk_rule_description,
            maxSeverity: rule.max_trigger_score ?? null,
            topIssueTypes: mapIssueDetails(issueDetails)
          }
        }).filter(Boolean)
        
        setVulnerabilities(topVulnerabilities)
      } catch (error) {
        console.error('Error fetching vulnerabilities:', error)
        toast({
          title: "Error",
          description: "Failed to load vulnerabilities",
          variant: "destructive",
        })
        setVulnerabilities([])
      } finally {
        setVulnerabilitiesLoading(false)
      }
    }

    fetchVulnerabilities()
  }, [mcp?.mcp_server_type, toast, activeOrgId])

  useEffect(() => {
    const fetchPolicies = async () => {
      if (!activeOrgId || !mcp?.mcp_server_type) return // RPC scopes by activeOrgId, not mcp.org_id
      
      try {
        setPoliciesLoading(true)
        
        const { data: policiesData, error: policiesError } = await supabase
          .rpc('get_mcp_selected_policies', {
            // cast to any: the committed generated types only model the p_org_id-required overload, so an
            // omitted p_org_id (flag-off legacy path) doesn't type-check yet. We cast to `any` rather than
            // `{ p_org_id: string }` because orgRpcArgs returns {} when the flag is off — asserting the field
            // is always present would be a false invariant. Removable once types are regenerated to include
            // the legacy (no-p_org_id) overload.
            ...(orgRpcArgs(activeOrgId) as any),
            p_mcp_server_types: [mcp.mcp_server_type],
          })

        if (policiesError) throw policiesError

        // Exclude default (is_default) policies — org scaffolding that shouldn't appear in the per-MCP
        // list. get_mcp_selected_policies returns is_default; enforcement still receives these rows, the
        // UI just hides them. Filtered by is_default (not name) so it's robust to policy renames.
        // MCP access policies (category 4) DO belong here — "may this MCP run" is a policy that
        // applies to the MCP — but only while the mcp-access feature flag is on.
        const mappedPolicies = (policiesData || [])
          .filter((item: any) => !item.is_default && (mcpAccessEnabled || item.category !== 4))
          .map(item => ({
            id: item.policy_id,
            name: item.name,
            description: item.description,
            status: item.policy_status,
            created_at: item.created_at,
            updated_at: item.updated_at,
            assignment_type: item.assignment_type,
            count: item.count,
            category: item.category,
            entity_type: 2
          }))

        setPolicies(mappedPolicies)
      } catch (error) {
        console.error('Error fetching assigned policies:', error)
        toast({
          title: "Error",
          description: "Failed to load policies",
          variant: "destructive",
        })
        setPolicies([])
      } finally {
        setPoliciesLoading(false)
      }
    }

    fetchPolicies()
  }, [mcp?.mcp_server_type, toast, activeOrgId])

  useEffect(() => {
    const fetchAgents = async () => {
      if (!id) return
      
      try {
        setAgentsLoading(true)
        
        // Fetch summary data and all instances in parallel
        const [agentsResult, instancesResult, orphansResult] = await Promise.all([
          supabase
            .from('mcp_connected_agents_summary')
            .select(`
              agent_id,
              agent_type,
              plan,
              agent_name,
              base_score,
              actual_score,
              instance_count
            `)
            .eq('org_id', activeOrgId!)
            .eq('mcp_server_id', id)
            .order('actual_score', { ascending: false, nullsFirst: false }),
          supabase
            .from('active_mcp_server_instances')
            .select(`
              id,
              agent_type,
              linked_plans,
              mcp_native_id,
              mcp_server_location,
              project_path,
              agent_accounts!mcp_server_instances_agent_account_id_fkey (
                agent_email
              ),
              auth_type,
              deployment_model,
              distribution_channel,
              last_seen_at,
              tools,
              devices_with_owners!inner (
                id,
                device_native_id,
                owner_email
              )
            `)
            .eq('org_id', activeOrgId!)
            .eq('mcp_server_id', id)
            .order('last_seen_at', { ascending: false }),
          supabase
            .from('mcp_orphan_agents_summary')
            .select('agent_type, agent_name, instance_count')
            .eq('org_id', activeOrgId!)
            .eq('mcp_server_id', id)
            .order('agent_name')
        ])

        if (agentsResult.error) throw agentsResult.error
        if (instancesResult.error) throw instancesResult.error
        if (orphansResult.error) throw orphansResult.error

        // Store all instances for popup filtering
        setAllMcpInstances(instancesResult.data || [])

        // Build distribution channel map keyed by "agent_type-plan"
        const distributionMap = new Map<string, Set<number>>()
        ;(instancesResult.data || []).forEach(instance => {
          (instance.linked_plans || []).forEach((plan: number) => {
            const key = `${instance.agent_type}-${plan}`
            const existing = distributionMap.get(key) || new Set()
            if (instance.distribution_channel !== null) {
              existing.add(instance.distribution_channel)
            }
            distributionMap.set(key, existing)
          })
        })

        const agentsList = (agentsResult.data || []).map(item => ({
          agent_id: item.agent_id,
          agent_type: item.agent_type,
          plan: item.plan,
          agent_name: item.agent_name,
          base_score: formatScore(item.base_score),
          actual_score: formatScore(item.actual_score),
          instance_count: item.instance_count,
          distribution_channels: Array.from(distributionMap.get(`${item.agent_type}-${item.plan}`) || []),
          notInstalled: false
        }))

        // Orphaned instances (mcp_orphan_agents_summary): MCP configured for an agent that
        // isn't installed on the device. Shown as muted "Not installed" rows below the
        // connected agents.
        const orphanRows = (orphansResult.data || []).map(o => ({
          agent_id: null,
          agent_type: o.agent_type,
          plan: null,
          agent_name: o.agent_name,
          base_score: null,
          actual_score: null,
          instance_count: o.instance_count,
          distribution_channels: [] as number[],
          notInstalled: true
        }))

        setAgents([...agentsList, ...orphanRows])
      } catch (error) {
        console.error('Error fetching connected agents:', error)
        toast({
          title: "Error",
          description: "Failed to load connected agents",
          variant: "destructive",
        })
        setAgents([])
      } finally {
        setAgentsLoading(false)
      }
    }

    fetchAgents()
  }, [id, toast, activeOrgId])

  useEffect(() => {
    if (!showMcpInstancesModal || !selectedAgent) return

    // Filter from pre-loaded data instead of API call. Orphaned ("not installed") rows have no
    // plan — match their agent_type with empty linked_plans rather than a plan membership.
    setSelectedMcpInstances(instancesForAgent(selectedAgent))
  }, [showMcpInstancesModal, selectedAgent, instancesForAgent])

  const fetchUserActivityData = async (limit?: number) => {
    if (!mcp?.mcp_server_type) return []
    
    try {
      const query = supabase
        .from('active_mcp_devices')
        .select('device_id, device_native_id, device_name, device_last_seen, platform, os_version, owner_email')
        .eq('org_id', activeOrgId!)
        .eq('mcp_server_type', mcp.mcp_server_type)
        .order('device_last_seen', { ascending: false })
      
      if (limit) {
        query.limit(limit)
      }
      
      const { data, error } = await query
      
      if (error) throw error
      
      return data || []
    } catch (error) {
      console.error('Error fetching user activity:', error)
      throw error
    }
  }

  const handleShowUserActivity = async () => {
    setUserActivityLoading(true)
    setShowUserActivityModal(true)
    
    try {
      const data = await fetchUserActivityData(100)
      setUserActivityData(data)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load user activity",
        variant: "destructive",
      })
      setShowUserActivityModal(false)
    } finally {
      setUserActivityLoading(false)
    }
  }

  const handleExportPermissions = async () => {
    if (!mcp?.mcp_server_type) return
    
    setExportLoading(true)
    
    try {
      const data = await fetchUserActivityData()
      
      const csvData = data.map(device => ({
        'Device ID': device.device_native_id || '-',
        'Device Owner': device.owner_email || '-',
        'Device Name': device.device_name || '-',
        'Platform': device.platform || '-',
        'OS Version': device.os_version || '-',
        'Device Last Seen': device.device_last_seen || '-'
      }))
      
      const timestamp = csvTimestamp()
      const mcpName = mcp.mcp_server_name.replace(/[^a-zA-Z0-9]/g, '-')
      
      downloadCsv(csvData, `active-devices-${mcpName}-${timestamp}.csv`)
    } catch (error) {
      console.error('Error exporting active users:', error)
      toast({
        title: "Error",
        description: "Failed to export active users",
        variant: "destructive",
      })
    } finally {
      setExportLoading(false)
    }
  }

  const handleExportAgents = async () => {
    if (!id || agents.length === 0) return
    
    setAgentsExportLoading(true)
    
    try {
      const { data: allInstancesData, error: instancesError } = await supabase
        .from('mcp_server_instances_with_agents')
        .select(`
          mcp_native_id,
          mcp_server_location,
          project_path,
          agent_accounts!mcp_server_instances_agent_account_id_fkey (
            agent_email
          ),
          auth_type,
          deployment_model,
          distribution_channel,
          last_seen_at,
          plan,
          agent_type,
          base_score,
          actual_score,
          agent_name,
          devices_with_owners!inner (
            device_native_id,
            friendly_name,
            owner_email
          )
        `)
        .eq('org_id', activeOrgId!)
        .eq('mcp_server_id', id)

      if (instancesError) throw instancesError

      const allInstances = (allInstancesData || []).map(instance => {
        return {
          'Agent': instance.agent_name || '-',
          'Plan': getPlan(getEffectivePlan(instance.agent_type, instance.plan)),
          'Baseline Risk': formatScore(instance.base_score) || '-',
          'Actual Risk': formatScore(instance.actual_score) || '-',
          'Connector Name': instance.mcp_native_id || '-',
          'Configured In': connectorLocationText({ location: instance.mcp_server_location, project_path: instance.project_path }),
          'Managed By': getDistributionChannel(instance.distribution_channel),
          'Auth Type': getAuthType(instance.auth_type),
          'Deployment Model': getDeploymentModel(instance.deployment_model),
          'Device ID': instance.devices_with_owners?.device_native_id || '-',
          'Device Owner': instance.devices_with_owners?.owner_email || '-',
          'Agent User': instance.agent_accounts?.agent_email || '-',
          'Device Name': instance.devices_with_owners?.friendly_name || instance.devices_with_owners?.device_native_id || '-',
          'Last Seen': instance.last_seen_at ? new Date(instance.last_seen_at).toLocaleString() : '-'
        }
      })
      
      const timestamp = csvTimestamp()
      const mcpName = mcp?.mcp_server_name?.replace(/[^a-zA-Z0-9]/g, '-') || 'mcp'
      
      downloadCsv(allInstances, `connected-agents-${mcpName}-${timestamp}.csv`)
    } catch (error) {
      console.error('Error exporting agent instances:', error)
      toast({
        title: "Error",
        description: "Failed to export agent instances",
        variant: "destructive",
      })
    } finally {
      setAgentsExportLoading(false)
    }
  }

  const getBackButton = () => {
    const sourceAgent = searchParams.get('source_agent')
    const sourceDevice = searchParams.get('source_device')
    const sourceDevices = searchParams.get('source_devices')
    const backSearch = (location.state?.backSearch as string) || ''

    if (sourceAgent) {
      return {
        path: `/agents/${sourceAgent}`,
        label: 'Back to Agent'
      }
    }
    if (sourceDevice) {
      return {
        path: `/devices/${sourceDevice}`,
        label: 'Back to Device'
      }
    }
    if (sourceDevices) {
      return {
        path: '/devices',
        label: 'Back to Devices'
      }
    }
    return {
      // Restore the query string the connectors list was showing when it opened
      // this page, so its filters/search survive the in-app back button.
      path: `/mcps${backSearch ? `?${backSearch}` : ''}`,
      label: 'Back to Connectors'
    }
  }

  const backButton = getBackButton()

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate(backButton.path)}>
          <ArrowLeft className="h-4 w-4" />
          {backButton.label}
        </Button>
        {loading ? (
          <div className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-64" />
              <div className="flex gap-1">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-16" />
              </div>
              <Skeleton className="h-3 w-40" />
            </div>
          </div>
        ) : !mcp ? (
          <div className="text-muted-foreground">Connector not found</div>
        ) : (
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold text-foreground">
                {transformMcpName(mcp.mcp_server_name)}
              </h1>
              {mcp.website && (
                <a 
                  href={mcp.website} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  title="Visit website"
                >
                  <ExternalLink className="h-5 w-5" />
                </a>
              )}
            </div>
            {mcp.description && (
              <p className="text-muted-foreground">
                {mcp.description}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card 
          className={!loading && mcp ? "cursor-pointer hover:shadow-lg transition-shadow" : ""}
          onClick={() => !loading && mcp && navigate(`/mcp-registry?mcp_server_type=${mcp.mcp_server_type}&source_mcp=${mcp.id}`)}
        >
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Risk Score
              </div>
              {!loading && mcp && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span>View breakdown</span>
                  <ChevronRight className="h-3 w-3" />
                </div>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-6 w-16" />
              </div>
            ) : (
              <div className="space-y-2">
                {(() => {
                  const { score, diff } = getEffectiveScoreDisplay(mcp?.base_score ?? null, mcp?.actual_score ?? null)
                  return (
                    <div className="flex items-center gap-2">
                      <div className={`text-2xl font-bold ${score !== null ? getRiskTextColor(score) : 'text-muted-foreground'}`}>
                        {score ?? 'N/A'}
                      </div>
                      {diff && (
                        <span className={`text-lg font-semibold ${diff.colorClass}`}>
                          ({diff.text})
                        </span>
                      )}
                    </div>
                  )
                })()}
              </div>
            )}
          </CardContent>
        </Card>

        <Card 
          className={!loading && mcp ? "cursor-pointer hover:shadow-lg transition-shadow" : ""}
          onClick={() => !loading && mcp && navigate(`/mcp-issues?mcp=${id}&source_mcp=${id}`)}
        >
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Active Issues
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {(mcp?.active_issues ?? 0).toLocaleString()}
              </div>
            )}
          </CardContent>
        </Card>

        <Card 
          className={!loading && mcp ? "cursor-pointer hover:shadow-lg transition-shadow" : ""}
          onClick={() => !loading && mcp && handleShowUserActivity()}
        >
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Active Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">
                {(mcp?.active_users ?? 0).toLocaleString()}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {(agentsLoading || agents.length > 0) && (
        <div className="mb-8">
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead colSpan={isCustomMcp ? 5 : 6} className="border-b-0 pb-4 pt-6">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-semibold text-foreground">Connected Agents</h2>
                      {!agentsLoading && agents.length > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleExportAgents}
                          disabled={agentsExportLoading}
                          className="gap-2 text-foreground"
                        >
                          {agentsExportLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                          Export All
                        </Button>
                      )}
                    </div>
                  </TableHead>
                </TableRow>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead>Plan</TableHead>
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
                  {!isCustomMcp && <TableHead>Tools</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {agentsLoading ? (
                  Array.from({ length: 3 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Skeleton className="h-5 w-48" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-24" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-16" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-16" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-24" />
                      </TableCell>
                      {!isCustomMcp && (
                        <TableCell>
                          <Skeleton className="h-5 w-20" />
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                ) : agents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isCustomMcp ? 5 : 6} className="text-center py-8 text-muted-foreground">
                      No connected agents
                    </TableCell>
                  </TableRow>
                ) : (
                  <TooltipProvider>
                    {agents.map((agent) => (
                      <TableRow key={`${agent.agent_id ?? 'ni'}-${agent.agent_type}-${agent.plan ?? 'none'}`} className="hover:bg-muted/50">
                        <TableCell>
                          {agent.notInstalled ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex items-center gap-1.5 text-muted-foreground italic cursor-default">
                                  <Unplug className="h-4 w-4" />
                                  {agent.agent_name}
                                  <Badge variant="outline" className="ml-1 not-italic font-normal text-muted-foreground">Not installed</Badge>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{agent.agent_name} isn't installed on the devices where this connector is configured — likely leftover configs.</p>
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <Link to={`/agents/${agent.agent_id}?source_mcp=${id}`} className="font-medium text-foreground hover:text-primary transition-colors">
                              {agent.agent_name}
                            </Link>
                          )}
                        </TableCell>
                        <TableCell>
                          {agent.notInstalled ? <span className="text-muted-foreground">–</span> : getPlanBadge(getEffectivePlan(agent.agent_type, agent.plan))}
                        </TableCell>
                        <TableCell>
                          {agent.notInstalled ? (
                            <span className="text-muted-foreground">–</span>
                          ) : (
                            getScoreBadgeWithDiff(agent.base_score, agent.actual_score) ?? (
                              <span className="text-muted-foreground">N/A</span>
                            )
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {agent.distribution_channels && agent.distribution_channels.filter((c: number) => c !== 0).length > 0 ? (
                              agent.distribution_channels
                                .filter((c: number) => c !== 0)
                                .sort((a: number, b: number) => a - b)
                                .map((channel: number) => (
                                  <span key={channel}>
                                    {getDistributionChannelBadge(channel)}
                                  </span>
                                ))
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div 
                            className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-1 rounded transition-colors"
                            onClick={() => {
                              setSelectedAgent(agent)
                              setShowMcpInstancesModal(true)
                            }}
                          >
                            <Laptop className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm underline decoration-dotted">
                              {agent.instance_count} instance{agent.instance_count !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </TableCell>
                        {!isCustomMcp && (
                          <TableCell>
                            {(() => {
                              const agentKey = `${agent.agent_id ?? "ni"}-${agent.agent_type}-${agent.plan ?? "none"}`
                              const toolCount = toolsByAgentKey.get(agentKey)?.length ?? 0
                              if (toolCount === 0) {
                                return (
                                  <span className="text-sm text-muted-foreground">Unavailable</span>
                                )
                              }
                              return (
                                <button
                                  type="button"
                                  className="flex items-center gap-2 hover:bg-muted/50 p-1 rounded transition-colors text-left"
                                  onClick={() => {
                                    setSelectedAgent(agent)
                                    setShowToolsModal(true)
                                  }}
                                >
                                  <Wrench className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-sm underline decoration-dotted">
                                    {toolCount} tool{toolCount !== 1 ? "s" : ""}
                                  </span>
                                </button>
                              )
                            })()}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TooltipProvider>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
      
      {/* Only show Top Vulnerabilities section if there are vulnerabilities */}
      {(vulnerabilitiesLoading || vulnerabilities.length > 0) && (
        <div className="mb-8">
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-foreground">Top Vulnerabilities</h2>
        </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {vulnerabilitiesLoading && (
              <Card className="border">
                <CardHeader className="pb-3">
                  <Skeleton className="h-6 w-3/4" />
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-5 w-16" />
                  </div>
                  <Skeleton className="h-16 w-full" />
                  <div className="space-y-1">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-3/4" />
                  </div>
                </CardContent>
              </Card>
            )}
            {vulnerabilities.map((vulnerability) => {
                const border = getRiskBorderColor(vulnerability.maxSeverity)
                const text = getRiskTextColor(vulnerability.maxSeverity)
                const icon = getRiskIcon(vulnerability.maxSeverity)

                return (
                  <Card 
                    key={vulnerability.ruleId}
                    className={`${border} cursor-pointer hover:shadow-lg transition-shadow`}
                    onClick={() => navigate(`/mcp-issues?risk_attribute=${vulnerability.ruleId}&mcp=${id}&source_mcp=${id}`)}
                  >
                    <CardHeader className="pb-3">
                      <CardTitle className={`text-lg font-semibold flex items-center gap-2 ${text}`}>
                        {icon}
                        {vulnerability.ruleName}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Risk Level</span>
                        {getRiskBadge(vulnerability.maxSeverity)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {vulnerability.consequence}
                      </p>
                      <div className="text-xs text-muted-foreground space-y-1">
                        {vulnerability.topIssueTypes.map((issueType, idx) => (
                          <div key={idx}>
                            • {issueType.count} instance{issueType.count > 1 ? 's' : ''} of {issueType.issueDetail}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
        </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Policies</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Policy</TableHead>
                <TableHead>Assignment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Last Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {policiesLoading ? (
                Array.from({ length: 3 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  </TableRow>
                ))
              ) : policies.length > 0 ? (
                policies.map((policy) => (
                  <TableRow
                    key={policy.id}
                    className={policy.category === 4 ? undefined : "cursor-pointer hover:bg-muted/50"}
                    // Access policies (category 4) don't navigate: PolicyDetail is the
                    // scan-policy editor — wrong surface until the access editor ships.
                    onClick={() => policy.category !== 4 && navigate(`/policies/${policy.id}?source_mcp=${mcp.id}`)}
                  >
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
                      </div>
                    </TableCell>
                    <TableCell>
                      {getPolicyAssignmentBadge(policy.assignment_type, policy.entity_type, policy.count)}
                    </TableCell>
                    <TableCell>
                      {getPolicyStatusBadge(policy.status)}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {new Date(policy.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {new Date(policy.updated_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No policies assigned to this connector
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showUserActivityModal} onOpenChange={setShowUserActivityModal}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Active Users - {transformMcpName(mcp?.mcp_server_name || '')}</DialogTitle>
            <DialogDescription>
              Showing up to 100 most recent active users
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportPermissions}
                disabled={exportLoading}
                className="gap-2"
              >
                {exportLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Export All
              </Button>
            </div>
            <ScrollArea className="h-[50vh] border rounded-md">
              {userActivityLoading ? (
                <div className="p-4 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : userActivityData.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  No active users found
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className={mdmNotConfigured || mdmNeedsAttention ? '[&>th]:align-top' : ''}>
                      <TableHead>Device ID</TableHead>
                      <TableHead>
                        <DeviceOwnerHeader mdmIntegrations={mdmIntegrations} mdmNotConfigured={mdmNotConfigured} mdmNeedsAttention={mdmNeedsAttention} />
                      </TableHead>
                      <TableHead>Device Name</TableHead>
                      <TableHead>Platform</TableHead>
                      <TableHead>OS Version</TableHead>
                      <TableHead>Device Last Seen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {userActivityData.map((device, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium font-mono">
                          {device.device_id ? (
                            <Link to={`/devices/${device.device_id}`} className="text-foreground hover:text-primary transition-colors">
                              {device.device_native_id}
                            </Link>
                          ) : (
                            device.device_native_id
                          )}
                        </TableCell>
                        <TableCell>
                          {device.owner_email ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="truncate cursor-default max-w-[150px]">
                                    {device.owner_email}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{device.owner_email}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {device.device_name || '-'}
                        </TableCell>
                        <TableCell>
                          {device.platform || '-'}
                        </TableCell>
                        <TableCell>
                          {device.os_version || '-'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(device.device_last_seen).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showToolsModal}
        onOpenChange={(open) => {
          setShowToolsModal(open)
          if (!open) setSelectedToolInstance(null)
        }}
      >
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>
              Tools · {selectedToolInstance?.mcp_native_id
                ? selectedToolInstance.mcp_native_id
                : transformMcpName(mcp?.mcp_server_name || "Unknown Connector")} for{" "}
              {selectedAgent?.agent_name || "Unknown Agent"}
              {selectedAgent
                ? ` (${selectedAgent.notInstalled ? "Not installed" : getPlan(getEffectivePlan(selectedAgent.agent_type, selectedAgent.plan))})`
                : ""}
            </DialogTitle>
            <DialogDescription>
              {(() => {
                const tools = selectedToolInstance
                  ? parseMcpInstanceTools(selectedToolInstance.tools, { includeUnknownStatus: true })
                  : selectedAgentTools
                return `${tools.length} tool${tools.length !== 1 ? "s" : ""} detected`
              })()}
            </DialogDescription>
          </DialogHeader>
          <McpToolsTableView
            tools={selectedToolInstance
              ? parseMcpInstanceTools(selectedToolInstance.tools, { includeUnknownStatus: true })
              : selectedAgentTools}
            loading={false}
            error={null}
            className="min-w-0"
            maxHeightClassName="[&>div]:max-h-[50vh]"
          />
        </DialogContent>
      </Dialog>

      <Dialog open={showMcpInstancesModal} onOpenChange={setShowMcpInstancesModal}>
        <DialogContent className="max-w-7xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{transformMcpName(mcp?.mcp_server_name || 'Unknown Connector')} for {selectedAgent?.agent_name || 'Unknown Agent'} ({selectedAgent?.notInstalled ? 'Not installed' : getPlan(getEffectivePlan(selectedAgent?.agent_type, selectedAgent?.plan ?? null))})</DialogTitle>
            <DialogDescription>
              Showing {selectedMcpInstances.length} connector instance{selectedMcpInstances.length !== 1 ? 's' : ''} (max 100)
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[50vh] border rounded-md">
            {selectedMcpInstances.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No instances found
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className={mdmNotConfigured || mdmNeedsAttention ? '[&>th]:align-top' : ''}>
                    <TableHead>Device ID</TableHead>
                    <TableHead>
                      <DeviceOwnerHeader mdmIntegrations={mdmIntegrations} mdmNotConfigured={mdmNotConfigured} mdmNeedsAttention={mdmNeedsAttention} />
                    </TableHead>
                    <TableHead>Connector Name</TableHead>
                    <TableHead>Configured In</TableHead>
                    <TableHead>Managed By</TableHead>
                    <TableHead>Auth Type</TableHead>
                    <TableHead>Deployment Model</TableHead>
                    <TableHead>Tools</TableHead>
                    <TableHead>Last Seen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedMcpInstances.map((instance: any, index: number) => {
                    const deviceId = instance.devices_with_owners?.device_native_id || '-'
                    const ownerEmail = instance.devices_with_owners?.owner_email
                    return (
                      <TableRow key={instance.id || index}>
                        <TableCell className="font-medium font-mono">
                          {instance.devices_with_owners?.id ? (
                            <Link to={`/devices/${instance.devices_with_owners.id}`} className="text-foreground hover:text-primary transition-colors">
                              {deviceId}
                            </Link>
                          ) : (
                            deviceId
                          )}
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          {ownerEmail ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="truncate cursor-default max-w-[200px]">
                                    {ownerEmail}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{ownerEmail}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="truncate cursor-default font-medium font-mono text-sm">
                                  {instance.mcp_native_id || '-'}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{instance.mcp_native_id || '-'}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell>
                          <ConnectorLocations
                            locations={[{ location: instance.mcp_server_location, project_path: instance.project_path }]}
                            accountEmail={instance.agent_accounts?.agent_email}
                          />
                        </TableCell>
                        <TableCell className="text-sm">
                          {getDistributionChannel(instance.distribution_channel)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {getAuthType(instance.auth_type)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {getDeploymentModel(instance.deployment_model)}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const tools = parseMcpInstanceTools(instance.tools, { includeUnknownStatus: true })
                            if (tools.length === 0) {
                              return <span className="text-sm text-muted-foreground">Unavailable</span>
                            }
                            return (
                              <button
                                type="button"
                                className="flex items-center gap-2 hover:bg-muted/50 p-1 rounded transition-colors text-left"
                                onClick={() => {
                                  setSelectedToolInstance(instance)
                                  setShowToolsModal(true)
                                }}
                              >
                                <Wrench className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm underline decoration-dotted">
                                  {tools.length} tool{tools.length !== 1 ? "s" : ""}
                                </span>
                              </button>
                            )
                          })()}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {instance.last_seen_at ? new Date(instance.last_seen_at).toLocaleString() : '-'}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default McpDetail
