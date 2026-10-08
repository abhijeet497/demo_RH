import { advisoryHref } from "@/lib/advisory"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

/**
 * Renders a finding's advisory id (CVE or GHSA). A published id links to its
 * entry in the CVE/GHSA database. An id that is not published there can still
 * have a public page of its own, typically a repository advisory a maintainer
 * published without a CVE, and url carries that. With neither, the id shows a
 * "Pending" marker rather than a link that 404s. Absent id renders a dash.
 *
 * url comes from a finding's SARIF properties, which a scan report can also
 * supply, so it is untrusted and only followed when it is https. That keeps a
 * crafted report from turning this into a javascript: link.
 */
export function AdvisoryLink({
  id,
  published = false,
  url = null,
}: {
  id: string | null
  published?: boolean
  url?: string | null
}) {
  if (!id) return <span className="text-muted-foreground">—</span>

  const href = published ? advisoryHref(id) : url && /^https:\/\//i.test(url) ? url : null

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="font-mono text-xs text-primary hover:underline"
      >
        {id}
      </a>
    )
  }

  // Published, but the id is in a format we have no page for: show it plainly.
  if (published) return <span className="font-mono text-xs">{id}</span>

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="secondary"
          tabIndex={0}
          aria-label={`Advisory ${id} pending publication`}
          className="font-normal cursor-default focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Pending
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <span className="font-mono text-xs">{id}</span> — advisory not yet published
      </TooltipContent>
    </Tooltip>
  )
}
