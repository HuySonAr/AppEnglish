import { ClipboardCheck, Compass, FileText, GraduationCap, Headphones, Library } from 'lucide-react';
import { FeatureCard } from '../../../components/shared/FeatureCard.jsx';
import { PageHeader } from '../../../components/shared/PageHeader.jsx';

export function ContentManagerDashboardPage() {
  return (
    <section className="space-y-8">
      <PageHeader
        eyebrow="Content Manager"
        title="Dashboard"
        description="Create units and lessons, write their vocabulary, fill-in exercises and lesson tests, then publish them for learners."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <FeatureCard
          icon={Library}
          title="Units and lessons"
          description="Create, order, edit and publish content"
          to="/content-manager/units"
        />
        <FeatureCard
          icon={ClipboardCheck}
          title="Placement test"
          description="Write and publish the test new learners take"
          to="/content-manager/placement"
          tone="success"
        />
        <FeatureCard
          icon={FileText}
          title="Mock tests"
          description="Write and publish full TOEIC-style tests"
          to="/content-manager/mock-tests"
          tone="info"
        />
        <FeatureCard
          icon={GraduationCap}
          title="Listening course"
          description="Units, lessons and level tests from A1 to C1"
          to="/content-manager/listening-course"
          tone="success"
        />
        <FeatureCard
          icon={Compass}
          title="Listening placement"
          description="The test that finds the level a learner starts the course at"
          to="/content-manager/listening-placement"
          tone="primary"
        />
        <FeatureCard
          icon={Headphones}
          title="Listening exercises"
          description="Write dictation exercises for the listening practice"
          to="/content-manager/listening"
          tone="warning"
        />
      </div>
    </section>
  );
}
