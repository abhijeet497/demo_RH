import { useMemo, useState } from "react"
import { ClipboardList, X } from "lucide-react"
import { useUrlStringFilter } from "@/hooks/use-url-filters"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { MultiSelect } from "@/components/ui/multi-select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/AuthContext"
import { formatDate } from "@/lib/utils"
import {
  cancelMcpAccessRequest,
  useMyMcpRequests,
  type McpRequestStatus,
  type MyMcpRequest,
} from "@/hooks/use-mcp-access"

// status: 0 unspecified · 1 pending · 2 approved · 3 denied
//         · 4 satisfied · 5 canceled.
// Status 3 reads "Declined", not "Denied": an admin decline closes the ask
// without changing access — it's "no, not now", and the user can re-request.
// Status 4 (satisfied — a policy change granted the ask with no admin
// decision) deliberately reads "Approved": the requester cares that it's a
// yes, not who said it. Provenance is an admin/audit concern.
// Status 5 (canceled) = you withdrew it; neutral, not destructive.
const statusMeta: Record<McpRequestStatus, { label: string; variant: "secondary" | "default" | "destructive" | "outline" }> = {
  0: { label: "Unknown", variant: "outline" },
  1: { label: "Pending", variant: "secondary" },
  2: { label: "Approved", variant: "default" },
  3: { label: "Declined", variant: "destructive" },
  4: { label: "Approved", variant: "default" },
  5: { label: "Canceled", variant: "outline" },
}

const LIFECYCLE_FILTER_OPTIONS = [
  { id: "open", name: "Open" },
  { id: "closed", name: "Closed" },
]

/** Pending requests are open; approved/denied/satisfied/canceled are closed. */
function isOpenRequest(status: McpRequestStatus): boolean {
  return status === 1
}

function isClosedRequest(status: McpRequestStatus): boolean {
  return status === 2 || status === 3 || status === 4 || status === 5
}

/** ENG-324 — regular-user view of their MCP access requests. */
const Requests = () => {
  const { toast } = useToast()
  const { session } = useAuth()
  const { data: requests, loading: reqLoading, error: reqError, refetch: refetchRequests } = useMyMcpRequests()

  // Empty = all; Open = pending; Closed = approved, declined or canceled.
  // URL-backed so the selection survives Back/refresh; explicit-empty is encoded
  // as "all" to keep it distinct from the absent param (the "open" default).
  const [lifecycleParam, setLifecycleParam] = useUrlStringFilter("lifecycle", "open")
  const lifecycleFilter = useMemo(
    () => (lifecycleParam === "all" ? [] : lifecycleParam.split(",").filter(Boolean)),
    [lifecycleParam]
  )
  const setLifecycleFilter = (values: string[]) =>
    setLifecycleParam(values.length === 0 ? "all" : values.join(","))

  // The pending request the user is about to cancel (drives the confirm dialog).
  const [toCancel, setToCancel] = useState<MyMcpRequest | null>(null)
  const [cancelling, setCancelling] = useState(false)

  const filteredRequests = useMemo(() => {
    if (lifecycleFilter.length === 0) return requests
    return requests.filter((r) => {
      const open = isOpenRequest(r.status)
      const closed = isClosedRequest(r.status)
      return (
        (lifecycleFilter.includes("open") && open) ||
        (lifecycleFilter.includes("closed") && closed)
      )
    })
  }, [requests, lifecycleFilter])

  const handleCancel = async () => {
    if (!toCancel) return
    if (!session?.access_token) {
      toast({
        title: "Not signed in",
        description: "Your session has expired. Please sign in again.",
        variant: "destructive",
      })
      return
    }
    setCancelling(true)
    try {
      await cancelMcpAccessRequest(session.access_token, toCancel.id)
      toast({
        title: "Request canceled",
        description: `Your request for ${toCancel.mcp_server_name} was canceled.`,
      })
      setToCancel(null)
      refetchRequests()
    } catch (e: any) {
      toast({
        title: "Could not cancel request",
        description: e?.message ?? "Something went wrong. Please try again.",
        variant: "destructive",
      })
    } finally {
      setCancelling(false)
    }
  }

  const emptyMessage = (() => {
    if (requests.length === 0) {
      return "You haven't requested any connector access yet. Open the connector registry to request one."
    }
    if (lifecycleFilter.length === 1 && lifecycleFilter[0] === "open") {
      return "No open requests. Switch the filter to Closed to see resolved ones."
    }
    if (lifecycleFilter.length === 1 && lifecycleFilter[0] === "closed") {
      return "No closed requests yet."
    }
    return "No requests match the current filter."
  })()

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-lg bg-primary/10">
          <ClipboardList className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-foreground">My Requests</h1>
          <p className="text-muted-foreground">
            Track the status of your connector access requests.
          </p>
        </div>
      </div>

      <div className="w-full max-w-xs space-y-2">
        <label className="text-sm font-medium text-muted-foreground">Status</label>
        <MultiSelect
          options={LIFECYCLE_FILTER_OPTIONS}
          selectedIds={lifecycleFilter}
          onChange={setLifecycleFilter}
          placeholder="All"
          searchPlaceholder="Search..."
          emptyMessage="No options found."
          label="status"
          compact
        />
      </div>

      <Card>
        <CardContent className="pt-6">
          {reqError ? (
            <p className="text-sm text-destructive">
              Couldn&apos;t load your requests: {reqError}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Connector</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reqLoading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredRequests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      {emptyMessage}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRequests.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.mcp_server_name}</TableCell>
                      <TableCell className="max-w-xs truncate text-muted-foreground" title={r.reason}>
                        {r.reason}
                      </TableCell>
                      <TableCell>
                        {/* Fall back to "Unknown" (status 0) if the server sends a
                            status we don't recognize, so the row never crashes. */}
                        <Badge variant={(statusMeta[r.status] ?? statusMeta[0]).variant}>
                          {(statusMeta[r.status] ?? statusMeta[0]).label}
                        </Badge>
                        {/* The admin's note to the requester (why declined /
                            any context on approval) — the request row is the
                            one place the requester sees the outcome. */}
                        {r.resolution_note && (
                          <p className="mt-1 max-w-xs text-xs text-muted-foreground" title={r.resolution_note}>
                            {r.resolution_note}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(r.created_at)}</TableCell>
                      <TableCell className="text-right">
                        {r.status === 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1.5 text-destructive hover:text-destructive"
                            onClick={() => setToCancel(r)}
                          >
                            <X className="h-4 w-4" />
                            Cancel
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={toCancel !== null} onOpenChange={(open) => !open && setToCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this request?</AlertDialogTitle>
            <AlertDialogDescription>
              Your pending request for {toCancel?.mcp_server_name} will be withdrawn. You can submit
              a new request later from the connector registry.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Keep request</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleCancel()
              }}
              disabled={cancelling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelling ? "Canceling…" : "Cancel request"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default Requests
