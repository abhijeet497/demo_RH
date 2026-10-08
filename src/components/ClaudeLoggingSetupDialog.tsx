import { useState } from "react"
import { Copy } from "lucide-react"
import claudeCoworkMonitoringImg from "/claude-cowork-monitoring.png"
import claudeCoworkCloudImg from "/claude-cowork-cloud.png"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"

// Scout's Cowork receiver binds 127.0.0.1:14318 on every device
// (traceforce-scout/otel-collector/otel-config.template.yaml). The loopback
// literal replaces the earlier collector.traceforce.co hostname, which only
// resolved to 127.0.0.1 via public DNS and made admins ask about TLS and
// "where does this go" — verified end to end against a Scout install
// (ENG-849): Claude Desktop passes it through unchanged to the Cowork engine
// on the device, so the traffic never leaves the machine (plain HTTP, no
// certificate).
const OTLP_ENDPOINT = "http://127.0.0.1:14318"

interface ClaudeLoggingSetupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Steps come from Anthropic's own docs: "Monitor Claude Cowork activity with
// OpenTelemetry" (support.claude.com) and "Telemetry and egress"
// (claude.com/docs/third-party/claude-desktop/telemetry).
export function ClaudeLoggingSetupDialog({ open, onOpenChange }: ClaudeLoggingSetupDialogProps) {
  const { toast } = useToast()
  // Holds the src of the image currently zoomed, or null when none is open.
  const [zoomedImage, setZoomedImage] = useState<string | null>(null)

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast({ title: "Success", description: `${label} copied to clipboard` })
    } catch {
      toast({ title: "Error", description: `Failed to copy ${label}`, variant: "destructive" })
    }
  }

  // Reset the zoom dialog whenever the main dialog closes, so it doesn't
  // reopen on top of it next time this dialog is shown.
  const handleOpenChange = (next: boolean) => {
    if (!next) setZoomedImage(null)
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Finish setup in Claude admin console</DialogTitle>
          <DialogDescription>
            Complete these steps in your Claude admin console to enable audit logging.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            <li>
              Open{" "}
              <a
                href="https://claude.ai/admin-settings/cowork"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline hover:no-underline"
              >
                Cowork admin settings
              </a>{" "}
              in Claude's admin console.
            </li>
            <li>Enter the OTLP endpoint below and save.</li>
          </ol>

          <button
            type="button"
            onClick={() => setZoomedImage(claudeCoworkMonitoringImg)}
            className="block w-full cursor-zoom-in rounded-md border transition-opacity hover:opacity-90"
          >
            <img
              src={claudeCoworkMonitoringImg}
              alt="Claude Cowork admin console — Monitoring section with OTLP endpoint field"
              className="w-full rounded-md"
            />
          </button>

          <div className="space-y-2">
            <Label htmlFor="otlp-endpoint">OTLP endpoint</Label>
            <div className="flex gap-2">
              <Input id="otlp-endpoint" value={OTLP_ENDPOINT} readOnly className="font-mono text-xs" />
              <Button
                variant="outline"
                size="sm"
                aria-label="Copy OTLP endpoint"
                onClick={() => copyToClipboard(OTLP_ENDPOINT, "OTLP endpoint")}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <ol className="list-decimal space-y-2 pl-5 text-sm" start={3}>
            <li>
              Turn <strong>off</strong> "Cowork in the cloud". When it's on,
              Cowork tasks run on Anthropic's cloud instead of your members'
              computers.
            </li>
          </ol>

          <button
            type="button"
            onClick={() => setZoomedImage(claudeCoworkCloudImg)}
            className="block w-full cursor-zoom-in rounded-md border transition-opacity hover:opacity-90"
          >
            <img
              src={claudeCoworkCloudImg}
              alt="Claude Cowork admin console — Cowork in the cloud toggle turned off"
              className="w-full rounded-md"
            />
          </button>
        </div>
      </DialogContent>

      <Dialog open={zoomedImage !== null} onOpenChange={(next) => !next && setZoomedImage(null)}>
        <DialogContent className="max-w-[90vw] sm:max-w-4xl">
          <DialogHeader className="sr-only">
            <DialogTitle>Claude Cowork admin console screenshot</DialogTitle>
            <DialogDescription>Zoomed view of the Claude Cowork admin console setting</DialogDescription>
          </DialogHeader>
          <div className="max-h-[80vh] overflow-auto">
            {zoomedImage && (
              <img
                src={zoomedImage}
                alt="Claude Cowork admin console setting — zoomed view"
                className="w-full min-w-[1024px] rounded-md"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}
