import { Brain, Headphones } from 'lucide-react';
import { FeatureCard } from '../../../components/shared/FeatureCard.jsx';
import { PageHeader } from '../../../components/shared/PageHeader.jsx';

export function PracticePage() {
  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Practice"
        title="Practice"
        description="Practise as often as you like."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <FeatureCard
          icon={Brain}
          title="Word memory"
          description="Words from the lessons you completed"
          to="/student/practice/vocabulary"
        />
        <FeatureCard
          icon={Headphones}
          title="Listening"
          description="Listen and write down what you hear"
          to="/student/practice/listening"
          tone="info"
        />
      </div>
    </section>
  );
}
