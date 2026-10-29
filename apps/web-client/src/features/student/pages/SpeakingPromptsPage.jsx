import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Check, Gauge, History, LayoutList, Mic, SignalHigh, SignalLow, SignalMedium, Trash2 } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { PRACTICE_LEVELS, PracticeLevel, practiceLevelOf } from '@appenglish/content-contracts';
import { PageBreadcrumb } from '../../../components/shared/PageBreadcrumb.jsx';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { compareText, paginate } from '../../../lib/list.js';
import { cn } from '../../../lib/utils.js';
import { Button } from '../../../components/ui';
import { EmptyState } from '../../../components/shared/EmptyState.jsx';
import { FilterSelect } from '../../../components/shared/ListFilter.jsx';
import { PracticeBanner } from '../../../components/shared/PracticeBanner.jsx';
import speakingArt from '../../../svg/Speaking Education.svg';
import { CardGridPageSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { Pagination } from '../../../components/shared/Pagination.jsx';
import { RevealGroup, RevealItem } from '../../../components/shared/Reveal.jsx';
import { SPEAKING_PARTS, levelLabel, speakingPartOf } from '../../../lib/practice-prompts.js';
import { clearSpeakingPrompt, listSpeakingPrompts } from '../api/speaking-api.js';
import { ConfirmDelete } from '../components/ConfirmDelete.jsx';

const PAGE_SIZE = 12;
const levelStyle = {
  [PracticeLevel.BASIC]: { icon: SignalLow, tone: 'text-success' },
  [PracticeLevel.INTERMEDIATE]: { icon: SignalMedium, tone: 'text-warning' },
  [PracticeLevel.ADVANCED]: { icon: SignalHigh, tone: 'text-destructive' },
};
const lift = { whileHover: { y: -3 }, transition: { type: 'spring', stiffness: 380, damping: 26 } };

export const speakingPartPath = (number) => `/student/practice/speaking?part=${number}`;

function PromptCard({ prompt, number, onClear }) {
  const level = practiceLevelOf(prompt.level);
  const style = levelStyle[level] || levelStyle[PracticeLevel.INTERMEDIATE];
  const LevelIcon = style.icon;
  const tried = prompt.attempts > 0;
  const iconButton = 'flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40';
  return (
    <motion.div {...lift} className={cn('flex h-full flex-col overflow-hidden rounded-xl border bg-card transition-colors hover:border-primary/40', tried && 'border-success/40')}>
      <Link to={`/student/practice/speaking/${prompt.id}`} className="group flex flex-1 flex-col gap-2 p-4 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
        {prompt.imageUrl ? (
          <div className="-mx-4 -mt-4 mb-1 aspect-video overflow-hidden border-b bg-muted">
            <img src={prompt.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
          </div>
        ) : null}
        <p className="line-clamp-2 font-semibold leading-snug group-hover:text-primary">{prompt.title || 'Untitled prompt'}</p>
        <p className="mt-auto flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
          <span className={cn('flex shrink-0 items-center gap-1 font-medium', style.tone)}>
            <LevelIcon className="h-3.5 w-3.5" />
            {levelLabel(prompt.level)}
          </span>
          <span className="shrink-0 tabular-nums">Ex {number}</span>
          {prompt.topic ? <span className="truncate">{prompt.topic}</span> : null}
        </p>
      </Link>
      <div className={cn('flex items-center gap-1 border-t px-4 py-1.5 text-xs', tried ? 'bg-success/5' : 'bg-muted/30')}>
        {tried ? (
          <span className="flex items-center gap-1.5 font-medium text-success">
            <Check className="h-3.5 w-3.5" />
            Practised
            {typeof prompt.bestTotal === 'number' ? <span className="font-semibold tabular-nums text-foreground">· {prompt.bestTotal.toFixed(1)}</span> : null}
          </span>
        ) : (
          <span className="text-muted-foreground">Not practised</span>
        )}
        <span className="ml-auto flex items-center">
          {tried ? (
            <Link to={`/student/practice/speaking/${prompt.id}/history`} className={cn(iconButton, 'hover:bg-accent hover:text-foreground')} aria-label="Your attempts" title="Your attempts">
              <History className="h-4 w-4" />
            </Link>
          ) : (
            <button type="button" disabled className={iconButton} aria-label="Your attempts">
              <History className="h-4 w-4" />
            </button>
          )}
          <button type="button" disabled={!tried} className={cn(iconButton, 'hover:bg-destructive/10 hover:text-destructive')} aria-label="Delete your attempts" title="Delete your attempts" onClick={() => onClear(prompt)}>
            <Trash2 className="h-4 w-4" />
          </button>
        </span>
      </div>
    </motion.div>
  );
}

export function SpeakingPromptsPage() {
  const [params, setParams] = useSearchParams();
  const [state, setState] = useState('loading');
  const [prompts, setPrompts] = useState([]);
  const [clearing, setClearing] = useState(null);
  const partNumber = SPEAKING_PARTS.some((part) => String(part.number) === params.get('part')) ? Number(params.get('part')) : 1;
  const level = params.get('level') || 'all';
  const topic = params.get('topic') || 'all';
  const page = Math.max(1, Number(params.get('page')) || 1);

  async function load() {
    setState('loading');
    try {
      setPrompts((await listSpeakingPrompts()).data.prompts);
      setState('ready');
    } catch (error) {
      setState('error');
      notify({ title: 'Could not load the prompts', description: getApiErrorMessage(error), variant: 'destructive' });
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function clear() {
    try {
      const { deleted, kept } = (await clearSpeakingPrompt(clearing.id)).data;
      notify({
        title: deleted.length ? 'Attempts deleted' : 'Nothing was deleted',
        description: kept ? `${kept} attempt${kept === 1 ? ' is' : 's are'} kept because ${kept === 1 ? 'it is' : 'they are'} being scored or sent to a teacher.` : undefined,
      });
      setClearing(null);
      setPrompts((await listSpeakingPrompts()).data.prompts);
    } catch (error) {
      notify({ title: 'Could not delete the attempts', description: getApiErrorMessage(error), variant: 'destructive' });
    }
  }

  const update = (changes) => {
    const next = { part: String(partNumber), level, topic, page: '1', ...changes };
    setParams(Object.fromEntries(Object.entries(next).filter(([key, value]) => !(value === 'all' || (key === 'page' && value === '1')))), { replace: true });
  };

  const back = <PageBreadcrumb items={[{ label: 'Practice', to: '/student/practice' }, { label: 'Speaking' }]} />;

  if (state === 'loading') return <CardGridPageSkeleton cards={8} toolbar={false} />;
  if (state === 'error')
    return (
      <div className="space-y-4">
        {back}
        <Button variant="outline" onClick={load}>
          Try again
        </Button>
      </div>
    );

  const part = SPEAKING_PARTS.find((item) => item.number === partNumber);
  const inPart = prompts.filter((prompt) => speakingPartOf(prompt)?.number === partNumber).sort((a, b) => compareText(a.title, b.title));
  const numbered = inPart.map((prompt, index) => ({ prompt, number: index + 1 }));
  const byTopic = topic === 'all' ? numbered : numbered.filter((item) => item.prompt.topic === topic);
  const filtered = level === 'all' ? byTopic : byTopic.filter((item) => practiceLevelOf(item.prompt.level) === level);
  const shown = paginate(filtered, page, PAGE_SIZE);
  const levelOptions = [
    { value: 'all', label: `All levels (${byTopic.length})` },
    ...PRACTICE_LEVELS.map((value) => ({ value, label: `${levelLabel(value)} (${byTopic.filter((item) => practiceLevelOf(item.prompt.level) === value).length})` })),
  ];
  const topics = [...new Set(inPart.map((prompt) => prompt.topic).filter(Boolean))].sort(compareText);
  const topicOptions = [{ value: 'all', label: `All topics (${inPart.length})` }, ...topics.map((value) => ({ value, label: `${value} (${inPart.filter((prompt) => prompt.topic === value).length})` }))];

  return (
    <section className="space-y-5">
      {back}
      <PracticeBanner
        eyebrow="Practice"
        eyebrowIcon={Mic}
        title="TOEIC"
        accent="Speaking"
        description="Pick a part and practise its prompts."
        image={speakingArt}
        features={[
          { icon: LayoutList, title: 'Five parts', note: 'Like the real test', tone: 'destructive' },
          { icon: Gauge, title: 'Quick scores', note: 'After each try' },
          { icon: History, title: 'Your history', note: 'Review every try', tone: 'success' },
        ]}
      />
      <div className="-mx-1 overflow-x-auto px-1">
        <div className="inline-flex gap-1 rounded-full border bg-card p-1" role="tablist" aria-label="Parts">
          {SPEAKING_PARTS.map((item) => {
            const active = item.number === partNumber;
            return (
              <button
                key={item.number}
                type="button"
                role="tab"
                aria-selected={active}
                title={`${item.title} · ${item.questions}`}
                onClick={() => update({ part: String(item.number), level: 'all', topic: 'all' })}
                className={cn(
                  'relative whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring',
                  active ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {active ? <motion.span layoutId="speaking-part" className="absolute inset-0 rounded-full bg-primary" transition={{ type: 'spring', stiffness: 420, damping: 34 }} /> : null}
                <span className="relative">Part {item.number}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <FilterSelect label="Level" value={level} onChange={(value) => update({ level: value })} options={levelOptions} className="w-full sm:w-52" />
        <FilterSelect label="Topic" value={topic} onChange={(value) => update({ topic: value })} options={topicOptions} className="w-full sm:w-60" />
        <p className="text-sm text-muted-foreground sm:ml-auto">
          {part.title} · {part.questions}
        </p>
      </div>

      {inPart.length === 0 ? (
        <EmptyState icon={Mic} title={`No prompts in Part ${partNumber} yet`} description="Prompts will appear here when they are published." />
      ) : shown.total === 0 ? (
        <EmptyState icon={Mic} title="No prompt matches" description="Try another level or topic." />
      ) : (
        <>
          <RevealGroup key={`${partNumber}-${level}-${topic}-${shown.page}`} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {shown.items.map((item) => (
              <RevealItem key={item.prompt.id} className="h-full">
                <PromptCard prompt={item.prompt} number={item.number} onClear={setClearing} />
              </RevealItem>
            ))}
          </RevealGroup>
          <Pagination page={shown.page} pageCount={shown.pageCount} total={shown.total} noun="prompt" onChange={(value) => update({ page: String(value) })} />
        </>
      )}
      <ConfirmDelete
        open={Boolean(clearing)}
        title="Delete your attempts?"
        description={clearing ? `All ${clearing.attempts} attempt${clearing.attempts === 1 ? '' : 's'} of “${clearing.title}” and their recordings are deleted for good, except ones sent to a teacher.` : ''}
        confirmLabel="Delete all"
        onOpenChange={(open) => !open && setClearing(null)}
        onConfirm={clear}
      />
    </section>
  );
}
