import { useMemo } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { users, type AccessLine } from "@/lib/accessUsage"

// The connector × group list behind the "Allow" dialog (Connectors page) and
// the policy editor's keep step. The host sets what starts checked: the Allow
// dialog checks every group line, the keep step starts with nothing checked.
// A "Users not in any group" line (which sits apart) allows the connector for
// all users, so it starts unchecked unless it's a single-connector dialog's
// only line. The master and per-connector checkboxes cover group lines only,
// so widening to all users is always its own deliberate click.

const usesIt = (n: number) => `${n} ${n === 1 ? "uses" : "use"} it`
const usersUseIt = (n: number) => `${users(n)} ${n === 1 ? "uses" : "use"} it`

export function AccessLinesList({
  lines,
  connectorName,
  groupLabel,
  groupSize,
  selected,
  onChange,
  verb,
}: {
  lines: AccessLine[]
  connectorName: (type: number) => string
  groupLabel: (groupId: string) => string
  /** "N members" / "N devices"; undefined (unknown) shows no size. */
  groupSize: (groupId: string) => string | undefined
  selected: Set<string>
  onChange: (next: Set<string>) => void
  /** "Keep" on the policy page, "Allow" on the Connectors page. */
  verb: "Keep" | "Allow"
}) {
  // Grouped and sorted once per list, not again on every checkbox click or
  // keystroke in the host dialog.
  const { groupLines, noGroupLines, byConnector, connectors } = useMemo(() => {
    const groupLines = lines.filter((l) => l.groupId !== null)
    const noGroupLines = lines
      .filter((l) => l.groupId === null)
      .sort((a, b) => connectorName(a.type).localeCompare(connectorName(b.type)))
    const byConnector = new Map<number, AccessLine[]>()
    for (const l of groupLines) {
      const ls = byConnector.get(l.type)
      if (ls) ls.push(l)
      else byConnector.set(l.type, [l])
    }
    for (const ls of byConnector.values()) ls.sort((a, b) => groupLabel(a.groupId!).localeCompare(groupLabel(b.groupId!)))
    const connectors = [...byConnector.keys()].sort((a, b) => connectorName(a).localeCompare(connectorName(b)))
    return { groupLines, noGroupLines, byConnector, connectors }
  }, [lines, connectorName, groupLabel])

  const checkedState = (ls: AccessLine[]) =>
    ls.every((l) => selected.has(l.key)) ? true : ls.some((l) => selected.has(l.key)) ? "indeterminate" : false
  const setMany = (keys: string[], on: boolean) => {
    const next = new Set(selected)
    for (const k of keys) {
      if (on) next.add(k)
      else next.delete(k)
    }
    onChange(next)
  }

  const row = "flex cursor-pointer items-center gap-3 px-3 py-1.5 text-sm hover:bg-muted/50"
  return (
    <div className="rounded-md border">
      {groupLines.length > 0 && (
        <label className="flex cursor-pointer items-center gap-3 border-b bg-muted/30 px-3 py-2">
          <Checkbox
            checked={checkedState(groupLines)}
            onCheckedChange={(checked) => setMany(groupLines.map((l) => l.key), checked === true)}
          />
          <span className="text-sm font-medium">{verb} all groups</span>
        </label>
      )}
      <div className="max-h-[min(20rem,45vh)] overflow-y-auto">
        {connectors.map((type) => (
          <div key={type} className="py-1">
            <label className={`${row} font-medium`}>
              <Checkbox
                checked={checkedState(byConnector.get(type)!)}
                onCheckedChange={(c) => setMany(byConnector.get(type)!.map((l) => l.key), c === true)}
              />
              {connectorName(type)}
            </label>
            {byConnector.get(type)!.map((l) => {
              const size = groupSize(l.groupId!)
              return (
                <label key={l.key} className={`${row} pl-6`}>
                  <Checkbox checked={selected.has(l.key)} onCheckedChange={(c) => setMany([l.key], c === true)} />
                  <span className="min-w-0 flex-1 truncate">
                    {groupLabel(l.groupId!)}
                    {size && <span className="text-muted-foreground"> · {size}</span>}
                  </span>
                  <span className="shrink-0 text-muted-foreground">{usesIt(l.people.size)}</span>
                </label>
              )
            })}
          </div>
        ))}
        {noGroupLines.length > 0 && (
          <div className={connectors.length > 0 ? "border-t py-1" : "py-1"}>
            <p className="px-3 pt-1.5 text-sm font-medium">Users not in any group</p>
            {noGroupLines.map((l) => (
              <label key={l.key} className={`${row} items-start pl-6`}>
                <Checkbox
                  className="mt-0.5"
                  checked={selected.has(l.key)}
                  onCheckedChange={(c) => setMany([l.key], c === true)}
                />
                <span className="min-w-0 flex-1">
                  <span className="block">
                    {connectorName(l.type)} · {usersUseIt(l.people.size)}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Allows it for all users
                  </span>
                </span>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
