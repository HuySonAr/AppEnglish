import { Activity, AudioLines, BookOpen, Brain, Calculator, ClipboardCheck, ClipboardList, Dumbbell, FileText, Headphones, Home, Inbox, Layers, LayoutDashboard, Library, Mic, MicVocal, PenLine, Tags, Timer, TrendingUp, Trophy, Users } from 'lucide-react';
import { Roles } from '../constants/auth.js';

const withItems = (config) => Object.freeze({ ...config, items: config.sections.flatMap((section) => section.items) });

export const navigation = Object.freeze({
  [Roles.STUDENT]: withItems({
    home: '/student',
    sections: [
      {
        label: 'Overview',
        items: [
          { to: '/student', label: 'Home', icon: Home, end: true },
          { to: '/student/progress', label: 'Progress', icon: TrendingUp },
          { to: '/student/leaderboard', label: 'Leaderboard', icon: Trophy },
        ],
      },
      {
        label: 'Learn',
        items: [
          { to: '/student/lessons', label: 'Lessons', icon: BookOpen },
        ],
      },
      {
        label: 'Practice',
        items: [
          {
            to: '/student/practice',
            label: 'Practice',
            icon: Dumbbell,
            children: [
              { to: '/student/practice/vocabulary', label: 'Word memory', icon: Brain },
              { to: '/student/practice/listening', label: 'Listening', icon: Headphones },
              { to: '/student/practice/speaking', label: 'Speaking', icon: Mic },
              { to: '/student/practice/writing', label: 'Writing', icon: PenLine },
            ],
          },
        ],
      },
      {
        label: 'Tests',
        items: [
          { to: '/student/mock-tests', label: 'Mock tests', icon: Timer },
          { to: '/student/sw-tests', label: 'S&W tests', icon: MicVocal },
          { to: '/student/placement', label: 'Placement test', icon: ClipboardCheck },
        ],
      },
    ],
  }),
  [Roles.CONTENT_MANAGER]: withItems({
    home: '/content-manager',
    sections: [
      { label: 'Overview', items: [{ to: '/content-manager', label: 'Dashboard', icon: LayoutDashboard, end: true }] },
      { label: 'Review', items: [{ to: '/content-manager/reviews', label: 'Review queue', icon: Inbox }] },
      {
        label: 'Lessons and tests',
        items: [
          { to: '/content-manager/units', label: 'Units and lessons', icon: Library, match: ['/content-manager/lessons'] },
          { to: '/content-manager/placement', label: 'Placement test', icon: ClipboardCheck },
          { to: '/content-manager/mock-tests', label: 'Mock tests', icon: FileText },
          { to: '/content-manager/sw-tests', label: 'S&W tests', icon: MicVocal },
        ],
      },
      {
        label: 'Listening',
        items: [
          { to: '/content-manager/listening', label: 'Listening library', icon: Headphones },
          { to: '/content-manager/listening-topics', label: 'Listening topics', icon: Tags },
        ],
      },
      {
        label: 'Teacher prompts',
        items: [
          { to: '/content-manager/speaking-prompts', label: 'Speaking prompts', icon: Mic },
          { to: '/content-manager/writing-prompts', label: 'Writing prompts', icon: PenLine },
        ],
      },
    ],
  }),
  [Roles.TEACHER]: withItems({
    home: '/teacher',
    sections: [
      { label: 'Overview', items: [{ to: '/teacher', label: 'Dashboard', icon: LayoutDashboard, end: true }] },
      {
        label: 'Content',
        items: [
          { to: '/teacher/units', label: 'Units and lessons', icon: Library, match: ['/teacher/lessons'] },
          { to: '/teacher/placement', label: 'Placement test', icon: ClipboardList },
          { to: '/teacher/mock-tests', label: 'Mock tests', icon: FileText },
          { to: '/teacher/sw-tests', label: 'S&W tests', icon: MicVocal },
          { to: '/teacher/listening', label: 'Listening library', icon: Headphones },
        ],
      },
      {
        label: 'Prompts',
        items: [
          { to: '/teacher/read-aloud', label: 'Read aloud', icon: AudioLines },
          { to: '/teacher/open-speaking', label: 'Open speaking', icon: Mic },
          { to: '/teacher/writing', label: 'Writing', icon: PenLine },
        ],
      },
      { label: 'Learners', items: [{ to: '/teacher/reviews', label: 'Grading', icon: ClipboardCheck }] },
    ],
  }),
  [Roles.ADMIN]: withItems({
    home: '/admin',
    sections: [
      {
        label: 'Overview',
        items: [
          { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
          { to: '/admin/system', label: 'System', icon: Activity },
        ],
      },
      { label: 'People', items: [{ to: '/admin/accounts', label: 'Accounts', icon: Users }] },
      {
        label: 'Settings',
        items: [
          { to: '/admin/placement', label: 'Placement', icon: ClipboardCheck },
          { to: '/admin/exam-types', label: 'Exam types', icon: Layers },
          { to: '/admin/listening-topics', label: 'Listening topics', icon: Tags },
          { to: '/admin/score-conversion', label: 'Score table', icon: Calculator },
        ],
      },
    ],
  }),
});

export function isNavItemActive(item, pathname) {
  if (item.end) return pathname === item.to;
  return [item.to, ...(item.match || [])].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
