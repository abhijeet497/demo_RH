import { useState, useEffect, useMemo } from "react"
import { orgRpcArgs } from '@/lib/orgScope';
import { useLocation, useNavigate, useParams } from "react-router-dom"
import { supabase } from "@/integrations/supabase/client"
import { traceforcApi } from "@/integrations/traceforce/client"
import type { LlmModelDto, LlmModelInstanceDto, MdmIntegration } from "@/integrations/traceforce/types"
import { ArrowLeft, Users, Network, AlertTriangle, Clock, CheckCircle2, XCircle, Info, Lock, Laptop, Brain } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatDistanceToNow } from "date-fns"
import { formatScore, getPlan, getEffectivePlan, ISSUE_STATUS_TABS, isValidIssueStatus, getMdmProviderLabel, getMdmSyncStatusText, sortMdmByCreatedAt, anyMdmNeedsAttention } from "@/lib/appUtils"
import { fetchAllRows } from "@/lib/supabasePaging"
import { useOrg } from "@/contexts/OrgContext"
import { useAuth } from "@/contexts/AuthContext"
import AgentsTable from "@/components/AgentsTable"
import McpsTable from "@/components/McpsTable"
import AgentIssuesTable from "@/components/AgentIssuesTable"
import McpIssuesTable from "@/components/McpIssuesTable"
import SandboxesTable, { type SandboxRow } from "@/components/SandboxesTable"
import { scopeModelsToDevices, catalogLogosByType } from "@/lib/llmModels"
import LlmModelsTable from "@/components/LlmModelsTable"
import { useFeatureFlag } from "@/hooks/use-feature-flag"
import { LLM_UI_FLAG } from "@/lib/llmModels"
import { useUrlStringFilter, useUrlArrayFilter } from "@/hooks/use-url-filters"
import { fetchMcpCatalogMap } from "@/lib/mcpCatalog"
import { mcpAccessEnabled } from "@/lib/featureFlags"
import { useConnectorAccess } from "@/hooks/use-connector-access"
import { AllowAccessDialog } from "@/components/AllowAccessDialog"
import { transformMcpName } from "@/lib/utils"

const DeviceDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  // Query string the Devices list was showing when it opened this page — restored on "Devices" so filters survive.
  const backSearch: string = location.state?.backSearch || ""
  const { session } = useAuth()
  const { activeOrgId } = useOrg()

  const [device, setDevice] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [mdmIntegrations, setMdmIntegrations] = useState<MdmIntegration[]>([])
  const [mdmLoaded, setMdmLoaded] = useState(false)

  // Sandboxes (child entities of this device). Selected ids filter all four
  // tabs and live in the URL so the selection survives Back/refresh.
  const [sandboxes, setSandboxes] = useState<SandboxRow[]>([])
  const [sandboxesLoading, setSandboxesLoading] = useState(true)
  const [selectedSandboxIds, setSelectedSandboxIds] = useUrlArrayFilter('sandboxes')

  // Agents tab
  const [agents, setAgents] = useState<any[]>([])
  const [agentsLoading, setAgentsLoading] = useState(true)
  const [deviceSpecificDeploymentTypes, setDeviceSpecificDeploymentTypes] = useState<Map<string, Set<number>>>(new Map())
  const [agentDeviceSpecificHasHostInstances, setAgentDeviceSpecificHasHostInstances] = useState<Map<string, boolean>>(new Map())
  const [agentDeviceSpecificSandboxRuntimeTypes, setAgentDeviceSpecificSandboxRuntimeTypes] = useState<Map<string, Set<number>>>(new Map())

  // MCPs tab
  const [mcps, setMcps] = useState<any[]>([])
  const [mcpsLoading, setMcpsLoading] = useState(true)
  // User Access column: what this device enforces, with "Allow".
  const access = useConnectorAccess(mcpAccessEnabled && !!id, id ? [id] : undefined)
  const connectorNameByType = useMemo(
    () => new Map(mcps.map((m) => [m.mcp_server_type as number, transformMcpName(m.mcp_server_name)])),
    [mcps],
  )
  const [deviceSpecificAgentNames, setDeviceSpecificAgentNames] = useState<Map<number, Set<string>>>(new Map())
  const [deviceSpecificDistributionChannels, setDeviceSpecificDistributionChannels] = useState<Map<number, Set<number>>>(new Map())
  const [mcpDeviceSpecificHasHostInstances, setMcpDeviceSpecificHasHostInstances] = useState<Map<number, boolean>>(new Map())
  const [mcpDeviceSpecificSandboxRuntimeTypes, setMcpDeviceSpecificSandboxRuntimeTypes] = useState<Map<number, Set<number>>>(new Map())

  // Active tab and issue status live in the URL so they survive Back, consistent with
  // the issues pages. Invalid deep-link values fall back to the defaults: an unknown
  // tab would render no content at all, and an unknown status would send NaN to the RPCs.
  const { enabled: llmEnabled } = useFeatureFlag(LLM_UI_FLAG)
  const [tabParam, setActiveTab] = useUrlStringFilter("tab", "agents")
  const activeTab = ["agents", "mcps", ...(llmEnabled ? ["llm-models"] : []), "agent-issues", "mcp-issues"].includes(tabParam) ? tabParam : "agents"
  const [issueStatusParam, setSelectedIssueStatus] = useUrlStringFilter("status", "1")
  const selectedIssueStatus = isValidIssueStatus(issueStatusParam) ? issueStatusParam : "1"
  const [agentIssues, setAgentIssues] = useState<any[]>([])
  const [agentIssuesLoading, setAgentIssuesLoading] = useState(true)
  const [agentIssuesError, setAgentIssuesError] = useState<string | null>(null)
  const [mcpIssues, setMcpIssues] = useState<any[]>([])
  const [mcpIssuesLoading, setMcpIssuesLoading] = useState(true)
  const [mcpIssuesError, setMcpIssuesError] = useState<string | null>(null)

  // LLM Models tab: the org's models scoped to this device (like the MCP tab).
  const [llmData, setLlmData] = useState<{ instances: LlmModelInstanceDto[]; models: LlmModelDto[] } | null>(null)
  const [llmLogos, setLlmLogos] = useState<Map<number, string>>(new Map())
  const [llmModelsLoading, setLlmModelsLoading] = useState(true)

  const sandboxFilterParam: string[] | null = selectedSandboxIds.length > 0 ? selectedSandboxIds : null

  // Computed MDM states — derived from full array for provider-agnostic coverage
  const mdmNeedsAttention = anyMdmNeedsAttention(mdmIntegrations)
  const mdmNotConfigured = mdmLoaded && mdmIntegrations.length === 0

  // Fetch device + sandboxes once per device
  useEffect(() => {
    if (id) {
      fetchDevice()
      fetchSandboxes()
    }
  }, [id, activeOrgId])

  // Re-fetch agents and MCPs when device or sandbox selection changes
  useEffect(() => {
    if (id) {
      fetchAgents()
      fetchMcps()
    }
  }, [id, selectedSandboxIds.join(','), activeOrgId])

  // LLM models for this device. Loaded once: none of these requests depends on the
  // sandbox selection, which is applied in the browser below.
  useEffect(() => {
    const token = session?.access_token
    if (!llmEnabled || !id || !token) return
    let cancelled = false
    setLlmModelsLoading(true)
    Promise.all([
      traceforcApi.listAllLlmModelInstances(token, { device_ids: [id] }),
      traceforcApi.listAllLlmModels(token),
      // Logos come from the catalog; a catalog failure only costs the logos.
      traceforcApi.listAllLlmCatalog(token).catch(() => []),
    ])
      .then(([instances, models, catalog]) => {
        if (cancelled) return
        setLlmLogos(catalogLogosByType(catalog))
        setLlmData({ instances, models })
      })
      .catch((error) => {
        if (cancelled) return
        console.error('Error fetching LLM models:', error)
        setLlmData(null)
      })
      .finally(() => { if (!cancelled) setLlmModelsLoading(false) })
    return () => { cancelled = true }
  }, [llmEnabled, id, session?.access_token, activeOrgId])

  // Scope to the selected sandboxes when any are chosen (matches the other tabs);
  // instance.sandbox_id references sandboxes.id, the same ids the picker uses.
  const sandboxKey = selectedSandboxIds.join(',')
  const llmModels = useMemo(() => {
    if (!llmData) return []
    const scoped = selectedSandboxIds.length
      ? llmData.instances.filter((i) => i.sandbox_id && selectedSandboxIds.includes(i.sandbox_id))
      : llmData.instances
    return scopeModelsToDevices(llmData.models, scoped)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [llmData, sandboxKey])

  useEffect(() => {
    if (session?.access_token) {
      fetchMdmIntegration()
    }
  }, [session?.access_token])

  // Fetch issues when the device is loaded, status changes, or sandbox selection changes
  useEffect(() => {
    if (device?.id) {
      fetchAgentIssues()
      fetchMcpIssues()
    }
  }, [device?.id, selectedIssueStatus, selectedSandboxIds.join(','), activeOrgId])

  const fetchDevice = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('devices_with_counts' as any)
        .select('*')
        .eq('org_id', activeOrgId!)
        .eq('device_id', id)
        .maybeSingle()

      if (error) throw error
      if (data) {
        const d = data as any
        const agentIssues = d.agent_issues || 0
        const mcpIssues = d.mcp_issues || 0
        setDevice({
          id: d.device_id,
          friendly_name: d.friendly_name,
          device_native_id: d.device_native_id,
          platform: d.platform,
          os_version: d.os_version,
          last_active: d.last_active,
          owner_email: d.owner_email,
          agent_count: d.agent_count || 0,
          mcp_count: d.mcp_count || 0,
          agent_issues: agentIssues,
          mcp_issues: mcpIssues,
          chrome_extension_version: d.chrome_extension_version,
          edge_extension_version: d.edge_extension_version,
          scout_version: d.scout_version,
        })
      }
    } catch (error) {
      console.error('Error fetching device:', error)
    } finally {
      setLoading(false)
    }
  }

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

  const fetchSandboxes = async () => {
    if (!id) return
    try {
      setSandboxesLoading(true)
      const { data, error } = await supabase
        .from('active_sandboxes')
        .select('id, parent_device_id, sandbox_native_id, workspace_folder, runtime_type, friendly_name, os_version, last_seen_at')
        .eq('org_id', activeOrgId!)
        .eq('parent_device_id', id)
        .order('last_seen_at', { ascending: false, nullsFirst: false })

      if (error) throw error
      setSandboxes(data || [])
    } catch (e) {
      console.error('Error fetching sandboxes:', e)
      setSandboxes([])
    } finally {
      setSandboxesLoading(false)
    }
  }

  const fetchAgents = async () => {
    if (!id) return
    try {
      setAgentsLoading(true)

      const { data: deviceAgentData, error: deviceError } = await supabase
        .rpc('get_device_agent_metadata', {
          p_device_ids: [id],
          p_sandbox_ids: sandboxFilterParam,
        })

      if (deviceError) throw deviceError
      if (!deviceAgentData || deviceAgentData.length === 0) {
        setAgents([])
        setDeviceSpecificDeploymentTypes(new Map())
        setAgentDeviceSpecificHasHostInstances(new Map())
        setAgentDeviceSpecificSandboxRuntimeTypes(new Map())
        return
      }

      const deploymentTypesMap = new Map<string, Set<number>>()
      const hostMap = new Map<string, boolean>()
      const runtimeMap = new Map<string, Set<number>>()
      ;(deviceAgentData as any[]).forEach(row => {
        const key = `${row.agent_type}:${row.plan}`
        const existing = deploymentTypesMap.get(key) || new Set<number>()
        ;(row.deployment_types || []).forEach((t: number) => existing.add(t))
        deploymentTypesMap.set(key, existing)
        if (row.has_host_instances) hostMap.set(key, true)
        const existingRuntimes = runtimeMap.get(key) || new Set<number>()
        ;(row.sandbox_runtime_types || []).forEach((t: number) => existingRuntimes.add(t))
        runtimeMap.set(key, existingRuntimes)
      })
      setDeviceSpecificDeploymentTypes(deploymentTypesMap)
      setAgentDeviceSpecificHasHostInstances(hostMap)
      setAgentDeviceSpecificSandboxRuntimeTypes(runtimeMap)

      const pairs = Array.from(new Set((deviceAgentData as any[]).map(d => `${d.agent_type}:${d.plan}`)))
      const orConditions = pairs.map(pair => {
        const [agentType, plan] = pair.split(':')
        return `and(agent_type.eq.${agentType},plan.eq.${plan})`
      }).join(',')

      const { data, error } = await supabase
        .from('active_agents')
        .select(`
          id, plan, agent_type, base_score, actual_score, active_issues, active_users, updated_at, deployment_types,
          has_host_instances, sandbox_runtime_types,
          agent_catalog!inner(agent_name, description, logo_url)
        `)
        .eq('org_id', activeOrgId!)
        .or(orConditions)
        .order('actual_score', { ascending: false, nullsFirst: false })

      if (error) throw error

      setAgents((data || []).map((a: any) => ({
        id: a.id,
        agent_type: a.agent_type,
        plan: a.plan,
        base_score: formatScore(a.base_score),
        actual_score: formatScore(a.actual_score),
        active_issues: a.active_issues,
        active_users: a.active_users,
        updated_at: a.updated_at,
        deployment_types: a.deployment_types,
        has_host_instances: a.has_host_instances,
        sandbox_runtime_types: a.sandbox_runtime_types,
        last_active_at: deviceAgentData.find(d => d.agent_type === a.agent_type && d.plan === a.plan)?.last_active_at ?? null,
        first_seen_at: deviceAgentData.find(d => d.agent_type === a.agent_type && d.plan === a.plan)?.first_seen_at ?? null,
        agent_name: a.agent_catalog?.agent_name,
        description: a.agent_catalog?.description,
        logo_url: a.agent_catalog?.logo_url,
      })))
    } catch (error) {
      console.error('Error fetching agents:', error)
    } finally {
      setAgentsLoading(false)
    }
  }

  const fetchMcps = async () => {
    if (!id) return
    try {
      setMcpsLoading(true)

      // Derive mcp_server_types from the sandbox-aware RPC so the type list
      // reflects the selected scope (not all device-level types across scopes).
      const { data: deviceMetadataData, error: deviceMetadataError } = await supabase
        .rpc('get_device_mcp_metadata', {
          p_device_ids: [id],
          p_sandbox_ids: sandboxFilterParam,
        })

      if (deviceMetadataError) throw deviceMetadataError
      const filteredMcpServerTypes = [...new Set((deviceMetadataData || []).map((d: any) => d.mcp_server_type).filter((t): t is number => t != null && t !== 0))]
      if (filteredMcpServerTypes.length === 0) {
        setMcps([])
        setDeviceSpecificAgentNames(new Map())
        setDeviceSpecificDistributionChannels(new Map())
        setMcpDeviceSpecificHasHostInstances(new Map())
        setMcpDeviceSpecificSandboxRuntimeTypes(new Map())
        return
      }

      const { data, error } = await supabase
        .from('active_mcp_servers')
        .select(`
          id,
          mcp_server_type,
          base_score,
          actual_score,
          active_issues,
          active_users,
          updated_at,
          agent_names,
          distribution_channels,
          has_host_instances,
          sandbox_runtime_types
        `)
        .eq('org_id', activeOrgId!)
        .in('mcp_server_type', filteredMcpServerTypes)
        .gt('active_users', 0)
        .order('actual_score', { ascending: false, nullsFirst: false })

      if (error) throw error

      // Catalog fields come from mcp_catalog_all (global + active-org entries)
      // resolved by mcp_server_type — an mcp_catalog embed can't see org-catalog
      // MCPs (their mcp_catalog_id is NULL).
      const catalogMap = await fetchMcpCatalogMap(activeOrgId!, filteredMcpServerTypes)

      const deviceMetadataResult = { data: deviceMetadataData }
      if (deviceMetadataResult?.data?.length) {
        const agentNamesMap = new Map<number, Set<string>>()
        const distributionChannelsMap = new Map<number, Set<number>>()
        const hostMap = new Map<number, boolean>()
        const runtimeMap = new Map<number, Set<number>>()
        deviceMetadataResult.data.forEach((row: any) => {
          const existingAgents = agentNamesMap.get(row.mcp_server_type) || new Set<string>()
          ;(row.agent_names || []).forEach((name: string) => existingAgents.add(name))
          agentNamesMap.set(row.mcp_server_type, existingAgents)
          const existingChannels = distributionChannelsMap.get(row.mcp_server_type) || new Set<number>()
          ;(row.distribution_channels || []).forEach((ch: number) => existingChannels.add(ch))
          distributionChannelsMap.set(row.mcp_server_type, existingChannels)
          if (row.has_host_instances) hostMap.set(row.mcp_server_type, true)
          const existingRuntimes = runtimeMap.get(row.mcp_server_type) || new Set<number>()
          ;(row.sandbox_runtime_types || []).forEach((t: number) => existingRuntimes.add(t))
          runtimeMap.set(row.mcp_server_type, existingRuntimes)
        })
        setDeviceSpecificAgentNames(agentNamesMap)
        setDeviceSpecificDistributionChannels(distributionChannelsMap)
        setMcpDeviceSpecificHasHostInstances(hostMap)
        setMcpDeviceSpecificSandboxRuntimeTypes(runtimeMap)
      } else {
        setDeviceSpecificAgentNames(new Map())
        setDeviceSpecificDistributionChannels(new Map())
        setMcpDeviceSpecificHasHostInstances(new Map())
        setMcpDeviceSpecificSandboxRuntimeTypes(new Map())
      }

      // Types in neither catalog stay hidden like the old !inner embed;
      // unlike it, uncategorized entries are now kept (intended).
      setMcps((data || [])
        .filter((item: any) => catalogMap.has(item.mcp_server_type))
        .map((item: any) => {
          const entry = catalogMap.get(item.mcp_server_type)!
          return {
            id: item.id,
            mcp_server_type: item.mcp_server_type,
            base_score: formatScore(item.base_score),
            actual_score: formatScore(item.actual_score),
            active_issues: item.active_issues,
            active_users: item.active_users,
            updated_at: item.updated_at,
            mcp_server_name: entry.mcp_server_name,
            description: entry.description,
            category_id: entry.category_id,
            category_name: entry.category_name,
            logo_url: entry.logo_url,
            source_type: entry.source_type,
            agent_names: item.agent_names && Array.isArray(item.agent_names) ? item.agent_names : null,
            distribution_channels: item.distribution_channels && Array.isArray(item.distribution_channels) ? item.distribution_channels : null,
            has_host_instances: item.has_host_instances,
            sandbox_runtime_types: item.sandbox_runtime_types,
            first_seen_at: (deviceMetadataData ?? []).find(d => d.mcp_server_type === item.mcp_server_type)?.first_seen_at ?? null,
            auth_types: (deviceMetadataData ?? []).find(d => d.mcp_server_type === item.mcp_server_type)?.auth_types ?? [],
          }
        }))
    } catch (error) {
      console.error('Error fetching MCPs:', error)
    } finally {
      setMcpsLoading(false)
    }
  }

  const fetchAgentIssues = async () => {
    if (!device) return
    try {
      setAgentIssuesLoading(true)
      setAgentIssuesError(null)

      const { data, error } = await supabase
        .rpc('get_agent_issues_by_issue_type', {
          ...orgRpcArgs(activeOrgId),
          p_status: parseInt(selectedIssueStatus),
        })
        .order('trigger_score', { ascending: false })
        .order('display_order', { ascending: true })

      if (error) throw error

      const mapped = (data || []).map((issue: any) => ({
        issue_type_control_id: issue.issue_type_control_id,
        name: issue.name,
        risk_rule_id: issue.risk_rule_id,
        risk_rule_name: issue.risk_rule_name,
        risk_framework_rule_id: issue.risk_framework_rule_id,
        trigger_score: issue.trigger_score,
        issue_status: issue.issue_status,
        last_seen_at: issue.last_seen_at,
        affected_devices: issue.affected_devices || [],
        incident_count: issue.incident_count,
        framework_id: issue.framework_id,
        applicable_to: issue.applicable_to,
        remediation_text: issue.remediation_text,
        issue_detail: issue.issue_detail,
      }))

      const forThisDevice = mapped.filter((v: any) =>
        (v.affected_devices || []).some((d: any) => d.device_id === device.id)
      )

      // Re-count incidents scoped to selected sandboxes, and date them by this
      // device's latest incident (rows are newest first) rather than the org's.
      // Drop zero-count rows so the list reflects the filter — without this,
      // every issue stays in the list with incident_count: 0 when sandboxes
      // don't share the issue.
      const withCounts = await Promise.all(
        forThisDevice.map(async (v: any) => {
          const rows = await fetchAgentDeviceData(v.issue_type_control_id)
          return { ...v, incident_count: rows.length, last_seen_at: rows[0]?.lastSeenAt ?? v.last_seen_at }
        })
      )
      setAgentIssues(withCounts.filter((v: any) => v.incident_count > 0))
    } catch (e) {
      console.error('Error fetching agent issues:', e)
      setAgentIssuesError(e instanceof Error ? e.message : 'Failed to load agent issues')
      setAgentIssues([])
    } finally {
      setAgentIssuesLoading(false)
    }
  }

  const fetchMcpIssues = async () => {
    if (!device) return
    try {
      setMcpIssuesLoading(true)
      setMcpIssuesError(null)

      const { data, error } = await supabase
        .rpc('get_mcp_server_issues_by_issue_type', {
          ...orgRpcArgs(activeOrgId),
          p_status: parseInt(selectedIssueStatus),
        })
        .order('trigger_score', { ascending: false })
        .order('display_order', { ascending: true })

      if (error) throw error

      const mapped = (data || []).map((issue: any) => ({
        issue_type_control_id: issue.issue_type_control_id,
        name: issue.name,
        risk_rule_id: issue.risk_rule_id,
        risk_rule_name: issue.risk_rule_name,
        risk_framework_rule_id: issue.risk_framework_rule_id,
        trigger_score: issue.trigger_score,
        issue_status: issue.issue_status,
        last_seen_at: issue.last_seen_at,
        affected_devices: issue.affected_devices || [],
        incident_count: issue.incident_count,
        framework_id: issue.framework_id,
        applicable_to: issue.applicable_to,
        remediation_text: issue.remediation_text,
      }))

      const forThisDevice = mapped.filter((v: any) =>
        (v.affected_devices || []).some((d: any) => d.device_id === device.id)
      )

      // Re-count incidents scoped to selected sandboxes and date them by this
      // device's latest incident (rows are newest first); drop zero-count rows.
      const withCounts = await Promise.all(
        forThisDevice.map(async (v: any) => {
          const rows = await fetchMcpDeviceData(v.issue_type_control_id)
          return { ...v, incident_count: rows.length, last_seen_at: rows[0]?.lastSeenAt ?? v.last_seen_at }
        })
      )
      setMcpIssues(withCounts.filter((v: any) => v.incident_count > 0))
    } catch (e) {
      console.error('Error fetching MCP issues:', e)
      setMcpIssuesError(e instanceof Error ? e.message : 'Failed to load connector issues')
      setMcpIssues([])
    } finally {
      setMcpIssuesLoading(false)
    }
  }

  const fetchAgentDeviceData = async (issueTypeControlId: string, limit?: number) => {
    let query = supabase
      .rpc('get_device_agent_issues_extended', {
        p_device_ids: [id],
        p_sandbox_ids: sandboxFilterParam,
      })
      .eq('issue_type_control_id', issueTypeControlId)
      .eq('issue_status', parseInt(selectedIssueStatus))
      .order('last_seen_at', { ascending: false })

    if (limit) {
      query = query.limit(limit)
    }

    const { data, error } = await query
    if (error) throw error

    return (data || []).map((issue: any) => ({
      device_id: issue.device_id,
      agent_account_id: issue.agent_account_id,
      deviceId: issue.device_native_id,
      deviceName: issue.friendly_name || issue.device_native_id,
      ownerEmail: issue.owner_email,
      agentName: issue.agent_name,
      agentEmail: issue.agent_email,
      plan: getPlan(getEffectivePlan(issue.agent_type, issue.plan)),
      lastSeen: new Date(issue.last_seen_at).toLocaleString(),
      lastSeenAt: issue.last_seen_at,
      lastActive: issue.last_active_at ? new Date(issue.last_active_at).toLocaleString() : '-',
      issueIds: issue.issue_ids || [],
      metadata: issue.metadata?.[0] || null,
    }))
  }

  const fetchMcpDeviceData = async (issueTypeControlId: string) => {
    // Paged: dismiss/reopen "All" act on every row returned, so none may be cut at the 1000-row cap.
    // issue_ids breaks last_seen_at ties, so page order is deterministic.
    const data = await fetchAllRows((from, to) =>
      supabase
        .rpc('get_device_mcp_server_issues_extended', {
          p_device_ids: [id],
          p_sandbox_ids: sandboxFilterParam,
        })
        .eq('issue_type_control_id', issueTypeControlId)
        .eq('issue_status', parseInt(selectedIssueStatus))
        .order('last_seen_at', { ascending: false })
        .order('issue_ids')
        .range(from, to)
    )

    return data.map((issue: any) => ({
      device_id: issue.device_id,
      deviceId: issue.device_native_id,
      deviceName: issue.friendly_name || issue.device_native_id,
      ownerEmail: issue.owner_email,
      mcpServerName: issue.mcp_server_name,
      mcpNativeId: issue.mcp_native_id,
      locations: issue.locations ?? [],
      agentName: issue.agent_name,
      plan: getPlan(getEffectivePlan(issue.agent_type, issue.plan)),
      agentEmail: issue.agent_email,
      lastSeen: new Date(issue.last_seen_at).toLocaleString(),
      lastSeenAt: issue.last_seen_at,
      issueIds: issue.issue_ids || [],
      metadata: issue.metadata?.[0] || null,
    }))
  }

  const handleRefreshIssues = () => {
    fetchAgentIssues()
    fetchMcpIssues()
    fetchDevice()
  }


  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate(`/devices${backSearch ? `?${backSearch}` : ''}`)}>
          <ArrowLeft className="h-4 w-4" />
          Devices
        </Button>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-40" />
          </div>
        ) : !device ? (
          <div className="text-muted-foreground">Device not found</div>
        ) : (
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Laptop className="h-8 w-8 text-muted-foreground" />
              <span>Device: <span className="font-mono">{device.device_native_id}</span></span>
            </h1>
            {device.last_active && (
              <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                <Clock className="h-3 w-3" />
                Last scanned {formatDistanceToNow(new Date(device.last_active), { addSuffix: true })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Device info card */}
      {!loading && device && (
        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <div className="flex flex-col gap-1">
                  <p className="text-xs font-medium text-muted-foreground mb-0.5 inline-flex items-center gap-1">
                    Owner
                    {mdmLoaded && mdmIntegrations.length > 0 && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="h-3.5 w-3.5 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            {sortMdmByCreatedAt(mdmIntegrations).map((i) => (
                              <div key={i.id}>
                                {getMdmProviderLabel(i.provider)} · {getMdmSyncStatusText(i)}
                              </div>
                            ))}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </p>
                  <p className="text-sm">{device.owner_email || '—'}</p>
                  {mdmNotConfigured && (
                    <Button
                      variant="link"
                      className="h-auto p-0 text-xs whitespace-nowrap inline-flex items-center gap-1 justify-start"
                      onClick={() => navigate('/settings?section=mdm-integration')}
                    >
                      <Lock className="h-3 w-3" />
                      Set up →
                    </Button>
                  )}
                  {mdmNeedsAttention && (
                    <Button
                      variant="link"
                      className="h-auto p-0 text-xs text-amber-600 hover:text-amber-700 whitespace-nowrap inline-flex items-center gap-1 justify-start"
                      onClick={() => navigate('/settings?section=mdm-integration')}
                    >
                      <AlertTriangle className="h-3 w-3" />
                      Action needed →
                    </Button>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-0.5">Friendly Name</p>
                <p className="text-sm">{device.friendly_name || '—'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-0.5">Installed Versions</p>
                <div className="text-sm flex flex-wrap gap-x-2 gap-y-0.5">
                  {device.scout_version ? <span><span className="text-muted-foreground">Scout </span>{device.scout_version}</span> : null}
                  {device.chrome_extension_version ? <span><span className="text-muted-foreground">Chrome Ext </span>{device.chrome_extension_version}</span> : null}
                  {device.edge_extension_version ? <span><span className="text-muted-foreground">Edge Ext </span>{device.edge_extension_version}</span> : null}
                  {!device.scout_version && !device.chrome_extension_version && !device.edge_extension_version ? '—' : null}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-0.5">OS</p>
                <p className="text-sm">{device.platform && device.os_version ? `${device.platform} ${device.os_version}` : '—'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && device && (
        <SandboxesTable
          sandboxes={sandboxes}
          loading={sandboxesLoading}
          selectedIds={selectedSandboxIds}
          onSelectionChange={setSelectedSandboxIds}
        />
      )}

      {/* Tabs */}
      {!loading && device && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="h-12 w-full flex flex-wrap gap-1 bg-muted/80 p-1.5 rounded-lg border border-border">
            {/*
              Tab badges read from the sandbox-filtered arrays (agents/mcps/
              agentIssues/mcpIssues) rather than device.* counts. device.*
              comes from devices_with_counts, which isn't sandbox-aware — using
              it would freeze the badges at device-wide totals when a sandbox
              is selected. Array lengths reflect the current filter.
            */}
            <TabsTrigger value="agents" className="flex-1 min-w-[120px] px-4 py-2.5 text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow">
              <span className="flex items-center gap-2">
                <Users className="h-4 w-4 shrink-0" />
                Agents
                <Badge variant="secondary" className="ml-0.5 font-semibold tabular-nums">{agents.length}</Badge>
              </span>
            </TabsTrigger>
            <TabsTrigger value="mcps" className="flex-1 min-w-[120px] px-4 py-2.5 text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow">
              <span className="flex items-center gap-2">
                <Network className="h-4 w-4 shrink-0" />
                Connectors
                <Badge variant="secondary" className="ml-0.5 font-semibold tabular-nums">{mcps.length}</Badge>
              </span>
            </TabsTrigger>
            {llmEnabled && (
              <TabsTrigger value="llm-models" className="flex-1 min-w-[120px] px-4 py-2.5 text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow">
                <span className="flex items-center gap-2">
                  <Brain className="h-4 w-4 shrink-0" />
                  LLM Models
                  <Badge variant="secondary" className="ml-0.5 font-semibold tabular-nums">{llmModels.length}</Badge>
                </span>
              </TabsTrigger>
            )}
            <TabsTrigger value="agent-issues" className="flex-1 min-w-[120px] px-4 py-2.5 text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow">
              <span className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Agent Issues
                <Badge variant="secondary" className="ml-0.5 font-semibold tabular-nums">{agentIssues.length}</Badge>
              </span>
            </TabsTrigger>
            <TabsTrigger value="mcp-issues" className="flex-1 min-w-[120px] px-4 py-2.5 text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow">
              <span className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Connector Issues
                <Badge variant="secondary" className="ml-0.5 font-semibold tabular-nums">{mcpIssues.length}</Badge>
              </span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="agents">
            <AgentsTable
              agents={agents}
              loading={agentsLoading}
              onRowClick={(agent) => navigate(`/agents/${agent.id}?source_device=${id}`)}
              hideActiveDevices={true}
              hideActiveIssues={true}
              deviceSpecificDeploymentTypes={deviceSpecificDeploymentTypes}
              deviceSpecificHasHostInstances={agentDeviceSpecificHasHostInstances}
              deviceSpecificSandboxRuntimeTypes={agentDeviceSpecificSandboxRuntimeTypes}
              hasDeviceFilter={true}
            />
          </TabsContent>

          <TabsContent value="mcps">
            <McpsTable
              mcps={mcps}
              loading={mcpsLoading}
              deviceSpecificAgentNames={deviceSpecificAgentNames}
              deviceSpecificDistributionChannels={deviceSpecificDistributionChannels}
              deviceSpecificHasHostInstances={mcpDeviceSpecificHasHostInstances}
              deviceSpecificSandboxRuntimeTypes={mcpDeviceSpecificSandboxRuntimeTypes}
              hasDeviceFilter={true}
              onRowClick={(mcp) => navigate(`/mcps/${mcp.id}?source_device=${id}`)}
              hideActiveDevices={true}
              hideActiveIssues={true}
              {...(mcpAccessEnabled ? access.tableProps : {})}
            />
            {mcpAccessEnabled && (
              <AllowAccessDialog
                {...access.allowDialogProps}
                connectorName={(type) => connectorNameByType.get(type) ?? `Connector ${type}`}
              />
            )}
          </TabsContent>

          {llmEnabled && (
            <TabsContent value="llm-models">
              <LlmModelsTable
                models={llmModels}
                logos={llmLogos}
                loading={llmModelsLoading}
                onRowClick={(m) => navigate(`/llm-models/${m.id}?source_device=${id}`)}
                hideActiveDevices={true}
              />
            </TabsContent>
          )}

          <TabsContent value="agent-issues">
            <div className="space-y-4">
              <Tabs value={selectedIssueStatus} onValueChange={setSelectedIssueStatus}>
                <TabsList className="h-auto p-1 gap-1">
                  {ISSUE_STATUS_TABS.map((tab) => {
                    const styles: Record<string, { dot: string; icon: typeof AlertTriangle; bg: string }> = {
                      "1": {
                        dot: "bg-red-500",
                        icon: AlertTriangle,
                        bg: "data-[state=active]:bg-red-100 data-[state=active]:dark:bg-red-900/30 border border-transparent data-[state=active]:border-red-200 data-[state=active]:dark:border-red-800"
                      },
                      "2": {
                        dot: "bg-green-500",
                        icon: CheckCircle2,
                        bg: "data-[state=active]:bg-green-100 data-[state=active]:dark:bg-green-900/30 border border-transparent data-[state=active]:border-green-200 data-[state=active]:dark:border-green-800"
                      },
                      "3": {
                        dot: "bg-gray-400",
                        icon: XCircle,
                        bg: "data-[state=active]:bg-gray-100 data-[state=active]:dark:bg-gray-800/50 border border-transparent data-[state=active]:border-gray-300 data-[state=active]:dark:border-gray-700"
                      },
                    }
                    const style = styles[tab.value]
                    const Icon = style.icon

                    return (
                      <TabsTrigger
                        key={tab.value}
                        value={tab.value}
                        className={`${style.bg} px-4 py-2`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${style.dot}`} />
                          <Icon className="h-4 w-4" />
                          <span>{tab.label}</span>
                        </div>
                      </TabsTrigger>
                    )
                  })}
                </TabsList>
              </Tabs>
              <AgentIssuesTable
                violations={agentIssues}
                selectedStatus={selectedIssueStatus}
                loading={agentIssuesLoading}
                error={agentIssuesError}
                onRefresh={handleRefreshIssues}
                fetchDeviceData={fetchAgentDeviceData}
              />
            </div>
          </TabsContent>

          <TabsContent value="mcp-issues">
            <div className="space-y-4">
              <Tabs value={selectedIssueStatus} onValueChange={setSelectedIssueStatus}>
                <TabsList className="h-auto p-1 gap-1">
                  {ISSUE_STATUS_TABS.map((tab) => {
                    const styles: Record<string, { dot: string; icon: typeof AlertTriangle; bg: string }> = {
                      "1": {
                        dot: "bg-red-500",
                        icon: AlertTriangle,
                        bg: "data-[state=active]:bg-red-100 data-[state=active]:dark:bg-red-900/30 border border-transparent data-[state=active]:border-red-200 data-[state=active]:dark:border-red-800"
                      },
                      "2": {
                        dot: "bg-green-500",
                        icon: CheckCircle2,
                        bg: "data-[state=active]:bg-green-100 data-[state=active]:dark:bg-green-900/30 border border-transparent data-[state=active]:border-green-200 data-[state=active]:dark:border-green-800"
                      },
                      "3": {
                        dot: "bg-gray-400",
                        icon: XCircle,
                        bg: "data-[state=active]:bg-gray-100 data-[state=active]:dark:bg-gray-800/50 border border-transparent data-[state=active]:border-gray-300 data-[state=active]:dark:border-gray-700"
                      },
                    }
                    const style = styles[tab.value]
                    const Icon = style.icon

                    return (
                      <TabsTrigger
                        key={tab.value}
                        value={tab.value}
                        className={`${style.bg} px-4 py-2`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${style.dot}`} />
                          <Icon className="h-4 w-4" />
                          <span>{tab.label}</span>
                        </div>
                      </TabsTrigger>
                    )
                  })}
                </TabsList>
              </Tabs>
              <McpIssuesTable
                violations={mcpIssues}
                selectedStatus={selectedIssueStatus}
                loading={mcpIssuesLoading}
                error={mcpIssuesError}
                onRefresh={handleRefreshIssues}
                fetchDeviceData={fetchMcpDeviceData}
              />
            </div>
          </TabsContent>

        </Tabs>
      )}
    </div>
  )
}

export default DeviceDetail
