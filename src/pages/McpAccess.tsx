import { useState } from "react"
// Settings2 is only used by the (temporarily hidden) Set Access button below.
// import { Settings2, ShieldCheck } from "lucide-react"
import { ArrowLeft, ShieldCheck } from "lucide-react"
import { useLocation, useNavigate } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import AggregatedRequests from "@/components/AggregatedRequests"
import McpRequestHistory from "@/components/McpRequestHistory"
import SetAccessDialog from "@/components/SetAccessDialog"
import {
  useAggregatedMcpRequests,
  useMcpCatalog,
  useMcpRequestHistory,
} from "@/hooks/use-mcp-access"
import { useUrlFilterParams, useUrlStringFilter } from "@/hooks/use-url-filters"
import { connectorsBackTarget } from "@/lib/appUtils"

// ---------------------------------------------------------------------------
// MCP Access — admin view, two tabs plus the Set Access dialog:
//   1. Pending requests — undecided requests rolled up by MCP → each group
//      currently blocking the requester, so the admin can approve org-wide or
//      per group in one action.
//   2. History — the decision ledger: one row per access change (request
//      approvals and manual decisions). Declines don't appear — they change
//      no access; the outcome lives on the request, which the requester sees.
//   Set Access — record a deliberate allow/block for any MCP/scope. It is
//      hidden, so standing blocks are legacy or API-only.
// Data is loaded once here (the page stays mounted across tab switches) and
// passed down, so switching tabs never refetches. Rows carry their own
// connector names and emails; the full catalog loads only for Set Access.
// ---------------------------------------------------------------------------
const McpAccess = () => {
  const [setAccessOpen, setSetAccessOpen] = useState(false)
  const catalog = useMcpCatalog(setAccessOpen)
  const requests = useAggregatedMcpRequests(catalog.map)
  const history = useMcpRequestHistory(catalog.map)

  // Total pending requests, reported up from the aggregated view so the tab can
  // show a count without a second fetch of the request list.
  const [pendingCount, setPendingCount] = useState(0)

  // Keep the active tab in the URL (?tab=…) so a refresh restores it instead of
  // snapping back to the first tab — matching the other tabbed pages. Anything
  // other than "history" renders as "pending".
  const { searchParams } = useUrlFilterParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [tabParam, setTabParam] = useUrlStringFilter("tab", "pending")
  const activeTab = tabParam === "history" ? "history" : "pending"

  // Deep-link filter from the MCPs table's Access Status column (?mcpType=<id>),
  // restricting whichever tab is active to a single MCP.
  const [mcpTypeParam, setMcpTypeParam] = useUrlStringFilter("mcpType")
  const mcpTypeFilter = mcpTypeParam !== "" ? Number(mcpTypeParam) : null

  // Group context carried in via ?group=Name1,Name2 (URL-encoded names) —
  // seeds both tabs' group filters. Read once on mount: the filters are local
  // state after that, so toggling them doesn't churn the URL.
  const [initialGroupFilters] = useState<string[]>(() => {
    const raw = searchParams.get("group")
    return raw ? raw.split(",").map((s) => s.trim()).filter(Boolean) : []
  })

  const handleTabChange = (value: string) => {
    setTabParam(value)
    // Refresh history whenever the admin switches to it, to pick up any requests
    // just decided from the Pending tab.
    if (value === "history") history.refetch()
  }

  const handleClearMcpFilter = () => setMcpTypeParam("")

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {searchParams.get("source_mcps") && (
            <Button
              variant="ghost"
              onClick={() => {
                const t = connectorsBackTarget(location.state)
                navigate(t.path, { state: t.state })
              }}
            >
              <ArrowLeft className="h-4 w-4" />
              {connectorsBackTarget(location.state).label}
            </Button>
          )}
          <div className="p-3 rounded-lg bg-primary/10">
            <ShieldCheck className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Access Requests</h1>
            <p className="text-muted-foreground">
              One-off requests from users for connector access beyond what Control Policies allow. Review pending requests and see the history of past decisions.
            </p>
          </div>
        </div>
        {/* Set Access is temporarily hidden. The dialog below stays wired up
            (open state, catalog, groups, refetch) so re-enabling is just
            uncommenting this button and the Settings2 import above. */}
        {/* <Button variant="outline" className="gap-1.5" onClick={() => setSetAccessOpen(true)}>
          <Settings2 className="h-4 w-4" />
          Set Access
        </Button> */}
      </div>

      <SetAccessDialog
        open={setAccessOpen}
        onOpenChange={setSetAccessOpen}
        mcp={null}
        catalog={catalog.options}
        catalogError={catalog.error}
        groups={requests.groups}
        onSaved={() => {
          // A decision may sweep pending requests and always writes a History
          // row — refresh both.
          requests.refetch()
          history.refetch()
        }}
      />

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="pending" className="gap-1.5">
            Pending requests
            {pendingCount > 0 && (
              <Badge variant="secondary" className="ml-1">
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* Pending requests -------------------------------------------------- */}
        <TabsContent value="pending" className="mt-4">
          {/* Each request row carries its own connector name (joined
              server-side), so the table never waits on the catalog. */}
          <AggregatedRequests
            entries={requests.data}
            groupMembers={requests.groupMembers}
            loading={requests.loading}
            error={requests.error}
            onMutated={() => {
              // Approving sweeps requests out of Pending and writes a History
              // row; declining only shrinks Pending — refresh both regardless.
              requests.refetch()
              history.refetch()
            }}
            onPendingCountChange={setPendingCount}
            mcpTypeFilter={mcpTypeFilter}
            onClearMcpFilter={handleClearMcpFilter}
            initialGroupFilters={initialGroupFilters}
          />
        </TabsContent>

        {/* History ----------------------------------------------------------- */}
        <TabsContent value="history" className="mt-4">
          {/* Not gated on the catalog either — decision rows carry their own
              joined mcp_server_name (see the Pending tab note). */}
          <McpRequestHistory
            rows={history.data}
            loading={history.loading}
            error={history.error}
            mcpTypeFilter={mcpTypeFilter}
            onClearMcpFilter={handleClearMcpFilter}
            initialGroupFilters={initialGroupFilters}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default McpAccess
