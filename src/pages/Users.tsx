import { useCallback, useEffect, useState } from "react"
import { Users as UsersIcon, Mail, RefreshCw, UserPlus } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { traceforcApi } from "@/integrations/traceforce/client"
import type { OrgInvitee } from "@/integrations/traceforce/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { useUrlStringFilter } from "@/hooks/use-url-filters"
import { formatDistanceToNow } from "date-fns"

const MAX_INVITEES_PER_ORG = 10

function parseApiErrorMessage(raw: string): string {
  try {
    const m = raw.match(/\{[\s\S]*\}$/)
    if (!m) return raw
    const j = JSON.parse(m[0]) as { error?: string; details?: string }
    return [j.error, j.details].filter(Boolean).join(": ") || raw
  } catch {
    return raw
  }
}

export default function Users() {
  const { session } = useAuth()
  const { toast } = useToast()
  const [invitees, setInvitees] = useState<OrgInvitee[]>([])
  const [total, setTotal] = useState(0)
  /** Full invitee count (ignores status filter) — used for the per-org invite cap. */
  const [totalAllStatuses, setTotalAllStatuses] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [statusParam, setStatusFilter] = useUrlStringFilter("status", "all")
  // Invalid deep-link values fall back to "all" rather than reaching the API.
  const statusFilter: "all" | "pending" | "active" =
    statusParam === "pending" || statusParam === "active" ? statusParam : "all"
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviting, setInviting] = useState(false)

  const loadInvitees = useCallback(async () => {
    if (!session?.access_token) {
      setInvitees([])
      setTotal(0)
      setTotalAllStatuses(0)
      setLoading(false)
      setLoadError(false)
      return
    }
    setLoading(true)
    setLoadError(false)
    try {
      const listRes = await traceforcApi.listInvitees(session.access_token, {
        limit: 100,
        offset: 0,
        status: statusFilter,
      })

      if (listRes.error) {
        setLoadError(true)
        toast({
          title: "Could not load users",
          description: parseApiErrorMessage(listRes.error),
          variant: "destructive",
        })
        return
      }

      if (listRes.data) {
        setInvitees(listRes.data.data)
        setTotal(listRes.data.total)
        setTotalAllStatuses(listRes.data.invited_count ?? 0)
      }
    } finally {
      setLoading(false)
    }
  }, [session?.access_token, statusFilter])

  useEffect(() => {
    loadInvitees()
  }, [loadInvitees])

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    const email = inviteEmail.trim()
    if (!session?.access_token || !email) return

    setInviting(true)
    try {
      const res = await traceforcApi.inviteUserByEmail(session.access_token, { email })
      if (res.error) {
        const msg = parseApiErrorMessage(res.error)
        toast({
          title: res.statusCode === 403 ? "Invite limit reached" : "Invite failed",
          description: msg,
          variant: "destructive",
        })
        return
      }
      toast({
        title: "Invitation sent",
        description: res.data?.message ?? `An invite was sent to ${res.data?.email ?? email}.`,
      })
      setInviteEmail("")
      await loadInvitees()
    } finally {
      setInviting(false)
    }
  }

  const slotsRemaining = Math.max(0, MAX_INVITEES_PER_ORG - totalAllStatuses)

  return (
    <div className="container max-w-5xl py-8 px-4">
      <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <UsersIcon className="h-7 w-7 text-muted-foreground" />
            Users
          </h1>
          <p className="text-muted-foreground mt-1">
            Invite teammates by email. Up to {MAX_INVITEES_PER_ORG} invited users per organization.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => loadInvitees()}
          disabled={loading}
          className="shrink-0"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Invite user
            </CardTitle>
            <CardDescription>
              They will receive an email with a link to join your organization.
              <span className="block mt-1">
                {slotsRemaining === 0
                  ? "You have reached the invite limit."
                  : `${slotsRemaining} invite slot${slotsRemaining === 1 ? "" : "s"} remaining (${totalAllStatuses} of ${MAX_INVITEES_PER_ORG} used).`}
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInvite} className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-2">
                <Label htmlFor="invite-email">Email address</Label>
                <Input
                  id="invite-email"
                  type="email"
                  autoComplete="email"
                  placeholder="colleague@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  disabled={inviting || slotsRemaining === 0}
                />
              </div>
              <Button
                type="submit"
                disabled={inviting || !inviteEmail.trim() || slotsRemaining === 0}
              >
                {inviting ? "Sending…" : "Send invite"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between space-y-0">
            <div>
              <CardTitle className="text-lg">Organization members</CardTitle>
              <CardDescription>
                Users in your organization ({total} shown
                {statusFilter !== "all" ? ` · filtered` : ""}).
              </CardDescription>
            </div>
            <div className="w-full sm:w-[200px]">
              <Label htmlFor="status-filter" className="sr-only">
                Status
              </Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id="status-filter">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : loadError ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Something went wrong. Try refresh.
              </p>
            ) : invitees.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <Mail className="h-10 w-10 mb-3 opacity-40" />
                <p className="text-sm">No members match this filter.</p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden sm:table-cell">Invited</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invitees.map((row) => (
                      <TableRow key={row.user_id}>
                        <TableCell className="font-medium">
                          {row.email ?? "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={row.status === "active" ? "default" : "secondary"}
                          >
                            {row.status === "active" ? "Active" : "Pending"}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">
                          {row.invited_at
                            ? formatDistanceToNow(new Date(row.invited_at), {
                                addSuffix: true,
                              })
                            : row.profile_created_at
                              ? formatDistanceToNow(new Date(row.profile_created_at), {
                                  addSuffix: true,
                                })
                              : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
