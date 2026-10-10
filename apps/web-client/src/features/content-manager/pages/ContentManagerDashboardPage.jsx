import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card.jsx';
import { Button } from '../../../components/ui/button.jsx';

export function ContentManagerDashboardPage() {
  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-widest text-primary">
          Content Manager dashboard
        </p>
        <h1 className="mt-3 text-3xl font-bold">Hello Content Manager</h1>
        <p className="mt-2 text-muted-foreground">
          Create units and lessons, write their vocabulary, fill-in exercises
          and lesson tests, then publish them for learners.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Units and lessons</CardTitle>
            <CardDescription>Create, order, edit and publish content</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/content-manager/units">Open</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
