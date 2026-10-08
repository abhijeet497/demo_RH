const PERSONAL_GMAIL_DOMAINS = new Set(['gmail.com', 'googlemail.com']);

/** Consumer Microsoft account domains (not Entra / work tenants on custom domains). */
const PERSONAL_MICROSOFT_DOMAINS = new Set([
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
]);

/** Domains (and their subdomains) that may not sign in to the trial deployment. */
const TRIAL_BLOCKED_DOMAINS = new Set([
  'oximy.com',
  'onyx.security',
  'geordie.ai',
  'glow.io',
  'ent.ai',
  'neo.ai',
  'manifold.security',
  'bloom.security',
  'bay.security',
]);

export const TRIAL_BLOCKED_MESSAGE =
  'This email domain is not eligible for the Traceforce trial. Please contact us at traceforce.ai/contact.';

export type OauthIdp = 'google' | 'azure';

export function isPersonalGmailDomain(email: string): boolean {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf('@');
  if (at < 1) return false;
  const domain = trimmed.slice(at + 1);
  return PERSONAL_GMAIL_DOMAINS.has(domain);
}

export function isPersonalMicrosoftConsumerDomain(email: string): boolean {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf('@');
  if (at < 1) return false;
  const domain = trimmed.slice(at + 1);
  return PERSONAL_MICROSOFT_DOMAINS.has(domain);
}

export function isTrialBlockedDomain(email: string): boolean {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf('@');
  if (at < 1) return false;
  const labels = trimmed.slice(at + 1).split('.');
  // Check the domain and every parent (mail.oximy.com -> oximy.com).
  for (let i = 0; i < labels.length - 1; i++) {
    if (TRIAL_BLOCKED_DOMAINS.has(labels.slice(i).join('.'))) return true;
  }
  return false;
}

function isTrialMode(): boolean {
  return import.meta.env?.VITE_TRIAL_MODE === 'true';
}

/** True when this is the trial deployment and the email's domain is blocked from it. */
export function isBlockedFromTrial(email: string): boolean {
  return isTrialMode() && isTrialBlockedDomain(email);
}

/**
 * Validates work email before Google or Microsoft OAuth (blocks common personal domains).
 */
export function validateOAuthWorkEmail(email: string): string | null {
  const t = email.trim();
  if (!t) {
    return 'Enter your work email address.';
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) {
    return 'Enter a valid email address.';
  }
  if (isPersonalGmailDomain(t)) {
    return 'Use your company Google account (your organization\'s domain). Personal @gmail.com addresses are not supported.';
  }
  if (isPersonalMicrosoftConsumerDomain(t)) {
    return 'Use your work Microsoft account (your organization\'s Microsoft 365 / Entra ID). Personal Outlook, Hotmail, or Live addresses are not supported.';
  }
  if (isBlockedFromTrial(t)) {
    return TRIAL_BLOCKED_MESSAGE;
  }
  return null;
}

/** @deprecated Use validateOAuthWorkEmail */
export const validateGoogleWorkEmail = validateOAuthWorkEmail;

/** Email the user entered before OAuth (lowercased). */
export const OAUTH_LOGIN_HINT_KEY = 'traceforce_oauth_login_hint';

/** Expected IdP: `google` | `azure` (Supabase uses provider `azure` for Microsoft). */
export const OAUTH_PROVIDER_EXPECTED_KEY = 'traceforce_oauth_provider';

/** @deprecated Use OAUTH_LOGIN_HINT_KEY */
export const GOOGLE_LOGIN_HINT_KEY = OAUTH_LOGIN_HINT_KEY;
