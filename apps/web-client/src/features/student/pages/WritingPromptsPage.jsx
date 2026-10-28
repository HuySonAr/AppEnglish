import { History, KeyRound, LayoutList, PenLine, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { listWritingPrompts } from '../api/writing-api.js';
import { PracticePromptList } from '../components/PracticePromptList.jsx';
import { PracticeBanner } from '../../../components/shared/PracticeBanner.jsx';
import writingArt from '../../../svg/Writing Education.svg';

function KeyNotice({ hasKey }) {
  if (hasKey) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-muted/40 p-4 text-sm">
      <KeyRound className="h-4 w-4 text-primary" />
      <span className="min-w-0 flex-1">Add your Gemini key to get a score.</span>
      <Link to="/student/gemini-key" className="font-medium text-primary underline-offset-4 hover:underline">
        Add key
      </Link>
    </div>
  );
}

export function WritingPromptsPage() {
  return (
    <PracticePromptList
      title="Writing"
      description="Write a short text and get feedback."
      icon={PenLine}
      kindLabel="Writing"
      basePath="/student/practice/writing"
      load={listWritingPrompts}
      maxScore={5}
      notice={(data) => <KeyNotice hasKey={data.hasKey} />}
      banner={
        <PracticeBanner
          eyebrow="Practice"
          eyebrowIcon={PenLine}
          title="TOEIC"
          accent="Writing"
          description="Write a short text and get feedback."
          image={writingArt}
          features={[
            { icon: LayoutList, title: 'Real tasks', note: 'Like the real test', tone: 'destructive' },
            { icon: Sparkles, title: 'AI feedback', note: 'Score and tips' },
            { icon: History, title: 'Your history', note: 'Review every try', tone: 'success' },
          ]}
        />
      }
    />
  );
}
