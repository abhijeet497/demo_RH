import { Badge } from "@/components/ui/badge"
import { normalizeUiState, STATE_LABELS } from "@/lib/copilot"
import type { CopilotUiState } from "@/lib/copilotTypes"

const STATE_CLASSES: Record<CopilotUiState, string> = {
  connected: "bg-success/15 text-success border-success/30",
  attention_customer: "bg-destructive/15 text-destructive border-destructive/30",
  attention_platform: "bg-warning/15 text-warning border-warning/30",
  stale: "bg-muted text-muted-foreground border-border",
}

export function ConnectionStateBadge({ state }: { state: string }) {
  const s = normalizeUiState(state)
  return <Badge variant="outline" className={STATE_CLASSES[s]}>{STATE_LABELS[s]}</Badge>
}
