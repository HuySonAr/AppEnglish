import { useEffect, useState } from 'react';
import { Compass, Plus } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { COURSE_LEVELS, COURSE_LIMITS, CourseItemType } from '@appenglish/content-contracts';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { Badge, Button } from '../../../components/ui';
import { EmptyState } from '../../../components/shared/EmptyState.jsx';
import { PageHeader } from '../../../components/shared/PageHeader.jsx';
import { RowsSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { createCourseItem, listListeningCourse } from '../api/content-api.js';

export const placementEditorPath = (placementId) => `/content-manager/listening-course/${placementId}`;

// The listening placement (F05C, D103) for a Content Manager, on its own page
// apart from the course's levels (D108): the one placement with its status,
// or the button that creates it and opens its editor.
export function CoursePlacementManagePage() {
  const navigate = useNavigate();
  const [state, setState] = useState('loading');
  const [placement, setPlacement] = useState(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setState('loading');
    try {
      setPlacement((await listListeningCourse()).data.placement);
      setState('ready');
    } catch (error) {
      setState('error');
      notify({ title: 'Could not load the listening placement', description: getApiErrorMessage(error), variant: 'destructive' });
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    setBusy(true);
    try {
      const { data } = await createCourseItem({ level: null, type: CourseItemType.PLACEMENT, title: 'Listening placement', description: '' });
      notify({ title: 'Placement created' });
      navigate(placementEditorPath(data.item.id));
    } catch (error) {
      notify({ title: 'Could not create the placement', description: getApiErrorMessage(error), variant: 'destructive' });
      setBusy(false);
    }
  }

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Content Manager"
        title="Listening placement"
        description={`Learners take it once, before the Listening course, to find the level they start at. Give each recording the level it tests, with at least ${COURSE_LIMITS.placementQuestionsPerLevel} questions for every level from ${COURSE_LEVELS[0]} to ${COURSE_LEVELS[COURSE_LEVELS.length - 1]}.`}
      />

      {state === 'loading' ? (
        <RowsSkeleton rows={1} />
      ) : state === 'error' ? (
        <Button variant="outline" onClick={load}>
          Try again
        </Button>
      ) : placement ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4 shadow-sm">
          <Compass className="h-5 w-5 text-primary" />
          <Link to={placementEditorPath(placement.id)} className="font-medium hover:underline">
            {placement.title}
          </Link>
          <span className="text-sm text-muted-foreground">
            {placement.questions} questions · {placement.levels} of {COURSE_LEVELS.length} levels
          </span>
          {placement.publishedVersionNumber ? (
            <Badge variant="success">Published v{placement.publishedVersionNumber}</Badge>
          ) : (
            <Badge variant="outline">Not published</Badge>
          )}
          {placement.hasDraft ? <Badge variant="warning">Draft</Badge> : null}
          <Button asChild variant="outline" size="sm" className="ml-auto">
            <Link to={placementEditorPath(placement.id)}>Open</Link>
          </Button>
        </div>
      ) : (
        <EmptyState
          icon={Compass}
          title="No listening placement yet"
          description="There is one placement for the whole course. Create it, then add a recording with questions for each level."
          action={
            <Button loading={busy} disabled={busy} onClick={create} className="gap-2">
              <Plus className="h-4 w-4" />
              Create the placement
            </Button>
          }
        />
      )}
    </section>
  );
}
