import { Badge } from '../../../components/ui';
import { CourseQuestion } from './CourseQuestion.jsx';
import { TestRecordingPlayer } from './TestRecordingPlayer.jsx';
import { playKeyOf } from '../lib/test-plays.js';

export function CourseTestSection({ index, section, first, versionId, answers, onChoose }) {
  return (
    <div className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <h2 className="font-semibold">Recording {index + 1}</h2>
        {section.level && !answers ? <Badge variant="secondary">{section.level}</Badge> : null}
      </div>
      {section.audioUrl ? (
        answers ? (
          <TestRecordingPlayer src={section.audioUrl} playKey={playKeyOf(versionId, section.id)} />
        ) : (
          <audio src={section.audioUrl} controls controlsList="nodownload" preload="none" className="w-full" />
        )
      ) : (
        <p className="text-sm text-destructive">This recording cannot be played right now.</p>
      )}
      <div className="space-y-6">
        {section.questions.map((question, at) => (
          <CourseQuestion
            key={question.id}
            number={first + at}
            question={question}
            chosen={answers?.[question.id]}
            marked={answers ? null : question}
            onChoose={(optionId) => onChoose?.(question.id, optionId)}
          />
        ))}
      </div>
      {section.transcript ? (
        <details className="rounded-lg border bg-background px-4 py-3 text-sm">
          <summary className="cursor-pointer font-medium">Transcript</summary>
          <ol className="mt-2 space-y-1">
            {section.transcript.map((segment) => (
              <li key={segment.id}>
                {segment.speaker ? <span className="mr-2 text-muted-foreground">{segment.speaker}:</span> : null}
                {segment.text}
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </div>
  );
}

export const firstNumbers = (sections) => sections.map((_, index) => sections.slice(0, index).reduce((sum, section) => sum + section.questions.length, 0) + 1);
