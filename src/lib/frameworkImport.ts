import { supabase } from "@/integrations/supabase/client"
import { traceforcApi } from "@/integrations/traceforce/client"
import type { Json } from "@/integrations/supabase/types"
import type {
  MapPolicyCatalogRule,
  MapPolicyMapping,
  MapPolicyResponse,
} from "@/integrations/traceforce/types"

/** Max upload size — must match API `MAX_FILE_BYTES` on map-policy. */
export const MAP_POLICY_MAX_FILE_BYTES = 5 * 1024 * 1024

export function isSupportedPolicyFile(file: File): boolean {
  const name = file.name.toLowerCase()
  return (
    name.endsWith(".pdf") ||
    name.endsWith(".docx") ||
    file.type === "application/pdf" ||
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  )
}

/** Persisted after save so the framework detail page can show source mappings. */
export type FrameworkImportRecord = {
  frameworkId: string
  orgId: string
  entityType: 1 | 2
  sourceFileName: string
  frameworkName: string
  description: string
  mappings: MapPolicyMapping[]
  /** Catalog rules at import time (for coverage %). */
  catalogRules: { id: string; name: string }[]
  policyId: string | null
  createdAt: string
}

/**
 * Source documents live in the private `policy-documents` Supabase Storage
 * bucket at `{orgId}/{frameworkId}/{fileName}` (RLS scopes access to the
 * caller's orgs), so the framework detail page can offer a download.
 */
const POLICY_DOCS_BUCKET = "policy-documents"

/** Keep storage keys to characters Supabase Storage always accepts. */
function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_")
}

function policyDocumentPath(orgId: string, frameworkId: string, fileName: string): string {
  return `${orgId}/${frameworkId}/${sanitizeFileName(fileName)}`
}

export async function savePolicyDocument(
  orgId: string,
  frameworkId: string,
  file: File,
): Promise<void> {
  const { error } = await supabase.storage
    .from(POLICY_DOCS_BUCKET)
    .upload(policyDocumentPath(orgId, frameworkId, file.name), file, {
      upsert: true,
      contentType: file.type || undefined,
    })
  if (error) throw error
}

export async function hasPolicyDocument(
  orgId: string,
  frameworkId: string,
  fileName: string,
): Promise<boolean> {
  const { data, error } = await supabase.storage
    .from(POLICY_DOCS_BUCKET)
    .list(`${orgId}/${frameworkId}`)
  if (error) return false
  const key = sanitizeFileName(fileName)
  return (data ?? []).some((f) => f.name === key)
}

export async function downloadPolicyDocument(
  orgId: string,
  frameworkId: string,
  fileName: string,
): Promise<Blob | null> {
  const { data, error } = await supabase.storage
    .from(POLICY_DOCS_BUCKET)
    .download(policyDocumentPath(orgId, frameworkId, fileName))
  if (error) return null
  return data
}

export async function removePolicyDocument(orgId: string, frameworkId: string): Promise<void> {
  const folder = `${orgId}/${frameworkId}`
  const { data, error } = await supabase.storage.from(POLICY_DOCS_BUCKET).list(folder)
  if (error || !data?.length) return
  await supabase.storage
    .from(POLICY_DOCS_BUCKET)
    .remove(data.map((f) => `${folder}/${f.name}`))
}

export async function loadImportRecord(
  frameworkId: string,
): Promise<FrameworkImportRecord | null> {
  const { data: importData, error: importError } = await supabase
    .from("risk_framework_imports")
    .select("framework_id, policy_id, source_file_name, mappings, catalog_rules, created_at")
    .eq("framework_id", frameworkId)
    .maybeSingle()

  if (importError) throw importError
  if (!importData) return null

  const { data: framework, error: frameworkError } = await supabase
    .from("risk_framework")
    .select("org_id, entity_type, name, description")
    .eq("id", frameworkId)
    .single()

  if (frameworkError) throw frameworkError

  return {
    frameworkId: importData.framework_id,
    orgId: framework.org_id,
    entityType: framework.entity_type === 2 ? 2 : 1,
    sourceFileName: importData.source_file_name,
    frameworkName: framework.name,
    description: framework.description ?? "",
    mappings: Array.isArray(importData.mappings)
      ? (importData.mappings as unknown as MapPolicyMapping[])
      : [],
    catalogRules: Array.isArray(importData.catalog_rules)
      ? (importData.catalog_rules as unknown as { id: string; name: string }[])
      : [],
    policyId: importData.policy_id,
    createdAt: importData.created_at,
  }
}

