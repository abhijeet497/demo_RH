import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { OAUTH_LOGIN_HINT_KEY, OAUTH_PROVIDER_EXPECTED_KEY, type OauthIdp } from '@/lib/auth-email';
import { ACTIVE_ORG_KEY, INTENTIONAL_SIGNOUT_AT_KEY, SESSION_EXPIRED_AT_KEY } from '@/lib/storageKeys';
import { mcpAccessEnabled, REGULAR_USER_MODE } from '@/lib/featureFlags';

/** Entitlement claim carried in the access token JWT. */
export type UserEntitlement = 'admin' | 'user';

/**
 * Decode the `user_entitlement` claim from a Supabase access token (JWT).
 * Returns null if the token is missing/malformed or the claim is absent —
 * callers should treat null as "no restriction" (full/admin view).
 */
function decodeUserEntitlement(accessToken: string | undefined | null): UserEntitlement | null {
  if (!accessToken) return null;
  try {
    const payload = accessToken.split('.')[1];
    if (!payload) return null;
    // JWT payloads are base64url with padding stripped; restore '+'/'/' and the
    // '=' padding before atob, which otherwise throws on many valid lengths.
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '=');
    const json = decodeURIComponent(
      atob(padded)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const entitlement = JSON.parse(json)?.user_entitlement;
    return entitlement === 'admin' || entitlement === 'user' ? entitlement : null;
  } catch {
    return null;
  }
}

/** Seconds since the access token was minted (its `iat` claim), or null if undecodable. */
function tokenAgeSec(accessToken: string): number | null {
  try {
    const payload = accessToken.split('.')[1];
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '=');
    const iat = JSON.parse(atob(padded))?.iat;
    return typeof iat === 'number' ? Math.floor(Date.now() / 1000) - iat : null;
  } catch {
    return null;
  }
}

