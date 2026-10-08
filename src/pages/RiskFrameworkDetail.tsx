import { useState, useEffect, useRef, useMemo } from "react"
import { useParams, useNavigate, useSearchParams, useLocation } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AlertTriangle, ArrowLeft, CheckCircle2, Download, ExternalLink, FileText, Shield } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { useOrg } from "@/contexts/OrgContext"
import { useToast } from "@/hooks/use-toast"
import {
  applyMappingPatch,
  downloadPolicyDocument,
  hasPolicyDocument,
  loadImportRecord,
  loadMappingCatalog,
  syncFrameworkRulesFromMappings,
  updateImportRecordMappings,
  type FrameworkImportRecord,
} from "@/lib/frameworkImport"
import { FrameworkMappingTable, mappingStatusCounts } from "@/components/FrameworkMappingTable"
import { useUrlStringFilter } from "@/hooks/use-url-filters"
import { cn } from "@/lib/utils"
import {
  getDeviceAssignmentBadge,
  getPolicyStatusBadge,
  SENSITIVE_DATA_DETECTION_DOCS_URL,
  SENSITIVE_DATA_HANDLING_RISK_RULE_TYPE,
  CONNECTOR_RISK_CONTAINMENT_RULE_TYPE,
  RISKY_ACTION_DETECTION_DOCS_URL,
} from "@/lib/appUtils"
import type { MapPolicyCatalogRule, MapPolicyMapping } from "@/integrations/traceforce/types"

