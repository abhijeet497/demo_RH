import { useEffect, useState } from "react"
import { Send } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/AuthContext"
import { createMcpAccessRequest } from "@/hooks/use-mcp-access"

interface RequestMcpAccessDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The MCP the user is requesting access to. */
  mcpServerType: number | null
  mcpServerName: string
  /** Called after a successful submit so the caller can refetch / update UI. */
  onSubmitted?: () => void
}

/**
 * ENG-324 — modal a regular user opens from the MCP Registry to request access
 * to an MCP. Captures a required reason and submits a pending request.
 */
const RequestMcpAccessDialog = ({
  open,
  onOpenChange,
  mcpServerType,
  mcpServerName,
  onSubmitted,
}: RequestMcpAccessDialogProps) => {
  const { toast } = useToast()
  const { session } = useAuth()
  const [reason, setReason] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) setReason("")
  }, [open])

  const handleSubmit = async () => {
    const trimmed = reason.trim()
    if (mcpServerType == null) {
      toast({
        title: "Unable to submit",
        description: "This connector is missing a server type. Please refresh and try again.",
        variant: "destructive",
      })
      return
    }
    if (!session?.access_token) {
      toast({
        title: "Not signed in",
        description: "Your session has expired. Please sign in again.",
        variant: "destructive",
      })
      return
    }
    setSubmitting(true)
    try {
      // One request; the server routes it to every scope blocking the user.
      await createMcpAccessRequest(session.access_token, { mcpServerType, reason: trimmed })
      toast({
        title: "Request submitted",
        description: `Your request for ${mcpServerName} was sent to your admin for approval.`,
      })
      onOpenChange(false)
      onSubmitted?.()
    } catch (e: any) {
      // Includes the server's 409s (already pending, already allowed, not restricted).
      toast({
        title: "Could not submit request",
        description: e?.message ?? "Something went wrong. Please try again.",
        variant: "destructive",
      })
      // A 409 means the state moved under us (e.g. another tab already asked):
      // let the host refetch so its button reflects it.
      onSubmitted?.()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request access to {mcpServerName}</DialogTitle>
          <DialogDescription>
            Your request goes to your admin for approval. Add a short reason so they have the
            context they need.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Just the reason: the server routes the request to every group
              blocking the user, and groups are the admin's concern (they see
              them in Pending), so the user isn't shown them. */}
          <div className="space-y-2">
            <Label htmlFor="reason">
              Reason <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="reason"
              placeholder="e.g. I need the GitHub connector so my agent can open issues for failed builds."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              maxLength={1000}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          {/* Disabled until the reason is filled — the house pattern for
              required fields (SetAccessDialog, ImportFrameworkWizard); toasts
              are for runtime failures only. */}
          <Button
            onClick={handleSubmit}
            disabled={!reason.trim() || submitting}
            className="gap-1.5"
          >
            <Send className="h-4 w-4" />
            {submitting ? "Submitting..." : "Submit request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default RequestMcpAccessDialog
