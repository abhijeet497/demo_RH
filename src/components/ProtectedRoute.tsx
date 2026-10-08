import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTrialStatus } from '@/hooks/use-trial-status';
import { AlertTriangle, ShieldX } from 'lucide-react';
import IdleTimeoutGuard from '@/components/IdleTimeoutGuard';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading } = useAuth();
  const { isExpired, isLoading: trialLoading, isError } = useTrialStatus();

  if (loading || trialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (isError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="max-w-md text-center space-y-4">
          <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto" />
          <h1 className="text-2xl font-bold">Unable to Verify Account</h1>
          <p className="text-muted-foreground">
            We couldn't verify your account status. Please try again.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="inline-block rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }

  if (isExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="max-w-md text-center space-y-4">
          <ShieldX className="h-12 w-12 text-muted-foreground mx-auto" />
          <h1 className="text-2xl font-bold">Trial Expired</h1>
          <p className="text-muted-foreground">
            Your trial has ended.
          </p>
          <a
            href="https://traceforce.ai/contact"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Contact Us
          </a>
        </div>
      </div>
    );
  }

  return <IdleTimeoutGuard>{children}</IdleTimeoutGuard>;
};

export default ProtectedRoute;
