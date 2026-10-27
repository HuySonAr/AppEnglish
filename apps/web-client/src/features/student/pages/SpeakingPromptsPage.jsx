import { Mic } from 'lucide-react';
import { kindLabels } from '../../../lib/practice-prompts.js';
import { listSpeakingPrompts } from '../api/speaking-api.js';
import { PracticePromptList } from '../components/PracticePromptList.jsx';

export function SpeakingPromptsPage() {
  return (
    <PracticePromptList
      title="Speaking"
      description="Read aloud or answer a question, then get a score."
      icon={Mic}
      kindLabel={(prompt) => kindLabels[prompt.kind]}
      basePath="/student/practice/speaking"
      load={listSpeakingPrompts}
    />
  );
}
