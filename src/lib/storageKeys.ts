// Shared browser-storage keys. Kept in a leaf module (no context imports) so both AuthContext and
// OrgContext can reference them without creating a circular dependency between the two contexts.
export const ACTIVE_ORG_KEY = 'traceforce_active_org_id';
export const DASHBOARD_ORG_FILTER_KEY = 'traceforce_dashboard_org_filter';
// Set (epoch ms) when the idle timeout signs the user out; the auth page
// reads-and-clears it to explain the logout with a persistent banner — a
// toast at sign-out time is gone by the time a user returns from another tab.
export const IDLE_SIGNOUT_AT_KEY = 'traceforce_idle_signout_at';
// Set (epoch ms) right before every deliberate sign-out (user menu, idle timeout, auth-callback errors).
// A SIGNED_OUT with no recent marker means the server ended the session. Lives in localStorage so a
// sign-out in one tab isn't misread as an expiry by the other tabs that receive the same event.
export const INTENTIONAL_SIGNOUT_AT_KEY = 'traceforce_intentional_signout_at';
// Set (epoch ms) when the server ended the session (timebox / inactivity / revoked refresh token);
// the auth page reads-and-clears it to explain the logout, like IDLE_SIGNOUT_AT_KEY.
export const SESSION_EXPIRED_AT_KEY = 'traceforce_session_expired_at';
