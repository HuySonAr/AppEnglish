import { useEffect, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import {
  COURSE_LEVELS,
  COURSE_LIMITS,
  COURSE_SECTIONS,
  COURSE_SECTION_TITLES,
  ContentResponseCode,
  CourseItemType,
  FILL_IN_BLANK,
} from '@appenglish/content-contracts';
import { errorCode, getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { cn } from '../../../lib/utils.js';
import { Badge, Button, Card, CardContent, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui';
import { EditorPageSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { getCourseItem, getListeningExercise, listListeningExercises, publishCourseItem, saveCourseItemDraft, updateCourseItem } from '../api/content-api.js';
import { CourseExercisePicker } from '../components/CourseExercisePicker.jsx';
import { CourseQuestionEditor } from '../components/CourseQuestionEditor.jsx';
import { TextField } from '../components/TextField.jsx';
import {
  courseIssueLabel,
  withBlankAnswers,
  newFocus,
  focusWordsFromText,
  newKeyword,
  newLesson,
  newQuestion,
  newSection,
  placementLevelCounts,
  sectionQuestionCount,
  toggleClose,
  workingCourse,
} from '../lib/course-draft.js';
import { lessonState } from '../lib/lesson-draft.js';

const move = (list, index, by) => {
  const next = [...list];
  [next[index], next[index + by]] = [next[index + by], next[index]];
  return next;
};

// Recordings of a unit check, a level test or the placement, each with its
// questions. withLevels: each recording also says the level it tests (the
// placement, D103), and questions are counted by level.
function SectionsEditor({ idPrefix, sections, onChange, library, exercises, onPick, minimum, withLevels = false }) {
  const count = sectionQuestionCount(sections);
  const setSection = (index, change) => onChange(sections.map((section, at) => (at === index ? change(section) : section)));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {withLevels ? (
          placementLevelCounts(sections).map((entry) => (
            <Badge key={entry.level} variant={entry.count >= minimum ? 'success' : 'secondary'}>
              {entry.level}: {entry.count}
            </Badge>
          ))
        ) : (
          <Badge variant={count >= minimum ? 'success' : 'secondary'}>
            {count} question{count === 1 ? '' : 's'} (at least {minimum})
          </Badge>
        )}
        {withLevels ? <span className="text-sm text-muted-foreground">questions by level (at least {minimum} each)</span> : null}
        <Button
          variant="outline"
          size="sm"
          className="ml-auto gap-1.5"
          disabled={sections.length >= COURSE_LIMITS.sections}
          onClick={() => onChange([...sections, newSection(withLevels ? null : undefined)])}
        >
          <Plus className="h-4 w-4" />
          Add a recording
        </Button>
      </div>
      {sections.map((section, index) => (
        <Card key={section.id}>
          <CardContent className="space-y-3 pt-6">
            <div className="flex items-center gap-2">
              <span className="font-medium">Recording {index + 1}</span>
              {withLevels ? (
                <Select value={section.level ?? ''} onValueChange={(level) => level && setSection(index, (current) => ({ ...current, level }))}>
                  <SelectTrigger className="h-8 w-32" aria-label={`Recording ${index + 1} level`}>
                    <SelectValue placeholder="Level" />
                  </SelectTrigger>
                  <SelectContent>
                    {COURSE_LEVELS.map((level) => (
                      <SelectItem key={level} value={level}>
                        Tests {level}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
              <Button
                variant="ghost"
                size="icon"
                className="ml-auto"
                aria-label={`Remove recording ${index + 1}`}
                onClick={() => onChange(sections.filter((_, at) => at !== index))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <CourseExercisePicker
              id={`${idPrefix}-${section.id}`}
              library={library}
              value={section.exerciseId}
              exercise={exercises[section.exerciseId]}
              onChange={(exerciseId) => {
                setSection(index, (current) => ({ ...current, exerciseId }));
                onPick(exerciseId);
              }}
            />
            {section.questions.map((question, at) => (
              <CourseQuestionEditor
                key={question.id}
                id={question.id}
                label={`Question ${at + 1}`}
                question={question}
                onChange={(next) =>
                  setSection(index, (current) => ({
                    ...current,
                    questions: current.questions.map((item) => (item.id === question.id ? next : item)),
                  }))
                }
                onRemove={() =>
                  setSection(index, (current) => ({
                    ...current,
                    questions: current.questions.filter((item) => item.id !== question.id),
                  }))
                }
              />
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5"
              disabled={section.questions.length >= COURSE_LIMITS.questionsPerSection}
              onClick={() =>
                setSection(index, (current) => ({
                  ...current,
                  questions: [...current.questions, newQuestion()],
                }))
              }
            >
              <Plus className="h-4 w-4" />
              Add question
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// One lesson of a unit: its recording, the sentences to write down, the
// keywords and the gist and detail questions (D100).
function LessonEditor({ lesson, index, count, onChange, onMove, onRemove, library, exercises, onPick }) {
  const set = (field, value) => onChange({ ...lesson, [field]: value });
  return (
    <details open className="group rounded-xl border bg-card shadow-sm">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 px-4 py-3">
        <span className="font-semibold">
          Lesson {index + 1}: {lesson.title || 'Untitled'}
        </span>
        <span className="text-sm text-muted-foreground">
          {lesson.closeSegmentIds.length} sentence
          {lesson.closeSegmentIds.length === 1 ? '' : 's'} · {lesson.detail.length} detail question
          {lesson.detail.length === 1 ? '' : 's'}
        </span>
        <span className="ml-auto flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Move lesson ${index + 1} up`}
            disabled={index === 0}
            onClick={(event) => {
              event.preventDefault();
              onMove(-1);
            }}
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Move lesson ${index + 1} down`}
            disabled={index === count - 1}
            onClick={(event) => {
              event.preventDefault();
              onMove(1);
            }}
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Remove lesson ${index + 1}`}
            onClick={(event) => {
              event.preventDefault();
              onRemove();
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </span>
      </summary>
      <div className="space-y-5 border-t px-4 py-4">
        <TextField id={`${lesson.id}-title`} label="Lesson title" value={lesson.title} maxLength={200} onChange={(value) => set('title', value)} />
        <CourseExercisePicker
          id={`${lesson.id}-exercise`}
          library={library}
          value={lesson.exerciseId}
          exercise={exercises[lesson.exerciseId]}
          onChange={(exerciseId) => {
            onChange({ ...lesson, exerciseId, closeSegmentIds: [] });
            onPick(exerciseId);
          }}
          chosen={lesson.closeSegmentIds}
          onToggle={(segmentId) => onChange(toggleClose(lesson, segmentId))}
          max={COURSE_LIMITS.closeSentences.max}
        />

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label>1 · Before you listen: keywords</Label>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto gap-1.5"
              disabled={lesson.keywords.length >= COURSE_LIMITS.keywords}
              onClick={() => set('keywords', [...lesson.keywords, newKeyword()])}
            >
              <Plus className="h-4 w-4" />
              Add keyword
            </Button>
          </div>
          {lesson.keywords.length === 0 ? <p className="text-sm text-muted-foreground">Optional: 4–6 words learners meet in the recording.</p> : null}
          {lesson.keywords.map((keyword, at) => (
            <div key={keyword.id} className="flex items-center gap-2">
              <Input
                aria-label={`Keyword ${at + 1}`}
                placeholder="Word"
                maxLength={100}
                value={keyword.word}
                onChange={(event) =>
                  set(
                    'keywords',
                    lesson.keywords.map((item) => (item.id === keyword.id ? { ...item, word: event.target.value } : item)),
                  )
                }
              />
              <Input
                aria-label={`Keyword ${at + 1} meaning`}
                placeholder="Meaning"
                maxLength={300}
                value={keyword.meaning}
                onChange={(event) =>
                  set(
                    'keywords',
                    lesson.keywords.map((item) => (item.id === keyword.id ? { ...item, meaning: event.target.value } : item)),
                  )
                }
              />
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0"
                aria-label={`Remove keyword ${at + 1}`}
                onClick={() =>
                  set(
                    'keywords',
                    lesson.keywords.filter((item) => item.id !== keyword.id),
                  )
                }
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <Label>2 · Listen for gist</Label>
          <CourseQuestionEditor id={lesson.gist.id} label="Main idea question" question={lesson.gist} fixedSkill onChange={(gist) => set('gist', gist)} />
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label>
              3 · Listen for detail ({COURSE_LIMITS.detailQuestions.min}–{COURSE_LIMITS.detailQuestions.max} questions)
            </Label>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto gap-1.5"
              disabled={lesson.detail.length >= COURSE_LIMITS.detailQuestions.max}
              onClick={() => set('detail', [...lesson.detail, newQuestion()])}
            >
              <Plus className="h-4 w-4" />
              Add question
            </Button>
          </div>
          {lesson.detail.map((question, at) => (
            <CourseQuestionEditor
              key={question.id}
              id={question.id}
              label={`Detail question ${at + 1}`}
              question={question}
              allowComplete
              onChange={(next) =>
                set(
                  'detail',
                  lesson.detail.map((item) => (item.id === question.id ? next : item)),
                )
              }
              onRemove={() =>
                set(
                  'detail',
                  lesson.detail.filter((item) => item.id !== question.id),
                )
              }
            />
          ))}
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label>4 · Focus on (optional)</Label>
            {lesson.focus ? (
              <Button variant="ghost" size="sm" className="ml-auto gap-1.5" onClick={() => set('focus', null)}>
                <Trash2 className="h-4 w-4" />
                Remove
              </Button>
            ) : (
              <Button variant="ghost" size="sm" className="ml-auto gap-1.5" onClick={() => set('focus', newFocus())}>
                <Plus className="h-4 w-4" />
                Add Focus on
              </Button>
            )}
          </div>
          {lesson.focus ? (
            <FocusEditor id={lesson.id} focus={lesson.focus} onChange={(focus) => set('focus', focus)} />
          ) : (
            <p className="text-sm text-muted-foreground">A short dialogue with blanks the learner fills from words given, as in the book's Focus on box.</p>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          5 · Listen closely uses the sentences ticked above; 6 · Review shows the transcript and the learner's mistakes.
        </p>
      </div>
    </details>
  );
}

// The Focus on step of a lesson (D109): a title, a dialogue with ___ for
// each blank, the words to choose from and the right word of each blank.
function FocusEditor({ id, focus, onChange }) {
  const [wordsText, setWordsText] = useState(focus.words.join(', '));
  const words = focus.words;
  return (
    <div className="space-y-3 rounded-lg border p-3">
      <TextField
        id={`${id}-focus-title`}
        label="Title, e.g. Saying hello"
        value={focus.title}
        maxLength={200}
        onChange={(title) => onChange({ ...focus, title })}
      />
      <TextField
        id={`${id}-focus-passage`}
        label={`Dialogue, one line per turn, ${FILL_IN_BLANK} for each blank (up to ${COURSE_LIMITS.focusBlanks})`}
        multiline
        rows={4}
        value={focus.passage}
        maxLength={2000}
        onChange={(passage) => onChange(withBlankAnswers({ ...focus, passage }))}
      />
      <TextField
        id={`${id}-focus-words`}
        label={`Words to choose from, separated by commas (up to ${COURSE_LIMITS.focusWords})`}
        value={wordsText}
        maxLength={1200}
        onChange={(text) => {
          setWordsText(text);
          onChange({ ...focus, words: focusWordsFromText(text).slice(0, COURSE_LIMITS.focusWords) });
        }}
      />
      {focus.answers.length ? (
        <div className="space-y-2">
          <Label>Right word of each blank</Label>
          {focus.answers.map((answer, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="w-16 text-sm text-muted-foreground">Blank {index + 1}</span>
              <Select
                value={answer || undefined}
                onValueChange={(word) => word && onChange({ ...focus, answers: focus.answers.map((item, at) => (at === index ? word : item)) })}
              >
                <SelectTrigger className="h-9 w-56" aria-label={`Focus on blank ${index + 1}`}>
                  <SelectValue placeholder="Choose" />
                </SelectTrigger>
                <SelectContent>
                  {words.map((word) => (
                    <SelectItem key={word} value={word}>
                      {word}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Write the dialogue with {FILL_IN_BLANK} where a word is missing; the blanks appear here to choose their word.
        </p>
      )}
    </div>
  );
}

// Editor of a unit or a level test of the Listening course (F05C, D100).
export function CourseItemEditorPage() {
  const { itemId } = useParams();
  const [state, setState] = useState('loading');
  const [item, setItem] = useState(null);
  const [details, setDetails] = useState({ title: '', description: '' });
  const [status, setStatus] = useState(lessonState(null));
  const [content, setContent] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [issues, setIssues] = useState([]);
  // Published library exercises to choose from, and the chosen ones' sentences.
  const [library, setLibrary] = useState([]);
  const [exercises, setExercises] = useState({});

  function update(change) {
    setContent((current) => change(current));
    setDirty(true);
  }

  function apply(data) {
    setItem(data.item);
    setDetails({
      title: data.item.title,
      description: data.item.description,
      section: data.item.section,
    });
    setStatus(lessonState(data));
    setContent(workingCourse(data));
    setExercises((current) => ({ ...current, ...data.exercises }));
    setDirty(false);
  }

  async function load() {
    setState('loading');
    try {
      const [data, list] = await Promise.all([getCourseItem(itemId), listListeningExercises()]);
      apply(data.data);
      setLibrary(list.data.exercises);
      setIssues([]);
      setState('ready');
    } catch (error) {
      setState('error');
      notify({
        title: 'Could not load the unit',
        description: getApiErrorMessage(error),
        variant: 'destructive',
      });
    }
  }

  useEffect(() => {
    load();
  }, [itemId]);

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  // Loads the sentences and recording of a newly chosen exercise.
  async function onPick(exerciseId) {
    if (exercises[exerciseId]) return;
    try {
      const data = (await getListeningExercise(exerciseId)).data;
      const published = data.published?.content;
      if (!published) return;
      setExercises((current) => ({
        ...current,
        [exerciseId]: {
          id: exerciseId,
          audioUrl: data.media?.[published.audioMediaId]?.url || null,
          segments: published.segments,
        },
      }));
    } catch (error) {
      notify({
        title: 'Could not load the recording',
        description: getApiErrorMessage(error),
        variant: 'destructive',
      });
    }
  }

  async function saveDraft({ quiet = false } = {}) {
    const data = (await saveCourseItemDraft(itemId, content)).data;
    apply(data);
    if (!quiet) notify({ title: `Draft saved (version ${data.draft.versionNumber})` });
  }

  async function onSave() {
    setBusy(true);
    try {
      await saveDraft();
      setIssues([]);
    } catch (error) {
      notify({
        title: 'Could not save the draft',
        description: getApiErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  }

  async function onPublish() {
    setBusy(true);
    try {
      if (dirty) await saveDraft({ quiet: true });
      const data = (await publishCourseItem(itemId)).data;
      apply(data);
      setIssues([]);
      notify({ title: `Published version ${data.published.versionNumber}` });
    } catch (error) {
      const found = error?.response?.data?.data?.issues;
      if (errorCode(error) === ContentResponseCode.CONTENT_NOT_PUBLISHABLE && found?.length) {
        setIssues(found);
        notify({
          title: 'Not ready to publish yet',
          description: `${found.length} item${found.length === 1 ? '' : 's'} to fix. The draft was saved.`,
          variant: 'destructive',
        });
      } else
        notify({
          title: 'Could not publish',
          description: getApiErrorMessage(error),
          variant: 'destructive',
        });
    } finally {
      setBusy(false);
    }
  }

  async function onSaveDetails(event) {
    event.preventDefault();
    setBusy(true);
    try {
      setItem(
        (
          await updateCourseItem(itemId, {
            title: details.title.trim(),
            description: details.description.trim(),
            ...(item.type === CourseItemType.UNIT && details.section !== item.section ? { section: details.section } : {}),
          })
        ).data.item,
      );
      notify({ title: 'Details saved' });
    } catch (error) {
      notify({
        title: 'Could not save the details',
        description: getApiErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  }

  const toPlacement = item?.type === CourseItemType.PLACEMENT;
  const back = (
    <Link
      to={toPlacement ? '/content-manager/listening-placement' : '/content-manager/listening-course'}
      className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" />
      {toPlacement ? 'Listening placement' : 'Listening course'}
    </Link>
  );

  if (state === 'loading') return <EditorPageSkeleton />;
  if (state === 'error')
    return (
      <div className="space-y-4">
        {back}
        <Button variant="outline" onClick={load}>
          Try again
        </Button>
      </div>
    );

  const unit = item.type === CourseItemType.UNIT;
  const placement = item.type === CourseItemType.PLACEMENT;
  const detailsChanged =
    details.title.trim() !== item.title ||
    details.description.trim() !== item.description ||
    (item.type === CourseItemType.UNIT && details.section !== item.section);
  const setLessons = (change) => update((current) => ({ ...current, lessons: change(current.lessons) }));

  return (
    <section className="space-y-6">
      {back}
      <form
        onSubmit={onSaveDetails}
        className={cn(
          'grid gap-3 rounded-xl border bg-card p-4 shadow-sm sm:items-end',
          unit ? 'sm:grid-cols-[auto_1fr_1fr_auto]' : 'sm:grid-cols-[1fr_1fr_auto]',
        )}
      >
        {unit ? (
          <div className="space-y-2">
            <Label htmlFor="item-section">Section</Label>
            <Select value={details.section || undefined} onValueChange={(value) => value && setDetails({ ...details, section: value })}>
              <SelectTrigger id="item-section" className="sm:w-48">
                <SelectValue placeholder="Choose" />
              </SelectTrigger>
              <SelectContent>
                {COURSE_SECTIONS.map((section) => (
                  <SelectItem key={section} value={section}>
                    {COURSE_SECTION_TITLES[section]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="item-title">Title</Label>
          <Input id="item-title" maxLength={200} value={details.title} onChange={(event) => setDetails({ ...details, title: event.target.value })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="item-description">Description</Label>
          <Input
            id="item-description"
            maxLength={2000}
            value={details.description}
            onChange={(event) => setDetails({ ...details, description: event.target.value })}
          />
        </div>
        <Button type="submit" variant="outline" disabled={busy || !details.title.trim() || !detailsChanged}>
          Save details
        </Button>
      </form>

      <div className="sticky top-16 z-10 -mx-4 flex flex-wrap items-center gap-2 border-b bg-background/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        {item.level ? <Badge variant="info">{item.level}</Badge> : null}
        <Badge variant="secondary">{unit ? 'Unit' : placement ? 'Listening placement' : 'Level test'}</Badge>
        {status.publishedVersion ? <Badge variant="success">Published v{status.publishedVersion}</Badge> : <Badge variant="outline">Not published</Badge>}
        {status.hasDraft ? <Badge variant="warning">Draft v{status.draftVersion}</Badge> : null}
        {dirty ? <Badge variant="info">Unsaved changes</Badge> : null}
        <div className="ml-auto flex gap-2">
          <Button loading={busy} variant="outline" disabled={busy || !dirty} onClick={onSave}>
            {busy ? 'Working…' : 'Save draft'}
          </Button>
          <Button disabled={busy || !(dirty || status.hasDraft)} onClick={onPublish}>
            Publish
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        {unit
          ? `Each lesson uses a published recording of the listening library. Learners go through five steps: keywords, the main idea, the details, writing down the ticked sentences, then the review. A lesson is passed at 70%; the unit check at 75% opens the next unit.`
          : placement
            ? `Learners take the placement once to find the level they start at. Give each recording the level it tests, with at least ${COURSE_LIMITS.placementQuestionsPerLevel} questions for every level from A1 to C1 (3 per level makes 15). A level counts as known at 60% of its questions; the learner starts at the first level not known.`
            : `Learners take the level test to move up from ${item.level}; it is passed at 70%. Use recordings learners have not met in the lessons.`}
      </p>

      {issues.length ? (
        <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <p className="font-medium">Fix these before publishing ({issues.length}):</p>
          <ul className="mt-2 max-h-64 list-disc space-y-1 overflow-y-auto pl-5">
            {issues.map((issue, index) => (
              <li key={index}>
                <span className="font-medium">{courseIssueLabel(issue.path, item.type)}</span>: {issue.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {unit ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">Lessons</h2>
            <Badge variant="secondary">{content.lessons.length}</Badge>
            <Button
              variant="outline"
              size="sm"
              className="ml-auto gap-1.5"
              disabled={content.lessons.length >= COURSE_LIMITS.lessonsPerUnit}
              onClick={() => setLessons((lessons) => [...lessons, newLesson()])}
            >
              <Plus className="h-4 w-4" />
              Add lesson
            </Button>
          </div>
          {content.lessons.length === 0 ? (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              No lesson yet. Add the first one; three per unit is a good size.
            </p>
          ) : null}
          <div className="space-y-3">
            {content.lessons.map((lesson, index) => (
              <LessonEditor
                key={lesson.id}
                lesson={lesson}
                index={index}
                count={content.lessons.length}
                library={library}
                exercises={exercises}
                onPick={onPick}
                onChange={(next) => setLessons((lessons) => lessons.map((item2) => (item2.id === lesson.id ? next : item2)))}
                onMove={(by) => setLessons((lessons) => move(lessons, index, by))}
                onRemove={() => setLessons((lessons) => lessons.filter((item2) => item2.id !== lesson.id))}
              />
            ))}
          </div>

          <h2 className="pt-2 text-lg font-semibold">Unit check</h2>
          <SectionsEditor
            idPrefix="check"
            sections={content.check.sections}
            onChange={(sections) => update((current) => ({ ...current, check: { sections } }))}
            library={library}
            exercises={exercises}
            onPick={onPick}
            minimum={COURSE_LIMITS.unitCheckQuestions}
          />
        </>
      ) : (
        <>
          <h2 className="text-lg font-semibold">{placement ? 'Placement recordings' : 'Level test'}</h2>
          <SectionsEditor
            idPrefix="test"
            sections={content.sections}
            onChange={(sections) => update((current) => ({ ...current, sections }))}
            library={library}
            exercises={exercises}
            onPick={onPick}
            minimum={placement ? COURSE_LIMITS.placementQuestionsPerLevel : COURSE_LIMITS.levelTestQuestions}
            withLevels={placement}
          />
        </>
      )}
    </section>
  );
}
