import { useEffect, useRef, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { traceforcApi } from '@/integrations/traceforce/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ConfirmDestructiveDialog } from './ConfirmDestructiveDialog';

// Mirrors the backend boundary regex (nextjs _schemas.ts) — same pattern the add-org form uses.
const DOMAIN_RE = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

// Backend error codes from POST/DELETE /api/v1/orgs/:org_id/domains that are CUSTOMER-ACTIONABLE.
// Keyed on the stable `code` (not the human message) so a message reword can't misroute; anything
// unlisted falls through to a generic toast so server-side detail is never surfaced.
const DOMAIN_ERRORS: Record<string, string> = {
  ORG_NOT_FOUND: 'This organization is no longer accessible. Refresh the page and try again.',
  ORG_NO_SSO: 'This organization has no sign-in method — additional domains require SSO.',
  DOMAIN_EXISTS: 'That domain is already added.',
  DOMAIN_CONFLICT: 'That domain already belongs to another organization.',
  DOMAIN_BLOCKED: "Public email provider domains can't be added.",
  DOMAIN_LIMIT: 'This organization already has the maximum number of additional domains.',
  DOMAIN_NOT_FOUND: 'That domain was already removed. Refresh the page if it still shows here.',
  DOMAIN_IS_PRIMARY: "The primary domain can't be removed.",
  DOMAIN_LAST: "The organization's last sign-in domain can't be removed.",
};
const GENERIC_ERROR = 'Something went wrong on our end. Please try again, or contact support if it keeps happening.';

/** The org the dialog is open for (null = closed), captured from the grant row at click time. */
export type ManageDomainsTarget = {
  org_id: string;
  email_domain: string;
  additional_domains: string[];
};

// ── Manage domains dialog ─────────────────────────────────────────────────────
// Lists the org's primary domain (fixed — it's the org's display identity everywhere) plus its
// additional SSO domains, with add/remove. The list is kept locally from each mutation's response
// (the updated additional_domains) so the dialog is immediately consistent; onChanged() refreshes
// the page's grants table in the background.
export function ManageDomainsDialog({ token, target, onOpenChange, onChanged }: {
  token: string;
  target: ManageDomainsTarget | null;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [domains, setDomains] = useState<string[]>([]);
  const [newDomain, setNewDomain] = useState('');
  // Inline error for the ADD input ONLY. Remove failures go to toasts — routing them here would
  // paint aria-invalid + a red border on the unrelated add field for something the user never typed.
  const [addErr, setAddErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Additional domain the remove-confirmation dialog is open for (null = closed).
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);
  // Synchronous double-submit guard, same rationale as the add form's (loading state applies only
  // after a re-render, so a fast double-click could fire twice).
  const inFlight = useRef(false);

  // Reset per target org so a previous org's list/input/errors never leak into the next open. Seeded
  // from the grant row's additional_domains; mutations below replace it with the server's response.
  useEffect(() => {
    setDomains(target?.additional_domains ?? []);
    setNewDomain('');
    setAddErr(null);
    setRemoveTarget(null);
  }, [target?.org_id]); // eslint-disable-line react-hooks/exhaustive-deps -- keyed on org identity, not the captured list

  // The dialog can be dismissed or reopened for a DIFFERENT org while a request is in flight — a live
  // mirror of the open org lets the response tell whether it still owns the dialog (mirrors
  // EnableSignInDialog's openOrgId pattern). If not, outcomes go to toasts that NAME the org.
  const openOrgId = useRef(target?.org_id ?? null);
  openOrgId.current = target?.org_id ?? null;

  const normalizedNew = newDomain.trim().toLowerCase();
  const canAdd = !loading && !!token && !!target && DOMAIN_RE.test(normalizedNew);

  const add = async () => {
    if (!canAdd || inFlight.current || !target) return;
    // Client-side pre-checks the server would 409 anyway — inline them without a round-trip.
    if (normalizedNew === target.email_domain) { setAddErr('This is already the primary domain.'); return; }
    if (domains.includes(normalizedNew)) { setAddErr(DOMAIN_ERRORS.DOMAIN_EXISTS); return; }
    const t = target; // capture: `target` can change (close/reopen) before the response lands
    inFlight.current = true;
    setAddErr(null);
    setLoading(true);
    try {
      const res = await traceforcApi.addOrgDomain(token, t.org_id, normalizedNew);
      const stillOpenForTarget = openOrgId.current === t.org_id;
      if (res.data) {
        toast({ title: 'Domain added', description: `${normalizedNew} now belongs to ${t.email_domain}.` });
        if (stillOpenForTarget) { setDomains(res.data.additional_domains); setNewDomain(''); }
        onChanged();
        return;
      }
      const mapped = res.code ? DOMAIN_ERRORS[res.code] : undefined;
      if (stillOpenForTarget && mapped) {
        setAddErr(mapped);
      } else if (res.statusCode === 429) {
        toast({ title: 'Too many requests', description: 'Please wait a moment and try again.', variant: 'destructive' });
      } else if (stillOpenForTarget && !res.code && res.statusCode === 400 && res.message) {
        // Codeless 400 = input validation — customer-safe, surface inline.
        setAddErr(res.message);
      } else {
        toast({ title: `Could not add domain to ${t.email_domain}`, description: mapped ?? GENERIC_ERROR, variant: 'destructive' });
      }
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  };

  const confirmRemove = async () => {
    if (!removeTarget || inFlight.current || !target) return;
    if (!token) {
      setRemoveTarget(null);
      toast({ title: 'Error', description: 'Your session is still loading — please try again in a moment.', variant: 'destructive' });
      return;
    }
    const t = target;
    const domain = removeTarget;
    inFlight.current = true;
    setLoading(true);
    setRemoveTarget(null); // close the confirm immediately so a double-click can't double-submit
    try {
      const res = await traceforcApi.removeOrgDomain(token, t.org_id, domain);
      const stillOpenForTarget = openOrgId.current === t.org_id;
      if (res.data) {
        toast({ title: 'Domain removed', description: `${domain} no longer belongs to ${t.email_domain}.` });
        // Clear any stale add-side error too (e.g. DOMAIN_LIMIT no longer holds after a removal).
        if (stillOpenForTarget) { setDomains(res.data.additional_domains); setAddErr(null); }
        onChanged();
        return;
      }
      if (res.statusCode === 429) {
        toast({ title: 'Too many requests', description: 'Please wait a moment and try again.', variant: 'destructive' });
        return;
      }
      // Remove failures ALWAYS toast (never the add input's inline error — see addErr).
      if (res.code === 'DOMAIN_NOT_FOUND') {
        // Already gone server-side (e.g. another admin removed it) — the desired outcome holds, so
        // report it neutrally, drop the stale row, and refresh the table behind the dialog.
        toast({ title: 'Domain removed', description: `${domain} was already removed by someone else.` });
        if (stillOpenForTarget) setDomains((ds) => ds.filter((x) => x !== domain));
        onChanged();
        return;
      }
      const mapped = res.code ? DOMAIN_ERRORS[res.code] : undefined;
      toast({ title: `Could not remove domain from ${t.email_domain}`, description: mapped ?? GENERIC_ERROR, variant: 'destructive' });
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  };

  return (
    <Dialog open={!!target} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage domains for <span className="font-mono">{target?.email_domain}</span></DialogTitle>
          <DialogDescription>
            Email domains that belong to this organization. The primary domain is shown in org listings.
          </DialogDescription>
        </DialogHeader>
        <ul className="flex flex-col gap-1.5">
          <li className="flex min-h-8 items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5">
              <span className="font-mono text-sm text-foreground">{target?.email_domain}</span>
              <Badge variant="outline" className="shrink-0 px-1 py-0 text-[10px] font-normal">Primary</Badge>
            </span>
          </li>
          {domains.map((d) => (
            <li key={d} className="flex min-h-8 items-center justify-between gap-2">
              <span className="font-mono text-sm text-foreground">{d}</span>
              <Button size="sm" variant="ghost" disabled={loading} onClick={() => setRemoveTarget(d)}
                aria-label={`Remove domain ${d}`}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <Input placeholder="acme.io" aria-label="Additional email domain" value={newDomain} disabled={loading}
            onChange={(e) => { setNewDomain(e.target.value); if (addErr) setAddErr(null); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void add(); } }}
            onBlur={() => { if (newDomain && !DOMAIN_RE.test(normalizedNew)) setAddErr('That doesn\'t look like a valid domain (e.g. acme.com).'); }}
            aria-invalid={!!addErr}
            aria-describedby={addErr ? 'manage-domains-error' : undefined}
            className={addErr ? 'border-destructive focus-visible:ring-destructive' : ''} />
          <Button onClick={() => void add()} disabled={!canAdd}>Add</Button>
        </div>
        {addErr && <p id="manage-domains-error" className="text-xs text-destructive">{addErr}</p>}
      </DialogContent>
      <ConfirmDestructiveDialog
        open={!!removeTarget}
        onOpenChange={(o) => !o && setRemoveTarget(null)}
        title={`Remove ${removeTarget ?? ''}?`}
        domain={`@${removeTarget ?? ''}`}
        description="Users signing in with"
        descriptionAfter="emails will lose access to this organization."
        confirmLabel="Remove domain"
        onConfirm={confirmRemove}
      />
    </Dialog>
  );
}