export async function saveImportRecord(record: FrameworkImportRecord): Promise<void> {
  const { error } = await supabase.from("risk_framework_imports").upsert(
    {
      framework_id: record.frameworkId,
      policy_id: record.policyId,
      source_file_name: record.sourceFileName,
      mappings: record.mappings as unknown as Json,
      catalog_rules: record.catalogRules as unknown as Json,
    },
    { onConflict: "framework_id" },
  )
  if (error) throw error
}

export async function updateImportRecordMappings(
  record: FrameworkImportRecord,
  mappings: MapPolicyMapping[],
): Promise<FrameworkImportRecord> {
  const { error } = await supabase
    .from("risk_framework_imports")
    .update({ mappings: mappings as unknown as Json })
    .eq("framework_id", record.frameworkId)

  if (error) throw error
  const next = { ...record, mappings }
  return next
}

/** Apply rule/desired-state edits (used by wizard + source mapping tab). */
export function applyMappingPatch(
  mapping: MapPolicyMapping,
  patch: Partial<MapPolicyMapping>,
  catalog: MapPolicyCatalogRule[],
): MapPolicyMapping {
  const next = { ...mapping, ...patch }
  if (patch.risk_rule_id !== undefined) {
    const rule = catalog.find((r) => r.risk_rule_id === patch.risk_rule_id)
    next.risk_rule_name = rule?.name ?? null
    if (patch.issue_type_id === undefined) {
      const first = rule?.issue_types[0]
      next.issue_type_id = first?.id ?? null
      next.expected_value = first?.expected_value ?? null
    }
    if (mapping.status === "excluded" && patch.status === undefined) {
      next.status = "excluded"
    } else {
      next.status = patch.risk_rule_id ? "mapped" : "unmapped"
    }
    next.confidence = patch.risk_rule_id ? Math.max(mapping.confidence, 0.5) : 0
  }
  if (patch.issue_type_id !== undefined) {
    const rule = catalog.find((r) => r.risk_rule_id === next.risk_rule_id)
    const it = rule?.issue_types.find((x) => x.id === patch.issue_type_id)
    next.expected_value = it?.expected_value ?? null
    if (next.risk_rule_id && next.status !== "excluded") next.status = "mapped"
  }
  return next
}

/** Load default Agent/MCP framework rules + desired states for mapping dropdowns. */
export async function loadMappingCatalog(
  orgId: string,
  entityType: 1 | 2,
): Promise<MapPolicyCatalogRule[]> {
  const defaultName =
    entityType === 1 ? "Default Agent Risk Framework" : "Default Connector Risk Framework"

  const { data: framework, error: fwErr } = await supabase
    .from("risk_framework")
    .select("id")
    .eq("org_id", orgId)
    .eq("name", defaultName)
    .maybeSingle()
  if (fwErr) throw fwErr
  if (!framework) return []

  const { data: ruleRows, error: rulesErr } = await supabase
    .from("risk_framework_rules")
    .select(`
      risk_rule_id,
      risk_rules!inner (
        id,
        name,
        description,
        implementation_status
      )
    `)
    .eq("framework_id", framework.id)
    .eq("risk_rules.implementation_status", 1)
  if (rulesErr) throw rulesErr

  const ruleIds = (ruleRows || [])
    .map((r: any) => r.risk_rules?.id as string | undefined)
    .filter(Boolean) as string[]
  if (ruleIds.length === 0) return []

  const { data: issueTypes, error: itErr } = await supabase
    .from("issue_types")
    .select("id, risk_rule_id, expected_value, trigger_score")
    .in("risk_rule_id", ruleIds)
    .not("expected_value", "is", null)
    .order("trigger_score", { ascending: true })
  if (itErr) throw itErr

  const byRule = new Map<string, MapPolicyCatalogRule["issue_types"]>()
  for (const it of issueTypes || []) {
    const list = byRule.get(it.risk_rule_id) || []
    if (!list.some((x) => x.expected_value === it.expected_value)) {
      list.push({
        id: it.id,
        expected_value: it.expected_value || "",
        trigger_score: it.trigger_score,
      })
    }
    byRule.set(it.risk_rule_id, list)
  }

  return (ruleRows || []).map((row: any) => ({
    risk_rule_id: row.risk_rules.id as string,
    name: row.risk_rules.name as string,
    description: (row.risk_rules.description as string | null) ?? null,
    issue_types: byRule.get(row.risk_rules.id) || [],
  }))
}

