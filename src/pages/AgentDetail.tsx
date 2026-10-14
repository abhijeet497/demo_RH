import { ArrowLeft, AlertTriangle, Shield, Clock, Download, Loader2, Users, Info, Laptop, ExternalLink, ChevronRight, Wrench } from "lucide-react"
import { orgRpcArgs } from '@/lib/orgScope';
import { supabase } from "@/integrations/supabase/client"
import { DeviceOwnerHeader } from "@/components/DeviceOwnerHeader"
import { transformMcpName } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { useLocation, useNavigate, useParams, Link, useSearchParams } from "react-router-dom"
import { useState, useEffect, useMemo } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { useOrg } from "@/contexts/OrgContext"
import { useAuth } from "@/contexts/AuthContext"
import { traceforcApi } from "@/integrations/traceforce/client"
import type { MdmIntegration } from "@/integrations/traceforce/types"
import { formatDistanceToNow } from "date-fns"
import { useToast } from "@/hooks/use-toast"
import { getPolicyStatusBadge, getPolicyAssignmentBadge, getRiskTextColor, getRiskBadge, getRiskBorderColor, getRiskIcon, getPlanBadge, getPlan, getEffectivePlan, formatScore, getAuthType, getDeploymentModel, getDistributionChannel, getDistributionChannelBadge, getAgentDeploymentTypeBadge, getRiskDifferenceIndicator, getScoreBadgeWithDiff, getEffectiveScoreDisplay, anyMdmNeedsAttention, CUSTOM_MCP_SERVER_TYPE } from "@/lib/appUtils"
import { downloadCsv, csvTimestamp } from "@/lib/csvUtils"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { McpToolsTableView } from "@/components/McpToolsCard"
import { collectToolsFromInstances, parseMcpInstanceTools } from "@/lib/mcpInstanceTools"
import { connectorLocationText } from "@/lib/connectorLocation"
import ConnectorLocations from "@/components/ConnectorLocations"
import { fetchMcpCatalogMap } from "@/lib/mcpCatalog"

