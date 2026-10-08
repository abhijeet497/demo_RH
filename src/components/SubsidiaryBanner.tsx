import { Building2 } from 'lucide-react';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

// Shown when an admin is viewing a subsidiary (active org != home). Mirrors TrialModeBanner.
export function SubsidiaryBanner() {
  const { isRegularUser } = useAuth();
  const { isMultiOrg, activeOrgId, homeOrgId, accessibleOrgs, loading, orgRole, setActiveOrg } = useOrg();

  // Guard on homeOrgId too: if the accessible-orgs response had no is_home org but activeOrgId still
  // resolved from storage, the banner would render with a dead "Return to your org" button (its onClick
  // depends on homeOrgId). No home → nothing to return to → don't show the banner.
  // Regular-user mode (including VITE_REGULAR_USER_MODE preview) never shows org navigation.
  if (
    isRegularUser ||
    loading ||
    orgRole !== 'admin' ||
    !isMultiOrg ||
    !activeOrgId ||
    !homeOrgId ||
    activeOrgId === homeOrgId
  ) {
    return null;
  }

  const active = accessibleOrgs.find((o) => o.org_id === activeOrgId);

  return (
    <div
      className="flex shrink-0 items-center justify-center gap-2 border-b border-blue-200 bg-blue-50 px-4 py-2 text-center text-sm text-blue-950 dark:border-blue-800/80 dark:bg-blue-950/30 dark:text-blue-100"
    >
      <Building2 className="h-4 w-4 shrink-0 text-blue-700 dark:text-blue-300" aria-hidden />
      {/* aria-live on the message only — keeping the interactive button OUT of the live region so SR
          users don't get the button announced as a status message (role="status" wrapped both). */}
      <span aria-live="polite">
        Viewing as <span className="font-medium">{active?.email_domain ?? 'subsidiary org'}</span>.
      </span>
      <Button
        variant="link"
        size="sm"
        className="h-auto p-0 text-blue-900 underline dark:text-blue-200"
        onClick={() => homeOrgId && setActiveOrg(homeOrgId)}
      >
        Return to your org
      </Button>
    </div>
  );
}
