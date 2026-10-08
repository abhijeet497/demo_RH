import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { BarChart3, ChevronDown, FileUp, HelpCircle, Trash2 } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { useOrg } from "@/contexts/OrgContext"
import { useToast } from "@/hooks/use-toast"
import { useFeatureFlag } from "@/hooks/use-feature-flag"
import { getRiskFrameworkTypeBadge } from "@/lib/appUtils"
import { ImportFrameworkWizard } from "@/components/ImportFrameworkWizard"
import {
  deleteCustomFrameworkImport,
  isDefaultRiskFramework,
} from "@/lib/frameworkImport"

type FrameworkRow = {
  id: string
  name: string
  description: string | null
  entity_type: number | null
  created_at: string
  updated_at: string
  isCustom: boolean
  isDefault: boolean
  policyCount: number
  activePolicyCount: number
}

function canDeleteFramework(framework: FrameworkRow): boolean {
  return framework.isCustom && !framework.isDefault
}

export default function RiskFrameworks() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { activeOrgId } = useOrg()
  const { enabled: customFrameworkImportEnabled } = useFeatureFlag("custom_framework_import")
  const [frameworks, setFrameworks] = useState<FrameworkRow[]>([])
  const [loading, setLoading] = useState(true)
  const [importOpen, setImportOpen] = useState(false)
  const [selectedFrameworks, setSelectedFrameworks] = useState<string[]>([])
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const loadFrameworks = async () => {
    try {
      setLoading(true)
      const [{ data, error }, policiesResult] = await Promise.all([
        supabase
          .from("risk_framework")
          .select("id, name, description, entity_type, is_custom, created_at, updated_at")
          .eq("org_id", activeOrgId!)
          .order("updated_at", { ascending: false }),
        // A framework can be implemented by several policies (e.g. one per
        // user group) — surface how many exist per framework.
        supabase
          .from("policies_with_metadata")
          .select("framework_id, policy_status, is_default")
          .eq("org_id", activeOrgId!),
      ])

      if (error) throw error
      if (policiesResult.error) throw policiesResult.error

      const policyCounts = new Map<string, { total: number; active: number }>()
      for (const p of policiesResult.data || []) {
        if (p.is_default || !p.framework_id) continue
        const counts = policyCounts.get(p.framework_id) ?? { total: 0, active: 0 }
        counts.total += 1
        if (p.policy_status === 1) counts.active += 1
        policyCounts.set(p.framework_id, counts)
      }

      const mappedFrameworks = (data || []).map((item: any) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        entity_type: item.entity_type,
        created_at: item.created_at,
        updated_at: item.updated_at,
        isCustom: item.is_custom,
        isDefault: isDefaultRiskFramework(item.name),
        policyCount: policyCounts.get(item.id)?.total ?? 0,
        activePolicyCount: policyCounts.get(item.id)?.active ?? 0,
      }))

      setFrameworks(mappedFrameworks)
    } catch (error) {
      console.error("Error loading risk frameworks:", error)
      toast({
        title: "Error",
        description: "Failed to load risk frameworks",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadFrameworks()
  }, [toast, activeOrgId])

  const handleSelectFramework = (frameworkId: string, checked: boolean) => {
    if (checked) {
      setSelectedFrameworks([...selectedFrameworks, frameworkId])
    } else {
      setSelectedFrameworks(selectedFrameworks.filter((id) => id !== frameworkId))
    }
  }

  const selectableFrameworks = frameworks.filter(canDeleteFramework)

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedFrameworks(selectableFrameworks.map((f) => f.id))
    } else {
      setSelectedFrameworks([])
    }
  }

  const deletableFrameworks = selectedFrameworks.filter((id) => {
    const framework = frameworks.find((f) => f.id === id)
    return framework && canDeleteFramework(framework)
  })

  const handleDeleteSelected = () => {
    if (deletableFrameworks.length === 0) return
    setShowDeleteDialog(true)
  }

  const confirmDelete = async () => {
    if (!activeOrgId) return
    setShowDeleteDialog(false)

    const toDelete = frameworks.filter((f) => deletableFrameworks.includes(f.id))

    try {
      for (const framework of toDelete) {
        await deleteCustomFrameworkImport({
          orgId: activeOrgId,
          frameworkId: framework.id,
          frameworkName: framework.name,
        })
      }

      setFrameworks(frameworks.filter((f) => !deletableFrameworks.includes(f.id)))
      setSelectedFrameworks([])
      toast({
        title: "Success",
        description: `Deleted ${toDelete.length} ${toDelete.length === 1 ? "framework" : "frameworks"}`,
      })
    } catch (error: any) {
      console.error("Error deleting frameworks:", error)
      toast({
        title: "Error",
        description: error?.message || "Failed to delete frameworks",
        variant: "destructive",
      })
      await loadFrameworks()
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
          <BarChart3 className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Risk Frameworks</h1>
          <p className="text-muted-foreground">Security assessment criteria and evaluation standards</p>
        </div>
      </div>

      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="info" className="border-none">
          <div className="relative overflow-hidden rounded-xl border border-border/50 bg-gradient-to-br from-primary/5 via-background to-background backdrop-blur-sm">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-50" />
            <AccordionTrigger className="relative px-6 pt-4 pb-4 hover:no-underline [&>svg]:hidden group">
              <div className="flex items-center gap-3 w-full">
                <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                <div className="text-left">
                  <h3 className="text-foreground font-medium text-base">About Risk Frameworks</h3>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="relative px-6 pb-6 pt-2">
              <p className="text-foreground/80 leading-relaxed font-normal text-[15px]">
                Risk frameworks are NIST-compliant criteria for scoring security risk across your AI agents and connectors. Use them to build control policies and track violations per criterion. Import a PDF or Word policy to create a custom framework mapped to NIST controls.
              </p>
            </AccordionContent>
          </div>
        </AccordionItem>
      </Accordion>

      <Card>
        {/* The header only holds import/delete actions, which all require the custom-framework
            flag — render nothing when it's off so the card doesn't show an empty padded block. */}
        {customFrameworkImportEnabled && (
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                {deletableFrameworks.length > 0 && (
                  <Button variant="destructive" onClick={handleDeleteSelected}>
                    <Trash2 className="h-4 w-4" />
                    Delete Selected ({deletableFrameworks.length})
                  </Button>
                )}
                <Button onClick={() => setImportOpen(true)}>
                  <FileUp className="h-4 w-4" />
                  Import policy framework
                </Button>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground"
                      aria-label="What is importing a policy framework?"
                    >
                      <HelpCircle className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    If you have an AI governance policy written in Word or PDF, import it here and
                    we'll map it to NIST-compliant controls.
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </CardHeader>
        )}
        {/* CardContent is p-6 pt-0 (expects a header above); restore top padding when it's hidden */}
        <CardContent className={customFrameworkImportEnabled ? undefined : "pt-6"}>
          <Table>
            <TableHeader>
              <TableRow>
                {customFrameworkImportEnabled && (
                  <TableHead className="w-12">
                    <Checkbox
                      checked={
                        selectableFrameworks.length > 0 &&
                        selectedFrameworks.length === selectableFrameworks.length
                      }
                      onCheckedChange={handleSelectAll}
                      aria-label="Select all custom frameworks"
                      disabled={loading || selectableFrameworks.length === 0}
                    />
                  </TableHead>
                )}
                <TableHead>Framework</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>
                  <div className="flex items-center gap-1.5">
                    <span>Policies</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground"
                          aria-label="How frameworks map to policies"
                        >
                          <HelpCircle className="h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-xs">
                        One framework can map to multiple control policies — for example, a
                        separate policy assigned to each user group.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Last Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 3 }).map((_, index) => (
                  <TableRow key={index}>
                    {customFrameworkImportEnabled && (
                      <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                    )}
                    <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  </TableRow>
                ))
              ) : frameworks.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={customFrameworkImportEnabled ? 6 : 5}
                    className="text-center py-8 text-muted-foreground"
                  >
                    No security frameworks found
                  </TableCell>
                </TableRow>
              ) : (
                frameworks.map((framework) => (
                  <TableRow
                    key={framework.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/risk-frameworks/${framework.id}`)}
                  >
                    {customFrameworkImportEnabled && (
                      <TableCell>
                        {canDeleteFramework(framework) ? (
                          <Checkbox
                            checked={selectedFrameworks.includes(framework.id)}
                            onCheckedChange={(checked) =>
                              handleSelectFramework(framework.id, checked as boolean)
                            }
                            aria-label={`Select ${framework.name}`}
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <Tooltip>
                            {/* span wrapper: disabled elements don't emit the hover events the tooltip needs */}
                            <TooltipTrigger asChild>
                              <span
                                className="inline-flex"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Checkbox
                                  disabled
                                  className="cursor-not-allowed border-muted-foreground/50 bg-muted opacity-60"
                                  aria-label={
                                    framework.isDefault
                                      ? `${framework.name} is a default framework and cannot be deleted`
                                      : `${framework.name} cannot be deleted`
                                  }
                                />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="right">
                              {framework.isDefault
                                ? "Default frameworks cannot be deleted"
                                : "Only custom frameworks can be deleted"}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </TableCell>
                    )}
                    <TableCell>
                      <div>
                        <div className="font-medium text-foreground flex items-center gap-2">
                          {framework.name}
                          {framework.isDefault && (
                            <Badge variant="secondary">Default</Badge>
                          )}
                        </div>
                        {framework.description && (
                          <div className="text-sm text-muted-foreground">
                            {framework.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getRiskFrameworkTypeBadge(framework.entity_type)}</TableCell>
                    <TableCell>
                      {framework.policyCount > 0 ? (
                        <button
                          type="button"
                          className="text-sm font-medium text-primary hover:underline"
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/policies?framework=${framework.id}`)
                          }}
                        >
                          {framework.policyCount}{" "}
                          {framework.policyCount === 1 ? "policy" : "policies"}
                          {framework.policyCount > 0 && (
                            <span className="text-muted-foreground font-normal">
                              {" "}({framework.activePolicyCount} active)
                            </span>
                          )}
                        </button>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {new Date(framework.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {new Date(framework.updated_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ImportFrameworkWizard
        open={importOpen}
        onOpenChange={setImportOpen}
        onComplete={(frameworkId) => {
          loadFrameworks()
          navigate(`/risk-frameworks/${frameworkId}`)
        }}
      />

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Frameworks</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {deletableFrameworks.length} selected{" "}
              {deletableFrameworks.length === 1 ? "framework" : "frameworks"}? Default frameworks
              cannot be deleted. This action cannot be undone.
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
  )
}
