import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Link, useLocation } from 'react-router-dom';
import { Monitor } from 'lucide-react';
import { useOrg } from '@/contexts/OrgContext';

/** On /agents only: one line under trial banner when there are no registered devices. */
export function AgentsNoDevicesBanner() {
  const { pathname } = useLocation();
  const { activeOrgId } = useOrg();
  const [checked, setChecked] = useState(false);
  const [noDevices, setNoDevices] = useState(false);

  useEffect(() => {
    if (pathname !== '/agents') {
      setChecked(false);
      setNoDevices(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setChecked(false);
      const { count, error } = await supabase.from('devices_with_owners').select('id', { count: 'exact', head: true }).eq('org_id', activeOrgId!);

      if (cancelled) return;
      setNoDevices(!error && (count ?? 0) === 0);
      setChecked(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [pathname, activeOrgId]);

  if (pathname !== '/agents' || !checked || !noDevices) {
    return null;
  }

  return (
    <div
      role="status"
      className="flex shrink-0 items-center justify-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-950 dark:border-amber-800/80 dark:bg-amber-950/30 dark:text-amber-100"
    >
      <Monitor className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden />
      <span>
        No devices yet —{' '}
        <Link
          to="/getting-started"
          className="font-medium underline underline-offset-4 hover:opacity-90"
        >
          Getting started
        </Link>
      </span>
    </div>
  );
}
