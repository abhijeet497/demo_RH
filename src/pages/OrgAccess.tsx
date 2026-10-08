import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { AlertTriangle, Info, Network, Plus, X } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { useOrg } from '@/contexts/OrgContext';
import { useToast } from '@/hooks/use-toast';
import { traceforcApi } from '@/integrations/traceforce/client';
import type { OrgAccessGrant } from '@/integrations/traceforce/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { OPEN_COUNT_BADGE_CLASS } from '@/lib/appUtils';
import { Skeleton } from '@/components/ui/skeleton';
import { AccessSubtree } from '@/components/org-access/AccessSubtree';
import { ConfirmDestructiveDialog } from '@/components/org-access/ConfirmDestructiveDialog';
import { ManageDomainsDialog, type ManageDomainsTarget } from '@/components/org-access/ManageDomainsDialog';

// Mirrors the backend boundary regex (nextjs _schemas.ts) — RFC-5321-ish: no empty labels, no
// leading/trailing hyphen per label, TLD 2–63 alpha. Tested against the normalized (lowercased) value.
const DOMAIN_RE = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

// Mirrors the backend's MAX_ADDITIONAL_DOMAINS (nextjs orgs/_schemas.ts) — caps the create form's
// extra-domain rows so a request can never carry more than the backend accepts.
const MAX_EXTRA_DOMAINS = 10;

// Backend error codes that are CUSTOMER-ACTIONABLE → specific inline field guidance. Keyed on the
// backend's stable `code` (not the human message) so a message reword can't misroute. Anything not
// listed — 5xx, or any coded-but-internal error like SSO_STORED_CERT_UNAVAILABLE — falls through to
// ADD_ORG_GENERIC_ERROR, so we never surface server-side detail to a customer.
const ADD_ORG_ERRORS: Record<string, { target: 'domain' | 'meta' | 'extras'; message: string }> = {
  SSO_METADATA_NO_SIGNING_CERT: { target: 'meta', message: 'This SSO metadata has no signing certificate. Re-export it from your identity provider and try again.' },
  SSO_METADATA_MISMATCH: { target: 'meta', message: "This SSO metadata doesn't match the identity provider already registered for this domain." },
  ORG_ALREADY_LINKED: { target: 'domain', message: 'This organization is already linked to yours.' },
  ORG_CYCLE: { target: 'domain', message: 'Linking this organization would create a loop in your org hierarchy.' },
  // No-sign-in create: an existing org for the domain conflicts (linking without metadata would be
  // a takeover vector) — except a no-sign-in org this org itself created, which is quietly re-linked
  // instead of erroring (see POST /api/v1/orgs).
  ORG_EXISTS_REQUIRES_METADATA: { target: 'domain', message: 'An organization for this domain already exists. Add it with its SAML metadata to link it instead.' },
  ORG_DOMAIN_CONFLICT: { target: 'domain', message: 'An organization for this domain already exists.' },
  ORG_UPGRADE_CONFLICT: { target: 'domain', message: 'The organization changed while sign-in was being enabled. Please try again.' },
  // Additional-domain rejections from create-or-link (same codes as the manage-domains endpoints).
  DOMAIN_CONFLICT: { target: 'extras', message: 'One of the additional domains already belongs to another organization.' },
  DOMAIN_BLOCKED: { target: 'extras', message: "Public email provider domains can't be added as additional domains." },
};
const ADD_ORG_GENERIC_ERROR = 'Something went wrong on our end. Please try again, or contact support if it keeps happening.';

// Metadata validity — shared by the add form and the enable-sign-in dialog so both surfaces accept
// exactly the same inputs for the same backend endpoint.
const isValidMetadataUrl = (s: string) => { try { const u = new URL(s.trim()); return u.protocol === 'https:' && !!u.hostname; } catch { return false; } };
const isValidMetadataXml = (s: string) => { const v = s.trim(); return v.startsWith('<') && /EntityDescriptor/.test(v); };

// Shared empty/loading/error states inside a table body (colSpan=3: Organization | Granted | Actions).
const TableState = ({ children }: { children: React.ReactNode }) => (
  <TableRow><TableCell colSpan={3}>{children}</TableCell></TableRow>
);
const EmptyState = ({ msg }: { msg: string }) => (
  <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
    <Network className="h-6 w-6" aria-hidden /><p className="text-sm">{msg}</p>
  </div>
);
const LoadingRows = () => (<>{[0, 1].map((i) => (<TableRow key={i}><TableCell colSpan={3}><Skeleton className="h-6 w-full" /></TableCell></TableRow>))}</>);

