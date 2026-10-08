import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useLocation, useNavigate, useParams } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { MultiSelect } from "@/components/ui/multi-select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Edit2,
  ExternalLink,
  Layers,
  Loader2,
  MoreVertical,
  Power,
  PowerOff,
  Settings,
  Shield,
  ShieldCheck,
  ShieldX,
  Trash2,
  X,
} from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/contexts/AuthContext"
import { useOrg } from "@/contexts/OrgContext"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { traceforcApi } from "@/integrations/traceforce/client"
import { fetchAllPages, setMcpAccessDecisions, useOrgUserGroups } from "@/hooks/use-mcp-access"
import { transformMcpName } from "@/lib/utils"
import { extractApiError, friendlyLoadError } from "@/lib/api-errors"
import { AccessLinesList } from "@/components/AccessLinesList"
import { useAccessUsage } from "@/hooks/use-access-usage"
import { fetchAccessByScope, fetchLatestDecisions, groupSize as groupSizeLabel, lineKey, newlyBlocked, peopleIn, peopleStillBlocked, users, type BlockedSet } from "@/lib/accessUsage"
import { connectorsBackTarget, DEFAULT_MCP_ACCESS_POLICY_NAME, getDeviceAssignmentContent, getPolicyStatusBadge, getRemediationBadge, getRiskBadge, getUserGroupSourceLabel, BROWSER_APP_SOURCE_TYPES, isBrowserAppConnectorSourceType, isGovernableMcpType } from "@/lib/appUtils"
import type { McpSourceType, UpdatePolicyBody } from "@/integrations/traceforce/types"

// ---------------------------------------------------------------------------
// MCP Access policy editor (ENG-519). Adapts the DeveloperMcpPolicy mock to
// real data. Structure:
//   header (status badge · activate/deactivate) → Allowed
//   MCPs / Assigned Users cards → one table with the Risk Score Limit and
//   Connector Exceptions rows (the non-framework conditions) → Policy Controls
//   (the categories condition; the Identity Control condition exists in the
//   data model but is deliberately NOT rendered yet) → review / keep dialogs.
//
// Each change saves on its own, as on the other policy pages: Edit → Review
// → Keep (only when the change newly blocks people using a connector) →
// Save. A rule's pencil opens its editor, whose Review shows the rule's
// effect (the connectors it newly blocks and allows, ones in use first);
// Assigned Users' Review shows who the policy starts and stops covering and
// where the rest end up; Activate goes straight to the keep step, or the
// house confirm when nobody is newly blocked. "Newly blocked" is an
// EFFECTIVE-verdict diff over people's groups (explicit decisions outrank
// policy, so a connector a decision allows never counts). Keeping a line is
// a group allow (an access decision) saved before the policy, never a
// connector exception, so the diff stays the rule's own effect. Turning a
// rule off and deactivating keep the house confirms.
// Every policy save is one PUT /api/v1/policies/:id — one transaction, so a
// tightened condition can never enforce without the rest of its draft. The
// page's draft state only ever holds an in-flight save: a cancelled review or
// a failed save reverts it, so the rows always show what the server has.
//
// Connector exceptions (ENG-810) are a policy-level condition: the MCP types
// the policy always allows, stored on the policy row as the
// policies.exception_types column (a typed integer[] beside risk_threshold)
// and evaluated by the resolver AHEAD of the risk and category conditions.
// Explicit decisions still outrank them. They save with the rest of the draft
// through the PUT (full list, so removing one is just a save); the lazy
// request sweep closes pending requests once nothing blocks the
// requester. ChatGPT / Claude browser connectors are dropped from
// the catalog at load (isBrowserAppConnectorSourceType): no device-side
// policy applies to them, so no count, list or picker on this page includes
// them. The draft holds the stored list in full — whatever the catalog can't
// show (a browser connector, a type missing from the catalog response) rides
// along untouched and is surfaced only as a count, because the save replaces
// the list.
//
// Assignment wording matches the other policy pages (Assigned Users: All
// Users / Selected Users), so every policy reads the same way.
//
// The seeded default policy is neither renamable nor deletable (the Policies
// page guards deletion BY NAME, so renaming would break that guard);
// description edits are allowed. Non-default access policies arrive with the
// create flow — deliberately not built yet.
// ---------------------------------------------------------------------------

// Key for the ungrouped-devices scope, so it can share Set/Map keys with
// group UUIDs.
const UNGROUPED_SCOPE = "__ungrouped__"

// risk_threshold vocabulary (app-enforced; no DB CHECK): the score bands are
// getRiskLevel's — <40 Low, <60 Medium, <80 High. An MCP is blocked when
// avg score >= threshold; null = no risk ban. 10 reads as "block all" (no
// catalog entry scores below 10).
const RISK_OPTIONS: { value: string; label: string }[] = [
  { value: "10", label: "Block all" },
  { value: "40", label: "Allow Low risk only" },
  { value: "60", label: "Allow up to Medium risk" },
  { value: "80", label: "Allow up to High risk" },
  { value: "none", label: "Allow all" },
]

const thresholdToOption = (t: number | null) => (t === null ? "none" : String(t))
const optionToThreshold = (v: string) => (v === "none" ? null : Number(v))

interface CatalogMcp {
  type: number
  name: string
  categoryId: string | null
  categoryName: string | null
  avgScore: number | null
  sourceType: McpSourceType | null
}

const byName = (a: CatalogMcp, b: CatalogMcp) => a.name.localeCompare(b.name)

// Agents whose device-side enforcement honours this policy's verdicts today.
// Copilot is CLI only: scout doesn't hook VS Code Copilot Chat. Static copy on
// the Allowed MCPs card until the API reports enforcement coverage per agent.
const MCP_ACCESS_AGENTS = "Cursor, Claude Code and GitHub Copilot CLI"

/** The draft's enforcement knobs (what policyVerdict evaluates). */
interface Conditions {
  riskThreshold: number | null
  categoriesEnabled: boolean
  deniedCategoryIds: string[]
  /** Connector exceptions: MCP types the policy always allows
   * (policies.exception_types). */
  exceptionTypes: number[]
}

/** Everything a save commits — the applied snapshot has the same shape. */
interface PolicyDraft extends Conditions {
  active: boolean
  grantScope: "1" | "2"
  selectedGroupIds: string[]
}

/** What one save applies: the conditions plus the scope. Built from the page's
 * current values with the editing surface's change merged over them, so a
 * save never depends on React state having caught up. */
type SaveDraft = Conditions & Pick<PolicyDraft, "grantScope" | "selectedGroupIds">

// Mirror of the resolver's layer-0 policy evaluation — MUST stay in sync with
// get_mcp_access_status (exception → allow; denied category → block; unscored
// → needs_review; avg score >= threshold → block; else allow). 1 allow ·
// 2 block · 3 needs review; "allowed" means verdict 1 — needs_review is not
// allowed (devices don't allowlist it).
function policyVerdict(mcp: CatalogMcp, c: Conditions): 1 | 2 | 3 {
  if (c.exceptionTypes.includes(mcp.type)) return 1
  if (c.categoriesEnabled && mcp.categoryId && c.deniedCategoryIds.includes(mcp.categoryId)) return 2
  if (mcp.avgScore === null) return 3
  if (c.riskThreshold !== null && mcp.avgScore >= c.riskThreshold) return 2
  return 1
}

/** The house error toast's description ("Failed to …"), with the server's
 * reason after it when there is one. */
const failure = (what: string, e: unknown) => {
  const reason = e instanceof Error ? e.message : typeof e === "string" ? e : ""
  return reason ? `${what}: ${reason}` : what
}

