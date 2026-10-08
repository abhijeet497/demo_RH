import { Info } from 'lucide-react';
import { useTrialStatus } from '@/hooks/use-trial-status';
import { useDeviceLimit } from '@/hooks/use-device-limit';

/** Shown on all authenticated pages when VITE_TRIAL_MODE=true */
export function TrialModeBanner() {
  if (import.meta.env.VITE_TRIAL_MODE !== 'true') {
    return null;
  }

  const { isTrial, daysRemaining, isLoading, isError } = useTrialStatus();
  const { deviceLimit, isLoading: isLimitLoading } = useDeviceLimit();

  return (
    <div
      role="status"
      className="flex shrink-0 items-start justify-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-950 dark:border-amber-800/80 dark:bg-amber-950/30 dark:text-amber-100"
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden />
      <span>
        {!isLoading && !isError && isTrial && daysRemaining !== null && (
          <>
            {' '}
            {daysRemaining === 1
              ? '1 day remaining.'
              : `${daysRemaining} days remaining in this trial.`}{' '}
            <a
              href="https://traceforce.ai/contact"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-medium"
            >
            </a>
          </>
        )}
        This environment supports up to{' '}
        <span className="font-medium">
          {isLimitLoading ? (
            <span
              className="inline-block h-4 w-6 animate-pulse rounded bg-amber-200/70 align-middle dark:bg-amber-800/60"
              aria-hidden
            />
          ) : (
            deviceLimit
          )}{' '}
          devices
        </span>{' '}
        only.
        <span className="block">
          Need help?{' '}
          <a
            href="https://calendly.com/d/cv2d-tcz-49c/30-minute-meeting-with-traceforce"
            target="_blank"
            rel="noopener noreferrer"
            className="underline font-medium"
          >
            Book a time
          </a>
          .
        </span>
      </span>
    </div>
  );
}
