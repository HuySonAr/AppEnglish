import { Link } from 'react-router-dom';
import { Button } from '../../../components/ui/button.jsx';

export function UnauthorizedPage() {
  return (
    <section className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <p className="text-7xl font-bold tracking-tight text-destructive/80">
        403
      </p>
      <h1 className="mt-4 text-3xl font-bold">Access denied</h1>
      <p className="mt-4 text-muted-foreground">
        Your account does not have permission to view this area.
      </p>
      <Button asChild className="mt-8">
        <Link to="/">Return to your dashboard</Link>
      </Button>
    </section>
  );
}