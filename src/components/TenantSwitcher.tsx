import { useMemo, useState } from 'react';
import { Check, ChevronRight, ChevronsUpDown, Folder, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { useOrg } from '@/contexts/OrgContext';
import { buildOrgForest, type OrgTreeNode } from '@/lib/orgTree';
import type { AccessibleOrg } from '@/integrations/traceforce/types';

// Org switcher (Command + Popover). Nested org tree by email_domain (never raw UUID);
// rendered in the SidebarHeader only when isMultiOrg. Panel grows past the sidebar so nested
// domains wrap instead of truncating.

function OrgSwitcherNode({
  node,
  activeOrgId,
  onSelect,
  defaultOpen = true,
}: {
  node: OrgTreeNode<AccessibleOrg>;
  activeOrgId: string | null;
  onSelect: (orgId: string) => void;
  defaultOpen?: boolean;
}) {
  const hasChildren = node.children.length > 0;
  const [expanded, setExpanded] = useState(defaultOpen);

  return (
    <div>
      <CommandItem
        value={node.email_domain}
        onSelect={() => onSelect(node.org_id)}
        className="items-start gap-1"
      >
        {hasChildren ? (
          <button
            type="button"
            className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground"
            aria-expanded={expanded}
            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${node.email_domain}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setExpanded((o) => !o);
            }}
            onKeyDown={(e) => {
              // Keep Space/Enter on the chevron from also selecting the org via CommandItem.
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                setExpanded((o) => !o);
              }
            }}
          >
            <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-90')} />
          </button>
        ) : (
          <span className="mt-0.5 inline-block h-4 w-4 shrink-0" aria-hidden />
        )}
        {hasChildren && expanded ? (
          <FolderOpen
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground"
            aria-hidden
          />
        ) : (
          <Folder
            className={cn(
              'mt-0.5 h-3.5 w-3.5 shrink-0',
              hasChildren ? 'text-muted-foreground' : 'text-muted-foreground/70',
            )}
            aria-hidden
          />
        )}
        <span className="min-w-0 flex-1 break-all" title={node.email_domain}>
          {node.email_domain}
        </span>
        <Check
          className={cn(
            'mt-0.5 h-4 w-4 shrink-0',
            activeOrgId === node.org_id ? 'opacity-100' : 'opacity-0',
          )}
        />
      </CommandItem>
      {hasChildren && expanded && (
        <div className="ml-3 border-l border-border/60 pl-1">
          {node.children.map((child) => (
            <OrgSwitcherNode
              key={child.org_id}
              node={child}
              activeOrgId={activeOrgId}
              onSelect={onSelect}
              defaultOpen
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function TenantSwitcher() {
  const { accessibleOrgs, activeOrgId, homeOrgId, setActiveOrg } = useOrg();
  const [open, setOpen] = useState(false);
  const active = accessibleOrgs.find((o) => o.org_id === activeOrgId);

  const forest = useMemo(
    () => buildOrgForest(accessibleOrgs, homeOrgId),
    [accessibleOrgs, homeOrgId],
  );

  const selectOrg = (orgId: string) => {
    setActiveOrg(orgId);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Switch organization"
          className="w-full justify-between"
        >
          {/* Native title (not the repo's Radix Tooltip pattern): full value on hover for truncated
              domains. Radix tooltips inside the Popover+Command list below would fight the listbox's
              keyboard nav and portal stacking, so both spots use the lightweight attribute. */}
          <span className="truncate" title={active?.email_domain}>
            {active?.email_domain ?? 'Select org'}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-max min-w-[var(--radix-popover-trigger-width)] max-w-[min(28rem,calc(100vw-1.5rem))] p-0"
        align="start"
      >
        <Command>
          <CommandInput placeholder="Search org..." />
          <CommandList className="overflow-x-hidden">
            <CommandEmpty>No org found.</CommandEmpty>
            <CommandGroup>
              {forest.map((node) => (
                <OrgSwitcherNode
                  key={node.org_id}
                  node={node}
                  activeOrgId={activeOrgId}
                  onSelect={selectOrg}
                  defaultOpen
                />
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
