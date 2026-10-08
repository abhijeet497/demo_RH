import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface TrialStatus {
  isTrial: boolean;
  isExpired: boolean;
  daysRemaining: number | null;
  expiresAt: string | null;
  isLoading: boolean;
  isError: boolean;
}

export function useTrialStatus(): TrialStatus {
  const { user } = useAuth();
  const trialMode = import.meta.env.VITE_TRIAL_MODE === 'true';

  const { data, isLoading, isError } = useQuery({
    queryKey: ['trial-status', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orgs')
        .select('trial_expires_at')
        .single();

      if (error || !data) return null;
      return data.trial_expires_at;
    },
    enabled: !!user && trialMode,
    staleTime: 5 * 60 * 1000,
  });

  if (!trialMode || !user) {
    return { isTrial: false, isExpired: false, daysRemaining: null, expiresAt: null, isLoading: false, isError: false };
  }

  if (isLoading) {
    return { isTrial: false, isExpired: false, daysRemaining: null, expiresAt: null, isLoading: true, isError: false };
  }

  if (isError) {
    return { isTrial: true, isExpired: false, daysRemaining: null, expiresAt: null, isLoading: false, isError: true };
  }

  if (!data) {
    return { isTrial: false, isExpired: false, daysRemaining: null, expiresAt: null, isLoading: false, isError: false };
  }

  const expiresAt = new Date(data);
  const now = new Date();
  const diffMs = expiresAt.getTime() - now.getTime();
  const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  const isExpired = diffMs <= 0;

  return {
    isTrial: true,
    isExpired,
    daysRemaining,
    expiresAt: data,
    isLoading: false,
    isError: false,
  };
}