const AgentDetail = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const { toast } = useToast()
  const { activeOrgId } = useOrg()
  const { session } = useAuth()
  const [agent, setAgent] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [agentFrameworkId, setAgentFrameworkId] = useState<string | null>(null)
  const [policies, setPolicies] = useState<any[]>([])
  const [policiesLoading, setPoliciesLoading] = useState(true)
  const [vulnerabilities, setVulnerabilities] = useState<any[]>([])
  const [vulnerabilitiesLoading, setVulnerabilitiesLoading] = useState(true)
  const [exportLoading, setExportLoading] = useState(false)
  const [mcpsExportLoading, setMcpsExportLoading] = useState(false)
  const [mcps, setMcps] = useState<any[]>([])
  const [mcpsLoading, setMcpsLoading] = useState(true)
  const [showUserActivityModal, setShowUserActivityModal] = useState(false)
  const [userActivityData, setUserActivityData] = useState<any[]>([])
  const [userActivityLoading, setUserActivityLoading] = useState(false)
  const [showMcpInstancesModal, setShowMcpInstancesModal] = useState(false)
  const [showToolsModal, setShowToolsModal] = useState(false)
  const [selectedToolInstance, setSelectedToolInstance] = useState<any>(null)
  const [selectedMcpInstances, setSelectedMcpInstances] = useState<any[]>([])
  const [selectedMcp, setSelectedMcp] = useState<any>(null)
  const [allMcpInstances, setAllMcpInstances] = useState<any[]>([])
  const [mdmIntegrations, setMdmIntegrations] = useState<MdmIntegration[]>([])
  const [mdmLoaded, setMdmLoaded] = useState(false)

  // Computed MDM states — derived from full array for provider-agnostic coverage
  const mdmNeedsAttention = anyMdmNeedsAttention(mdmIntegrations)
  const mdmNotConfigured = mdmLoaded && mdmIntegrations.length === 0

  const toolsByMcpId = useMemo(() => {
    const map = new Map<string, ReturnType<typeof collectToolsFromInstances>>()
    for (const mcp of mcps) {
      if (mcp.mcp_server_type === CUSTOM_MCP_SERVER_TYPE) continue
      const instances = allMcpInstances.filter(
        (instance) => instance.mcp_server_id === mcp.mcp_server_id,
      )
      map.set(mcp.mcp_server_id, collectToolsFromInstances(instances))
    }
    return map
  }, [mcps, allMcpInstances])

  const selectedMcpTools = useMemo(
    () => selectedMcp ? toolsByMcpId.get(selectedMcp.mcp_server_id) ?? [] : [],
    [selectedMcp, toolsByMcpId],
  )

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
    const fetchAgent = async () => {
      if (!id) return

      setLoading(true)
      
      try {
        const { data, error } = await supabase.from('active_agents').select(`
            id,
            org_id,
            agent_type,
            plan,
            base_score,
            actual_score,
            active_issues,
            active_users,
            updated_at,
            deployment_types,
            last_active_at,
            agent_catalog!inner (
              description,
              agent_name,
              website
            )
          `).eq('org_id', activeOrgId!)
          .eq('id', id)
          .maybeSingle() as { data: any, error: any }
        
        if (error) throw error
        
        if (!data) {
          setAgent(null)
          setLoading(false)
          return
        }
        
        const mappedAgent = {
          id: data.id,
          org_id: data.org_id,
          agent_type: data.agent_type,
          plan: data.plan,
          base_score: formatScore(data.base_score),
          actual_score: formatScore(data.actual_score),
          active_issues: data.active_issues,
          active_users: data.active_users,
          updated_at: data.updated_at,
          deployment_types: data.deployment_types,
          last_active_at: data.last_active_at,
          agent_name: data.agent_catalog.agent_name,
          description: data.agent_catalog.description,
          website: data.agent_catalog.website
        }
        
        console.log('Agent fetched:', mappedAgent.agent_name, 'Type:', mappedAgent.agent_type)
        setAgent(mappedAgent)
      } catch (error) {
        console.error('Error fetching agent:', error)
        toast({
          title: "Error",
          description: "Failed to load agent data",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }
    
    fetchAgent()
  }, [id, toast, activeOrgId])

  useEffect(() => {
    const fetchFramework = async () => {
      try {
        const { data, error } = await supabase.from('risk_framework').select('id').eq('org_id', activeOrgId!)
          .eq('entity_type', 1)
          .eq('name', 'Default Agent Risk Framework')
          .maybeSingle()

        if (error) {
          console.error('Error fetching framework:', error)
          return
        }
        
        if (!data) {
          console.error('No agent framework found')
          return
        }

        setAgentFrameworkId(data.id)
      } catch (error) {
        console.error('Error fetching framework:', error)
      }
    }
    
    fetchFramework()
  }, [activeOrgId])


  useEffect(() => {
    const fetchVulnerabilities = async () => {
      if (!agent?.agent_type || agent?.plan === null || agent?.plan === undefined) return
      
      try {
        setVulnerabilitiesLoading(true)
        
        // Start MCP and agent risk rules queries in parallel
        const mcpIssuesPromise = supabase
          .rpc('get_mcp_server_issues_by_issue_type', { ...orgRpcArgs(activeOrgId),
            p_agent_types: [agent.agent_type],
            p_plans: [agent.plan],
            p_status: 1
          })
          .eq('applicable_to', 1)
          .order('trigger_score', { ascending: false })
          .order('incident_count', { ascending: false })
          .limit(3)
        
        const agentRiskRulesPromise = supabase.from('agent_issues_by_risk_rule').select(`
            risk_rule_id,
            risk_rule_name,
            risk_rule_description,
            max_trigger_score,
            total_issues
          `).eq('org_id', activeOrgId!)
          .eq('agent_type', agent.agent_type)
          .eq('plan', agent.plan)
          .eq('issue_status', 1)
          .order('max_trigger_score', { ascending: false })
          .order('total_issues', { ascending: false })
          .limit(3)
        
        // Wait for agent risk rules, then immediately start fetching issue types
        const agentRiskRulesResult = await agentRiskRulesPromise
        
        if (agentRiskRulesResult.error) throw agentRiskRulesResult.error
        
        const agentIssueDetailsPromise = Promise.all(
          (agentRiskRulesResult.data || []).map(rule =>
            supabase
              .rpc('get_agent_issues_by_issue_type', { ...orgRpcArgs(activeOrgId),
                p_agent_types: [agent.agent_type],
                p_plans: [agent.plan],
                p_risk_rule_ids: [rule.risk_rule_id],
                p_status: 1
              })
              .eq('applicable_to', 1)
              .order('trigger_score', { ascending: false })
              .order('incident_count', { ascending: false })
              .limit(3)
          )
        )
        
        // Wait for both MCP and agent issue details to finish
        const [mcpIssuesResult, agentIssueDetailsResults] = await Promise.all([
          mcpIssuesPromise,
          agentIssueDetailsPromise
        ])
        
        if (mcpIssuesResult.error) throw mcpIssuesResult.error
        
        // Determine how many agent cards to show based on MCP existence
        const limit = mcpIssuesResult.data && mcpIssuesResult.data.length > 0 ? 2 : 3
        
        // Build vulnerability cards
        const allVulnerabilities: any[] = []
        
        // Helper to map issue types to consistent structure
        const mapIssueDetails = (issues: any[]) => 
          issues.map(issue => ({
            issueDetail: issue.name,
            count: issue.incident_count
          }))
        
        // Add MCP card if there are MCP issues
        if (mcpIssuesResult.data && mcpIssuesResult.data.length > 0) {
          const scores = mcpIssuesResult.data.map(issue => issue.trigger_score).filter(s => s != null)
          const maxMcpScore = scores.length > 0 ? Math.max(...scores) : null
          
          allVulnerabilities.push({
            ruleId: 'MCP',
            ruleName: 'Risky connector tools',
            maxSeverity: maxMcpScore,
            source: 'mcp',
            consequence: 'Compromised connector tools can exfiltrate sensitive secrets, establish connections to untrusted servers, and execute unsafe commands without user visibility or control.',
            topIssueDetails: mapIssueDetails(mcpIssuesResult.data)
          })
        }
        
        // Add agent vulnerability cards
        const topAgentRiskRules = agentRiskRulesResult.data?.slice(0, limit) || []
        topAgentRiskRules.forEach((rule, index) => {
          const issueDetailsResult = agentIssueDetailsResults[index]
          if (issueDetailsResult.error) {
            console.error('Error fetching issue details for rule:', rule.risk_rule_id, issueDetailsResult.error)
            return
          }
          
          const issueDetails = issueDetailsResult.data || []
          
          allVulnerabilities.push({
            ruleId: rule.risk_rule_id,
            ruleName: rule.risk_rule_name,
            maxSeverity: rule.max_trigger_score ?? null,
            source: 'agent',
            consequence: rule.risk_rule_description,
            topIssueDetails: mapIssueDetails(issueDetails)
          })
        })
        
        setVulnerabilities(allVulnerabilities)
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
  }, [agent?.agent_type, agent?.plan, toast, activeOrgId])

  useEffect(() => {
    const fetchPolicies = async () => {
      if (!activeOrgId || !agent?.agent_type || agent?.plan === null || agent?.plan === undefined) return // RPC scopes by activeOrgId, not agent.org_id
      
      try {
        setPoliciesLoading(true)
        
        const { data: policiesData, error: policiesError } = await supabase
          .rpc('get_agent_selected_policies', {
            // cast to any: the committed generated types only model the p_org_id-required overload, so an
            // omitted p_org_id (flag-off legacy path) doesn't type-check yet. We cast to `any` rather than
            // `{ p_org_id: string }` because orgRpcArgs returns {} when the flag is off — asserting the field
            // is always present would be a false invariant. Removable once types are regenerated to include
            // the legacy (no-p_org_id) overload.
            ...(orgRpcArgs(activeOrgId) as any),
            p_agent_types: [agent.agent_type],
            p_plans: [agent.plan],
          })

        if (policiesError) throw policiesError

        // Exclude default (is_default) policies — org scaffolding that shouldn't appear in the per-agent
        // list. get_agent_selected_policies returns is_default; enforcement still receives these rows, the
        // UI just hides them. Filtered by is_default (not name) so it's robust to policy renames.
        const mappedPolicies = (policiesData || [])
          .filter((item: any) => !item.is_default)
          .map(item => ({
            id: item.policy_id,
            name: item.name,
            description: item.description,
            status: item.policy_status,
            created_at: item.created_at,
            updated_at: item.updated_at,
            assignment_type: item.assignment_type,
            count: item.count,
            entity_type: 1
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
  }, [agent?.agent_type, agent?.plan, toast, activeOrgId])

  useEffect(() => {
    const fetchMcps = async () => {
      if (!agent?.agent_type || agent?.plan === null || agent?.plan === undefined) return
      
      try {
        setMcpsLoading(true)
        
        // Fetch summary data and all instances in parallel
        const [mcpResult, instancesResult] = await Promise.all([
          supabase.from('agent_mcp_servers_summary').select(`
              mcp_server_id,
              mcp_server_type,
              mcp_server_name,
              category_name,
              base_score,
              actual_score,
              instance_count
            `).eq('org_id', activeOrgId!)
            .eq('agent_type', agent.agent_type)
            .eq('plan', agent.plan)
            .order('actual_score', { ascending: false, nullsFirst: false }),
          supabase.from('active_mcp_server_instances').select(`
              id,
              mcp_server_id,
              mcp_native_id,
              mcp_server_location,
              project_path,
              agent_accounts!mcp_server_instances_agent_account_id_fkey (
                agent_email
              ),
              auth_type,
              deployment_model,
              distribution_channel,
              tools,
              last_seen_at,
              devices_with_owners!inner (
                id,
                device_native_id,
                owner_email
              )
            `).eq('org_id', activeOrgId!)
            .eq('agent_type', agent.agent_type)
            .contains('linked_plans', [agent.plan])
            .order('last_seen_at', { ascending: false })
        ])

        if (mcpResult.error) throw mcpResult.error
        if (instancesResult.error) throw instancesResult.error

        // Store all instances for popup filtering
        setAllMcpInstances(instancesResult.data || [])

        // Build distribution channel map for rollup
        const distributionMap = new Map<string, Set<number>>()
        ;(instancesResult.data || []).forEach(instance => {
          const key = instance.mcp_server_id
          if (key) {
            const existing = distributionMap.get(key) || new Set()
            if (instance.distribution_channel !== null) {
              existing.add(instance.distribution_channel)
            }
            distributionMap.set(key, existing)
          }
        })

        const mcpList = (mcpResult.data || []).map(item => ({
          mcp_server_id: item.mcp_server_id,
          mcp_server_type: item.mcp_server_type,
          mcp_server_name: item.mcp_server_name,
          category_name: item.category_name || 'N/A',
          base_score: formatScore(item.base_score),
          actual_score: formatScore(item.actual_score),
          instance_count: item.instance_count,
          distribution_channels: Array.from(distributionMap.get(item.mcp_server_id) || [])
        }))

        setMcps(mcpList)
      } catch (error) {
        console.error('Error fetching MCPs:', error)
        toast({
          title: "Error",
          description: "Failed to load connected connectors",
          variant: "destructive",
        })
        setMcps([])
      } finally {
        setMcpsLoading(false)
      }
    }

    fetchMcps()
  }, [agent?.agent_type, agent?.plan, toast, activeOrgId])

  useEffect(() => {
    if (!showMcpInstancesModal || !selectedMcp) return
    
    // Filter from pre-loaded data instead of API call
    const filtered = allMcpInstances.filter(
      instance => instance.mcp_server_id === selectedMcp.mcp_server_id
    )
    setSelectedMcpInstances(filtered)
  }, [showMcpInstancesModal, selectedMcp, allMcpInstances])

  const fetchUserActivityData = async (limit?: number) => {
    if (!agent?.agent_type || agent?.plan === null || agent?.plan === undefined) return []
    
    try {
      const query = supabase
        .rpc('get_device_agent_metadata', {
          p_device_ids: null,
          p_sandbox_ids: null,
        })
        .eq('org_id', activeOrgId!)
        .eq('agent_type', agent.agent_type)
        .eq('plan', agent.plan)
        .order('last_active_at', { ascending: false, nullsFirst: false })

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

  const handleExportUserActivity = async () => {
    if (!agent?.agent_type || agent?.plan === null || agent?.plan === undefined) return
    
    setExportLoading(true)
    
    try {
      const data = await fetchUserActivityData()
      
      const csvData = data.map(device => ({
        'Device ID': device.device_native_id || '-',
        'Device Owner': device.owner_email || '-',
        'Agent Users': device.agent_emails?.length > 0 ? device.agent_emails.join(', ') : '-',
        'Device Name': device.device_name || '-',
        'Platform': device.platform || '-',
        'OS Version': device.os_version || '-',
        'Device Last Seen': device.device_last_seen || '-',
        'Agent Last Active': device.last_active_at ? new Date(device.last_active_at).toLocaleString() : '-'
      }))
      
      const timestamp = csvTimestamp()
      const agentName = agent.agent_name.replace(/[^a-zA-Z0-9]/g, '-')
      const planName = getPlan(getEffectivePlan(agent.agent_type, agent.plan)).replace(/[^a-zA-Z0-9]/g, '-')
      
      downloadCsv(csvData, `active-devices-${agentName}-${planName}-${timestamp}.csv`)
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

  const handleExportMcps = async () => {
    if (!agent || mcps.length === 0) return
    
    setMcpsExportLoading(true)
    
    try {
      const { data: allInstancesData, error: instancesError } = await supabase.from('active_mcp_server_instances').select(`
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
          devices_with_owners!inner (
            device_native_id,
            friendly_name,
            owner_email
          ),
          mcp_servers!inner (
            mcp_server_type,
            base_score,
            actual_score
          )
        `).eq('org_id', activeOrgId!)
        .eq('agent_type', agent.agent_type)
        .contains('linked_plans', [agent.plan])

      if (instancesError) throw instancesError

      // Connector Type/Category come from mcp_catalog_all (global + active-org
      // entries) resolved by mcp_server_type — a mcp_catalog_id embed can't see
      // org-catalog MCPs (their mcp_catalog_id is NULL). Types in neither
      // catalog keep the '-' fallback below.
      const types = [...new Set((allInstancesData || [])
        .map(instance => instance.mcp_servers?.mcp_server_type)
        .filter((t): t is number => t != null))]
      const catalogMap = await fetchMcpCatalogMap(activeOrgId!, types)

      const allInstances = (allInstancesData || []).map(instance => {
        const mcpServer = instance.mcp_servers
        const catalogEntry = mcpServer ? catalogMap.get(mcpServer.mcp_server_type) : undefined

        return {
          'Connector Type': catalogEntry?.mcp_server_name || '-',
          'Category': catalogEntry?.category_name || '-',
          'Baseline Risk': formatScore(mcpServer?.base_score) || '-',
          'Actual Risk': formatScore(mcpServer?.actual_score) || '-',
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
      const agentName = agent.agent_name.replace(/[^a-zA-Z0-9]/g, '-')
      const planName = getPlan(getEffectivePlan(agent.agent_type, agent.plan)).replace(/[^a-zA-Z0-9]/g, '-')
      
      downloadCsv(allInstances, `connected-connectors-${agentName}-${planName}-${timestamp}.csv`)
    } catch (error) {
      console.error('Error exporting MCP instances:', error)
      toast({
        title: "Error",
        description: "Failed to export connector instances",
        variant: "destructive",
      })
    } finally {
      setMcpsExportLoading(false)
    }
  }

  const getBackButton = () => {
    const sourceMcp = searchParams.get('source_mcp')
    const sourceDevice = searchParams.get('source_device')
    const sourceDevices = searchParams.get('source_devices')
    const backSearch = (location.state?.backSearch as string) || ''

    if (sourceMcp) {
      return {
        path: `/mcps/${sourceMcp}`,
        label: 'Back to connector'
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
      // Restore the query string the Agents list was showing when it opened
      // this page, so its filters/search survive the in-app back button.
      path: `/agents${backSearch ? `?${backSearch}` : ''}`,
      label: 'Back to Agents'
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate(getBackButton().path)}>
          <ArrowLeft className="h-4 w-4" />
          {getBackButton().label}
        </Button>
        {loading ? (
          <div className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-64" />
              <Skeleton className="h-3 w-40" />
            </div>
          </div>
        ) : !agent ? (
          <div className="text-muted-foreground">Agent not found</div>
        ) : (
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold text-foreground">{agent.agent_name}</h1>
              {getPlanBadge(getEffectivePlan(agent.agent_type, agent.plan))}
              {agent.website && (
                <a 
                  href={agent.website} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  title="Visit website"
                >
                  <ExternalLink className="h-5 w-5" />
                </a>
              )}
            </div>
            {agent.description && (
              <p className="text-muted-foreground">{agent.description}</p>
            )}
            <div className="flex items-center gap-2 mt-2">
              <span className="text-sm text-muted-foreground">Deployment Types:</span>
              {agent.deployment_types && agent.deployment_types.length > 0 ? (
                agent.deployment_types.map((type: number, index: number) => (
                  <span key={index}>
                    {getAgentDeploymentTypeBadge(type)}
                  </span>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">None</span>
              )}
            </div>
            {agent.last_active_at && (
              <div className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                <Clock className="h-3 w-3" />
                Last active {formatDistanceToNow(new Date(agent.last_active_at), { addSuffix: true })}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card 
          className={!loading && agent ? "cursor-pointer hover:shadow-lg transition-shadow" : ""}
          onClick={() => !loading && agent && navigate(`/agent-registry?agent_type=${agent.agent_type}&plan=${getEffectivePlan(agent.agent_type, agent.plan)}&source_agent=${agent.id}`)}
        >
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Risk Score
              </div>
              {!loading && agent && (
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
                  const { score, diff } = getEffectiveScoreDisplay(agent?.base_score ?? null, agent?.actual_score ?? null)
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
          className={!loading && agent ? "cursor-pointer hover:shadow-lg transition-shadow" : ""}
          onClick={() => !loading && agent && navigate(`/agent-issues?agent=${agent.id}&source_agent=${agent.id}`)}
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
              <div className={`text-2xl font-bold ${agent?.active_issues ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                {agent?.active_issues?.toLocaleString() ?? 'N/A'}
              </div>
            )}
          </CardContent>
        </Card>

        <Card 
          className={!loading && agent ? "cursor-pointer hover:shadow-lg transition-shadow" : ""}
          onClick={() => !loading && agent && handleShowUserActivity()}
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
              <div className={`text-2xl font-bold ${agent?.active_users ? 'text-foreground' : 'text-muted-foreground'}`}>
                {agent?.active_users?.toLocaleString() ?? 'N/A'}
              </div>
            )}
          </CardContent>
        </Card>
      </div>



      {(mcpsLoading || mcps.length > 0) && (
        <div className="mb-8">
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead colSpan={6} className="border-b-0 pb-4 pt-6">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-semibold text-foreground">Connectors</h2>
                      {!mcpsLoading && mcps.length > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleExportMcps}
                          disabled={mcpsExportLoading}
                          className="gap-2 text-foreground"
                        >
                          {mcpsExportLoading ? (
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
                  <TableHead>Connector Type</TableHead>
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
                {mcpsLoading ? (
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
                      <TableCell>
                        <Skeleton className="h-5 w-20" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : mcps.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No connected connectors
                    </TableCell>
                  </TableRow>
                ) : (
                  <TooltipProvider>
                    {mcps.map((mcp) => (
                      <TableRow key={mcp.mcp_server_id} className="hover:bg-muted/50">
                        <TableCell>
                          <Link to={`/mcps/${mcp.mcp_server_id}?source_agent=${agent.id}`} className="font-medium text-foreground hover:text-primary transition-colors">
                            {transformMcpName(mcp.mcp_server_name)}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{mcp.category_name || 'N/A'}</Badge>
                        </TableCell>
                        <TableCell>
                          {getScoreBadgeWithDiff(mcp.base_score, mcp.actual_score) ?? (
                            <span className="text-muted-foreground">N/A</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {mcp.distribution_channels && mcp.distribution_channels.filter((c: number) => c !== 0).length > 0 ? (
                              mcp.distribution_channels
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
                              setSelectedMcp(mcp)
                              setShowMcpInstancesModal(true)
                            }}
                          >
                            <Laptop className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm underline decoration-dotted">
                              {mcp.instance_count} instance{mcp.instance_count !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const toolCount = toolsByMcpId.get(mcp.mcp_server_id)?.length ?? 0
                            if (
                              mcp.mcp_server_type === CUSTOM_MCP_SERVER_TYPE ||
                              toolCount === 0
                            ) {
                              return <span className="text-sm text-muted-foreground">Unavailable</span>
                            }
                            return (
                              <button
                                type="button"
                                className="flex items-center gap-2 hover:bg-muted/50 p-1 rounded transition-colors text-left"
                                onClick={() => {
                                  setSelectedMcp(mcp)
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
                      </TableRow>
                    ))}
                  </TooltipProvider>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

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
            {!vulnerabilitiesLoading && vulnerabilities.map((vulnerability) => {
              const border = getRiskBorderColor(vulnerability.maxSeverity)
              const text = getRiskTextColor(vulnerability.maxSeverity)
              const icon = getRiskIcon(vulnerability.maxSeverity)
              const navigationUrl = vulnerability.source === 'mcp'
                ? `/mcp-issues?agent=${agent.id}&source_agent=${agent.id}`
                : `/agent-issues?agent=${agent.id}&risk_attribute=${vulnerability.ruleId}&source_agent=${agent.id}`
              
              return (
                <Card
                  key={vulnerability.ruleId}
                  className={`${border} cursor-pointer hover:shadow-lg transition-shadow`}
                  onClick={() => navigate(navigationUrl)}
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
                      {vulnerability.topIssueDetails.map((detail, idx) => (
                        <div key={idx}>
                          • {detail.count} instance{detail.count > 1 ? 's' : ''} of {detail.issueDetail}
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
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/policies/${policy.id}?source_agent=${agent.id}`)}
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
                    No policies assigned to this agent
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
                : transformMcpName(selectedMcp?.mcp_server_name || "Unknown connector")} for{" "}
              {agent?.agent_name || "Unknown Agent"}
              {agent ? ` (${getPlan(getEffectivePlan(agent.agent_type, agent.plan))})` : ""}
            </DialogTitle>
            <DialogDescription>
              {(() => {
                const tools = selectedToolInstance
                  ? parseMcpInstanceTools(selectedToolInstance.tools, { includeUnknownStatus: true })
                  : selectedMcpTools
                return `${tools.length} tool${tools.length !== 1 ? "s" : ""} detected`
              })()}
            </DialogDescription>
          </DialogHeader>
          <McpToolsTableView
            tools={selectedToolInstance
              ? parseMcpInstanceTools(selectedToolInstance.tools, { includeUnknownStatus: true })
              : selectedMcpTools}
            loading={false}
            error={null}
            className="min-w-0"
            maxHeightClassName="[&>div]:max-h-[50vh]"
          />
        </DialogContent>
      </Dialog>

      <Dialog open={showUserActivityModal} onOpenChange={setShowUserActivityModal}>
        <DialogContent className="max-w-6xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Active Users - {agent?.agent_name}</DialogTitle>
            <DialogDescription>
              Showing up to 100 most recent active users
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportUserActivity}
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
                      <TableHead>Agent Users</TableHead>
                      <TableHead>Device Name</TableHead>
                      <TableHead>Platform</TableHead>
                      <TableHead>OS Version</TableHead>
                      <TableHead>Device Last Seen</TableHead>
                      <TableHead>Agent Last Active</TableHead>
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
                        <TableCell className="max-w-[200px]">
                          {device.agent_emails?.length > 0 ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="truncate cursor-default">
                                    {device.agent_emails.join(', ')}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{device.agent_emails.join(', ')}</p>
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
                        <TableCell className="text-sm text-muted-foreground">
                          {device.last_active_at ? new Date(device.last_active_at).toLocaleString() : '-'}
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

      <Dialog open={showMcpInstancesModal} onOpenChange={setShowMcpInstancesModal}>
        <DialogContent className="max-w-7xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{transformMcpName(selectedMcp?.mcp_server_name || 'Unknown connector')} for {agent?.agent_name || 'Unknown Agent'} ({getPlan(getEffectivePlan(agent?.agent_type, agent?.plan ?? null))})</DialogTitle>
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
                    const deviceId = instance.devices_with_owners?.device_native_id || 'Unknown'
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

export default AgentDetail