/** Risk rules that should be on the framework given current mapping statuses. */
export function includedRiskRuleIds(mappings: MapPolicyMapping[]): string[] {
  const byRule = new Map<string, MapPolicyMapping>()
  for (const m of mappings) {
    if (
      !m.risk_rule_id ||
      m.status === "excluded" ||
      m.status === "unmapped" ||
      (m.status !== "mapped" && m.status !== "needs_review")
    ) {
      continue
    }
    const prev = byRule.get(m.risk_rule_id)
    if (!prev || m.confidence > prev.confidence) byRule.set(m.risk_rule_id, m)
  }
  return [...byRule.keys()]
}

/**
 * Keep risk_framework_rules (and draft policy_controls) aligned with included mappings.
 */
export async function syncFrameworkRulesFromMappings(args: {
  orgId: string
  frameworkId: string
  policyId: string | null
  mappings: MapPolicyMapping[]
}): Promise<void> {
  const desired = new Set(includedRiskRuleIds(args.mappings))

  const { data: existing, error: listErr } = await supabase
    .from("risk_framework_rules")
    .select("id, risk_rule_id")
    .eq("framework_id", args.frameworkId)
    .eq("org_id", args.orgId)
  if (listErr) throw listErr

  const current = existing || []
  const toRemove = current.filter((r) => !desired.has(r.risk_rule_id))
  const currentRuleIds = new Set(current.map((r) => r.risk_rule_id))
  const toAdd = [...desired].filter((id) => !currentRuleIds.has(id))

  if (toRemove.length > 0) {
    const rfrIds = toRemove.map((r) => r.id)
    if (args.policyId) {
      const { error: pcErr } = await supabase
        .from("policy_controls")
        .delete()
        .eq("policy_id", args.policyId)
        .eq("org_id", args.orgId)
        .in("risk_framework_rule_id", rfrIds)
      if (pcErr) throw pcErr
    }
    const { error: delErr } = await supabase
      .from("risk_framework_rules")
      .delete()
      .eq("org_id", args.orgId)
      .in("id", rfrIds)
    if (delErr) throw delErr
  }

  if (toAdd.length === 0) return

  const { data: inserted, error: insErr } = await supabase
    .from("risk_framework_rules")
    .insert(
      toAdd.map((risk_rule_id) => ({
        org_id: args.orgId,
        framework_id: args.frameworkId,
        risk_rule_id,
      })),
    )
    .select("id, risk_rule_id")
  if (insErr) throw insErr

  if (!args.policyId || !inserted?.length) return

  const remediationControlId = await loadReportRemediationControlId(args.orgId)
  const mappingByRule = new Map(
    args.mappings
      .filter((m) => m.risk_rule_id && desired.has(m.risk_rule_id))
      .map((m) => [m.risk_rule_id!, m]),
  )

  const issueTypeIds = inserted
    .map((r) => mappingByRule.get(r.risk_rule_id)?.issue_type_id)
    .filter(Boolean) as string[]

  let itcByIssueType = new Map<string, string>()
  if (issueTypeIds.length > 0) {
    const { data: itcs, error: itcErr } = await supabase
      .from("issue_type_controls")
      .select("id, issue_type_id")
      .eq("org_id", args.orgId)
      .in("issue_type_id", issueTypeIds)
    if (itcErr) throw itcErr
    itcByIssueType = new Map((itcs || []).map((r) => [r.issue_type_id, r.id]))
  }

  const { error: pcInsErr } = await supabase.from("policy_controls").insert(
    inserted.map((r) => {
      const m = mappingByRule.get(r.risk_rule_id)
      return {
        org_id: args.orgId,
        policy_id: args.policyId!,
        risk_framework_rule_id: r.id,
        remediation_control_id: remediationControlId,
        issue_type_control_id: m?.issue_type_id
          ? itcByIssueType.get(m.issue_type_id) ?? null
          : null,
      }
    }),
  )
  if (pcInsErr) throw pcInsErr
}

