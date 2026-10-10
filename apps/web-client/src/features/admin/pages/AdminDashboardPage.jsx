import { Activity, ClipboardCheck, Library, Users } from 'lucide-react';
import { FeatureCard } from '../../../components/shared/FeatureCard.jsx';
import { PageHeader } from '../../../components/shared/PageHeader.jsx';

export function AdminDashboardPage() {
  return (
    <section className="space-y-8">
      <PageHeader
        eyebrow="Admin"
        title="Dashboard"
        description="Manage who can use AppEnglish. More administrative tools will appear here as features are added."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <FeatureCard
          icon={Users}
          title="Account management"
          description="View accounts, change roles, lock and unlock access"
          to="/admin/accounts"
        />
        <FeatureCard
          icon={ClipboardCheck}
          title="Placement"
          description="Set the scores that decide a learner's starting unit"
          to="/admin/placement"
          tone="warning"
        />
        <FeatureCard
          icon={Library}
          title="Content management"
          description="Manage learning content"
          tone="info"
        />
        <FeatureCard
          icon={Activity}
          title="System health"
          description="Monitor service status"
          tone="success"
        />
      </div>
    </section>
  );
}
