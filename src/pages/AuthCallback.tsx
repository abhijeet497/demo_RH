import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';
import {
  isBlockedFromTrial,
  isPersonalGmailDomain,
  isPersonalMicrosoftConsumerDomain,
  OAUTH_LOGIN_HINT_KEY,
  OAUTH_PROVIDER_EXPECTED_KEY,
  TRIAL_BLOCKED_MESSAGE,
} from '@/lib/auth-email';

// Supabase Auth error codes where retrying is the whole fix (sign-in took too long, back button, reused link).
const RETRYABLE_AUTH_ERROR_CODES = new Set([
  'saml_relay_state_expired',
  'saml_relay_state_not_found',
  'bad_oauth_state',
]);

// Raw Supabase Auth descriptions aren't written for end users; map the actionable cases, generic otherwise.
function authErrorMessage(error: string, code: string | null): string {
  // A bare access_denied is the user cancelling at the provider; Supabase also uses access_denied (with a
  // code) for banned users / disabled signups, which fall through to the generic message.
  if (error === 'access_denied' && !code) return 'Sign-in was cancelled. Please try again.';
  if (code === 'saml_assertion_no_email') {
    return "Your identity provider didn't send your email address. Ask your IT admin to map your email to an attribute named \"email\" in the Traceforce SAML app.";
  }
  if (code && RETRYABLE_AUTH_ERROR_CODES.has(code)) return 'Your sign-in session expired. Please sign in again.';
  return 'Sign-in failed. Please try again, or contact support if this keeps happening.';
}

function clearOauthPreflightKeys() {
  sessionStorage.removeItem(OAUTH_LOGIN_HINT_KEY);
  sessionStorage.removeItem(OAUTH_PROVIDER_EXPECTED_KEY);
}


const ensureOrgAndProfile = async (user: User, isOAuth: boolean = false) => {
  const email = user.email;
  const userId = user.id;
  try {
    console.log('Ensuring org and profile for:', email, userId, 'OAuth:', isOAuth);
    
    // 1. Check if user profile already exists
    const { data: existingProfile, error: profileCheckError } = await (supabase as any)
      .from('user_profiles')
      .select(`
        *,
        orgs:org_id (*)
      `)
      .eq('id', userId)
      .maybeSingle();
    
    if (profileCheckError) {
      console.error('Error checking existing profile:', profileCheckError);
      throw new Error(`Failed to check existing profile: ${profileCheckError.message}`);
    }
    
    // If user profile exists, return existing data
    if (existingProfile) {
      console.log('User profile already exists, returning existing data');
      return { 
        success: true, 
        org: existingProfile.orgs, 
        profile: existingProfile,
        isExisting: true 
      };
    }
    
    console.log('User profile does not exist, creating new org and profile');
    
    // Check for forced_org environment variable. If set, use it as the org name.
    // In regular operation, for OAuth, use email as org name (globally unique)
    // For SSO, use auth.sso_provider ID as org name
    const forcedOrg = import.meta.env.VITE_FORCED_ORG;
    const orgName = forcedOrg && forcedOrg.trim() !== '' 
      ? forcedOrg 
      : (isOAuth ? email.toLowerCase() : user.app_metadata.provider);
    
    console.log('Using org name:', orgName);

    // 2. Check if organization already exists by name
    const { data: existingOrg, error: orgCheckError } = await (supabase as any)
      .from('orgs')
      .select('*')
      .eq('name', orgName)
      .maybeSingle();
    
    if (orgCheckError) {
      console.error('Error checking existing org:', orgCheckError);
      throw new Error(`Failed to check existing organization: ${orgCheckError.message}`);
    }
    
    let orgData = existingOrg;
    
    // 3. Create organization if it doesn't exist
    if (!existingOrg) {
      const emailDomain = email.split('@')[1];
      const orgDescription = isOAuth 
        ? `Personal organization for ${email}`
        : `Organization for ${emailDomain}`;
        
      const { data: newOrgData, error: orgError } = await (supabase as any)
        .rpc('create_org_with_conflict_handling', {
          org_name: orgName,
          org_description: orgDescription,
          org_email_domain: emailDomain,
          org_is_trial: import.meta.env.VITE_TRIAL_MODE === 'true'
        });
      
      if (orgError) {
        console.error('Error creating organization:', orgError);
        throw new Error(`Failed to create organization: ${orgError.message}`);
      }
      
      console.log('Organization created:', newOrgData);
      orgData = newOrgData;
    } else {
      console.log('Using existing organization:', existingOrg);
    }
    
    // 4. Create user profile record
    console.log("orgData", orgData);
    const orgId = Array.isArray(orgData) ? orgData[0]?.id : orgData?.id;
    const { data: profileData, error: profileError } = await (supabase as any)
      .rpc('create_user_profile_with_conflict_handling', {
        user_id: userId,
        user_org_id: orgId,
        user_role: 'standard_user'
      });
    
    if (profileError) {
      console.error('Error creating user profile:', profileError);
      throw new Error(`Failed to create user profile: ${profileError.message}`);
    }
    
    console.log('User profile created:', profileData);
    
    return { success: true, org: orgData, profile: profileData, isExisting: false };
  } catch (error) {
    console.error('Error ensuring org and profile:', error);
    return { success: false, error: error };
  }
};



