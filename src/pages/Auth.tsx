import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isAuthApiError } from '@supabase/supabase-js';
import traceforceLogo from '/lovable-uploads/new-icon.png';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { validateOAuthWorkEmail } from '@/lib/auth-email';
import { IDLE_TIMEOUT_MINUTES, OAUTH_IN_NON_TRIAL_ENABLED } from '@/lib/featureFlags';
import { IDLE_SIGNOUT_AT_KEY, SESSION_EXPIRED_AT_KEY } from '@/lib/storageKeys';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Building2, Clock, Handshake, Loader2, Shield } from 'lucide-react';
import { DevLoginBypass } from '@/components/DevLoginBypass';

const trialMode = import.meta.env.VITE_TRIAL_MODE === 'true';
const MSP_ASSESSMENT_URL = 'https://port1.io/traceforce?utm_source=traceforce&utm_medium=referral&utm_campaign=trial-router';

const AUTH_BG_URL = '/auth-hero-bg.png';

function AuthPageBackdrop() {
  return (
    <>
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${AUTH_BG_URL})` }}
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-background/80 backdrop-blur-sm dark:bg-background/70"
      />
    </>
  );
}

function TraceforceLogoMark() {
  return (
    <a
      href="https://traceforce.ai"
      target="_blank"
      rel="noopener noreferrer"
      className="absolute left-4 top-4 z-10 flex h-8 items-center gap-2 rounded-md px-2 text-xs font-medium text-muted-foreground outline-none ring-offset-background transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring sm:left-6 sm:top-6"
    >
      <img src={traceforceLogo} alt="" className="h-5 w-5 shrink-0" aria-hidden />
      <span>Traceforce</span>
    </a>
  );
}

type SignInPath = 'chooser' | 'login';

const Auth = () => {
  const { user, signInWithGoogle, signInWithMicrosoft, signInWithSSO, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [signInPath, setSignInPath] = useState<SignInPath>('chooser');
  const [ssoDialogOpen, setSsoDialogOpen] = useState(false);
  const [workEmail, setWorkEmail] = useState('');
  const [googleSigningIn, setGoogleSigningIn] = useState(false);
  const [microsoftSigningIn, setMicrosoftSigningIn] = useState(false);
  const [ssoSigningIn, setSsoSigningIn] = useState(false);
  const oauthStartLockRef = useRef(false);
  // Read-and-clear the idle-signout marker once on mount: a static banner here
  // outlives the moment of logout, unlike a toast, so a user returning from
  // another tab minutes later still learns why they were signed out.
  // Same read-and-clear for the server-ended-session marker (AuthContext sets it on an unexplained SIGNED_OUT).
  const [idleSignedOut, setIdleSignedOut] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  useEffect(() => {
    try {
      // Ignore stale markers (>24h) left by e.g. a crashed tab long ago.
      const readFresh = (key: string) => {
        const at = Number(localStorage.getItem(key));
        localStorage.removeItem(key);
        return Number.isFinite(at) && at > 0 && Date.now() - at < 24 * 60 * 60 * 1000;
      };
      setIdleSignedOut(readFresh(IDLE_SIGNOUT_AT_KEY));
      setSessionExpired(readFresh(SESSION_EXPIRED_AT_KEY));
    } catch {
      /* private mode: no banner */
    }
  }, []);

  function isBenignOAuthStartFailure(err: unknown): boolean {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return true;
    }
    if (err instanceof Error && /abort/i.test(err.message)) {
      return true;
    }
    return false;
  }

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const oauthBusy = googleSigningIn || microsoftSigningIn;

  const handleGoogleSignIn = async () => {
    const validationError = validateOAuthWorkEmail(workEmail);
    if (validationError) {
      toast({
        title: 'Company email required',
        description: validationError,
        variant: 'destructive',
      });
      return;
    }
    if (oauthStartLockRef.current) {
      return;
    }
    oauthStartLockRef.current = true;
    setGoogleSigningIn(true);
    try {
      await signInWithGoogle(workEmail.trim());
    } catch (err) {
      console.error('Google sign-in start failed:', err);
      if (isBenignOAuthStartFailure(err)) {
        return;
      }
      toast({
        title: 'Authentication Error',
        description: 'Failed to start Google sign-in. Please try again.',
        variant: 'destructive',
      });
    } finally {
      oauthStartLockRef.current = false;
      setGoogleSigningIn(false);
    }
  };

  const handleMicrosoftSignIn = async () => {
    const validationError = validateOAuthWorkEmail(workEmail);
    if (validationError) {
      toast({
        title: 'Company email required',
        description: validationError,
        variant: 'destructive',
      });
      return;
    }
    if (oauthStartLockRef.current) {
      return;
    }
    oauthStartLockRef.current = true;
    setMicrosoftSigningIn(true);
    try {
      await signInWithMicrosoft(workEmail.trim());
    } catch (err) {
      console.error('Microsoft sign-in start failed:', err);
      if (isBenignOAuthStartFailure(err)) {
        return;
      }
      toast({
        title: 'Authentication Error',
        description: 'Failed to start Microsoft sign-in. Please try again.',
        variant: 'destructive',
      });
    } finally {
      oauthStartLockRef.current = false;
      setMicrosoftSigningIn(false);
    }
  };

  const handleSsoSignIn = () => {
    setSsoDialogOpen(true);
  };

  const handleSsoEmailSignIn = async () => {
    const validationError = validateOAuthWorkEmail(workEmail);
    if (validationError) {
      toast({
        title: 'Company email required',
        description: validationError,
        variant: 'destructive',
      });
      return;
    }
    setSsoSigningIn(true);
    try {
      await signInWithSSO(workEmail.trim());
    } catch (err) {
      console.error('SSO sign-in failed:', err);
      const noProvider = isAuthApiError(err) && err.code === 'sso_provider_not_found';
      toast({
        title: 'Authentication Error',
        description: noProvider
          ? `We couldn't find single sign-on for @${workEmail.trim().split('@')[1]}. Check your work email, or ask your admin if Traceforce SSO is set up.`
          : err instanceof Error ? err.message : 'Failed to start SSO sign-in. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSsoSigningIn(false);
    }
  };



  if (loading) {
    return (
      <div className="relative isolate min-h-screen flex items-center justify-center overflow-hidden p-4">
        <AuthPageBackdrop />
        <TraceforceLogoMark />
        <Loader2 className="relative h-8 w-8 animate-spin text-foreground" />
      </div>
    );
  }

  return (
    <div className="relative isolate min-h-screen flex flex-col items-center justify-center gap-6 overflow-hidden p-4">
      <AuthPageBackdrop />
      <TraceforceLogoMark />
      <DevLoginBypass />

      {idleSignedOut && (
        <Alert className="w-full max-w-md">
          <Clock className="h-4 w-4" />
          <AlertDescription>
            Signed out after {IDLE_TIMEOUT_MINUTES} minutes of inactivity.
          </AlertDescription>
        </Alert>
      )}

      {sessionExpired && !idleSignedOut && (
        <Alert className="w-full max-w-md">
          <Clock className="h-4 w-4" />
          <AlertDescription>Your session expired. Please sign in again.</AlertDescription>
        </Alert>
      )}

      {!trialMode ? (
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">Welcome to Traceforce</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="work-email">Work email</Label>
                <Input
                  id="work-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@yourcompany.com"
                  value={workEmail}
                  onChange={(e) => setWorkEmail(e.target.value)}
                  disabled={loading || ssoSigningIn || oauthBusy}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void handleSsoEmailSignIn();
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Enter your company email. You will be redirected to your organization's identity provider.
                </p>
              </div>
              <Button
                type="button"
                onClick={() => void handleSsoEmailSignIn()}
                className="w-full"
                disabled={loading || ssoSigningIn || oauthBusy}
              >
                {ssoSigningIn ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Shield className="h-4 w-4 mr-2" />
                )}
                Continue with SSO
              </Button>
              <div className="text-center">
                <button
                  type="button"
                  className="text-sm text-primary underline hover:no-underline"
                  onClick={handleSsoSignIn}
                >
                  SSO setup guide
                </button>
              </div>
              {OAUTH_IN_NON_TRIAL_ENABLED && (
                <>
                  <div className="flex items-center gap-3" aria-hidden>
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-xs uppercase text-muted-foreground">or</span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                  <div className="flex flex-col gap-2 rounded-lg border bg-card/50 p-4">
                    <Button
                      type="button"
                      onClick={() => void handleGoogleSignIn()}
                      variant="outline"
                      className="w-full"
                      disabled={loading || ssoSigningIn || oauthBusy}
                    >
                      {googleSigningIn ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <img
                          src="/lovable-uploads/icons8-google-logo-480.png"
                          alt=""
                          className="h-4 w-4 mr-2"
                        />
                      )}
                      Continue with Google
                    </Button>
                    <Button
                      type="button"
                      onClick={() => void handleMicrosoftSignIn()}
                      variant="outline"
                      className="w-full"
                      disabled={loading || ssoSigningIn || oauthBusy}
                    >
                      {microsoftSigningIn ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <svg
                          className="h-4 w-4 mr-2 shrink-0"
                          viewBox="0 0 23 23"
                          xmlns="http://www.w3.org/2000/svg"
                          aria-hidden
                        >
                          <path fill="#f25022" d="M0 0h11v11H0z" />
                          <path fill="#7fba00" d="M12 0h11v11H12z" />
                          <path fill="#00a4ef" d="M0 12h11v11H0z" />
                          <path fill="#ffb900" d="M12 12h11v11H12z" />
                        </svg>
                      )}
                      Continue with Microsoft
                    </Button>
                  </div>
                </>
              )}
            </div>
            <div className="text-center text-sm text-muted-foreground">
              By signing in, you agree to our{' '}
              <a
                href="https://traceforce.ai/legal"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:no-underline"
              >
                terms of service and privacy policy
              </a>
              .
            </div>
          </CardContent>
        </Card>
      ) : signInPath === 'chooser' ? (
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">Welcome to Traceforce</CardTitle>
            <CardDescription>Get a full AI risk assessment in minutes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <button
              type="button"
              onClick={() => setSignInPath('login')}
              className="flex w-full items-start gap-4 rounded-lg border bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Shield className="h-5 w-5" />
              </div>
              <div className="min-w-0 space-y-1">
                <p className="font-semibold text-foreground">Security Engineers</p>
                <p className="text-sm text-muted-foreground">
                  Sign up for free with your work email.
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setSignInPath('login')}
              className="flex w-full items-start gap-4 rounded-lg border bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Handshake className="h-5 w-5" />
              </div>
              <div className="min-w-0 space-y-1">
                <p className="font-semibold text-foreground">VARS & Consultants</p>
                <p className="text-sm text-muted-foreground">
                  Try out for free with your company email.
                </p>
              </div>
            </button>

            <a
              href={MSP_ASSESSMENT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-start gap-4 rounded-lg border bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Building2 className="h-5 w-5" />
              </div>
              <div className="min-w-0 space-y-1">
                <p className="font-semibold text-foreground">MSPs & MSSPs</p>
                <p className="text-sm text-muted-foreground">
                  Work with PORT1 to set up a free trial with service provider features.
                </p>
              </div>
            </a>
          </CardContent>
        </Card>
      ) : (
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <button
              type="button"
              onClick={() => setSignInPath('chooser')}
              className="mb-2 inline-flex items-center gap-1.5 self-start text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <CardTitle className="text-2xl font-bold">Welcome to Traceforce</CardTitle>
            <CardDescription>Sign in with your work email</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3 rounded-lg border bg-card/50 p-4">
              <div className="space-y-2">
                <Label htmlFor="work-email">Work email</Label>
                <Input
                  id="work-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@yourcompany.com"
                  value={workEmail}
                  onChange={(e) => setWorkEmail(e.target.value)}
                  disabled={loading || oauthBusy}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void handleGoogleSignIn();
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Please provide a company email address (Google Workspace or Microsoft 365).
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  onClick={() => void handleGoogleSignIn()}
                  variant="outline"
                  className="w-full"
                  disabled={loading || oauthBusy}
                >
                  {googleSigningIn ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <img
                      src="/lovable-uploads/icons8-google-logo-480.png"
                      alt=""
                      className="h-4 w-4 mr-2"
                    />
                  )}
                  Continue with Google
                </Button>
                <Button
                  type="button"
                  onClick={() => void handleMicrosoftSignIn()}
                  variant="outline"
                  className="w-full"
                  disabled={loading || oauthBusy}
                >
                  {microsoftSigningIn ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <svg
                      className="h-4 w-4 mr-2 shrink-0"
                      viewBox="0 0 23 23"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-hidden
                    >
                      <path fill="#f25022" d="M0 0h11v11H0z" />
                      <path fill="#7fba00" d="M12 0h11v11H12z" />
                      <path fill="#00a4ef" d="M0 12h11v11H0z" />
                      <path fill="#ffb900" d="M12 12h11v11H12z" />
                    </svg>
                  )}
                  Continue with Microsoft
                </Button>
              </div>
            </div>

            <div className="text-center text-sm text-muted-foreground">
              By signing in, you agree to our{' '}
              <a
                href="https://traceforce.ai/legal"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:no-underline"
              >
                terms of service and privacy policy
              </a>
              .
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={ssoDialogOpen} onOpenChange={setSsoDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Single Sign-On (SSO)</DialogTitle>
            <DialogDescription>
              Please sign in using your organization's SSO provider.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              If you haven't configured SSO yet, please follow the setup guide to configure
              Single Sign-On for your organization using SAML 2.0.
            </p>
            <p className="text-sm text-muted-foreground">
              Once SSO is configured by your administrator, you'll be able to sign in directly from your organization's SSO provider.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSsoDialogOpen(false)}
            >
              Close
            </Button>
            <Button
              onClick={() => {
                window.open('https://traceforce.readme.io/docs/getting-started', '_blank');
              }}
            >
              View Setup Guide
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Auth;