export default function McpAccessPolicyDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  // From a connectors table (source_mcps) it goes back there, with its
  // filters; otherwise to Policies, as on the other policy pages.
  const back = new URLSearchParams(location.search).has("source_mcps")
    ? connectorsBackTarget(location.state)
    : { path: `/policies${location.state?.backSearch ? `?${location.state.backSearch}` : ""}`, label: "Back to Policies", state: undefined }
  const { toast } = useToast()
  const { session } = useAuth()
  const { activeOrgId } = useOrg()
  // Who uses which connector, and in which groups (IdP groups included): the
  // keep step's input. Loads alongside the page.
  const accessUsage = useAccessUsage(true)
  const accessToken = session?.access_token
  // This is a DRAFT-holding page: the token's VALUE lives in a ref so routine
  // token rotations don't re-run the loader (which would reseed the draft and
  // discard unsaved edits). Its PRESENCE stays a load dependency below, so
  // the first arrival of auth still triggers the initial load. The loader
  // reads the ref at call time; the save paths use the render's own
  // accessToken (they run on a click, so it is current either way).
  const tokenRef = useRef(accessToken)
  tokenRef.current = accessToken

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // --- Loaded, non-draft data ----------------------------------------------
  const [policyName, setPolicyName] = useState("")
  const [policyDescription, setPolicyDescription] = useState("")
  const [createdAt, setCreatedAt] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [catalog, setCatalog] = useState<CatalogMcp[]>([])
  const [userGroups, setUserGroups] = useState<{ id: string; name: string; deleted?: boolean }[]>([])
  /** Groups governed by ANOTHER active group-scoped access policy — an
   * org-wide policy does not govern them (specific replaces org-wide). */
  const [specificallyGoverned, setSpecificallyGoverned] = useState<Set<string>>(new Set())
  /** Another active org-wide access policy: where people this policy stops
   * covering end up when no group-scoped policy governs them. */
  const [otherOrgWideName, setOtherOrgWideName] = useState<string | null>(null)
  /** The org's MCP risk framework (entity_type 2) — the Framework summary
   * card links to it and the Resource Type rule deep-links into it. */
  const [mcpFramework, setMcpFramework] = useState<{ id: string; name: string } | null>(null)
  /** The Resource Type rule's risk_rules id — the framework page's
   * scroll-and-highlight deep-link keys on it (same as PolicyDetail). */
  const [categoriesRuleId, setCategoriesRuleId] = useState<string | null>(null)
  /** The Resource Type rule's own name and description (risk_rules), shown in
   * its row and editor as the other policy pages show theirs. */
  const [categoriesRule, setCategoriesRule] = useState<{ name: string; description: string | null } | null>(null)

  // --- Applied snapshot + draft --------------------------------------------
  const [applied, setApplied] = useState<PolicyDraft>({
    active: false,
    grantScope: "1",
    selectedGroupIds: [],
    riskThreshold: null,
    categoriesEnabled: false,
    deniedCategoryIds: [],
    exceptionTypes: [],
  })
  const [grantScope, setGrantScope] = useState<"1" | "2">("1")
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([])
  const [riskThreshold, setRiskThreshold] = useState<number | null>(null)
  const [categoriesEnabled, setCategoriesEnabled] = useState(false)
  const [deniedCategoryIds, setDeniedCategoryIds] = useState<string[]>([])
  const [exceptionTypes, setExceptionTypes] = useState<number[]>([])

  // --- UI state --------------------------------------------------------------
  // Name + description edit together in one mode (PolicyDetail's pattern).
  const [editingHeader, setEditingHeader] = useState(false)
  const [draftName, setDraftName] = useState("")
  const [draftDescription, setDraftDescription] = useState("")
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  /** Confirm for the status toggle (house convention; PolicyDetail gates the
   * same buttons). null = closed. */
  const [confirmToggle, setConfirmToggle] = useState<"activate" | "deactivate" | null>(null)
  /** "Disable Rule" confirm for the Resource Type switch (house pattern). */
  const [confirmDisableRule, setConfirmDisableRule] = useState(false)
  const [editingGrantScope, setEditingGrantScope] = useState(false)
  const [draftGrantScope, setDraftGrantScope] = useState<"1" | "2">("1")
  const [draftGroupIds, setDraftGroupIds] = useState<string[]>([])
  const [categoryDialog, setCategoryDialog] = useState<{ id: string | null; name: string } | null>(null)
  const [allowedDialog, setAllowedDialog] = useState<"risk" | "categories" | "summary" | "exceptions" | null>(null)
  const [allowedQuery, setAllowedQuery] = useState("")
  /** Activation and Assigned Users changes that need a decision: who the
   * change would newly block (checked fresh when it opens), and the step it's
   * on. Assigned Users starts on its review; activation goes straight to keep. */
  const [changeFlow, setChangeFlow] = useState<{
    kind: "activate" | "scope"
    step: "review" | "keep"
    draft: SaveDraft
    keep: BlockedSet
  } | null>(null)
  /** Keep-step lines checked. Every line starts unchecked (a "not in any
   * group" line would allow the connector for all users). */
  const [keepSelected, setKeepSelected] = useState<Set<string>>(new Set())
  /** The per-rule editor behind each row's pencil (the edit-and-save model the
   * other policy pages use): which rule, which step, and the values being
   * edited. Edit → Review (the rule's effect) → Keep (only if people using a
   * connector would be newly blocked) → Save. */
  const [ruleEditor, setRuleEditor] = useState<{
    rule: "risk" | "exceptions" | "categories"
    /** Opened from the rule's switch: saving also turns the rule on. */
    enable?: boolean
    step: "edit" | "review" | "keep"
    riskThreshold: number | null
    exceptionTypes: number[]
    deniedCategoryIds: string[]
    /** Set by Review: what the rule change does to the catalog, and who using
     * a connector it would newly block (the keep step, when anyone). */
    diff?: { blocked: CatalogMcp[]; allowed: CatalogMcp[] }
    keep?: BlockedSet
  } | null>(null)
  /** Group sizes ("· N members" / "· N devices") for the review and keep
   * steps, from the user group list. */
  const orgGroups = useOrgUserGroups()
  const groupSizes = useMemo(() => new Map(orgGroups.data.map((g) => [g.id, groupSizeLabel(g)])), [orgGroups.data])
  const groupSize = useCallback((groupId: string) => groupSizes.get(groupId), [groupSizes])
  const [saving, setSaving] = useState(false)
  /** True while a change checks current access before its review or keep step. */
  const [previewing, setPreviewing] = useState(false)
  /** Inline name-collision error under the rename input (field errors live
   * inline; system errors stay toasts). */
  const [nameError, setNameError] = useState<string | null>(null)

  // --- Load everything -------------------------------------------------------
  // Runs once per (policy, org, auth-arrival). No post-save re-run: the save
  // response supplies the fields a save changes, and current access is read
  // fresh when a change is reviewed (checkNewlyBlocked), never held here.
  const load = useCallback(async () => {
    const token = tokenRef.current
    if (!id || !activeOrgId || !token) return
    setLoading(true)
    setError(null)
    try {
      // Policy row first — a non-access policy bounces to the standard editor
      // (mirror of PolicyDetail's category-4 bounce, pointing the other way).
      const { data: policy, error: policyErr } = await supabase
        .from("policies")
        .select("id, name, description, category, policy_status, risk_threshold, employee_assignment_type, exception_types, created_at, updated_at")
        .eq("id", id)
        .eq("org_id", activeOrgId)
        .maybeSingle()
      if (policyErr) throw policyErr
      if (!policy) {
        navigate("/policies", { replace: true })
        return
      }
      if (policy.category !== 4) {
        navigate(`/policies/${id}`, { replace: true })
        return
      }

      // Commit the header fields immediately — the policy row is one fast
      // query, and the title shouldn't wait on the heavy catalog/usage batch
      // below. The body keeps its skeletons until everything else lands.
      setPolicyName(policy.name ?? "")
      setPolicyDescription(policy.description ?? "")
      setCreatedAt(policy.created_at ?? null)
      setUpdatedAt(policy.updated_at ?? null)

      const [controlsRes, linksRes, groupsRes, specificRes, frameworkRes, catalogRows] =
        await Promise.all([
          // The categories condition (the Identity Control row also exists,
          // seeded disabled — not read because it isn't rendered yet).
          supabase
            .from("policy_controls")
            .select("id, settings, risk_framework_rules!inner(risk_rules!inner(id, risk_rule_type, name, description))")
            .eq("policy_id", id)
            .eq("org_id", activeOrgId),
          supabase.from("policy_user_groups").select("user_group_id").eq("policy_id", id).eq("org_id", activeOrgId),
          // deleted_at rides along: tombstoned (disconnected) IdP groups are
          // hidden everywhere on this page (product decision) but their
          // ATTACHMENTS survive — ghost ids keep riding through saves so a
          // reconnect can revive them (see ghostGroupIds).
          // Base table, not active_user_groups: this page needs the tombstoned
          // rows too (attached ghosts stay saveable — see ghostGroupIds).
          supabase.from("user_groups").select("id, name, user_group_source, deleted_at").eq("org_id", activeOrgId).order("name"),
          // Other ACTIVE access policies: group-scoped ones' groups escape an
          // org-wide policy (specific replaces org-wide); an org-wide one is
          // where people this policy stops covering end up.
          supabase
            .from("policies")
            .select("id, name, employee_assignment_type, policy_user_groups(user_group_id)")
            .eq("org_id", activeOrgId)
            .eq("category", 4)
            .eq("policy_status", 1)
            .neq("id", id),
          // The MCP risk framework (entity_type 2) for the Framework card and
          // the rule deep-link. Frameworks are per-org; without the org filter
          // a multi-org admin sees several rows and the link degrades.
          supabase
            .from("risk_framework")
            .select("id, name")
            .eq("entity_type", 2)
            .eq("org_id", activeOrgId)
            .maybeSingle(),
          // Skips the ChatGPT / Claude connectors (see below): ~92% of the catalog.
          fetchAllPages((next_token) =>
            traceforcApi.listMcpCatalog(token, {
              include_scores: true,
              exclude_source_type: BROWSER_APP_SOURCE_TYPES,
              next_token,
            }),
          ),
        ])

      if (controlsRes.error) throw controlsRes.error
      if (linksRes.error) throw linksRes.error
      if (groupsRes.error) throw groupsRes.error
      if (specificRes.error) throw specificRes.error
      // Framework lookup failing is non-fatal (the rule link falls back to
      // the frameworks list) but shouldn't be silent.
      if (frameworkRes.error) console.error("MCP framework lookup failed", frameworkRes.error)

      // Categories condition off the rule-1012 control row. Its risk_rules id
      // feeds the framework deep-link (scroll + highlight, like PolicyDetail).
      const categoriesControl = (controlsRes.data ?? []).find(
        (c: any) => c.risk_framework_rules?.risk_rules?.risk_rule_type === 1012,
      ) as any
      const settings = categoriesControl?.settings ?? {}
      const catEnabled = settings.enabled === true
      const deniedIds: string[] = Array.isArray(settings.denied_category_ids)
        ? settings.denied_category_ids
        : []

      // ChatGPT / Claude "connectors" are browser-app integrations, not MCP
      // servers a device runs: no policy applies to them (the Connectors table
      // marks them "coming soon"), so they are out of every count,
      // list and picker here. The request already leaves them out; this keeps
      // the page correct against a backend that ignores exclude_source_type.
      const catalogMcps: CatalogMcp[] = catalogRows
        .filter((r: any) => isGovernableMcpType(r.mcp_server_type) && !isBrowserAppConnectorSourceType(r.source_type))
        .map((r: any) => ({
          type: r.mcp_server_type,
          name: transformMcpName(r.mcp_server_name),
          categoryId: r.category_id ?? null,
          categoryName: r.category_name ?? null,
          avgScore: r.avg_baseline_score ?? null,
          sourceType: r.source_type ?? null,
        }))
      const loadedState: PolicyDraft = {
        active: policy.policy_status === 1,
        grantScope: policy.employee_assignment_type === 2 ? "2" : "1",
        selectedGroupIds: (linksRes.data ?? []).map((l: any) => l.user_group_id),
        riskThreshold: policy.risk_threshold ?? null,
        categoriesEnabled: catEnabled,
        deniedCategoryIds: deniedIds,
        // The FULL stored list, browser connectors and unknown types included:
        // the save sends it back with replace semantics, so narrowing here
        // would silently delete what the picker can't show. Presentation is
        // narrowed separately (exceptionMcps); the hidden ones ride through
        // every save untouched.
        exceptionTypes: [...(policy.exception_types ?? [])].sort((a, b) => a - b),
      }

      const governed = new Set<string>()
      for (const p of specificRes.data ?? []) {
        if (p.employee_assignment_type !== 2) continue
        for (const link of (p as any).policy_user_groups ?? []) governed.add(link.user_group_id)
      }

      // Commit the body (header fields were committed right after the policy
      // fetch above).
      setCatalog(catalogMcps)
      setUserGroups(((groupsRes.data ?? []) as { id: string; name: string; user_group_source: number; deleted_at: string | null }[]).map((g) => ({
        id: g.id,
        // With the IdP, as on PolicyDetail: two IdPs can each have an "Engineering".
        name: `${g.name} (${getUserGroupSourceLabel(g.user_group_source)})`,
        deleted: !!g.deleted_at,
      })))
      setSpecificallyGoverned(governed)
      setOtherOrgWideName((specificRes.data ?? []).find((p) => p.employee_assignment_type !== 2)?.name ?? null)
      setMcpFramework(frameworkRes.data ?? null)
      setCategoriesRuleId(categoriesControl?.risk_framework_rules?.risk_rules?.id ?? null)
      const categoriesRiskRule = categoriesControl?.risk_framework_rules?.risk_rules
      setCategoriesRule(categoriesRiskRule?.name ? { name: categoriesRiskRule.name, description: categoriesRiskRule.description ?? null } : null)
      setApplied(loadedState)
      setGrantScope(loadedState.grantScope)
      setSelectedGroupIds(loadedState.selectedGroupIds)
      setRiskThreshold(loadedState.riskThreshold)
      setCategoriesEnabled(loadedState.categoriesEnabled)
      setDeniedCategoryIds(loadedState.deniedCategoryIds)
      setExceptionTypes(loadedState.exceptionTypes)
    } catch (e: any) {
      setError(friendlyLoadError(e?.message ?? "Failed to load the policy"))
    } finally {
      setLoading(false)
    }
    // tokenRef is deliberately NOT a dependency: only the token's PRESENCE
    // (!!accessToken) re-triggers, so rotations can't reseed the draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, activeOrgId, !!accessToken, navigate])

  useEffect(() => {
    load()
  }, [load])

  // --- Derived draft state ----------------------------------------------------
  const isDefaultPolicy = policyName === DEFAULT_MCP_ACCESS_POLICY_NAME
  // Scope says "specific groups" but none remain (e.g. the assigned groups
  // were removed) — the policy governs nothing and a save would be rejected;
  // the Assigned Users card prompts and Save/Activate disable instead.
  const orphanedScope = grantScope === "2" && selectedGroupIds.length === 0

  const draftConditions: Conditions = useMemo(
    () => ({ riskThreshold, categoriesEnabled, deniedCategoryIds, exceptionTypes }),
    [riskThreshold, categoriesEnabled, deniedCategoryIds, exceptionTypes],
  )

  const categories = useMemo(() => {
    const byId = new Map<string, { id: string; name: string; count: number }>()
    for (const m of catalog) {
      if (!m.categoryId) continue
      const c = byId.get(m.categoryId) ?? { id: m.categoryId, name: m.categoryName ?? "Uncategorized", count: 0 }
      c.count += 1
      byId.set(m.categoryId, c)
    }
    return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [catalog])

  // Per-rule lists: policyVerdict with only that rule on. Risk lists what it
  // allows (unscored needs review, so it's left out); categories lists what
  // it doesn't block.
  const allowedByRisk = useMemo(() => {
    const c: Conditions = { riskThreshold, categoriesEnabled: false, deniedCategoryIds: [], exceptionTypes: [] }
    return catalog.filter((m) => policyVerdict(m, c) === 1)
  }, [catalog, riskThreshold])
  const allowedByCategories = useMemo(() => {
    if (!categoriesEnabled) return []
    const c: Conditions = { riskThreshold: null, categoriesEnabled: true, deniedCategoryIds, exceptionTypes: [] }
    return catalog.filter((m) => policyVerdict(m, c) !== 2)
  }, [catalog, categoriesEnabled, deniedCategoryIds])
  const allowedMcps = useMemo(
    () => catalog.filter((m) => policyVerdict(m, draftConditions) === 1),
    [catalog, draftConditions],
  )
  /** The exceptions universe: the catalog, by name. Feeds the picker's
   * options, its selected badges and the exceptions dialog, so all three list
   * in the same order. */
  const sortedCatalog = useMemo(() => [...catalog].sort(byName), [catalog])
  const exceptionMcps = useMemo(
    () => sortedCatalog.filter((m) => exceptionTypes.includes(m.type)),
    [sortedCatalog, exceptionTypes],
  )
  const exceptionOptions = useMemo(
    () => sortedCatalog.map((m) => ({ id: String(m.type), name: m.name })),
    [sortedCatalog],
  )
  // Tombstoned (disconnected) attachments are hidden everywhere on this page
  // — the scope card, its count badge, and the picker show live groups only.
  const selectedGroups = useMemo(
    () => userGroups.filter((g) => !g.deleted && selectedGroupIds.includes(g.id)),
    [userGroups, selectedGroupIds],
  )
  const groupPickerOptions = useMemo(
    () => userGroups.filter((g) => !g.deleted),
    [userGroups],
  )

  // The hidden attachments themselves must survive: the save's scope sync is
  // delete-and-reinsert, so their ids ride along in selectedGroupIds — seeded
  // by load, stripped from the scope editor's draft (they have no checkbox),
  // and re-appended on Done so a save keeps round-tripping them for reconnect
  // revival. Keyed on the PERSISTED set (applied): only saved attachments are
  // worth preserving.
  const ghostGroupIds = useMemo(() => {
    const deleted = new Set(userGroups.filter((g) => g.deleted).map((g) => g.id))
    return applied.selectedGroupIds.filter((id) => deleted.has(id))
  }, [userGroups, applied.selectedGroupIds])

  /** The page's current values as one save draft — what a switch toggle or
   * an editor's Save merges its change over. */
  const pageDraft = useMemo<SaveDraft>(
    () => ({ ...draftConditions, grantScope, selectedGroupIds }),
    [draftConditions, grantScope, selectedGroupIds],
  )

  // Would saving `d` change anything stored?
  const isDirty = useCallback(
    (d: SaveDraft) =>
      JSON.stringify({
        r: d.riskThreshold,
        e: d.categoriesEnabled,
        d: [...d.deniedCategoryIds].sort(),
        x: [...d.exceptionTypes].sort((a, b) => a - b),
        g: d.grantScope,
        i: [...d.selectedGroupIds].sort(),
      }) !==
      JSON.stringify({
        r: applied.riskThreshold,
        e: applied.categoriesEnabled,
        d: [...applied.deniedCategoryIds].sort(),
        x: [...applied.exceptionTypes].sort((a, b) => a - b),
        g: applied.grantScope,
        i: [...applied.selectedGroupIds].sort(),
      }),
    [applied],
  )
  // The scope editor's groups as a save would send them (hidden tombstoned
  // attachments rejoin), and whether its draft changes anything.
  const scopeEditorGroups = draftGrantScope === "2" ? [...draftGroupIds, ...ghostGroupIds] : draftGroupIds
  const scopeEditorChanged =
    draftGrantScope !== applied.grantScope ||
    (draftGrantScope === "2" && isDirty({ ...pageDraft, grantScope: "2", selectedGroupIds: scopeEditorGroups }))

  // --- The per-rule editor's working state ----------------------------------
  const openRuleEditor = (rule: "risk" | "exceptions" | "categories", enable = false) =>
    setRuleEditor({
      rule,
      enable,
      step: "edit",
      riskThreshold,
      exceptionTypes: [...exceptionTypes],
      deniedCategoryIds: [...deniedCategoryIds],
    })
  /** The page draft with the editor's values over it — what its Save sends. */
  const editorConditions = useMemo<Conditions | null>(
    () =>
      ruleEditor
        ? {
            ...draftConditions,
            ...(ruleEditor.enable ? { categoriesEnabled: true } : {}),
            riskThreshold: ruleEditor.riskThreshold,
            exceptionTypes: ruleEditor.exceptionTypes,
            deniedCategoryIds: ruleEditor.deniedCategoryIds,
          }
        : null,
    [ruleEditor, draftConditions],
  )
  const editorVisibleExceptionIds = useMemo(
    () => (ruleEditor ? sortedCatalog.filter((m) => ruleEditor.exceptionTypes.includes(m.type)).map((m) => String(m.type)) : []),
    [ruleEditor, sortedCatalog],
  )
  const catalogByType = useMemo(() => new Map(catalog.map((m) => [m.type, m])), [catalog])
  /** In use on devices, catalog connectors only: custom and browser-app
   * connectors aren't governable, so no policy change can block them. */
  const catalogUsage = useMemo(
    () => new Map([...accessUsage.usage].filter(([type]) => catalogByType.has(type))),
    [accessUsage.usage, catalogByType],
  )
  const connectorName = useCallback((type: number) => catalogByType.get(type)?.name ?? `Connector ${type}`, [catalogByType])
  const groupNames = useMemo(() => new Map(userGroups.map((g) => [g.id, g.name])), [userGroups])
  const groupLabel = useCallback((groupId: string) => groupNames.get(groupId) ?? "Unknown group", [groupNames])

  // Does THIS policy govern this scope after the save? Org-wide governs every
  // scope except groups owned by another active specific access policy;
  // group-scoped governs exactly its assigned groups.
  const enforcedAfter = useCallback(
    (scopeKey: string, scope: Pick<SaveDraft, "grantScope" | "selectedGroupIds">) =>
      scope.grantScope === "2"
        ? scope.selectedGroupIds.includes(scopeKey)
        : scopeKey === UNGROUPED_SCOPE || !specificallyGoverned.has(scopeKey),
    [specificallyGoverned],
  )

  /** What a rule change does to the catalog: the connectors this policy's
   * rules newly block or allow. The rules' effect, whether or not the policy
   * is on. Connectors in use first, then by name. */
  const ruleDiff = (before: Conditions, after: Conditions) => {
    const blocked: CatalogMcp[] = []
    const allowed: CatalogMcp[] = []
    for (const m of catalog) {
      const b = policyVerdict(m, before) === 1
      const a = policyVerdict(m, after) === 1
      if (b && !a) blocked.push(m)
      else if (!b && a) allowed.push(m)
    }
    const order = (x: CatalogMcp, y: CatalogMcp) =>
      Number(catalogUsage.has(y.type)) - Number(catalogUsage.has(x.type)) || x.name.localeCompare(y.name)
    return { blocked: blocked.sort(order), allowed: allowed.sort(order) }
  }

  /** Who using a connector this save would newly block, from current access
   * read now (fresh, including decisions written a minute ago). An admin's
   * decision outranks any policy, so its scope keeps its access; scopes this
   * policy governs after the save take the draft's verdict, unless the scope
   * isn't governed today and the ledger already holds a decision for it (its
   * group's, else the one for all users): the resolver applies that the
   * moment the scope is governed. The rest don't change. KNOWN GAP: people a
   * narrowed scope hands back to another policy keep their current access
   * here (that policy's rules aren't on this page). Throws if access can't be
   * read: a list we can't stand behind is worse than none (fail closed). */
  const checkNewlyBlocked = async (draft: SaveDraft, draftActive: boolean): Promise<BlockedSet> => {
    if (!draftActive || !accessToken || !activeOrgId) return { lines: [], devices: [] }
    if (accessUsage.error) throw new Error(accessUsage.error)
    const types = [...catalogUsage.keys()]
    const [before, decisions] = await Promise.all([
      fetchAccessByScope(accessToken, types),
      fetchLatestDecisions(activeOrgId, types),
    ])
    return newlyBlocked(catalogUsage, before, (type, scope, b) => {
      if (b?.hasDecision) return b
      if (enforcedAfter(scope ?? UNGROUPED_SCOPE, draft)) {
        if (!b) {
          const action =
            (scope !== null ? decisions.get(lineKey(type, scope)) : undefined) ?? decisions.get(lineKey(type, null))
          if (action !== undefined) return { verdict: action, hasDecision: true }
        }
        return { verdict: policyVerdict(catalogByType.get(type)!, draft), hasDecision: false }
      }
      return b
    })
  }

  // --- Save / activate / deactivate -----------------------------------------
  const discardDraft = () => {
    setGrantScope(applied.grantScope)
    setSelectedGroupIds([...applied.selectedGroupIds])
    setRiskThreshold(applied.riskThreshold)
    setCategoriesEnabled(applied.categoriesEnabled)
    setDeniedCategoryIds([...applied.deniedCategoryIds])
    setExceptionTypes([...applied.exceptionTypes])
  }

  /** True when this click's world includes the policy being active. */
  const effectiveActive = (activating: boolean) => activating || applied.active

  /** The rule editor's Review button: the rule's effect, and who using a
   * connector it would newly block (the keep step behind Next). */
  const openReview = async () => {
    if (!editorConditions) return
    const draft: SaveDraft = { ...pageDraft, ...editorConditions }
    setPreviewing(true)
    try {
      // A rule save never activates, so the world is the policy's current status.
      const keep = await checkNewlyBlocked(draft, applied.active)
      setKeepSelected(new Set())
      setRuleEditor((e) => e && { ...e, step: "review", diff: ruleDiff(draftConditions, editorConditions), keep })
    } catch (e) {
      toast({ title: "Error", description: failure("Failed to check current access", e), variant: "destructive" })
    } finally {
      setPreviewing(false)
    }
  }

  /** Activate (header) and Assigned Users (card): check who the change would
   * newly block. Assigned Users opens on its review; activation goes to the
   * keep step when anyone would lose access, else the plain confirm. */
  const openChange = async (kind: "activate" | "scope", draft: SaveDraft = pageDraft) => {
    if (!accessToken) return
    setPreviewing(true)
    try {
      const keep = await checkNewlyBlocked(draft, kind === "activate" || applied.active)
      setKeepSelected(new Set())
      if (kind === "scope") setChangeFlow({ kind, step: "review", draft, keep })
      else if (keep.lines.length > 0) setChangeFlow({ kind, step: "keep", draft, keep })
      else setConfirmToggle("activate")
    } catch (e) {
      toast({ title: "Error", description: failure("Failed to check current access", e), variant: "destructive" })
      // Nothing was saved: the rows go back to showing what the server has.
      if (kind === "scope") discardDraft()
    } finally {
      setPreviewing(false)
    }
  }

  /** Saves a change with the keep step's choices: the kept groups' allows
   * first (so nobody using them is blocked in between), then the policy. The
   * allows go in one call that lands whole or not at all; if it fails the
   * policy isn't saved, and if the policy then fails, the toast says the
   * keeps landed. Resolves true when it all landed. */
  const saveChange = async (activating: boolean, draft: SaveDraft, keep: BlockedSet | undefined) => {
    const lines = keep ? keep.lines.filter((l) => keepSelected.has(l.key)) : []
    if (lines.length > 0 && accessToken) {
      setSaving(true)
      try {
        await setMcpAccessDecisions(
          accessToken,
          lines.map((line) => ({
            action: 1,
            scopeType: line.groupId ? 2 : 1,
            groupId: line.groupId,
            mcpServerType: line.type,
            reason: `Kept for current users when "${policyName}" changed`,
          })),
        )
      } catch (e) {
        toast({ title: "Error", description: failure("Failed to keep access", e), variant: "destructive" })
        setSaving(false)
        // The policy wasn't saved: the rows go back to showing what the
        // server has (the open dialog or editor carries the retry).
        discardDraft()
        return false
      }
      setSaving(false)
    }
    const kept = lines.length > 0 ? { people: peopleIn(lines), connectors: new Set(lines.map((l) => l.type)).size } : undefined
    return commitSave(activating, draft, kept)
  }

  /** The rule editor's Save (from Review, or the keep step). The editor stays
   * open while the request is in flight (a failed save keeps the edit for a
   * retry) and closes on success. */
  const saveRuleEditor = async () => {
    if (!editorConditions || !ruleEditor) return
    const c = editorConditions
    const draft: SaveDraft = { ...pageDraft, ...c }
    // Stage into the page draft so the rows show the change while the save
    // is in flight (commitSave reverts them if it fails).
    setRiskThreshold(c.riskThreshold)
    setExceptionTypes(c.exceptionTypes)
    setDeniedCategoryIds([...c.deniedCategoryIds])
    setCategoriesEnabled(c.categoriesEnabled)
    if (await saveChange(false, draft, ruleEditor.keep)) setRuleEditor(null)
  }

  /** Resolves true when the save landed. `kept`: the keep step's allows, for
   * the toast. */
  const commitSave = async (
    activating: boolean,
    draft: SaveDraft = pageDraft,
    kept?: { people: number; connectors: number },
  ): Promise<boolean> => {
    if (!id || !accessToken) return false
    const scopeChanged =
      draft.grantScope !== applied.grantScope ||
      draft.selectedGroupIds.length !== applied.selectedGroupIds.length ||
      draft.selectedGroupIds.some((g) => !applied.selectedGroupIds.includes(g))
    setSaving(true)
    try {
      // Every request carries exactly what the admin changed, nothing they
      // merely looked at:
      //   - status only when this click's job is activation (a plain save
      //     must never re-assert the page's possibly stale status);
      //   - conditions/scope only when the draft is dirty (a clean Activate
      //     must never replay page-load state over a concurrent admin's
      //     edits — the scope sync is delete-and-reinsert).
      const body: UpdatePolicyBody = isDirty(draft)
        ? {
            ...(activating ? { policy_status: 1 as const } : {}),
            assignment: {
              employee_assignment_type: draft.grantScope === "2" ? 2 : 1,
              // Deliberate: switching to org-wide sends [] and the
              // delete-and-reinsert sync drops ALL attachments, including
              // tombstoned ones held for reconnect revival — a scope change is
              // an explicit statement that groups no longer govern this policy.
              group_ids: draft.grantScope === "2" ? draft.selectedGroupIds : [],
            },
            mcp_access: {
              risk_threshold: draft.riskThreshold,
              denied_categories: { enabled: draft.categoriesEnabled, category_ids: draft.deniedCategoryIds },
              exception_types: draft.exceptionTypes,
            },
          }
        : { ...(activating ? { policy_status: 1 as const } : {}) }
      const res = await traceforcApi.updatePolicy(accessToken, id, body)
      if (res.error) throw new Error(extractApiError(res.error))

      // The response carries the saved list (authoritative); what we sent is
      // the fallback. Kept in full — see the load comment.
      const exceptionsNow = [...(res.data?.policy.exception_types ?? draft.exceptionTypes)].sort((a, b) => a - b)
      setApplied({
        // The response carries the authoritative post-save status — never
        // guess from page-load state (a concurrent admin may have toggled it).
        active: res.data ? res.data.policy.policy_status === 1 : effectiveActive(activating),
        grantScope: draft.grantScope,
        selectedGroupIds: [...draft.selectedGroupIds],
        riskThreshold: draft.riskThreshold,
        categoriesEnabled: draft.categoriesEnabled,
        deniedCategoryIds: [...draft.deniedCategoryIds],
        exceptionTypes: exceptionsNow,
      })
      // The page draft adopts what was saved — a rule editor's save carries
      // values the page draft may not hold yet.
      setGrantScope(draft.grantScope)
      setSelectedGroupIds([...draft.selectedGroupIds])
      setRiskThreshold(draft.riskThreshold)
      setCategoriesEnabled(draft.categoriesEnabled)
      setDeniedCategoryIds([...draft.deniedCategoryIds])
      setExceptionTypes(exceptionsNow)
      setUpdatedAt(res.data?.policy.updated_at ?? updatedAt)
      setChangeFlow(null)
      setConfirmToggle(null)
      // As on the other policy pages: activation and assignment changes
      // confirm with a toast, and a rule edit just updates its row, unless
      // access was kept for people using a connector (only the toast says so).
      const keptNote = kept
        ? ` ${kept.people} ${kept.people === 1 ? "user keeps" : "users keep"} access to ${kept.connectors} ${kept.connectors === 1 ? "connector" : "connectors"} they use.`
        : ""
      if (activating) toast({ title: "Success", description: `Policy activated successfully.${keptNote}` })
      else if (scopeChanged) toast({ title: "Success", description: `Assigned Users updated successfully.${keptNote}` })
      else if (kept) toast({ title: "Success", description: `Changes saved.${keptNote}` })
      return true
    } catch (e: any) {
      // "Nothing was changed" is the SERVER's sentence (it knows the
      // transaction rolled back); a network-level failure can't honestly
      // claim it, so the title stays outcome-neutral. Keeps saved before the
      // policy did land, so the toast says so.
      const reason = failure(activating ? "Failed to activate policy" : "Failed to update policy", e)
      toast({
        title: "Error",
        description: kept ? `Kept access for ${users(kept.people)}; the policy change wasn't saved. ${reason}` : reason,
        variant: "destructive",
      })
      // The policy wasn't saved: the rows go back to showing what the server has.
      // With a flow dialog (or the rule editor) still open its own draft
      // carries the retry, so the page draft can revert regardless.
      discardDraft()
      return false
    } finally {
      setSaving(false)
    }
  }

  const deactivate = async () => {
    if (!id || !accessToken) return
    setSaving(true)
    try {
      const res = await traceforcApi.updatePolicy(accessToken, id, { policy_status: 2 })
      if (res.error) throw new Error(extractApiError(res.error))
      // Adopt the response: the status, and the exceptions list — it is
      // authoritative, and another admin may have edited it since this page
      // loaded; keeping the page-loaded copy would let a later dirty save
      // replay it. Then discard the draft deliberately (the confirm dialog
      // said so), resetting exceptions to the ADOPTED list — discardDraft
      // closes over the pre-update `applied`.
      const nextExceptions = res.data
        ? [...res.data.policy.exception_types].sort((a, b) => a - b)
        : applied.exceptionTypes
      setApplied((p) => ({
        ...p,
        active: res.data ? res.data.policy.policy_status === 1 : false,
        exceptionTypes: nextExceptions,
      }))
      discardDraft()
      setExceptionTypes([...nextExceptions])
      setConfirmToggle(null)
      toast({ title: "Success", description: "Policy deactivated successfully" })
    } catch (e: any) {
      toast({ title: "Error", description: failure("Failed to deactivate policy", e), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  // Save the header edit (name + description in one write, like
  // PolicyDetail). The default policy's name is the delete guard's key and is
  // locked (the input is disabled; the name is never written for it); no
  // policy may take that name for the same reason. Name collisions render
  // INLINE under the input (field errors live where the fix is); only system
  // failures toast. The reserved default name is always occupied anyway, so
  // both checks share one message.
  const saveHeader = async () => {
    if (!id || !activeOrgId) return
    const nextName = draftName.trim()
    const nextDescription = draftDescription.trim()
    if (!nextName) return
    const nameChanged = !isDefaultPolicy && nextName !== policyName
    const descriptionChanged = nextDescription !== policyDescription
    if (!nameChanged && !descriptionChanged) {
      setEditingHeader(false)
      setNameError(null)
      return
    }
    if (nameChanged && nextName === DEFAULT_MCP_ACCESS_POLICY_NAME) {
      setNameError("A policy with this name already exists.")
      return
    }
    const updates: { name?: string; description?: string } = {}
    if (nameChanged) updates.name = nextName
    if (descriptionChanged) updates.description = nextDescription
    // The policies updated_at trigger stamps the row; we just read it back.
    const { data: row, error: updateErr } = await supabase
      .from("policies")
      .update(updates)
      .eq("id", id)
      .eq("org_id", activeOrgId)
      .select("updated_at")
      .maybeSingle()
    if (updateErr) {
      if ((updateErr as any).code === "23505" && updateErr.message?.includes("policies_name_org_key")) {
        setNameError("A policy with this name already exists.")
      } else {
        toast({ title: "Error", description: failure("Failed to update policy", updateErr.message), variant: "destructive" })
      }
      return
    }
    if (nameChanged) setPolicyName(nextName)
    if (descriptionChanged) setPolicyDescription(nextDescription)
    if (row?.updated_at) setUpdatedAt(row.updated_at)
    setEditingHeader(false)
    setNameError(null)
    toast({ title: "Success", description: "Policy updated successfully" })
  }

  // Delete (non-default only). Same copy as PolicyDetail's delete confirm.
  const handleDelete = async () => {
    if (!id || !activeOrgId) return
    setSaving(true)
    try {
      const { error: delErr } = await supabase
        .from("policies")
        .delete()
        .eq("id", id)
        .eq("org_id", activeOrgId)
      if (delErr) throw delErr
      toast({ title: "Success", description: "Policy deleted successfully" })
      // Back where the page was opened from, like the back button.
      navigate(back.path, { state: back.state })
    } catch (e: any) {
      toast({ title: "Error", description: failure("Failed to delete policy", e), variant: "destructive" })
      setSaving(false)
    }
  }

  // Framework link (same params PolicyDetail sends): the source policy for
  // back-navigation, plus — from the Resource Type rule — the rule id so the
  // framework page scrolls to and highlights that row.
  const openMcpFramework = ({ highlightRule = false } = {}) => {
    if (!mcpFramework) {
      navigate("/risk-frameworks")
      return
    }
    const params = new URLSearchParams()
    if (highlightRule && categoriesRuleId) params.set("risk_attribute", categoriesRuleId)
    if (id) params.set("source_policy", id)
    const qs = params.toString()
    navigate(`/risk-frameworks/${mcpFramework.id}${qs ? `?${qs}` : ""}`)
  }

  // Rows for the "allowed MCPs" dialogs.
  const allowedDialogMcps = useMemo(() => {
    if (allowedDialog === "risk") return allowedByRisk
    if (allowedDialog === "categories") return allowedByCategories
    if (allowedDialog === "summary") return allowedMcps
    if (allowedDialog === "exceptions") return exceptionMcps
    return []
  }, [allowedDialog, allowedByRisk, allowedByCategories, allowedMcps, exceptionMcps])
  const shownAllowedMcps = useMemo(() => {
    const q = allowedQuery.trim().toLowerCase()
    return q ? allowedDialogMcps.filter((m) => m.name.toLowerCase().includes(q)) : allowedDialogMcps
  }, [allowedDialogMcps, allowedQuery])

  const categoryDialogMcps = useMemo(
    () => (categoryDialog ? catalog.filter((m) => m.categoryId === categoryDialog.id) : []),
    [categoryDialog, catalog],
  )

  /** The rule editor's values differ from the page's (so Review has something
   * to show). */
  const sameSet = <T,>(a: T[], b: T[]) => a.length === b.length && a.every((x) => b.includes(x))
  const editorChanged =
    !!editorConditions &&
    (editorConditions.riskThreshold !== draftConditions.riskThreshold ||
      editorConditions.categoriesEnabled !== draftConditions.categoriesEnabled ||
      !sameSet(editorConditions.deniedCategoryIds, draftConditions.deniedCategoryIds) ||
      !sameSet(editorConditions.exceptionTypes, draftConditions.exceptionTypes))

  // --- Review and keep steps (shared by the rule editor and changeFlow) -----
  const usersUse = (n: number) => `${users(n)} ${n === 1 ? "uses" : "use"}`
  const connectorsWord = (n: number) => `${n} ${n === 1 ? "connector" : "connectors"}`

  /** What a rule change does: the connectors it newly blocks and allows, in
   * one scroll area with sticky section headers; ones in use first, tagged. */
  const renderRuleDiff = (diff: { blocked: CatalogMcp[]; allowed: CatalogMcp[] }) => {
    const summary = [
      diff.blocked.length > 0 ? `${connectorsWord(diff.blocked.length)} will be blocked` : null,
      diff.allowed.length > 0 ? `${diff.allowed.length} will be allowed` : null,
    ].filter(Boolean)
    const rows = (list: CatalogMcp[]) =>
      list.map((m) => (
        <div key={m.type} className="flex items-center gap-3 border-b px-3 py-1.5 text-sm last:border-b-0">
          <span className="min-w-0 flex-1 truncate">{m.name}</span>
          {catalogUsage.has(m.type) && (
            <Badge variant="outline" className="shrink-0 text-xs font-normal">
              In use
            </Badge>
          )}
          {m.avgScore != null && <span className="shrink-0">{getRiskBadge(m.avgScore)}</span>}
        </div>
      ))
    const header = "sticky top-0 z-10 border-b bg-muted px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground"
    return (
      <div className="space-y-3">
        <p className="text-sm font-medium">{summary.length > 0 ? summary.join(" · ") : "No connectors change"}</p>
        {!applied.active && (
          <p className="text-sm text-muted-foreground">This policy is off. No one is affected until you activate it.</p>
        )}
        {summary.length > 0 && (
          <div className="max-h-[min(24rem,50vh)] overflow-y-auto rounded-md border">
            {diff.blocked.length > 0 && (
              <>
                <div className={header}>Will be blocked ({diff.blocked.length})</div>
                {rows(diff.blocked)}
              </>
            )}
            {diff.allowed.length > 0 && (
              <>
                <div className={header}>Will be allowed ({diff.allowed.length})</div>
                {rows(diff.allowed)}
              </>
            )}
          </div>
        )}
      </div>
    )
  }

  /** The keep step: people using connectors the change blocks, by group. */
  const renderKeep = (keep: BlockedSet, what: "change" | "policy") => (
    <div className="space-y-3">
      <p className="text-sm">
        {usersUse(new Set(keep.devices.map((d) => d.person)).size)} connectors this {what} blocks. Keeping a group
        lets everyone in it use the connector.
      </p>
      <AccessLinesList
        lines={keep.lines}
        connectorName={connectorName}
        groupLabel={groupLabel}
        groupSize={groupSize}
        selected={keepSelected}
        onChange={setKeepSelected}
        verb="Keep"
      />
    </div>
  )
  const keepFooter = (keep: BlockedSet) => {
    const losing = peopleStillBlocked(keep, keepSelected)
    return (
      <span className="text-sm text-muted-foreground">
        {losing > 0 ? `${users(losing)} ${losing === 1 ? "loses" : "lose"} access` : "Nobody using them loses access"}
      </span>
    )
  }

  /** The Assigned Users review: who this policy starts and stops covering,
   * and where people it stops covering end up. */
  const renderScopeReview = (draft: SaveDraft) => {
    const fallback = (groupId: string | null) =>
      groupId && specificallyGoverned.has(groupId)
        ? "Still covered by another access policy"
        : otherOrgWideName
          ? `Now follow ${otherOrgWideName}`
          : "No policy: can use any connector"
    const groupRow = (gid: string, note?: string) => {
      const size = groupSize(gid)
      return (
        <div key={gid} className="flex items-center justify-between gap-3 px-3 py-1.5 text-sm">
          <span className="min-w-0 truncate">
            {groupLabel(gid)}
            {size && <span className="text-muted-foreground"> · {size}</span>}
          </span>
          {note && <span className="shrink-0 text-muted-foreground">{note}</span>}
        </div>
      )
    }
    const header = "px-3 pt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground"
    const wasAll = applied.grantScope === "1"
    const nowAll = draft.grantScope === "1"
    const added = draft.selectedGroupIds.filter((g) => !applied.selectedGroupIds.includes(g))
    const removed = applied.selectedGroupIds.filter((g) => !draft.selectedGroupIds.includes(g))
    return (
      <div className="space-y-3">
        {!applied.active && (
          <p className="text-sm text-muted-foreground">This policy is off. No one is affected until you activate it.</p>
        )}
        <div className="max-h-[min(20rem,45vh)] overflow-y-auto rounded-md border pb-2">
          {wasAll && !nowAll && (
            <>
              <div className={header}>Now covers</div>
              {draft.selectedGroupIds.map((g) => groupRow(g))}
              <div className={header}>Everyone else</div>
              <div className="px-3 py-1.5 text-sm text-muted-foreground">{fallback(null)}</div>
            </>
          )}
          {!wasAll && nowAll && <div className="px-3 pt-2 text-sm">This policy will cover all users.</div>}
          {!wasAll && !nowAll && (
            <>
              {added.length > 0 && (
                <>
                  <div className={header}>Added</div>
                  {added.map((g) => groupRow(g))}
                </>
              )}
              {removed.length > 0 && (
                <>
                  <div className={header}>Removed</div>
                  {removed.map((g) => groupRow(g, fallback(g)))}
                </>
              )}
            </>
          )}
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-6 p-6">
      {/* Header — one row like PolicyDetail: back button, then the title
          block to its right, then the action cluster pushed to the far
          right. */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate(back.path, { state: back.state })}>
          <ArrowLeft className="h-4 w-4" />
          {back.label}
        </Button>
        <div className="flex-1">
          {editingHeader ? (
            <div className="max-w-2xl space-y-3">
              {/* The default policy's NAME is locked — the Policies page's
                  delete guard matches it by name. Its description edits
                  normally, so only the field is disabled, not the mode. */}
              <Input
                value={draftName}
                onChange={(e) => {
                  setDraftName(e.target.value)
                  // Field errors clear the moment the field changes.
                  setNameError(null)
                }}
                disabled={isDefaultPolicy}
                className="text-2xl font-bold"
                placeholder="Policy name..."
              />
              {nameError && <p className="text-sm text-destructive">{nameError}</p>}
              <Textarea
                value={draftDescription}
                onChange={(e) => setDraftDescription(e.target.value)}
                className="resize-none"
                placeholder="Policy description..."
                rows={2}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => void saveHeader()} disabled={!draftName.trim()}>
                  <Check className="h-4 w-4" />
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingHeader(false)
                    setNameError(null)
                  }}
                >
                  <X className="h-4 w-4" />
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-3">
                {policyName ? (
                  <h1 className="text-3xl font-bold text-foreground">{policyName}</h1>
                ) : (
                  <Skeleton className="h-8 w-64" />
                )}
                {!loading && !error && getPolicyStatusBadge(applied.active ? 1 : 2)}
                {/* Activate / edit icons beside the badge, as on the other
                    policy pages. Activating checks first: if people using a
                    connector would be blocked, the keep step is the confirm. */}
                {!loading && !error && (
                  <div className="flex items-center gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={saving || previewing || (!applied.active && (orphanedScope || accessUsage.loading))}
                          onClick={() => {
                            if (applied.active) setConfirmToggle("deactivate")
                            else void openChange("activate")
                          }}
                          aria-label={applied.active ? "Deactivate policy" : "Activate policy"}
                        >
                          {previewing ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : applied.active ? (
                            <PowerOff className="h-4 w-4" />
                          ) : (
                            <Power className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{applied.active ? "Deactivate policy" : "Activate policy"}</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          aria-label="Edit policy"
                          onClick={() => {
                            setDraftName(policyName)
                            setDraftDescription(policyDescription)
                            setEditingHeader(true)
                          }}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Edit policy</TooltipContent>
                    </Tooltip>
                  </div>
                )}
              </div>
              {policyDescription && (
                <p className="text-muted-foreground">{policyDescription}</p>
              )}
              {createdAt && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Created {new Date(createdAt).toLocaleDateString()}
                  {updatedAt ? ` · Updated ${new Date(updatedAt).toLocaleDateString()}` : ""}
                </p>
              )}
            </div>
          )}
        </div>
        {/* Wraps so a narrow viewport drops the cluster to a second line
            instead of overflowing off-screen. No Save / Discard here: every
            rule and the scope save from their own editor. */}
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          {/* The default policy is not deletable (the list's delete guard
              keys on its name); any other access policy deletes normally. */}
          {!loading && !error && !isDefaultPolicy && (
            <Button variant="destructive" size="sm" disabled={saving} onClick={() => setShowDeleteDialog(true)}>
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          )}
        </div>
      </div>

      {/* Activate / deactivate confirm (house pattern — PolicyDetail gates the
          same toggle; activation that newly blocks people using a connector
          confirms via the keep step instead). */}
      <Dialog open={confirmToggle !== null} onOpenChange={(o) => !o && !saving && setConfirmToggle(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{confirmToggle === "deactivate" ? "Deactivate" : "Activate"} Policy</DialogTitle>
            <DialogDescription>
              Are you sure you want to {confirmToggle === "deactivate" ? "deactivate" : "activate"} policy "{policyName}"?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" disabled={saving} onClick={() => setConfirmToggle(null)}>
              Cancel
            </Button>
            <Button
              variant="default"
              disabled={saving}
              onClick={() => {
                if (confirmToggle === "deactivate") void deactivate()
                else void commitSave(true)
              }}
            >
              {confirmToggle === "deactivate" ? "Deactivate" : "Activate"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Disable Rule confirm for the Resource Type switch (same copy as
          PolicyDetail). Turning a blocking rule off only widens access, so the
          save goes straight through after this. */}
      <Dialog open={confirmDisableRule} onOpenChange={(o) => !o && !saving && setConfirmDisableRule(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disable Rule</DialogTitle>
            <DialogDescription>Are you sure you want to disable this rule?</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" disabled={saving} onClick={() => setConfirmDisableRule(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={saving || previewing}
              onClick={() => {
                setConfirmDisableRule(false)
                setCategoriesEnabled(false)
                void commitSave(false, { ...pageDraft, categoriesEnabled: false })
              }}
            >
              Disable
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm (non-default policies only; same copy as PolicyDetail). */}
      <Dialog open={showDeleteDialog} onOpenChange={(o) => !o && !saving && setShowDeleteDialog(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Policy</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete policy "{policyName}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" disabled={saving} onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={saving} onClick={() => void handleDelete()}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Activation and Assigned Users ----------------------------------------- */}
      {/* Assigned Users opens on its review (who's added, removed, and where
          they end up); either change goes to the keep step when it would
          newly block people using a connector. For activation the keep step
          is the confirmation. */}
      <Dialog
        open={!!changeFlow}
        onOpenChange={(o) => {
          if (o || saving) return
          setChangeFlow(null)
          discardDraft() // nothing was saved; rows show the server's state again
        }}
      >
        <DialogContent className="grid-cols-[minmax(0,1fr)] sm:max-w-lg" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>
              {changeFlow?.kind === "activate"
                ? "Activate policy?"
                : changeFlow?.step === "keep"
                  ? "Keep access for current users?"
                  : "Review changes"}
            </DialogTitle>
          </DialogHeader>
          {changeFlow?.step === "review" && renderScopeReview(changeFlow.draft)}
          {changeFlow?.step === "keep" && renderKeep(changeFlow.keep, changeFlow.kind === "activate" ? "policy" : "change")}
          <DialogFooter className="items-center sm:justify-between">
            {changeFlow?.step === "keep" ? keepFooter(changeFlow.keep) : <span />}
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={saving}
                onClick={() => {
                  if (changeFlow?.kind === "scope" && changeFlow.step === "keep") {
                    setChangeFlow((f) => f && { ...f, step: "review" })
                    return
                  }
                  setChangeFlow(null)
                  discardDraft()
                }}
              >
                {changeFlow?.kind === "scope" && changeFlow.step === "keep" ? "Back" : "Cancel"}
              </Button>
              {changeFlow?.step === "review" && changeFlow.keep.lines.length > 0 ? (
                <Button onClick={() => setChangeFlow((f) => f && { ...f, step: "keep" })}>Next</Button>
              ) : (
                <Button
                  disabled={saving}
                  onClick={() =>
                    changeFlow && void saveChange(changeFlow.kind === "activate", changeFlow.draft, changeFlow.keep)
                  }
                >
                  {saving ? "Saving…" : changeFlow?.kind === "activate" ? "Activate" : "Save changes"}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Couldn&apos;t load the policy</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      ) : (
        !error && (
          <>
            {/* Summary cards — same row as PolicyDetail, Framework first ------ */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Layers className="h-4 w-4" />
                    Framework
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {mcpFramework ? (
                    <Button
                      variant="link"
                      className="h-auto w-full justify-start whitespace-normal break-words p-0 text-left text-md transition-colors hover:text-primary"
                      onClick={() => openMcpFramework()}
                    >
                      {mcpFramework.name}
                    </Button>
                  ) : (
                    <p className="text-md font-bold text-muted-foreground">None</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Shield className="h-4 w-4" />
                    Allowed Connectors
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <button
                    type="button"
                    className="disabled:cursor-default"
                    disabled={allowedMcps.length === 0}
                    onClick={() => setAllowedDialog("summary")}
                  >
                    <Badge
                      variant="warning"
                      className={allowedMcps.length === 0 ? undefined : "cursor-pointer hover:underline"}
                    >
                      {allowedMcps.length.toLocaleString()} of {catalog.length.toLocaleString()} connectors
                    </Badge>
                  </button>
                  {/* Same detail-text treatment as the scan policy cards'
                      assignment lists (text-sm, muted). */}
                  <p className="mt-2 text-sm text-muted-foreground">
                    Applies to {MCP_ACCESS_AGENTS}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Shield className="h-4 w-4" />
                    Assigned Users
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {editingGrantScope ? (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Assignment</Label>
                        <Select
                          value={draftGrantScope}
                          onValueChange={(value) => {
                            setDraftGrantScope(value as "1" | "2")
                            if (value === "1") setDraftGroupIds([])
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select scope..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">All Users</SelectItem>
                            <SelectItem value="2">Selected Users</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {draftGrantScope === "2" && (
                        <div>
                          <Label>Select User Groups</Label>
                          <MultiSelect
                            options={groupPickerOptions}
                            selectedIds={draftGroupIds}
                            onChange={setDraftGroupIds}
                            placeholder="Select user groups..."
                            searchPlaceholder="Search user groups..."
                            emptyMessage="No user groups found."
                            label="user group"
                          />
                          <a
                            href="/devices?tab=user-groups"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1.5 inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80 hover:underline"
                          >
                            Manage user groups <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            // Opens the review (who's added and removed, and
                            // whom it would newly block).
                            setGrantScope(draftGrantScope)
                            setSelectedGroupIds(scopeEditorGroups)
                            setEditingGrantScope(false)
                            void openChange("scope", { ...pageDraft, grantScope: draftGrantScope, selectedGroupIds: scopeEditorGroups })
                          }}
                          disabled={
                            !scopeEditorChanged ||
                            previewing ||
                            saving ||
                            accessUsage.loading ||
                            (draftGrantScope === "2" && draftGroupIds.length === 0)
                          }
                        >
                          {previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                          Review
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingGrantScope(false)}>
                          <X className="h-4 w-4" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        {/* Shared with PolicyDetail. Selected ids beyond the live
                            groups are tombstoned attachments (ghosts). */}
                        {getDeviceAssignmentContent(
                          Number(grantScope),
                          2,
                          selectedGroups,
                          selectedGroupIds.length > selectedGroups.length,
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={previewing}
                        onClick={() => {
                          setDraftGrantScope(grantScope)
                          // Live ids only: ghosts have no checkbox in the
                          // picker; Done re-appends them (see ghostGroupIds).
                          setDraftGroupIds(selectedGroupIds.filter((id) => !ghostGroupIds.includes(id)))
                          setEditingGrantScope(true)
                        }}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Risk score limit + connector exceptions --------------------------- */}
            {/* One table for the two conditions that are NOT framework rules (the
                risk limit and the exceptions are both policies columns), kept
                apart from Policy Controls. No card title: the rows name
                themselves. pt-6 restores the top padding CardContent drops in
                favour of a header. */}
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4 rounded-lg border bg-card p-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[350px]">Rule</TableHead>
                        <TableHead>Requirement</TableHead>
                        <TableHead className="w-[150px]">Allowed Connectors</TableHead>
                        <TableHead className="w-[200px]">On Violation</TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell>
                          {/* Not a link: the threshold applies against the
                              framework's overall scoring, so there is no
                              single rule row to navigate to. */}
                          <div className="font-medium">Risk score limit</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            Which risk levels this policy admits
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-semibold">
                            {RISK_OPTIONS.find((o) => o.value === thresholdToOption(riskThreshold))?.label ?? "Allow all"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <button
                            type="button"
                            className="font-semibold text-primary hover:underline disabled:cursor-default disabled:text-muted-foreground disabled:no-underline"
                            disabled={allowedByRisk.length === 0}
                            onClick={() => setAllowedDialog("risk")}
                          >
                            {allowedByRisk.length}
                          </button>
                        </TableCell>
                        <TableCell>{getRemediationBadge("Block connector", 4)}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label="Edit risk score limit"
                            disabled={previewing || saving}
                            onClick={() => openRuleEditor("risk")}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>

                      {/* The "always allow" list — a policy-level condition stored in
                          the policies.exception_types column and evaluated by the
                          resolver ahead of the risk and category rules (decisions still
                          outrank it). Not a framework rule, hence a row here beside the
                          risk limit rather than in Policy Controls (framework-linked
                          rules); no switch, and no violation of its own. */}
                      <TableRow>
                        <TableCell>
                          <div className="font-medium">Connector exceptions</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            Always allowed, regardless of other rules
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {exceptionMcps.length === 0 ? (
                            <span className="text-muted-foreground">None</span>
                          ) : (
                            <span className="text-sm font-medium">
                              {exceptionMcps.length} {exceptionMcps.length === 1 ? "connector" : "connectors"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <button
                            type="button"
                            className="font-semibold text-primary hover:underline disabled:cursor-default disabled:text-muted-foreground disabled:no-underline"
                            disabled={exceptionMcps.length === 0}
                            onClick={() => setAllowedDialog("exceptions")}
                          >
                            {exceptionMcps.length}
                          </button>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">—</span>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label="Edit connector exceptions"
                            disabled={previewing || saving}
                            onClick={() => openRuleEditor("exceptions")}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Policy controls -------------------------------------------------- */}
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
              <CardContent className="space-y-6">
                {/* One row today: Resource Type (Identity Control isn't rendered yet). */}
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold">Enforceable Controls</h3>
                  <Badge variant="secondary">1</Badge>
                </div>

                {/* The categories condition. Switching it on opens the rule editor
                    (Review, then Keep if needed); switching it off confirms and
                    saves. The pencil opens the editor for the per-category values.
                    (Identity Control deliberately not rendered — its control row
                    stays disabled in the data model until its UI ships.) */}
                <div className="space-y-3">
                  <div className="ml-1">
                    <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Enforceable by Traceforce
                    </h4>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]" />
                        <TableHead className="w-[350px]">Rule</TableHead>
                        <TableHead>Requirement</TableHead>
                        <TableHead className="w-[150px]">Allowed Connectors</TableHead>
                        <TableHead className="w-[200px]">On Violation</TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow className={!categoriesEnabled ? "opacity-50" : ""}>
                        <TableCell>
                          <Switch
                            checked={categoriesEnabled}
                            onCheckedChange={(checked) => {
                              // As on the other policy pages: on opens the
                              // rule's editor to pick values first; off confirms.
                              if (checked) openRuleEditor("categories", true)
                              else setConfirmDisableRule(true)
                            }}
                            aria-label="Enable Resource Type"
                            disabled={previewing || saving}
                          />
                        </TableCell>
                        <TableCell>
                          <button
                            type="button"
                            className="font-medium text-primary hover:underline"
                            onClick={() => openMcpFramework({ highlightRule: true })}
                          >
                            {categoriesRule?.name ?? "Resource Type"}
                          </button>
                          {categoriesRule?.description && (
                            <div className="mt-1 text-xs text-muted-foreground">{categoriesRule.description}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          {/* As on the other policy pages: a narrowed list reads
                              "Disallow certain … (N)" and opens its editor; off
                              reads "Disabled". */}
                          {!categoriesEnabled ? (
                            <span className="text-muted-foreground">Disabled</span>
                          ) : (() => {
                            const blocked = categories.filter((c) => deniedCategoryIds.includes(c.id)).length
                            return blocked === 0 ? (
                              <span className="text-sm font-medium">Allow all resource types</span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => openRuleEditor("categories")}
                                disabled={previewing || saving}
                                className="text-sm font-medium text-left underline decoration-dotted underline-offset-2 hover:opacity-80 transition-opacity disabled:cursor-not-allowed"
                              >
                                Disallow certain resource types ({blocked})
                              </button>
                            )
                          })()}
                        </TableCell>
                        <TableCell>
                          <button
                            type="button"
                            className="font-semibold text-primary hover:underline disabled:cursor-default disabled:text-muted-foreground disabled:no-underline"
                            disabled={!categoriesEnabled || allowedByCategories.length === 0}
                            onClick={() => setAllowedDialog("categories")}
                          >
                            {categoriesEnabled ? allowedByCategories.length : "—"}
                          </button>
                        </TableCell>
                        <TableCell>
                          {categoriesEnabled ? (
                            getRemediationBadge("Block connector", 4)
                          ) : (
                            <span className="text-muted-foreground">Disabled</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {/* Hidden while disabled, as on the other policy pages:
                              there are no values to edit until the rule is on. */}
                          {categoriesEnabled && (
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label="Edit resource type"
                              disabled={previewing || saving}
                              onClick={() => openRuleEditor("categories")}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        )
      )}

      {/* Rule editor ---------------------------------------------------------- */}
      {/* Behind each row's pencil, as on the other policy pages. Edit the rule,
          Review what it changes, and only if people using a connector would be
          newly blocked, Keep access for their groups; then Save. */}
      <Dialog open={!!ruleEditor} onOpenChange={(o) => !o && !saving && setRuleEditor(null)}>
        <DialogContent
          // minmax(0,1fr): the dialog is a grid, and a grid track otherwise
          // grows to its widest child, pushing long lists past the edge.
          className="grid-cols-[minmax(0,1fr)] sm:max-w-lg"
          // Only the edit step has a description; tells Radix that's intended.
          {...(ruleEditor?.step !== "edit" ? { "aria-describedby": undefined } : {})}
        >
          <DialogHeader>
            <DialogTitle>
              {ruleEditor?.step === "review"
                ? "Review changes"
                : ruleEditor?.step === "keep"
                  ? "Keep access for current users?"
                  : ruleEditor?.rule === "risk"
                  ? "Risk score limit"
                  : ruleEditor?.rule === "categories"
                    ? (categoriesRule?.name ?? "Resource Type")
                    : "Connector exceptions"}
            </DialogTitle>
            {/* The review and keep steps' own lines say what they show. */}
            {ruleEditor?.step === "edit" && (
              <DialogDescription>
                {ruleEditor?.rule === "risk"
                  ? "Which risk levels this policy admits"
                  : ruleEditor?.rule === "categories"
                    ? categoriesRule?.description ?? ""
                    : "Always allowed, regardless of other rules"}
              </DialogDescription>
            )}
          </DialogHeader>

          {ruleEditor?.step === "edit" && ruleEditor.rule === "risk" && (
            <Select
              value={thresholdToOption(ruleEditor.riskThreshold)}
              onValueChange={(value) => setRuleEditor((e) => e && { ...e, riskThreshold: optionToThreshold(value) })}
            >
              <SelectTrigger aria-label="Maximum allowed risk level">
                <SelectValue placeholder="Select level" />
              </SelectTrigger>
              <SelectContent>
                {RISK_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {ruleEditor?.step === "edit" && ruleEditor.rule === "exceptions" && (
            <div className="space-y-1.5">
              <MultiSelect
                options={exceptionOptions}
                selectedIds={editorVisibleExceptionIds}
                onChange={(ids) =>
                  setRuleEditor((e) => {
                    if (!e) return e
                    // Merge the picker's selection back into the full list:
                    // types outside its option set are neither added nor removed.
                    const pickable = new Set(sortedCatalog.map((m) => m.type))
                    return { ...e, exceptionTypes: [...e.exceptionTypes.filter((t) => !pickable.has(t)), ...ids.map(Number)] }
                  })
                }
                placeholder="Select connectors..."
                searchPlaceholder="Search connectors..."
                emptyMessage="No connectors found."
                label="connector"
              />
            </div>
          )}

          {ruleEditor?.step === "edit" && ruleEditor.rule === "categories" && (
            <div className="max-h-[min(22rem,50vh)] overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Value</TableHead>
                    <TableHead className="w-[96px]">Connectors</TableHead>
                    <TableHead className="w-[130px]">
                      Access
                      {/* Bulk form of the row dropdowns, like the Connectors
                          Access header. Acts on the listed rows only, so stored
                          ids the table doesn't show are kept, as with a row edit. */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="ml-1 h-6 w-6 align-middle" aria-label="Access column actions">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() =>
                              setRuleEditor((e) => {
                                if (!e) return e
                                const listed = new Set(categories.map((c) => c.id))
                                return { ...e, deniedCategoryIds: e.deniedCategoryIds.filter((id) => !listed.has(id)) }
                              })
                            }
                          >
                            <ShieldCheck className="h-4 w-4 mr-2" />
                            Allow all
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              setRuleEditor((e) => {
                                if (!e) return e
                                const added = categories.map((c) => c.id).filter((id) => !e.deniedCategoryIds.includes(id))
                                return { ...e, deniedCategoryIds: [...e.deniedCategoryIds, ...added] }
                              })
                            }
                          >
                            <ShieldX className="h-4 w-4 mr-2" />
                            Block all
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <Badge variant="secondary" className="font-normal">
                          {c.name}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {/* The category's MCP list opens in its own dialog, layered
                            over this one; each Esc / outside click peels one layer. */}
                        <button
                          type="button"
                          className="font-medium text-primary hover:underline disabled:cursor-default disabled:text-muted-foreground disabled:no-underline"
                          disabled={c.count === 0}
                          onClick={() => setCategoryDialog({ id: c.id, name: c.name })}
                        >
                          {c.count}
                        </button>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={ruleEditor.deniedCategoryIds.includes(c.id) ? "blocked" : "allowed"}
                          onValueChange={(v) =>
                            setRuleEditor((e) =>
                              e && {
                                ...e,
                                deniedCategoryIds:
                                  v === "blocked"
                                    ? e.deniedCategoryIds.includes(c.id)
                                      ? e.deniedCategoryIds
                                      : [...e.deniedCategoryIds, c.id]
                                    : e.deniedCategoryIds.filter((x) => x !== c.id),
                              },
                            )
                          }
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="allowed">Allowed</SelectItem>
                            <SelectItem value="blocked">Blocked</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {ruleEditor?.step === "review" && ruleEditor.diff && renderRuleDiff(ruleEditor.diff)}
          {ruleEditor?.step === "keep" && ruleEditor.keep && renderKeep(ruleEditor.keep, "change")}

          <DialogFooter className="items-center sm:justify-between">
            {ruleEditor?.step === "keep" && ruleEditor.keep ? keepFooter(ruleEditor.keep) : <span />}
            <div className="flex gap-2">
              {ruleEditor?.step === "edit" ? (
                <>
                  <Button variant="outline" onClick={() => setRuleEditor(null)}>
                    Cancel
                  </Button>
                  {/* The check finishes before Review opens, so the next
                      screen's buttons never change under the cursor. */}
                  <Button disabled={!editorChanged || previewing || accessUsage.loading} onClick={() => void openReview()}>
                    {previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Review
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    disabled={saving}
                    onClick={() => setRuleEditor((e) => e && { ...e, step: e.step === "keep" ? "review" : "edit" })}
                  >
                    Back
                  </Button>
                  {ruleEditor?.step === "review" && (ruleEditor.keep?.lines.length ?? 0) > 0 ? (
                    <Button onClick={() => setRuleEditor((e) => e && { ...e, step: "keep" })}>Next</Button>
                  ) : (
                    <Button
                      disabled={saving || orphanedScope}
                      onClick={() => void saveRuleEditor()}
                    >
                      {saving ? "Saving…" : "Save changes"}
                    </Button>
                  )}
                </>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category MCPs dialog ------------------------------------------------- */}
      <Dialog open={!!categoryDialog} onOpenChange={(o) => !o && setCategoryDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{categoryDialog?.name}</DialogTitle>
            <DialogDescription>
              {categoryDialogMcps.length} {categoryDialogMcps.length === 1 ? "connector" : "connectors"} in this category
            </DialogDescription>
          </DialogHeader>
          <ul className="max-h-80 space-y-1.5 overflow-y-auto">
            {categoryDialogMcps.map((m) => (
              <li key={m.type} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate">{m.name}</span>
                {m.avgScore != null && getRiskBadge(m.avgScore)}
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>

      {/* Allowed MCPs dialog -------------------------------------------------- */}
      <Dialog
        open={!!allowedDialog}
        onOpenChange={(o) => {
          if (!o) {
            setAllowedDialog(null)
            setAllowedQuery("")
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {allowedDialog === "summary"
                ? "Connectors this policy allows"
                : allowedDialog === "exceptions"
                  ? "Connector exceptions"
                  : "Connectors this rule allows"}
            </DialogTitle>
            <DialogDescription>
              {allowedDialog === "exceptions"
                ? `${allowedDialogMcps.length} ${allowedDialogMcps.length === 1 ? "connector" : "connectors"} allowed`
                : `${allowedDialogMcps.length} of ${catalog.length} connectors allowed`}
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Search connectors…"
            value={allowedQuery}
            onChange={(e) => setAllowedQuery(e.target.value)}
          />
          <ul className="max-h-80 space-y-1.5 overflow-y-auto">
            {shownAllowedMcps.length === 0 && <li className="text-sm text-muted-foreground">No connectors match.</li>}
            {shownAllowedMcps.map((m) => (
              <li key={m.type} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate">{m.name}</span>
                {m.avgScore != null && getRiskBadge(m.avgScore)}
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  )
}
