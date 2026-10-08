import type { AccessibleOrg } from "@/integrations/traceforce/types"

export type OrgTreeNode<T extends { org_id: string } = AccessibleOrg> = T & {
  children: OrgTreeNode<T>[]
}

/** Build a forest from a flat org set using parent_org_id when present;
 * otherwise treat every non-home org as a direct child of home. */
export function buildOrgForest<T extends { org_id: string; email_domain: string; parent_org_id?: string | null }>(
  orgs: T[],
  homeOrgId: string | null,
): OrgTreeNode<T>[] {
  const byId = new Map<string, OrgTreeNode<T>>()
  orgs.forEach((o) => byId.set(o.org_id, { ...o, children: [] }))

  const hasParentLinks = orgs.some((o) => o.parent_org_id)

  const roots: OrgTreeNode<T>[] = []
  byId.forEach((node) => {
    const parentId = hasParentLinks
      ? node.parent_org_id
      : node.org_id === homeOrgId
        ? null
        : homeOrgId
    const parent = parentId ? byId.get(parentId) : undefined
    if (parent && parent.org_id !== node.org_id) {
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  })

  const sortTree = (nodes: OrgTreeNode<T>[]) => {
    nodes.sort((a, b) => {
      if (a.org_id === homeOrgId) return -1
      if (b.org_id === homeOrgId) return 1
      return a.email_domain.localeCompare(b.email_domain)
    })
    nodes.forEach((n) => sortTree(n.children))
  }
  sortTree(roots)
  return roots
}
