import { BookOpen, Headphones, LineChart } from 'lucide-react';
import { Outlet } from 'react-router-dom';
import { Brand } from './components/Brand.jsx';
import { ThemeToggle } from './components/ThemeToggle.jsx';

const highlights = [
  {
    icon: BookOpen,
    title: 'Reading',
    text: 'Build vocabulary and comprehension lesson by lesson.',
  },
  {
    icon: Headphones,
    title: 'Listening',
    text: 'Train your ear with audio in every lesson test.',
  },
  {
    icon: LineChart,
    title: 'Progress',
    text: 'Unlock the next lesson as you pass each test.',
  },
];

export function AuthLayout() {
  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-primary text-primary-foreground lg:flex lg:flex-col lg:justify-between lg:p-12">
        <p className="relative text-lg font-semibold tracking-tight">
          AppEnglish
        </p>
        <div className="relative space-y-8">
          <h2 className="max-w-md text-4xl font-bold leading-tight">
            Reading and Listening, one lesson at a time.
          </h2>
          <ul className="space-y-5">
            {highlights.map((item) => (
              <li key={item.title} className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
                  <item.icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-semibold">{item.title}</p>
                  <p className="text-sm text-primary-foreground/80">
                    {item.text}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-primary-foreground/70">
          Learn at your own pace.
        </p>
      </aside>
      <main className="flex min-h-screen flex-col">
        <header className="flex items-center justify-between px-6 py-5">
          <Brand to="/login" />
          <ThemeToggle />
        </header>
        <div className="flex flex-1 items-center justify-center px-4 pb-12 sm:px-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
