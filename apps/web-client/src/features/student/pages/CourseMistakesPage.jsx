import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, NotebookPen, Play, RotateCcw, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { COURSE_LEVELS } from '@appenglish/content-contracts';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { paginate } from '../../../lib/list.js';
import { cn } from '../../../lib/utils.js';
import { useHeldPlayer } from '../../../hooks/use-held-player.js';
import { Badge, Button, Input } from '../../../components/ui';
import { EmptyState } from '../../../components/shared/EmptyState.jsx';
import { FilterSelect, SearchField } from '../../../components/shared/ListFilter.jsx';
import { PageHeader } from '../../../components/shared/PageHeader.jsx';
import { Pagination } from '../../../components/shared/Pagination.jsx';
import { ListPageSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { checkCourseMistake, listCourseMistakes } from '../api/course-api.js';
import { CheckedWords } from '../components/ListeningMarks.jsx';
import { filterMistakes, MistakeSort, mistakeSortOptions, missedWordLabel } from '../lib/listening-course.js';
import { isTimed } from '../lib/listening-practice.js';

const PER_PAGE = 10;
const levelOptions = [{ value: 'all', label: 'All levels' }, ...COURSE_LEVELS.map((level) => ({ value: level, label: level }))];

// One sentence of the notebook written again: the player held to the
// sentence (D95), a box, and the check. Right, it leaves the notebook.
function MistakePractice({ mistake, onFixed, onClose }) {
  const audioRef = useRef(null);
  const inputRef = useRef(null);
  const [text, setText] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const timed = isTimed(mistake);
  const { playLine } = useHeldPlayer(audioRef, { line: mistake, onStop: () => inputRef.current?.focus() });

  async function check() {
    if (busy) return;
    setBusy(true);
    try {
      const checked = (await checkCourseMistake(mistake.id, text)).data;
      setResult(checked);
      if (checked.fixed) notify({ title: 'Right! The sentence leaves your notebook.' });
    } catch (error) {
      notify({ title: 'Could not check the sentence', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 border-t bg-muted/30 px-4 py-4">
      {mistake.audioUrl ? (
        <div className="space-y-2">
          <audio ref={audioRef} src={mistake.audioUrl} controls controlsList="nodownload" preload="auto" className="w-full" />
          {timed ? (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => playLine().catch(() => {})}>
              <Play className="h-4 w-4" />
              Play the sentence
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">This recording has no sentence times: find the sentence in it.</p>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">The recording is no longer published; write the sentence from memory.</p>
      )}
      {result ? (
        <div className="space-y-1">
          <div className="text-lg">
            <CheckedWords words={result.sentence.words} />
          </div>
          <p className={cn('font-semibold', result.fixed ? 'text-success' : 'text-destructive')}>
            {result.fixed ? 'All right! It leaves your notebook.' : `${result.sentence.accuracy}% right. The sentence is: “${result.sentence.text}”`}
          </p>
        </div>
      ) : (
        <Input
          ref={inputRef}
          aria-label="What you hear"
          className="h-11 text-base"
          autoComplete="off"
          spellCheck={false}
          maxLength={2000}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              check();
            }
          }}
        />
      )}
      <div className="flex flex-wrap gap-2">
        {result ? (
          result.fixed ? (
            <Button onClick={onFixed}>Done</Button>
          ) : (
            <Button
              variant="outline"
              className="gap-1.5"
              onClick={() => {
                setResult(null);
                setText('');
              }}
            >
              <RotateCcw className="h-4 w-4" />
              Try again
            </Button>
          )
        ) : (
          <Button className="gap-1.5" loading={busy} disabled={busy} onClick={check}>
            <Check className="h-4 w-4" />
            Check
          </Button>
        )}
        <Button variant="ghost" className="gap-1.5" onClick={result?.fixed ? onFixed : onClose}>
          <X className="h-4 w-4" />
          Close
        </Button>
      </div>
    </div>
  );
}

// The mistakes notebook of the Listening course (D104): the sentences the
// learner wrote down wrong when finishing a lesson, with the words missed,
// searched, filtered, sorted and paged; each can be written again until it is
// right, and then leaves the notebook.
export function CourseMistakesPage() {
  const [state, setState] = useState('loading');
  const [data, setData] = useState(null);
  const [filters, setFilters] = useState({ search: '', level: 'all', sort: MistakeSort.LATEST });
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(null);
  const setFilter = (name) => (value) => {
    setFilters((current) => ({ ...current, [name]: value }));
    setPage(1);
  };

  async function load() {
    setState('loading');
    try {
      setData((await listCourseMistakes()).data);
      setState('ready');
    } catch (error) {
      setState('error');
      notify({ title: 'Could not load your mistakes', description: getApiErrorMessage(error), variant: 'destructive' });
    }
  }

  useEffect(() => {
    load();
  }, []);

  const back = (
    <Link to="/student/listening-course" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="h-4 w-4" />
      Listening course
    </Link>
  );

  if (state === 'loading') return <ListPageSkeleton rows={5} />;
  if (state === 'error')
    return (
      <div className="space-y-4">
        {back}
        <Button variant="outline" onClick={load}>
          Try again
        </Button>
      </div>
    );

  const shown = paginate(filterMistakes(data.mistakes, filters), page, PER_PAGE);
  const fixed = (id) => {
    setOpen(null);
    setData((current) => ({ ...current, mistakes: current.mistakes.filter((mistake) => mistake.id !== id) }));
  };

  return (
    <section className="space-y-6">
      {back}
      <PageHeader
        eyebrow="Listening course"
        title="My mistakes"
        description="The sentences you wrote down wrong when you finished a lesson. Listen again and write each one until it is right."
      />
      {data.mistakes.length === 0 ? (
        <EmptyState icon={NotebookPen} title="No mistakes to review" description="Sentences you write down wrong in a lesson will appear here." />
      ) : (
        <>
          {data.mostMissedWords.length ? (
            <div className="space-y-2 rounded-xl border bg-card p-4 shadow-sm">
              <p className="text-sm font-medium">Words you miss most</p>
              <div className="flex flex-wrap gap-2">
                {data.mostMissedWords.map((entry) => (
                  <Badge key={entry.word} variant="secondary">
                    {entry.word} · {entry.count}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <SearchField value={filters.search} onChange={setFilter('search')} placeholder="Search by lesson, unit or word" />
            <FilterSelect label="Level" value={filters.level} onChange={setFilter('level')} options={levelOptions} />
            <FilterSelect label="Sort" value={filters.sort} onChange={setFilter('sort')} options={mistakeSortOptions} />
          </div>
          {shown.total === 0 ? <EmptyState icon={NotebookPen} title="No mistake matches" description="Try another search or filter." /> : null}
          <ul className="space-y-3">
            {shown.items.map((mistake) => (
              <li key={mistake.id} className="overflow-hidden rounded-xl border bg-card shadow-sm">
                <div className="flex flex-wrap items-start gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{mistake.level}</Badge>
                      <span className="truncate font-medium">{mistake.lessonTitle}</span>
                      <span className="truncate text-sm text-muted-foreground">{mistake.unitTitle}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {mistake.speaker ? `${mistake.speaker} · ` : ''}missed {mistake.timesMissed} time{mistake.timesMissed === 1 ? '' : 's'}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {mistake.missedWords.map((word, index) => (
                        <span key={index} className="rounded bg-destructive/10 px-1.5 py-0.5 text-xs text-destructive">
                          {missedWordLabel(word)}
                        </span>
                      ))}
                    </div>
                  </div>
                  {open === mistake.id ? null : (
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen(mistake.id)}>
                      <NotebookPen className="h-4 w-4" />
                      Write it again
                    </Button>
                  )}
                </div>
                {open === mistake.id ? <MistakePractice mistake={mistake} onFixed={() => fixed(mistake.id)} onClose={() => setOpen(null)} /> : null}
              </li>
            ))}
          </ul>
          <Pagination page={shown.page} pageCount={shown.pageCount} total={shown.total} noun="sentence" onChange={setPage} />
        </>
      )}
    </section>
  );
}
