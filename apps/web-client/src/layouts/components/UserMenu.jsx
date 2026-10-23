import { LogOut, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { displayNameOf } from '@appenglish/auth-contracts';
import { RoleLabels } from '../../constants/auth.js';
import { useAuth } from '../../features/auth/context/AuthContext.jsx';
import { dashboardPathForRole } from '../../features/auth/flow/auth-flow.js';
import { canLeave } from '../../lib/leave-guard.js';
import { Avatar } from '../../components/shared/Avatar.jsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu.jsx';

export function UserMenu() {
  const { account, signOut } = useAuth();
  const navigate = useNavigate();
  const name = displayNameOf(account || {});
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Account menu for ${name}`}
        className="rounded-full ring-offset-background transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <Avatar account={account} size="md" className="border shadow-sm" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="space-y-0.5">
          <p className="truncate text-sm font-medium">{name}</p>
          <p className="truncate text-xs font-normal text-muted-foreground">{account?.email}</p>
          <p className="text-xs font-normal text-muted-foreground">{RoleLabels[account?.role]}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="gap-2"
          onSelect={() => {
            if (!canLeave()) return;
            navigate(`${dashboardPathForRole(account.role)}/profile`);
          }}
        >
          <UserRound className="h-4 w-4" />
          Your profile
        </DropdownMenuItem>
        <DropdownMenuItem
          className="gap-2"
          onSelect={async () => {
            if (!canLeave()) return;
            await signOut();
            navigate('/login', { replace: true });
          }}
        >
          <LogOut className="h-4 w-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
