import { useCallback, useEffect, useRef, useState } from 'react';

// Server-side session limits (Supabase inactivity timeout) only observe token
// refreshes, and an open tab auto-refreshes forever — so a tab left open never
// goes "idle" server-side. This hook supplies the user-activity semantics
// (NIST 800-63B AAL2: reauthenticate after 30 minutes of user inactivity):
// track real interaction, warn shortly before the limit, and expire at it.

// Last-activity timestamp is shared across tabs so typing in one tab keeps a
// dashboard open in another from logging the whole browser out.
const LAST_ACTIVITY_KEY = 'tf-last-activity-at';

// Persisting activity on every mousemove would hammer localStorage; batching
// to one write per few seconds costs at most that much timeout precision.
const ACTIVITY_WRITE_INTERVAL_MS = 5_000;

const CHECK_INTERVAL_MS = 1_000;

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  'pointerdown',
  'pointermove',
  'keydown',
  'wheel',
  'touchstart',
  'scroll',
];

export interface IdleTimeoutState {
  /** True once idle time has entered the warning window. */
  warned: boolean;
  /** Seconds until expiry; only meaningful while warned. */
  remainingSeconds: number;
  /** Reset the idle clock (e.g. "Stay signed in" in the warning dialog). */
  stayActive: () => void;
}

export function useIdleTimeout(options: {
  /** Total idle time before expiry, in minutes. */
  idleMinutes: number;
  /** How long before expiry the warning shows, in minutes. */
  warnMinutes: number;
  /** Called once when the idle limit is reached. May be async; rejections are logged. */
  onExpire: () => void | Promise<void>;
  /** Master switch — when false the hook is inert. */
  enabled: boolean;
}): IdleTimeoutState {
  const { idleMinutes, warnMinutes, onExpire, enabled } = options;
  const [warned, setWarned] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const lastWriteRef = useRef(0);
  const expiredRef = useRef(false);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  const touch = useCallback((force = false) => {
    const now = Date.now();
    if (!force && now - lastWriteRef.current < ACTIVITY_WRITE_INTERVAL_MS) return;
    lastWriteRef.current = now;
    try {
      localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
    } catch {
      /* private mode / ITP: single-tab behavior still works via lastWriteRef */
    }
  }, []);

  const readLastActivity = useCallback((): number => {
    try {
      const raw = localStorage.getItem(LAST_ACTIVITY_KEY);
      const parsed = raw ? Number(raw) : NaN;
      if (Number.isFinite(parsed)) return parsed;
    } catch {
      /* fall through */
    }
    return lastWriteRef.current;
  }, []);

  const stayActive = useCallback(() => {
    expiredRef.current = false;
    setWarned(false);
    touch(true);
  }, [touch]);

  useEffect(() => {
    if (!enabled) return;

    // Start the clock at mount, not zero — otherwise a freshly opened app
    // with no stored timestamp counts as idle-since-epoch.
    touch(true);
    expiredRef.current = false;

    const onActivity = () => {
      touch();
      // Any real interaction dismisses the warning without needing the button.
      setWarned((w) => (w ? false : w));
    };
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));

    const interval = window.setInterval(() => {
      if (expiredRef.current) return;
      const idleMs = Date.now() - readLastActivity();
      const limitMs = idleMinutes * 60_000;
      // Clamp to [0, idleMinutes]: env-sourced overrides can otherwise make the
      // warning window negative (never warns) or larger than the whole timeout
      // (warns immediately and forever).
      const warnMs = limitMs - Math.min(Math.max(warnMinutes, 0), idleMinutes) * 60_000;

      if (idleMs >= limitMs) {
        expiredRef.current = true;
        setWarned(false);
        void Promise.resolve(onExpireRef.current()).catch((err) =>
          console.error('Idle-timeout sign-out failed:', err)
        );
      } else if (idleMs >= warnMs) {
        setWarned(true);
        setRemainingSeconds(Math.max(0, Math.ceil((limitMs - idleMs) / 1000)));
      } else {
        setWarned((w) => (w ? false : w));
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, onActivity));
      window.clearInterval(interval);
    };
  }, [enabled, idleMinutes, warnMinutes, touch, readLastActivity]);

  return { warned, remainingSeconds, stayActive };
}
