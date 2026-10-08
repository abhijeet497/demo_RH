import React, { useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useIdleTimeout } from '@/hooks/useIdleTimeout';
import { supabase } from '@/integrations/supabase/client';
import { IDLE_SIGNOUT_AT_KEY } from '@/lib/storageKeys';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { IDLE_TIMEOUT_MINUTES, IDLE_WARNING_MINUTES } from '@/lib/featureFlags';

/**
 * Signs the user out after IDLE_TIMEOUT_MINUTES without interaction, with a
 * countdown warning beforehand. Mounted inside ProtectedRoute so it only runs
 * for authenticated views; sign-out flips useAuth().user to null and
 * ProtectedRoute redirects to /auth.
 *
 * This is the user-activity half of the session-timeout requirement — the
 * server-side half (Supabase inactivity/timebox) can't see users, only token
 * refreshes, and an open tab refreshes forever.
 */
const IdleTimeoutGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { signOut } = useAuth();

  const handleExpire = useCallback(async () => {
    // Persist the reason BEFORE signing out: the auth page renders it as a
    // static banner, which survives however long the user takes to come back
    // (a toast fired here would be gone before a user returns from another tab).
    try {
      localStorage.setItem(IDLE_SIGNOUT_AT_KEY, String(Date.now()));
    } catch {
      /* private mode: banner is best-effort */
    }
    await signOut();
  }, [signOut]);

  const { warned, remainingSeconds, stayActive } = useIdleTimeout({
    idleMinutes: IDLE_TIMEOUT_MINUTES,
    warnMinutes: IDLE_WARNING_MINUTES,
    onExpire: handleExpire,
    enabled: IDLE_TIMEOUT_MINUTES > 0,
  });

  const handleStay = () => {
    stayActive();
    // Also bump server-side session activity so the Supabase inactivity
    // timeout and the UI idle clock stay in step.
    void supabase.auth.refreshSession();
  };

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;

  return (
    <>
      {children}
      <AlertDialog open={warned}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you still there?</AlertDialogTitle>
            <AlertDialogDescription>
              You will be signed out in {minutes}:{String(seconds).padStart(2, '0')} due to
              inactivity.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={handleStay}>Stay signed in</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default IdleTimeoutGuard;
