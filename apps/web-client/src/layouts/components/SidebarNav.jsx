import { Link, useLocation } from 'react-router-dom';
import { isNavItemActive } from '../../app/navigation.js';
import { cn } from '../../lib/utils.js';

// Vertical menu used by the desktop sidebar and the phone drawer.
export function SidebarNav({ items, label, onNavigate }) {
  const { pathname } = useLocation();
  return (
    <nav aria-label={label} className="space-y-1">
      {items.map((item) => {
        const active = isNavItemActive(item, pathname);
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
