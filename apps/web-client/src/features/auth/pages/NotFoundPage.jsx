import { Link } from 'react-router-dom';
import { Button } from '../../../components/ui/button.jsx';

export function NotFoundPage() {
  return (
    <section className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <p className="text-7xl font-bold tracking-tight text-primary/70">
        404
      </p>
      <h1 className="mt-4 text-3xl font-bold">Page not found</h1>
      <Button asChild className="mt-8">
        <Link to="/">Return home</Link>
      </Button>
    </section>
  );
}