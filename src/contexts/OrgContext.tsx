import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { OrgContextState, AccessibleOrg } from '@/integrations/traceforce/types';
import { MULTI_ORG_ENABLED } from '@/lib/featureFlags';
import { traceforcApi } from '@/integrations/traceforce/client';
import { toast } from 'sonner';
import { ACTIVE_ORG_KEY } from '@/lib/storageKeys';

function readStored(): string | null {
  try { return sessionStorage.getItem(ACTIVE_ORG_KEY); } catch { return null; }
}

function writeStored(id: string | null): void {
  try {
    if (id) sessionStorage.setItem(ACTIVE_ORG_KEY, id);
    else sessionStorage.removeItem(ACTIVE_ORG_KEY);
  } catch { /* ITP / private mode: best-effort — persistence is skipped. The active org still lives in
    React state for the session (just not restored across a reload). */ }
}

// Admin-ness is read from the JWT `user_entitlement` claim — the same source the API's is_admin()
// gate uses. Fail-closed: only an explicit 'admin' claim grants admin (absent → non-admin). No DB
// read, no API round-trip. (Mirrors the decode helper in traceforce-ui PR #92; kept local here.)
function decodeEntitlement(accessToken: string): 'admin' | 'user' {
  try {
    // JWT segments are base64URL WITHOUT padding — restore it before atob (which requires a length
    // that's a multiple of 4), else atob throws on most real tokens and admins get downgraded.
    const b64 = accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '=');
    const claims = JSON.parse(atob(padded));
    // Fail-closed: only an explicit 'admin' claim grants admin, matching the API's isAdminAuthHeader /
    // public.is_admin() (both hardened to treat an absent claim as non-admin).
    return claims?.user_entitlement === 'admin' ? 'admin' : 'user';
  } catch {
    return 'user'; // undecodable token → fail-safe to non-admin
  }
}

const OrgContext = createContext<OrgContextState | undefined>(undefined);

export const useOrg = () => {
  const ctx = useContext(OrgContext);
  if (ctx === undefined) {
    throw new Error('useOrg must be used within an OrgProvider');
  }
  return ctx;
};