const DEFAULT_FRAMEWORK_NAMES = new Set([
  "Default Agent Risk Framework",
  "Default Connector Risk Framework",
])

export function isDefaultRiskFramework(name: string): boolean {
  return DEFAULT_FRAMEWORK_NAMES.has(name.trim())
}

/**
 * Delete a custom imported framework (and its draft policy if present).
 * Refuses default Agent/MCP frameworks.
 */
export async function deleteCustomFrameworkImport(args: {
  orgId: string
  frameworkId: string
  frameworkName: string
}): Promise<void> {
  if (isDefaultRiskFramework(args.frameworkName)) {
    throw new Error("Default risk frameworks cannot be deleted.")
  }

  const { data: framework, error: frameworkError } = await supabase
    .from("risk_framework")
    .select("is_custom")
    .eq("id", args.frameworkId)
    .eq("org_id", args.orgId)
    .maybeSingle()

  if (frameworkError) throw frameworkError
  if (!framework?.is_custom) {
    throw new Error("Only custom frameworks can be deleted from this page.")
  }

  // Clear every policy linked to the framework before deleting its rules and framework row.
  const { data: policies, error: polListErr } = await supabase
    .from("policies")
    .select("id")
    .eq("org_id", args.orgId)
    .eq("framework_id", args.frameworkId)

  if (polListErr) throw polListErr

  for (const policy of policies || []) {
    const { error: polDelErr } = await supabase
      .from("policies")
      .delete()
      .eq("id", policy.id)
      .eq("org_id", args.orgId)
    if (polDelErr) throw polDelErr
  }

  const { error: rulesErr } = await supabase
    .from("risk_framework_rules")
    .delete()
    .eq("framework_id", args.frameworkId)
    .eq("org_id", args.orgId)
  if (rulesErr) throw rulesErr

  const { error: fwErr } = await supabase
    .from("risk_framework")
    .delete()
    .eq("id", args.frameworkId)
    .eq("org_id", args.orgId)
  if (fwErr) throw fwErr

  // risk_framework_imports is removed by its ON DELETE CASCADE foreign key.
  await removePolicyDocument(args.orgId, args.frameworkId)
}

/** Call map-policy and return the API payload as-is. */
export async function mapPolicyViaApi(
  accessToken: string,
  file: File,
  entityType: 1 | 2,
): Promise<MapPolicyResponse> {
  const response = await traceforcApi.mapPolicyToRiskFramework(accessToken, {
    file,
    entityType,
  })

  if (response.error || !response.data) {
    throw new Error(
      response.message ||
        response.error ||
        "Failed to map policy document to the risk framework.",
    )
  }

  if (!response.data.mappings.length) {
    throw new Error(
      "Could not identify controls in the document. Try a PDF or Word file with numbered requirements.",
    )
  }

  return response.data
}

async function loadReportRemediationControlId(orgId: string): Promise<string> {
  const { data, error } = await supabase
    .from("remediation_controls")
    .select(`id, remediations!inner ( remediation_type )`)
    .eq("org_id", orgId)

  if (error) throw error
  const report = (data || []).find((rc: any) => rc.remediations?.remediation_type === 1)
  if (!report) throw new Error("Default remediation (Report as Issue) not found")
  return report.id
}

export type SaveImportResult = {
  frameworkId: string
  policyId: string
}

/**
 * Create custom framework from API mappings, then an inactive draft policy
 * with desired states applied.
 */
