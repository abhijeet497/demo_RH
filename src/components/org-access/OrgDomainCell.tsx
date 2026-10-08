import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Props = {
  domain: string;
  /**
   * Extra domains beyond the primary (the org's SAML SSO domain set). Empty renders the bare domain —
   * the "Primary" badge only appears when there's something to contrast it with.
   */
  additionalDomains: string[];
  className?: string;
};

// email_domain is the only customer-facing org label. We intentionally do NOT render the org `name`:
// for SSO orgs it is the internal `sso:<provider-uuid>` linkage key, not a human display name.
export function OrgDomainCell({ domain, additionalDomains: extras, className }: Props) {
  if (extras.length === 0) {
    return (
      <span className={cn("font-mono text-sm text-foreground", className)}>{domain}</span>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className={cn("font-mono text-sm text-foreground", className)}>{domain}</span>
      <Badge variant="outline" className="shrink-0 px-1 py-0 text-[10px] font-normal">Primary</Badge>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="text-xs text-muted-foreground underline decoration-dotted underline-offset-2 hover:text-foreground transition-colors"
            aria-label={`Show ${extras.length} more domain${extras.length === 1 ? "" : "s"} of ${domain}`}
          >
            +{extras.length} more
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-2">
          <ul className="flex flex-col gap-1">
            {extras.map((d) => (
              <li key={d} className="font-mono text-xs text-foreground">{d}</li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>
    </span>
  );
}
