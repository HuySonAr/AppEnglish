import { Library } from 'lucide-react';
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
      </div>
    </section>
  );
}
