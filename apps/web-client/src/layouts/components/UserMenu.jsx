import { ChevronDown, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { RoleLabels } from '../../constants/auth.js';
import { useAuth } from '../../features/auth/context/AuthContext.jsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu.jsx';

// Account button in the top bar: who is signed in, and Log out.
export function UserMenu() {
  const { account, signOut } = useAuth();
  const navigate = useNavigate();
  const email = account?.email || '';
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-full border bg-card py-1 pl-1 pr-2 text-sm shadow-sm transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 font-semibold uppercase text-primary">
          {email.slice(0, 1) || '?'}
        </span>
        <span className="hidden max-w-[12rem] truncate sm:block">{email}</span>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="space-y-0.5">
          <p className="truncate text-sm font-medium">{email}</p>
          <p className="text-xs font-normal text-muted-foreground">{RoleLabels[account?.role]}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="gap-2"
          onSelect={async () => {
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
