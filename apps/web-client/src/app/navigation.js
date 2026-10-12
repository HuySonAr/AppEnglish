import {
  BookOpen,
  Calculator,
  ClipboardCheck,
  FileText,
  Home,
  Layers,
  LayoutDashboard,
  Library,
  Timer,
  Users,
} from 'lucide-react';
import { Roles } from '../constants/auth.js';

// The menu of each role. To add a page: add its route in router.jsx and one
// entry here. `end` matches the path exactly; `match` lists other path
// prefixes that should also highlight the entry.
export const navigation = Object.freeze({
  [Roles.STUDENT]: {
    home: '/student',
    items: [
      { to: '/student', label: 'Home', icon: Home, end: true },
      { to: '/student/lessons', label: 'Lessons', icon: BookOpen },
      { to: '/student/mock-tests', label: 'Mock tests', icon: Timer },
      { to: '/student/placement', label: 'Placement', icon: ClipboardCheck },
    ],
  },
  [Roles.CONTENT_MANAGER]: {
    home: '/content-manager',
    items: [
      { to: '/content-manager', label: 'Dashboard', icon: LayoutDashboard, end: true },
      {
        to: '/content-manager/units',
        label: 'Units and lessons',
        icon: Library,
        match: ['/content-manager/lessons'],
      },
      { to: '/content-manager/placement', label: 'Placement test', icon: ClipboardCheck },
      { to: '/content-manager/mock-tests', label: 'Mock tests', icon: FileText },
    ],
  },
  [Roles.ADMIN]: {
    home: '/admin',
    items: [
      { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/admin/accounts', label: 'Accounts', icon: Users },
      { to: '/admin/placement', label: 'Placement', icon: ClipboardCheck },
      { to: '/admin/exam-types', label: 'Exam types', icon: Layers },
      { to: '/admin/score-conversion', label: 'Score table', icon: Calculator },
    ],
  },
});

export function isNavItemActive(item, pathname) {
  if (item.end) return pathname === item.to;
  return [item.to, ...(item.match || [])].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