// Only re-mint the token when the current one is older than this. Guards against refresh-token
// churn from rapid reloads / several tabs opening at once — NOT a delay on entitlement changes:
// any token minted more than 5 minutes ago (i.e. virtually every page load) refreshes immediately.
const TOKEN_REMINT_MIN_AGE_SEC = 300;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  /** True only when the entitlement is explicitly 'user' — drives the limited regular-user view. */
  isRegularUser: boolean;
  /** Dev/preview-only view simulation (UserMenu "View as user/admin"); no-op
   * in production, where the only caller is dead-code-eliminated. */
  setViewOverride: (view: 'user' | 'admin' | null) => void;
  /** @param workEmail Optional company email used as Google's OAuth login_hint. */
  signInWithGoogle: (workEmail?: string) => Promise<void>;
  signInWithMicrosoft: (workEmail: string) => Promise<void>;
  signInWithSSO: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const hadSessionRef = useRef(false);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Clear the persisted active-org selection on sign-out HERE (not only in OrgProvider): OrgProvider
        // is unmounted by ProtectedRoute on logout, so its own reset never runs. AuthProvider is the app
        // root and never unmounts, so this listener reliably fires — preventing a next same-tab sign-in
        // from inheriting the previous user's active org.
        if (event === 'SIGNED_OUT') {
          try { sessionStorage.removeItem(ACTIVE_ORG_KEY); } catch { /* ITP / private mode: best-effort */ }
          // No deliberate sign-out in the last minute (in any tab) → the server ended the session, e.g. a
          // rejected refresh. Flag it so the auth page explains the logout instead of a silent bounce.
          // Only if this tab had a session: auth-js also emits SIGNED_OUT when a failed-login callback URL
          // (?error_description=...) is parsed, and that must not read as "your session expired".
          try {
            const intentionalAt = Number(localStorage.getItem(INTENTIONAL_SIGNOUT_AT_KEY));
            if (hadSessionRef.current && !(Date.now() - intentionalAt < 60_000)) {
              localStorage.setItem(SESSION_EXPIRED_AT_KEY, String(Date.now()));
            }
          } catch { /* private mode: no banner */ }
        } else if (event === 'SIGNED_IN') {
          try { localStorage.removeItem(SESSION_EXPIRED_AT_KEY); } catch { /* private mode */ }
        }
        hadSessionRef.current = !!session;
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      // Re-mint the token on app load: user_entitlement lives in the JWT and is otherwise frozen
      // until expiry, so a role change (or enabling the entitlement hook) would take days to reach
      // an active session — the "have to log out and back in" problem. Fire-and-forget: the app
      // renders with the current claims and TOKEN_REFRESHED delivers the fresh ones moments later
      // (OrgContext re-derives orgRole from the live token; isRegularUser recomputes off session).
      // age < 0 = client clock behind the server's iat; the token's true age is unknowable locally,
      // so refresh rather than silently skipping (a skewed clock would otherwise suppress the
      // re-mint entirely and re-open the stale-entitlement window this exists to close).
      const age = session ? tokenAgeSec(session.access_token) : null;
      if (age !== null && (age > TOKEN_REMINT_MIN_AGE_SEC || age < 0)) {
        void supabase.auth.refreshSession();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  function clearOauthPreflight() {
    sessionStorage.removeItem(OAUTH_LOGIN_HINT_KEY);
    sessionStorage.removeItem(OAUTH_PROVIDER_EXPECTED_KEY);
  }

  function setOauthPreflight(workEmail: string | undefined, idp: OauthIdp) {
    const email = workEmail?.trim();
    if (email) {
      sessionStorage.setItem(OAUTH_LOGIN_HINT_KEY, email.toLowerCase());
    } else {
      sessionStorage.removeItem(OAUTH_LOGIN_HINT_KEY);
    }
    sessionStorage.setItem(OAUTH_PROVIDER_EXPECTED_KEY, idp);
  }

  const signInWithGoogle = async (workEmail?: string) => {
    const email = workEmail?.trim();
    setOauthPreflight(email, 'google');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        ...(email ? { queryParams: { login_hint: email } } : {}),
      },
    });
    if (error) {
      clearOauthPreflight();
      console.error('Error signing in with Google:', error);
      throw error;
    }
  };

  const signInWithMicrosoft = async (workEmail: string) => {
    const email = workEmail.trim();
    setOauthPreflight(email, 'azure');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        // Supabase requires an email from Azure; request OIDC scopes (see Auth > Azure docs).
        scopes: 'email',
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          login_hint: email,
        },
      },
    });
    if (error) {
      clearOauthPreflight();
      console.error('Error signing in with Microsoft:', error);
      throw error;
    }
  };


  const signInWithSSO = async (email: string) => {
    // Extract domain from email
    const domain = email.split('@')[1];
    if (!domain) {
      throw new Error('Invalid email format');
    }
    
    // Default SAML flow for non-whitelisted emails
    const { data: signInData, error: signInError } = await supabase.auth.signInWithSSO({
      domain: domain,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    });
    
    if (signInError) {
      console.error('Error signing in with SSO:', signInError);
      throw signInError;
    }

    // A host-less URL (e.g. "?SAMLRequest=...") means the provider's IdP metadata has no HTTP-Redirect
    // binding; following it just reloads this page, so fail loudly instead.
    if (!signInData?.url?.startsWith('https://')) {
      console.error('SSO sign-in returned an unusable IdP URL:', signInData?.url);
      throw new Error("Single sign-on isn't set up correctly for your organization. Please contact support.");
    }

    // redirect the user to the identity provider's authentication flow
    window.location.href = signInData.url
  };

  const signOut = async () => {
    // Mark BEFORE the SIGNED_OUT event fires (here and in other tabs) so it isn't read as a server expiry.
    try { localStorage.setItem(INTENTIONAL_SIGNOUT_AT_KEY, String(Date.now())); } catch { /* private mode */ }
    // Check if there's an active Supabase session before attempting remote sign-out
    const { data: { session: currentSession } } = await supabase.auth.getSession();

    if (!currentSession) {
      console.log('No active Supabase session found during sign-out; clearing local auth state.');
      setSession(null);
      setUser(null);
      return;
    }

    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error signing out:', error);
      // Even if remote sign-out fails, clear local auth state so the UI is not left authenticated
    }

    setSession(null);
    setUser(null);
  };
  // Entitlement is computed from the JWT but kept internal — consumers only need
  // isRegularUser, so it isn't exposed on the context value.
  const userEntitlement = useMemo(
    () => decodeUserEntitlement(session?.access_token),
    [session?.access_token]
  );
  // Dev/preview-only runtime override of the view simulation (UserMenu "View
  // as user/admin"). null = no override (the computed value below applies).
  // Never set in production — the setter is only reachable from the
  // viewSwitcherEnabled-gated menu item, which production builds eliminate.
  const [viewOverride, setViewOverride] = useState<'user' | 'admin' | null>(null);

  // Gated behind the MCP-access feature flag: with the flag off, the regular-user
  // flow is fully neutralized (isRegularUser is always false) so every account
  // gets the existing full/admin experience — unless VITE_REGULAR_USER_MODE forces it.
  const isRegularUser =
    viewOverride !== null
      ? viewOverride === 'user'
      : REGULAR_USER_MODE || (mcpAccessEnabled && userEntitlement === 'user');

  const value = {
    user,
    session,
    loading,
    isRegularUser,
    setViewOverride,
    signInWithGoogle,
    signInWithMicrosoft,
    signInWithSSO,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};