import { Link } from 'react-router-dom';
import { Button } from '../../../components/ui/button.jsx';

export function UnauthorizedPage() {
  return (
    <section className="mx-auto max-w-xl px-6 py-20 text-center">
      <p className="text-sm font-semibold uppercase tracking-widest text-destructive">
        403
      </p>
      <h1 className="mt-3 text-4xl font-bold">Access denied</h1>
      <p className="mt-4 text-muted-foreground">
        Your account does not have permission to view this area.
      </p>
      <Button variant="link" asChild className="mt-8">
        <Link to="/">Return to your dashboard</Link>
      </Button>
    </section>
  );
}