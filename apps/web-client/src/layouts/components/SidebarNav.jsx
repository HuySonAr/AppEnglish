import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { isNavItemActive } from '../../app/navigation.js';
import { cn } from '../../lib/utils.js';

const rowClass = (active, open) =>
  cn(
    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    active ? 'bg-primary/10 text-primary' : open ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
  );

const isOn = (pathname, to) => pathname === to || pathname.startsWith(`${to}/`);

function NavGroup({ item, pathname, onNavigate }) {
  const inside = isNavItemActive(item, pathname);
  const [open, setOpen] = useState(inside);
  const listId = `nav-group-${item.to.replace(/\W+/g, '-')}`;

  useEffect(() => {
    if (inside) setOpen(true);
  }, [inside, pathname]);

  return (
    <div>
      <button type="button" aria-expanded={open} aria-controls={listId} onClick={() => setOpen((value) => !value)} className={cn(rowClass(false, open), 'w-full text-left')}>
        <item.icon className="h-4 w-4 shrink-0" />
        <span className="flex-1 truncate">{item.label}</span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200', open && 'rotate-180')} />
      </button>

      <div id={listId} className={cn('grid transition-[grid-template-rows] duration-200 ease-out', open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
        <ul className="overflow-hidden">
          <li aria-hidden="true" className="h-1" />
          {item.children.map((child) => {
            const current = isOn(pathname, child.to);
            return (
              <li key={child.to} className="ml-5 border-l pl-3">
                <Link
                  to={child.to}
                  tabIndex={open ? undefined : -1}
                  onClick={onNavigate}
                  aria-current={current ? 'page' : undefined}
                  className={cn(
                    'my-0.5 flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    current ? 'bg-accent font-medium text-foreground' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                  )}
                >
                  <span className="flex-1 truncate">{child.label}</span>
                  {current ? <ChevronRight className="h-4 w-4 shrink-0" /> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function NavItem({ item, pathname, onNavigate }) {
  if (item.children?.length) return <NavGroup item={item} pathname={pathname} onNavigate={onNavigate} />;
  const active = isNavItemActive(item, pathname);
  return (
    <Link to={item.to} onClick={onNavigate} aria-current={active ? 'page' : undefined} className={rowClass(active, false)}>
      <item.icon className="h-4 w-4 shrink-0" />
      {item.label}
    </Link>
  );
}

export function SidebarNav({ sections, label, onNavigate }) {
  const { pathname } = useLocation();
  return (
    <nav aria-label={label} className="space-y-5">
      {sections.map((section) => {
        const id = `nav-section-${section.label.replace(/\W+/g, '-').toLowerCase()}`;
        return (
          <div key={section.label} role="group" aria-labelledby={id} className="space-y-1">
            <p id={id} className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
              {section.label}
            </p>
            {section.items.map((item) => (
              <NavItem key={item.to} item={item} pathname={pathname} onNavigate={onNavigate} />
            ))}
          </div>
        );
      })}
    </nav>
  );
}
