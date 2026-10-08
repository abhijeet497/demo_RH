import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrg } from '@/contexts/OrgContext';

/**
 * The boolean value of `name` for the active org, via the
 * `get_effective_feature_flags` RPC (global default in `feature_flag_defaults`,
 * overridable per org in `org_feature_flags`). Missing flags, non-boolean values,
 * and query errors fail closed (`enabled: false`).
 *
 * `error` is true ONLY on an actual RPC failure (not a missing/off flag), so a
 * caller that must not conflate "flag is off" with "we couldn't read the flag"
 * can render an unavailable state instead of a confident "disabled".
 */
export function useFeatureFlag(name: string): { enabled: boolean; isLoading: boolean; error: boolean } {
  const { user } = useAuth();
  const { activeOrgId } = useOrg();

  const { data, isLoading } = useQuery({
    queryKey: ['feature-flag', name, activeOrgId],
    queryFn: async () => {
      const { data: flags, error } = await supabase.rpc('get_effective_feature_flags', {
        p_org_id: activeOrgId!,
      });
      // Keep failing closed (value:false) but remember WHETHER the RPC errored, so
      // callers can tell a real read failure from a legitimately-off flag. We don't
      // throw here on purpose — that would change retry/loading behaviour for every
      // existing consumer; the flag stays off on error as before.
      if (error) return { value: false, errored: true };
      if (!flags) return { value: false, errored: false };
      return { value: flags.find((f) => f.name === name)?.value === true, errored: false };
    },
    enabled: !!user && !!activeOrgId,
    staleTime: 5 * 60 * 1000,
  });

  return { enabled: data?.value ?? false, isLoading, error: data?.errored ?? false };
}
