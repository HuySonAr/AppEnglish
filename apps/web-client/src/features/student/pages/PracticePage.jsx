import { Brain, Headphones } from 'lucide-react';
import { FeatureCard } from '../../../components/shared/FeatureCard.jsx';
import { PageHeader } from '../../../components/shared/PageHeader.jsx';

// The kinds of practice (F05B). Practice earns no XP and does not count for
// progress; it can be repeated as often as the learner likes.
export function PracticePage() {
  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Practice"
        title="Practice"
        description="Practise as often as you like. Practice does not count for your progress or XP."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <FeatureCard
          icon={Brain}
          title="Word memory"
          description="20 random words from the lessons you completed, asked word → meaning and meaning → word"
          to="/student/practice/vocabulary"
        />
        <FeatureCard
          icon={Headphones}
          title="Listening"
          description="Listen and write down what you hear, by topic and level"
          to="/student/practice/listening"
          tone="info"
        />
      </div>
    </section>
  );
}
