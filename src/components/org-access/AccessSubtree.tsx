import { useState } from "react";
import { ChevronRight, Folder, FolderTree } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OrgNode } from "@/integrations/traceforce/types";
import { OrgDomainCell } from "./OrgDomainCell";

function countDescendants(node: OrgNode): number {
  return node.children.reduce((sum, c) => sum + 1 + countDescendants(c), 0);
}

type Props = {
  root: OrgNode;
};

/**
 * Read-only folder tree of the org subtree reachable by a single grant. The subtree is one revocable
 * unit — descendants have NO actions; revoke acts on the whole subtree from the row. (ENG-382)
 */
export function AccessSubtree({ root }: Props) {
  const [open, setOpen] = useState(false);
  const total = countDescendants(root);
  const hasChildren = total > 0;

  return (
    // Native semantics only: the disclosure buttons (with aria-expanded/aria-label) + indentation convey
    // the hierarchy. We deliberately do NOT use the ARIA tree pattern (role=tree/treeitem/group), which
    // would require a full roving-tabindex + arrow-key model we don't implement — a partial tree is worse
    // for assistive tech than the native button semantics.
    <div className="flex flex-col gap-1">
      <div className="flex flex-col gap-1">
        <OrgDomainCell domain={root.email_domain} additionalDomains={root.additional_domains} />
        {hasChildren && (
          <>
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              className="inline-flex items-center gap-1 self-start text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronRight className={cn("h-3 w-3 transition-transform", open && "rotate-90")} />
              <FolderTree className="h-3 w-3" />
              <span>
                Includes {total} sub-org{total === 1 ? "" : "s"}
              </span>
            </button>
            {open && (
              <div className="ml-3 mt-1 border-l border-border/60 pl-3">
                {root.children.map((c) => (
                  <SubtreeNode key={c.org_id} node={c} depth={0} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SubtreeNode({ node, depth }: { node: OrgNode; depth: number }) {
  const [open, setOpen] = useState(true);
  const hasChildren = node.children.length > 0;
  return (
    <div>
      <div
        className="flex items-center gap-1.5 py-0.5 text-xs text-muted-foreground"
        style={{ paddingLeft: depth * 4 }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="inline-flex items-center hover:text-foreground"
            aria-expanded={open}
            aria-label={`${open ? "Collapse" : "Expand"} sub-organizations of ${node.email_domain}`}
          >
            <ChevronRight className={cn("h-3 w-3 transition-transform", open && "rotate-90")} />
          </button>
        ) : (
          <span className="inline-block w-3" />
        )}
        <Folder className="h-3 w-3 opacity-70" />
        {/* OrgDomainCell (not a bare span) so descendants get the same Primary/+N-more treatment as
            the root; the class overrides keep the existing muted text-xs look for the single-domain
            case (cn/twMerge resolves the conflicts). */}
        <OrgDomainCell domain={node.email_domain} additionalDomains={node.additional_domains} className="text-xs text-muted-foreground" />
      </div>
      {hasChildren && open && (
        <div className="ml-3 border-l border-border/60 pl-3">
          {node.children.map((c) => (
            <SubtreeNode key={c.org_id} node={c} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
