import { useEffect, useState } from 'react';
import { BookOpenText, Headphones, Mic, PenLine } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Skeleton } from '../../../components/ui';
import { getCefrProfile } from '../api/progress-api.js';
import { cefrLabel, productiveDetail, receptiveDetail } from '../lib/cefr.js';

export function CefrProfileCard({ bare = false }) {
  const [profile, setProfile] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    getCefrProfile()
      .then((result) => active && setProfile(result.data.profile))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, []);

  if (failed) return null;
  const skills = profile
    ? [
        { key: 'listening', label: 'Listening', icon: Headphones, ...receptiveDetail(profile.listening) },
        { key: 'reading', label: 'Reading', icon: BookOpenText, ...receptiveDetail(profile.reading) },
        { key: 'speaking', label: 'Speaking', icon: Mic, ...productiveDetail(profile.speaking, { noun: 'open answers', to: '/student/practice/speaking' }) },
        { key: 'writing', label: 'Writing', icon: PenLine, ...productiveDetail(profile.writing, { noun: 'texts', to: '/student/practice/writing' }) },
      ]
    : [];

  return (
    <div className={bare ? 'space-y-3' : 'space-y-3 rounded-3xl border bg-card p-5 sm:p-6'}>
      <div className="flex items-baseline justify-between gap-2">
        {bare ? <h3 className="text-sm font-medium text-muted-foreground">CEFR level by skill</h3> : <h2 className="font-semibold">CEFR level by skill</h2>}
        <span className="text-xs text-muted-foreground">Your TOEIC goal stays the same.</span>
      </div>
      {!profile ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {skills.map((skill) => {
            const level = profile[skill.key].level;
            return (
              <div key={skill.key} className="space-y-1 rounded-2xl border bg-background p-3.5">
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <skill.icon className="h-4 w-4" />
                  {skill.label}
                </p>
                <p className={level ? 'text-2xl font-bold' : 'text-2xl font-bold text-muted-foreground'}>{cefrLabel(level)}</p>
                {skill.to ? (
                  <Link to={skill.to} className="block text-xs font-medium text-primary underline-offset-4 hover:underline">
                    {skill.text}
                  </Link>
                ) : (
                  <p className="text-xs text-muted-foreground">{skill.text}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
