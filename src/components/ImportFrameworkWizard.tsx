import { useEffect, useMemo, useState } from "react"
import { FileUp, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { useOrg } from "@/contexts/OrgContext"
import { useAuth } from "@/contexts/AuthContext"
import type { MapPolicyCatalogRule, MapPolicyMapping, MapPolicyResponse } from "@/integrations/traceforce/types"
import {
  applyMappingPatch,
  isSupportedPolicyFile,
  MAP_POLICY_MAX_FILE_BYTES,
  mapPolicyViaApi,
  saveCustomFrameworkImport,
} from "@/lib/frameworkImport"
import {
  FrameworkMappingTable,
  mappingStatusCounts,
} from "@/components/FrameworkMappingTable"
import { cn } from "@/lib/utils"

type Step = 1 | 2 | 3

interface ImportFrameworkWizardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: (frameworkId: string, policyId: string) => void
}

export function ImportFrameworkWizard({ open, onOpenChange, onComplete }: ImportFrameworkWizardProps) {
  const { toast } = useToast()
  const { activeOrgId } = useOrg()
  const { session } = useAuth()
  const [step, setStep] = useState<Step>(1)
  const [saving, setSaving] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)

  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [entityType, setEntityType] = useState<"1" | "2">("1")
  const [result, setResult] = useState<MapPolicyResponse | null>(null)
  const [mappings, setMappings] = useState<MapPolicyMapping[]>([])

  const reset = () => {
    setStep(1)
    setSaving(false)
    setAnalyzing(false)
    setFile(null)
    setName("")
    setDescription("")
    setEntityType("1")
    setResult(null)
    setMappings([])
  }

  useEffect(() => {
    if (!open) reset()
  }, [open])

  const catalog: MapPolicyCatalogRule[] = result?.catalog ?? []
  const counts = useMemo(() => mappingStatusCounts(mappings), [mappings])
  const mappedCount = counts.mapped + counts.needsReview
  const gapCount = counts.unmapped + counts.needsReview

  const handleFile = (f: File | null) => {
    if (!f) {
      setFile(null)
      return
    }
    if (!isSupportedPolicyFile(f)) {
      toast({
        title: "Invalid file",
        description: "Please upload a PDF or Word (.docx) document.",
        variant: "destructive",
      })
      return
    }
    if (f.size > MAP_POLICY_MAX_FILE_BYTES) {
      toast({
        title: "File too large",
        description: "Document must be under 5 MB.",
        variant: "destructive",
      })
      return
    }
    setFile(f)
    setResult(null)
    setMappings([])
    if (!name.trim()) {
      setName(f.name.replace(/\.(pdf|docx)$/i, "").replace(/[_-]+/g, " ").trim())
    }
  }

  const analyze = async () => {
    if (!file || !name.trim()) return
    const token = session?.access_token
    if (!token) {
      toast({ title: "Not signed in", description: "Sign in again to import a policy.", variant: "destructive" })
      return
    }

    setAnalyzing(true)
    try {
      const data = await mapPolicyViaApi(token, file, Number(entityType) as 1 | 2)
      setResult(data)
      setMappings(data.mappings)
      setStep(2)
    } catch (e: any) {
      console.error(e)
      toast({
        title: "Import failed",
        description: e?.message || "Could not map this document.",
        variant: "destructive",
      })
    } finally {
      setAnalyzing(false)
    }
  }

  const updateMapping = (id: string, patch: Partial<MapPolicyMapping>) => {
    setMappings((prev) =>
      prev.map((m) => (m.id === id ? applyMappingPatch(m, patch, catalog) : m)),
    )
  }

  const handleSave = async () => {
    if (!activeOrgId || !file || !result) return
    setSaving(true)
    try {
      const saved = await saveCustomFrameworkImport({
        orgId: activeOrgId,
        name,
        description,
        entityType: Number(entityType) as 1 | 2,
        sourceFile: file,
        mappings,
        catalogRules: catalog.map((r) => ({ id: r.risk_rule_id, name: r.name })),
      })
      toast({
        title: "Framework imported",
        description: `Created custom framework and draft policy (${counts.mapped} mapped, ${gapCount} gaps).`,
      })
      onOpenChange(false)
      onComplete(saved.frameworkId, saved.policyId)
    } catch (e: any) {
      console.error(e)
      toast({
        title: "Import failed",
        description: e?.message || "Could not create framework or draft policy.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-h-[90vh] flex flex-col min-w-0 overflow-hidden",
          step === 2 ? "max-w-4xl" : "max-w-3xl",
        )}
      >
        <DialogHeader>
          <DialogTitle>Import custom risk framework</DialogTitle>
          <DialogDescription>
            Upload a PDF or Word (.docx) policy. Traceforce maps it to the default framework and
            desired states, then you can create a draft policy.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 text-xs text-muted-foreground mb-2 shrink-0">
          {[1, 2, 3].map((s) => (
            <span
              key={s}
              className={
                step === s
                  ? "font-medium text-foreground"
                  : step > s
                    ? "text-foreground/70"
                    : undefined
              }
            >
              {s}. {s === 1 ? "Upload" : s === 2 ? "Mappings" : "Confirm"}
              {s < 3 ? " →" : ""}
            </span>
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-4 py-2 overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor="fw-policy">Policy document</Label>
              <Input
                id="fw-policy"
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              />
              {file && (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <FileUp className="h-4 w-4" />
                  {file.name} ({Math.round(file.size / 1024)} KB)
                </p>
              )}
              <p className="text-xs text-muted-foreground">PDF or .docx, max 5 MB.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fw-name">Framework name</Label>
              <Input
                id="fw-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Acme AI Security Standard"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fw-desc">Description (optional)</Label>
              <Textarea
                id="fw-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Entity type</Label>
              <Select value={entityType} onValueChange={(v) => setEntityType(v as "1" | "2")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">AI Agents</SelectItem>
                  <SelectItem value="2">Connectors</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="min-h-0 min-w-0 flex-1 flex flex-col overflow-hidden">
            <FrameworkMappingTable
              key={result?.source_file_name ?? "mappings"}
              className="min-h-0 min-w-0 flex-1"
              mappings={mappings}
              catalog={catalog}
              showFilters
              defaultFilter="all"
              onUpdateMapping={updateMapping}
            />
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3 py-2 text-sm overflow-y-auto">
            <p>
              <span className="font-medium">{name}</span> ·{" "}
              {entityType === "1" ? "AI Agents" : "Connectors"} · source{" "}
              <span className="font-mono text-xs">{file?.name}</span>
            </p>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>
                Create custom framework with <span className="text-foreground">{mappedCount}</span>{" "}
                mapped default rules
              </li>
              <li>
                Keep desired state on the mapping (
                <span className="text-foreground">{gapCount}</span> gaps remain)
              </li>
              <li>
                Auto-create an <span className="text-foreground">inactive draft policy</span> seeded
                from mapped desired states
              </li>
            </ul>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0 shrink-0">
          {step > 1 && (
            <Button type="button" variant="outline" onClick={() => setStep((s) => (s - 1) as Step)} disabled={saving}>
              Back
            </Button>
          )}
          {step === 1 && (
            <Button type="button" onClick={analyze} disabled={!file || !name.trim() || analyzing}>
              {analyzing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {analyzing ? "Analyzing…" : "Analyze"}
            </Button>
          )}
          {step === 2 && (
            <Button type="button" onClick={() => setStep(3)}>
              Review & create
            </Button>
          )}
          {step === 3 && (
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create framework & draft policy
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
