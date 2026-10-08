import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { DeviceOwnerHeader } from "@/components/DeviceOwnerHeader"
import { useNavigate } from "react-router-dom"
import { supabase } from "@/integrations/supabase/client"
import { useOrg } from "@/contexts/OrgContext"
import { useAuth } from "@/contexts/AuthContext"
import { Monitor, AlertTriangle, Clock, Search, Download, Tag, Plus, Pencil, Trash2, Eye } from "lucide-react"
import { traceforcApi } from "@/integrations/traceforce/client"
import type { MdmIntegration, LatestVersions } from "@/integrations/traceforce/types"
import { getUserGroupSourceLabel, getUserGroupSourceBadge, anyMdmNeedsAttention, deviceOptions } from "@/lib/appUtils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MultiSelect } from "@/components/ui/multi-select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { useUrlFilterParams, useUrlStringFilter, useUrlArrayFilter } from "@/hooks/use-url-filters"
import { downloadCsv } from "@/lib/csvUtils"
import { userGroupSourceEnumFromString } from "@/lib/idpGroups"
import { useTableSort } from "@/hooks/use-table-sort"
import { SortableTableHead } from "@/components/SortableTableHead"
import { useFeatureFlag } from "@/hooks/use-feature-flag"
import { LLM_UI_FLAG } from "@/lib/llmModels"
import { formatDistanceToNow, format } from "date-fns"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts"


