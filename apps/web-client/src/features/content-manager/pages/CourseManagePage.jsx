import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Compass, GraduationCap, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { COURSE_LEVELS, COURSE_SECTIONS, COURSE_SECTION_TITLES, CourseItemType } from '@appenglish/content-contracts';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import {
  Badge,
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../../../components/ui';
import { EmptyState } from '../../../components/shared/EmptyState.jsx';
import { PageHeader } from '../../../components/shared/PageHeader.jsx';
import { RowsSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { createCourseItem, listListeningCourse, updateCourseItem } from '../api/content-api.js';

function Status({ item }) {
  return (
    <>
      {item.publishedVersionNumber ? <Badge variant="success">Published v{item.publishedVersionNumber}</Badge> : <Badge variant="outline">Not published</Badge>}
      {item.hasDraft ? <Badge variant="warning">Draft</Badge> : null}
    </>
  );
}

// The Listening course (F05C, D100, D107) for a Content Manager: each CEFR
// level with its units, grouped by section in learning order, and its level
// test. Each is written on its own page; the listening placement has its own
// page too (D108).
export function CourseManagePage() {
  const [state, setState] = useState('loading');
  const [levels, setLevels] = useState([]);
  const [level, setLevel] = useState(COURSE_LEVELS[0]);
  const [form, setForm] = useState({
    section: COURSE_SECTIONS[0],
    title: '',
    description: '',
  });
  const [busy, setBusy] = useState(false);

  async function load({ quiet = false } = {}) {
    if (!quiet) setState('loading');
    try {
      const { data } = await listListeningCourse();
      setLevels(data.levels);
      setState('ready');
    } catch (error) {
      setState('error');
      notify({
        title: 'Could not load the listening course',
        description: getApiErrorMessage(error),
        variant: 'destructive',
      });
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function run(action, success, failure) {
    setBusy(true);
    try {
      await action();
      notify({ title: success });
      await load({ quiet: true });
      return true;
    } catch (error) {
      notify({
        title: failure,
        description: getApiErrorMessage(error),
        variant: 'destructive',
      });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function onAddUnit(event) {
    event.preventDefault();
    const added = await run(
      () =>
        createCourseItem({
          level,
          type: CourseItemType.UNIT,
          section: form.section,
          title: form.title.trim(),
          description: form.description.trim(),
        }),
      'Unit added',
      'Could not add the unit',
    );
    if (added) setForm({ ...form, title: '', description: '' });
  }

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Content Manager"
        title="Listening course"
        description="The listening path from A1 to C1. Each level has two sections, Social and Travel then Work and Study, with units of lessons; each unit ends with a unit check, and a level test lets learners move up. The placement learners take first is on its own page."
        actions={
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link to="/content-manager/listening-placement">
              <Compass className="h-4 w-4" />
              Listening placement
            </Link>
          </Button>
        }
      />

      {state === 'loading' ? (
        <RowsSkeleton rows={5} />
      ) : state === 'error' ? (
        <Button variant="outline" onClick={() => load()}>
          Try again
        </Button>
      ) : (
        <>
          <Tabs value={level} onValueChange={setLevel}>
            <TabsList>
              {levels.map((entry) => (
                <TabsTrigger key={entry.level} value={entry.level}>
                  {entry.level} ({entry.units.length})
                </TabsTrigger>
              ))}
            </TabsList>
            {levels.map((entry) => (
              <TabsContent key={entry.level} value={entry.level} className="space-y-4">
                <form onSubmit={onAddUnit} className="grid gap-3 rounded-xl border bg-card p-4 shadow-sm sm:grid-cols-[auto_1fr_1fr_auto] sm:items-end">
                  <div className="space-y-2">
                    <Label htmlFor="unit-section">Section</Label>
                    <Select value={form.section} onValueChange={(value) => value && setForm({ ...form, section: value })}>
                      <SelectTrigger id="unit-section" className="sm:w-48">
                        <SelectValue />
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
                  <div className="space-y-2">
                    <Label htmlFor="unit-title">New {entry.level} unit</Label>
                    <Input
                      id="unit-title"
                      placeholder="e.g. Shopping"
                      maxLength={200}
                      value={form.title}
                      onChange={(event) => setForm({ ...form, title: event.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="unit-description">Description (optional)</Label>
                    <Input
                      id="unit-description"
                      maxLength={2000}
                      value={form.description}
                      onChange={(event) => setForm({ ...form, description: event.target.value })}
                    />
                  </div>
                  <Button type="submit" loading={busy} disabled={busy || !form.title.trim()} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add unit
                  </Button>
                </form>

                {entry.units.length === 0 ? (
                  <EmptyState icon={GraduationCap} title={`No ${entry.level} unit yet`} description="Add the first unit above." />
                ) : (
                  COURSE_SECTIONS.map((section) => {
                    const units = entry.units.filter((unit) => unit.section === section);
                    return (
                      <div key={section} className="overflow-hidden rounded-xl border bg-card shadow-sm">
                        <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2">
                          <h2 className="font-semibold">{COURSE_SECTION_TITLES[section]}</h2>
                          <span className="text-sm text-muted-foreground">
                            {units.length} unit{units.length === 1 ? '' : 's'}
                          </span>
                        </div>
                        {units.length === 0 ? (
                          <p className="px-4 py-3 text-sm text-muted-foreground">No unit in this section yet.</p>
                        ) : (
                          <ol className="divide-y">
                            {units.map((unit, index) => (
                              <li key={unit.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                                <span className="w-6 text-sm font-semibold text-muted-foreground">{index + 1}</span>
                                <Link to={`/content-manager/listening-course/${unit.id}`} className="min-w-0 flex-1 truncate font-medium hover:underline">
                                  {unit.title}
                                </Link>
                                <span className="text-sm text-muted-foreground">
                                  {unit.lessons} lesson
                                  {unit.lessons === 1 ? '' : 's'} · {unit.questions} check question
                                  {unit.questions === 1 ? '' : 's'}
                                </span>
                                <Status item={unit} />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label={`Move ${unit.title} up`}
                                  disabled={busy || index === 0}
                                  onClick={() =>
                                    run(
                                      () =>
                                        updateCourseItem(unit.id, {
                                          position: index,
                                        }),
                                      'Unit moved',
                                      'Could not move the unit',
                                    )
                                  }
                                >
                                  <ArrowUp className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label={`Move ${unit.title} down`}
                                  disabled={busy || index === units.length - 1}
                                  onClick={() =>
                                    run(
                                      () =>
                                        updateCourseItem(unit.id, {
                                          position: index + 2,
                                        }),
                                      'Unit moved',
                                      'Could not move the unit',
                                    )
                                  }
                                >
                                  <ArrowDown className="h-4 w-4" />
                                </Button>
                              </li>
                            ))}
                          </ol>
                        )}
                      </div>
                    );
                  })
                )}

                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed bg-card p-4">
                  <GraduationCap className="h-5 w-5 text-primary" />
                  {entry.levelTest ? (
                    <>
                      <Link to={`/content-manager/listening-course/${entry.levelTest.id}`} className="font-medium hover:underline">
                        {entry.levelTest.title}
                      </Link>
                      <span className="text-sm text-muted-foreground">{entry.levelTest.questions} questions</span>
                      <Status item={entry.levelTest} />
                    </>
                  ) : (
                    <>
                      <span className="text-sm text-muted-foreground">No {entry.level} level test yet. Learners take it to move up a level.</span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="ml-auto"
                        disabled={busy}
                        onClick={() =>
                          run(
                            () =>
                              createCourseItem({
                                level: entry.level,
                                type: CourseItemType.LEVEL_TEST,
                                title: `${entry.level} level test`,
                                description: '',
                              }),
                            'Level test created',
                            'Could not create the level test',
                          )
                        }
                      >
                        Create the level test
                      </Button>
                    </>
                  )}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </>
      )}
    </section>
  );
}
