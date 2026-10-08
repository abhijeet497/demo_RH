import React from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { LogOut, UserCog, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { mcpAccessEnabled, viewSwitcherEnabled } from '@/lib/featureFlags';

const trialMode = import.meta.env.VITE_TRIAL_MODE === 'true';

const UserMenu = () => {
  const { user, signOut, isRegularUser, setViewOverride } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Dev/preview only (production builds eliminate this branch): flip the
  // regular-user simulation at runtime to test both sides of the MCP-access
  // flow in one session. UI-only — API calls keep the real session.
  const handleViewSwitch = () => {
    setViewOverride(isRegularUser ? 'admin' : 'user');
    navigate(isRegularUser ? '/' : '/requests');
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast({
        title: 'Signed out',
        description: 'You have been successfully signed out.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to sign out. Please try again.',
        variant: 'destructive',
      });
    }
  };

  if (!user) return null;

  const userInitials = user.user_metadata?.full_name
    ? user.user_metadata.full_name
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
    : user.email?.substring(0, 2).toUpperCase() || 'U';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.user_metadata?.avatar_url} alt={user.user_metadata?.full_name || user.email} />
            <AvatarFallback>{userInitials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">
              {user.user_metadata?.full_name || 'User'}
            </p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        {trialMode ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/users')}>
              <Users className="mr-2 h-4 w-4" />
              <span>Manage users</span>
            </DropdownMenuItem>
          </>
        ) : null}
        {/* The user view IS the mcp-access feature — without the flag there's
            nothing to preview, so the switcher requires both. */}
        {viewSwitcherEnabled && mcpAccessEnabled && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleViewSwitch}>
              <UserCog className="mr-2 h-4 w-4" />
              <span>{isRegularUser ? 'View as admin' : 'View as user'}</span>
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default UserMenu;