export default function RiskFrameworkDetail() {
  const navigate = useNavigate()
  const location = useLocation()
  const { toast } = useToast()
  const { activeOrgId } = useOrg()
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  // Active tab lives in the URL so it survives Back from a policy detail. The
  // default tab depends on the framework type, resolved below once loaded.
  const [tabParam, setTabParam] = useUrlStringFilter("tab")
  const [riskFramework, setRiskFramework] = useState<any>(null)
  const [frameworkInfo, setFrameworkInfo] = useState<any>(null)
  const [frameworkLoading, setFrameworkLoading] = useState(true)
  const [frameworkDetailsLoading, setFrameworkDetailsLoading] = useState(true)
  const [groupByNist, setGroupByNist] = useState(true)
  const highlightedRowRef = useRef<HTMLTableRowElement>(null)
  const [importRecord, setImportRecord] = useState<FrameworkImportRecord | null>(null)
  const [importRecordLoading, setImportRecordLoading] = useState(true)
  const [mappingCatalog, setMappingCatalog] = useState<MapPolicyCatalogRule[]>([])
  const [hasSourceDocument, setHasSourceDocument] = useState(false)
  const [implementingPolicies, setImplementingPolicies] = useState<any[]>([])
  const [policiesLoading, setPoliciesLoading] = useState(true)

  // A framework is implemented by zero or more policies (often one per user group).
  useEffect(() => {
    if (!id || !activeOrgId) return
    let cancelled = false
    setPoliciesLoading(true)
    supabase
      .from("policies_with_metadata")
      .select(`
        id,
        name,
        description,
        policy_status,
        employee_assignment_type,
        updated_at,
        is_default,
        risk_framework!inner ( entity_type ),
        policy_user_groups(count)
      `)
      .eq("org_id", activeOrgId)
      .eq("framework_id", id)
      .order("updated_at", { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.error("Failed to load policies for framework:", error)
          setImplementingPolicies([])
        } else {
          setImplementingPolicies(
            (data || [])
              .filter((p: any) => !p.is_default)
              .map((p: any) => ({
                id: p.id,
                name: p.name,
                description: p.description,
                policy_status: p.policy_status,
                employee_assignment_type: p.employee_assignment_type,
                entity_type: p.risk_framework?.entity_type ?? null,
                user_group_count: p.policy_user_groups?.[0]?.count ?? null,
                updated_at: p.updated_at,
              })),
          )
        }
        setPoliciesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id, activeOrgId])

  useEffect(() => {
    if (!id || !activeOrgId) return
    let cancelled = false
    loadFrameworkInfo()
    setImportRecord(null)
    setImportRecordLoading(true)
    loadImportRecord(id)
      .then((record) => {
        if (!cancelled) {
          setImportRecord(record)
          setImportRecordLoading(false)
        }
      })
      .catch((error) => {
        console.error("Failed to load framework import mappings:", error)
        if (!cancelled) {
          setImportRecord(null)
          setImportRecordLoading(false)
          toast({
            title: "Error",
            description: "Failed to load source mapping details",
            variant: "destructive",
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [id, toast, activeOrgId])

  useEffect(() => {
    if (!id || !activeOrgId || !importRecord) {
      setHasSourceDocument(false)
      return
    }
    let cancelled = false
    hasPolicyDocument(activeOrgId, id, importRecord.sourceFileName).then((exists) => {
      if (!cancelled) setHasSourceDocument(exists)
    })
    return () => {
      cancelled = true
    }
  }, [id, activeOrgId, importRecord?.sourceFileName])

  const handleDownloadSourceDocument = async () => {
    if (!id || !activeOrgId || !importRecord) return
    const blob = await downloadPolicyDocument(activeOrgId, id, importRecord.sourceFileName)
    if (!blob) {
      setHasSourceDocument(false)
      toast({
        title: "Document unavailable",
        description: "The source document could not be downloaded from storage.",
        variant: "destructive",
      })
      return
    }
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = importRecord.sourceFileName
    a.click()
    URL.revokeObjectURL(url)
  }

  const summaryCounts = useMemo(
    () => mappingStatusCounts(importRecord?.mappings ?? []),
    [importRecord],
  )

  useEffect(() => {
    if (!importRecord || !activeOrgId) {
      setMappingCatalog([])
      return
    }
    let cancelled = false
    loadMappingCatalog(activeOrgId, importRecord.entityType)
      .then((catalog) => {
        if (!cancelled) setMappingCatalog(catalog)
      })
      .catch((error) => {
        console.error("Failed to load mapping catalog:", error)
        if (!cancelled) setMappingCatalog([])
      })
    return () => {
      cancelled = true
    }
  }, [importRecord?.entityType, importRecord?.frameworkId, activeOrgId])

  const coverage = useMemo(() => {
    if (!importRecord) return null
    const catalogRules = importRecord.catalogRules ?? []
    const mappedRuleIds = new Set(
      importRecord.mappings
        .filter((m) => m.risk_rule_id && m.status !== "excluded" && m.status !== "unmapped")
        .map((m) => m.risk_rule_id as string),
    )
    const total = catalogRules.length || mappedRuleIds.size
    return {
      mapped: mappedRuleIds.size,
      total,
      pct: total ? Math.round((mappedRuleIds.size / total) * 100) : 0,
      uncovered: catalogRules.filter((r) => !mappedRuleIds.has(r.id)),
      gaps: importRecord.mappings.filter((m) => m.status === "unmapped" || m.status === "needs_review"),
    }
  }, [importRecord])

  const handleUpdateMapping = async (mappingId: string, patch: Partial<MapPolicyMapping>) => {
    if (!importRecord || !activeOrgId || !id) return

    const nextMappings = importRecord.mappings.map((m) =>
      m.id === mappingId ? applyMappingPatch(m, patch, mappingCatalog) : m,
    )

    try {
      const saved = await updateImportRecordMappings(importRecord, nextMappings)
      setImportRecord(saved)
      await syncFrameworkRulesFromMappings({
        orgId: activeOrgId,
        frameworkId: id,
        policyId: saved.policyId,
        mappings: nextMappings,
      })
      if (frameworkInfo?.id) {
        await loadRiskFramework()
      }
    } catch (error) {
      console.error("Failed to save or sync framework mapping:", error)
      toast({
        title: "Error",
        description: "Failed to save or sync the framework mapping.",
        variant: "destructive",
      })
    }
  }

  useEffect(() => {
    if (frameworkInfo?.id) {
      loadRiskFramework()
    }
  }, [frameworkInfo?.id, groupByNist, toast])

  const loadFrameworkInfo = async () => {
    if (!id) return
    
    try {
      const { data, error } = await supabase
        .from('risk_framework' as any)
        .select('id, name, description, entity_type, is_custom, created_at, updated_at')
        .eq('org_id', activeOrgId!)
        .eq('id', id)
        .maybeSingle()

      if (error) throw error
      
      if (data) {
        setFrameworkInfo({ 
          id: (data as any).id, 
          name: (data as any).name, 
          description: (data as any).description,
          entity_type: (data as any).entity_type,
          is_custom: (data as any).is_custom,
          created_at: (data as any).created_at,
          updated_at: (data as any).updated_at
        })
      }
    } catch (error) {
      console.error('Error loading framework info:', error)
      toast({
        title: "Error",
        description: "Failed to load framework information",
        variant: "destructive",
      })
    } finally {
      setFrameworkLoading(false)
    }
  }

  const loadRiskFramework = async () => {
    if (!frameworkInfo?.id) return
    try {
      setFrameworkDetailsLoading(true)
      const { data, error } = await supabase
        .from('risk_framework_rules')
        .select(`
          id,
          risk_rules!inner (
            id,
            name,
            description,
            scoring_criteria,
            implementation_status,
            display_order,
            risk_rule_type,
            category_id,
            default_category:risk_categories!risk_rules_category_id_fkey (
              name,
              display_order
            ),
            risk_rule_control_mappings (
              control_mapping,
              category_id,
              nist_category:risk_categories (
                name,
                display_order
              )
            )
          )
        `)
        .eq('framework_id', frameworkInfo?.id)
        .eq('risk_rules.implementation_status', 1)

      if (error) throw error
      
      const mappedFramework = (data || [])
        .map((item: any) => {
          // Get default category from direct relationship
          const defaultCategory = item.risk_rules.default_category
          
          // Get NIST mapping
          const nistMapping = item.risk_rules.risk_rule_control_mappings?.[0]
          const nistCategory = nistMapping?.nist_category
          
          return {
            id: item.id,
            rule_id: item.risk_rules.id,
            rule_name: item.risk_rules.name,
            default_category_name: defaultCategory?.name || 'Uncategorized',
            default_category_display_order: defaultCategory?.display_order || 999,
            nist_category_name: nistCategory?.name || 'Uncategorized',
            nist_category_display_order: nistCategory?.display_order || 999,
            nist_control_mapping: nistMapping?.control_mapping || null,
            rule_display_order: item.risk_rules.display_order,
            risk_rule_type: item.risk_rules.risk_rule_type,
            description: item.risk_rules.description,
            scoring_criteria: item.risk_rules.scoring_criteria
          }
        })
        .sort((a, b) => {
          const displayOrder1 = groupByNist ? a.nist_category_display_order : a.default_category_display_order
          const displayOrder2 = groupByNist ? b.nist_category_display_order : b.default_category_display_order
          if (displayOrder1 !== displayOrder2) {
            return displayOrder1 - displayOrder2
          }
          return a.rule_display_order - b.rule_display_order
        })
      
      // Group by selected category type
      const groupedFramework = mappedFramework.reduce((acc: any, item: any) => {
        const categoryKey = groupByNist ? item.nist_category_name : item.default_category_name
        if (!acc[categoryKey]) {
          acc[categoryKey] = []
        }
        acc[categoryKey].push(item)
        return acc
      }, {})
      
      setRiskFramework(groupedFramework)
    } catch (error) {
      console.error('Error loading risk framework:', error)
      toast({
        title: "Error",
        description: "Failed to load risk framework",
        variant: "destructive",
      })
    } finally {
      setFrameworkDetailsLoading(false)
    }
  }

  // Auto-scroll to highlighted risk attribute from issues page
  useEffect(() => {
    const riskAttributeId = searchParams.get('risk_attribute')
    if (riskAttributeId && highlightedRowRef.current && !frameworkDetailsLoading) {
      setTimeout(() => {
        highlightedRowRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        })
      }, 100)
    }
  }, [searchParams, frameworkDetailsLoading])

  const handleBackNavigation = () => {
    const sourceAgentIssues = searchParams.get('source_agent_issues')
    const sourceMcpIssues = searchParams.get('source_mcp_issues')
    const sourcePolicies = searchParams.get('source_policies')
    const sourcePolicyId = searchParams.get('source_policy')
    
    // Preserve filters when going back
    const backParams = new URLSearchParams()
    const agent = searchParams.get('agent')
    const mcp = searchParams.get('mcp')
    const status = searchParams.get('status')
    
    if (agent) backParams.set('agent', agent)
    if (mcp) backParams.set('mcp', mcp)
    if (status) backParams.set('status', status)
    
    const queryString = backParams.toString()
    const suffix = queryString ? `?${queryString}` : ''
    // Full query string of the page that opened this one — preferred over the
    // rebuilt subset above so every filter survives the round trip.
    const backSearch = (location.state?.backSearch as string) || ''

    if (sourceAgentIssues) {
      navigate(`/agent-issues${backSearch ? `?${backSearch}` : suffix}`)
    } else if (sourceMcpIssues) {
      navigate(`/mcp-issues${backSearch ? `?${backSearch}` : suffix}`)
    } else if (sourcePolicyId) {
      navigate(`/policies/${sourcePolicyId}`)
    } else if (sourcePolicies) {
      navigate(`/policies${backSearch ? `?${backSearch}` : ''}`)
    } else {
      navigate('/risk-frameworks')
    }
  }

  const getBackButtonText = () => {
    const sourceAgentIssues = searchParams.get('source_agent_issues')
    const sourceMcpIssues = searchParams.get('source_mcp_issues')
    const sourcePolicies = searchParams.get('source_policies')
    const sourcePolicyId = searchParams.get('source_policy')
    
    if (sourceAgentIssues) return 'Back to Agent Issues'
    if (sourceMcpIssues) return 'Back to Connector Issues'
    if (sourcePolicyId) return 'Back to Policy'
    if (sourcePolicies) return 'Back to Policies'
    return 'Back to Frameworks'
  }

  const isCustomFramework = frameworkInfo?.is_custom === true
  const defaultTab = isCustomFramework ? "mapping" : "criteria"
  // Ignore stale/invalid tab params (e.g. ?tab=mapping on a non-custom framework).
  const activeTab =
    tabParam === "policies" || tabParam === "criteria" || (tabParam === "mapping" && isCustomFramework)
      ? tabParam
      : defaultTab

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          onClick={handleBackNavigation}
        >
          <ArrowLeft className="h-4 w-4" />
          {getBackButtonText()}
        </Button>
        <div>
          {frameworkLoading ? (
            <>
              <Skeleton className="h-8 w-64 mb-2" />
              <Skeleton className="h-4 w-96" />
            </>
          ) : (
            <>
              <h1 className="text-3xl font-bold text-foreground">{frameworkInfo?.name}</h1>
              <p className="text-muted-foreground">{frameworkInfo?.description || "Risk assessment framework"}</p>
              {frameworkInfo?.created_at && (
                <p className="text-xs text-muted-foreground mt-1">
                  Created {new Date(frameworkInfo.created_at).toLocaleDateString()} · Updated{" "}
                  {new Date(frameworkInfo.updated_at).toLocaleDateString()}
                </p>
              )}
            </>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setTabParam(v === defaultTab ? "" : v)}
          >
            <TabsList className="mb-4">
              {isCustomFramework && <TabsTrigger value="mapping">Mapped policies</TabsTrigger>}
              <TabsTrigger value="criteria">Risk evaluation criteria</TabsTrigger>
              <TabsTrigger value="policies">
                Policies
                {implementingPolicies.length > 0 && (
                  <Badge variant="secondary" className="ml-2 h-5 min-w-5 px-1.5 text-xs">
                    {implementingPolicies.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {isCustomFramework && (
              <TabsContent value="mapping" className="mt-0 space-y-4">
                {importRecordLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-64 w-full" />
                  </div>
                ) : !importRecord ? (
                  <div className="rounded-lg border border-dashed p-8 text-center">
                    <FileText className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                    <p className="font-medium text-foreground">Mapping details unavailable</p>
<p className="mt-1 text-sm text-muted-foreground">
  This custom framework does not have source mapping details stored in the database.
</p>
                  </div>
                ) : (
                  <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Controls in Document
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{summaryCounts.total}</div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4" />
                        Mapped
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{summaryCounts.mapped}</div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Needs Review / Unmapped
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div
                        className={cn(
                          "text-2xl font-bold",
                          summaryCounts.needsReview + summaryCounts.unmapped > 0
                            ? "text-warning"
                            : "text-muted-foreground",
                        )}
                      >
                        {summaryCounts.needsReview + summaryCounts.unmapped}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        Default Rule Coverage
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{coverage ? `${coverage.pct}%` : "—"}</div>
                      {coverage && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {coverage.mapped} of {coverage.total} rules
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-2">
                    Source:{" "}
                    <span className="font-mono text-foreground">{importRecord.sourceFileName}</span>
                    {hasSourceDocument && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 px-2"
                        onClick={handleDownloadSourceDocument}
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download
                      </Button>
                    )}
                  </span>
                  {importRecord.policyId && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/policies/${importRecord.policyId}`)}
                    >
                      Open draft policy
                    </Button>
                  )}
                </div>
                <FrameworkMappingTable
                  mappings={importRecord.mappings}
                  catalog={mappingCatalog}
                  showFilters
                  filterLayout="collapsible"
                  defaultFilter="all"
                  onUpdateMapping={handleUpdateMapping}
                />
                  </>
                )}
              </TabsContent>
            )}

            <TabsContent value="criteria" className="mt-0">
          <p className="text-sm text-muted-foreground mb-4">
            The scoring criteria below define how risk scores are calculated across your users.
          </p>
          <div className="flex items-center gap-3 mb-6 pb-4 border-b">
            <Switch
              id="group-toggle"
              checked={groupByNist}
              onCheckedChange={setGroupByNist}
            />
            <Label htmlFor="group-toggle" className="cursor-pointer">
              Group by {groupByNist ? 'NIST Category' : 'Traceforce Default'}
            </Label>
          </div>
          {frameworkDetailsLoading ? (
            <div className="space-y-8">
              {Array.from({ length: 3 }).map((_, categoryIndex) => (
                <div key={categoryIndex} className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b">
                    <Skeleton className="h-6 w-32" />
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[200px]">Risk evaluation criterion</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Scoring Criteria</TableHead>
                        <TableHead className="w-[150px]">NIST Control</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Array.from({ length: 4 }).map((_, rowIndex) => (
                        <TableRow key={rowIndex}>
                          <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-64" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-8">
              {riskFramework && Object.entries(riskFramework).map(([category, items]) => (
                <div key={category} className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b">
                    <Badge className="whitespace-nowrap">
                      {category}
                    </Badge>
                  </div>
                  
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[200px]">Risk evaluation criterion</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Scoring Criteria</TableHead>
                        <TableHead className="w-[150px]">NIST Control</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(items as any[]).map((item, index) => {
                        const isHighlighted = searchParams.get('risk_attribute') === item.rule_id
                        return (
                          <TableRow 
                            key={index}
                            ref={isHighlighted ? highlightedRowRef : null}
                            className={isHighlighted ? "bg-primary/10 border-l-4 border-l-primary" : ""}
                          >
                            <TableCell className="font-medium">
                              <div>{item.rule_name}</div>
                              {item.risk_rule_type === SENSITIVE_DATA_HANDLING_RISK_RULE_TYPE && (
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
                              {item.risk_rule_type === CONNECTOR_RISK_CONTAINMENT_RULE_TYPE && (
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
                            <TableCell>{item.description}</TableCell>
                            <TableCell>{item.scoring_criteria}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {item.nist_control_mapping || '-'}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </div>
          )}
            </TabsContent>

            <TabsContent value="policies" className="mt-0 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  Policies that implement this framework. A framework can be implemented by
                  multiple policies — for example, one per user group.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/policies?framework=${id}`)}
                >
                  View in Policies
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Policy</TableHead>
                    <TableHead>Assigned Devices</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {policiesLoading ? (
                    Array.from({ length: 2 }).map((_, index) => (
                      <TableRow key={index}>
                        <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      </TableRow>
                    ))
                  ) : implementingPolicies.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        No policies implement this framework yet. Create one from the Policies page.
                      </TableCell>
                    </TableRow>
                  ) : (
                    implementingPolicies.map((policy) => (
                      <TableRow
                        key={policy.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/policies/${policy.id}`)}
                      >
                        <TableCell>
                          <div className="font-medium text-foreground">{policy.name}</div>
                          {policy.description && (
                            <div className="text-sm text-muted-foreground line-clamp-1">
                              {policy.description}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {getDeviceAssignmentBadge(
                            policy.employee_assignment_type,
                            policy.entity_type,
                            policy.user_group_count,
                          )}
                        </TableCell>
                        <TableCell>{getPolicyStatusBadge(policy.policy_status)}</TableCell>
                        <TableCell className="font-mono text-sm text-muted-foreground">
                          {new Date(policy.updated_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
