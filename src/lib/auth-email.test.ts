import { describe, expect, test } from 'bun:test';
import { isTrialBlockedDomain } from './auth-email';

describe('isTrialBlockedDomain', () => {
  test('blocks listed domains and their subdomains, case-insensitively', () => {
    expect(isTrialBlockedDomain('a@oximy.com')).toBe(true);
    expect(isTrialBlockedDomain(' A@Onyx.Security ')).toBe(true);
    expect(isTrialBlockedDomain('a@mail.neo.ai')).toBe(true);
    expect(isTrialBlockedDomain('a@manifold.security')).toBe(true);
    expect(isTrialBlockedDomain('a@bloom.security')).toBe(true);
    expect(isTrialBlockedDomain('a@bay.security')).toBe(true);
  });

  test('does not block lookalike or unrelated domains', () => {
    expect(isTrialBlockedDomain('a@notneo.ai')).toBe(false);
    expect(isTrialBlockedDomain('a@glow.io.example.com')).toBe(false);
    expect(isTrialBlockedDomain('a@traceforce.ai')).toBe(false);
    expect(isTrialBlockedDomain('ent.ai')).toBe(false);
  });
});
