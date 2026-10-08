import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const DEFAULT_DEVICE_LIMIT = 10;

/**
 * Effective per-org device limit, sourced from the `max_devices` feature flag
 * (global default + per-org override). Falls back to 10 if unavailable.
 */
export function useDeviceLimit(): { deviceLimit: number; isLoading: boolean } {
  const { user } = useAuth();
  const trialMode = import.meta.env.VITE_TRIAL_MODE === 'true';

  const { data, isLoading } = useQuery({
    queryKey: ['device-limit', user?.id],
    queryFn: async () => {
      const { data: org, error: orgError } = await supabase
        .from('orgs')
        .select('id')
        .single();
      if (orgError || !org) return null;

      const { data: flags, error: flagsError } = await supabase.rpc(
        'get_effective_feature_flags',
        { p_org_id: org.id }
      );
      if (flagsError || !flags) return null;

      const flag = flags.find((f) => f.name === 'max_devices');
      const count = (flag?.value as unknown as { count?: number } | null)?.count;
      return typeof count === 'number' ? count : null;
    },
    enabled: !!user && trialMode,
    staleTime: 5 * 60 * 1000,
  });

  return { deviceLimit: data ?? DEFAULT_DEVICE_LIMIT, isLoading };
}
