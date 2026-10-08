import { Skeleton } from "@/components/ui/skeleton"
import type { McpAccessGroupStatusDto } from "@/integrations/traceforce/types"
import { ACCESS_OFF_LINE, mergeAccessLines, type DeviceScopeLines, type MergedAccessLine } from "@/lib/mcpAccessLines"

// Renders mergeAccessLines (lib/mcpAccessLines) for the Connectors popover and
// the Set Access dialog, so the two say the same thing in the same words.

/** One line: "Allowed: <who>" with the verdict word coloured like the badge,
 * and the reason underneath. Spans only, so it can sit inside a button. */
export const AccessLine = ({
  line,
  linked = false,
}: {
  line: Pick<MergedAccessLine, "verdict" | "who" | "reason">
  linked?: boolean
}) => {
  const blocked = line.verdict === 2 || line.verdict === 3
  const color = line.verdict === 3 ? "text-warning" : blocked ? "text-destructive" : "text-success"
  return (
    <span className="block text-left text-sm">
      <span className="block">
        <span className={`font-medium ${color}`}>{blocked ? "Blocked" : "Allowed"}:</span>{" "}
        {/* Groups wrap rather than truncate: the names are the answer. */}
        <span className="break-words">{line.who}</span>
      </span>
      <span className="block text-xs text-muted-foreground">
        {line.reason}
        {linked && " →"}
      </span>
    </span>
  )
}

/** The list. `rows` null = not settled yet (skeleton); an error reads as an
 * error. With `onLineClick`, lines that own a destination become buttons. */
export function McpAccessLines({
  rows,
  error,
  groupLabels,
  deviceScope,
  onLineClick,
}: {
  rows: McpAccessGroupStatusDto[] | null
  error: string | null
  groupLabels?: Map<string, string>
  /** The rows are some devices' scopes (see mergeAccessLines). */
  deviceScope?: DeviceScopeLines
  onLineClick?: (line: MergedAccessLine) => void
}) {
  if (error) {
    return <p className="text-sm text-destructive">Couldn&apos;t load current access: {error}</p>
  }
  if (rows === null) return <Skeleton className="h-4 w-40" />
  const lines = mergeAccessLines(rows, groupLabels, deviceScope)
  if (lines.length === 0) {
    return (
      <div className="px-1.5 py-1">
        <AccessLine line={ACCESS_OFF_LINE} />
      </div>
    )
  }
  return (
    // Cap + scroll so a many-group org can't push the host's footer
    // off-screen (matches the MultiSelect pattern).
    <div className="max-h-48 space-y-1 overflow-y-auto">
      {lines.map((line) =>
        onLineClick && line.target ? (
          <button
            key={line.key}
            type="button"
            className="block w-full rounded-md px-1.5 py-1 hover:bg-muted/50"
            onClick={() => onLineClick(line)}
          >
            <AccessLine line={line} linked />
          </button>
        ) : (
          <div key={line.key} className="px-1.5 py-1">
            <AccessLine line={line} />
          </div>
        ),
      )}
    </div>
  )
}