const Devices = () => {
  const navigate = useNavigate()
  const { enabled: llmEnabled } = useFeatureFlag(LLM_UI_FLAG)
  const { searchParams, updateParams } = useUrlFilterParams()
  const { session } = useAuth()
  const { activeOrgId } = useOrg()
  // Filters live in the URL (defaults omitted) so Back from a device detail restores them.
  const [tabParam, setActiveTab] = useUrlStringFilter("tab", "devices")
  // Invalid deep-link values fall back to the default — an unknown tab would render no content.
  const activeTab = ["devices", "user-groups"].includes(tabParam) ? tabParam : "devices"
  const [searchTerm, setSearchTerm] = useUrlStringFilter("q")
  const [platformFilters, setPlatformFilters] = useUrlArrayFilter("platform")
  const [statusParam, setStatusFilter] = useUrlStringFilter("status", "all")
  const statusFilter = ["all", "active", "inactive", "has-issues"].includes(statusParam) ? statusParam : "all"
  const [versionFilter, setVersionFilter] = useUrlStringFilter("version", "all")
  const [latestVersions, setLatestVersions] = useState<LatestVersions | null>(null)
  const [versionsLoaded, setVersionsLoaded] = useState(false)
  const [devices, setDevices] = useState<any[]>([])
  // Set when the device LIST fetch failed: the table renders the error instead
  // of "No devices found matching your filters" (reads as data loss).
  const [devicesError, setDevicesError] = useState<string | null>(null)
  const [scanActivity, setScanActivity] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState({
    total: null as number | null,
    withIssues: null as number | null,
    lastScan: null as string | null
  })
  const [mdmIntegrations, setMdmIntegrations] = useState<MdmIntegration[]>([])
  const [mdmLoaded, setMdmLoaded] = useState(false)
  const { toast } = useToast()

  const [userGroups, setUserGroups] = useState<any[]>([])
  // Set when the groups fetch failed: the tab renders the error + retry
  // instead of stale rows or a lying "No user groups yet".
  const [userGroupsError, setUserGroupsError] = useState<string | null>(null)
  const [userGroupsLoading, setUserGroupsLoading] = useState(true)
  const [userGroupFilters, setUserGroupFilters] = useUrlArrayFilter("groups")
  const [groupSearchTerm, setGroupSearchTerm] = useState("")
  const [showGroupDialog, setShowGroupDialog] = useState(false)
  const [editingGroup, setEditingGroup] = useState<{ id: string; name: string; preservedDeviceIds: string[] } | null>(null)
  const [groupName, setGroupName] = useState("")
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  // True while the edit dialog waits for the detail GET (dialog opens
  // immediately on click; Update stays disabled until membership loads).
  const [editLoading, setEditLoading] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null)
  const [policyCount, setPolicyCount] = useState(0)
  const [deleting, setDeleting] = useState(false)
  const { sort: groupSort, handleSort: handleGroupSort, sortItems: sortGroupItems } = useTableSort()

  // Computed MDM states — derived from full array for provider-agnostic coverage
  const mdmNeedsAttention = anyMdmNeedsAttention(mdmIntegrations)
  const mdmNotConfigured = mdmLoaded && mdmIntegrations.length === 0

  useEffect(() => {
    fetchDevicesData()
    // session?.access_token: the devices read goes through the API, so a
    // late-hydrating session must re-run this rather than skip the table.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrgId, session?.access_token])

  useEffect(() => {
    fetchMetrics()
  }, [activeOrgId])

  useEffect(() => {
    fetchScanActivity()
  }, [activeOrgId])

  useEffect(() => {
    fetchUserGroups()
    // session?.access_token: the groups read goes through the API, so a
    // late-hydrating session must re-run this rather than skip the tab.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrgId, session?.access_token])

  useEffect(() => {
    if (session?.access_token) {
      fetchMdmIntegration()
      fetchLatestVersions()
    }
  }, [session?.access_token])

  const fetchLatestVersions = async () => {
    if (!session?.access_token) return
    try {
      const response = await traceforcApi.getVersions(session.access_token)
      if (response.error) {
        throw new Error(response.error)
      }
      if (response.data) {
        setLatestVersions(response.data)
      }
    } catch (error) {
      console.error('Error fetching latest versions:', error)
      toast({
        title: "Error",
        description: "Failed to load latest version data",
        variant: "destructive",
      })
    } finally {
      setVersionsLoaded(true)
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

  const fetchMetrics = async () => {
    try {
      // Query all metrics in parallel
      const [totalResult, withIssuesResult, lastScanResult] = await Promise.all([
        // Total devices count
        supabase
          .from('devices_with_counts' as any)
          .select('device_id', { count: 'exact', head: true })
          .eq('org_id', activeOrgId!),

        // Devices with issues count (has agent_issues > 0 OR mcp_issues > 0)
        supabase
          .from('devices_with_counts' as any)
          .select('device_id', { count: 'exact', head: true })
          .eq('org_id', activeOrgId!)
          .or('agent_issues.gt.0,mcp_issues.gt.0'),

        // Last scan (most recent last_active)
        supabase
          .from('devices_with_counts' as any)
          .select('last_active')
          .eq('org_id', activeOrgId!)
          .order('last_active', { ascending: false })
          .limit(1)
          .maybeSingle()
      ])

      setMetrics({
        total: totalResult.count ?? null,
        withIssues: withIssuesResult.count ?? null,
        lastScan: (lastScanResult.data as any)?.last_active ?? null
      })
    } catch (error: any) {
      console.error('Error fetching metrics:', error)
      // Don't show toast for metrics errors, just log
    }
  }

  const fetchScanActivity = async () => {
    try {
      // Build the 7-day window aligned to local-day boundaries so the query
      // range and chart buckets agree exactly.
      const windowStart = new Date()
      windowStart.setHours(0, 0, 0, 0)
      windowStart.setDate(windowStart.getDate() - 6)

      const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(windowStart)
        d.setDate(windowStart.getDate() + i)
        return {
          key: format(d, 'yyyy-MM-dd'),
          label: format(d, 'MMM d'),
        }
      })

      const { data: recentAgentIssues } = await supabase
        .from('agent_issues')
        .select('created_at')
        .eq('org_id', activeOrgId!)
        .gte('created_at', windowStart.toISOString())
        .order('created_at', { ascending: false })

      const { data: recentMcpIssues } = await supabase
        .from('mcp_server_issues')
        .select('created_at')
        .eq('org_id', activeOrgId!)
        .gte('created_at', windowStart.toISOString())
        .order('created_at', { ascending: false })

      const agentCounts = new Map(days.map(d => [d.key, 0]))
      const mcpCounts = new Map(days.map(d => [d.key, 0]))

      recentAgentIssues?.forEach(issue => {
        const k = format(new Date(issue.created_at), 'yyyy-MM-dd')
        agentCounts.set(k, (agentCounts.get(k) ?? 0) + 1)
      })

      recentMcpIssues?.forEach(issue => {
        const k = format(new Date(issue.created_at), 'yyyy-MM-dd')
        mcpCounts.set(k, (mcpCounts.get(k) ?? 0) + 1)
      })

      const chartData = days.map(({ key, label }) => ({
        date: key,
        displayDate: label,
        agentIssues: agentCounts.get(key) ?? 0,
        mcpIssues: mcpCounts.get(key) ?? 0,
      }))

      setScanActivity(chartData as any)
    } catch (error: any) {
      console.error('Error fetching scan activity:', error)
      // Don't show toast for scan activity errors, just log
    }
  }

  const fetchDevicesData = async () => {
    if (!session?.access_token) return
    try {
      setLoading(true)

      // GET /api/v1/devices: counts, component versions, and RESOLVED user
      // groups server-side. user_groups covers both membership kinds — direct
      // assignments AND IdP-synced groups the device's owner belongs to via
      // the MDM owner email — so the chips and the group filter show the same
      // reach group-scoped policies enforce against. Drained through the
      // cursor; this table filters and sorts client-side.
      // Drain on a STABLE sort key: cursor pages compare (sort_value, id), so
      // paging on last_seen_at would silently drop any device that heartbeats
      // mid-drain (its value moves past the cursor). name only changes on a
      // rename; the table re-sorts client-side anyway.
      const devicesData = await traceforcApi.listAllDevices(session.access_token, {
        sort_by: 'name',
        sort_order: 'asc',
      })
      setDevicesError(null)

      const mappedDevices: any[] = devicesData.map((d) => ({
        id: d.id,
        friendly_name: d.friendly_name,
        device_native_id: d.device_native_id,
        platform: d.platform,
        os_version: d.os_version,
        last_active: d.last_seen_at,
        owner_email: d.owner_email,
        sandbox_count: d.sandbox_count,
        agent_count: d.agent_count,
        mcp_count: d.mcp_count,
        active_issues: d.active_issues,
        agent_issues: d.agent_issues,
        mcp_issues: d.mcp_issues,
        llm_model_count: d.llm_model_count ?? 0,
        chrome_extension_version: d.chrome_extension_version,
        edge_extension_version: d.edge_extension_version,
        scout_version: d.scout_version,
        // The API's status verdicts ride along so the version filter matches
        // exactly what the server computed (null = latest-versions blip).
        scout_version_status: d.scout_version_status,
        chrome_extension_version_status: d.chrome_extension_version_status,
        edge_extension_version_status: d.edge_extension_version_status,
        // The badge/label helpers are keyed on the UserGroupSource enum ints;
        // the API speaks the string vocabulary — bridge here.
        user_groups: d.user_groups.map((g) => ({
          id: g.id,
          name: g.name,
          user_group_source: userGroupSourceEnumFromString(g.source),
        })),
      }))

      // The drain pages on the stable name key; the table's resting order is
      // last-seen descending (what the page always showed), restored here —
      // useTableSort only reorders once the user clicks a column.
      mappedDevices.sort((a, b) =>
        new Date(b.last_active ?? 0).getTime() - new Date(a.last_active ?? 0).getTime())
      setDevices(mappedDevices)

    } catch (error: any) {
      console.error('Error fetching devices:', error)
      // The table renders the error (devicesError) instead of falling through
      // to "No devices found matching your filters" — which reads as data
      // loss on an onboarded org. Same precedent as DirectoryUsers.
      setDevicesError(error instanceof Error ? error.message : 'Request failed')
      setDevices([])
    } finally {
      setLoading(false)
    }
  }

  const fetchUserGroups = async () => {
    if (!session?.access_token) return
    try {
      setUserGroupsLoading(true)
      // GET /api/v1/user-groups resolves everything this tab shows server-side:
      // tombstoned IdP groups filtered out, device_count via
      // user_group_resolved_devices (assigned devices for Traceforce groups,
      // active-member owner-email resolution for synced groups — the same
      // number group-scoped policies reach), user_count = live directory
      // members, and the cursor drain replaces the PostgREST paging loop.
      //
      // managed = the group is synced from an identity provider: its name and
      // membership are read-only in this UI (the buttons are hidden; a
      // server-side write guard is a nextjs follow-up).
      // lastUpdatedAt: manual edits stamp last_modified_at; the IdP sync worker
      // maintains updated_at instead, so the Updated column falls back to it.
      const data = await traceforcApi.listAllUserGroups(session.access_token)
      setUserGroups(data.map((g) => ({
        id: g.id,
        name: g.name,
        user_group_source: userGroupSourceEnumFromString(g.source),
        created_at: g.created_at,
        managed: g.synced,
        activeDeviceCount: g.device_count,
        memberCount: g.user_count,
        lastUpdatedAt: g.last_modified_at ?? g.updated_at ?? null,
      })))
      setUserGroupsError(null)
    } catch (error: any) {
      console.error('Error fetching user groups:', error)
      // Same treatment as the device table and DirectoryUsers: clear stale
      // rows and render the error in-table instead of leaving old data under
      // a transient toast.
      setUserGroups([])
      setUserGroupsError(error instanceof Error ? error.message : 'Request failed')
      toast({
        title: "Error",
        description: "Failed to load user groups",
        variant: "destructive",
      })
    } finally {
      setUserGroupsLoading(false)
    }
  }

  // Deliberately NOT memoized: a useCallback([], …) would freeze the first
  // render's fetch closures — on a hard reload those hold session = null, so
  // every post-save refetch would silently no-op on the token guards (and in a
  // long-lived tab they'd hold a rotated-out token). Only event handlers call
  // this, so a fresh identity per render costs nothing.
  const refetchUserGroupData = async () => {
    await Promise.all([fetchUserGroups(), fetchDevicesData()])
  }

  const filteredDevices = devices.filter((device) => {
    const searchLower = searchTerm.toLowerCase()
    const matchesSearch =
      device.device_native_id.toLowerCase().includes(searchLower) ||
      (device.friendly_name && device.friendly_name.toLowerCase().includes(searchLower)) ||
      (device.owner_email && device.owner_email.toLowerCase().includes(searchLower))
    const matchesPlatform = platformFilters.length === 0 || platformFilters.includes(device.platform)
    
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const isActive = new Date(device.last_active) > thirtyDaysAgo
    
    const matchesStatus = statusFilter === "all" ||
      (statusFilter === "active" && isActive) ||
      (statusFilter === "inactive" && !isActive) ||
      (statusFilter === "has-issues" && device.active_issues > 0)

    // Version filter runs on the API's *_version_status fields — the same
    // computation the rows carry — instead of re-deriving from the separately
    // fetched latestVersions (two computations can disagree mid-rollout). The
    // /versions fetch remains only for the latest-versions card and this
    // filter's disabled state. Null statuses (the API's versions-blip case)
    // fail OPEN: an unknown status must not hide devices.
    let matchesVersion = true
    if (versionFilter !== "all") {
      const scoutStatus = device.scout_version_status ?? null
      const chromeStatus = device.chrome_extension_version_status ?? null
      const edgeStatus = device.edge_extension_version_status ?? null
      if (scoutStatus === null || chromeStatus === null || edgeStatus === null) {
        matchesVersion = true
      } else {
        const hasExtension = chromeStatus !== "not_installed" || edgeStatus !== "not_installed"
        // "Current" = scout at latest AND at least one installed browser extension at latest.
        const isCurrent =
          scoutStatus === "latest" && (chromeStatus === "latest" || edgeStatus === "latest")
        const isOutdated = hasExtension && !isCurrent

        if (versionFilter === "latest") {
          matchesVersion = isCurrent
        } else if (versionFilter === "outdated") {
          matchesVersion = isOutdated
        } else if (versionFilter === "no-extension") {
          matchesVersion = !hasExtension
        }
      }
    }

    const matchesUserGroup = userGroupFilters.length === 0 ||
      device.user_groups.some((g: any) => userGroupFilters.includes(g.id))

    return matchesSearch && matchesPlatform && matchesStatus && matchesVersion && matchesUserGroup
  })

  const { sort, handleSort, sortItems } = useTableSort()

  const sortedDevices = useMemo(() => {
    return sortItems(filteredDevices, (device, column) => {
      switch (column) {
        case 'device_id': return device.device_native_id?.toLowerCase()
        case 'owner': return device.owner_email?.toLowerCase()
        case 'name': return (device.friendly_name || device.device_native_id)?.toLowerCase()
        case 'sandboxes': return device.sandbox_count
        case 'agents': return device.agent_count
        case 'mcps': return device.mcp_count
        case 'llm_models': return device.llm_model_count
        case 'agent_issues': return device.agent_issues
        case 'mcp_issues': return device.mcp_issues
        case 'last_seen': return device.last_active ? new Date(device.last_active).getTime() : null
        default: return null
      }
    })
  }, [filteredDevices, sort])

  const platformOptions = useMemo(() =>
    Array.from(new Set(devices.map(d => d.platform).filter(Boolean)))
      .map(p => ({ id: p, name: p })),
    [devices]
  )
  // Managed (IdP-synced) groups are offered too: device rows now carry
  // RESOLVED membership (the API's user_group_resolved_devices join), so
  // filtering by a synced group matches the devices its members own — the
  // same reach group-scoped policies have.
  const userGroupFilterOptions = useMemo(() =>
    userGroups.map(g => ({ id: g.id, name: `${g.name} (${getUserGroupSourceLabel(g.user_group_source)})` })),
    [userGroups]
  )
  const filteredUserGroups = useMemo(() => {
    if (!groupSearchTerm) return userGroups
    const lower = groupSearchTerm.toLowerCase()
    return userGroups.filter(g => g.name.toLowerCase().includes(lower))
  }, [userGroups, groupSearchTerm])
  const sortedUserGroups = useMemo(() => {
    return sortGroupItems(filteredUserGroups, (group, column) => {
      switch (column) {
        case 'name': return group.name?.toLowerCase()
        case 'devices': return group.activeDeviceCount ?? 0
        // Manual groups show a dash in Members — sort them as null (useTableSort
        // puts nulls last in BOTH directions), not a sentinel that floats dash
        // rows to the top on ascending.
        case 'members': return group.managed ? (group.memberCount ?? 0) : null
        case 'source': return getUserGroupSourceLabel(group.user_group_source)
        case 'created': return new Date(group.created_at).getTime()
        case 'updated': return group.lastUpdatedAt ? new Date(group.lastUpdatedAt).getTime() : 0
        default: return null
      }
    })
  }, [filteredUserGroups, groupSort])

  const devicePickerOptions = useMemo(() =>
    deviceOptions(devices),
    [devices]
  )

  const handleExport = () => {
    const exportData = filteredDevices.map(device => ({
      'Device ID': device.device_native_id || '-',
      'Device Owner': device.owner_email || '-',
      'Device Name': device.friendly_name || device.device_native_id || '-',
      'User Groups': device.user_groups?.map((g: any) => `${g.name} (${getUserGroupSourceLabel(g.user_group_source)})`).join(', ') || '-',
      'Platform': device.platform || '-',
      'OS Version': device.os_version || '-',
      'Sandboxes': device.sandbox_count,
      'Agents': device.agent_count,
      'Connectors': device.mcp_count,
      ...(llmEnabled ? { 'LLM Models': device.llm_model_count } : {}),
      'Agent Issues': device.agent_issues,
      'Connector Issues': device.mcp_issues,
      'Total Issues': device.active_issues,
      'Chrome Ext Version': device.chrome_extension_version || '-',
      'Edge Ext Version': device.edge_extension_version || '-',
      'Scout Version': device.scout_version || '-',
      'Last Seen': device.last_active ? new Date(device.last_active).toLocaleString() : '-'
    }))
    downloadCsv(exportData, `devices-${new Date().toISOString().split('T')[0]}.csv`)
  }

  // Invalidates any in-flight edit-detail fetch: bumped on every dialog
  // open/close so a slow response for group A can never repopulate a dialog
  // that has since been closed or reopened for group B / Create.
  const editSeq = useRef(0)

  const openCreateGroupDialog = () => {
    editSeq.current++
    setEditingGroup(null)
    setGroupName("")
    setSelectedDeviceIds([])
    setEditLoading(false)
    setShowGroupDialog(true)
  }

  const openEditGroupDialog = async (group: any) => {
    // The API list carries counts, not member device ids — the detail fetch
    // happens on demand. The dialog opens IMMEDIATELY (a click must respond;
    // the round-trip can take seconds on cold routes) with the name prefilled
    // and the picker in a loading state; Update stays disabled until the
    // membership lands, so nothing can be saved against unloaded state.
    if (!session?.access_token) return
    const seq = ++editSeq.current
    setEditingGroup({ id: group.id, name: group.name, preservedDeviceIds: [] })
    setGroupName(group.name)
    setSelectedDeviceIds([])
    setEditLoading(true)
    setShowGroupDialog(true)

    const res = await traceforcApi.getUserGroup(session.access_token, group.id)
    // A newer open/close superseded this fetch — its response must not touch
    // the current dialog's state.
    if (seq !== editSeq.current) return
    // Missing device_ids (a detail GET predating the field) is a LOAD FAILURE,
    // not an empty group: populating [] would let a save replace the whole
    // membership with just the new selection — success toast, policies
    // silently narrowed. Close the dialog instead; dead-but-safe.
    if (res.error || !res.data || !Array.isArray(res.data.device_ids)) {
      setShowGroupDialog(false)
      setEditingGroup(null)
      setEditLoading(false)
      toast({ title: "Error", description: "Failed to load the group's devices", variant: "destructive" })
      return
    }
    // The picker shows only active devices, so select only members that are in
    // the page's (active-only) device list — same split isActiveMember made on
    // the embed. Members whose device is soft-deleted are held aside and
    // re-appended on save so editing never silently drops them.
    const deviceIds = res.data.device_ids
    const activeDeviceIdSet = new Set(devices.map((d: any) => d.id))
    const activeIds = deviceIds.filter((id) => activeDeviceIdSet.has(id))
    const preservedDeviceIds = deviceIds.filter((id) => !activeDeviceIdSet.has(id))
    setEditingGroup({ id: group.id, name: group.name, preservedDeviceIds })
    setSelectedDeviceIds(activeIds)
    setEditLoading(false)
  }

  const handleSaveGroup = async () => {
    if (!session?.access_token || !groupName.trim() || selectedDeviceIds.length === 0) return
    setSaving(true)
    try {
      if (editingGroup) {
        const response = await traceforcApi.updateUserGroup(session.access_token, editingGroup.id, {
          name: groupName.trim(),
          // Re-append the soft-deleted members so they stay in the group (they're hidden from the picker).
          device_ids: [...selectedDeviceIds, ...editingGroup.preservedDeviceIds],
        })
        if (response.statusCode === 409) {
          toast({ title: "Error", description: "A group with this name already exists", variant: "destructive" })
          return
        }
        if (response.error) {
          toast({ title: "Error", description: "Failed to update user group", variant: "destructive" })
          return
        }
        toast({ title: "Success", description: "User group updated" })
      } else {
        const response = await traceforcApi.createUserGroup(session.access_token, {
          name: groupName.trim(),
          device_ids: selectedDeviceIds,
        })
        if (response.statusCode === 409) {
          toast({ title: "Error", description: "A group with this name already exists", variant: "destructive" })
          return
        }
        if (response.error) {
          toast({ title: "Error", description: "Failed to create user group", variant: "destructive" })
          return
        }
        toast({ title: "Success", description: "User group created" })
      }
      setShowGroupDialog(false)
      await refetchUserGroupData()
    } catch (error) {
      console.error('Error saving user group:', error)
      toast({ title: "Error", description: "An unexpected error occurred", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteClick = async (group: any) => {
    setDeletingGroupId(group.id)
    try {
      const { count, error } = await supabase
        .from('policy_user_groups')
        .select('*', { count: 'exact', head: true })
        .eq('user_group_id', group.id)
      if (error) throw error
      setPolicyCount(count ?? 0)
    } catch (error) {
      console.error('Error checking policy associations:', error)
      setPolicyCount(0)
    }
    setShowDeleteDialog(true)
  }

  const confirmDelete = async () => {
    if (!session?.access_token || !deletingGroupId) return
    setDeleting(true)
    try {
      const response = await traceforcApi.deleteUserGroup(session.access_token, deletingGroupId)
      if (response.error) {
        toast({ title: "Error", description: "Failed to delete user group", variant: "destructive" })
        return
      }
      toast({ title: "Success", description: "User group deleted" })
      setShowDeleteDialog(false)
      setDeletingGroupId(null)
      await refetchUserGroupData()
    } catch (error) {
      console.error('Error deleting user group:', error)
      toast({ title: "Error", description: "An unexpected error occurred", variant: "destructive" })
    } finally {
      setDeleting(false)
    }
  }

  const MetricCard = ({ title, value, icon: Icon, description }: any) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{loading || value === null ? <Skeleton className="h-8 w-20" /> : value}</div>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
      </CardContent>
    </Card>
  )

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Devices</h1>
        <p className="text-muted-foreground">
          Monitor and manage devices running AI agents and connectors
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Devices"
          value={metrics.total}
          icon={Monitor}
          description="Registered devices"
        />
        <MetricCard
          title="Devices with Issues"
          value={metrics.withIssues}
          icon={AlertTriangle}
          description="Devices with active issues"
        />
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Latest Versions</CardTitle>
            <Tag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {!versionsLoaded ? (
              <Skeleton className="h-8 w-full" />
            ) : (
              <div className="flex gap-6">
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Scout</div>
                  <div className="text-2xl font-bold">{latestVersions?.scout || '-'}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Browser Extension</div>
                  <div className="text-2xl font-bold">{latestVersions?.extension || '-'}</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        <MetricCard
          title="Last Scan"
          value={metrics.lastScan ? formatDistanceToNow(new Date(metrics.lastScan), { addSuffix: true }) : '-'}
          icon={Clock}
          description="Most recent activity"
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full bg-transparent p-0 h-auto gap-0">
          <TabsTrigger
            value="devices"
            className="flex-1 flex flex-col items-start rounded-none rounded-tl-lg px-5 py-3 text-left data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm data-[state=inactive]:bg-secondary data-[state=inactive]:text-secondary-foreground data-[state=inactive]:border data-[state=inactive]:border-border data-[state=inactive]:hover:bg-accent"
          >
            <span className="text-sm font-semibold">Device Management</span>
            <span className="text-xs font-normal opacity-80">Search, filter, and manage your devices</span>
          </TabsTrigger>
          <TabsTrigger
            value="user-groups"
            className="flex-1 flex flex-col items-start rounded-none rounded-tr-lg px-5 py-3 text-left data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm data-[state=inactive]:bg-secondary data-[state=inactive]:text-secondary-foreground data-[state=inactive]:border data-[state=inactive]:border-border data-[state=inactive]:hover:bg-accent"
          >
            <span className="text-sm font-semibold">User Group Management</span>
            <span className="text-xs font-normal opacity-80">Create and manage user groups</span>
          </TabsTrigger>
        </TabsList>

      <Card className="rounded-t-none">
        <CardContent className="pt-6">
            <TabsContent value="devices">
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by device ID, owner, or name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={versionFilter}
              onValueChange={setVersionFilter}
              disabled={!latestVersions?.scout || !latestVersions?.extension}
            >
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Version" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Versions</SelectItem>
                <SelectItem value="latest">Latest</SelectItem>
                <SelectItem value="outdated">Outdated</SelectItem>
                <SelectItem value="no-extension">No Browser Extension</SelectItem>
              </SelectContent>
            </Select>
            <div className="w-full md:w-[180px]">
              <MultiSelect
                options={platformOptions}
                selectedIds={platformFilters}
                onChange={setPlatformFilters}
                placeholder="Platform"
                searchPlaceholder="Search platforms..."
                emptyMessage="No platforms."
                label="platform"
                compact
              />
            </div>
            <div className="w-full md:w-[200px]">
              <MultiSelect
                options={userGroupFilterOptions}
                selectedIds={userGroupFilters}
                onChange={setUserGroupFilters}
                placeholder="User Groups"
                searchPlaceholder="Search groups..."
                emptyMessage="No user groups."
                label="group"
                compact
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="has-issues">Has Issues</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleExport} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>

          {/* Devices Table */}
          <div className="rounded-md border">
            <Table className="[&_th]:px-2 [&_td]:px-2">
              <TableHeader>
                <TableRow className={mdmNotConfigured || mdmNeedsAttention ? '[&>th]:align-top' : ''}>
                  <SortableTableHead column="device_id" currentColumn={sort.column} direction={sort.direction} onSort={handleSort} className="w-[11%]">Device ID</SortableTableHead>
                  <SortableTableHead column="owner" currentColumn={sort.column} direction={sort.direction} onSort={handleSort} className="w-[12%]">
                    <DeviceOwnerHeader mdmIntegrations={mdmIntegrations} mdmNotConfigured={mdmNotConfigured} mdmNeedsAttention={mdmNeedsAttention} />
                  </SortableTableHead>
                  <SortableTableHead column="name" currentColumn={sort.column} direction={sort.direction} onSort={handleSort} className="w-[11%]">Device Name</SortableTableHead>
                  <TableHead className="w-[10%]">Versions</TableHead>
                  <TableHead className="w-[8%]">Platform/OS</TableHead>
                  <TableHead className="w-[12%]">User Groups</TableHead>
                  <SortableTableHead column="sandboxes" currentColumn={sort.column} direction={sort.direction} onSort={handleSort} className="w-[6%] text-center">Sandboxes</SortableTableHead>
                  <SortableTableHead column="agents" currentColumn={sort.column} direction={sort.direction} onSort={handleSort} className="w-[5%] text-center">Agents</SortableTableHead>
                  <SortableTableHead column="mcps" currentColumn={sort.column} direction={sort.direction} onSort={handleSort} className="w-[5%] text-center">Connectors</SortableTableHead>
                  {llmEnabled && <SortableTableHead column="llm_models" currentColumn={sort.column} direction={sort.direction} onSort={handleSort} className="w-[5%] text-center">LLM Models</SortableTableHead>}
                  <SortableTableHead column="agent_issues" currentColumn={sort.column} direction={sort.direction} onSort={handleSort} className="w-[6%] text-center">Agent Issues</SortableTableHead>
                  <SortableTableHead column="mcp_issues" currentColumn={sort.column} direction={sort.direction} onSort={handleSort} className="w-[6%] text-center">Connector Issues</SortableTableHead>
                  <SortableTableHead column="last_seen" currentColumn={sort.column} direction={sort.direction} onSort={handleSort} className="w-[8%]">Last Seen</SortableTableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-8 mx-auto" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-8 mx-auto" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-8 mx-auto" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-8 mx-auto" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-8 mx-auto" /></TableCell>
                      {llmEnabled && <TableCell><Skeleton className="h-6 w-8 mx-auto" /></TableCell>}
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    </TableRow>
                  ))
                ) : devicesError ? (
                  <TableRow>
                    <TableCell colSpan={llmEnabled ? 13 : 12} className="text-center text-muted-foreground py-8">
                      <div className="space-y-3">
                        <p>Couldn't load devices. {devicesError}</p>
                        <Button variant="outline" size="sm" onClick={() => void fetchDevicesData()}>
                          Try again
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredDevices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={llmEnabled ? 13 : 12} className="text-center text-muted-foreground py-8">
                      No devices found matching your filters
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedDevices.map((device) => (
                    <TableRow
                      key={device.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/devices/${device.id}`, { state: { backSearch: searchParams.toString() } })}
                    >
                      <TableCell className="font-medium font-mono">
                        <div className="truncate max-w-[130px]" title={device.device_native_id}>
                          {device.device_native_id}
                        </div>
                      </TableCell>
                      <TableCell>
                        {device.owner_email ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="truncate cursor-default max-w-[160px]">
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
                      <TableCell>
                        <div className="truncate max-w-[140px]" title={device.friendly_name || device.device_native_id}>
                          {device.friendly_name || device.device_native_id}
                        </div>
                      </TableCell>
                      <TableCell>
                        {device.chrome_extension_version || device.edge_extension_version || device.scout_version ? (
                          <div className="text-xs space-y-0.5">
                            {device.chrome_extension_version && (
                              <div><span className="text-muted-foreground">Chrome Ext</span> {device.chrome_extension_version}</div>
                            )}
                            {device.edge_extension_version && (
                              <div><span className="text-muted-foreground">Edge Ext</span> {device.edge_extension_version}</div>
                            )}
                            {device.scout_version && (
                              <div><span className="text-muted-foreground">Scout</span> {device.scout_version}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {device.platform && device.os_version ? (
                          <span className="text-sm">
                            {device.platform} {device.os_version}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {device.user_groups && device.user_groups.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-[170px]">
                            {/* Capped like Directory Users: resolved membership can
                                span many groups; the rest sit behind +N with a
                                hover list. */}
                            {device.user_groups.slice(0, 3).map((g: any) => (
                              <Badge key={g.id} variant="outline" className="text-xs max-w-full" title={`${g.name} (${getUserGroupSourceLabel(g.user_group_source)})`}>
                                <span className="truncate">
                                  {g.name} ({getUserGroupSourceLabel(g.user_group_source)})
                                </span>
                              </Badge>
                            ))}
                            {device.user_groups.length > 3 && (
                              <Badge
                                variant="secondary"
                                className="text-xs cursor-default"
                                title={device.user_groups.slice(3).map((g: any) => `${g.name} (${getUserGroupSourceLabel(g.user_group_source)})`).join(', ')}
                              >
                                +{device.user_groups.length - 3}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{device.sandbox_count}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/agents?deviceId=${device.id}&source_devices=true`, { state: { backSearch: searchParams.toString() } })
                          }}
                          className="h-6 px-2"
                        >
                          <Badge variant="secondary">{device.agent_count}</Badge>
                        </Button>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/mcps?deviceId=${device.id}&source_devices=true`, { state: { backSearch: searchParams.toString() } })
                          }}
                          className="h-6 px-2"
                        >
                          <Badge variant="secondary">{device.mcp_count}</Badge>
                        </Button>
                      </TableCell>
                      {llmEnabled && (
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              navigate(`/llm-models?deviceId=${device.id}&source_devices=true`, { state: { backSearch: searchParams.toString() } })
                            }}
                            className="h-6 px-2"
                          >
                            <Badge variant="secondary">{device.llm_model_count}</Badge>
                          </Button>
                        </TableCell>
                      )}
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/agent-issues?deviceId=${device.id}&source_devices=true`, { state: { backSearch: searchParams.toString() } })
                          }}
                          className="h-6 px-2"
                        >
                          <Badge variant="destructive">{device.agent_issues}</Badge>
                        </Button>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/mcp-issues?deviceId=${device.id}&source_devices=true`, { state: { backSearch: searchParams.toString() } })
                          }}
                          className="h-6 px-2"
                        >
                          <Badge variant="destructive">{device.mcp_issues}</Badge>
                        </Button>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(device.last_active), { addSuffix: true })}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
            </TabsContent>
            <TabsContent value="user-groups">
              <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search groups..."
                    value={groupSearchTerm}
                    onChange={(e) => setGroupSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Button onClick={openCreateGroupDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Group
                </Button>
                <Button variant="outline" onClick={() => navigate("/settings?drawer=idp")}>
                  Import Groups
                </Button>
              </div>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableTableHead column="name" currentColumn={groupSort.column} direction={groupSort.direction} onSort={handleGroupSort}>Name</SortableTableHead>
                      <SortableTableHead column="devices" currentColumn={groupSort.column} direction={groupSort.direction} onSort={handleGroupSort} className="text-center">Devices</SortableTableHead>
                      <SortableTableHead column="members" currentColumn={groupSort.column} direction={groupSort.direction} onSort={handleGroupSort} className="text-center">Users</SortableTableHead>
                      <SortableTableHead column="source" currentColumn={groupSort.column} direction={groupSort.direction} onSort={handleGroupSort}>Source</SortableTableHead>
                      <SortableTableHead column="created" currentColumn={groupSort.column} direction={groupSort.direction} onSort={handleGroupSort}>Created/Imported</SortableTableHead>
                      <SortableTableHead column="updated" currentColumn={groupSort.column} direction={groupSort.direction} onSort={handleGroupSort}>Updated</SortableTableHead>
                      <TableHead className="w-[100px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {userGroupsLoading ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-8 mx-auto" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-8 mx-auto" /></TableCell>
                          <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                        </TableRow>
                      ))
                    ) : userGroupsError ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          <div className="space-y-3">
                            <p>Couldn't load user groups. {userGroupsError}</p>
                            <Button variant="outline" size="sm" onClick={() => void fetchUserGroups()}>
                              Try again
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : sortedUserGroups.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          {groupSearchTerm ? "No groups matching your search" : "No user groups yet"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      sortedUserGroups.map((group) => (
                        <TableRow
                          key={group.id}
                          className="cursor-pointer hover:bg-muted/50"
                          // Every row filters the device table — device rows now
                          // carry RESOLVED membership, so filtering by a synced
                          // group matches the devices its members own (the old
                          // managed-row redirect existed only because this filter
                          // used to come up empty). The eye on managed rows is the
                          // path to Directory Users (who is in the group).
                          onClick={() => updateParams({ groups: group.id, tab: null })}
                        >
                          <TableCell className="font-medium">{group.name}</TableCell>
                          {/* Both kinds show a real count now: the API resolves
                              managed groups through user_group_resolved_devices
                              (active members × MDM owner email) — the devices
                              their policies actually reach. The row still
                              navigates to Directory Users, not the device
                              filter, which can't express resolved membership. */}
                          <TableCell className="text-center">{group.activeDeviceCount}</TableCell>
                          <TableCell className="text-center">
                            {/* Manual (Traceforce) groups map to devices, not identities — no member count. */}
                            {group.managed
                              ? group.memberCount
                              : <span className="text-muted-foreground">-</span>}
                          </TableCell>
                          <TableCell>
                            {getUserGroupSourceBadge(group.user_group_source)}
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {formatDistanceToNow(new Date(group.created_at), { addSuffix: true })}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {group.lastUpdatedAt
                                ? formatDistanceToNow(new Date(group.lastUpdatedAt), { addSuffix: true })
                                : "—"}
                            </span>
                          </TableCell>
                          <TableCell>
                            {/* Manual groups: edit/delete. IdP-managed groups are read-only
                                in this UI (buttons hidden; the server-side write guard is a
                                nextjs follow-up) — their action is the eye, which opens the
                                Directory Users page pre-filtered to the group. */}
                            {group.managed ? (
                              <div className="flex gap-1 justify-end">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  title="View directory users"
                                  onClick={(e) => { e.stopPropagation(); navigate(`/directory-users?group=${group.id}&source_devices=true`, { state: { backSearch: searchParams.toString() } }) }}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : group.user_group_source === 1 && (
                              <div className="flex gap-1 justify-end">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); openEditGroupDialog(group) }}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); handleDeleteClick(group) }}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
        </CardContent>
      </Card>
      </Tabs>

      {/* Recent Scan Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Scan Activity</CardTitle>
          <CardDescription>Security findings over the last 7 days</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : scanActivity.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No recent scan activity</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={scanActivity}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="displayDate" 
                  className="text-xs text-muted-foreground"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis 
                  className="text-xs text-muted-foreground"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  allowDecimals={false}
                />
                <RechartsTooltip 
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                    color: 'hsl(var(--popover-foreground))'
                  }}
                  labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="agentIssues" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))', r: 4 }}
                  activeDot={{ r: 6 }}
                  name="New Agent Issues"
                />
                <Line 
                  type="monotone" 
                  dataKey="mcpIssues" 
                  stroke="hsl(var(--destructive))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--destructive))', r: 4 }}
                  activeDot={{ r: 6 }}
                  name="New Connector Issues"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
      {/* Create/Edit Group Dialog — manual (Traceforce) groups only. IdP-managed
          groups never open it: they are read-only, and their member view is the
          Directory Users page (the eye action on the row). */}
      <Dialog open={showGroupDialog} onOpenChange={(open) => { if (!open) editSeq.current++; setShowGroupDialog(open) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingGroup ? "Edit User Group" : "Create User Group"}</DialogTitle>
            <DialogDescription>
              {editingGroup ? "Update the group name and device membership." : "Create a new user group and assign devices."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="group-name">Name</Label>
              <Input
                id="group-name"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Enter group name..."
              />
            </div>
            <div className="space-y-2">
              <Label>{editLoading ? "Devices (loading…)" : `Devices (${selectedDeviceIds.length} selected)`}</Label>
              <MultiSelect
                options={devicePickerOptions}
                selectedIds={selectedDeviceIds}
                onChange={setSelectedDeviceIds}
                placeholder={editLoading ? "Loading the group's devices…" : "Select devices..."}
                searchPlaceholder="Search devices..."
                emptyMessage="No devices found."
                label="device"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { editSeq.current++; setShowGroupDialog(false) }} disabled={saving}>Cancel</Button>
            <Button onClick={handleSaveGroup} disabled={saving || editLoading || !groupName.trim() || selectedDeviceIds.length === 0}>
              {saving ? (editingGroup ? "Updating..." : "Creating...") : (editingGroup ? "Update" : "Create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Group Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={(open) => { if (!open) { setShowDeleteDialog(false); setDeletingGroupId(null) } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User Group</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this group?
            </DialogDescription>
          </DialogHeader>
          {policyCount > 0 && (
            <div className="text-sm text-muted-foreground">
              <p>
                This group is assigned to {policyCount} {policyCount === 1 ? "policy" : "policies"}. Deleting it will remove it from those policies.
              </p>
              <a
                href="/policies"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline mt-1"
              >
                Review Policies →
              </a>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDeleteDialog(false); setDeletingGroupId(null) }} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Devices