// How auth is configured for the org being added: SAML metadata by URL or pasted XML, or 'none' —
// create the org with NO sign-in method at all (MSP-managed; nobody from its domain can log in).
type AddOrgTab = 'url' | 'xml' | 'none';

// ── Add organization (create-or-link) ────────────────────────────────────────
function CreateOrLinkOrgCard({ token, onCreated }: { token: string; onCreated: () => void }) {
  const { toast } = useToast();
  const [domain, setDomain] = useState('');
  const [tab, setTab] = useState<AddOrgTab>('url');
  const [metadataUrl, setMetadataUrl] = useState('');
  const [metadataXml, setMetadataXml] = useState('');
  // Extra SSO domains beyond the primary — one row per entry. Row errors are DERIVED on render (not
  // stored) so cross-field rules (duplicate / equals-primary) can never go stale when the primary or
  // a sibling row changes; `touched` (set on blur) only gates when an error becomes visible. Kept in
  // state even while the "No sign-in" tab hides the rows (additional domains require SSO), so
  // switching back restores what was typed.
  const [extras, setExtras] = useState<{ value: string; touched: boolean }[]>([]);
  const [domainErr, setDomainErr] = useState<string | null>(null);
  const [metaErr, setMetaErr] = useState<string | null>(null);
  // Server-side rejection of the additional-domains set (e.g. DOMAIN_BLOCKED) — a section-level
  // error, since the backend doesn't say which row it refers to.
  const [extrasErr, setExtrasErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmNoSso, setConfirmNoSso] = useState(false);
  // Synchronous in-flight guard: `loading` is state (applies after re-render), so a fast double-click
  // can fire submit() twice before the button disables. A ref flips immediately, blocking the second call.
  const inFlight = useRef(false);

  // Per-tab metadata validity — single source of truth shared by the onBlur validators AND canSubmit,
  // so the button only enables (and submit only proceeds) on a valid domain + valid active-tab metadata.
  const urlValid = isValidMetadataUrl(metadataUrl);
  const xmlValid = isValidMetadataXml(metadataXml);
  // The 'none' tab has no metadata input — nothing to validate; the consequence is gated by the
  // confirmation dialog instead.
  const metaValid = tab === 'url' ? urlValid : tab === 'xml' ? xmlValid : true;
  // Single normalized form of the domain — validation, the request body, the confirm dialog, and the
  // toasts must all agree on it.
  const normalizedDomain = domain.trim().toLowerCase();
  const normalizedExtras = extras.map((x) => x.value.trim().toLowerCase());
  // Empty rows are simply ignored on submit (an abandoned "+ Add another domain" click shouldn't
  // block the form); non-empty rows must be valid, unique, and distinct from the primary.
  const sentExtras = normalizedExtras.filter(Boolean);
  // Derived per-row errors — recomputed every render, so editing the PRIMARY (or a sibling row)
  // immediately updates or clears them; extrasValid below is `no row errors`, so the visible messages
  // and the submit button can never disagree.
  const extraErrs = normalizedExtras.map((d, i) => {
    if (!d) return null; // empty row — ignored on submit, never an error
    if (!DOMAIN_RE.test(d)) return 'That doesn\'t look like a valid domain (e.g. acme.com).';
    if (d === normalizedDomain) return 'This is already the primary domain.';
    if (normalizedExtras.some((o, j) => j !== i && o === d)) return 'This domain is already listed.';
    return null;
  });
  const extrasValid = tab === 'none' || extraErrs.every((e) => e === null);
  // Require a non-empty token: it's '' until the session resolves, and submitting then would fire a
  // guaranteed-401 and surface a confusing error toast.
  const canSubmit = !loading && !!token && DOMAIN_RE.test(normalizedDomain) && metaValid && extrasValid;

  const submit = async () => {
    if (!canSubmit || inFlight.current) return; // sync guard blocks a double-click before setLoading re-renders
    // A no-sign-in create is consequential (nobody from the new org will be able to log in), so it
    // goes through an explicit confirmation dialog; doCreate() runs on confirm.
    if (tab === 'none') { setConfirmNoSso(true); return; }
    await doCreate();
  };

  const doCreate = async () => {
    if (!token) {
      // Session dropped while the confirm dialog sat open — Radix closes the dialog on confirm
      // regardless, so without this it would be a silent no-op (mirrors confirmRevoke below).
      setConfirmNoSso(false);
      toast({ title: 'Error', description: 'Your session is still loading — please try again in a moment.', variant: 'destructive' });
      return;
    }
    if (!canSubmit || inFlight.current) return; // re-checked here — the dialog confirm calls this directly
    inFlight.current = true;
    setDomainErr(null); setMetaErr(null); setExtrasErr(null); // clear stale errors before a retry
    setLoading(true);
    try {
      const d = normalizedDomain;
      // additional_domains only on the SSO paths — they live on the SAML provider, so the backend
      // rejects them with no_sso (and the form hides the rows on that tab).
      const extrasBody = sentExtras.length > 0 ? { additional_domains: sentExtras } : {};
      const body = tab === 'url'
        ? { child_email_domain: d, sso_metadata_url: metadataUrl.trim(), ...extrasBody }
        : tab === 'xml'
          ? { child_email_domain: d, sso_metadata_xml: metadataXml.trim(), ...extrasBody }
          : { child_email_domain: d, no_sso: true };
      const res = await traceforcApi.createOrLinkOrg(token, body);
      if (res.data) {
        if (res.data.domains_error) {
          // PARTIAL SUCCESS: the org IS linked (grant minted) but some additional domains failed —
          // still reset + refresh (the row appears with its Manage domains button), warn loudly.
          toast({
            title: 'Organization added — some domains were not',
            description: `${d} is linked, but ${res.data.domains_error.code === 'DOMAIN_CONFLICT'
              ? 'some additional domains already belong to another organization'
              : "some additional domains couldn't be added right now"}. Use Manage domains on its row to finish.`,
            variant: 'destructive',
          });
        } else if (res.data.org.sso_upgraded) {
          // Upgrade path: the domain's no-sign-in org just had SSO attached — nothing new was created.
          toast({ title: 'Sign-in enabled', description: `Members of ${d} can now sign in with SSO.` });
        } else if (tab === 'none') {
          // created: false here = the backend re-linked an existing no-sign-in org we created before
          // (reclaim after a revoke) rather than creating a new one.
          toast({ title: 'Organization added', description: res.data.org.created ? `${d} was created without sign-in.` : `${d} was added back with its existing data.` });
        } else {
          toast({ title: 'Organization added', description: `${d} is now accessible.` });
        }
        setDomain(''); setMetadataUrl(''); setMetadataXml(''); setExtras([]);
        onCreated();
      } else {
        // Route on the backend's stable `code` first; only customer-actionable errors get specific
        // inline guidance, everything else gets a generic message (see ADD_ORG_ERRORS).
        const mapped = res.code ? ADD_ORG_ERRORS[res.code] : undefined;
        if (mapped) {
          (mapped.target === 'meta' ? setMetaErr : mapped.target === 'extras' ? setExtrasErr : setDomainErr)(mapped.message);
        } else if (res.statusCode === 429) {
          toast({ title: 'Too many requests', description: 'Please wait a moment and try again.', variant: 'destructive' });
        } else if (!res.code && res.statusCode === 422 && res.message) {
          // Codeless 422 = a SAML-metadata validation error (malformed XML, missing entityID, bad
          // metadata URL) — customer-fixable and metadata-related, so surface it on the metadata field.
          setMetaErr(res.message);
        } else if (!res.code && (res.statusCode === 400 || res.statusCode === 409) && res.message) {
          // Codeless 400/409 = input validation, self-link, already-linked, or domain conflict — all
          // customer-safe messages worth showing verbatim.
          toast({ title: 'Could not add organization', description: res.message, variant: 'destructive' });
        } else {
          // 5xx, coded-internal errors, or an unparseable body → never expose server-side detail.
          toast({ title: 'Could not add organization', description: ADD_ORG_GENERIC_ERROR, variant: 'destructive' });
        }
      }
    } finally {
      inFlight.current = false;
      setLoading(false); // in try/finally so a thrown request can't leave the button stuck disabled
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">Add organization</CardTitle>
        <CardDescription>Link a subsidiary by its email domain and SAML SSO metadata — or create one without sign-in, managed entirely by your org.</CardDescription></CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3 max-w-2xl">
          <div>
            <p className="mb-1.5 text-sm font-medium">Primary domain</p>
            <Input placeholder="acme.com" aria-label="Subsidiary email domain" value={domain} disabled={loading}
              onChange={(e) => { setDomain(e.target.value); if (domainErr) setDomainErr(null); }}
              onBlur={() => { if (domain && !DOMAIN_RE.test(normalizedDomain)) setDomainErr('That doesn\'t look like a valid domain (e.g. acme.com).'); }}
              aria-invalid={!!domainErr}
              aria-describedby={domainErr ? 'org-access-domain-error' : undefined}
              className={domainErr ? 'border-destructive focus-visible:ring-destructive' : ''} />
            {domainErr
              ? <p id="org-access-domain-error" className="mt-1.5 text-xs text-destructive">{domainErr}</p>
              : <p className="mt-1.5 text-xs text-muted-foreground">Shown as the org's name everywhere in the app.</p>}
          </div>
          <div>
            <p className="text-sm font-medium">Additional domains <span className="font-normal text-muted-foreground">(optional)</span></p>
            {tab === 'none' ? (
              // Rows are REPLACED (not disabled) — a sentence answers "why can't I type here?" better
              // than greyed inputs. Typed values stay in state and reappear on switching back to SSO.
              <p className="mt-1.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Info className="h-3.5 w-3.5 shrink-0" aria-hidden /> Additional domains require SSO.
              </p>
            ) : (
              <div className="mt-1.5 flex flex-col gap-2">
                {extras.map((row, i) => {
                  // Errors are derived (see extraErrs) and shown once the row has been blurred — from
                  // then on they track every keystroke, including edits to the primary field.
                  const shownErr = row.touched ? extraErrs[i] : null;
                  // Index keys are safe here: the inputs are fully controlled.
                  return (
                    <div key={i}>
                      <div className="flex gap-2">
                        <Input placeholder="acme.io" aria-label={`Additional email domain ${i + 1}`} value={row.value} disabled={loading}
                          onChange={(e) => {
                            const v = e.target.value;
                            setExtras((xs) => xs.map((o, j) => (j === i ? { ...o, value: v } : o)));
                            if (extrasErr) setExtrasErr(null);
                          }}
                          onBlur={() => setExtras((xs) => xs.map((o, j) => (j === i ? { ...o, touched: true } : o)))}
                          aria-invalid={!!shownErr}
                          aria-describedby={shownErr ? `org-access-extra-domain-error-${i}` : undefined}
                          className={shownErr ? 'border-destructive focus-visible:ring-destructive' : ''} />
                        <Button type="button" size="icon" variant="ghost" disabled={loading} className="shrink-0"
                          onClick={() => { setExtras((xs) => xs.filter((_, j) => j !== i)); if (extrasErr) setExtrasErr(null); }}
                          aria-label={`Remove additional domain ${i + 1}`}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      {shownErr && <p id={`org-access-extra-domain-error-${i}`} className="mt-1.5 text-xs text-destructive">{shownErr}</p>}
                    </div>
                  );
                })}
                {/* Mirrors the backend's MAX_ADDITIONAL_DOMAINS — past it the request would be a
                    zod 400 with raw library copy, so stop the rows client-side with a hint. */}
                {extras.length < MAX_EXTRA_DOMAINS ? (
                  <button type="button" disabled={loading}
                    onClick={() => setExtras((xs) => [...xs, { value: '', touched: false }])}
                    className="inline-flex items-center gap-1 self-start text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <Plus className="h-3 w-3" aria-hidden /> Add another domain
                  </button>
                ) : (
                  <p className="text-xs text-muted-foreground">Up to {MAX_EXTRA_DOMAINS} additional domains.</p>
                )}
                {extrasErr && <p className="text-xs text-destructive">{extrasErr}</p>}
              </div>
            )}
          </div>
          <Tabs value={tab} onValueChange={(v) => { setTab(v as AddOrgTab); if (metaErr) setMetaErr(null); }}>
            <TabsList>
              <TabsTrigger value="url" disabled={loading}>Metadata URL</TabsTrigger>
              <TabsTrigger value="xml" disabled={loading}>Paste XML</TabsTrigger>
              <TabsTrigger value="none" disabled={loading}>No sign-in</TabsTrigger>
            </TabsList>
            <TabsContent value="url">
              <Input type="url" placeholder="https://idp.acme.com/saml/metadata" aria-label="SAML metadata URL" value={metadataUrl} disabled={loading}
                onChange={(e) => { setMetadataUrl(e.target.value); if (metaErr) setMetaErr(null); }}
                onBlur={() => { if (metadataUrl && !urlValid) setMetaErr('Enter a valid https metadata URL.'); }}
                aria-invalid={!!metaErr}
                aria-describedby={metaErr ? 'org-access-metadata-error' : undefined}
                className={metaErr ? 'border-destructive focus-visible:ring-destructive' : ''} />
            </TabsContent>
            <TabsContent value="xml">
              <Textarea rows={6} placeholder="<EntityDescriptor entityID=…>…</EntityDescriptor>" aria-label="SAML metadata XML" value={metadataXml} disabled={loading}
                onChange={(e) => { setMetadataXml(e.target.value); if (metaErr) setMetaErr(null); }}
                onBlur={() => { if (metadataXml.trim() && !xmlValid) setMetaErr('That doesn\'t look like SAML metadata XML.'); }}
                aria-invalid={!!metaErr}
                aria-describedby={metaErr ? 'org-access-metadata-error' : undefined}
                className={metaErr ? 'border-destructive focus-visible:ring-destructive font-mono text-xs' : 'font-mono text-xs'} />
            </TabsContent>
            <TabsContent value="none">
              {/* Static copy on purpose — no live domain interpolation (half-typed input reads worse
                  than the generic sentence); the confirmation dialog names the exact domain, which is
                  guaranteed valid there because submit is gated on DOMAIN_RE. */}
              <Alert variant="warning">
                <AlertTriangle className="h-4 w-4" aria-hidden />
                <AlertDescription>
                  Creates a new organization with no sign-in method. Members of the new organization
                  won't be able to sign in — only your org can access and manage it.
                </AlertDescription>
              </Alert>
            </TabsContent>
            {metaErr && <p id="org-access-metadata-error" className="mt-1.5 text-xs text-destructive">{metaErr}</p>}
          </Tabs>
          <div><Button onClick={submit} disabled={!canSubmit}>Add organization</Button></div>
        </div>
      </CardContent>
      <ConfirmDestructiveDialog
        open={confirmNoSso}
        onOpenChange={setConfirmNoSso}
        // Domain is guaranteed valid here — submit() only opens this dialog when canSubmit (which
        // includes DOMAIN_RE) holds.
        title={`Create ${normalizedDomain} without sign-in?`}
        domain={normalizedDomain}
        description="No one from"
        descriptionAfter="will be able to sign in to their portal. Only your organization can access and manage it. To enable sign-in later, add this organization again with its SAML metadata."
        confirmLabel="Create without sign-in"
        onConfirm={doCreate}
      />
    </Card>
  );
}

// ── Enable sign-in (SSO upgrade) dialog ──────────────────────────────────────
// Submits the SAME create-or-link endpoint as the add form with the domain fixed to the selected
// no-sign-in org — the backend registers the provider and upgrades the org in place. A dedicated
// surface (instead of prefilling the add form) so the action names itself and needs no scroll/focus
// choreography.
function EnableSignInDialog({ token, target, onOpenChange, onEnabled }: {
  token: string;
  // Non-null = dialog open for this org. Keyed on org_id (the stable identity) rather than the
  // domain string — an org can have several domains, so a domain no longer identifies one org.
  target: { org_id: string; email_domain: string } | null;
  onOpenChange: (open: boolean) => void;
  onEnabled: () => void;
}) {
  const { toast } = useToast();
  const [tab, setTab] = useState<'url' | 'xml'>('url');
  const [metadataUrl, setMetadataUrl] = useState('');
  const [metadataXml, setMetadataXml] = useState('');
  const [metaErr, setMetaErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Synchronous double-submit guard, same rationale as the add form's.
  const inFlight = useRef(false);

  // Reset per target org so a previous attempt's inputs/errors never leak into the next open.
  useEffect(() => { setTab('url'); setMetadataUrl(''); setMetadataXml(''); setMetaErr(null); }, [target?.org_id]);

  const metaValid = tab === 'url' ? isValidMetadataUrl(metadataUrl) : isValidMetadataXml(metadataXml);
  const canSubmit = !loading && !!token && !!target && metaValid;

  // The dialog can be dismissed (Escape/outside-click/X) or even reopened for a DIFFERENT org while a
  // request is in flight — a live mirror of the open org_id lets the response tell whether it still
  // owns the open dialog. If not, outcomes go to toasts that NAME the org instead of mutating dialog
  // state (which would silently vanish, or worse, render org A's error inside org B's dialog).
  const openOrgId = useRef(target?.org_id ?? null);
  openOrgId.current = target?.org_id ?? null;

  const submit = async () => {
    if (!canSubmit || inFlight.current || !target) return;
    const t = target; // capture: `target` can change (close/reopen) before the response lands
    inFlight.current = true;
    setMetaErr(null);
    setLoading(true);
    try {
      const body = tab === 'url'
        ? { child_email_domain: t.email_domain, sso_metadata_url: metadataUrl.trim() }
        : { child_email_domain: t.email_domain, sso_metadata_xml: metadataXml.trim() };
      const res = await traceforcApi.createOrLinkOrg(token, body);
      const stillOpenForTarget = openOrgId.current === t.org_id;
      if (res.data) {
        // Toast + refresh unconditionally — sign-in WAS enabled even if the dialog moved on.
        toast({ title: 'Sign-in enabled', description: `Members of ${t.email_domain} can now sign in with SSO.` });
        if (stillOpenForTarget) onOpenChange(false);
        onEnabled();
        return;
      }
      // Inline routing only while this org's dialog is still up; otherwise fall through to toasts.
      const mapped = res.code ? ADD_ORG_ERRORS[res.code] : undefined;
      if (stillOpenForTarget && (mapped?.target === 'meta' || res.code === 'ORG_UPGRADE_CONFLICT')) {
        // ORG_UPGRADE_CONFLICT says "try again" — keep the dialog (and the pasted metadata) so the
        // user actually can, rather than closing and discarding their input.
        setMetaErr(mapped?.message ?? 'Something changed while enabling sign-in. Please try again.');
      } else if (stillOpenForTarget && !res.code && res.statusCode === 422 && res.message) {
        // Codeless 422 = SAML-metadata validation error — customer-fixable, surface inline.
        setMetaErr(res.message);
      } else if (res.statusCode === 429) {
        toast({ title: 'Too many requests', description: 'Please wait a moment and try again.', variant: 'destructive' });
      } else if (!res.code && (res.statusCode === 400 || res.statusCode === 409) && res.message) {
        // Codeless 400/409 carry customer-safe messages worth showing verbatim (mirrors the add
        // form) — e.g. 'Grant already active' when another admin enabled sign-in concurrently.
        if (stillOpenForTarget) onOpenChange(false);
        toast({ title: `Could not enable sign-in for ${t.email_domain}`, description: res.message, variant: 'destructive' });
      } else if (mapped) {
        // Domain-level conflicts can't be fixed here (the domain isn't editable) — close and toast.
        if (stillOpenForTarget) onOpenChange(false);
        toast({ title: `Could not enable sign-in for ${t.email_domain}`, description: mapped.message, variant: 'destructive' });
      } else {
        toast({ title: `Could not enable sign-in for ${t.email_domain}`, description: ADD_ORG_GENERIC_ERROR, variant: 'destructive' });
      }
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  };

  return (
    <Dialog open={!!target} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enable sign-in for <span className="font-mono">{target?.email_domain}</span></DialogTitle>
          <DialogDescription>Provide the organization's SAML SSO metadata. Its members will be able to sign in once it's configured.</DialogDescription>
        </DialogHeader>
        <Tabs value={tab} onValueChange={(v) => { setTab(v as 'url' | 'xml'); if (metaErr) setMetaErr(null); }}>
          <TabsList>
            <TabsTrigger value="url" disabled={loading}>Metadata URL</TabsTrigger>
            <TabsTrigger value="xml" disabled={loading}>Paste XML</TabsTrigger>
          </TabsList>
          <TabsContent value="url">
            <Input type="url" placeholder="https://idp.acme.com/saml/metadata" aria-label="SAML metadata URL" value={metadataUrl} disabled={loading}
              onChange={(e) => { setMetadataUrl(e.target.value); if (metaErr) setMetaErr(null); }}
              onBlur={() => { if (metadataUrl && !isValidMetadataUrl(metadataUrl)) setMetaErr('Enter a valid https metadata URL.'); }}
              aria-invalid={!!metaErr}
              aria-describedby={metaErr ? 'enable-sso-metadata-error' : undefined}
              className={metaErr ? 'border-destructive focus-visible:ring-destructive' : ''} />
          </TabsContent>
          <TabsContent value="xml">
            <Textarea rows={6} placeholder="<EntityDescriptor entityID=…>…</EntityDescriptor>" aria-label="SAML metadata XML" value={metadataXml} disabled={loading}
              onChange={(e) => { setMetadataXml(e.target.value); if (metaErr) setMetaErr(null); }}
              onBlur={() => { if (metadataXml.trim() && !isValidMetadataXml(metadataXml)) setMetaErr('That doesn\'t look like SAML metadata XML.'); }}
              aria-invalid={!!metaErr}
              aria-describedby={metaErr ? 'enable-sso-metadata-error' : undefined}
              className={metaErr ? 'border-destructive focus-visible:ring-destructive font-mono text-xs' : 'font-mono text-xs'} />
          </TabsContent>
          {metaErr && <p id="enable-sso-metadata-error" className="mt-1.5 text-xs text-destructive">{metaErr}</p>}
        </Tabs>
        <DialogFooter>
          {/* Not disabled while loading — Escape/outside-click/X already dismiss during a request
              (Radix defaults, per repo convention), so the button shouldn't be the one holdout. */}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!canSubmit}>Enable sign-in</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Outgoing-only linked-orgs card ───────────────────────────────────────────
function LinkedOrgsCard({ token, tick, onChanged }: { token: string; tick: number; onChanged: () => void }) {
  const { toast } = useToast();
  const [grants, setGrants] = useState<OrgAccessGrant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [target, setTarget] = useState<OrgAccessGrant | null>(null);
  // The no-sign-in org the "Enable sign-in" dialog is open for (null = closed). Keyed on org_id —
  // an org can have several domains, so a domain string no longer identifies one org.
  const [enableTarget, setEnableTarget] = useState<{ org_id: string; email_domain: string } | null>(null);
  // The SSO org the "Manage domains" dialog is open for (null = closed).
  const [manageTarget, setManageTarget] = useState<ManageDomainsTarget | null>(null);
  // Synchronous in-flight guard: setTarget(null) closes the dialog but is React state (applies after
  // re-render), so a fast double-click could fire confirmRevoke twice while target is still set. A ref
  // flips immediately, blocking the second call.
  const revokeInFlight = useRef(false);
  // Reactive mirror of the ref so the per-row buttons can be disabled during a revoke. Without this a
  // user could open the confirm dialog for a DIFFERENT row mid-revoke, where confirmRevoke would hit the
  // revokeInFlight guard and silently no-op — a dialog that looks broken. (The ref stays as the
  // synchronous double-submit guard; state alone re-renders too late to block a fast double-click.)
  const [revoking, setRevoking] = useState(false);

  const load = useCallback(async () => {
    // Short-circuit when there's no token (e.g. auth/session refresh): a fetch would be a guaranteed
    // 401 and could overwrite good data with an error state. Park the card in the loading skeleton (and
    // clear any stale error) until a token arrives, rather than leaving stale grants / a stale error up.
    if (!token) { setLoading(true); setError(false); return; }
    setLoading(true); setError(false);
    const res = await traceforcApi.getOrgAccessGrants(token);
    if (res.data) setGrants(res.data.grants);
    else setError(true);
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load, tick]);

  const confirmRevoke = async () => {
    if (!target || revokeInFlight.current) return; // sync guard blocks a double-click before setTarget re-renders
    if (!token) {
      // Session unresolved — a revoke would be a guaranteed 401. Close the dialog and tell the user
      // instead of a silent no-op that leaves the confirmation dialog open with no feedback.
      setTarget(null);
      toast({ title: 'Error', description: 'Your session is still loading — please try again in a moment.', variant: 'destructive' });
      return;
    }
    const grantId = target.id;
    revokeInFlight.current = true;
    setRevoking(true); // disable the row buttons so no other confirm dialog can open mid-revoke
    setTarget(null); // close the dialog immediately so a double-click during the request can't double-submit
    try {
      const res = await traceforcApi.revokeOrgAccessGrant(token, grantId);
      if (res.data) {
        toast({ title: 'Access removed' });
      } else {
        // Surface any non-200 as a destructive toast (no 403 branch — backend returns uniform 404).
        toast({ title: 'Error', description: res.error ?? 'Failed to remove access', variant: 'destructive' });
      }
      // Page-level refresh: reloads this list (via tick) AND re-fetches the accessible set so the
      // tenant switcher drops the revoked org. (Plain load() would only refresh this card.)
      onChanged();
    } finally {
      revokeInFlight.current = false;
      setRevoking(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Orgs you can access</CardTitle>
        <CardDescription>Subsidiary organizations your org has linked and can access (added above). Revoke to remove access.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Organization</TableHead>
              <TableHead>Granted</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? <LoadingRows /> : error
              ? <TableState><EmptyState msg="Failed to load grants." /></TableState>
              : grants.length === 0
                ? <TableState><EmptyState msg="You don't have access to any other orgs." /></TableState>
                : grants.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell>
                      <div className="flex items-start gap-2">
                        <AccessSubtree root={{
                          org_id: g.child_org.org_id,
                          email_domain: g.child_org.email_domain,
                          additional_domains: g.child_org.additional_domains,
                          children: g.subtree,
                        }} />
                        {!g.child_org.has_sso && (
                          <Badge variant="outline" className={cn('shrink-0', OPEN_COUNT_BADGE_CLASS)}>
                            No sign-in
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(g.created_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="text-right">
                      {/* The remedy for the "No sign-in" badge — opens the enable-sign-in dialog. */}
                      {!g.child_org.has_sso && (
                        <Button size="sm" variant="outline" className="mr-2" disabled={revoking}
                          onClick={() => setEnableTarget({ org_id: g.child_org.org_id, email_domain: g.child_org.email_domain })}
                          aria-label={`Enable sign-in for ${g.child_org.email_domain}`}>
                          Enable sign-in
                        </Button>
                      )}
                      {/* Additional domains live on the org's SAML provider, so a no-sign-in org has
                          nowhere to put them. */}
                      {g.child_org.has_sso && (
                        <Button size="sm" variant="outline" className="mr-2" disabled={revoking}
                          onClick={() => setManageTarget({
                            org_id: g.child_org.org_id,
                            email_domain: g.child_org.email_domain,
                            additional_domains: g.child_org.additional_domains,
                          })}
                          aria-label={`Manage domains of ${g.child_org.email_domain}`}>
                          Manage domains
                        </Button>
                      )}
                      <Button size="sm" variant="destructive" disabled={revoking} onClick={() => setTarget(g)}
                        aria-label={`Remove my access to ${g.child_org.email_domain}`}>
                        Remove my access
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </CardContent>
      <ConfirmDestructiveDialog
        open={!!target}
        onOpenChange={(o) => !o && setTarget(null)}
        title="Remove my access?"
        domain={target?.child_org.email_domain ?? ''}
        description="This ends your organization's access to"
        // A no-sign-in child has no members of its own, so removing the grant leaves it unreachable
        // until re-added — reassure that adding it back (same No sign-in tab) restores it with its data.
        descriptionAfter={target?.child_org.has_sso === false
          ? 'and all of its sub-organizations. No one can access it until you add it back from this page.'
          : 'and all of its sub-organizations.'}
        confirmLabel="Remove my access"
        onConfirm={confirmRevoke}
      />
      <EnableSignInDialog
        token={token}
        target={enableTarget}
        onOpenChange={(o) => !o && setEnableTarget(null)}
        onEnabled={onChanged}
      />
      <ManageDomainsDialog
        token={token}
        target={manageTarget}
        onOpenChange={(o) => !o && setManageTarget(null)}
        onChanged={onChanged}
      />
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function OrgAccess() {
  const { session } = useAuth();
  const { orgRole, loading, refresh: refreshOrgs } = useOrg();
  const [tick, setTick] = useState(0);
  const token = session?.access_token ?? '';
  // Reload the grants list (tick) AND re-fetch the accessible-org set so the tenant switcher reflects
  // the change, after any create-or-link / revoke.
  // refreshOrgs() is async (returns a Promise) but we fire-and-forget it; `void` marks that explicitly
  // (no floating-promise lint warning). It surfaces its own failures via a toast inside OrgContext.
  const refresh = useCallback(() => { setTick((t) => t + 1); void refreshOrgs(); }, [refreshOrgs]);

  if (loading) return <div className="p-6"><Skeleton className="h-6 w-48" /></div>;
  if (orgRole !== 'admin') return <Navigate to="/dashboard" replace />;

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Organization Access</h1>
        <p className="text-muted-foreground">Link sub-organizations and manage the organizations your org can access.</p>
      </div>
      <CreateOrLinkOrgCard token={token} onCreated={refresh} />
      <LinkedOrgsCard token={token} tick={tick} onChanged={refresh} />
    </div>
  );
}
