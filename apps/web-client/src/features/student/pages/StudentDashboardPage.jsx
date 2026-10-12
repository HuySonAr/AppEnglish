import { BookOpen, ClipboardCheck, Timer, Trophy } from 'lucide-react';
import { FeatureCard } from '../../../components/shared/FeatureCard.jsx';
import { useAuth } from '../../auth/context/AuthContext.jsx';

export function StudentDashboardPage() {
  const { account } = useAuth();
  return (
    <section className="space-y-8">
      <div className="relative overflow-hidden rounded-2xl bg-primary p-6 text-primary-foreground shadow-lg sm:p-10">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <p className="relative text-sm font-medium text-primary-foreground/80">{account?.email}</p>
        <h1 className="relative mt-2 text-3xl font-bold sm:text-4xl">Welcome to AppEnglish</h1>
        <p className="relative mt-3 max-w-xl text-primary-foreground/85">
          Your Reading and Listening learning space is ready. Take the placement
          test, then work through the lessons one by one.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <FeatureCard
          icon={BookOpen}
          title="Lessons"
          description="Vocabulary, exercises and a test in every lesson"
          to="/student/lessons"
        />
        <FeatureCard
          icon={ClipboardCheck}
          title="Placement test"
          description="Find the unit you start at"
          to="/student/placement"
          tone="success"
        />
        <FeatureCard
          icon={Timer}
          title="Mock tests"
          description="Full tests against the clock, or one part at a time"
          to="/student/mock-tests"
          tone="info"
        />
        <FeatureCard icon={Trophy} title="Progress" description="Track your learning journey" tone="warning" />
      </div>
    </section>
  );
}
