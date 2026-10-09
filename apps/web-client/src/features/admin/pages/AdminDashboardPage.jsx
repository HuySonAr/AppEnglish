import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card.jsx';
import { Button } from '../../../components/ui/button.jsx';
import { Link } from 'react-router-dom';

export function AdminDashboardPage() {
  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-widest text-primary">
          Admin dashboard
        </p>
        <h1 className="mt-3 text-3xl font-bold">Hello Admin</h1>
        <p className="mt-2 text-muted-foreground">
          Administrative tools will appear here when the relevant product features
          are implemented.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Account Management</CardTitle>
            <CardDescription>View and manage user accounts</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link to="/admin/accounts">Open accounts</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Content Management</CardTitle>
            <CardDescription>Manage learning content (coming soon)</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" disabled>Coming soon</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>System Health</CardTitle>
            <CardDescription>Monitor service status (coming soon)</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" disabled>Coming soon</Button>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}