const AuthCallback: React.FC = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [processingComplete, setProcessingComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExchangingSession, setIsExchangingSession] = useState(true);

  useEffect(() => {
    handleAuthCallback();
  }, []);

  useEffect(() => {
    // If user is authenticated (from either SSO or OAuth), run setup logic
    if (user && !loading && !isExchangingSession) {
      executePostAuthLogic();
    }
  }, [user, loading, isExchangingSession]);

  const handleAuthCallback = async () => {
    try {
      console.log('Handling auth callback...');
      
      // Check URL for OAuth error parameters first
      const urlParams = new URLSearchParams(window.location.search);
      const oauthError = urlParams.get('error');
      const oauthErrorDescription = urlParams.get('error_description');
      const oauthErrorCode = urlParams.get('error_code');

      if (oauthError) {
        console.error('OAuth error:', oauthError, oauthErrorCode, oauthErrorDescription);
        clearOauthPreflightKeys();

        // Clear any existing session on OAuth failure (only if session exists)
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await signOut();
        }
        
        setError(authErrorMessage(oauthError, oauthErrorCode));
        setIsExchangingSession(false);
        return;
      }
      
      // Check if we already have a session (OAuth flows handle this automatically)
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionData?.session) {
        console.log('Session already exists (OAuth flow)');
        setIsExchangingSession(false);
        return;
      }
      
      // If no session exists, check URL for auth parameters that need to be exchanged
      const hasAuthCode = urlParams.has('code') || urlParams.has('access_token') || urlParams.has('refresh_token');
      
      if (hasAuthCode) {
        console.log('Found auth parameters in URL, exchanging for session...');
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(window.location.href);
        
        if (exchangeError) {
          console.error('Error exchanging code for session:', exchangeError);
          clearOauthPreflightKeys();

          // Clear any stale session on exchange failure (only if session exists)
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            await signOut();
          }
          
          setError('Authentication failed. Please try signing in again.');
          setIsExchangingSession(false);
          return;
        }
        console.log('Successfully exchanged auth code for session');
      }
      
      setIsExchangingSession(false);
      
    } catch (err) {
      console.error('Unexpected error in auth callback:', err);
      clearOauthPreflightKeys();

      // Clear any existing session on unexpected error (only if session exists)
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await signOut();
      }
      
      setError('An unexpected error occurred during authentication.');
      setIsExchangingSession(false);
    }
  };

  const executePostAuthLogic = async () => {
    try {
      console.log('Executing post-auth logic for user:', user?.id);

      // Validate user has email
      if (!user?.email) {
        console.error('User authenticated but no email provided');
        setError('Authentication failed: No email provided. Please contact support.');
        // Sign out the user on error
        await signOut();
        return; // Early return on error
      }

      // Determine if this is OAuth or SSO based on app_metadata
      console.log('User app metadata:', user.app_metadata);
      const isOAuth =
        user.app_metadata?.provider &&
        ['google', 'github', 'azure'].includes(user.app_metadata.provider);
      console.log('User authenticated via:', isOAuth ? 'OAuth' : 'SSO', 'user ID:', user.id);

      const loginHint = sessionStorage.getItem(OAUTH_LOGIN_HINT_KEY);
      const expectedIdp = sessionStorage.getItem(OAUTH_PROVIDER_EXPECTED_KEY);
      clearOauthPreflightKeys();

      const provider = user.app_metadata?.provider;
      const identityProviders = new Set(
        (user.identities ?? []).map((i) => i.provider)
      );

      // app_metadata.provider is the "primary" provider and may not match the IdP used for this
      // sign-in when the user has linked identities (e.g. Google sign-in but provider still "github").
      if (expectedIdp) {
        const matchedThisSignIn =
          identityProviders.has(expectedIdp) || provider === expectedIdp;
        if (!matchedThisSignIn) {
          setError(
            'The sign-in provider does not match the option you chose. Please go back and use the same Microsoft or Google button again.'
          );
          await signOut();
          return;
        }
      }

      const enforceGoogleEmailRules =
        expectedIdp === 'google' ||
        (expectedIdp == null && provider === 'google');
      const enforceAzureEmailRules =
        expectedIdp === 'azure' ||
        (expectedIdp == null && provider === 'azure');

      if (enforceGoogleEmailRules) {
        if (isPersonalGmailDomain(user.email)) {
          setError(
            'That Google account uses a personal @gmail.com address. Go back and sign in with your company Google Workspace account.'
          );
          await signOut();
          return;
        }
        if (loginHint && user.email.toLowerCase() !== loginHint) {
          setError(
            'The Google account you signed in with does not match the work email you entered. Please try again and choose the correct account.'
          );
          await signOut();
          return;
        }
      }

      if (enforceAzureEmailRules) {
        if (isPersonalMicrosoftConsumerDomain(user.email)) {
          setError(
            'That Microsoft account uses a personal Outlook, Hotmail, or Live address. Go back and enter your work Microsoft 365 email, then sign in with the matching account.'
          );
          await signOut();
          return;
        }
        if (loginHint && user.email.toLowerCase() !== loginHint) {
          setError(
            'The Microsoft account you signed in with does not match the work email you entered. Please try again and choose the correct account.'
          );
          await signOut();
          return;
        }
      }

      // Covers every provider (incl. SSO), and runs before the org/profile is created.
      if (isBlockedFromTrial(user.email)) {
        setError(TRIAL_BLOCKED_MESSAGE);
        await signOut();
        return;
      }

      // Create organization and user profile
      const orgResult = await ensureOrgAndProfile(user, isOAuth);
      
      if (!orgResult.success) {
        console.error('Failed to create org/profile for user:', orgResult.error);
        const errorMessage = typeof orgResult.error === 'string' 
          ? orgResult.error 
          : 'Failed to set up your account. Please try again.';
        setError(errorMessage);
        // Sign out the user on error
        await signOut();
        return; // Early return on error
      }
      
      console.log('Org setup complete for user');
      
      // Simulate custom logic processing
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Mark processing as complete
      setProcessingComplete(true);
      
      // Redirect to main app after a brief delay
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 1000);
      
    } catch (err) {
      console.error('Error in post-auth logic:', err);
      const errorMessage = err instanceof Error 
        ? `Setup failed: ${err.message}` 
        : 'Failed to complete authentication setup. Please try again.';
      setError(errorMessage);
      // Sign out the user on error
      await signOut();
    }
  };

  // Show loading while authentication is being processed OR session is being exchanged
  if ((loading && !user) || isExchangingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>
              {isExchangingSession ? 'Processing Authentication...' : 'Authenticating...'}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">
              {isExchangingSession ? 'Exchanging authentication credentials' : 'Processing your authentication'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show error state BEFORE the no-user redirect: every error path signs out (or never had a session),
  // so checking !user first would bounce to /auth and silently drop the message.
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-destructive">Authentication Error</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <XCircle className="h-8 w-8 text-destructive mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">{error}</p>
            <button
              onClick={() => navigate('/auth', { replace: true })}
              className="text-primary hover:underline"
            >
              Return to Login
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If no user after loading is complete, redirect to auth page
  if (!loading && !user) {
    return <Navigate to="/auth" replace />;
  }

  // Show processing complete state
  if (processingComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Welcome!</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-4" />
            <p className="text-muted-foreground">
              Authentication complete. Redirecting to your dashboard...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show processing state
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Fetching your account...</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">
            Finalizing your account verification
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthCallback;