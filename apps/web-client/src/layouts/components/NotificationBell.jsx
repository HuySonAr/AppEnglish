import { useEffect, useState } from 'react';
import { Bell, BellOff, CheckCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/context/AuthContext.jsx';
import { listNotifications, markNotificationsRead } from '../../lib/api/notifications-api.js';
import { canLeave } from '../../lib/leave-guard.js';
import { describeNotification, mergeNotifications, notificationSources, timeAgo } from '../../lib/notifications.js';
import { cn } from '../../lib/utils.js';
import { Button } from '../../components/ui/button.jsx';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../../components/ui/dropdown-menu.jsx';

const POLL_MS = 60000;
const toneDot = { success: 'bg-success', warning: 'bg-warning', destructive: 'bg-destructive', info: 'bg-info' };

export function NotificationBell() {
  const { account } = useAuth();
  const sources = notificationSources(account?.role);
  const sourceKey = sources.join(',');
  const navigate = useNavigate();
  const [data, setData] = useState({ notifications: [], unread: 0 });
  const [state, setState] = useState('loading');

  async function refresh() {
    try {
      const results = await Promise.all(sources.map(async (source) => ({ source, data: (await listNotifications(source)).data })));
      setData(mergeNotifications(results));
      setState('ready');
    } catch {
      setState((current) => (current === 'ready' ? 'ready' : 'error'));
    }
  }

  useEffect(() => {
    if (!sources.length) return undefined;
    refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [sourceKey, account?.id]);

  if (!sources.length) return null;

  async function markRead(items) {
    const ids = items ? items.map((item) => item.id) : null;
    setData((current) => ({
      notifications: current.notifications.map((item) => (!ids || ids.includes(item.id) ? { ...item, read: true } : item)),
      unread: ids ? Math.max(0, current.unread - current.notifications.filter((item) => ids.includes(item.id) && !item.read).length) : 0,
    }));
    try {
      const touched = items ? [...new Set(items.map((item) => item.source))] : sources;
      await Promise.all(touched.map((source) => markNotificationsRead(source, items ? items.filter((item) => item.source === source).map((item) => item.id) : null)));
    } catch {
      refresh();
    }
  }

  const now = new Date();
  return (
    <DropdownMenu onOpenChange={(open) => open && refresh()}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={data.unread ? `Notifications, ${data.unread} unread` : 'Notifications'}>
          <Bell className="h-5 w-5" />
          {data.unread ? (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-white tabular-nums">
              {data.unread > 9 ? '9+' : data.unread}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[22rem] max-w-[calc(100vw-2rem)] p-0">
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
          <p className="text-sm font-semibold">Notifications</p>
          <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" disabled={!data.unread} onClick={() => markRead(null)}>
            <CheckCheck className="h-3.5 w-3.5" />
            Mark all as read
          </Button>
        </div>
        {state === 'error' ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">Could not load the notifications.</p>
        ) : data.notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-sm text-muted-foreground">
            <BellOff className="h-5 w-5" />
            {state === 'loading' ? 'Loading…' : 'Nothing new.'}
          </div>
        ) : (
          <div className="max-h-[26rem] overflow-y-auto py-1">
            {data.notifications.map((item) => {
              const view = describeNotification(item);
              return (
                <DropdownMenuItem
                  key={`${item.source}-${item.id}`}
                  className={cn('mx-1 items-start gap-3 rounded-md px-2.5 py-2.5', !item.read && 'bg-primary/5')}
                  onSelect={() => {
                    if (!item.read) markRead([item]);
                    if (view.to && canLeave()) navigate(view.to);
                  }}
                >
                  <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', item.read ? 'bg-muted' : toneDot[view.tone])} aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className={cn('block text-sm', item.read ? 'text-muted-foreground' : 'font-medium')}>{view.title}</span>
                    {view.detail ? <span className="block truncate text-xs text-muted-foreground">{view.detail}</span> : null}
                    <span className="block text-[11px] text-muted-foreground">{timeAgo(item.createdAt, now)}</span>
                  </span>
                </DropdownMenuItem>
              );
            })}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
