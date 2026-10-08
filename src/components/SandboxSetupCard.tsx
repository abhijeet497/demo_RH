import { Copy, Info } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"

const FEATURE_ID =
  import.meta.env.VITE_VERCEL_ENV !== "production"
    ? "scout-lite-dev"
    : import.meta.env.VITE_TRIAL_MODE === "true"
      ? "scout-lite-trial"
      : "scout-lite"
const SANDBOX_SNIPPET = `{
  "features": {
    "ghcr.io/traceforce/devcontainer-feature/${FEATURE_ID}:latest": {}
  }
}`

const SandboxSetupCard = () => {
  const { toast } = useToast()

  const copySnippet = async () => {
    try {
      await navigator.clipboard.writeText(SANDBOX_SNIPPET)
      toast({ title: "Success", description: "Snippet copied to clipboard" })
    } catch {
      toast({ title: "Error", description: "Failed to copy snippet", variant: "destructive" })
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Adds AI-assistant monitoring inside dev containers. Add this to your{" "}
        <code className="text-xs px-1 py-0.5 rounded bg-muted font-mono">.devcontainer/devcontainer.json</code>:
      </p>
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          The Traceforce scanner must already be installed on the host device. Dev containers rely on it to identify themselves — without it, no data will be reported.
        </AlertDescription>
      </Alert>
      <div className="relative">
        <pre className="text-xs p-3 pr-12 bg-muted rounded-md overflow-x-auto font-mono">
          {SANDBOX_SNIPPET}
        </pre>
        <Button
          variant="ghost"
          size="sm"
          onClick={copySnippet}
          className="absolute top-2 right-2 h-7 w-7 p-0"
          aria-label="Copy snippet"
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

export default SandboxSetupCard
