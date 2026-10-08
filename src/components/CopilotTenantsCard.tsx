import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { ChevronDown, ChevronUp } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ConnectionStateBadge } from "@/components/CopilotConnectionStateBadge"
import { formatRelative, needsAttention } from "@/lib/copilot"
import { getCopilotConnections } from "@/lib/copilotMock"
import type { CopilotConnection } from "@/lib/copilotTypes"

// Copilot tenant totals with a per-tenant breakdown (preview data).
export function CopilotTenantsCard() {
  const navigate = useNavigate()
  const [connections, setConnections] = useState<CopilotConnection[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    getCopilotConnections().then((l) => { if (!cancelled) setConnections(l) })
    return () => { cancelled = true }
  }, [])
  if (connections.length === 0) return null
  const attention = connections.filter(needsAttention).length

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Microsoft 365 Copilot</CardTitle>
        <Button variant="ghost" size="sm" onClick={() => setOpen((o) => !o)}>
          Per-tenant breakdown {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-8">
          <div><p className="text-3xl font-bold">{connections.length}</p><p className="text-sm text-muted-foreground">Tenants</p></div>
          <div><p className="text-3xl font-bold">{attention}</p><p className="text-sm text-muted-foreground">Need attention</p></div>
        </div>
        {open && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last synced</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {connections.map((c) => {
                const to = `/agents?tenant=${encodeURIComponent(c.tenant_id)}`
                return (
                <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(to)}>
                  <TableCell className="break-all font-mono text-sm">
                    {/* Real link so keyboard and screen-reader users can open the tenant too. */}
                    <Link to={to} className="hover:underline" onClick={(e) => e.stopPropagation()}>{c.tenant_id}</Link>
                  </TableCell>
                  <TableCell><ConnectionStateBadge state={c.ui_state} /></TableCell>
                  <TableCell className="text-muted-foreground">{formatRelative(c.last_synced_at) ?? "Never synced"}</TableCell>
                </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
