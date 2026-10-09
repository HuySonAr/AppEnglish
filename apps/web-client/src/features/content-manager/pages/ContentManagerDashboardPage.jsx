import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card.jsx';
import { Button } from '../../../components/ui/button.jsx';
import { FileText, Edit, Library } from 'lucide-react';

export function ContentManagerDashboardPage() {
  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-widest text-primary">
          Content Manager dashboard
        </p>
        <h1 className="mt-3 text-3xl font-bold">Hello Content Manager</h1>
        <p className="mt-2 text-muted-foreground">
          Content management tools will appear here when the content feature is
          implemented.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Content Library</CardTitle>
            <CardDescription>Browse and manage all content</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" disabled>Coming soon</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Create Content</CardTitle>
            <CardDescription>Add new lessons and materials</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" disabled>Coming soon</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Review Queue</CardTitle>
            <CardDescription>Review pending submissions</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" disabled>Coming soon</Button>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}