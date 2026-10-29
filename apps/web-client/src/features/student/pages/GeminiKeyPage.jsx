import { ExternalLink } from 'lucide-react';
import { PageBreadcrumb } from '../../../components/shared/PageBreadcrumb.jsx';
import { PageHeader } from '../../../components/shared/PageHeader.jsx';
import { GeminiKeyCard } from '../components/GeminiKeyCard.jsx';

const steps = [
  { title: 'Open Google AI Studio', detail: 'Sign in with your Google account.', link: 'https://aistudio.google.com/app/apikey' },
  { title: 'Create an API key', detail: 'Choose "Create API key" and copy it.' },
  { title: 'Paste it below', detail: 'We check it once and keep it encrypted.' },
];

export function GeminiKeyPage() {
  return (
    <section className="space-y-6">
      <PageBreadcrumb items={[{ label: 'Profile', to: '/student/profile' }, { label: 'Gemini key' }]} />
      <PageHeader eyebrow="Writing" title="Get your Gemini key" description="Follow three steps to have your writing scored." />
      <ol className="grid gap-3 md:grid-cols-3">
        {steps.map((step, index) => (
          <li key={step.title} className="flex gap-3 rounded-2xl border bg-card p-4 shadow-xs">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{index + 1}</span>
            <div className="min-w-0 space-y-1">
              <p className="font-medium">{step.title}</p>
              <p className="text-sm text-muted-foreground">{step.detail}</p>
              {step.link ? (
                <a href={step.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline">
                  aistudio.google.com
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
      <div className="max-w-2xl">
        <GeminiKeyCard showGuideLink={false} />
      </div>
    </section>
  );
}
