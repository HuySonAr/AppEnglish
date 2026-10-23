import { Activity, AudioLines, BookOpen, Calculator, ClipboardCheck, Dumbbell, FileText, GraduationCap, Headphones, Home, Layers, LayoutDashboard, Library, MessageSquareText, Mic, PenLine, Tags, Timer, TrendingUp, Trophy, Users } from 'lucide-react';
import { Roles } from '../constants/auth.js';

export const navigation = Object.freeze({
  [Roles.STUDENT]: {
    home: '/student',
    items: [
      { to: '/student', label: 'Home', icon: Home, end: true },
      { to: '/student/lessons', label: 'Lessons', icon: BookOpen },
      { to: '/student/listening-course', label: 'Listening course', icon: GraduationCap },
      { to: '/student/mock-tests', label: 'Mock tests', icon: Timer },
      { to: '/student/practice', label: 'Practice', icon: Dumbbell },
      { to: '/student/placement', label: 'Placement', icon: ClipboardCheck },
      { to: '/student/progress', label: 'Progress', icon: TrendingUp },
      { to: '/student/leaderboard', label: 'Leaderboard', icon: Trophy },
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
      { to: '/content-manager/listening-course', label: 'Listening course', icon: GraduationCap },
      { to: '/content-manager/listening', label: 'Listening library', icon: Headphones },
      { to: '/content-manager/listening-topics', label: 'Listening topics', icon: Tags },
      { to: '/content-manager/practice-prompts', label: 'Speaking and writing', icon: MessageSquareText },
    ],
  },
  [Roles.TEACHER]: {
    home: '/teacher',
    items: [
      { to: '/teacher', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/teacher/read-aloud', label: 'Read aloud', icon: AudioLines },
      { to: '/teacher/open-speaking', label: 'Open speaking', icon: Mic },
      { to: '/teacher/writing', label: 'Writing', icon: PenLine },
      { to: '/teacher/reviews', label: 'Grading', icon: ClipboardCheck },
    ],
  },
  [Roles.ADMIN]: {
    home: '/admin',
    items: [
      { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/admin/accounts', label: 'Accounts', icon: Users },
      { to: '/admin/placement', label: 'Placement', icon: ClipboardCheck },
      { to: '/admin/exam-types', label: 'Exam types', icon: Layers },
      { to: '/admin/listening-topics', label: 'Listening topics', icon: Tags },
      { to: '/admin/score-conversion', label: 'Score table', icon: Calculator },
      { to: '/admin/system', label: 'System', icon: Activity },
    ],
  },
});

export function isNavItemActive(item, pathname) {
  if (item.end) return pathname === item.to;
  return [item.to, ...(item.match || [])].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