export async function saveCustomFrameworkImport(args: {
  orgId: string
  name: string
  description: string
  entityType: 1 | 2
  sourceFile: File
  mappings: MapPolicyMapping[]
  catalogRules: { id: string; name: string }[]
}): Promise<SaveImportResult> {
  const sourceFileName = args.sourceFile.name
  const mapped = args.mappings.filter(
    (m) =>
      m.status !== "excluded" &&
      m.risk_rule_id &&
      (m.status === "mapped" || m.status === "needs_review"),
  )

  const byRule = new Map<string, MapPolicyMapping>()
  for (const m of mapped) {
    const prev = byRule.get(m.risk_rule_id!)
    if (!prev || m.confidence > prev.confidence) byRule.set(m.risk_rule_id!, m)
  }
  const uniqueMapped = [...byRule.values()]

  const { data: framework, error: fwErr } = await supabase
    .from("risk_framework")
    .insert({
      org_id: args.orgId,
      name: args.name.trim(),
      description: args.description.trim() || `Imported from ${sourceFileName}`,
      entity_type: args.entityType,
      is_custom: true,
    })
    .select("id")
    .single()

  if (fwErr) throw fwErr
  const frameworkId = framework.id as string

  if (uniqueMapped.length > 0) {
    const { error: rulesErr } = await supabase.from("risk_framework_rules").insert(
      uniqueMapped.map((m) => ({
        org_id: args.orgId,
        framework_id: frameworkId,
        risk_rule_id: m.risk_rule_id!,
      })),
    )
    if (rulesErr) throw rulesErr
  }

  const remediationControlId = await loadReportRemediationControlId(args.orgId)
  const isAgent = args.entityType === 1
  const rpcName = isAgent ? "create_agent_policy" : "create_mcp_policy"

  const policyParams: Record<string, unknown> = {
    p_name: `${args.name.trim()} (Draft)`,
    p_description: `Draft policy auto-created from policy import (${sourceFileName}). Review mappings before activating.`,
    p_framework_id: frameworkId,
    p_assignment_type: 1,
    p_org_id: args.orgId,
    p_employee_assignment_type: 1,
    p_policy_status: 2,
    p_aggression_level: 2,
    p_remediation_control_id: remediationControlId,
    p_user_group_ids: [],
  }

  if (isAgent) {
    policyParams.p_agent_types = []
  } else {
    policyParams.p_mcp_server_types = []
  }

  const { data: policyId, error: policyErr } = await supabase.rpc(rpcName as any, policyParams)
  if (policyErr) throw policyErr
  const draftPolicyId = policyId as string

  if (uniqueMapped.length > 0) {
    const { data: frameworkRules, error: rfrErr } = await supabase
      .from("risk_framework_rules")
      .select("id, risk_rule_id")
      .eq("framework_id", frameworkId)
      .eq("org_id", args.orgId)

    if (rfrErr) throw rfrErr

    const issueTypeIds = uniqueMapped.map((m) => m.issue_type_id).filter(Boolean) as string[]
    let itcByIssueType = new Map<string, string>()
    if (issueTypeIds.length > 0) {
      const { data: itcs, error: itcErr } = await supabase
        .from("issue_type_controls")
        .select("id, issue_type_id")
        .eq("org_id", args.orgId)
        .in("issue_type_id", issueTypeIds)
      if (itcErr) throw itcErr
      itcByIssueType = new Map((itcs || []).map((r) => [r.issue_type_id, r.id]))
    }

    for (const m of uniqueMapped) {
      if (!m.issue_type_id) continue
      const rfr = (frameworkRules || []).find((r) => r.risk_rule_id === m.risk_rule_id)
      const itcId = itcByIssueType.get(m.issue_type_id)
      if (!rfr || !itcId) continue

      const { error: updErr } = await supabase
        .from("policy_controls")
        .update({ issue_type_control_id: itcId })
        .eq("policy_id", draftPolicyId)
        .eq("risk_framework_rule_id", rfr.id)

      if (updErr) throw updErr
    }
  }

  await saveImportRecord({
    frameworkId,
    orgId: args.orgId,
    entityType: args.entityType,
    sourceFileName,
    frameworkName: args.name.trim(),
    description: args.description.trim(),
    mappings: args.mappings,
    catalogRules: args.catalogRules,
    policyId: draftPolicyId,
    createdAt: new Date().toISOString(),
  })

  try {
    await savePolicyDocument(args.orgId, frameworkId, args.sourceFile)
  } catch (error) {
    // Download availability is best-effort; the import itself succeeded.
    console.error("Failed to store source document for download:", error)
  }

  return { frameworkId, policyId: draftPolicyId }
}