export const OrgProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, session } = useAuth();
  const navigate = useNavigate();
  const [orgRole, setOrgRole] = useState<'admin' | 'user'>('user');
  const [homeOrgId, setHomeOrgId] = useState<string | null>(null);
  const [activeOrgId, setActiveOrgIdState] = useState<string | null>(null);
  const [accessibleOrgs, setAccessibleOrgs] = useState<AccessibleOrg[]>([]);
  // True once the accessible-orgs question is SETTLED for this session — fetch succeeded, fetch
  // failed (the API client aborts at 30s, so it always settles), or no fetch will ever run
  // (non-admin / flag off / signed out). Consumers may use this to defer multi-org-dependent
  // work (ENG-454: the dashboard holds its first fetch to avoid a home-only flash); it must
  // NEVER gate routes — the accessible-orgs fill stays non-blocking (July 2026 incident).
  const [accessibleOrgsResolved, setAccessibleOrgsResolved] = useState(false);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  // Refs so the revocation callback always reads the latest values without a stale closure
  const activeOrgIdRef = useRef<string | null>(null);
  const homeOrgIdRef = useRef<string | null>(null);
  // Previous JWT-derived role, so the token-sync effect below can detect a mid-session
  // user→admin transition (vs. the mount run / a same-role refresh) without extra deps.
  const prevRoleRef = useRef<'admin' | 'user' | null>(null);

  useEffect(() => { activeOrgIdRef.current = activeOrgId; }, [activeOrgId]);
  useEffect(() => { homeOrgIdRef.current = homeOrgId; }, [homeOrgId]);

  useEffect(() => {
    const userId = user?.id;
    const token = session?.access_token;
    setLoading(true); // reset on re-run (e.g. user switch) so stale state isn't shown mid-resolve
    setError(false);  // clear any prior error so a successful re-run unblocks the AppShell gate
    // Reset all org-derived state to safe defaults on sign-out / token loss (and at the start of a
    // user switch) so a previous session's role/orgs can't linger and render stale or admin-only UI
    // while the provider stays mounted across the auth transition. loading=true gates the UI meanwhile.
    setOrgRole('user');
    setAccessibleOrgs([]);
    setAccessibleOrgsResolved(false);
    setHomeOrgId(null);
    setActiveOrgIdState(null);
    activeOrgIdRef.current = null;
    homeOrgIdRef.current = null;
    traceforcApi.setActiveOrgId(null);
    // On sign-out / token loss, also clear the PERSISTED active org so a later sign-in in the same tab
    // can't inherit the previous user's selection. (Only here, not on every effect run — a normal
    // reload keeps the stored value so the bootstrap below can restore it.)
    if (!token || !userId) { writeStored(null); setLoading(false); setAccessibleOrgsResolved(true); return; }

    let cancelled = false;

    // Admin-ness comes from the JWT (user_entitlement claim), matching the API's is_admin() gate — no
    // DB read, no API call.
    const role = token ? decodeEntitlement(token) : 'user';
    setOrgRole(role);

    // ONE bootstrap for everyone: resolve the home org from the local user_profiles row. This is the
    // only thing the AppShell gate waits on — one fast Supabase read, never a traceforce-API call —
    // so the admin path unblocks the shell exactly like the non-admin path. The accessible-orgs fetch
    // below is a BACKGROUND fill for the admin-only surfaces (tenant switcher, subsidiary banner,
    // /org-access), mirroring how every other admin surface is render-gated on orgRole rather than
    // load-bearing: if that endpoint is slow or down, those surfaces degrade — the app must not wedge
    // every route on "Loading…" (the July 2026 incident, where a hung accessible-orgs bricked the SPA
    // the moment the entitlement hook made anyone admin).
    (async () => {
      // maybeSingle() returns null (not a thrown error) when no profile row exists yet.
      const { data, error: dbError } = await supabase
        .from('user_profiles')
        .select('org_id')
        .eq('id', userId)
        .maybeSingle();
      if (cancelled) return;
      // Session but no profile row: this sign-in skipped /auth/callback (e.g. an IdP-initiated SAML
      // login lands on the Site URL host directly), and the callback is the only place that creates
      // the org + profile. Hand off to it — it runs on any existing session and signs out on failure,
      // so this can't loop. A query ERROR still falls through to the error state below.
      if (!dbError && !data) {
        navigate('/auth/callback', { replace: true });
        return;
      }
      const home = data?.org_id ?? null;
      if (dbError || !home) {
        if (dbError) console.error('OrgContext: could not resolve org', dbError);
        // No home org resolved → coherent error state (the AppShell gate blocks on !activeOrgId).
        setError(true);
        setLoading(false);
        setAccessibleOrgsResolved(true);
        return;
      }

      const isAdmin = MULTI_ORG_ENABLED && role === 'admin';
      // Admins: restore a persisted subsidiary selection optimistically (same UX as the old blocking
      // bootstrap — reloading while switched stays switched) and validate it against the accessible
      // set once the background fetch lands. This is UI state only, not the authz boundary: an active
      // org the admin can't actually access just 403s (ORG_NOT_ACCESSIBLE) server-side → onOrgRevoked
      // resets to home.
      const active = (isAdmin ? readStored() : null) ?? home;

      // Sync the refs synchronously (not only via the [activeOrgId]/[homeOrgId] effects, which run
      // after this render): a 403 reaching onOrgRevoked before the post-render sync must see the
      // just-resolved active/home orgs, not stale nulls.
      homeOrgIdRef.current = home;
      activeOrgIdRef.current = active;
      setHomeOrgId(home);
      setActiveOrgIdState(active);
      // Non-admins never send X-Active-Org-Id (client stays null) — unchanged. getAccessibleOrgs
      // itself is skipOrgScope, so setting the admin's active org before that fetch is safe.
      traceforcApi.setActiveOrgId(isAdmin ? active : null);
      setLoading(false); // ← shell unblocked here; nothing below gates any route

      if (!isAdmin) { setAccessibleOrgsResolved(true); return; } // no fill will run — settled

      // Background fill of the multi-org set. Failure degrades the admin surfaces (isMultiOrg stays
      // false → no switcher) and is surfaced (no silent fallbacks — house rule); it does NOT set the
      // app-wide error gate.
      const result = await traceforcApi.getAccessibleOrgs(token);
      if (cancelled) return;
      setAccessibleOrgsResolved(true); // settled either way (client aborts at 30s, so this always runs)
      if (result.error || !result.data?.orgs?.length) {
        console.error('OrgContext: failed to load accessible orgs', result.error);
        toast('Could not load your organizations — the org switcher is unavailable.');
        // The optimistic subsidiary restore is only safe while it can still be VALIDATED. With the
        // accessible set unavailable, an admin restored into a subsidiary would be stranded there:
        // accessibleOrgs stays [] → isMultiOrg false → no switcher and no banner to get back home,
        // and pure-Supabase pages never 403 (RLS just returns empty), so onOrgRevoked can't rescue.
        // Fall back to home — the one org that needs no validation.
        if (activeOrgIdRef.current !== home) {
          activeOrgIdRef.current = home;
          setActiveOrgIdState(home);
          writeStored(home);
          traceforcApi.setActiveOrgId(home);
        }
        return;
      }
      const { orgs } = result.data;
      // The API's is_home and the local user_profiles.org_id derive from the same row; prefer the
      // API's value once present (mirrors refresh()).
      const fetchedHome = orgs.find(o => o.is_home)?.org_id ?? home;
      homeOrgIdRef.current = fetchedHome;
      setHomeOrgId(fetchedHome);
      setAccessibleOrgs(orgs);
      // Validate the optimistic restore: a persisted selection that's no longer accessible falls back
      // to home (same reconciliation as refresh()).
      const current = activeOrgIdRef.current;
      if (current && !orgs.some(o => o.org_id === current)) {
        activeOrgIdRef.current = fetchedHome;
        setActiveOrgIdState(fetchedHome);
        writeStored(fetchedHome);
        traceforcApi.setActiveOrgId(fetchedHome);
      }
    })();

    traceforcApi.setOnOrgRevoked((revokedOrgId: string) => {
      const currentActiveOrgId = activeOrgIdRef.current;
      const currentHomeOrgId = homeOrgIdRef.current;

      if (revokedOrgId !== currentActiveOrgId) return; // late 403 from pre-switch request — ignore

      if (revokedOrgId === currentHomeOrgId || currentHomeOrgId === null) {
        setError(true);
        return;
      }

      // Update the ref synchronously (before the async re-render) so several concurrent 403s for the
      // same org don't each re-run the reset/toast — the next callback sees home as the active org.
      activeOrgIdRef.current = currentHomeOrgId;
      setActiveOrgIdState(currentHomeOrgId);
      writeStored(currentHomeOrgId);
      setAccessibleOrgs(prev => prev.filter(o => o.org_id !== revokedOrgId));
      traceforcApi.setActiveOrgId(currentHomeOrgId);
      toast('Access revoked — returning to your organization');
    });

    return () => {
      cancelled = true;
      traceforcApi.setOnOrgRevoked(null); // clear the handler outright rather than installing a noop
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Re-fetch the accessible-org set on demand (after a create-or-link/revoke) so the tenant switcher
  // reflects newly linked orgs without a full reload. Lightweight: no loading gate (no flicker), and
  // it keeps the current active org unless that org just dropped out of the set (then fall to home).
  // Declared ABOVE the token-sync effect below, which lists it as a dependency (deps are evaluated
  // at render, so a later declaration would be a TDZ error).
  const refresh = useCallback(async () => {
    const token = session?.access_token;
    // Only admins have a switcher to refresh, and accessible-orgs is admin-only — gate on the JWT role
    // so a non-admin never hits the (403) endpoint.
    if (!token || !MULTI_ORG_ENABLED || decodeEntitlement(token) !== 'admin') return;
    const result = await traceforcApi.getAccessibleOrgs(token);
    if (result.error || !result.data?.orgs?.length) {
      // Surface the failure instead of silently leaving a stale switcher (no silent fallbacks — house
      // rule). refresh() is user-triggered (create/link/revoke), so a toast — not just a console
      // log — is needed; keep the existing accessibleOrgs rather than wiping to empty on a transient error.
      console.error('OrgContext.refresh: failed to refresh accessible orgs', result.error);
      toast('Could not refresh your organizations — the list may be out of date.');
      return;
    }
    const { orgs } = result.data;
    const home = orgs.find(o => o.is_home)?.org_id ?? null;
    // Sync homeOrgIdRef synchronously (not only via the [homeOrgId] effect, which runs after render):
    // onOrgRevoked reads this ref to decide whether the revoked org is home, so a stale ref right after
    // a refresh could misclassify the revocation.
    homeOrgIdRef.current = home;
    setHomeOrgId(home);
    setAccessibleOrgs(orgs);
    const active = activeOrgIdRef.current;
    if (active && !orgs.some(o => o.org_id === active) && home) {
      // Same ref-sync reason as setActiveOrg: update the ref now so a later revocation callback sees
      // home as active rather than the org that just dropped out of the accessible set.
      activeOrgIdRef.current = home;
      setActiveOrgIdState(home);
      writeStored(home);
      traceforcApi.setActiveOrgId(home);
    }
  }, [session?.access_token]);

  // Keep orgRole in sync with the LIVE token, not just the bootstrap run. The bootstrap effect above is
  // keyed on [user?.id], so a Supabase TOKEN_REFRESHED that changes the user_entitlement claim (e.g. an
  // admin getting admin revoked mid-session) would otherwise leave orgRole — and the admin-only surfaces
  // gated on it — stale until reload/sign-out. Re-derive orgRole from the fresh access_token so admin-only
  // UI hides immediately. UI-consistency only: the API re-checks the JWT entitlement on every request
  // (withAuth), so a stale-admin client is already 403'd server-side; this is not the authz boundary.
  // Kept as a SEPARATE effect (no loading gate, no data fetch) so it can't flicker or re-trigger the
  // bootstrap fetch. The heavier multi-org teardown (accessibleOrgs, active→home) is intentionally left to
  // the next natural bootstrap to avoid racing the ref-synced bootstrap state.
  useEffect(() => {
    const token = session?.access_token;
    if (!token) {
      // Sign-out / token loss: state reset is handled by the bootstrap effect. Reset the role
      // tracker too, so a next same-tab sign-in starts from "mount" semantics instead of
      // comparing against the PREVIOUS user's role (which could mis-detect a transition).
      prevRoleRef.current = null;
      return;
    }
    const role = decodeEntitlement(token);
    const prevRole = prevRoleRef.current;
    prevRoleRef.current = role;
    setOrgRole(role);
    // On a mid-session UPGRADE user→admin (e.g. the app-load token re-mint in AuthContext picking
    // up a new entitlement), the [user?.id] bootstrap already ran as non-admin and never fetched
    // the multi-org set — fill it in the background so the tenant switcher appears without a
    // reload. refresh() is non-blocking and internally admin/flag-gated; mount runs (prevRole
    // null) are excluded because the bootstrap handles those.
    if (role === 'admin' && prevRole === 'user') {
      void refresh();
    }
    // On a downgrade admin→user, realign BOTH tenant surfaces back to home so they can't disagree:
    // (1) stop the API client attaching X-Active-Org-Id — makeRequest sends it whenever MULTI_ORG_ENABLED
    //     and activeOrgId is set (it doesn't consult orgRole), so a just-downgraded admin would keep
    //     switch-scoping requests (→ 403s / revocation handling);
    // (2) reset OrgContext's OWN active org (state + ref + sessionStorage) to the resolved home org.
    //     The UI is keyed on activeOrgId and Supabase RPCs scope via orgRpcArgs(activeOrgId); left at a
    //     subsidiary, the user would be stuck viewing an org they can no longer switch away from
    //     (TenantSwitcher is admin-gated) while API calls default to home — an inconsistent tenant state.
    // Do NOT touch the client in (2): it must stay null for a non-admin. This mirrors setActiveOrg minus
    // the client call; homeOrgIdRef is already populated by the [user?.id] bootstrap effect.
    if (role !== 'admin') {
      traceforcApi.setActiveOrgId(null);
      const home = homeOrgIdRef.current;
      if (home && activeOrgIdRef.current !== home) {
        activeOrgIdRef.current = home;
        setActiveOrgIdState(home);
        writeStored(home);
      }
    }
  }, [session?.access_token, refresh]);

  const setActiveOrg = useCallback((id: string) => {
    // Sync the ref synchronously (not just via the [activeOrgId] effect, which runs after render): a
    // 403 from a request fired right after the switch could otherwise reach onOrgRevoked while the ref
    // still holds the PREVIOUS org, mis-firing the revocation reset against the org we just left.
    activeOrgIdRef.current = id;
    setActiveOrgIdState(id);
    writeStored(id);
    traceforcApi.setActiveOrgId(id);
  }, []);

  const isMultiOrg = accessibleOrgs.length > 1;

  const value: OrgContextState = {
    orgRole,
    homeOrgId,
    activeOrgId,
    isMultiOrg,
    accessibleOrgs,
    accessibleOrgsResolved,
    error,
    loading,
    setActiveOrg,
    refresh,
  };

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
};
