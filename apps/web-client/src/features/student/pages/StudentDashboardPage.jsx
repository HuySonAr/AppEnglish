import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card.jsx';
import { Button } from '../../../components/ui/button.jsx';
import { BookOpen, Headphones, Trophy } from 'lucide-react';

export function StudentDashboardPage() {
  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-widest text-primary">
          Student dashboard
        </p>
        <h1 className="mt-3 text-3xl font-bold">Welcome to AppEnglish</h1>
        <p className="mt-2 max-w-xl text-muted-foreground">
          Your Reading and Listening learning space is ready. Lessons and progress
          will appear here when those features are available.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reading</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Coming soon</div>
            <p className="text-xs text-muted-foreground">Practice reading comprehension</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Listening</CardTitle>
            <Headphones className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Coming soon</div>
            <p className="text-xs text-muted-foreground">Improve listening skills</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Progress</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Coming soon</div>
            <p className="text-xs text-muted-foreground">Track your learning journey</p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}