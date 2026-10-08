import { useMemo, useState } from "react"
import { Check, ChevronRight, ChevronsUpDown, Folder, FolderOpen, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { cn } from "@/lib/utils"
import { useOrg } from "@/contexts/OrgContext"
import { buildOrgForest, type OrgTreeNode } from "@/lib/orgTree"
import type { AccessibleOrg } from "@/integrations/traceforce/types"

// Multi-select org filter with the same folder tree as TenantSwitcher (chevron expand,
// Folder/FolderOpen, nested border). Used on the dashboard org scope filter.

function OrgTreeFilterNode({
  node,
  selectedIds,
  onToggle,
  defaultOpen = true,
}: {
  node: OrgTreeNode<AccessibleOrg>
  selectedIds: string[]
  onToggle: (orgId: string) => void
  defaultOpen?: boolean
}) {
  const hasChildren = node.children.length > 0
  const [expanded, setExpanded] = useState(defaultOpen)
  const selected = selectedIds.includes(node.org_id)

  return (
    <div>
      <CommandItem
        value={node.email_domain}
        onSelect={() => onToggle(node.org_id)}
        className="items-start gap-1"
      >
        {hasChildren ? (
          <button
            type="button"
            className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground"
            aria-expanded={expanded}
            aria-label={`${expanded ? "Collapse" : "Expand"} ${node.email_domain}`}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setExpanded((o) => !o)
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                e.stopPropagation()
                setExpanded((o) => !o)
              }
            }}
          >
            <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-90")} />
          </button>
        ) : (
          <span className="mt-0.5 inline-block h-4 w-4 shrink-0" aria-hidden />
        )}
        {hasChildren && expanded ? (
          <FolderOpen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        ) : (
          <Folder
            className={cn(
              "mt-0.5 h-3.5 w-3.5 shrink-0",
              hasChildren ? "text-muted-foreground" : "text-muted-foreground/70",
            )}
            aria-hidden
          />
        )}
        <Checkbox
          checked={selected}
          className="mt-0.5 mr-1"
          onCheckedChange={() => {}}
          aria-hidden
          tabIndex={-1}
        />
        <span className="min-w-0 flex-1 break-all" title={node.email_domain}>
          {node.email_domain}
        </span>
        <Check className={cn("mt-0.5 h-4 w-4 shrink-0", selected ? "opacity-100" : "opacity-0")} />
      </CommandItem>
      {hasChildren && expanded && (
        <div className="ml-3 border-l border-border/60 pl-1">
          {node.children.map((child) => (
            <OrgTreeFilterNode
              key={child.org_id}
              node={child}
              selectedIds={selectedIds}
              onToggle={onToggle}
              defaultOpen
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface OrgTreeMultiSelectProps {
  selectedIds: string[]
  onChange: (selectedIds: string[]) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  label?: string
  disabled?: boolean
}

export function OrgTreeMultiSelect({
  selectedIds,
  onChange,
  placeholder = "All Organizations",
  searchPlaceholder = "Search organizations...",
  emptyMessage = "No organizations found.",
  label = "organization",
  disabled = false,
}: OrgTreeMultiSelectProps) {
  const { accessibleOrgs, homeOrgId } = useOrg()
  const [open, setOpen] = useState(false)

  const forest = useMemo(
    () => buildOrgForest(accessibleOrgs, homeOrgId),
    [accessibleOrgs, homeOrgId],
  )

  const toggleItem = (id: string) => {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((selectedId) => selectedId !== id)
        : [...selectedIds, id],
    )
  }

  return (
    <div className="min-w-0">
      <Popover open={open} onOpenChange={setOpen} modal>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full min-w-0 justify-between bg-background"
            disabled={disabled}
          >
            <span className="min-w-0 truncate text-left">
              {selectedIds.length > 0
                ? `${selectedIds.length} ${label}${selectedIds.length > 1 ? "s" : ""} selected`
                : placeholder}
            </span>
            <span className="flex shrink-0 items-center gap-0.5">
              {selectedIds.length > 0 && !disabled && (
                <span
                  role="button"
                  tabIndex={0}
                  aria-label="Clear selection"
                  className="inline-flex cursor-pointer rounded p-0.5 hover:bg-muted"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onChange([])
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      e.stopPropagation()
                      onChange([])
                    }
                  }}
                >
                  <X className="h-4 w-4 opacity-50 hover:opacity-100" />
                </span>
              )}
              <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-max min-w-[var(--radix-popover-trigger-width)] max-w-[min(28rem,calc(100vw-1.5rem))] p-0"
          align="start"
        >
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList className="overflow-x-hidden">
              <CommandEmpty>{emptyMessage}</CommandEmpty>
              <CommandGroup>
                {forest.map((node) => (
                  <OrgTreeFilterNode
                    key={node.org_id}
                    node={node}
                    selectedIds={selectedIds}
                    onToggle={toggleItem}
                    defaultOpen
                  />
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
